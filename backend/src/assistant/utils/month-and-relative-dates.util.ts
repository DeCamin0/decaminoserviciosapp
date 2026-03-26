/**
 * Normalización para matching (español / rumano / inglés) sin depender del LLM.
 */

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calendario en España (Europe/Madrid). El servidor suele estar en UTC;
 * «este mes» a las 00:30 del día 1 en Madrid puede seguir siendo el mes anterior en UTC.
 */
export function getSpainCalendarYearMonthDay(): {
  year: number;
  month: number;
  day: number;
} {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? 0);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 0);
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? 0);
  return { year, month, day };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Mes canónico en español (misma lista que DataQueryService). */
export type SpanishMonthName =
  | 'enero'
  | 'febrero'
  | 'marzo'
  | 'abril'
  | 'mayo'
  | 'junio'
  | 'julio'
  | 'agosto'
  | 'septiembre'
  | 'octubre'
  | 'noviembre'
  | 'diciembre';

const MESES_ES_CANON: SpanishMonthName[] = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * Año/mes (España) para filtros de cuadrante / plan mensual del asistente.
 * Alineado con la lógica de `buildCuadranteMesSqlCondition` (enero pidiéndose en diciembre en España → año siguiente).
 */
export function resolveSpainMonthYearFromEntities(entidades?: {
  mes?: string;
  year?: string;
}): { y: number; m: number } {
  const spain = getSpainCalendarYearMonthDay();
  let y = spain.year;
  let mo = spain.month;
  const explicitYear =
    Boolean(entidades?.year) &&
    /^\d{4}$/.test(String(entidades?.year).trim());
  if (explicitYear) {
    y = parseInt(String(entidades?.year).trim(), 10);
  }
  if (entidades?.mes) {
    const raw = String(entidades.mes)
      .replace(/^completo_/i, '')
      .toLowerCase();
    const idx = MESES_ES_CANON.indexOf(raw as SpanishMonthName);
    if (idx >= 0) {
      mo = idx + 1;
      if (!explicitYear && spain.month === 12 && idx === 0) {
        y = spain.year + 1;
      }
    }
  }
  return { y, m: mo };
}

const MONTH_RULES: { es: SpanishMonthName; aliases: string[] }[] = [
  {
    es: 'enero',
    aliases: ['enero', 'ianuarie', 'january'],
  },
  {
    es: 'febrero',
    aliases: ['febrero', 'februarie', 'february'],
  },
  {
    es: 'marzo',
    aliases: ['marzo', 'martie', 'march'],
  },
  {
    es: 'abril',
    aliases: ['abril', 'aprilie', 'april'],
  },
  {
    es: 'mayo',
    aliases: ['mayo', 'mai', 'may'],
  },
  {
    es: 'junio',
    aliases: ['junio', 'iunie', 'june'],
  },
  {
    es: 'julio',
    aliases: ['julio', 'iulie', 'july'],
  },
  {
    es: 'agosto',
    aliases: ['agosto', 'august'],
  },
  {
    es: 'septiembre',
    aliases: ['septiembre', 'septembrie', 'september', 'setiembre', 'sep'],
  },
  {
    es: 'octubre',
    aliases: ['octubre', 'octombrie', 'october'],
  },
  {
    es: 'noviembre',
    aliases: ['noviembre', 'noiembrie', 'november'],
  },
  {
    es: 'diciembre',
    aliases: ['diciembre', 'decembrie', 'december'],
  },
];

/**
 * Detecta el primer mes mencionado y devuelve el nombre en español para entidades.mes.
 */
export function extractSpanishMonthFromText(
  raw: string,
): SpanishMonthName | null {
  const n = normalizeForMatch(raw);
  for (const { es, aliases } of MONTH_RULES) {
    for (const a of aliases) {
      const an = normalizeForMatch(a);
      if (an.length < 3) continue;
      const re = new RegExp(`\\b${escapeRe(an)}\\b`, 'i');
      if (re.test(n)) {
        return es;
      }
    }
  }
  return null;
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Si el texto indica hoy / ayer / mañana (ES/RO), devuelve fecha YYYY-MM-DD en hora local.
 */
export function extractRelativeDayIso(raw: string): string | null {
  const n = normalizeForMatch(raw);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (/\b(pentru|pt\.?)\s+(azi|astazi)\b/.test(n)) {
    return formatYmd(today);
  }
  if (/\b(para|de)\s+hoy\b/.test(n)) {
    return formatYmd(today);
  }

  if (/\b(hoy|azi|astazi|avui|oggi|today)\b/i.test(n)) {
    return formatYmd(today);
  }
  if (/\b(ayer|ieri|yesterday)\b/i.test(n)) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return formatYmd(d);
  }
  if (/\b(manana|mañana|maine|mâine|tomorrow)\b/i.test(n)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return formatYmd(d);
  }
  return null;
}

/** Referencia temporal relativa (fichajes / follow-ups). */
export function hasRelativeDayKeyword(raw: string): boolean {
  return extractRelativeDayIso(raw) != null;
}

const FOLLOW_UP_CUES = [
  'dar ',
  'daca ',
  'dacă ',
  'si ',
  'sí ',
  'y ',
  'și ',
  'pero ',
  'what about',
  'how about',
  'iar ',
  'iară',
];

/**
 * Perioade naturale RO/ES: luna curentă (completo_mes) sau anul curent (year YYYY).
 * Nu forța ambele: „luna asta” → doar mes; „anul asta” → doar year.
 */
export function extractNaturalPeriodEntityPatch(raw: string): {
  mes?: string;
  year?: string;
} {
  const n = normalizeForMatch(raw);
  const out: { mes?: string; year?: string } = {};
  const spain = getSpainCalendarYearMonthDay();
  const yearStr = String(spain.year);
  const mesesEs: SpanishMonthName[] = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  const currentMonthEs = mesesEs[spain.month - 1];

  const currentMonthPhrase =
    /\b(luna\s+asta|luna\s+aceasta|luna\s+curenta)\b/.test(n) ||
    /\b(este\s+mes|mes\s+actual|este\s+mes\s+actual)\b/.test(n);

  const currentYearPhrase =
    /\b(anul\s+asta|anu\s+asta|anul\s+acesta|in\s+acest\s+an)\b/.test(n) ||
    /\b(este\s+ano|este\s+an)\b/.test(n) ||
    /\b(el\s+ano\s+actual|ano\s+actual)\b/.test(n);

  if (currentMonthPhrase) {
    out.mes = `completo_${currentMonthEs}`;
  } else if (currentYearPhrase) {
    out.year = yearStr;
  }

  return out;
}

/** „Este mes” / „mes actual” / etc.: amplo de lună, nu o zi concretă (anulează fecha sticky din context). */
export function messageImpliesWholeMonthSchedule(raw: string): boolean {
  if (extractNaturalPeriodEntityPatch(raw).mes) {
    return true;
  }
  const lower = raw.toLowerCase();
  const phrases = [
    'todo el mes',
    'tot mesul',
    'luna asta',
    'luna aceasta',
    'luna curenta',
    'este mes',
    'este mes actual',
    'mes actual',
    'mes corriente',
    'todo el mes de',
    'tot mesul de',
    'este mes de',
    'mes actual de',
    'horario del mes',
    'horario de este mes',
    'cuadrante del mes',
    'cuadrante de este mes',
    'registros del mes',
    'fichajes del mes',
    'registros de este mes',
    'fichajes de este mes',
    'todos los registros del mes',
  ];
  return phrases.some((p) => lower.includes(p));
}

/**
 * Mensaje corto que suena a cambio de periodo / seguimiento (p. ej. "dar in aprilie?").
 */
export function looksLikeShortTemporalFollowUp(raw: string): boolean {
  const t = raw.trim();
  if (t.length > 96) {
    return false;
  }
  const n = normalizeForMatch(t);
  if (extractSpanishMonthFromText(t)) {
    return true;
  }
  if (hasRelativeDayKeyword(t)) {
    return true;
  }
  const patch = extractNaturalPeriodEntityPatch(t);
  if (patch.mes || patch.year) {
    return true;
  }
  for (const cue of FOLLOW_UP_CUES) {
    const c = normalizeForMatch(cue);
    if (n.startsWith(c) || n.includes(` ${c}`)) {
      return true;
    }
  }
  return false;
}

/**
 * „Próximos 5 días”, „en los próximos 10 días”, „următoarele 3 zile”, „next 7 days”.
 * Returnează N (1–90) sau null.
 */
export function extractProximosDiasCount(raw: string): number | null {
  const n = normalizeForMatch(raw);
  const capped = (v: number) =>
    Number.isFinite(v) ? Math.min(90, Math.max(1, Math.floor(v))) : null;

  let m = /\b(proximos?|siguientes?)\s+(\d{1,2})\s*d[ií]as?\b/.exec(n);
  if (m) return capped(parseInt(m[2], 10));

  m = /\ben\s+los\s+proximos?\s+(\d{1,2})\s*d[ií]as?\b/.exec(n);
  if (m) return capped(parseInt(m[1], 10));

  m = /\bpara\s+los\s+proximos?\s+(\d{1,2})\s*d[ií]as?\b/.exec(n);
  if (m) return capped(parseInt(m[1], 10));

  m = /\b(los\s+)?proximos?\s+(\d{1,2})\s*d[ií]as?\b/.exec(n);
  if (m) return capped(parseInt(m[2], 10));

  m = /\b(urmatoarele|următoarele)\s+(\d{1,2})\s*zile\b/.exec(n);
  if (m) return capped(parseInt(m[2], 10));

  m = /\bnext\s+(\d{1,2})\s*days?\b/.exec(n);
  if (m) return capped(parseInt(m[1], 10));

  return null;
}
