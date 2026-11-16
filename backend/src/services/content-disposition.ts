function stripUnsafeFilenameChars(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 31 || code === 127) continue;
    out += value[i];
  }
  return out;
}

export function sanitizeContentDispositionFilename(
  filename: unknown,
  fallback = 'archivo',
): string {
  const cleaned = stripUnsafeFilenameChars(String(filename ?? ''))
    .replace(/["\\;]/g, '')
    .trim()
    .slice(0, 180);
  return cleaned || fallback;
}

export function contentDisposition(
  kind: 'inline' | 'attachment',
  filename: unknown,
  fallback = 'archivo',
): string {
  const cleaned = sanitizeContentDispositionFilename(filename, fallback);
  return `${kind}; filename="${cleaned}"; filename*=UTF-8''${encodeURIComponent(cleaned)}`;
}
