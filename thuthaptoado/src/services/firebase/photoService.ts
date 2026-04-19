// src/services/firebase/photoService.ts
import { storage } from './config';
import { ref, uploadString, getDownloadURL, listAll } from 'firebase/storage';

class PhotoService {
  async uploadPhoto(assetCode: string, base64: string): Promise<string | null> {
    try {
      if (!storage) {
        console.warn('⚠️ Storage not available');
        return base64;
      }

      const fileName = `${assetCode}_${Date.now()}.jpg`;
      const storageRef = ref(storage, `poles/${assetCode}/${fileName}`);
      
      const snapshot = await uploadString(storageRef, base64, 'data_url');
      const downloadUrl = await getDownloadURL(snapshot.ref);
      
      return downloadUrl;
    } catch (error) {
      console.error('❌ Lỗi upload photo:', error);
      return base64; // Fallback to base64
    }
  }

  async getPhotos(assetCode: string): Promise<string[]> {
    try {
      const folderRef = ref(storage, `poles/${assetCode}`);
      const result = await listAll(folderRef);
      
      const urls = await Promise.all(
        result.items.map(async (itemRef) => {
          return await getDownloadURL(itemRef);
        })
      );
      
      return urls;
    } catch (error) {
      console.error('❌ Lỗi lấy photos:', error);
      return [];
    }
  }
}

export default new PhotoService();