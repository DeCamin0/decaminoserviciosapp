import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export const PRL_MATRIX_SHARE_TYP = 'prl_matrix_share';

@Injectable()
export class PrlMatrixShareGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const enabled =
      String(
        this.configService.get<string>('PRL_MATRIX_SHARE_ENABLED') || '',
      ).toLowerCase() === 'true';
    if (!enabled) {
      throw new ForbiddenException('Acceso matrix share no disponible');
    }

    const req = context.switchToHttp().getRequest();
    const auth = String(req.headers?.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) {
      throw new UnauthorizedException('Token requerido');
    }

    try {
      const payload = this.jwtService.verify(token) as {
        typ?: string;
        displayName?: string;
        scope?: string;
      };
      if (
        payload?.typ !== PRL_MATRIX_SHARE_TYP ||
        payload?.scope !== 'prl_matrix_readonly'
      ) {
        throw new UnauthorizedException('Token inválido');
      }
      req.prlMatrixShare = {
        displayName:
          payload.displayName ||
          this.configService.get<string>('PRL_MATRIX_SHARE_DISPLAY_NAME') ||
          'Invitado',
        scope: 'prl_matrix_readonly',
      };
      return true;
    } catch (e: any) {
      if (
        e instanceof UnauthorizedException ||
        e instanceof ForbiddenException
      ) {
        throw e;
      }
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
