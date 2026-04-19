export function isValidVNCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= 7 && lat <= 24
    && lng >= 102 && lng <= 110;
}

export function convertWGS84toVN2000(lat: number, lng: number): { x: number; y: number } {
  if (!isValidVNCoords(lat, lng)) return { x: NaN, y: NaN };

  // Tham số ellipsoid WGS84
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const k0 = 0.9999;
  const lon0 = 105.75 * Math.PI / 180;

  const latRad = lat * Math.PI / 180;
  const lonRad = lng * Math.PI / 180;
  
  const e2 = 2 * f - f * f;
  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) ** 2);
  
  const T = Math.tan(latRad) ** 2;
  const C = e2 * Math.cos(latRad) ** 2 / (1 - e2);
  const A = (lonRad - lon0) * Math.cos(latRad);
  
  // Tính M (chiều dài cung kinh tuyến)
  const M = a * (
    (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256) * latRad -
    (3*e2/8 + 3*e2**2/32 + 45*e2**3/1024) * Math.sin(2 * latRad) +
    (15*e2**2/256 + 45*e2**3/1024) * Math.sin(4 * latRad) -
    (35*e2**3/3072) * Math.sin(6 * latRad)
  );
  
  // Tính tọa độ VN2000
  const x = k0 * N * (
    A + 
    (1 - T + C) * A**3 / 6 + 
    (5 - 18*T + T**2 + 72*C - 58*e2) * A**5 / 120
  ) + 500000;
  
  const y = k0 * (
    M + 
    N * Math.tan(latRad) * (
      A**2 / 2 + 
      (5 - T + 9*C + 4*C**2) * A**4 / 24 +
      (61 - 58*T + T**2 + 600*C - 330*e2) * A**6 / 720
    )
  );
  
  return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
}