import React, { useState, useEffect } from 'react';
import syncQueueService from '../services/syncQueueService';

interface SyncStatusProps {
  onSync?: () => void;
}

const SyncStatus: React.FC<SyncStatusProps> = ({ onSync }) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const updateStats = () => {
      setPendingCount(syncQueueService.getPendingCount());
      setFailedCount(syncQueueService.getFailedCount());
    };

    updateStats();
    const interval = setInterval(updateStats, 5000);

    const handleSyncUpdate = (e: CustomEvent) => {
      updateStats();
    };

    window.addEventListener('sync-update', handleSyncUpdate as EventListener);

    return () => {
      clearInterval(interval);
      window.removeEventListener('sync-update', handleSyncUpdate as EventListener);
    };
  }, []);

  const handleSync = () => {
    setIsSyncing(true);
    if (onSync) {
      onSync();
    }
    setTimeout(() => setIsSyncing(false), 2000);
  };

  const handleRetryFailed = () => {
    syncQueueService.retryFailed();
  };

  if (pendingCount === 0 && failedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[1000]">
      <div className="bg-white rounded-2xl shadow-2xl p-4 border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800">Trạng thái đồng bộ</h3>
          <span className="text-xs text-slate-500">
            {new Date().toLocaleTimeString('vi-VN')}
          </span>
        </div>

        <div className="space-y-2">
          {pendingCount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fas fa-clock text-amber-500"></i>
                <span className="text-sm">Đang chờ: {pendingCount}</span>
              </div>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="px-3 py-1 bg-blue-600 text-white rounded-xl text-sm disabled:opacity-50"
              >
                {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ'}
              </button>
            </div>
          )}

          {failedCount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fas fa-exclamation-triangle text-red-500"></i>
                <span className="text-sm">Thất bại: {failedCount}</span>
              </div>
              <button
                onClick={handleRetryFailed}
                className="px-3 py-1 bg-red-600 text-white rounded-xl text-sm"
              >
                Thử lại
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncStatus;