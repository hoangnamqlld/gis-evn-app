import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense, memo, useRef } from 'react';
import { AssetType, GridAsset, Coordinates, AppState, PowerLine, InspectionRecord } from './types';
import { convertWGS84toVN2000 } from './utils/vn2000';
import { calculateDistance } from './utils/math';
import './index.css';

// Lazy load components
const MapModule = lazy(() => import('./components/MapModule'));
const CollectionForm = lazy(() => import('./components/CollectionForm'));
const AssetDetail = lazy(() => import('./components/AssetDetail'));
const LineDetail = lazy(() => import('./components/LineDetail'));
const ModernLogin = lazy(() => import('./components/ModernLogin'));
const SearchPopup = lazy(() => import('./components/SearchPopup'));
const PinBoard = lazy(() => import('./components/PinBoard'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const ReportExporter = lazy(() => import('./components/ReportExporter'));
const InspectionForm = lazy(() => import('./components/InspectionForm'));

// Services
import { useCloudSync } from './services/useCloudSync';
import authService from './services/firebase/authService';
import dualSyncService from './services/dualSyncService';
import driveAuthService from './services/driveAuthService';
import syncQueueService from './services/syncQueueService';
import { auth } from './services/firebase/config';
import { initTileData, loadSearchIndex, loadTilesForBbox, queryBbox } from './services/tileDataService';
import { readFragmentPins, clearFragment } from './utils/shareRoute';

// Constants
const UNITS = ["PCCCH", "PCBCA", "PCBD", "PCVT", "PCDD"];
const DEFAULT_CENTER = { lat: 11.002, lng: 106.507 }; // Điện lực Củ Chi
const STORAGE_KEYS = {
  USER_NAME: 'evnhcmc_user_name',
  UNIT: 'evnhcmc_unit',
  PROJECT_ID: 'evnhcmc_project_id',
  ASSETS: 'evnhcmc_assets',
  LINES: 'evnhcmc_lines',
  LOGIN_DATE: 'evnhcmc_login_date'
};

// Backend đã được gỡ bỏ — app chạy 100% client-side qua tileDataService (static CDN).

/** Phân loại thiết bị GIS nhất quán — dùng chung cho mọi nguồn. Ánh xạ với build_tiles.py.
 *  Mapping thực tế:
 *    point_dk       F05_DienKe_HT_S   → điện kế
 *    point_tru_ht   F07_Tru_HT_S      → trụ hạ thế
 *    point_tru_tt   F08_Tru_TT_S      → trụ trung thế
 *    point_tbdc     F02_TBDC_HT_S     → tủ điện phân phối
 *    point_tram_tt  F04_Tram_TT_S     → TRẠM BIẾN ÁP thật
 *    point_tba      F10_TBTTDL_HT_S   → thiết bị gateway
 */
function classifyAsset(props: any, id: string): AssetType {
  const upperId     = (id || "").toString().toUpperCase();
  const upperMtb    = (props.MATHIETBI || "").toString().toUpperCase();
  const upperKhId   = (props.KH_ID || props.MA_KHANG || props.MA_KH || "").toString().toUpperCase().trim();
  const upperDiachi = (props.DIACHI || props.DIA_CHI || "").toString().toUpperCase().trim();
  const loaiTb      = (props.LOAITHIETBI || "").toString().toUpperCase();
  const layer       = (props._layer || "").toString().toUpperCase();
  const tp          = props._type;

  // 1. Điện kế
  if (upperMtb.startsWith('PES') || upperId.startsWith('PES') ||
      upperKhId.startsWith('PE') || upperDiachi.startsWith('PE0') ||
      tp === 'point_dk' || layer.includes('DIENKE')) {
    return AssetType.METER;
  }

  // 2. TRẠM BIẾN ÁP thật (point_tram_tt / F04_Tram_TT_S)
  if (tp === 'point_tram_tt' || tp === 'point_tram_ht' ||
      loaiTb.includes('TRAM') || layer.includes('TRAM_') || layer.endsWith('TRAM') ||
      upperMtb.startsWith('TBA') || upperId.startsWith('TBA')) {
    return AssetType.SUBSTATION;
  }

  // 3. Tủ điện (TBDC)
  if (tp === 'point_tbdc' || layer.includes('TBDC') || upperMtb.includes('TBDC')) {
    return AssetType.SWITCHGEAR;
  }

  // 4. TBTTDL — device gateway, coi như meter
  if (tp === 'point_tba' || layer.includes('TBTTDL')) {
    return AssetType.METER;
  }

  // 5. Trụ trung thế
  if (upperId.startsWith('F08') || upperMtb.startsWith('F08') ||
      tp === 'point_tru_tt' || layer.includes('F08_') || layer.includes('_TT_')) {
    return AssetType.POLE_MV;
  }

  // 6. Trụ hạ thế
  if (upperId.startsWith('F07') || upperMtb.startsWith('F07') ||
      tp === 'point_tru_ht' || layer.includes('F07_') || layer.includes('_HT_')) {
    return AssetType.POLE_LV;
  }

  return AssetType.POLE_LV;
}

// Loading component
const LoadingSpinner = () => (
  <div className="fixed inset-0 bg-white flex items-center justify-center z-[10000]">
    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-red-600 text-3xl"></i>
            </div>
            <h2 className="text-2xl font-bold mb-2">Có lỗi xảy ra</h2>
            <p className="text-slate-600 mb-4">Vui lòng tải lại trang</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold"
            >
              Tải lại
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Component components UI V5.0
const AppHeader: React.FC<{ userName: string; unit: string; role: string | null; onLogout: () => void }> = memo(({ userName, unit, role, onLogout }) => (
  <header className="app-header animate-slide" style={{ paddingTop: 'calc(var(--safe-top) + 0.5rem)' }}>
    <div className="flex items-center gap-3">
      <div className="header-logo">
        <i className="fas fa-bolt"></i>
      </div>
      <div>
        <h1 className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-0.5">PowerMind v6.2</h1>
        <p className="text-sm font-black text-slate-900 leading-tight">{userName}</p>
      </div>
    </div>
    <div className="flex items-center gap-2.5">
      <div className="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">{role === 'admin' ? 'Quản trị' : 'Kỹ thuật'}</span>
      </div>
      <button onClick={onLogout} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90">
        <i className="fas fa-power-off text-sm"></i>
      </button>
    </div>
  </header>
));

const BottomNav: React.FC<{ view: string; role: string | null; onViewChange: (v: any) => void }> = memo(({ view, role, onViewChange }) => (
  <nav className="bottom-nav" style={{ paddingBottom: 'calc(var(--safe-bottom) + 0.75rem)', height: 'calc(4.5rem + var(--safe-bottom))' }}>
    <button onClick={() => onViewChange('collect')} className={`nav-item ${view === 'collect' ? 'active' : ''}`}>
      <i className="fas fa-map-marked-alt text-xl"></i>
      <span>Bản đồ</span>
    </button>
    
    <button onClick={() => onViewChange('pins')} className={`nav-item ${view === 'pins' ? 'active' : ''}`}>
      <i className="fas fa-route text-xl"></i>
      <span>Lộ trình</span>
    </button>
    
    {role === 'admin' && (
      <button onClick={() => onViewChange('inspect')} className={`nav-item ${view === 'inspect' ? 'active' : ''}`}>
        <i className="fas fa-clipboard-check text-xl"></i>
        <span>Kiểm tra</span>
      </button>
    )}
    
    {role === 'admin' && (
      <button onClick={() => onViewChange('manage')} className={`nav-item ${view === 'manage' ? 'active' : ''}`}>
        <i className="fas fa-th-large text-xl"></i>
        <span>Quản lý</span>
      </button>
    )}
  </nav>
));


const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    try {
      const savedAssets = localStorage.getItem(STORAGE_KEYS.ASSETS);
      const savedLines = localStorage.getItem(STORAGE_KEYS.LINES);
      const savedPinned = localStorage.getItem('evnhcmc_pinned_assets');
      const savedDone   = localStorage.getItem('evnhcmc_completed_assets');
      const doneDate    = localStorage.getItem('evnhcmc_completed_date');
      const today       = new Date().toISOString().split('T')[0];
      // Reset danh sách "đã làm" mỗi ngày
      const completedAssetIds = (doneDate === today && savedDone) ? JSON.parse(savedDone) : [];

      return {
        view: 'collect',
        assets: savedAssets ? JSON.parse(savedAssets) : [],
        lines: savedLines ? JSON.parse(savedLines) : [],
        currentLocation: null,
        selectedAsset: null,
        selectedLine: null,
        flyToAsset: null,
        userName: localStorage.getItem(STORAGE_KEYS.USER_NAME) || "",
        unit: localStorage.getItem(STORAGE_KEYS.UNIT) || "",
        projectId: localStorage.getItem(STORAGE_KEYS.PROJECT_ID) || "DA-2026-LUOI-DIEN",
        filterDate: new Date().toISOString().split('T')[0],
        isSyncing: false,
        isMovingMode: false,
        isRegionMode: false,
        isDriveConnected: false,
        syncStats: { pending: 0, failed: 0, completed: 0 },
        pinnedAssetIds: savedPinned ? JSON.parse(savedPinned) : [],
        completedAssetIds,
        userRole: (localStorage.getItem('evnhcmc_role') as any) || null
      };
    } catch (e) {
      return {
        view: 'collect',
        assets: [], lines: [], currentLocation: null,
        selectedAsset: null, selectedLine: null,
        flyToAsset: null,
        userName: "", unit: "", projectId: "DA-2026-LUOI-DIEN",
        filterDate: new Date().toISOString().split('T')[0],
        isSyncing: false, isMovingMode: false, isRegionMode: false,
        isDriveConnected: false,
        syncStats: { pending: 0, failed: 0, completed: 0 },
        pinnedAssetIds: [],
        completedAssetIds: [],
        userRole: null
      };
    }
  });

  const [uiState, setUiState] = useState({
    isIdentified: !!localStorage.getItem('evnhcmc_role'),
    isCameraOpen: false,
    smartMode: null as 'capture' | 'scan' | 'ocr' | null,
    tempPhotos: [] as string[],
    smartImages: [] as any[],
    activeFormType: null as AssetType | null,
    editingAsset: null as GridAsset | null,
    mapCenter: DEFAULT_CENTER,
    showTypeSelector: false,
    isWiringMode: false,
    wiringStartAsset: null as GridAsset | null,
    flyToAsset: null as GridAsset | null,
    focusCustomerLocation: null as { lat: number; lng: number } | null,
    syncError: null as string | null,
    showReportExporter: false,
    showSearch: false,
    activeInspectionAsset: null as GridAsset | null,
    userRole: localStorage.getItem('evnhcmc_role'),
    searchPastQuery: '',
    pastSearchResults: [] as GridAsset[],
    pendingLocationChange: null as any,
    autoSyncTimer: null as NodeJS.Timeout | null,
    isOfflineMode: false,
    FirebaseAvailable: true,
    activeTab: 'map' as 'map' | 'pins' | 'inspect' | 'settings',
    isPinningMode: false
  });

  const hasFlownToLocation = useRef(false);

  // Static data version & update banner
  const [dataVersion, setDataVersion] = useState<number | null>(null);
  const [hasDataUpdate, setHasDataUpdate] = useState(false);

  // Initialise static tile data + search index ngay khi app start
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await initTileData({
          onUpdateAvailable: (ver) => {
            if (cancelled) return;
            console.log(`[PowerMind] Có bản data mới: ${ver}`);
            setHasDataUpdate(true);
          },
        });
        if (cancelled) return;
        setDataVersion(m.version);
        // Search index tải lazy — đợi user mở search lần đầu (load khi cần).
        // Nhưng với 8MB gzip, có thể preload nền sau 2s để search tức thì.
        setTimeout(() => { loadSearchIndex().catch(err => console.warn('Search index load failed:', err)); }, 2000);
      } catch (e) {
        console.warn('[PowerMind] Static data init failed — dùng backend fallback:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const applyDataUpdate = useCallback(() => {
    // Clear RAM cache + hard reload (SW đã xoá tiles-data trong initTileData)
    window.location.reload();
  }, []);

  // Import lộ trình từ URL chia sẻ (#pins=KH1,KH2,...) — 1 lần duy nhất khi load
  const [sharedImport, setSharedImport] = useState<string[] | null>(null);
  useEffect(() => {
    const ids = readFragmentPins();
    if (ids.length === 0) return;
    setSharedImport(ids);
    clearFragment();
  }, []);

  const applySharedPins = useCallback(() => {
    if (!sharedImport?.length) return;
    setState(prev => {
      const merged = [...sharedImport.filter(id => !prev.pinnedAssetIds.includes(id)), ...prev.pinnedAssetIds];
      localStorage.setItem('evnhcmc_pinned_assets', JSON.stringify(merged));
      return { ...prev, pinnedAssetIds: merged, view: 'pins' };
    });
    setSharedImport(null);
  }, [sharedImport]);

  const {
    isSyncing: cloudSyncing,
    pendingCount,
    sync: syncToCloud,
    fetch: fetchFromCloud,
    retryPending
  } = useCloudSync(
    state.assets,
    state.lines,
    state.projectId,
    state.unit,
    state.userName
  );

  const draftCount = useMemo(() => 
    state.assets.filter(a => a.status === 'Draft').length,
    [state.assets]
  );

  // Helper: convert GeoJSON feature → GridAsset (dùng lại ở cả loadGridAround & fetchAssetsInView)
  const featureToAsset = useCallback((f: any): any | null => {
    const g = f.geometry;
    if (!g || g.type !== 'Point') return null;
    const id = f.properties.GISID || f.properties.MATHIETBI || `GIS-${Math.random()}`;
    const props = f.properties || {};
    const pLat = g.coordinates[1];
    const pLng = g.coordinates[0];
    const { x, y } = convertWGS84toVN2000(pLat, pLng);
    const assetType = classifyAsset(props, id);
    const upperKhId = (props.KH_ID || props.MA_KHANG || props.MA_KH || "").toString().toUpperCase().trim();
    const sotru    = (props.SOTRU || props.MAHIEU || props.VITRI || "").toString().trim();
    const displayName = assetType === AssetType.METER
      ? (upperKhId ? `Điện kế ${upperKhId}` : (props.MATHIETBI ? `Điện kế ${props.MATHIETBI}` : "Điện kế"))
      : assetType === AssetType.SUBSTATION
      ? (props.TEN || props.CHIDANH || `Trạm ${props.TBT_ID || props.MATHIETBI || ''}`)
      : (sotru ? `Trụ ${sotru}` : (props.TEN || (assetType === AssetType.POLE_MV ? "Trụ Trung Thế" : "Trụ Hạ Thế")));
    return {
      id, name: displayName,
      code: props.MATHIETBI || sotru || id,
      type: assetType,
      coords: { lat: pLat, lng: pLng, x_vn2000: x, y_vn2000: y },
      customerCode: upperKhId.startsWith('PE') ? upperKhId : (props.KH_ID || ""),
      status: 'Synced' as const,
      rawProperties: { ...props, SOTRU: sotru },
      photoUrls: [], timestamp: Date.now(),
      unit: "GIS", collectorName: "GIS", collectorId: "GIS_SYSTEM",
    };
  }, []);

  // Helper: feature → PowerLine
  const featureToLine = useCallback((f: any, typeHint: 'MV' | 'LV'): any[] => {
    if (!f.geometry || !f.geometry.type.includes('Line')) return [];
    const segments: any[][] = f.geometry.type === 'MultiLineString'
      ? f.geometry.coordinates
      : [f.geometry.coordinates];
    return segments
      .filter((seg: any[]) => Array.isArray(seg) && seg.length >= 2)
      .map((seg: any[], idx: number) => {
        const coords = seg.map((c: any) => ({ lat: c[1], lng: c[0] }));
        let length = parseFloat(f.properties.LENGTH || "0");
        if (length <= 0 && coords.length >= 2) {
          length = 0;
          for (let i = 0; i < coords.length - 1; i++) {
            length += calculateDistance(coords[i].lat, coords[i].lng, coords[i+1].lat, coords[i+1].lng);
          }
        }
        return {
          id: `${f.properties.GISID || f.properties.MATHIETBI || `${typeHint}-${Math.random()}`}${segments.length > 1 ? `-${idx}` : ''}`,
          name: f.properties.TEN || (typeHint === 'MV' ? "Đường dây TT" : "Dây hạ thế"),
          type: typeHint,
          fromId: f.properties.START_ID || '',
          toId:   f.properties.END_ID || '',
          length: Math.round(length),
          isUnderground: !!f.properties.CAP_NGAM,
          coords,
          rawProperties: f.properties,
          status: 'Synced' as const,
        };
      });
  }, []);

  // Load lưới trung thế + TBA quanh điểm từ STATIC TILES (zero backend)
  const loadGridAround = useCallback(async (lat: number, lng: number, range = 0.008) => {
    try {
      await loadTilesForBbox(lat - range, lat + range, lng - range, lng + range, ['tt']);
      const feats = queryBbox(lat - range, lat + range, lng - range, lng + range, ['tt'], 1000);
      const mvLines: any[] = [];
      const mvPoles: any[] = [];
      for (const f of feats) {
        if (f.geometry?.type === 'Point') {
          const a = featureToAsset(f);
          if (a) mvPoles.push(a);
        } else if (f.geometry?.type?.includes('Line')) {
          mvLines.push(...featureToLine(f, 'MV'));
        }
      }
      setState(prev => {
        const lineMap = new Map<string, any>();
        prev.lines.forEach(l => lineMap.set(l.id, l));
        mvLines.forEach(l => lineMap.set(l.id, l));
        const assetMap = new Map<string, any>();
        prev.assets.forEach(a => assetMap.set(a.id, a));
        mvPoles.forEach(a => assetMap.set(a.id, a));
        return {
          ...prev,
          lines:  Array.from(lineMap.values()).slice(-1000),
          assets: Array.from(assetMap.values()).slice(-500),
        };
      });
    } catch (e) {
      console.error('[loadGridAround] lỗi:', e);
    }
  }, [featureToAsset, featureToLine]);

  // ============= GPS TRACKING & GEOLOCATION =============
  useEffect(() => {
    if (!uiState.isIdentified) return;

    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { x, y } = convertWGS84toVN2000(pos.coords.latitude, pos.coords.longitude);
          
          // Tự động bay về vị trí GPS lần đầu (v10.0)
          if (!hasFlownToLocation.current && pos.coords.latitude) {
            setUiState(prev => ({ 
              ...prev, 
              mapCenter: { lat: pos.coords.latitude, lng: pos.coords.longitude },
              flyToAsset: { id: 'GPS-INIT', coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } } as any
            }));
            hasFlownToLocation.current = true;
          }

          setState(prev => ({
            ...prev,
            currentLocation: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              x_vn2000: x,
              y_vn2000: y
            }
          }));
        },
        (err) => console.warn("⚠️ GPS Error:", err.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [uiState.isIdentified]);

  // ============= GPS PROXIMITY AUTO-COMPLETE =============
  // Khi GPS đi vào trong 30m của 1 điểm đã ghim → tự đánh dấu ĐÃ LÀM XONG.
  const COMPLETION_RADIUS_M = 30;
  useEffect(() => {
    if (!state.currentLocation) return;
    if (state.pinnedAssetIds.length === 0) return;
    const { lat, lng } = state.currentLocation;

    const toMark: string[] = [];
    for (const pinId of state.pinnedAssetIds) {
      if (state.completedAssetIds.includes(pinId)) continue;
      const asset = state.assets.find(a => a.id === pinId);
      if (!asset) continue;
      const dist = calculateDistance(lat, lng, asset.coords.lat, asset.coords.lng);
      if (dist <= COMPLETION_RADIUS_M) toMark.push(pinId);
    }
    if (toMark.length === 0) return;

    setState(prev => {
      const merged = [...toMark.filter(id => !prev.completedAssetIds.includes(id)), ...prev.completedAssetIds];
      if (merged.length === prev.completedAssetIds.length) return prev;
      localStorage.setItem('evnhcmc_completed_assets', JSON.stringify(merged));
      localStorage.setItem('evnhcmc_completed_date', new Date().toISOString().split('T')[0]);
      return { ...prev, completedAssetIds: merged };
    });
  }, [state.currentLocation, state.pinnedAssetIds, state.completedAssetIds, state.assets]);

  // ============= GIS DATA FETCHING (ON-DEMAND & SAFETY) =============
  const handleSearchSelect = useCallback(async (asset: GridAsset) => {
    const lat = Number(asset.coords?.lat);
    const lng = Number(asset.coords?.lng);
    const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);

    // Nếu điểm này chưa có trong state, thêm vào để hiển thị chi tiết
    setState(prev => {
      const exists = prev.assets.find(a => a.id === asset.id);
      if (exists) return { ...prev, selectedAsset: asset };
      return { ...prev, assets: [...prev.assets, asset], selectedAsset: asset };
    });

    if (hasValidCoords) {
      setUiState(prev => ({
        ...prev,
        mapCenter: asset.coords,
        flyToAsset: asset,
        showSearch: false,
        // Mọi loại kết quả đều focus: bản đồ chỉ load quanh điểm này (≤ 200 object)
        focusCustomerLocation: { lat, lng },
      }));
      // Tải lưới trung thế + trạm quanh điểm đã chọn (≤ 500 segment)
      loadGridAround(lat, lng, 0.008);
    } else {
      console.warn('[Search] Kết quả không có toạ độ:', asset.id, asset.name);
      setUiState(prev => ({ ...prev, showSearch: false, focusCustomerLocation: null }));
    }
  }, [loadGridAround]);

  const fetchAssetsInView = useCallback(async (lat: number, lng: number, zoom: number) => {
    if (!uiState.isIdentified || zoom < 16) return;
    const range = 0.005; // ~550m

    try {
      // 1. Tải điểm (dk layer) từ static tiles
      await loadTilesForBbox(lat - range, lat + range, lng - range, lng + range, ['dk']);
      const diemFeats = queryBbox(lat - range, lat + range, lng - range, lng + range, ['dk'], 200);
      const gisAssets = diemFeats.map(featureToAsset).filter((a): a is any => !!a);

      if (gisAssets.length) {
        setState(prev => {
          const assetMap = new Map<string, any>();
          prev.assets.forEach(a => assetMap.set(a.id, a));
          gisAssets.forEach(a => assetMap.set(a.id, a));
          return { ...prev, assets: Array.from(assetMap.values()).slice(-5000) };
        });
      }

      // 2. Tải dây hạ thế khi zoom ≥ 17
      if (zoom >= 17) {
        await loadTilesForBbox(lat - range, lat + range, lng - range, lng + range, ['ht']);
        const htFeats = queryBbox(lat - range, lat + range, lng - range, lng + range, ['ht'], 300);
        const lvLines: any[] = [];
        for (const f of htFeats) lvLines.push(...featureToLine(f, 'LV'));
        if (lvLines.length) {
          setState(prev => {
            const lineMap = new Map<string, any>();
            prev.lines.forEach(l => lineMap.set(l.id, l));
            lvLines.forEach(l => lineMap.set(l.id, l));
            return { ...prev, lines: Array.from(lineMap.values()).slice(-2000) };
          });
        }
      }
    } catch (e) {
      console.warn('[fetchAssetsInView] lỗi:', e);
    }
  }, [uiState.isIdentified, featureToAsset, featureToLine]);

  // Chỉ tải dữ liệu lưới khi user đã tìm/chọn 1 khách hàng.
  // Khi chưa search → bản đồ trống (chỉ basemap + GPS) để máy yếu chạy mượt.
  useEffect(() => {
    if (!uiState.focusCustomerLocation) return;
    const { lat, lng } = uiState.focusCustomerLocation;
    const timeoutId = setTimeout(() => {
      fetchAssetsInView(lat, lng, 18);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [uiState.focusCustomerLocation, fetchAssetsInView]);

  // ============= AUTO-SAVE TO LOCAL STORAGE =============
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        // CHỈ LƯU CÁC ĐIỂM DRAFT (CHƯA ĐỒNG BỘ) ĐỂ TRÁNH TRÀN BỘ NHỚ (QuotaExceededError)
        const draftsOnly = state.assets.filter(a => a.status === 'Draft');
        localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(draftsOnly));
        localStorage.setItem(STORAGE_KEYS.LINES, JSON.stringify(state.lines));
      } catch (e) {
        console.error("❌ Persistence Error:", e);
      }
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [state.assets, state.lines]);

  // ============= HANDLERS =============
  const handleMapClick = useCallback((lat?: number, lng?: number) => {
    if (uiState.isPinningMode && lat !== undefined && lng !== undefined) {
      const { x, y } = convertWGS84toVN2000(lat, lng);
      const newPin: GridAsset = {
        id: `PIN-${Date.now()}`,
        name: `Điểm ghim #${state.assets.filter(a => a.type === AssetType.TEMP_PIN).length + 1}`,
        code: `PIN-${Date.now()}`,
        type: AssetType.TEMP_PIN,
        coords: { lat, lng, x_vn2000: x, y_vn2000: y },
        photoUrls: [],
        timestamp: Date.now(),
        unit: state.unit,
        collectorName: state.userName,
        collectorId: 'PINNER',
        status: 'Draft'
      };
      
      setState(prev => {
        const newAssets = [newPin, ...prev.assets];
        const newPinned = [newPin.id, ...prev.pinnedAssetIds];
        localStorage.setItem('evnhcmc_pinned_assets', JSON.stringify(newPinned));
        return { ...prev, assets: newAssets, pinnedAssetIds: newPinned };
      });
      return;
    }

    if (uiState.isWiringMode) {
      setUiState(prev => ({ ...prev, isWiringMode: false, wiringStartAsset: null }));
    } else if (state.isMovingMode) {
      setState(prev => ({ ...prev, isMovingMode: false }));
    }
  }, [uiState.isPinningMode, uiState.isWiringMode, state.isMovingMode, state.assets.length, state.unit, state.userName, state.pinnedAssetIds]);

  const handleAssetClick = useCallback((asset: GridAsset) => {
    if (uiState.isWiringMode) {
      if (!uiState.wiringStartAsset) {
        setUiState(prev => ({ ...prev, wiringStartAsset: asset }));
      } else if (uiState.wiringStartAsset.id !== asset.id) {
        const dist = calculateDistance(
          uiState.wiringStartAsset.coords.lat, uiState.wiringStartAsset.coords.lng,
          asset.coords.lat, asset.coords.lng
        );
        const lineType = (asset.type === AssetType.POLE_MV || uiState.wiringStartAsset.type === AssetType.POLE_MV) ? 'MV' : 'LV';
        const newLine: PowerLine = {
          id: `LINE-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          fromId: uiState.wiringStartAsset.id,
          toId: asset.id,
          type: lineType,
          length: Math.round(dist * 100) / 100,
          isUnderground: false,
          timestamp: Date.now(),
          status: 'Draft'
        };
        setState(prev => ({ ...prev, lines: [...prev.lines, newLine] }));
        setUiState(prev => ({ ...prev, wiringStartAsset: null, isWiringMode: false }));
      }
      return;
    }
    if (!state.isMovingMode) {
      setState(prev => ({ ...prev, selectedAsset: asset }));
    }
  }, [uiState.isWiringMode, uiState.wiringStartAsset, state.isMovingMode]);

  const handleAssetMove = useCallback((id: string, newLat: number, newLng: number) => {
    const { x, y } = convertWGS84toVN2000(newLat, newLng);
    setState(prev => ({
      ...prev,
      assets: prev.assets.map(a => a.id === id ? {
        ...a,
        coords: { lat: newLat, lng: newLng, x_vn2000: x, y_vn2000: y },
        status: 'Draft' as const
      } : a)
    }));
  }, []);

  const handleSaveAsset = useCallback((formData: Partial<GridAsset>) => {
    if (uiState.editingAsset) {
      setState(prev => ({
        ...prev,
        assets: prev.assets.map(a => a.id === uiState.editingAsset?.id ? { ...a, ...formData, status: 'Draft' as const } : a),
        selectedAsset: null
      }));
      setUiState(prev => ({ ...prev, editingAsset: null, tempPhotos: [] }));
      return;
    }
    const { x, y } = convertWGS84toVN2000(uiState.mapCenter.lat, uiState.mapCenter.lng);
    const newAsset: GridAsset = {
      id: `ASSET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: uiState.activeFormType!,
      name: formData.name || `${uiState.activeFormType} mới`,
      code: formData.code || `CODE-${Date.now()}`,
      address: formData.address || "",
      unit: state.unit,
      coords: { lat: uiState.mapCenter.lat, lng: uiState.mapCenter.lng, x_vn2000: x, y_vn2000: y },
      photoUrls: [...uiState.tempPhotos],
      timestamp: Date.now(),
      collectorName: state.userName,
      collectorId: state.userName,
      status: 'Draft'
    };
    setState(prev => ({ ...prev, assets: [newAsset, ...prev.assets] }));
    setUiState(prev => ({ ...prev, activeFormType: null, tempPhotos: [] }));
  }, [uiState.editingAsset, uiState.activeFormType, uiState.mapCenter, uiState.tempPhotos, state.unit, state.userName]);

  const handlePinToggle = useCallback((id: string) => {
    setState(prev => {
      const isPinned = prev.pinnedAssetIds.includes(id);
      const newPinned = isPinned ? prev.pinnedAssetIds.filter(pid => pid !== id) : [id, ...prev.pinnedAssetIds];
      localStorage.setItem('evnhcmc_pinned_assets', JSON.stringify(newPinned));
      return { ...prev, pinnedAssetIds: newPinned };
    });
  }, []);

  /** Đánh dấu 1 điểm đã ghim là ĐÃ LÀM XONG. Không đổi pin — chỉ thêm vào completedAssetIds. */
  const handleMarkCompleted = useCallback((id: string) => {
    setState(prev => {
      if (prev.completedAssetIds.includes(id)) return prev;
      const newDone = [id, ...prev.completedAssetIds];
      localStorage.setItem('evnhcmc_completed_assets', JSON.stringify(newDone));
      localStorage.setItem('evnhcmc_completed_date', new Date().toISOString().split('T')[0]);
      return { ...prev, completedAssetIds: newDone };
    });
  }, []);

  /** Reset "đã làm xong" khi đầu ngày mới hoặc user muốn làm lại. */
  const handleResetCompleted = useCallback(() => {
    if (!window.confirm('Đánh dấu lại TẤT CẢ điểm ghim thành "chưa xong" để làm tiếp?')) return;
    localStorage.removeItem('evnhcmc_completed_assets');
    localStorage.removeItem('evnhcmc_completed_date');
    setState(prev => ({ ...prev, completedAssetIds: [] }));
  }, []);

  /** Xoá sạch ghim + lịch sử để bắt đầu lộ trình mới (dùng đầu ngày). */
  const handleClearAllPins = useCallback(() => {
    if (!window.confirm('Xoá TOÀN BỘ ghim & lịch sử làm việc để bắt đầu ngày mới?')) return;
    localStorage.removeItem('evnhcmc_pinned_assets');
    localStorage.removeItem('evnhcmc_completed_assets');
    localStorage.removeItem('evnhcmc_completed_date');
    setState(prev => ({ ...prev, pinnedAssetIds: [], completedAssetIds: [] }));
  }, []);

  /** Ghim + thêm asset vào state — dùng khi pin từ Search popup (asset chưa tồn tại trong state). */
  const handlePinAssetFromSearch = useCallback((asset: GridAsset) => {
    setState(prev => {
      const exists = prev.assets.find(a => a.id === asset.id);
      const newAssets = exists ? prev.assets : [...prev.assets, asset];
      const isPinned  = prev.pinnedAssetIds.includes(asset.id);
      const newPinned = isPinned
        ? prev.pinnedAssetIds.filter(pid => pid !== asset.id)
        : [asset.id, ...prev.pinnedAssetIds];
      localStorage.setItem('evnhcmc_pinned_assets', JSON.stringify(newPinned));
      return { ...prev, assets: newAssets, pinnedAssetIds: newPinned };
    });
  }, []);

  const performSync = useCallback(async () => {
    setState(p => ({ ...p, isSyncing: true }));
    try {
      for (const asset of state.assets.filter(a => a.status === 'Draft')) {
        await syncQueueService.addToQueue({ type: 'asset', data: asset });
      }
      syncQueueService.processQueue();
      setState(prev => ({ ...prev, isSyncing: false, assets: prev.assets.map(a => a.status === 'Draft' ? { ...a, status: 'Synced' } : a) }));
    } catch (e) {
      setState(p => ({ ...p, isSyncing: false }));
    }
  }, [state.assets]);

  return (
    <ErrorBoundary>
      <div className="app-container">
        {/* Banner import lộ trình từ link chia sẻ (#pins=...) */}
        {sharedImport && sharedImport.length > 0 && (
          <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-2xl animate-slide-down">
            <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3" style={{ paddingTop: 'calc(var(--safe-top) + 0.75rem)' }}>
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                <i className="fas fa-route text-lg"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase tracking-widest opacity-90">Lộ trình được chia sẻ</p>
                <p className="text-sm font-black">{sharedImport.length} điểm KH · bấm để thêm vào ghim</p>
              </div>
              <button
                onClick={() => setSharedImport(null)}
                className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center active:scale-95 shrink-0"
                title="Bỏ qua"
              >
                <i className="fas fa-times"></i>
              </button>
              <button
                onClick={applySharedPins}
                className="bg-white text-orange-700 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 shrink-0"
              >
                Nhận lộ trình
              </button>
            </div>
          </div>
        )}

        {/* Banner auto-update data — admin push xong user mở app = thấy ngay */}
        {hasDataUpdate && (
          <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xl animate-slide-down">
            <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3" style={{ paddingTop: 'calc(var(--safe-top) + 0.75rem)' }}>
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                <i className="fas fa-cloud-arrow-down text-lg"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase tracking-widest opacity-80">Có dữ liệu mới</p>
                <p className="text-sm font-black">Admin vừa cập nhật lưới điện · bấm để tải</p>
              </div>
              <button
                onClick={applyDataUpdate}
                className="bg-white text-blue-700 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 shrink-0"
              >
                Cập nhật
              </button>
            </div>
          </div>
        )}
        {!uiState.isIdentified ? (
          <Suspense fallback={<LoadingSpinner />}>
            <ModernLogin onLogin={(role, name) => {
              localStorage.setItem('evnhcmc_role', role);
              localStorage.setItem('evnhcmc_user_name', name);
              setUiState(prev => ({ ...prev, isIdentified: true, userRole: role }));
              setState(prev => ({ ...prev, userName: name, unit: 'EVNHCMC' }));
            }} />
          </Suspense>
        ) : (
          <>
            <AppHeader 
              userName={state.userName} 
              unit={state.unit} 
              role={uiState.userRole}
              onLogout={() => {
                localStorage.removeItem('evnhcmc_role');
                localStorage.removeItem('evnhcmc_user_name');
                setUiState(prev => ({ ...prev, isIdentified: false, userRole: null }));
              }}
            />

            <main className="flex-1 relative w-full overflow-hidden flex flex-col">
              {state.view === 'collect' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <MapModule 
                    assets={state.assets}
                    lines={state.lines}
                    currentLocation={state.currentLocation}
                    isWiringMode={uiState.isWiringMode}
                    isMovingMode={state.isMovingMode}
                    isRegionMode={state.isRegionMode}
                    wiringStartId={uiState.wiringStartAsset?.id || null}
                    onAssetSelect={handleAssetClick}
                    onAssetMove={handleAssetMove}
                    onCenterChange={(c) => setUiState(prev => ({ ...prev, mapCenter: c }))}
                    onMapClickAction={handleMapClick}
                    onLineClick={(id) => setState(p => ({ 
                      ...p, 
                      selectedLine: p.lines.find(l => l.id === id) || null 
                    }))}
                    flyToAsset={state.view === 'collect' ? uiState.flyToAsset : null}
                    onFlyToComplete={() => setUiState(p => ({ ...p, flyToAsset: null }))}
                    pinnedAssetIds={state.pinnedAssetIds}
                    completedAssetIds={state.completedAssetIds}
                    initialCenter={DEFAULT_CENTER}
                    focusCustomerLocation={uiState.focusCustomerLocation}
                    onResetCompleted={handleResetCompleted}
                    onClearAllPins={handleClearAllPins}
                  />
                  
                  {/* Top Persistent Search Bar - v8.0 Optimized for Mobile Notch */}
                  <div className="absolute left-4 right-16 z-[1000] animate-slide-down" style={{ top: 'calc(var(--safe-top) + 1rem)' }}>
                    <button 
                      onClick={() => setUiState(p => ({ ...p, showSearch: true, focusCustomerLocation: null }))}
                      className="bg-white/95 backdrop-blur-xl h-14 w-full rounded-2xl shadow-xl shadow-blue-900/10 border border-white/50 flex items-center px-4 gap-4 transition-all active:scale-[0.98] group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                        <i className="fas fa-search text-sm"></i>
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none mb-0.5">Tìm kiếm theo mã PE, số trụ...</p>
                        <p className="text-xs font-bold text-slate-400 truncate">Nhấn để bắt đầu tìm kiếm lưới điện</p>
                      </div>
                    </button>
                  </div>

                  {/* Active Mode Indicator */}
                  {(uiState.isPinningMode || state.isMovingMode) && (
                    <div className="absolute left-1/2 -translate-x-1/2 z-[1000] animate-bounce-subtle" style={{ top: 'calc(var(--safe-top) + 5.5rem)' }}>
                      <div className={`px-4 py-2 rounded-full shadow-lg border flex items-center gap-2 ${
                        uiState.isPinningMode ? 'bg-amber-600 border-amber-500 text-white' : 'bg-blue-600 border-blue-500 text-white'
                      }`}>
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                          {uiState.isPinningMode ? 'Chế độ ghim nhanh: Chạm bản đồ' : 'Đang di chuyển đối tượng'}
                        </span>
                        <button 
                          onClick={() => setUiState(p => ({ ...p, isPinningMode: false }))}
                          className="ml-2 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center"
                        >
                          <i className="fas fa-times text-[8px]"></i>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Map Floating Controls - Light Style */}
                  <div className="map-controls-layer">
                    <div className="flex flex-col gap-3 p-4">
                      <button onClick={() => setUiState(p => ({ ...p, showTypeSelector: true }))} className="fab fab-primary">
                        <i className="fas fa-plus"></i>
                      </button>
                      <button 
                        onClick={() => setState(p => ({ ...p, isMovingMode: !p.isMovingMode, isRegionMode: false }))}
                        className={`fab ${state.isMovingMode ? 'bg-blue-600 !text-white !border-blue-600 shadow-blue-200' : ''}`}
                      >
                        <i className="fas fa-arrows-alt"></i>
                      </button>
                      <button 
                        onClick={() => setUiState(p => ({ ...p, smartMode: 'scan' }))}
                        className="fab"
                      >
                        <i className="fas fa-qrcode"></i>
                      </button>
                      <button 
                        onClick={() => setUiState(p => ({ ...p, isPinningMode: !p.isPinningMode }))}
                        className={`fab ${uiState.isPinningMode ? 'bg-amber-500 !text-white !border-amber-500 shadow-amber-200' : ''}`}
                        title="Chế độ ghim nhanh"
                      >
                        <i className="fas fa-thumbtack"></i>
                      </button>
                    </div>
                  </div>
                </Suspense>
              )}

              {state.view === 'pins' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <div className="flex-1 overflow-y-auto bg-slate-50">
                    <PinBoard
                      assets={state.assets}
                      pinnedIds={state.pinnedAssetIds}
                      completedIds={state.completedAssetIds}
                      currentLocation={state.currentLocation}
                      onSelect={(a) => {
                        setState(p => ({ ...p, view: 'collect', selectedAsset: a }));
                        setUiState(u => ({ ...u, flyToAsset: a }));
                      }}
                      onUnpin={handlePinToggle}
                      onClearAll={handleClearAllPins}
                    />
                  </div>
                </Suspense>
              )}

              {state.view === 'inspect' && (
                <div className="flex-1 flex flex-col items-center justify-center p-10 text-center animate-fade bg-slate-50">
                   <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 shadow-sm border border-blue-50">
                     <i className="fas fa-clipboard-check text-blue-500 text-3xl"></i>
                   </div>
                   <h3 className="text-slate-900 font-black uppercase tracking-tight text-lg italic">Tính năng Kiểm tra</h3>
                   <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">Dành riêng cho kỹ thuật viên hiện trường</p>
                </div>
              )}

              {state.view === 'manage' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <div className="flex-1 overflow-y-auto bg-slate-50">
                    <Dashboard 
                      assets={state.assets}
                      lines={state.lines}
                      filterDate={state.filterDate}
                      isSyncing={state.isSyncing || cloudSyncing}
                      syncStats={state.syncStats}
                      onSync={performSync}
                      onRefreshCloud={() => Promise.resolve()}
                      onFilterDateChange={(d) => setState(p => ({ ...p, filterDate: d }))}
                      onNavigate={(a) => {
                        setState(p => ({ ...p, view: 'collect' }));
                        setUiState(u => ({ ...u, flyToAsset: a }));
                      }}
                      onViewDetail={(a) => setState(p => ({ ...p, selectedAsset: a }))}
                      onBack={() => setState(prev => ({ ...prev, view: 'collect' }))}
                      onOpenReport={() => setUiState(u => ({ ...u, showReportExporter: true }))}
                      showPastData={false}
                      setShowPastData={() => {}}
                      searchPastQuery={uiState.searchPastQuery}
                      setSearchPastQuery={(q) => setUiState(u => ({ ...u, searchPastQuery: q }))}
                      pastSearchResults={uiState.pastSearchResults}
                      pinnedAssetIds={state.pinnedAssetIds}
                    />
                  </div>
                </Suspense>
              )}
            </main>

            <BottomNav 
              view={state.view}
              role={uiState.userRole}
              onViewChange={(v: any) => setState(p => ({ ...p, view: v }))}
            />

            {uiState.showTypeSelector && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-8">
                <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-blue-600 to-cyan-400"></div>
                  <div className="p-6">
                    <h3 className="text-center text-[10px] font-black text-slate-800 uppercase tracking-widest mb-6">THÊM ĐỐI TƯỢNG MỚI</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { type: AssetType.SUBSTATION, color: 'bg-blue-50', textColor: 'text-blue-700', icon: 'fa-bolt', label: 'Trạm Biến Áp' },
                        { type: AssetType.POLE_MV, color: 'bg-violet-50', textColor: 'text-violet-700', icon: 'fa-tower-broadcast', label: 'Trụ Trung Thế' },
                        { type: AssetType.POLE_LV, color: 'bg-emerald-50', textColor: 'text-emerald-700', icon: 'fa-tower-observation', label: 'Trụ Hạ Thế' },
                        { type: AssetType.METER, color: 'bg-pink-50', textColor: 'text-pink-700', icon: 'fa-gauge-high', label: 'Điện kế' },
                        { type: AssetType.SWITCHGEAR, color: 'bg-amber-50', textColor: 'text-amber-700', icon: 'fa-toggle-on', label: 'Thiết bị' }
                      ].map(item => (
                        <button key={item.type} onClick={() => { setUiState(p => ({ ...p, activeFormType: item.type, showTypeSelector: false })); }} className={`flex items-center gap-3 p-4 rounded-2xl ${item.color} ${item.textColor} hover:brightness-95 transition-all`}>
                          <i className={`fas ${item.icon} text-xl`}></i>
                          <span className="text-xs font-bold uppercase">{item.label}</span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setUiState(p => ({ ...p, showTypeSelector: false }))} className="w-full py-4 mt-4 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase">Đóng</button>
                  </div>
                </div>
              </div>
            )}

            {(uiState.activeFormType || uiState.editingAsset) && (
              <Suspense fallback={null}>
                <CollectionForm 
                  type={uiState.activeFormType || (uiState.editingAsset?.type as AssetType)}
                  coords={uiState.editingAsset ? uiState.editingAsset.coords : { ...uiState.mapCenter, ...convertWGS84toVN2000(uiState.mapCenter.lat, uiState.mapCenter.lng) }}
                  photoUrls={uiState.tempPhotos}
                  initialData={uiState.editingAsset || undefined}
                  onSave={handleSaveAsset}
                  onCancel={() => { setUiState(p => ({ ...p, activeFormType: null, editingAsset: null, tempPhotos: [] })); }}
                  onOpenCamera={() => setUiState(p => ({ ...p, isCameraOpen: true }))}
                  onPhotoDelete={(newUrls) => setUiState(p => ({ ...p, tempPhotos: newUrls }))}
                  isSaving={state.isSyncing || cloudSyncing}
                />
              </Suspense>
            )}

            {uiState.showSearch && (
              <Suspense fallback={null}>
                <SearchPopup 
                  assets={state.assets}
                  onClose={() => setUiState(p => ({ ...p, showSearch: false }))}
                  onSelect={handleSearchSelect}
                  onPin={handlePinAssetFromSearch}
                  pinnedIds={state.pinnedAssetIds}
                  currentLocation={state.currentLocation}
                  onViewPins={() => setState(p => ({ ...p, view: 'pins' }))}
                />
              </Suspense>
            )}

            {uiState.activeInspectionAsset && (
              <Suspense fallback={null}>
                <InspectionForm asset={uiState.activeInspectionAsset} userName={state.userName} onClose={() => setUiState(p => ({ ...p, activeInspectionAsset: null }))} onSave={async (r) => {
                   setState(prev => ({ ...prev, assets: prev.assets.map(a => a.id === uiState.activeInspectionAsset?.id ? { ...a, inspections: [r, ...(a.inspections || [])], status: 'Draft' } : a) }));
                   setUiState(p => ({ ...p, activeInspectionAsset: null }));
                }} />
              </Suspense>
            )}

            {state.selectedAsset && (
              <Suspense fallback={null}>
                <AssetDetail asset={state.selectedAsset}
                isCompleted={state.completedAssetIds.includes(state.selectedAsset.id)}
                onDirections={() => handleMarkCompleted(state.selectedAsset!.id)}
                onClose={() => setState(prev => ({ ...prev, selectedAsset: null }))} onNavigate={(a) => { setState(prev => ({ ...prev, view: 'collect' })); setUiState(u => ({ ...u, flyToAsset: a })); }} onUseCoords={(a) => { navigator.clipboard.writeText(`${a.coords.x_vn2000}, ${a.coords.y_vn2000}`); }}
                onDelete={(id) => { if (window.confirm("Xóa?")) setState(p => ({ ...p, assets: p.assets.filter(a => a.id !== id), selectedAsset: null })); }}
                onEdit={(a) => { setUiState(p => ({ ...p, editingAsset: a, tempPhotos: a.photoUrls })); setState(p => ({ ...p, selectedAsset: null })); }}
                onPin={handlePinToggle} isPinned={state.pinnedAssetIds.includes(state.selectedAsset.id)}
                onStartInspection={(asset) => setUiState(prev => ({ ...prev, activeInspectionAsset: asset }))} />
              </Suspense>
            )}

            {state.selectedLine && (
              <Suspense fallback={null}>
                <LineDetail line={state.selectedLine} onSave={(u) => setState(p => ({ ...p, lines: p.lines.map(l => l.id === u.id ? u : l), selectedLine: null }))}
                onDelete={(id) => { if (window.confirm("Xóa?")) setState(p => ({ ...p, lines: p.lines.filter(l => l.id !== id), selectedLine: null })); }}
                onClose={() => setState(p => ({ ...p, selectedLine: null }))} />
              </Suspense>
            )}

            {uiState.showReportExporter && (
              <Suspense fallback={null}>
                <ReportExporter assets={state.assets} lines={state.lines} onClose={() => setUiState(u => ({ ...u, showReportExporter: false }))} />
              </Suspense>
            )}
          </>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
