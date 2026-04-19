import React from 'react';
import { GridAsset, AssetType } from '../types';

interface AssetCardProps {
  asset: GridAsset;
  onNavigate: (asset: GridAsset) => void;
}

const AssetCard: React.FC<AssetCardProps> = ({ asset, onNavigate }) => {
  // Hàm helper để xác định màu sắc dựa trên AssetType chuẩn
  const getAssetStyle = (type: AssetType) => {
    switch (type) {
      case AssetType.SUBSTATION:
        return { color: 'bg-blue-600', icon: 'fa-bolt' };
      case AssetType.POLE_MV:
        return { color: 'bg-violet-600', icon: 'fa-tower-broadcast' };
      case AssetType.POLE_LV:
        return { color: 'bg-emerald-600', icon: 'fa-tower-observation' };
      case AssetType.METER:
        return { color: 'bg-pink-600', icon: 'fa-gauge-high' };
      default:
        return { color: 'bg-amber-600', icon: 'fa-toggle-on' };
    }
  };

  const style = getAssetStyle(asset.type);

  return (
    <div
      onClick={() => onNavigate(asset)}
      className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
    >
      <div className="flex items-start gap-3">
        {/* Icon theo loại (Đã sửa lỗi so sánh Type) */}
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 ${style.color}`}>
          <i className={`fas ${style.icon} text-sm`}></i>
        </div>

        {/* Thông tin hiển thị */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-black text-slate-800 truncate">{asset.name}</h4>
          <p className="text-[10px] font-bold text-blue-600 font-mono mt-0.5">{asset.code}</p>
          
          {/* Địa chỉ thu thập */}
          <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500">
            <i className="fas fa-map-pin"></i>
            <span className="truncate">{asset.address || 'Không có địa chỉ'}</span>
          </div>
          
          {/* Thông tin nhân viên & Thời gian */}
          <div className="flex items-center gap-2 mt-0.5 text-[8px] text-slate-400">
            <i className="fas fa-clock"></i>
            <span>{new Date(asset.timestamp).toLocaleTimeString('vi-VN')}</span>
            <span>•</span>
            <span className="font-bold text-slate-500 uppercase">{asset.collectorName}</span>
          </div>
        </div>

        {/* Nút điều hướng nhanh trên bản đồ */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(asset);
          }}
          className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 active:scale-90 transition-all shadow-sm"
        >
          <i className="fas fa-location-arrow text-sm"></i>
        </button>
      </div>
    </div>
  );
};

export default AssetCard;