import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { AssetType, GridAsset, Coordinates, AppState, PowerLine } from './types';
import { convertWGS84toVN2000 } from './utils/vn2000';
import { calculateDistance } from './utils/math';
import './index.css';

// Lazy load components
const CameraModule = lazy(() => import('./components/CameraModule'));
const SmartCameraModule = lazy(() => import('./components/SmartCameraModule'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const MapModule = lazy(() => import('./components/MapModule'));
const CollectionForm = lazy(() => import('./components/CollectionForm'));
const AssetDetail = lazy(() => import('./components/AssetDetail'));
const LineDetail = lazy(() => import('./components/LineDetail'));
const FirebaseLogin = lazy(() => import('./components/FirebaseLogin'));
const FallbackLogin = lazy(() => import('./components/FallbackLogin'));
const SearchPopup = lazy(() => import('./components/SearchPopup'));
const WorklistTray = lazy(() => import('./components/WorklistTray'));
const InspectionForm = lazy(() => import('./components/InspectionForm'));

// Services
import { useCloudSync } from './services/useCloudSync';
import authService from './services/firebase/authService';
import dualSyncService from './services/dualSyncService';
import driveAuthService from './services/driveAuthService';
import syncQueueService from './services/syncQueueService';
import { auth } from './services/firebase/config';

// Constants
const UNITS = ["PCCCH", "PCBCA", "PCBD", "PCVT", "PCDD"];
const DEFAULT_CENTER = { lat: 10.7769, lng: 106.7009 };
const STORAGE_KEYS = {
  USER_NAME: 'evnhcmc_user_name',
  UNIT: 'evnhcmc_unit',
  PROJECT_ID: 'evnhcmc_project_id',
  ASSETS: 'evnhcmc_assets',
  LINES: 'evnhcmc_lines',
  LOGIN_DATE: 'evnhcmc_login_date'
};

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

// Header Component
const Header = React.memo(({ 
  unit, 
  userName, 
  firebaseUser, 
  isDriveConnected, 
  pendingCount, 
  isSyncing, 
  onDriveConnect, 
  onLogout, 
  onSync,
  isOfflineMode
}: any) => (
  <header className="bg-white border-b border-slate-200 p-4 pt-12 shrink-0 z-[1000] flex justify-between items-center shadow-md">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
        <i className="fas fa-bolt"></i>
      </div>
      <div>
        <h1 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">EVNHCMC</h1>
        <p className="text-xs font-black text-slate-800 uppercase truncate max-w-[150px]">
          {unit} - {userName}
        </p>
        <div className="flex gap-1 mt-1">
          {isOfflineMode && (
            <span className="text-[8px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
              <i className="fas fa-wifi-slash mr-1"></i>Offline
            </span>
          )}
          {firebaseUser && (
            <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
              <i className="fas fa-check-circle mr-1"></i>Firebase
            </span>
          )}
          {isDriveConnected && (
            <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
              <i className="fab fa-google-drive mr-1"></i>Drive
            </span>
          )}
        </div>
      </div>
    </div>
    
    <div className="flex gap-2">
      <button
        onClick={onDriveConnect}
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          isDriveConnected 
            ? 'bg-green-100 text-green-600 hover:bg-green-200' 
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }`}
        title={isDriveConnected ? "Đã kết nối Drive" : "Kết nối Google Drive"}
      >
        <i className="fab fa-google-drive text-lg"></i>
      </button>

      <button onClick={onLogout} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
        <i className="fas fa-sign-out-alt"></i>
      </button>
      
      <button 
        onClick={onSync} 
        disabled={isSyncing} 
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
          isSyncing
            ? 'bg-blue-100 text-blue-600' 
            : pendingCount > 0
              ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-lg'
              : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg'
        }`}
        title={pendingCount > 0 ? `Đồng bộ ${pendingCount} điểm` : "Đồng bộ dữ liệu"}
      >
        <i className={`fas ${isSyncing ? 'fa-sync fa-spin' : 'fa-cloud-upload-alt'}`}></i>
      </button>
    </div>
  </header>
));

// Bottom Navigation Component
const BottomNav = React.memo(({ view, pendingCount, onViewChange }: any) => (
  <nav className="bg-white border-t border-slate-200 pb-10 pt-3 px-10 shrink-0 z-[1000] flex justify-around shadow-2xl safe-bottom">
    <button 
      onClick={() => onViewChange('collect')} 
      className={`flex flex-col items-center gap-1 ${view === 'collect' ? 'text-blue-700' : 'text-slate-400'}`}
    >
      <i className="fas fa-map-marked-alt text-xl"></i>
      <span className="text-[9px] font-black uppercase">Bản đồ</span>
    </button>
    
    <button 
      onClick={() => onViewChange('manage')} 
      className={`flex flex-col items-center gap-1 relative ${view === 'manage' ? 'text-blue-700' : 'text-slate-400'}`}
    >
      <i className="fas fa-list-ul text-xl"></i>
      <span className="text-[9px] font-black uppercase">Dữ liệu</span>
      {pendingCount > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[8px] rounded-full flex items-center justify-center">
          {pendingCount}
        </span>
      )}
    </button>
  </nav>
));

const App: React.FC = () => {
  // ============= STATE CHÍNH =============
  const [state, setState] = useState<AppState>(() => {
    try {
      const savedAssets = localStorage.getItem(STORAGE_KEYS.ASSETS);
      const savedLines = localStorage.getItem(STORAGE_KEYS.LINES);
      const savedPinned = localStorage.getItem('evnhcmc_pinned_assets');
      
      return {
        view: 'collect',
        assets: savedAssets ? JSON.parse(savedAssets) : [],
        lines: savedLines ? JSON.parse(savedLines) : [],
        currentLocation: null,
        selectedAsset: null,
        selectedLine: null,
        flyToAsset: null, // Thêm field thiếu
        userName: localStorage.getItem(STORAGE_KEYS.USER_NAME) || "",
        unit: localStorage.getItem(STORAGE_KEYS.UNIT) || "",
        projectId: localStorage.getItem(STORAGE_KEYS.PROJECT_ID) || "DA-2026-LUOI-DIEN",
        filterDate: new Date().toISOString().split('T')[0],
        isSyncing: false,
        isMovingMode: false,
        isRegionMode: false,
        isDriveConnected: false,
        syncStats: { pending: 0, failed: 0, completed: 0 },
        pinnedAssetIds: savedPinned ? JSON.parse(savedPinned) : []
      };
    } catch (e) {
      return {
        view: 'collect',
        assets: [], lines: [], currentLocation: null,
        selectedAsset: null, selectedLine: null,
        flyToAsset: null, // Thêm field thiếu
        userName: "", unit: "", projectId: "DA-2026-LUOI-DIEN",
        filterDate: new Date().toISOString().split('T')[0],
        isSyncing: false, isMovingMode: false, isRegionMode: false,
        isDriveConnected: false,
        syncStats: { pending: 0, failed: 0, completed: 0 },
        pinnedAssetIds: []
      };
    }
  });

  // ============= UI STATE =============
  const [uiState, setUiState] = useState({
    isIdentified: false,
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
    syncError: null as string | null,
    showReportExporter: false,
    showSearch: false,
    activeInspectionAsset: null as GridAsset | null,
    searchPastQuery: '',
    pastSearchResults: [] as GridAsset[],
    pendingLocationChange: null as any,
    autoSyncTimer: null as NodeJS.Timeout | null,
    isOfflineMode: false,
    firebaseAvailable: true
  });

  const [firebaseUser, setFirebaseUser] = useState<any>(null);

  // ============= HOOKS =============
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

  // ============= MEMOIZED VALUES =============
  const draftCount = useMemo(() => 
    state.assets.filter(a => a.status === 'Draft').length,
    [state.assets]
  );

  // ============= KIỂM TRA FIREBASE AVAILABILITY =============
  useEffect(() => {
    const checkFirebase = () => {
      const isAvailable = auth !== null && authService !== null;
      setUiState(prev => ({ ...prev, firebaseAvailable: isAvailable }));
      console.log('🔥 Firebase available:', isAvailable);
    };
    
    checkFirebase();
  }, []);

  // ============= AUTH EFFECT =============
  useEffect(() => {
    // Nếu Firebase không khả dụng, bỏ qua
    if (!uiState.firebaseAvailable) {
      console.log('⚠️ Firebase not available, skipping auth listener');
      return;
    }

    console.log('🔄 Setting up auth listener...');
    
    try {
      const unsubscribe = authService.onAuthStateChanged((user) => {
        if (user) {
          setFirebaseUser(user);
          setUiState(prev => ({ ...prev, isIdentified: true, isOfflineMode: false }));
          
          const unit = authService.extractUnitFromEmail(user.email || '');
          
          setState(prev => ({
            ...prev,
            userName: user.displayName || user.email?.split('@')[0] || '',
            unit,
            isDriveConnected: driveAuthService.isAuthenticated()
          }));
          
          console.log("✅ Firebase user:", user.email);
        } else {
          setFirebaseUser(null);
          setUiState(prev => ({ ...prev, isIdentified: false }));
          console.log("👤 No user");
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('❌ Auth error:', error);
      setUiState(prev => ({ ...prev, firebaseAvailable: false }));
    }
  }, [uiState.firebaseAvailable]);

  // ============= GIS DATA FETCH EFFECT =============
  useEffect(() => {
    const fetchGisAssets = async () => {
      try {
        const response = await fetch('/data/gis_assets.json');
        if (response.ok) {
          const gisAssets: GridAsset[] = await response.json();
          setState(prev => {
            // Merge logic: Giữ lại assets local ('Draft') và merge thêm assets từ GIS
            // Những asset nào từ GIS có cùng ID sẽ bị overwrite bởi bản mới nhất
            const localAssets = prev.assets.filter(a => a.status === 'Draft');
            
            // Tạo Map để merge tránh trùng lặp
            const assetMap = new Map();
            gisAssets.forEach(a => assetMap.set(a.id, a));
            localAssets.forEach(a => assetMap.set(a.id, a));
            
            return {
              ...prev,
              assets: Array.from(assetMap.values())
            };
          });
          console.log(`📡 Loaded ${gisAssets.length} assets from GIS database`);
        }
      } catch (e) {
        console.warn("ℹ️ No GIS assets found in public/data/gis_assets.json");
      }
    };

    fetchGisAssets();
  }, []);

  // ============= GLOBAL SEARCH EXPOSURE =============
  useEffect(() => {
    (window as any).toggleSearch = () => {
      setUiState(prev => ({ ...prev, showSearch: !prev.showSearch }));
    };
    return () => {
      delete (window as any).toggleSearch;
    };
  }, []);

  // ============= SEARCH HANDLERS =============
  const handleSearchSelect = useCallback((asset: GridAsset) => {
    setUiState(prev => ({ 
      ...prev, 
      showSearch: false,
      flyToAsset: asset,
      mapCenter: asset.coords 
    }));
    setState(prev => ({ ...prev, view: 'collect', selectedAsset: asset }));
  }, []);

  // ============= PINNING HANDLERS =============
  const handlePinToggle = useCallback((id: string) => {
    setState(prev => {
      const isPinned = prev.pinnedAssetIds.includes(id);
      const newPinned = isPinned 
        ? prev.pinnedAssetIds.filter(pid => pid !== id)
        : [id, ...prev.pinnedAssetIds];
      
      localStorage.setItem('evnhcmc_pinned_assets', JSON.stringify(newPinned));
      return { ...prev, pinnedAssetIds: newPinned };
    });
  }, []);

  // ============= GPS EFFECT =============
  useEffect(() => {
    if (!uiState.isIdentified) return;
    
    if (navigator.geolocation) {
      console.log("📍 Bắt đầu theo dõi GPS...");
      
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { x, y } = convertWGS84toVN2000(
            pos.coords.latitude, 
            pos.coords.longitude
          );
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
        (error) => {
          console.warn("⚠️ GPS error:", error.message);
        },
        { 
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
      
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [uiState.isIdentified]);

  // ============= AUTO-SAVE EFFECT =============
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(state.assets));
        localStorage.setItem(STORAGE_KEYS.LINES, JSON.stringify(state.lines));
        console.log("💾 Đã auto-save:", {
          assets: state.assets.length,
          lines: state.lines.length,
          draft: draftCount
        });
      } catch (e) {
        console.error("❌ Lỗi lưu dữ liệu:", e);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [state.assets, state.lines, draftCount]);

  // ============= HANDLERS =============
  const handleLogout = useCallback(async () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      try {
        if (uiState.firebaseAvailable) {
          await authService.logout();
        }
        driveAuthService.logout();
      } catch (error) {
        console.error('Logout error:', error);
      }
      
      localStorage.clear();
      setUiState(prev => ({ ...prev, isIdentified: false }));
      window.location.reload();
    }
  }, [uiState.firebaseAvailable]);

  const handleDriveConnect = useCallback(() => {
    if (driveAuthService.isAuthenticated()) {
      alert("✅ Đã kết nối Google Drive");
    } else {
      window.location.href = driveAuthService.getAuthUrl();
    }
  }, []);

  const handleOfflineLogin = useCallback((unit: string, name: string) => {
    setState(prev => ({ ...prev, unit, userName: name }));
    setUiState(prev => ({ 
      ...prev, 
      isIdentified: true, 
      isOfflineMode: true 
    }));
    
    // Lưu vào localStorage
    localStorage.setItem(STORAGE_KEYS.UNIT, unit);
    localStorage.setItem(STORAGE_KEYS.USER_NAME, name);
    localStorage.setItem(STORAGE_KEYS.LOGIN_DATE, new Date().toISOString().split('T')[0]);
    
    console.log('✅ Offline login:', { unit, name });
  }, []);

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
          timestamp: Date.now()
        };
        
        setState(prev => ({ ...prev, lines: [...prev.lines, newLine] }));
        setUiState(prev => ({ ...prev, wiringStartAsset: null, isWiringMode: false }));
        alert(`✅ Đã tạo đường dây ${lineType} dài ${newLine.length}m`);
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

  const createNewAsset = useCallback((formData: Partial<GridAsset>) => {
    if (!uiState.activeFormType) return;
    
    const { x, y } = convertWGS84toVN2000(uiState.mapCenter.lat, uiState.mapCenter.lng);
    const newAsset: GridAsset = {
      id: `ASSET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: uiState.activeFormType,
      name: formData.name || `${uiState.activeFormType} mới`,
      code: formData.code || `CODE-${Date.now()}`,
      address: formData.address || "",
      unit: state.unit,
      coords: { 
        lat: uiState.mapCenter.lat, 
        lng: uiState.mapCenter.lng, 
        x_vn2000: x, 
        y_vn2000: y 
      },
      photoUrls: [...uiState.tempPhotos],
      timestamp: Date.now(),
      collectorName: state.userName,
      collectorId: state.userName,
      status: 'Draft'
    };
    
    setState(prev => ({ ...prev, assets: [newAsset, ...prev.assets] }));
    setUiState(prev => ({ 
      ...prev, 
      activeFormType: null, 
      tempPhotos: [], 
      showTypeSelector: false 
    }));
  }, [uiState.activeFormType, uiState.mapCenter, uiState.tempPhotos, state.unit, state.userName]);

  const handleSaveAsset = useCallback((formData: Partial<GridAsset>) => {
    if (uiState.editingAsset) {
      setState(prev => ({
        ...prev,
        assets: prev.assets.map(a => a.id === uiState.editingAsset?.id ? { 
          ...a, 
          ...formData, 
          status: 'Draft' as const 
        } : a),
        selectedAsset: null
      }));
      setUiState(prev => ({ 
        ...prev, 
        editingAsset: null, 
        tempPhotos: [], 
        pendingLocationChange: null 
      }));
      return;
    }
    
    createNewAsset(formData);
  }, [uiState.editingAsset, createNewAsset]);

  const handleSmartCapture = useCallback((
    imageData: string, 
    poleNumber?: string, 
    asset?: GridAsset
  ) => {
    if (asset) {
      setState(prev => ({
        ...prev,
        assets: prev.assets.map(a => 
          a.id === asset.id 
            ? { ...a, photoUrls: [...a.photoUrls, imageData], status: 'Draft' }
            : a
        )
      }));
    } else if (poleNumber) {
      const { x, y } = convertWGS84toVN2000(uiState.mapCenter.lat, uiState.mapCenter.lng);
      const newAsset: GridAsset = {
        id: `ASSET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: AssetType.POLE_LV,
        name: `Trụ ${poleNumber}`,
        code: poleNumber,
        address: "",
        unit: state.unit,
        coords: { 
          lat: uiState.mapCenter.lat, 
          lng: uiState.mapCenter.lng, 
          x_vn2000: x, 
          y_vn2000: y 
        },
        photoUrls: [imageData],
        timestamp: Date.now(),
        collectorName: state.userName,
        collectorId: state.userName,
        status: 'Draft'
      };
      
      setState(prev => ({ ...prev, assets: [newAsset, ...prev.assets] }));
    }
    
    setUiState(prev => ({ ...prev, smartMode: null }));
  }, [uiState.mapCenter, state.unit, state.userName]);

  // ============= INSPECTION HANDLERS =============
  const handleSaveInspection = useCallback((record: InspectionRecord) => {
    if (!uiState.activeInspectionAsset) return;
    
    setState(prev => ({
      ...prev,
      assets: prev.assets.map(a => a.id === uiState.activeInspectionAsset?.id ? {
        ...a,
        inspections: [record, ...(a.inspections || [])],
        status: 'Draft' as const
      } : a),
      selectedAsset: prev.selectedAsset?.id === uiState.activeInspectionAsset?.id 
        ? { 
            ...prev.selectedAsset, 
            inspections: [record, ...(prev.selectedAsset.inspections || [])],
            status: 'Draft'
          } 
        : prev.selectedAsset
    }));
    
    setUiState(prev => ({ ...prev, activeInspectionAsset: null }));
    alert("✅ Đã lưu phiếu kiểm tra hiện trường!");
  }, [uiState.activeInspectionAsset]);

  const performSync = useCallback(async () => {
    if (draftCount === 0) {
      alert("📭 Không có dữ liệu mới để đồng bộ."); 
      return; 
    }
    
    setState(p => ({ ...p, isSyncing: true }));
    setUiState(p => ({ ...p, syncError: null }));
    
    setTimeout(async () => {
      try {
        let successCount = 0;
        
        for (const asset of state.assets.filter(a => a.status === 'Draft')) {
          await syncQueueService.addToQueue({
            id: asset.id,
            type: 'asset',
            data: asset
          });
          successCount++;
        }
        
        syncQueueService.processQueue();
        
        setState(prev => ({
          ...prev,
          isSyncing: false,
          assets: prev.assets.map(a => 
            a.status === 'Draft' ? { ...a, status: 'Synced' } : a
          )
        }));
        
        alert(`✅ Đã đưa ${successCount} điểm vào hàng đợi đồng bộ`);
        
      } catch (error) {
        setState(p => ({ ...p, isSyncing: false }));
        setUiState(p => ({ ...p, syncError: "Lỗi đồng bộ" }));
        alert("❌ Lỗi đồng bộ, vui lòng thử lại!");
      }
    }, 0);
  }, [state.assets, draftCount]);

  const handleMapClick = useCallback(() => {
    if (uiState.isWiringMode) {
      setUiState(prev => ({ ...prev, isWiringMode: false, wiringStartAsset: null }));
    } else if (state.isMovingMode) {
      setState(prev => ({ ...prev, isMovingMode: false }));
    }
  }, [uiState.isWiringMode, state.isMovingMode]);

  // ============= RENDER =============
  if (!uiState.isIdentified) {
    if (!uiState.firebaseAvailable) {
      return (
        <Suspense fallback={<LoadingSpinner />}>
          <FallbackLogin onLogin={handleOfflineLogin} />
        </Suspense>
      );
    }
    
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <FirebaseLogin onLoginSuccess={(user) => setFirebaseUser(user)} />
      </Suspense>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-[100dvh] w-full bg-slate-50 overflow-hidden font-sans">
        <Header 
          unit={state.unit}
          userName={state.userName}
          firebaseUser={firebaseUser}
          isDriveConnected={state.isDriveConnected}
          pendingCount={pendingCount}
          isSyncing={state.isSyncing || cloudSyncing}
          onDriveConnect={handleDriveConnect}
          onLogout={handleLogout}
          onSync={performSync}
          isOfflineMode={uiState.isOfflineMode}
        />

        {/* Error banner */}
        {uiState.syncError && (
          <div className="fixed bottom-20 left-4 right-4 z-[5000] bg-red-600 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between">
            <span className="text-sm font-medium">{uiState.syncError}</span>
            <button 
              onClick={() => {
                setUiState(p => ({ ...p, syncError: null }));
                performSync();
              }}
              className="ml-4 px-4 py-2 bg-white text-red-600 rounded-xl text-sm font-bold"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Sync Status Bar */}
        {(pendingCount > 0) && (
          <div className="bg-blue-500 text-white py-2 px-4 text-sm flex justify-between items-center">
            <span>
              <i className="fas fa-sync fa-spin mr-2"></i>
              Đang chờ đồng bộ: {pendingCount} mục
            </span>
            <button 
              onClick={() => syncQueueService.processQueue()}
              className="bg-white text-blue-500 px-3 py-1 rounded-full text-xs font-bold"
            >
              Đồng bộ ngay
            </button>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 relative w-full overflow-hidden">
          {state.view === 'collect' ? (
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
                flyToAsset={uiState.flyToAsset}
                onFlyToComplete={() => setUiState(p => ({ ...p, flyToAsset: null }))}
                pinnedAssetIds={state.pinnedAssetIds}
              />
            </Suspense>
          ) : (
            <Suspense fallback={<LoadingSpinner />}>
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
            </Suspense>
          )}
        </main>

        {/* Floating buttons for collect view */}
        {state.view === 'collect' && (
          <>
            <div className="absolute top-24 left-4 z-[500] flex flex-col gap-3">
              <button 
                onClick={() => {
                  setUiState(prev => ({ 
                    ...prev, 
                    isWiringMode: !prev.isWiringMode,
                    wiringStartAsset: null 
                  }));
                  setState(p => ({ ...p, isMovingMode: false, isRegionMode: false }));
                }} 
                className={`w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center border-2 transition-all ${
                  uiState.isWiringMode ? 'bg-orange-600 border-white text-white scale-110' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title="Vẽ đường dây"
              >
                <i className="fas fa-project-diagram text-xl"></i>
              </button>
              
              <button 
                onClick={() => setState(p => ({ ...p, isMovingMode: !p.isMovingMode, isRegionMode: false }))} 
                className={`w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center border-2 transition-all ${
                  state.isMovingMode ? 'bg-blue-600 border-white text-white scale-110' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title="Di chuyển đối tượng"
              >
                <i className="fas fa-arrows-alt text-xl"></i>
              </button>
              
              <button 
                onClick={() => setState(p => ({ ...p, isRegionMode: !p.isRegionMode, isMovingMode: false }))} 
                className={`w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center border-2 transition-all ${
                  state.isRegionMode ? 'bg-emerald-600 border-white text-white scale-110' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title="Đo vùng"
              >
                <i className="fas fa-draw-polygon text-xl"></i>
              </button>
            </div>

            <div className="absolute top-24 right-4 z-[500] flex flex-col gap-3">
              <button
                onClick={() => setUiState(p => ({ ...p, smartMode: 'capture' }))}
                className="w-14 h-14 rounded-2xl shadow-xl bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition-all"
                title="Chụp ảnh thông minh"
              >
                <i className="fas fa-camera-retro text-xl"></i>
              </button>
              
              <button
                onClick={() => setUiState(p => ({ ...p, smartMode: 'scan' }))}
                className="w-14 h-14 rounded-2xl shadow-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-all"
                title="Quét QR Code"
              >
                <i className="fas fa-qrcode text-xl"></i>
              </button>
            </div>

            <div className="absolute bottom-40 right-4 z-[1100]">
              <button 
                onClick={() => setUiState(p => ({ ...p, showTypeSelector: true }))} 
                className="w-16 h-16 bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center border-4 border-white active:scale-95 transition-all hover:bg-blue-800"
                title="Thêm đối tượng mới"
              >
                <i className="fas fa-plus text-2xl"></i>
              </button>
            </div>
          </>
        )}

        <BottomNav 
          view={state.view}
          pendingCount={pendingCount}
          onViewChange={(view: 'collect' | 'manage') => setState(p => ({ ...p, view }))}
        />

        {/* Modals */}
        {uiState.showTypeSelector && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-8">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl">
              <h3 className="text-center text-[10px] font-black text-slate-800 uppercase tracking-widest mb-4">
                CHỌN LOẠI ĐỐI TƯỢNG
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { type: AssetType.SUBSTATION, color: 'bg-blue-50', textColor: 'text-blue-700', icon: 'fa-bolt', label: 'Trạm Biến Áp' },
                  { type: AssetType.POLE_MV, color: 'bg-violet-50', textColor: 'text-violet-700', icon: 'fa-tower-broadcast', label: 'Trụ Trung Thế' },
                  { type: AssetType.POLE_LV, color: 'bg-emerald-50', textColor: 'text-emerald-700', icon: 'fa-tower-observation', label: 'Trụ Hạ Thế' },
                  { type: AssetType.METER, color: 'bg-pink-50', textColor: 'text-pink-700', icon: 'fa-gauge-high', label: 'Điện kế' },
                  { type: AssetType.SWITCHGEAR, color: 'bg-amber-50', textColor: 'text-amber-700', icon: 'fa-toggle-on', label: 'Thiết bị' }
                ].map(item => (
                  <button 
                    key={item.type}
                    onClick={() => { 
                      setUiState(p => ({ ...p, activeFormType: item.type, showTypeSelector: false })); 
                    }} 
                    className={`flex items-center gap-3 p-4 rounded-2xl ${item.color} ${item.textColor} hover:opacity-80 transition-colors`}
                  >
                    <i className={`fas ${item.icon} text-xl`}></i>
                    <span className="text-xs font-bold uppercase">{item.label}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setUiState(p => ({ ...p, showTypeSelector: false }))} className="w-full py-3 mt-3 text-xs font-bold text-slate-400 hover:text-slate-600">
                ĐÓNG
              </button>
            </div>
          </div>
        )}

        {/* Collection Form */}
        {(uiState.activeFormType || uiState.editingAsset) && (
          <Suspense fallback={null}>
            <CollectionForm 
              type={uiState.activeFormType || (uiState.editingAsset?.type as AssetType)}
              coords={uiState.editingAsset ? uiState.editingAsset.coords : { 
                ...uiState.mapCenter, 
                ...convertWGS84toVN2000(uiState.mapCenter.lat, uiState.mapCenter.lng) 
              }}
              photoUrls={uiState.tempPhotos}
              initialData={uiState.editingAsset || undefined}
              onSave={handleSaveAsset}
              onCancel={() => { 
                setUiState(p => ({ 
                  ...p, 
                  activeFormType: null, 
                  editingAsset: null, 
                  tempPhotos: [] 
                })); 
              }}
              onOpenCamera={() => setUiState(p => ({ ...p, isCameraOpen: true }))}
              onPhotoDelete={(newUrls) => setUiState(p => ({ ...p, tempPhotos: newUrls }))}
              isSaving={state.isSyncing || cloudSyncing}
            />
          </Suspense>
        )}

        {/* Camera */}
        {uiState.isCameraOpen && (
          <Suspense fallback={null}>
            <CameraModule 
              onCapture={(img) => setUiState(p => ({ 
                ...p, 
                tempPhotos: [...p.tempPhotos, img].slice(0, 5) 
              }))}
              onClose={() => setUiState(p => ({ ...p, isCameraOpen: false }))}
              existingCount={uiState.tempPhotos.length}
              userName={state.userName}
              coords={state.currentLocation || uiState.mapCenter}
            />
          </Suspense>
        )}

        {/* Smart Camera */}
        {uiState.smartMode && (
          <Suspense fallback={null}>
            <SmartCameraModule
              onCapture={handleSmartCapture}
              onClose={() => setUiState(p => ({ ...p, smartMode: null }))}
              existingCount={uiState.smartImages.length}
              userName={state.userName}
              coords={state.currentLocation || uiState.mapCenter}
              assets={state.assets}
              mode={uiState.smartMode}
            />
          </Suspense>
        )}

        {/* SEARCH POPUP */}
        {uiState.showSearch && (
          <Suspense fallback={null}>
            <SearchPopup 
              assets={state.assets}
              onClose={() => setUiState(prev => ({ ...prev, showSearch: false }))}
              onSelect={handleSearchSelect}
            />
          </Suspense>
        )}

        {/* INSPECTION FORM */}
        {uiState.activeInspectionAsset && (
          <Suspense fallback={null}>
            <InspectionForm 
              asset={uiState.activeInspectionAsset}
              userName={state.userName}
              onClose={() => setUiState(prev => ({ ...prev, activeInspectionAsset: null }))}
              onSave={handleSaveInspection}
            />
          </Suspense>
        )}

        {/* Asset Detail */}
        {state.selectedAsset && (
          <Suspense fallback={null}>
            <AssetDetail 
              asset={state.selectedAsset}
              onClose={() => setState(prev => ({ ...prev, selectedAsset: null }))}
              onNavigate={(a) => {
                setState(prev => ({ ...prev, view: 'collect' }));
                setUiState(u => ({ ...u, flyToAsset: a }));
              }}
              onUseCoords={(a) => { 
                navigator.clipboard.writeText(`${a.coords.x_vn2000}, ${a.coords.y_vn2000}`); 
                alert("Đã sao chép tọa độ VN2000!"); 
              }}
              onDelete={(id) => {
                if (window.confirm("Xóa đối tượng này?")) {
                  setState(p => ({ 
                    ...p, 
                    assets: p.assets.filter(a => a.id !== id),
                    lines: p.lines.filter(l => l.fromId !== id && l.toId !== id),
                    selectedAsset: null 
                  }));
                }
              }}
              onEdit={(a) => { 
                setUiState(p => ({ 
                  ...p, 
                  editingAsset: a, 
                  tempPhotos: a.photoUrls 
                })); 
                setState(p => ({ ...p, selectedAsset: null })); 
              }}
              onPin={handlePinToggle}
              isPinned={state.pinnedAssetIds.includes(state.selectedAsset.id)}
              onStartInspection={(asset) => setUiState(prev => ({ ...prev, activeInspectionAsset: asset }))}
            />
          </Suspense>
        )}

        {/* Line Detail */}
        {state.selectedLine && (
          <Suspense fallback={null}>
            <LineDetail 
              line={state.selectedLine}
              onSave={(u) => {
                setState(p => ({ 
                  ...p, 
                  lines: p.lines.map(l => l.id === u.id ? u : l), 
                  selectedLine: null 
                }));
              }}
              onDelete={(id) => {
                if (window.confirm("Xóa đường dây này?")) {
                  setState(p => ({ 
                    ...p, 
                    lines: p.lines.filter(l => l.id !== id), 
                    selectedLine: null 
                  }));
                }
              }}
              onClose={() => setState(p => ({ ...p, selectedLine: null }))}
            />
          </Suspense>
        )}

        {/* Report Exporter */}
        {uiState.showReportExporter && (
          <Suspense fallback={null}>
            <ReportExporter 
              assets={state.assets}
              lines={state.lines}
              onClose={() => setUiState(u => ({ ...u, showReportExporter: false }))}
            />
          </Suspense>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;