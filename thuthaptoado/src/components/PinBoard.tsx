import React, { useMemo, useState } from 'react';
import { GridAsset, AssetTypeIcons, AssetTypeColors, Coordinates } from '../types';
import { calculateDistance } from '../utils/math';
import { optimizeRoute } from '../utils/tsp';
import { shareRoute } from '../utils/shareRoute';

interface PinBoardProps {
  assets: GridAsset[];
  pinnedIds: string[];
  completedIds?: string[];
  currentLocation: Coordinates | null;
  onSelect: (asset: GridAsset) => void;
  onUnpin: (id: string) => void;
  onClearAll?: () => void;
}

const PinBoard: React.FC<PinBoardProps> = ({
  assets, pinnedIds, completedIds = [], currentLocation, onSelect, onUnpin, onClearAll,
}) => {
  const [optimizedOrder, setOptimizedOrder] = useState<string[] | null>(null);
  const [savedKm, setSavedKm] = useState<number>(0);
  const [shareToast, setShareToast] = useState(false);

  // 1. Lọc pin theo thứ tự — nếu có tối ưu thì dùng thứ tự đó, không thì sort theo GPS
  const sortedPins = useMemo(() => {
    const pinnedAssets = assets.filter(a => pinnedIds.includes(a.id));

    const withDistance = pinnedAssets.map(asset => ({
      ...asset,
      distance: currentLocation
        ? calculateDistance(currentLocation.lat, currentLocation.lng, asset.coords.lat, asset.coords.lng)
        : 0,
    }));

    if (optimizedOrder) {
      const idToAsset = new Map(withDistance.map(a => [a.id, a]));
      return optimizedOrder
        .map(id => idToAsset.get(id))
        .filter((a): a is typeof withDistance[number] => !!a);
    }
    if (!currentLocation) return withDistance;
    return withDistance.sort((a, b) => a.distance - b.distance);
  }, [assets, pinnedIds, currentLocation, optimizedOrder]);

  const handleOptimize = () => {
    const pinnedAssets = assets.filter(a => pinnedIds.includes(a.id));
    if (pinnedAssets.length < 2) return;
    const res = optimizeRoute(pinnedAssets, currentLocation);
    setOptimizedOrder(res.ordered.map(a => a.id));
    setSavedKm(res.savedKm);
  };

  const handleResetOrder = () => {
    setOptimizedOrder(null);
    setSavedKm(0);
  };

  const directionsUrl = (asset: GridAsset) =>
    `https://www.google.com/maps/dir/?api=1&destination=${asset.coords.lat},${asset.coords.lng}&travelmode=driving`;

  const handleNavigate = (asset: GridAsset) => {
    const url = directionsUrl(asset);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w || w.closed || typeof w.closed === 'undefined') {
      window.location.href = url; // iOS Safari fallback
    }
  };

  /** Dẫn đường cả tuyến qua Google Maps.
   *  origin = GPS hiện tại (hoặc điểm đầu tiên nếu không có GPS)
   *  destination = điểm cuối trong danh sách ghim chưa xong
   *  waypoints  = các điểm giữa (tối đa 9 — giới hạn Google Maps free URL)
   */
  const handleRouteAll = () => {
    const remaining = sortedPins.filter(a => !completedIds.includes(a.id));
    const targets = remaining.length > 0 ? remaining : sortedPins;
    const valid = targets.filter(a =>
      a.coords && Number.isFinite(a.coords.lat) && Number.isFinite(a.coords.lng)
    );
    if (valid.length === 0) {
      alert('Không có điểm ghim hợp lệ để dẫn đường.');
      return;
    }

    const MAX_WAYPOINTS = 9;
    let truncated = false;
    let stops = valid.map(a => `${a.coords.lat},${a.coords.lng}`);

    const hasGps = !!currentLocation && Number.isFinite(currentLocation.lat);
    const totalAllowed = hasGps ? MAX_WAYPOINTS + 1 /*destination*/ : MAX_WAYPOINTS + 2 /*origin + destination*/;
    if (stops.length > totalAllowed) {
      stops = stops.slice(0, totalAllowed);
      truncated = true;
    }

    const origin = hasGps
      ? `${currentLocation!.lat},${currentLocation!.lng}`
      : stops.shift()!; // dùng điểm đầu làm origin
    const destination = stops.pop()!;
    const waypoints = stops.join('|');

    const params = new URLSearchParams({
      api: '1',
      origin,
      destination,
      travelmode: 'driving',
    });
    if (waypoints) params.set('waypoints', waypoints);

    const url = `https://www.google.com/maps/dir/?${params.toString()}`;

    if (truncated) {
      if (!window.confirm(
        `Google Maps chỉ hỗ trợ ${MAX_WAYPOINTS} điểm dừng + điểm đến.\n` +
        `Tuyến của bạn có ${valid.length} điểm — sẽ cắt bớt, chỉ dẫn đến ${hasGps ? totalAllowed : totalAllowed - 1} điểm đầu.\n` +
        `Tiếp tục?`
      )) return;
    }

    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w || w.closed || typeof w.closed === 'undefined') {
      window.location.href = url;
    }
  };

  const formatDist = (meters: number) => {
    if (meters > 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  };

  // Đếm thực tế = asset tồn tại (loại trừ ghim mồ côi)
  const realPinCount = sortedPins.length;
  const doneCount = sortedPins.filter((a: any) => completedIds.includes(a.id)).length;

  if (realPinCount === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-10 text-center animate-fade-in">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 border border-slate-200">
          <i className="fas fa-thumbtack text-slate-400 text-3xl rotate-45"></i>
        </div>
        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">Chưa có lộ trình</h3>
        <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
          Mở tab Bản đồ, tìm KH và bấm <span className="text-amber-600 font-black">GHIM</span> để thêm vào lộ trình.
        </p>
        {pinnedIds.length > 0 && onClearAll && (
          <button
            onClick={onClearAll}
            className="mt-5 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-wider border border-red-200 active:scale-95"
          >
            <i className="fas fa-trash-can mr-1.5"></i> Xoá {pinnedIds.length} ghim mồ côi
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-slide-up bg-slate-50">
      <div className="px-5 pt-5 pb-3 bg-white border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Lộ trình di chuyển</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {realPinCount} điểm · {doneCount} đã xong · {realPinCount - doneCount} còn lại
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-lg">
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-[8px] font-black text-blue-600 uppercase">GPS</span>
            </div>
            <button
              onClick={async () => {
                const ids = sortedPins.map(a => a.id);
                await shareRoute(ids);
                setShareToast(true);
                setTimeout(() => setShareToast(false), 2500);
              }}
              title="Chia sẻ lộ trình qua Zalo / copy link"
              className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 active:scale-95 flex items-center justify-center"
            >
              <i className="fas fa-share-nodes text-[11px]"></i>
            </button>
            {onClearAll && (
              <button
                onClick={onClearAll}
                title="Xoá toàn bộ ghim"
                className="w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 active:scale-95 flex items-center justify-center"
              >
                <i className="fas fa-trash-can text-[11px]"></i>
              </button>
            )}
          </div>
        </div>

        {/* Hàng action: Tối ưu TSP / Reset */}
        {realPinCount >= 2 && (
          <div className="mt-3 flex items-center gap-2">
            {!optimizedOrder ? (
              <button
                onClick={handleOptimize}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <i className="fas fa-wand-magic-sparkles text-xs"></i>
                Tối ưu thứ tự đi ({realPinCount} điểm)
              </button>
            ) : (
              <>
                <div className="flex-1 bg-emerald-50 text-emerald-700 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider border border-emerald-200 flex items-center gap-1.5">
                  <i className="fas fa-check-circle"></i>
                  Đã tối ưu{savedKm > 0.1 ? ` · tiết kiệm ${savedKm.toFixed(1)} km` : ''}
                </div>
                <button
                  onClick={handleResetOrder}
                  className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center active:scale-95"
                  title="Về thứ tự ghim ban đầu"
                >
                  <i className="fas fa-rotate-left text-xs"></i>
                </button>
              </>
            )}
          </div>
        )}

        {/* Dẫn đường cả tuyến qua Google Maps */}
        {realPinCount >= 1 && (
          <button
            onClick={handleRouteAll}
            className="mt-2 w-full bg-[#0079c1] hover:bg-[#005e96] text-white py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider shadow-md flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <i className="fab fa-google text-xs"></i>
            Dẫn đường cả tuyến trên Google Maps
            <span className="text-[9px] font-bold opacity-80 normal-case">
              ({(realPinCount - doneCount) || realPinCount} điểm còn lại)
            </span>
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto pin-list custom-scrollbar px-6 pb-12 relative">
        {/* Optimization Path Line */}
        <div className="absolute left-[3.25rem] top-0 bottom-0 w-px bg-slate-200 border-l border-dashed border-slate-300 -z-10"></div>

        {sortedPins.map((asset: any, index) => (
          <a
            key={asset.id}
            href={directionsUrl(asset)}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 relative mb-4 flex items-center gap-4 p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group active:scale-[0.98] no-underline"
          >
            {/* Index Badge */}
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-[11px] font-black text-white shadow-lg border-2 border-white z-10">
              {index + 1}
            </div>

            {/* Icon */}
            <div className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center text-white shadow-sm ${AssetTypeColors[asset.type] || 'bg-slate-700'}`}>
              <i className={`fas ${AssetTypeIcons[asset.type] || 'fa-question'}`}></i>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h4 className="text-sm font-black text-slate-900 truncate pr-2">{asset.name}</h4>
                <button 
                  onClick={(e) => { e.stopPropagation(); onUnpin(asset.id); }}
                  className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 transition-all hover:bg-red-50 rounded-full"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-black text-blue-600 font-mono uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                  {asset.customerCode || asset.code}
                </span>
                {asset.distance !== undefined && (
                  <span className="text-[10px] font-bold text-slate-500 flex items-center">
                    <i className="fas fa-location-arrow mr-1.5 text-blue-400 rotate-45"></i>
                    {formatDist(asset.distance)}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Action Overlay Hint */}
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
              <i className="fas fa-diamond-turn-right text-sm"></i>
            </div>
          </a>
        ))}

        {/* Info Legend */}
        <div className="mt-2 p-6 rounded-[2rem] bg-slate-100 border border-slate-200 text-center border-dashed">
          <i className="fas fa-info-circle text-slate-300 text-xl mb-2 block"></i>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
            Nhấn vào bất kỳ điểm nào để mở chỉ đường trực tiếp<br/>đến vị trí đó trên Google Maps
          </p>
        </div>
      </div>

      {/* Share toast */}
      {shareToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl z-[3000] animate-scale-up flex items-center gap-2.5">
          <i className="fas fa-circle-check text-emerald-400"></i>
          <span className="text-xs font-black uppercase tracking-wider">Đã copy link · dán vào Zalo</span>
        </div>
      )}
    </div>
  );
};

export default PinBoard;
