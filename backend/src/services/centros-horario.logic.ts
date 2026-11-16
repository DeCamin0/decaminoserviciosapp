export type HorarioInterval = {
  horaIn: string;
  horaOut: string;
};

export type CentroBlock = HorarioInterval & {
  centro: string;
};

export type CentroHorarioGroup = {
  centro: string;
  intervals: HorarioInterval[];
};

export type MergedCentroHorario = {
  intervals: CentroBlock[];
  conflict: boolean;
  centros: string[];
};

export function clockToMinutes(value: string): number | null {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function normalizeClock(value: unknown): string | null {
  if (value == null) return null;
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const minutes = clockToMinutes(`${match[1]}:${match[2]}`);
  if (minutes == null) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/** Două blocuri se calcă. Capătul comun (12:00 cu 12:00) nu e suprapunere. */
export function blocksOverlap(
  left: HorarioInterval,
  right: HorarioInterval,
): boolean {
  const a0 = clockToMinutes(left.horaIn);
  const a1 = clockToMinutes(left.horaOut);
  const b0 = clockToMinutes(right.horaIn);
  const b1 = clockToMinutes(right.horaOut);
  if (a0 == null || a1 == null || b0 == null || b1 == null) return false;
  if (a1 <= a0 || b1 <= b0) return true;
  return a0 < b1 && b0 < a1;
}

export function intervalsFromWeeklyRow(
  row: Record<string, unknown>,
  prefix: string,
): HorarioInterval[] {
  const intervals: HorarioInterval[] = [];
  for (const slot of [1, 2, 3]) {
    const horaIn = normalizeClock(row[`${prefix}_in${slot}`]);
    const horaOut = normalizeClock(row[`${prefix}_out${slot}`]);
    if (horaIn && horaOut) intervals.push({ horaIn, horaOut });
  }
  return intervals;
}

/**
 * Două centre cu ore care nu se calcă se adună.
 * Aceleași ore la două centre sunt conflict, nu două ture.
 * Intervalele aceluiași centru nu se bat între ele.
 */
export function mergeCentroHorarios(
  groups: CentroHorarioGroup[],
): MergedCentroHorario {
  const centros = [
    ...new Set(groups.map((group) => group.centro).filter(Boolean)),
  ];
  const blocks: CentroBlock[] = [];
  for (const group of groups) {
    for (const interval of group.intervals) {
      const horaIn = normalizeClock(interval.horaIn);
      const horaOut = normalizeClock(interval.horaOut);
      if (!horaIn || !horaOut) continue;
      blocks.push({ horaIn, horaOut, centro: group.centro });
    }
  }

  let conflict = false;
  for (let i = 0; i < blocks.length && !conflict; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      if (blocks[i].centro === blocks[j].centro) continue;
      if (blocksOverlap(blocks[i], blocks[j])) {
        conflict = true;
        break;
      }
    }
  }

  if (conflict) {
    return { intervals: [], conflict: true, centros };
  }

  blocks.sort(
    (a, b) => (clockToMinutes(a.horaIn) || 0) - (clockToMinutes(b.horaIn) || 0),
  );
  return { intervals: blocks, conflict: false, centros };
}
