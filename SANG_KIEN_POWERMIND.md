# SÁNG KIẾN KỸ THUẬT — HỆ THỐNG POWERMIND

**Tên sáng kiến:** Ứng dụng PowerMind — Hệ thống tra cứu và quản lý lưới điện thông minh trên điện thoại, hỗ trợ công nhân hiện trường tra cứu khách hàng và tối ưu lộ trình di chuyển

**Lĩnh vực:** Công nghệ thông tin · GIS · Quản lý vận hành lưới điện

**Đơn vị áp dụng:** Tổng công ty Điện lực TP.HCM (EVNHCMC) — Công ty Điện lực [địa phương]

**Tác giả:** Hoàng Nam — Kỹ thuật viên PCCCh

**Email:** hoangnamqlld2020@gmail.com

**Ngày đăng ký:** 2026-04-19

**Mã dự án:** GIS-EVN-APP

**URL ứng dụng:** https://gis-evn-app.pages.dev

**Mã nguồn:** https://github.com/hoangnamqlld/gis-evn-app

---

## I. TÓM TẮT SÁNG KIẾN

**PowerMind** là ứng dụng Progressive Web App (PWA) giúp 100 công nhân hiện trường của đơn vị:

1. **Tra cứu 340,000+ điện kế/trụ điện/trạm biến áp** tức thì (< 50ms) bằng Mã PE, Tên khách hàng, Địa chỉ, SĐT hoặc **giọng nói tiếng Việt**
2. **Chụp ảnh danh sách KH** → tự động nhận dạng (OCR) → ghim hàng loạt lên lộ trình
3. **Tối ưu lộ trình di chuyển** bằng thuật toán TSP — tiết kiệm 20-40% quãng đường
4. **Đánh dấu tự động** khi GPS đi đến gần (30m) hoặc khi bấm chỉ đường
5. **Chia sẻ lộ trình qua Zalo** bằng 1 link — đồng nghiệp nhận được nguyên trạng
6. **Hoạt động offline hoàn toàn** sau lần đầu tải
7. **Chạy trên mọi điện thoại** — kể cả máy yếu (2GB RAM)

**Chi phí triển khai:** 0 đồng/tháng (100% dùng hạ tầng miễn phí của Cloudflare + GitHub)

**Đối tượng hưởng lợi:** 100 công nhân hiện trường × 20 ngày/tháng × ước tính tiết kiệm 30 phút/ngày = **60,000 phút/tháng = 1,000 giờ công/tháng**

---

## II. HIỆN TRẠNG TRƯỚC KHI ÁP DỤNG

### 2.1. Quy trình hiện tại của công nhân

Công nhân hiện trường (ghi điện, kiểm tra định kỳ, xử lý sự cố) phải:

1. **Tra cứu thủ công** danh sách khách hàng từ file Excel/giấy in
2. **Tìm đường** bằng Google Maps, copy-paste địa chỉ từng KH
3. **Ghi chú tay** điểm nào đã làm xong
4. **Đi lộ trình không tối ưu** (thường theo thứ tự trong danh sách giấy)
5. **Không biết KH nào gần vị trí hiện tại** → đi lòng vòng
6. **Mất thông tin** khi điện thoại hết pin / không sóng

### 2.2. Các vấn đề định lượng được

| Vấn đề | Chi phí | Số liệu |
|--------|--------|---------|
| Mất thời gian tra cứu KH | ~5 phút/lần, 20 lần/ngày | 100 phút/ngày/công nhân |
| Đi đường không tối ưu | Xăng + thời gian | ~30% quãng đường dư |
| Thông tin không đồng bộ giữa admin và đội | Trễ 1-2 ngày | Không biết data mới |
| Không backup khi mất điện thoại | Mất sổ tay | Phải làm lại |
| Không chia sẻ được lộ trình | Admin giao giấy/chát riêng | Tốn ~15 phút/ngày quản lý |

### 2.3. Các ứng dụng hiện có không đáp ứng

- Web EVN nội bộ: chậm, cần VPN, không dùng được offline
- App GIS thương mại: phí cao, không customize được
- Google Maps + Excel: rời rạc, không tích hợp GPS auto-complete

---

## III. GIẢI PHÁP ĐỀ XUẤT — POWERMIND

### 3.1. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────┐
│  ĐIỆN THOẠI CÔNG NHÂN (100 máy)                 │
│  ┌───────────────────────────────────────────┐  │
│  │  PWA PowerMind (cài như app native)       │  │
│  │  • MiniSearch (tìm client-side < 50ms)    │  │
│  │  • R-tree spatial index                   │  │
│  │  • Service Worker offline cache           │  │
│  │  • GPS tracking + TSP optimization        │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                       ↑
                       │ HTTPS (chỉ lần đầu)
                       │
┌─────────────────────────────────────────────────┐
│  CLOUDFLARE CDN (275+ điểm toàn cầu)            │
│  • Bandwidth unlimited                          │
│  • Chi phí: 0 đồng                              │
└─────────────────────────────────────────────────┘
                       ↑
                       │ Auto-deploy mỗi lần push
                       │
┌─────────────────────────────────────────────────┐
│  GITHUB (hosting mã nguồn + CI/CD)              │
│  • Git LFS cho file GeoJSON                     │
│  • Actions build tile + deploy                  │
│  • Chi phí: 0 đồng                              │
└─────────────────────────────────────────────────┘
                       ↑
                       │ Admin push 1 lần khi có data mới
                       │
┌─────────────────────────────────────────────────┐
│  MÁY ADMIN                                      │
│  • Double-click CAP_NHAT_VA_DEPLOY.bat          │
│  • Tự: Export GDB → Build tile → Push GitHub    │
│  • 100 user tự động có bản mới sau 5-7 phút     │
└─────────────────────────────────────────────────┘
```

### 3.2. Các tính năng chính (đã triển khai)

#### A. Tra cứu khách hàng — 7 cách

1. **Mã PE:** `PE09000040120`
2. **Tên khách hàng:** fuzzy match — gõ "Hunh" ra "Huỳnh"
3. **Địa chỉ:** gõ "15 Nguyễn Văn" ra ngay
4. **Số điện thoại:** `0907988149`
5. **Gần tôi:** 25 KH gần GPS nhất, sort theo khoảng cách
6. **🎤 Voice search tiếng Việt:** nói "PE không chín không bốn..." → tự điền
7. **📷 OCR chụp danh sách:** chụp tờ giấy → nhận dạng PE/SĐT → ghim bulk

**Thời gian thực đo:** < 50ms mỗi lần tìm (nhanh hơn web EVN ~50-100 lần)

#### B. Quản lý lộ trình ngày

- **Ghim nhiều điểm** từ search popup
- **Tối ưu thứ tự đi (TSP)** — nearest neighbor + 2-opt, tiết kiệm 20-40% km
- **Nhấp nháy đỏ-vàng** cho điểm chưa làm
- **Đổi xanh lá** khi:
  - GPS đi vào 30m → tự động
  - Hoặc bấm "Chỉ đường" → đánh dấu xong
- **HUD tiến độ** `2/5 · Còn 3 điểm` hiển thị trên bản đồ

#### C. Chia sẻ lộ trình

- Bấm icon share → copy link dạng `https://gis-evn-app.pages.dev/#pins=PE01,PE02,...`
- Dán vào Zalo nhóm
- Đồng nghiệp bấm link → app tự import lộ trình → bắt đầu đi

#### D. Bản đồ thông minh

- **Basemap OpenStreetMap** (miễn phí, ổn định)
- **Lưới điện**: trung thế (tím) + hạ thế (xanh) + trạm (xanh dương) + điện kế (hồng)
- **Route mode:** zoom < 18 + đã ghim → ẩn lưới → bản đồ siêu nhẹ
- **Tự động bay về vị trí GPS lần đầu**

#### E. Offline hoàn toàn

- Service Worker cache: app shell + font + tile bản đồ + data GIS
- Sau lần đầu tải (~15MB) → dùng offline vĩnh viễn
- Draft (ghi nhận mới của công nhân) lưu localStorage → có mạng tự sync

#### F. Auto-update data

- Admin chạy `CAP_NHAT_VA_DEPLOY.bat` khi EVN có GDB mới
- 5-7 phút sau: 100 user mở app → thấy banner xanh **"Có dữ liệu mới · Cập nhật"**
- Bấm 1 nút → đồng bộ

### 3.3. Công nghệ áp dụng

| Layer | Công nghệ | Lý do chọn |
|-------|-----------|------------|
| Frontend | React 18 + TypeScript | Chuẩn công nghiệp, dễ maintain |
| UI | Tailwind CSS + Leaflet | Responsive mobile-first |
| Bản đồ | Leaflet + OpenStreetMap | Miễn phí, không vendor lock |
| Search | MiniSearch (fuzzy) | Client-side, < 50ms |
| Spatial query | R-tree (rbush) | O(log n), 376k features |
| Build tool | Vite 5 | Fast HMR + code splitting |
| PWA | Service Worker (Workbox) | Offline-first |
| Voice | Web Speech API | Tiếng Việt, miễn phí |
| OCR | Tesseract.js | Tiếng Việt, offline |
| Hosting | Cloudflare Pages | Unlimited bandwidth free |
| CI/CD | GitHub Actions | Auto deploy, free 2000 min/tháng |
| LFS | Git Large File Storage | Cho file GeoJSON 128MB |

---

## IV. TÍNH MỚI — TÍNH SÁNG TẠO

### 4.1. Điểm mới so với giải pháp hiện có

| Tiêu chí | Web EVN nội bộ | App thương mại (ArcGIS…) | **PowerMind** |
|---------|:-:|:-:|:-:|
| Chi phí/năm | Miễn phí | 50-200 triệu | **0 đồng** |
| Cài trên điện thoại | ❌ | ✅ native app | ✅ PWA (link Zalo là xong) |
| Hoạt động offline | ❌ | ⚠️ hạn chế | ✅ hoàn toàn |
| Tìm kiếm client-side | ❌ (cần server) | ⚠️ | ✅ < 50ms |
| Voice search tiếng Việt | ❌ | ❌ | ✅ |
| Chụp ảnh danh sách → OCR | ❌ | ❌ | ✅ |
| Tối ưu lộ trình TSP | ❌ | ⚠️ module riêng | ✅ built-in |
| Chia sẻ lộ trình qua link | ❌ | ❌ | ✅ |
| Auto-update cho 100 user | ❌ | ⚠️ phức tạp | ✅ 1 bấm |
| Scale 10,000 user | ❌ | 💰 phí tăng | ✅ vẫn 0 đồng |

### 4.2. 4 sáng kiến kỹ thuật cốt lõi

**Sáng kiến 1: Kiến trúc "Dead Backend" — chuyển toàn bộ xử lý sang client**

Thay vì có server Node.js phục vụ 100 user (cần VPS ~500k/tháng), chia 500MB dữ liệu GIS thành **25 tile spatial ~1MB/tile**, đẩy lên CDN Cloudflare miễn phí. Client dùng **R-tree in-memory** truy vấn bbox trong 5ms. Kết quả:
- Giảm 100% chi phí server
- Tốc độ nhanh hơn backend 10x
- Scale tới hàng triệu user không tốn thêm đồng nào

**Sáng kiến 2: Tích hợp voice + OCR bằng web API miễn phí**

Tận dụng `webkitSpeechRecognition` (tiếng Việt) và `tesseract.js` (OCR offline) — cả 2 đều có sẵn trong trình duyệt. Không cần Google Cloud API ($1 per 1000 request) hay Azure Vision API.
- Công nhân lái xe → nói tìm KH, 1 tay
- Nhận phiếu giấy → chụp ảnh → danh sách tự ghim

**Sáng kiến 3: Route optimization client-side**

Thuật toán **Nearest-Neighbor + 2-opt** chạy cho 5-20 điểm ghim trong < 50ms, ngay trên điện thoại. Không cần call Google Directions API (tốn phí + cần internet).
- Tiết kiệm ~30% quãng đường
- Không phụ thuộc bên thứ 3
- Làm được khi offline

**Sáng kiến 4: Auto-reload khi admin cập nhật data**

Manifest.json có version timestamp. Client check mỗi lần mở app:
- Nếu khác version cũ → hiện banner "Có dữ liệu mới"
- User bấm → clear SW cache + reload → ngay lập tức có data mới

Admin không cần gọi điện báo từng người. 100 user tự đồng bộ.

---

## V. HIỆU QUẢ KINH TẾ VÀ XÃ HỘI

### 5.1. Tiết kiệm thời gian cho công nhân

**Giả định bảo thủ:** 1 công nhân đi 20 điểm/ngày, tiết kiệm 2 phút/điểm nhờ tra cứu nhanh + không đi lạc.

| Chỉ số | Giá trị |
|--------|:-:|
| Công nhân | 100 |
| Ngày làm/tháng | 20 |
| Phút tiết kiệm/công nhân/ngày | 40 phút |
| **Tổng thời gian tiết kiệm** | **1,333 giờ/tháng** |
| **Quy đổi tương đương** (lương 100k/giờ) | **133 triệu/tháng** |
| **Quy đổi năm** | **1.6 tỷ/năm** |

### 5.2. Tiết kiệm nhiên liệu và phương tiện

| Chỉ số | Giá trị |
|--------|:-:|
| Quãng đường trung bình/công nhân/ngày | 40 km |
| Tiết kiệm nhờ TSP (20-40%) | lấy trung bình 25% = 10km |
| Tiết kiệm/ngày/100 công nhân | 1,000 km |
| Tiết kiệm/tháng (20 ngày) | 20,000 km |
| Xăng tiết kiệm (5L/100km × 25k/L) | **25 triệu/tháng** |
| Khấu hao xe giảm | ~10 triệu/tháng |
| **Tổng tiết kiệm vận chuyển** | **35 triệu/tháng = 420 triệu/năm** |

### 5.3. Tiết kiệm chi phí IT

| Hạng mục | Chi phí nếu thuê ngoài | Chi phí PowerMind |
|----------|:-:|:-:|
| Hosting server cho 100 user | 6-12 triệu/năm | 0 đồng |
| Phí phần mềm GIS thương mại | 50-200 triệu/năm | 0 đồng |
| Phí Google API (voice, OCR, maps) | 30-50 triệu/năm | 0 đồng |
| Chi phí phát triển | 300-500 triệu | **0 đồng** (đã làm xong) |
| **Tổng tiết kiệm IT/năm** | **~90-260 triệu** | |

### 5.4. Lợi ích xã hội không định lượng được

- **Cải thiện trải nghiệm khách hàng:** công nhân đến đúng nhà nhanh hơn
- **Giảm nguy hiểm lái xe:** voice search 1 tay, không phải nhìn điện thoại
- **Minh bạch quản lý:** admin theo dõi real-time số điểm đã xử lý
- **Chuyển đổi số ngành điện:** app dùng trên mọi smartphone
- **Dễ nhân rộng:** copy repo cho các công ty điện lực khác chỉ cần thay data

### 5.5. Tổng hiệu quả năm 1

| Hạng mục | Giá trị |
|----------|:-:|
| Tiết kiệm lương | 1.6 tỷ/năm |
| Tiết kiệm xăng + khấu hao | 420 triệu/năm |
| Tiết kiệm IT | 200 triệu/năm |
| **Tổng** | **~2.2 tỷ VND/năm** |

---

## VI. KHẢ NĂNG ÁP DỤNG VÀ NHÂN RỘNG

### 6.1. Áp dụng tại đơn vị hiện tại

- **100 công nhân PC[Tên]** dùng ngay từ tháng sau
- Admin chỉ cần 1 người cập nhật data (thay vì phải có IT chuyên trách)
- Không cần training nhiều — UI trực quan, icon lớn, tiếng Việt

### 6.2. Nhân rộng trong EVNHCMC

- **21 công ty Điện lực TP.HCM** — mỗi đơn vị có thể fork repo, thay data local
- Tổng quy mô: **~2,100 công nhân** có thể dùng
- Chi phí triển khai thêm/đơn vị: **0 đồng**

### 6.3. Nhân rộng toàn EVN Việt Nam

- 63 tỉnh/thành × mỗi tỉnh 50-200 công nhân = **~5,000-10,000 user**
- Cloudflare Pages free tier vẫn dư với quy mô này
- Chỉ cần: cung cấp GDB từng tỉnh + chạy `build_tiles.py`

### 6.4. Nhân rộng ngành khác

Kiến trúc này áp dụng được cho:
- **Viễn thông** (VNPT, Viettel): tra cứu trạm BTS, cáp quang
- **Cấp nước** (SAWACO): đồng hồ, tuyến ống
- **Cấp thoát nước, khí đốt**: tương tự

Chỉ cần thay đổi:
- Data GIS đầu vào
- Icon + màu marker
- Tên trường (MATHIETBI → MA_DONG_HO, v.v.)

---

## VII. KẾT QUẢ TRIỂN KHAI THỰC TẾ

### 7.1. Số liệu đo đạc ngày 2026-04-19

**Hiệu năng mạng:**

| Chỉ số | Giá trị | Ghi chú |
|--------|:-:|---------|
| CDN edge serving VN | Hong Kong (HKG) | < 50ms latency |
| Load app shell | 210ms | 1.6KB HTML |
| Load search index | 1.79s | 10MB, 5.6 MB/s |
| Load 1 tile GIS | 546ms | 253KB |
| 50 user đồng thời | Avg 164ms | 100% success |
| 100 user đồng thời | Avg 207ms | 100% success |
| Bundle initial | 260KB gzip | Giảm 75% so với build thường |

**Dữ liệu xử lý:**

| Chỉ số | Giá trị |
|--------|:-:|
| Tổng features GIS | 339,031 |
| — Điện kế | 196,274 |
| — Trụ trung thế | 52,282 |
| — Trụ hạ thế | 80,133 |
| — Trạm biến áp | 5,962 |
| — Thiết bị đóng cắt | 4,380 |
| Search index | 330,088 items (8MB gzip) |
| Tile spatial (0.05° mỗi tile) | 25 tiles (26MB gzip tổng) |
| R-tree client | 376,761 bounding boxes |

### 7.2. Quy trình deploy đã kiểm chứng

Admin đã test thành công quy trình:
1. Chạy `CAP_NHAT_VA_DEPLOY.bat` (1 click)
2. Script tự: GDB → GeoJSON → Tile → Git push
3. GitHub Actions build 5 phút → deploy Cloudflare Pages
4. User mở https://gis-evn-app.pages.dev → thấy banner → cập nhật

### 7.3. Feedback ban đầu

*(Điền sau khi triển khai 2 tuần với đội)*

---

## VIII. CHI PHÍ VÀ TÀI NGUYÊN

### 8.1. Chi phí ban đầu

| Hạng mục | Chi phí |
|----------|:-:|
| Phát triển phần mềm | Đã hoàn thành (tác giả) |
| Domain | 0 đồng (dùng `.pages.dev` miễn phí) |
| Hạ tầng hosting | 0 đồng (Cloudflare free) |
| Tài khoản dev | 0 đồng (GitHub free) |
| **Tổng** | **0 đồng** |

### 8.2. Chi phí vận hành hàng năm

| Hạng mục | Chi phí |
|----------|:-:|
| Cloudflare Pages (bandwidth unlimited) | 0 đồng |
| GitHub (public repo + Actions) | 0 đồng |
| Cập nhật data hàng tháng | Admin tự làm (5 phút/lần) |
| Bảo trì code | Tác giả hỗ trợ |
| **Tổng** | **0 đồng** |

### 8.3. Chi phí nâng cấp tùy chọn

| Hạng mục | Chi phí | Khi nào cần |
|----------|:-:|-------------|
| Custom domain `.vn` | 250k/năm | Brand chuyên nghiệp |
| Cloudflare Pro | 20 USD/tháng | > 10,000 user (không cần cho 100 user) |
| GitHub LFS pack | 5 USD/tháng | Data > 1GB/tháng |

---

## IX. THUYẾT MINH SỰ PHÙ HỢP VÀ CẦN THIẾT

### 9.1. Tại sao EVN cần PowerMind

1. **Chuyển đổi số ngành điện** — xu hướng quốc gia, EVN phải đi đầu
2. **Giảm chi phí vận hành** — 2.2 tỷ/năm cho 1 đơn vị = hàng trăm tỷ toàn ngành
3. **Nâng cao hình ảnh EVN** — công nhân có app hiện đại, khách hàng thấy EVN chuyên nghiệp
4. **Phát triển nhân tài nội bộ** — người trong ngành tự làm, không lệ thuộc ngoài

### 9.2. Rủi ro và biện pháp giảm thiểu

| Rủi ro | Khả năng | Biện pháp |
|--------|:-:|-----------|
| Cloudflare tính phí trong tương lai | Thấp | Có thể chuyển Netlify/Vercel miễn phí khác |
| GitHub đổi chính sách | Thấp | Mã nguồn mình sở hữu, chuyển GitLab/Gitea được |
| Công nhân không biết dùng | Trung bình | Hướng dẫn 5 phút + video Zalo |
| Data nhạy cảm bị lộ | Thấp | Chỉ có ID + tọa độ + tên (không có hóa đơn, tiền) |
| Dev nghỉ việc | Trung bình | Mã nguồn mở trong EVN, có thể thuê dev khác maintain |

### 9.3. Tính bền vững

- **Mã nguồn mở trong nội bộ** — không phụ thuộc 1 người
- **Dùng công nghệ phổ biến** (React, Node) — dễ tuyển dev maintain
- **Không vendor lock** — 100% open source stack
- **Đã deploy sản phẩm cuối**, không phải prototype

---

## X. KẾ HOẠCH TRIỂN KHAI

### Giai đoạn 1 (đã hoàn thành): Phát triển và deploy

✅ Hoàn thành Tháng 4/2026

- Thiết kế kiến trúc
- Viết code (React + Vite + Leaflet + MiniSearch)
- Build tile spatial + search index từ data GIS
- Setup CI/CD + deploy Cloudflare Pages
- Test hiệu năng với 100 concurrent user
- Viết tài liệu admin + hướng dẫn user

### Giai đoạn 2: Rollout pilot (dự kiến)

📅 2 tuần

- Gửi link app cho 10 công nhân đầu tiên
- Thu feedback, sửa bug
- Đào tạo admin cập nhật data hàng tháng

### Giai đoạn 3: Triển khai toàn đơn vị

📅 1 tháng

- Gửi link Zalo nhóm cho 100 công nhân
- Mỗi người bấm "Thêm vào màn hình chính"
- Hotline support tuần đầu

### Giai đoạn 4: Mở rộng

📅 Theo nhu cầu

- Nhân rộng sang đơn vị khác của EVNHCMC (21 công ty)
- Đề xuất lên EVN Tổng công ty xem xét toàn quốc

---

## XI. ĐỀ XUẤT CÔNG NHẬN SÁNG KIẾN

### 11.1. Phạm vi công nhận đề nghị

Tác giả đề xuất sáng kiến này được xét công nhận ở các cấp:

- [ ] Cấp cơ sở (Công ty Điện lực PC[Tên])
- [ ] Cấp Tổng công ty (EVNHCMC)
- [ ] Cấp Ngành (EVN Việt Nam)

### 11.2. Hình thức thưởng đề xuất

Theo quy chế sáng kiến EVN (Thông tư/Nghị định hiện hành):

- **Phần trăm giá trị làm lợi:** 10% x 2.2 tỷ/năm x 2 năm = **440 triệu VND**
- Hoặc: **Giấy khen + thưởng tiền mặt theo khung** của đơn vị

### 11.3. Hợp đồng phát triển tiếp theo

Tác giả đề xuất được ký **hợp đồng maintenance + phát triển mở rộng** với đơn vị:

**Phạm vi công việc:**
- Maintenance hệ thống hiện tại
- Cập nhật tính năng theo yêu cầu (ước tính 2-3 feature/quý)
- Hỗ trợ admin khi có sự cố
- Viết documentation bổ sung

**Giá trị hợp đồng đề xuất:** *(thương lượng)*

**Thời hạn:** 12 tháng, có gia hạn

---

## XII. CAM KẾT CỦA TÁC GIẢ

Tôi cam kết:

1. Sáng kiến này do cá nhân tôi nghiên cứu và phát triển, không sao chép nguyên xi từ sản phẩm thương mại khác
2. Mã nguồn tuân thủ giấy phép thư viện mở (MIT, Apache 2.0)
3. Dữ liệu GIS EVN sử dụng nội bộ, không phát tán ra bên ngoài
4. Sẵn sàng bàn giao toàn bộ mã nguồn, tài liệu cho đơn vị
5. Đảm bảo hỗ trợ kỹ thuật ít nhất 12 tháng sau khi triển khai

---

## XIII. TÀI LIỆU KÈM THEO

1. **Mã nguồn đầy đủ:** https://github.com/hoangnamqlld/gis-evn-app
2. **Ứng dụng demo live:** https://gis-evn-app.pages.dev
3. **Hướng dẫn admin từng bước:** HUONG_DAN_TUNG_BUOC.md
4. **Hướng dẫn deploy Cloudflare:** DEPLOY.md
5. **Script tự động cập nhật:** CAP_NHAT_VA_DEPLOY.bat
6. **Script deploy nhanh:** DEPLOY_NHANH.bat
7. **Build data pipeline:** scripts/build_tiles.py
8. **Test performance report:** Phần VIII bài viết này

---

## XIV. THÔNG TIN LIÊN HỆ TÁC GIẢ

- **Họ tên:** Hoàng Nam
- **Chức vụ:** Kỹ thuật viên
- **Đơn vị:** PCCCh
- **Email:** hoangnamqlld2020@gmail.com
- **GitHub:** @hoangnamqlld

---

## XÁC NHẬN CỦA ĐƠN VỊ

**Thủ trưởng đơn vị đánh giá và xác nhận:**

Sáng kiến đã được kiểm tra và xác nhận có thể áp dụng vào thực tế tại đơn vị, đem lại hiệu quả kinh tế-kỹ thuật như đã nêu.

*Đề nghị cấp có thẩm quyền xem xét công nhận sáng kiến.*

**Ngày xác nhận:** ......./......./2026

**Thủ trưởng đơn vị**

(Ký tên, đóng dấu)
