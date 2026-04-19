import React from 'react';
import { GridAsset, AssetTypeIcons, AssetTypeColors } from '../types';

interface WorklistTrayProps {
  pinnedAssets: GridAsset[];
  onSelect: (asset: GridAsset) => void;
  onUnpin: (id: string) => void;
  onNavigate: (asset: GridAsset) => void;
}

const WorklistTray: React.FC<WorklistTrayProps> = ({ 
  pinnedAssets, onSelect, onUnpin, onNavigate 
}) => {
  if (pinnedAssets.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[900] animate-slide-up">
      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-3 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
            <i className="fas fa-thumbtack text-amber-500"></i>
            Danh sách làm việc ({pinnedAssets.length})
          </h3>
          <span className="text-[8px] font-bold text-slate-500 uppercase">Vuốt ngang để xem</span>
        </div>
        
        <div className="flex overflow-x-auto p-4 gap-3 custom-scrollbar snap-x">
          {pinnedAssets.map(asset => (
            <div 
              key={asset.id}
              className="snap-start shrink-0 w-48 bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col gap-3 relative group"
            >
              <button 
                onClick={() => onUnpin(asset.id)}
                className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <i className="fas fa-times"></i>
              </button>

              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl ${AssetTypeColors[asset.type] || 'bg-slate-700'} flex items-center justify-center text-white text-xs`}>
                  <i className={`fas ${AssetTypeIcons[asset.type] || 'fa-question'}`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-white truncate">{asset.name}</p>
                  <p className="text-[9px] font-bold text-slate-500 truncate">{asset.customerCode || asset.code}</p>
                </div>
              </div>

              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => onSelect(asset)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl text-[9px] font-black uppercase transition-all"
                >
                  Chi tiết
                </button>
                <button
                  onClick={() => onNavigate(asset)}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1 shadow-lg shadow-blue-500/20"
                >
                  <i className="fas fa-diamond-turn-right text-[8px]"></i>
                  Đi
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorklistTray;
