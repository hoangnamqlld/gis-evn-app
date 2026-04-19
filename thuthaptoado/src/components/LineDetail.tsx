import React, { useState } from 'react';
import { PowerLine } from '../types';

interface LineDetailProps {
  line: PowerLine;
  onSave: (updatedLine: PowerLine) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const LineDetail: React.FC<LineDetailProps> = ({ line, onSave, onDelete, onClose }) => {
  const [formData, setFormData] = useState<PowerLine>({ ...line });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[3000] flex items-end">
      <div className="bg-white w-full rounded-t-[2rem] p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-100">
            <i className="fas fa-arrow-left"></i>
          </button>
          <h2 className="text-xl font-bold">Chi tiết đường dây</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-600 mb-1 block">Loại dây</label>
            <select
              value={formData.wireType || ''}
              onChange={(e) => setFormData({ ...formData, wireType: e.target.value })}
              className="w-full p-4 bg-slate-50 rounded-xl"
            >
              <option value="">Chọn loại dây</option>
              <option value="ACSR-35">ACSR-35</option>
              <option value="ACSR-50">ACSR-50</option>
              <option value="ACSR-70">ACSR-70</option>
              <option value="ACSR-95">ACSR-95</option>
              <option value="CU-16">CU-16</option>
              <option value="CU-25">CU-25</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-slate-600 mb-1 block">Tiết diện</label>
            <select
              value={formData.crossSection || ''}
              onChange={(e) => setFormData({ ...formData, crossSection: e.target.value })}
              className="w-full p-4 bg-slate-50 rounded-xl"
            >
              <option value="">Chọn tiết diện</option>
              <option value="35">35 mm²</option>
              <option value="50">50 mm²</option>
              <option value="70">70 mm²</option>
              <option value="95">95 mm²</option>
              <option value="120">120 mm²</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-slate-600 mb-1 block">Chiều dài (m)</label>
            <input
              type="number"
              value={formData.length}
              onChange={(e) => setFormData({ ...formData, length: parseFloat(e.target.value) })}
              className="w-full p-4 bg-slate-50 rounded-xl"
              step="0.1"
            />
          </div>

          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
            <input
              type="checkbox"
              id="isUnderground"
              checked={formData.isUnderground}
              onChange={(e) => setFormData({ ...formData, isUnderground: e.target.checked })}
              className="w-5 h-5"
            />
            <label htmlFor="isUnderground">Đường dây ngầm</label>
          </div>

          <div>
            <label className="text-sm text-slate-600 mb-1 block">Ghi chú</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full p-4 bg-slate-50 rounded-xl"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold"
            >
              Lưu thay đổi
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Xóa đường dây này?')) {
                  onDelete(line.id);
                }
              }}
              className="w-14 h-14 bg-red-600 text-white rounded-xl"
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LineDetail;