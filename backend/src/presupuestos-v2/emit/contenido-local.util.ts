import {
  ContenidoComercial,
  normalizeContenidoComercial,
} from '../config/config-catalog';

/** Stable JSON for comparing plantilla vs working copy. */
export function contenidoFingerprint(
  c: ContenidoComercial | null | undefined,
): string {
  const n = normalizeContenidoComercial(c || {}, '');
  const sortedPeriodicos = [...(n.servicios_periodicos || [])]
    .map((p, i) => ({
      nombre: p.nombre,
      periodicidad: p.periodicidad,
      descripcion: p.descripcion || null,
      orden: p.orden ?? i,
    }))
    .sort(
      (a, b) =>
        (a.orden || 0) - (b.orden || 0) || a.nombre.localeCompare(b.nombre),
    );
  return JSON.stringify({
    titulo_comercial: n.titulo_comercial || null,
    descripcion_comercial: n.descripcion_comercial || null,
    operativa: n.operativa || [],
    tareas: n.tareas || [],
    tareas_auxiliares: n.tareas_auxiliares || [],
    tareas_limpieza: n.tareas_limpieza || [],
    bloques_refs: [...(n.bloques_refs || [])].sort(),
    servicios_periodicos: sortedPeriodicos,
    condiciones_especificas: n.condiciones_especificas || [],
    imagen_ref: n.imagen_ref || null,
    periodicidad: n.periodicidad || null,
    template_key: n.template_key || null,
  });
}

export function isContenidoPersonalizado(
  local: unknown,
  plantilla: unknown,
  fallbackNombre?: string,
): boolean {
  if (local == null) return false;
  const a = normalizeContenidoComercial(local, fallbackNombre);
  const b = normalizeContenidoComercial(plantilla, fallbackNombre);
  return contenidoFingerprint(a) !== contenidoFingerprint(b);
}

/**
 * Effective commercial content for a presupuesto line.
 * Prefer local working copy → optional snapshot → catalog plantilla.
 */
export function resolveContenidoEfectivo(opts: {
  local?: unknown;
  snapshot?: unknown;
  plantilla?: unknown;
  nombre?: string;
}): ContenidoComercial {
  const nombre = opts.nombre || '';
  if (opts.local != null) {
    return normalizeContenidoComercial(opts.local, nombre);
  }
  if (opts.snapshot != null) {
    return normalizeContenidoComercial(opts.snapshot, nombre);
  }
  return normalizeContenidoComercial(opts.plantilla, nombre);
}

export function cloneContenidoFromPlantilla(
  plantilla: unknown,
  nombre?: string,
): ContenidoComercial {
  return normalizeContenidoComercial(plantilla, nombre);
}
