// src/services/firebase/poleService.ts
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from './config';
import { GridAsset } from '../../types';

class PoleService {
  private collectionName = 'poles';

  async createPole(asset: GridAsset, userId: string) {
    try {
      const poleData = {
      code: asset.code || '',
      name: asset.name || '',
      type: asset.type,
      location: {
        lat: asset.coords.lat,
        lng: asset.coords.lng,
        x_vn2000: asset.coords.x_vn2000 || 0,
        y_vn2000: asset.coords.y_vn2000 || 0,
        address: asset.address || ''
      },
      technical: {
        // 👇 SỬA TẠI ĐÂY: Đảm bảo notes luôn là chuỗi, không phải undefined
        notes: asset.notes || '' 
      },
      photoUrls: asset.photoUrls || [],
      metadata: {
        unit: asset.unit || 'UNKNOWN',
        createdBy: asset.collectorName || userId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      status: asset.status || 'Draft'
    };

      const docRef = await addDoc(collection(db, this.collectionName), poleData);
      console.log(`✅ Đã tạo pole với ID: ${docRef.id}`);
      return { id: docRef.id, ...poleData };
    } catch (error) {
      console.error('❌ Lỗi tạo pole:', error);
      throw error;
    }
  }

  async getPolesByUnit(unit: string) {
    try {
      const q = query(
        collection(db, this.collectionName), 
        where('metadata.unit', '==', unit)
      );
      const querySnapshot = await getDocs(q);
      const poles: any[] = [];
      
      querySnapshot.forEach((doc) => {
        poles.push({ id: doc.id, ...doc.data() });
      });
      
      return poles;
    } catch (error) {
      console.error('❌ Lỗi lấy poles:', error);
      return [];
    }
  }

  async updatePole(id: string, data: Partial<GridAsset>) {
    try {
      const poleRef = doc(db, this.collectionName, id);
      await updateDoc(poleRef, {
        ...data,
        'metadata.updatedAt': new Date()
      });
      return true;
    } catch (error) {
      console.error('❌ Lỗi cập nhật pole:', error);
      return false;
    }
  }

  async deletePole(id: string) {
    try {
      await deleteDoc(doc(db, this.collectionName, id));
      return true;
    } catch (error) {
      console.error('❌ Lỗi xóa pole:', error);
      return false;
    }
  }
}

export default new PoleService();