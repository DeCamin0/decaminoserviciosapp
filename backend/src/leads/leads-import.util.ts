import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';

/** Fila CSV/JSON: acepta snake_case o camelCase */
export type RawLeadRow = Record<string, unknown>;

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export function normalizePhone(p: string | null): string {
  if (!p) return '';
  return p.replace(/\s+/g, '').replace(/^00/, '+');
}

export function normalizeWebsite(w: string | null): string {
  if (!w) return '';
  let x = w.trim().toLowerCase();
  x = x.replace(/^https?:\/\//i, '').replace(/^www\./, '');
  return (x.split('/')[0] || '').replace(/\/$/, '');
}

export function computeDedupeKey(input: {
  companyName: string;
  phone: string | null;
  website: string | null;
}): string {
  const name = input.companyName.trim().toLowerCase().replace(/\s+/g, ' ');
  return createHash('sha256')
    .update(
      `${name}|${normalizePhone(input.phone)}|${normalizeWebsite(input.website)}`,
    )
    .digest('hex');
}

function getField(row: RawLeadRow, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') {
      return row[k];
    }
  }
  return undefined;
}

export function rowToCreateInput(
  row: RawLeadRow,
): Prisma.LeadCreateManyInput | null {
  const companyName = str(getField(row, 'company_name', 'companyName'));
  if (!companyName) {
    return null;
  }

  const email = str(getField(row, 'email'));
  const phone = str(getField(row, 'phone', 'telefono', 'tel'));
  const website = str(getField(row, 'website', 'web', 'url'));
  const category = str(getField(row, 'category'));
  const country = str(getField(row, 'country')) ?? 'ES';
  const province = str(getField(row, 'province', 'provincia'));
  const city = str(getField(row, 'city', 'ciudad', 'localidad'));
  const sourceName =
    str(getField(row, 'source_name', 'sourceName')) ?? 'import';
  const sourceUrl = str(getField(row, 'source_url', 'sourceUrl'));
  const status = str(getField(row, 'status')) ?? 'new';
  const notes = str(getField(row, 'notes'));

  let scrapedAt: Date | null = null;
  const scrapedRaw = getField(row, 'scraped_at', 'scrapedAt');
  if (scrapedRaw) {
    const d = new Date(String(scrapedRaw));
    if (!Number.isNaN(d.getTime())) scrapedAt = d;
  }

  const explicitDedupe = str(getField(row, 'dedupe_key', 'dedupeKey'));
  const dedupeKey =
    explicitDedupe ??
    computeDedupeKey({ companyName, phone, website: website ?? null });

  return {
    companyName,
    email,
    phone,
    website,
    category,
    country,
    province,
    city,
    sourceName,
    sourceUrl,
    scrapedAt,
    dedupeKey,
    status,
    notes,
  };
}

/**
 * CSV mínimo: primera fila = cabeceras (company_name, …).
 */
export function parseCsvToRecords(csvText: string): RawLeadRow[] {
  const text = csvText.replace(/^\uFEFF/, '').trim();
  if (!text) return [];

  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const out: RawLeadRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (!cells.some((c) => c.trim())) continue;
    const obj: RawLeadRow = {};
    headers.forEach((h, j) => {
      if (h) obj[h] = cells[j] ?? '';
    });
    out.push(obj);
  }
  return out;
}

function parseCsvRows(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (c === '\n' || (c === '\r' && text[i + 1] === '\n')) {
      if (c === '\r') i++;
      row.push(cell);
      cell = '';
      if (row.some((x) => x.trim())) result.push(row);
      row = [];
      continue;
    }
    if (c === '\r') {
      row.push(cell);
      cell = '';
      if (row.some((x) => x.trim())) result.push(row);
      row = [];
      continue;
    }
    cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) result.push(row);
  return result;
}

export function dedupeCreateInputs(
  inputs: Prisma.LeadCreateManyInput[],
): Prisma.LeadCreateManyInput[] {
  const seen = new Set<string>();
  return inputs.filter((r) => {
    if (seen.has(r.dedupeKey)) return false;
    seen.add(r.dedupeKey);
    return true;
  });
}
