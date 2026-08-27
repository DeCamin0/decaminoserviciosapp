/** Structured jornada / horario on a presupuesto opción. */

export type JornadaTramo = {
  /** Human label e.g. "Lunes a jueves" */
  dias_label: string;
  /** Optional codes L M X J V S D */
  dias?: string[];
  hora_inicio: string;
  hora_fin: string;
};

export type JornadaOpcion = {
  horas_semana?: number | null;
  festivos_incluidos?: boolean;
  observacion?: string | null;
  tramos?: JornadaTramo[];
};

export function emptyJornada(): JornadaOpcion {
  return {
    horas_semana: null,
    festivos_incluidos: false,
    observacion: null,
    tramos: [],
  };
}

function parseTimeToMinutes(hhmm: string): number | null {
  const m = String(hhmm || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function hoursBetween(inicio: string, fin: string): number {
  const a = parseTimeToMinutes(inicio);
  const b = parseTimeToMinutes(fin);
  if (a == null || b == null || b <= a) return 0;
  return Math.round(((b - a) / 60) * 100) / 100;
}

export function normalizeJornada(raw: unknown): JornadaOpcion | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, any>;
  const tramosRaw = Array.isArray(o.tramos) ? o.tramos : [];
  const tramos: JornadaTramo[] = tramosRaw
    .map((t: any) => ({
      dias_label: String(t?.dias_label || '').trim(),
      dias: Array.isArray(t?.dias)
        ? t.dias.map((d: any) => String(d).trim()).filter(Boolean)
        : undefined,
      hora_inicio: String(t?.hora_inicio || '').trim(),
      hora_fin: String(t?.hora_fin || '').trim(),
    }))
    .filter((t) => t.dias_label || t.hora_inicio || t.hora_fin);

  const horas =
    o.horas_semana != null && o.horas_semana !== ''
      ? Number(o.horas_semana)
      : null;

  return {
    horas_semana: Number.isFinite(horas as number) ? (horas as number) : null,
    festivos_incluidos: Boolean(o.festivos_incluidos),
    observacion: o.observacion != null ? String(o.observacion) : null,
    tramos,
  };
}

/** Derive calc inputs from jornada without wiping unrelated cost fields. */
export function applyJornadaToMotorInputs(
  inputs: Record<string, unknown>,
  jornada: JornadaOpcion | null | undefined,
): Record<string, unknown> {
  if (!jornada) return inputs;
  const next: Record<string, unknown> = { ...inputs };

  if (jornada.horas_semana != null && Number.isFinite(jornada.horas_semana)) {
    next.horasACubrirPorSemana = jornada.horas_semana;
  }
  if (jornada.festivos_incluidos != null) {
    next.sinFestivos = !jornada.festivos_incluidos;
  }

  const tramos = jornada.tramos || [];
  if (tramos.length) {
    let totalH = 0;
    let days = 0;
    for (const t of tramos) {
      const h = hoursBetween(t.hora_inicio, t.hora_fin);
      const d =
        Array.isArray(t.dias) && t.dias.length
          ? t.dias.length
          : guessDaysFromLabel(t.dias_label);
      totalH += h * d;
      days += d;
    }
    if (days > 0 && totalH > 0) {
      next.diasPorSemana = days;
      next.horasDiarias = Math.round((totalH / days) * 100) / 100;
      if (jornada.horas_semana == null) {
        next.horasACubrirPorSemana = Math.round(totalH * 100) / 100;
      }
    }
  }

  return next;
}

function guessDaysFromLabel(label: string): number {
  const l = String(label || '').toLowerCase();
  if (/lunes\s*a\s*jueves|l-j|l\/j/.test(l)) return 4;
  if (/lunes\s*a\s*viernes|l-v|l\/v/.test(l)) return 5;
  if (/viernes|^v$/.test(l)) return 1;
  if (/s[áa]bado|^s$/.test(l)) return 1;
  if (/domingo|^d$/.test(l)) return 1;
  return 1;
}

/** Client-facing lines for PDF / UI. */
export function formatJornadaLines(
  jornada: JornadaOpcion | null | undefined,
): string[] {
  if (!jornada) return [];
  const lines: string[] = [];
  if (jornada.horas_semana != null) {
    lines.push(`${jornada.horas_semana} horas/semana`);
  }
  for (const t of jornada.tramos || []) {
    const label = t.dias_label || (t.dias || []).join(', ');
    const slot =
      t.hora_inicio && t.hora_fin ? `${t.hora_inicio}–${t.hora_fin}` : '';
    if (label && slot) lines.push(`${label}: ${slot}`);
    else if (label) lines.push(label);
    else if (slot) lines.push(slot);
  }
  if (jornada.festivos_incluidos === false) {
    lines.push('Sin festivos');
  } else if (jornada.festivos_incluidos === true) {
    lines.push('Festivos incluidos');
  }
  if (jornada.observacion) lines.push(String(jornada.observacion));
  return lines;
}
