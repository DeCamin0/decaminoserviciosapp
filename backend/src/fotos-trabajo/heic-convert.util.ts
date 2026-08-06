import convert = require('heic-convert');

const HEIC_MIME = new Set(['image/heic', 'image/heif']);

export function isHeicUpload(mime: string, fileName?: string | null): boolean {
  const m = String(mime || '').toLowerCase();
  if (HEIC_MIME.has(m)) return true;
  const n = String(fileName || '').toLowerCase();
  return n.endsWith('.heic') || n.endsWith('.heif');
}

function replaceHeicExt(name: string): string {
  return name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
}

/**
 * Convert HEIC/HEIF buffers to JPEG for browser-friendly storage.
 * PNG would be lossless but much larger for photos — JPEG @ 0.92 is the right tradeoff.
 */
export async function ensureBrowserImage(input: {
  buffer: Buffer;
  mime: string;
  fileName?: string | null;
}): Promise<{
  buffer: Buffer;
  mime: string;
  fileName: string | null;
  converted: boolean;
}> {
  const fileName = input.fileName ?? null;
  if (!isHeicUpload(input.mime, fileName)) {
    return {
      buffer: input.buffer,
      mime: input.mime,
      fileName,
      converted: false,
    };
  }

  const out = await convert({
    buffer: input.buffer,
    format: 'JPEG',
    quality: 0.92,
  });
  const buffer = Buffer.from(out);

  return {
    buffer,
    mime: 'image/jpeg',
    fileName: fileName ? replaceHeicExt(fileName) : 'foto.jpg',
    converted: true,
  };
}
