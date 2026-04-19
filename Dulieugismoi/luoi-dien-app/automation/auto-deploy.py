#!/usr/bin/env python3
"""
Auto-deploy: ArcGIS FileGDB -> GeoJSON dung pyogrio
Chay hang thang sau khi cap nhat GDB moi
"""

import os, sys, json, shutil, logging, warnings
from datetime import datetime
from pathlib import Path

warnings.filterwarnings("ignore")

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / "config.env")
except ImportError:
    pass

# ─── CONFIG ───────────────────────────────────────────────
GDB_PATH   = os.getenv("GDB_PATH",
             r"d:\DUAN_AI\Web KTLD\Dulieugismoi\07042026\New File Geodatabase.gdb")
OUTPUT_DIR = os.getenv("OUTPUT_DIR",
             str(Path(__file__).parent / "output"))
LOG_FILE   = str(Path(__file__).parent / "deploy.log")

OUTPUT_FILE      = os.path.join(OUTPUT_DIR, "luoi-dien.geojson")
OUTPUT_FILE_TT   = os.path.join(OUTPUT_DIR, "luoi-dien-trungthe.geojson")
OUTPUT_FILE_HT   = os.path.join(OUTPUT_DIR, "luoi-dien-hathe.geojson")
OUTPUT_FILE_DIEM = os.path.join(OUTPUT_DIR, "luoi-dien-diem.geojson")

# Cac layer can convert + field can giu lai
LAYERS = {
    # Duong day trung the
    "F10_DuongDay_TT_S": {
        "type": "line_tt",
        "label": "Duong day trung the",
        "fields": ["MADD", "PHA", "DIENAP", "LOAIDAY_PHA_A", "TIETDIENDAY_PHA_A",
                   "SOHUU", "DONVI", "CD_QL", "ENABLED", "GISID"],
        "color_field": "MADD",
    },
    # Duong day ha the
    "F08_DuongDay_HT_S": {
        "type": "line_ht",
        "label": "Duong day ha the",
        "fields": ["TBT_ID", "LORA", "MACDIEN", "PHA", "LOAIDAY",
                   "TIETDIENDAY", "SOHUU", "DONVI", "CD_QL", "ENABLED", "GISID"],
        "color_field": "TBT_ID",
    },
    # Dien ke
    "F05_DienKe_HT_S": {
        "type": "point_dk",
        "label": "Dien ke",
        "fields": ["KH_ID", "TEN_KH", "TBT_ID", "LORA", "VITRI", "DIA_CHI", "SOHUU", "DONVI", "GISID",
                    "TEN_KHANG", "DTHOAI", "DIA_CHI_KH"], # v14.0 Joined fields
        "color_field": "TBT_ID",
    },
    # Tram bien ap / TBT ha the
    "F10_TBTTDL_HT_S": {
        "type": "point_tba",
        "label": "TBA / TBT ha the",
        "fields": ["TEN", "LOAITHIETBI", "MATHIETBI", "DIACHI", "SOHUU", "DONVI", "GISID",
                    "CONG_SUAT", "ASSETDESC"], # v14.0 Joined fields
        "color_field": "TBT_ID",
    },
    # Tru ha the
    "F07_Tru_HT_S": {
        "type": "point_tru_ht",
        "label": "Tru ha the",
        "fields": ["SOTRU", "LOAITRU", "CHIEUCAOTRU", "SOHUU", "DONVI", "ENABLED", "GISID", "TEN_TRAM"],
        "color_field": None,
    },
    # Tru trung the (v11.0)
    "F08_Tru_TT_S": {
        "type": "point_tru_tt",
        "label": "Tru trung the",
        "fields": ["SOTRU", "LOAITRU", "SOHUU", "DONVI", "ENABLED", "GISID", "MATHIETBI"],
        "color_field": None,
    },
    # Tram trung the
    "F04_Tram_TT_S": {
        "type": "point_tram_tt",
        "label": "Tram trung the",
        "fields": ["TEN", "LOAITHIETBI", "SOHUU", "DONVI", "GISID", "ENABLED", "DIA_CHI"],
        "color_field": None,
    },
    # Thiet bi dong cat ha the
    "F02_TBDC_HT_S": {
        "type": "point_tbdc",
        "label": "Thiet bi dong cat",
        "fields": ["CHIDANH", "MA_LOAI", "TEN", "SOHUU", "DONVI", "GISID", "ENABLED"],
        "color_field": None,
    },
}

# ─── LOGGING ──────────────────────────────────────────────
os.makedirs(OUTPUT_DIR, exist_ok=True)
log_handlers = [logging.FileHandler(LOG_FILE, encoding="utf-8")]
try:
    log_handlers.append(
        logging.StreamHandler(
            open(sys.stdout.fileno(), mode="w", encoding="utf-8", closefd=False)
        )
    )
except Exception:
    log_handlers.append(logging.StreamHandler(sys.stdout))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=log_handlers,
)
log = logging.getLogger(__name__)


def load_lookups(gdb_path):
    """Doc cac bang thuoc tinh de join du lieu (v14.0)."""
    import pyogrio
    lookups = {"kh": {}, "mba": {}}
    
    # 1. Bang khach hang (V_KHANG_CUCHI)
    try:
        log.info("Loading customer lookup (V_KHANG_CUCHI)...")
        df_kh = pyogrio.read_dataframe(gdb_path, layer="V_KHANG_CUCHI", columns=["MA_KHANG", "TEN_KHANG", "DTHOAI", "DIA_CHI"])
        # v16.0: Normal hóa ID để join chính xác
        df_kh["MA_KHANG"] = df_kh["MA_KHANG"].astype(str).str.strip().str.upper()
        lookups["kh"] = df_kh.set_index("MA_KHANG").to_dict(orient="index")
        log.info(f"  -> {len(lookups['kh']):,} customers loaded")
    except Exception as e:
        log.warning(f"  Could not load V_KHANG_CUCHI: {e}")

    # 2. Bang cong suat tram (S_PMIS_TBA - v14.1 fix)
    try:
        log.info("Loading substation lookup (S_PMIS_TBA)...")
        df_tba = pyogrio.read_dataframe(gdb_path, layer="S_PMIS_TBA", columns=["GISID", "P", "ASSETDESC"])
        df_tba = df_tba[df_tba["GISID"].notna() & (df_tba["GISID"] != "")]
        # v16.0: Normal hóa ID
        df_tba["GISID"] = df_tba["GISID"].astype(str).str.strip().str.upper()
        df_tba = df_tba.drop_duplicates(subset=["GISID"])
        lookups["mba"] = df_tba.set_index("GISID").to_dict(orient="index")
        log.info(f"  -> {len(lookups['mba']):,} substations loaded")
    except Exception as e:
        log.warning(f"  Could not load S_PMIS_TBA: {e}")

    return lookups


def convert_layer(gdb_path, layer_name, cfg):
    """Doc 1 layer tu GDB, tra ve list features GeoJSON."""
    import pyogrio, json as _json
    import numpy as np

    keep_fields = cfg["fields"]

    try:
        meta = pyogrio.read_info(gdb_path, layer=layer_name)
        total = meta["features"]
        log.info(f"  Layer {layer_name}: {total:,} features")
    except Exception as e:
        log.warning(f"  Khong doc duoc {layer_name}: {e}")
        return []

    # Doc tung batch de tranh OOM voi du lieu lon
    BATCH = 50_000
    features = []
    offset = 0

    while offset < total:
        try:
            gdf = pyogrio.read_dataframe(
                gdb_path,
                layer=layer_name,
                columns=keep_fields,
                skip_features=offset,
                max_features=BATCH,
                use_arrow=True,
            )
        except Exception as e:
            log.warning(f"    batch {offset}: {e}")
            offset += BATCH
            continue

        # Convert sang GeoJSON features
        for _, row in gdf.iterrows():
            geom = row.get("geometry")
            if geom is None or geom.is_empty:
                offset += 1
                continue

            # Simplify geometry de giam size file
            geom_simplified = geom.simplify(0.00003)  # ~3m
            if geom_simplified.is_empty:
                geom_simplified = geom

            # Drop Z coordinate de gon nhe hon
            try:
                import shapely
                geom_2d = shapely.force_2d(geom_simplified)
            except Exception:
                geom_2d = geom_simplified

            props = {}
            for f in keep_fields:
                v = row.get(f)
                if v is None or (isinstance(v, float) and np.isnan(v)):
                    props[f] = None
                else:
                    props[f] = str(v) if not isinstance(v, (int, float, bool, str)) else v

            props["_layer"]  = layer_name
            props["_type"]   = cfg["type"]
            props["_label"]  = cfg["label"]

            features.append({
                "type": "Feature",
                "geometry": _json.loads(geom_2d.to_wkt() if False else geom_2d.__geo_interface__.__class__.__name__ and str(geom_2d.__geo_interface__).replace("'", '"')),
                "properties": props,
            })

        offset += BATCH
        log.info(f"    ... {min(offset, total):,}/{total:,} features doc xong")

    return features


def convert_layer_fast(gdb_path, layer_name, cfg, lookups=None):
    """Doc layer, reproject VN2000 -> WGS84, xuat GeoJSON (Enriched v14.0)."""
    import pyogrio, json as _json, tempfile, os as _os, shapely
    import pandas as pd

    # Chi doc cac field co trong layer thuc te
    all_fields = pyogrio.read_info(gdb_path, layer=layer_name)["fields"].tolist()
    primary_fields = [f for f in cfg["fields"] if f in all_fields]
    
    try:
        total = pyogrio.read_info(gdb_path, layer=layer_name)["features"]
    except Exception as e:
        log.warning(f"  Khong doc duoc {layer_name}: {e}")
        return []

    log.info(f"  Converting {layer_name}: {total:,} features...")
    tmp_geojson = tempfile.mktemp(suffix=".geojson")
    try:
        gdf = pyogrio.read_dataframe(gdb_path, layer=layer_name, columns=primary_fields)

        # Reproject VN2000 -> WGS84
        if gdf.crs and not gdf.crs.is_geographic:
            log.info(f"    Reprojecting {gdf.crs.to_string()[:40]} -> WGS84...")
            gdf = gdf.to_crs("EPSG:4326")

        # JOIN DU LIEU (v16.0 Normalized)
        if lookups:
            if cfg["type"] == "point_dk" and "KH_ID" in gdf.columns:
                def get_kh_info(row):
                    kid = str(row["KH_ID"]).strip().upper() if row["KH_ID"] else ""
                    return lookups["kh"].get(kid, {})
                
                kh_info = gdf.apply(get_kh_info, axis=1)
                gdf["TEN_KHANG"] = kh_info.apply(lambda x: x.get("TEN_KHANG"))
                gdf["DTHOAI"]    = kh_info.apply(lambda x: x.get("DTHOAI"))
                gdf["DIA_CHI_KH"] = kh_info.apply(lambda x: x.get("DIA_CHI"))
            
            if cfg["type"] == "point_tba" and "GISID" in gdf.columns:
                def get_mba_info(row):
                    gid = str(row["GISID"]).strip().upper() if row["GISID"] else ""
                    return lookups["mba"].get(gid, {})

                mba_info = gdf.apply(get_mba_info, axis=1)
                gdf["CONG_SUAT"] = mba_info.apply(lambda x: x.get("P"))
                gdf["ASSETDESC"] = mba_info.apply(lambda x: x.get("ASSETDESC"))

        # Bo Z, simplify
        gdf["geometry"] = gdf["geometry"].apply(
            lambda g: shapely.force_2d(g.simplify(0.000003)) if g and not g.is_empty else g
        )
        gdf = gdf[gdf["geometry"].notna() & ~gdf["geometry"].is_empty]

        # Them meta
        gdf["_layer"] = layer_name
        gdf["_type"]  = cfg["type"]
        gdf["_label"] = cfg["label"]

        pyogrio.write_dataframe(gdf, tmp_geojson, driver="GeoJSON")
        with open(tmp_geojson, "r", encoding="utf-8") as f:
            fc = _json.load(f)

        log.info(f"    OK: {len(fc['features']):,} features")
        return fc["features"]
    except Exception as e:
        log.error(f"  Loi {layer_name}: {e}")
        return []
    finally:
        if _os.path.exists(tmp_geojson):
            _os.remove(tmp_geojson)


def backup(path):
    if not os.path.exists(path):
        return
    backup_dir = os.path.join(OUTPUT_DIR, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M")
    name = os.path.basename(path).replace(".geojson", f"_{ts}.geojson")
    shutil.copy2(path, os.path.join(backup_dir, name))


def save_geojson(features, path, meta=None):
    fc = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "source": GDB_PATH,
            "total": len(features),
            **(meta or {}),
        },
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, separators=(",", ":"), default=str)
    mb = os.path.getsize(path) / 1024 / 1024
    log.info(f"  Saved: {path} ({mb:.1f} MB, {len(features):,} features)")


def main():
    log.info("=" * 60)
    log.info("Luoi Dien App - Auto Deploy (pyogrio)")
    log.info(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    log.info("=" * 60)

    if not os.path.exists(GDB_PATH):
        log.error(f"GDB khong ton tai: {GDB_PATH}")
        sys.exit(1)

    log.info(f"GDB: {GDB_PATH}")

    # Backup files cu
    for f in [OUTPUT_FILE, OUTPUT_FILE_TT, OUTPUT_FILE_HT, OUTPUT_FILE_DIEM]:
        backup(f)

    all_features   = []
    line_tt_feats  = []
    line_ht_feats  = []
    point_feats    = []

    # Tinh tai lookups (v14.0)
    lookups = load_lookups(GDB_PATH)

    for layer_name, cfg in LAYERS.items():
        log.info(f"\nLay {cfg['label']} ({layer_name})...")
        feats = convert_layer_fast(GDB_PATH, layer_name, cfg, lookups=lookups)
        if not feats:
            continue
        all_features.extend(feats)
        if cfg["type"] == "line_tt":
            line_tt_feats.extend(feats)
        elif cfg["type"] == "line_ht":
            line_ht_feats.extend(feats)
        else:
            point_feats.extend(feats)

    log.info(f"\nTong: {len(all_features):,} features")
    log.info("Dang ghi file GeoJSON...")

    # File tong hop (trung the + TBT + tram + tru TT)
    combined = line_tt_feats + [f for f in point_feats if f["properties"]["_type"] in ("point_tba", "point_tram_tt", "point_tru_tt")]
    save_geojson(combined, OUTPUT_FILE,
                 {"layers": ["F10_DuongDay_TT_S", "F10_TBTTDL_HT_S", "F04_Tram_TT_S", "F08_Tru_TT_S"]})

    # File duong day trung the
    save_geojson(line_tt_feats, OUTPUT_FILE_TT, {"layers": ["F10_DuongDay_TT_S"]})

    # File duong day ha the
    save_geojson(line_ht_feats, OUTPUT_FILE_HT, {"layers": ["F08_DuongDay_HT_S"]})

    # File diem (dien ke + tru + TBA)
    save_geojson(point_feats, OUTPUT_FILE_DIEM,
                 {"layers": ["F05_DienKe_HT_S", "F07_Tru_HT_S", "F10_TBTTDL_HT_S", "F04_Tram_TT_S"]})

    log.info("\nHoan thanh! Cac file GeoJSON:")
    log.info(f"  Tong hop (TT + TBA) : {OUTPUT_FILE}")
    log.info(f"  Duong day trung the  : {OUTPUT_FILE_TT}")
    log.info(f"  Duong day ha the     : {OUTPUT_FILE_HT}")
    log.info(f"  Diem (DK+Tru+TBA)   : {OUTPUT_FILE_DIEM}")
    log.info("Restart backend server de load du lieu moi.")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
