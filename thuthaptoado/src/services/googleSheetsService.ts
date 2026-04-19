// src/services/googleSheetsService.ts
import { GridAsset, AssetType, AssetTypeLabels } from '../types';
import driveAuthService from './driveAuthService';

interface SheetRow {
  timestamp: string;
  unit: string;
  collector: string;
  assetCode: string;
  assetName: string;
  assetType: string;
  latitude: number;
  longitude: number;
  x_vn2000: number;
  y_vn2000: number;
  address: string;
  notes: string;
  photoCount: number;
  syncStatus: string;
}

class GoogleSheetsService {
  private sheetId: string;
  private apiKey: string;

  constructor() {
    const getEnvVar = (key: string, defaultValue: string = ''): string => {
      try {
        if (typeof import.meta !== 'undefined' && import.meta.env) {
          return import.meta.env[key] || defaultValue;
        }
      } catch {
        return defaultValue;
      }
    };

    this.sheetId = getEnvVar('VITE_GOOGLE_SHEETS_ID', '');
    this.apiKey = getEnvVar('VITE_GOOGLE_API_KEY', '');
  }

  /**
   * Thêm một asset vào Google Sheets
   */
  async appendAsset(asset: GridAsset): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      if (!token) {
        console.warn('Không có token, lưu vào queue');
        await this.addToSyncQueue(asset);
        return false;
      }

      const row = this.convertAssetToRow(asset);
      const range = 'Assets!A:R';
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [[
              row.timestamp,
              row.unit,
              row.collector,
              row.assetCode,
              row.assetName,
              row.assetType,
              row.latitude,
              row.longitude,
              row.x_vn2000,
              row.y_vn2000,
              row.address,
              row.notes,
              row.photoCount,
              row.syncStatus
            ]]
          })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      console.log(`✅ Đã thêm asset ${asset.code} vào Google Sheets`);
      return true;

    } catch (error) {
      console.error('❌ Lỗi thêm asset vào Google Sheets:', error);
      await this.addToSyncQueue(asset);
      return false;
    }
  }

  /**
   * Thêm nhiều assets cùng lúc
   */
  async appendAssets(assets: GridAsset[]): Promise<{
    success: number;
    failed: number;
  }> {
    let success = 0;
    let failed = 0;

    for (const asset of assets) {
      const result = await this.appendAsset(asset);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Lấy thống kê theo đơn vị
   */
  async getUnitStatistics(unit: string, date: string): Promise<any> {
    try {
      const token = await this.getAccessToken();
      if (!token) return null;

      const range = 'Assets!A:R';
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${range}?key=${this.apiKey}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const rows = data.values || [];
      
      // Bỏ qua header
      const dataRows = rows.slice(1);
      
      // Lọc theo đơn vị và ngày
      const filtered = dataRows.filter((row: any[]) => 
        row[1] === unit && row[0].startsWith(date)
      );

      return {
        total: filtered.length,
        byType: this.groupByType(filtered),
        recent: filtered.slice(-10)
      };

    } catch (error) {
      console.error('Lỗi lấy thống kê:', error);
      return null;
    }
  }

  /**
   * Chuyển đổi Asset thành dòng trong sheet
   */
  private convertAssetToRow(asset: GridAsset): SheetRow {
    return {
      timestamp: new Date(asset.timestamp).toISOString(),
      unit: asset.unit,
      collector: asset.collectorName,
      assetCode: asset.code,
      assetName: asset.name,
      assetType: this.getAssetTypeName(asset.type),
      latitude: asset.coords.lat,
      longitude: asset.coords.lng,
      x_vn2000: asset.coords.x_vn2000 || 0,
      y_vn2000: asset.coords.y_vn2000 || 0,
      address: asset.address || '',
      notes: asset.notes || '',
      photoCount: asset.photoUrls.length,
      syncStatus: asset.status
    };
  }

  /**
   * Lấy tên loại asset
   */
  private getAssetTypeName(type: AssetType): string {
    return AssetTypeLabels[type] || type;
  }

  /**
   * Thêm vào queue đồng bộ
   */
  private async addToSyncQueue(asset: GridAsset): Promise<void> {
    const { default: syncQueueService } = await import('./syncQueueService');
    await syncQueueService.addToQueue({
      type: 'sheet',
      data: asset
    });
  }

  /**
   * Nhóm theo loại
   */
  private groupByType(rows: any[]): Record<string, number> {
    const result: Record<string, number> = {};
    
    for (const row of rows) {
      const type = row[5] || 'Khác';
      result[type] = (result[type] || 0) + 1;
    }
    
    return result;
  }

  /**
   * Lấy access token
   */
  private async getAccessToken(): Promise<string | null> {
    try {
      return await driveAuthService.getAccessToken();
    } catch {
      return null;
    }
  }
}

export default new GoogleSheetsService();