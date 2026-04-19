import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GridAsset, AssetType, AssetTypeLabels, AssetTypeIcons, AssetTypeColors, Coordinates } from '../types';
import { search as clientSearch, searchNearby, SearchItem } from '../services/tileDataService';
import { convertWGS84toVN2000 } from '../utils/vn2000';
import { useVoiceSearch, isVoiceSupported } from '../hooks/useVoiceSearch';
import { ocrImage, extractFromText } from '../utils/listOcr';

interface SearchPopupProps {
  assets: GridAsset[];
  onClose: () => void;
  onSelect: (asset: GridAsset) => void;
  onPin?: (asset: GridAsset) => void;
  pinnedIds?: string[];
  onViewPins?: () => void;
  currentLocation?: Coordinates | null;
}

type Tab = 'all' | 'pe' | 'name' | 'address' | 'phone' | 'nearby' | 'recent';
const RECENT_KEY = 'powermind_recent_search';
const RECENT_MAX = 20;

function loadRecent(): SearchItem[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function pushRecent(it: SearchItem) {
  try {
    const list = loadRecent().filter(x => x.i !== it.i);
    list.unshift(it);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {}
}

const typeMap: Record<string, AssetType> = {
  meter:      AssetType.METER,
  substation: AssetType.SUBSTATION,
  switchgear: AssetType.SWITCHGEAR,
  pole_mv:    AssetType.POLE_MV,
  pole_lv:    AssetType.POLE_LV,
};

/** Distance squared (cheap, dùng cho sort) */
function distSq(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dx = a.lat - b.lat, dy = a.lng - b.lng;
  return dx * dx + dy * dy;
}

/** Convert SearchItem (client) → GridAsset format (có VN2000) — defensive */
function itemToAsset(it: SearchItem): GridAsset | null {
  try {
    if (!it || !it.i) return null;
    const type = typeMap[it.t] || AssetType.POLE_LV;
    const isMeter = type === AssetType.METER;
    const isSubstation = type === AssetType.SUBSTATION;
    const isSwitchgear = type === AssetType.SWITCHGEAR;

    // Guard: ll có thể thiếu hoặc không phải array
    const ll = Array.isArray(it.ll) ? it.ll : [NaN, NaN];
    const lat = Number(ll[0]);
    const lng = Number(ll[1]);

    let x = NaN, y = NaN;
    try {
      const result = convertWGS84toVN2000(lat, lng);
      x = result.x;
      y = result.y;
    } catch {
      /* keep NaN */
    }

    const name = isMeter
      ? (it.n || (it.p ? `Điện kế ${it.p}` : (it.m ? `Điện kế ${it.m}` : 'Điện kế')))
      : isSubstation
      ? (it.n || it.lb || `Trạm ${it.tb || it.m || ''}`.trim())
      : isSwitchgear
      ? (it.n || it.cd || it.lb || `Thiết bị ${it.m || ''}`.trim())
      : (it.s ? `Trụ ${it.s}` : (it.n || it.m || it.lb || 'Trụ'));

    return {
      id:   it.i,
      name,
      code: it.s || it.m || it.cd || it.p || it.i,
      type,
      coords: { lat, lng, x_vn2000: x, y_vn2000: y },
      address: it.a || '',
      photoUrls: [],
      timestamp: Date.now(),
      status: 'Synced',
      unit: 'GIS',
      collectorName: 'GIS',
      collectorId: 'GIS_SYSTEM',
      customerCode: it.p || undefined,
      poleNumber:   it.s || undefined,
      rawProperties: it as any,
    };
  } catch (e) {
    console.warn('[SearchPopup] itemToAsset lỗi:', e, it);
    return null;
  }
}

const SearchPopup: React.FC<SearchPopupProps> = ({
  assets, onClose, onSelect, onPin, pinnedIds = [], onViewPins, currentLocation,
}) => {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [tick, setTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrState, setOcrState] = useState<{ progress: number; matches: SearchItem[]; pickedIds: Set<string> } | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Voice search — nói xong tự đổ vào ô input
  const voice = useVoiceSearch((text) => {
    // Normalize: "pe không chín..." → vẫn set text, user có thể sửa. Chuyển các số đọc ra thành digits.
    const spoken = text
      .replace(/\bkhông\b/gi, '0').replace(/\bmột\b/gi, '1').replace(/\bhai\b/gi, '2')
      .replace(/\bba\b/gi, '3').replace(/\bbốn\b/gi, '4').replace(/\bnăm\b/gi, '5')
      .replace(/\bsáu\b/gi, '6').replace(/\bbảy\b/gi, '7').replace(/\btám\b/gi, '8')
      .replace(/\bchín\b/gi, '9').replace(/\s+/g, ' ').trim();
    setQuery(spoken);
  });

  const handleOcrFile = async (file: File) => {
    setOcrError(null);
    setOcrState({ progress: 0, matches: [], pickedIds: new Set() });
    try {
      const ex = await ocrImage(file, (p) => {
        setOcrState(s => s ? { ...s, progress: p } : s);
      });
      // Match với search index: thử PE → SĐT → TBT
      const matches: SearchItem[] = [];
      const seen = new Set<string>();
      for (const pe of ex.peCodes) {
        const hits = clientSearch(pe, 3);
        for (const h of hits) { if (!seen.has(h.i)) { matches.push(h); seen.add(h.i); } }
      }
      for (const ph of ex.phones) {
        const hits = clientSearch(ph, 3);
        for (const h of hits) { if (!seen.has(h.i)) { matches.push(h); seen.add(h.i); } }
      }
      setOcrState({ progress: 100, matches, pickedIds: new Set(matches.map(m => m.i)) });
      if (matches.length === 0) setOcrError(`OCR đọc được nhưng không tìm thấy KH khớp. Mã PE trích: ${ex.peCodes.length}, SĐT: ${ex.phones.length}`);
    } catch (e: any) {
      setOcrError('OCR lỗi: ' + (e?.message || String(e)));
      setOcrState(null);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return;
      const ex = extractFromText(text);
      const matches: SearchItem[] = [];
      const seen = new Set<string>();
      for (const pe of ex.peCodes) {
        const hits = clientSearch(pe, 3);
        for (const h of hits) { if (!seen.has(h.i)) { matches.push(h); seen.add(h.i); } }
      }
      for (const ph of ex.phones) {
        const hits = clientSearch(ph, 3);
        for (const h of hits) { if (!seen.has(h.i)) { matches.push(h); seen.add(h.i); } }
      }
      setOcrState({ progress: 100, matches, pickedIds: new Set(matches.map(m => m.i)) });
    } catch (e: any) {
      setOcrError('Không đọc được clipboard: ' + (e?.message || String(e)));
    }
  };

  const togglePickMatch = (id: string) => {
    setOcrState(s => {
      if (!s) return s;
      const next = new Set(s.pickedIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...s, pickedIds: next };
    });
  };

  const bulkPin = () => {
    if (!ocrState || !onPin) return;
    for (const m of ocrState.matches) {
      if (!ocrState.pickedIds.has(m.i)) continue;
      const a = itemToAsset(m);
      if (a) onPin(a);
    }
    setOcrState(null);
  };

  // Check index ready every 500ms until loaded
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  // Local drafts (điểm user tạo)
  const localFiltered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return assets.filter(a =>
      a.status === 'Draft' && (
        a.name.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        (a.customerCode && a.customerCode.toLowerCase().includes(q)) ||
        (a.poleNumber && a.poleNumber.toLowerCase().includes(q))
      ),
    ).slice(0, 5);
  }, [assets, query]);

  // CLIENT SEARCH — tức thì, < 50ms
  const clientResults = useMemo(() => {
    void tick;
    if (tab === 'nearby') {
      if (!currentLocation) return [];
      return searchNearby(currentLocation.lat, currentLocation.lng, 25, 'meter');
    }
    if (tab === 'recent') {
      return loadRecent();
    }
    if (!query.trim() || query.length < 2) return [];

    const hits = clientSearch(query, 50);
    let filtered = hits;
    if (tab === 'pe')       filtered = hits.filter(h => h.t === 'meter' && (h.p || '').toUpperCase().includes(query.toUpperCase()));
    else if (tab === 'name')    filtered = hits.filter(h => (h.n || '').length > 0);
    else if (tab === 'address') filtered = hits.filter(h => (h.a || '').length > 0);
    else if (tab === 'phone')   filtered = hits.filter(h => (h.ph || '').replace(/\D/g, '').includes(query.replace(/\D/g, '')));

    // Nếu có currentLocation: sort theo khoảng cách
    if (currentLocation) {
      filtered = [...filtered].sort((a, b) =>
        distSq({ lat: a.ll[0], lng: a.ll[1] }, currentLocation) -
        distSq({ lat: b.ll[0], lng: b.ll[1] }, currentLocation),
      );
    }
    return filtered.slice(0, 25);
  }, [query, tab, currentLocation, tick]);

  const allResults = useMemo(() => {
    const results: GridAsset[] = [...localFiltered];
    const seen = new Set(results.map(a => a.id));
    for (const it of clientResults) {
      if (seen.has(it.i)) continue;
      seen.add(it.i);
      const asset = itemToAsset(it);
      if (asset) results.push(asset);
    }
    return results.slice(0, 25);
  }, [localFiltered, clientResults]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[5000] flex flex-col p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col flex-1 sm:max-h-[80vh] w-full max-w-lg mx-auto sm:mt-12 border border-white/20">
        
        {/* Search Header - Mobile Safe Area Support */}
        <div className="p-4 border-b border-slate-100" style={{ paddingTop: 'calc(var(--safe-top) + 1rem)' }}>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input
                autoFocus
                type="text"
                placeholder={voice.listening ? 'Đang nghe...' : 'Tìm Mã PE, Tên, Địa chỉ, SĐT...'}
                className="w-full bg-slate-100 border-none rounded-2xl py-4 pl-12 pr-24 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={voice.listening ? voice.transcript : query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {/* Mic button inside input */}
              {isVoiceSupported() && (
                <button
                  onClick={() => voice.listening ? voice.stop() : voice.start()}
                  title={voice.listening ? 'Đang nghe, bấm để dừng' : 'Nói để tìm (tiếng Việt)'}
                  className={`absolute right-12 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    voice.listening
                      ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse'
                      : 'bg-white text-slate-500 hover:bg-blue-50 hover:text-blue-600 border border-slate-200'
                  }`}
                >
                  <i className={`fas ${voice.listening ? 'fa-microphone-lines' : 'fa-microphone'} text-xs`}></i>
                </button>
              )}
              {/* Camera OCR — chụp danh sách */}
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Chụp hình danh sách KH để tự tìm"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center bg-white text-slate-500 hover:bg-blue-50 hover:text-blue-600 border border-slate-200"
              >
                <i className="fas fa-camera text-xs"></i>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleOcrFile(f);
                  if (e.target) e.target.value = '';
                }}
              />
            </div>
            <button
              onClick={onClose}
              className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 hover:bg-slate-200"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          {voice.error && (
            <p className="mt-2 text-[10px] font-bold text-red-600 px-1">
              <i className="fas fa-circle-exclamation mr-1"></i> {voice.error}
            </p>
          )}
          {/* Tab bar — Recent + các kiểu tìm */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {([
              { k: 'recent',  label: 'Gần đây', icon: 'fa-clock-rotate-left' },
              { k: 'all',     label: 'Tất cả',  icon: 'fa-layer-group' },
              { k: 'pe',      label: 'Mã PE',   icon: 'fa-hashtag' },
              { k: 'name',    label: 'Tên KH',  icon: 'fa-user' },
              { k: 'address', label: 'Địa chỉ', icon: 'fa-map-pin' },
              { k: 'phone',   label: 'SĐT',     icon: 'fa-phone' },
            ] as { k: Tab; label: string; icon: string }[]).map(t => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${
                  tab === t.k
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <i className={`fas ${t.icon} text-[9px]`}></i> {t.label}
              </button>
            ))}
            {currentLocation && (
              <button
                onClick={() => setTab('nearby')}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ml-auto transition-all ${
                  tab === 'nearby'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                }`}
              >
                <i className="fas fa-location-crosshairs text-[9px]"></i> Gần tôi
              </button>
            )}
          </div>

          {/* Ghim counter */}
          <div className="mt-2 flex items-center justify-between gap-2 px-1">
            <p className="text-[9px] font-bold text-slate-400 leading-tight">
              {tab === 'nearby'
                ? 'Hiển thị KH gần vị trí GPS của bạn'
                : currentLocation
                ? 'Kết quả sắp xếp theo khoảng cách'
                : 'Gõ mã PE / tên / địa chỉ · tìm tức thì, không cần mạng'}
            </p>
            {pinnedIds.length > 0 && (
              <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase shadow-sm border border-amber-200 whitespace-nowrap">
                {pinnedIds.length} ghim
              </span>
            )}
          </div>
        </div>

        {/* Results List - Elegant Typography & Modern Layout */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white/50">
          {allResults.length > 0 ? (
            <div className="space-y-3">
              {allResults.map(asset => {
                const isMeter = asset.type === AssetType.METER || asset.type === AssetType.CUSTOMER;
                return (
                  <div key={asset.id} className="group relative animate-fade-in">
                    <button
                      onClick={() => {
                        const src = clientResults.find(r => r.i === asset.id);
                        if (src) pushRecent(src);
                        onSelect(asset);
                      }}
                      className="w-full text-left bg-white border border-slate-100 p-4 rounded-3xl hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5 transition-all active:scale-[0.98] flex items-center gap-4"
                    >
                      <div className={`w-14 h-14 rounded-2xl ${AssetTypeColors[asset.type] || 'bg-slate-500'} flex items-center justify-center text-white shadow-inner shrink-0 transition-transform group-hover:scale-105`}>
                        <i className={`fas ${AssetTypeIcons[asset.type] || 'fa-question'} text-xl`}></i>
                      </div>
                      
                      <div className="flex-1 min-w-0 pr-24">
                        <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${
                          asset.type === AssetType.POLE_MV ? 'text-violet-600'
                          : asset.type === AssetType.POLE_LV ? 'text-emerald-600'
                          : asset.type === AssetType.SUBSTATION ? 'text-blue-600'
                          : asset.type === AssetType.METER || asset.type === AssetType.CUSTOMER ? 'text-amber-600'
                          : 'text-slate-500'
                        }`}>
                          {AssetTypeLabels[asset.type] || 'Thiết bị'}
                          {isMeter && asset.customerCode ? ` · Mã PE ${asset.customerCode}` : ''}
                          {!isMeter && asset.poleNumber ? ` · Số trụ ${asset.poleNumber}` : ''}
                        </p>
                        <p className="text-base font-black text-slate-900 truncate tracking-tight">{asset.name}</p>
                        {!isMeter && asset.code && asset.code !== asset.poleNumber && (
                          <p className="text-[10px] font-bold text-slate-500 mt-0.5 uppercase tracking-tight truncate">Mã hiệu: {asset.code}</p>
                        )}
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight truncate">{asset.address || 'Hệ thống GIS EVNHCMC'}</p>
                      </div>
                    </button>
                    
                    {/* Quick Pin Action - lớn hơn + nhãn chữ để dễ thấy */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onPin?.(asset); }}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 h-11 px-3 rounded-2xl flex items-center gap-1.5 font-black text-[10px] uppercase tracking-widest transition-all z-10 active:scale-95 ${
                        pinnedIds.includes(asset.id)
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-200'
                        : 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100'
                      }`}
                      title={pinnedIds.includes(asset.id) ? 'Bỏ ghim' : 'Ghim vào lộ trình'}
                    >
                      <i className={`fas fa-thumbtack ${pinnedIds.includes(asset.id) ? 'rotate-45' : ''} text-xs`}></i>
                      <span>{pinnedIds.includes(asset.id) ? 'Đã ghim' : 'Ghim'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : query ? (
            <div className="py-12 text-center text-slate-400">
              <i className="fas fa-search text-4xl mb-3 opacity-20"></i>
              <p className="text-sm font-bold uppercase tracking-widest opacity-40">Không tìm thấy kết quả</p>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">
              <i className="fas fa-keyboard text-4xl mb-3 opacity-20"></i>
              <p className="text-sm font-bold uppercase tracking-widest opacity-40">Nhập thông tin tìm kiếm</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 px-6">
                <span className="text-[9px] bg-slate-100 px-2 py-1 rounded text-slate-500">Mã hiệu trụ</span>
                <span className="text-[9px] bg-slate-100 px-2 py-1 rounded text-slate-500">Tên khách hàng</span>
                <span className="text-[9px] bg-slate-100 px-2 py-1 rounded text-slate-500">Mã PE (Khách hàng)</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer — CTA "Xem lộ trình" khi có ghim, fallback hiện đếm thiết bị */}
        <div className="p-3 bg-slate-50 border-t border-slate-100" style={{ paddingBottom: 'calc(var(--safe-bottom) + 0.5rem)' }}>
          {pinnedIds.length > 0 && onViewPins ? (
            <button
              onClick={() => { onViewPins(); onClose(); }}
              className="w-full bg-blue-600 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <i className="fas fa-route"></i>
              Xem lộ trình {pinnedIds.length} điểm
            </button>
          ) : (
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">
              {assets.length} thiết bị trong hệ thống
            </p>
          )}
        </div>
      </div>

      {/* OCR Review — hiện sau khi chụp ảnh hoặc dán clipboard */}
      {ocrState && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[6000] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Kết quả OCR</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                  {ocrState.progress < 100 ? `Đang đọc ảnh... ${ocrState.progress}%`
                    : ocrState.matches.length > 0 ? `Tìm thấy ${ocrState.matches.length} KH · tick để chọn`
                    : 'Không khớp KH nào'}
                </p>
              </div>
              <button onClick={() => setOcrState(null)} className="w-10 h-10 bg-slate-100 rounded-xl text-slate-500">
                <i className="fas fa-times"></i>
              </button>
            </div>

            {ocrState.progress < 100 && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-3 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-slate-500">Nhận dạng văn bản tiếng Việt...</p>
              </div>
            )}

            {ocrState.progress === 100 && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                  {ocrState.matches.map(m => {
                    const picked = ocrState.pickedIds.has(m.i);
                    return (
                      <button
                        key={m.i}
                        onClick={() => togglePickMatch(m.i)}
                        className={`w-full text-left p-3 rounded-2xl border flex items-center gap-3 transition-all ${
                          picked ? 'bg-blue-50 border-blue-300 shadow-sm' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${picked ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          <i className={`fas ${picked ? 'fa-check' : 'fa-square'} text-[10px]`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black text-blue-600 uppercase tracking-wider">
                            {m.p || m.m || m.i}
                          </p>
                          <p className="text-xs font-bold text-slate-800 truncate">{m.n || '(không tên)'}</p>
                          {m.a && <p className="text-[10px] text-slate-500 truncate">{m.a}</p>}
                        </div>
                      </button>
                    );
                  })}
                  {ocrError && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] font-bold text-amber-800">
                      <i className="fas fa-circle-info mr-1.5"></i> {ocrError}
                    </div>
                  )}
                  {ocrState.matches.length === 0 && !ocrError && (
                    <button
                      onClick={handlePasteClipboard}
                      className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-600 text-left"
                    >
                      <i className="fas fa-clipboard mr-1.5"></i> Không ra kết quả? Bấm đây để dán danh sách từ clipboard.
                    </button>
                  )}
                </div>
                <div className="p-4 border-t border-slate-100 grid grid-cols-2 gap-2" style={{ paddingBottom: 'calc(var(--safe-bottom) + 1rem)' }}>
                  <button
                    onClick={() => setOcrState(null)}
                    className="bg-slate-100 text-slate-600 py-3 rounded-xl font-black text-xs uppercase tracking-wider active:scale-95"
                  >
                    Huỷ
                  </button>
                  <button
                    onClick={bulkPin}
                    disabled={ocrState.pickedIds.size === 0}
                    className="bg-amber-500 text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-300 active:scale-95 disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-thumbtack"></i> Ghim {ocrState.pickedIds.size} điểm
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPopup;
