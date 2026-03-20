import type { AssistantLocale } from '../types/assistant-preferences.types';

/** Metadate UI pentru intent DESCONOCIDO / fără tool-uri. */
export function unsupportedIntentUi(locale: AssistantLocale) {
  switch (locale) {
    case 'ro':
      return {
        sourceLabel: 'Răspuns asistat',
        sourceDetail:
          'Intent neclasificat sau încredere scăzută; fără interogare date interne',
        limitations: [
          'Nu s-au rulat instrumente de date (doar răspuns generat).',
        ],
      };
    case 'en':
      return {
        sourceLabel: 'Assisted response',
        sourceDetail:
          'Unclassified intent or low confidence; no internal data query',
        limitations: ['No data tools were run (generated response only).'],
      };
    default:
      return {
        sourceLabel: 'Respuesta asistida',
        sourceDetail:
          'Intent no clasificado o confianza baja; sin consulta a datos internos',
        limitations: [
          'No se ejecutaron herramientas de datos (solo respuesta generada).',
        ],
      };
  }
}

/** Falta/sin nómina: hace falta un mes concreto para la consulta SQL. */
export function nominasMesClarificationUi(locale: AssistantLocale) {
  switch (locale) {
    case 'ro':
      return {
        label: 'Clarificare',
        detail:
          'Pentru angajații fără fluturaș, spune luna (ex. „februarie”, „febrero”).',
        followUps: [
          'Exemple: „lipsește fluturașul pentru februarie”, „cine nu are nomina în martie”.',
        ],
      };
    case 'en':
      return {
        label: 'Clarification',
        detail:
          'To list employees missing a payslip, specify the month (e.g. February).',
        followUps: [
          'Examples: “who is missing February payslip”, “no payslip for March”.',
        ],
      };
    default:
      return {
        label: 'Aclaración',
        detail:
          'Para ver empleados sin nómina, indica el mes (ej. febrero, marzo).',
        followUps: [
          'Ejemplos: «falta nómina febrero», «quién no tiene nómina en marzo».',
        ],
      };
  }
}

export function fichajesClarificationUi(locale: AssistantLocale) {
  switch (locale) {
    case 'ro':
      return {
        label: 'Clarificare',
        detail: 'E nevoie de dată sau perioadă pentru registrele de fichaje.',
        followUps: [
          'Indică «azi», «acum», «luna asta» sau o dată concretă (AAAA-LL-ZZ).',
        ],
      };
    case 'en':
      return {
        label: 'Clarification',
        detail: 'A date or period is needed to query clock-in records.',
        followUps: [
          'Say «today», «now», «this month» or a concrete date (YYYY-MM-DD).',
        ],
      };
    default:
      return {
        label: 'Aclaración',
        detail: 'Se necesita fecha o periodo para consultar fichajes',
        followUps: [
          'Indica «hoy», «ahora», «este mes» o una fecha concreta (AAAA-MM-DD).',
        ],
      };
  }
}

/** KB procedimientos consultada pero sin artículos: sin mensaje «no hay datos». */
export function procedimientosSinArticulosUi(locale: AssistantLocale) {
  switch (locale) {
    case 'ro':
      return {
        sourceLabel: 'Ghid utilizare aplicație',
        sourceDetail:
          'Baza de cunoștințe nu conține un articol exact; răspunsul oferă pași generali siguri.',
        limitations: [
          'Pașii sunt orientativi; detaliile pot varia după rol sau versiune.',
        ],
        followUp:
          'Reformulează cu un cuvânt din meniu (ex. „solicitări”, „cuadrante”, „documente”) sau întreabă administrarea.',
      };
    case 'en':
      return {
        sourceLabel: 'App usage guide',
        sourceDetail:
          'No exact knowledge-base article matched; the answer gives safe general steps.',
        limitations: [
          'Steps are indicative; details may vary by role or app version.',
        ],
        followUp:
          'Rephrase using a menu keyword (e.g. “requests”, “schedule”, “documents”) or ask your admin team.',
      };
    default:
      return {
        sourceLabel: 'Guía de uso de la app',
        sourceDetail:
          'No hay un artículo exacto en la base de conocimiento; la respuesta ofrece pasos generales seguros.',
        limitations: [
          'Los pasos son orientativos; pueden variar según rol o versión.',
        ],
        followUp:
          'Reformula con una palabra del menú (ej. «solicitudes», «cuadrantes», «documentos») o consulta a administración.',
      };
  }
}

export function noDataQueryUi(locale: AssistantLocale) {
  switch (locale) {
    case 'ro':
      return {
        sourceLabel: 'Răspuns asistat',
        sourceDetail:
          'Interogarea nu a întors rânduri; textul te poate ghida fără a inventa date.',
        limitations: [
          'Nu există înregistrări care să corespundă criteriilor (sau rezultat gol).',
          'În acest flux nu se distinge încă «fără date» de «fără permisiune».',
        ],
        kbFollowUp: 'Încearcă alte cuvinte în baza de cunoștințe.',
      };
    case 'en':
      return {
        sourceLabel: 'Assisted response',
        sourceDetail:
          'The query returned no rows; the text may guide you without inventing data.',
        limitations: [
          'No records match the current criteria (or empty result).',
          'This flow does not yet distinguish «no data» from «no permission».',
        ],
        kbFollowUp: 'Try other keywords in the knowledge base.',
      };
    default:
      return {
        sourceLabel: 'Respuesta asistida',
        sourceDetail:
          'La consulta no devolvió filas; el texto puede orientarte sin inventar datos',
        limitations: [
          'No hay registros que coincidan con los criterios actuales (o resultado vacío).',
          'No se distingue aún «sin datos» de «sin permiso» en este flujo.',
        ],
        kbFollowUp: 'Prueba otras palabras en la base de conocimiento.',
      };
  }
}

export function queryTechnicalErrorUi(
  locale: AssistantLocale,
  queryError: string,
) {
  const snippet = String(queryError).slice(0, 240);
  switch (locale) {
    case 'ro':
      return {
        respuesta:
          'Nu s-a putut finaliza interogarea din cauza unei erori tehnice. ' +
          'Administrarea a fost anunțată cu o referință de urmărire.',
        sourceLabel: 'Administrare anunțată',
        limitation: `Eroare la interogarea internă: ${snippet}`,
      };
    case 'en':
      return {
        respuesta:
          'The query could not be completed due to a technical error. ' +
          'Administration has been notified with a tracking reference.',
        sourceLabel: 'Administration notified',
        limitation: `Internal query error: ${snippet}`,
      };
    default:
      return {
        respuesta:
          'No se pudo completar la consulta por un error técnico. ' +
          'Se ha notificado a administración con una referencia de seguimiento.',
        sourceLabel: 'Administración notificada',
        limitation: `Error en consulta interna: ${snippet}`,
      };
  }
}

export function assistantFatalErrorUi(locale: AssistantLocale) {
  switch (locale) {
    case 'ro':
      return {
        respuesta:
          'A apărut o erorare la procesarea mesajului. S-a creat un tichet cu prioritate mare.',
        sourceLabel: 'Eroare de sistem',
        limitationFallback: 'Eroare internă nespecificată',
      };
    case 'en':
      return {
        respuesta:
          'An error occurred while processing your request. A high-priority ticket was created.',
        sourceLabel: 'System error',
        limitationFallback: 'Unspecified internal error',
      };
    default:
      return {
        respuesta:
          'Ha ocurrido un error procesando tu consulta. Se ha creado una incidencia de alta prioridad.',
        sourceLabel: 'Error de sistema',
        limitationFallback: 'Error interno no especificado',
      };
  }
}
