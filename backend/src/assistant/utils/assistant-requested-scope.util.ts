import { AssistantDataScope } from '../constants/assistant-data-scope.const';
import { normalizeAssistantText } from './assistant-business-signals.util';

/** Roluri cu drept la ALL (aceeași listă ca RbacService.resolveDataScope). */
export function isAssistantFullAccessRole(
  rol: string | null | undefined,
): boolean {
  if (!rol) return false;
  const r = rol.toLowerCase().trim();
  return (
    r === 'supervisor' ||
    r === 'admin' ||
    r === 'manager' ||
    r === 'jefe' ||
    r === 'developer'
  );
}

/**
 * Scope cerut de formularea mesajului (înainte de clamp la rol).
 * Pentru empleado → mereu OWN. Pentru FULL_ACCESS → OWN dacă semnale personale puternice, altfel ALL.
 */
export function resolveRequestedAssistantDataScope(
  mensaje: string,
  rol: string | null | undefined,
): AssistantDataScope {
  if (!isAssistantFullAccessRole(rol)) {
    return AssistantDataScope.OWN;
  }

  const t = normalizeAssistantText(mensaje);

  if (matchesOwnScopeSignals(t)) {
    return AssistantDataScope.OWN;
  }
  if (matchesAllScopeSignals(t)) {
    return AssistantDataScope.ALL;
  }
  /** Întrebări operaționale fără indiciu personal → ALL (comportament clasic admin). */
  return AssistantDataScope.ALL;
}

/** Expus pentru teste / debug. */
export function matchesOwnScopeSignals(normalizedText: string): boolean {
  const t = normalizedText;

  if (/\bmis\b/.test(t)) return true;

  if (
    /\bmi\s+(horario|cuadrante|nomina|nominas?|ausencia|ausencias|solicitud|solicitudes|vacacion|vacaciones|fichaje|fichajes|entrada|salida|pedido|pedidos)\b/.test(
      t,
    )
  ) {
    return true;
  }

  if (/\bpara\s+mi\b/.test(t)) return true;

  /** „que / qué … tengo” + domeniu personal */
  if (
    /\btengo\b/.test(t) &&
    /\b(ausencias?|vacaciones|nominas?|nomina|fichajes?|fichaje|horario|solicitudes?|solicitud|cuadrante|entrada|salida)\b/.test(
      t,
    )
  ) {
    return true;
  }

  /** Engleză */
  if (
    /\bmy\s+(schedule|shift|absences|payslips?|payslip|requests?|vacation|time\s*off|clock|entries|hours)\b/.test(
      t,
    ) ||
    /\bI\s+have\b/.test(t)
  ) {
    if (
      /\b(absences?|vacation|payslips?|schedule|requests?|time\s*off|clock)\b/.test(
        t,
      )
    ) {
      return true;
    }
  }

  /** Română */
  if (/\bpentru\s+mine\b/.test(t)) return true;
  if (
    /\b(orarul|absentele|cererile|pontajele|nominile|vacantele)\s+(meu|mea|mele|mei)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\b(am|am\s+eu)\b/.test(t) &&
    /\b(absent|orar|cerer|vacant|pontaj|nomina)\w*\b/.test(t)
  ) {
    return true;
  }

  return false;
}

/** Expus pentru teste / debug. */
export function matchesAllScopeSignals(normalizedText: string): boolean {
  const t = normalizedText;

  if (/\b(quien|quienes)\b/.test(t)) return true;
  if (/\bempleados?\b/.test(t)) return true;
  if (/\bequipo\b/.test(t)) return true;
  if (/\btodos\b/.test(t)) return true;
  if (/\bcentro\b/.test(t)) return true;
  if (/\bhay\b/.test(t)) return true;
  if (/\bprevistas?\b/.test(t)) return true;
  /** „pendientes” fără „mis” — OWN e deja tratat înainte */
  if (/\bpendientes\b/.test(t)) return true;

  if (
    /\b(cine|angajatii|angajati|toti|toate|echipa|centrul?|sunt|exista)\b/.test(
      t,
    )
  ) {
    return true;
  }

  if (
    /\b(who|whose|employees?|staff|team|everyone|anyone|center|centre|scheduled|there\s+are)\b/.test(
      t,
    )
  ) {
    return true;
  }

  return false;
}
