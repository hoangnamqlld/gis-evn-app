// src/services/firebase/safeStorage.ts
import { storage } from './config';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

class SafeStorage {
  async uploadPhoto(path: string, base64: string): Promise<string | null> {
    try {
      if (!storage) {
        console.warn('⚠️ Storage not available, using local fallback');
        return base64; // Fallback to base64
      }

      const storageRef = ref(storage, path);
      const snapshot = await uploadString(storageRef, base64, 'data_url');
      const url = await getDownloadURL(snapshot.ref);
      return url;
    } catch (error) {
      console.error('❌ Storage upload error:', error);
      return base64; // Fallback to base64
    }
  }

  isAvailable(): boolean {
    return storage !== null;
  }
}

export default new SafeStorage();