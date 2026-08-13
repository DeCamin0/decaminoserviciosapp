import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: any) {
    if (!payload || !payload.email) {
      throw new UnauthorizedException('Invalid token');
    }

    // New tokens carry authVersion; old passwordHash fingerprint is obsolete.
    if (typeof payload.authVersion !== 'number') {
      throw new UnauthorizedException(
        'Token invalidado: inicia sesión nuevamente.',
      );
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { CODIGO: payload.userId },
        select: { AUTH_VERSION: true },
      });

      if (user && (user.AUTH_VERSION ?? 0) !== payload.authVersion) {
        throw new UnauthorizedException(
          'Token invalidado: la contraseña ha sido cambiada. Por favor, inicia sesión nuevamente.',
        );
      }
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      console.warn(
        '[JwtStrategy] Error validating authVersion:',
        error.message,
      );
    }

    return {
      email: payload.email,
      userId: payload.userId,
      role: payload.role,
      grupo: payload.grupo,
    };
  }
}
