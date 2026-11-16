const PEDIDOS_NOTA_IMAGE = /^\/api\/pedidos-notas\/imagenes\/\d+\/archivo$/;

/**
 * Headerul Bearer este calea normală.
 * Query-ul `token` rămâne doar pentru imaginile din notele de comenzi,
 * unde pagina închisă le pune în src-ul unui <img>.
 */
export function extractJwtToken(input: {
  authorizationHeader?: string | string[] | null;
  queryToken?: unknown;
  method?: string | null;
  path?: string | null;
}): string | null {
  const header = Array.isArray(input.authorizationHeader)
    ? input.authorizationHeader[0]
    : input.authorizationHeader;
  const bearer = String(header || '').match(/^Bearer\s+(\S+)/i);
  if (bearer?.[1]) return bearer[1];

  if (typeof input.queryToken !== 'string') return null;
  const query = input.queryToken.trim();
  if (!query) return null;

  const method = String(input.method || '').toUpperCase();
  const path = String(input.path || '').split('?')[0];
  if (method === 'GET' && PEDIDOS_NOTA_IMAGE.test(path)) return query;
  return null;
}
