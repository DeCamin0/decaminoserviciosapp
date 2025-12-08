import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

/**
 * Auth Service
 * 
 * Implements real authentication logic using direct database queries
 * Generates JWT tokens for authenticated users
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Login user
   * 
   * @param email User email
   * @param password User password (D.N.I. / NIE)
   * @returns User object if successful, error otherwise
   */
  async login(email: string, password: string): Promise<{
    success: boolean;
    user?: any;
    accessToken?: string;
    error?: string;
  }> {
    try {
      console.log('[AuthService] Login attempt for:', email);
      
      // Normalize email (lowercase, trim)
      const normalizedEmail = email.trim().toLowerCase();
      
      // Query database for user by email
      // Use raw query to handle case-insensitive search and special characters in column names
      const found = await this.userRepository
        .createQueryBuilder('user')
        .where('LOWER(`CORREO ELECTRONICO`) = LOWER(:email)', { email: normalizedEmail })
        .getOne();

      if (!found) {
        console.log('[AuthService] User not found:', normalizedEmail);
        return { success: false, error: 'Correo o contraseña incorrecta' };
      }

      // Verify password - try both D.N.I. / NIE and Contraseña fields
      const dniPassword = String(found['D.N.I. / NIE'] || '').trim();
      const contraseñaPassword = String(found['Contraseña'] || '').trim();
      const inputPassword = password.trim();
      
      console.log('[AuthService] Password check:', {
        dni: dniPassword ? '***' : 'empty',
        contraseña: contraseñaPassword ? '***' : 'empty',
        inputLength: inputPassword.length
      });
      
      // Check if password matches D.N.I. / NIE or Contraseña
      if (dniPassword !== inputPassword && contraseñaPassword !== inputPassword) {
        console.log('[AuthService] Password mismatch for:', normalizedEmail);
        return { success: false, error: 'Correo o contraseña incorrecta' };
      }

      // Validate active status
      const estadoRaw = (found.ESTADO || '').toString().trim().toUpperCase();
      if (estadoRaw && estadoRaw !== 'ACTIVO') {
        console.log('[AuthService] User inactive:', normalizedEmail, 'Estado:', estadoRaw);
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
        email: found['CORREO ELECTRONICO'],
        isManager: grupo === 'Manager' || grupo === 'Supervisor' || grupo === 'Developer',
        role,
        GRUPO: grupo,
        ...found,
      };

      // Generate JWT token
      const payload = {
        email: found['CORREO ELECTRONICO'],
        userId: found.CODIGO,
        role,
        grupo,
      };
      const accessToken = this.jwtService.sign(payload);

      console.log('[AuthService] Login successful for:', normalizedEmail, 'Role:', role);
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
}
