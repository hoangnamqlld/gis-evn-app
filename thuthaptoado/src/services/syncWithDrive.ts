// src/services/syncWithDrive.ts
import driveAuthService from './driveAuthService';
import drivePhotoService from './drivePhotoService';
import { GridAsset } from '../types';

class DriveUploadService {
  private accessToken: string | null = null;

  /**
   * Set access token
   */
  setAccessToken(token: string) {
    this.accessToken = token;
    console.log('✅ Đã set access token');
  }

  /**
   * Đồng bộ assets lên Drive
   */
  async syncAssetsToDrive(assets: GridAsset[]): Promise<{
    success: number;
    failed: number;
  }> {
    let success = 0;
    let failed = 0;

    try {
      // Lấy token nếu chưa có
      if (!this.accessToken) {
        this.accessToken = await driveAuthService.getAccessToken();
      }

      for (const asset of assets) {
        try {
          // Upload ảnh của asset
          if (asset.photoUrls && asset.photoUrls.length > 0) {
            const newUrls = await drivePhotoService.uploadAssetPhotos(
              asset,
              asset.photoUrls
            );
            
            if (newUrls.length > 0) {
              success++;
            } else {
              failed++;
            }
          } else {
            // Không có ảnh để upload
            success++;
          }
        } catch (error) {
          console.error(`Lỗi upload asset ${asset.code}:`, error);
          failed++;
        }
      }

      console.log(`✅ Đã upload ${success} assets, ${failed} lỗi`);
      
      return { success, failed };

    } catch (error) {
      console.error('❌ Lỗi đồng bộ Drive:', error);
      return { success: 0, failed: assets.length };
    }
  }

  /**
   * Kiểm tra kết nối Drive
   */
  async checkConnection(): Promise<boolean> {
    try {
      const token = await driveAuthService.getAccessToken();
      return !!token;
    } catch {
      return false;
    }
  }
}

export default new DriveUploadService();