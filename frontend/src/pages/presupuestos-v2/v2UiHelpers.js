/** Human labels for V2 motors (codes stay internal). */
export const MOTOR_LABELS = {
  auxiliares_coste: 'Coste de personal — Auxiliares',
  limpieza_coste: 'Coste de personal — Limpieza',
  precio_mensual: 'Precio mensual directo',
  piscina: 'Piscina',
};

export function motorLabel(codigo, motores = []) {
  const fromApi = (motores || []).find((m) => m.codigo === codigo);
  if (fromApi?.label_ui && !/\([a-z_]+\)/i.test(fromApi.label_ui)) {
    return fromApi.label_ui;
  }
  return MOTOR_LABELS[codigo] || fromApi?.label_ui || codigo || '—';
}

/** Suggest internal code from display name. */
export function slugifyCodigo(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 64);
}

export function moneyEs(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Commercial summary lines for a servicio (UI + PDF parity). */
export function summarizeServicioInputs(codigoMotor, inputs = {}) {
  const i = inputs || {};
  const bits = [];
  if (codigoMotor === 'limpieza_coste') {
    if (i.numOperarias != null && i.numOperarias !== '') {
      bits.push(
        `${i.numOperarias} ${Number(i.numOperarias) === 1 ? 'operaria' : 'operarias'}`,
      );
    }
    if (i.horasPorDiaPorOperaria != null && i.horasPorDiaPorOperaria !== '') {
      bits.push(`${i.horasPorDiaPorOperaria} horas/día`);
    }
    if (i.diasLaborablesSemana != null && i.diasLaborablesSemana !== '') {
      bits.push(`${i.diasLaborablesSemana} días laborables/semana`);
    }
  } else if (codigoMotor === 'auxiliares_coste') {
    if (i.horasDiarias != null && i.horasDiarias !== '') {
      bits.push(`${i.horasDiarias} horas/día`);
    }
    if (i.diasPorSemana != null && i.diasPorSemana !== '') {
      bits.push(`${i.diasPorSemana} días/semana`);
    }
    if (i.horasACubrirPorSemana != null && i.horasACubrirPorSemana !== '') {
      bits.push(`${i.horasACubrirPorSemana} h a cubrir/semana`);
    }
  } else if (codigoMotor === 'precio_mensual') {
    if (i.concepto) bits.push(String(i.concepto));
  } else if (codigoMotor === 'piscina') {
    if (i.concepto) bits.push(String(i.concepto));
    if (i.horas) bits.push(`${i.horas} h`);
    if (i.dias) bits.push(String(i.dias));
  }
  return bits;
}

export function clienteDisplayLines(cliente) {
  if (!cliente || typeof cliente !== 'object') return [];
  const c = cliente;
  return [
    c.nombre || null,
    c.nif ? `CIF/NIF: ${c.nif}` : null,
    c.direccion_servicio || c.direccion || null,
    [c.codigo_postal, c.poblacion, c.provincia].filter(Boolean).join(' ') || null,
    c.email_envio || c.email || null,
    c.telefono || c.movil || null,
    c.atencion_de ? `Att.: ${c.atencion_de}` : null,
    c.contacto_especifico ? `Contacto: ${c.contacto_especifico}` : null,
    c.observaciones_documento
      ? `Observaciones: ${c.observaciones_documento}`
      : null,
  ].filter(Boolean);
}

export function mergeClienteWorking(draft) {
  if (!draft) return null;
  if (draft.estado === 'EMITIDO' && draft.snapshot_cliente_json) {
    return draft.snapshot_cliente_json;
  }
  const w = draft.cliente_working_json || {};
  const o = draft.cliente_overrides_json || {};
  return {
    ...w,
    ...Object.fromEntries(
      Object.entries(o).filter(([, v]) => v != null && String(v).trim() !== ''),
    ),
    nombre:
      w.nombre ||
      draft.cliente_nombre ||
      null,
  };
}
