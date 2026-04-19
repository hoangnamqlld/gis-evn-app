# 🗺️ PowerMind ArcGIS Toolbox

Công cụ import dữ liệu thu thập hiện trường vào ArcGIS Feature Class.

## 📦 File

- `PowerMind_Toolbox.pyt` — Python Toolbox chính (3 tool)

## 🚀 Cài đặt (1 lần)

### 1. Cài thư viện Google Drive (cho tool "Sync from Drive")

Mở **ArcGIS Pro** → **Project** → **Python** → **Manage Environments**:

```bash
# Clone default env rồi install vào clone
pip install google-api-python-client google-auth
```

Hoặc mở **Command Prompt** ở ArcGIS Python env:
```
"C:\Program Files\ArcGIS\Pro\bin\Python\scripts\propy.bat" install google-api-python-client google-auth
```

### 2. Add Toolbox vào ArcGIS Pro

1. Mở ArcGIS Pro → **Catalog pane**
2. Chuột phải **Toolboxes** → **Add Toolbox**
3. Browse đến `d:\DUAN_AI\Web KTLD\scripts\arcgis\PowerMind_Toolbox.pyt`
4. Toolbox xuất hiện với 3 tool:
   - `1. Import Submissions`
   - `2. Import Inspections`
   - `3. Sync từ Google Drive`

## 📋 Quy trình hàng ngày

### Option A: Manual (khuyến nghị lần đầu)

1. Công nhân collect data → upload Drive folder `PowerMind/submissions/`
2. Mở ArcGIS Pro → chạy tool **3. Sync từ Google Drive**
   - Input: service account JSON + folder ID + thư mục local
   - Output: download JSON mới về máy
3. Chạy tool **1. Import Submissions**
   - Input: thư mục JSON vừa sync
   - Chọn FC đích cho từng loại (meter/pole_lv/pole_mv/substation)
   - Output: features được append vào GDB
4. (Nếu có kiểm tra) chạy tool **2. Import Inspections**
5. Sau khi xong → chạy `CAP_NHAT_VA_DEPLOY.bat` để deploy lên Cloudflare

### Option B: Automation script (khuyến nghị khi ổn)

Tạo Windows Task Scheduler gọi script Python:

```python
# daily_sync.py
import arcpy
arcpy.ImportToolbox(r"d:\DUAN_AI\Web KTLD\scripts\arcgis\PowerMind_Toolbox.pyt")

# 1. Sync Drive
arcpy.PowerMind.SyncFromDrive(
    service_account=r"C:\keys\drive-sync.json",
    drive_folder_id="1abc...xyz",
    local_folder=r"d:\PowerMind\submissions"
)

# 2. Import
arcpy.PowerMind.ImportSubmissions(
    input_folder=r"d:\PowerMind\submissions",
    fc_meter=r"d:\GIS\master.gdb\F05_DienKe",
    fc_pole_lv=r"d:\GIS\master.gdb\F07_Tru_HT",
    fc_pole_mv=r"d:\GIS\master.gdb\F08_Tru_TT",
    fc_substation=r"d:\GIS\master.gdb\F04_Tram_TT",
    approved_only=True,
    move_archived=True
)

# 3. Trigger deploy
import subprocess
subprocess.run(["d:\\DUAN_AI\\Web KTLD\\CAP_NHAT_VA_DEPLOY.bat"], shell=True)
```

Task Scheduler: 6:00 + 12:00 + 18:00 hàng ngày.

## 🔑 Setup Google Drive service account

Cần 1 lần duy nhất để tool `Sync from Drive` hoạt động:

1. Vào https://console.cloud.google.com/ → chọn project
2. **IAM & Admin** → **Service Accounts** → **Create service account**
   - Name: `powermind-drive-reader`
   - Role: Viewer (hoặc Editor)
3. **Keys** → **Add Key** → **JSON** → download file JSON
4. Copy file JSON vào `C:\keys\drive-sync.json` (đừng commit lên GitHub!)
5. Vào Google Drive → tạo folder `PowerMind/submissions` → share với email service account (viewer quyền)
6. Copy folder ID từ URL (dạng `1abc...xyz`)

## 🔧 Thêm tool mới

Chỉnh sửa file `.pyt` rồi refresh toolbox trong ArcGIS:

```python
class YourNewTool(object):
    def __init__(self):
        self.label = "4. Your Tool"
        self.description = "..."
    
    def getParameterInfo(self):
        return [...]
    
    def execute(self, parameters, messages):
        # your logic
        pass
```

Rồi thêm vào `Toolbox.tools`:
```python
self.tools = [ImportSubmissions, ImportInspections, SyncFromDrive, YourNewTool]
```

## 🆘 Troubleshooting

### `ImportError: No module named google`
→ Chưa cài thư viện. Xem phần **Cài đặt** ở trên.

### Tool hiện đỏ trong ArcGIS
→ File .pyt có lỗi syntax. Chuột phải → Refresh. Xem log tại View → Geoprocessing → History.

### `FC target không có field X`
→ Tool tự AddField. Nếu không được → quyền ghi FC bị lock, mở FC ngoài app khác đang dùng.

### Coords không hợp lệ
→ JSON submission có lat/lng = 0 hoặc null. Kiểm tra data raw.

### Duplicate import 1 record nhiều lần
→ Tick "move_archived" để tool tự chuyển file sang `_archived` sau import.

## 📞 Liên hệ

Dev: hoangnamqlld2020@gmail.com
Repo: https://github.com/hoangnamqlld/gis-evn-app
