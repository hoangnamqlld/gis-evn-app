# 🗂️ Định dạng xuất dữ liệu GIS — Đề xuất cho PowerMind

Anh xuất data từ ArcGIS ở format nào để app load **nhanh nhất**, **không cần preprocess**?

---

## 🏆 Top 3 lựa chọn (xếp hạng)

| # | Format | Size | Preprocess | Bbox query | Đề xuất |
|:-:|--------|:--:|:--:|:--:|:-:|
| 1 | **FlatGeobuf (.fgb)** | Nhỏ (~50MB) | **Không** | ✅ Native R-tree | 🏆 BEST |
| 2 | **PMTiles (.pmtiles)** | Rất nhỏ (~30MB) | Cần tippecanoe | ✅ Native | 🥈 |
| 3 | **GeoJSON** (hiện tại) | Lớn (~300MB) | Cần `build_tiles.py` | ❌ Linear scan | 🥉 OK |

---

## 🏆 FlatGeobuf (.fgb) — Đề xuất CHÍNH

**Tại sao tốt nhất:**

- **ArcGIS Pro xuất trực tiếp** (từ version 3.0+) — không cần converter
- **1 file duy nhất** chứa tất cả features + R-tree spatial index
- **HTTP range request** → app chỉ tải phần bbox đang xem (10-50KB mỗi viewport)
- **10× nhỏ hơn GeoJSON** do binary format
- **Bỏ được `build_tiles.py`** — deploy nhanh hơn

### Cách xuất từ ArcGIS Pro

1. Mở ArcGIS Pro → **Catalog pane**
2. Chuột phải **Feature Class** (VD: `F05_DienKe_HT_S`) → **Data** → **Export Features**
3. **Output Location:** chọn thư mục
4. **Output Name:** `dien_ke.fgb`
5. **Format:** `FlatGeobuf`
6. **OK** → chờ vài phút

### File cần xuất (4 cái, đặt tên rõ ràng):

```
📁 export/
├── dien_ke.fgb          ← F05_DienKe_HT_S  (~200k features)
├── tru_ha_the.fgb       ← F07_Tru_HT_S
├── tru_trung_the.fgb    ← F08_Tru_TT_S
├── tram_trung_the.fgb   ← F04_Tram_TT_S  + S_PMIS_TBA join
├── tram_tbdc.fgb        ← F02_TBDC_HT_S
├── day_trung_the.fgb    ← F10_DuongDay_TT_S  (line)
└── day_ha_the.fgb       ← F08_DuongDay_HT_S  (line)
```

### Quan trọng — trước khi xuất phải

1. **Join attribute table** (S_PMIS_TBA, V_KHANG_CUCHI) vào Feature Class bằng:
   - **Data** → **Joins and Relates** → **Add Join**
   - Key field: GISID hoặc MA_KHANG
   - Sau khi xuất, các field TEN, CONG_SUAT, DIA_CHI_KH... đã nằm trong FGB luôn
2. **Reproject về WGS84** (EPSG:4326) — ArcGIS tự động khi xuất FGB, không cần làm gì
3. **Tick "Export all rows"** để giữ nguyên số lượng

### Gửi cho tôi

Upload 4-7 file `.fgb` lên Drive folder đã có:
```
https://drive.google.com/drive/folders/1vSYVCjGCpcIyG2D2UkhJ-QrhwSLY1pOR
→ tạo subfolder mới: gis-raw-fgb/
```

Tôi sẽ update code app load FGB trực tiếp → bỏ `build_tiles.py` → pipeline gọn.

---

## 🥈 PMTiles — Nếu muốn SIÊU nhanh

**Khi nào dùng:** Nếu data > 1GB hoặc có ≥10,000 user concurrent.

Cần cài `tippecanoe` (macOS/Linux) hoặc WSL trên Windows. Phức tạp hơn nên chỉ dùng nếu FGB không đủ nhanh.

---

## 🥉 GeoJSON (hiện tại) — OK nhưng chậm

App đang dùng. Nếu anh không muốn đổi gì, vẫn chạy được. Nhược:
- File to (300+MB, cần gzip)
- Cần `build_tiles.py` chia tile → deploy chậm
- Không có spatial index native

Nếu tiếp tục dùng GeoJSON, xuất từ ArcGIS:
- **Feature Class to JSON** tool → output .geojson
- Đảm bảo **EPSG:4326** (WGS84)

---

## 📊 So sánh thời gian deploy cho anh

| Bước | GeoJSON (hiện tại) | FlatGeobuf (đề xuất) |
|------|:--:|:--:|
| ArcGIS export | 2 phút | 2 phút |
| `auto-deploy.py` GDB→GeoJSON | 60-90s | ❌ bỏ |
| `build_tiles.py` chia tile | 30s | ❌ bỏ |
| Git push + CI/CD | 5-7 phút | 5-7 phút |
| **Tổng** | **~10 phút** | **~7 phút** |

Khác biệt lớn nhất: **bỏ 2 bước Python** → admin workflow gọn hơn, ít chỗ fail hơn.

---

## 🛠️ Script verify FGB (sau khi anh gửi)

```python
# scripts/verify_fgb.py — check FGB có đúng format không
from flatgeobuf.reader import Reader

for file in ['dien_ke.fgb', 'tru_ht.fgb', ...]:
    reader = Reader(f'export/{file}')
    print(f'{file}: {reader.num_features} features, CRS={reader.crs}')
    # Sample 1 feature
    for feat in reader:
        print(f'  sample: {feat.properties}')
        break
```

Tôi sẽ chạy verify + setup pipeline mới khi nhận được file.

---

## ⚡ Sau khi chuyển sang FGB — app sẽ có

- **Load nhanh hơn:** chỉ tải features trong viewport (~30KB mỗi lần pan) thay vì 10MB full tile
- **Bbox query native:** R-tree index built-in, không cần rbush client
- **Update data:** thay file FGB mới là xong, không rebuild
- **Vẫn offline:** SW cache FGB bình thường
- **Vẫn search nhanh:** MiniSearch client-side giữ nguyên

---

## 🔄 So sánh toàn phần

| Tiêu chí | GeoJSON → tiles | FlatGeobuf |
|----------|:--:|:--:|
| ArcGIS export trực tiếp | ❌ qua Python | ✅ |
| Preprocess cần thiết | ✅ build_tiles.py | ❌ |
| Số file deploy | 25 tile + search.json | 4-7 file |
| Bandwidth CDN | Trần ~15MB/user | ~5MB/user |
| Viewport load | All tiles giao bbox | Chỉ features trong bbox |
| Cập nhật 1 layer | Rebuild all | Thay 1 file |
| Phức tạp code client | Cao (R-tree manual) | Thấp (thư viện sẵn) |
| Chi phí thời gian admin/ngày | 10 phút | **3 phút** |

---

## 🎯 Quyết định của tôi (với tư cách dev)

**Chuyển sang FlatGeobuf** nếu anh đồng ý. Lợi ích:

1. **Pipeline đơn giản hơn** — bỏ 2 bước Python
2. **Admin deploy nhanh hơn** — 10 phút → 3 phút
3. **App load mượt hơn** — load partial, không full tile
4. **Bảo trì dễ hơn** — 1 code path thay vì 2

**Risk thấp:**
- FGB là open standard (OGC)
- Thư viện `flatgeobuf` maintained tốt
- Nếu sau này đổi ý, có thể revert về GeoJSON

**Việc anh cần làm:**
1. Mở ArcGIS Pro
2. Add Join (S_PMIS_TBA → F04_Tram_TT_S, V_KHANG_CUCHI → F05_DienKe_HT_S)
3. Export mỗi FC sang .fgb
4. Upload 7 file .fgb lên Drive folder `gis-raw-fgb/`
5. Báo tôi: "file đã up"

Tôi setup pipeline mới trong 1 ngày.

---

## ❓ Câu hỏi cần anh chốt

1. **Version ArcGIS Pro** của anh: 2.x hay 3.x?
   *(FGB chỉ export được từ 3.0+; 2.x thì phải convert qua QGIS)*
2. **Muốn chuyển FGB không?** Nếu OK → tôi prep code.
3. **Hay giữ GeoJSON?** Cũng OK, pipeline hiện tại vẫn chạy tốt.

Tôi chờ anh.
