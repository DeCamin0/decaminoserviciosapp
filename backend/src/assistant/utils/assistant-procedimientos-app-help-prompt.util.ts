import type { AssistantLocale } from '../types/assistant-preferences.types';

/**
 * Instrucciones explícitas cuando KB está vacío pero el mensaje es app-help / datos personales.
 * Evita que el LLM invente flujos genéricos sin mencionar `/datos`, motivo y aprobación.
 */
export function procedimientosAppHelpDatosPersonalesSupplement(
  locale: AssistantLocale,
): string {
  switch (locale) {
    case 'ro':
      return (
        '\n\nCONTEXT OBLIGATORIU (date personale în aplicația Decamino):\n' +
        '- Ruta: `/datos` sau meniul **Date personale** / **Datos personales**.\n' +
        '- La editare, **motivul modificării este obligatoriu**; fără el nu se poate trimite.\n' +
        '- Modificările merg de obicei la **aprobare**; nu sunt mereu salvate instant.\n' +
        '- Nu inventa alte secțiuni (ex. Documentos generic) dacă utilizatorul întreabă de adresă sau date personale.'
      );
    case 'en':
      return (
        '\n\nMANDATORY CONTEXT (personal data in the Decamino app):\n' +
        '- Route: `/datos` or **Datos personales** in the menu.\n' +
        '- When editing, the **reason for the change is required**; you cannot submit without it.\n' +
        '- Changes usually go for **approval**; they are not always saved instantly.\n' +
        '- Do not invent other sections (e.g. generic Documents) if the user asks about address or personal data.'
      );
    default:
      return (
        '\n\nCONTEXTO OBLIGATORIO (datos personales en la app Decamino):\n' +
        '- Ruta: `/datos` o menú **Datos personales**.\n' +
        '- Al editar, el **Motivo de la modificación** es obligatorio; sin él no se puede enviar.\n' +
        '- Los cambios suelen ir a **aprobación**; no siempre se guardan al instante.\n' +
        '- No inventes otras secciones (p. ej. Documentos genéricos) si el usuario pregunta por dirección o datos personales.'
      );
  }
}
