/**
 * Semnale lexicale pentru recovery / alerting (fără LLM).
 * Text normalizat: minuscule, fără diacritice pentru potrivire.
 */
export function normalizeAssistantText(mensaje: string): string {
  return String(mensaje ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Semnătură scurtă pentru dedup (fără PII structurată). */
export function assistantMessageSignature(mensaje: string): string {
  const n = normalizeAssistantText(mensaje);
  const tokens = n
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 12);
  return tokens.sort().join('|').slice(0, 200);
}

export function assistantTimeBucket15Min(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / (15 * 60 * 1000));
}

/**
 * Preguntas sobre el propio contrato laboral (DatosEmpleados), no listados de equipo.
 */
export function messageAsksOwnContractSummary(mensaje: string): boolean {
  const n = normalizeAssistantText(mensaje);
  if (!/\bcontrato/.test(n) && !/\bcontract\b/.test(n)) {
    return false;
  }
  if (
    /\b(listado|lista)\s+de\s+empleados\b/.test(n) ||
    /\bempleados\s+sin\b/.test(n)
  ) {
    return false;
  }
  return (
    /\b(mi|mio|mis|meu)\s+contrato\b/.test(n) ||
    /\b(tipo|horas)\s+(de\s+)?contrato\b/.test(n) ||
    /\bcontrato\s+(laboral|de\s+trabajo)\b/.test(n) ||
    /\bsobre\s+(el\s+)?contrato\b/.test(n) ||
    /\bdatos\s+(del\s+|de\s+)?(mi\s+)?contrato\b/.test(n) ||
    (n.split(/\s+/).filter(Boolean).length <= 8 &&
      /\bcontrato\b/.test(n) &&
      !/\bempleados\b/.test(n))
  );
}

export interface BusinessLexiconSignals {
  nomina: boolean;
  diploma: boolean;
  pedido: boolean;
  vacaciones: boolean;
  /** Ausencias operativas / calendario (nu „cómo pido vacaciones”). */
  ausenciasOperativas: boolean;
  fichajes: boolean;
  cuadranteHorario: boolean;
  comunicados: boolean;
  documentosInspeccion: boolean;
  documentosSolicitados: boolean;
  empleadosLista: boolean;
  /** Orice semnal „business” pentru alertă DESCONOCIDO. */
  anyBusiness: boolean;
}

export function computeBusinessLexiconSignals(
  mensaje: string,
): BusinessLexiconSignals {
  const t = normalizeAssistantText(mensaje);

  const nomina =
    /\b(nomina|nominas|fluturas|fluturasi|salario|sueldo|paga)\b/.test(t) ||
    /\bfalta\s+.{0,30}nomina\b/.test(t) ||
    /\bsin\s+nomina\b/.test(t);

  const diploma =
    /\b(diploma|diplomas|certificacion|certificaciones|certificat)\b/.test(t) ||
    /\bprl\b/.test(t) ||
    (/\b(diploma|certificacion|prl)\b/.test(t) &&
      /\b(aplicacion|aplicaci|app)\b/.test(t));

  const pedido =
    /\b(pedido|pedidos|comanda|comenzi|catalogo|material)\b/.test(t) ||
    /\b(mi|el)\s+centro\b/.test(t);

  const vacaciones =
    /\b(vacacion|vacaciones|concediu|concedii|vacanta|vacante)\b/.test(t);

  const ausenciasOperativas =
    (/\b(ausencia|ausencias|absenta|absente|baja)\b/.test(t) &&
      (/\b(manana|mañana|previst|programad|hoy|azi|fecha|dia|día)\b/.test(t) ||
        /\b(proxim|proximos|urmatoare|siguiente)\b/.test(t))) ||
    /\bausencias\s+.{0,40}(manana|mañana|hoy)\b/.test(t);

  const fichajes =
    /\b(fichaje|fichajes|fichar|pontaj|registr(o|a)\s+la\s+entrada|entrada\s+hoy|quien\s+ha\s+registrad)\b/.test(
      t,
    );

  const cuadranteHorario =
    /\b(cuadrante|cuadrantes|horario|orar|plan\s+de\s+trabajo)\b/.test(t);

  const comunicados = /\b(comunicado|comunicados|anuncio|avisos?)\b/.test(t);

  const documentosInspeccion =
    /\b(documento|inspeccion|inspección)\b/.test(t) && !diploma;

  const documentosSolicitados =
    /\b(documentacion\s+pendiente|documento\s+solicit|subir\s+document|me\s+falta\s+subir)\b/.test(
      t,
    );

  const empleadosLista =
    /\b(empleado|empleados|angajat|angajati|lista\s+de\s+personal|personal)\b/.test(
      t,
    ) &&
    !nomina &&
    !pedido;

  const anyBusiness =
    nomina ||
    diploma ||
    pedido ||
    vacaciones ||
    ausenciasOperativas ||
    fichajes ||
    cuadranteHorario ||
    comunicados ||
    documentosInspeccion ||
    documentosSolicitados;

  return {
    nomina,
    diploma,
    pedido,
    vacaciones,
    ausenciasOperativas,
    fichajes,
    cuadranteHorario,
    comunicados,
    documentosInspeccion,
    documentosSolicitados,
    empleadosLista,
    anyBusiness,
  };
}
