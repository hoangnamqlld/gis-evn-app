# -*- coding: utf-8 -*-
"""
PowerMind ArcGIS Python Toolbox
===============================
Import submissions thu thập từ công nhân (qua Google Drive) vào ArcGIS Feature Class.

Cách dùng:
  1. Mở ArcGIS Pro → Catalog pane
  2. Chuột phải "Toolboxes" → Add Toolbox → chọn file .pyt này
  3. Expand toolbox → thấy 3 tool:
     - Import Submissions
     - Import Inspections
     - Sync from Drive
  4. Double-click tool → điền input → Run

File submission format (JSON):
  {
    "id": "uuid",
    "type": "meter|pole_lv|pole_mv|substation",
    "coords": { "lat": ..., "lng": ... },
    "properties": {
      "KH_ID": "PE09...", "MATHIETBI": "F07...",
      "TEN_KHANG": "...", "DIA_CHI_KH": "...",
      "SOTRU": "...", "TBT_ID": "...", ...
    },
    "photos": ["drive_file_id_1", ...],
    "collectorName": "Nguyễn Văn A",
    "timestamp": 1234567890000,
    "status": "approved"
  }
"""

import arcpy
import json
import os
from datetime import datetime
from pathlib import Path


class Toolbox(object):
    def __init__(self):
        self.label = "PowerMind Import Tools"
        self.alias = "PowerMind"
        self.tools = [ImportSubmissions, ImportInspections, SyncFromDrive]


# ============================================================
# Tool 1: Import Submissions (điện kế/trụ mới)
# ============================================================
class ImportSubmissions(object):
    def __init__(self):
        self.label = "1. Import Submissions (điểm mới)"
        self.description = "Import điểm thu thập mới (điện kế, trụ, trạm) từ thư mục JSON vào Feature Class."
        self.canRunInBackground = False

    def getParameterInfo(self):
        params = []

        p0 = arcpy.Parameter(
            displayName="Thư mục chứa JSON submissions",
            name="input_folder",
            datatype="DEFolder",
            parameterType="Required",
            direction="Input",
        )
        params.append(p0)

        p1 = arcpy.Parameter(
            displayName="Feature Class đích (Điện kế)",
            name="fc_meter",
            datatype="DEFeatureClass",
            parameterType="Optional",
            direction="Input",
        )
        params.append(p1)

        p2 = arcpy.Parameter(
            displayName="Feature Class đích (Trụ hạ thế F07)",
            name="fc_pole_lv",
            datatype="DEFeatureClass",
            parameterType="Optional",
            direction="Input",
        )
        params.append(p2)

        p3 = arcpy.Parameter(
            displayName="Feature Class đích (Trụ trung thế F08)",
            name="fc_pole_mv",
            datatype="DEFeatureClass",
            parameterType="Optional",
            direction="Input",
        )
        params.append(p3)

        p4 = arcpy.Parameter(
            displayName="Feature Class đích (Trạm TBA)",
            name="fc_substation",
            datatype="DEFeatureClass",
            parameterType="Optional",
            direction="Input",
        )
        params.append(p4)

        p5 = arcpy.Parameter(
            displayName="Chỉ import status='approved'?",
            name="approved_only",
            datatype="GPBoolean",
            parameterType="Optional",
            direction="Input",
        )
        p5.value = True
        params.append(p5)

        p6 = arcpy.Parameter(
            displayName="Sau import: di chuyển file JSON sang thư mục 'archived'?",
            name="move_archived",
            datatype="GPBoolean",
            parameterType="Optional",
            direction="Input",
        )
        p6.value = True
        params.append(p6)

        return params

    def execute(self, parameters, messages):
        input_folder = parameters[0].valueAsText
        fc_meter = parameters[1].valueAsText
        fc_pole_lv = parameters[2].valueAsText
        fc_pole_mv = parameters[3].valueAsText
        fc_substation = parameters[4].valueAsText
        approved_only = parameters[5].value
        move_archived = parameters[6].value

        fc_map = {
            "meter": fc_meter,
            "pole_lv": fc_pole_lv,
            "pole_mv": fc_pole_mv,
            "substation": fc_substation,
        }

        arcpy.AddMessage(f"📂 Quét thư mục: {input_folder}")
        json_files = list(Path(input_folder).rglob("*.json"))
        arcpy.AddMessage(f"   Tìm thấy {len(json_files)} file JSON")

        stats = {"imported": 0, "skipped": 0, "errors": 0}
        by_type = {k: 0 for k in fc_map.keys()}

        archived_dir = Path(input_folder) / "_archived" / datetime.now().strftime("%Y-%m-%d")
        if move_archived:
            archived_dir.mkdir(parents=True, exist_ok=True)

        for jf in json_files:
            try:
                with open(jf, "r", encoding="utf-8") as f:
                    rec = json.load(f)

                if approved_only and rec.get("status") != "approved":
                    stats["skipped"] += 1
                    continue

                rec_type = rec.get("type", "").lower()
                target_fc = fc_map.get(rec_type)
                if not target_fc:
                    arcpy.AddWarning(f"⚠ {jf.name}: type='{rec_type}' chưa map hoặc không có FC")
                    stats["skipped"] += 1
                    continue

                self._append_to_fc(target_fc, rec, messages)
                by_type[rec_type] = by_type.get(rec_type, 0) + 1
                stats["imported"] += 1

                if move_archived:
                    jf.rename(archived_dir / jf.name)

            except Exception as e:
                arcpy.AddError(f"❌ {jf.name}: {e}")
                stats["errors"] += 1

        arcpy.AddMessage("")
        arcpy.AddMessage("=" * 50)
        arcpy.AddMessage("📊 KẾT QUẢ IMPORT")
        arcpy.AddMessage("=" * 50)
        arcpy.AddMessage(f"✅ Imported: {stats['imported']}")
        for t, n in by_type.items():
            if n > 0:
                arcpy.AddMessage(f"   - {t}: {n}")
        arcpy.AddMessage(f"⏭ Skipped: {stats['skipped']}")
        arcpy.AddMessage(f"❌ Errors: {stats['errors']}")
        if move_archived and stats['imported'] > 0:
            arcpy.AddMessage(f"📦 Archived → {archived_dir}")

    def _append_to_fc(self, fc, rec, messages):
        """Append 1 record vào FC. Tự tạo field nếu chưa có."""
        # Lấy schema hiện tại
        existing_fields = {f.name.upper() for f in arcpy.ListFields(fc)}

        # Các field phổ biến cần có
        common_fields = [
            ("COLLECTOR", "TEXT", 100),
            ("COLLECT_TS", "DATE", None),
            ("SUBMIT_ID", "TEXT", 64),
            ("STATUS", "TEXT", 20),
        ]
        for fname, ftype, flen in common_fields:
            if fname not in existing_fields:
                try:
                    arcpy.management.AddField(fc, fname, ftype, field_length=flen)
                    existing_fields.add(fname)
                except Exception:
                    pass

        # Auto-add field từ properties nếu chưa có
        props = rec.get("properties", {}) or {}
        for k, v in props.items():
            if k.upper() not in existing_fields and v is not None:
                fname = k.upper()[:31]  # FC field name max 31 char
                try:
                    if isinstance(v, (int, float)):
                        arcpy.management.AddField(fc, fname, "DOUBLE")
                    else:
                        arcpy.management.AddField(fc, fname, "TEXT", field_length=255)
                    existing_fields.add(fname)
                except Exception:
                    pass

        # Insert row
        coords = rec.get("coords", {})
        lat = float(coords.get("lat", 0))
        lng = float(coords.get("lng", 0))
        if lat == 0 or lng == 0:
            raise ValueError("Coords không hợp lệ")

        fields_to_insert = ["SHAPE@XY", "COLLECTOR", "COLLECT_TS", "SUBMIT_ID", "STATUS"]
        values = [
            (lng, lat),
            str(rec.get("collectorName", "")),
            datetime.fromtimestamp(rec.get("timestamp", 0) / 1000),
            str(rec.get("id", "")),
            str(rec.get("status", "")),
        ]

        # Thêm các field property
        for k, v in props.items():
            fname = k.upper()[:31]
            if fname in existing_fields and fname not in fields_to_insert:
                fields_to_insert.append(fname)
                values.append(v if not isinstance(v, (dict, list)) else json.dumps(v, ensure_ascii=False))

        with arcpy.da.InsertCursor(fc, fields_to_insert) as cursor:
            cursor.insertRow(values)


# ============================================================
# Tool 2: Import Inspections (kiểm tra trụ/trạm)
# ============================================================
class ImportInspections(object):
    def __init__(self):
        self.label = "2. Import Inspections (kiểm tra)"
        self.description = "Import biên bản kiểm tra lưới điện vào bảng attribute của Feature Class."

    def getParameterInfo(self):
        p0 = arcpy.Parameter("input_folder", "Thư mục JSON inspections", "DEFolder", "Required", "Input")
        p0.displayName = "Thư mục JSON inspections"

        p1 = arcpy.Parameter("fc_target", "Feature Class có thiết bị", "DEFeatureClass", "Required", "Input")
        p1.displayName = "Feature Class target"

        p2 = arcpy.Parameter("id_field", "Field ID để match (VD: MATHIETBI)", "GPString", "Required", "Input")
        p2.displayName = "ID field để match (VD: MATHIETBI)"
        p2.value = "MATHIETBI"

        return [p0, p1, p2]

    def execute(self, parameters, messages):
        input_folder = parameters[0].valueAsText
        fc = parameters[1].valueAsText
        id_field = parameters[2].valueAsText

        # Đảm bảo có các field inspection
        existing = {f.name.upper() for f in arcpy.ListFields(fc)}
        for fname, ftype, flen in [
            ("INSP_DATE", "DATE", None),
            ("INSP_STATUS", "TEXT", 20),
            ("INSP_NOTE", "TEXT", 500),
            ("INSP_BY", "TEXT", 100),
        ]:
            if fname not in existing:
                arcpy.management.AddField(fc, fname, ftype, field_length=flen)

        json_files = list(Path(input_folder).rglob("*.json"))
        arcpy.AddMessage(f"📂 Xử lý {len(json_files)} inspection")

        count = 0
        for jf in json_files:
            try:
                with open(jf, "r", encoding="utf-8") as f:
                    rec = json.load(f)
                target_id = rec.get("assetId") or rec.get("targetId") or rec.get("properties", {}).get(id_field)
                if not target_id:
                    continue

                where = f"{id_field} = '{target_id}'"
                with arcpy.da.UpdateCursor(fc, ["INSP_DATE", "INSP_STATUS", "INSP_NOTE", "INSP_BY"], where) as cur:
                    for row in cur:
                        row[0] = datetime.fromtimestamp(rec.get("timestamp", 0) / 1000)
                        row[1] = rec.get("status", "")
                        row[2] = rec.get("notes", "")[:500]
                        row[3] = rec.get("inspectorName", "")
                        cur.updateRow(row)
                        count += 1
            except Exception as e:
                arcpy.AddWarning(f"⚠ {jf.name}: {e}")

        arcpy.AddMessage(f"✅ Cập nhật {count} inspection vào FC")


# ============================================================
# Tool 3: Sync from Google Drive (auto-download)
# ============================================================
class SyncFromDrive(object):
    def __init__(self):
        self.label = "3. Sync từ Google Drive"
        self.description = "Tự download các submissions/inspections mới từ Google Drive về thư mục local."

    def getParameterInfo(self):
        p0 = arcpy.Parameter("service_account", "Service account JSON key", "DEFile", "Required", "Input")
        p0.filter.list = ["json"]
        p0.displayName = "Service account JSON key"

        p1 = arcpy.Parameter("drive_folder_id", "Drive folder ID (từ PowerMind)", "GPString", "Required", "Input")
        p1.displayName = "Drive folder ID PowerMind"

        p2 = arcpy.Parameter("local_folder", "Thư mục local đích", "DEFolder", "Required", "Input")
        p2.displayName = "Thư mục local đích"

        return [p0, p1, p2]

    def execute(self, parameters, messages):
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
            from googleapiclient.http import MediaIoBaseDownload
        except ImportError:
            arcpy.AddError(
                "❌ Chưa cài thư viện Google. Chạy trong ArcGIS Pro Python:\n"
                "   pip install google-api-python-client google-auth"
            )
            return

        key_file = parameters[0].valueAsText
        folder_id = parameters[1].valueAsText
        local_folder = Path(parameters[2].valueAsText)
        local_folder.mkdir(parents=True, exist_ok=True)

        creds = service_account.Credentials.from_service_account_file(
            key_file, scopes=["https://www.googleapis.com/auth/drive.readonly"]
        )
        service = build("drive", "v3", credentials=creds)

        # List files in folder
        query = f"'{folder_id}' in parents and trashed = false and mimeType = 'application/json'"
        results = service.files().list(q=query, fields="files(id, name, modifiedTime)", pageSize=1000).execute()
        files = results.get("files", [])

        arcpy.AddMessage(f"☁ Tìm thấy {len(files)} file trên Drive")

        downloaded = 0
        for f in files:
            local_path = local_folder / f["name"]
            if local_path.exists():
                continue  # đã có, skip

            request = service.files().get_media(fileId=f["id"])
            with open(local_path, "wb") as fh:
                downloader = MediaIoBaseDownload(fh, request)
                done = False
                while not done:
                    _, done = downloader.next_chunk()
            downloaded += 1
            arcpy.AddMessage(f"   ↓ {f['name']}")

        arcpy.AddMessage(f"✅ Download {downloaded} file mới vào {local_folder}")
