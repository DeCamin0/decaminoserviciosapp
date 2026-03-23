import { normalizeAssistantText } from './assistant-business-signals.util';

/**
 * Detecta mensajes sobre uso de la app / datos personales / dirección donde el usuario
 * necesita pasos concretos (no un "no hay datos" genérico).
 * Reglas explícitas — sin ML.
 */
export function looksLikeAppHelpDatosPersonales(mensaje: string): boolean {
  const t = normalizeAssistantText(mensaje);
  if (!t) return false;

  const topicPersonal =
    /\b(direccion|domicilio|datos personales|mis datos|mi perfil|perfil)\b/.test(
      t,
    ) ||
    /\b(telefono|teléfono|correo|email|mi casa)\b/.test(t) ||
    /\b(correo electronico|cuenta bancaria|iban)\b/.test(t);

  const appHelpCue =
    /\b(no me deja|no puedo|no deja)\b/.test(t) ||
    /\b(donde|dónde)\b/.test(t) ||
    /\b(como|cómo)\b/.test(t) ||
    /\b(quiero|necesito)\s+(poner|cambiar|actualizar|editar|guardar|meter)\b/.test(
      t,
    );

  if (topicPersonal && appHelpCue) return true;

  if (
    /\bno me deja\b/.test(t) &&
    /\b(guardar|editar|poner|cambiar|actualizar|escribir)\b/.test(t)
  ) {
    return true;
  }

  return false;
}
