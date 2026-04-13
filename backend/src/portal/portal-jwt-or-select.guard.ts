import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { PortalAuthUserPayload } from './portal.types';

type ReqWithUser = Request & { user?: PortalAuthUserPayload };

/**
 * Acepta JWT `portal` (sesión en una comunidad) o `portal-select` (tras OTP
 * gestores con varias comunidades) solo para rutas que no requieren `cliente_id`
 * concreto — p. ej. documentación general de empresa.
 */
@Injectable()
export class PortalJwtOrSelectGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ReqWithUser>();
    const h = req.headers.authorization;
    if (!h || !String(h).startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }
    const token = String(h).slice(7).trim();
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwtService.verifyAsync<Record<string, unknown>>(
        token,
        {
          secret: this.configService.getOrThrow<string>('jwt.portalSecret'),
        },
      );
    } catch {
      throw new UnauthorizedException('Token inválido o caducado');
    }

    if (payload.typ === 'portal-select') {
      const ids = payload.contacto_ids;
      if (
        !Array.isArray(ids) ||
        ids.length === 0 ||
        !ids.every((x) => typeof x === 'number' && Number.isFinite(x))
      ) {
        throw new UnauthorizedException('Token de selección inválido');
      }
      return true;
    }

    if (
      payload.typ === 'portal' &&
      typeof payload.contacto_id === 'number' &&
      typeof payload.cliente_id === 'number'
    ) {
      const contacto = await this.prisma.clienteContacto.findFirst({
        where: {
          id: payload.contacto_id,
          cliente_id: payload.cliente_id,
          acceso_portal: true,
          estado: 'activo',
        },
        include: {
          cliente: {
            select: {
              id: true,
              NIF: true,
              NOMBRE_O_RAZON_SOCIAL: true,
              ESTADO: true,
            },
          },
        },
      });
      if (!contacto?.cliente) {
        throw new UnauthorizedException('Contacto no autorizado');
      }
      req.user = {
        contacto_id: contacto.id,
        cliente_id: contacto.cliente_id,
        email: contacto.email,
        nombre: contacto.nombre,
        clienteNombre: contacto.cliente.NOMBRE_O_RAZON_SOCIAL,
        nif: contacto.cliente.NIF,
      };
      return true;
    }

    throw new UnauthorizedException();
  }
}
