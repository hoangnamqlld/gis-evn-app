
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Coordinates } from '../types';

interface CameraModuleProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
  existingCount: number;
  coords: Coordinates | null;
  userName: string;
}

const CameraModule: React.FC<CameraModuleProps> = ({ onCapture, onClose, existingCount, coords, userName }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedInSession, setCapturedInSession] = useState(0);

  const startCamera = useCallback(async () => {
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
    } catch (err) {
      alert("Không thể truy cập camera: " + err);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [startCamera]);

  const capture = () => {
    const totalCount = existingCount + capturedInSession;
    if (videoRef.current && totalCount < 5) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0);

      const fontSize = Math.max(20, canvas.width / 40);
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      
      const margin = 20;
      const lineHeight = fontSize * 1.5;
      const textX = margin;
      let textY = canvas.height - margin - (lineHeight * 3);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, textY - fontSize, canvas.width, canvas.height - textY + fontSize);

      ctx.fillStyle = '#FFFFFF';
      const timestamp = new Date().toLocaleString('vi-VN');
      const collectionCode = `EVNHCMC-${Date.now().toString().slice(-6)}`;
      
      ctx.fillText(`Mã EVNHCMC: ${collectionCode}`, textX, textY);
      textY += lineHeight;
      ctx.fillText(`Tọa độ: X:${coords?.x_vn2000?.toFixed(2)} Y:${coords?.y_vn2000?.toFixed(2)}`, textX, textY);
      textY += lineHeight;
      ctx.fillText(`Thời gian: ${timestamp} | NV: ${userName}`, textX, textY);

      const data = canvas.toDataURL('image/jpeg', 0.8);
      onCapture(data);
      setCapturedInSession(prev => prev + 1);
      
      if (totalCount + 1 >= 5) {
        onClose();
      }
    }
  };

  const totalCaptured = existingCount + capturedInSession;

  return (
    <div className="fixed inset-0 bg-black z-[2000] flex flex-col h-full h-[100dvh] overflow-hidden animate-fade-in">
      {/* Header bar - Cố định ở trên */}
      <div className="shrink-0 flex justify-between p-4 pt-12 items-center bg-black/80 backdrop-blur-md z-10 safe-top">
        <div className="flex flex-col">
           <h3 className="text-white font-black text-xs uppercase tracking-widest">EVNHCMC Camera</h3>
           <p className="text-blue-400 text-[10px] font-bold uppercase">Đã chụp: {totalCaptured}/5 ảnh</p>
        </div>
        <button onClick={onClose} className="text-white bg-white/10 w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all">
          <i className="fas fa-times"></i>
        </button>
      </div>

      {/* Video Viewport - Tự động giãn nở */}
      <div className="flex-1 relative bg-zinc-900 overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        
        {/* Aim Guide Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
           <div className="w-64 h-64 border-2 border-white/20 rounded-3xl"></div>
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500/50 rounded-full"></div>
        </div>
      </div>

      {/* Controls Bar - Cố định ở dưới, không dùng padding quá lớn gây trôi nút */}
      <div className="shrink-0 bg-black p-6 safe-bottom">
        <div className="flex items-center justify-around w-full max-w-sm mx-auto">
          {/* Nút Hủy */}
          <button 
            onClick={onClose} 
            className="w-16 text-white/50 text-[10px] font-black uppercase tracking-widest active:text-white"
          >
            Đóng
          </button>
          
          {/* Nút Chụp - Shutter */}
          <button 
            onClick={capture}
            className="relative w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            <div className="w-14 h-14 rounded-full bg-white shadow-inner"></div>
          </button>

          {/* Nút Xong / Preview */}
          <div className="w-16 flex justify-end">
            {totalCaptured > 0 ? (
              <button 
                onClick={onClose} 
                className="bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl shadow-lg active:bg-blue-500"
              >
                Xong
              </button>
            ) : (
              <div className="w-16"></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraModule;
