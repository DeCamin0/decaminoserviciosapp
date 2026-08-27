/** Document-level digital services (Vecindario, portal, …). */

export type ServicioDigital = {
  codigo: string;
  nombre: string;
  precio_referencia_mensual: number;
  descuento_pct: number;
  descripcion?: string | null;
  activo: boolean;
  orden?: number;
};

export type ServicioDigitalResolved = ServicioDigital & {
  precio_final_mensual: number;
  incluido: boolean;
};

export function resolveServicioDigital(
  s: ServicioDigital,
): ServicioDigitalResolved {
  const ref = Number(s.precio_referencia_mensual) || 0;
  const disc = Math.min(100, Math.max(0, Number(s.descuento_pct) || 0));
  const final = Math.round(ref * (1 - disc / 100) * 100) / 100;
  return {
    ...s,
    descuento_pct: disc,
    precio_referencia_mensual: ref,
    precio_final_mensual: final,
    incluido: !s.activo ? false : disc >= 100 || final <= 0,
  };
}

export function normalizeServiciosDigitales(raw: unknown): ServicioDigital[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row: any, i: number) => ({
      codigo: String(row?.codigo || `digital_${i}`).trim() || `digital_${i}`,
      nombre: String(row?.nombre || '').trim() || 'Servicio digital',
      precio_referencia_mensual: Number(row?.precio_referencia_mensual) || 0,
      descuento_pct: Number(row?.descuento_pct) || 0,
      descripcion: row?.descripcion != null ? String(row.descripcion) : null,
      activo: row?.activo !== false,
      orden: Number(row?.orden) || i,
    }))
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

export function resolveAllDigitales(raw: unknown): ServicioDigitalResolved[] {
  return normalizeServiciosDigitales(raw)
    .filter((s) => s.activo)
    .map(resolveServicioDigital);
}

/** Sum only digitales with precio_final > 0 into document totals. */
export function sumDigitalesCobrables(raw: unknown): {
  mensualidad_sin_iva: number;
  anualidad_sin_iva: number;
} {
  let mensual = 0;
  for (const s of resolveAllDigitales(raw)) {
    if (!s.incluido && s.precio_final_mensual > 0) {
      mensual += s.precio_final_mensual;
    }
  }
  return {
    mensualidad_sin_iva: Math.round(mensual * 100) / 100,
    anualidad_sin_iva: Math.round(mensual * 12 * 100) / 100,
  };
}

export const DEFAULT_VECINDARIO: ServicioDigital = {
  codigo: 'vecindario',
  nombre: 'Vecindario',
  precio_referencia_mensual: 25,
  descuento_pct: 100,
  descripcion: 'App de comunicación con la comunidad',
  activo: true,
  orden: 0,
};

/** Read brand defaults; fallback Vecindario 25€ / 100%. */
export function digitalesFromBrandConfig(
  brandConfig: unknown,
): ServicioDigital[] {
  const cfg =
    brandConfig && typeof brandConfig === 'object'
      ? (brandConfig as Record<string, any>)
      : {};
  if (
    Array.isArray(cfg.servicios_digitales) &&
    cfg.servicios_digitales.length
  ) {
    return normalizeServiciosDigitales(cfg.servicios_digitales);
  }
  return [DEFAULT_VECINDARIO];
}
