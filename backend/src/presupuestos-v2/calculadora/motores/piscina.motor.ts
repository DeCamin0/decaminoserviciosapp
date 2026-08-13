import { CalcParams, LineaCalcResult, MotorDefinition } from '../tipos';

function n(v: unknown, fallback = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function parseEuro(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null || v === '') return 0;
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  const x = Number(s);
  return Number.isFinite(x) ? x : 0;
}

export function defaultInputsPiscina(): Record<string, unknown> {
  return {
    concepto: 'Mantenimiento piscina temporada',
    horas: '',
    dias: '',
    precioSinIva: 0,
    extra: 0,
    conLona: true,
    precioConLona: 1800,
    precioSinLona: 1600,
    incluirInvernalConLona: true,
    incluirInvernalSinLona: true,
    recuperacionAguaPrecio: 650,
  };
}

/**
 * Port of Legacy piscina oferta logic.
 * NOTE (Legacy quirk preserved): season `precioSinIva` labeled "€/temporada"
 * is treated as monthly in oferta (×12 for annual). Documented in warnings.
 */
export function calculatePiscina(
  inputs: Record<string, unknown>,
  params: CalcParams,
): LineaCalcResult {
  const warnings: string[] = [
    'Legacy: precio temporada se trata como base mensual en oferta (×12 anual)',
  ];
  const precio = parseEuro(inputs.precioSinIva);
  const extra = n(inputs.extra);
  const concepto = String(inputs.concepto || 'Piscina').trim();
  const horas = String(inputs.horas || '').trim();
  const dias = String(inputs.dias || '').trim();

  const mensualSin = precio + extra;
  const anualSin = precio * params.meses_anio + extra * params.meses_anio;

  const precioConLona = parseEuro(inputs.precioConLona);
  const precioSinLona = parseEuro(inputs.precioSinLona);
  const incluirCon = inputs.incluirInvernalConLona !== false;
  const incluirSin = inputs.incluirInvernalSinLona !== false;

  const lineasInvernal: Array<{
    tipo: string;
    importe: number;
    con_iva: number;
  }> = [];
  if (incluirCon && precioConLona > 0) {
    lineasInvernal.push({
      tipo: 'invernal_con_lona',
      importe: precioConLona,
      con_iva: precioConLona * params.iva_factor,
    });
  }
  if (incluirSin && precioSinLona > 0) {
    lineasInvernal.push({
      tipo: 'invernal_sin_lona',
      importe: precioSinLona,
      con_iva: precioSinLona * params.iva_factor,
    });
  }

  const recuperacion = parseEuro(inputs.recuperacionAguaPrecio);
  const descParts = [concepto];
  if (horas) descParts.push(`${horas}h`);
  if (dias) descParts.push(dias);

  return {
    codigo_motor: 'piscina',
    version_motor: '1',
    descripcion: descParts.join(' · '),
    breakdown: {
      precio_temporada_sin_iva: precio,
      extra_mensual: extra,
      recuperacion_agua: recuperacion,
      recuperacion_agua_con_iva: recuperacion * params.iva_factor,
      invernal_lineas_count: lineasInvernal.length,
      // Invernal: Legacy puts same amount in mensualidad and anualidad columns
      invernal_con_lona: incluirCon ? precioConLona : 0,
      invernal_sin_lona: incluirSin ? precioSinLona : 0,
    },
    totales: {
      mensualidad_sin_iva: mensualSin,
      mensualidad_con_iva: mensualSin * params.iva_factor,
      anualidad_sin_iva: anualSin,
      anualidad_con_iva: anualSin * params.iva_factor,
    },
    warnings,
    params_usados: { ...params },
  };
}

export const motorPiscina: MotorDefinition = {
  codigo: 'piscina',
  version: '1',
  label: 'Piscina',
  defaultInputs: defaultInputsPiscina,
  calculate: calculatePiscina,
  inputSchema: [
    { key: 'concepto', label: 'Concepto', type: 'string', group: 'temporada' },
    { key: 'horas', label: 'Horas (texto)', type: 'string', group: 'temporada' },
    { key: 'dias', label: 'Días (texto)', type: 'string', group: 'temporada' },
    {
      key: 'precioSinIva',
      label: 'Precio temporada sin IVA (€)',
      type: 'number',
      group: 'temporada',
    },
    { key: 'extra', label: 'Extra €/mes', type: 'number', group: 'temporada' },
    { key: 'incluirInvernalConLona', label: 'Incluir invernal con lona', type: 'boolean', group: 'invernal' },
    { key: 'precioConLona', label: 'Precio invernal con lona', type: 'number', group: 'invernal' },
    { key: 'incluirInvernalSinLona', label: 'Incluir invernal sin lona', type: 'boolean', group: 'invernal' },
    { key: 'precioSinLona', label: 'Precio invernal sin lona', type: 'number', group: 'invernal' },
    { key: 'recuperacionAguaPrecio', label: 'Recuperación de agua (€)', type: 'number', group: 'extras' },
  ],
};
