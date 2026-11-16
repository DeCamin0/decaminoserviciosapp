export type BajaEpisode = {
  idCaso: string;
  idPosicion: string;
  codigo: string;
  fuente: string;
  fechaBaja: string;
  fechaAlta: string | null;
  altaAnunciada: string | null;
};

const OPEN_END = '9999-12-31';

export function isOpenEpisode(
  episode: Pick<BajaEpisode, 'fechaAlta'>,
): boolean {
  return !episode.fechaAlta;
}

export function episodesOverlap(
  left: Pick<BajaEpisode, 'fechaBaja' | 'fechaAlta'>,
  right: Pick<BajaEpisode, 'fechaBaja' | 'fechaAlta'>,
): boolean {
  if (!left.fechaBaja || !right.fechaBaja) return false;
  const leftEnd = left.fechaAlta || OPEN_END;
  const rightEnd = right.fechaAlta || OPEN_END;
  return left.fechaBaja <= rightEnd && right.fechaBaja <= leftEnd;
}

export function effectiveReturnDate(
  episode: Pick<BajaEpisode, 'fechaAlta' | 'altaAnunciada'>,
): string | null {
  return episode.fechaAlta || episode.altaAnunciada || null;
}

function formatEs(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function decideEmployeeAnnounce(
  existing: BajaEpisode[],
  incoming: { codigo: string; fechaBaja: string },
): { ok: true } | { ok: false; message: string } {
  const own = existing.filter((row) => row.codigo === incoming.codigo);
  const open = own.find((row) => isOpenEpisode(row));
  if (open) {
    return {
      ok: false,
      message: `Ya tienes una baja médica abierta desde el ${formatEs(open.fechaBaja)}. No puedes abrir otra. Si te han dado el alta, anúnciala en esa baja.`,
    };
  }
  const sameStart = own.find((row) => row.fechaBaja === incoming.fechaBaja);
  if (sameStart) {
    return {
      ok: false,
      message: `Ya existe una baja médica con la misma fecha de inicio (${formatEs(incoming.fechaBaja)}).`,
    };
  }
  return { ok: true };
}

export function decideMutuaAbsorption(
  employeeRows: BajaEpisode[],
  mutua: Pick<BajaEpisode, 'codigo' | 'fechaBaja' | 'fechaAlta'>,
):
  | { action: 'none' }
  | { action: 'replace'; row: BajaEpisode }
  | { action: 'conflict'; rows: BajaEpisode[] } {
  const matches = employeeRows.filter(
    (row) =>
      row.fuente === 'EMPLEADO' &&
      row.codigo === mutua.codigo &&
      episodesOverlap(row, mutua),
  );
  if (matches.length === 0) return { action: 'none' };
  if (matches.length === 1) return { action: 'replace', row: matches[0] };
  return { action: 'conflict', rows: matches };
}
