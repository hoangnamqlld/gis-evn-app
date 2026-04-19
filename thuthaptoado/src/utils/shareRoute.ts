// shareRoute.ts — Encode/decode danh sách ghim vào URL fragment để chia sẻ nhanh qua Zalo.
// Không cần server: `https://app.com/#pins=PE09000040120,PE09000117924,...`
// Người nhận mở link → app đọc fragment → tự ghim.

const FRAGMENT_KEY = 'pins';

export function buildShareUrl(ids: string[]): string {
  const base = location.origin + location.pathname;
  if (!ids.length) return base;
  return `${base}#${FRAGMENT_KEY}=${ids.join(',')}`;
}

/** Đọc ids từ URL fragment khi app mount. Trả về ids nếu có, kèm flag clear để xoá fragment sau khi import. */
export function readFragmentPins(): string[] {
  try {
    const hash = location.hash.replace(/^#/, '');
    if (!hash) return [];
    const parts = Object.fromEntries(hash.split('&').map(kv => kv.split('=')));
    const raw = parts[FRAGMENT_KEY];
    if (!raw) return [];
    return decodeURIComponent(raw).split(',').map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function clearFragment() {
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {}
}

/** Copy URL ghim vào clipboard. Trả về URL. */
export async function copyShareUrl(ids: string[]): Promise<string> {
  const url = buildShareUrl(ids);
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // fallback cho iOS cũ
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
  }
  return url;
}

/** Gọi Web Share API nếu có (mobile), fallback copy clipboard. */
export async function shareRoute(ids: string[], title = 'Lộ trình PowerMind') {
  const url = buildShareUrl(ids);
  if (navigator.share) {
    try {
      await navigator.share({ title, text: `${ids.length} điểm KH cần kiểm tra`, url });
      return;
    } catch {}
  }
  await copyShareUrl(ids);
}
