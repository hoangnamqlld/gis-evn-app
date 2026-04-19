# 📘 Hướng dẫn Admin — Cập nhật dữ liệu & Deploy

## 🎯 Câu trả lời nhanh

| Kịch bản | Làm gì |
|----------|--------|
| **Dữ liệu GIS đổi** (có GDB mới từ EVN) | Click 2 lần vào `CAP_NHAT_VA_DEPLOY.bat` |
| **Chỉ sửa code/UI** | Click 2 lần vào `DEPLOY_NHANH.bat` |
| **Xem tiến độ deploy** | Mở https://github.com/hoangnamqlld/gis-evn-app/actions |
| **Kiểm tra app live** | Mở https://gis-evn-app.pages.dev |

---

## 🔄 Quy trình CẬP NHẬT DỮ LIỆU (chi tiết)

### Khi nào dùng
- EVN gửi Geodatabase (GDB) mới hàng tuần/tháng
- Cập nhật customers.csv
- Thêm KH / đổi thông tin trụ / thêm trạm mới

### Cách làm

1. **Copy GDB mới** vào: `Dulieugismoi/07042026/New File Geodatabase.gdb/`
   *(giữ nguyên tên thư mục cho auto-deploy.py tìm được)*

2. **Double-click** `CAP_NHAT_VA_DEPLOY.bat`

3. Đợi ~3-5 phút (script tự chạy 4 bước):
   ```
   [1/4] 📥 Xuất GeoJSON từ Geodatabase
   [2/4] 🗂️  Chia tile + build search index
   [3/4] 📝 Commit changes
   [4/4] ☁️  Push lên GitHub (trigger auto-deploy)
   ```

4. Script tự mở trang GitHub Actions để anh theo dõi

5. Đợi thêm **5-7 phút** cho CI/CD deploy xong

6. **100 user** mở app → thấy banner **"Có dữ liệu mới"** → bấm 1 nút là cập nhật

### Tổng thời gian: 10-15 phút, KHÔNG cần thao tác gì khác

---

## ⚡ Quy trình DEPLOY NHANH (chỉ code, không đổi data)

### Khi nào dùng
- Sửa giao diện / fix bug UI
- Thêm feature mới
- Cập nhật thư viện

### Cách làm

1. **Sửa code** trong thư mục `thuthaptoado/src/...`

2. **Double-click** `DEPLOY_NHANH.bat`

3. Script hiện danh sách thay đổi → gõ Y → Enter

4. Nhập commit message ngắn (hoặc Enter để dùng mặc định)

5. Script tự push + mở Actions

6. **3-5 phút sau** → app live có code mới

---

## 🆘 Khi script báo lỗi

### `❌ Python chua cai`
Tải Python 3.11+: https://www.python.org/downloads/
Tick **"Add Python to PATH"** khi cài.

### `❌ Git chua cai`
Tải Git: https://git-scm.com/download/win

### `❌ Push FAIL`
Đăng nhập GitHub CLI (1 lần duy nhất):
```bash
winget install GitHub.cli
gh auth login
```
Chọn GitHub.com → HTTPS → Login with browser → paste code → xong.
Sau đó chạy lại script.

### `❌ Loi khi chay auto-deploy.py`
Check GDB path + thư viện. Mở terminal tại `Dulieugismoi\luoi-dien-app\automation\`:
```bash
python auto-deploy.py
```
Xem error chi tiết. Thường do:
- GDB path sai → sửa trong `auto-deploy.py`
- Thiếu `pip install geopandas pyproj`

### `❌ Build tile fail` (hiếm)
Chạy tay:
```bash
cd d:\DUAN_AI\Web KTLD
python scripts\build_tiles.py
```
Nếu lỗi → báo dev.

---

## 📊 Monitor app sau khi deploy

### Cloudflare Analytics
https://dash.cloudflare.com → Workers & Pages → `gis-evn-app` → **Metrics**
- Số request/ngày
- Bandwidth
- Top URL được gọi

### GitHub Actions log
https://github.com/hoangnamqlld/gis-evn-app/actions
- Xem lịch sử deploy
- Nếu đỏ → click vào xem fail step nào

### Test app live
https://gis-evn-app.pages.dev
- Kiểm tra data mới có hiện chưa
- Test tìm KH → search có ra đúng không

---

## 🔐 Bảo mật

**KHÔNG** commit:
- File JSON chứa key (đã gitignore: `evn-*.json`, `*service-account*.json`)
- Thư mục Geodatabase thô (đã gitignore: `*.gdb/`)
- Token GitHub / API keys

Script `CAP_NHAT_VA_DEPLOY.bat` đã tuân thủ — chỉ commit:
- File GeoJSON đã xuất (không có secret)
- Code TypeScript

---

## 🎓 Best practices

1. **Backup trước khi update data lớn:**
   ```bash
   git tag -a v-data-2026-04-19 -m "Backup trước update"
   git push --tags
   ```
   Nếu deploy fail: `git checkout v-data-2026-04-19 -- .`

2. **Test local trước khi push:**
   Chạy `KHOI_DONG_PowerMind.bat` → mở http://localhost:3001/app/ trước → OK mới push.

3. **Commit thường xuyên, commit nhỏ:**
   Thay vì update 1 tháng 1 lần, update 1 tuần để easier debug.

4. **Đừng chỉnh sửa trực tiếp trên GitHub web editor** cho file code — dễ break workflow.

---

## 📞 Khi cần giúp

- Dev (tôi): paste log/screenshot lỗi
- GitHub Issue: https://github.com/hoangnamqlld/gis-evn-app/issues
- Cloudflare support: Ask AI trong dashboard
