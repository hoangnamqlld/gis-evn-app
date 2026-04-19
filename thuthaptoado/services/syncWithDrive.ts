// services/syncWithDrive.ts
import driveAuthService from './driveAuthService';
import driveUploadService from './driveUploadService';
import { GridAsset } from '../types';

class SyncWithDriveService {
  /**
   * Đồng bộ ảnh lên Drive
   */
  async syncPhotos(assets: GridAsset[]): Promise<{
    success: boolean;
    message: string;
    failed: number;
  }> {
    try {
      // Lấy access token
      const token = await driveAuthService.getAccessToken();
      driveUploadService.setAccessToken(token);

      // Tạo folder cho ngày hôm nay
      const today = new Date().toISOString().split('T')[0];
      const folderId = await this.getOrCreateFolder(today);

      // Gom tất cả ảnh cần upload
      const photos: { file: File; asset: GridAsset }[] = [];
      
      for (const asset of assets) {
        for (let i = 0; i < asset.photoUrls.length; i++) {
          const url = asset.photoUrls[i];
          if (url.startsWith('data:')) {
            // Chuyển base64 thành file
            const blob = this.dataURLtoBlob(url);
            const file = new File([blob], `${asset.code}_${i+1}.jpg`, {
              type: 'image/jpeg'
            });
            photos.push({ file, asset });
          }
        }
      }

      if (photos.length === 0) {
        return { success: true, message: 'Không có ảnh mới', failed: 0 };
      }

      console.log(`📸 Đang upload ${photos.length} ảnh...`);

      // Upload ảnh
      let failed = 0;
      for (const { file, asset } of photos) {
        try {
          await driveUploadService.uploadFile(file, folderId);
          console.log(`✅ ${asset.code}: ${file.name}`);
        } catch (error) {
          console.error(`❌ ${asset.code}: ${file.name}`, error);
          failed++;
        }
        
        // Delay nhẹ giữa các file
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return {
        success: failed === 0,
        message: `Upload ${photos.length - failed}/${photos.length} ảnh thành công`,
        failed
      };

    } catch (error) {
      console.error('❌ Lỗi đồng bộ Drive:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Lỗi không xác định',
        failed: 0
      };
    }
  }

  /**
   * Chuyển data URL thành Blob
   */
  private dataURLtoBlob(dataURL: string): Blob {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Tạo hoặc lấy folder theo tên
   */
  private async getOrCreateFolder(folderName: string): Promise<string> {
    const token = await driveAuthService.getAccessToken();
    
    // Tìm folder
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const searchData = await searchRes.json();
    
    if (searchData.files?.length > 0) {
      return searchData.files[0].id;
    }

    // Tạo folder mới
    const createUrl = 'https://www.googleapis.com/drive/v3/files';
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    const createData = await createRes.json();
    return createData.id;
  }
}

export default new SyncWithDriveService();