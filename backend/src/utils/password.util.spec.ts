import {
  BCRYPT_COST,
  generateTemporaryPassword,
  hashPassword,
  isBcryptHash,
  validateNewPasswordPair,
  validatePasswordComplexity,
  verifyPassword,
} from './password.util';
import {
  FORGOT_GENERIC_MESSAGE,
  SlidingWindowRateLimiter,
  checkForgotPasswordRateLimits,
  generatePasswordResetTokenPlain,
  hashPasswordResetToken,
  normalizeResetEmail,
  passwordResetExpiresAt,
  PASSWORD_RESET_TTL_MS,
  tokenHashesEqual,
} from './password-reset.util';

describe('password.util', () => {
  it('detects bcrypt hashes', async () => {
    const hash = await hashPassword('Abcdefg1!');
    expect(isBcryptHash(hash)).toBe(true);
    expect(isBcryptHash('plaintext')).toBe(false);
    expect(isBcryptHash('')).toBe(false);
  });

  it('verifies bcrypt and rejects wrong password', async () => {
    const hash = await hashPassword('SecretPass1!');
    expect((await verifyPassword('SecretPass1!', hash)).ok).toBe(true);
    expect((await verifyPassword('WrongPass1!', hash)).ok).toBe(false);
    expect((await verifyPassword('SecretPass1!', hash)).needsUpgrade).toBe(
      false,
    );
  });

  it('verifies legacy plaintext and flags upgrade', async () => {
    const r = await verifyPassword('legacyPass', 'legacyPass');
    expect(r.ok).toBe(true);
    expect(r.needsUpgrade).toBe(true);
    const bad = await verifyPassword('nope', 'legacyPass');
    expect(bad.ok).toBe(false);
  });

  it('does not treat DNI equality specially (caller must not pass DNI)', async () => {
    // Stored password is bcrypt of X; typing DNI fails
    const hash = await hashPassword('RealPass1!');
    expect((await verifyPassword('12345678A', hash)).ok).toBe(false);
  });

  it('enforces DeCamino complexity', () => {
    expect(validatePasswordComplexity('short').ok).toBe(false);
    expect(validatePasswordComplexity('alllowercase1!').ok).toBe(false);
    expect(validatePasswordComplexity('ALLUPPERCASE1!').ok).toBe(false);
    expect(validatePasswordComplexity('NoNumber!!AA').ok).toBe(false);
    expect(validatePasswordComplexity('NoSpecial12A').ok).toBe(false);
    expect(validatePasswordComplexity('ValidPass1!').ok).toBe(true);
  });

  it('validates password pair match', () => {
    expect(validateNewPasswordPair('ValidPass1!', 'ValidPass1!').ok).toBe(true);
    expect(validateNewPasswordPair('ValidPass1!', 'OtherPass1!').ok).toBe(
      false,
    );
  });

  it('generates complex temporary passwords', () => {
    const p = generateTemporaryPassword(12);
    expect(p.length).toBe(12);
    expect(validatePasswordComplexity(p).ok).toBe(true);
  });

  it('uses bcrypt cost 12', () => {
    expect(BCRYPT_COST).toBe(12);
  });
});

describe('password-reset.util', () => {
  it('generates opaque base64url token and stores only sha256', () => {
    const plain = generatePasswordResetTokenPlain();
    expect(plain.length).toBeGreaterThanOrEqual(40);
    expect(plain).not.toMatch(/[+/=]/);
    const hash = hashPasswordResetToken(plain);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(plain);
    expect(tokenHashesEqual(hash, hashPasswordResetToken(plain))).toBe(true);
  });

  it('TTL is 60 minutes', () => {
    const from = new Date('2026-08-13T12:00:00.000Z');
    const exp = passwordResetExpiresAt(from);
    expect(exp.getTime() - from.getTime()).toBe(PASSWORD_RESET_TTL_MS);
    expect(PASSWORD_RESET_TTL_MS).toBe(60 * 60 * 1000);
  });

  it('normalizes email', () => {
    expect(normalizeResetEmail('  A@B.COM ')).toBe('a@b.com');
    expect(normalizeResetEmail('bad')).toBeNull();
    expect(normalizeResetEmail(null)).toBeNull();
  });

  it('rate limits by IP and email', () => {
    const limiter = new SlidingWindowRateLimiter(() => 1_000_000);
    const email = 'user@example.com';
    for (let i = 0; i < 5; i++) {
      expect(
        checkForgotPasswordRateLimits({ ip: '1.1.1.1', email, limiter }).ok,
      ).toBe(true);
    }
    expect(
      checkForgotPasswordRateLimits({ ip: '1.1.1.1', email, limiter }).ok,
    ).toBe(false);
  });

  it('exposes generic anti-enumeration message', () => {
    expect(FORGOT_GENERIC_MESSAGE.toLowerCase()).toContain('si existe');
  });
});
