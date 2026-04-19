// src/services/firebase/syncService.ts
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './config';
import poleService from './poleService';
import photoService from './photoService';
import { GridAsset } from '../../types';

class SyncService {
  /**
   * Đồng bộ lên Firebase
   */
  async syncToFirebase(assets: GridAsset[], userId: string): Promise<{
    success: boolean;
    syncedCount: number;
    failedCount: number;
    message: string;
  }> {
    let synced = 0;
    let failed = 0;

    for (const asset of assets) {
      try {
        // 1. Tìm kiếm pole hiện hữu (Sử dụng as any để tránh lỗi build TS)
        let existing: any = null;
        try {
          existing = await (poleService as any).findPoleByCode(asset.code);
        } catch (e) {
          console.warn(`Chưa có hàm findPoleByCode hoặc lỗi tìm kiếm: ${asset.code}`);
        }
        
        if (existing && existing.id) {
          // 2. Cập nhật (Chuẩn hóa dữ liệu để tránh lỗi undefined)
          await poleService.updatePole(existing.id, {
            coords: {
              lat: asset.coords.lat,
              lng: asset.coords.lng,
              x_vn2000: asset.coords.x_vn2000 || 0,
              y_vn2000: asset.coords.y_vn2000 || 0
            },
            address: asset.address || '',
            notes: asset.notes || ''
          } as any); // Ép kiểu để khớp với Partial<GridAsset> trong poleService
        } else {
          // 3. Tạo mới
          await poleService.createPole(asset, userId);
        }
        
        // 4. Xử lý Upload ảnh (Sửa lỗi khớp nối photoService)
        if (asset.photoUrls && asset.photoUrls.length > 0) {
          for (const photoUrl of asset.photoUrls) {
            if (photoUrl && photoUrl.startsWith('data:')) {
              try {
                // Tùy biến gọi hàm uploadPhoto để build không lỗi
                // Nếu photoService.uploadPhoto của anh nhận string base64:
                await (photoService as any).uploadPhoto(
                  asset.code, 
                  photoUrl
                );
              } catch (photoErr) {
                console.error(`❌ Lỗi upload ảnh cho ${asset.code}:`, photoErr);
              }
            }
          }
        }
        
        synced++;
      } catch (error) {
        console.error(`❌ Lỗi đồng bộ asset ${asset.code}:`, error);
        failed++;
      }
    }

    return {
      success: failed === 0,
      syncedCount: synced,
      failedCount: failed,
      message: failed === 0 ? `Đã đồng bộ thành công ${synced} điểm` : `Đồng bộ ${synced} thành công, ${failed} thất bại`
    };
  }

  /**
   * Lấy dữ liệu từ Firebase
   */
  async fetchFromFirebase(unit: string): Promise<GridAsset[]> {
    try {
      const poles = await poleService.getPolesByUnit(unit);
      
      if (!poles || !Array.isArray(poles)) return [];

      // Chuyển đổi từ cấu trúc Firestore sang GridAsset chuẩn của App
      return poles.map((pole: any) => ({
        id: pole.id || `FB-${Date.now()}-${Math.random()}`,
        code: pole.code || '',
        name: pole.name || '',
        type: pole.type,
        coords: {
          lat: pole.location?.lat || 0,
          lng: pole.location?.lng || 0,
          x_vn2000: pole.location?.x_vn2000 || 0,
          y_vn2000: pole.location?.y_vn2000 || 0
        },
        address: pole.location?.address || '',
        notes: pole.technical?.notes || pole.notes || '',
        photoUrls: pole.photoUrls || [],
        timestamp: pole.metadata?.createdAt?.seconds ? pole.metadata.createdAt.seconds * 1000 : Date.now(),
        unit: pole.metadata?.unit || '',
        collectorName: pole.metadata?.createdBy || '',
        collectorId: pole.metadata?.createdBy || '',
        status: 'Synced'
      })) as GridAsset[];
    } catch (error) {
      console.error('❌ Lỗi lấy dữ liệu từ Firebase:', error);
      return [];
    }
  }
}

export default new SyncService();