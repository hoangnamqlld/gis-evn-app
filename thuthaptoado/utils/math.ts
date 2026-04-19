/**
 * Tính khoảng cách giữa hai điểm theo công thức Haversine
 * @param lat1 Vĩ độ điểm 1
 * @param lon1 Kinh độ điểm 1
 * @param lat2 Vĩ độ điểm 2
 * @param lon2 Kinh độ điểm 2
 * @returns Khoảng cách (mét)
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Bán kính trái đất (mét)
  
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Kết quả (mét)
}

/**
 * Tính diện tích polygon theo công thức Shoelace
 * @param points Mảng các điểm [lat, lng]
 * @returns Diện tích (m²)
 */
export function calculatePolygonArea(points: [number, number][]): number {
  if (points.length < 3) return 0;
  
  let area = 0;
  const R = 6371000; // Bán kính trái đất (mét)
  
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    
    const φ1 = points[i][0] * Math.PI / 180;
    const φ2 = points[j][0] * Math.PI / 180;
    const λ1 = points[i][1] * Math.PI / 180;
    const λ2 = points[j][1] * Math.PI / 180;
    
    area += (λ2 - λ1) * (2 + Math.sin(φ1) + Math.sin(φ2));
  }
  
  area = area * R * R / 2;
  return Math.abs(area);
}

/**
 * Format khoảng cách
 * @param meters Khoảng cách (mét)
 * @returns Chuỗi đã format
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Format diện tích
 * @param sqm Diện tích (m²)
 * @returns Chuỗi đã format
 */
export function formatArea(sqm: number): string {
  if (sqm >= 1000000) {
    return `${(sqm / 1000000).toFixed(2)} km²`;
  }
  if (sqm >= 10000) {
    return `${(sqm / 10000).toFixed(2)} ha`;
  }
  return `${Math.round(sqm)} m²`;
}