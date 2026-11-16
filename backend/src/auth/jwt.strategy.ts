import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decideJwtAccess } from '../services/jwt-access-policy';
import { extractJwtToken } from '../services/jwt-query-token';
import {
  decideRefreshSession,
  findRefreshSession,
} from '../services/refresh-session';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: (req: {
        headers?: { authorization?: string | string[] };
        query?: { token?: unknown };
        method?: string;
        path?: string;
        url?: string;
      }) =>
        extractJwtToken({
          authorizationHeader: req?.headers?.authorization,
          queryToken: req?.query?.token,
          method: req?.method,
          path: req?.path || req?.url,
        }),
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

    let lookupFailed = false;
    let user: { AUTH_VERSION: number | null; ESTADO: string | null } | null =
      null;
    try {
      user = await this.prisma.user.findUnique({
        where: { CODIGO: payload.userId },
        select: { AUTH_VERSION: true, ESTADO: true },
      });
    } catch (error: any) {
      lookupFailed = true;
      console.warn(
        '[JwtStrategy] Error validating authVersion:',
        error?.message,
      );
    }

    const decision = decideJwtAccess({
      lookupFailed,
      userFound: !!user,
      tokenAuthVersion: payload.authVersion,
      storedAuthVersion: user?.AUTH_VERSION ?? 0,
      estado: user?.ESTADO,
      impersonation: payload.impersonation === true,
    });
    if (decision.ok === false) {
      if (decision.reason === 'version-mismatch') {
        throw new UnauthorizedException(
          'Token invalidado: la contraseña ha sido cambiada. Por favor, inicia sesión nuevamente.',
        );
      }
      if (decision.reason === 'inactive') {
        throw new UnauthorizedException('Usuario inactivo');
      }
      if (decision.reason === 'missing-user') {
        throw new UnauthorizedException(
          'Token invalidado: el usuario ya no existe.',
        );
      }
      throw new UnauthorizedException('No se ha podido verificar la sesión.');
    }

    let sessionLookupFailed = false;
    let session = null;
    try {
      if (typeof payload.sid === 'string' && payload.sid.trim() !== '') {
        session = await findRefreshSession(this.prisma, payload.sid);
      }
    } catch (error: any) {
      sessionLookupFailed = true;
      console.warn(
        '[JwtStrategy] Error validating refresh session:',
        error?.message,
      );
    }
    if (sessionLookupFailed) {
      throw new UnauthorizedException('No se ha podido verificar la sesión.');
    }
    const sessionDecision = decideRefreshSession({
      sid: payload.sid,
      userId: payload.userId,
      session,
      now: new Date(),
    });
    if (sessionDecision.ok === false) {
      throw new UnauthorizedException(
        'Token invalidado: inicia sesión nuevamente.',
      );
    }

    const result: Record<string, unknown> = {
      email: payload.email,
      userId: payload.userId,
      role: payload.role,
      grupo: payload.grupo,
      isManager:
        payload.role === 'MANAGER' ||
        payload.role === 'DEVELOPER' ||
        payload.role === 'ADMIN' ||
        payload.grupo === 'Manager' ||
        payload.grupo === 'Supervisor' ||
        payload.grupo === 'Developer' ||
        payload.grupo === 'Admin',
    };
    if (payload.impersonation && payload.impersonatedBy) {
      result.impersonation = true;
      result.impersonatedBy = payload.impersonatedBy;
    }
    return result;
  }
}
