import React, { useState } from 'react';
import { GridAsset, AssetType } from '../types';
import { CloudService } from '../services/cloudService';

interface AssetDetailProps {
  asset: GridAsset;
  onClose: () => void;
  onNavigate: (asset: GridAsset) => void;
  onUseCoords: (asset: GridAsset) => void;
  onDelete: (id: string) => void;
  onEdit: (asset: GridAsset) => void;
  onPin: (id: string) => void;
  isPinned: boolean;
  onStartInspection?: (asset: GridAsset) => void;
}

const AssetDetail: React.FC<AssetDetailProps> = ({ 
  asset, onClose, onNavigate, onUseCoords, onDelete, onEdit, onPin, isPinned, onStartInspection 
}) => {
  const [activePhoto, setActivePhoto] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const typeLabels = {
    [AssetType.SUBSTATION]: { label: 'Trạm Biến Áp', color: 'bg-blue-600', icon: 'fa-bolt' },
    [AssetType.POLE_MV]: { label: 'Trụ Trung Thế', color: 'bg-violet-600', icon: 'fa-tower-broadcast' },
    [AssetType.POLE_LV]: { label: 'Trụ Hạ Thế', color: 'bg-emerald-600', icon: 'fa-tower-observation' },
    [AssetType.SWITCHGEAR]: { label: 'Thiết bị Đóng cắt', color: 'bg-amber-500', icon: 'fa-toggle-on' },
    [AssetType.METER]: { label: 'Điện kế', color: 'bg-pink-600', icon: 'fa-gauge-high' },
  };

  const info = typeLabels[asset.type] || { label: 'Thiết bị', color: 'bg-slate-600', icon: 'fa-question' };

  const handleDownloadImage = async (url: string, index: number) => {
    setDownloading(true);
    const fileName = `${asset.code}_${asset.name}_${index + 1}.jpg`;
    const success = await CloudService.downloadImage(url, fileName);
    if (success) {
      alert(`✅ Đã tải ảnh: ${fileName}`);
    } else {
      alert('❌ Không thể tải ảnh');
    }
    setDownloading(false);
  };

  const handleDownloadAllImages = async () => {
    if (!asset.photoUrls || asset.photoUrls.length === 0) return;
    
    setDownloading(true);
    const zipName = `${asset.code}_${asset.name}`.replace(/[^a-zA-Z0-9]/g, '_');
    const success = await CloudService.downloadImagesAsZip(asset.photoUrls, zipName);
    if (success) {
      alert(`✅ Đã tải ${asset.photoUrls.length} ảnh dưới dạng ZIP`);
    } else {
      alert('❌ Không thể tải ảnh');
    }
    setDownloading(false);
  };

  const handleDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${asset.coords.lat},${asset.coords.lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[2100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header với ảnh */}
        <div className="relative h-64 shrink-0 bg-slate-900 flex items-center justify-center overflow-hidden">
          {asset.photoUrls && asset.photoUrls.length > 0 ? (
            <>
              <img 
                key={asset.photoUrls[activePhoto]}
                src={asset.photoUrls[activePhoto]} 
                className="max-w-full max-h-full object-contain transition-all duration-300" 
                alt={asset.name}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://placehold.co/600x400/1e293b/white?text=Khong+the+tai+anh';
                }}
              />
              
              {/* Nút tải ảnh hiện tại */}
              <button
                onClick={() => handleDownloadImage(asset.photoUrls[activePhoto], activePhoto)}
                disabled={downloading}
                className="absolute top-4 right-16 bg-white/90 text-slate-700 w-10 h-10 rounded-full flex items-center justify-center shadow-md hover:bg-white z-20"
                title="Tải ảnh này"
              >
                <i className={`fas ${downloading ? 'fa-spinner fa-spin' : 'fa-download'} text-sm`}></i>
              </button>
              
              {asset.photoUrls.length > 1 && (
                <>
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20">
                    {asset.photoUrls.map((_, i) => (
                      <button 
                        key={i} 
                        onClick={() => setActivePhoto(i)}
                        className={`h-1.5 rounded-full transition-all ${activePhoto === i ? 'w-6 bg-white' : 'w-2 bg-white/40'}`}
                      />
                    ))}
                  </div>
                  
                  {/* Nút chuyển ảnh */}
                  <button
                    onClick={() => setActivePhoto((activePhoto - 1 + asset.photoUrls.length) % asset.photoUrls.length)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/70 z-20"
                  >
                    <i className="fas fa-chevron-left text-sm"></i>
                  </button>
                  <button
                    onClick={() => setActivePhoto((activePhoto + 1) % asset.photoUrls.length)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/70 z-20"
                  >
                    <i className="fas fa-chevron-right text-sm"></i>
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-800">
              <i className="fas fa-image text-5xl mb-2 opacity-20"></i>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Không có hình ảnh</span>
            </div>
          )}
          
          <div className={`absolute top-4 left-4 ${info.color} text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg z-20`}>
            {info.label}
          </div>
          
          <div className="absolute top-4 right-4 flex gap-2 z-20">
            {/* Nút tải tất cả ảnh */}
            {asset.photoUrls && asset.photoUrls.length > 1 && (
              <button 
                onClick={handleDownloadAllImages} 
                disabled={downloading}
                className="bg-emerald-500/90 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md hover:bg-emerald-600"
                title="Tải tất cả ảnh (ZIP)"
              >
                <i className={`fas ${downloading ? 'fa-spinner fa-spin' : 'fa-file-archive'} text-sm`}></i>
              </button>
            )}
            <button 
              onClick={() => onPin(asset.id)} 
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all ${
                isPinned ? 'bg-yellow-400 text-slate-800' : 'bg-white/90 text-slate-700 hover:bg-white'
              }`}
              title={isPinned ? "Bỏ ghim" : "Ghim vị trí"}
            >
              <i className={`${isPinned ? 'fas' : 'far'} fa-bookmark text-sm`}></i>
            </button>
            <button onClick={() => onEdit(asset)} className="bg-white/90 text-slate-700 w-10 h-10 rounded-full flex items-center justify-center shadow-md hover:bg-white">
              <i className="fas fa-pencil-alt text-sm"></i>
            </button>
            <button onClick={() => onDelete(asset.id)} className="bg-red-500/90 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md hover:bg-red-600">
              <i className="fas fa-trash-alt text-sm"></i>
            </button>
            <button onClick={onClose} className="bg-black/40 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/60">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Thông tin chi tiết */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
          <div>
            <h2 className="text-xl font-black text-slate-800 leading-tight">{asset.name}</h2>
            <p className="text-xs font-bold text-blue-600 font-mono mt-1">Mã hiệu: {asset.code}</p>
          </div>

          {/* Tọa độ */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <p className="text-[8px] text-slate-400 font-bold uppercase mb-1">VN2000 X</p>
              <p className="text-xs font-mono font-bold text-slate-700">{asset.coords.x_vn2000?.toFixed(2)}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <p className="text-[8px] text-slate-400 font-bold uppercase mb-1">VN2000 Y</p>
              <p className="text-xs font-mono font-bold text-slate-700">{asset.coords.y_vn2000?.toFixed(2)}</p>
            </div>
          </div>

          {/* Địa chỉ và thông tin khác */}
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="text-blue-500 shrink-0"><i className="fas fa-location-dot"></i></div>
              <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{asset.address}</p>
            </div>
            <div className="flex gap-3">
              <div className="text-slate-400 shrink-0"><i className="fas fa-clock"></i></div>
              <p className="text-[11px] text-slate-500">
                NV: {asset.collectorName} • {new Date(asset.timestamp).toLocaleString('vi-VN')}
              </p>
            </div>
            {asset.notes && (
              <div className="flex gap-3">
                <div className="text-slate-400 shrink-0"><i className="fas fa-sticky-note"></i></div>
                <p className="text-[11px] text-slate-600 italic">{asset.notes}</p>
              </div>
            )}
          </div>

          {/* Danh sách ảnh dạng thumbnail */}
          {asset.photoUrls && asset.photoUrls.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase">ẢNH ({asset.photoUrls.length})</p>
                {asset.photoUrls.length > 1 && (
                  <button
                    onClick={handleDownloadAllImages}
                    disabled={downloading}
                    className="text-[10px] bg-emerald-600 text-white px-3 py-1 rounded-full font-bold hover:bg-emerald-700"
                  >
                    <i className="fas fa-file-archive mr-1"></i>
                    Tải tất cả
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {asset.photoUrls.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img 
                      src={url} 
                      alt={`Ảnh ${idx + 1}`} 
                      className="w-full h-16 object-cover rounded-lg border border-slate-200"
                      onClick={() => setActivePhoto(idx)}
                    />
                    <button
                      onClick={() => handleDownloadImage(url, idx)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center"
                    >
                      <i className="fas fa-download text-white text-sm"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Nút hành động */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2">
          <button 
            onClick={handleDirections}
            className="flex-1 bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-2xl font-black text-[10px] uppercase shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <i className="fas fa-diamond-turn-right text-blue-600"></i> Chỉ đường
          </button>
          <button 
            onClick={() => { onNavigate(asset); onClose(); }}
            className="flex-1 bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-2xl font-black text-[10px] uppercase shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <i className="fas fa-map-marked-alt text-blue-600"></i> Xem trên bản đồ
          </button>
          {onStartInspection && (
            <button 
              onClick={() => onStartInspection(asset)}
              className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <i className="fas fa-clipboard-check"></i> Kiểm tra
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetDetail;