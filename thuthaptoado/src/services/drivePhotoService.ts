// src/services/drivePhotoService.ts
import { GridAsset } from '../types';
import driveAuthService from './driveAuthService'; // 👈 THÊM IMPORT

class DrivePhotoService {
  private baseFolderId: string;

  constructor() {
    // Lấy baseFolderId từ environment một cách an toàn
    const getEnvVar = (key: string, defaultValue: string = ''): string => {
      try {
        if (typeof import.meta !== 'undefined' && import.meta.env) {
          return import.meta.env[key] || defaultValue;
        }
        if (typeof process !== 'undefined' && process.env) {
          return process.env[key] || defaultValue;
        }
      } catch (error) {
        console.warn(`⚠️ Không thể đọc biến môi trường ${key}:`, error);
      }
      return defaultValue;
    };

    this.baseFolderId = getEnvVar('VITE_GOOGLE_DRIVE_FOLDER_ID', '');
    
    if (!this.baseFolderId) {
      console.warn('⚠️ VITE_GOOGLE_DRIVE_FOLDER_ID chưa được cấu hình');
    }
  }
  
  /**
   * Upload ảnh của asset lên Google Drive
   */
  async uploadAssetPhotos(asset: GridAsset, photos: string[]): Promise<string[]> {
    const uploadedUrls: string[] = [];
    
    try {
      // Kiểm tra đăng nhập Drive
      if (!driveAuthService.isAuthenticated()) {
        throw new Error('Chưa đăng nhập Google Drive');
      }

      if (!this.baseFolderId) {
        throw new Error('Chưa cấu hình Google Drive Folder ID');
      }
      
      console.log(`📤 Đang upload ${photos.length} ảnh cho asset ${asset.code}...`);
      
      // Tạo folder cho đơn vị nếu chưa có
      const unitFolderId = await this.getOrCreateFolder(
        this.baseFolderId,
        asset.unit
      );
      
      // Tạo folder cho ngày thu thập
      const dateStr = new Date(asset.timestamp).toISOString().split('T')[0];
      const dateFolderId = await this.getOrCreateFolder(unitFolderId, dateStr);
      
      // Upload từng ảnh
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        if (photo.startsWith('data:')) {
          const fileName = `${asset.code}_${i+1}_${Date.now()}.jpg`;
          console.log(`📤 Đang upload ảnh ${i+1}/${photos.length}: ${fileName}`);
          
          const fileId = await this.uploadFile(photo, fileName, dateFolderId);
          const fileUrl = `https://drive.google.com/uc?id=${fileId}`;
          uploadedUrls.push(fileUrl);
          
          console.log(`✅ Đã upload ảnh ${i+1}: ${fileUrl}`);
        } else {
          // Nếu đã là URL thì giữ nguyên
          uploadedUrls.push(photo);
        }
      }
      
      console.log(`✅ Đã upload ${uploadedUrls.length}/${photos.length} ảnh thành công`);
      
    } catch (error) {
      console.error('❌ Lỗi upload ảnh:', error);
      throw error;
    }
    
    return uploadedUrls;
  }
  
  /**
   * Upload một file lên Google Drive
   */
  private async uploadFile(base64: string, fileName: string, folderId: string): Promise<string> {
    try {
      // Chuyển base64 sang blob
      const blob = this.base64ToBlob(base64);
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      
      // Tạo form data
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify({
        name: fileName,
        parents: [folderId]
      })], { type: 'application/json' }));
      formData.append('file', file);
      
      // Lấy access token
      const token = await driveAuthService.getAccessToken();
      
      // Upload lên Drive
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }
      
      const data = await response.json();
      return data.id;
      
    } catch (error) {
      console.error(`❌ Lỗi upload file ${fileName}:`, error);
      throw error;
    }
  }
  
  /**
   * Chuyển base64 sang Blob
   */
  private base64ToBlob(base64: string): Blob {
    try {
      // Xử lý cả trường hợp có data:image/jpeg;base64, và không có
      let base64Data = base64;
      let mimeType = 'image/jpeg';
      
      if (base64.includes(',')) {
        const matches = base64.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          base64Data = matches[2];
        }
      }
      
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: mimeType });
      
    } catch (error) {
      console.error('❌ Lỗi chuyển base64 sang blob:', error);
      throw error;
    }
  }
  
  /**
   * Tạo hoặc lấy folder ID
   */
  private async getOrCreateFolder(parentId: string, folderName: string): Promise<string> {
    try {
      console.log(`📁 Đang tìm folder: ${folderName} trong parent: ${parentId}`);
      
      const token = await driveAuthService.getAccessToken();
      
      // Kiểm tra folder đã tồn tại chưa
      const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!searchResponse.ok) {
        throw new Error(`HTTP ${searchResponse.status}`);
      }
      
      const searchData = await searchResponse.json();
      
      if (searchData.files && searchData.files.length > 0) {
        console.log(`✅ Đã tìm thấy folder: ${folderName} (ID: ${searchData.files[0].id})`);
        return searchData.files[0].id;
      }
      
      // Tạo folder mới
      console.log(`📁 Đang tạo folder mới: ${folderName}`);
      
      const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId]
        })
      });
      
      if (!createResponse.ok) {
        const error = await createResponse.text();
        throw new Error(`HTTP ${createResponse.status}: ${error}`);
      }
      
      const createData = await createResponse.json();
      console.log(`✅ Đã tạo folder: ${folderName} (ID: ${createData.id})`);
      
      return createData.id;
      
    } catch (error) {
      console.error(`❌ Lỗi tạo/tìm folder ${folderName}:`, error);
      throw error;
    }
  }
  
  /**
   * Xóa ảnh khỏi Drive
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const token = await driveAuthService.getAccessToken();
      
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.ok;
      
    } catch (error) {
      console.error('❌ Lỗi xóa file:', error);
      return false;
    }
  }
  
  /**
   * Lấy danh sách ảnh trong folder
   */
  async listFilesInFolder(folderId: string): Promise<any[]> {
    try {
      const token = await driveAuthService.getAccessToken();
      const query = `'${folderId}' in parents and trashed=false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink)`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return data.files || [];
      
    } catch (error) {
      console.error('❌ Lỗi lấy danh sách file:', error);
      return [];
    }
  }
}

// Export singleton instance
const drivePhotoService = new DrivePhotoService();
export default drivePhotoService;