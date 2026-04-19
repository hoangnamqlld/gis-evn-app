// src/types.ts

/**
 * Định nghĩa loại thiết bị lưới điện chuẩn cho toàn hệ thống
 */
export enum AssetType {
  SUBSTATION = 'substation',
  POLE_MV = 'pole_mv',
  POLE_LV = 'pole_lv',
  SWITCHGEAR = 'switchgear',
  METER = 'meter',
  CUSTOMER = 'customer',
  TEMP_PIN = 'temp_pin'
}

/**
 * Ánh xạ AssetType sang tên tiếng Việt
 */
export const AssetTypeLabels: Record<AssetType, string> = {
  [AssetType.SUBSTATION]: 'Trạm Biến Áp',
  [AssetType.POLE_MV]: 'Trụ Trung Thế',
  [AssetType.POLE_LV]: 'Trụ Hạ Thế',
  [AssetType.SWITCHGEAR]: 'Thiết bị Đóng cắt',
  [AssetType.METER]: 'Điện kế',
  [AssetType.CUSTOMER]: 'Khách hàng',
  [AssetType.TEMP_PIN]: 'Điểm ghim tạm'
};

/**
 * Ánh xạ AssetType sang màu sắc UI
 */
export const AssetTypeColors: Record<AssetType, string> = {
  [AssetType.SUBSTATION]: 'bg-blue-600',
  [AssetType.POLE_MV]: 'bg-violet-600',
  [AssetType.POLE_LV]: 'bg-emerald-600',
  [AssetType.SWITCHGEAR]: 'bg-amber-500',
  [AssetType.METER]: 'bg-pink-600',
  [AssetType.CUSTOMER]: 'bg-amber-600',
  [AssetType.TEMP_PIN]: 'bg-rose-500'
};

/**
 * Ánh xạ AssetType sang icon FontAwesome
 */
export const AssetTypeIcons: Record<AssetType, string> = {
  [AssetType.SUBSTATION]: 'fa-bolt',
  [AssetType.POLE_MV]: 'fa-tower-broadcast',
  [AssetType.POLE_LV]: 'fa-tower-observation',
  [AssetType.SWITCHGEAR]: 'fa-toggle-on',
  [AssetType.METER]: 'fa-gauge-high',
  [AssetType.CUSTOMER]: 'fa-house-user',
  [AssetType.TEMP_PIN]: 'fa-map-pin'
};

/**
 * Cấu trúc tọa độ
 */
export interface Coordinates {
  lat: number;
  lng: number;
  x_vn2000?: number;
  y_vn2000?: number;
}

/**
 * Trạng thái kiểm tra
 */
export enum InspectionStatus {
  OK = 'ok',
  WARNING = 'warning',
  DANGER = 'danger'
}

/**
 * Cấu trúc một lần kiểm tra
 */
export interface InspectionRecord {
  id: string;
  timestamp: number;
  inspectorName: string;
  status: InspectionStatus;
  checklist: {
    poleCondition: boolean;
    insulatorCondition: boolean;
    wireCondition: boolean;
    safetyCorridor: boolean;
  };
  notes: string;
  photoUrls: string[];
}

/**
 * Cấu trúc dữ liệu cho một thiết bị
 */
export interface GridAsset {
  id: string;
  code: string;
  name: string;
  type: AssetType;
  coords: Coordinates;
  address?: string;
  notes?: string;
  photoUrls: string[];
  timestamp: number;
  unit: string;
  collectorName: string;
  collectorId: string;
  status: 'Draft' | 'Synced';
  poleNumber?: string;
  customerCode?: string;
  isPinned?: boolean;
  inspections?: InspectionRecord[];
  rawProperties?: Record<string, any>;
}

/**
 * Cấu trúc dữ liệu cho đường dây điện
 */
export interface PowerLine {
  id: string;
  fromId: string;
  toId: string;
  type: 'MV' | 'LV';
  length: number;
  isUnderground: boolean;
  timestamp: number;
  status: 'Draft' | 'Synced';
  wireType?: string;
  crossSection?: string;
  notes?: string;
  coords?: Coordinates[]; // v15.0: Supporting direct geometry
  rawProperties?: Record<string, any>;
}

/**
 * Trạng thái ứng dụng (Global State)
 */
export interface AppState {
  view: 'collect' | 'pins' | 'inspect' | 'manage';
  assets: GridAsset[];
  lines: PowerLine[];
  currentLocation: Coordinates | null;
  userName: string;
  unit: string;
  projectId: string;
  filterDate: string;
  isSyncing: boolean;
  isMovingMode: boolean;
  isRegionMode: boolean;
  isDriveConnected: boolean;
  syncStats: { 
    pending: number; 
    failed: number; 
    completed: number 
  };
  selectedAsset: GridAsset | null;
  selectedLine: PowerLine | null;
  flyToAsset: GridAsset | null;
  pinnedAssetIds: string[];
  completedAssetIds: string[]; // Đã hoàn thành (GPS đi qua hoặc đã chỉ đường)
  userRole: UserRole | null;
}

/**
 * Kết quả đồng bộ Cloud
 */
export interface SyncResult {
  firebase: { success: boolean; error?: string; count?: number };
  google: { success: boolean; error?: string; count?: number };
  message: string;
}

export type UserRole = 'admin' | 'manager' | 'collector' | 'viewer';

export interface SyncData {
  unit: string;
  collector: string;
  assets: any[];
  lines: any[];
  driveFolderId: string;
}

export interface OCRResult {
  poleNumber: string;
  confidence: number;
  text: string;
  alternatives: string[];
}
