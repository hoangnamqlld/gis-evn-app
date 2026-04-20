# -*- coding: utf-8 -*-
"""
gpkg_to_geojson.py — Convert 1 file .gpkg sang nhiều file GeoJSON (thay auto-deploy.py)

Thay the auto-deploy.py + load_lookups() — do .gpkg da chua san table join.

Cach dung:
  python scripts/gpkg_to_geojson.py <input.gpkg> <output_dir>

Hoac tu config:
  Script tu tim file .gpkg moi nhat trong folder gis-raw/
  Xuat GeoJSON sang automation/output/

Yeu cau: pip install pyogrio pandas
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT_DIR = ROOT / "Dulieugismoi" / "luoi-dien-app" / "gis-raw"
DEFAULT_OUTPUT_DIR = ROOT / "Dulieugismoi" / "luoi-dien-app" / "automation" / "output"

# Mapping layer name trong .gpkg → config xuat
LAYERS = {
    "F10_DuongDay_TT_S": ("line_tt", "Duong day trung the"),
    "F08_DuongDay_HT_S": ("line_ht", "Duong day ha the"),
    "F05_DienKe_HT_S":   ("point_dk", "Dien ke"),
    "F10_TBTTDL_HT_S":   ("point_tba", "TBA / TBT ha the"),
    "F07_Tru_HT_S":      ("point_tru_ht", "Tru ha the"),
    "F08_Tru_TT_S":      ("point_tru_tt", "Tru trung the"),
    "F04_Tram_TT_S":     ("point_tram_tt", "Tram trung the"),
    "F02_TBDC_HT_S":     ("point_tbdc", "Thiet bi dong cat"),
}


def log(msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")


def load_attribute_tables(gpkg: Path) -> dict:
    """Doc cac bang attribute (khong co geometry) de join."""
    import pyogrio

    lookups = {"kh": {}, "mba": {}}
    layer_names = [lr[0] if isinstance(lr, tuple) else lr for lr in pyogrio.list_layers(gpkg)]

    # Bang khach hang
    kh_table_candidates = ["V_KHANG_CUCHI", "V_KHANG", "KHANG", "KH"]
    for name in kh_table_candidates:
        if name not in layer_names:
            continue
        try:
            df = pyogrio.read_dataframe(gpkg, layer=name)
            if "geometry" in df.columns:
                df = df.drop(columns=["geometry"])
            id_col = "MA_KHANG" if "MA_KHANG" in df.columns else df.columns[0]
            df[id_col] = df[id_col].astype(str).str.strip().str.upper()
            lookups["kh"] = df.set_index(id_col).to_dict(orient="index")
            log(f"  ✓ KH lookup: {len(lookups['kh']):,} (from {name})")
            break
        except Exception as exc:
            log(f"  ⚠ {name} error: {exc}")

    # Bang thiet bi / TBA
    tba_table_candidates = ["S_PMIS_TBA", "S_PMIS_TRAM", "V_TBA", "TRAM", "MBA"]
    for name in tba_table_candidates:
        if name not in layer_names:
            continue
        try:
            df = pyogrio.read_dataframe(gpkg, layer=name)
            if "geometry" in df.columns:
                df = df.drop(columns=["geometry"])
            id_col = "GISID" if "GISID" in df.columns else df.columns[0]
            df = df[df[id_col].notna() & (df[id_col] != "")]
            df[id_col] = df[id_col].astype(str).str.strip().str.upper()
            df = df.drop_duplicates(subset=[id_col])
            lookups["mba"] = df.set_index(id_col).to_dict(orient="index")
            log(f"  ✓ TBA lookup: {len(lookups['mba']):,} (from {name})")
            break
        except Exception as exc:
            log(f"  ⚠ {name} error: {exc}")

    return lookups


def convert_layer(gpkg: Path, layer_name: str, type_: str, label: str, lookups: dict) -> list:
    import pyogrio
    import shapely

    try:
        gdf = pyogrio.read_dataframe(gpkg, layer=layer_name)
    except Exception as exc:
        log(f"  ⚠ bo qua {layer_name}: {exc}")
        return []

    # Reproject sang WGS84 neu can
    if gdf.crs and not gdf.crs.is_geographic:
        gdf = gdf.to_crs("EPSG:4326")

    # Join KH
    if type_ == "point_dk" and lookups.get("kh") and "KH_ID" in gdf.columns:
        def enrich(row):
            kid = str(row.get("KH_ID") or "").strip().upper()
            return lookups["kh"].get(kid, {})
        joined = gdf.apply(enrich, axis=1)
        for k in ("TEN_KHANG", "DTHOAI", "DIA_CHI"):
            if k in joined.iloc[0] if len(joined) else False:
                gdf[k] = joined.apply(lambda x: x.get(k))

    # Join TBA
    if type_ in ("point_tba", "point_tram_tt") and lookups.get("mba") and "GISID" in gdf.columns:
        def enrich(row):
            gid = str(row.get("GISID") or "").strip().upper()
            return lookups["mba"].get(gid, {})
        joined = gdf.apply(enrich, axis=1)
        if len(joined) and isinstance(joined.iloc[0], dict):
            for k in joined.iloc[0].keys():
                if k != "geometry" and k not in gdf.columns:
                    gdf[k] = joined.apply(lambda x: x.get(k))

    # Simplify geometry, drop Z
    gdf["geometry"] = gdf["geometry"].apply(
        lambda g: shapely.force_2d(g.simplify(0.000003)) if g and not g.is_empty else g
    )
    gdf = gdf[gdf["geometry"].notna() & ~gdf["geometry"].is_empty]

    # Meta
    gdf["_layer"] = layer_name
    gdf["_type"] = type_
    gdf["_label"] = label

    # Convert to GeoJSON features (khong dung pyogrio.write vi can full control)
    import tempfile
    tmp = Path(tempfile.mktemp(suffix=".geojson"))
    try:
        pyogrio.write_dataframe(gdf, str(tmp), driver="GeoJSON")
        return json.loads(tmp.read_text(encoding="utf-8"))["features"]
    finally:
        if tmp.exists():
            tmp.unlink()


def main() -> None:
    # Resolve input .gpkg
    if len(sys.argv) >= 2:
        gpkg = Path(sys.argv[1])
    else:
        # Tim .gpkg moi nhat trong default folder
        candidates = sorted(DEFAULT_INPUT_DIR.glob("*.gpkg"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not candidates:
            log(f"❌ Khong tim thay .gpkg trong {DEFAULT_INPUT_DIR}")
            sys.exit(1)
        gpkg = candidates[0]
        log(f"📁 Dung file moi nhat: {gpkg.name}")

    out_dir = Path(sys.argv[2]) if len(sys.argv) >= 3 else DEFAULT_OUTPUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    log(f"Input:  {gpkg} ({gpkg.stat().st_size / 1_048_576:.1f} MB)")
    log(f"Output: {out_dir}")

    log("📖 Loading attribute tables...")
    lookups = load_attribute_tables(gpkg)

    all_features = []
    line_tt, line_ht, points = [], [], []

    for layer_name, (type_, label) in LAYERS.items():
        log(f"\n📦 {layer_name} ({label})...")
        feats = convert_layer(gpkg, layer_name, type_, label, lookups)
        if not feats:
            continue
        log(f"   -> {len(feats):,} features")
        all_features.extend(feats)
        if type_ == "line_tt":
            line_tt.extend(feats)
        elif type_ == "line_ht":
            line_ht.extend(feats)
        else:
            points.extend(feats)

    log(f"\nTong: {len(all_features):,} features")

    def save(features: list, name: str) -> None:
        fc = {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {"generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "source": str(gpkg)},
        }
        path = out_dir / name
        path.write_text(
            json.dumps(fc, ensure_ascii=False, separators=(",", ":"), default=str),
            encoding="utf-8",
        )
        mb = path.stat().st_size / 1_048_576
        log(f"  ✓ {name}: {mb:.1f} MB, {len(features):,} features")

    log("\n💾 Ghi GeoJSON files...")
    combined_tt_tba = line_tt + [f for f in points if f["properties"]["_type"] in ("point_tba", "point_tram_tt", "point_tru_tt")]
    save(combined_tt_tba, "luoi-dien.geojson")
    save(line_tt, "luoi-dien-trungthe.geojson")
    save(line_ht, "luoi-dien-hathe.geojson")
    save(points, "luoi-dien-diem.geojson")

    log("\n✅ Hoan tat. Tiep theo chay build_tiles.py.")


if __name__ == "__main__":
    main()
