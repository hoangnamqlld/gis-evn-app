#!/usr/bin/env python3
"""
explore_gdb.py — Khám phá cấu trúc GDB để tìm bảng TBA / metadata.
Chạy: python explore_gdb.py
Output: liệt kê tất cả layer/table + columns → gửi dev để config lookup đúng.
"""
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / "config.env")
except ImportError:
    pass

GDB_PATH = os.getenv(
    "GDB_PATH",
    r"d:\DUAN_AI\Web KTLD\Dulieugismoi\07042026\New File Geodatabase.gdb",
)


def main() -> None:
    if not os.path.exists(GDB_PATH):
        print(f"❌ GDB khong ton tai: {GDB_PATH}")
        sys.exit(1)

    try:
        import pyogrio
    except ImportError:
        print("❌ Chua cai pyogrio. Chay: pip install pyogrio")
        sys.exit(1)

    print(f"📁 GDB: {GDB_PATH}")
    print("=" * 80)

    try:
        layers = pyogrio.list_layers(GDB_PATH)
    except Exception as exc:
        print(f"❌ Khong list duoc layers: {exc}")
        sys.exit(1)

    print(f"✓ Tim thay {len(layers)} layer/table\n")

    # Phan loai: spatial vs table
    spatial = []
    tables = []
    for item in layers:
        name = item[0] if isinstance(item, (list, tuple)) else str(item)
        try:
            info = pyogrio.read_info(GDB_PATH, layer=name)
            has_geom = bool(info.get("geometry_type"))
            if has_geom:
                spatial.append((name, info))
            else:
                tables.append((name, info))
        except Exception:
            tables.append((name, None))

    print(f"📐 SPATIAL LAYERS ({len(spatial)}):")
    for name, info in spatial:
        total = info.get("features", 0)
        gtype = info.get("geometry_type", "?")
        cols = info.get("fields", [])
        ncols = len(cols) if hasattr(cols, "__len__") else "?"
        print(f"  • {name:<35} {gtype:<20} {total:>10,} features · {ncols} cols")

    print(f"\n📋 ATTRIBUTE TABLES ({len(tables)}):")
    keyword_hits = []
    for name, info in tables:
        total = info.get("features", 0) if info else "?"
        print(f"  • {name:<35} {total:>10,} rows")
        if info:
            cols = info.get("fields", [])
            col_list = cols.tolist() if hasattr(cols, "tolist") else list(cols)
            name_up = name.upper()
            if any(kw in name_up for kw in ("TBA", "TRAM", "PMIS", "KHANG", "MBA")):
                keyword_hits.append((name, col_list))

    if keyword_hits:
        print(f"\n🔑 BANG CO KHA NANG CHUA METADATA TBA ({len(keyword_hits)}):")
        print("=" * 80)
        for name, cols in keyword_hits:
            print(f"\n### {name}")
            print(f"   Columns ({len(cols)}): {cols}")
            # Sample 3 rows
            try:
                df = pyogrio.read_dataframe(GDB_PATH, layer=name, max_features=3)
                if "geometry" in df.columns:
                    df = df.drop(columns=["geometry"])
                print(f"   Sample:")
                for i, row in df.iterrows():
                    print(f"     [{i}] {dict(row)}")
            except Exception as exc:
                print(f"   (khong doc duoc sample: {exc})")

    print("\n" + "=" * 80)
    print("💡 BUOC TIEP THEO:")
    print("  1. Doi chieu cac bang tren voi data ArcGIS cua ban")
    print("  2. Neu co bang chua MATHIETBI/TEN/CONG_SUAT cua Tram TT")
    print("     → gui ten bang + ten cot cho dev update auto-deploy.py")
    print("  3. Neu khong co → phai thu thap lai bang Sprint 1 app")


if __name__ == "__main__":
    main()
