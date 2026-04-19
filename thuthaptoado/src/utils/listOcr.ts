// listOcr.ts — OCR ảnh danh sách KH rồi trích PE / SĐT / tên để batch search + ghim.
// Tesseract.js lazy-load để không tăng initial bundle.

export interface OcrExtract {
  raw: string;            // full text recognized
  peCodes: string[];      // PE09...
  phones: string[];       // 09..., 08...
  tbtIds: string[];       // TBT... hoặc mã trạm số
  lines: string[];        // các dòng đã normalize (có thể search theo tên)
}

/** Tesseract chunk lazy-loaded */
let tesseractMod: any = null;
async function getTesseract() {
  if (!tesseractMod) tesseractMod = await import('tesseract.js');
  return tesseractMod;
}

export async function ocrImage(
  blob: Blob | File,
  onProgress?: (pct: number) => void,
): Promise<OcrExtract> {
  const { createWorker } = await getTesseract();
  const worker = await createWorker('vie', 1, {
    logger: (m: any) => {
      if (m?.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(Math.round(m.progress * 100));
      }
    },
  });
  try {
    const { data } = await worker.recognize(blob);
    const raw = (data?.text || '').trim();
    return extractFromText(raw);
  } finally {
    try { await worker.terminate(); } catch {}
  }
}

/** Parse text trong clipboard hoặc OCR để lấy ID. Có thể dùng cho dán text không cần ảnh. */
export function extractFromText(raw: string): OcrExtract {
  const upper = raw.toUpperCase();
  // Mã PE của EVN: PE + 11 số (ví dụ PE09000040120). Một số format rút gọn cũng gặp 8-13 chữ số.
  const peMatches = upper.match(/PE\s?\d{7,13}/g) || [];
  const peCodes = Array.from(new Set(peMatches.map(s => s.replace(/\s/g, ''))));

  // Số điện thoại VN: 09x, 08x, 07x, 03x, 05x — 10 chữ số (chấp nhận có dấu . hoặc khoảng trắng)
  const phoneRaw = raw.match(/(?:\+?84|0)[\s.\-]?\d(?:[\s.\-]?\d){8,9}/g) || [];
  const phones = Array.from(new Set(phoneRaw.map(s => s.replace(/\D/g, '').replace(/^84/, '0')).filter(p => p.length === 10)));

  // TBT_ID: 6 chữ số liên tiếp (ví dụ 086986). Loại trừ trùng với phone.
  const phoneSet = new Set(phones);
  const tbtRaw = raw.match(/\b\d{6}\b/g) || [];
  const tbtIds = Array.from(new Set(tbtRaw.filter(t => !phoneSet.has('0' + t) && !phoneSet.has(t))));

  // Lines để match fuzzy theo tên KH
  const lines = raw.split(/\r?\n|;|\||,(?=[A-ZÀ-Ỹ])/).map(s => s.trim()).filter(s => s.length > 4 && s.length < 100);

  return { raw, peCodes, phones, tbtIds, lines };
}
