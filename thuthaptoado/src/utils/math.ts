// src/utils/math.ts

/**
 * Tính khoảng cách giữa hai điểm theo công thức Haversine (km)
 */
import { Coordinates } from '../types';

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Bán kính trái đất (km)
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // km
  return distance * 1000; // mét
};

const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};

/**
 * Format số với đơn vị
 */
export const formatNumber = (num: number, unit: string = ''): string => {
  return num.toLocaleString('vi-VN') + unit;
};

/**
 * Format ngày giờ
 */
export const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * Format ngày
 */
export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Tính toán bounding box từ danh sách tọa độ
 */
export const calculateBounds = (coordinates: Coordinates[]) => {
  // SỬA LỖI: Kiểm tra mảng rỗng trước khi truy cập
  if (!coordinates || coordinates.length === 0) {
    return {
      minLat: 0,
      maxLat: 0,
      minLng: 0,
      maxLng: 0
    };
  }
  
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  
  coordinates.forEach(coord => {
    minLat = Math.min(minLat, coord.lat);
    maxLat = Math.max(maxLat, coord.lat);
    minLng = Math.min(minLng, coord.lng);
    maxLng = Math.max(maxLng, coord.lng);
  });
  
  return {
    minLat,
    maxLat,
    minLng,
    maxLng
  };
};

/**
 * Tính diện tích đa giác (km²) - Hữu ích cho Region Mode
 */
export const calculatePolygonArea = (points: Coordinates[]): number => {
  if (points.length < 3) return 0;
  
  let area = 0;
  const R2 = 6371 * 6371; // Bán kính trái đất bình phương (km²)
  
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const xi = points[i].lat * Math.PI / 180;
    const yi = points[i].lng * Math.PI / 180;
    const xj = points[j].lat * Math.PI / 180;
    const yj = points[j].lng * Math.PI / 180;
    
    area += (xj - xi) * (2 + Math.sin(yi) + Math.sin(yj));
  }
  
  area = Math.abs(area * R2 / 2);
  return area;
};

/**
 * Tính trung tâm của một tập hợp tọa độ
 */
export const calculateCenter = (coordinates: Coordinates[]): Coordinates | null => {
  if (!coordinates || coordinates.length === 0) return null;
  
  let sumLat = 0;
  let sumLng = 0;
  
  coordinates.forEach(coord => {
    sumLat += coord.lat;
    sumLng += coord.lng;
  });
  
  return {
    lat: sumLat / coordinates.length,
    lng: sumLng / coordinates.length
  };
};