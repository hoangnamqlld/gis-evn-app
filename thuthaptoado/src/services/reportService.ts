// src/services/reportService.ts
import { GridAsset, PowerLine, AssetType, AssetTypeLabels } from '../types';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { db } from './firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface ReportFilters {
  startDate: string;
  endDate: string;
  unit?: string;
  collector?: string;
  assetType?: AssetType;
  status?: 'Draft' | 'Synced';
}

interface ReportSummary {
  totalAssets: number;
  totalLines: number;
  totalPhotos: number;
  byUnit: Record<string, number>;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  synced: number;
  pending: number;
}

class ReportService {
  /**
   * Tạo báo cáo Excel
   */
  async generateExcelReport(filters: ReportFilters): Promise<void> {
    try {
      const assets = await this.fetchFilteredAssets(filters);
      const summary = this.generateSummary(assets, []);

      // Tạo workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Danh sách assets
      const assetData = assets.map(a => ({
        'Mã': a.code,
        'Tên': a.name,
        'Loại': AssetTypeLabels[a.type] || a.type,
        'Đơn vị': a.unit,
        'Người thu thập': a.collectorName,
        'Thời gian': new Date(a.timestamp).toLocaleString('vi-VN'),
        'Vĩ độ': a.coords.lat,
        'Kinh độ': a.coords.lng,
        'X (VN2000)': a.coords.x_vn2000,
        'Y (VN2000)': a.coords.y_vn2000,
        'Địa chỉ': a.address,
        'Ghi chú': a.notes,
        'Số ảnh': a.photoUrls.length,
        'Trạng thái': a.status === 'Synced' ? 'Đã đồng bộ' : 'Chờ đồng bộ'
      }));

      const wsAssets = XLSX.utils.json_to_sheet(assetData);
      XLSX.utils.book_append_sheet(wb, wsAssets, 'Danh sách thiết bị');

      // Sheet 2: Tổng hợp
      const summaryData = [{
        'Tổng số thiết bị': summary.totalAssets,
        'Tổng số đường dây': summary.totalLines,
        'Tổng số ảnh': summary.totalPhotos,
        'Đã đồng bộ': summary.synced,
        'Chờ đồng bộ': summary.pending,
        'Theo loại': JSON.stringify(summary.byType),
        'Theo đơn vị': JSON.stringify(summary.byUnit)
      }];

      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng hợp');

      // Tạo file Excel
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
      
      const fileName = `bao-cao-${filters.startDate}-${filters.endDate}.xlsx`;
      saveAs(blob, fileName);

      console.log('✅ Đã tạo báo cáo Excel:', fileName);

    } catch (error) {
      console.error('❌ Lỗi tạo báo cáo:', error);
      throw error;
    }
  }

  /**
   * Lấy dữ liệu từ Firebase
   */
  private async fetchFilteredAssets(filters: ReportFilters): Promise<GridAsset[]> {
    try {
      let constraints = [];

      if (filters.startDate) {
        const start = new Date(filters.startDate).getTime();
        constraints.push(where('timestamp', '>=', start));
      }

      if (filters.endDate) {
        const end = new Date(filters.endDate).getTime() + 86400000;
        constraints.push(where('timestamp', '<=', end));
      }

      if (filters.unit) {
        constraints.push(where('unit', '==', filters.unit));
      }

      if (filters.collector) {
        constraints.push(where('collectorName', '==', filters.collector));
      }

      if (filters.assetType) {
        constraints.push(where('type', '==', filters.assetType));
      }

      if (filters.status) {
        constraints.push(where('status', '==', filters.status));
      }

      const q = query(collection(db, 'assets'), ...constraints);
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GridAsset[];

    } catch (error) {
      console.error('Lỗi lấy dữ liệu từ Firebase:', error);
      return [];
    }
  }

  /**
   * Tạo báo cáo PDF
   */
  async generatePDFReport(filters: ReportFilters): Promise<void> {
    // Sẽ implement sau
    console.log('PDF report coming soon');
  }

  /**
   * Tạo summary từ dữ liệu
   */
  private generateSummary(assets: GridAsset[], lines: PowerLine[]): ReportSummary {
    const byUnit: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    let totalPhotos = 0;
    let synced = 0;
    let pending = 0;

    assets.forEach(asset => {
      // Theo đơn vị
      byUnit[asset.unit] = (byUnit[asset.unit] || 0) + 1;

      // Theo loại
      const typeName = AssetTypeLabels[asset.type] || asset.type;
      byType[typeName] = (byType[typeName] || 0) + 1;

      // Theo trạng thái
      byStatus[asset.status] = (byStatus[asset.status] || 0) + 1;

      // Đếm ảnh
      totalPhotos += asset.photoUrls.length;

      // Đếm trạng thái
      if (asset.status === 'Synced') {
        synced++;
      } else {
        pending++;
      }
    });

    return {
      totalAssets: assets.length,
      totalLines: lines.length,
      totalPhotos,
      byUnit,
      byType,
      byStatus,
      synced,
      pending
    };
  }

  /**
   * Xuất báo cáo thống kê nhanh
   */
  async getQuickStats(unit?: string): Promise<any> {
    try {
      const assets = await this.fetchFilteredAssets({ 
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        unit 
      });

      return {
        today: assets.length,
        byType: this.groupBy(assets, 'type'),
        synced: assets.filter(a => a.status === 'Synced').length,
        pending: assets.filter(a => a.status === 'Draft').length,
        photos: assets.reduce((sum, a) => sum + a.photoUrls.length, 0)
      };

    } catch (error) {
      console.error('Lỗi lấy thống kê nhanh:', error);
      return null;
    }
  }

  /**
   * Nhóm mảng theo trường
   */
  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((result, item) => {
      const value = item[key];
      const label = AssetTypeLabels[value as AssetType] || value;
      result[label] = (result[label] || 0) + 1;
      return result;
    }, {});
  }
}

export default new ReportService();