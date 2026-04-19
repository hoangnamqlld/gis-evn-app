// tsp.ts — Tối ưu thứ tự lộ trình (Traveling Salesman) cho danh sách ghim.
// Nearest-Neighbor + 2-opt improvement. Với 5-20 điểm cho kết quả ~90% optimal trong < 50ms.

import { GridAsset, Coordinates } from '../types';
import { calculateDistance } from './math';

function totalDistance(path: GridAsset[], start?: Coordinates): number {
  let sum = 0;
  let prev = start ? { lat: start.lat, lng: start.lng } : null;
  for (const a of path) {
    if (prev) sum += calculateDistance(prev.lat, prev.lng, a.coords.lat, a.coords.lng);
    prev = a.coords;
  }
  return sum;
}

function nearestNeighbor(items: GridAsset[], start: Coordinates): GridAsset[] {
  const remaining = [...items];
  const ordered: GridAsset[] = [];
  let cur = { lat: start.lat, lng: start.lng };
  while (remaining.length) {
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = calculateDistance(cur.lat, cur.lng, remaining[i].coords.lat, remaining[i].coords.lng);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const picked = remaining.splice(bestIdx, 1)[0];
    ordered.push(picked);
    cur = picked.coords;
  }
  return ordered;
}

function twoOpt(path: GridAsset[], start: Coordinates, maxIter = 50): GridAsset[] {
  let best = path;
  let bestDist = totalDistance(best, start);
  for (let iter = 0; iter < maxIter; iter++) {
    let improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const d = totalDistance(candidate, start);
        if (d < bestDist - 0.001) {
          best = candidate;
          bestDist = d;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return best;
}

export interface TspResult {
  ordered: GridAsset[];
  totalKm: number;
  savedKm: number; // so với thứ tự gốc
}

export function optimizeRoute(pins: GridAsset[], startFrom: Coordinates | null): TspResult {
  if (pins.length <= 1) return { ordered: pins, totalKm: 0, savedKm: 0 };
  const start = startFrom || pins[0].coords;
  const originalKm = totalDistance(pins, start) / 1000;
  const nn = nearestNeighbor(pins, start);
  const optimized = pins.length > 2 ? twoOpt(nn, start) : nn;
  const optimizedKm = totalDistance(optimized, start) / 1000;
  return {
    ordered: optimized,
    totalKm: optimizedKm,
    savedKm: Math.max(0, originalKm - optimizedKm),
  };
}
