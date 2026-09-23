/**
 * Birthday greeting helpers — Europe/Madrid calendar day only (no age).
 */

const MADRID_TZ = 'Europe/Madrid';

const BIRTHDAY_WISHES = [
  (name) =>
    `¡Feliz cumpleaños, ${name}! Que este día esté lleno de momentos bonitos y mucha energía.`,
  (name) =>
    `¡Feliz cumpleaños, ${name}! Gracias por formar parte del equipo. ¡Disfruta tu día!`,
  (name) =>
    `¡Feliz cumpleaños, ${name}! Te deseamos un día genial y un año lleno de buenos momentos.`,
  (name) =>
    `¡Feliz cumpleaños, ${name}! Que cumplas muchos más rodeado de gente que te aprecia.`,
  (name) =>
    `¡Feliz cumpleaños, ${name}! Hoy es tu día: ¡celébralo como te mereces!`,
];

/**
 * @param {unknown} value
 * @returns {{ day: number, month: number } | null} month 1–12
 */
export function parseBirthMonthDay(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (
    lower.includes('undefined') ||
    lower.includes('null') ||
    lower.includes('invalid') ||
    lower === 'nan'
  ) {
    return null;
  }

  let day;
  let month;

  // YYYY-MM-DD or YYYY/MM/DD (optional time)
  let m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m) {
    month = Number(m[2]);
    day = Number(m[3]);
  } else {
    // DD/MM/YYYY or DD-MM-YYYY
    m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (m) {
      day = Number(m[1]);
      month = Number(m[2]);
    }
  }

  if (!day || !month || day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }
  return { day, month };
}

/**
 * Today's day/month in Europe/Madrid.
 * @param {Date} [now]
 * @returns {{ day: number, month: number }}
 */
export function getMadridMonthDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MADRID_TZ,
    day: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  return { day, month };
}

/**
 * @param {unknown} fechaNacimiento
 * @param {Date} [now]
 */
export function isBirthdayToday(fechaNacimiento, now = new Date()) {
  const birth = parseBirthMonthDay(fechaNacimiento);
  if (!birth) return false;
  const today = getMadridMonthDay(now);
  return birth.day === today.day && birth.month === today.month;
}

/**
 * Prefer split NOMBRE; else first token of full name.
 * @param {Record<string, unknown> | null | undefined} empleado
 * @param {string} [fallbackFullName]
 */
export function getBirthdayFirstName(empleado, fallbackFullName = '') {
  const fromSplit = String(
    empleado?.NOMBRE ?? empleado?.nombre ?? '',
  ).trim();
  if (fromSplit) {
    return fromSplit.split(/\s+/)[0];
  }
  const full = String(
    empleado?.['NOMBRE / APELLIDOS'] ??
      empleado?.NOMBRE_APELLIDOS ??
      fallbackFullName ??
      '',
  ).trim();
  if (!full) return 'compañero/a';
  return full.split(/\s+/)[0] || 'compañero/a';
}

/**
 * Stable wish for the same person on the same Madrid calendar day.
 * @param {string} firstName
 * @param {string} [seed] e.g. employee CODIGO
 * @param {Date} [now]
 */
export function getBirthdayWish(firstName, seed = '', now = new Date()) {
  const name = (firstName || 'compañero/a').trim() || 'compañero/a';
  const { day, month } = getMadridMonthDay(now);
  const key = `${seed}|${month}-${day}|${name}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const wishFn = BIRTHDAY_WISHES[hash % BIRTHDAY_WISHES.length];
  return wishFn(name);
}

/**
 * @param {Record<string, unknown> | null | undefined} empleado
 * @param {string} [fallbackFullName]
 * @param {Date} [now]
 * @returns {{ isBirthday: boolean, firstName: string, wish: string } | null}
 */
export function getBirthdayGreeting(empleado, fallbackFullName = '', now = new Date()) {
  const fecha =
    empleado?.['FECHA NACIMIENTO'] ??
    empleado?.FECHA_NACIMIENTO ??
    empleado?.fecha_nacimiento ??
    empleado?.fechaNacimiento ??
    null;
  if (!isBirthdayToday(fecha, now)) {
    return null;
  }
  const firstName = getBirthdayFirstName(empleado, fallbackFullName);
  const seed = String(empleado?.CODIGO ?? empleado?.codigo ?? fallbackFullName ?? '');
  return {
    isBirthday: true,
    firstName,
    wish: getBirthdayWish(firstName, seed, now),
  };
}
