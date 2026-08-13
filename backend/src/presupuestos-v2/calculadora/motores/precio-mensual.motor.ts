import { CalcParams, LineaCalcResult, MotorDefinition } from '../tipos';

function n(v: unknown, fallback = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export function defaultInputsPrecioMensual(): Record<string, unknown> {
  return {
    concepto: '',
    precioSinIva: 0,
  };
}

/** Port of Legacy jardinería / cubos / garaje simple price. */
export function calculatePrecioMensual(
  inputs: Record<string, unknown>,
  params: CalcParams,
): LineaCalcResult {
  const precio = n(inputs.precioSinIva);
  const concepto = String(inputs.concepto || '').trim();
  return {
    codigo_motor: 'precio_mensual',
    version_motor: '1',
    descripcion: concepto || undefined,
    breakdown: {
      precio_sin_iva: precio,
      iva: precio * params.iva_pct,
      precio_con_iva: precio * params.iva_factor,
    },
    totales: {
      mensualidad_sin_iva: precio,
      mensualidad_con_iva: precio * params.iva_factor,
      anualidad_sin_iva: precio * params.meses_anio,
      anualidad_con_iva: precio * params.meses_anio * params.iva_factor,
    },
    warnings: precio <= 0 ? ['Precio sin IVA es 0'] : [],
    params_usados: { ...params },
  };
}

export const motorPrecioMensual: MotorDefinition = {
  codigo: 'precio_mensual',
  version: '1',
  label: 'Precio mensual directo',
  defaultInputs: defaultInputsPrecioMensual,
  calculate: calculatePrecioMensual,
  inputSchema: [
    { key: 'concepto', label: 'Concepto', type: 'string', group: 'base' },
    { key: 'precioSinIva', label: 'Precio mensual sin IVA (€)', type: 'number', group: 'base', required: true },
  ],
};
