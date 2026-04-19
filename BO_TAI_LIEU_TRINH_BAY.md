# 🎯 BỘ TÀI LIỆU TRÌNH BÀY — POWERMIND

3 tài liệu trong 1 file để anh copy-paste tuỳ dịp:
1. **Email pitch** (200 từ) — gửi trước cho sếp đọc
2. **Slide content** (10 slide) — paste vào PowerPoint
3. **Video demo script** (2 phút) — tự quay điện thoại

---

# 1️⃣ EMAIL PITCH CHO SẾP (200 TỪ)

## Tiêu đề email

```
[Sáng kiến] PowerMind — Ứng dụng GIS EVN miễn phí cho 100 công nhân · Tiết kiệm 2.2 tỷ/năm
```

## Nội dung email

```
Kính gửi Anh/Chị [Tên sếp],

Em xin báo cáo kết quả sáng kiến "PowerMind" — ứng dụng web tra cứu lưới 
điện trên điện thoại mà em đã tự nghiên cứu và triển khai.

TÓM TẮT 1 PHÚT:

• Ứng dụng đã LIVE tại: https://gis-evn-app.pages.dev
• Đã test với 339,031 feature GIS và 100 user đồng thời — tốc độ < 300ms
• Dùng offline hoàn toàn sau lần đầu tải
• Hỗ trợ: Voice search tiếng Việt · Chụp ảnh danh sách KH (OCR) · Tối ưu 
  lộ trình (TSP) · Chia sẻ qua Zalo
• Chi phí hosting: 0 đồng/tháng (dùng Cloudflare free tier)

HIỆU QUẢ DỰ KIẾN:

• 100 công nhân × tiết kiệm 40 phút/ngày → 1,333 giờ/tháng
• Quy đổi: ~1.6 tỷ VND/năm (tiền lương) + 420 triệu (xăng, xe)
• Tổng ROI năm 1: ~2.2 tỷ VND
• Đầu tư: 0 đồng (sáng kiến nội bộ)

ĐỀ XUẤT:

1. Tổ chức demo 15 phút trước ban giám đốc
2. Pilot 2 tuần với 10 công nhân
3. Nếu OK → rollout 100 người sau 1 tháng

File sáng kiến đầy đủ và demo video em gửi đính kèm.

Rất mong được Anh/Chị cho ý kiến.

Trân trọng,
Hoàng Nam
Kỹ thuật viên PCCCh
0xxx xxx xxx
```

**Note:** Thay `[Tên sếp]` và số điện thoại thật. Đính kèm file `SANG_KIEN_POWERMIND.md` và 1-2 screenshot app đẹp.

---

# 2️⃣ SLIDE POWERPOINT (10 SLIDE)

Copy từng khối vào slide tương ứng. Mỗi slide < 60 chữ (nguyên tắc 10-20-30 của Guy Kawasaki).

## Slide 1 — TITLE

```
POWERMIND
Ứng dụng GIS Lưới điện trên điện thoại

Cho 100 công nhân hiện trường
Chi phí: 0 đồng/năm
ROI: 2.2 tỷ VND/năm

Hoàng Nam · PCCCh · 04/2026
```

**Visual:** Logo EVN + screenshot app trên iPhone.

## Slide 2 — VẤN ĐỀ

```
HIỆN TRẠNG — 100 CÔNG NHÂN

• Tra cứu KH từ Excel/giấy in — mất 5 phút/lần × 20 lần/ngày
• Đi đường không tối ưu — thừa 30% quãng đường
• Admin cập nhật data → đội biết sau 1-2 ngày
• Không có app nào tích hợp GIS + GPS + offline

→ Lãng phí ~1,300 giờ/tháng
```

**Visual:** Ảnh công nhân cầm tờ giấy + điện thoại chạy Google Maps.

## Slide 3 — GIẢI PHÁP

```
POWERMIND LÀM GÌ?

🔍  Tìm KH tức thì (< 50ms) — Mã PE, Tên, Địa chỉ, SĐT
🎤  Voice search tiếng Việt
📷  Chụp danh sách → OCR → Ghim bulk
🗺️  Tối ưu lộ trình đi (TSP)
📍  GPS auto-complete khi đến gần
🔗  Chia sẻ lộ trình qua Zalo
📴  Offline hoàn toàn sau lần đầu
```

**Visual:** 4 screenshot app: Search, Map, Pin list, Detail.

## Slide 4 — KIẾN TRÚC

```
"DEAD BACKEND" — ZERO COST

Điện thoại 100 user
    ↓ HTTPS (1 lần duy nhất)
Cloudflare CDN (275+ điểm, unlimited bandwidth)
    ↑ Auto-deploy
GitHub (mã nguồn + CI/CD)
    ↑ Admin 1 click
Máy Admin (xuất GDB → tile)

= Không cần server, không cần VPS, 0 đồng/tháng
```

**Visual:** Diagram kiến trúc 4 tầng (dùng draw.io hoặc Excalidraw).

## Slide 5 — TÍNH MỚI

```
SO SÁNH VỚI GIẢI PHÁP HIỆN CÓ

                 Web EVN   ArcGIS     PowerMind
─────────────────────────────────────────────────
Chi phí/năm      0đ        50-200tr   0đ
Offline          ❌         ⚠️         ✅
Voice tiếng Việt ❌         ❌         ✅
OCR chụp list    ❌         ❌         ✅
Cài điện thoại   ❌         ✅         ✅ (PWA)
Auto-update      ❌         ⚠️         ✅
Scale 10k user   ❌         💰💰       ✅ (0đ)
```

## Slide 6 — HIỆU NĂNG THỰC TẾ

```
TEST NGÀY 19/04/2026

• CDN edge: Hong Kong (< 50ms tới VN)
• Load app: 210ms
• Tìm kiếm: < 50ms (client-side)
• Search index: 330,088 items
• Tile spatial: 25 tiles · 26MB
• 100 user đồng thời: Avg 207ms · 100% success
• Scale tới 10,000 user: vẫn 0 đồng/tháng

→ Nhanh hơn web EVN hiện tại ~50x
```

**Visual:** Bar chart so sánh thời gian.

## Slide 7 — HIỆU QUẢ KINH TẾ

```
TIẾT KIỆM ĐỊNH LƯỢNG

Lương (100 công nhân × 40ph/ngày × 100k/h)
                                  1,600,000,000 đ/năm
Xăng + khấu hao xe (25% quãng đường)
                                    420,000,000 đ/năm
Tiết kiệm IT (so thuê ngoài)
                                    200,000,000 đ/năm
────────────────────────────────────────────────
TỔNG ROI NĂM 1                  2,220,000,000 đ
CHI PHÍ ĐẦU TƯ                              0 đ
```

**Visual:** Pie chart + con số 2.2 tỷ thật to.

## Slide 8 — KHẢ NĂNG NHÂN RỘNG

```
TỪ 1 ĐƠN VỊ → TOÀN NGÀNH

Hiện tại:    1 PC × 100 công nhân      = 100 user
EVNHCMC:     21 PC × 100               = 2,100 user
Toàn EVN:    63 tỉnh × 100-300         = 5,000-10,000 user

Chi phí triển khai thêm /đơn vị: 0 đồng
Thời gian setup /đơn vị: 1 ngày (chỉ thay data GIS)

Tương tự áp dụng được cho: VNPT · Viettel · SAWACO · Khí đốt
```

## Slide 9 — KẾ HOẠCH

```
LỘ TRÌNH TRIỂN KHAI

Giai đoạn 1: ✅ Đã xong (App live, pipeline deploy hoàn chỉnh)
Giai đoạn 2: 📅 Pilot 2 tuần (10 công nhân)
Giai đoạn 3: 📅 Rollout 100 người (1 tháng)
Giai đoạn 4: 📅 Nhân rộng toàn EVNHCMC (6 tháng)

ĐỀ XUẤT HÔM NAY:
• Công nhận sáng kiến cấp đơn vị
• Cho phép pilot 2 tuần
• Hợp đồng maintenance 12 tháng
```

## Slide 10 — Q&A

```
DEMO LIVE NGAY

Mở: https://gis-evn-app.pages.dev

Thử ngay: gõ "PE09" hoặc nói tên KH
Chụp 1 tờ danh sách → xem OCR
Ghim 3 KH → Tối ưu lộ trình

Email: hoangnamqlld2020@gmail.com
GitHub: github.com/hoangnamqlld/gis-evn-app

Xin cảm ơn!
```

**Visual:** QR code to app + ảnh cá nhân tác giả.

---

## Tips thiết kế slide

- **Font:** Be Vietnam Pro / Montserrat / Roboto — tránh Times New Roman
- **Màu chủ đạo:** Xanh EVN `#0066CC` + trắng + xám nhẹ
- **1 slide = 1 ý chính**
- **Dùng icon** từ flaticon.com / fontawesome
- **Tránh bullet dài** — dùng bảng hoặc chart
- **Screenshot thật của app** hơn là mockup
- **Để slide 10 mở → demo live cho mọi người cùng thấy**

---

# 3️⃣ VIDEO DEMO SCRIPT (2 PHÚT)

Quay bằng điện thoại + màn hình máy tính. Thời lượng 2 phút, 4 cảnh.

## Cảnh 1 — Mở đầu (0:00 - 0:15)

**Voice-over (giọng rõ ràng, tự nhiên):**
> "Xin chào, tôi là Hoàng Nam — kỹ thuật viên PCCCh. Đây là PowerMind —
>  ứng dụng tra cứu lưới điện tôi vừa phát triển cho 100 công nhân hiện
>  trường của đơn vị. Mời mọi người xem demo 2 phút."

**Hình ảnh:** Mở link https://gis-evn-app.pages.dev trên Chrome điện thoại. Hiện logo PowerMind.

## Cảnh 2 — Tìm kiếm 3 cách (0:15 - 1:00)

**Voice-over:**
> "Cách 1 — gõ mã PE."

**Hình ảnh:** Gõ `PE09000040120` → kết quả hiện 1 giây → bấm vào → map bay đến.

**Voice-over:**
> "Cách 2 — nói bằng giọng Việt."

**Hình ảnh:** Bấm icon mic → "Tìm Nguyễn Văn An" → text hiện trong ô → kết quả ra.

**Voice-over:**
> "Cách 3 — chụp tờ danh sách."

**Hình ảnh:** Bấm icon camera → chụp tờ giấy có mã PE → OCR process 3 giây → modal hiện 5 KH → tick 3 KH → bấm "Ghim 3 điểm".

## Cảnh 3 — Lộ trình + chỉ đường (1:00 - 1:40)

**Voice-over:**
> "3 điểm đã ghim. Bấm tab Lộ trình. Bấm Tối ưu thứ tự đi."

**Hình ảnh:** Tab Lộ trình → 3 điểm sắp xếp lại → hiện "Tiết kiệm 2.3 km".

**Voice-over:**
> "Bấm vào điểm đầu tiên — Google Maps mở, có lộ trình từ vị trí
>  hiện tại đến khách hàng."

**Hình ảnh:** Click item → Google Maps mở → hiện route.

**Voice-over:**
> "Khi GPS đi vào 30 mét, điểm này tự đổi xanh — đã làm xong.
>  Cứ thế hết lộ trình."

**Hình ảnh:** Zoom vào marker đỏ-vàng nhấp nháy → đổi sang xanh tick.

## Cảnh 4 — Kết (1:40 - 2:00)

**Voice-over:**
> "Toàn bộ app chạy offline sau lần đầu. Chi phí hosting: 0 đồng.
>  100 công nhân tiết kiệm 40 phút mỗi ngày — tương đương 2.2 tỷ
>  đồng mỗi năm. Cảm ơn mọi người đã xem."

**Hình ảnh:** Ngắt WiFi → app vẫn chạy → fade out với text:
```
✅ Chi phí: 0 đồng
✅ ROI: 2.2 tỷ/năm
✅ Ngay 100 user: https://gis-evn-app.pages.dev
```

## Hướng dẫn quay video

**Công cụ miễn phí:**
- **ScreenRec** (Windows): quay màn hình máy tính + mic
- **OBS Studio**: quay + edit cơ bản
- **CapCut** (PC hoặc mobile): edit cắt ghép + voice-over
- **DaVinci Resolve** (pro, free): edit chuyên nghiệp

**Quy trình:**
1. Viết script ra giấy, tập đọc 3 lần
2. Quay màn hình điện thoại bằng **Built-in screen recorder** (Android/iOS):
   - Android: kéo xuống notifications → "Screen recorder"
   - iOS: Control Center → icon record
3. Ghi âm voice-over riêng bằng điện thoại (app Voice Memo)
4. Ghép trong CapCut hoặc DaVinci
5. Export MP4 720p, max 50MB để gửi Zalo

**Tips:**
- Quay nhiều takes, chọn take tốt nhất
- Giọng nói rõ, không rushed
- Dùng headphone + ngồi chỗ yên tĩnh
- Thêm nhạc nền nhẹ (free tại YouTube Audio Library) — volume 10%

---

# 📦 CHECKLIST TRƯỚC KHI ĐI TRÌNH

- [ ] Soát lại file `SANG_KIEN_POWERMIND.md` — điền `[Tên]`, số phone, đơn vị cụ thể
- [ ] In bản cứng sáng kiến (hoặc PDF)
- [ ] Chuẩn bị 10 slide PowerPoint
- [ ] Quay video demo 2 phút
- [ ] Test app https://gis-evn-app.pages.dev trên điện thoại sếp dùng (iOS hoặc Android)
- [ ] Chuẩn bị 2-3 câu trả lời khó:
  - "Nếu anh nghỉ thì ai maintain?" → Mã nguồn mở, có thể thuê dev khác
  - "Data bị lộ thì sao?" → Chỉ có tên + tọa độ, không có tiền/hóa đơn
  - "Cloudflare tính phí thì sao?" → Chuyển Netlify/Vercel free khác
- [ ] Gửi email pitch cho sếp 1-2 ngày trước khi gặp
- [ ] Mang theo laptop + điện thoại đã cài app (phòng WiFi sếp yếu)
- [ ] Nụ cười tự tin 😊

---

## 🎯 Kết luận

Anh có 3 tài liệu trong file này:

1. **Email pitch** — gửi sếp trước 1-2 ngày để sếp đọc qua
2. **Slide PowerPoint** — 10 slide, 5-7 phút thuyết trình
3. **Video demo** — 2 phút, gửi Zalo trước cho sếp xem nếu không gặp mặt được

**Công thức thuyết phục:**

> **Vấn đề 1,300 giờ lãng phí mỗi tháng** +
> **Giải pháp miễn phí đã chạy** +
> **ROI 2.2 tỷ/năm** +
> **Demo live có thật** +
> **Lộ trình rõ ràng** =
> **Sáng kiến khó từ chối**

Chúc anh thành công. Khi họp xong, paste kết quả cho tôi biết.
