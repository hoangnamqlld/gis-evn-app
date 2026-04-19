# 📘 HƯỚNG DẪN TỪNG BƯỚC — POWERMIND ADMIN

> Đọc tuần tự từ đầu đến cuối. Mỗi phần có checkbox — tick vào khi làm xong.
> Nếu vướng bước nào, chụp màn hình gửi cho dev.

---

## PHẦN 1 — KIỂM TRA LẦN ĐẦU (làm 1 lần)

### ✅ Bước 1.1: Xác nhận app đã live

- [ ] Mở trình duyệt Chrome trên máy tính
- [ ] Vào địa chỉ: **https://gis-evn-app.pages.dev**
- [ ] Phải thấy giao diện PowerMind với icon mic + camera + ô tìm kiếm

Nếu thấy trang trắng → chờ 2-3 phút rồi F5. Vẫn trắng → báo dev.

### ✅ Bước 1.2: Test tìm kiếm

- [ ] Bấm ô **TÌM KIẾM THEO MÃ PE, SỐ TRỤ**
- [ ] Gõ `PE09` — phải ra kết quả trong < 1 giây
- [ ] Bấm vào 1 KH → bản đồ bay đến vị trí đó
- [ ] Popup chi tiết hiển thị Mã PE, Tên, Địa chỉ, Điện thoại

### ✅ Bước 1.3: Test chỉ đường

- [ ] Trong popup chi tiết → bấm **CHỈ ĐƯỜNG**
- [ ] Trình duyệt hỏi cho phép truy cập vị trí → bấm **Cho phép**
- [ ] Google Maps mở ở tab mới với lộ trình từ vị trí anh đến KH
- [ ] Nếu báo "không tìm được đường" → thử nút **XEM VỊ TRÍ** (fallback)

### ✅ Bước 1.4: Test ghim + lộ trình

- [ ] Search 3-5 KH khác nhau → mỗi KH bấm nút **GHIM** (vàng)
- [ ] Bấm tab **LỘ TRÌNH** (bottom nav)
- [ ] Thấy danh sách các điểm đã ghim
- [ ] Bấm **TỐI ƯU THỨ TỰ ĐI** → thứ tự sắp xếp lại + báo tiết kiệm X km
- [ ] Bấm icon **share** → copy link vào clipboard

### ✅ Bước 1.5: Test PWA trên điện thoại

- [ ] Mở https://gis-evn-app.pages.dev trên điện thoại
- [ ] Chrome Android: menu `⋮` → **Add to Home Screen**
- [ ] iPhone Safari: icon chia sẻ → **Add to Home Screen**
- [ ] Icon PowerMind xuất hiện trên màn hình chính
- [ ] Bấm icon → app mở fullscreen như app native
- [ ] Ngắt WiFi → F5 → app vẫn chạy (SW cache)

---

## PHẦN 2 — QUY TRÌNH HÀNG NGÀY

### Kịch bản A: Cập nhật dữ liệu GIS từ EVN

**Khi nào dùng:** EVN gửi GDB mới hàng tuần/tháng, hoặc customers.csv đổi.

#### ✅ Bước 2A.1: Copy GDB mới

- [ ] Nhận GDB từ EVN qua Drive/USB
- [ ] Copy vào: `d:\DUAN_AI\Web KTLD\Dulieugismoi\07042026\New File Geodatabase.gdb\`
- [ ] Thay thế file cũ

#### ✅ Bước 2A.2: Chạy script deploy

- [ ] Mở thư mục `d:\DUAN_AI\Web KTLD\`
- [ ] **Double-click** `CAP_NHAT_VA_DEPLOY.bat`
- [ ] Cửa sổ đen hiện ra, tự chạy 4 bước:
  ```
  [1/4] 📥 Xuất GeoJSON từ Geodatabase    (~60s)
  [2/4] 🗂️  Chia tile + build search index (~30s)
  [3/4] 📝 Commit changes                  (~5s)
  [4/4] ☁️  Push lên GitHub                (~10s)
  ```
- [ ] Trình duyệt tự mở trang Actions

#### ✅ Bước 2A.3: Đợi GitHub Actions deploy

- [ ] Trang Actions hiện workflow đang chạy (icon quay vòng)
- [ ] Đợi **5-7 phút** → chuyển xanh ✅
- [ ] Nếu đỏ ❌ → click vào → xem step nào fail → chụp screenshot gửi dev

#### ✅ Bước 2A.4: Verify app đã update

- [ ] Mở https://gis-evn-app.pages.dev trên máy khác (incognito)
- [ ] Phải thấy banner xanh **"Có dữ liệu mới · Cập nhật"** ở đầu trang
- [ ] Bấm **Cập nhật** → F5 → app reload với data mới

**Tổng thời gian: ~10-15 phút** — không cần thao tác gì khác ngoài bấm bat file + đợi.

---

### Kịch bản B: Chỉ sửa code/giao diện (không đổi data)

#### ✅ Bước 2B.1: Sửa code

- [ ] Mở VSCode/editor tại `d:\DUAN_AI\Web KTLD\thuthaptoado\src\`
- [ ] Sửa file cần thiết
- [ ] Save

#### ✅ Bước 2B.2: (Tùy chọn) Test local

- [ ] Mở PowerShell tại `d:\DUAN_AI\Web KTLD\thuthaptoado\`
- [ ] Gõ: `npm run dev`
- [ ] Trình duyệt mở http://localhost:5173 → test thử
- [ ] OK rồi → Ctrl+C để dừng

#### ✅ Bước 2B.3: Push deploy nhanh

- [ ] Double-click `DEPLOY_NHANH.bat`
- [ ] Script hiện danh sách file thay đổi
- [ ] Gõ **Y** → Enter
- [ ] Nhập commit message (hoặc Enter dùng mặc định)
- [ ] Script tự push + mở Actions

#### ✅ Bước 2B.4: Đợi deploy

- [ ] Đợi **3-5 phút** ✅ xanh
- [ ] F5 hard refresh (Ctrl+Shift+R) trên https://gis-evn-app.pages.dev
- [ ] Kiểm tra thay đổi đã live

---

## PHẦN 3 — CHIA SẺ CHO 100 NGƯỜI DÙNG

### ✅ Bước 3.1: Chuẩn bị tin nhắn Zalo

Copy đoạn sau, thay tên đội vào:

```
📱 ỨNG DỤNG POWERMIND — GIS EVN [TÊN ĐỘI]

Cài app trên điện thoại:
1. Mở link: https://gis-evn-app.pages.dev
2. Chrome Android: menu ⋮ → "Thêm vào màn hình chính"
   iPhone Safari: nút chia sẻ → "Thêm vào màn hình chính"
3. Icon xuất hiện như app native

Cách dùng:
• Tìm KH: gõ Mã PE, Tên, Địa chỉ, hoặc SĐT
• 🎤 Nói tiếng Việt để tìm
• 📷 Chụp danh sách KH → tự ghim bulk
• Ghim nhiều điểm → tab Lộ trình → Tối ưu thứ tự đi
• GPS đến gần điểm ghim = tự đánh dấu đã xong
• Chạy offline sau lần đầu

Thắc mắc: liên hệ [NUMBER] hoặc trong nhóm này.
```

### ✅ Bước 3.2: Gửi nhóm Zalo

- [ ] Tin nhắn + link vào nhóm chính
- [ ] Ghim tin nhắn trong nhóm để người mới dễ tìm

### ✅ Bước 3.3: Theo dõi tuần đầu

- [ ] Hỏi 5-10 công nhân đầu tiên: có cài được không? Tìm KH ra không?
- [ ] Bug/phản hồi → note lại → gửi dev sửa
- [ ] Sau 1 tuần: 80% đội dùng được = thành công

---

## PHẦN 4 — MONITOR APP

### ✅ Bước 4.1: Xem số user dùng hàng ngày

- [ ] Mở https://dash.cloudflare.com → **Workers & Pages** → **gis-evn-app**
- [ ] Tab **Metrics** → xem:
  - **Requests:** số request/ngày
  - **Bandwidth:** băng thông dùng
  - **Unique visitors:** số user khác nhau

**Kỳ vọng 100 user:**
- ~1,000-3,000 requests/ngày (vì SW cache)
- ~50-200 MB bandwidth/ngày
- ~100 unique visitors

### ✅ Bước 4.2: Xem lịch sử deploy

- [ ] https://github.com/hoangnamqlld/gis-evn-app/actions
- [ ] Tất cả deploy gần đây + status
- [ ] Deploy fail → click vào xem log

### ✅ Bước 4.3: Kiểm tra dung lượng data

- [ ] Khi GeoJSON > 1GB, LFS bandwidth có thể bị giới hạn
- [ ] https://github.com/hoangnamqlld/gis-evn-app/settings/billing → xem LFS usage

---

## PHẦN 5 — TROUBLESHOOT

### Triệu chứng: App mở nhưng data không hiện

**Nguyên nhân thường gặp:**
1. Service Worker cache cũ
2. Deploy chưa xong

**Xử lý:**
- [ ] Ctrl+Shift+R hard refresh
- [ ] Hoặc F12 → Application → Service Workers → Unregister → F5
- [ ] Hoặc mở incognito

### Triệu chứng: Script CAP_NHAT báo "Python chưa cài"

- [ ] Tải: https://www.python.org/downloads/
- [ ] Cài đặt, TICK **"Add Python to PATH"** (quan trọng!)
- [ ] Đóng script, chạy lại

### Triệu chứng: Git push báo lỗi auth

- [ ] Mở PowerShell
- [ ] Gõ: `gh auth status`
- [ ] Nếu "not logged in":
  ```
  winget install GitHub.cli
  ```
- [ ] Đóng/mở lại PowerShell
- [ ] Gõ: `gh auth login`
- [ ] Chọn: GitHub.com → HTTPS → Login with browser
- [ ] Browser mở → paste code → xong
- [ ] Chạy lại script

### Triệu chứng: Actions fail ở step "Build data tiles"

- [ ] Click vào run → expand step "Build data tiles"
- [ ] Đọc error đỏ ở cuối log
- [ ] Thường do GeoJSON corrupt → chạy lại `CAP_NHAT_DU_LIEU.bat` rồi deploy lại

### Triệu chứng: Actions fail ở step "Verify LFS"

- [ ] GitHub LFS free tier 1GB/tháng, có thể hết
- [ ] Đợi qua ngày 1 tháng tiếp theo (reset quota)
- [ ] Hoặc upgrade LFS pack $5/tháng

### Triệu chứng: Cloudflare báo "Build failed"

- [ ] Thường do dùng "Direct Upload" thay vì GitHub Actions
- [ ] Disable tự-build trong Cloudflare project settings
- [ ] Pages project → Settings → Builds → Disable automatic deployments

---

## PHẦN 6 — NÂNG CẤP TƯƠNG LAI

### Khi nào cần custom domain `powermind.evn.vn`?

**Lợi ích:** Professional, dễ nhớ, brand company.
**Chi phí:** ~$10/năm cho domain.

- [ ] Mua domain `.vn` tại Mắt Bão / Nhân Hòa / hoặc Cloudflare Registrar
- [ ] Cloudflare Pages → **Custom domains** → **Add custom domain** → paste tên
- [ ] Cloudflare tự cấu hình DNS (nếu mua qua CF Registrar)
- [ ] 5 phút sau domain chạy

### Khi nào nâng lên Cloudflare Pro ($20/tháng)?

**Chỉ cần khi:**
- > 10,000 user concurrent (hiện 100)
- Cần SLA 99.99% uptime
- Muốn analytics chi tiết hơn

**Không cần với 100 user** — free tier dư.

### Khi nào thêm tính năng mới?

**Ưu tiên nên xin thêm:**
- [ ] **Route TSP với Google Directions API** (hiện là nearest-neighbor local, có thể tối ưu thêm 10%)
- [ ] **Camera AR** — chỉ máy cameraPhone trụ điện → hiện overlay số trụ + thông tin KH
- [ ] **Voice note** — ghi âm ngắn thay vì gõ
- [ ] **Report hàng ngày** — auto xuất Excel gửi Zalo nhóm

Khi muốn → liên hệ dev, báo priority list.

---

## PHẦN 7 — KIỂM TRA ĐỊNH KỲ

### ✅ Hàng tuần

- [ ] Chạy app, thử tìm 1 KH để đảm bảo còn chạy
- [ ] Xem Cloudflare Metrics — có spike bất thường không
- [ ] Kiểm tra feedback từ đội trong nhóm Zalo

### ✅ Hàng tháng

- [ ] Cập nhật GIS data từ EVN (nếu có bản mới)
- [ ] Backup repo: `git tag v-month-2026-XX && git push --tags`
- [ ] Review GitHub Actions LFS usage
- [ ] Đọc tin nhắn Cloudflare (nếu có)

### ✅ Hàng quý

- [ ] Survey đội về tính năng còn thiếu
- [ ] Plan thêm feature mới
- [ ] Update thư viện: `cd thuthaptoado && npm update`

---

## PHẦN 8 — HIỆU NĂNG THỰC TẾ

**Test đo đạc từ sandbox (ngày 2026-04-19):**

| Chỉ số | Giá trị |
|--------|:-:|
| CDN edge | Hong Kong (HKG) — gần VN |
| Latency VN → HKG | ~30-50ms |
| Load index HTML | 210ms |
| Load manifest.json | 489ms |
| Load search.json.gz (10MB) | 1.79s (5.6 MB/s) |
| Load 1 tile (253KB) | 546ms |

**Load test concurrent:**
- 50 user đồng thời: Avg **164ms**, Max 195ms — 100% success
- 100 user đồng thời: Avg **207ms**, Max 317ms — 100% success

**Scale capacity:**
- 100 user hiện tại: sử dụng ~1% free tier quota
- Có thể scale lên **10,000 user** mà vẫn $0/tháng
- CF Pages unlimited bandwidth/requests

**Kết luận:** Với 100 user, app chạy dưới 300ms mỗi thao tác, không lag. **KHÔNG CẦN** auto-logout/bandwidth saving — app là static CDN, user idle = 0 tốn.

---

## PHẦN 9 — LIÊN HỆ

**Khi cần:**
- 🐛 Bug report
- 💡 Feature request
- 🔧 Script không chạy
- 📊 Báo cáo stats

**Cách liên hệ:**
1. GitHub Issue (theo dõi tốt nhất):
   https://github.com/hoangnamqlld/gis-evn-app/issues/new
2. Zalo trực tiếp với dev
3. Email

**Gửi kèm:**
- Screenshot màn hình lỗi
- Browser console log (F12 → Console → copy text)
- Mô tả: đang làm gì → bấm gì → thấy gì (hoặc không thấy gì)

---

## ✨ CHECKLIST HOÀN THÀNH

- [ ] Đã đọc hết hướng dẫn
- [ ] Test app https://gis-evn-app.pages.dev thành công
- [ ] Cài GitHub CLI + đăng nhập
- [ ] Thử chạy `CAP_NHAT_VA_DEPLOY.bat` 1 lần (dù data không đổi, để verify pipeline)
- [ ] Gửi link Zalo cho 3-5 người đầu tiên test
- [ ] Bookmark 3 URL: app / Actions / Cloudflare dashboard
- [ ] Lưu file hướng dẫn này vào Drive để sau tham khảo

Khi tick đủ 7 ô trên → anh là admin thành thạo 🎉
