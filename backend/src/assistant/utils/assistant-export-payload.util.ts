/**
 * Copia profunda para payloads de exportación (Excel/TXT/PDF).
 * Evita que el cliente exporte por error un subconjunto compartido con el prompt LLM.
 */
export function deepCloneForAssistantExport(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(data);
    } catch {
      /* Date/Proxy/BigInt pueden fallar; JSON como respaldo */
    }
  }
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return data;
  }
}
