import React from 'react';
import { GridAsset, AssetType, AssetTypeColors, AssetTypeIcons } from '../types';

interface PastSearchResultsProps {
  results: GridAsset[];
  onSelect: (asset: GridAsset) => void;
  onClose: () => void;
}

const PastSearchResults: React.FC<PastSearchResultsProps> = ({ results, onSelect, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 z-[3000] flex items-end">
      <div className="bg-white w-full rounded-t-[2rem] p-6 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-100">
            <i className="fas fa-arrow-left"></i>
          </button>
          <h2 className="text-xl font-bold">Kết quả tìm kiếm ({results.length})</h2>
        </div>

        {/* Results */}
        <div className="space-y-3">
          {results.map(asset => {
            const bgColor = AssetTypeColors[asset.type] || 'bg-slate-600';
            const icon = AssetTypeIcons[asset.type] || 'fa-question';
            
            return (
              <div
                key={asset.id}
                onClick={() => onSelect(asset)}
                className="bg-white border border-slate-200 rounded-xl p-4 active:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 ${bgColor} rounded-2xl flex items-center justify-center text-white`}>
                    <i className={`fas ${icon} text-xl`}></i>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{asset.name}</h3>
                    <p className="text-sm text-slate-500">{asset.code}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(asset.timestamp).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <i className="fas fa-chevron-right text-slate-400"></i>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PastSearchResults;