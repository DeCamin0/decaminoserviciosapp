import { Injectable } from '@nestjs/common';
import type { JwtSignOptions } from '@nestjs/jwt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import {
  hashPassword,
  isBcryptHash,
  verifyPassword,
} from '../utils/password.util';
import {
  createRefreshSession,
  decideRefreshSession,
  findRefreshSession,
  refreshTtlMs,
  revokeAllRefreshSessions,
  revokeRefreshSession,
} from './refresh-session';
import { writeActivityLog } from '../utils/activity-log-write';

/**
 * Auth Service — employee login with bcrypt + legacy plaintext auto-upgrade.
 * DNI/NIE is NEVER accepted as password.
 */
@Injectable()
export class AuthService {
  /** Sesiunea de impersonare rămâne mai scurtă decât refresh-ul obișnuit de 7 zile. */
  private static readonly IMPERSONATION_REFRESH = '2h';

  private accessExpires(): JwtSignOptions['expiresIn'] {
    const value = String(process.env.JWT_EXPIRES_IN || '30m').trim() || '30m';
    return value as JwtSignOptions['expiresIn'];
  }

  private refreshExpires(): JwtSignOptions['expiresIn'] {
    const value =
      String(process.env.JWT_REFRESH_EXPIRES_IN || '7d').trim() || '7d';
    return value as JwtSignOptions['expiresIn'];
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private mapRole(grupo: string): string {
    if (grupo === 'Manager' || grupo === 'Supervisor') return 'MANAGER';
    if (grupo === 'Developer') return 'DEVELOPER';
    if (grupo === 'Admin') return 'ADMIN';
    return 'EMPLEADOS';
  }

  private async bumpAuthAndSetPassword(
    codigo: string,
    passwordHash: string,
  ): Promise<number> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE DatosEmpleados
       SET \`Contraseña\` = ?, AUTH_VERSION = AUTH_VERSION + 1
       WHERE CODIGO = ?`,
      passwordHash,
      codigo,
    );
    const updated = await this.prisma.user.findUnique({
      where: { CODIGO: codigo },
      select: { AUTH_VERSION: true },
    });
    await revokeAllRefreshSessions(this.prisma, codigo);
    return updated?.AUTH_VERSION ?? 1;
  }

  private async issueSession(input: {
    email: string | null;
    userId: string;
    authVersion: number;
    impersonation?: boolean;
    impersonatedBy?: string | null;
  }): Promise<{ sid: string; refreshToken: string }> {
    const impersonation = input.impersonation === true;
    const ttlSpec = impersonation
      ? AuthService.IMPERSONATION_REFRESH
      : String(process.env.JWT_REFRESH_EXPIRES_IN || '7d');
    const fallbackMs = impersonation
      ? 2 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + refreshTtlMs(ttlSpec, fallbackMs));
    const sid = await createRefreshSession(this.prisma, {
      userCodigo: input.userId,
      expiresAt,
      impersonation,
      impersonatedBy: input.impersonatedBy ?? null,
    });
    const refreshToken = this.jwtService.sign(
      {
        email: input.email,
        userId: input.userId,
        authVersion: input.authVersion,
        type: 'refresh',
        sid,
        ...(impersonation
          ? { impersonation: true, impersonatedBy: input.impersonatedBy }
          : {}),
      },
      {
        expiresIn: impersonation
          ? AuthService.IMPERSONATION_REFRESH
          : this.refreshExpires(),
      },
    );
    return { sid, refreshToken };
  }

  private async recordAuth(input: {
    action: string;
    user?: string | null;
    email?: string | null;
    grupo?: string | null;
    ip?: string | null;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await writeActivityLog(this.prisma, {
      action: input.action,
      user: input.user,
      email: input.email,
      grupo: input.grupo,
      updateby: input.user,
      ip: input.ip,
      url: '/api/auth/login',
      details: input.details,
    });
  }

  async login(
    email: string,
    password: string,
    ip?: string | null,
  ): Promise<{
    success: boolean;
    user?: any;
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  }> {
    try {
      console.log('[AuthService] Login attempt for:', email);

      const normalizedEmail = email.trim().toLowerCase();
      const found = await this.prisma.user.findFirst({
        where: { CORREO_ELECTRONICO: normalizedEmail },
      });

      if (!found) {
        console.log('[AuthService] User not found (Prisma):', normalizedEmail);
        await this.recordAuth({
          action: 'login_failed',
          email: normalizedEmail,
          ip,
          details: { motivo: 'usuario_no_encontrado' },
        });
        return { success: false, error: 'Correo o contraseña incorrecta' };
      }

      const storedPassword = String(found.CONTRASENA || '').trim();
      const inputPassword = password.trim();

      if (!storedPassword) {
        console.log('[AuthService] Empty password for:', normalizedEmail);
        await this.recordAuth({
          action: 'login_failed',
          user: found.NOMBRE_APELLIDOS,
          email: normalizedEmail,
          grupo: found.GRUPO,
          ip,
          details: { codigo: found.CODIGO, motivo: 'sin_contraseña' },
        });
        return { success: false, error: 'Correo o contraseña incorrecta' };
      }

      const check = await verifyPassword(inputPassword, storedPassword);
      if (!check.ok) {
        console.log('[AuthService] Password mismatch for:', normalizedEmail);
        await this.recordAuth({
          action: 'login_failed',
          user: found.NOMBRE_APELLIDOS,
          email: normalizedEmail,
          grupo: found.GRUPO,
          ip,
          details: { codigo: found.CODIGO, motivo: 'contraseña_incorrecta' },
        });
        return { success: false, error: 'Correo o contraseña incorrecta' };
      }

      let authVersion = found.AUTH_VERSION ?? 0;

      if (check.needsUpgrade) {
        const newHash = await hashPassword(inputPassword);
        authVersion = await this.bumpAuthAndSetPassword(found.CODIGO, newHash);
        console.log(
          '[AuthService] Legacy plaintext upgraded to bcrypt for:',
          found.CODIGO,
        );
      }

      const estadoRaw = (found.ESTADO || '').toString().trim().toUpperCase();
      if (estadoRaw && estadoRaw !== 'ACTIVO') {
        console.log(
          '[AuthService] User inactive:',
          normalizedEmail,
          'Estado:',
          estadoRaw,
        );
        await this.recordAuth({
          action: 'login_failed',
          user: found.NOMBRE_APELLIDOS,
          email: normalizedEmail,
          grupo: found.GRUPO,
          ip,
          details: { codigo: found.CODIGO, motivo: 'usuario_inactivo' },
        });
        return { success: false, error: 'Usuario inactivo' };
      }

      const grupo = found.GRUPO || '';
      const role = this.mapRole(grupo);

      const userObj = {
        email: found.CORREO_ELECTRONICO,
        isManager:
          grupo === 'Manager' ||
          grupo === 'Supervisor' ||
          grupo === 'Developer',
        role,
        GRUPO: grupo,
        ...found,
        CONTRASENA: undefined,
      };
      delete (userObj as any).CONTRASENA;

      const session = await this.issueSession({
        email: found.CORREO_ELECTRONICO,
        userId: found.CODIGO,
        authVersion,
      });
      const payload = {
        email: found.CORREO_ELECTRONICO,
        userId: found.CODIGO,
        role,
        grupo,
        authVersion,
        type: 'access',
        sid: session.sid,
      };
      const accessToken = this.jwtService.sign(payload, {
        expiresIn: this.accessExpires(),
      });
      const refreshToken = session.refreshToken;

      console.log(
        '[AuthService] Login successful for:',
        normalizedEmail,
        'Role:',
        role,
      );
      await this.recordAuth({
        action: 'login',
        user: found.NOMBRE_APELLIDOS,
        email: normalizedEmail,
        grupo,
        ip,
        details: { codigo: found.CODIGO, role },
      });
      return {
        success: true,
        user: userObj,
        accessToken,
        refreshToken,
      };
    } catch (error: any) {
      console.error('[AuthService] Login error:', error);
      return {
        success: false,
        error: error.message || 'Error during login',
      };
    }
  }

  async findUserByCodigoPrisma(codigo: string) {
    try {
      const usePrisma = process.env.USE_PRISMA_AUTH === 'true';
      if (!usePrisma) return null;

      const user = await this.prisma.user.findUnique({
        where: { CODIGO: codigo },
      });
      return user || null;
    } catch (error) {
      console.error(
        '[AuthService] Prisma findUserByCodigoPrisma error:',
        error,
      );
      return null;
    }
  }

  /**
   * Issue tokens as target employee (support review). Does NOT require ACTIVO.
   * Caller must enforce permissions / scope / no nested impersonation.
   */
  async impersonate(
    actorUserId: string,
    targetCodigo: string,
  ): Promise<{
    success: boolean;
    user?: any;
    accessToken?: string;
    refreshToken?: string;
    impersonatedBy?: string;
    error?: string;
  }> {
    try {
      const found = await this.prisma.user.findUnique({
        where: { CODIGO: targetCodigo },
      });
      if (!found) {
        return { success: false, error: 'Empleado no encontrado' };
      }

      const grupo = found.GRUPO || '';
      const role = this.mapRole(grupo);
      const authVersion = found.AUTH_VERSION ?? 0;

      const userObj: any = {
        email: found.CORREO_ELECTRONICO,
        isManager:
          grupo === 'Manager' ||
          grupo === 'Supervisor' ||
          grupo === 'Developer',
        role,
        GRUPO: grupo,
        ...found,
        CONTRASENA: undefined,
        impersonation: true,
        impersonatedBy: actorUserId,
      };
      delete userObj.CONTRASENA;

      const session = await this.issueSession({
        email: found.CORREO_ELECTRONICO,
        userId: found.CODIGO,
        authVersion,
        impersonation: true,
        impersonatedBy: actorUserId,
      });
      const payload = {
        email: found.CORREO_ELECTRONICO,
        userId: found.CODIGO,
        role,
        grupo,
        authVersion,
        type: 'access',
        sid: session.sid,
        impersonation: true,
        impersonatedBy: actorUserId,
      };
      const accessToken = this.jwtService.sign(payload, {
        expiresIn: this.accessExpires(),
      });
      const refreshToken = session.refreshToken;

      console.log(
        `[AuthService] Impersonation: actor=${actorUserId} → target=${found.CODIGO} (${found.CORREO_ELECTRONICO})`,
      );
      await writeActivityLog(this.prisma, {
        action: 'impersonation_started',
        user: actorUserId,
        updateby: actorUserId,
        url: '/api/auth/impersonate',
        details: {
          actorCodigo: actorUserId,
          targetCodigo: found.CODIGO,
          targetNombre: found.NOMBRE_APELLIDOS,
        },
      });

      return {
        success: true,
        user: userObj,
        accessToken,
        refreshToken,
        impersonatedBy: actorUserId,
      };
    } catch (error: any) {
      console.error('[AuthService] Impersonate error:', error);
      return {
        success: false,
        error: error.message || 'Error during impersonation',
      };
    }
  }

  async refreshToken(refreshToken: string): Promise<{
    success: boolean;
    accessToken?: string;
    error?: string;
  }> {
    try {
      const decoded = this.jwtService.verify(refreshToken);

      if (decoded.type !== 'refresh') {
        console.log('[AuthService] Invalid token type for refresh');
        return { success: false, error: 'Invalid refresh token' };
      }

      const normalizedEmail = decoded.email?.toLowerCase();
      if (!normalizedEmail) {
        return { success: false, error: 'Invalid token payload' };
      }

      const found = await this.prisma.user.findFirst({
        where: { CORREO_ELECTRONICO: normalizedEmail },
      });

      if (!found) {
        console.log('[AuthService] User not found for refresh token');
        return { success: false, error: 'User not found' };
      }

      const isImpersonation =
        !!decoded.impersonation && !!decoded.impersonatedBy;
      const estadoRaw = (found.ESTADO || '').toString().trim().toUpperCase();
      // Impersonation may target INACTIVO for support review — allow refresh then.
      if (!isImpersonation && estadoRaw && estadoRaw !== 'ACTIVO') {
        console.log('[AuthService] User inactive for refresh');
        return { success: false, error: 'Usuario inactivo' };
      }

      const currentVersion = found.AUTH_VERSION ?? 0;
      if (
        typeof decoded.authVersion !== 'number' ||
        decoded.authVersion !== currentVersion
      ) {
        console.log('[AuthService] authVersion mismatch, refresh invalid');
        return {
          success: false,
          error: 'Token invalidated by password change',
        };
      }

      const session = await findRefreshSession(
        this.prisma,
        String(decoded.sid || ''),
      );
      const sessionDecision = decideRefreshSession({
        sid: decoded.sid,
        userId: found.CODIGO,
        session,
        now: new Date(),
      });
      if (sessionDecision.ok === false) {
        console.log(
          '[AuthService] Refresh session rejected:',
          sessionDecision.reason,
        );
        return { success: false, error: 'Invalid refresh token' };
      }

      const grupo = found.GRUPO || '';
      const role = this.mapRole(grupo);

      const payload: Record<string, unknown> = {
        email: found.CORREO_ELECTRONICO,
        userId: found.CODIGO,
        role,
        grupo,
        authVersion: currentVersion,
        type: 'access',
        sid: decoded.sid,
      };
      if (isImpersonation) {
        payload.impersonation = true;
        payload.impersonatedBy = decoded.impersonatedBy;
      }
      const newAccessToken = this.jwtService.sign(payload, {
        expiresIn: this.accessExpires(),
      });

      console.log(
        '[AuthService] Token refreshed successfully for:',
        normalizedEmail,
        isImpersonation ? '(impersonation)' : '',
      );
      return {
        success: true,
        accessToken: newAccessToken,
      };
    } catch (error: any) {
      console.error('[AuthService] Refresh token error:', error);
      if (error.name === 'TokenExpiredError') {
        return { success: false, error: 'Refresh token expired' };
      }
      if (error.name === 'JsonWebTokenError') {
        return { success: false, error: 'Invalid refresh token' };
      }
      return {
        success: false,
        error: error.message || 'Error refreshing token',
      };
    }
  }

  /**
   * Închide o singură sesiune. Token invalid sau deja închis: tot succes,
   * ca logout-ul din browser să nu depindă de starea cheii.
   */
  async revokePresentedRefreshToken(refreshToken: string): Promise<void> {
    const raw = String(refreshToken || '').trim();
    if (!raw) return;
    try {
      const decoded = this.jwtService.verify(raw, { ignoreExpiration: true });
      if (decoded?.type !== 'refresh' || typeof decoded.sid !== 'string')
        return;
      await revokeRefreshSession(this.prisma, decoded.sid);
    } catch (error: any) {
      console.log(
        '[AuthService] Logout revoke skipped:',
        error?.name || 'invalid',
      );
    }
  }

  /**
   * Counts users still on legacy plaintext vs bcrypt (no password values logged).
   */
  async getPasswordMigrationStats(): Promise<{
    totalWithPassword: number;
    bcrypt: number;
    plaintextLegacy: number;
  }> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ CONTRASENA: string | null }>
    >(
      `SELECT \`Contraseña\` AS CONTRASENA FROM DatosEmpleados
       WHERE \`Contraseña\` IS NOT NULL AND TRIM(\`Contraseña\`) <> ''`,
    );
    let bcryptCount = 0;
    let plaintext = 0;
    for (const row of rows) {
      if (isBcryptHash(row.CONTRASENA)) bcryptCount += 1;
      else plaintext += 1;
    }
    return {
      totalWithPassword: rows.length,
      bcrypt: bcryptCount,
      plaintextLegacy: plaintext,
    };
  }
}
