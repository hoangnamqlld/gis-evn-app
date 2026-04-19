import React, { useState, useMemo } from 'react';
import { GridAsset, PowerLine } from '../types';
import { formatDateTime, formatDate } from '../utils/math';

interface DashboardProps {
  assets: GridAsset[];
  lines: PowerLine[];
  filterDate: string;
  isSyncing: boolean;
  syncStats?: {
    pending: number;
    failed: number;
    completed: number;
  };
  onSync: () => void;
  onRefreshCloud: () => Promise<void>;
  onFilterDateChange: (date: string) => void;
  onNavigate: (asset: GridAsset) => void;
  onViewDetail: (asset: GridAsset) => void;
  onBack: () => void;
  onOpenReport: () => void;
  showPastData: boolean;
  setShowPastData: (show: boolean) => void;
  searchPastQuery: string;
  setSearchPastQuery: (query: string) => void;
  pastSearchResults: GridAsset[];
  pinnedAssetIds?: string[];
}

const Dashboard: React.FC<DashboardProps> = ({
  assets,
  lines,
  filterDate,
  isSyncing,
  syncStats = { pending: 0, failed: 0, completed: 0 },
  onSync,
  onRefreshCloud,
  onFilterDateChange,
  onNavigate,
  onViewDetail,
  onBack,
  onOpenReport,
  showPastData,
  setShowPastData,
  searchPastQuery,
  setSearchPastQuery,
  pastSearchResults,
  pinnedAssetIds = []
}) => {
  const [selectedTab, setSelectedTab] = useState<'assets' | 'lines' | 'stats' | 'pinned'>('assets');
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Thống kê theo ngày
  const stats = useMemo(() => {
    const today = new Date(filterDate).toISOString().split('T')[0];
    
    const todayAssets = assets.filter(a => 
      new Date(a.timestamp).toISOString().split('T')[0] === today
    );
    
    const syncedToday = todayAssets.filter(a => a.status === 'Synced').length;
    const draftToday = todayAssets.filter(a => a.status === 'Draft').length;
    
    const byUnit = assets.reduce((acc, asset) => {
      acc[asset.unit] = (acc[asset.unit] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const byType = assets.reduce((acc, asset) => {
      acc[asset.type] = (acc[asset.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const totalPhotos = assets.reduce((sum, a) => sum + a.photoUrls.length, 0);
    
    return {
      total: assets.length,
      today: todayAssets.length,
      syncedToday,
      draftToday,
      byUnit,
      byType,
      totalPhotos,
      linesTotal: lines.length
    };
  }, [assets, lines, filterDate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshCloud();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getAssetTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      substation: 'bg-blue-100 text-blue-700 border-blue-200',
      pole_mv: 'bg-violet-100 text-violet-700 border-violet-200',
      pole_lv: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      meter: 'bg-pink-100 text-pink-700 border-pink-200',
      switchgear: 'bg-amber-100 text-amber-700 border-amber-200'
    };
    return colors[type] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getAssetTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      substation: 'fa-bolt',
      pole_mv: 'fa-tower-broadcast',
      pole_lv: 'fa-tower-observation',
      meter: 'fa-gauge-high',
      switchgear: 'fa-toggle-on'
    };
    return icons[type] || 'fa-question';
  };

  const getAssetTypeName = (type: string) => {
    const names: Record<string, string> = {
      substation: 'Trạm BA',
      pole_mv: 'Trụ TT',
      pole_lv: 'Trụ HT',
      meter: 'Điện kế',
      switchgear: 'Thiết bị'
    };
    return names[type] || type;
  };

  const displayedAssets = showPastData ? pastSearchResults : assets;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
        >
          <i className="fas fa-arrow-left"></i>
        </button>
        <div className="flex-1">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
            QUẢN LÝ DỮ LIỆU
          </h2>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {stats.total} điểm · {stats.totalPhotos} ảnh · {stats.linesTotal} đường dây
          </p>
        </div>
        <div className="flex gap-2">
          {/* Nút xuất báo cáo */}
          <button
            onClick={onOpenReport}
            className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200"
            title="Xuất báo cáo"
          >
            <i className="fas fa-file-export"></i>
          </button>
          
          {/* Nút làm mới */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 disabled:opacity-50"
          >
            <i className={`fas fa-sync-alt ${isRefreshing ? 'fa-spin' : ''}`}></i>
          </button>
          
          {/* Nút đồng bộ */}
          <button
            onClick={onSync}
            disabled={isSyncing}
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              syncStats.pending > 0
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            <i className={`fas ${isSyncing ? 'fa-sync fa-spin' : 'fa-cloud-upload-alt'}`}></i>
          </button>
        </div>
      </div>

      {/* Sync Stats Bar - Hiển thị khi có pending hoặc failed */}
      {(syncStats.pending > 0 || syncStats.failed > 0) && (
        <div className="bg-blue-50 border-b border-blue-200 p-3 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            {syncStats.pending > 0 && (
              <span className="text-blue-700">
                <i className="fas fa-clock mr-1"></i>
                Đang chờ: {syncStats.pending}
              </span>
            )}
            {syncStats.failed > 0 && (
              <span className="text-red-600">
                <i className="fas fa-exclamation-circle mr-1"></i>
                Thất bại: {syncStats.failed}
              </span>
            )}
          </div>
          <button
            onClick={onSync}
            className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold"
          >
            Đồng bộ ngay
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border-b border-slate-200 p-3 flex items-center gap-2">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm"></i>
          <input
            type="text"
            value={searchPastQuery}
            onChange={(e) => setSearchPastQuery(e.target.value)}
            placeholder="Tìm kiếm theo mã, tên, địa chỉ..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
          />
        </div>
        
        <input
          type="date"
          value={filterDate}
          onChange={(e) => onFilterDateChange(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
        />
        
        <button
          onClick={() => setShowPastData(!showPastData)}
          className={`px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${
            showPastData
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {showPastData ? 'Kết quả tìm kiếm' : 'Dữ liệu mới nhất'}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 flex gap-4">
        <button
          onClick={() => setSelectedTab('assets')}
          className={`py-3 text-sm font-bold border-b-2 transition-colors ${
            selectedTab === 'assets'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <i className="fas fa-box mr-2"></i>
          Điểm thu thập ({displayedAssets.length})
        </button>
        <button
          onClick={() => setSelectedTab('lines')}
          className={`py-3 text-sm font-bold border-b-2 transition-colors ${
            selectedTab === 'lines'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <i className="fas fa-project-diagram mr-2"></i>
          Đường dây ({lines.length})
        </button>
        <button
          onClick={() => setSelectedTab('stats')}
          className={`py-3 text-sm font-bold border-b-2 transition-colors ${
            selectedTab === 'stats'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <i className="fas fa-chart-pie mr-2"></i>
          Thống kê
        </button>
        <button
          onClick={() => setSelectedTab('pinned')}
          className={`py-3 text-sm font-bold border-b-2 transition-colors ${
            selectedTab === 'pinned'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <i className="fas fa-bookmark mr-2"></i>
          Đã ghim ({pinnedAssetIds.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedTab === 'assets' && (
          <div className="space-y-2">
            {displayedAssets.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-slate-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <i className="fas fa-box-open text-3xl text-slate-400"></i>
                </div>
                <p className="text-slate-500">Không có dữ liệu</p>
              </div>
            ) : (
              displayedAssets.map(asset => (
                <div
                  key={asset.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                >
                  {/* Header */}
                  <div
                    onClick={() => setExpandedAsset(expandedAsset === asset.id ? null : asset.id)}
                    className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getAssetTypeColor(asset.type)}`}>
                      <i className={`fas ${getAssetTypeIcon(asset.type)}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm truncate">{asset.name}</h3>
                        {asset.status === 'Draft' ? (
                          <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            <i className="fas fa-clock mr-0.5"></i>
                            Chờ
                          </span>
                        ) : (
                          <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            <i className="fas fa-check-circle mr-0.5"></i>
                            Đã GB
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        <i className="fas fa-map-pin mr-1 text-slate-400"></i>
                        {asset.address || 'Chưa có địa chỉ'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-slate-600">
                        {asset.coords.x_vn2000?.toFixed(0)} | {asset.coords.y_vn2000?.toFixed(0)}
                      </p>
                      <p className="text-[8px] text-slate-400">
                        {new Date(asset.timestamp).toLocaleTimeString('vi-VN')}
                      </p>
                    </div>
                    <i className={`fas fa-chevron-${expandedAsset === asset.id ? 'up' : 'down'} text-slate-400`}></i>
                  </div>

                  {/* Expanded Details */}
                  {expandedAsset === asset.id && (
                    <div className="border-t border-slate-100 p-4 bg-slate-50">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-[8px] text-slate-400 uppercase font-bold">Mã số</p>
                          <p className="text-xs font-mono font-bold">{asset.code}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-slate-400 uppercase font-bold">Người thu thập</p>
                          <p className="text-xs">{asset.collectorName}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-slate-400 uppercase font-bold">Thời gian</p>
                          <p className="text-xs">{formatDateTime(asset.timestamp)}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-slate-400 uppercase font-bold">Số ảnh</p>
                          <p className="text-xs">
                            <i className="fas fa-camera mr-1 text-blue-500"></i>
                            {asset.photoUrls.length}
                          </p>
                        </div>
                      </div>

                      {asset.notes && (
                        <div className="mb-3 p-2 bg-white rounded-lg border border-slate-200">
                          <p className="text-[10px] italic text-slate-600">{asset.notes}</p>
                        </div>
                      )}

                      {/* Photos preview */}
                      {asset.photoUrls.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                          {asset.photoUrls.slice(0, 3).map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`Photo ${idx + 1}`}
                              className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                            />
                          ))}
                          {asset.photoUrls.length > 3 && (
                            <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center text-slate-500 text-xs font-bold">
                              +{asset.photoUrls.length - 3}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => onNavigate(asset)}
                          className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                        >
                          <i className="fas fa-map-marked-alt"></i>
                          Xem trên bản đồ
                        </button>
                        <button
                          onClick={() => onViewDetail(asset)}
                          className="flex-1 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                        >
                          <i className="fas fa-info-circle"></i>
                          Chi tiết
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {selectedTab === 'lines' && (
          <div className="space-y-2">
            {lines.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-slate-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <i className="fas fa-project-diagram text-3xl text-slate-400"></i>
                </div>
                <p className="text-slate-500">Chưa có đường dây nào</p>
              </div>
            ) : (
              lines.map(line => {
                const fromAsset = assets.find(a => a.id === line.fromId);
                const toAsset = assets.find(a => a.id === line.toId);
                
                return (
                  <div key={line.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        line.type === 'MV' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {line.type === 'MV' ? 'Trung thế' : 'Hạ thế'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDate(line.timestamp)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-bold truncate">{fromAsset?.name || 'Unknown'}</p>
                        <p className="text-[8px] text-slate-400">{fromAsset?.code}</p>
                      </div>
                      <i className="fas fa-arrow-right text-slate-400"></i>
                      <div className="flex-1">
                        <p className="text-xs font-bold truncate">{toAsset?.name || 'Unknown'}</p>
                        <p className="text-[8px] text-slate-400">{toAsset?.code}</p>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                      <span>
                        <i className="fas fa-ruler mr-1"></i>
                        {line.length}m
                      </span>
                      {line.isUnderground && (
                        <span className="text-slate-400">
                          <i className="fas fa-undo-alt mr-1"></i>
                          Ngầm
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {selectedTab === 'stats' && (
          <div className="space-y-4">
            {/* Thống kê nhanh */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <p className="text-[8px] text-slate-400 uppercase font-bold mb-1">Tổng số điểm</p>
                <p className="text-2xl font-black text-slate-800">{stats.total}</p>
                <p className="text-[10px] text-green-600 mt-1">
                  <i className="fas fa-arrow-up mr-1"></i>
                  {stats.today} hôm nay
                </p>
              </div>
              
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <p className="text-[8px] text-slate-400 uppercase font-bold mb-1">Đã đồng bộ</p>
                <p className="text-2xl font-black text-green-600">{stats.syncedToday}</p>
                <p className="text-[10px] text-amber-600 mt-1">
                  <i className="fas fa-clock mr-1"></i>
                  {stats.draftToday} chờ
                </p>
              </div>
            </div>

            {/* Theo đơn vị */}
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <h3 className="text-xs font-black text-slate-800 uppercase mb-3">THEO ĐƠN VỊ</h3>
              <div className="space-y-2">
                {Object.entries(stats.byUnit).map(([unit, count]) => (
                  <div key={unit} className="flex items-center gap-2">
                    <span className="text-xs font-bold w-16">{unit}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${(count / stats.total) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Theo loại */}
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <h3 className="text-xs font-black text-slate-800 uppercase mb-3">THEO LOẠI</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(stats.byType).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getAssetTypeColor(type).split(' ')[0]}`}></div>
                    <span className="text-xs flex-1">{getAssetTypeName(type)}</span>
                    <span className="text-xs font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Thống kê đồng bộ */}
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <h3 className="text-xs font-black text-slate-800 uppercase mb-3">TRẠNG THÁI ĐỒNG BỘ</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Đã đồng bộ</span>
                    <span className="font-bold text-green-600">{syncStats.completed}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${(syncStats.completed / stats.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                {syncStats.pending > 0 && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Đang chờ</span>
                      <span className="font-bold text-amber-600">{syncStats.pending}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${(syncStats.pending / stats.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                
                {syncStats.failed > 0 && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Thất bại</span>
                      <span className="font-bold text-red-600">{syncStats.failed}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${(syncStats.failed / stats.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Thông tin ảnh */}
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[8px] text-slate-400 uppercase font-bold">TỔNG SỐ ẢNH</p>
                  <p className="text-2xl font-black text-slate-800">{stats.totalPhotos}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <i className="fas fa-camera text-blue-600 text-xl"></i>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                Trung bình {(stats.totalPhotos / stats.total || 0).toFixed(1)} ảnh/điểm
              </p>
            </div>
          </div>
        )}
 
        {selectedTab === 'pinned' && (
          <div className="space-y-3">
             {assets.filter(a => pinnedAssetIds.includes(a.id)).length === 0 ? (
               <div className="text-center py-12">
                 <div className="w-20 h-20 bg-slate-50 rounded-full mx-auto mb-4 flex items-center justify-center">
                   <i className="fas fa-bookmark text-3xl text-slate-200"></i>
                 </div>
                 <p className="text-slate-500">Chưa có vị trí nào được ghim</p>
               </div>
             ) : (
               assets.filter(a => pinnedAssetIds.includes(a.id)).map(asset => (
                 <div
                   key={asset.id}
                   className="bg-white rounded-xl border border-amber-100 overflow-hidden shadow-sm"
                 >
                   <div
                     className="p-4 flex items-center gap-3 cursor-pointer hover:bg-amber-50"
                     onClick={() => { onNavigate(asset); onBack(); }}
                   >
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getAssetTypeColor(asset.type)}`}>
                       <i className={`fas ${getAssetTypeIcon(asset.type)} text-sm`}></i>
                     </div>
                     <div className="flex-1 min-w-0">
                       <h3 className="font-bold text-sm truncate">{asset.name}</h3>
                       <p className="text-[10px] text-slate-500 truncate">{asset.address}</p>
                     </div>
                     <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                        <i className="fas fa-location-arrow text-xs"></i>
                     </div>
                   </div>
                 </div>
               ))
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;