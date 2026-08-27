import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Get,
  UseGuards,
  Req,
  Headers,
  Param,
  Logger,
} from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';
import { AuthService } from '../services/auth.service';
import { PasswordResetService } from '../services/password-reset.service';
import { EmpleadoGrupoScopeService } from '../services/empleado-grupo-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ForgotPasswordRateLimitError } from '../utils/password-reset.util';

@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
    private readonly empleadoGrupoScopeService: EmpleadoGrupoScopeService,
    private readonly prisma: PrismaService,
  ) {}

  private clientIp(req: any): string {
    const xf = req?.headers?.['x-forwarded-for'];
    if (typeof xf === 'string' && xf.trim()) {
      return xf.split(',')[0].trim();
    }
    return (
      req?.headers?.['x-real-ip'] ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      'unknown'
    );
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    try {
      console.log('[AuthController] Login request received:', {
        email: loginDto.email,
        hasPassword: !!loginDto.password,
      });

      const result = await this.authService.login(
        loginDto.email,
        loginDto.password,
      );

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            message: result.error || 'Invalid credentials',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      return {
        success: true,
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: error.message || 'Login failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('forgot-password')
  async forgotPassword(
    @Body() body: { email?: string },
    @Req() req: any,
    @Headers('user-agent') userAgent?: string,
  ) {
    try {
      const result = await this.passwordResetService.requestPasswordReset({
        email: body?.email,
        ip: this.clientIp(req),
        userAgent: userAgent || null,
      });
      return { success: true, message: result.message };
    } catch (error: any) {
      if (error instanceof ForgotPasswordRateLimitError) {
        throw new HttpException(
          { success: false, message: error.message },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return {
        success: true,
        message: this.passwordResetService.getGenericMessage(),
      };
    }
  }

  @Post('reset-password')
  async resetPassword(
    @Body()
    body: {
      token?: string;
      newPassword?: string;
      confirmPassword?: string;
    },
    @Req() req: any,
  ) {
    try {
      const result = await this.passwordResetService.resetPasswordWithToken({
        token: body?.token,
        newPassword: body?.newPassword,
        confirmPassword: body?.confirmPassword,
        ip: this.clientIp(req),
      });
      return result;
    } catch (error: any) {
      if (error instanceof ForgotPasswordRateLimitError) {
        throw new HttpException(
          { success: false, message: error.message },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const status =
        typeof error?.status === 'number'
          ? error.status
          : HttpStatus.BAD_REQUEST;
      throw new HttpException(
        {
          success: false,
          message: error?.message || 'No se pudo restablecer la contraseña',
        },
        status,
      );
    }
  }

  /**
   * POST /api/auth/impersonate/:codigo
   * Manager/Developer: enter the app as another employee (support review).
   */
  @Post('impersonate/:codigo')
  @UseGuards(JwtAuthGuard)
  async impersonate(@CurrentUser() user: any, @Param('codigo') codigo: string) {
    try {
      if (!codigo) {
        throw new HttpException(
          { success: false, message: 'CODIGO es obligatorio' },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (user?.impersonation || user?.impersonatedBy) {
        throw new HttpException(
          {
            success: false,
            message:
              'Ya estás en una sesión de impersonación. Vuelve a tu cuenta primero.',
          },
          HttpStatus.FORBIDDEN,
        );
      }

      const role = String(user?.role || '').toUpperCase();
      const grupo = String(user?.grupo || user?.GRUPO || '');
      const isManager =
        !!user?.isManager ||
        role === 'MANAGER' ||
        role === 'ADMIN' ||
        role === 'DEVELOPER' ||
        grupo === 'Manager' ||
        grupo === 'Supervisor' ||
        grupo === 'Developer' ||
        grupo === 'Admin';
      const isDeveloper = role === 'DEVELOPER' || grupo === 'Developer';

      const actorCodigo = user?.userId || user?.CODIGO;
      if (!actorCodigo) {
        throw new HttpException(
          { success: false, message: 'Sesión inválida' },
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (codigo === actorCodigo) {
        throw new HttpException(
          {
            success: false,
            message: 'No puedes entrar como tu propia cuenta',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!isManager && !isDeveloper) {
        throw new HttpException(
          {
            success: false,
            message: 'No tienes permiso para entrar como otro empleado',
          },
          HttpStatus.FORBIDDEN,
        );
      }

      const target = await this.prisma.user.findUnique({
        where: { CODIGO: codigo },
        select: { CODIGO: true, GRUPO: true },
      });
      if (!target) {
        throw new HttpException(
          { success: false, message: 'Empleado no encontrado' },
          HttpStatus.NOT_FOUND,
        );
      }

      const scRs = await this.empleadoGrupoScopeService.resolveScopeFilter({
        userId: actorCodigo,
        role: user?.role,
        grupo: user?.grupo || user?.GRUPO,
      });
      this.empleadoGrupoScopeService.assertEmpleadoAccessible(
        scRs,
        codigo,
        target.GRUPO,
      );

      const result = await this.authService.impersonate(actorCodigo, codigo);
      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            message: result.error || 'No se pudo iniciar impersonación',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`🔐 Impersonation started: ${actorCodigo} → ${codigo}`);

      return {
        success: true,
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        impersonatedBy: result.impersonatedBy,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Impersonate error:', error);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Impersonation failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    try {
      console.log('[AuthController] Refresh token request received');

      if (!body.refreshToken) {
        throw new HttpException(
          {
            success: false,
            message: 'Refresh token is required',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.authService.refreshToken(body.refreshToken);

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            message: result.error || 'Invalid refresh token',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      return {
        success: true,
        accessToken: result.accessToken,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: error.message || 'Refresh failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: any) {
    return {
      success: true,
      user,
    };
  }

  /** Metrics: plaintext legacy vs bcrypt (no password values). Managers/dev only. */
  @Get('password-migration-stats')
  @UseGuards(JwtAuthGuard)
  async passwordMigrationStats(@CurrentUser() user: any) {
    const role = String(user?.role || '').toUpperCase();
    const grupo = String(user?.grupo || '').toLowerCase();
    const allowed =
      role === 'MANAGER' ||
      role === 'DEVELOPER' ||
      role === 'ADMIN' ||
      grupo === 'developer' ||
      grupo === 'manager' ||
      grupo === 'supervisor' ||
      grupo === 'admin';
    if (!allowed) {
      throw new HttpException(
        { success: false, message: 'Forbidden' },
        HttpStatus.FORBIDDEN,
      );
    }
    const stats = await this.authService.getPasswordMigrationStats();
    return { success: true, ...stats };
  }
}
