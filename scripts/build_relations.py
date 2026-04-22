"""
build_relations.py — Xây dựng các bảng quan hệ giữa các lớp GIS lưới điện.

Đọc 3 file GeoJSON gốc, tạo 4 bảng JOIN và ghi ra public/data/relations.json.gz
để frontend tra cứu O(1) (không cần backend).

Output bảng:
  station_to_meters : { TBT_ID: [meter_id, ...] }          (join qua TBT_ID)
  meter_to_pole     : { meter_id: pole_id }                (spatial join ≤ 25m)
  pole_to_meters    : { pole_id: [meter_id, ...] }         (inverse của meter_to_pole)
  pole_graph        : { pole_id: [neighbor_pole_id, ...] } (từ START_ID/END_ID của line)

Chạy:  python scripts/build_relations.py
"""
from __future__ import annotations

import gzip
import io
import json
import math
import sys
import time
from collections import defaultdict
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "Dulieugismoi" / "luoi-dien-app" / "automation" / "output"
OUT_DIR = ROOT / "thuthaptoado" / "public" / "data"

SRC_TT = SOURCE_DIR / "luoi-dien.geojson"
SRC_HT = SOURCE_DIR / "luoi-dien-hathe.geojson"
SRC_DK = SOURCE_DIR / "luoi-dien-diem.geojson"

# Spatial join settings
GRID_CELL_DEG = 0.00025          # ~27 m ở xích đạo
POLE_SNAP_METERS = 25.0          # Điện kế thuộc trụ hạ thế gần nhất trong 25m
LINE_ENDPOINT_SNAP_METERS = 10.0 # Endpoint dây nối với trụ gần nhất trong 10m


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Khoảng cách địa cầu giữa 2 điểm (mét)."""
    R = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def cell_key(lat: float, lng: float) -> tuple[int, int]:
    return int(lat / GRID_CELL_DEG), int(lng / GRID_CELL_DEG)


def load_geojson(p: Path):
    if not p.exists():
        print(f"  ⚠️  bỏ qua (không tồn tại): {p.name}")
        return None
    print(f"  📥 {p.name}  ({p.stat().st_size / 1_048_576:.1f} MB)")
    t0 = time.time()
    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"     -> {len(data.get('features', [])):,} features in {time.time()-t0:.1f}s")
    return data


def write_gz_json(path: Path, obj) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=6, mtime=0) as gz:
        gz.write(json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    data = buf.getvalue()
    path.write_bytes(data)
    return len(data)


def classify_point(props: dict) -> str:
    """Cùng logic với build_tiles.py — phân loại 1 điểm."""
    mtb = str(props.get("MATHIETBI", "") or "").upper()
    gid = str(props.get("GISID", "") or "").upper()
    kh = str(props.get("KH_ID", props.get("MA_KHANG", props.get("MA_KH", ""))) or "").upper().strip()
    diach = str(props.get("DIACHI", props.get("DIA_CHI", "")) or "").upper().strip()
    loai = str(props.get("LOAITHIETBI", "") or "").upper()
    layer = str(props.get("_layer", "") or "").upper()
    tp = props.get("_type", "")

    if (mtb.startswith("PES") or gid.startswith("PES") or kh.startswith("PE")
            or diach.startswith("PE0") or tp == "point_dk" or "DIENKE" in layer):
        return "meter"
    if (tp in ("point_tram_tt", "point_tram_ht") or "TRAM" in loai or "TRAM_" in layer
            or layer.endswith("TRAM") or mtb.startswith("TBA") or gid.startswith("TBA")):
        return "substation"
    if tp == "point_tbdc" or "TBDC" in layer or "TBDC" in mtb:
        return "switchgear"
    if tp == "point_tba" or "TBTTDL" in layer:
        return "meter"
    if (gid.startswith("F08") or mtb.startswith("F08") or tp == "point_tru_tt"
            or "F08_" in layer or "_TT_" in layer):
        return "pole_mv"
    if (gid.startswith("F07") or mtb.startswith("F07") or tp == "point_tru_ht"
            or "F07_" in layer or "_HT_" in layer):
        return "pole_lv"
    return "unknown"


def pick_id(props: dict, fallback_coords: tuple[float, float] | None = None) -> str:
    """Chọn ID ổn định cho 1 feature. Giống quy ước của frontend."""
    gid = props.get("GISID") or ""
    if gid:
        return str(gid)
    mtb = props.get("MATHIETBI") or ""
    if mtb:
        return str(mtb)
    kh = props.get("KH_ID") or props.get("MA_KHANG") or ""
    if kh:
        return str(kh)
    if fallback_coords:
        return f"pt-{fallback_coords[0]:.5f}-{fallback_coords[1]:.5f}"
    return ""


def main():
    t_start = time.time()
    print(f"▶️  build_relations.py\n   Source: {SOURCE_DIR}\n   Output: {OUT_DIR}\n")

    # ─── 1. Đọc điểm (điện kế + trụ) ──────────────────────────────
    print("📥 Đọc điểm (điện kế + trụ)")
    dk = load_geojson(SRC_DK)
    meters: list[dict] = []
    poles_lv: list[dict] = []   # trụ hạ thế (để snap điện kế)
    all_poles: dict[str, tuple[float, float]] = {}  # tất cả trụ (LV + MV) cho pole_graph
    substations: dict[str, dict] = {}  # TBT_ID → info

    if dk:
        for f in dk["features"]:
            g = f.get("geometry", {})
            if g.get("type") != "Point":
                continue
            c = g.get("coordinates") or []
            if len(c) < 2:
                continue
            lng, lat = float(c[0]), float(c[1])
            props = f.get("properties", {}) or {}
            cls = classify_point(props)
            fid = pick_id(props, (lat, lng))
            if not fid:
                continue

            if cls == "meter":
                tbt = str(props.get("TBT_ID", "") or "").strip()
                kh = str(props.get("KH_ID", props.get("MA_KHANG", "")) or "").strip()
                meters.append({
                    "id": fid,
                    "lat": lat, "lng": lng,
                    "tbt": tbt,
                    "kh": kh,
                })
            elif cls == "pole_lv":
                poles_lv.append({"id": fid, "lat": lat, "lng": lng})
                all_poles[fid] = (lat, lng)
            elif cls == "pole_mv":
                all_poles[fid] = (lat, lng)
            elif cls == "substation":
                tbt = str(props.get("TBT_ID", "") or fid).strip()
                substations[tbt] = {"id": fid, "lat": lat, "lng": lng}
    print(f"   Tổng: {len(meters):,} điện kế · {len(poles_lv):,} trụ HT · "
          f"{len(all_poles):,} tất cả trụ · {len(substations):,} TBA")

    # ─── 2. station_to_meters (join qua TBT_ID) ───────────────────
    print("\n🔗 station_to_meters (join qua TBT_ID)")
    station_to_meters: dict[str, list[str]] = defaultdict(list)
    for m in meters:
        if m["tbt"]:
            station_to_meters[m["tbt"]].append(m["id"])
    print(f"   {len(station_to_meters):,} TBA có khách · "
          f"trung bình {sum(len(v) for v in station_to_meters.values()) / max(1, len(station_to_meters)):.1f} KH/TBA")

    # ─── 3. meter_to_pole (spatial join ≤ 25m) ────────────────────
    print(f"\n🔗 meter_to_pole (spatial ≤ {POLE_SNAP_METERS:.0f}m)")
    pole_grid: dict[tuple[int, int], list[dict]] = defaultdict(list)
    for p in poles_lv:
        pole_grid[cell_key(p["lat"], p["lng"])].append(p)

    meter_to_pole: dict[str, str] = {}
    pole_to_meters: dict[str, list[str]] = defaultdict(list)
    matched = 0
    for m in meters:
        ci, cj = cell_key(m["lat"], m["lng"])
        best_id, best_d = None, POLE_SNAP_METERS
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                for p in pole_grid.get((ci + di, cj + dj), ()):
                    d = haversine(m["lat"], m["lng"], p["lat"], p["lng"])
                    if d < best_d:
                        best_d = d
                        best_id = p["id"]
        if best_id:
            meter_to_pole[m["id"]] = best_id
            pole_to_meters[best_id].append(m["id"])
            matched += 1
    print(f"   {matched:,}/{len(meters):,} điện kế đã match trụ HT gần nhất "
          f"({matched * 100 / max(1, len(meters)):.1f}%)")

    # ─── 4. pole_graph (spatial — endpoint line snap vào trụ ≤ 10m) ──
    # GIS export không giữ topology (không có START_ID/END_ID),
    # nên ta tự rebuild bằng cách map endpoint line → trụ gần nhất.
    print(f"\n🔗 pole_graph (spatial endpoint ≤ {LINE_ENDPOINT_SNAP_METERS:.0f}m)")

    all_pole_grid: dict[tuple[int, int], list[tuple[str, float, float]]] = defaultdict(list)
    for pid, (plat, plng) in all_poles.items():
        all_pole_grid[cell_key(plat, plng)].append((pid, plat, plng))

    def snap_to_pole(lat: float, lng: float) -> str | None:
        ci, cj = cell_key(lat, lng)
        best_id, best_d = None, LINE_ENDPOINT_SNAP_METERS
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                for pid, plat, plng in all_pole_grid.get((ci + di, cj + dj), ()):
                    d = haversine(lat, lng, plat, plng)
                    if d < best_d:
                        best_d = d
                        best_id = pid
        return best_id

    pole_neighbors: dict[str, set[str]] = defaultdict(set)

    def walk_segments(coords):
        """Duyệt segments của LineString / MultiLineString — yield (start, end) WGS84."""
        if not coords:
            return
        if isinstance(coords[0][0], (int, float)):      # LineString
            yield coords[0], coords[-1]
        else:                                             # MultiLineString
            for seg in coords:
                if seg and isinstance(seg[0][0], (int, float)):
                    yield seg[0], seg[-1]

    def add_lines_from(src: Path) -> int:
        d = load_geojson(src)
        if not d:
            return 0
        cnt = 0
        for f in d["features"]:
            g = f.get("geometry") or {}
            t = g.get("type") or ""
            if "Line" not in t:
                continue
            for start, end in walk_segments(g.get("coordinates") or []):
                a = snap_to_pole(start[1], start[0])  # coords = [lng, lat]
                b = snap_to_pole(end[1], end[0])
                if a and b and a != b:
                    pole_neighbors[a].add(b)
                    pole_neighbors[b].add(a)
                    cnt += 1
        return cnt

    ln_tt = add_lines_from(SRC_TT)
    ln_ht = add_lines_from(SRC_HT)
    pole_graph = {k: sorted(v) for k, v in pole_neighbors.items()}
    print(f"   {ln_tt:,} cạnh TT · {ln_ht:,} cạnh HT · "
          f"{len(pole_graph):,} trụ có kết nối")

    # ─── 5. Ghi ra đĩa ────────────────────────────────────────────
    print("\n💾 Ghi relations.json.gz")
    out = {
        "version": int(time.time()),
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "stats": {
            "meters": len(meters),
            "poles_lv": len(poles_lv),
            "poles_total": len(all_poles),
            "substations": len(substations),
            "station_to_meters_count": len(station_to_meters),
            "meter_to_pole_matched": matched,
            "pole_graph_nodes": len(pole_graph),
        },
        "station_to_meters": {k: sorted(v) for k, v in station_to_meters.items()},
        "meter_to_pole": meter_to_pole,
        "pole_to_meters": {k: sorted(v) for k, v in pole_to_meters.items()},
        "pole_graph": pole_graph,
    }
    size = write_gz_json(OUT_DIR / "relations.json.gz", out)
    print(f"   relations.json.gz · {size / 1_048_576:.2f} MB gzipped")

    # Cập nhật manifest.json để frontend biết có file relations
    manifest_path = OUT_DIR / "manifest.json"
    if manifest_path.exists():
        try:
            m = json.loads(manifest_path.read_text(encoding="utf-8"))
            m["relations"] = {
                "version": out["version"],
                "size": size,
                "stats": out["stats"],
            }
            manifest_path.write_text(
                json.dumps(m, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print("   manifest.json đã có mục 'relations'")
        except Exception as e:
            print(f"   ⚠️  Không update được manifest.json: {e}")

    print(f"\n✅ Xong trong {time.time() - t_start:.1f}s")


if __name__ == "__main__":
    main()
