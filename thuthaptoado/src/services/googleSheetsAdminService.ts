// src/services/googleSheetsAdminService.ts
import { GridAsset, PowerLine, UserRole } from '../types';

interface SheetPermissions {
  canViewAll: boolean;
  canExportAll: boolean;
  canManageUsers: boolean;
  allowedUnits: string[];
  allowedSheets: string[];
}

class GoogleSheetsAdminService {
  private spreadsheetId = import.meta.env.VITE_GOOGLE_SHEETS_ID;
  private apiKey = import.meta.env.VITE_GOOGLE_API_KEY; // Thêm API Key

  constructor() {
    console.log('📊 GoogleSheetsAdminService initialized');
    console.log('📊 Sheet ID:', this.spreadsheetId);
    console.log('📊 API Key:', this.apiKey ? '✅' : '❌');
  }

  // ============= QUẢN LÝ PHÂN QUYỀN =============
  async getUserPermissions(email: string): Promise<SheetPermissions> {
    try {
      // Kiểm tra API Key
      if (!this.apiKey) {
        console.error('❌ Thiếu Google API Key');
        return this.getDefaultPermissions(email);
      }

      // Đọc từ sheet Admin_PhanQuyen
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/Admin_PhanQuyen!A:E?key=${this.apiKey}`;
      console.log('📡 Fetching permissions from:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn('⚠️ Không thể đọc sheet phân quyền, dùng mặc định');
        return this.getDefaultPermissions(email);
      }
      
      const data = await response.json();
      const rows = data.values || [];
      
      // Tìm user trong sheet
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row[0] === email) {
          return {
            canViewAll: row[2] === 'admin',
            canExportAll: row[2] === 'admin',
            canManageUsers: row[2] === 'admin',
            allowedUnits: row[2] === 'admin' ? [] : [row[1]],
            allowedSheets: row[2] === 'admin' ? [] : [`${row[1]}_Assets`]
          };
        }
      }
      
      // Không tìm thấy, trả về quyền mặc định
      return this.getDefaultPermissions(email);
      
    } catch (error) {
      console.error('Lỗi lấy phân quyền:', error);
      return this.getDefaultPermissions(email);
    }
  }

  private getDefaultPermissions(email: string): SheetPermissions {
    // Trích xuất unit từ email
    const unit = this.extractUnitFromEmail(email);
    
    return {
      canViewAll: false,
      canExportAll: false,
      canManageUsers: false,
      allowedUnits: unit ? [unit] : [],
      allowedSheets: unit ? [`${unit}_Assets`] : []
    };
  }

  private extractUnitFromEmail(email: string): string | null {
    const units = ['PCCCH', 'PCBCA', 'PCBD', 'PCVT', 'PCDD'];
    const emailUpper = email.toUpperCase();
    
    for (const unit of units) {
      if (emailUpper.includes(unit)) {
        return unit;
      }
    }
    return null;
  }

  // ============= XUẤT BÁO CÁO THEO PHÂN QUYỀN =============
  async exportReport(filters: any, userEmail: string): Promise<{ url: string; data: any[] }> {
    console.log('📊 Exporting report for:', userEmail);
    
    try {
      // Kiểm tra token
      const token = await this.getAccessToken();
      if (!token) {
        throw new Error('Chưa đăng nhập Google');
      }

      // Lấy quyền của user
      const permissions = await this.getUserPermissions(userEmail);
      
      // Xác định phạm vi dữ liệu
      let data: any[] = [];
      
      if (permissions.canViewAll) {
        // Admin: xem tất cả
        data = await this.fetchAllData(filters);
      } else if (permissions.allowedUnits.length > 0) {
        // Quản lý đơn vị: xem dữ liệu trong đơn vị mình quản lý
        data = await this.fetchUnitData(permissions.allowedUnits[0], filters);
      } else {
        // User thường: không có dữ liệu
        data = [];
      }
      
      // Tạo báo cáo
      return this.generateReport(data, filters, token);
      
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  }

  private async fetchAllData(filters: any): Promise<any[]> {
    try {
      if (!this.apiKey) return [];
      
      const sheetName = 'Admin_TongHop_All';
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${sheetName}!A:Z?key=${this.apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) return [];
      
      const data = await response.json();
      return this.parseSheetData(data);
    } catch (error) {
      console.warn('⚠️ Không thể fetch all data:', error);
      return [];
    }
  }

  private async fetchUnitData(unit: string, filters: any): Promise<any[]> {
    try {
      if (!this.apiKey) return [];
      
      const sheetName = `${unit}_Assets`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${sheetName}!A:Z?key=${this.apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) return [];
      
      const data = await response.json();
      return this.parseSheetData(data);
    } catch (error) {
      console.warn(`⚠️ Không thể fetch data cho unit ${unit}:`, error);
      return [];
    }
  }

  private async generateReport(data: any[], filters: any, token: string): Promise<{ url: string; data: any[] }> {
    const timestamp = new Date().getTime();
    const reportName = `Bao_cao_${filters.startDate}_${filters.endDate}_${timestamp}`;
    
    // Tạo sheet báo cáo mới
    const sheetId = await this.createSheet(reportName, token);
    
    // Ghi dữ liệu
    if (data.length > 0) {
      await this.writeToSheet(sheetId, this.dataToRows(data), token);
    }
    
    return {
      url: `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit#gid=${sheetId}`,
      data
    };
  }

  private async createSheet(sheetName: string, token: string): Promise<string> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [{
          addSheet: {
            properties: {
              title: sheetName
            }
          }
        }]
      })
    });
    
    if (!response.ok) {
      throw new Error('Không thể tạo sheet mới');
    }
    
    const data = await response.json();
    return data.replies[0].addSheet.properties.sheetId;
  }

  private async writeToSheet(sheetName: string, rows: any[][], token: string) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${sheetName}?valueInputOption=USER_ENTERED`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: rows
      })
    });
    
    if (!response.ok) {
      throw new Error('Không thể ghi dữ liệu vào sheet');
    }
  }

  private async getAccessToken(): Promise<string | null> {
    // Lấy token từ localStorage
    const token = localStorage.getItem('google_access_token');
    if (!token) {
      console.warn('⚠️ Chưa có Google access token');
      return null;
    }
    return token;
  }

  private parseSheetData(response: any): any[] {
    if (!response.values || response.values.length === 0) return [];
    
    const headers = response.values[0];
    return response.values.slice(1).map((row: any[]) => {
      const obj: any = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index];
      });
      return obj;
    });
  }

  private dataToRows(data: any[]): any[][] {
    if (data.length === 0) return [['Không có dữ liệu']];
    
    const headers = Object.keys(data[0]);
    return [
      headers,
      ...data.map(item => headers.map(h => item[h] || ''))
    ];
  }
}

export default new GoogleSheetsAdminService();