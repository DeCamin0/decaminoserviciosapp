import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { PortalAuthUserPayload } from './portal.types';

export interface PortalJwtPayload {
  typ?: string;
  contacto_id?: number;
  cliente_id?: number;
}

@Injectable()
export class PortalJwtStrategy extends PassportStrategy(
  Strategy,
  'portal-jwt',
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.portalSecret'),
    });
  }

  async validate(payload: PortalJwtPayload): Promise<PortalAuthUserPayload> {
    if (
      payload.typ !== 'portal' ||
      typeof payload.contacto_id !== 'number' ||
      typeof payload.cliente_id !== 'number'
    ) {
      throw new UnauthorizedException('Token de portal inválido');
    }

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

    return {
      contacto_id: contacto.id,
      cliente_id: contacto.cliente_id,
      email: contacto.email,
      nombre: contacto.nombre,
      clienteNombre: contacto.cliente.NOMBRE_O_RAZON_SOCIAL,
      nif: contacto.cliente.NIF,
    };
  }
}
