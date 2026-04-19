import React, { useState } from 'react';
import * as XLSX from 'xlsx';

interface ReportButtonProps {
  filters: any;
  onGenerate?: () => void;
}

const ReportButton: React.FC<ReportButtonProps> = ({ filters, onGenerate }) => {
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      // Tạo dữ liệu mẫu
      const data = [
        { 'Mã': '001', 'Tên': 'Trụ điện 1', 'Loại': 'Trụ Hạ Thế', 'Ngày': '2024-01-15' },
        { 'Mã': '002', 'Tên': 'Trạm biến áp A', 'Loại': 'Trạm Biến Áp', 'Ngày': '2024-01-16' },
        { 'Mã': '003', 'Tên': 'Điện kế 123', 'Loại': 'Điện kế', 'Ngày': '2024-01-17' }
      ];

      // Tạo worksheet
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      
      // Thêm worksheet vào workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Báo cáo');
      
      // Tạo tên file
      const fileName = `bao-cao-${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Download file
      XLSX.writeFile(workbook, fileName);

      if (onGenerate) onGenerate();
    } catch (error) {
      console.error('Lỗi tạo báo cáo:', error);
      alert('Không thể tạo báo cáo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={generateReport}
      disabled={loading}
      className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
    >
      {loading ? (
        <>
          <i className="fas fa-spinner fa-spin"></i>
          Đang tạo...
        </>
      ) : (
        <>
          <i className="fas fa-file-excel"></i>
          Xuất báo cáo
        </>
      )}
    </button>
  );
};

export default ReportButton;