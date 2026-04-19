import { useState, useCallback, useEffect } from 'react';
import { CloudService } from '@/services/cloudService'; // Dùng alias
import { GridAsset, PowerLine } from '@/types'; // Dùng alias

interface SyncResult {
  success: boolean;
  message?: string;
  syncedIds?: string[];
  pending?: boolean;
}

interface PendingSyncResult {
  success: boolean;
  synced?: number;
  failed?: number;
  remaining?: number;
  message?: string;
}

interface FetchResult {
  success: boolean;
  assets?: any[];
  lines?: any[];
  message?: string;
}

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

  useEffect(() => {
    const drafts = assets.filter(a => a.status === 'Draft').length;
    setPendingCount(drafts);
  }, [assets]);

  const sync = useCallback(async (): Promise<SyncResult> => {
    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const result = await CloudService.syncToAdmin(
        assets, 
        lines, 
        projectId, 
        unit, 
        collector
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

  const fetch = useCallback(async (): Promise<FetchResult> => {
    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const result = await CloudService.fetchData(unit);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi tải dữ liệu';
      setSyncError(message);
      return { success: false, message, assets: [], lines: [] };
    } finally {
      setIsSyncing(false);
    }
  }, [unit]);

  const retryPending = useCallback(async (): Promise<PendingSyncResult> => {
    setIsSyncing(true);
    
    try {
      const result = await CloudService.retryPendingSync();
      return result;
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Lỗi đồng bộ pending' 
      };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const cleanupPending = useCallback(() => {
    CloudService.cleanupPendingSync();
  }, []);

  const openDriveFolder = useCallback(() => {
    CloudService.openDriveFolder();
  }, []);

  const exportData = useCallback(() => {
    CloudService.exportDataToJSON(assets, lines, projectId);
  }, [assets, lines, projectId]);

  return {
    isSyncing,
    lastSyncTime,
    syncError,
    pendingCount,
    sync,
    fetch,
    retryPending,
    cleanupPending,
    openDriveFolder,
    exportData
  };
};