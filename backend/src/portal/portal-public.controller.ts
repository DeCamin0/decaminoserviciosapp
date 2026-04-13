import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

/** Datos mínimos para la pantalla pública del portal (sin JWT). */
@Controller('api/portal/public')
export class PortalPublicController {
  private readonly logger = new Logger(PortalPublicController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get('comunidad/:token')
  @Throttle({ short: { limit: 120, ttl: 60000 } })
  async comunidadPorToken(@Param('token') token: string) {
    const t = String(token || '').trim();
    if (t.length < 16) {
      throw new NotFoundException();
    }
    const c = await this.prisma.clientes.findFirst({
      where: { portal_invite_token: t },
      select: { NOMBRE_O_RAZON_SOCIAL: true },
    });
    if (!c) {
      this.logger.debug(`[portal-public] token no encontrado`);
      throw new NotFoundException();
    }
    return {
      success: true,
      data: { nombre: c.NOMBRE_O_RAZON_SOCIAL ?? null },
    };
  }
}
