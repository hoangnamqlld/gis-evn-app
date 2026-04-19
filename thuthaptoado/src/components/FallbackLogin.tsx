// src/components/FallbackLogin.tsx
import React, { useState } from 'react';

interface FallbackLoginProps {
  onLogin: (unit: string, name: string) => void;
}

const FallbackLogin: React.FC<FallbackLoginProps> = ({ onLogin }) => {
  const [unit, setUnit] = useState('PCCCH');
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onLogin(unit, name);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-yellow-500 p-6 text-center">
          <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <i className="fas fa-exclamation-triangle text-yellow-500 text-4xl"></i>
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-widest">
            CHẾ ĐỘ OFFLINE
          </h1>
          <p className="text-yellow-100 text-sm mt-1">
            Firebase không khả dụng. Đăng nhập để tiếp tục.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Đơn vị
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="PCCCH">PCCCH</option>
              <option value="PCBCA">PCBCA</option>
              <option value="PCBD">PCBD</option>
              <option value="PCVT">PCVT</option>
              <option value="PCDD">PCDD</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Họ tên
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập họ tên"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-yellow-500 text-white rounded-xl font-bold text-lg hover:bg-yellow-600 transition-colors"
          >
            ĐĂNG NHẬP OFFLINE
          </button>

          <p className="text-xs text-center text-slate-400 mt-4">
            Dữ liệu sẽ được lưu local và đồng bộ khi có kết nối
          </p>
        </form>
      </div>
    </div>
  );
};

export default FallbackLogin;