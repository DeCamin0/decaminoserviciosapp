import {
  Controller,
  Get,
  Post,
  UseGuards,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DocumentoObligationService } from '../services/documento-obligation.service';

@Controller('api/documentos-obligation')
@UseGuards(JwtAuthGuard)
export class DocumentoObligationController {
  private readonly logger = new Logger(DocumentoObligationController.name);

  constructor(private readonly obligationService: DocumentoObligationService) {}

  private resolveCodigo(user: any): string {
    const codigo =
      user?.CODIGO || user?.codigo || user?.userId || user?.empleadoId || '';
    return String(codigo).trim();
  }

  /** GET /api/documentos-obligation/me */
  @Get('me')
  @Throttle({
    short: { ttl: 10000, limit: 120 },
    medium: { ttl: 60000, limit: 600 },
  })
  async getMe(@CurrentUser() user: any) {
    const codigo = this.resolveCodigo(user);
    if (!codigo) {
      throw new BadRequestException('No se pudo identificar al empleado');
    }
    const state = await this.obligationService.getMyState(codigo);
    return { success: true, state };
  }

  /** POST /api/documentos-obligation/shown */
  @Post('shown')
  @Throttle({ short: { ttl: 10000, limit: 30 } })
  async recordShown(@CurrentUser() user: any) {
    const codigo = this.resolveCodigo(user);
    if (!codigo) {
      throw new BadRequestException('No se pudo identificar al empleado');
    }
    const state = await this.obligationService.recordShown(codigo);
    return { success: true, state };
  }

  /** POST /api/documentos-obligation/snooze */
  @Post('snooze')
  @Throttle({ short: { ttl: 10000, limit: 20 } })
  async recordSnooze(@CurrentUser() user: any) {
    const codigo = this.resolveCodigo(user);
    if (!codigo) {
      throw new BadRequestException('No se pudo identificar al empleado');
    }
    const state = await this.obligationService.recordSnooze(codigo);
    return { success: true, state };
  }

  /** POST /api/documentos-obligation/resolve */
  @Post('resolve')
  @Throttle({ short: { ttl: 10000, limit: 30 } })
  async recordResolved(@CurrentUser() user: any) {
    const codigo = this.resolveCodigo(user);
    if (!codigo) {
      throw new BadRequestException('No se pudo identificar al empleado');
    }
    const state = await this.obligationService.recordResolved(codigo);
    return { success: true, state };
  }

  /** GET /api/documentos-obligation/admin — evidență (manager/dev) */
  @Get('admin')
  @Throttle({ short: { ttl: 10000, limit: 30 } })
  async listAdmin(@CurrentUser() user: any) {
    try {
      const grupo = user?.GRUPO || user?.grupo || user?.role || '';
      const items = await this.obligationService.listForAdmin(grupo);
      return { success: true, items };
    } catch (error: any) {
      this.logger.error('Error listAdmin obligation:', error);
      if (error instanceof ForbiddenException) throw error;
      throw new BadRequestException(
        error?.message || 'Error al listar evidencias',
      );
    }
  }
}
