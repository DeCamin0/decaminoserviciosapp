import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import {
  hashPassword,
  isBcryptHash,
  verifyPassword,
} from '../utils/password.util';

/**
 * Auth Service — employee login with bcrypt + legacy plaintext auto-upgrade.
 * DNI/NIE is NEVER accepted as password.
 */
@Injectable()
export class AuthService {
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
    return updated?.AUTH_VERSION ?? 1;
  }

  async login(
    email: string,
    password: string,
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
        return { success: false, error: 'Correo o contraseña incorrecta' };
      }

      const storedPassword = String(found.CONTRASENA || '').trim();
      const inputPassword = password.trim();

      if (!storedPassword) {
        console.log('[AuthService] Empty password for:', normalizedEmail);
        return { success: false, error: 'Correo o contraseña incorrecta' };
      }

      const check = await verifyPassword(inputPassword, storedPassword);
      if (!check.ok) {
        console.log('[AuthService] Password mismatch for:', normalizedEmail);
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

      const payload = {
        email: found.CORREO_ELECTRONICO,
        userId: found.CODIGO,
        role,
        grupo,
        authVersion,
        type: 'access',
      };
      const accessToken = this.jwtService.sign(payload, {
        expiresIn: '30m',
      });

      const refreshPayload = {
        email: found.CORREO_ELECTRONICO,
        userId: found.CODIGO,
        authVersion,
        type: 'refresh',
      };
      const refreshToken = this.jwtService.sign(refreshPayload, {
        expiresIn: '7d',
      });

      console.log(
        '[AuthService] Login successful for:',
        normalizedEmail,
        'Role:',
        role,
      );
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

      const estadoRaw = (found.ESTADO || '').toString().trim().toUpperCase();
      if (estadoRaw && estadoRaw !== 'ACTIVO') {
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

      const grupo = found.GRUPO || '';
      const role = this.mapRole(grupo);

      const payload = {
        email: found.CORREO_ELECTRONICO,
        userId: found.CODIGO,
        role,
        grupo,
        authVersion: currentVersion,
        type: 'access',
      };
      const newAccessToken = this.jwtService.sign(payload, {
        expiresIn: '30m',
      });

      console.log(
        '[AuthService] Token refreshed successfully for:',
        normalizedEmail,
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
