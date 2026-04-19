# PowerMind — Quy trình Admin cập nhật dữ liệu

## Cập nhật dữ liệu hàng ngày (tại máy admin)

```
1. Chạy CAP_NHAT_DU_LIEU.bat
   → automation/auto-deploy.py xuất GeoJSON mới vào automation/output/

2. Chạy: python scripts/build_tiles.py
   → Chia GeoJSON thành 25 tile nhỏ + search index
   → Output: thuthaptoado/public/data/{manifest.json, search.json.gz, tiles/*}
   → Version = timestamp hiện tại

3. (Local): Chạy KHOI_DONG_PowerMind.bat để phục vụ user cùng mạng WiFi
   (Deploy Cloudflare Pages sẽ viết sau)

4. User mở app → manifest.json mới → banner "Có dữ liệu mới" → bấm Cập nhật
```

## Khi triển khai Cloudflare Pages (sau này)

```
cd thuthaptoado
npm run build          # chạy build:tiles + build:app
# dist/ chứa toàn bộ: app + data tiles
# Push git → Cloudflare Pages auto-deploy → tất cả user mở app = update
```

## Kiểm tra pipeline

```
# Output tile gzipped
ls thuthaptoado/public/data/tiles/

# Xem manifest
cat thuthaptoado/public/data/manifest.json | python -m json.tool | head -30

# Test serve local
cd Dulieugismoi/luoi-dien-app/backend && node server.js
# Mở http://localhost:3001/app/
```
