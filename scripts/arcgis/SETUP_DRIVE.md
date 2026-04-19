# 🔐 Setup Google Drive cho PowerMind — 3 PHƯƠNG ÁN

## ⚠️ Nếu gặp lỗi "Service account key creation is disabled"

Đó là Google Workspace organization chặn tạo key service account (security policy).
Dùng 1 trong 3 cách dưới để vòng qua:

| Phương án | Mức độ dễ | Bảo mật | Khuyến nghị |
|-----------|:--:|:--:|:--:|
| **A. OAuth Desktop App** | ⭐⭐⭐ | Tốt | ✅ Nên làm |
| **B. Drive Desktop Sync + local folder** | ⭐⭐⭐⭐⭐ | Rất tốt | ✅ Đơn giản nhất |
| **C. Tài khoản Gmail cá nhân** | ⭐⭐⭐⭐ | Trung bình | Nếu Workspace khó |

## Folder đã dùng

- **URL:** https://drive.google.com/drive/folders/1vSYVCjGCpcIyG2D2UkhJ-QrhwSLY1pOR
- **Folder ID:** `1vSYVCjGCpcIyG2D2UkhJ-QrhwSLY1pOR`

---

# 🅐 PHƯƠNG ÁN A — OAuth 2.0 Desktop App (KHUYẾN NGHỊ)

OAuth Client ID KHÔNG bị chặn như service account key. Admin login 1 lần, refresh token lưu local → chạy tự động vĩnh viễn.

## Bước 1 — Tạo OAuth Client ID

1. Vào https://console.cloud.google.com/
2. Chọn project PowerMind (hoặc tạo nếu chưa có)
3. **APIs & Services** → **OAuth consent screen**:
   - User Type: **Internal** (nếu tổ chức cho phép) hoặc **External**
   - App name: `PowerMind`
   - User support email: email admin
   - Developer contact: email admin
   - **Save**
4. **APIs & Services** → **Library** → tìm **Google Drive API** → **Enable**
5. **APIs & Services** → **Credentials**:
   - **+ CREATE CREDENTIALS** → **OAuth client ID**
   - Application type: **Desktop app**
   - Name: `powermind-desktop`
   - **Create**
6. Click **DOWNLOAD JSON** → file dạng `client_secret_xxxx.json`
7. Rename file → `client_secret.json`
8. Copy vào `d:\DUAN_AI\Web KTLD\scripts\arcgis\client_secret.json`

## Bước 2 — Test + lấy refresh token

```powershell
cd "d:\DUAN_AI\Web KTLD\scripts\arcgis"

# Cài thư viện
"C:\Program Files\ArcGIS\Pro\bin\Python\scripts\propy.bat" install google-api-python-client google-auth google-auth-oauthlib

# Chạy lần đầu
"C:\Program Files\ArcGIS\Pro\bin\Python\propy.bat" daily_sync.py
```

Trình duyệt sẽ mở → login Google → **Allow** quyền Drive → browser hiện "authentication successful".
Script tự lưu token vào `token.json`. Lần sau chạy không hỏi nữa.

**⚠️ File `client_secret.json` và `token.json` KHÔNG commit lên GitHub** — đã gitignore.

---

# 🅑 PHƯƠNG ÁN B — Google Drive Desktop Sync (ĐƠN GIẢN NHẤT)

Không cần API, không cần token. Chỉ cần cài Drive Desktop, folder auto-sync xuống máy → script đọc trực tiếp.

## Bước 1 — Cài Google Drive for Desktop

1. Tải: https://www.google.com/drive/download/
2. Cài đặt → login bằng email EVN
3. Chọn **Stream files** (không chọn Mirror để tiết kiệm ổ cứng)

## Bước 2 — Thêm shortcut folder PowerMind

1. Mở https://drive.google.com/drive/folders/1vSYVCjGCpcIyG2D2UkhJ-QrhwSLY1pOR
2. Chuột phải vào folder → **Organize** → **Add shortcut to Drive**
3. Chọn **My Drive** → **Add**
4. Đợi 1-2 phút → folder sync về máy

## Bước 3 — Tìm đường dẫn local

Folder sẽ ở:
```
G:\My Drive\PowerMind\
  (hoặc drive letter Google gán, có thể là H: / I:)
```

## Bước 4 — Cập nhật config.json

Mở `d:\DUAN_AI\Web KTLD\scripts\arcgis\config.json`, thay:
```json
{
  "drive": {
    "mode": "local_sync",
    "local_path": "G:\\My Drive\\PowerMind"
  },
  ...
}
```

## Bước 5 — Test

```powershell
"C:\Program Files\ArcGIS\Pro\bin\Python\propy.bat" daily_sync.py
```

Script sẽ đọc file trực tiếp từ Drive Desktop sync — không cần Drive API.

**Ưu điểm phương án B:**
- Không cần OAuth / service account gì hết
- Drive Desktop tự sync 2 chiều
- Data trên Drive = data trên máy (realtime)

**Nhược điểm:**
- Phải cài Drive Desktop
- Máy phải online để sync

---

# 🅒 PHƯƠNG ÁN C — Tài khoản Gmail cá nhân

Nếu Workspace EVN chặn cả OAuth thì dùng Gmail cá nhân:

1. Tạo Gmail mới: `powermind.evn@gmail.com`
2. Tạo folder PowerMind mới trong Drive của Gmail này
3. Share folder `1vSYVCj...` cho Gmail này (Editor quyền)
4. Làm Phương án A nhưng OAuth với Gmail cá nhân

**Nhược điểm:** Data chia sẻ qua tài khoản ngoài tổ chức, bảo mật kém hơn.

---

## Cấu trúc folder cần tạo (cho CẢ 3 phương án)

Vào https://drive.google.com/drive/folders/1vSYVCjGCpcIyG2D2UkhJ-QrhwSLY1pOR tạo 4 sub-folder:

```
PowerMind (root)
├── submissions/       ← JSON điểm mới
├── photos/            ← Ảnh chụp hiện trường
├── inspections/       ← JSON kiểm tra
└── _archived/         ← Auto-move sau import
```

---

## Cài Task Scheduler (sau khi test OK 1 trong 3 phương án)

1. Mở **Task Scheduler** (Windows)
2. **Create Task** → tab **General**:
   - Name: `PowerMind Daily Sync`
   - Run with highest privileges ✓
3. **Triggers** → **New**:
   - Daily, lặp **mỗi 6 giờ**
4. **Actions** → **New**:
   - Program: `C:\Program Files\ArcGIS\Pro\bin\Python\propy.bat`
   - Arguments: `d:\DUAN_AI\Web KTLD\scripts\arcgis\daily_sync.py`
5. OK → nhập password Windows

Máy tự chạy 4 lần/ngày, không cần động.

---

## 🆘 Troubleshooting

### OAuth báo "redirect_uri_mismatch"
→ OAuth client type phải chọn **Desktop app**, không phải Web.

### Drive Desktop không sync
→ Mở Drive Desktop trong system tray → Pause → Resume.
→ Hoặc restart máy.

### Policy cản tạo OAuth client
→ Liên hệ IT EVN / Workspace admin, nhờ disable tạm policy:
`iam.disableServiceAccountKeyCreation`
Hoặc thêm bạn vào Organization Policy Administrator role.

### Workspace không cho tạo project
→ Dùng Gmail cá nhân (Phương án C)

---

## 🔒 Checklist bảo mật

- [ ] `client_secret.json` nằm trong `scripts/arcgis/` và **đã gitignore**
- [ ] `token.json` chỉ ở local, không commit
- [ ] Folder Drive share hạn chế (Editor cho dev + Viewer cho người review)
- [ ] Backup folder định kỳ (Google Takeout)
- [ ] Revoke OAuth token nếu mất máy: https://myaccount.google.com/permissions

---

## 📞 Khuyến nghị cuối cùng

**Nếu anh không rành IT / muốn đơn giản nhất:**
→ Làm **Phương án B (Drive Desktop Sync)**. Cài phần mềm, login 1 lần, xong.

**Nếu anh muốn chuyên nghiệp + automate cloud:**
→ Làm **Phương án A (OAuth Desktop)**. Setup phức tạp hơn chút nhưng chạy headless.

**Nếu Workspace EVN chặn hết:**
→ **Phương án C (Gmail cá nhân)**. Tạo Gmail riêng cho app, không dính EVN.

Chọn xong nói tôi → tôi update `daily_sync.py` phù hợp.
