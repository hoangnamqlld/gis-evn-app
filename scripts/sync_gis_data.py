import os
import json
import pandas as pd
import glob
from datetime import datetime

# Path Configuration
GIS_DATA_DIR = r"d:\DUAN_AI\Web KTLD\dulieugismoi"
WEB_APP_DATA_FILE = r"d:\DUAN_AI\Web KTLD\thuthaptoado\public\data\gis_assets.json"

def process_gis_data():
    print(f"🚀 Starting GIS Data Sync from {GIS_DATA_DIR}...")
    all_assets = []
    
    # 1. Search for Excel and CSV files recursively in all subfolders
    excel_files = glob.glob(os.path.join(GIS_DATA_DIR, "**/*.xlsx"), recursive=True)
    csv_files = glob.glob(os.path.join(GIS_DATA_DIR, "**/*.csv"), recursive=True)
    json_files = glob.glob(os.path.join(GIS_DATA_DIR, "**/*.json"), recursive=True)
    
    print(f"🔍 Found {len(excel_files)} Excel, {len(csv_files)} CSV, and {len(json_files)} JSON files.")
    
    for file in excel_files + csv_files + json_files:
        try:
            print(f"📄 Processing: {file.replace(GIS_DATA_DIR, '')}")
            
            if file.endswith('.xlsx'):
                df = pd.read_excel(file)
            elif file.endswith('.csv'):
                df = pd.read_csv(file)
            elif file.endswith('.json'):
                # Basic support for GeoJSON or simple JSON arrays
                with open(file, 'r', encoding='utf-8') as jf:
                    data = json.load(jf)
                    # Simple check if it's already in our format or GeoJSON
                    if isinstance(data, list):
                        all_assets.extend(data)
                        continue
                    elif isinstance(data, dict) and data.get('type') == 'FeatureCollection':
                        for feature in data.get('features', []):
                            # Convert GeoJSON feature to GridAsset
                            props = feature.get('properties', {})
                            geom = feature.get('geometry', {})
                            if geom.get('type') == 'Point':
                                coords = geom.get('coordinates', [0, 0])
                                asset = {
                                    "id": f"GIS-{props.get('MA_PE', props.get('OBJECTID', len(all_assets)))}",
                                    "code": str(props.get('MA_PE', props.get('ID', ''))),
                                    "customerCode": str(props.get('MA_PE', '')),
                                    "name": str(props.get('TEN_KH', props.get('NAME', 'Thiết bị'))),
                                    "type": "customer" if 'MA_PE' in props else "pole_lv",
                                    "coords": {"lat": coords[1], "lng": coords[0]},
                                    "address": str(props.get('DIA_CHI', '')),
                                    "photoUrls": [],
                                    "timestamp": int(datetime.now().timestamp() * 1000),
                                    "status": "Synced",
                                    "unit": "GIS_IMPORT"
                                }
                                all_assets.append(asset)
                        continue
                    else: continue
            
            # Basic validation: need Lat/Lng or X/Y
            # Assuming columns might be: 'MA_PE', 'TEN_KH', 'LAT', 'LNG', 'DIA_CHI'
            # Or VN2000: 'X_VN2000', 'Y_VN2000'
            
            for index, row in df.iterrows():
                asset = {
                    "id": f"GIS-{row.get('MA_PE', index)}",
                    "code": str(row.get('MA_PE', f"G{index}")),
                    "customerCode": str(row.get('MA_PE', '')),
                    "name": str(row.get('TEN_KH', 'Khách hàng không tên')),
                    "type": "customer",
                    "coords": {
                        "lat": float(row.get('LAT', 10.7769)),
                        "lng": float(row.get('LNG', 106.7009)),
                        "x_vn2000": float(row.get('X_VN2000', 0)),
                        "y_vn2000": float(row.get('Y_VN2000', 0))
                    },
                    "address": str(row.get('DIA_CHI', '')),
                    "photoUrls": [],
                    "timestamp": int(datetime.now().timestamp() * 1000),
                    "status": "Synced",
                    "unit": "DULIEU_GIS"
                }
                all_assets.append(asset)
                
        except Exception as e:
            print(f"❌ Error processing {file}: {e}")

    # Ensure directory exists
    os.makedirs(os.path.dirname(WEB_APP_DATA_FILE), exist_ok=True)
    
    # Write to JSON
    with open(WEB_APP_DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_assets, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Sync Complete! {len(all_assets)} assets saved to {WEB_APP_DATA_FILE}")

if __name__ == "__main__":
    process_gis_data()
