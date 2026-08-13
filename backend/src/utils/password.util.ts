/**
 * Password helpers for DeCamino employee auth.
 * Legacy plaintext in DatosEmpleados.Contraseña is only accepted for login
 * transition; every successful legacy login (and every write) upgrades to bcrypt.
 */
import * as bcrypt from 'bcrypt';

export const BCRYPT_COST = 12;

/** bcrypt hashes start with $2a$ / $2b$ / $2y$ and are ~60 chars. */
const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export function isBcryptHash(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  return BCRYPT_HASH_RE.test(v);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Verify password against stored value.
 * - bcrypt → bcrypt.compare
 * - otherwise → temporary plaintext equality (legacy only)
 */
export async function verifyPassword(
  plain: string,
  stored: string | null | undefined,
): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  const input = String(plain ?? '');
  const storedValue = String(stored ?? '').trim();
  if (!storedValue) {
    return { ok: false, needsUpgrade: false };
  }
  if (isBcryptHash(storedValue)) {
    const ok = await bcrypt.compare(input, storedValue);
    return { ok, needsUpgrade: false };
  }
  // Legacy plaintext — timing not critical; will be upgraded on success.
  const ok = storedValue === input.trim();
  return { ok, needsUpgrade: ok };
}

/** Same complexity rules as historical changePassword. */
export type PasswordComplexityResult =
  | { ok: true; password: string }
  | { ok: false; error: string };

export function validatePasswordComplexity(
  newPassword: unknown,
): PasswordComplexityResult {
  if (typeof newPassword !== 'string' || !newPassword.trim()) {
    return { ok: false, error: 'La nueva contraseña es obligatoria' };
  }
  const password = newPassword.trim();
  if (password.length < 9) {
    return {
      ok: false,
      error:
        'La nueva contraseña debe tener al menos 9 caracteres (se recomienda 12)',
    };
  }
  if (password.length > 100) {
    return {
      ok: false,
      error: 'La nueva contraseña no puede tener más de 100 caracteres',
    };
  }
  const errors: string[] = [];
  if (!/[A-Z]/.test(password)) errors.push('al menos 1 letra mayúscula (A-Z)');
  if (!/[a-z]/.test(password)) errors.push('al menos 1 letra minúscula (a-z)');
  if (!/[0-9]/.test(password)) errors.push('al menos 1 número (0-9)');
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('al menos 1 carácter especial (! @ # $ % ^ & * ( ) _ + - =)');
  }
  if (errors.length > 0) {
    return {
      ok: false,
      error: `La nueva contraseña debe contener: ${errors.join(', ')}`,
    };
  }
  return { ok: true, password };
}

export function validateNewPasswordPair(
  newPassword: unknown,
  confirmPassword: unknown,
): PasswordComplexityResult {
  const base = validatePasswordComplexity(newPassword);
  if (!base.ok) return base;
  if (
    typeof confirmPassword !== 'string' ||
    confirmPassword !== base.password
  ) {
    return {
      ok: false,
      error: 'La contraseña y la confirmación no coinciden',
    };
  }
  return base;
}

/** Generate a one-time temporary password (never persisted in plaintext). */
export function generateTemporaryPassword(length = 12): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnpqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%&*';
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  password += special[Math.floor(Math.random() * special.length)];
  const allChars = uppercase + lowercase + numbers + special;
  while (password.length < length) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}
