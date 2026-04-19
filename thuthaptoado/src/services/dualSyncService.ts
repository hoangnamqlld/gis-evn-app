// src/services/dualSyncService.ts
import { CloudService } from './cloudService';
import { GridAsset, PowerLine } from '../types';
import { db } from './firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

class DualSyncService {
  /**
   * Đồng bộ lên Firebase (cho queue service sử dụng)
   */
  async syncToFirebase(data: any): Promise<boolean> {
    try {
      console.log('🔥 syncToFirebase called with:', data);
      
      // Xử lý theo loại dữ liệu
      if (data.assets) {
        // Nếu là object có assets array
        for (const asset of data.assets) {
          await this.syncAssetToFirestore(asset, data.userId || 'system');
        }
        return true;
      } else if (Array.isArray(data)) {
        // Nếu là mảng assets
        for (const asset of data) {
          await this.syncAssetToFirestore(asset, 'system');
        }
        return true;
      } else if (data.asset) {
        // Nếu là single asset
        await this.syncAssetToFirestore(data.asset, data.userId || 'system');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Lỗi syncToFirebase:', error);
      throw error;
    }
  }

  /**
   * Đồng bộ một asset lên Firestore
   */
  private async syncAssetToFirestore(asset: GridAsset, userId: string) {
    try {
      console.log(`🔄 Đang sync asset ${asset.code} lên Firestore...`);
      
      // Chuẩn bị dữ liệu
      const assetData = {
        ...asset,
        userId: userId,
        syncedAt: serverTimestamp(),
        createdAt: new Date().toISOString(),
        // Chuyển đổi coordinates
        location: {
          lat: asset.coords.lat,
          lng: asset.coords.lng,
          x_vn2000: asset.coords.x_vn2000,
          y_vn2000: asset.coords.y_vn2000
        }
      };
      
      // Xóa trường không cần
      delete assetData.coords;
      delete assetData.status;
      
      // Thêm vào Firestore
      const docRef = await addDoc(collection(db, 'assets'), assetData);
      
      console.log(`✅ Đã sync asset ${asset.code} thành công! ID: ${docRef.id}`);
      return docRef.id;
      
    } catch (error) {
      console.error(`❌ Lỗi sync asset ${asset.code}:`, error);
      throw error;
    }
  }

  /**
   * Đồng bộ lên cả 2 hệ thống (song song)
   */
  async syncToBoth(
    assets: GridAsset[],
    lines: PowerLine[],
    projectId: string,
    unit: string,
    collector: string,
    userId: string
  ) {
    const results = {
      google: { success: false, message: '', sheetUrl: '', folderUrl: '' },
      firebase: { success: false, message: '' }
    };

    console.log('🔄 Bắt đầu đồng bộ song song...');
    console.log(`📦 Assets: ${assets.length}, Lines: ${lines.length}`);
    console.log(`📋 Đơn vị: ${unit}, Người thu thập: ${collector}`);

    // Đồng bộ lên Google Sheets
    try {
      console.log('📤 Đang đồng bộ lên Google Sheets...');
      const googleResult = await CloudService.syncToAdmin(
        assets, lines, projectId, unit, collector
      );
      
      results.google = {
        success: googleResult.success,
        message: googleResult.message || 'Đã đồng bộ Google Sheets',
        sheetUrl: googleResult.sheetUrl || '',
        folderUrl: googleResult.folderUrl || ''
      };
      
      console.log('✅ Google Sheets:', results.google.message);
      if (results.google.sheetUrl) {
        console.log('📊 URL Sheet:', results.google.sheetUrl);
      }
      if (results.google.folderUrl) {
        console.log('📁 URL Folder:', results.google.folderUrl);
      }
    } catch (error: any) {
      results.google = { 
        success: false, 
        message: error.message || 'Lỗi đồng bộ Google Sheets',
        sheetUrl: '',
        folderUrl: ''
      };
      console.error('❌ Google Sheets error:', error);
    }

    // Đồng bộ lên Firebase
    try {
      console.log('📤 Đang đồng bộ lên Firebase...');
      
      let firebaseSuccess = 0;
      
      for (const asset of assets) {
        try {
          // Kiểm tra asset có hợp lệ không
          if (!asset.code || !asset.coords) {
            console.warn('⚠️ Asset không hợp lệ:', asset.id);
            continue;
          }
          
          await this.syncAssetToFirestore(asset, userId);
          firebaseSuccess++;
          
        } catch (assetError) {
          console.error(`❌ Lỗi đồng bộ asset ${asset.code}:`, assetError);
        }
      }
      
      results.firebase = {
        success: firebaseSuccess > 0,
        message: `Đã đồng bộ ${firebaseSuccess}/${assets.length} assets lên Firebase`
      };
      
      console.log('✅ Firebase:', results.firebase.message);
      
    } catch (error: any) {
      results.firebase = { 
        success: false, 
        message: error.message || 'Lỗi đồng bộ Firebase' 
      };
      console.error('❌ Firebase error:', error);
    }

    // Log tổng kết
    console.log('📊 KẾT QUẢ ĐỒNG BỘ:');
    console.log('   - Google Sheets:', results.google.success ? '✅' : '❌', results.google.message);
    console.log('   - Firebase:', results.firebase.success ? '✅' : '❌', results.firebase.message);
    
    return results;
  }

  /**
   * Lấy dữ liệu từ Firebase
   */
  async fetchData(unit: string) {
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      const q = query(collection(db, 'assets'), where('unit', '==', unit));
      const snapshot = await getDocs(q);
      
      const assets = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          coords: data.location || { lat: 0, lng: 0 }
        } as GridAsset;
      });
      
      console.log(`📥 Đã lấy ${assets.length} assets từ Firebase cho đơn vị ${unit}`);
      return { success: true, assets, lines: [] };
      
    } catch (error) {
      console.error('❌ Lỗi fetch từ Firebase:', error);
      return { success: false, assets: [], lines: [] };
    }
  }

  /**
   * Kiểm tra kết nối Google Script
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await CloudService.testConnection();
      console.log('🔌 Test kết nối Google Script:', result);
      return result.success;
    } catch (error) {
      console.error('❌ Lỗi test kết nối:', error);
      return false;
    }
  }
}

// Export singleton instance
const dualSyncService = new DualSyncService();
export default dualSyncService;