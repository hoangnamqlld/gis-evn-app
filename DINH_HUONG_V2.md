# 🚀 ĐỊNH HƯỚNG NÂNG CẤP POWERMIND V2 — THU THẬP & ĐỒNG BỘ

> Biến PowerMind từ "chỉ xem" → "thu thập + cập nhật" — công nhân ghi data hiện trường,
> admin ở nhà duyệt, GIS công ty tự sync.

---

## I. BỨC TRANH LỚN

### Mô hình **2 chiều dữ liệu**

```
 ┌──────────────────────────────────────────────────────────┐
 │  CÔNG NHÂN HIỆN TRƯỜNG (100 người)                       │
 │  • Chụp trụ mới → GPS + ảnh                              │
 │  • Kiểm tra trụ/trạm → checklist + ghi chú               │
 │  • Cập nhật điện kế → thay số, đổi vị trí                │
 │  ↓ (offline queue, auto-sync khi có mạng)                │
 └──────────────────────────────────────────────────────────┘
              │
              ▼
 ┌──────────────────────────────────────────────────────────┐
 │  GOOGLE DRIVE (đã có sẵn key)                            │
 │  /PowerMind/                                             │
 │    ├── submissions/YYYY-MM-DD/{id}.json   ← data forms   │
 │    ├── photos/YYYY-MM-DD/{id}/*.jpg        ← ảnh          │
 │    └── inspections/YYYY-MM-DD/{id}.json   ← kiểm tra     │
 └──────────────────────────────────────────────────────────┘
              │
              ▼
 ┌──────────────────────────────────────────────────────────┐
 │  ADMIN Ở NHÀ — DASHBOARD REVIEW                          │
 │  • Xem submissions mới real-time                         │
 │  • Duyệt / từ chối từng record                           │
 │  • Bấm "Sync to GIS" → đẩy sang công ty                  │
 └──────────────────────────────────────────────────────────┘
              │
              ▼ (trigger qua Cloudflare Worker / GitHub webhook)
 ┌──────────────────────────────────────────────────────────┐
 │  MÁY GIS CÔNG TY (cron 6h/lần)                           │
 │  • Pull approved records từ Drive                        │
 │  • Merge vào master GeoJSON                              │
 │  • Chạy auto-deploy.py + build_tiles.py                  │
 │  • Push lên GitHub → 100 user mở app = data mới          │
 └──────────────────────────────────────────────────────────┘
              │
              └─→ VÒNG LẶP khép kín — "Hôm nay thu, mai cả đội thấy"
```

---

## II. CÁI CÓ SẴN — KHÔNG PHẢI VIẾT LẠI

### 2.1. Code đã tồn tại trong repo

Kiểm tra `thuthaptoado/src/`:

| Module | Đã có | Trạng thái |
|--------|:--:|-----------|
| `components/CollectionForm.tsx` | ✅ | Form thu thập (cần mở rộng) |
| `components/CameraModule.tsx` | ✅ | Chụp ảnh + GPS |
| `components/SmartCameraModule.tsx` | ✅ | Camera AI |
| `components/InspectionForm.tsx` | ✅ | Form kiểm tra |
| `services/firebase/authService` | ✅ | Login Firebase |
| `services/driveAuthService` | ✅ | OAuth Drive |
| `services/driveUploadService` | ✅ | Upload file lên Drive |
| `services/syncQueueService` | ✅ | Queue sync khi offline |
| `services/dualSyncService` | ✅ | Sync Firebase + Drive |
| `services/useCloudSync.ts` | ✅ | Hook React quản lý sync |
| `services/syncWithDrive.ts` | ✅ | Sync 2 chiều Drive |

→ **80% code đã có**, chỉ cần wire up + test + sửa UX.

### 2.2. Hạ tầng đã setup

| Service | Đã sẵn | Dùng cho |
|---------|:--:|---------|
| Google Cloud project | ✅ (credentials trong các file json) | Drive API |
| Firebase project | ✅ (trong code config.ts) | Auth + Firestore |
| Cloudflare Pages | ✅ `gis-evn-app.pages.dev` | Host frontend |
| GitHub + Actions | ✅ CI/CD auto-deploy | Build + publish |

### 2.3. Free tier đủ dùng cho 100 user

| Service | Free tier | Dùng cho 100 user |
|---------|-----------|:--:|
| Google Drive | 15GB/tài khoản | ~500 ảnh/ngày × 500KB = 7.5GB/tháng — đủ |
| Firebase Firestore | 50k read/50k write/day | ~20k operation/day — đủ |
| Firebase Auth | Unlimited | Không giới hạn user |
| Cloudflare Pages | Unlimited bandwidth | Không vấn đề |
| Cloudflare Workers (scheduled) | 100k request/day free | Trigger sync đủ |

**Tổng chi phí phụ trợ hàng tháng:** 0 đồng.

---

## III. ROADMAP 4 SPRINT (4 TUẦN)

### 🏁 Sprint 1: Thu thập tọa độ trụ/điện kế mới

**Mục tiêu:** Công nhân chụp trụ mới → GPS + ảnh + form → offline queue → auto-upload Drive khi online.

#### Tuần 1 — Việc cần làm

| # | Task | File | Thời gian |
|---|------|------|:--:|
| 1 | Review + enable `CollectionForm.tsx` | src/components/ | 1h |
| 2 | Form fields: Loại thiết bị, Mã PE, Tên KH, SĐT, Ghi chú | same | 2h |
| 3 | Camera chụp tối đa 5 ảnh/submission | CameraModule | 1h |
| 4 | GPS coords auto-lấy (đã có) | utils/vn2000 | 0.5h |
| 5 | Lưu offline vào IndexedDB (nếu mất mạng) | syncQueueService | 2h |
| 6 | Auto-retry upload Drive khi có mạng | Service Worker | 2h |
| 7 | Nút "Gửi" + UI progress upload | UI | 1h |

**Deliverable:** Công nhân bấm `+` trên bản đồ → chụp ảnh → điền form → bấm Gửi → offline OK, online auto-sync.

#### Kỹ thuật chi tiết

```typescript
// Flow đơn giản hóa
async function submitNewPoint(form: CollectionForm) {
  const record = {
    id: crypto.randomUUID(),
    type: form.type,        // 'pole_lv' | 'pole_mv' | 'meter' | ...
    coords: { lat, lng },
    properties: { ... },
    photos: [blob1, blob2, ...],
    collectorId: state.userName,
    timestamp: Date.now(),
    status: 'Draft',
  };

  // 1. Lưu IndexedDB ngay (offline-first)
  await db.submissions.add(record);

  // 2. Thêm vào queue sync
  await syncQueueService.enqueue(record);

  // 3. Nếu online → bắt đầu upload ngay
  if (navigator.onLine) {
    syncQueueService.processQueue();
  }
}

// Background sync registered via Service Worker
self.addEventListener('sync', event => {
  if (event.tag === 'upload-submissions') {
    event.waitUntil(syncQueueService.processQueue());
  }
});
```

---

### 🏁 Sprint 2: Kiểm tra lưới điện

**Mục tiêu:** Mở 1 trụ/trạm → bấm "Kiểm tra" → điền checklist + ảnh → gửi.

#### Tuần 2

| # | Task | File |
|---|------|------|
| 1 | Expand `InspectionForm.tsx` | src/components/ |
| 2 | Checklist cấu kiện: Trụ / Sứ / Dây / Hành lang / ... | form schema |
| 3 | 3 mức: OK / Theo dõi / Nguy hiểm | UI select |
| 4 | Upload ảnh kèm mỗi mục checklist | CameraModule |
| 5 | Lưu `inspectionRecord` vào asset | types.ts |
| 6 | Sync lên Drive folder `/inspections/` | driveUploadService |
| 7 | Trên bản đồ: trụ được kiểm tra gần đây có viền xanh | MapModule |

**Deliverable:** Công nhân bấm trụ → "Kiểm tra" → điền → gửi. Admin ở nhà thấy ngay.

---

### 🏁 Sprint 3: Admin Dashboard Review

**Mục tiêu:** Trang web cho admin xem tất cả submissions + duyệt.

#### Tuần 3

Tạo route mới `/admin` trong app (lazy-load, chỉ load khi userRole = 'admin'):

```
/admin
├── /submissions       ← Danh sách chờ duyệt
├── /inspections       ← Danh sách kiểm tra  
├── /collectors        ← Danh sách công nhân + thống kê
└── /sync-log          ← Log đồng bộ GIS
```

#### UI chính

```
┌─────────────────────────────────────────────┐
│ DANH SÁCH CHỜ DUYỆT (3)                     │
├─────────────────────────────────────────────┤
│ ☑ Điện kế mới PE...  · Nguyễn Văn A · 15:30 │
│ ☐ Trụ HT F07...      · Trần Văn B  · 14:20 │
│ ☐ KT trạm TBA...     · Lê Văn C    · 13:10 │
│                                             │
│ [DUYỆT ĐÃ CHỌN] [TỪ CHỐI] [XEM ẢNH]         │
└─────────────────────────────────────────────┘
```

| # | Task |
|---|------|
| 1 | Component `AdminDashboard.tsx` (đã có) — expand |
| 2 | Query Firestore `submissions` where status='pending' |
| 3 | Display list + photo preview |
| 4 | Approve → update status='approved' + ghi vào GeoJSON patch |
| 5 | Reject → update status='rejected' + reason |
| 6 | Export batch approved → `pending-sync.geojson` |

**Deliverable:** Admin ở nhà mở link `/admin` → duyệt 20 submissions/5 phút.

---

### 🏁 Sprint 4: Auto-sync về GIS công ty

**Mục tiêu:** Data đã duyệt tự về máy GIS, merge vào master, redeploy.

#### Tuần 4 — 2 cách triển khai, chọn 1

#### Cách A (đơn giản hơn): Script cron trên máy GIS

```python
# scripts/pull_approved.py — chạy mỗi 6 giờ bằng Task Scheduler
from google_drive_api import pull_folder
from datetime import datetime

def main():
    # 1. Pull approved submissions từ Drive
    new_records = pull_folder('/PowerMind/approved/', since=last_sync_time)
    
    # 2. Merge vào master GeoJSON
    master = load_geojson('automation/output/luoi-dien-diem.geojson')
    for rec in new_records:
        feature = record_to_feature(rec)
        master['features'].append(feature)
    save_geojson(master)
    
    # 3. Kích hoạt auto-deploy + build_tiles + git push
    subprocess.run(['python', 'scripts/build_tiles.py'])
    subprocess.run(['git', 'add', '-A'])
    subprocess.run(['git', 'commit', '-m', f'auto-sync {datetime.now()}'])
    subprocess.run(['git', 'push'])
```

Windows Task Scheduler:
```
Trigger: Daily 06:00 + 12:00 + 18:00
Action: python d:\DUAN_AI\Web KTLD\scripts\pull_approved.py
```

**Ưu:** Đơn giản, máy admin chạy, không cần cloud.
**Nhược:** Máy phải bật 24/7.

#### Cách B (chuyên nghiệp): Cloudflare Worker scheduled

```typescript
// worker/scheduled-sync.ts — chạy trên Cloudflare miễn phí
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    // 1. Pull approved từ Firestore (realtime)
    const records = await getFirestore(env, 'submissions', { status: 'approved' });
    
    // 2. Build GeoJSON patch
    const patch = buildGeoJsonPatch(records);
    
    // 3. Commit patch vào GitHub repo qua Octokit
    await githubCommit(env, {
      path: 'automation/output/luoi-dien-diem-patch.geojson',
      content: JSON.stringify(patch),
      message: `auto-sync ${new Date().toISOString()}`,
    });
    
    // 4. GitHub Actions sẽ tự merge patch vào master + redeploy
    // (workflow hiện tại đã handle)
  }
};
```

`wrangler.toml`:
```toml
[triggers]
crons = ["0 */6 * * *"]   # every 6 hours
```

**Ưu:** Hoàn toàn cloud, máy admin không cần bật. Cloudflare Worker free 100k req/day.
**Nhược:** Cần học thêm Worker API, phức tạp hơn.

---

## IV. QUY TRÌNH ADMIN Ở NHÀ

### Kịch bản hàng ngày

**09:00** — Admin mở điện thoại/laptop, vào `https://gis-evn-app.pages.dev/admin`

**09:05** — Thấy 15 submissions mới đêm qua
- 10 điện kế mới được thu thập
- 3 trụ HT mới
- 2 inspection báo "nguy hiểm"

**09:15** — Review + duyệt:
- Bỏ 1 submission ảnh mờ (reject + ghi lý do)
- 14 còn lại OK → bấm "Duyệt hàng loạt"

**09:20** — Bấm "Sync to GIS"
- Worker/script chạy
- 5-7 phút sau → 100 công nhân mở app thấy data mới

**09:30** — Xem submissions hôm qua đã được merge chưa (tab `sync-log`)

### Thời gian admin hàng ngày: ~30 phút

---

## V. PHÂN QUYỀN & BẢO MẬT

### Roles

| Role | Có thể | Không thể |
|------|--------|-----------|
| `collector` (công nhân) | Tìm · Ghim · Thu thập · Kiểm tra | Duyệt · Xoá người khác · Cấu hình |
| `admin` | Tất cả của collector + Review + Sync GIS | Thêm admin khác |
| `superadmin` | Tất cả + Quản lý user + Cấu hình system | — |

### Auth flow

1. **Collector:** Login bằng Firebase (email/phone) → chỉ cần tên + đơn vị
2. **Admin:** Login bằng Google OAuth (để chứng thực Drive) → quyền theo email allowlist

### Bảo mật data

- Ảnh lưu Drive với ACL `private` — chỉ admin + owner xem
- Firestore rules: collector chỉ ghi record của mình
- GPS coords → OK public (không nhạy cảm)
- Số phone KH → chỉ admin xem trong detail (không xuất báo cáo công khai)

---

## VI. TÍNH NĂNG NÂNG CAO (SPRINT 5+)

### 6.1. Thu thập thông minh

- **Photo AI**: nhận diện loại thiết bị từ ảnh (pole vs meter vs trạm) bằng TensorFlow.js trên điện thoại
- **Auto-extract số trụ** từ ảnh biển số bằng OCR
- **Detect hư hỏng** bằng AI image classification (nếu có dataset training)

### 6.2. Thống kê & báo cáo

- **Leaderboard** công nhân: ai thu thập nhiều nhất tuần này
- **Heatmap** vùng đã kiểm tra + vùng chưa kiểm tra
- **Báo cáo ngày/tuần/tháng**: xuất Excel tự động gửi Zalo nhóm

### 6.3. Phối hợp nhóm

- **Assignment**: admin gán lộ trình cho từng công nhân sáng hôm sau
- **Realtime location**: xem 100 công nhân đang ở đâu (nếu họ đồng ý)
- **Chat group** mỗi lộ trình — discuss nhanh với đồng đội

### 6.4. Tích hợp hệ thống EVN

- **Pull data từ CMIS** (billing system): lấy thông tin KH mới
- **Push dữ liệu lên PMIS** (maintenance system): ghi inspection result
- **Sync với SmartGIS/ArcGIS** của EVN: chuẩn hóa format

---

## VII. DANH SÁCH CÔNG CỤ MIỄN PHÍ DÙNG

| Tool | Dùng làm gì | Free tier |
|------|-------------|-----------|
| **Cloudflare Pages** | Host frontend | Unlimited |
| **Cloudflare Workers** | Scheduled sync | 100k req/day |
| **Cloudflare R2** | Lưu ảnh (alternative Drive) | 10GB |
| **Cloudflare D1** | SQLite database | 5GB |
| **GitHub** | Source + Actions | Public repo unlimited |
| **Google Drive** | Lưu ảnh + submissions | 15GB |
| **Firebase Auth** | Login | Unlimited |
| **Firebase Firestore** | Realtime DB | 50k op/day |
| **Firebase Storage** | Lưu ảnh (alt) | 5GB |
| **Supabase** | Postgres + Auth | 500MB DB |
| **Sentry** | Error tracking | 5k event/month |
| **Plausible (self-host)** | Analytics | Free self |
| **MeiliSearch Cloud** | Search engine | 100k doc |

**Chọn combo cho PowerMind V2:**

| Phần | Combo đề xuất |
|------|----------------|
| Frontend host | Cloudflare Pages |
| Upload ảnh | Google Drive (đã có auth) |
| Realtime DB | Firebase Firestore |
| Auth | Firebase Auth |
| Scheduled sync | Windows Task Scheduler (đơn giản) hoặc CF Worker |
| Error tracking | Sentry free |

Tổng chi phí: **0 đồng/tháng** cho 100 user.

---

## VIII. ƯU TIÊN VÀ SỐ GIỜ ƯỚC TÍNH

| Sprint | Tính năng | Giờ ước tính | Giá trị |
|:-:|------|:--:|---------|
| 1 | Thu thập điểm mới (Drive upload) | 15h | 🔴 Cực cao |
| 2 | Kiểm tra lưới điện (checklist) | 12h | 🔴 Cao |
| 3 | Admin Dashboard duyệt | 18h | 🟡 Trung bình |
| 4 | Auto-sync GIS về công ty | 10h | 🔴 Cao |
| 5 | Tính năng nâng cao (AI, stats) | 25h | 🟢 Nice to have |

**Total V2 (Sprint 1-4):** ~55 giờ code.

**Đề xuất phân phối:**
- Dev làm toàn bộ: 2 tuần full-time
- Dev làm part-time (sau giờ hành chính): 4-5 tuần
- Có support từ team IT EVN: nhanh hơn 30%

---

## IX. RỦI RO VÀ GIẢM THIỂU

| Rủi ro | Xác suất | Ảnh hưởng | Biện pháp |
|--------|:-:|:-:|-----------|
| Google Drive API rate limit | Thấp | Medium | Batch upload, retry với exponential backoff |
| Firebase quota vượt | Thấp | High | Thiết kế caching client, monitor quota |
| Ảnh mất vì device lỗi | Trung bình | High | Sync ngay khi online, không chờ user bấm |
| Data bị merge sai | Trung bình | High | Luôn lưu patch separate, không overwrite master |
| Admin approve sai | Cao | Medium | Có nút "Rollback last sync" |
| GPS kém gây điểm lệch | Cao | Low | Yêu cầu accuracy < 10m mới cho submit |

---

## X. ĐỊNH HƯỚNG NHÌN XA

### 6 tháng nữa

- 100 công nhân đang active
- Đã thu thập ~10,000 điểm mới
- Data GIS công ty update realtime
- ROI từ V1 + V2 = 3-4 tỷ/năm

### 12 tháng nữa

- Nhân rộng ra 21 PC EVNHCMC
- 2,100 công nhân dùng
- Sync qua API thẳng với SmartGIS của EVN
- Có app native iOS/Android qua Capacitor

### 24 tháng nữa

- Triển khai toàn EVN Việt Nam (63 tỉnh, 10,000+ user)
- AI detect hư hỏng từ ảnh
- Chatbot trợ lý cho công nhân
- Integration với PMIS/CMIS

---

## XI. BƯỚC TIẾP THEO CHO ANH

### Tuần này (chọn 1 trong 3 option)

**Option A — Bắt đầu Sprint 1 ngay (khuyến nghị nếu gấp)**
1. Confirm với tôi: OK start Sprint 1
2. Tôi viết code thu thập điểm mới
3. Deploy trong 5-7 ngày
4. Test với 10 công nhân

**Option B — Demo V1 trước, V2 sau**
1. Cho 100 user dùng V1 hiện tại 1-2 tháng
2. Ghi nhận feedback thực tế
3. Dựa feedback quyết định V2 cần gì nhất
4. Start Sprint có ưu tiên cao nhất

**Option C — Thuyết phục hợp đồng dài hạn trước**
1. Dùng `SANG_KIEN_POWERMIND.md` + document này
2. Trình ban giám đốc → ký hợp đồng 6-12 tháng
3. Start V2 với budget + thời gian ổn định
4. Làm đúng roadmap 4 sprint

### Câu hỏi cần anh trả lời

1. **Thời gian gấp đến đâu?**
   - Nếu < 1 tháng: cần pilot Sprint 1 ngay
   - Nếu 3-6 tháng: làm từ từ, chất lượng hơn

2. **Admin thật sự là ai?**
   - Chính anh?
   - Team IT EVN?
   - Cần phân quyền nhiều admin không?

3. **Máy GIS công ty hiện tại chạy gì?**
   - Windows / Linux?
   - ArcGIS / QGIS / chỉ Python script?
   - Có API exposed không hay chỉ file?

4. **Data nhạy cảm cỡ nào?**
   - Tên KH + SĐT = OK public cho nhân viên
   - Có cần mã hoá data on-Drive không?

5. **Budget ước chừng?**
   - Dành cho mua tool: 0 / 5tr / 20tr / 50tr/tháng?
   - Dành cho dev: trong nội bộ / thuê ngoài?

---

## XII. TỔNG KẾT

**Mục tiêu:** Biến PowerMind v1 (tra cứu) → v2 (thu thập + sync).

**Nguyên tắc:**
1. **Tận dụng cái có sẵn** — 80% code viết rồi
2. **Zero cost** — dùng free tier Google + Firebase + Cloudflare
3. **Offline-first** — mạng yếu vẫn thu thập được
4. **Admin ở nhà kiểm soát** — không cần ở công ty
5. **Auto-sync khép kín** — công nhân thu → admin duyệt → GIS cập nhật → app user xem

**Deliverable cuối V2:**
- App thu thập điểm mới + kiểm tra trạm
- Dashboard duyệt cho admin
- Sync 2 chiều Drive ↔ GIS công ty
- Tài liệu + hợp đồng maintenance

**Thời gian:** 4 tuần code + 1 tuần test = **5 tuần**.

**Chi phí:** 0 đồng hosting + 0 đồng tool (chỉ giờ công dev).

**Next step:** Anh chọn Option A/B/C ở Phần XI → tôi start luôn.
