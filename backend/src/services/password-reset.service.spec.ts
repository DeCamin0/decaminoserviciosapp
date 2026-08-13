import { PasswordResetService } from './password-reset.service';
import {
  FORGOT_GENERIC_MESSAGE,
  ForgotPasswordRateLimitError,
  forgotPasswordRateLimiter,
  generatePasswordResetTokenPlain,
  hashPasswordResetToken,
  passwordResetExpiresAt,
} from '../utils/password-reset.util';
import { isBcryptHash } from '../utils/password.util';

describe('PasswordResetService', () => {
  let prisma: any;
  let email: any;
  let config: any;
  let service: PasswordResetService;

  beforeEach(() => {
    forgotPasswordRateLimiter.reset();
    prisma = {
      user: { findFirst: jest.fn() },
      passwordResetToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };
    email = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'company') {
          return {
            frontendAppUrl: 'https://app.example.com',
            legalNameShort: 'DeCamino',
            brandRed: '#CC0000',
          };
        }
        return undefined;
      }),
    };
    service = new PasswordResetService(prisma, email, config);
  });

  it('existing email → generic message + token hash stored (not plain)', async () => {
    prisma.user.findFirst.mockResolvedValue({
      CODIGO: 'E1',
      CORREO_ELECTRONICO: 'user@ex.com',
      ESTADO: 'ACTIVO',
    });
    const res = await service.requestPasswordReset({
      email: 'user@ex.com',
      ip: '10.0.0.1',
      userAgent: 'jest',
    });
    expect(res.message).toBe(FORGOT_GENERIC_MESSAGE);
    expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    const created = prisma.passwordResetToken.create.mock.calls[0][0].data;
    expect(created.tokenHash).toHaveLength(64);
    expect(created.tokenHash).not.toMatch(/[^a-f0-9]/);
    expect(email.sendEmail).toHaveBeenCalled();
    const html = email.sendEmail.mock.calls[0][2] as string;
    expect(html).toContain('Restablecer contraseña');
    expect(html).toContain('/restablecer-contrasena?token=');
  });

  it('unknown email → same generic message', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const res = await service.requestPasswordReset({
      email: 'nobody@ex.com',
      ip: '10.0.0.2',
      userAgent: null,
    });
    expect(res.message).toBe(FORGOT_GENERIC_MESSAGE);
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('SMTP failure still returns generic message', async () => {
    prisma.user.findFirst.mockResolvedValue({
      CODIGO: 'E1',
      CORREO_ELECTRONICO: 'user@ex.com',
      ESTADO: 'ACTIVO',
    });
    email.sendEmail.mockRejectedValue(new Error('SMTP down'));
    const res = await service.requestPasswordReset({
      email: 'user@ex.com',
      ip: '10.0.0.3',
      userAgent: null,
    });
    expect(res.message).toBe(FORGOT_GENERIC_MESSAGE);
  });

  it('valid token resets with bcrypt and marks used', async () => {
    const plain = generatePasswordResetTokenPlain();
    const tokenHash = hashPasswordResetToken(plain);
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 9,
      userCodigo: 'E9',
      tokenHash,
      expiresAt: passwordResetExpiresAt(),
      usedAt: null,
    });

    const result = await service.resetPasswordWithToken({
      token: plain,
      newPassword: 'NewValid1!',
      confirmPassword: 'NewValid1!',
      ip: '10.0.0.4',
    });
    expect(result.success).toBe(true);
    const hashArg = prisma.$executeRawUnsafe.mock.calls[0][1];
    expect(isBcryptHash(hashArg)).toBe(true);
    expect(prisma.passwordResetToken.update).toHaveBeenCalled();
  });

  it('expired token rejected', async () => {
    const plain = generatePasswordResetTokenPlain();
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 1,
      userCodigo: 'E1',
      tokenHash: hashPasswordResetToken(plain),
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });
    await expect(
      service.resetPasswordWithToken({
        token: plain,
        newPassword: 'NewValid1!',
        confirmPassword: 'NewValid1!',
        ip: '10.0.0.5',
      }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/no válido|caducado/i),
    });
  });

  it('used token rejected (single-use)', async () => {
    const plain = generatePasswordResetTokenPlain();
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 1,
      userCodigo: 'E1',
      tokenHash: hashPasswordResetToken(plain),
      expiresAt: passwordResetExpiresAt(),
      usedAt: new Date(),
    });
    await expect(
      service.resetPasswordWithToken({
        token: plain,
        newPassword: 'NewValid1!',
        confirmPassword: 'NewValid1!',
        ip: '10.0.0.6',
      }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/no válido|caducado/i),
    });
  });

  it('password mismatch rejected', async () => {
    await expect(
      service.resetPasswordWithToken({
        token: 'abc',
        newPassword: 'NewValid1!',
        confirmPassword: 'OtherValid1!',
        ip: '10.0.0.7',
      }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/coinciden/i) });
  });

  it('forgot rate limit throws 429-style error', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    for (let i = 0; i < 10; i++) {
      await service.requestPasswordReset({
        email: `u${i}@ex.com`,
        ip: '9.9.9.9',
        userAgent: null,
      });
    }
    await expect(
      service.requestPasswordReset({
        email: 'last@ex.com',
        ip: '9.9.9.9',
        userAgent: null,
      }),
    ).rejects.toBeInstanceOf(ForgotPasswordRateLimitError);
  });
});
