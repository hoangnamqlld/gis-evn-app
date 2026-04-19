import syncQueueService from './syncQueueService';

class PhotoStorageService {
  async compressImage(base64: string, quality: number): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
    });
  }

  async savePhoto(photoId: string, base64: string): Promise<void> {
    const compressed = await this.compressImage(base64, 0.7);
    localStorage.setItem(`photo_${photoId}`, compressed);
  }

  async getPhoto(photoId: string): Promise<string | null> {
    return localStorage.getItem(`photo_${photoId}`);
  }

  async uploadToQueue(asset: any, photos: string[]): Promise<void> {
    await syncQueueService.addToQueue({
      type: 'photo',
      data: { asset, photos }
    });
  }
}

export default new PhotoStorageService();