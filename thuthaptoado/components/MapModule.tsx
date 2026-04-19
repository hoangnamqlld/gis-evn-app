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
  onMapClickAction: () => void;
  onLineClick: (lineId: string) => void;
  flyToAsset?: GridAsset | null;
  onFlyToComplete?: () => void;
  pinnedAssetIds?: string[];
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
  pinnedAssetIds = []
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  
  // Layer groups
  const markersLayerRef = useRef<L.MarkerClusterGroup | null>(null);
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
  const [tempPolyPoints, setTempPolyPoints] = useState<any[]>([]);
  const [currentZoom, setCurrentZoom] = useState(18);

  // Layer references
  const streetLayer = useRef<L.TileLayer | null>(null);
  const satelliteLayer = useRef<L.TileLayer | null>(null);

  // 1. KHỞI TẠO BẢN ĐỒ
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        center: [10.7769, 106.7009],
        zoom: 18,
        maxZoom: 22,
        minZoom: 5,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        tapTolerance: 10,
      });

      // Layer đường phố
      streetLayer.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 22,
        detectRetina: true
      }).addTo(map);

      // Layer vệ tinh
      satelliteLayer.current = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 22,
        detectRetina: true
      });

      // MarkerClusterGroup
      markersLayerRef.current = L.markerClusterGroup({
        disableClusteringAtZoom: 17,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        removeOutsideVisibleBounds: true,
        chunkedLoading: true
      }).addTo(map);

      // Layer groups
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
          onMapClickAction();
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

  // 2. XỬ LÝ FLY TO ASSET
  useEffect(() => {
    if (!mapInstanceRef.current || !flyToAsset) return;
    
    const { lat, lng } = flyToAsset.coords;
    console.log("✈️ Bay đến điểm:", flyToAsset.name, lat, lng);
    
    mapInstanceRef.current.flyTo([lat, lng], 20, {
      duration: 1.5,
      easeLinearity: 0.25
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
    markersMapRef.current.clear();

    assets.forEach(asset => {
      const colors: Record<AssetType, string> = {
        [AssetType.SUBSTATION]: '#1d4ed8',
        [AssetType.POLE_MV]: '#7c3aed',
        [AssetType.POLE_LV]: '#059669',
        [AssetType.METER]: '#db2777',
        [AssetType.SWITCHGEAR]: '#d97706'
      };

      const icons: Record<AssetType, string> = {
        [AssetType.SUBSTATION]: 'fa-bolt',
        [AssetType.POLE_MV]: 'fa-tower-broadcast',
        [AssetType.POLE_LV]: 'fa-tower-observation',
        [AssetType.METER]: 'fa-gauge-high',
        [AssetType.SWITCHGEAR]: 'fa-toggle-on'
      };

      const isWiringStart = isWiringMode && wiringStartId === asset.id;
      const isPinned = pinnedAssetIds.includes(asset.id);
      
      const markerHtml = `
        <div class="relative">
          <div class="flex items-center justify-center w-7 h-7 rounded-full border-2 border-white shadow-md ${
            isMovingMode ? 'ring-2 ring-blue-500 animate-bounce' : ''
          } ${
            isWiringStart ? 'ring-2 ring-orange-500 animate-pulse' : ''
          }" style="background-color: ${colors[asset.type]}">
            <i class="fas ${icons[asset.type]} text-[10px] text-white"></i>
          </div>
          ${isPinned ? `
            <div class="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 border border-white rounded-full flex items-center justify-center shadow-sm">
              <i class="fas fa-bookmark text-[7px] text-slate-800"></i>
            </div>
          ` : ''}
        </div>
      `;

      const marker = L.marker([asset.coords.lat, asset.coords.lng], {
        draggable: isMovingMode,
        icon: L.divIcon({
          className: 'asset-marker',
          html: markerHtml,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      });

      // Thêm popup
      marker.bindPopup(`
        <div class="p-2">
          <strong class="text-sm">${asset.name}</strong><br/>
          <span class="text-xs">${asset.code}</span><br/>
          <span class="text-xs text-slate-500">${asset.type}</span>
        </div>
      `);

      marker.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        onAssetSelect(asset);
      });

      // 👇 SỬA: Xử lý dragend với xác nhận
      marker.on('dragend', (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        console.log(`📍 Di chuyển asset ${asset.id} đến:`, lat, lng);
        
        // Hiển thị dialog xác nhận
        setPendingMove({
          id: asset.id,
          lat,
          lng
        });
        setShowConfirmDialog(true);
      });

      markersMapRef.current.set(asset.id, marker);
      markersLayerRef.current!.addLayer(marker);
    });

    console.log(`✅ Đã vẽ ${assets.length} markers`);
  }, [assets, isMovingMode, isWiringMode, wiringStartId, onAssetSelect, pinnedAssetIds]);

  // 4. VẼ ĐƯỜNG DÂY
  useEffect(() => {
    if (!linesLayerRef.current || !labelsLayerRef.current) return;

    linesLayerRef.current.clearLayers();
    labelsLayerRef.current.clearLayers();

    console.log("🔄 Vẽ lại đường dây:", lines.length);

    lines.forEach(line => {
      const from = assets.find(a => a.id === line.fromId);
      const to = assets.find(a => a.id === line.toId);
      
      if (from && to) {
        const coords: [number, number][] = [
          [from.coords.lat, from.coords.lng],
          [to.coords.lat, to.coords.lng]
        ];

        const length = calculateDistance(
          from.coords.lat, from.coords.lng,
          to.coords.lat, to.coords.lng
        );

        const polyline = L.polyline(coords, {
          color: line.type === 'MV' ? '#4f46e5' : '#10b981',
          weight: 4,
          opacity: 0.9,
          dashArray: line.isUnderground ? '10, 10' : undefined
        }).addTo(linesLayerRef.current!);

        polyline.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          onLineClick(line.id);
        });

        const mid: [number, number] = [
          (from.coords.lat + to.coords.lat) / 2,
          (from.coords.lng + to.coords.lng) / 2
        ];

        const lengthText = length >= 1000
          ? `${(length / 1000).toFixed(2)} km`
          : `${Math.round(length)} m`;

        L.marker(mid, {
          icon: L.divIcon({
            className: 'line-label',
            html: `<div class="bg-white border border-slate-300 px-2 py-1 rounded-full text-[9px] font-bold shadow-sm">${lengthText}</div>`,
            iconSize: [50, 20],
            iconAnchor: [25, 10]
          })
        }).addTo(labelsLayerRef.current!);
      }
    });
  }, [lines, assets, onLineClick]);

  // 5. XỬ LÝ GPS
  useEffect(() => {
    if (!mapInstanceRef.current || !currentLocation || !showGps) return;

    const { lat, lng } = currentLocation;
    
    if (!gpsMarkerRef.current) {
      const gpsIcon = L.divIcon({
        className: 'gps-marker',
        html: `
          <div class="relative">
            <div class="w-5 h-5 bg-blue-600 border-2 border-white rounded-full shadow-lg"></div>
            <div class="absolute -bottom-4 left-1/2 transform -translate-x-1/2 whitespace-nowrap bg-blue-600 text-white px-1.5 py-0.5 rounded-full text-[8px] font-bold">
              Bạn
            </div>
          </div>
        `,
        iconSize: [20, 28],
        iconAnchor: [10, 28]
      });

      gpsMarkerRef.current = L.marker([lat, lng], {
        icon: gpsIcon,
        zIndexOffset: 1000,
        interactive: false
      }).addTo(mapInstanceRef.current);
    } else {
      gpsMarkerRef.current.setLatLng([lat, lng]);
    }
  }, [currentLocation, showGps]);

  // 6. TẠO MARKER TÂM
  const createCenterMarker = (lat: number, lng: number, map: L.Map) => {
    if (centerMarkerRef.current) map.removeLayer(centerMarkerRef.current);

    const centerIcon = L.divIcon({
      className: 'center-marker',
      html: `
        <div class="relative">
          <div class="w-12 h-12 rounded-full border-2 border-red-500 bg-red-500/10"></div>
          <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-red-600 rounded-full shadow-lg"></div>
          <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-px bg-red-400/30"></div>
          <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-8 w-px bg-red-400/30"></div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24]
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
    }
  };

  // 7. CHUYỂN LAYER
  const toggleLayer = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    
    if (layerType === 'street') {
      map.removeLayer(streetLayer.current!);
      satelliteLayer.current?.addTo(map);
      setLayerType('satellite');
    } else {
      map.removeLayer(satelliteLayer.current!);
      streetLayer.current?.addTo(map);
      setLayerType('street');
    }
  }, [layerType]);

  // 8. VỀ VỊ TRÍ HIỆN TẠI
  const goToCurrentLocation = useCallback(() => {
    if (!mapInstanceRef.current || !currentLocation) return;
    mapInstanceRef.current.setView([currentLocation.lat, currentLocation.lng], 18);
  }, [currentLocation]);

  // 9. XÁC NHẬN DI CHUYỂN
  const confirmMove = useCallback(() => {
    if (pendingMove) {
      onAssetMove(pendingMove.id, pendingMove.lat, pendingMove.lng);
      setShowConfirmDialog(false);
      setPendingMove(null);
    }
  }, [pendingMove, onAssetMove]);

  const cancelMove = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingMove(null);
    // Reset marker về vị trí cũ (không cần làm gì thêm vì marker chưa được cập nhật)
  }, []);

  return (
    <div className="map-wrapper relative w-full h-full bg-slate-100 overflow-hidden">
      {/* Container bản đồ */}
      <div ref={mapContainerRef} className="w-full h-full absolute inset-0" />

      {/* VÒNG TRÒN TÂM */}
      {!isWiringMode && !isMovingMode && !isRegionMode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-2 border-red-400/50"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-px bg-red-400/30"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-12 w-px bg-red-400/30"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-red-600 rounded-full"></div>
          </div>
        </div>
      )}

      {/* HIỂN THỊ CHẾ ĐỘ */}
      {isWiringMode && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-orange-600 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold">
          {wiringStartId ? '🔴 Chọn điểm cuối' : '🟢 Chọn điểm đầu'}
        </div>
      )}

      {isMovingMode && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold">
          🔵 Kéo thả để di chuyển
        </div>
      )}

      {isRegionMode && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold">
          🟢 Click để vẽ vùng
        </div>
      )}

      {/* NÚT ĐIỀU KHIỂN */}
      <div className="absolute bottom-6 right-3 z-50 flex flex-col gap-2">
        <button
          onClick={toggleLayer}
          className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-slate-700 active:bg-white"
          title={layerType === 'street' ? 'Vệ tinh' : 'Đường phố'}
        >
          <i className={`fas ${layerType === 'street' ? 'fa-satellite' : 'fa-map'} text-sm`}></i>
        </button>
        
        {currentLocation && (
          <button
            onClick={goToCurrentLocation}
            className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-blue-600 active:bg-white"
            title="Về vị trí của bạn"
          >
            <i className="fas fa-location-dot text-sm"></i>
          </button>
        )}
      </div>

      {/* GPS STATUS */}
      {currentLocation && (
        <div className="absolute top-3 left-3 z-50 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-full shadow-md text-[10px] flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
          <span className="font-medium">Đã định vị</span>
        </div>
      )}

      {/* HIỂN THỊ ZOOM */}
      <div className="absolute top-3 right-3 z-50 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-full shadow-md text-[10px]">
        Zoom: {currentZoom}
      </div>

      {/* HIỂN THỊ THÔNG BÁO KHI BAY */}
      {flyToAsset && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold animate-pulse">
          ✈️ Đang bay đến {flyToAsset.name}...
        </div>
      )}

      {/* 👇 DIALOG XÁC NHẬN DI CHUYỂN */}
      {showConfirmDialog && pendingMove && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                <i className="fas fa-question-circle text-xl"></i>
              </div>
              <h3 className="text-lg font-black text-slate-800">Xác nhận di chuyển</h3>
            </div>
            
            <p className="text-slate-600 mb-6">
              Bạn có chắc chắn muốn di chuyển điểm này đến vị trí mới?
            </p>
            
            <div className="bg-slate-50 p-3 rounded-xl mb-6">
              <p className="text-xs text-slate-500 font-medium mb-1">Tọa độ mới:</p>
              <p className="font-mono text-sm">
                WGS84: {pendingMove.lat.toFixed(6)}, {pendingMove.lng.toFixed(6)}
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={confirmMove}
                className="flex-1 py-3 bg-blue-700 text-white rounded-xl font-bold text-sm hover:bg-blue-800 transition-colors"
              >
                <i className="fas fa-check mr-2"></i>
                Xác nhận
              </button>
              <button
                onClick={cancelMove}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
              >
                <i className="fas fa-times mr-2"></i>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(MapModule);