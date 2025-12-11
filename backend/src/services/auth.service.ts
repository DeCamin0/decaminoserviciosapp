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

      // Generate JWT token
      const payload = {
        email: found.CORREO_ELECTRONICO,
        userId: found.CODIGO,
        role,
        grupo,
      };
      const accessToken = this.jwtService.sign(payload);

      console.log(
        '[AuthService] Login successful for:',
        normalizedEmail,
        'Role:',
        role,
      );
      return {
        success: true,
        user: userObj,
        accessToken, // JWT token
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
}
