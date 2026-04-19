require("dotenv").config();
const express     = require("express");
const cors        = require("cors");
const compression = require("compression");
const RBush       = require("rbush").default || require("rbush");
const fs          = require("fs");
const path        = require("path");

const app  = express();
const PORT = process.env.PORT || 3001;
const OUTPUT_DIR    = path.resolve(__dirname, "../automation/output");
const GEOJSON_PATH  = path.join(OUTPUT_DIR, "luoi-dien.geojson");
const GEOJSON_HT    = path.join(OUTPUT_DIR, "luoi-dien-hathe.geojson");
const GEOJSON_DIEM  = path.join(OUTPUT_DIR, "luoi-dien-diem.geojson");
const CUSTOMERS_CSV = path.resolve(__dirname, "customers.csv");
const STATIC_DIR    = path.resolve(__dirname, "../../../thuthaptoado/dist");

app.use(compression({ threshold: 1024 })); // gzip mọi response > 1KB
app.use(cors());
app.use(express.json());
// Serve frontend build — mở http://localhost:3001/app/ để dùng
console.log(`📁 STATIC_DIR = ${STATIC_DIR} (${fs.existsSync(STATIC_DIR) ? "EXISTS" : "MISSING"})`);
if (fs.existsSync(STATIC_DIR)) {
  app.use("/app", express.static(STATIC_DIR, { maxAge: "1h", index: "index.html" }));
  app.get("/app", (req, res) => res.redirect("/app/"));
}

// ─── GeoJSON cache + spatial index (R-tree) ──────────────
const cache  = {};
const rtrees = {}; // filePath -> RBush<{minX,minY,maxX,maxY,feature}>

function buildRtree(filePath, data) {
  const tree = new RBush();
  const items = [];
  for (const f of data.features) {
    const g = f.geometry;
    if (!g) continue;
    const pts = flattenCoords(g);
    if (!pts.length) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [lon, lat] of pts) {
      if (lon < minX) minX = lon;
      if (lat < minY) minY = lat;
      if (lon > maxX) maxX = lon;
      if (lat > maxY) maxY = lat;
    }
    items.push({ minX, minY, maxX, maxY, feature: f });
  }
  tree.load(items);
  rtrees[filePath] = tree;
  console.log(`  🌳 R-tree: ${items.length.toLocaleString()} bbox`);
}

function loadFile(filePath) {
  if (cache[filePath]) return cache[filePath];
  if (!fs.existsSync(filePath)) return null;
  try {
    console.log(`Loading ${path.basename(filePath)}...`);
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    cache[filePath] = data;
    console.log(`  -> ${data.features.length.toLocaleString()} features`);
    buildRtree(filePath, data);
    return data;
  } catch (err) {
    console.error(`Loi doc ${path.basename(filePath)}:`, err.message);
    return null;
  }
}

function loadGeoJSON()  { return loadFile(GEOJSON_PATH); }
function loadHaThe()    { return loadFile(GEOJSON_HT);   }
function loadDiem()     { return loadFile(GEOJSON_DIEM); }

// ─── GeoJSON feature search index ─────────────────────────
let featureSearchIndex = null; // [{label, haystack, type, lat, lon, props}]
let featureByTbtid    = null;  // TBT_ID -> first feature with coords (for customer enrichment)

function buildFeatureIndex() {
  if (featureSearchIndex) return;
  featureSearchIndex = [];
  featureByTbtid    = {};

  const pushFeature = (f) => {
    const p = f.properties || {};
    const g = f.geometry;
    if (!g) return;
    // Lấy toạ độ đại diện (Point, hoặc điểm đầu của Line/Polygon)
    let lat = null, lon = null;
    if (g.type === "Point") {
      [lon, lat] = g.coordinates;
    } else if (g.type === "LineString" && g.coordinates.length) {
      [lon, lat] = g.coordinates[0];
    } else if (g.type === "MultiLineString" && g.coordinates[0]?.length) {
      [lon, lat] = g.coordinates[0][0];
    } else if (g.type === "Polygon" && g.coordinates[0]?.length) {
      [lon, lat] = g.coordinates[0][0];
    } else {
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const label = p.TEN || p.CHIDANH || p.MATHIETBI || p.GISID || p.SOTRU || p.KH_ID || "";
    // Gộp toàn bộ mã định danh để search không phân biệt field
    const haystack = [
      p.TEN, p.CHIDANH, p.MATHIETBI, p.GISID, p.SOTRU,
      p.KH_ID, p.MA_KHANG, p.MA_KH, p.TBT_ID, p.MADD, p.MATRAM,
    ].filter(Boolean).join(" ").toLowerCase();
    if (!haystack) return;

    featureSearchIndex.push({
      label: label || p.KH_ID || p.SOTRU || p.GISID || "(không tên)",
      haystack,
      type:  p._type,
      layer: p._layer,
      lat, lon,
      props: p,
    });

    if (p.TBT_ID && !featureByTbtid[p.TBT_ID]) {
      featureByTbtid[p.TBT_ID] = { lat, lon, props: p };
    }
  };

  const diem = loadDiem();
  if (diem) diem.features.forEach(pushFeature);
  // Index cả TBA/đường TT (cần để tra TBT_ID của KH)
  const tt = loadGeoJSON();
  if (tt) tt.features.forEach(pushFeature);

  console.log(`Feature search index: ${featureSearchIndex.length} items, ${Object.keys(featureByTbtid).length} TBT_ID`);
}

// ─── Customer CSV loader ───────────────────────────────────
let customerByMaKhang = null;
let customerByTbtid   = null;

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || "").trim()]));
  });
}

function loadCustomers() {
  if (customerByMaKhang) return;
  if (!fs.existsSync(CUSTOMERS_CSV)) {
    customerByMaKhang = {};
    customerByTbtid   = {};
    return;
  }
  const rows = parseCSV(fs.readFileSync(CUSTOMERS_CSV, "utf-8"));
  customerByMaKhang = {};
  customerByTbtid   = {};
  for (const row of rows) {
    if (row.KH_ID)  customerByMaKhang[row.KH_ID]  = row;
    if (row.TBT_ID) {
      if (!customerByTbtid[row.TBT_ID]) customerByTbtid[row.TBT_ID] = [];
      customerByTbtid[row.TBT_ID].push(row);
    }
  }
  console.log(`Da load ${rows.length} khach hang tu customers.csv`);
}

function reloadCustomers() {
  customerByMaKhang = null;
  customerByTbtid   = null;
  loadCustomers();
}

// ─── ROUTES ───────────────────────────────────────────────

// Health check
app.get("/api/health", (req, res) => {
  const data = loadGeoJSON();
  const diem = cache[GEOJSON_DIEM];
  const ht   = cache[GEOJSON_HT];
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    dataFile: data ? "ready" : "not_found",
    featureCount: data ? data.features.length : 0,
    diemCount:    diem ? diem.features.length : 0,
    htCount:      ht   ? ht.features.length   : 0,
    searchIndex:  featureSearchIndex ? featureSearchIndex.length : 0,
    tbtidIndexed: featureByTbtid     ? Object.keys(featureByTbtid).length : 0,
    lastReloadAt, isRebuilding,
    dataPath: GEOJSON_PATH,
  });
});

// Helper chung: truy vấn bbox qua R-tree → O(log n)
function bboxQuery(filePath, req, defaultLimit, maxLimit) {
  const data = loadFile(filePath);
  if (!data) return null;
  const { minLat, maxLat, minLon, maxLon, limit, layer } = req.query;
  const cap = Math.min(parseInt(limit || String(defaultLimit), 10), maxLimit);

  if (!(minLat && maxLon)) {
    let features = data.features;
    if (layer) features = features.filter(f => f.properties._layer === layer);
    return { type: "FeatureCollection", features: features.slice(0, cap) };
  }
  const mnLat = parseFloat(minLat), mxLat = parseFloat(maxLat);
  const mnLon = parseFloat(minLon), mxLon = parseFloat(maxLon);
  const tree  = rtrees[filePath];
  const hits  = tree
    ? tree.search({ minX: mnLon, minY: mnLat, maxX: mxLon, maxY: mxLat })
    : data.features.map(feature => ({ feature }));
  const out = [];
  for (const h of hits) {
    if (out.length >= cap) break;
    const f = h.feature;
    if (layer && f.properties._layer !== layer) continue;
    out.push(f);
  }
  return { type: "FeatureCollection", features: out };
}

// Duong day trung the + TBA
app.get("/api/grid", (req, res) => {
  const out = bboxQuery(GEOJSON_PATH, req, 68434, 70000);
  if (!out) return res.status(404).json({ error: "Chua co du lieu. Chay auto-deploy.py" });
  res.json(out);
});

// ─── Automating Reload on File Change ──────────────────────
// Windows fs.watch thường bắn nhiều event liên tiếp khi copy/ghi đè file lớn.
// Dùng debounce + quiet-window: chờ 3s không còn event mới rồi mới rebuild một lần.
let reloadTimer   = null;
let isRebuilding  = false;
let pendingRebuild = false;
let lastReloadAt  = null;

function scheduleReload(reason) {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    reloadTimer = null;
    if (isRebuilding) { pendingRebuild = true; return; }
    isRebuilding = true;
    try {
      console.log(`\n🔄 Rebuild cache (${reason})...`);
      Object.keys(cache).forEach(key => delete cache[key]);
      Object.keys(rtrees).forEach(key => delete rtrees[key]);
      featureSearchIndex = null;
      featureByTbtid    = null;
      // Pre-load để log số lượng và sẵn sàng cho request đầu tiên
      loadGeoJSON();
      loadDiem();
      loadHaThe();
      buildFeatureIndex();
      lastReloadAt = new Date().toISOString();
      console.log(`✅ Cache đã sẵn sàng lúc ${lastReloadAt}`);
    } catch (err) {
      console.error(`❌ Rebuild lỗi:`, err.message);
    } finally {
      isRebuilding = false;
      if (pendingRebuild) {
        pendingRebuild = false;
        scheduleReload("pending");
      }
    }
  }, 3000);
}

function startWatcher() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.warn(`⚠️  OUTPUT_DIR chưa tồn tại: ${OUTPUT_DIR}. Sẽ thử lại sau 10s.`);
    setTimeout(startWatcher, 10000);
    return;
  }
  try {
    fs.watch(OUTPUT_DIR, (eventType, filename) => {
      if (!filename || !filename.endsWith(".geojson")) return;
      console.log(`🔔 ${eventType}: ${filename}`);
      scheduleReload(filename);
    });
    console.log(`👀 Watching ${OUTPUT_DIR}`);
  } catch (err) {
    console.error(`❌ Không thể watch ${OUTPUT_DIR}:`, err.message);
  }
}
startWatcher();

// Duong day ha the (127MB - chi goi khi zoom cao)
app.get("/api/grid/hathe", (req, res) => {
  const out = bboxQuery(GEOJSON_HT, req, 10000, 15000);
  if (!out) return res.status(404).json({ error: "Chua co file hathe" });
  res.json(out);
});

// Diem: dien ke, tru, TBA
app.get("/api/grid/diem", (req, res) => {
  const out = bboxQuery(GEOJSON_DIEM, req, 5000, 8000);
  if (!out) return res.status(404).json({ error: "Chua co file diem" });
  res.json(out);
});

// Summary: danh sach tuyen MADD, TBT_ID
app.get("/api/grid/summary", (req, res) => {
  const data = loadGeoJSON();
  if (!data) return res.status(404).json({ error: "Chua co du lieu" });

  const maddSet = new Set();
  const tbtSet  = new Set();
  let htCount = 0, ttCount = 0, diemCount = 0;

  for (const f of data.features) {
    const p = f.properties || {};
    if (p.MADD)   maddSet.add(p.MADD);
    if (p.TBT_ID) tbtSet.add(p.TBT_ID);
    if (p._type === "line_tt")  ttCount++;
    if (p._type === "line_ht")  htCount++;
    if (p._type?.startsWith("point")) diemCount++;
  }

  // Dem them tu file HT
  const ht = loadHaThe();
  if (ht) {
    for (const f of ht.features) {
      const p = f.properties || {};
      if (p.TBT_ID) tbtSet.add(p.TBT_ID);
    }
    htCount = ht.features.length;
  }

  res.json({
    totalTT:        ttCount,
    totalHT:        htCount,
    totalDiem:      diemCount,
    maddList:       [...maddSet].sort(),
    tbtidList:      [...tbtSet].sort(),
    generatedAt:    data.metadata?.generated_at || null,
  });
});

// ─── CUSTOMER ROUTES ──────────────────────────────────────

// Tra cứu theo MA_KHANG
app.get("/api/customer/:ma_khang", (req, res) => {
  loadCustomers();
  const kh = customerByMaKhang[req.params.ma_khang];
  if (!kh) return res.status(404).json({ error: "Khong tim thay khach hang" });
  res.json(kh);
});

// Danh sách KH theo TBTID
app.get("/api/customers/tbt/:tbtid", (req, res) => {
  loadCustomers();
  const list = customerByTbtid[req.params.tbtid] || [];
  res.json({ tbtid: req.params.tbtid, total: list.length, customers: list });
});

// Tim kiem tong hop: KH + thiet bi + TBDC
app.get("/api/customers/search", (req, res) => {
  loadCustomers();
  buildFeatureIndex();
  const q = (req.query.q || "").toLowerCase().trim();
  if (!q) return res.json({ results: [] });

  // Tim trong khach hang (enrich coords qua TBT_ID)
  const khResults = Object.values(customerByMaKhang)
    .filter((kh) =>
      (kh.TEN_KH    || "").toLowerCase().includes(q) ||
      (kh.DIA_CHI   || "").toLowerCase().includes(q) ||
      (kh.KH_ID     || "").toLowerCase().includes(q) ||
      (kh.SO_HOP_DONG || "").toLowerCase().includes(q) ||
      (kh.TBT_ID    || "").toLowerCase().includes(q)
    )
    .slice(0, 20)
    .map((kh) => {
      const anchor = kh.TBT_ID && featureByTbtid ? featureByTbtid[kh.TBT_ID] : null;
      return {
        ...kh,
        _searchType: "customer",
        _lat: anchor ? anchor.lat : null,
        _lon: anchor ? anchor.lon : null,
      };
    });

  // Tim trong thiet bi (Trụ, TBA, điện kế GIS, TBDC) — quét toàn bộ haystack, không chỉ label
  const devResults = (featureSearchIndex || [])
    .filter((f) => f.haystack.includes(q))
    .slice(0, 20)
    .map((f) => ({
      _searchType: "device",
      _label: f.label,
      _type:  f.type,
      _layer: f.layer,
      _lat:   f.lat,
      _lon:   f.lon,
      ...f.props,
    }));

  res.json({ results: [...khResults, ...devResults] });
});

// Tất cả KH (phân trang)
app.get("/api/customers", (req, res) => {
  loadCustomers();
  const page  = Math.max(1, parseInt(req.query.page  || "1"));
  const limit = Math.min(100, parseInt(req.query.limit || "20"));
  const all   = Object.values(customerByMaKhang);
  const total = all.length;
  const items = all.slice((page - 1) * limit, page * limit);
  res.json({ total, page, limit, customers: items });
});

// Upload / thay thế customers.csv
app.post("/api/customers/reload", (req, res) => {
  reloadCustomers();
  loadCustomers();
  res.json({ success: true, total: Object.keys(customerByMaKhang).length });
});

// Reload cache (manual)
app.post("/api/reload", (req, res) => {
  Object.keys(cache).forEach((k) => delete cache[k]);
  Object.keys(rtrees).forEach((k) => delete rtrees[k]);
  featureSearchIndex = null;
  featureByTbtid    = null;
  reloadCustomers();
  const data = loadGeoJSON();
  loadDiem();
  loadHaThe();
  buildFeatureIndex();
  lastReloadAt = new Date().toISOString();
  res.json({
    success: !!data,
    featureCount: data ? data.features.length : 0,
    searchIndex:  featureSearchIndex ? featureSearchIndex.length : 0,
    lastReloadAt,
  });
});

// ─── HELPERS ──────────────────────────────────────────────
function flattenCoords(geometry) {
  if (!geometry) return [];
  const { type, coordinates } = geometry;
  if (type === "Point") return [coordinates];
  if (type === "LineString") return coordinates;
  if (type === "MultiLineString") return coordinates.flat();
  if (type === "Polygon") return coordinates.flat();
  if (type === "MultiPolygon") return coordinates.flat(2);
  return [];
}

// ─── START ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(
    `\n╔════════════════════════════════════════╗`
  );
  console.log(`║  🚀 Server running on port ${PORT}        ║`);
  console.log(`║  📍 http://localhost:${PORT}              ║`);
  console.log(`║  🗺️  API: /api/grid                     ║`);
  console.log(`╚════════════════════════════════════════╝\n`);

  // Pre-load file nho truoc (TT), file lon (HT, Diem) load khi co request
  const data = loadGeoJSON();
  if (data) console.log(`TT+TBA: ${data.features.length.toLocaleString()} features`);
  else console.log(`Chua co du lieu. Chay: cd automation && python auto-deploy.py`);
  loadCustomers();
  // Build index sau 3 giay (cho file diem load xong)
  setTimeout(buildFeatureIndex, 3000);
});
