import React, { useState } from 'react';
import { GridAsset, InspectionStatus, InspectionRecord } from '../types';

interface InspectionFormProps {
  asset: GridAsset;
  onClose: () => void;
  onSave: (record: InspectionRecord) => void;
  userName: string;
}

const InspectionForm: React.FC<InspectionFormProps> = ({ asset, onClose, onSave, userName }) => {
  const [status, setStatus] = useState<InspectionStatus>(InspectionStatus.OK);
  const [notes, setNotes] = useState('');
  const [checklist, setChecklist] = useState({
    poleCondition: true,
    insulatorCondition: true,
    wireCondition: true,
    safetyCorridor: true
  });
  const [photos, setPhotos] = useState<string[]>([]);

  const handleToggle = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotos(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleSubmit = () => {
    const record: InspectionRecord = {
      id: `INSP-${Date.now()}`,
      timestamp: Date.now(),
      inspectorName: userName,
      status,
      checklist,
      notes,
      photoUrls: photos
    };
    onSave(record);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[3000] flex flex-col p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] shadow-2xl w-full max-w-lg mx-auto flex flex-col overflow-hidden my-auto border-t-white/30">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div>
            <h2 className="text-xl font-black text-white leading-tight">Kiểm tra hiện trường</h2>
            <p className="text-[10px] font-bold text-blue-400 uppercase mt-1">
              {asset.name} • {asset.code}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Tình trạng tổng quát */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tình trạng tổng quát</label>
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => setStatus(InspectionStatus.OK)}
                className={`flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all ${
                  status === InspectionStatus.OK 
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20' 
                    : 'bg-white/5 border-white/5 text-slate-500 opacity-60'
                }`}
              >
                <i className="fas fa-check-circle text-xl"></i>
                <span className="text-[9px] font-black uppercase">Bình thường</span>
              </button>
              <button 
                onClick={() => setStatus(InspectionStatus.WARNING)}
                className={`flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all ${
                  status === InspectionStatus.WARNING 
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/20' 
                    : 'bg-white/5 border-white/5 text-slate-500 opacity-60'
                }`}
              >
                <i className="fas fa-exclamation-triangle text-xl"></i>
                <span className="text-[9px] font-black uppercase">Theo dõi</span>
              </button>
              <button 
                onClick={() => setStatus(InspectionStatus.DANGER)}
                className={`flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all ${
                  status === InspectionStatus.DANGER 
                    ? 'bg-red-500/20 border-red-500 text-red-400 shadow-lg shadow-red-500/20' 
                    : 'bg-white/5 border-white/5 text-slate-500 opacity-60'
                }`}
              >
                <i className="fas fa-skull-crossbones text-xl"></i>
                <span className="text-[9px] font-black uppercase">Nguy hiểm</span>
              </button>
            </div>
          </div>

          {/* Danh mục kiểm tra */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Danh mục kiểm tra</label>
            <div className="space-y-2">
              {[
                { key: 'poleCondition', label: 'Thân trụ / Xà / Móng', icon: 'fa-tower-observation' },
                { key: 'insulatorCondition', label: 'Sứ / Cách điện', icon: 'fa-bolt-lightning' },
                { key: 'wireCondition', label: 'Dây dẫn / Độ võng', icon: 'fa-lines-leaning' },
                { key: 'safetyCorridor', label: 'Hành lang an toàn', icon: 'fa-shield-halved' },
              ].map(item => (
                <div 
                  key={item.key}
                  onClick={() => handleToggle(item.key as any)}
                  className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-blue-400 text-xs">
                      <i className={`fas ${item.icon}`}></i>
                    </div>
                    <span className="text-xs font-bold text-white">{item.label}</span>
                  </div>
                  <div className={`w-10 h-6 rounded-full p-1 transition-all ${checklist[item.key as keyof typeof checklist] ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-all ${checklist[item.key as keyof typeof checklist] ? 'translate-x-4' : 'translate-x-0'}`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hình ảnh */}
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hình ảnh minh chứng</label>
              <label className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase cursor-pointer hover:bg-blue-500">
                <i className="fas fa-camera mr-1"></i> Chụp ảnh
                <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
            {photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {photos.map((src, idx) => (
                  <div key={idx} className="relative shrink-0">
                    <img src={src} className="w-20 h-20 object-cover rounded-xl border border-white/20" alt="Evidence" />
                    <button 
                      onClick={() => setPhotos(p => p.filter((_, i) => i !== idx))}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ghi chú */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Ghi chú chi tiết</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nhập nhận xét hoặc mô tả khiếm khuyết..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-xs placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none min-h-[100px]"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-white/5 border-t border-white/10 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-white/5 text-slate-400 rounded-2xl font-black text-[10px] uppercase hover:bg-white/10 transition-all"
          >
            Hủy bỏ
          </button>
          <button 
            onClick={handleSubmit}
            className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
          >
            Hoàn tất & Lưu phiếu
          </button>
        </div>
      </div>
    </div>
  );
};

export default InspectionForm;
