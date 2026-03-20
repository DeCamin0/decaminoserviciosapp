import { normalizeForMatch } from './month-and-relative-dates.util';

/**
 * Follow-up scurt semantic: utilizatorul cere listă, detalii sau clarificare
 * legată de răspunsul anterior, fără să reîncadreze explicit tema (RO/ES/EN ușor).
 *
 * Nu include „listă angajați / lista de empleados” — acolo vrem intent EMPLEADOS, nu re-lipire la context.
 */
export function looksLikeDetailOrReformulationFollowUp(raw: string): boolean {
  const t = raw.trim();
  if (t.length > 180) {
    return false;
  }
  const n = normalizeForMatch(t);

  if (
    /\b(lista|listado)\s+de\s+(los\s+)?emplead/.test(n) ||
    /\b(lista|listado)\s+de\s+angajat/.test(n) ||
    /\b(mis|los)\s+empleados\b/.test(n) ||
    /\bangajat(ii|i)\s+mei\b/.test(n)
  ) {
    return false;
  }

  return (
    /\b(lista|listado|detalle|detalles|detalii)\b/.test(n) ||
    /\b(mas\s+datos|mas\s+informacion|mai\s+mult(e)?|more\s+info(rmation)?)\b/.test(
      n,
    ) ||
    /\b(clarifica|clarificare|explic(a|ă|ame))\b/.test(n) ||
    /\b(muestrame|muéstrame|arata|arata-?mi|show\s+me)\b/.test(n) ||
    /\b(dame|da-?mi|dă-?mi|give\s+me)\b/.test(n) ||
    /\b(puedes\s+darme|me\s+puedes(\s+da(r)?)?|poti(\s+sa)?-?mi|poti\s+sami|imi\s+poti|mi\s+poti|nu\s+mi\s+poti)\b/.test(
      n,
    ) ||
    /\b(sa\s+mi\s+arati|sa-mi\s+arat|arati-?mi\s+toate)\b/.test(n) ||
    /\b(o\s+lista|una\s+lista)\b/.test(n) ||
    /\b(amplia|ampliar|enumera)\b/.test(n)
  );
}

/** RO/ES: mesajul vorbește explicit de fluturași / nóminas (inclusiv „nominele”). */
export function looksLikeNominaTopicLex(raw: string): boolean {
  const n = normalizeForMatch(raw);
  return (
    /\b(nomina|nominas|nominele|nomine|nominile|nomină)\b/.test(n) ||
    /\b(fluturasi|fluturas)\b/.test(n) ||
    /\b(payslip|bustar\s+paga)\b/.test(n)
  );
}
