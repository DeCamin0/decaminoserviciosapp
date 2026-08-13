import { MotorCodigo, MotorDefinition } from './tipos';
import { motorAuxiliaresCoste } from './motores/auxiliares-coste.motor';
import { motorLimpiezaCoste } from './motores/limpieza-coste.motor';
import { motorPrecioMensual } from './motores/precio-mensual.motor';
import { motorPiscina } from './motores/piscina.motor';

const REGISTRY: Record<string, MotorDefinition> = {
  [motorAuxiliaresCoste.codigo]: motorAuxiliaresCoste,
  [motorLimpiezaCoste.codigo]: motorLimpiezaCoste,
  [motorPrecioMensual.codigo]: motorPrecioMensual,
  [motorPiscina.codigo]: motorPiscina,
};

export function getMotorDefinition(codigo: string): MotorDefinition | null {
  return REGISTRY[codigo] ?? null;
}

export function listImplementedMotors(): MotorDefinition[] {
  return Object.values(REGISTRY);
}

export function assertMotorImplemented(codigo: string): MotorDefinition {
  const m = getMotorDefinition(codigo);
  if (!m) {
    throw new Error(
      `Motor "${codigo}" está en catálogo pero no tiene implementación en código`,
    );
  }
  return m;
}

export function isKnownMotorCodigo(codigo: string): codigo is MotorCodigo {
  return codigo in REGISTRY;
}

/** Deep-merge defaults ← servicio defaults ← line inputs (objects shallow-merge nested bc pairs). */
export function mergeInputs(
  ...layers: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    for (const [k, v] of Object.entries(layer)) {
      if (
        v &&
        typeof v === 'object' &&
        !Array.isArray(v) &&
        out[k] &&
        typeof out[k] === 'object' &&
        !Array.isArray(out[k])
      ) {
        out[k] = { ...(out[k] as object), ...(v as object) };
      } else if (v !== undefined) {
        out[k] = v;
      }
    }
  }
  return out;
}
