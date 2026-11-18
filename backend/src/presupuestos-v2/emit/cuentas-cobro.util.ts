export type CuentaCobro = {
  id: string;
  banco: string;
  iban: string;
};

export function ibanCompacto(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

export function ibanEnGrupos(value: unknown): string {
  const compact = ibanCompacto(value);
  return compact.replace(/(.{4})/g, '$1 ').trim();
}

export function normalizeCuentasCobro(raw: unknown): CuentaCobro[] {
  if (!Array.isArray(raw)) return [];
  const out: CuentaCobro[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const iban = ibanCompacto((row as { iban?: unknown }).iban);
    const banco = String((row as { banco?: unknown }).banco ?? '').trim();
    if (!iban || !banco) continue;
    const id =
      String((row as { id?: unknown }).id ?? '').trim() || `c${out.length + 1}`;
    out.push({ id, banco, iban });
    if (out.length >= 30) break;
  }
  return out;
}
