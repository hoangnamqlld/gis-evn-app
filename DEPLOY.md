# Hướng dẫn Deploy PowerMind lên Cloudflare Pages

Chi phí: **$0/tháng** cho 100 user. Không cần server. Admin cập nhật data → tất cả user auto-reload khi mở app.

---

## A. Một lần duy nhất — setup lần đầu (15 phút)

### 1. Tạo repo GitHub

```bash
cd "d:/DUAN_AI/Web KTLD"
git init
git lfs install    # quan trọng: file GeoJSON lớn cần LFS
git add .
git commit -m "Initial commit"
# Tạo repo trên github.com (private hay public đều được)
git remote add origin https://github.com/<username>/powermind.git
git branch -M main
git push -u origin main
```

### 2. Tạo Cloudflare Pages project

1. Vào https://dash.cloudflare.com/ → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. Chọn repo `powermind` vừa push
3. Build config:
   - **Framework preset:** None
   - **Build command:** *(để trống — GitHub Actions sẽ tự deploy)*
   - **Build output directory:** `thuthaptoado/dist`
4. Save and Deploy → Cloudflare tạo URL `https://powermind.pages.dev`

### 3. Lấy API token + Account ID cho GitHub Actions

1. Cloudflare → **My Profile** → **API Tokens** → **Create Token** → template **"Edit Cloudflare Workers"** hoặc custom:
   - Permission: `Account - Cloudflare Pages - Edit`
   - Resource: Account = `PowerMind Account`
2. Copy token (chỉ hiện 1 lần)
3. Account ID: có sẵn ở URL dashboard (`82128e90ca821b2902412f4e6bde2207`)

### 4. Thêm secrets vào GitHub

Repo GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
- `CLOUDFLARE_API_TOKEN` = token vừa tạo
- `CLOUDFLARE_ACCOUNT_ID` = `82128e90ca821b2902412f4e6bde2207`

Xong. Mọi `git push main` sẽ auto-deploy.

---

## B. Quy trình hàng ngày của admin

### Khi data GIS thay đổi:

```bash
# 1. Chạy bat để xuất GeoJSON mới từ Geodatabase
CAP_NHAT_DU_LIEU.bat

# 2. Commit + push (GitHub Actions tự build tile + deploy)
git add Dulieugismoi/luoi-dien-app/automation/output/
git commit -m "Update GIS data $(date +%Y-%m-%d)"
git push
```

- GitHub Actions sẽ chạy `python scripts/build_tiles.py` → build tile mới → `npm run build:app` → deploy.
- Trong 3-5 phút, tất cả user mở app sẽ thấy banner xanh **"Có dữ liệu mới · Cập nhật"**.

### Khi chỉ thay đổi code frontend:

```bash
# Code ở thuthaptoado/src/...
git add thuthaptoado/src/
git commit -m "Fix: ..."
git push
```

- Actions sẽ bỏ qua bước `build_tiles.py` (không đổi data) nhưng vẫn rebuild app.
- Admin có thể trigger tay: GitHub → **Actions** → **Deploy to Cloudflare Pages** → **Run workflow** → tick/untick `rebuild_data`.

---

## C. Chia sẻ cho 100 user

1. Link: `https://powermind.pages.dev`
2. Gửi Zalo nhóm kèm hướng dẫn:
   ```
   📱 PowerMind — Mở link rồi bấm "Thêm vào màn hình chính"
   → Icon sẽ xuất hiện như app native
   → Dùng offline sau lần đầu
   
   https://powermind.pages.dev
   ```

### Custom domain (optional, $10/năm)

- Mua domain `.vn` tại Mắt Bão, Nhân Hoà, hoặc Cloudflare Registrar
- Cloudflare Pages → `powermind` project → **Custom domains** → Add `powermind.yourcompany.vn`
- Trỏ DNS như hướng dẫn. 5 phút sau có domain riêng.

---

## D. Giới hạn & chi phí

| Hạng mục | Free tier | Đủ cho 100 user? |
|----------|-----------|:--:|
| Cloudflare Pages bandwidth | Unlimited | ✅ |
| Cloudflare Pages request | Unlimited | ✅ |
| Cloudflare Pages build | 500/tháng | ✅ (dư xa) |
| GitHub Actions | 2000 min/tháng | ✅ (mỗi build ~3min × 30 lần = 90 min) |
| Git LFS bandwidth | 1GB/tháng free | ⚠️ Có thể đụng trần nếu build nhiều |

Nếu đụng trần LFS: nâng lên $5/tháng GitHub LFS data pack (50GB).

---

## E. Troubleshooting

**Build fail `python not found`:**
- `actions/setup-python@v5` đã config sẵn. Kiểm tra version Python 3.11.

**LFS file > 100MB:**
- File `luoi-dien-hathe.geojson` 128MB vẫn push được qua LFS.
- Nếu vẫn fail: giảm size bằng cách pre-filter ở `sync_gis_data.py` hoặc dùng R2 upload trực tiếp (Bonus E1 bên dưới).

**Bonus E1 — Upload data qua R2 thay vì LFS:**
- Tạo R2 bucket `powermind-data` trên Cloudflare
- Workflow upload `public/data/` lên R2 thay vì commit Git
- Frontend fetch từ `https://data.powermind.pages.dev/tiles/...`
- Khi nào cần, báo tôi viết Worker route.

---

## F. Rollback nhanh

Nếu deploy mới bị lỗi:
1. Cloudflare Pages → Project → **Deployments**
2. Tìm deployment trước đó → **...** → **Rollback**
3. 30 giây sau URL trả về phiên bản cũ.
