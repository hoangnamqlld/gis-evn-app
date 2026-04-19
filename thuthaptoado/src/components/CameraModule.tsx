// src/components/CameraModule.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Coordinates } from '../types';

interface CameraModuleProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
  existingCount: number;
  userName: string;
  coords: any;
}

const CameraModule: React.FC<CameraModuleProps> = ({
  onCapture,
  onClose,
  existingCount,
  userName,
  coords
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string>('');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // Khởi tạo camera với cấu hình tối ưu cho mobile
  useEffect(() => {
    let mounted = true;
    
    const startCamera = async () => {
      try {
        setError('');
        setIsCameraReady(false);
        
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        // Cấu hình tối ưu cho mobile - giảm độ phân giải để tăng tốc
        const constraints = {
          video: {
            facingMode,
            width: { ideal: 720 }, // Giảm từ 1280 xuống 720
            height: { ideal: 480 }, // Giảm từ 720 xuống 480
            frameRate: { ideal: 15, max: 20 } // Giới hạn FPS
          },
          audio: false
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!mounted) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }
        
        setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            if (mounted) {
              videoRef.current?.play()
                .then(() => setIsCameraReady(true))
                .catch(e => setError('Không thể phát video'));
            }
          };
        }
      } catch (error) {
        console.error('Lỗi camera:', error);
        if (mounted) {
          setError('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.');
        }
      }
    };

    startCamera();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  // Tối ưu capture - dùng requestAnimationFrame
  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isCameraReady || isCapturing) return;
    
    setIsCapturing(true);
    
    // Dùng requestAnimationFrame để không block UI
    requestAnimationFrame(() => {
      try {
        const video = videoRef.current!;
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d');
        
        if (!context) return;
        
        // Giảm kích thước ảnh để xử lý nhanh hơn
        const maxWidth = 640;  // Giảm từ 1024 xuống 640
        const maxHeight = 480; // Giảm từ 768 xuống 480
        
        let width = video.videoWidth;
        let height = video.videoHeight;
        
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Vẽ ảnh nhanh
        context.drawImage(video, 0, 0, width, height);
        
        // Giảm chất lượng để nén nhanh hơn
        const imageData = canvas.toDataURL('image/jpeg', 0.6); // Giảm từ 0.7 xuống 0.6
        
        // Dùng setTimeout để không block UI
        setTimeout(() => {
          onCapture(imageData);
          setIsCapturing(false);
        }, 10);
        
      } catch (error) {
        console.error('Lỗi capture:', error);
        setIsCapturing(false);
      }
    });
  }, [isCameraReady, isCapturing, onCapture]);

  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  }, []);

  if (existingCount >= 5) {
    return (
      <div className="fixed inset-0 z-[10000] bg-black/90 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
          <div className="w-16 h-16 bg-amber-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <i className="fas fa-exclamation-triangle text-amber-600 text-2xl"></i>
          </div>
          <h3 className="text-lg font-bold text-center mb-2">Đã đủ 5 ảnh</h3>
          <p className="text-sm text-slate-600 text-center mb-6">
            Bạn chỉ có thể chụp tối đa 5 ảnh cho mỗi điểm thu thập
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm"
          >
            ĐÓNG
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10000] bg-black flex flex-col">
      {/* Video container */}
      <div className="flex-1 relative bg-black">
        {!isCameraReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-center">
              <i className="fas fa-spinner fa-spin text-3xl mb-2"></i>
              <p className="text-sm">Đang khởi động camera...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-red-50 rounded-xl p-4">
              <p className="text-red-600 text-sm">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm w-full"
              >
                Thử lại
              </button>
            </div>
          </div>
        )}
        
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Khung căn chỉnh */}
      {isCameraReady && !error && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-56 h-56 border-2 border-white/50 rounded-lg">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white"></div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex justify-between items-center">
          <button
            onClick={onClose}
            className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white"
          >
            <i className="fas fa-times text-lg"></i>
          </button>
          <span className="text-white text-sm bg-black/50 px-3 py-1 rounded-full">
            {existingCount}/5 ảnh
          </span>
        </div>
        <p className="text-white text-xs mt-2 text-center bg-black/30 py-1 rounded-full">
          {userName}
        </p>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-0 right-0">
        <div className="flex justify-center items-center gap-6">
          <button
            onClick={toggleCamera}
            className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-white"
            title="Đổi camera"
          >
            <i className="fas fa-sync-alt text-lg"></i>
          </button>
          
          <button
            onClick={captureImage}
            disabled={!isCameraReady || isCapturing}
            className={`w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-blue-500 disabled:opacity-50 disabled:border-gray-400 transition-all active:scale-95`}
          >
            <div className={`w-14 h-14 ${isCapturing ? 'bg-blue-400' : 'bg-blue-600'} rounded-full flex items-center justify-center transition-colors`}>
              {isCapturing ? (
                <i className="fas fa-spinner fa-spin text-white text-xl"></i>
              ) : (
                <i className="fas fa-camera text-white text-xl"></i>
              )}
            </div>
          </button>

          <div className="w-12 h-12" /> {/* Spacer */}
        </div>
      </div>
    </div>
  );
};

export default CameraModule;