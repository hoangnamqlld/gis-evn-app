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
import { initTileData, loadSearchIndex, loadTilesForBbox, queryBbox, loadRelations, getSearchItemById } from './services/tileDataService';
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
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string; stack: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '', stack: '' };
  }

  static getDerivedStateFromError(error: any) {
    console.error('[PowerMind] App Crash caught by ErrorBoundary:', error);
    return {
      hasError: true,
      errorMsg: String(error?.message || error || 'Unknown error'),
      stack: String(error?.stack || '').split('\n').slice(0, 6).join('\n'),
    };
  }

  componentDidCatch(_error: any, info: any) {
    console.error('[PowerMind] Error info:', info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-3 flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-red-600 text-2xl"></i>
            </div>
            <h2 className="text-xl font-bold mb-2 text-center">Có lỗi xảy ra</h2>
            <p className="text-slate-600 mb-3 text-center text-sm">Vui lòng tải lại trang</p>
            {this.state.errorMsg && (
              <details className="mb-4 bg-slate-50 rounded-lg p-3 text-left">
                <summary className="text-xs font-bold text-slate-600 cursor-pointer">Chi tiết lỗi (gửi cho dev)</summary>
                <p className="text-[11px] text-red-700 font-mono mt-2 break-words">{this.state.errorMsg}</p>
                {this.state.stack && (
                  <pre className="text-[10px] text-slate-500 font-mono mt-1 whitespace-pre-wrap max-h-32 overflow-y-auto">{this.state.stack}</pre>
                )}
              </details>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold text-sm"
              >
                Tải lại
              </button>
              <button
                onClick={() => this.setState({ hasError: false, errorMsg: '', stack: '' })}
                className="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold text-sm"
              >
                Tiếp tục
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Compact top bar - ESRI Field Maps style
const AppHeader: React.FC<{
  userName: string;
  unit: string;
  role: string | null;
  onLogout: () => void;
  onOpenSearch: () => void;
}> = memo(({ userName, role, onLogout, onOpenSearch }) => (
  <header className="app-header">
    <div className="header-logo" title={userName}>
      <i className="fas fa-bolt"></i>
    </div>
    <button onClick={onOpenSearch} className="esri-search" aria-label="Tìm kiếm">
      <i className="fas fa-search"></i>
      <span>Tìm mã PE, số trụ, trạm…</span>
    </button>
    <button
      onClick={onLogout}
      className="header-icon-btn"
      title={`${userName} · ${role === 'admin' ? 'Quản trị' : 'Kỹ thuật'} · Đăng xuất`}
    >
      <i className="fas fa-ellipsis-vertical text-sm"></i>
    </button>
  </header>
));

const BottomNav: React.FC<{ view: string; role: string | null; onViewChange: (v: any) => void }> = memo(({ view, role, onViewChange }) => (
  <nav className="bottom-nav">
    <button onClick={() => onViewChange('collect')} className={`nav-item ${view === 'collect' ? 'active' : ''}`}>
      <i className="fas fa-map"></i>
      <span>Bản đồ</span>
    </button>
    <button onClick={() => onViewChange('pins')} className={`nav-item ${view === 'pins' ? 'active' : ''}`}>
      <i className="fas fa-thumbtack"></i>
      <span>Lộ trình</span>
    </button>
    {role === 'admin' && (
      <button onClick={() => onViewChange('inspect')} className={`nav-item ${view === 'inspect' ? 'active' : ''}`}>
        <i className="fas fa-clipboard-check"></i>
        <span>Kiểm tra</span>
      </button>
    )}
    {role === 'admin' && (
      <button onClick={() => onViewChange('manage')} className={`nav-item ${view === 'manage' ? 'active' : ''}`}>
        <i className="fas fa-layer-group"></i>
        <span>Quản lý</span>
      </button>
    )}
  </nav>
));


const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    try {
      let assetsArr = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.ASSETS);
        if (raw) {
          const parsed = JSON.parse(raw);
          assetsArr = Array.isArray(parsed) ? parsed : [];
        }
      } catch (e) {
        console.warn('Lỗi parse assets từ local:', e);
      }

      let linesArr = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.LINES);
        if (raw) {
          const parsed = JSON.parse(raw);
          linesArr = Array.isArray(parsed) ? parsed : [];
        }
      } catch (e) {
        console.warn('Lỗi parse lines từ local:', e);
      }

      let pinnedArr = [];
      try {
        const raw = localStorage.getItem('evnhcmc_pinned_assets');
        if (raw) {
          const parsed = JSON.parse(raw);
          pinnedArr = Array.isArray(parsed) ? parsed : [];
        }
      } catch (e) {
        console.warn('Lỗi parse pinned từ local:', e);
      }

      let completedArr = [];
      const savedDone = localStorage.getItem('evnhcmc_completed_assets');
      const doneDate = localStorage.getItem('evnhcmc_completed_date');
      const today = new Date().toISOString().split('T')[0];
      if (doneDate === today && savedDone) {
        try {
          const parsed = JSON.parse(savedDone);
          completedArr = Array.isArray(parsed) ? parsed : [];
        } catch {}
      }

      return {
        view: 'collect',
        assets: assetsArr,
        lines: linesArr,
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
        pinnedAssetIds: pinnedArr,
        completedAssetIds: completedArr,
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
        // Relations (4MB gzip) tải nền sau 3s — cần cho AssetDetail hiển thị "N khách/TBA"
        setTimeout(() => { loadRelations().catch(err => console.warn('Relations load failed:', err)); }, 3000);
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
    // Field thực tế trong source GeoJSON:
    //   TBA  → ASSETDESC ("An Nhơn Tây 27"), công suất ở P (kVA)
    //   TBDC → TEN ("Thị Trấn 43"), CHIDANH ("035738_02")
    //   Trụ  → SOTRU
    const displayName = assetType === AssetType.METER
      ? (upperKhId ? `Điện kế ${upperKhId}` : (props.MATHIETBI ? `Điện kế ${props.MATHIETBI}` : "Điện kế"))
      : assetType === AssetType.SUBSTATION
      ? (props.ASSETDESC || props.TEN || props.CHIDANH || `Trạm ${props.TBT_ID || props.MATHIETBI || ''}`)
      : assetType === AssetType.SWITCHGEAR
      ? (props.TEN || props.CHIDANH || props.MATHIETBI || "Thiết bị đóng cắt")
      : (sotru ? `Trụ ${sotru}` : (assetType === AssetType.POLE_MV ? "Trụ Trung Thế" : "Trụ Hạ Thế"));
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
  // Skip-list: pin vừa bị reset sẽ không auto-complete cho đến khi user đi
  // ra xa điểm reset >100m rồi mới quay lại (tránh loop reset→re-mark).
  const COMPLETION_RADIUS_M = 30;
  const RESET_ESCAPE_M = 100;
  const [autoCompleteSkip, setAutoCompleteSkip] = useState<Record<string, { lat: number; lng: number }>>(() => {
    try {
      const raw = localStorage.getItem('evnhcmc_autocomplete_skip');
      if (raw) { const p = JSON.parse(raw); return p && typeof p === 'object' ? p : {}; }
    } catch {}
    return {};
  });

  useEffect(() => {
    if (!state.currentLocation) return;
    if (state.pinnedAssetIds.length === 0) return;
    const { lat, lng } = state.currentLocation;

    // Xoá khỏi skip-list các pin mà user đã đi xa điểm reset > 100m (sẵn sàng auto-complete lại)
    const skipClear: string[] = [];
    for (const [pinId, origin] of Object.entries(autoCompleteSkip)) {
      if (calculateDistance(lat, lng, origin.lat, origin.lng) > RESET_ESCAPE_M) skipClear.push(pinId);
    }
    if (skipClear.length > 0) {
      setAutoCompleteSkip(prev => {
        const next = { ...prev };
        for (const id of skipClear) delete next[id];
        localStorage.setItem('evnhcmc_autocomplete_skip', JSON.stringify(next));
        return next;
      });
    }

    const toMark: string[] = [];
    for (const pinId of state.pinnedAssetIds) {
      if (state.completedAssetIds.includes(pinId)) continue;
      if (autoCompleteSkip[pinId]) continue; // đang trong skip-list
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
  }, [state.currentLocation, state.pinnedAssetIds, state.completedAssetIds, state.assets, autoCompleteSkip]);

  // ============= GIS DATA FETCHING (ON-DEMAND & SAFETY) =============
  const handleSearchSelect = useCallback(async (asset: GridAsset) => {
    if (!asset) return;
    try {
      let lat = Number(asset.coords?.lat);
      let lng = Number(asset.coords?.lng);
      const inVN = (la: number, lo: number) =>
        Number.isFinite(la) && Number.isFinite(lo) && la >= 7 && la <= 24 && lo >= 102 && lo <= 110;

      // Fallback: nếu asset cached có coords invalid, tra lại từ search index qua id.
      if (!inVN(lat, lng)) {
        const it = getSearchItemById(asset.id);
        if (it && Array.isArray(it.ll) && it.ll.length >= 2) {
          lat = Number(it.ll[0]);
          lng = Number(it.ll[1]);
          const { x, y } = convertWGS84toVN2000(lat, lng);
          asset = { ...asset, coords: { lat, lng, x_vn2000: x, y_vn2000: y } };
        }
      }

      if (!inVN(lat, lng)) {
        console.warn('[Search] Toạ độ không hợp lệ, bỏ qua:', asset.id, asset.name);
        setUiState(prev => ({ ...prev, showSearch: false }));
        return; // Silent — không alert chặn user
      }

      setState(prev => {
        const currentAssets = Array.isArray(prev.assets) ? prev.assets : [];
        const exists = currentAssets.find(a => a.id === asset.id);
        const assets = exists ? currentAssets : [...currentAssets, asset];
        return { ...prev, assets, selectedAsset: asset };
      });

      setUiState(prev => ({
        ...prev,
        mapCenter: { lat, lng },
        flyToAsset: asset,
        showSearch: false,
        focusCustomerLocation: { lat, lng },
      }));

      // loadGridAround có thể throw → không crash app
      if (typeof loadGridAround === 'function') {
        loadGridAround(lat, lng, 0.008).catch((err) => {
          console.warn('[loadGridAround] lỗi (bỏ qua):', err);
        });
      }
    } catch (e) {
      console.error('[handleSearchSelect] crash caught:', e);
      setUiState(prev => ({ ...prev, showSearch: false }));
    }
  }, [loadGridAround]);

  const fetchAssetsInView = useCallback(async (lat: number, lng: number, zoom: number) => {
    if (!uiState.isIdentified || zoom < 16) return;
    const range = 0.005; // ~550m

    try {
      // 1. Tải điểm (dk = điện kế, tt = trụ trung thế/trạm) từ static tiles
      await loadTilesForBbox(lat - range, lat + range, lng - range, lng + range, ['dk', 'tt']);
      const diemFeats = queryBbox(lat - range, lat + range, lng - range, lng + range, ['dk', 'tt'], 400);
      const gisAssets = diemFeats.map(featureToAsset).filter((a): a is any => !!a);

      if (gisAssets.length) {
        setState(prev => {
          const assetMap = new Map<string, any>();
          prev.assets.forEach(a => assetMap.set(a.id, a));
          gisAssets.forEach(a => assetMap.set(a.id, a));
          return { ...prev, assets: Array.from(assetMap.values()).slice(-6000) };
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

  // Tải dữ liệu lưới khi user tìm/chọn 1 khách hàng
  useEffect(() => {
    if (!uiState.focusCustomerLocation) return;
    const { lat, lng } = uiState.focusCustomerLocation;
    const timeoutId = setTimeout(() => {
      fetchAssetsInView(lat, lng, 18);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [uiState.focusCustomerLocation, fetchAssetsInView]);

  // Auto-fetch lưới khi user pan/zoom — debounce 400ms.
  // fetchAssetsInView tự guard zoom < 16 nên không gọi lúc nhìn xa.
  // Tile cache trong tileDataService đảm bảo không request trùng.
  const viewportDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const handleViewportChange = useCallback((lat: number, lng: number, zoom: number) => {
    if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current);
    viewportDebounceRef.current = setTimeout(() => {
      fetchAssetsInView(lat, lng, zoom);
    }, 400);
  }, [fetchAssetsInView]);

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

  /** Sang ngày mới: GỠ các điểm đã xong khỏi lộ trình, GIỮ các điểm chưa xong.
   *  Dùng khi qua ngày hôm sau — chỉ làm tiếp các điểm chưa hoàn thành hôm qua. */
  const handleArchiveCompleted = useCallback(() => {
    const doneCount = state.completedAssetIds.length;
    if (doneCount === 0) {
      window.alert('Chưa có điểm nào đã xong để gỡ.');
      return;
    }
    const pendingCount = state.pinnedAssetIds.filter(id => !state.completedAssetIds.includes(id)).length;
    if (!window.confirm(
      `Gỡ ${doneCount} điểm đã xong, giữ ${pendingCount} điểm chưa xong để làm tiếp?`
    )) return;

    setState(prev => {
      const newPinned = prev.pinnedAssetIds.filter(id => !prev.completedAssetIds.includes(id));
      localStorage.setItem('evnhcmc_pinned_assets', JSON.stringify(newPinned));
      localStorage.removeItem('evnhcmc_completed_assets');
      localStorage.removeItem('evnhcmc_completed_date');
      localStorage.removeItem('evnhcmc_autocomplete_skip');
      return { ...prev, pinnedAssetIds: newPinned, completedAssetIds: [] };
    });
    setAutoCompleteSkip({});
  }, [state.pinnedAssetIds, state.completedAssetIds]);

  /** Reset "đã làm xong" — đồng thời ghi skip-list để auto-complete không re-mark ngay.
   *  Dùng khi muốn LÀM LẠI điểm đã xong (không gỡ khỏi lộ trình).
   *  Skip chỉ giải phóng sau khi user rời điểm reset >100m (xem effect proximity). */
  const handleResetCompleted = useCallback(() => {
    if (!window.confirm('Đánh dấu lại TẤT CẢ điểm ghim thành "chưa xong" để làm tiếp?')) return;
    const resetOrigin = state.currentLocation
      ? { lat: state.currentLocation.lat, lng: state.currentLocation.lng }
      : null;
    const pinsToReset = state.completedAssetIds;
    const nextSkip: Record<string, { lat: number; lng: number }> = { ...autoCompleteSkip };
    if (resetOrigin) {
      for (const id of pinsToReset) nextSkip[id] = resetOrigin;
    }
    localStorage.removeItem('evnhcmc_completed_assets');
    localStorage.removeItem('evnhcmc_completed_date');
    localStorage.setItem('evnhcmc_autocomplete_skip', JSON.stringify(nextSkip));
    setAutoCompleteSkip(nextSkip);
    setState(prev => ({ ...prev, completedAssetIds: [] }));
  }, [state.currentLocation, state.completedAssetIds, autoCompleteSkip]);

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
              onOpenSearch={() => setUiState(p => ({ ...p, showSearch: true, focusCustomerLocation: null }))}
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
                    onViewportChange={handleViewportChange}
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
                    onArchiveCompleted={handleArchiveCompleted}
                    onClearAllPins={handleClearAllPins}
                  />
                  
                  {/* Active Mode Indicator - compact pill */}
                  {(uiState.isPinningMode || state.isMovingMode) && (
                    <div className="absolute left-1/2 -translate-x-1/2 z-[1000]" style={{ top: '8px' }}>
                      <div className={`px-3 py-1.5 rounded-md shadow-md flex items-center gap-2 text-white ${
                        uiState.isPinningMode ? 'bg-amber-600' : 'bg-[#0079c1]'
                      }`}>
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                        <span className="text-[11px] font-semibold leading-none">
                          {uiState.isPinningMode ? 'Chạm bản đồ để ghim' : 'Đang di chuyển đối tượng'}
                        </span>
                        <button
                          onClick={() => setUiState(p => ({ ...p, isPinningMode: false }))
                          }
                          className="ml-1 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center"
                        >
                          <i className="fas fa-times text-[9px]"></i>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ESRI-style FAB stacks - grouped vertical tools on the right */}
                  <div className="fab-stack" style={{ top: '12px' }}>
                    <button
                      onClick={() => setUiState(p => ({ ...p, showTypeSelector: true }))}
                      className="fab fab-primary"
                      title="Thêm đối tượng"
                    >
                      <i className="fas fa-plus"></i>
                    </button>
                    <button
                      onClick={() => setUiState(p => ({ ...p, isPinningMode: !p.isPinningMode }))}
                      className={`fab ${uiState.isPinningMode ? 'fab-active' : ''}`}
                      title="Ghim nhanh"
                    >
                      <i className="fas fa-thumbtack"></i>
                    </button>
                    <button
                      onClick={() => setState(p => ({ ...p, isMovingMode: !p.isMovingMode, isRegionMode: false }))}
                      className={`fab ${state.isMovingMode ? 'fab-active' : ''}`}
                      title="Di chuyển đối tượng"
                    >
                      <i className="fas fa-arrows-alt"></i>
                    </button>
                    <button
                      onClick={() => setUiState(p => ({ ...p, smartMode: 'scan' }))}
                      className="fab"
                      title="Quét QR"
                    >
                      <i className="fas fa-qrcode"></i>
                    </button>
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
              <Suspense fallback={<LoadingSpinner />}>
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
                currentLocation={state.currentLocation}
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
