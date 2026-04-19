
import React, { useState } from 'react';
import { PowerLine } from '../types';

interface LineDetailProps {
  line: PowerLine;
  onSave: (line: PowerLine) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const LineDetail: React.FC<LineDetailProps> = ({ line, onSave, onDelete, onClose }) => {
  const [formData, setFormData] = useState<PowerLine>({ ...line });

  const handleDelete = () => {
    if (window.confirm("Bạn chắc chắn muốn xóa đoạn dây này?")) {
      onDelete(line.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[1100] flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
        <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <i className="fas fa-project-diagram"></i>
            <span className="font-black text-xs uppercase tracking-widest">Hiệu chỉnh đoạn dây</span>
          </div>
          <button onClick={onClose} className="bg-white/10 w-8 h-8 rounded-full flex items-center justify-center"><i className="fas fa-times text-xs"></i></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => setFormData(p => ({ ...p, isUnderground: false }))}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all ${!formData.isUnderground ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
            >
              <i className="fas fa-grip-lines"></i>
              <span className="text-[10px] font-black uppercase">Dây Nổi</span>
            </button>
            <button 
              onClick={() => setFormData(p => ({ ...p, isUnderground: true }))}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all ${formData.isUnderground ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
            >
              <i className="fas fa-ellipsis-h"></i>
              <span className="text-[10px] font-black uppercase">Dây Ngầm</span>
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cấp điện áp</label>
              <select 
                value={formData.type}
                onChange={(e) => setFormData(p => ({ ...p, type: e.target.value as any }))}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm"
              >
                <option value="MV">Trung thế (MV)</option>
                <option value="LV">Hạ thế (LV)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input 
                type="text" placeholder="Loại dây (AC, AXV...)"
                value={formData.wireType || ''}
                onChange={(e) => setFormData(p => ({ ...p, wireType: e.target.value }))}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm"
              />
              <input 
                type="text" placeholder="Tiết diện (mm2)"
                value={formData.crossSection || ''}
                onChange={(e) => setFormData(p => ({ ...p, crossSection: e.target.value }))}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm"
              />
            </div>

            <textarea 
              rows={2} placeholder="Ghi chú thêm..."
              value={formData.notes || ''}
              onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-medium"
            />
          </div>

          <div className="flex gap-3">
            <button 
              onClick={handleDelete}
              className="px-6 bg-red-500 text-white rounded-2xl active:scale-95 transition-all shadow-md flex items-center justify-center"
              title="Xóa đoạn dây"
            >
              <i className="fas fa-trash-alt"></i>
            </button>
            <button 
              onClick={() => onSave(formData)}
              className="flex-1 py-5 bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all"
            >
              Lưu thay đổi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LineDetail;
