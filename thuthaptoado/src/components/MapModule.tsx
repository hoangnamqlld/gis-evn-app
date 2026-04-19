import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { GridAsset, Coordinates, AssetType, PowerLine } from '../types';
import { calculateDistance } from '../utils/math';
import { convertWGS84toVN2000 } from '../utils/vn2000';
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
  onMapClickAction: (lat?: number, lng?: number) => void;
  onLineClick: (lineId: string) => void;
  flyToAsset?: GridAsset | null;
  onFlyToComplete?: () => void;
  pinnedAssetIds?: string[]; // Mới: Hỗ trợ hiện thị điểm đã ghim
  completedAssetIds?: string[]; // Đã làm xong → đổi màu, không nhấp nháy
  initialCenter?: Coordinates;       // Vị trí mặc định khi chưa có GPS
  focusCustomerLocation?: Coordinates | null; // Khi tìm KH: chỉ hiển thị 20 điện kế gần nhất
  onResetCompleted?: () => void;  // Reset "đã xong" — giữ ghim
  onClearAllPins?: () => void;    // Xoá sạch ghim — bắt đầu ngày mới
}

// Mức zoom tối đa của basemap (Google/CartoDB vỡ tiles trên 20)
const MAP_MAX_ZOOM = 20;
const MAX_NEAREST_METERS = 20;
const MAX_VISIBLE_MARKERS = 200; // Trần hiển thị để điện thoại yếu không lag

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
  onMapClickAction,
  onLineClick,
  flyToAsset,
  onFlyToComplete,
  pinnedAssetIds = [],
  completedAssetIds = [],
  initialCenter,
  focusCustomerLocation = null,
  onResetCompleted,
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
        tapTolerance: 10,
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

      // MarkerClusterGroup — gom nhóm mạnh ở zoom thấp để UI không kẹt
      markersLayerRef.current = L.markerClusterGroup({
        disableClusteringAtZoom: 17,
        maxClusterRadius: (zoom: number) => (zoom < 14 ? 80 : zoom < 16 ? 60 : 45),
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        removeOutsideVisibleBounds: true,
        chunkedLoading: true,
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
        onCenterChange({ lat: center.lat, lng: center.lng });
        setCurrentZoom(map.getZoom());
        updateCenterMarker(center.lat, center.lng, map);
      });

      map.on('zoomend', () => {
        setCurrentZoom(map.getZoom());
      });

      // XỬ LÝ CLICK
      map.on('click', (e: L.LeafletMouseEvent) => {
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
    
    const { lat, lng } = flyToAsset.coords;
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
        marker.openPopup();
        const markerElement = marker.getElement();
        if (markerElement) {
          markerElement.classList.add('ring-4', 'ring-yellow-400', 'animate-pulse');
          setTimeout(() => {
            markerElement.classList.remove('ring-4', 'ring-yellow-400', 'animate-pulse');
          }, 3000);
        }
      }, 1500);
    }
    
    if (onFlyToComplete) {
      setTimeout(onFlyToComplete, 2000);
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
    if (focusCustomerLocation) {
      const meters = assets
        .filter(a => isMeterType(a.type))
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
          .filter(a => !priority.find(p => p.id === a.id))
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

    assets.forEach(asset => {
      if (renderSet && !renderSet.has(asset.id)) return;

      const isPinned    = pinnedAssetIds.includes(asset.id);
      const isCompleted = completedAssetIds.includes(asset.id);
      const isSelected = !!flyToAsset && flyToAsset.id === asset.id;
      const keepAnyway = isPinned || isSelected || asset.status === 'Draft';

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

      // Thêm Nhãn Số Trụ (vocalize pole numbers) - v9.0
      const isPole = asset.type === AssetType.POLE_LV || asset.type === AssetType.POLE_MV;
      if (isPole && currentZoom >= 19) {
        const labelMarker = L.marker([asset.coords.lat, asset.coords.lng], {
          icon: L.divIcon({
            className: 'pole-label-v2',
            html: `<div class="mt-4 px-1.5 py-0.5 bg-white/95 backdrop-blur-sm rounded border border-blue-100 shadow-sm whitespace-nowrap"><span class="text-[9px] font-black text-blue-800 uppercase tracking-tighter">${asset.code}</span></div>`,
            iconSize: [0, 0], // Anchor it to the marker center
            iconAnchor: [0, -10]
          }),
          interactive: false,
          zIndexOffset: -500 // Phía dưới marker chính
        });
        labelsLayerRef.current?.addLayer(labelMarker);
      }

      // Thêm Nhãn Mã PE phía TRÊN icon nhà cho Điện kế (zoom >= 18)
      const isMeter = asset.type === AssetType.METER || asset.type === AssetType.CUSTOMER;
      const peCode = asset.customerCode || asset.code;
      if (isMeter && currentZoom >= 18 && peCode) {
        const peLabelMarker = L.marker([asset.coords.lat, asset.coords.lng], {
          icon: L.divIcon({
            className: 'pe-label-top',
            html: `<div style="transform: translate(-50%, -160%); display: inline-block;" class="px-1.5 py-0.5 bg-cyan-600 rounded border border-white shadow whitespace-nowrap"><span class="text-[9px] font-black text-white tracking-tight">${peCode}</span></div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
          interactive: false,
          zIndexOffset: 900,
        });
        labelsLayerRef.current?.addLayer(peLabelMarker);
      }
    });
  }, [assets, isWiringMode, isMovingMode, wiringStartId, pinnedAssetIds, completedAssetIds, currentZoom, focusCustomerLocation, flyToAsset]);

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
      if (line.coords && line.coords.length >= 2) {
        const path: [number, number][] = line.coords.map(c => [c.lat, c.lng]);
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
  }, [lines, assets, currentZoom, showLineLabels, pinnedAssetIds.length]);

  // 5. CẬP NHẬT GPS
  useEffect(() => {
    if (!mapInstanceRef.current || !currentLocation || !showGps) return;

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
            <div className="mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden w-56 animate-slide-down">
              <button
                onClick={() => { setShowPinMenu(false); onResetCompleted?.(); }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-amber-50 active:bg-amber-100 text-left border-b border-slate-50"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <i className="fas fa-rotate-left text-xs"></i>
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-800">Đánh dấu lại "chưa xong"</p>
                  <p className="text-[9px] text-slate-500 font-bold leading-tight mt-0.5">Giữ ghim, bỏ trạng thái đã làm</p>
                </div>
              </button>
              <button
                onClick={() => { setShowPinMenu(false); onClearAllPins?.(); }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-50 active:bg-red-100 text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <i className="fas fa-trash-can text-xs"></i>
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-800">Xoá sạch để ngày mới</p>
                  <p className="text-[9px] text-slate-500 font-bold leading-tight mt-0.5">Bỏ toàn bộ ghim + lịch sử</p>
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-[500] flex flex-col gap-2">
        <button 
          onClick={toggleLayer}
          className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-slate-200"
        >
          <i className={`fas ${layerType === 'street' ? 'fa-satellite' : 'fa-map'} text-slate-700`}></i>
        </button>
        <button
          onClick={() => setShowGps(!showGps)}
          className={`w-12 h-12 rounded-2xl shadow-xl flex items-center justify-center border ${
            showGps ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-700'
          }`}
          title="Hiện/ẩn GPS"
        >
          <i className="fas fa-location-arrow"></i>
        </button>
        <button
          onClick={() => setShowLineLabels(v => !v)}
          className={`w-12 h-12 rounded-2xl shadow-xl flex items-center justify-center border ${
            showLineLabels ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-700'
          }`}
          title={showLineLabels ? 'Ẩn chiều dài dây' : 'Hiện chiều dài dây'}
        >
          <i className="fas fa-ruler"></i>
        </button>
      </div>

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
