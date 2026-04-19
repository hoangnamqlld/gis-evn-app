// src/pages/OAuthCallback.tsx
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import driveAuthService from '../services/driveAuthService';

const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const error = params.get('error');

      if (error) {
        console.error('❌ OAuth error:', error);
        alert('Không thể kết nối Google Drive. Vui lòng thử lại.');
        navigate('/');
        return;
      }

      if (code) {
        try {
          await driveAuthService.getToken(code);
          alert('✅ Kết nối Google Drive thành công!');
          navigate('/');
        } catch (err) {
          console.error('❌ Token error:', err);
          alert('Lỗi xác thực Google Drive');
          navigate('/');
        }
      }
    };

    handleCallback();
  }, [location, navigate]);

  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Đang xác thực Google Drive...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;