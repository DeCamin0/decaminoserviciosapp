/** Totals aware of EXCLUSIVE vs ACUMULABLE opciones. */

export type TotalesMoney = {
  mensualidad_sin_iva: number;
  mensualidad_con_iva: number;
  anualidad_sin_iva: number;
  anualidad_con_iva: number;
};

export type SeleccionTipo = 'EXCLUSIVE' | 'ACUMULABLE';

export type OpcionTotalesInput = {
  id?: number;
  etiqueta?: string;
  seleccion_tipo?: string | null;
  activo?: boolean;
  resultado?: { totales?: Partial<TotalesMoney> } | null;
  resultado_json?: { totales?: Partial<TotalesMoney> } | null;
};

export type ServicioOpcionesInput = {
  nombre?: string;
  servicio_comercial_id?: number;
  opciones?: OpcionTotalesInput[];
  /** Legacy single-line fallback */
  resultado?: { totales?: Partial<TotalesMoney> } | null;
  resultado_json?: unknown;
};

export type TotalesDocumento = {
  totales: TotalesMoney;
  /** True when ≥2 EXCLUSIVE options exist in any servicio (no single unambiguous total). */
  ambiguo: boolean;
  /** Sum of all acumulable + single exclusives only (excludes multi-exclusive groups). */
  totales_sin_alternativas: TotalesMoney;
  alternativas: Array<{
    servicio: string;
    opciones: Array<{ etiqueta: string; totales: TotalesMoney }>;
  }>;
};

const EPS = 0.005;

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function normalizeTotales(
  t: Partial<TotalesMoney> | null | undefined,
): TotalesMoney {
  return {
    mensualidad_sin_iva: round2(t?.mensualidad_sin_iva ?? 0),
    mensualidad_con_iva: round2(t?.mensualidad_con_iva ?? 0),
    anualidad_sin_iva: round2(t?.anualidad_sin_iva ?? 0),
    anualidad_con_iva: round2(t?.anualidad_con_iva ?? 0),
  };
}

export function emptyTotales(): TotalesMoney {
  return normalizeTotales({});
}

export function addTotales(a: TotalesMoney, b: TotalesMoney): TotalesMoney {
  return normalizeTotales({
    mensualidad_sin_iva: a.mensualidad_sin_iva + b.mensualidad_sin_iva,
    mensualidad_con_iva: a.mensualidad_con_iva + b.mensualidad_con_iva,
    anualidad_sin_iva: a.anualidad_sin_iva + b.anualidad_sin_iva,
    anualidad_con_iva: a.anualidad_con_iva + b.anualidad_con_iva,
  });
}

function optTotales(o: OpcionTotalesInput): TotalesMoney {
  const t = o.resultado?.totales || (o.resultado_json as any)?.totales || null;
  return normalizeTotales(t);
}

function isActive(o: OpcionTotalesInput): boolean {
  return o.activo !== false;
}

function tipoOf(o: OpcionTotalesInput): SeleccionTipo {
  const t = String(o.seleccion_tipo || 'ACUMULABLE').toUpperCase();
  return t === 'EXCLUSIVE' ? 'EXCLUSIVE' : 'ACUMULABLE';
}

/** Legacy helper: sum resultados as if every line is acumulable. */
export function sumLineTotales(
  lineas: Array<{ resultado?: { totales?: Partial<TotalesMoney> } | null }>,
): TotalesMoney {
  let acc = emptyTotales();
  for (const l of lineas) {
    acc = addTotales(acc, normalizeTotales(l.resultado?.totales));
  }
  return acc;
}

/**
 * Document totals respecting EXCLUSIVE groups.
 * - All ACUMULABLE options are summed.
 * - A single EXCLUSIVE option is summed.
 * - Multiple EXCLUSIVE options in the same servicio are NOT summed (alternatives).
 */
export function computeDocumentTotales(
  servicios: ServicioOpcionesInput[],
): TotalesDocumento {
  let totales_sin_alternativas = emptyTotales();
  let ambiguo = false;
  const alternativas: TotalesDocumento['alternativas'] = [];

  for (const svc of servicios) {
    const nombre = svc.nombre || `Servicio ${svc.servicio_comercial_id || ''}`;
    let opciones = (svc.opciones || []).filter(isActive);

    // Legacy: no opciones array → treat line resultado as one acumulable option
    if (!opciones.length) {
      const legacy = normalizeTotales(
        (svc.resultado as any)?.totales || (svc.resultado_json as any)?.totales,
      );
      totales_sin_alternativas = addTotales(totales_sin_alternativas, legacy);
      continue;
    }

    const exclusivas = opciones.filter((o) => tipoOf(o) === 'EXCLUSIVE');
    const acumulables = opciones.filter((o) => tipoOf(o) === 'ACUMULABLE');

    for (const o of acumulables) {
      totales_sin_alternativas = addTotales(
        totales_sin_alternativas,
        optTotales(o),
      );
    }

    if (exclusivas.length === 1) {
      totales_sin_alternativas = addTotales(
        totales_sin_alternativas,
        optTotales(exclusivas[0]),
      );
    } else if (exclusivas.length > 1) {
      ambiguo = true;
      alternativas.push({
        servicio: nombre,
        opciones: exclusivas.map((o) => ({
          etiqueta: o.etiqueta || 'Opción',
          totales: optTotales(o),
        })),
      });
    }
  }

  return {
    totales: totales_sin_alternativas,
    ambiguo,
    totales_sin_alternativas,
    alternativas,
  };
}

/** Sum only selected option IDs (future firma). Ignores exclusivity conflicts. */
export function sumSelectedOpcionTotales(
  servicios: ServicioOpcionesInput[],
  selectedOpcionIds: number[],
): TotalesMoney {
  const set = new Set(selectedOpcionIds);
  let acc = emptyTotales();
  for (const svc of servicios) {
    for (const o of svc.opciones || []) {
      if (o.id != null && set.has(o.id) && isActive(o)) {
        acc = addTotales(acc, optTotales(o));
      }
    }
  }
  return acc;
}

export function totalesDiffer(
  a: TotalesMoney,
  b: TotalesMoney,
  eps = EPS,
): boolean {
  return (
    Math.abs(a.mensualidad_sin_iva - b.mensualidad_sin_iva) > eps ||
    Math.abs(a.mensualidad_con_iva - b.mensualidad_con_iva) > eps ||
    Math.abs(a.anualidad_sin_iva - b.anualidad_sin_iva) > eps ||
    Math.abs(a.anualidad_con_iva - b.anualidad_con_iva) > eps
  );
}

export function extractSavedTotalesFromLineas(
  lineas: Array<{
    resultado_json?: unknown;
    opciones?: OpcionTotalesInput[];
    nombre?: string;
    servicio_comercial_id?: number;
  }>,
): TotalesMoney {
  return computeDocumentTotales(
    lineas.map((l) => ({
      nombre: l.nombre,
      servicio_comercial_id: l.servicio_comercial_id,
      opciones: l.opciones,
      resultado_json: l.resultado_json,
    })),
  ).totales_sin_alternativas;
}

/** Deep clone plain JSON-compatible values (inputs/config). */
export function deepCloneJson<T>(value: T): T {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}
