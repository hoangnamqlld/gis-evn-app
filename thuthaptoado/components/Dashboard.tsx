import React, { useState, useMemo, useEffect } from 'react';
import { GridAsset, AssetType, PowerLine } from '../types';

interface DashboardProps {
  assets: GridAsset[];
  lines: PowerLine[];
  filterDate: string;
  isSyncing: boolean;
  onSync: () => void;
  onRefreshCloud: () => Promise<void>;
  onFilterDateChange: (date: string) => void;
  onNavigate: (asset: GridAsset) => void;
  onViewDetail: (asset: GridAsset) => void;
  onBack: () => void;
  showPastData?: boolean;
  setShowPastData?: (show: boolean) => void;
  searchPastQuery?: string;
  setSearchPastQuery?: (query: string) => void;
  pastSearchResults?: GridAsset[];
  pinnedAssetIds?: string[];
}

type Period = 'day' | 'week' | 'month';

// Component AssetCard hiển thị một asset
const AssetCard: React.FC<{ asset: GridAsset; onNavigate: (asset: GridAsset) => void; onViewDetail: (asset: GridAsset) => void }> = ({ 
  asset, onNavigate, onViewDetail 
}) => {
  const assetDate = new Date(asset.timestamp);
  const isToday = assetDate.toDateString() === new Date().toDateString();
  
  return (
    <div 
      onClick={() => onViewDetail(asset)} 
      className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
    >
      <div className="flex items-start gap-3">
        {/* Icon theo loại */}
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md ${
          asset.type === AssetType.SUBSTATION ? 'bg-blue-600' : 
          asset.type === AssetType.POLE_MV ? 'bg-violet-600' :
          asset.type === AssetType.POLE_LV ? 'bg-emerald-600' : 
          asset.type === AssetType.METER ? 'bg-pink-600' : 'bg-amber-600'
        }`}>
          <i className={`fas ${
            asset.type === AssetType.SUBSTATION ? 'fa-bolt' : 
            asset.type === AssetType.POLE_MV ? 'fa-tower-broadcast' :
            asset.type === AssetType.POLE_LV ? 'fa-tower-observation' :
            asset.type === AssetType.METER ? 'fa-gauge-high' : 'fa-toggle-on'
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
          
          {/* Địa chỉ */}
          <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500">
            <i className="fas fa-map-pin"></i>
            <span className="truncate">{asset.address || 'Không có địa chỉ'}</span>
          </div>
          
          {/* Thời gian */}
          <div className="flex items-center gap-2 mt-0.5 text-[8px] text-slate-400">
            <i className="fas fa-clock"></i>
            <span>{assetDate.toLocaleTimeString('vi-VN')}</span>
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
          className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors"
        >
          <i className="fas fa-map-location-dot text-sm"></i>
        </button>
      </div>
    </div>
  );
};

// Component hiển thị kết quả tìm kiếm dữ liệu cũ
const PastSearchResults: React.FC<{ 
  query: string; 
  assets: GridAsset[]; 
  onNavigate: (asset: GridAsset) => void;
  onViewDetail: (asset: GridAsset) => void;
}> = ({ query, assets, onNavigate, onViewDetail }) => {
  const results = useMemo(() => {
    if (!query.trim()) return [];
    
    return assets.filter(asset => {
      const searchStr = query.toLowerCase();
      const assetDate = new Date(asset.timestamp).toLocaleDateString('vi-VN');
      return (
        asset.name.toLowerCase().includes(searchStr) ||
        asset.code.toLowerCase().includes(searchStr) ||
        asset.address?.toLowerCase().includes(searchStr) ||
        asset.notes?.toLowerCase().includes(searchStr) ||
        assetDate.includes(searchStr)
      );
    }).sort((a, b) => b.timestamp - a.timestamp);
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
      
      {results.map(asset => (
        <AssetCard 
          key={asset.id} 
          asset={asset} 
          onNavigate={onNavigate}
          onViewDetail={onViewDetail}
        />
      ))}
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ 
  assets, 
  filterDate, 
  isSyncing, 
  onSync, 
  onRefreshCloud,
  onFilterDateChange, 
  onNavigate, 
  onViewDetail, 
  onBack,
  showPastData = false,
  setShowPastData = () => {},
  searchPastQuery = '',
  setSearchPastQuery = () => {},
  pastSearchResults = [],
  pinnedAssetIds = []
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'list' | 'performance' | 'admin' | 'past' | 'pinned'>('stats');
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<AssetType | "ALL">("ALL");
  const [perfPeriod, setPerfPeriod] = useState<Period>('day');
  const [pastSearchInput, setPastSearchInput] = useState('');

  // 👉 THÊM useEffect để log assets
  useEffect(() => {
    console.log(`📊 Dashboard nhận ${assets.length} assets`);
    
    const today = new Date().toDateString();
    const todayAssets = assets.filter(a => new Date(a.timestamp).toDateString() === today);
    console.log(`📅 Assets hôm nay: ${todayAssets.length}`);
    
    const oldest = assets.length > 0 ? new Date(Math.min(...assets.map(a => a.timestamp))) : null;
    const newest = assets.length > 0 ? new Date(Math.max(...assets.map(a => a.timestamp))) : null;
    
    if (oldest) console.log(`📅 Cũ nhất: ${oldest.toLocaleDateString('vi-VN')}`);
    if (newest) console.log(`📅 Mới nhất: ${newest.toLocaleDateString('vi-VN')}`);
  }, [assets]);

  // Thống kê tổng hợp
  const statsByType = useMemo(() => {
    const counts = { 
      [AssetType.SUBSTATION]: 0, 
      [AssetType.POLE_MV]: 0, 
      [AssetType.POLE_LV]: 0, 
      [AssetType.METER]: 0, 
      [AssetType.SWITCHGEAR]: 0 
    };
    assets.forEach(a => { if (counts[a.type] !== undefined) counts[a.type]++; });
    return counts;
  }, [assets]);

  // Thống kê theo Đơn vị
  const unitStats = useMemo(() => {
    const units: Record<string, number> = {};
    assets.forEach(a => { units[a.unit] = (units[a.unit] || 0) + 1; });
    return Object.entries(units).sort((a, b) => b[1] - a[1]);
  }, [assets]);

  // Hiệu suất làm việc theo thời gian
  const userPerformance = useMemo(() => {
    const now = new Date();
    const filtered = assets.filter(a => {
      const date = new Date(a.timestamp);
      if (perfPeriod === 'day') return date.toDateString() === now.toDateString();
      if (perfPeriod === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return date >= weekAgo;
      }
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });

    const perf: Record<string, { count: number, unit: string }> = {};
    filtered.forEach(a => {
      if (!perf[a.collectorName]) perf[a.collectorName] = { count: 0, unit: a.unit };
      perf[a.collectorName].count++;
    });
    return Object.entries(perf).sort((a, b) => b[1].count - a[1].count);
  }, [assets, perfPeriod]);

  // Lọc assets hiện tại (chỉ hiển thị dữ liệu hôm nay khi không ở tab past)
  const todayAssets = useMemo(() => {
    const today = new Date().toDateString();
    return assets.filter(a => new Date(a.timestamp).toDateString() === today);
  }, [assets]);

  // Lọc assets theo tìm kiếm và type
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         a.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = typeFilter === "ALL" || a.type === typeFilter;
      return matchSearch && matchType;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [assets, searchQuery, typeFilter]);

  const handleStatClick = (type: AssetType) => {
    setTypeFilter(type);
    setActiveTab('list');
  };

  const handlePastSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPastSearchInput(value);
    setSearchPastQuery(value);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header Điều hành */}
      <div className="p-4 bg-white border-b border-slate-200 shrink-0 shadow-sm flex items-center justify-between">
         <div className="flex items-center gap-3">
            <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
              <i className="fas fa-arrow-left text-xs"></i>
            </button>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Báo cáo & Phân tích</h2>
         </div>
         <div className="flex gap-2">
           <button onClick={onRefreshCloud} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
             <i className="fas fa-sync-alt text-xs"></i>
           </button>
           <button onClick={onSync} disabled={isSyncing} className="px-3 h-8 rounded-lg bg-slate-900 text-white text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all">
             {isSyncing ? <i className="fas fa-spinner fa-spin"></i> : 'Đồng bộ'}
           </button>
         </div>
      </div>

      {/* Tabs Menu - Thêm tab "Dữ liệu cũ" */}
      <div className="flex p-2 bg-white border-b border-slate-100 shrink-0 overflow-x-auto no-scrollbar gap-2">
         {[
           { id: 'stats', label: 'Tổng quan', icon: 'fa-chart-pie' },
           { id: 'list', label: 'Dữ liệu', icon: 'fa-table-list' },
           { id: 'performance', label: 'Hiệu suất', icon: 'fa-user-ninja' },
           { id: 'admin', label: 'Đơn vị', icon: 'fa-building-shield' },
           { id: 'pinned', label: 'Đã ghim', icon: 'fa-bookmark' },
           { id: 'past', label: 'Dữ liệu cũ', icon: 'fa-archive' }
         ].map(t => (
           <button 
             key={t.id}
             onClick={() => setActiveTab(t.id as any)}
             className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 ${
               activeTab === t.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 bg-slate-50'
             }`}
           >
             <i className={`fas ${t.icon}`}></i> {t.label}
           </button>
         ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-32">
        
        {/* TAB 1: THỐNG KÊ TỔNG QUAN */}
        {activeTab === 'stats' && (
          <div className="space-y-6 animate-fade-in">
             <div className="grid grid-cols-2 gap-3">
                <div onClick={() => handleStatClick(AssetType.SUBSTATION)} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm active:scale-95 transition-all">
                   <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                     <i className="fas fa-bolt text-sm"></i>
                   </div>
                   <p className="text-[10px] font-black text-slate-400 uppercase">Trạm Biến Áp</p>
                   <p className="text-2xl font-black text-slate-800">{statsByType[AssetType.SUBSTATION]}</p>
                </div>
                <div onClick={() => handleStatClick(AssetType.POLE_MV)} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm active:scale-95 transition-all">
                   <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center mb-3">
                     <i className="fas fa-tower-broadcast text-sm"></i>
                   </div>
                   <p className="text-[10px] font-black text-slate-400 uppercase">Trụ Trung Thế</p>
                   <p className="text-2xl font-black text-slate-800">{statsByType[AssetType.POLE_MV]}</p>
                </div>
                <div onClick={() => handleStatClick(AssetType.POLE_LV)} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm active:scale-95 transition-all">
                   <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                     <i className="fas fa-tower-observation text-sm"></i>
                   </div>
                   <p className="text-[10px] font-black text-slate-400 uppercase">Trụ Hạ Thế</p>
                   <p className="text-2xl font-black text-slate-800">{statsByType[AssetType.POLE_LV]}</p>
                </div>
                <div onClick={() => handleStatClick(AssetType.METER)} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm active:scale-95 transition-all">
                   <div className="w-10 h-10 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center mb-3">
                     <i className="fas fa-gauge-high text-sm"></i>
                   </div>
                   <p className="text-[10px] font-black text-slate-400 uppercase">Điện kế</p>
                   <p className="text-2xl font-black text-slate-800">{statsByType[AssetType.METER]}</p>
                </div>
             </div>

             <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
                <i className="fas fa-chart-line absolute -right-6 -bottom-6 text-9xl opacity-10"></i>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Tổng sản lượng thu thập</h4>
                <p className="text-4xl font-black mb-1">{assets.length}</p>
                <p className="text-[10px] font-bold opacity-60 uppercase">Dữ liệu hợp lệ trên toàn hệ thống</p>
             </div>
          </div>
        )}

        {/* TAB 2: DANH SÁCH DỮ LIỆU HÔM NAY */}
        {activeTab === 'list' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
              <p className="text-xs text-emerald-700 font-medium">
                📍 Hiển thị dữ liệu thu thập hôm nay {new Date().toLocaleDateString('vi-VN')}
              </p>
            </div>

            <div className="space-y-3">
               {todayAssets.length === 0 ? (
                 <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                   <i className="fas fa-calendar-day text-4xl text-slate-300 mb-3"></i>
                   <p className="text-sm text-slate-500">Chưa có dữ liệu hôm nay</p>
                 </div>
               ) : (
                 todayAssets.map(asset => (
                   <AssetCard 
                     key={asset.id} 
                     asset={asset} 
                     onNavigate={onNavigate}
                     onViewDetail={onViewDetail}
                   />
                 ))
               )}
            </div>
          </div>
        )}

        {/* TAB 3: HIỆU SUẤT NHÂN VIÊN */}
        {activeTab === 'performance' && (
          <div className="space-y-6 animate-fade-in">
             <div className="flex p-1 bg-white rounded-2xl border border-slate-100 shadow-sm">
                {(['day', 'week', 'month'] as Period[]).map(p => (
                  <button 
                    key={p} onClick={() => setPerfPeriod(p)}
                    className={`flex-1 py-2 text-[9px] font-black uppercase rounded-xl transition-all ${
                      perfPeriod === p ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'
                    }`}
                  >
                    {p === 'day' ? 'Hôm nay' : p === 'week' ? 'Tuần này' : 'Tháng này'}
                  </button>
                ))}
             </div>

             <div className="space-y-2">
                {userPerformance.map(([name, data], idx) => (
                  <div key={name} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] ${
                       idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400'
                     }`}>
                        {idx + 1}
                     </div>
                     <div className="flex-1">
                        <p className="text-xs font-black text-slate-800">{name}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">{data.unit}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-lg font-black text-blue-600">{data.count}</p>
                        <p className="text-[8px] font-bold text-slate-300 uppercase">Đối tượng</p>
                     </div>
                  </div>
                ))}
                {userPerformance.length === 0 && (
                  <p className="text-center py-10 text-[10px] text-slate-300 font-bold uppercase">
                    Chưa có dữ liệu thời gian này
                  </p>
                )}
             </div>
          </div>
        )}

        {/* TAB 4: QUẢN LÝ ĐƠN VỊ */}
        {activeTab === 'admin' && (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-4">Sản lượng theo Đơn vị</h3>
                <div className="space-y-4">
                   {unitStats.map(([unit, count]) => (
                     <div key={unit} className="space-y-1">
                        <div className="flex justify-between items-end px-1">
                           <p className="text-[10px] font-black text-slate-700">Công ty Điện lực {unit}</p>
                           <p className="text-xs font-black text-blue-600">{count}</p>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                           <div 
                              className="bg-blue-600 h-full rounded-full" 
                              style={{ width: `${Math.min(100, (count / (assets.length || 1)) * 100)}%` }}
                           ></div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
             
             <div className="grid grid-cols-1 gap-4">
                <div className="bg-indigo-600 p-6 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100">
                   <h4 className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Dự báo tiến độ</h4>
                   <p className="text-2xl font-black">Vượt kế hoạch 12%</p>
                   <p className="text-[10px] mt-2 font-medium opacity-80 leading-relaxed">
                     Hệ thống ghi nhận hiệu suất thu thập đang ở mức ổn định cho chiến dịch lưới điện 2025.
                   </p>
                </div>
             </div>
          </div>
        )}

        {/* TAB 5: DỮ LIỆU CŨ - TÌM KIẾM */}
        {activeTab === 'past' && (
          <div className="space-y-4 animate-fade-in">
            {/* Ô tìm kiếm */}
            <div className="relative">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input
                type="text"
                value={pastSearchInput}
                onChange={handlePastSearch}
                placeholder="Tìm theo tên, mã số, địa chỉ, ngày tháng..."
                className="w-full bg-white p-4 pl-12 rounded-2xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {pastSearchInput && (
                <button
                  onClick={() => {
                    setPastSearchInput('');
                    setSearchPastQuery('');
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>

            {/* Kết quả tìm kiếm */}
            {pastSearchInput ? (
              <PastSearchResults 
                query={pastSearchInput} 
                assets={assets}
                onNavigate={onNavigate}
                onViewDetail={onViewDetail}
              />
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                <i className="fas fa-search text-4xl text-slate-300 mb-3"></i>
                <p className="text-sm text-slate-500">Nhập từ khóa để tìm kiếm dữ liệu cũ</p>
                <p className="text-[10px] text-slate-400 mt-2">
                  Bạn có thể tìm theo tên, mã số, địa chỉ hoặc ngày tháng
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* TAB 6: DANH SÁCH ĐÃ GHIM */}
        {activeTab === 'pinned' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <i className="fas fa-bookmark text-xs"></i>
              </div>
              <p className="text-xs text-amber-700 font-medium">
                Danh sách các vị trí đã ghim để theo dõi nhanh.
              </p>
            </div>
            
            <div className="space-y-3">
              {assets.filter(a => pinnedAssetIds.includes(a.id)).length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                  <i className="far fa-bookmark text-4xl text-slate-200 mb-3"></i>
                  <p className="text-sm text-slate-500">Chưa có vị trí nào được ghim</p>
                </div>
              ) : (
                assets.filter(a => pinnedAssetIds.includes(a.id)).map(asset => (
                  <AssetCard 
                    key={asset.id} 
                    asset={asset} 
                    onNavigate={onNavigate}
                    onViewDetail={onViewDetail}
                  />
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;