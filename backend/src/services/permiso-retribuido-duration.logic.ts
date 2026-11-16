import {
  isSolicitudStaff,
  type SolicitudActor,
} from './solicitudes-actor-policy';

export type SlotState = 'missing' | 'empty' | 'work' | 'off' | 'unknown';
export type HolidayState = 'none' | 'applies' | 'unresolved';
export type ScheduleSource =
  | 'cuadrante'
  | 'multicentro'
  | 'horarios'
  | 'festivo'
  | 'none';

export type DayScheduleInput = {
  date: string;
  cuadrante: SlotState;
  multicentro: SlotState;
  horario: 'work' | 'off' | 'missing';
  holiday: HolidayState;
};

export type DayDecision = {
  date: string;
  status: 'work' | 'off' | 'unknown';
  source: ScheduleSource;
};

export type PermisoDuration = {
  status: 'calculated' | 'needs_verification';
  workingDays: number | null;
  knownWorkingDays: number;
  calendarDays: number;
  unknownDates: string[];
  workDates: string[];
  offDates: string[];
  days: DayDecision[];
  manual: boolean;
  /** Durată deja salvată, diferită de calculul curent. Nu se prezintă calculul nou ca aprobat. */
  registered: boolean;
  headline: string;
  intervalo: string;
  detail: string;
  text: string;
};

const OFF_MARKERS = new Set([
  'LIB',
  'LIBRE',
  'L',
  'DESCANSO',
  'FESTIVO',
  'VAC',
  'VACACIONES',
  'BAJA',
  'X',
  '0',
  '0H',
  '0 H',
]);

const WEEKDAY = ['dum', 'lun', 'mar', 'mie', 'joi', 'vin', 'sam'] as const;

export function isPermisoRetribuido(tipo: unknown): boolean {
  return (
    String(tipo || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '') === 'permiso retribuido'
  );
}

export function madridIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    const year = get('year');
    const month = get('month');
    const day = get('day');
    if (year && month && day) return `${year}-${month}-${day}`;
  }
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function eachIsoDate(inicio: string, fin: string): string[] {
  const start = madridIsoDate(inicio);
  const end = madridIsoDate(fin);
  if (!start || !end || end < start) return [];
  const dates: string[] = [];
  let [year, month, day] = start.split('-').map(Number);
  while (dates.length <= 400) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dates.push(iso);
    if (iso === end) return dates;
    const next = new Date(Date.UTC(year, month - 1, day + 1, 12));
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
  }
  return dates;
}

export function weekdayPrefix(iso: string): (typeof WEEKDAY)[number] {
  const [year, month, day] = iso.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return WEEKDAY[weekday] ?? 'lun';
}

const MONTH_NAMES: Record<string, number> = {
  enero: 1,
  ene: 1,
  febrero: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  mayo: 5,
  may: 5,
  junio: 6,
  jun: 6,
  julio: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  septiembre: 9,
  setiembre: 9,
  sep: 9,
  octubre: 10,
  oct: 10,
  noviembre: 11,
  nov: 11,
  diciembre: 12,
  dic: 12,
};

export type LunaResolution =
  | { kind: 'dated'; year: number; month: number }
  | { kind: 'ambiguous'; month: number }
  | { kind: 'ignore' };

function datedMonth(year: number, month: number): LunaResolution {
  if (year < 1990 || year > 2100 || month < 1 || month > 12) {
    return { kind: 'ignore' };
  }
  return { kind: 'dated', year, month };
}

function resolveLunaNumber(value: number): LunaResolution {
  if (!Number.isFinite(value)) return { kind: 'ignore' };
  const rounded = Math.round(value);
  if (rounded >= 1 && rounded <= 12)
    return { kind: 'ambiguous', month: rounded };
  if (rounded >= 190001 && rounded <= 210012) {
    return datedMonth(Math.floor(rounded / 100), rounded % 100);
  }
  // Serie Excel, același calcul ca la afișarea cuadrantelor. 11 nu intră aici.
  if (rounded >= 20000 && rounded <= 80000) {
    const date = new Date(Math.round((rounded - 25569) * 86400 * 1000));
    return datedMonth(date.getUTCFullYear(), date.getUTCMonth() + 1);
  }
  return { kind: 'ignore' };
}

/**
 * Luna cuadrantelor se salvează ca YYYY-MM. Importurile vechi pot fi
 * MM/YYYY, YYYYMM sau număr de serie Excel. O lună fără an rămâne ambiguă.
 */
export function resolveLuna(stored: unknown): LunaResolution {
  if (typeof stored === 'number') return resolveLunaNumber(stored);
  const raw = String(stored ?? '').trim();
  if (!raw) return { kind: 'ignore' };
  if (/^\d+(?:\.0+)?$/.test(raw)) return resolveLunaNumber(Number(raw));

  const text = raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  const iso = text.match(/^(\d{4})-(\d{2})(?:-\d{2})?(?:[t\s].*)?$/);
  if (iso) return datedMonth(Number(iso[1]), Number(iso[2]));
  const compact = text.match(/^(\d{4})(\d{2})$/);
  if (compact) return datedMonth(Number(compact[1]), Number(compact[2]));
  const monthYear = text.match(/^(\d{1,2})[/-](\d{4})$/);
  if (monthYear) return datedMonth(Number(monthYear[2]), Number(monthYear[1]));
  const yearMonth = text.match(/^(\d{4})[/-](\d{1,2})$/);
  if (yearMonth) return datedMonth(Number(yearMonth[1]), Number(yearMonth[2]));
  const shortYear = text.match(/^(\d{1,2})[/-](\d{2})$/);
  if (shortYear && Number(shortYear[1]) >= 1 && Number(shortYear[1]) <= 12) {
    return { kind: 'ambiguous', month: Number(shortYear[1]) };
  }
  const nameYear = text.match(/^([a-z]+)\s*[/-]?\s*(\d{4})$/);
  if (nameYear && MONTH_NAMES[nameYear[1]]) {
    return datedMonth(Number(nameYear[2]), MONTH_NAMES[nameYear[1]]);
  }
  const yearName = text.match(/^(\d{4})\s*[/-]?\s*([a-z]+)$/);
  if (yearName && MONTH_NAMES[yearName[2]]) {
    return datedMonth(Number(yearName[1]), MONTH_NAMES[yearName[2]]);
  }
  if (MONTH_NAMES[text]) return { kind: 'ambiguous', month: MONTH_NAMES[text] };
  return { kind: 'ignore' };
}

/** Doar lunile care au anul în ele. `11` nu se potrivește cu niciun an. */
export function lunaMatches(
  stored: unknown,
  year: number,
  month: number,
): boolean {
  const resolved = resolveLuna(stored);
  return (
    resolved.kind === 'dated' &&
    resolved.year === year &&
    resolved.month === month
  );
}

export function classifySlot(raw: unknown): Exclude<SlotState, 'missing'> {
  if (raw == null) return 'empty';
  const trimmed = String(raw).trim();
  if (!trimmed) return 'empty';
  const upper = trimmed
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  if (OFF_MARKERS.has(upper)) return 'off';
  if (/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(trimmed)) return 'work';
  if (/^\d+(?:[.,]\d+)?\s*h(?:\s*\(.*\))?$/i.test(trimmed)) return 'work';
  if (
    /^\d+(?:[.,]\d+)?$/.test(trimmed) &&
    Number(trimmed.replace(',', '.')) > 0
  ) {
    return 'work';
  }
  return 'unknown';
}

export function collapseTemplates(
  flags: Array<'work' | 'off' | 'missing'>,
): 'work' | 'off' | 'missing' {
  const present = flags.filter((flag) => flag !== 'missing');
  if (present.length === 0) return 'missing';
  if (present.includes('work')) return 'work';
  return 'off';
}

function preferSlot(current: SlotState, next: SlotState): SlotState {
  const cells = [current, next];
  if (cells.includes('work')) return 'work';
  if (cells.includes('unknown')) return 'unknown';
  if (cells.includes('off')) return 'off';
  if (cells.includes('empty')) return 'empty';
  return 'missing';
}

export function combineMulticentro(cells: SlotState[]): SlotState {
  if (cells.length === 0) return 'missing';
  return cells.reduce<SlotState>(
    (acc, cell) => preferSlot(acc, cell),
    'missing',
  );
}

function combineExclusive(cells: SlotState[]): SlotState {
  if (cells.length === 0) return 'missing';
  const meaningful = cells.filter((cell) => cell !== 'empty');
  if (meaningful.length === 0) return 'empty';
  const unique = new Set(meaningful);
  if (unique.size > 1) return 'unknown';
  return meaningful[0];
}

export function slotFromMonthRows(
  rows: Array<{
    luna: unknown;
    visible?: unknown;
    cells: Record<string, unknown>;
  }>,
  year: number,
  month: number,
  day: number,
  mode: 'one' | 'many',
): SlotState {
  const visibleRows = rows.filter((row) => {
    const visible = row.visible;
    return !(visible === false || visible === 0 || visible === '0');
  });
  const dated = visibleRows.filter((row) => lunaMatches(row.luna, year, month));
  if (dated.length === 0) {
    const ambiguous = visibleRows.some((row) => {
      const resolved = resolveLuna(row.luna);
      return resolved.kind === 'ambiguous' && resolved.month === month;
    });
    return ambiguous ? 'unknown' : 'missing';
  }
  const states = dated.map((row) =>
    classifySlot(row.cells[String(day)] ?? row.cells[`ZI_${day}`]),
  );
  return mode === 'many'
    ? combineMulticentro(states)
    : combineExclusive(states);
}

function scheduleOf(day: DayScheduleInput): DayDecision {
  if (
    day.cuadrante === 'work' ||
    day.cuadrante === 'off' ||
    day.cuadrante === 'unknown'
  ) {
    return {
      date: day.date,
      status:
        day.cuadrante === 'work'
          ? 'work'
          : day.cuadrante === 'off'
            ? 'off'
            : 'unknown',
      source: 'cuadrante',
    };
  }
  if (
    day.multicentro === 'work' ||
    day.multicentro === 'off' ||
    day.multicentro === 'unknown'
  ) {
    return {
      date: day.date,
      status:
        day.multicentro === 'work'
          ? 'work'
          : day.multicentro === 'off'
            ? 'off'
            : 'unknown',
      source: 'multicentro',
    };
  }
  if (day.horario === 'work' || day.horario === 'off') {
    return {
      date: day.date,
      status: day.horario,
      source: 'horarios',
    };
  }
  return { date: day.date, status: 'unknown', source: 'none' };
}

export function decideDay(
  day: DayScheduleInput,
  trabajaFestivos: boolean,
): DayDecision {
  if (day.holiday === 'unresolved') {
    return { date: day.date, status: 'unknown', source: 'festivo' };
  }
  const schedule = scheduleOf(day);
  if (day.holiday === 'applies' && !trabajaFestivos) {
    return { date: day.date, status: 'off', source: 'festivo' };
  }
  return schedule;
}

function formatEs(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function laborableLabel(days: number): string {
  return `${days} ${days === 1 ? 'día laborable' : 'días laborables'}`;
}

export function presentPermisoDuration(
  days: DayDecision[],
  options?: { manual?: boolean; workingDays?: number | null },
): PermisoDuration {
  const unknownDates = days
    .filter((day) => day.status === 'unknown')
    .map((day) => day.date);
  const workDates = days
    .filter((day) => day.status === 'work')
    .map((day) => day.date);
  const offDates = days
    .filter((day) => day.status === 'off')
    .map((day) => day.date);
  const knownWorkingDays = workDates.length;
  const manual = options?.manual === true;
  const status: PermisoDuration['status'] =
    manual || unknownDates.length === 0 ? 'calculated' : 'needs_verification';
  const workingDays = manual
    ? (options?.workingDays ?? knownWorkingDays)
    : status === 'calculated'
      ? knownWorkingDays
      : null;
  const calendarDays = days.length;
  const intervalo = `Intervalo: ${calendarDays} ${calendarDays === 1 ? 'día natural' : 'días naturales'}`;
  let headline = 'Duración pendiente de verificar';
  let detail = '';
  if (manual && workingDays != null) {
    headline = `${laborableLabel(workingDays)} (confirmados)`;
  } else if (status === 'calculated' && workingDays != null) {
    headline = laborableLabel(workingDays);
  } else {
    const parts: string[] = [];
    if (knownWorkingDays > 0) {
      parts.push(`Días con programa: ${knownWorkingDays}.`);
    }
    if (unknownDates.length > 0) {
      const shown = unknownDates.slice(0, 15).map(formatEs).join(', ');
      const extra =
        unknownDates.length > 15 ? ` y ${unknownDates.length - 15} más` : '';
      parts.push(`Días sin información: ${shown}${extra}.`);
    }
    detail = parts.join(' ');
  }
  const text = [headline, intervalo, detail].filter(Boolean).join(' ');
  return {
    status,
    workingDays,
    knownWorkingDays,
    calendarDays,
    unknownDates,
    workDates,
    offDates,
    days,
    manual,
    registered: false,
    headline,
    intervalo,
    detail,
    text,
  };
}

export function evaluatePermisoRange(input: {
  inicio: string;
  fin: string;
  trabajaFestivos: boolean;
  days: DayScheduleInput[];
}): PermisoDuration {
  const dates = eachIsoDate(input.inicio, input.fin);
  const byDate = new Map(input.days.map((day) => [day.date, day]));
  const decisions = dates.map((date) =>
    decideDay(
      byDate.get(date) ?? {
        date,
        cuadrante: 'missing',
        multicentro: 'missing',
        horario: 'missing',
        holiday: 'none',
      },
      input.trabajaFestivos,
    ),
  );
  return presentPermisoDuration(decisions);
}

export type SaveDecision =
  | { applies: false }
  | {
      applies: true;
      action: 'save';
      dias: number;
      unidad: 'dias' | 'dias_manual';
    }
  | {
      applies: true;
      action: 'keep';
      dias: number;
      unidad: 'dias' | 'dias_manual';
      warning: string;
      requiresForce: boolean;
    }
  | { applies: true; action: 'reject'; message: string };

export function finiteDayCount(value: unknown): number | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function presentRegisteredDuration(
  preview: PermisoDuration,
  stored?: { unidad?: unknown; dias?: unknown } | null,
): PermisoDuration {
  const dias = finiteDayCount(stored?.dias);
  if (dias == null) return preview;
  if (String(stored?.unidad || '') === 'dias_manual') {
    return presentPermisoDuration(preview.days, {
      manual: true,
      workingDays: dias,
    });
  }
  if (preview.status === 'calculated' && preview.workingDays === dias) {
    return preview;
  }
  const headline = `Duración registrada: ${dias} ${dias === 1 ? 'día' : 'días'}`;
  const detail =
    'Se muestra la duración guardada. Un cálculo nuevo no la sustituye.';
  return {
    ...preview,
    status: 'calculated',
    workingDays: dias,
    manual: false,
    registered: true,
    headline,
    detail,
    text: [headline, preview.intervalo, detail].filter(Boolean).join(' '),
  };
}

export function decidePermisoSave(input: {
  tipo: unknown;
  preview: PermisoDuration;
  duracionConfirmada?: number | null;
  existingUnidad?: string | null;
  existingDias?: number | null;
  forzar?: boolean;
  /** Editarea datelor sau trecerea la acest tip înlocuiește durata veche. */
  replaceStored?: boolean;
}): SaveDecision {
  if (!isPermisoRetribuido(input.tipo)) return { applies: false };

  const confirmed = input.duracionConfirmada;
  const hasConfirmation =
    confirmed != null && Number.isInteger(confirmed) && confirmed >= 0;
  const manual = String(input.existingUnidad || '') === 'dias_manual';
  const existing = finiteDayCount(input.existingDias);
  const replace = input.forzar === true || input.replaceStored === true;

  if (manual && existing != null && !input.forzar && !hasConfirmation) {
    return {
      applies: true,
      action: 'keep',
      dias: existing,
      unidad: 'dias_manual',
      requiresForce: true,
      warning:
        'La duración fue confirmada manualmente y no se ha modificado. Vuelve a confirmarla para sustituirla.',
    };
  }

  if (hasConfirmation) {
    return {
      applies: true,
      action: 'save',
      dias: confirmed as number,
      unidad: 'dias_manual',
    };
  }

  if (existing != null && !replace) {
    const same =
      input.preview.status === 'calculated' &&
      input.preview.workingDays === existing;
    return {
      applies: true,
      action: 'keep',
      dias: existing,
      unidad: 'dias',
      requiresForce: !same,
      warning: same
        ? 'La duración registrada ya coincide con el programa.'
        : 'Se mantiene la duración registrada. Confirma el recálculo para sustituirla.',
    };
  }

  if (
    input.preview.status === 'calculated' &&
    input.preview.workingDays != null
  ) {
    return {
      applies: true,
      action: 'save',
      dias: input.preview.workingDays,
      unidad: 'dias',
    };
  }

  return {
    applies: true,
    action: 'reject',
    message: `Duración pendiente de verificar. ${input.preview.intervalo}. ${input.preview.detail} Confirma los días laborables antes de aprobar.`,
  };
}

export function canConfirmPermisoDuracion(
  actor: SolicitudActor | null | undefined,
): boolean {
  return isSolicitudStaff(actor);
}
