# -*- coding: utf-8 -*-
"""
daily_sync.py — Script tự động chạy hàng ngày:
  1. Download submissions/inspections từ Google Drive
  2. Import vào ArcGIS Feature Class
  3. Trigger build tile + deploy Cloudflare

Cài Windows Task Scheduler:
  Trigger: Daily 06:00 + 12:00 + 18:00
  Action:  "C:\\Program Files\\ArcGIS\\Pro\\bin\\Python\\scripts\\propy.bat"
           "d:\\DUAN_AI\\Web KTLD\\scripts\\arcgis\\daily_sync.py"

Yeu cau:
  pip install google-api-python-client google-auth
"""

import json
import sys
import subprocess
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_PATH = SCRIPT_DIR / "config.json"

if not CONFIG_PATH.exists():
    print("❌ Khong tim thay config.json")
    sys.exit(1)

with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    CONFIG = json.load(f)


def log(msg):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def sync_drive_folder(subfolder: str):
    """Download toan bo JSON tu Drive subfolder ve local."""
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaIoBaseDownload
    except ImportError:
        log("❌ Chua cai google-api-python-client. Chay:")
        log("   propy pip install google-api-python-client google-auth")
        sys.exit(1)

    import io

    key_file = SCRIPT_DIR / "drive-key.json"
    if not key_file.exists():
        log(f"❌ Khong tim thay {key_file}. Xem README de setup.")
        return 0

    creds = service_account.Credentials.from_service_account_file(
        str(key_file), scopes=["https://www.googleapis.com/auth/drive"]
    )
    service = build("drive", "v3", credentials=creds)

    # Tim subfolder trong root folder
    root_id = CONFIG["drive"]["root_folder_id"]
    q = f"'{root_id}' in parents and name = '{subfolder}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    result = service.files().list(q=q, fields="files(id,name)").execute()
    folders = result.get("files", [])
    if not folders:
        log(f"⚠ Khong tim thay subfolder '{subfolder}' trong Drive root")
        return 0
    sub_id = folders[0]["id"]

    # List file trong subfolder
    q2 = f"'{sub_id}' in parents and mimeType = 'application/json' and trashed = false"
    page_token = None
    files = []
    while True:
        r = service.files().list(
            q=q2, fields="nextPageToken, files(id, name, modifiedTime)",
            pageSize=1000, pageToken=page_token
        ).execute()
        files.extend(r.get("files", []))
        page_token = r.get("nextPageToken")
        if not page_token:
            break

    local_dir = Path(CONFIG["local"]["download_folder"]) / subfolder
    local_dir.mkdir(parents=True, exist_ok=True)

    downloaded = 0
    for f in files:
        local_path = local_dir / f["name"]
        if local_path.exists():
            continue
        request = service.files().get_media(fileId=f["id"])
        buf = io.BytesIO()
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        local_path.write_bytes(buf.getvalue())
        downloaded += 1
    log(f"   ↓ {subfolder}: {downloaded}/{len(files)} file moi")
    return downloaded


def run_arcgis_toolbox(submissions_count, inspections_count):
    """Chay ArcGIS Python Toolbox de import."""
    if submissions_count == 0 and inspections_count == 0:
        log("   (Khong co data moi, bo qua arcpy)")
        return

    try:
        import arcpy
    except ImportError:
        log("❌ arcpy chua co. Script nay phai chay bang ArcGIS Pro Python.")
        sys.exit(1)

    toolbox = str(SCRIPT_DIR / "PowerMind_Toolbox.pyt")
    arcpy.ImportToolbox(toolbox)

    gdb = CONFIG["gdb"]["path"]
    fc = CONFIG["gdb"]["feature_classes"]
    downloads = CONFIG["local"]["download_folder"]

    if submissions_count > 0:
        log("▶ Chay tool Import Submissions...")
        arcpy.PowerMind.ImportSubmissions(
            input_folder=f"{downloads}/submissions",
            fc_meter=f"{gdb}/{fc['meter']}",
            fc_pole_lv=f"{gdb}/{fc['pole_lv']}",
            fc_pole_mv=f"{gdb}/{fc['pole_mv']}",
            fc_substation=f"{gdb}/{fc['substation']}",
            approved_only=True,
            move_archived=True,
        )

    if inspections_count > 0:
        log("▶ Chay tool Import Inspections...")
        for fc_type in ["meter", "pole_lv", "pole_mv", "substation"]:
            arcpy.PowerMind.ImportInspections(
                input_folder=f"{downloads}/inspections",
                fc_target=f"{gdb}/{fc[fc_type]}",
                id_field="MATHIETBI",
            )


def trigger_deploy():
    """Goi CAP_NHAT_VA_DEPLOY.bat de build tile + push."""
    batch = CONFIG["deploy"]["trigger_batch"]
    if not Path(batch).exists():
        log(f"⚠ Khong tim thay {batch}")
        return
    log(f"▶ Trigger {batch}...")
    try:
        subprocess.run([batch], shell=True, check=True, timeout=600)
        log("✅ Deploy xong")
    except subprocess.TimeoutExpired:
        log("⚠ Deploy timeout 10 phut — kiem tra log rieng")
    except subprocess.CalledProcessError as e:
        log(f"❌ Deploy fail: {e}")


def main():
    log("=" * 60)
    log("🚀 POWERMIND DAILY SYNC")
    log("=" * 60)

    submissions_count = sync_drive_folder("submissions")
    inspections_count = sync_drive_folder("inspections")

    if submissions_count + inspections_count == 0:
        log("✓ Khong co data moi hom nay. Ket thuc.")
        return

    run_arcgis_toolbox(submissions_count, inspections_count)

    if CONFIG["deploy"]["auto_trigger_after_import"]:
        trigger_deploy()

    log("=" * 60)
    log(f"🎉 HOAN THANH: {submissions_count} submissions + {inspections_count} inspections")
    log("=" * 60)


if __name__ == "__main__":
    main()
