// src/services/googleScriptService.ts
interface SyncData {
  unit: string;
  collector: string;
  driveFolderId: string;
  assets: any[];
  lines: any[];
}

class GoogleScriptService {
  private scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
  private driveFolderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.scriptUrl}?action=test&_t=${Date.now()}`);
      const data = await response.json();
      console.log('📡 Test connection:', data);
      return data.success === true;
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  }

  async syncData(data: SyncData): Promise<any> {
    try {
      // Thêm driveFolderId vào data
      const syncPayload = {
        ...data,
        driveFolderId: this.driveFolderId
      };

      // Sử dụng JSONP để tránh CORS
      const response = await fetch(`${this.scriptUrl}?action=sync_data_evn&data=${encodeURIComponent(JSON.stringify(syncPayload))}&_t=${Date.now()}`);
      const result = await response.json();
      
      console.log('📡 Sync result:', result);
      return result;
    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw error;
    }
  }

  async getData(unit: string): Promise<any> {
    try {
      const response = await fetch(`${this.scriptUrl}?action=get_data_evn&unit=${unit}&_t=${Date.now()}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Get data failed:', error);
      throw error;
    }
  }

  async getStats(): Promise<any> {
    try {
      const response = await fetch(`${this.scriptUrl}?action=get_stats&_t=${Date.now()}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Get stats failed:', error);
      throw error;
    }
  }
}

export default new GoogleScriptService();