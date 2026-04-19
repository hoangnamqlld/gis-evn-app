// types.ts
export enum AssetType {
  SUBSTATION = 'TRAM',
  POLE_MV = 'TRU_TRUNG_THE',
  POLE_LV = 'TRU_HA_THE',
  SWITCHGEAR = 'THIET_BI',
  METER = 'DIEN_KE'
}

export interface Coordinates {
  lat: number;
  lng: number;
  x_vn2000?: number;
  y_vn2000?: number;
}

export interface PowerLine {
  id: string;
  fromId: string;
  toId: string;
  type: 'MV' | 'LV'; 
  isUnderground: boolean; 
  wireType?: string;      
  crossSection?: string;  
  length?: number;
  notes?: string;
  lastSynced?: number;
  timestamp?: number;
}

export interface GridAsset {
  id: string;
  type: AssetType;
  name: string;
  code: string; 
  address?: string; 
  notes?: string; 
  coords: Coordinates;
  photoUrls: string[];
  timestamp: number;
  unit: string; 
  collectorName: string;
  collectorId: string;
  status: 'Draft' | 'Submitted' | 'Synced' | 'Syncing';
  lastSynced?: number;
  aiAnalysis?: string;
}

export interface AppState {
  view: 'collect' | 'manage' | 'admin';
  assets: GridAsset[];
  lines: PowerLine[]; 
  currentLocation: Coordinates | null;
  selectedAsset: GridAsset | null;
  selectedLine: PowerLine | null;
  userName: string;
  unit: string;
  projectId: string; 
  filterDate: string;
  isSyncing: boolean;
  isMovingMode: boolean;
  isRegionMode: boolean;
  shouldFlyToAsset?: boolean;
  // 👉 THÊM CÁC TRƯỜNG MỚI
  showPastData?: boolean;
  searchPastQuery?: string;
  pastSearchResults?: GridAsset[];
  pinnedAssetIds: string[];
  flyToAsset?: GridAsset | null;
  syncStats: { pending: number; failed: number; completed: number };
}