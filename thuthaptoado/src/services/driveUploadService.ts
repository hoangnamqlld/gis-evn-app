// services/driveUploadService.ts
import driveAuthService from './driveAuthService';

interface UploadOptions {
  maxRetries?: number;
  initialDelay?: number;
  onProgress?: (progress: number) => void;
}

class DriveUploadService {
  /**
   * Tạo folder trên Drive
   */
  async createFolder(folderName: string, parentId?: string): Promise<string> {
    const token = await driveAuthService.getAccessToken();
    
    const metadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    if (parentId) {
      metadata.parents = [parentId];
    }
    
    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    if (!response.ok) {
      throw new Error(`Lỗi tạo folder: ${response.status}`);
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Tìm folder theo tên
   */
  async findFolder(folderName: string, parentId?: string): Promise<string | null> {
    const token = await driveAuthService.getAccessToken();
    
    let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }
    
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    return data.files?.[0]?.id || null;
  }

  /**
   * Lấy hoặc tạo folder
   */
  async getOrCreateFolder(folderName: string, parentId?: string): Promise<string> {
    const existing = await this.findFolder(folderName, parentId);
    if (existing) return existing;
    
    return this.createFolder(folderName, parentId);
  }

  /**
   * Upload file lên Drive
   */
  async uploadFile(
    file: File,
    folderId: string,
    options: UploadOptions = {}
  ): Promise<string> {
    const { maxRetries = 3, initialDelay = 1000, onProgress } = options;
    const token = await driveAuthService.getAccessToken();

    // Tạo metadata
    const metadata = {
      name: file.name,
      parents: [folderId]
    };

    // Tạo form data
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { 
      type: 'application/json' 
    }));
    form.append('file', file);

    // Upload với retry
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const xhr = new XMLHttpRequest();
        
        const uploadPromise = new Promise<string>((resolve, reject) => {
          xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);

          if (onProgress) {
            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                const percent = Math.round((e.loaded * 100) / e.total);
                onProgress(percent);
              }
            });
          }

          xhr.onload = () => {
            if (xhr.status === 200) {
              const data = JSON.parse(xhr.responseText);
              resolve(data.id);
            } else {
              reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
            }
          };

          xhr.onerror = () => reject(new Error('Network error'));
          xhr.send(form);
        });

        return await uploadPromise;

      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        
        if (isLastAttempt) {
          console.error(`❌ Upload thất bại sau ${maxRetries} lần thử:`, error);
          throw error;
        }

        // Exponential backoff
        const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`⏳ Retry ${attempt + 1}/${maxRetries} sau ${Math.round(delay)}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Upload failed');
  }

  /**
   * Upload nhiều file
   */
  async uploadMultipleFiles(
    files: { file: File; assetCode: string }[],
    folderId: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<{
    success: number;
    failed: number;
    results: { assetCode: string; fileId?: string; error?: string }[];
  }> {
    const results: { assetCode: string; fileId?: string; error?: string }[] = [];
    const BATCH_SIZE = 2; // Upload 2 file mỗi lần
    const DELAY_BETWEEN_BATCHES = 2000;

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      
      for (const { file, assetCode } of batch) {
        try {
          const fileId = await this.uploadFile(file, folderId, {
            onProgress: (percent) => {
              console.log(`${assetCode}: ${percent}%`);
            }
          });
          results.push({ assetCode, fileId });
        } catch (error) {
          results.push({ 
            assetCode, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      if (onProgress) {
        onProgress(Math.min(i + BATCH_SIZE, files.length), files.length);
      }

      if (i + BATCH_SIZE < files.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    const success = results.filter(r => r.fileId).length;
    const failed = results.filter(r => r.error).length;

    return { success, failed, results };
  }
}

export default new DriveUploadService();