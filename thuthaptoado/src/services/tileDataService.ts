// tileDataService.ts — Thay thế backend API bằng static tiles + client-side R-tree + MiniSearch.
//
// Flow:
//   1. init() tải manifest.json, so version với localStorage → nếu khác, prompt auto-reload
//   2. loadTilesForBbox() tải tile cần thiết (gzip), cache RAM + IndexedDB qua SW
//   3. search(q) fuzzy match ngay trên RAM, < 50ms
//   4. queryBbox(bbox, layer) dùng R-tree client, < 5ms

import MiniSearch from 'minisearch';
import RBush from 'rbush';

// ─── Types ────────────────────────────────────────────────────────
export interface Manifest {
  version: number;
  generatedAt: string;
  tileStep: number;
  counts: Record<string, number>;
  searchCount: number;
  searchSize: number;
  tiles: Record<string, { counts: Record<string, number>; sizes: Record<string, number> }>;
}

export interface SearchItem {
  i:  string;              // id (GISID / MATHIETBI / KH_ID)
  p?: string;              // mã PE (KH_ID)
  m?: string;              // MATHIETBI (hoặc GISID fallback)
  n?: string;              // tên
  a?: string;              // địa chỉ
  ph?: string;             // số điện thoại
  s?: string;              // SOTRU
  tb?: string;             // TBT_ID
  cd?: string;             // CHIDANH (mã TBDC/trạm ngắn)
  lb?: string;             // _label ("Tram trung the"...)
  t:  string;              // type: meter | pole_mv | pole_lv | substation | switchgear
  ll: [number, number];    // [lat, lng]
}

export type Layer = 'tt' | 'ht' | 'dk';

interface RTreeItem { minX: number; minY: number; maxX: number; maxY: number; feature: any }

// ─── Constants ────────────────────────────────────────────────────
const DATA_BASE = '/data';
const TILE_STEP = 0.05;
const KEY_SCALE = 1000;
const KEY_STRIDE = 50;
const LS_VERSION_KEY = 'powermind_data_version';

// ─── State ────────────────────────────────────────────────────────
let manifest: Manifest | null = null;
let miniSearch: MiniSearch<SearchItem> | null = null;
let allSearchItems: SearchItem[] = []; // giữ nguyên cho nearby scan
const rtrees: Record<string, RBush<RTreeItem>> = {}; // cache key: `${tileKey}:${layer}`
const tileInflight: Record<string, Promise<void>> = {};

// ─── Helpers ──────────────────────────────────────────────────────
function tileKey(lat: number, lng: number): string {
  const la = Math.floor((lat * KEY_SCALE) / KEY_STRIDE) * KEY_STRIDE;
  const lo = Math.floor((lng * KEY_SCALE) / KEY_STRIDE) * KEY_STRIDE;
  return `${la}_${lo}`;
}

export function tilesCoveringBbox(minLat: number, maxLat: number, minLng: number, maxLng: number): string[] {
  const keys: string[] = [];
  const laStart = Math.floor((minLat * KEY_SCALE) / KEY_STRIDE) * KEY_STRIDE;
  const laEnd   = Math.floor((maxLat * KEY_SCALE) / KEY_STRIDE) * KEY_STRIDE;
  const loStart = Math.floor((minLng * KEY_SCALE) / KEY_STRIDE) * KEY_STRIDE;
  const loEnd   = Math.floor((maxLng * KEY_SCALE) / KEY_STRIDE) * KEY_STRIDE;
  for (let la = laStart; la <= laEnd; la += KEY_STRIDE) {
    for (let lo = loStart; lo <= loEnd; lo += KEY_STRIDE) {
      keys.push(`${la}_${lo}`);
    }
  }
  return keys;
}

function featureBbox(geom: any): [number, number, number, number] | null {
  if (!geom?.coordinates) return null;
  let mnLa = Infinity, mnLo = Infinity, mxLa = -Infinity, mxLo = -Infinity;
  const walk = (arr: any) => {
    if (!arr) return;
    if (typeof arr[0] === 'number') {
      const [lng, lat] = arr;
      if (lat < mnLa) mnLa = lat;
      if (lat > mxLa) mxLa = lat;
      if (lng < mnLo) mnLo = lng;
      if (lng > mxLo) mxLo = lng;
    } else {
      for (const a of arr) walk(a);
    }
  };
  walk(geom.coordinates);
  if (!isFinite(mnLa)) return null;
  return [mnLo, mnLa, mxLo, mxLa]; // [minX, minY, maxX, maxY]
}

// ─── Init ─────────────────────────────────────────────────────────
export async function initTileData(opts?: { onUpdateAvailable?: (newVer: number) => void }): Promise<Manifest> {
  // Luôn bypass cache khi fetch manifest để phát hiện update ngay
  const res = await fetch(`${DATA_BASE}/manifest.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);
  manifest = await res.json();

  const localVer = localStorage.getItem(LS_VERSION_KEY);
  if (localVer && manifest && localVer !== String(manifest.version)) {
    // Có bản mới → clear cache tile, báo cho App
    await clearTileCache();
    opts?.onUpdateAvailable?.(manifest.version);
  }
  if (manifest) localStorage.setItem(LS_VERSION_KEY, String(manifest.version));

  return manifest!;
}

async function clearTileCache() {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('tiles-data')).map(k => caches.delete(k)));
  } catch {}
  Object.keys(rtrees).forEach(k => delete rtrees[k]);
  miniSearch = null;
}

/** Fetch gzipped JSON — luôn decompress manual vì CF Pages không set Content-Encoding */
async function fetchGzipJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} fetch failed: ${res.status}`);
  // Kiểm tra content-type để bắt SPA fallback (trả HTML khi file không tồn tại)
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/html')) {
    throw new Error(`${url} returned HTML (file không tồn tại trên server)`);
  }
  const buf = await res.arrayBuffer();
  // Check magic bytes 0x1F 0x8B = gzip
  const u8 = new Uint8Array(buf);
  if (u8.length >= 2 && u8[0] === 0x1f && u8[1] === 0x8b) {
    const stream = new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip')));
    return await stream.json();
  }
  // Không gzip (CF đã tự decompress qua Accept-Encoding) → parse trực tiếp
  return JSON.parse(new TextDecoder().decode(buf));
}

// ─── Search index ─────────────────────────────────────────────────
export async function loadSearchIndex(): Promise<void> {
  if (miniSearch) return;
  const data = await fetchGzipJson<{ items: SearchItem[] }>(`${DATA_BASE}/search.json.gz`);

  miniSearch = new MiniSearch<SearchItem>({
    fields: ['p', 'm', 'n', 'a', 'ph', 's', 'tb', 'cd', 'lb'],
    storeFields: ['i', 'p', 'm', 'n', 'a', 'ph', 's', 'tb', 'cd', 'lb', 't', 'll'],
    idField: 'i',
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { p: 3, ph: 3, m: 2, n: 2, cd: 2, a: 1.5, s: 2, lb: 1 },
      combineWith: 'AND',
    },
    extractField: (doc: any, field: string) => (doc[field] ?? '').toString(),
    tokenize: (s: string) => s.split(/[\s/\\|.,;\-_]+/).filter(Boolean),
  });

  // Dedupe theo id (có item không có id)
  const seen = new Set<string>();
  const toAdd: SearchItem[] = [];
  for (const it of data.items) {
    const id = it.i || `${it.t}_${it.ll?.[0]}_${it.ll?.[1]}_${toAdd.length}`;
    if (seen.has(id)) continue;
    seen.add(id);
    toAdd.push({ ...it, i: id });
  }
  miniSearch.addAll(toAdd);
  allSearchItems = toAdd;
  console.log(`[tileData] Search index: ${toAdd.length.toLocaleString()} items`);
}

/** Tìm N khách hàng gần vị trí GPS nhất (quét linear ~295k items ~50ms). */
export function searchNearby(lat: number, lng: number, limit = 25, type?: string): SearchItem[] {
  if (!allSearchItems.length) return [];
  // Nhanh: bbox 500m ~ 0.0045° filter trước, rồi sort
  const box = 0.01; // ~1.1km, đủ để có ≥ limit kết quả ở đa số khu
  const candidates: { item: SearchItem; d: number }[] = [];
  for (const it of allSearchItems) {
    if (type && it.t !== type) continue;
    const dLat = it.ll[0] - lat;
    const dLng = it.ll[1] - lng;
    if (Math.abs(dLat) > box || Math.abs(dLng) > box) continue;
    candidates.push({ item: it, d: dLat * dLat + dLng * dLng });
  }
  candidates.sort((a, b) => a.d - b.d);
  return candidates.slice(0, limit).map(c => c.item);
}

export function search(query: string, limit = 25): SearchItem[] {
  if (!miniSearch || !query.trim()) return [];
  const results = miniSearch.search(query, { prefix: true, fuzzy: 0.2 });
  return results.slice(0, limit) as unknown as SearchItem[];
}

// ─── Tile loader ──────────────────────────────────────────────────
export async function loadTile(key: string, layer: Layer): Promise<void> {
  const cacheKey = `${key}:${layer}`;
  if (rtrees[cacheKey]) return;
  if (tileInflight[cacheKey]) return tileInflight[cacheKey];
  if (!manifest?.tiles[key]?.sizes?.[layer]) return; // tile không có layer đó

  const p = (async () => {
    const url = `${DATA_BASE}/tiles/${key}/${layer}.geojson.gz`;
    const data = await fetchGzipJson<{ features: any[] }>(url);
    const tree = new RBush<RTreeItem>();
    const items: RTreeItem[] = [];
    for (const f of data.features || []) {
      const bb = featureBbox(f.geometry);
      if (!bb) continue;
      items.push({ minX: bb[0], minY: bb[1], maxX: bb[2], maxY: bb[3], feature: f });
    }
    tree.load(items);
    rtrees[cacheKey] = tree;
  })();

  tileInflight[cacheKey] = p;
  try { await p; } finally { delete tileInflight[cacheKey]; }
}

export async function loadTilesForBbox(
  minLat: number, maxLat: number, minLng: number, maxLng: number, layers: Layer[] = ['tt', 'dk'],
): Promise<void> {
  const keys = tilesCoveringBbox(minLat, maxLat, minLng, maxLng);
  await Promise.all(keys.flatMap(k => layers.map(l => loadTile(k, l))));
}

export function queryBbox(
  minLat: number, maxLat: number, minLng: number, maxLng: number,
  layers: Layer[] = ['tt', 'dk'], limit = 500,
): any[] {
  const keys = tilesCoveringBbox(minLat, maxLat, minLng, maxLng);
  const out: any[] = [];
  for (const k of keys) {
    for (const l of layers) {
      const tree = rtrees[`${k}:${l}`];
      if (!tree) continue;
      const hits = tree.search({ minX: minLng, minY: minLat, maxX: maxLng, maxY: maxLat });
      for (const h of hits) {
        out.push(h.feature);
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

export function getManifest(): Manifest | null {
  return manifest;
}
