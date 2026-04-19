// src/services/cloudService.ts
import { GridAsset, PowerLine } from '../types';

// SỬA URL NÀY THÀNH URL MỚI NHẤT TỪ GOOGLE APPS SCRIPT
const ADMIN_API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwHDrSzgGW6whrpM8ghgwWPZwiwFUSir2uBpPNzC-VpXKyVa_pw7UhOWzxFuZrarcYN/exec'; 
const GOOGLE_DRIVE_FOLDER_ID = '1VwRrez7rmYHPBSZCFeeaOC5MzvpHoqBX';

// Session management
const SESSION_CHECK_KEY = 'evnhcmc_session_valid';
const SESSION_TIMEOUT = 30 * 60 * 1000;

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const isOnline = (): boolean => navigator.onLine;

const updateSession = () => {
  localStorage.setItem(SESSION_CHECK_KEY, Date.now().toString());
};

export const CloudService = {
  checkConnection: async (): Promise<boolean> => {
    if (!isOnline()) return false;
    try {
      // Thử dùng fetch thay vì no-cors để kiểm tra
      const response = await fetch(`${ADMIN_API_ENDPOINT}?action=test`, {
        method: 'GET',
        mode: 'cors'
      });
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Kết nối Google Script thành công:', data);
        return true;
      }
      return false;
    } catch (error) {
      console.warn('⚠️ Không thể kết nối Google Script:', error);
      return false;
    }
  },

  testConnection: async () => {
    try {
      const response = await fetch(`${ADMIN_API_ENDPOINT}?action=test`, {
        method: 'GET',
        mode: 'cors'
      });
      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      }
      return { success: false, message: 'Không thể kết nối' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  },

  syncToAdmin: async (assets: GridAsset[], lines: PowerLine[], projectId: string, unit: string, collector: string) => {
    const unsyncedAssets = assets.filter(a => a.status === 'Draft');
    if (unsyncedAssets.length === 0) return { success: true, message: "Không có dữ liệu mới." };

    console.log("☁️ Bắt đầu đồng bộ:", {
      assets: unsyncedAssets.length,
      lines: lines.length,
      unit,
      collector
    });

    if (!isOnline()) {
      return await CloudService.saveToPending(unsyncedAssets, lines, projectId, unit, collector);
    }

    try {
      const payload = {
        action: 'sync_data_evn',
        unit: unit,
        collector: collector,
        projectId: projectId,
        driveFolderId: GOOGLE_DRIVE_FOLDER_ID,
        assets: unsyncedAssets.map(a => ({
          id: a.id,
          code: a.code || '',
          name: a.name || '',
          type: a.type || '',
          x_vn2000: a.coords.x_vn2000 || 0,
          y_vn2000: a.coords.y_vn2000 || 0,
          lat: a.coords.lat || 0,
          lng: a.coords.lng || 0,
          address: a.address || '',
          notes: a.notes || '',
          timestamp: a.timestamp || Date.now(),
          locationName: `${a.code}_${a.name}`.replace(/[^a-zA-Z0-9]/g, '_'),
          images: a.photoUrls
            .filter(url => url.startsWith('data:image'))
            .map((url, index) => ({
              name: `${unit}_${collector}_${a.type}_${a.code || a.id}_${index + 1}.jpg`,
              base64: url.split(',')[1] || url
            }))
        })),
        lines: lines.map(l => {
          const fromAsset = assets.find(a => a.id === l.fromId);
          const toAsset = assets.find(a => a.id === l.toId);
          return {
            id: l.id,
            fromId: l.fromId,
            toId: l.toId,
            fromCode: fromAsset?.code || l.fromId,
            toCode: toAsset?.code || l.toId,
            type: l.type || '',
            length: l.length || 0,
            isUnderground: l.isUnderground || false,
            notes: l.notes || ''
          };
        })
      };

      console.log("📦 Payload:", JSON.stringify(payload).substring(0, 200) + "...");

      // Thử dùng fetch trước, nếu lỗi thì fallback sang JSONP
      try {
        const response = await fetch(ADMIN_API_ENDPOINT, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Đồng bộ thành công:', data);
          return {
            success: true,
            message: data.message || `✅ Đã đồng bộ ${unsyncedAssets.length} điểm.`,
            sheetUrl: data.sheetUrl,
            folderUrl: data.folderUrl
          };
        }
      } catch (fetchError) {
        console.log('⚠️ Fetch không hoạt động, chuyển sang JSONP...');
      }

      // Fallback sang JSONP
      return await CloudService.jsonpSync(payload, unsyncedAssets);

    } catch (error) {
      console.error("❌ Sync error:", error);
      return await CloudService.saveToPending(unsyncedAssets, lines, projectId, unit, collector);
    }
  },

  jsonpSync: (payload: any, unsyncedAssets: GridAsset[]): Promise<any> => {
    return new Promise((resolve) => {
      const callbackName = `jsonp_sync_${Date.now()}`;
      const jsonString = JSON.stringify(payload);
      const encodedData = encodeURIComponent(jsonString);
      
      const baseUrl = ADMIN_API_ENDPOINT;
      const url = `${baseUrl}?action=sync_data_evn&callback=${callbackName}&data=${encodedData}&_t=${Date.now()}`;

      const script = document.createElement('script');
      script.src = url;
      script.async = true;

      const timeout = setTimeout(() => {
        cleanup();
        resolve({
          success: false,
          message: "Timeout khi kết nối.",
          pending: true
        });
      }, 15000);

      const cleanup = () => {
        clearTimeout(timeout);
        if (script.parentNode) script.parentNode.removeChild(script);
        delete (window as any)[callbackName];
      };

      (window as any)[callbackName] = (data: any) => {
        cleanup();
        if (data && data.success) {
          updateSession();
          resolve({
            success: true,
            syncedIds: unsyncedAssets.map(a => a.id),
            message: data.message || `✅ Đã đồng bộ thành công ${unsyncedAssets.length} điểm.`,
            sheetUrl: data.sheetUrl,
            folderUrl: data.folderUrl
          });
        } else {
          resolve({
            success: false,
            message: data?.message || "Lỗi không xác định từ server",
            pending: true
          });
        }
      };

      script.onerror = () => {
        cleanup();
        resolve({
          success: false,
          message: "Không thể kết nối đến server.",
          pending: true
        });
      };

      document.body.appendChild(script);
    });
  },

  saveToPending: async (unsyncedAssets: GridAsset[], lines: PowerLine[], projectId: string, unit: string, collector: string) => {
    try {
      const pendingSync = JSON.parse(localStorage.getItem('evnhcmc_pending_sync') || '[]');
      
      const safeAssets = unsyncedAssets.map(a => ({
        ...a,
        photoUrls: a.photoUrls.filter(url => url.startsWith('http'))
      }));
      
      pendingSync.push({
        id: generateId(),
        timestamp: Date.now(),
        assets: safeAssets,
        lines,
        projectId,
        unit,
        collector,
        retryCount: 0
      });
      
      if (pendingSync.length > 50) pendingSync.splice(0, pendingSync.length - 50);
      localStorage.setItem('evnhcmc_pending_sync', JSON.stringify(pendingSync));
      
      return { 
        success: false, 
        message: `📦 Mất kết nối. Dữ liệu đã được lưu tạm (${pendingSync.length} gói chờ).`,
        pending: true
      };
    } catch (e) {
      return { success: false, message: "❌ Lỗi kết nối khi gửi dữ liệu." };
    }
  },

  fetchData: async (unit: string) => {
    if (!isOnline()) {
      return { success: false, message: "Mất kết nối mạng", assets: [], lines: [] };
    }
    try {
      return await CloudService.jsonpFetch(unit);
    } catch (error: any) {
      return { success: false, message: error.message || "Lỗi kết nối", assets: [], lines: [] };
    }
  },

  jsonpFetch: (unit: string): Promise<any> => {
    return new Promise((resolve) => {
      const callbackName = `jsonp_fetch_${Date.now()}`;
      const url = `${ADMIN_API_ENDPOINT}?action=get_data_evn&unit=${encodeURIComponent(unit)}&callback=${callbackName}&_t=${Date.now()}`;

      const script = document.createElement('script');
      script.src = url;
      script.async = true;

      const timeout = setTimeout(() => {
        cleanup();
        resolve({ success: false, message: "Timeout", assets: [], lines: [] });
      }, 15000);

      const cleanup = () => {
        clearTimeout(timeout);
        if (script.parentNode) script.parentNode.removeChild(script);
        delete (window as any)[callbackName];
      };

      (window as any)[callbackName] = (data: any) => {
        cleanup();
        if (data && data.success) {
          updateSession();
          resolve({
            success: true,
            assets: data.assets || [],
            lines: data.lines || []
          });
        } else {
          resolve({
            success: false,
            message: data?.message || "Lỗi tải dữ liệu",
            assets: [],
            lines: []
          });
        }
      };

      script.onerror = () => {
        cleanup();
        resolve({ success: false, message: "Không thể kết nối", assets: [], lines: [] });
      };

      document.body.appendChild(script);
    });
  },

  retryPendingSync: async () => {
    try {
      const pendingSync = JSON.parse(localStorage.getItem('evnhcmc_pending_sync') || '[]');
      if (pendingSync.length === 0) return { success: true, message: "Không có dữ liệu pending." };

      if (!isOnline()) {
        return { 
          success: false, 
          message: "Mất kết nối mạng",
          synced: 0,
          failed: pendingSync.length,
          remaining: pendingSync.length
        };
      }

      const successful: any[] = [];
      const failed: any[] = [];

      for (const item of pendingSync) {
        if (item.retryCount > 3) {
          failed.push(item);
          continue;
        }

        try {
          item.retryCount++;
          const result = await CloudService.syncToAdmin(
            item.assets, item.lines, item.projectId, item.unit, item.collector
          );
          if (result.success) successful.push(item);
          else failed.push(item);
        } catch (e) {
          failed.push(item);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const remaining = pendingSync.filter((item: any) => !successful.includes(item) && failed.includes(item));
      localStorage.setItem('evnhcmc_pending_sync', JSON.stringify(remaining));

      return {
        success: true,
        synced: successful.length,
        failed: failed.length,
        remaining: remaining.length,
        message: `✅ Đã đồng bộ ${successful.length}/${pendingSync.length} gói.`
      };
      
    } catch (error) {
      return { success: false, message: "Lỗi khi đồng bộ lại." };
    }
  },

  openDriveFolder: () => {
    window.open(`https://drive.google.com/drive/u/0/folders/${GOOGLE_DRIVE_FOLDER_ID}`, '_blank');
  },

  exportDataToJSON: (assets: GridAsset[], lines: PowerLine[], projectId: string) => {
    try {
      const data = { 
        projectId, 
        exportDate: new Date().toLocaleString('vi-VN'), 
        totalAssets: assets.length,
        totalLines: lines.length,
        assets: assets.map(a => ({
          id: a.id,
          code: a.code,
          name: a.name,
          type: a.type,
          x_vn2000: a.coords.x_vn2000,
          y_vn2000: a.coords.y_vn2000,
          lat: a.coords.lat,
          lng: a.coords.lng,
          address: a.address,
          notes: a.notes,
          unit: a.unit,
          collectorName: a.collectorName,
          timestamp: new Date(a.timestamp).toLocaleString('vi-VN'),
          photoUrls: a.photoUrls
        })),
        lines
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `EVN_DATA_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error("❌ Lỗi xuất dữ liệu:", error);
    }
  },

  cleanupPendingSync: (maxAge = 7 * 24 * 60 * 60 * 1000) => {
    try {
      const pendingSync = JSON.parse(localStorage.getItem('evnhcmc_pending_sync') || '[]');
      const now = Date.now();
      const filtered = pendingSync.filter((item: any) => now - item.timestamp < maxAge);
      localStorage.setItem('evnhcmc_pending_sync', JSON.stringify(filtered));
      return pendingSync.length - filtered.length;
    } catch (error) {
      return 0;
    }
  }
};