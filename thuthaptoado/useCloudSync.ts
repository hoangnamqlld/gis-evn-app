import { useState, useCallback, useEffect } from 'react';
import { CloudService } from './cloudService';
import { GridAsset, PowerLine } from '../types';

export const useCloudSync = (
  assets: GridAsset[],
  lines: PowerLine[],
  projectId: string,
  unit: string,
  collector: string
) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Đếm số lượng draft
  useEffect(() => {
    const drafts = assets.filter(a => a.status === 'Draft').length;
    setPendingCount(drafts);
  }, [assets]);

  // Đồng bộ thủ công
  const sync = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const result = await CloudService.syncToAdmin(
        assets, lines, projectId, unit, collector
      );
      
      if (result.success) {
        setLastSyncTime(new Date());
        return result;
      } else {
        setSyncError(result.message || 'Lỗi đồng bộ');
        return result;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      setSyncError(message);
      return { success: false, message };
    } finally {
      setIsSyncing(false);
    }
  }, [assets, lines, projectId, unit, collector]);

  // Tải dữ liệu từ cloud
  const fetch = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const result = await CloudService.fetchData(unit);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi tải dữ liệu';
      setSyncError(message);
      return { success: false, assets: [], lines: [] };
    } finally {
      setIsSyncing(false);
    }
  }, [unit]);

  // Đồng bộ pending
  const retryPending = useCallback(async () => {
    setIsSyncing(true);
    
    try {
      const result = await CloudService.retryPendingSync();
      return result;
    } catch (error) {
      return { success: false, message: 'Lỗi đồng bộ pending' };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    isSyncing,
    lastSyncTime,
    syncError,
    pendingCount,
    sync,
    fetch,
    retryPending
  };
};