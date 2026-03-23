import type { AssistantLocale } from '../types/assistant-preferences.types';

/**
 * Mensaje demasiado vago para buscar en KB o datos (sin tema de app).
 * Solo frases muy cortas y sin objeto (evita "no funciona el fichaje").
 */
export function messageIsVeryVagueAppHelp(mensaje: string): boolean {
  const raw = String(mensaje ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[.!?…]+$/u, '');

  if (raw.length < 4 || raw.length > 80) return false;

  const exact = new Set([
    'no funciona',
    'no me deja',
    'quiero cambiar algo',
    'no va',
    'no funciona nada',
    'no va nada',
  ]);

  return exact.has(raw);
}

const VAGUE_ES =
  '¿En qué parte de la aplicación necesitas ayuda?\n\n' +
  'Puedes indicarme si es sobre datos personales, pedidos, fichaje, vacaciones, cuadrantes, solicitudes u otra sección.';

const VAGUE_RO =
  'În ce zonă a aplicației ai nevoie de ajutor?\n\n' +
  'Poți spune dacă e despre date personale, comenzi (pedidos), pontaj, concedii, cuadrante, cereri sau alt modul.';

const VAGUE_EN =
  'Which part of the app do you need help with?\n\n' +
  'Tell me if it’s about personal data, orders (pedidos), clock-in, time off, schedules, requests, or another section.';

export function getVagueAppHelpClarificationReply(
  locale: AssistantLocale = 'es',
): string {
  switch (locale) {
    case 'ro':
      return VAGUE_RO;
    case 'en':
      return VAGUE_EN;
    default:
      return VAGUE_ES;
  }
}
