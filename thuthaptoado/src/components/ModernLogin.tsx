// src/components/ModernLogin.tsx
import React, { useState } from 'react';
import { UserRole } from '../types';

interface ModernLoginProps {
  onLogin: (role: UserRole, userName: string) => void;
}

const ModernLogin: React.FC<ModernLoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    setTimeout(() => {
      const u = username.toLowerCase();
      if (u === 'qlld' && password === '123456') {
        onLogin('admin', 'Quản lý Lưới điện');
      } else if (u === 'pccch' && password === '123456') {
        onLogin('viewer', 'Kỹ thuật viên PCCCh');
      } else {
        setError('Tài khoản hoặc mật khẩu không chính xác!');
      }
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-['Outfit'] relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-100 rounded-full blur-[100px] opacity-60"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-sky-100 rounded-full blur-[100px] opacity-60"></div>
      
      <div className="w-full max-w-sm relative z-10 animate-slide">
        <div className="bg-white/70 backdrop-blur-2xl border border-white rounded-[2.5rem] p-8 shadow-2xl shadow-blue-900/5 overflow-hidden">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-blue-200">
              <i className="fas fa-bolt text-white text-2xl"></i>
            </div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              PowerMind <span className="text-blue-600">v6.0</span>
            </h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Hệ thống quản lý lưới HCM</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Tài khoản</label>
              <div className="relative">
                <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all text-sm font-semibold"
                  placeholder="Nhập tài khoản"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Mật khẩu</label>
              <div className="relative">
                <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all text-sm font-semibold"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-500 text-[11px] font-bold p-3 rounded-xl border border-red-100 text-center animate-fade">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black uppercase text-xs tracking-widest hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <i className="fas fa-circle-notch fa-spin text-lg"></i>
              ) : (
                <>
                  <span>Bắt đầu làm việc</span>
                  <i className="fas fa-chevron-right text-[10px]"></i>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter leading-relaxed">
              Phiên bản 6.0 - Bright Modern Edition<br/>
              © 2026 PowerMind EVNHCMC
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernLogin;
