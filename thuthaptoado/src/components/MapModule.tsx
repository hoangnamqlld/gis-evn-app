import React, { useEffect, useRef, useState, memo, useCallback, useMemo } from 'react';
import { GridAsset, Coordinates, AssetType, PowerLine } from '../types';
import { calculateDistance } from '../utils/math';
import { loadTilesForBbox } from '../services/tileDataService';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// 👇 SỬA: Không import ảnh, dùng URL CDN
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapModuleProps {
  assets: GridAsset[];
  lines: PowerLine[];
  currentLocation: Coordinates | null;
  isWiringMode: boolean;
  isMovingMode: boolean;
  isRegionMode: boolean;
  wiringStartId: string | null;
  onAssetSelect: (asset: GridAsset) => void;
  onAssetMove: (id: string, lat: number, lng: number) => void;
  onCenterChange: (coords: Coordinates) => void;
  onViewportChange?: (lat: number, lng: number, zoom: number) => void;
  onMapClickAction: (lat?: number, lng?: number) => void;
  onLineClick: (lineId: string) => void;
  flyToAsset?: GridAsset | null;
  onFlyToComplete?: () => void;
  pinnedAssetIds?: string[]; // Mới: Hỗ trợ hiện thị điểm đã ghim
  completedAssetIds?: string[]; // Đã làm xong → đổi màu, không nhấp nháy
  initialCenter?: Coordinates;       // Vị trí mặc định khi chưa có GPS
  focusCustomerLocation?: Coordinates | null; // Khi tìm KH: chỉ hiển thị 20 điện kế gần nhất
  onResetCompleted?: () => void;   // Reset TẤT CẢ "đã xong" về "chưa xong" (làm lại)
  onArchiveCompleted?: () => void; // Gỡ các điểm đã xong, giữ điểm chưa xong (sang ngày mới)
  onClearAllPins?: () => void;     // Xoá sạch ghim — bắt đầu ngày mới
}

// Mức zoom tối đa của basemap
const MAP_MAX_ZOOM = 19; // OSM chỉ có tile đến 19
const MAX_NEAREST_METERS = 20;
// Điện thoại yếu: giảm max marker xuống
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const MAX_VISIBLE_MARKERS = IS_MOBILE ? 100 : 200;
// Hạn chế hardware acceleration trên máy yếu
const LOW_POWER_MODE = IS_MOBILE && (navigator.hardwareConcurrency || 2) <= 4;

function distSq(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dx = a.lat - b.lat;
  const dy = a.lng - b.lng;
  return dx * dx + dy * dy;
}

const MapModule: React.FC<MapModuleProps> = ({
  assets,
  lines,
  currentLocation,
  isWiringMode,
  isMovingMode,
  isRegionMode,
  wiringStartId,
  onAssetSelect,
  onAssetMove,
  onCenterChange,
  onViewportChange,
  onMapClickAction,
  onLineClick,
  flyToAsset,
  onFlyToComplete,
  pinnedAssetIds = [],
  completedAssetIds = [],
  initialCenter,
  focusCustomerLocation = null,
  onResetCompleted,
  onArchiveCompleted,
  onClearAllPins,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  
  // Layer groups
  const markersLayerRef = useRef<L.MarkerClusterGroup | null>(null);
  const criticalLayerRef = useRef<L.LayerGroup | null>(null); // Trụ trung thế + Trạm: không cluster
  const linesLayerRef = useRef<L.LayerGroup | null>(null);
  const labelsLayerRef = useRef<L.LayerGroup | null>(null);
  const gpsMarkerRef = useRef<L.Marker | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);
  
  // Map để lưu markers
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());
  
  // State cho xác nhận di chuyển
  const [pendingMove, setPendingMove] = useState<{id: string, lat: number, lng: number} | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const [mapInitialized, setMapInitialized] = useState(false);
  const [layerType, setLayerType] = useState<'street' | 'satellite'>('street');
  const [showGps, setShowGps] = useState(true);
  const [showLineLabels, setShowLineLabels] = useState(false); // Mặc định TẮT nhãn chiều dài
  const [showPinMenu, setShowPinMenu] = useState(false);
  const [tempPolyPoints, setTempPolyPoints] = useState<any[]>([]);
  const [currentZoom, setCurrentZoom] = useState(16);

  // Layer visibility — ESRI Field Maps style
  const LAYER_STORAGE_KEY = 'evnhcmc_visible_layers';
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(LAYER_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      substation: true,
      pole_mv: true,
      pole_lv: true,
      meter: true,
      switchgear: true,
      line_mv: true,
      line_lv: true,
      pins: true,
    };
  });
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  const toggleLayerVisibility = useCallback((key: string) => {
    setVisibleLayers(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(LAYER_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Bookmarks — ESRI Field Maps style
  interface Bookmark { id: string; name: string; lat: number; lng: number; zoom: number; createdAt: number }
  const BOOKMARK_KEY = 'evnhcmc_bookmarks';
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    try {
      const raw = localStorage.getItem(BOOKMARK_KEY);
      if (raw) { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }
    } catch {}
    return [];
  });
  const [showBookmarkPanel, setShowBookmarkPanel] = useState(false);

  const saveBookmarks = useCallback((list: Bookmark[]) => {
    setBookmarks(list);
    try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify(list)); } catch {}
  }, []);

  const addBookmark = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const name = window.prompt('Tên điểm ưa thích:');
    if (!name || !name.trim()) return;
    const c = mapInstanceRef.current.getCenter();
    const z = mapInstanceRef.current.getZoom();
    saveBookmarks([{ id: `bm-${Date.now()}`, name: name.trim(), lat: c.lat, lng: c.lng, zoom: z, createdAt: Date.now() }, ...bookmarks]);
  }, [bookmarks, saveBookmarks]);

  const flyToBookmark = useCallback((bm: Bookmark) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([bm.lat, bm.lng], bm.zoom, { animate: true, duration: 1.4 });
    setShowBookmarkPanel(false);
  }, []);

  const deleteBookmark = useCallback((id: string) => {
    saveBookmarks(bookmarks.filter(b => b.id !== id));
  }, [bookmarks, saveBookmarks]);

  // Measure tool — ESRI Field Maps style
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<{ lat: number; lng: number }[]>([]);
  const measureLayerRef = useRef<L.LayerGroup | null>(null);
  const measureModeRef = useRef(false);
  useEffect(() => { measureModeRef.current = measureMode; }, [measureMode]);

  const totalMeasureMeters = useMemo(() => {
    if (measurePoints.length < 2) return 0;
    let sum = 0;
    for (let i = 0; i < measurePoints.length - 1; i++) {
      sum += calculateDistance(measurePoints[i].lat, measurePoints[i].lng, measurePoints[i+1].lat, measurePoints[i+1].lng);
    }
    return sum;
  }, [measurePoints]);

  // Redraw measure overlay
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (!measureLayerRef.current) {
      measureLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    }
    measureLayerRef.current.clearLayers();
    if (measurePoints.length === 0) return;

    const path = measurePoints.map(p => [p.lat, p.lng]) as [number, number][];
    if (path.length >= 2) {
      L.polyline(path, { color: '#f97316', weight: 3, opacity: 0.9, dashArray: '6,6' })
        .addTo(measureLayerRef.current);
    }
    measurePoints.forEach((p, idx) => {
      L.circleMarker([p.lat, p.lng], {
        radius: 5, color: 'white', fillColor: '#f97316', fillOpacity: 1, weight: 2,
      }).addTo(measureLayerRef.current!);
      if (idx > 0) {
        const prev = measurePoints[idx - 1];
        const segM = calculateDistance(prev.lat, prev.lng, p.lat, p.lng);
        const mid = { lat: (prev.lat + p.lat) / 2, lng: (prev.lng + p.lng) / 2 };
        L.marker([mid.lat, mid.lng], {
          icon: L.divIcon({
            className: 'measure-label',
            html: `<span class="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">${segM < 1000 ? `${segM.toFixed(1)}m` : `${(segM/1000).toFixed(2)}km`}</span>`,
            iconSize: [60, 18], iconAnchor: [30, 9],
          }),
          interactive: false,
        }).addTo(measureLayerRef.current!);
      }
    });
  }, [measurePoints]);

  const toggleMeasureMode = useCallback(() => {
    setMeasureMode(prev => {
      if (prev) setMeasurePoints([]);
      return !prev;
    });
  }, []);
  const undoMeasure = useCallback(() => setMeasurePoints(p => p.slice(0, -1)), []);
  const clearMeasure = useCallback(() => setMeasurePoints([]), []);

  // Offline areas — ESRI Field Maps style
  interface OfflineArea {
    id: string;
    name: string;
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
    zoomMin: number; zoomMax: number;
    tileCount: number;
    createdAt: number;
  }
  const OFFLINE_KEY = 'evnhcmc_offline_areas';
  const [offlineAreas, setOfflineAreas] = useState<OfflineArea[]>(() => {
    try { const raw = localStorage.getItem(OFFLINE_KEY); if (raw) { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } } catch {}
    return [];
  });
  const [showOfflinePanel, setShowOfflinePanel] = useState(false);
  const [dlProgress, setDlProgress] = useState<{ done: number; total: number } | null>(null);

  const saveOfflineAreas = useCallback((list: OfflineArea[]) => {
    setOfflineAreas(list);
    try { localStorage.setItem(OFFLINE_KEY, JSON.stringify(list)); } catch {}
  }, []);

  const lng2tile = (lng: number, z: number) => Math.floor((lng + 180) / 360 * Math.pow(2, z));
  const lat2tile = (lat: number, z: number) => Math.floor(
    (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z)
  );

  const estimateTileCount = (bounds: OfflineArea['bounds'], zMin: number, zMax: number) => {
    let total = 0;
    for (let z = zMin; z <= zMax; z++) {
      const xMin = lng2tile(bounds.minLng, z);
      const xMax = lng2tile(bounds.maxLng, z);
      const yMin = lat2tile(bounds.maxLat, z);
      const yMax = lat2tile(bounds.minLat, z);
      total += (xMax - xMin + 1) * (yMax - yMin + 1);
    }
    return total;
  };

  const downloadCurrentArea = useCallback(async () => {
    if (!mapInstanceRef.current || dlProgress) return;
    const name = window.prompt('Tên vùng offline (vd: Củ Chi - Ấp 5):');
    if (!name || !name.trim()) return;

    const b = mapInstanceRef.current.getBounds();
    const bounds = {
      minLat: b.getSouth(), maxLat: b.getNorth(),
      minLng: b.getWest(), maxLng: b.getEast(),
    };
    const curZ = Math.round(mapInstanceRef.current.getZoom());
    const zoomMin = Math.max(14, curZ - 1);
    const zoomMax = Math.min(MAP_MAX_ZOOM, curZ + 2);
    const count = estimateTileCount(bounds, zoomMin, zoomMax);

    if (count > 2000) {
      if (!window.confirm(`Vùng này có ${count} ô basemap (rất lớn). Tiếp tục tải? (có thể mất vài phút)`)) return;
    }

    setDlProgress({ done: 0, total: count });

    // Basemap tiles — fetch song song 6 request
    const urls: string[] = [];
    const baseTpl = layerType === 'satellite'
      ? (x: number, y: number, z: number) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
      : (x: number, y: number, z: number) => `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`;
    for (let z = zoomMin; z <= zoomMax; z++) {
      const xMin = lng2tile(bounds.minLng, z);
      const xMax = lng2tile(bounds.maxLng, z);
      const yMin = lat2tile(bounds.maxLat, z);
      const yMax = lat2tile(bounds.minLat, z);
      for (let x = xMin; x <= xMax; x++)
        for (let y = yMin; y <= yMax; y++)
          urls.push(baseTpl(x, y, z));
    }

    let done = 0;
    const CONCURRENT = 6;
    const queue = urls.slice();
    const workers: Promise<void>[] = [];
    for (let i = 0; i < CONCURRENT; i++) {
      workers.push((async () => {
        while (queue.length) {
          const url = queue.shift();
          if (!url) break;
          try { await fetch(url, { mode: 'cors', cache: 'force-cache' }); } catch {}
          done++;
          if (done % 10 === 0 || done === urls.length) setDlProgress({ done, total: urls.length });
        }
      })());
    }
    await Promise.all(workers);

    // Prefetch data tiles (MV + LV + meters)
    try {
      await loadTilesForBbox(bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng, ['tt', 'ht', 'dk']);
    } catch (e) { console.warn('[OfflineArea] loadTilesForBbox lỗi:', e); }

    const area: OfflineArea = {
      id: `area-${Date.now()}`, name: name.trim(), bounds,
      zoomMin, zoomMax, tileCount: urls.length, createdAt: Date.now(),
    };
    saveOfflineAreas([area, ...offlineAreas]);
    setDlProgress(null);
    alert(`✅ Đã tải xong ${urls.length} ô bản đồ cho "${area.name}"`);
  }, [layerType, dlProgress, offlineAreas, saveOfflineAreas]);

  const flyToOfflineArea = useCallback((a: OfflineArea) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyToBounds(
      [[a.bounds.minLat, a.bounds.minLng], [a.bounds.maxLat, a.bounds.maxLng]],
      { animate: true, duration: 1.2 }
    );
    setShowOfflinePanel(false);
  }, []);

  const deleteOfflineArea = useCallback((id: string) => {
    saveOfflineAreas(offlineAreas.filter(a => a.id !== id));
  }, [offlineAreas, saveOfflineAreas]);

  // Markup — ESRI Field Maps style
  interface Markup {
    id: string;
    type: 'pin' | 'line';
    points: { lat: number; lng: number }[];
    note: string;
    color: string;
    createdAt: number;
  }
  const MARKUP_KEY = 'evnhcmc_markups';
  const [markups, setMarkups] = useState<Markup[]>(() => {
    try { const raw = localStorage.getItem(MARKUP_KEY); if (raw) { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } } catch {}
    return [];
  });
  const [markupMode, setMarkupMode] = useState<'pin' | 'line' | null>(null);
  const [markupDraftPoints, setMarkupDraftPoints] = useState<{ lat: number; lng: number }[]>([]);
  const [showMarkupPanel, setShowMarkupPanel] = useState(false);
  const markupLayerRef = useRef<L.LayerGroup | null>(null);
  const markupModeRef = useRef<'pin' | 'line' | null>(null);
  useEffect(() => { markupModeRef.current = markupMode; }, [markupMode]);

  const saveMarkups = useCallback((list: Markup[]) => {
    setMarkups(list);
    try { localStorage.setItem(MARKUP_KEY, JSON.stringify(list)); } catch {}
  }, []);

  // Render markups + draft
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (!markupLayerRef.current) markupLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    markupLayerRef.current.clearLayers();

    markups.forEach(m => {
      if (m.type === 'pin' && m.points[0]) {
        const p = m.points[0];
        const icon = L.divIcon({
          className: 'markup-pin',
          html: `<div class="flex flex-col items-center"><i class="fas fa-map-pin" style="color:${m.color};font-size:22px;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.3))"></i>${m.note ? `<div class="mt-0.5 px-1.5 py-0.5 bg-white rounded shadow border border-slate-200 text-[9px] font-bold text-slate-700 whitespace-nowrap max-w-[120px] truncate">${m.note}</div>` : ''}</div>`,
          iconSize: [120, 40], iconAnchor: [60, 22],
        });
        L.marker([p.lat, p.lng], { icon }).addTo(markupLayerRef.current!);
      } else if (m.type === 'line' && m.points.length >= 2) {
        const path = m.points.map(p => [p.lat, p.lng]) as [number, number][];
        L.polyline(path, { color: m.color, weight: 3, opacity: 0.85 }).addTo(markupLayerRef.current!);
        if (m.note) {
          const mid = m.points[Math.floor(m.points.length / 2)];
          L.marker([mid.lat, mid.lng], {
            icon: L.divIcon({
              className: 'markup-note',
              html: `<div class="px-1.5 py-0.5 bg-white rounded shadow border border-slate-200 text-[9px] font-bold text-slate-700 whitespace-nowrap max-w-[140px] truncate">${m.note}</div>`,
              iconSize: [140, 18], iconAnchor: [70, 9],
            }),
            interactive: false,
          }).addTo(markupLayerRef.current!);
        }
      }
    });

    // Draft line while drawing
    if (markupMode === 'line' && markupDraftPoints.length > 0) {
      markupDraftPoints.forEach(p => {
        L.circleMarker([p.lat, p.lng], { radius: 4, color: 'white', fillColor: '#ef4444', fillOpacity: 1, weight: 2 })
          .addTo(markupLayerRef.current!);
      });
      if (markupDraftPoints.length >= 2) {
        const path = markupDraftPoints.map(p => [p.lat, p.lng]) as [number, number][];
        L.polyline(path, { color: '#ef4444', weight: 2, opacity: 0.8, dashArray: '4,4' }).addTo(markupLayerRef.current!);
      }
    }
  }, [markups, markupMode, markupDraftPoints]);

  // Inject markup click handler
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const handler = (e: L.LeafletMouseEvent) => {
      if (markupModeRef.current === 'pin') {
        const note = window.prompt('Ghi chú ngắn (để trống nếu không cần):') ?? '';
        saveMarkups([{
          id: `mk-${Date.now()}`, type: 'pin',
          points: [{ lat: e.latlng.lat, lng: e.latlng.lng }],
          note: note.trim(), color: '#ef4444', createdAt: Date.now(),
        }, ...markups]);
        setMarkupMode(null);
      } else if (markupModeRef.current === 'line') {
        setMarkupDraftPoints(prev => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]);
      }
    };
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [markups, saveMarkups]);

  const finishLineMarkup = useCallback(() => {
    if (markupDraftPoints.length < 2) {
      setMarkupMode(null); setMarkupDraftPoints([]);
      return;
    }
    const note = window.prompt('Ghi chú cho đường vẽ:') ?? '';
    saveMarkups([{
      id: `mk-${Date.now()}`, type: 'line',
      points: markupDraftPoints, note: note.trim(),
      color: '#ef4444', createdAt: Date.now(),
    }, ...markups]);
    setMarkupMode(null); setMarkupDraftPoints([]);
  }, [markupDraftPoints, markups, saveMarkups]);

  const cancelMarkup = useCallback(() => {
    setMarkupMode(null); setMarkupDraftPoints([]);
  }, []);

  const deleteMarkup = useCallback((id: string) => {
    saveMarkups(markups.filter(m => m.id !== id));
  }, [markups, saveMarkups]);

  const clearAllMarkups = useCallback(() => {
    if (!window.confirm('Xoá toàn bộ ghi chú trên bản đồ?')) return;
    saveMarkups([]);
  }, [saveMarkups]);

  // Layer references
  const streetLayer = useRef<L.TileLayer | null>(null);
  const satelliteLayer = useRef<L.TileLayer | null>(null);

  // 1. KHỞI TẠO BẢN ĐỒ
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      // Mặc định: Điện lực Củ Chi khi chưa có GPS
      const startCenter: [number, number] = initialCenter
        ? [initialCenter.lat, initialCenter.lng]
        : [11.002, 106.507];

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        center: startCenter,
        zoom: 16,
        maxZoom: MAP_MAX_ZOOM,
        minZoom: 5,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        tapTolerance: 15,
        // Tối ưu mobile
        fadeAnimation: !LOW_POWER_MODE,
        zoomAnimation: true,
        markerZoomAnimation: !LOW_POWER_MODE,
        inertia: true,
        inertiaDeceleration: 3000,
        preferCanvas: true, // Render markers trên canvas thay vì DOM → nhanh hơn rất nhiều
      });

      // Basemap — OpenStreetMap (miễn phí, không tracking, ổn định nhất)
      streetLayer.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        crossOrigin: true,
      }).addTo(map);

      // Layer vệ tinh (ESRI World Imagery — free, không cần key)
      satelliteLayer.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: MAP_MAX_ZOOM,
        attribution: '&copy; Esri',
        crossOrigin: true,
      });

      // MarkerClusterGroup — tối ưu mạnh cho mobile
      markersLayerRef.current = L.markerClusterGroup({
        disableClusteringAtZoom: 17,
        maxClusterRadius: (zoom: number) => (zoom < 14 ? 100 : zoom < 16 ? 70 : 50),
        spiderfyOnMaxZoom: !LOW_POWER_MODE,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        removeOutsideVisibleBounds: true,
        chunkedLoading: true,
        chunkInterval: 50,
        chunkDelay: 20,
        animate: !LOW_POWER_MODE, // Tắt animation spiderfy trên máy yếu
      }).addTo(map);

      // Layer groups
      criticalLayerRef.current = L.layerGroup().addTo(map); // MV pole + TBA luôn nhìn thấy
      linesLayerRef.current = L.layerGroup().addTo(map);
      labelsLayerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;

      // Tạo marker tâm
      createCenterMarker(map.getCenter().lat, map.getCenter().lng, map);

      // Xử lý di chuyển
      map.on('moveend', () => {
        const center = map.getCenter();
        const z = map.getZoom();
        onCenterChange({ lat: center.lat, lng: center.lng });
        setCurrentZoom(z);
        updateCenterMarker(center.lat, center.lng, map);
        onViewportChange?.(center.lat, center.lng, z);
      });

      map.on('zoomend', () => {
        const center = map.getCenter();
        const z = map.getZoom();
        setCurrentZoom(z);
        onViewportChange?.(center.lat, center.lng, z);
      });

      // XỬ LÝ CLICK
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (markupModeRef.current) return; // markup handler xử lý riêng
        if (measureModeRef.current) {
          setMeasurePoints(prev => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]);
          return;
        }
        if (isRegionMode) {
          setTempPolyPoints(prev => [...prev, e.latlng]);
          L.circleMarker(e.latlng, {
            radius: 6,
            color: 'white',
            fillColor: '#10b981',
            fillOpacity: 1,
            weight: 2
          }).addTo(map);
        } else if (!isWiringMode && !isMovingMode) {
          onMapClickAction(e.latlng.lat, e.latlng.lng);
        }
      });

      // Resize observer
      new ResizeObserver(() => map.invalidateSize()).observe(mapContainerRef.current);

      setMapInitialized(true);
      console.log("✅ Bản đồ khởi tạo thành công");
    } catch (error) {
      console.error("❌ Lỗi khởi tạo bản đồ:", error);
    }
  }, []);

  const createCenterMarker = (lat: number, lng: number, map: L.Map) => {
    if (centerMarkerRef.current) centerMarkerRef.current.remove();
    
    const centerIcon = L.divIcon({
      className: 'center-marker',
      html: '<div class="w-8 h-8 flex items-center justify-center"><div class="w-1.5 h-1.5 bg-blue-600 rounded-full ring-8 ring-blue-600/20 shadow-xl shadow-blue-600/40"></div></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    
    centerMarkerRef.current = L.marker([lat, lng], { 
      icon: centerIcon,
      zIndexOffset: 1000,
      interactive: false 
    }).addTo(map);
  };

  const updateCenterMarker = (lat: number, lng: number, map: L.Map) => {
    if (centerMarkerRef.current) {
      centerMarkerRef.current.setLatLng([lat, lng]);
    } else {
      createCenterMarker(lat, lng, map);
    }
  };

  // 2. XỬ LÝ FLY TO ASSET
  useEffect(() => {
    if (!mapInstanceRef.current || !flyToAsset) return;
    
    try {
      const { lat, lng } = flyToAsset.coords || {};
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.warn('⚠️ Toạ độ flyToAsset không hợp lệ:', flyToAsset.id, lat, lng);
        if (onFlyToComplete) onFlyToComplete();
        return;
      }

      console.log("✈️ Bay đến điểm:", flyToAsset.name, lat, lng);
      
      // FlyTo mượt: zoom đích 19 (không tối đa) + duration dài hơn + ease mạnh
      mapInstanceRef.current.flyTo([lat, lng], 19, {
        animate: true,
        duration: 1.8,
        easeLinearity: 0.18,
        noMoveStart: false,
      });
      
      const marker = markersMapRef.current.get(flyToAsset.id);
      if (marker) {
        setTimeout(() => {
          try {
            marker.openPopup();
            const markerElement = marker.getElement();
            if (markerElement) {
              markerElement.classList.add('ring-4', 'ring-yellow-400', 'animate-pulse');
              setTimeout(() => {
                markerElement.classList.remove('ring-4', 'ring-yellow-400', 'animate-pulse');
              }, 3000);
            }
          } catch {}
        }, 1500);
      }
      
      if (typeof onFlyToComplete === 'function') {
        setTimeout(onFlyToComplete, 2000);
      }
    } catch (err) {
      console.error('[MapModule] FlyTo error:', err);
      if (onFlyToComplete) onFlyToComplete();
    }
  }, [flyToAsset]);

  // 3. VẼ LẠI MARKERS
  useEffect(() => {
    if (!markersLayerRef.current || !mapInstanceRef.current) return;

    markersLayerRef.current.clearLayers();
    criticalLayerRef.current?.clearLayers();
    markersMapRef.current.clear();

    const isCriticalType = (t: AssetType) =>
      t === AssetType.POLE_MV || t === AssetType.SUBSTATION || t === AssetType.SWITCHGEAR;

    const colors: Record<string, string> = {
      [AssetType.SUBSTATION]: '#1d4ed8',
      [AssetType.POLE_MV]: '#7c3aed',
      [AssetType.POLE_LV]: '#059669',
      [AssetType.METER]: '#06b6d4',
      [AssetType.SWITCHGEAR]: '#d97706',
      [AssetType.CUSTOMER]: '#06b6d4',
      [AssetType.TEMP_PIN]: '#f43f5e',
    };

    const icons: Record<string, string> = {
      [AssetType.SUBSTATION]: 'fa-bolt',
      [AssetType.POLE_MV]: 'fa-tower-broadcast',
      [AssetType.POLE_LV]: 'fa-tower-observation',
      [AssetType.METER]: 'fa-gauge-high',
      [AssetType.SWITCHGEAR]: 'fa-toggle-on',
      [AssetType.CUSTOMER]: 'fa-house-user',
      [AssetType.TEMP_PIN]: 'fa-map-pin',
    };

    // Quy tắc hiển thị theo zoom:
    //   zoom < 16  → chỉ Trung thế + Trạm (Hạ thế & Điện kế ẨN để tăng tốc)
    //   zoom 16-19 → thêm Trụ hạ thế + Điện kế (Khách hàng)
    //   zoom 20   → toàn bộ, label chi tiết
    const isLVType = (t: AssetType) => t === AssetType.POLE_LV;
    const isMeterType = (t: AssetType) => t === AssetType.METER || t === AssetType.CUSTOMER;

    // Khi đang focus 1 khách hàng (tìm kiếm KH) — chỉ hiện 20 điện kế gần nhất
    let allowedMeterIds: Set<string> | null = null;
    if (focusCustomerLocation && Number.isFinite(focusCustomerLocation.lat)) {
      const meters = assets
        .filter(a => a && a.coords && isMeterType(a.type) && Number.isFinite(a.coords.lat))
        .map(a => ({ id: a.id, d: distSq(a.coords, focusCustomerLocation) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, MAX_NEAREST_METERS);
      allowedMeterIds = new Set(meters.map(m => m.id));
    }

    // Trần 200 marker tổng cộng: ưu tiên pinned/selected/draft, rồi 200 gần tâm nhất
    let renderSet: Set<string> | null = null;
    if (assets.length > MAX_VISIBLE_MARKERS) {
      const center = focusCustomerLocation
        || (mapInstanceRef.current ? { lat: mapInstanceRef.current.getCenter().lat, lng: mapInstanceRef.current.getCenter().lng } : null);
      if (center) {
        const priority = assets
          .filter(a => pinnedAssetIds.includes(a.id) || (flyToAsset && flyToAsset.id === a.id) || a.status === 'Draft');
        const nearest = assets
          .filter(a => a && a.coords && Number.isFinite(a.coords.lat) && !priority.find(p => p.id === a.id))
          .map(a => ({ id: a.id, d: distSq(a.coords, center) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, Math.max(0, MAX_VISIBLE_MARKERS - priority.length));
        renderSet = new Set([...priority.map(p => p.id), ...nearest.map(n => n.id)]);
      }
    }

    // CHẾ ĐỘ LỘ TRÌNH: khi có ghim VÀ chưa zoom đến nơi làm việc → chỉ vẽ điểm ghim
    //   Ghim nhiều điểm rải rác → ẩn toàn bộ lưới cho map nhẹ nhàng.
    //   Zoom ≥ 18 → bật lại lưới quanh khu vực đang xem.
    const routeMode = pinnedAssetIds.length > 0 && currentZoom < 18;

    const layerKeyOf = (t: AssetType): string => {
      if (t === AssetType.SUBSTATION) return 'substation';
      if (t === AssetType.POLE_MV) return 'pole_mv';
      if (t === AssetType.POLE_LV) return 'pole_lv';
      if (t === AssetType.METER || t === AssetType.CUSTOMER) return 'meter';
      if (t === AssetType.SWITCHGEAR) return 'switchgear';
      if (t === AssetType.TEMP_PIN) return 'pins';
      return '';
    };

    assets.forEach(asset => {
      if (renderSet && !renderSet.has(asset.id)) return;

      // GUARD: Leaflet crash với LatLng (NaN, NaN) → skip asset không có tọa độ hợp lệ
      const la = Number(asset.coords?.lat);
      const ln = Number(asset.coords?.lng);
      if (!Number.isFinite(la) || !Number.isFinite(ln)) return;

      const isPinned    = pinnedAssetIds.includes(asset.id);
      const isCompleted = completedAssetIds.includes(asset.id);
      const isSelected = !!flyToAsset && flyToAsset.id === asset.id;
      const keepAnyway = isPinned || isSelected || asset.status === 'Draft';

      // Layer visibility (ESRI Field Maps) — ẩn ngay cả khi pinned, người dùng đã chủ động tắt
      const lkey = layerKeyOf(asset.type);
      if (lkey && visibleLayers[lkey] === false) return;

      // Route mode: chỉ hiện điểm ghim
      if (routeMode && !keepAnyway) return;

      // Zoom-gated visibility
      // Trụ trung thế + TBA: LUÔN hiển thị (không gate)
      if (!keepAnyway && !isCriticalType(asset.type)) {
        if (currentZoom < 13) return; // quá xa — chỉ cluster
        if (currentZoom < 16 && (isLVType(asset.type) || isMeterType(asset.type))) return;
      }

      // Khi focus KH: giới hạn điện kế
      if (allowedMeterIds && isMeterType(asset.type) && !keepAnyway && !allowedMeterIds.has(asset.id)) {
        return;
      }

      const isWiringStart = isWiringMode && wiringStartId === asset.id;
      
      // Tạo Icon Biểu tượng Mới (v11.0)
      let iconHtml = '';
      const iconColor = colors[asset.type] || '#64748b';
      
      if (asset.type === AssetType.POLE_MV) {
        // Hình Tròn Lớn cho Trụ Trung Thế (v13.0)
        iconHtml = `<div class="w-3.5 h-3.5 rounded-full border-2 border-white shadow-md flex items-center justify-center transition-all group-hover:scale-125 ring-2 ring-violet-500/20" style="background-color: ${iconColor}"></div>`;
      } else if (asset.type === AssetType.POLE_LV) {
        // Hình Tròn cho Trụ Hạ Thế
        iconHtml = `<div class="w-2.5 h-2.5 rounded-full border border-white shadow-sm flex items-center justify-center transition-all group-hover:scale-125" style="background-color: ${iconColor}"></div>`;
      } else if (asset.type === AssetType.SWITCHGEAR || asset.type === AssetType.SUBSTATION) {
        // Hình Vuông cho Thiết bị/Trạm
        iconHtml = `<div class="w-3 h-3 rounded-sm border border-white shadow-sm flex items-center justify-center transition-all group-hover:scale-125" style="background-color: ${iconColor}"></div>`;
      } else if (asset.type === AssetType.METER || asset.type === AssetType.CUSTOMER) {
        // Hình Ngôi nhà cho Điện kế (Cỡ 8/10)
        iconHtml = `<div class="flex items-center justify-center transform group-hover:scale-125 transition-all" style="color: ${iconColor}; font-size: 10px;">
                      <i class="fas fa-house-chimney shadow-sm"></i>
                    </div>`;
      } else if (asset.type === AssetType.TEMP_PIN) {
        // Hình Ghim cho Điểm ghim tạm
        iconHtml = `<div class="flex items-center justify-center transform group-hover:scale-125 transition-all text-white" style="font-size: 12px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
                      <i class="fas fa-map-pin"></i>
                    </div>`;
      } else {
        // Mặc định hình thoi
        iconHtml = `<div class="w-2 h-2 rotate-45 border border-white shadow-sm" style="background-color: ${iconColor}"></div>`;
      }

      // 3 trạng thái ghim:
      //   Ghim + CHƯA xong → halo vàng nhấp nháy (ping + pulse), badge thumbtack
      //   Ghim + ĐÃ xong   → viền xanh lá đậm, badge tick, KHÔNG nhấp nháy
      //   Không ghim       → icon thường
      const pinHalo = isPinned && !isCompleted
        ? '<div class="absolute -inset-3 bg-amber-400/30 rounded-full animate-ping"></div><div class="absolute -inset-1.5 bg-amber-500/70 rounded-full animate-pulse"></div>'
        : isPinned && isCompleted
        ? '<div class="absolute -inset-2 border-[3px] border-emerald-500 rounded-full shadow-lg shadow-emerald-500/40 bg-emerald-500/10"></div>'
        : '';
      const pinBadge = isPinned && !isCompleted
        ? '<div class="absolute -top-2.5 -right-2.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-[9px] text-white shadow-md border-2 border-white z-10"><i class="fas fa-thumbtack rotate-45"></i></div>'
        : isPinned && isCompleted
        ? '<div class="absolute -top-2.5 -right-2.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[9px] text-white shadow-md border-2 border-white z-10"><i class="fas fa-check"></i></div>'
        : '';

      const wrapperHtml = `
        <div class="relative group flex items-center justify-center">
          ${pinHalo}
          ${isMovingMode ? '<div class="absolute -inset-2 border-2 border-blue-500 border-dashed rounded-full animate-spin-slow"></div>' : ''}
          ${isWiringStart ? '<div class="absolute -inset-1.5 bg-orange-500/40 rounded-full animate-ping"></div>' : ''}
          ${iconHtml}
          ${pinBadge}
        </div>
      `;

      const marker = L.marker([asset.coords.lat, asset.coords.lng], {
        draggable: isMovingMode,
        icon: L.divIcon({
          className: 'asset-symbol-icon',
          html: wrapperHtml,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onAssetSelect(asset);
      });

      marker.on('dragend', (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        setPendingMove({ id: asset.id, lat, lng });
        setShowConfirmDialog(true);
        // Reset marker position temporarily until confirmed
        e.target.setLatLng([asset.coords.lat, asset.coords.lng]);
      });

      if (isCriticalType(asset.type)) {
        criticalLayerRef.current?.addLayer(marker);
      } else {
        markersLayerRef.current?.addLayer(marker);
      }
      markersMapRef.current.set(asset.id, marker);

      // Helper: làm nhãn pill trên đầu icon — dùng chung cho PE, SOTRU, tên TBA
      const addTopLabel = (text: string, bgClass: string) => {
        const m = L.marker([asset.coords.lat, asset.coords.lng], {
          icon: L.divIcon({
            className: 'asset-top-label',
            html: `<div style="transform: translate(-50%, -160%); display: inline-block;" class="px-1.5 py-0.5 ${bgClass} rounded border border-white shadow whitespace-nowrap max-w-[140px] truncate"><span class="text-[9px] font-black text-white tracking-tight">${text}</span></div>`,
            iconSize: [0, 0], iconAnchor: [0, 0],
          }),
          interactive: false,
          zIndexOffset: 900,
        });
        labelsLayerRef.current?.addLayer(m);
      };

      // Nhãn SỐ TRỤ — trụ trung thế từ zoom 17, trụ hạ thế từ zoom 18 (mật độ cao)
      const isPoleMV = asset.type === AssetType.POLE_MV;
      const isPoleLV = asset.type === AssetType.POLE_LV;
      const sotru = asset.rawProperties?.SOTRU || asset.rawProperties?.MAHIEU || asset.rawProperties?.VITRI;
      if ((isPoleMV && currentZoom >= 17) || (isPoleLV && currentZoom >= 18)) {
        if (sotru) {
          addTopLabel(`Trụ ${sotru}`, isPoleMV ? 'bg-violet-600' : 'bg-emerald-600');
        }
      }

      // Nhãn TÊN TRẠM BIẾN ÁP — hiện từ zoom 16 (TBA to, cần nhìn sớm)
      if (asset.type === AssetType.SUBSTATION && currentZoom >= 16) {
        const tbaName = asset.rawProperties?.ASSETDESC || asset.name;
        const p = asset.rawProperties?.P || asset.rawProperties?.CONG_SUAT;
        if (tbaName) {
          addTopLabel(p ? `${tbaName} · ${p}kVA` : String(tbaName), 'bg-blue-600');
        }
      }

      // Nhãn TÊN THIẾT BỊ ĐÓNG CẮT — hiện từ zoom 17
      if (asset.type === AssetType.SWITCHGEAR && currentZoom >= 17) {
        const ten = asset.rawProperties?.TEN || asset.name;
        if (ten) addTopLabel(String(ten), 'bg-amber-600');
      }

      // Nhãn Mã PE — điện kế (zoom >= 18)
      const isMeter = asset.type === AssetType.METER || asset.type === AssetType.CUSTOMER;
      const peCode = asset.customerCode || asset.code;
      if (isMeter && currentZoom >= 18 && peCode) {
        addTopLabel(String(peCode), 'bg-cyan-600');
      }
    });
  }, [assets, isWiringMode, isMovingMode, wiringStartId, pinnedAssetIds, completedAssetIds, currentZoom, focusCustomerLocation, flyToAsset, visibleLayers]);

  // 4. VẼ LẠI ĐƯỜNG DÂY
  useEffect(() => {
    if (!linesLayerRef.current || !mapInstanceRef.current) return;

    linesLayerRef.current.clearLayers();
    labelsLayerRef.current?.clearLayers();

    // Route mode: có ghim & chưa zoom đến nơi → ẨN lưới điện cho map nhẹ
    const routeMode = pinnedAssetIds.length > 0 && currentZoom < 18;
    if (routeMode) return;

    // 4. VẼ LẠI ĐƯỜNG DÂY (v16.0 Optimized Canvas)
    const lineRenderer = L.canvas({ padding: 0.5 });

    lines.forEach(line => {
      // Layer visibility filter
      if (line.type === 'MV' && !visibleLayers.line_mv) return;
      if (line.type === 'LV' && !visibleLayers.line_lv) return;

      if (line.coords && line.coords.length >= 2) {
        // GUARD: bỏ coords NaN để tránh Leaflet crash
        const validCoords = line.coords.filter(c =>
          c && Number.isFinite(c.lat) && Number.isFinite(c.lng)
        );
        if (validCoords.length < 2) return;
        const path: [number, number][] = validCoords.map(c => [c.lat, c.lng]);
        const color = line.type === 'MV' ? '#7c3aed' : '#059669';
        const poly = L.polyline(path, { 
          color,
          weight: line.type === 'MV' ? 4 : 3,
          opacity: 0.8,
          dashArray: line.isUnderground ? '5, 10' : undefined,
          renderer: lineRenderer,
          smoothFactor: 1.5,
          interactive: true
        }).addTo(linesLayerRef.current!);

        poly.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onLineClick(line.id);
        });

        // Nhãn chiều dài — chỉ hiện khi user bật toggle + zoom >= 19
        if (showLineLabels && currentZoom >= 19) {
          const midIndex = Math.floor(path.length / 2);
          const midPoint = path[midIndex];

          L.marker(midPoint, {
            icon: L.divIcon({
              className: 'line-label',
              html: `<span class="bg-white/95 px-1.5 py-0.5 rounded shadow-sm text-[9px] font-black border border-slate-200" style="color: ${color}">${line.length}m</span>`,
              iconSize: [45, 16],
              iconAnchor: [22, 8]
            }),
            interactive: false
          }).addTo(labelsLayerRef.current!);
        }
      }
    });
  }, [lines, assets, currentZoom, showLineLabels, pinnedAssetIds.length, visibleLayers]);

  // 5. CẬP NHẬT GPS
  useEffect(() => {
    if (!mapInstanceRef.current || !currentLocation || !showGps) return;
    if (!Number.isFinite(currentLocation.lat) || !Number.isFinite(currentLocation.lng)) return;

    if (gpsMarkerRef.current) {
      gpsMarkerRef.current.setLatLng([currentLocation.lat, currentLocation.lng]);
    } else {
      gpsMarkerRef.current = L.marker([currentLocation.lat, currentLocation.lng], {
        icon: L.divIcon({
          className: 'gps-marker',
          html: '<div class="relative flex items-center justify-center w-8 h-8"><div class="absolute w-8 h-8 bg-blue-500/20 rounded-full animate-ping"></div><div class="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg"></div></div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      }).addTo(mapInstanceRef.current);
    }
  }, [currentLocation, showGps]);

  const toggleLayer = () => {
    if (!mapInstanceRef.current) return;
    if (layerType === 'street') {
      streetLayer.current?.remove();
      satelliteLayer.current?.addTo(mapInstanceRef.current);
      setLayerType('satellite');
    } else {
      satelliteLayer.current?.remove();
      streetLayer.current?.addTo(mapInstanceRef.current);
      setLayerType('street');
    }
  };

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full bg-slate-100" />
      
      {/* HUD tiến độ ghim — click để mở menu reset/xoá sạch */}
      {pinnedAssetIds.length > 0 && (
        <div className="absolute top-4 left-4 z-[500] animate-fade-in">
          <button
            onClick={() => setShowPinMenu(v => !v)}
            className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 px-3 py-2 flex items-center gap-2.5 active:scale-95 transition-transform"
          >
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-100"></div>
              <span className="relative text-[11px] font-black text-amber-600">
                {completedAssetIds.filter(id => pinnedAssetIds.includes(id)).length}/{pinnedAssetIds.length}
              </span>
            </div>
            <div className="leading-tight text-left">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Lộ trình {currentZoom < 18 ? '· Lưới ẩn' : '· Lưới hiện'}
              </p>
              <p className="text-[10px] font-black text-slate-700">
                Còn <span className="text-amber-600">{pinnedAssetIds.length - completedAssetIds.filter(id => pinnedAssetIds.includes(id)).length}</span> điểm
              </p>
            </div>
            <i className={`fas fa-chevron-down text-slate-400 text-[10px] transition-transform ${showPinMenu ? 'rotate-180' : ''}`}></i>
          </button>

          {showPinMenu && (
            <div className="mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden w-64 animate-slide-down">
              {/* Nút 1 (MỚI): sang ngày mới — gỡ điểm đã xong, chỉ giữ điểm chưa xong */}
              <button
                onClick={() => { setShowPinMenu(false); onArchiveCompleted?.(); }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-emerald-50 active:bg-emerald-100 text-left border-b border-slate-50"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <i className="fas fa-calendar-day text-xs"></i>
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-800">Sang ngày mới — giữ điểm chưa xong</p>
                  <p className="text-[9px] text-slate-500 font-bold leading-tight mt-0.5">Gỡ các điểm đã xong khỏi lộ trình</p>
                </div>
              </button>
              {/* Nút 2: làm lại — reset toàn bộ về chưa xong (giữ đủ ghim) */}
              <button
                onClick={() => { setShowPinMenu(false); onResetCompleted?.(); }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-amber-50 active:bg-amber-100 text-left border-b border-slate-50"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <i className="fas fa-rotate-left text-xs"></i>
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-800">Làm lại — đánh dấu toàn bộ "chưa xong"</p>
                  <p className="text-[9px] text-slate-500 font-bold leading-tight mt-0.5">Giữ ghim, bỏ trạng thái đã làm</p>
                </div>
              </button>
              {/* Nút 3: xoá sạch */}
              <button
                onClick={() => { setShowPinMenu(false); onClearAllPins?.(); }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-50 active:bg-red-100 text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <i className="fas fa-trash-can text-xs"></i>
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-800">Xoá sạch toàn bộ</p>
                  <p className="text-[9px] text-slate-500 font-bold leading-tight mt-0.5">Bỏ tất cả ghim + lịch sử</p>
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Basemap + GPS + Layers + Line labels — ESRI Field Maps style */}
      <div className="fab-stack" style={{ bottom: '72px', right: '10px' }}>
        <button
          onClick={toggleLayer}
          className="fab"
          title={layerType === 'street' ? 'Chuyển sang vệ tinh' : 'Chuyển sang bản đồ'}
        >
          <i className={`fas ${layerType === 'street' ? 'fa-satellite' : 'fa-map'}`}></i>
        </button>
        <button
          onClick={() => setShowLayerPanel(v => !v)}
          className={`fab ${showLayerPanel ? 'fab-active' : ''}`}
          title="Lớp dữ liệu"
        >
          <i className="fas fa-layer-group"></i>
        </button>
        <button
          onClick={() => setShowBookmarkPanel(v => !v)}
          className={`fab ${showBookmarkPanel ? 'fab-active' : ''}`}
          title="Điểm ưa thích"
        >
          <i className="fas fa-bookmark"></i>
        </button>
        <button
          onClick={() => setShowGps(!showGps)}
          className={`fab ${showGps ? 'fab-primary' : ''}`}
          title="Hiện/ẩn GPS"
        >
          <i className="fas fa-location-arrow"></i>
        </button>
        <button
          onClick={() => setShowLineLabels(v => !v)}
          className={`fab ${showLineLabels ? 'fab-active' : ''}`}
          title={showLineLabels ? 'Ẩn chiều dài dây' : 'Hiện chiều dài dây'}
        >
          <i className="fas fa-ruler"></i>
        </button>
        <button
          onClick={toggleMeasureMode}
          className={`fab ${measureMode ? 'fab-active' : ''}`}
          title="Đo khoảng cách"
        >
          <i className="fas fa-ruler-combined"></i>
        </button>
        <button
          onClick={() => setShowOfflinePanel(v => !v)}
          className={`fab ${showOfflinePanel ? 'fab-active' : ''}`}
          title="Vùng offline"
        >
          <i className="fas fa-cloud-arrow-down"></i>
        </button>
        <button
          onClick={() => setShowMarkupPanel(v => !v)}
          className={`fab ${showMarkupPanel || markupMode ? 'fab-active' : ''}`}
          title="Ghi chú / Vẽ"
        >
          <i className="fas fa-pencil"></i>
        </button>
      </div>

      {/* Measure HUD — chạm map để thêm điểm */}
      {measureMode && (
        <div className="absolute left-1/2 -translate-x-1/2 z-[1000]" style={{ bottom: '72px' }}>
          <div className="bg-white rounded-lg shadow-xl border border-orange-200 px-3 py-2 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-orange-500 flex items-center justify-center text-white">
              <i className="fas fa-ruler-combined text-xs"></i>
            </div>
            <div className="leading-tight min-w-[90px]">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Tổng khoảng cách</p>
              <p className="text-sm font-black text-slate-800">
                {totalMeasureMeters < 1000
                  ? `${totalMeasureMeters.toFixed(1)} m`
                  : `${(totalMeasureMeters / 1000).toFixed(2)} km`}
              </p>
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <button
              onClick={undoMeasure}
              disabled={measurePoints.length === 0}
              className="w-8 h-8 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-600"
              title="Bỏ điểm cuối"
            >
              <i className="fas fa-rotate-left text-xs"></i>
            </button>
            <button
              onClick={clearMeasure}
              disabled={measurePoints.length === 0}
              className="w-8 h-8 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-600"
              title="Xoá tất cả"
            >
              <i className="fas fa-eraser text-xs"></i>
            </button>
            <button
              onClick={() => { setMeasureMode(false); setMeasurePoints([]); }}
              className="px-3 h-8 rounded bg-orange-500 text-white text-[11px] font-bold hover:bg-orange-600"
            >
              Xong
            </button>
          </div>
          {measurePoints.length === 0 && (
            <p className="text-center text-[10px] text-white bg-black/50 rounded mt-1 py-1 px-2">
              Chạm bản đồ để đặt điểm đầu tiên
            </p>
          )}
        </div>
      )}

      {/* ESRI-style Layers Panel */}
      {showLayerPanel && (
        <>
          <div className="absolute inset-0 z-[600]" onClick={() => setShowLayerPanel(false)}></div>
          <div className="absolute right-[58px] z-[700] bg-white rounded-lg shadow-xl border border-slate-200 w-60 overflow-hidden animate-slide-down" style={{ bottom: '72px' }}>
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Lớp dữ liệu</span>
              <button onClick={() => setShowLayerPanel(false)} className="text-slate-400 hover:text-slate-700 text-xs">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="py-1">
              {[
                { key: 'substation', label: 'Trạm biến áp', icon: 'fa-bolt', color: '#1d4ed8' },
                { key: 'pole_mv',    label: 'Trụ trung thế', icon: 'fa-tower-broadcast', color: '#7c3aed' },
                { key: 'line_mv',    label: 'Đường dây TT',  icon: 'fa-minus', color: '#7c3aed' },
                { key: 'pole_lv',    label: 'Trụ hạ thế',    icon: 'fa-tower-observation', color: '#059669' },
                { key: 'line_lv',    label: 'Đường dây HT',  icon: 'fa-minus', color: '#059669' },
                { key: 'meter',      label: 'Điện kế',       icon: 'fa-house-chimney', color: '#06b6d4' },
                { key: 'switchgear', label: 'Thiết bị đóng cắt', icon: 'fa-toggle-on', color: '#d97706' },
                { key: 'pins',       label: 'Điểm ghim tạm', icon: 'fa-map-pin', color: '#f43f5e' },
              ].map(item => {
                const on = !!visibleLayers[item.key];
                return (
                  <button
                    key={item.key}
                    onClick={() => toggleLayerVisibility(item.key)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 active:bg-slate-100 text-left"
                  >
                    <i
                      className={`fas ${item.icon} w-4 text-center text-sm`}
                      style={{ color: on ? item.color : '#cbd5e1' }}
                    ></i>
                    <span className={`flex-1 text-xs ${on ? 'text-slate-800 font-semibold' : 'text-slate-400'}`}>
                      {item.label}
                    </span>
                    <i className={`fas ${on ? 'fa-eye text-[#0079c1]' : 'fa-eye-slash text-slate-300'} text-xs`}></i>
                  </button>
                );
              })}
            </div>
            <div className="px-3 py-2 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => {
                  const all = Object.keys(visibleLayers).reduce((a, k) => ({ ...a, [k]: true }), {});
                  setVisibleLayers(all);
                  try { localStorage.setItem(LAYER_STORAGE_KEY, JSON.stringify(all)); } catch {}
                }}
                className="flex-1 text-[10px] font-bold text-[#0079c1] hover:bg-blue-50 py-1.5 rounded"
              >
                Hiện tất cả
              </button>
              <button
                onClick={() => {
                  const none = Object.keys(visibleLayers).reduce((a, k) => ({ ...a, [k]: false }), {});
                  setVisibleLayers(none);
                  try { localStorage.setItem(LAYER_STORAGE_KEY, JSON.stringify(none)); } catch {}
                }}
                className="flex-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 py-1.5 rounded"
              >
                Ẩn tất cả
              </button>
            </div>
          </div>
        </>
      )}

      {/* ESRI-style Bookmarks Panel */}
      {showBookmarkPanel && (
        <>
          <div className="absolute inset-0 z-[600]" onClick={() => setShowBookmarkPanel(false)}></div>
          <div className="absolute right-[58px] z-[700] bg-white rounded-lg shadow-xl border border-slate-200 w-64 overflow-hidden animate-slide-down" style={{ bottom: '72px' }}>
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Điểm ưa thích</span>
              <button onClick={() => setShowBookmarkPanel(false)} className="text-slate-400 hover:text-slate-700 text-xs">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto custom-scrollbar">
              {bookmarks.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <i className="fas fa-bookmark text-slate-300 text-2xl mb-2"></i>
                  <p className="text-[11px] text-slate-400">Chưa có điểm ưa thích nào</p>
                  <p className="text-[10px] text-slate-400 mt-1">Bấm "+ Thêm" để lưu view hiện tại</p>
                </div>
              ) : (
                <div className="py-1">
                  {bookmarks.map(bm => (
                    <div key={bm.id} className="flex items-center hover:bg-slate-50 group">
                      <button
                        onClick={() => flyToBookmark(bm)}
                        className="flex-1 flex items-center gap-2 px-3 py-2 text-left min-w-0"
                      >
                        <i className="fas fa-bookmark text-[#0079c1] text-xs"></i>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-slate-800 truncate">{bm.name}</p>
                          <p className="text-[9px] text-slate-400">
                            {bm.lat.toFixed(5)}, {bm.lng.toFixed(5)} · z{bm.zoom}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`Xoá "${bm.name}"?`)) deleteBookmark(bm.id); }}
                        className="px-2 py-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                        title="Xoá"
                      >
                        <i className="fas fa-trash text-[10px]"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={addBookmark}
              className="w-full px-3 py-2 border-t border-slate-100 text-[11px] font-bold text-[#0079c1] hover:bg-blue-50 flex items-center justify-center gap-2"
            >
              <i className="fas fa-plus text-[10px]"></i>
              Thêm điểm hiện tại
            </button>
          </div>
        </>
      )}

      {/* ESRI-style Offline Areas Panel */}
      {showOfflinePanel && (
        <>
          <div className="absolute inset-0 z-[600]" onClick={() => setShowOfflinePanel(false)}></div>
          <div className="absolute right-[58px] z-[700] bg-white rounded-lg shadow-xl border border-slate-200 w-72 overflow-hidden animate-slide-down" style={{ bottom: '72px' }}>
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Vùng offline</span>
              <button onClick={() => setShowOfflinePanel(false)} className="text-slate-400 hover:text-slate-700 text-xs">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              {offlineAreas.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <i className="fas fa-cloud-arrow-down text-slate-300 text-2xl mb-2"></i>
                  <p className="text-[11px] text-slate-400">Chưa có vùng offline nào</p>
                  <p className="text-[10px] text-slate-400 mt-1">Di chuyển đến khu vực cần tải, bấm nút bên dưới</p>
                </div>
              ) : (
                <div className="py-1">
                  {offlineAreas.map(a => (
                    <div key={a.id} className="flex items-center hover:bg-slate-50 group">
                      <button
                        onClick={() => flyToOfflineArea(a)}
                        className="flex-1 flex items-center gap-2 px-3 py-2 text-left min-w-0"
                      >
                        <i className="fas fa-square-check text-emerald-600 text-xs"></i>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-slate-800 truncate">{a.name}</p>
                          <p className="text-[9px] text-slate-400">
                            z{a.zoomMin}-{a.zoomMax} · {a.tileCount.toLocaleString()} ô · {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`Xoá "${a.name}" khỏi danh sách?`)) deleteOfflineArea(a.id); }}
                        className="px-2 py-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                        title="Xoá"
                      >
                        <i className="fas fa-trash text-[10px]"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {dlProgress ? (
              <div className="px-3 py-2 border-t border-slate-100 bg-blue-50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-blue-700">Đang tải… {dlProgress.done}/{dlProgress.total}</span>
                  <span className="text-[10px] font-bold text-blue-700">{Math.round((dlProgress.done / dlProgress.total) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-blue-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0079c1] transition-all" style={{ width: `${(dlProgress.done / dlProgress.total) * 100}%` }}></div>
                </div>
              </div>
            ) : (
              <button
                onClick={downloadCurrentArea}
                className="w-full px-3 py-2 border-t border-slate-100 text-[11px] font-bold text-[#0079c1] hover:bg-blue-50 flex items-center justify-center gap-2"
              >
                <i className="fas fa-cloud-arrow-down text-[10px]"></i>
                Tải vùng hiện tại
              </button>
            )}
          </div>
        </>
      )}

      {/* ESRI-style Markup Panel */}
      {showMarkupPanel && !markupMode && (
        <>
          <div className="absolute inset-0 z-[600]" onClick={() => setShowMarkupPanel(false)}></div>
          <div className="absolute right-[58px] z-[700] bg-white rounded-lg shadow-xl border border-slate-200 w-64 overflow-hidden animate-slide-down" style={{ bottom: '72px' }}>
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Ghi chú & vẽ</span>
              <button onClick={() => setShowMarkupPanel(false)} className="text-slate-400 hover:text-slate-700 text-xs">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 p-2 border-b border-slate-100">
              <button
                onClick={() => { setMarkupMode('pin'); setShowMarkupPanel(false); }}
                className="flex flex-col items-center gap-1 py-3 rounded hover:bg-red-50 text-slate-700"
              >
                <i className="fas fa-map-pin text-red-500 text-lg"></i>
                <span className="text-[10px] font-bold">Điểm + note</span>
              </button>
              <button
                onClick={() => { setMarkupMode('line'); setMarkupDraftPoints([]); setShowMarkupPanel(false); }}
                className="flex flex-col items-center gap-1 py-3 rounded hover:bg-red-50 text-slate-700"
              >
                <i className="fas fa-wave-square text-red-500 text-lg"></i>
                <span className="text-[10px] font-bold">Vẽ đường</span>
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto custom-scrollbar">
              {markups.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-[10px] text-slate-400">Chưa có ghi chú nào</p>
                </div>
              ) : (
                <div className="py-1">
                  {markups.map(m => (
                    <div key={m.id} className="flex items-center hover:bg-slate-50 group">
                      <div className="flex-1 flex items-center gap-2 px-3 py-1.5 min-w-0">
                        <i className={`fas ${m.type === 'pin' ? 'fa-map-pin' : 'fa-wave-square'} text-xs`} style={{ color: m.color }}></i>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-slate-800 truncate">
                            {m.note || (m.type === 'pin' ? 'Điểm ghi chú' : `Đường vẽ (${m.points.length} điểm)`)}
                          </p>
                          <p className="text-[9px] text-slate-400">{new Date(m.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteMarkup(m.id)}
                        className="px-2 py-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                        title="Xoá"
                      >
                        <i className="fas fa-trash text-[10px]"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {markups.length > 0 && (
              <button
                onClick={clearAllMarkups}
                className="w-full px-3 py-2 border-t border-slate-100 text-[11px] font-bold text-red-500 hover:bg-red-50"
              >
                Xoá tất cả ghi chú
              </button>
            )}
          </div>
        </>
      )}

      {/* Markup active HUD */}
      {markupMode && (
        <div className="absolute left-1/2 -translate-x-1/2 z-[1000]" style={{ bottom: '72px' }}>
          <div className="bg-white rounded-lg shadow-xl border border-red-200 px-3 py-2 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-red-500 flex items-center justify-center text-white">
              <i className={`fas ${markupMode === 'pin' ? 'fa-map-pin' : 'fa-wave-square'} text-xs`}></i>
            </div>
            <div className="leading-tight min-w-[120px]">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                {markupMode === 'pin' ? 'Đặt điểm ghi chú' : `Vẽ đường · ${markupDraftPoints.length} điểm`}
              </p>
              <p className="text-[11px] font-bold text-slate-800">
                {markupMode === 'pin' ? 'Chạm bản đồ 1 lần' : 'Chạm nhiều lần rồi bấm Xong'}
              </p>
            </div>
            {markupMode === 'line' && (
              <button
                onClick={finishLineMarkup}
                disabled={markupDraftPoints.length < 2}
                className="px-3 h-8 rounded bg-red-500 text-white text-[11px] font-bold hover:bg-red-600 disabled:opacity-30"
              >
                Xong
              </button>
            )}
            <button
              onClick={cancelMarkup}
              className="px-3 h-8 rounded border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-slate-50"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {/* Confirm Move Dialog */}
      {showConfirmDialog && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl p-6 shadow-2xl z-[2000] w-72 animate-scale-up border border-slate-100">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
            <i className="fas fa-location-dot text-2xl"></i>
          </div>
          <h3 className="text-sm font-black text-slate-800 text-center uppercase tracking-wider mb-2">Xác nhận di chuyển?</h3>
          <p className="text-[11px] text-slate-500 text-center leading-relaxed mb-6">Bạn có chắc chắn muốn thay đổi vị trí của đối tượng này không?</p>
          <div className="flex gap-2">
            <button 
              onClick={() => { setShowConfirmDialog(false); setPendingMove(null); }}
              className="flex-1 py-3 border-2 border-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-50"
            >
              Hủy
            </button>
            <button 
              onClick={() => {
                if (pendingMove) onAssetMove(pendingMove.id, pendingMove.lat, pendingMove.lng);
                setShowConfirmDialog(false);
                setPendingMove(null);
              }}
              className="flex-1 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-blue-600/20"
            >
              Lưu mới
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(MapModule);
