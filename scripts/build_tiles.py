"""
build_tiles.py — Chia GeoJSON lưới điện thành spatial tile + search index
cho frontend static PWA (serve qua Cloudflare Pages + R2).

Input:  Dulieugismoi/luoi-dien-app/automation/output/*.geojson
Output: thuthaptoado/public/data/
        ├── manifest.json         (version + danh sách tile + counts)
        ├── search.json.gz        (search index: KH + TBA + trụ tiêu biểu)
        └── tiles/{lat}_{lng}/
            ├── tt.geojson.gz     (trung thế + TBA ~ lớp "luoi-dien.geojson")
            ├── ht.geojson.gz     (hạ thế)
            └── dk.geojson.gz     (điểm: điện kế / trụ)

Tile grid: 0.05° ≈ 5.5 km. Key = floor(lat*1000/50)*50, floor(lng*1000/50)*50.
"""

from __future__ import annotations

import gzip
import io
import json
import os
import sys
import time
from collections import defaultdict
from pathlib import Path

# Unicode-safe stdout trên Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]

ROOT       = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "Dulieugismoi" / "luoi-dien-app" / "automation" / "output"
OUT_DIR    = ROOT / "thuthaptoado" / "public" / "data"

SRC_TT = SOURCE_DIR / "luoi-dien.geojson"          # Trung thế + TBA
SRC_HT = SOURCE_DIR / "luoi-dien-hathe.geojson"    # Hạ thế
SRC_DK = SOURCE_DIR / "luoi-dien-diem.geojson"     # Điểm (điện kế / trụ)

TILE_STEP  = 0.05           # 0.05° ≈ 5.5 km
KEY_SCALE  = 1000
KEY_STRIDE = int(TILE_STEP * KEY_SCALE)   # 50


def tile_key(lat: float, lng: float) -> str:
    la = int(lat * KEY_SCALE) // KEY_STRIDE * KEY_STRIDE
    lo = int(lng * KEY_SCALE) // KEY_STRIDE * KEY_STRIDE
    return f"{la}_{lo}"


def feature_bbox(geom):
    """Trả về (minLat, maxLat, minLng, maxLng) cho 1 geometry."""
    if not geom:
        return None
    t = geom.get("type")
    c = geom.get("coordinates")
    if not c:
        return None
    if t == "Point":
        lng, lat = c[0], c[1]
        return (lat, lat, lng, lng)
    mnLa = mnLo =  1e9
    mxLa = mxLo = -1e9

    def walk(arr):
        nonlocal mnLa, mnLo, mxLa, mxLo
        if not arr:
            return
        if isinstance(arr[0], (int, float)):
            lng, lat = arr[0], arr[1]
            if lat < mnLa: mnLa = lat
            if lat > mxLa: mxLa = lat
            if lng < mnLo: mnLo = lng
            if lng > mxLo: mxLo = lng
        else:
            for a in arr:
                walk(a)

    walk(c)
    if mnLa == 1e9:
        return None
    return (mnLa, mxLa, mnLo, mxLo)


def keys_covering_bbox(bbox):
    """Trả về set các tile key phủ bbox (feature dài chạy qua nhiều tile sẽ có trong nhiều tile)."""
    mnLa, mxLa, mnLo, mxLo = bbox
    keys = set()
    la = int(mnLa * KEY_SCALE) // KEY_STRIDE * KEY_STRIDE
    la_end = int(mxLa * KEY_SCALE) // KEY_STRIDE * KEY_STRIDE
    while la <= la_end:
        lo = int(mnLo * KEY_SCALE) // KEY_STRIDE * KEY_STRIDE
        lo_end = int(mxLo * KEY_SCALE) // KEY_STRIDE * KEY_STRIDE
        while lo <= lo_end:
            keys.add(f"{la}_{lo}")
            lo += KEY_STRIDE
        la += KEY_STRIDE
    return keys


def write_gz_json(path: Path, obj) -> int:
    """Ghi JSON đã gzip, trả về kích thước bytes."""
    path.parent.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=6, mtime=0) as gz:
        gz.write(json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    data = buf.getvalue()
    path.write_bytes(data)
    return len(data)


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


# ─── Classifier nhất quán với frontend ────────────────────────────
# Mapping _type/_layer thực tế của GIS EVNHCMC:
#   point_dk       F05_DienKe_HT_S       → điện kế
#   point_tru_ht   F07_Tru_HT_S          → trụ hạ thế
#   point_tru_tt   F08_Tru_TT_S          → trụ trung thế
#   point_tbdc     F02_TBDC_HT_S         → tủ điện phân phối (switchgear)
#   point_tram_tt  F04_Tram_TT_S         → trạm biến áp (real)
#   point_tba      F10_TBTTDL_HT_S       → thiết bị tập trung dữ liệu (device)
def classify(props) -> str:
    mtb   = str(props.get("MATHIETBI", "") or "").upper()
    gid   = str(props.get("GISID", "") or "").upper()
    kh    = str(props.get("KH_ID", props.get("MA_KHANG", props.get("MA_KH", ""))) or "").upper().strip()
    diach = str(props.get("DIACHI", props.get("DIA_CHI", "")) or "").upper().strip()
    loai  = str(props.get("LOAITHIETBI", "") or "").upper()
    layer = str(props.get("_layer", "") or "").upper()
    tp    = props.get("_type", "")

    # 1. Điện kế — PES prefix luôn ưu tiên (kể cả _type=point_tba nếu có PES)
    if (mtb.startswith("PES") or gid.startswith("PES") or
        kh.startswith("PE") or diach.startswith("PE0") or
        tp == "point_dk" or "DIENKE" in layer):
        return "meter"

    # 2. Trạm biến áp thật — _type=point_tram_tt HOẶC có "TRAM" trong _layer/LOAITHIETBI
    if (tp in ("point_tram_tt", "point_tram_ht") or
        "TRAM" in loai or "TRAM_" in layer or layer.endswith("TRAM") or
        mtb.startswith("TBA") or gid.startswith("TBA")):
        return "substation"

    # 3. Tủ điện phân phối (TBDC) / thiết bị đóng cắt
    if (tp == "point_tbdc" or "TBDC" in layer or "TBDC" in mtb):
        return "switchgear"

    # 4. TBTTDL (thiết bị tập trung dữ liệu, hiếm) → coi như device/meter gateway
    if tp == "point_tba" or "TBTTDL" in layer:
        return "meter"

    # 5. Trụ trung thế
    if (gid.startswith("F08") or mtb.startswith("F08") or
        tp == "point_tru_tt" or "F08_" in layer or "_TT_" in layer):
        return "pole_mv"

    # 6. Trụ hạ thế
    if (gid.startswith("F07") or mtb.startswith("F07") or
        tp == "point_tru_ht" or "F07_" in layer or "_HT_" in layer):
        return "pole_lv"

    return "unknown"


# ─── Build ────────────────────────────────────────────────────────
def main():
    t_start = time.time()
    print(f"▶️  build_tiles.py\n   Source:  {SOURCE_DIR}\n   Output:  {OUT_DIR}")
    print()

    # Xoá output cũ — retry nếu file bị lock (browser / editor đang mở)
    if OUT_DIR.exists():
        import shutil
        import stat

        def _force_remove(func, path, exc_info):
            # Clear read-only flag rồi retry
            try:
                os.chmod(path, stat.S_IWRITE)
                func(path)
            except Exception:
                pass

        for attempt in range(3):
            try:
                shutil.rmtree(OUT_DIR, onexc=_force_remove)
                break
            except PermissionError as e:
                if attempt < 2:
                    print(f"   Retry {attempt + 1}/3: {e}")
                    time.sleep(2)
                else:
                    # Fallback: xoá tối đa những gì có thể
                    print(f"   CANH BAO: {e}")
                    print(f"   Dang thu xoa file theo individual...")
                    shutil.rmtree(OUT_DIR, ignore_errors=True)
                    # Nếu folder vẫn còn sau khi ignore, bỏ qua
    (OUT_DIR / "tiles").mkdir(parents=True, exist_ok=True)

    tiles_tt: dict[str, list] = defaultdict(list)
    tiles_ht: dict[str, list] = defaultdict(list)
    tiles_dk: dict[str, list] = defaultdict(list)
    search_items: list[dict] = []

    type_count = defaultdict(int)

    # 1. Trung thế + TBA
    print("📦 Phân tile TRUNG THẾ + TBA")
    d = load_geojson(SRC_TT)
    if d:
        for f in d["features"]:
            bb = feature_bbox(f.get("geometry"))
            if not bb:
                continue
            for k in keys_covering_bbox(bb):
                tiles_tt[k].append(f)
            # Search index: chỉ thêm TBA (không thêm từng đường dây)
            if f.get("geometry", {}).get("type") == "Point":
                p = f.get("properties", {})
                cls = classify(p)
                type_count[cls] += 1
                if cls in ("substation", "pole_mv"):
                    c = f["geometry"]["coordinates"]
                    # Field thực tế: TBA có ASSETDESC ("An Nhơn Tây 27") + P (kVA).
                    name = (p.get("ASSETDESC") or p.get("TEN")
                            or p.get("CHIDANH") or p.get("MATHIETBI") or "")
                    search_items.append({
                        "i": p.get("GISID") or p.get("MATHIETBI") or "",
                        "n": name,
                        "a": p.get("DIACHI") or p.get("DIA_CHI") or "",
                        "s": str(p.get("SOTRU", "") or ""),
                        "tb": str(p.get("TBT_ID", "") or ""),
                        "cs": p.get("P") or p.get("CONG_SUAT") or "",  # công suất kVA
                        "t": cls,
                        "ll": [round(c[1], 6), round(c[0], 6)],
                    })

    # 2. Hạ thế
    print("\n📦 Phân tile HẠ THẾ")
    d = load_geojson(SRC_HT)
    if d:
        for f in d["features"]:
            bb = feature_bbox(f.get("geometry"))
            if not bb:
                continue
            for k in keys_covering_bbox(bb):
                tiles_ht[k].append(f)

    # 3. Điểm (điện kế + trụ)
    print("\n📦 Phân tile ĐIỂM (điện kế + trụ)")
    d = load_geojson(SRC_DK)
    if d:
        for f in d["features"]:
            bb = feature_bbox(f.get("geometry"))
            if not bb:
                continue
            for k in keys_covering_bbox(bb):
                tiles_dk[k].append(f)
            p = f.get("properties", {})
            cls = classify(p)
            type_count[cls] += 1
            # Index TAT CA loai diem de tim duoc
            if cls in ("meter", "pole_mv", "pole_lv", "substation", "switchgear"):
                g = f.get("geometry", {})
                if g.get("type") != "Point":
                    continue
                c = g["coordinates"]
                gisid = p.get("GISID", "") or ""
                mtb = p.get("MATHIETBI", "") or ""
                kh  = p.get("KH_ID", p.get("MA_KHANG", "")) or ""
                tbt = str(p.get("TBT_ID", "") or "")
                sotru = str(p.get("SOTRU", "") or "")
                chidanh = str(p.get("CHIDANH", "") or "")
                # Điện kế: TEN_KHANG (99%). TBA: ASSETDESC. TBDC: TEN. Trụ: không có tên.
                ten = (p.get("TEN_KH") or p.get("TEN_KHANG") or p.get("ASSETDESC")
                       or p.get("TEN") or chidanh or "")
                # _label de cap co the search: "Tram trung the", "Tru ha the", "Dien ke"...
                label = str(p.get("_label", "") or "")

                # Phai co it nhat 1 thu gi de hien thi
                if not (gisid or mtb or kh or tbt or sotru or ten or label):
                    continue

                # ID cho MiniSearch - luon duy nhat
                search_id = gisid or mtb or kh or tbt or f"{cls}-{c[1]:.5f}-{c[0]:.5f}"

                search_items.append({
                    "i":    search_id,
                    "p":    str(kh),
                    "m":    str(mtb) or gisid,   # fallback GISID neu khong co MATHIETBI
                    "n":    ten or label,         # fallback _label neu khong co ten
                    "a":    p.get("DIA_CHI_KH") or p.get("DIA_CHI") or p.get("DIACHI") or "",
                    "ph":   str(p.get("DTHOAI", p.get("SDT", "")) or ""),
                    "s":    sotru,
                    "tb":   tbt,
                    "cd":   chidanh,              # CHIDANH (ma TBDC/tram ngan)
                    "cs":   p.get("P") or p.get("CONG_SUAT") or "",  # cong suat kVA (chi TBA)
                    "lb":   label,                # _label ("Tram trung the"...)
                    "t":    cls,
                    "ll":   [round(c[1], 6), round(c[0], 6)],
                })

    # 4. Ghi tile ra đĩa
    print("\n💾 Ghi tile")
    all_keys = set(tiles_tt) | set(tiles_ht) | set(tiles_dk)
    total_bytes = 0
    tile_info = {}
    for k in sorted(all_keys):
        info = {"counts": {}, "sizes": {}}
        for label, bucket in (("tt", tiles_tt), ("ht", tiles_ht), ("dk", tiles_dk)):
            feats = bucket.get(k)
            if not feats:
                continue
            out = {"type": "FeatureCollection", "features": feats}
            path = OUT_DIR / "tiles" / k / f"{label}.geojson.gz"
            size = write_gz_json(path, out)
            info["counts"][label] = len(feats)
            info["sizes"][label]  = size
            total_bytes += size
        if info["counts"]:
            tile_info[k] = info
    print(f"   {len(tile_info)} tile · {total_bytes / 1_048_576:.1f} MB (đã gzip)")

    # 5. Search index
    print("\n🔍 Search index")
    search_size = write_gz_json(OUT_DIR / "search.json.gz", {"items": search_items})
    print(f"   {len(search_items):,} records · {search_size / 1_048_576:.1f} MB gzipped")

    # 6. Manifest
    manifest = {
        "version":     int(time.time()),
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "tileStep":    TILE_STEP,
        "counts":      dict(type_count),
        "searchCount": len(search_items),
        "searchSize":  search_size,
        "tiles":       tile_info,
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\n📋 manifest.json  version={manifest['version']}")
    print(f"   Tổng: {sum(type_count.values()):,} features · "
          f"{total_bytes / 1_048_576:.1f} MB tiles · "
          f"{search_size / 1_048_576:.1f} MB search")
    print(f"\n✅ Xong trong {time.time() - t_start:.1f}s")


if __name__ == "__main__":
    main()
