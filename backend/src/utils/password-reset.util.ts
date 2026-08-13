/**
 * Password-reset token helpers (Vecindario security model, DeCamino wiring).
 */
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export const FORGOT_GENERIC_MESSAGE =
  'Si existe una cuenta asociada a este correo, recibirás instrucciones para restablecer tu contraseña.';

export const FORGOT_RATE_LIMIT_IP = 10;
export const FORGOT_RATE_WINDOW_IP_MS = 15 * 60 * 1000;
export const FORGOT_RATE_LIMIT_EMAIL = 5;
export const FORGOT_RATE_WINDOW_EMAIL_MS = 60 * 60 * 1000;

export const RESET_RATE_LIMIT_IP = 20;
export const RESET_RATE_WINDOW_IP_MS = 15 * 60 * 1000;

export function normalizeResetEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  if (!t || !t.includes('@') || t.length > 255) return null;
  return t;
}

export function generatePasswordResetTokenPlain(): string {
  return randomBytes(32).toString('base64url');
}

export function hashPasswordResetToken(plainToken: string): string {
  return createHash('sha256').update(plainToken, 'utf8').digest('hex');
}

export function passwordResetExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + PASSWORD_RESET_TTL_MS);
}

export function tokenHashesEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length || ba.length === 0) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** In-memory sliding window (single API process). */
export class SlidingWindowRateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private readonly nowFn: () => number = () => Date.now()) {}

  allow(key: string, limit: number, windowMs: number): boolean {
    const now = this.nowFn();
    const cutoff = now - windowMs;
    const prev = this.hits.get(key) ?? [];
    const recent = prev.filter((t) => t > cutoff);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  reset(): void {
    this.hits.clear();
  }
}

export const forgotPasswordRateLimiter = new SlidingWindowRateLimiter();
export const resetPasswordRateLimiter = new SlidingWindowRateLimiter();

export function checkForgotPasswordRateLimits(opts: {
  ip: string;
  email: string;
  limiter?: SlidingWindowRateLimiter;
}): { ok: true } | { ok: false; retryAfterHint: string } {
  const limiter = opts.limiter ?? forgotPasswordRateLimiter;
  if (
    !limiter.allow(
      `ip:${opts.ip || 'unknown'}`,
      FORGOT_RATE_LIMIT_IP,
      FORGOT_RATE_WINDOW_IP_MS,
    )
  ) {
    return {
      ok: false,
      retryAfterHint:
        'Demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.',
    };
  }
  if (
    !limiter.allow(
      `email:${opts.email}`,
      FORGOT_RATE_LIMIT_EMAIL,
      FORGOT_RATE_WINDOW_EMAIL_MS,
    )
  ) {
    return {
      ok: false,
      retryAfterHint:
        'Demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.',
    };
  }
  return { ok: true };
}

export function checkResetPasswordRateLimits(opts: {
  ip: string;
  limiter?: SlidingWindowRateLimiter;
}): { ok: true } | { ok: false; retryAfterHint: string } {
  const limiter = opts.limiter ?? resetPasswordRateLimiter;
  if (
    !limiter.allow(
      `ip:${opts.ip || 'unknown'}`,
      RESET_RATE_LIMIT_IP,
      RESET_RATE_WINDOW_IP_MS,
    )
  ) {
    return {
      ok: false,
      retryAfterHint:
        'Demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.',
    };
  }
  return { ok: true };
}

export class ForgotPasswordRateLimitError extends Error {
  status = 429;
  constructor(message: string) {
    super(message);
    this.name = 'ForgotPasswordRateLimitError';
  }
}
