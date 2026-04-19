import React, { useMemo } from 'react';
import { GridAsset } from '../types';

interface PastSearchResultsProps {
  query: string;
  assets: GridAsset[];
  onNavigate: (asset: GridAsset) => void;
}

const PastSearchResults: React.FC<PastSearchResultsProps> = ({ query, assets, onNavigate }) => {
  const results = useMemo(() => {
    if (!query.trim()) return [];
    
    return assets.filter(asset => {
      const searchStr = query.toLowerCase();
      return (
        asset.name.toLowerCase().includes(searchStr) ||
        asset.code.toLowerCase().includes(searchStr) ||
        asset.address?.toLowerCase().includes(searchStr) ||
        asset.notes?.toLowerCase().includes(searchStr) ||
        new Date(asset.timestamp).toLocaleDateString('vi-VN').includes(searchStr)
      );
    }).sort((a, b) => b.timestamp - a.timestamp); // Sắp xếp mới nhất lên đầu
  }, [query, assets]);

  if (results.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
        <i className="fas fa-folder-open text-4xl text-slate-300 mb-3"></i>
        <p className="text-sm text-slate-500">Không tìm thấy kết quả</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 font-medium px-2">
        Tìm thấy {results.length} kết quả
      </p>
      
      {results.map(asset => {
        const assetDate = new Date(asset.timestamp).toLocaleDateString('vi-VN');
        const isToday = new Date(asset.timestamp).toDateString() === new Date().toDateString();
        
        return (
          <div
            key={asset.id}
            onClick={() => onNavigate(asset)}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
          >
            <div className="flex items-start gap-3">
              {/* Icon theo loại */}
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                asset.type === 'TRAM' ? 'bg-blue-600' :
                asset.type === 'TRU_TRUNG_THE' ? 'bg-violet-600' :
                asset.type === 'TRU_HA_THE' ? 'bg-emerald-600' :
                asset.type === 'DIEN_KE' ? 'bg-pink-600' : 'bg-amber-600'
              }`}>
                <i className={`fas ${
                  asset.type === 'TRAM' ? 'fa-bolt' :
                  asset.type === 'TRU_TRUNG_THE' ? 'fa-tower-broadcast' :
                  asset.type === 'TRU_HA_THE' ? 'fa-tower-observation' :
                  asset.type === 'DIEN_KE' ? 'fa-gauge-high' : 'fa-toggle-on'
                } text-sm`}></i>
              </div>

              {/* Thông tin */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-slate-800 truncate">{asset.name}</h4>
                  {isToday && (
                    <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                      Hôm nay
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-bold text-blue-600 font-mono mt-0.5">{asset.code}</p>
                
                {/* Địa chỉ và ngày */}
                <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500">
                  <i className="fas fa-map-pin"></i>
                  <span className="truncate">{asset.address || 'Không có địa chỉ'}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[8px] text-slate-400">
                  <i className="fas fa-clock"></i>
                  <span>{assetDate}</span>
                  <span>•</span>
                  <span>{asset.collectorName}</span>
                </div>
              </div>

              {/* Nút xem trên bản đồ */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(asset);
                }}
                className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors"
              >
                <i className="fas fa-map-location-dot text-sm"></i>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PastSearchResults;