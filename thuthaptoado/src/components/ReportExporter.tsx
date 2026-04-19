// src/components/ReportExporter.tsx
import React, { useState, useEffect } from 'react';
import { GridAsset, PowerLine } from '../types';
import googleSheetsAdminService from '../services/googleSheetsAdminService';
import authService from '../services/firebase/authService';
import driveAuthService from '../services/driveAuthService';

interface ReportExporterProps {
  assets: GridAsset[];
  lines: PowerLine[];
  onClose: () => void;
}

const ReportExporter: React.FC<ReportExporterProps> = ({ assets, lines, onClose }) => {
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    unit: 'all',
    collector: 'all',
    type: 'all',
    status: 'all'
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  useEffect(() => {
    // Kiểm tra kết nối Google
    setIsGoogleConnected(driveAuthService.isAuthenticated());
  }, []);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const user = authService.getCurrentUser();
      if (!user?.email) {
        // Nếu chưa đăng nhập Firebase, thử dùng email từ localStorage
        const localEmail = localStorage.getItem('evnhcmc_user_email') || 'unknown@evnhcmc.com';
        console.log('Using local email:', localEmail);
      }
      
      const userEmail = user?.email || localStorage.getItem('evnhcmc_user_email') || 'unknown@evnhcmc.com';
      
      // Kiểm tra kết nối Google
      if (!isGoogleConnected) {
        const confirm = window.confirm(
          'Bạn chưa kết nối Google Drive. Kết nối ngay?'
        );
        if (confirm) {
          window.location.href = driveAuthService.getAuthUrl();
          return;
        } else {
          throw new Error('Cần kết nối Google Drive để xuất báo cáo');
        }
      }
      
      const result = await googleSheetsAdminService.exportReport(filters, userEmail);
      
      window.open(result.url, '_blank');
      alert('✅ Xuất báo cáo thành công!');
      onClose();
      
    } catch (error: any) {
      console.error('Export error:', error);
      setError(error.message || 'Có lỗi khi xuất báo cáo');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = driveAuthService.getAuthUrl();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6">
          <h3 className="text-lg font-black">📊 XUẤT BÁO CÁO</h3>
        </div>
        
        <div className="p-6 space-y-4">
          {!isGoogleConnected && (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
              <p className="text-yellow-700 text-sm mb-3">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                Cần kết nối Google Drive để xuất báo cáo
              </p>
              <button
                onClick={handleGoogleLogin}
                className="w-full py-2 bg-yellow-500 text-white rounded-lg font-bold text-sm hover:bg-yellow-600"
              >
                <i className="fab fa-google-drive mr-2"></i>
                Kết nối Google Drive
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-xl">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500">Từ ngày</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={e => setFilters({...filters, startDate: e.target.value})}
                className="w-full p-3 border rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Đến ngày</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={e => setFilters({...filters, endDate: e.target.value})}
                className="w-full p-3 border rounded-xl"
              />
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl">
            <p className="text-sm text-blue-700">
              <i className="fas fa-info-circle mr-2"></i>
              Tổng số: {assets.length} điểm
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleExport}
              disabled={loading || !isGoogleConnected}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <i className="fas fa-file-export"></i>
              )}
              Xuất báo cáo
            </button>
            
            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportExporter;