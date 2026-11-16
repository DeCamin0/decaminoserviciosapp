import { AuthService } from './auth.service';
import { hashPassword } from '../utils/password.util';

function makeJwt() {
  return {
    sign: jest.fn(
      (payload: any) => `jwt:${payload.type}:${payload.authVersion}`,
    ),
    verify: jest.fn(),
  };
}

describe('AuthService login bcrypt migration', () => {
  let prisma: any;
  let jwt: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      authRefreshSession: {
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: { id: string } }) =>
            Promise.resolve(data),
          ),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };
    jwt = makeJwt();
    service = new AuthService(jwt as any, prisma);
  });

  it('plaintext correct → OK + auto-upgrade bcrypt', async () => {
    prisma.user.findFirst.mockResolvedValue({
      CODIGO: 'E1',
      CORREO_ELECTRONICO: 'a@b.com',
      CONTRASENA: 'PlainPass1!',
      DNI_NIE: '12345678A',
      ESTADO: 'ACTIVO',
      GRUPO: 'Empleados',
      AUTH_VERSION: 0,
    });
    prisma.user.findUnique.mockResolvedValue({ AUTH_VERSION: 1 });

    const result = await service.login('a@b.com', 'PlainPass1!');
    expect(result.success).toBe(true);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalled();
    const storedArg = prisma.$executeRawUnsafe.mock.calls[0][1];
    expect(storedArg.startsWith('$2')).toBe(true);
    expect(result.user.CONTRASENA).toBeUndefined();
  });

  it('plaintext incorrect → reject', async () => {
    prisma.user.findFirst.mockResolvedValue({
      CODIGO: 'E1',
      CORREO_ELECTRONICO: 'a@b.com',
      CONTRASENA: 'PlainPass1!',
      DNI_NIE: '12345678A',
      ESTADO: 'ACTIVO',
      GRUPO: 'Empleados',
      AUTH_VERSION: 0,
    });
    const result = await service.login('a@b.com', 'WrongPass1!');
    expect(result.success).toBe(false);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('bcrypt correct → OK without upgrade write', async () => {
    const hash = await hashPassword('BcryptPass1!');
    prisma.user.findFirst.mockResolvedValue({
      CODIGO: 'E2',
      CORREO_ELECTRONICO: 'b@b.com',
      CONTRASENA: hash,
      DNI_NIE: 'X',
      ESTADO: 'ACTIVO',
      GRUPO: 'Manager',
      AUTH_VERSION: 3,
    });
    const result = await service.login('b@b.com', 'BcryptPass1!');
    expect(result.success).toBe(true);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.authRefreshSession.create).toHaveBeenCalled();
    expect(result.accessToken).toContain('jwt:access:3');
    const accessCall = jwt.sign.mock.calls.find(
      (call: any[]) => call[0]?.type === 'access',
    );
    const refreshCall = jwt.sign.mock.calls.find(
      (call: any[]) => call[0]?.type === 'refresh' && !call[0]?.impersonation,
    );
    expect(accessCall[1].expiresIn).toBe(process.env.JWT_EXPIRES_IN || '30m');
    expect(refreshCall[1].expiresIn).toBe(
      process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    );
  });

  it('bcrypt incorrect → reject', async () => {
    const hash = await hashPassword('BcryptPass1!');
    prisma.user.findFirst.mockResolvedValue({
      CODIGO: 'E2',
      CORREO_ELECTRONICO: 'b@b.com',
      CONTRASENA: hash,
      ESTADO: 'ACTIVO',
      GRUPO: 'Empleados',
      AUTH_VERSION: 1,
    });
    const result = await service.login('b@b.com', 'NopePass1!');
    expect(result.success).toBe(false);
  });

  it('DNI/NIE as password → reject even if matches DNI field', async () => {
    prisma.user.findFirst.mockResolvedValue({
      CODIGO: 'E3',
      CORREO_ELECTRONICO: 'c@b.com',
      CONTRASENA: 'RealPass1!',
      DNI_NIE: '12345678A',
      ESTADO: 'ACTIVO',
      GRUPO: 'Empleados',
      AUTH_VERSION: 0,
    });
    const result = await service.login('c@b.com', '12345678A');
    expect(result.success).toBe(false);
  });

  it('password migration stats counts bcrypt vs plaintext', async () => {
    const hash = await hashPassword('XyzAbcde1!');
    prisma.$queryRawUnsafe = jest
      .fn()
      .mockResolvedValue([
        { CONTRASENA: 'plain' },
        { CONTRASENA: hash },
        { CONTRASENA: 'other' },
      ]);
    const stats = await service.getPasswordMigrationStats();
    expect(stats.totalWithPassword).toBe(3);
    expect(stats.bcrypt).toBe(1);
    expect(stats.plaintextLegacy).toBe(2);
  });

  it('refresh acceptă sesiunea activă și refuză sesiunea revocată sau fără sid', async () => {
    prisma.user.findFirst.mockResolvedValue({
      CODIGO: 'E2',
      CORREO_ELECTRONICO: 'b@b.com',
      ESTADO: 'ACTIVO',
      GRUPO: 'Empleados',
      AUTH_VERSION: 3,
    });
    prisma.authRefreshSession.findUnique.mockResolvedValue({
      userCodigo: 'E2',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    jwt.verify.mockReturnValue({
      type: 'refresh',
      email: 'b@b.com',
      userId: 'E2',
      authVersion: 3,
      sid: 'sid-1',
    });
    const ok = await service.refreshToken('refresh-jwt');
    expect(ok.success).toBe(true);
    expect(ok.accessToken).toContain('jwt:access:3');

    prisma.authRefreshSession.findUnique.mockResolvedValue({
      userCodigo: 'E2',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const revoked = await service.refreshToken('refresh-jwt');
    expect(revoked.success).toBe(false);

    jwt.verify.mockReturnValue({
      type: 'refresh',
      email: 'b@b.com',
      userId: 'E2',
      authVersion: 3,
    });
    const legacy = await service.refreshToken('refresh-jwt');
    expect(legacy.success).toBe(false);
  });

  it('logout revocă sid-ul din refresh', async () => {
    jwt.verify.mockReturnValue({ type: 'refresh', sid: 'sid-9' });
    await service.revokePresentedRefreshToken('refresh-jwt');
    expect(prisma.authRefreshSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'sid-9' }),
      }),
    );
  });
});
