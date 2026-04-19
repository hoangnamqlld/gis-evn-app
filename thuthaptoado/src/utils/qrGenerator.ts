import QRCode from 'qrcode';
import { GridAsset } from '../types';

// Thêm import cho thư viện đọc QR code
import jsQR from 'jsqr';

interface QRData {
  id: string;
  code: string;
  type: string;
  url: string;
}

// Định nghĩa interface cho kết quả scan
interface ScanResult {
  id: string;
  code: string;
  type: string;
  url: string;
  rawData: string;
}

class QRGenerator {
  /**
   * Tạo dữ liệu QR từ asset
   */
  generateQRData(asset: GridAsset): QRData {
    return {
      id: asset.id,
      code: asset.code,
      type: asset.type,
      url: `https://your-app.com/asset/${asset.id}`
    };
  }

  /**
   * Tạo QR code từ dữ liệu
   */
  async generateQRCode(data: QRData): Promise<string> {
    try {
      const qrData = JSON.stringify(data);
      const url = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      return url;
    } catch (error) {
      console.error('Lỗi tạo QR code:', error);
      throw error;
    }
  }

  /**
   * Tạo và tải xuống QR code
   */
  async generateAndDownload(asset: GridAsset): Promise<void> {
    const qrData = this.generateQRData(asset);
    const qrUrl = await this.generateQRCode(qrData);
    
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `QR_${asset.code}.png`;
    link.click();
  }

  /**
   * QUAN TRỌNG: Đọc/Scan QR code từ ảnh
   * Method này được gọi từ useSmartCapture.ts
   */
  async scanQRCode(imageUrl: string): Promise<ScanResult | null> {
    try {
      console.log('🔍 Đang quét QR code từ ảnh...');
      
      // Tạo image element để load ảnh
      const img = await this.loadImage(imageUrl);
      
      // Tạo canvas để vẽ ảnh
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Không thể tạo canvas context');
      }
      
      // Set kích thước canvas bằng kích thước ảnh
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Vẽ ảnh lên canvas
      ctx.drawImage(img, 0, 0, img.width, img.height);
      
      // Lấy dữ liệu ảnh
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      
      // Sử dụng jsQR để đọc QR code
      const code = jsQR(imageData.data, img.width, img.height, {
        inversionAttempts: 'dontInvert',
      });
      
      if (code) {
        console.log('✅ Đã tìm thấy QR code:', code.data);
        
        // Parse dữ liệu QR (nếu là JSON)
        try {
          const parsed = JSON.parse(code.data);
          return {
            id: parsed.id || '',
            code: parsed.code || '',
            type: parsed.type || '',
            url: parsed.url || '',
            rawData: code.data
          };
        } catch {
          // Nếu không phải JSON, trả về raw data
          return {
            id: '',
            code: code.data,
            type: 'unknown',
            url: '',
            rawData: code.data
          };
        }
      }
      
      console.log('❌ Không tìm thấy QR code trong ảnh');
      return null;
      
    } catch (error) {
      console.error('Lỗi scan QR code:', error);
      return null;
    }
  }

  /**
   * Hỗ trợ: Đọc QR code từ base64 string
   */
  async scanQRCodeFromBase64(base64Image: string): Promise<ScanResult | null> {
    return this.scanQRCode(base64Image);
  }

  /**
   * Hỗ trợ: Load image từ URL hoặc base64
   */
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      
      img.onload = () => {
        resolve(img);
      };
      
      img.onerror = () => {
        reject(new Error(`Không thể load ảnh: ${src}`));
      };
      
      img.src = src;
    });
  }

  /**
   * Kiểm tra xem một string có phải là QR code data không
   */
  isValidQRData(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      return !!(parsed.id || parsed.code);
    } catch {
      return data.length > 0;
    }
  }
}

// Cài đặt thêm thư viện jsqr nếu chưa có
// npm install jsqr

export default new QRGenerator();