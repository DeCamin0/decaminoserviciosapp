import type { AssistantLocale } from '../types/assistant-preferences.types';

function loose(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/(.)\1+/g, '$1')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asksHow(text: string): boolean {
  return (
    /\b(como|cum|how|unde|donde|where)\b/.test(text) ||
    /\b(solicito|solicitar|pido|pedir|cer|solicit)\b/.test(text)
  );
}

const VACACIONES_ES =
  'Para solicitar vacaciones:\n\n' +
  '1. Abre Solicitudes en el menú.\n' +
  '2. Crea una solicitud nueva.\n' +
  '3. Elige el tipo Vacaciones.\n' +
  '4. Marca el primer día y el último día.\n' +
  '5. Envía la solicitud. Queda pendiente hasta que la aprueben.\n\n' +
  'Si quieres saber cuántos días te quedan, pregunta por el saldo, no por cómo se pide.';

const OLVIDO_FICHAR_ES =
  'Si se te olvidó fichar hoy, entra en Fichaje y registra la entrada o la salida que falta.\n\n' +
  'Si el día ya pasó y no hay fichajes:\n' +
  '1. Abre Mi Horario.\n' +
  '2. En ese día, pulsa «Indicar motivo».\n' +
  '3. Elige «Olvidé fichar».\n' +
  '4. El supervisor lo revisa.\n\n' +
  'Si el fichaje ya existe pero falta la salida o la hora está mal, abre Registros y pulsa «Regularizar» en ese registro.';

const OLVIDO_FICHAR_RO =
  'Dacă ai uitat să pontezi azi, intră în Fichaje și înregistrează intrarea sau ieșirea care lipsește.\n\n' +
  'Dacă ziua a trecut și nu are pontaje:\n' +
  '1. Deschide Mi Horario.\n' +
  '2. În ziua aia, apasă «Indicar motivo».\n' +
  '3. Alege «Olvidé fichar».\n' +
  '4. Supervizorul îl verifică.\n\n' +
  'Dacă pontajul există, dar lipsește ieșirea sau ora e greșită, deschide Registros și apasă «Regularizar» pe înregistrarea aia.';

const VACACIONES_RO =
  'Ca să ceri concediu:\n\n' +
  '1. Deschide Solicitudes din meniu.\n' +
  '2. Creează o cerere nouă.\n' +
  '3. Alege tipul Vacaciones.\n' +
  '4. Marchează prima zi și ultima zi.\n' +
  '5. Trimite cererea. Rămâne în așteptare până este aprobată.\n\n' +
  'Dacă vrei câte zile îți mai rămân, întreabă de sold, nu de cum se face cererea.';

/**
 * Pași ficși pentru „cum fac”, când baza de cunoștințe nu are articol.
 * Tolerează litere repetate (horarrio, vacaciones) fără o listă de greșeli.
 */
export function proceduralHowToReply(
  mensaje: string,
  locale: AssistantLocale = 'es',
): string | null {
  const text = loose(mensaje);
  if (!text) return null;
  const forgotPunch =
    /\b(fich\w*|pontaj\w*|marcaj\w*)\b/.test(text) &&
    /\b(ol[vb]id\w*|uitat\w*|forgot\w*)\b/.test(text);
  if (forgotPunch) {
    if (locale === 'ro' || /\b(uitat|am uitat)\b/.test(text))
      return OLVIDO_FICHAR_RO;
    return OLVIDO_FICHAR_ES;
  }
  if (!asksHow(text)) return null;
  const aboutVacation = /\b(vacacion\w*|concediu\w*|vacation\w*)\b/.test(text);
  if (!aboutVacation) return null;
  if (locale === 'ro' || /\b(concediu|cum)\b/.test(text)) return VACACIONES_RO;
  return VACACIONES_ES;
}
