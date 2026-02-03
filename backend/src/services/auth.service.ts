import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Auth Service
 *
 * Implements real authentication logic using direct database queries
 * Generates JWT tokens for authenticated users
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Login user
   *
   * @param email User email
   * @param password User password (D.N.I. / NIE)
   * @returns User object if successful, error otherwise
   */
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

      // Prisma lookup by email (case-insensitive)
      const found = await this.prisma.user.findFirst({
        where: {
          CORREO_ELECTRONICO: normalizedEmail,
        },
      });

      if (!found) {
        console.log('[AuthService] User not found (Prisma):', normalizedEmail);
        return { success: false, error: 'Correo o contraseña incorrecta' };
      }

      // Verify password - try both D.N.I. / NIE and Contraseña fields
      const dniPassword = String(found.DNI_NIE || '').trim();
      const contraseñaPassword = String(found.CONTRASENA || '').trim();
      const inputPassword = password.trim();

      console.log('[AuthService] Password check:', {
        dni: dniPassword ? '***' : 'empty',
        contraseña: contraseñaPassword ? '***' : 'empty',
        inputLength: inputPassword.length,
      });

      // Check if password matches D.N.I. / NIE or Contraseña
      if (
        dniPassword !== inputPassword &&
        contraseñaPassword !== inputPassword
      ) {
        console.log('[AuthService] Password mismatch for:', normalizedEmail);
        return { success: false, error: 'Correo o contraseña incorrecta' };
      }

      // Validate active status
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

      // Detect role from GRUPO
      const grupo = found.GRUPO || '';
      let role = 'EMPLEADOS'; // default
      if (grupo === 'Manager' || grupo === 'Supervisor') {
        role = 'MANAGER';
      } else if (grupo === 'Developer') {
        role = 'DEVELOPER';
      } else if (grupo === 'Admin') {
        role = 'ADMIN';
      }

      // Create user object (same format as frontend expects)
      const userObj = {
        email: found.CORREO_ELECTRONICO,
        isManager:
          grupo === 'Manager' ||
          grupo === 'Supervisor' ||
          grupo === 'Developer',
        role,
        GRUPO: grupo,
        ...found,
      };

      // Calculează un hash simplu al parolei pentru a invalida token-urile când se schimbă parola
      // Folosim primul caracter, ultimul caracter și lungimea pentru a crea un hash unic
      const passwordHash = this.getPasswordHash(
        contraseñaPassword || dniPassword,
      );

      // Generate JWT access token (30 minutes)
      const payload = {
        email: found.CORREO_ELECTRONICO,
        userId: found.CODIGO,
        role,
        grupo,
        passwordHash, // Hash pentru a invalida token-urile când se schimbă parola
        type: 'access', // Mark as access token
      };
      const accessToken = this.jwtService.sign(payload, {
        expiresIn: '30m', // 30 minutes
      });

      // Generate JWT refresh token (7 days)
      const refreshPayload = {
        email: found.CORREO_ELECTRONICO,
        userId: found.CODIGO,
        passwordHash, // Hash pentru a invalida token-urile când se schimbă parola
        type: 'refresh', // Mark as refresh token
      };
      const refreshToken = this.jwtService.sign(refreshPayload, {
        expiresIn: '7d', // 7 days
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
        accessToken, // JWT access token (30 minutes)
        refreshToken, // JWT refresh token (7 days)
      };
    } catch (error: any) {
      console.error('[AuthService] Login error:', error);
      return {
        success: false,
        error: error.message || 'Error during login',
      };
    }
  }

  /**
   * Prisma-based lookup by CODIGO (parallel to TypeORM, behind flag)
   */
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
   * Refresh access token using refresh token
   *
   * @param refreshToken Refresh token string
   * @returns New access token if successful, error otherwise
   */
  async refreshToken(refreshToken: string): Promise<{
    success: boolean;
    accessToken?: string;
    error?: string;
  }> {
    try {
      // Verify refresh token
      const decoded = this.jwtService.verify(refreshToken);

      // Check if it's a refresh token
      if (decoded.type !== 'refresh') {
        console.log('[AuthService] Invalid token type for refresh');
        return { success: false, error: 'Invalid refresh token' };
      }

      // Find user by email
      const normalizedEmail = decoded.email?.toLowerCase();
      if (!normalizedEmail) {
        return { success: false, error: 'Invalid token payload' };
      }

      const found = await this.prisma.user.findFirst({
        where: {
          CORREO_ELECTRONICO: normalizedEmail,
        },
      });

      if (!found) {
        console.log('[AuthService] User not found for refresh token');
        return { success: false, error: 'User not found' };
      }

      // Validate active status
      const estadoRaw = (found.ESTADO || '').toString().trim().toUpperCase();
      if (estadoRaw && estadoRaw !== 'ACTIVO') {
        console.log('[AuthService] User inactive for refresh');
        return { success: false, error: 'Usuario inactivo' };
      }

      // Verify password hash hasn't changed (password change invalidates tokens)
      const dniPassword = String(found.DNI_NIE || '').trim();
      const contraseñaPassword = String(found.CONTRASENA || '').trim();
      const currentPasswordHash = this.getPasswordHash(
        contraseñaPassword || dniPassword,
      );

      if (decoded.passwordHash !== currentPasswordHash) {
        console.log('[AuthService] Password changed, refresh token invalid');
        return {
          success: false,
          error: 'Token invalidated by password change',
        };
      }

      // Detect role from GRUPO
      const grupo = found.GRUPO || '';
      let role = 'EMPLEADOS'; // default
      if (grupo === 'Manager' || grupo === 'Supervisor') {
        role = 'MANAGER';
      } else if (grupo === 'Developer') {
        role = 'DEVELOPER';
      } else if (grupo === 'Admin') {
        role = 'ADMIN';
      }

      // Generate new access token
      const payload = {
        email: found.CORREO_ELECTRONICO,
        userId: found.CODIGO,
        role,
        grupo,
        passwordHash: currentPasswordHash,
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
   * Calculează un hash simplu al parolei pentru a invalida token-urile când se schimbă parola
   * Folosim primul caracter, ultimul caracter și lungimea
   */
  private getPasswordHash(password: string): string {
    if (!password || password.length === 0) return '';
    const firstChar = password[0] || '';
    const lastChar = password[password.length - 1] || '';
    const length = password.length;
    // Creează un hash simplu dar unic
    return `${firstChar}${lastChar}${length}`.substring(0, 10);
  }
}
