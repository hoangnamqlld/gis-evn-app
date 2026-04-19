// src/hooks/useSmartCapture.ts
import { useState, useCallback } from 'react';
import ocrService from '../utils/ocrUtils';
import qrGenerator from '../utils/qrGenerator';
import { GridAsset } from '../types';

interface SmartCaptureState {
  isProcessing: boolean;
  progress: number;
  detectedPoleNumber: string | null;
  detectedQRData: any | null;
  error: string | null;
}

// Định nghĩa interface cho kết quả QR từ service
interface QRServiceResult {
  id: string;
  code: string;
  type: string;
  url: string;
  rawData?: string;
}

// Định nghĩa interface cho kết quả OCR từ service
interface OCRServiceResult {
  poleNumber: string;
  confidence: number;
  text: string;
  alternatives: string[];
}

// Định nghĩa kết quả trả về (dùng chung)
interface ProcessResult {
  type: 'qr' | 'ocr' | 'none';
  data: QRServiceResult | OCRServiceResult | null;
  asset: GridAsset | null;
}

export const useSmartCapture = () => {
  const [state, setState] = useState<SmartCaptureState>({
    isProcessing: false,
    progress: 0,
    detectedPoleNumber: null,
    detectedQRData: null,
    error: null
  });

  /**
   * Xử lý ảnh chụp: OCR + QR
   */
  const processImage = useCallback(async (
    imageUrl: string,
    existingAssets: GridAsset[]
  ): Promise<ProcessResult | null> => {
    setState(prev => ({ ...prev, isProcessing: true, progress: 0, error: null }));

    try {
      // Bước 1: Quét QR code trước (nhanh hơn)
      setState(prev => ({ ...prev, progress: 20 }));
      
      // Quét QR code
      let qrResult: QRServiceResult | null = null;
      try {
        if (typeof qrGenerator.scanQRCode === 'function') {
          const result = await qrGenerator.scanQRCode(imageUrl);
          if (result) {
            qrResult = {
              id: result.id || '',
              code: result.code || '',
              type: result.type || 'unknown',
              url: result.url || '',
              rawData: result.rawData
            };
          }
        }
      } catch (qrError) {
        console.log('Không tìm thấy QR code:', qrError);
      }
      
      if (qrResult) {
        const matchedAsset = existingAssets.find(a => 
          a.id === qrResult.id || a.code === qrResult.code
        );
        
        setState(prev => ({
          ...prev,
          isProcessing: false,
          progress: 100,
          detectedQRData: qrResult,
          detectedPoleNumber: qrResult.code
        }));
        
        return {
          type: 'qr',
          data: qrResult,
          asset: matchedAsset || null
        };
      }

      // Bước 2: OCR nếu không có QR
      setState(prev => ({ ...prev, progress: 40 }));
      
      let ocrResult: OCRServiceResult | null = null;
      try {
        if (typeof ocrService.recognizePoleNumber === 'function') {
          ocrResult = await ocrService.recognizePoleNumber(imageUrl);
        }
      } catch (ocrError) {
        console.log('Lỗi OCR:', ocrError);
      }
      
      if (ocrResult && ocrResult.poleNumber) {
        const matchedAsset = existingAssets.find(a => 
          a.code.includes(ocrResult.poleNumber) ||
          (ocrResult.poleNumber && ocrResult.poleNumber.includes(a.code))
        );

        setState(prev => ({
          ...prev,
          isProcessing: false,
          progress: 100,
          detectedPoleNumber: ocrResult.poleNumber
        }));

        return {
          type: 'ocr',
          data: ocrResult,
          asset: matchedAsset || null
        };
      }

      // Không tìm thấy
      setState(prev => ({
        ...prev,
        isProcessing: false,
        progress: 100
      }));
      
      return {
        type: 'none',
        data: null,
        asset: null
      };

    } catch (error) {
      console.error('Lỗi xử lý ảnh:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Lỗi xử lý ảnh'
      }));
      return null;
    }
  }, []);

  /**
   * Xử lý nhiều ảnh cùng lúc
   */
  const processMultipleImages = useCallback(async (
    imageUrls: string[],
    existingAssets: GridAsset[]
  ): Promise<ProcessResult[]> => {
    const results: ProcessResult[] = [];
    
    if (!imageUrls || imageUrls.length === 0) {
      return results;
    }
    
    for (let i = 0; i < imageUrls.length; i++) {
      const progress = Math.round(((i + 1) / imageUrls.length) * 100);
      setState(prev => ({ ...prev, progress }));
      
      try {
        const result = await processImage(imageUrls[i], existingAssets);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error(`Lỗi xử lý ảnh ${i + 1}:`, error);
      }
    }
    
    setState(prev => ({ ...prev, progress: 100 }));
    return results;
  }, [processImage]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      progress: 0,
      detectedPoleNumber: null,
      detectedQRData: null,
      error: null
    });
  }, []);

  return {
    isProcessing: state.isProcessing,
    progress: state.progress,
    detectedPoleNumber: state.detectedPoleNumber,
    detectedQRData: state.detectedQRData,
    error: state.error,
    processImage,
    processMultipleImages,
    reset
  };
};