/**
 * Origini permise pentru HTTP și pentru WebSocket.
 * CORS_ORIGINS / CORS_ORIGIN, plus adresele aplicației.
 * În dev, dacă lista e goală, rămâne localhost:5173.
 */
export function buildUniqueCorsOrigins(): string[] {
  const fromList = (value?: string) =>
    value?.trim()
      ? value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      : [];

  const explicit = fromList(
    process.env.CORS_ORIGINS || process.env.CORS_ORIGIN,
  );
  const implicitDefaults =
    explicit.length > 0
      ? []
      : process.env.NODE_ENV === 'production'
        ? []
        : ['http://localhost:5173'];

  const originFromBaseUrl = (raw?: string): string[] => {
    const value = raw?.trim();
    if (!value) return [];
    try {
      const parsed = new URL(value);
      return [`${parsed.protocol}//${parsed.host}`];
    } catch {
      return [];
    }
  };

  return [
    ...new Set([
      ...explicit,
      ...implicitDefaults,
      ...originFromBaseUrl(process.env.FRONTEND_APP_URL),
      ...originFromBaseUrl(process.env.APP_URL),
      ...originFromBaseUrl(process.env.FRONTEND_URL),
    ]),
  ];
}

export function isCorsOriginAllowed(origin?: string): boolean {
  if (!origin) return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return buildUniqueCorsOrigins().includes(origin);
}
