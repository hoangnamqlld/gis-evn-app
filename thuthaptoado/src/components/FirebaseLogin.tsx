// src/components/FirebaseLogin.tsx
import React, { useState } from 'react';
import authService from '../services/firebase/authService';

interface FirebaseLoginProps {
  onLoginSuccess: (user: any) => void;
}

const FirebaseLogin: React.FC<FirebaseLoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await authService.login(email, password);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  // Danh sách tài khoản mẫu để hiển thị
  const sampleAccounts = [
    { unit: 'PCCCH', email: 'PCCCH_QLLD@evn.com.vn', role: 'Quản lý' },
    { unit: 'PCBCA', email: 'PCBCA_QLLD@evn.com.vn', role: 'Quản lý' },
    { unit: 'PCBD', email: 'PCBD_QLLD@evn.com.vn', role: 'Quản lý' },
    { unit: 'PCVT', email: 'PCVT_NV01@evn.com.vn', role: 'Nhân viên' },
    { unit: 'PCDD', email: 'PCDD_NV01@evn.com.vn', role: 'Nhân viên' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-6 z-[9999] overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-[3rem] p-8 space-y-6 shadow-2xl">
        {/* Logo */}
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-[2rem] mx-auto flex items-center justify-center shadow-xl mb-4">
            <i className="fas fa-bolt text-4xl text-white"></i>
          </div>
          <h2 className="text-2xl font-black text-slate-800 uppercase">EVNHCMC</h2>
          <p className="text-sm text-slate-500 mt-1">Hệ thống thu thập lưới điện</p>
        </div>

        {/* Form đăng nhập */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <i className="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nhanvien@evn.com.vn"
                className="w-full p-4 pl-12 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 font-medium"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mật khẩu <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-4 pl-12 pr-12 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 font-medium"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-sm font-medium flex items-center gap-2">
              <i className="fas fa-exclamation-circle"></i>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-blue-700 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-blue-800 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                <span>Đang đăng nhập...</span>
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt"></i>
                <span>Đăng nhập</span>
              </>
            )}
          </button>
        </form>

        {/* Thông tin tài khoản mẫu */}
        <div className="bg-blue-50 rounded-2xl p-4">
          <p className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1">
            <i className="fas fa-info-circle"></i>
            Tài khoản mẫu (mật khẩu: 123456)
          </p>
          <div className="space-y-1 text-xs">
            {sampleAccounts.map((acc, idx) => (
              <div 
                key={idx} 
                className="flex items-center justify-between p-1 hover:bg-white rounded-lg cursor-pointer"
                onClick={() => setEmail(acc.email)}
              >
                <span className="font-mono text-blue-700">{acc.email}</span>
                <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[9px] font-bold">
                  {acc.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-400">
          © 2026 EVNHCMC - Hệ thống quản lý lưới điện
        </p>
      </div>
    </div>
  );
};

export default FirebaseLogin;