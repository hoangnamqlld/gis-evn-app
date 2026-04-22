import React, { useState, useEffect } from 'react';
import { AssetType, GridAsset, Coordinates } from '../types';

interface CollectionFormProps {
  type: AssetType;
  coords: Coordinates;
  photoUrls: string[];
  initialData?: GridAsset;
  onSave: (data: Partial<GridAsset>) => void;
  onCancel: () => void;
  onOpenCamera: () => void; // Đổi tên cho đúng với App.tsx
  onPhotoDelete?: (newUrls: string[]) => void; // Thêm prop xóa ảnh
  isSaving: boolean;
}

const CollectionForm: React.FC<CollectionFormProps> = ({ 
  type, 
  coords, 
  photoUrls, 
  initialData, 
  onSave, 
  onCancel, 
  onOpenCamera, // Nhận prop này từ App.tsx
  onPhotoDelete,
  isSaving 
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [address, setAddress] = useState(initialData?.address || 'Đang xác định địa chỉ...');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isLoadingAddress, setIsLoadingAddress] = useState(!initialData);

  useEffect(() => {
    if (!initialData) {
      setIsLoadingAddress(true);
      // Gọi API lấy địa chỉ từ tọa độ
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&addressdetails=1&zoom=18`, { 
        headers: { 
          'Accept-Language': 'vi',
          'User-Agent': 'EVNHCMC-Collector/1.0'
        } 
      })
        .then(res => res.json())
        .then(data => {
          if (data.display_name) {
            setAddress(data.display_name);
          } else {
            const lLat = Number(coords.lat);
            const lLng = Number(coords.lng);
            setAddress(`Tọa độ: ${Number.isFinite(lLat) ? lLat.toFixed(6) : '?'}, ${Number.isFinite(lLng) ? lLng.toFixed(6) : '?'}`);
          }
        })
        .catch(() => {
          const lLat = Number(coords.lat);
          const lLng = Number(coords.lng);
          setAddress(`Tọa độ: ${Number.isFinite(lLat) ? lLat.toFixed(6) : '?'}, ${Number.isFinite(lLng) ? lLng.toFixed(6) : '?'}`);
        })
        .finally(() => {
          setIsLoadingAddress(false);
        });
    }
  }, [coords, initialData]);

  const handleDeletePhoto = (index: number) => {
    if (window.confirm('Xóa ảnh này?')) {
      const newUrls = [...photoUrls];
      newUrls.splice(index, 1);
      onPhotoDelete?.(newUrls);
    }
  };

  const config = {
    [AssetType.SUBSTATION]: { 
      label: 'Trạm Biến Áp', 
      color: 'bg-blue-600', 
      icon: 'fa-bolt', 
      nameLabel: 'Tên trạm', 
      codeLabel: 'Mã trạm',
      placeholder: 'VD: TBA Phú Thọ Hòa'
    },
    [AssetType.POLE_MV]: { 
      label: 'Trụ Trung Thế', 
      color: 'bg-violet-600', 
      icon: 'fa-tower-broadcast', 
      nameLabel: 'Tên trụ', 
      codeLabel: 'Số hiệu trụ',
      placeholder: 'VD: 471/ĐĐT'
    },
    [AssetType.POLE_LV]: { 
      label: 'Trụ Hạ Thế', 
      color: 'bg-emerald-600', 
      icon: 'fa-tower-observation', 
      nameLabel: 'Tên trụ', 
      codeLabel: 'Số hiệu trụ',
      placeholder: 'VD: 15/4 Bà Hom'
    },
    [AssetType.SWITCHGEAR]: { 
      label: 'Thiết bị', 
      color: 'bg-amber-500', 
      icon: 'fa-toggle-on', 
      nameLabel: 'Tên thiết bị', 
      codeLabel: 'Mã thiết bị',
      placeholder: 'VD: Recloser RTU-01'
    },
    [AssetType.METER]: { 
      label: 'Điện kế', 
      color: 'bg-pink-600', 
      icon: 'fa-gauge-high', 
      nameLabel: 'Tên khách hàng', 
      codeLabel: 'Mã PE điện kế',
      placeholder: 'VD: PE0123456789'
    },
  };

  const currentConfig = config[type] || { 
    label: 'Thiết bị', 
    color: 'bg-slate-600', 
    icon: 'fa-question', 
    nameLabel: 'Tên đối tượng', 
    codeLabel: 'Mã hiệu',
    placeholder: 'Nhập thông tin...'
  };

  const isFormValid = name.trim() !== '' && photoUrls.length > 0;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[1000] flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className={`p-4 text-white flex justify-between items-center ${currentConfig.color}`}>
          <div className="flex items-center gap-2">
            <i className={`fas ${currentConfig.icon}`}></i>
            <span className="font-black text-xs uppercase tracking-widest">
              {initialData ? 'CHỈNH SỬA' : 'THU THẬP'} {currentConfig.label}
            </span>
          </div>
          <button 
            onClick={onCancel} 
            className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <i className="fas fa-times text-xs"></i>
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Photos */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                HÌNH ẢNH <span className="text-red-500">*</span> ({photoUrls.length}/5)
              </label>
              {photoUrls.length < 5 && (
                <button 
                  onClick={onOpenCamera} 
                  className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1"
                >
                  <i className="fas fa-camera"></i>
                  THÊM ẢNH
                </button>
              )}
            </div>
            
            {photoUrls.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {photoUrls.map((url, idx) => (
                  <div key={idx} className="relative aspect-square bg-slate-100 rounded-xl overflow-hidden group">
                    <img 
                      src={url} 
                      alt={`Photo ${idx + 1}`} 
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => handleDeletePhoto(idx)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      ×
                    </button>
                  </div>
                ))}
                
                {photoUrls.length < 5 && (
                  <button
                    onClick={onOpenCamera}
                    className="aspect-square bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl flex flex-col items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    <i className="fas fa-plus text-xl mb-1"></i>
                    <span className="text-[8px] font-bold">THÊM</span>
                  </button>
                )}
              </div>
            ) : (
              <button 
                onClick={onOpenCamera} 
                className="w-full h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <i className="fas fa-camera text-2xl"></i>
                <span className="text-[10px] font-bold uppercase">Bắt buộc chụp ít nhất 1 ảnh</span>
              </button>
            )}
          </div>

          {/* Tọa độ VN2000 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">VN2000 X</span>
              <span className="text-xs font-mono font-bold text-slate-700">
                {Number.isFinite(coords.x_vn2000) ? coords.x_vn2000!.toFixed(2) : 'Đang tính...'}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">VN2000 Y</span>
              <span className="text-xs font-mono font-bold text-slate-700">
                {Number.isFinite(coords.y_vn2000) ? coords.y_vn2000!.toFixed(2) : 'Đang tính...'}
              </span>
            </div>
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-1">
                {currentConfig.nameLabel} <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder={currentConfig.placeholder}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-bold text-sm transition-all"
                autoFocus
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-1">{currentConfig.codeLabel}</label>
              <input 
                type="text" 
                value={code} 
                onChange={(e) => setCode(e.target.value)}
                placeholder={`Nhập ${currentConfig.codeLabel.toLowerCase()}...`}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-bold text-sm transition-all"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-1">ĐỊA CHỈ</label>
              <div className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl text-[10px] font-medium text-slate-500 leading-tight italic min-h-[4rem] flex items-center">
                {isLoadingAddress ? (
                  <span className="flex items-center gap-2">
                    <i className="fas fa-spinner fa-spin"></i>
                    Đang xác định địa chỉ...
                  </span>
                ) : (
                  address
                )}
              </div>
            </div>
            
            <textarea 
              rows={3} 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú thêm (nếu có)..."
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm font-medium resize-none transition-all"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors"
              disabled={isSaving}
            >
              HỦY
            </button>
            
            <button 
              disabled={!isFormValid || isSaving}
              onClick={() => onSave({ name, code, address, notes, coords, photoUrls })}
              className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${
                !isFormValid || isSaving 
                  ? 'bg-slate-300 cursor-not-allowed' 
                  : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              {isSaving ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  ĐANG LƯU...
                </>
              ) : (
                <>
                  <i className="fas fa-check-circle"></i>
                  {initialData ? 'CẬP NHẬT' : 'HOÀN TẤT'}
                </>
              )}
            </button>
          </div>

          {/* Required field note */}
          <p className="text-[8px] text-slate-400 text-center">
            <span className="text-red-500">*</span> Thông tin bắt buộc
          </p>
        </div>
      </div>
    </div>
  );
};

export default CollectionForm;