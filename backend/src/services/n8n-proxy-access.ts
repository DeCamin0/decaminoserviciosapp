const BLOCKED_FORWARD_HEADERS = new Set([
  'authorization',
  'cookie',
  'host',
  'connection',
  'content-length',
]);

/** Proxy-ul nu mai este anonim. Tokenul sesiunii nu se trimite mai departe către n8n. */
export function n8nProxyRequiresSession(): boolean {
  return true;
}

export function n8nForwardHeaders(
  headers: Record<string, string | undefined> | null | undefined,
): Record<string, string> {
  const forward: Record<string, string> = {};
  if (!headers) return forward;
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue;
    if (BLOCKED_FORWARD_HEADERS.has(key.toLowerCase())) continue;
    forward[key] = value;
  }
  return forward;
}
