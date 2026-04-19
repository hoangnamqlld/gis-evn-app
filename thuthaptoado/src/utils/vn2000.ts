// vn2000.ts — Chuyển đổi toạ độ WGS84 ↔ VN-2000 bằng proj4 (chuẩn quốc tế)
//
// Hỗ trợ 3 hệ VN-2000 phổ biến:
//   - TP.HCM (3° zone 105°45'):  EPSG:9208 tương đương
//   - UTM 48N (6° zone 105°):    EPSG:32648/9210
//   - UTM 49N (6° zone 111°):    EPSG:32649/9211
//
// Datum shift WGS84 → VN-2000 đã được include.

import proj4 from 'proj4';

// Helmert datum shift params (Quyết định 05/2007/QĐ-BTNMT)
const WGS84_TO_VN2000_SHIFT =
  '+towgs84=-191.90441429,-39.30318279,-111.45032835,' +
  '0.00928836,-0.01975479,0.00427372,0.252906278';

// Định nghĩa các hệ VN-2000 phổ biến
proj4.defs([
  // TP.HCM local zone (3° meridian 105°45')
  ['VN2000:HCM',
    `+proj=tmerc +lat_0=0 +lon_0=105.75 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 ${WGS84_TO_VN2000_SHIFT} +units=m +no_defs`],
  // UTM zone 48N (toàn Nam Bộ — 6° meridian 105°)
  ['VN2000:UTM48',
    `+proj=utm +zone=48 +ellps=WGS84 ${WGS84_TO_VN2000_SHIFT} +units=m +no_defs`],
  // UTM zone 49N
  ['VN2000:UTM49',
    `+proj=utm +zone=49 +ellps=WGS84 ${WGS84_TO_VN2000_SHIFT} +units=m +no_defs`],
]);

// Zone mặc định — có thể đổi theo đơn vị EVN
// PCCCh (Củ Chi) thường dùng HCM local 3°
const DEFAULT_ZONE = 'VN2000:HCM';

export function isValidVNCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= 7 && lat <= 24
    && lng >= 102 && lng <= 110;
}

/**
 * Chuyển WGS84 (lat, lng độ thập phân) → VN2000 (x, y mét).
 * Trả {NaN, NaN} nếu toạ độ ngoài phạm vi Việt Nam.
 */
export function convertWGS84toVN2000(
  lat: number,
  lng: number,
  zone: string = DEFAULT_ZONE,
): { x: number; y: number } {
  if (!isValidVNCoords(lat, lng)) return { x: NaN, y: NaN };
  try {
    // proj4 dùng thứ tự [lng, lat]
    const [x, y] = proj4('EPSG:4326', zone, [lng, lat]);
    return {
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
    };
  } catch (e) {
    console.warn('[VN2000] Convert failed:', e);
    return { x: NaN, y: NaN };
  }
}

/** Đổi VN2000 → WGS84 (dùng khi import từ ArcGIS về) */
export function convertVN2000toWGS84(
  x: number,
  y: number,
  zone: string = DEFAULT_ZONE,
): { lat: number; lng: number } {
  try {
    const [lng, lat] = proj4(zone, 'EPSG:4326', [x, y]);
    return {
      lat: Math.round(lat * 1e8) / 1e8,
      lng: Math.round(lng * 1e8) / 1e8,
    };
  } catch (e) {
    console.warn('[VN2000] Reverse convert failed:', e);
    return { lat: NaN, lng: NaN };
  }
}

export const VN2000_ZONES = {
  HCM: 'VN2000:HCM',
  UTM48: 'VN2000:UTM48',
  UTM49: 'VN2000:UTM49',
} as const;
