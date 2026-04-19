import React, { useState } from 'react';
import googleScriptService from '../services/googleScriptService';
import { SyncData } from '../types';

const SyncTest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testSync = async () => {
    setLoading(true);
    try {
      // Sử dụng folder ID bạn đã cung cấp
      const testData: SyncData = {
        unit: "PCCCH",
        collector: "Test User",
        driveFolderId: "1VwRrez7rmYHPBSZCFeeaOC5MzvpHoqBX", // 👈 SỬ DỤNG FOLDER ID THẬT
        assets: [
          {
            id: "TEST-001",
            code: "TRU001",
            name: "Trụ điện số 1",
            type: "pole_lv",
            x_vn2000: 1234567.89,
            y_vn2000: 1234567.89,
            lat: 10.7769,
            lng: 106.7009,
            address: "123 Đường ABC, Quận 1",
            notes: "Trụ điện test",
            timestamp: Date.now(),
            images: []
          }
        ],
        lines: []
      };

      console.log('Đang đồng bộ với folder ID:', testData.driveFolderId);
      const result = await googleScriptService.syncData(testData);
      setResult(result);
      console.log('Sync result:', result);
    } catch (error) {
      console.error('Sync error:', error);
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-lg font-bold mb-4">Test đồng bộ Google Script</h2>
      
      <div className="mb-4 p-3 bg-blue-50 rounded-xl text-xs">
        <p className="font-medium text-blue-800 mb-1">Folder ID:</p>
        <p className="font-mono text-blue-600 break-all">1VwRrez7rmYHPBSZCFeeaOC5MzvpHoqBX</p>
      </div>
      
      <button
        onClick={testSync}
        disabled={loading}
        className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-blue-700 transition-colors"
      >
        {loading ? (
          <>
            <i className="fas fa-spinner fa-spin mr-2"></i>
            Đang đồng bộ...
          </>
        ) : (
          <>
            <i className="fas fa-sync-alt mr-2"></i>
            Test đồng bộ
          </>
        )}
      </button>

      {result && (
        <div className="mt-4 p-4 bg-slate-100 rounded-xl">
          <h3 className="font-bold mb-2 flex items-center">
            {result.error ? (
              <>
                <i className="fas fa-exclamation-triangle text-red-500 mr-2"></i>
                <span className="text-red-600">Lỗi</span>
              </>
            ) : (
              <>
                <i className="fas fa-check-circle text-green-500 mr-2"></i>
                <span className="text-green-600">Thành công</span>
              </>
            )}
          </h3>
          <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-60">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default SyncTest;