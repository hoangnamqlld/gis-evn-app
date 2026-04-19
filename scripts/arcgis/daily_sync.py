# -*- coding: utf-8 -*-
"""
daily_sync.py — Script tu dong PowerMind Daily Sync
Support 3 auth mode:
  - oauth:      OAuth Desktop (client_secret.json + token.json)
  - local_sync: Google Drive Desktop - doc tu folder local
  - service:    Service Account (neu org cho phep)

Cai Windows Task Scheduler:
  Program:   C:\\Program Files\\ArcGIS\\Pro\\bin\\Python\\propy.bat
  Arguments: d:\\DUAN_AI\\Web KTLD\\scripts\\arcgis\\daily_sync.py
  Trigger:   Daily every 6 hours
"""

import io
import json
import shutil
import subprocess
import sys
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


# ============================================================
# MODE 1: OAuth Desktop App
# ============================================================
def get_drive_service_oauth():
    """OAuth Desktop flow — mo browser lan dau de login."""
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
    except ImportError:
        log("❌ Chua cai thu vien. Chay:")
        log("   propy pip install google-api-python-client google-auth google-auth-oauthlib")
        sys.exit(1)

    SCOPES = ["https://www.googleapis.com/auth/drive"]
    token_file = SCRIPT_DIR / "token.json"
    client_secret = SCRIPT_DIR / "client_secret.json"

    if not client_secret.exists():
        log(f"❌ Khong tim thay {client_secret}")
        log("   Xem SETUP_DRIVE.md Phuong an A de tao OAuth Client ID")
        sys.exit(1)

    creds = None
    if token_file.exists():
        creds = Credentials.from_authorized_user_file(str(token_file), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            log("🔄 Refresh OAuth token...")
            creds.refresh(Request())
        else:
            log("🌐 Mo browser de login Google (lan dau duy nhat)...")
            flow = InstalledAppFlow.from_client_secrets_file(str(client_secret), SCOPES)
            creds = flow.run_local_server(port=0)
        token_file.write_text(creds.to_json())
        log(f"✓ Token saved: {token_file}")

    return build("drive", "v3", credentials=creds)


def sync_drive_folder_oauth(service, subfolder: str):
    """Download JSON tu Drive subfolder (OAuth mode)."""
    root_id = CONFIG["drive"]["root_folder_id"]
    q = f"'{root_id}' in parents and name = '{subfolder}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    result = service.files().list(q=q, fields="files(id,name)").execute()
    folders = result.get("files", [])
    if not folders:
        log(f"⚠ Khong tim thay subfolder '{subfolder}' trong Drive root")
        return 0
    sub_id = folders[0]["id"]

    q2 = f"'{sub_id}' in parents and mimeType = 'application/json' and trashed = false"
    page_token = None
    files = []
    while True:
        r = service.files().list(
            q=q2, fields="nextPageToken, files(id, name, modifiedTime)",
            pageSize=1000, pageToken=page_token,
        ).execute()
        files.extend(r.get("files", []))
        page_token = r.get("nextPageToken")
        if not page_token:
            break

    local_dir = Path(CONFIG["local"]["download_folder"]) / subfolder
    local_dir.mkdir(parents=True, exist_ok=True)

    from googleapiclient.http import MediaIoBaseDownload
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
    log(f"   ↓ {subfolder}: {downloaded} file moi (/{len(files)} tong)")
    return downloaded


# ============================================================
# MODE 2: Drive Desktop local sync
# ============================================================
def sync_drive_folder_local(subfolder: str):
    """Copy JSON tu folder Drive Desktop local xuong download folder."""
    drive_local = Path(CONFIG["drive"].get("local_path", ""))
    if not drive_local.exists():
        log(f"❌ Drive Desktop folder khong ton tai: {drive_local}")
        log("   Cai Drive Desktop va add shortcut PowerMind folder vao My Drive")
        sys.exit(1)

    src_dir = drive_local / subfolder
    if not src_dir.exists():
        log(f"⚠ Subfolder '{subfolder}' chua co trong Drive Desktop")
        return 0

    local_dir = Path(CONFIG["local"]["download_folder"]) / subfolder
    local_dir.mkdir(parents=True, exist_ok=True)

    downloaded = 0
    total = 0
    for src_file in src_dir.rglob("*.json"):
        total += 1
        rel = src_file.relative_to(src_dir)
        dst_file = local_dir / rel
        if dst_file.exists():
            continue
        dst_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_file, dst_file)
        downloaded += 1
    log(f"   ↓ {subfolder}: {downloaded} file moi (/{total} tong)")
    return downloaded


# ============================================================
# MODE 3: Service Account (neu org cho phep)
# ============================================================
def get_drive_service_sa():
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    key_file = SCRIPT_DIR / "drive-key.json"
    if not key_file.exists():
        log(f"❌ Khong tim thay {key_file}")
        sys.exit(1)
    creds = service_account.Credentials.from_service_account_file(
        str(key_file), scopes=["https://www.googleapis.com/auth/drive"]
    )
    return build("drive", "v3", credentials=creds)


# ============================================================
# ArcGIS import + deploy
# ============================================================
def run_arcgis_toolbox(submissions_count, inspections_count):
    if submissions_count == 0 and inspections_count == 0:
        log("   (Khong co data moi, bo qua arcpy)")
        return

    try:
        import arcpy
    except ImportError:
        log("")
        log("⚠ arcpy chua co trong Python hien tai.")
        log("  Download da xong (file tai tai: " + str(Path(CONFIG["local"]["download_folder"])) + ")")
        log("")
        log("  De import vao ArcGIS, chay lai bang:")
        log("    run_sync.bat")
        log("  Hoac:")
        log("    \"C:\\Program Files\\ArcGIS\\Pro\\bin\\Python\\scripts\\propy.bat\" daily_sync.py")
        log("")
        if "--download-only" in sys.argv:
            log("✓ --download-only mode: OK, bo qua import")
            return
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
    batch = CONFIG["deploy"]["trigger_batch"]
    if not Path(batch).exists():
        log(f"⚠ Khong tim thay {batch}")
        return
    log(f"▶ Trigger {batch}...")
    try:
        subprocess.run([batch], shell=True, check=True, timeout=600)
        log("✅ Deploy xong")
    except subprocess.TimeoutExpired:
        log("⚠ Deploy timeout 10 phut")
    except subprocess.CalledProcessError as e:
        log(f"❌ Deploy fail: {e}")


# ============================================================
# MAIN
# ============================================================
def main():
    log("=" * 60)
    log("🚀 POWERMIND DAILY SYNC")
    log("=" * 60)

    mode = CONFIG["drive"].get("mode", "oauth")
    log(f"📡 Auth mode: {mode}")

    if mode == "local_sync":
        submissions = sync_drive_folder_local("submissions")
        inspections = sync_drive_folder_local("inspections")
    elif mode == "service":
        service = get_drive_service_sa()
        submissions = sync_drive_folder_oauth(service, "submissions")
        inspections = sync_drive_folder_oauth(service, "inspections")
    else:  # oauth
        service = get_drive_service_oauth()
        submissions = sync_drive_folder_oauth(service, "submissions")
        inspections = sync_drive_folder_oauth(service, "inspections")

    if submissions + inspections == 0:
        log("✓ Khong co data moi hom nay. Ket thuc.")
        return

    run_arcgis_toolbox(submissions, inspections)

    if CONFIG["deploy"]["auto_trigger_after_import"]:
        trigger_deploy()

    log("=" * 60)
    log(f"🎉 HOAN THANH: {submissions} submissions + {inspections} inspections")
    log("=" * 60)


if __name__ == "__main__":
    main()
