import React, { useState } from 'react';
import { GridAsset, AssetType } from '../types';

interface AssetDetailProps {
  asset: GridAsset;
  onClose: () => void;
  onNavigate: (asset: GridAsset) => void;
  onUseCoords: (asset: GridAsset) => void;
  onDelete: (id: string) => void;
  onEdit: (asset: GridAsset) => void;
  onPin: (id: string) => void;
  isPinned?: boolean;
  isCompleted?: boolean;
  onDirections?: () => void;
  onStartInspection: (asset: GridAsset) => void;
}

const AssetDetail: React.FC<AssetDetailProps> = ({
  asset, onClose, onNavigate, onUseCoords, onDelete, onEdit, onPin, isPinned, isCompleted, onDirections, onStartInspection
}) => {
  const [activePhoto, setActivePhoto] = useState(0);

  const statusMap = {
    ok: { label: 'Bình thường', color: 'bg-emerald-500', text: 'text-emerald-500' },
    warning: { label: 'Theo dõi', color: 'bg-amber-500', text: 'text-amber-500' },
    danger: { label: 'Nguy hiểm', color: 'bg-red-500', text: 'text-red-500' },
  };

  const isPole = asset.type === AssetType.POLE_MV || asset.type === AssetType.POLE_LV;
  const isMeter = asset.type === AssetType.METER;
  const isSubstation = asset.type === AssetType.SUBSTATION || asset.type === AssetType.SWITCHGEAR;

  const typeDetails = {
    [AssetType.SUBSTATION]: { label: 'Trạm Biến Áp', color: 'bg-blue-600', icon: 'fa-bolt' },
    [AssetType.POLE_MV]: { label: 'Trụ Trung Thế', color: 'bg-violet-600', icon: 'fa-tower-broadcast' },
    [AssetType.POLE_LV]: { label: 'Trụ Hạ Thế', color: 'bg-emerald-600', icon: 'fa-tower-observation' },
    [AssetType.SWITCHGEAR]: { label: 'Thiết bị Đóng cắt', color: 'bg-amber-500', icon: 'fa-toggle-on' },
    [AssetType.METER]: { label: 'Điện kế', color: 'bg-pink-600', icon: 'fa-gauge-high' },
    [AssetType.CUSTOMER]: { label: 'Khách hàng', color: 'bg-amber-600', icon: 'fa-house-user' },
  };

  const info = typeDetails[asset.type] || { label: 'Thiết bị', color: 'bg-slate-600', icon: 'fa-question' };

  // Chỉ đường — xây URL, để click handler mở bằng <a> để mobile chấp nhận user gesture
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${asset.coords.lat},${asset.coords.lng}&travelmode=driving`;
  const handleDirections = () => {
    onDirections?.();
    // window.open có thể bị chặn trên iOS Safari → dùng location khi open fail
    const w = window.open(directionsUrl, '_blank', 'noopener,noreferrer');
    if (!w || w.closed || typeof w.closed === 'undefined') {
      window.location.href = directionsUrl;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[2100] flex items-center justify-center p-4 animate-fade-in font-['Outfit',_sans-serif]">
      <div className="bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-white/20">
        
        {/* Header with Photo - Premium UI */}
        <div className="relative h-72 shrink-0 bg-slate-900 flex items-center justify-center overflow-hidden">
          {asset.photoUrls && asset.photoUrls.length > 0 ? (
            <img 
              src={asset.photoUrls[activePhoto]} 
              className="w-full h-full object-cover" 
              alt={asset.name}
            />
          ) : (
            <div className="flex flex-col items-center opacity-30 text-white">
              <i className={`fas ${info.icon} text-6xl mb-3`}></i>
              <span className="text-[10px] font-black uppercase tracking-widest">Hệ thống PowerMind</span>
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          
          <div className="absolute top-6 left-6 flex items-center gap-2 flex-wrap">
            <div className={`${info.color} text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl`}>
              {info.label}
            </div>
            {isPinned && (
              <div className={`${isCompleted ? 'bg-emerald-500' : 'bg-amber-500'} text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-1.5`}>
                <i className={`fas ${isCompleted ? 'fa-check' : 'fa-thumbtack rotate-45'}`}></i>
                {isCompleted ? 'Đã xong' : 'Đang làm'}
              </div>
            )}
          </div>

          <div className="absolute top-6 right-6 flex gap-2.5">
            <button 
              onClick={() => onPin(asset.id)}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-xl transition-all ${
                isPinned ? 'bg-amber-500 text-white' : 'bg-white/20 backdrop-blur-md text-white border border-white/30'
              }`}
            >
              <i className={`fas fa-thumbtack ${isPinned ? 'rotate-45' : ''} text-sm`}></i>
            </button>
            <button 
              onClick={onClose} 
              className="bg-white/20 backdrop-blur-md text-white w-11 h-11 rounded-2xl flex items-center justify-center border border-white/30"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Content - Elegant Typography & Modern Layout */}
        <div className="p-8 overflow-y-auto flex-1 space-y-8 custom-scrollbar bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 mb-2">
               {asset.collectorId === 'GIS_SYSTEM' && (
                 <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-[9px] font-black uppercase border border-blue-100">
                   Dữ liệu GIS
                 </span>
               )}
            </div>
            <h2 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">{asset.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
               <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-[9px] font-bold border border-slate-200 uppercase">
                 ID: {asset.id}
               </span>
               {asset.rawProperties?.TBT_ID && (
                 <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg text-[9px] font-black border border-indigo-100 uppercase">
                   Mã Trạm: {asset.rawProperties.TBT_ID}
                 </span>
               )}
               {asset.rawProperties?.MADD && (
                 <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[9px] font-black border border-blue-100 uppercase">
                   Tuyến: {asset.rawProperties.MADD}
                 </span>
               )}
               {asset.customerCode && (
                 <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase shadow-sm border border-amber-200/50">
                   Mã PE: {asset.customerCode}
                 </span>
               )}
            </div>
          </div>

          {/* Location & GIS Details */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 shrink-0">
                  <i className="fas fa-location-dot"></i>
                </div>
                <div className="flex-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Địa chỉ</p>
                  <p className="text-xs font-bold text-slate-700 leading-relaxed">{asset.address || 'Hệ thống GIS EVNHCMC'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-50">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Hệ tọa độ</p>
                  <p className="text-[11px] font-bold text-slate-700">VN2000 TP.HCM</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Nguồn cấp</p>
                  <p className="text-[11px] font-bold text-emerald-600">Đã đồng bộ</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">VN2000 (X)</p>
                <p className="text-xs font-mono font-black text-slate-800 tracking-tight">{asset.coords.x_vn2000?.toFixed(3) || '0.000'}</p>
              </div>
              <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">VN2000 (Y)</p>
                <p className="text-xs font-mono font-black text-slate-800 tracking-tight">{asset.coords.y_vn2000?.toFixed(3) || '0.000'}</p>
              </div>
            </div>
          </div>

          {/* v16.0 SPECIAL CARD: Customer ID (PE Code) for Meters */}
          {isMeter && asset.customerCode && (
            <div className="space-y-4 animate-slide-up">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Định danh Khách hàng</h4>
              <div className="bg-gradient-to-br from-pink-600 to-rose-700 p-6 rounded-[2rem] shadow-xl text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-pink-100 uppercase tracking-widest opacity-80 mb-1">Mã khách hàng (PE)</p>
                    <h5 className="text-4xl font-black tracking-tighter">{asset.customerCode}</h5>
                  </div>
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
                    <i className="fas fa-gauge-high text-2xl"></i>
                  </div>
                </div>
                {asset.rawProperties?.SO_HO_SO && (
                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
                    <span className="text-[9px] font-black text-pink-100 uppercase tracking-widest opacity-80">Số hồ sơ:</span>
                    <span className="text-[11px] font-black bg-white/10 px-2 py-0.5 rounded-lg">{asset.rawProperties.SO_HO_SO}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* v15.0 SPECIAL CARD: Pole Number (SOTRU) — show for ALL poles, hint if missing */}
          {isPole && (
            <div className="space-y-4 animate-slide-up">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Vị trí & Định danh Trụ</h4>
              <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-6 rounded-[2rem] shadow-xl text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-violet-100 uppercase tracking-widest opacity-80 mb-1">Số hiệu Trụ (GIS)</p>
                    <h5 className="text-4xl font-black tracking-tighter">
                      {asset.rawProperties?.SOTRU || asset.rawProperties?.MAHIEU || asset.rawProperties?.VITRI || (
                        <span className="text-base opacity-70">(Chưa có số trụ)</span>
                      )}
                    </h5>
                    <p className="text-[9px] font-bold text-violet-200 opacity-70 mt-1 uppercase tracking-widest">
                      {asset.rawProperties?.MATHIETBI || asset.code}
                    </p>
                  </div>
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
                    <i className="fas fa-tower-broadcast text-2xl"></i>
                  </div>
                </div>
                {asset.rawProperties.LOAITRU && (
                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
                    <span className="text-[9px] font-black text-violet-100 uppercase tracking-widest opacity-80">Loại trụ:</span>
                    <span className="text-[11px] font-black bg-white/10 px-2 py-0.5 rounded-lg">{asset.rawProperties.LOAITRU}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* v14.0 ENRICHED DATA: Customer Info (Meters) */}
          {isMeter && asset.rawProperties?.TEN_KHANG && (
            <div className="space-y-4 animate-slide-up">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Thông tin Khách hàng</h4>
              <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-cyan-50 rounded-2xl flex items-center justify-center text-cyan-600 shrink-0">
                    <i className="fas fa-user-tie"></i>
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Họ tên chủ hộ</p>
                    <p className="text-sm font-black text-slate-900 leading-tight">{asset.rawProperties.TEN_KHANG}</p>
                  </div>
                </div>

                {asset.rawProperties.DTHOAI && (
                  <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
                    <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                      <i className="fas fa-phone"></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Số điện thoại</p>
                      <p className="text-sm font-black text-slate-900">{asset.rawProperties.DTHOAI}</p>
                    </div>
                    <a 
                      href={`tel:${asset.rawProperties.DTHOAI}`}
                      className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-90 transition-all"
                    >
                      <i className="fas fa-phone-flip text-xs"></i>
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
                  <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-500 shrink-0">
                    <i className="fas fa-map-pin"></i>
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Địa chỉ đăng ký</p>
                    <p className="text-xs font-bold text-slate-600 italic">
                      {asset.rawProperties.DIA_CHI_KH || asset.rawProperties.DIA_CHI || "Chưa cập nhật"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* v14.0 ENRICHED DATA: Substation Info */}
          {asset.type === AssetType.SUBSTATION && asset.rawProperties?.CONG_SUAT && (
            <div className="space-y-4 animate-slide-up">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Thông số Kỹ thuật Trạm</h4>
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-[2rem] shadow-xl text-white">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest opacity-80 mb-1">Công suất định mức</p>
                    <h5 className="text-3xl font-black">{asset.rawProperties.CONG_SUAT} <span className="text-sm font-bold opacity-60">kVA</span></h5>
                  </div>
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30">
                    <i className="fas fa-bolt-lightning text-xl"></i>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <p className="text-[9px] font-black text-blue-100 uppercase tracking-widest opacity-80 mb-1">Mô tả thiết bị</p>
                  <p className="text-xs font-medium leading-relaxed italic">{asset.rawProperties.ASSETDESC || "Máy biến áp PowerMind"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Additional Metadata — gọn, font đồng nhất, dịch tên field */}
          <div className="space-y-3">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Thông tin chi tiết</h4>
             <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                   <tbody>
                      {asset.rawProperties ? (() => {
                        const FIELD_LABELS: Record<string, string> = {
                          MATHIETBI: 'Mã thiết bị', TEN: 'Tên', CHIDANH: 'Chỉ danh',
                          SOTRU: 'Số trụ', KH_ID: 'Mã PE', TBT_ID: 'Mã trạm', MADD: 'Tuyến',
                          TEN_KH: 'Tên khách hàng', TEN_KHANG: 'Chủ hộ',
                          DIA_CHI: 'Địa chỉ', DIA_CHI_KH: 'Địa chỉ KH', DIACHI: 'Địa chỉ',
                          DTHOAI: 'Điện thoại', SDT: 'Điện thoại', SO_HOP_DONG: 'Số HĐ',
                          CONG_SUAT: 'Công suất', CONG_SUAT_HOP_DONG: 'Công suất HĐ',
                          LOAITHIETBI: 'Loại thiết bị', LOAI_KH: 'Loại KH',
                          ASSETDESC: 'Mô tả', TRANGTHAI: 'Trạng thái', TRANG_THAI: 'Trạng thái',
                          DONVI: 'Đơn vị', LORA: 'Lora', SOHUU: 'Sở hữu',
                          VITRI: 'Vị trí', MAHIEU: 'Mã hiệu',
                          i: 'ID', p: 'Mã PE', m: 'MATHIETBI', n: 'Tên', a: 'Địa chỉ',
                          s: 'Số trụ', tb: 'Mã trạm', t: 'Loại', ll: 'Toạ độ',
                        };
                        const HIDDEN = new Set(['_layer','_type','i','t','ll','rawProperties']);
                        const rows = Object.entries(asset.rawProperties)
                          .filter(([key, val]) => {
                            if (val === null || val === undefined) return false;
                            if (key.startsWith('_') || HIDDEN.has(key)) return false;
                            if (['GISID', 'geometry'].includes(key)) return false;
                            const s = String(val).trim();
                            if (s === '' || s === '0' || s === 'null' || s === 'undefined') return false;
                            return true;
                          });
                        if (rows.length === 0) {
                          return (<tr><td colSpan={2} className="py-6 px-4 text-center text-[10px] font-bold text-slate-300 uppercase italic">Không có dữ liệu chi tiết</td></tr>);
                        }
                        return rows.map(([key, val], idx) => (
                          <tr key={key} className={idx % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'}>
                            <td className="py-2 px-3 text-[10px] font-bold text-slate-500 border-b border-slate-50 w-[38%] whitespace-nowrap">
                              {FIELD_LABELS[key] || key}
                            </td>
                            <td className="py-2 px-3 text-[11px] font-black text-slate-800 border-b border-slate-50 break-words">
                              {String(val)}
                            </td>
                          </tr>
                        ));
                      })() : (
                        <tr className="bg-white">
                           <td colSpan={2} className="py-6 px-4 text-center text-[10px] font-bold text-slate-300 uppercase italic">Không có dữ liệu chi tiết</td>
                        </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-white border-t border-slate-100 grid grid-cols-2 gap-3">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onDirections?.()}
            className="bg-white border-2 border-slate-100 text-slate-700 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95"
          >
            <i className="fas fa-diamond-turn-right text-blue-600 text-sm"></i> Chỉ đường
          </a>
          <button 
            onClick={() => onStartInspection(asset)}
            className="bg-amber-500 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <i className="fas fa-clipboard-check text-sm"></i> Kiểm tra
          </button>
          <button 
            onClick={() => { onNavigate(asset); onClose(); }}
            className="col-span-2 bg-blue-700 text-white py-4.5 h-14 rounded-2xl font-black text-[11px] uppercase flex items-center justify-center gap-2 shadow-xl shadow-blue-700/20 active:scale-[0.98] transition-all"
          >
            <i className="fas fa-map-marked-alt text-base"></i> Xem trên bản đồ
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetDetail;
