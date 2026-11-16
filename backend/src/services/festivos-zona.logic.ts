export type FiestaRow = {
  date: string;
  observedDate: string | null;
  name: string;
  scope: string;
  ccaaCode: string | null;
  municipioIne: string;
  active: boolean;
};

export type Zona = {
  ine: string;
  nombre: string;
  ccaaCode: string;
};

export type ZonaDecision = {
  zona: Zona | null;
  needsChoice: boolean;
  source: 'centro' | 'unica' | 'elegida' | 'ninguna';
};

const CCAA_ALIASES: Record<string, string[]> = {
  'ES-MD': ['ES-MD', 'MAD', 'MD'],
};

export function normalizePlaceName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function scopeKind(
  scope: string,
): 'nacional' | 'autonomico' | 'local' | 'otro' {
  const s = normalizePlaceName(scope);
  if (s.startsWith('nac') || s === 'national') return 'nacional';
  if (s.startsWith('aut') || s.startsWith('ccaa') || s.startsWith('reg')) {
    return 'autonomico';
  }
  if (s.startsWith('loc') || s.startsWith('mun')) return 'local';
  return 'otro';
}

function dayDistance(a: string, b: string): number | null {
  const left = Date.parse(`${a}T00:00:00Z`);
  const right = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.abs(left - right) / 86400000;
}

/** Ziua oficială contează. Data observată contează doar dacă e un puente apropiat. */
export function fiestaAppliesOn(row: FiestaRow, dateStr: string): boolean {
  if (!row.active) return false;
  if (row.date === dateStr) return true;
  if (!row.observedDate || row.observedDate === row.date) return false;
  const days = dayDistance(row.date, row.observedDate);
  return days != null && days <= 14 && row.observedDate === dateStr;
}

export function observedDateForClient(row: FiestaRow): string | null {
  if (!row.observedDate || row.observedDate === row.date)
    return row.observedDate;
  const days = dayDistance(row.date, row.observedDate);
  if (days == null || days > 14) return null;
  return row.observedDate;
}

function sameCcaa(rowCode: string | null, zonaCode: string): boolean {
  const code = String(rowCode || '').toUpperCase();
  if (!code) return true;
  const zona = String(zonaCode || '').toUpperCase();
  if (code === zona) return true;
  const aliases = CCAA_ALIASES[zona] || [zona];
  return aliases.includes(code);
}

export function fiestaVisibleForZona(
  row: FiestaRow,
  zona: Zona | null,
): boolean {
  if (!row.active) return false;
  const kind = scopeKind(row.scope);
  if (kind === 'local') {
    return !!zona && row.municipioIne !== '' && row.municipioIne === zona.ine;
  }
  if (kind === 'autonomico') {
    if (!zona) return true;
    return sameCcaa(row.ccaaCode, zona.ccaaCode);
  }
  return true;
}

export function fiestaAppliesToZona(
  row: FiestaRow,
  zona: Zona | null,
  dateStr: string,
): boolean {
  return fiestaAppliesOn(row, dateStr) && fiestaVisibleForZona(row, zona);
}

export function decideZona(input: {
  hasCenter: boolean;
  poblacion: string | null;
  zonas: Zona[];
  chosenIne: string | null;
}): ZonaDecision {
  if (input.zonas.length === 1) {
    return { zona: input.zonas[0], needsChoice: false, source: 'unica' };
  }

  if (input.hasCenter) {
    const poblacionKey = normalizePlaceName(input.poblacion || '');
    const match = poblacionKey
      ? input.zonas.find(
          (zona) => normalizePlaceName(zona.nombre) === poblacionKey,
        )
      : undefined;
    if (match) {
      return { zona: match, needsChoice: false, source: 'centro' };
    }
    return { zona: null, needsChoice: false, source: 'ninguna' };
  }

  if (input.zonas.length > 1) {
    const chosen = input.zonas.find((zona) => zona.ine === input.chosenIne);
    if (chosen) {
      return { zona: chosen, needsChoice: false, source: 'elegida' };
    }
    return { zona: null, needsChoice: true, source: 'ninguna' };
  }

  return { zona: null, needsChoice: false, source: 'ninguna' };
}

export function isGenericLocalName(name: string): boolean {
  const value = String(name || '').trim();
  return (
    !value ||
    /^fiesta local\.?$/i.test(value) ||
    /^festivo local de /i.test(value)
  );
}

export function localFestivoName(rawName: string, town: string): string {
  const name = String(rawName || '').trim();
  if (isGenericLocalName(name)) {
    return `Festivo local de ${town}`;
  }
  return name.slice(0, 160);
}

const OFFICIAL_MARKERS = ['calendariosnacionales', 'madrid-od', 'nager'];

export function isOfficialNonLocalRow(row: {
  scope: string;
  notes: string | null;
}): boolean {
  const kind = scopeKind(row.scope);
  if (kind !== 'nacional' && kind !== 'autonomico') return false;
  const notes = String(row.notes || '').toLowerCase();
  return OFFICIAL_MARKERS.some((marker) => notes.includes(marker));
}

const ZONA_MANAGER_GROUPS = new Set([
  'Admin',
  'Developer',
  'Manager',
  'Supervisor',
]);

/** Cine vede Cuadrantes poate schimba zonele. Grupurile vechi rămân admise și fără bifă. */
export function canManageFestivoZonas(input: {
  grupo?: string | null;
  role?: string | null;
  cuadrantesPermitted?: boolean;
}): boolean {
  const grupo = String(input.grupo || '').trim();
  const role = String(input.role || '')
    .trim()
    .toUpperCase();
  if (ZONA_MANAGER_GROUPS.has(grupo)) return true;
  if (role === 'ADMIN' || role === 'DEVELOPER') return true;
  return input.cuadrantesPermitted === true;
}

/** Rând pus de mână, pe aceeași zi cu un festivo oficial național sau de comunitate. */
export function isManualCalendarShadow(row: {
  scope: string;
  notes: string | null;
  municipioIne?: string | null;
}): boolean {
  if (String(row.municipioIne || '').trim()) return false;
  return !isOfficialNonLocalRow(row);
}
