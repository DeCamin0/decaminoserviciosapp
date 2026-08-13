/** Format official V2 presupuesto numbers from series config (no Legacy MADYYYY####). */

export type SerieNumeracionSnapshot = {
  serie_id: number;
  codigo: string;
  prefijo: string;
  formato: string;
  padding: number;
  reset_anual: boolean;
  anio: number;
  secuencia: number;
  numero: string;
};

export function formatNumeroSerie(opts: {
  prefijo: string;
  formato: string;
  padding: number;
  anio: number;
  secuencia: number;
}): string {
  const seq = String(opts.secuencia).padStart(Math.max(1, opts.padding), '0');
  const map: Record<string, string> = {
    '{PREF}': opts.prefijo,
    '{YYYY}': String(opts.anio),
    '{YY}': String(opts.anio).slice(-2),
    '{SEQ}': seq,
  };
  let out = opts.formato || '{PREF}{YYYY}-{SEQ}';
  for (const [k, v] of Object.entries(map)) {
    out = out.split(k).join(v);
  }
  return out;
}

/**
 * Resolve next sequence for a series row (in-memory). Caller must persist atomically.
 * Returns updated series fields + formatted number.
 */
export function allocateNextNumero(serie: {
  id: number;
  codigo: string;
  prefijo: string;
  formato: string;
  padding: number;
  reset_anual: boolean;
  anio_actual: number | null;
  siguiente_numero: number;
}, now = new Date()): {
  nextAnio: number;
  nextSiguiente: number;
  snapshot: SerieNumeracionSnapshot;
} {
  const anio = now.getFullYear();
  let secuencia = serie.siguiente_numero;
  let nextAnio = serie.anio_actual ?? anio;

  if (serie.reset_anual) {
    if (serie.anio_actual == null || serie.anio_actual !== anio) {
      secuencia = 1;
      nextAnio = anio;
    } else {
      nextAnio = anio;
    }
  }

  const numero = formatNumeroSerie({
    prefijo: serie.prefijo,
    formato: serie.formato,
    padding: serie.padding,
    anio: nextAnio,
    secuencia,
  });

  return {
    nextAnio,
    nextSiguiente: secuencia + 1,
    snapshot: {
      serie_id: serie.id,
      codigo: serie.codigo,
      prefijo: serie.prefijo,
      formato: serie.formato,
      padding: serie.padding,
      reset_anual: serie.reset_anual,
      anio: nextAnio,
      secuencia,
      numero,
    },
  };
}
