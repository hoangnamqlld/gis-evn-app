# 🔐 Setup Google Drive cho PowerMind

## Folder đã được cấu hình

- **URL:** https://drive.google.com/drive/folders/1vSYVCjGCpcIyG2D2UkhJ-QrhwSLY1pOR
- **Folder ID:** `1vSYVCjGCpcIyG2D2UkhJ-QrhwSLY1pOR`

## Cấu trúc folder cần tạo

Vào folder trên, tạo 4 sub-folder này bằng tay (1 lần duy nhất):

```
PowerMind (root 1vSYVCj...)
├── submissions/       ← JSON điểm mới (meter, trụ, trạm)
├── photos/            ← Ảnh chụp hiện trường
├── inspections/       ← JSON kiểm tra trụ/trạm
└── _archived/         ← Data đã xử lý (tool tự move vào)
```

### Cách tạo

1. Mở https://drive.google.com/drive/folders/1vSYVCjGCpcIyG2D2UkhJ-QrhwSLY1pOR
2. Chuột phải vùng trống → **New folder** → đặt tên `submissions`
3. Lặp lại với `photos`, `inspections`, `_archived`

## Tạo Service Account (để ArcGIS + app có quyền đọc/ghi)

### Bước 1: Tạo project Google Cloud (nếu chưa có)

1. Vào https://console.cloud.google.com/
2. Dropdown project (góc trên) → **New Project**
3. Name: `PowerMind` → **Create**

### Bước 2: Enable Drive API

1. Trong project → menu trái **APIs & Services** → **Library**
2. Tìm **Google Drive API** → **Enable**

### Bước 3: Tạo Service Account

1. **APIs & Services** → **Credentials**
2. **+ CREATE CREDENTIALS** → **Service account**
3. Name: `powermind-drive-sync`
4. ID tự gen dạng `powermind-drive-sync@<project>.iam.gserviceaccount.com`
5. Skip các bước optional → **Done**

### Bước 4: Tạo key JSON

1. Click vào service account vừa tạo
2. Tab **Keys** → **Add Key** → **Create new key**
3. Chọn **JSON** → **Create**
4. File JSON tự download về máy

### Bước 5: Đặt key vào đúng chỗ

Copy file JSON vừa download vào:
```
d:\DUAN_AI\Web KTLD\scripts\arcgis\drive-key.json
```

**⚠️ KHÔNG commit file này lên GitHub** — đã gitignore.

### Bước 6: Share folder Drive cho service account

1. Mở folder: https://drive.google.com/drive/folders/1vSYVCjGCpcIyG2D2UkhJ-QrhwSLY1pOR
2. Chuột phải → **Share**
3. Paste email service account (`powermind-drive-sync@...iam.gserviceaccount.com`)
4. Quyền: **Editor** (để app upload được, ArcGIS đọc được)
5. **Send** (bỏ tick "Notify people")

## Test kết nối

Mở PowerShell, chạy:

```powershell
cd "d:\DUAN_AI\Web KTLD\scripts\arcgis"

# Cài thư viện (1 lần)
"C:\Program Files\ArcGIS\Pro\bin\Python\scripts\propy.bat" install google-api-python-client google-auth

# Test
"C:\Program Files\ArcGIS\Pro\bin\Python\propy.bat" daily_sync.py
```

Nếu thành công sẽ thấy:
```
[...] 🚀 POWERMIND DAILY SYNC
[...]    ↓ submissions: 0/0 file moi
[...]    ↓ inspections: 0/0 file moi
[...] ✓ Khong co data moi hom nay. Ket thuc.
```

Folder trống nên 0 file — đúng.

## Cài Task Scheduler chạy tự động

1. Mở **Task Scheduler** (Windows)
2. **Create Task** → tab **General**:
   - Name: `PowerMind Daily Sync`
   - Run whether user is logged on or not → ✓
   - Run with highest privileges → ✓
3. Tab **Triggers** → **New**:
   - Begin: On a schedule
   - Daily — lặp **mỗi 6 giờ** (6:00, 12:00, 18:00, 0:00)
4. Tab **Actions** → **New**:
   - Action: Start a program
   - Program:  `C:\Program Files\ArcGIS\Pro\bin\Python\propy.bat`
   - Arguments: `d:\DUAN_AI\Web KTLD\scripts\arcgis\daily_sync.py`
   - Start in: `d:\DUAN_AI\Web KTLD\scripts\arcgis`
5. Tab **Conditions** → bỏ tick "Start only if on AC power" nếu dùng laptop
6. **OK** → nhập password Windows

Xong. Máy tự chạy 4 lần/ngày, anh không cần động.

## Test với 1 file mẫu

Tạo file `test.json` nội dung:
```json
{
  "id": "test-001",
  "type": "meter",
  "coords": { "lat": 11.002, "lng": 106.507 },
  "properties": {
    "KH_ID": "PE09999999999",
    "TEN_KHANG": "Khách hàng test",
    "DIA_CHI_KH": "Test Củ Chi",
    "SOTRU": "ST/TEST/001"
  },
  "collectorName": "Admin Test",
  "timestamp": 1713524000000,
  "status": "approved"
}
```

Upload vào folder `submissions/` trên Drive → chạy `daily_sync.py` → phải thấy:
```
   ↓ submissions: 1/1 file moi
▶ Chay tool Import Submissions...
✅ Imported: 1
   - meter: 1
▶ Trigger CAP_NHAT_VA_DEPLOY.bat...
✅ Deploy xong
```

5 phút sau: app gis-evn-app.pages.dev → search `PE09999999999` → ra điểm test đó.

Xong = **pipeline khép kín hoạt động đúng**.

---

## 🔒 Bảo mật

| Thứ | Ai giữ | Không được làm |
|-----|--------|----------------|
| `drive-key.json` | Chỉ máy admin | Không commit, không share qua email |
| Service account email | Có thể share | Không tạo thêm role/permission ngoài Drive |
| Folder Drive | Viewer cho team | Chỉ admin có Editor |

Nếu mất key → vào Google Cloud Console xoá key cũ + tạo key mới.

## 🆘 Troubleshooting

### `Service Accounts disabled in this organization`
→ Google Workspace admin đã tắt. Xin IT EVN enable, hoặc dùng personal Gmail.

### `403 insufficientPermissions`
→ Quên share folder cho service account. Xem Bước 6.

### `ImportError: google.oauth2`
→ Chưa cài thư viện. Xem "Test kết nối".

### Task Scheduler không chạy
→ Mở Task Scheduler → History tab → xem lỗi.
→ Thử chạy tay script xem pass không, rồi mới setup scheduler.
