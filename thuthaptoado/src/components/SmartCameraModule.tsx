// src/components/SmartCameraModule.tsx
import React, { useState, useRef, useEffect } from 'react';
import { GridAsset, Coordinates } from '../types';

interface SmartCameraModuleProps {
  onCapture: (imageData: string, poleNumber?: string, asset?: GridAsset) => void;
  onClose: () => void;
  existingCount: number;
  userName: string;
  coords: Coordinates | null;
  assets: GridAsset[];
  mode: 'capture' | 'scan' | 'ocr';
}

const SmartCameraModule: React.FC<SmartCameraModuleProps> = ({
  onCapture,
  onClose,
  existingCount,
  userName,
  coords,
  assets,
  mode
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [detectedNumber, setDetectedNumber] = useState<string>('');
  const [manualNumber, setManualNumber] = useState('');
  const [matchedAsset, setMatchedAsset] = useState<GridAsset | null>(null);
  const [suggestions, setSuggestions] = useState<GridAsset[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const initCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setStream(mediaStream);
      } catch (error) {
        console.error('❌ Lỗi camera:', error);
      }
    };

    if (mode !== 'scan') {
      initCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mode]);

  const simulateOCR = async (imageData: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setIsProcessing(true);
      setProgress(0);
      
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
        setIsProcessing(false);
        setProgress(100);
        
        const mockPoleNumber = 'TRU' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        resolve(mockPoleNumber);
      }, 1500);
    });
  };

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current || !coords) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context?.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);

    if (mode === 'capture' || mode === 'ocr') {
      const poleNumber = await simulateOCR(imageData);
      if (poleNumber) {
        setDetectedNumber(poleNumber);
        
        const found = assets.find(a => 
          a.code.includes(poleNumber) || 
          a.name.includes(poleNumber)
        );
        setMatchedAsset(found || null);

        const similar = assets.filter(a => 
          a.code.includes(poleNumber.substring(0, 3))
        ).slice(0, 3);
        setSuggestions(similar);
      }
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage, detectedNumber || manualNumber, matchedAsset || undefined);
      onClose();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const imageData = event.target?.result as string;
      setCapturedImage(imageData);

      if (mode === 'capture' || mode === 'ocr') {
        const poleNumber = await simulateOCR(imageData);
        if (poleNumber) {
          setDetectedNumber(poleNumber);
          
          const found = assets.find(a => 
            a.code.includes(poleNumber) || 
            a.name.includes(poleNumber)
          );
          setMatchedAsset(found || null);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-black z-[2000] flex flex-col">
      <div className="shrink-0 flex justify-between p-4 pt-12 items-center bg-black/80 text-white z-10">
        <div className="flex flex-col">
          <h3 className="font-black text-sm uppercase tracking-widest">
            {mode === 'capture' && '📸 CHỤP ẢNH THÔNG MINH'}
            {mode === 'scan' && '🔍 QUÉT QR CODE'}
            {mode === 'ocr' && '🔎 NHẬN DẠNG SỐ TRỤ'}
          </h3>
          <p className="text-blue-400 text-xs">Đã chụp: {existingCount}/5 ảnh</p>
        </div>
        <button onClick={onClose} className="w-10 h-10 bg-white/10 rounded-full">
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="flex-1 relative bg-black">
        {!capturedImage ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative">
                <div className="w-72 h-72 border-2 border-yellow-400 rounded-lg opacity-50"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-center">
                  <p className="bg-black/50 px-4 py-2 rounded-full text-sm whitespace-nowrap">
                    {mode === 'capture' && 'Đặt số trụ trong khung'}
                    {mode === 'scan' && 'Đưa QR code vào khung'}
                    {mode === 'ocr' && 'Đặt số trụ vào khung'}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="relative w-full h-full bg-black">
            <img src={capturedImage} className="w-full h-full object-contain" alt="Preview" />
            
            {isProcessing && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-white">Đang xử lý... {progress}%</p>
                </div>
              </div>
            )}

            {!isProcessing && (detectedNumber || manualNumber) && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-6">
                <div className="bg-white rounded-2xl p-4">
                  <h4 className="font-bold text-lg mb-2 flex items-center gap-2">
                    <i className="fas fa-check-circle text-green-500"></i>
                    Phát hiện số trụ
                  </h4>
                  
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={detectedNumber || manualNumber}
                        onChange={(e) => setManualNumber(e.target.value)}
                        className="w-full p-3 bg-slate-50 rounded-xl font-mono text-lg border border-slate-200 focus:border-blue-500 outline-none"
                        placeholder="Nhập số trụ"
                      />
                    </div>
                    {matchedAsset && (
                      <div className="bg-green-50 p-2 px-3 rounded-xl">
                        <p className="text-xs text-green-600">✅ Đã có dữ liệu</p>
                        <p className="font-medium text-sm">{matchedAsset.name}</p>
                      </div>
                    )}
                  </div>

                  {suggestions.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-500 mb-2">Gợi ý:</p>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map(s => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setDetectedNumber(s.code);
                              setMatchedAsset(s);
                            }}
                            className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200"
                          >
                            {s.code} - {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => {
                        setCapturedImage(null);
                        setDetectedNumber('');
                        setManualNumber('');
                        setMatchedAsset(null);
                      }}
                      className="flex-1 py-3 bg-slate-200 rounded-xl font-bold hover:bg-slate-300"
                    >
                      Chụp lại
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={!detectedNumber && !manualNumber}
                      className="flex-1 py-3 bg-blue-700 text-white rounded-xl font-bold hover:bg-blue-800 disabled:bg-slate-400"
                    >
                      Xác nhận
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!capturedImage && (
        <div className="shrink-0 bg-black/90 backdrop-blur-sm p-6 border-t border-white/10">
          <div className="flex justify-center items-center gap-6">
            <button
              onClick={captureImage}
              disabled={isProcessing}
              className="w-16 h-16 bg-white rounded-full border-4 border-yellow-400 flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
            >
              <div className="w-12 h-12 bg-yellow-400 rounded-full"></div>
            </button>
            
            <label className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/20">
              <i className="fas fa-image text-white text-xl"></i>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartCameraModule;