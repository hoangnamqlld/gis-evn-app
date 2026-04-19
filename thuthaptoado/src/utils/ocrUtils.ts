// src/utils/ocrUtils.ts
import Tesseract from 'tesseract.js';

export interface OCRResult {
  poleNumber: string;
  confidence: number;
  text: string;
  alternatives: string[];
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Định nghĩa enum PSM (Page Segmentation Mode)
enum PSM {
  OSD_ONLY = '0',
  AUTO_OSD = '1',
  AUTO_ONLY = '2',
  AUTO = '3',
  SINGLE_COLUMN = '4',
  SINGLE_BLOCK_VERT_TEXT = '5',
  SINGLE_BLOCK = '6',
  SINGLE_LINE = '7',
  SINGLE_WORD = '8',
  CIRCLE_WORD = '9',
  SINGLE_CHAR = '10',
  SPARSE_TEXT = '11',
  SPARSE_TEXT_OSD = '12',
  RAW_LINE = '13'
}

class OCRService {
  private static instance: OCRService;
  private worker: Tesseract.Worker | null = null;
  private isInitialized = false;

  static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  /**
   * Khởi tạo worker Tesseract
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      console.log('🔄 Đang khởi tạo OCR...');
      
      // Tạo worker với ngôn ngữ tiếng Việt
      this.worker = await Tesseract.createWorker('vie');
      
      // Set parameters với giá trị đúng kiểu
      await this.worker.setParameters({
        // Sử dụng số (number) thay vì string
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-',
        // PSM phải là string, nhưng Tesseract.js chấp nhận cả string và number
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK, // Sử dụng enum thay vì string literal
        preserve_interword_spaces: '0',
      });
      
      this.isInitialized = true;
      console.log('✅ OCR đã sẵn sàng');
    } catch (error) {
      console.error('❌ Lỗi khởi tạo OCR:', error);
      throw error;
    }
  }

  /**
   * Nhận dạng số trụ từ ảnh (dùng URL)
   */
  async recognizePoleNumber(imageUrl: string): Promise<OCRResult | null> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('🔍 Bắt đầu OCR trên ảnh:', imageUrl);
      
      const result = await this.worker!.recognize(imageUrl);
      const text = result.data.text.toUpperCase().trim();
      
      console.log('📝 OCR text:', text);

      // Trích xuất số trụ
      const poleNumber = this.extractPoleNumber(text);
      
      // Tìm tất cả các số
      const alternatives = this.extractAllNumbers(text);

      return {
        poleNumber: poleNumber || '',
        confidence: result.data.confidence / 100,
        text,
        alternatives
      };
    } catch (error) {
      console.error('❌ Lỗi OCR:', error);
      return null;
    }
  }

  /**
   * Nhận dạng số trụ từ base64 image
   */
  async recognizeFromBase64(base64Image: string): Promise<OCRResult | null> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('🔍 Bắt đầu OCR trên base64 image...');
      
      const result = await this.worker!.recognize(base64Image);
      const text = result.data.text.toUpperCase().trim();
      
      console.log('📝 OCR text:', text);

      // Trích xuất số trụ
      const poleNumber = this.extractPoleNumber(text);
      
      // Tìm tất cả các số
      const alternatives = this.extractAllNumbers(text);

      return {
        poleNumber: poleNumber || '',
        confidence: result.data.confidence / 100,
        text,
        alternatives
      };
    } catch (error) {
      console.error('❌ Lỗi OCR:', error);
      return null;
    }
  }

  /**
   * Trích xuất số trụ từ text
   */
  private extractPoleNumber(text: string): string | null {
    // Pattern: TRU 123, TRỤ 123, P123, T123, số có 3-5 chữ số
    const patterns = [
      /TR[UỤ]\s*(\d{3,5})/i,
      /C[O]?T?\s*(\d{3,5})/i,
      /P[O]?L[E]?\s*(\d{3,5})/i,
      /(\d{3,5})/,
      /[A-Z]{1,2}[-]?(\d{3,5})/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    
    return null;
  }

  /**
   * Trích xuất tất cả các số
   */
  private extractAllNumbers(text: string): string[] {
    return (text.match(/\d{3,}/g) || []);
  }

  /**
   * Nhận dạng nhiều ảnh cùng lúc
   */
  async recognizeMultiple(images: string[]): Promise<OCRResult[]> {
    const results: OCRResult[] = [];
    
    for (let i = 0; i < images.length; i++) {
      console.log(`🔍 Đang xử lý ảnh ${i + 1}/${images.length}`);
      const result = await this.recognizeFromBase64(images[i]);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }

  /**
   * Lấy kết quả OCR có độ tin cậy cao nhất
   */
  getBestResult(results: OCRResult[]): OCRResult | null {
    if (results.length === 0) return null;
    
    return results.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
  }

  /**
   * Kiểm tra xem có phải số trụ không
   */
  isValidPoleNumber(text: string): boolean {
    // Số trụ thường có 3-5 chữ số
    return /^\d{3,5}$/.test(text.trim());
  }

  /**
   * Kết thúc worker
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      console.log('🛑 OCR worker đã kết thúc');
    }
  }
}

// Export singleton instance
const ocrService = OCRService.getInstance();
export default ocrService;