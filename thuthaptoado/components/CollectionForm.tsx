
import React, { useState, useEffect } from 'react';
import { AssetType, GridAsset, Coordinates } from '../types';

interface CollectionFormProps {
  type: AssetType;
  coords: Coordinates;
  photoUrls: string[];
  initialData?: GridAsset;
  onSave: (data: Partial<GridAsset>) => void;
  onCancel: () => void;
  onOpenAssistantCamera: () => void;
  isSaving: boolean;
}

const CollectionForm: React.FC<CollectionFormProps> = ({ type, coords, photoUrls, initialData, onSave, onCancel, onOpenAssistantCamera, isSaving }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [address, setAddress] = useState(initialData?.address || 'Đang xác định địa chỉ...');
  const [notes, setNotes] = useState(initialData?.notes || '');

  useEffect(() => {
    if (!initialData) {
      // Gọi API lấy địa chỉ từ tọa độ tâm bản đồ
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&addressdetails=1`, { 
        headers: { 'Accept-Language': 'vi' } 
      })
        .then(res => res.json())
        .then(data => {
          setAddress(data.display_name || `Tọa độ: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
        })
        .catch(() => setAddress(`Tọa độ: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`));
    }
  }, [coords, initialData]);

  const config = {
    [AssetType.SUBSTATION]: { label: 'Trạm Biến Áp', color: 'bg-blue-600', icon: 'fa-bolt', nameLabel: 'Tên trạm', codeLabel: 'Mã trạm' },
    [AssetType.POLE_MV]: { label: 'Trụ Trung Thế', color: 'bg-violet-600', icon: 'fa-tower-broadcast', nameLabel: 'Tên trụ', codeLabel: 'Số hiệu trụ' },
    [AssetType.POLE_LV]: { label: 'Trụ Hạ Thế', color: 'bg-emerald-600', icon: 'fa-tower-observation', nameLabel: 'Tên trụ', codeLabel: 'Số hiệu trụ' },
    [AssetType.SWITCHGEAR]: { label: 'Thiết bị', color: 'bg-amber-500', icon: 'fa-toggle-on', nameLabel: 'Tên thiết bị', codeLabel: 'Mã thiết bị' },
    [AssetType.METER]: { label: 'Điện kế', color: 'bg-pink-600', icon: 'fa-gauge-high', nameLabel: 'Tên khách hàng', codeLabel: 'Mã PE điện kế' },
  };

  const currentConfig = config[type] || { label: 'Thiết bị', color: 'bg-slate-600', icon: 'fa-question', nameLabel: 'Tên đối tượng', codeLabel: 'Mã hiệu' };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[1000] flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        <div className={`p-4 text-white flex justify-between items-center ${currentConfig.color}`}>
          <div className="flex items-center gap-2">
            <i className={`fas ${currentConfig.icon}`}></i>
            <span className="font-black text-xs uppercase tracking-widest">{initialData ? 'Chỉnh sửa' : 'Thu thập'} {currentConfig.label}</span>
          </div>
          <button onClick={onCancel} className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center"><i className="fas fa-times text-xs"></i></button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Photos */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hình ảnh ({photoUrls.length}/5)</label>
              <button onClick={onOpenAssistantCamera} className="text-[10px] font-bold text-indigo-600 uppercase">Thêm ảnh</button>
            </div>
            {photoUrls.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {photoUrls.map((p, i) => (
                  <img key={i} src={p} className="w-24 h-24 object-cover rounded-xl border border-slate-100 shadow-sm shrink-0" alt="Field" />
                ))}
                {photoUrls.length < 5 && (
                  <button onClick={onOpenAssistantCamera} className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300">
                    <i className="fas fa-plus"></i>
                  </button>
                )}
              </div>
            ) : (
              <button onClick={onOpenAssistantCamera} className="w-full h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400">
                <i className="fas fa-camera text-xl"></i>
                <span className="text-[10px] font-bold uppercase">Bắt buộc chụp ít nhất 1 ảnh</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
               <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">VN2000 X</span>
               <span className="text-xs font-mono font-bold text-slate-700">{coords.x_vn2000?.toFixed(2)}</span>
             </div>
             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
               <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">VN2000 Y</span>
               <span className="text-xs font-mono font-bold text-slate-700">{coords.y_vn2000?.toFixed(2)}</span>
             </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-1">{currentConfig.nameLabel}</label>
              <input 
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder={`${currentConfig.nameLabel}...`}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 font-bold text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-1">{currentConfig.codeLabel}</label>
              <input 
                type="text" value={code} onChange={(e) => setCode(e.target.value)}
                placeholder={`${currentConfig.codeLabel}...`}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 font-bold text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Địa chỉ (Tự động)</label>
              <div className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl text-[10px] font-medium text-slate-500 leading-tight italic">
                {address}
              </div>
            </div>
            <textarea 
              rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú thêm..."
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 text-sm font-medium"
            />
          </div>

          <button 
            disabled={!name || photoUrls.length === 0}
            onClick={() => onSave({ name, code, address, notes, photoUrls })}
            className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-lg active:scale-95 transition-all ${!name || photoUrls.length === 0 ? 'bg-slate-300' : 'bg-slate-900'}`}
          >
            <i className="fas fa-check-circle mr-2"></i>
            {initialData ? 'Cập nhật thay đổi' : 'Hoàn tất & Lưu lại'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollectionForm;
