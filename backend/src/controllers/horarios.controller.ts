import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HorariosService } from '../services/horarios.service';

@Controller('api/horarios')
@UseGuards(JwtAuthGuard)
export class HorariosController {
  private readonly logger = new Logger(HorariosController.name);

  constructor(private readonly horariosService: HorariosService) {}

  /**
   * POST endpoint pentru toate acțiunile (create, get, update, delete)
   * POST /api/horarios
   * Body: { action: "create" | "get" | "update" | "delete", payload: {...} }
   */
  @Post()
  async handleHorarioAction(@Body() body: any) {
    try {
      const action = body?.action || body?.body?.action;

      this.logger.log(`📝 Horario action request: ${action}`);

      switch (action) {
        case 'create': {
          const result = await this.horariosService.createHorario(body);
          return result;
        }

        case 'get': {
          const horarios = await this.horariosService.getAllHorarios();
          return horarios;
        }

        case 'update': {
          const result = await this.horariosService.updateHorario(body);
          return result;
        }

        case 'delete': {
          const payload = body?.body?.payload || body?.payload || body;
          const id = payload?.id;
          const centroNombre = payload?.centroNombre;

          if (!id) {
            throw new BadRequestException(
              'Se requiere el ID del horario para eliminar.',
            );
          }

          if (!centroNombre) {
            throw new BadRequestException(
              'Se requiere el centroNombre del horario para eliminar.',
            );
          }

          const result = await this.horariosService.deleteHorario(
            Number(id),
            centroNombre,
          );
          return result;
        }

        default:
          throw new BadRequestException(
            `Acción no válida: ${action}. Acciones permitidas: create, get, update, delete.`,
          );
      }
    } catch (error: any) {
      this.logger.error(
        'Error in HorariosController.handleHorarioAction:',
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al procesar la acción: ${error.message}`,
      );
    }
  }

  /**
   * GET endpoint pentru listarea tuturor horarios (compatibilitate REST)
   * GET /api/horarios
   */
  @Get()
  async getAllHorarios() {
    try {
      this.logger.log('📝 Get all horarios request (GET)');
      const horarios = await this.horariosService.getAllHorarios();
      return horarios;
    } catch (error: any) {
      this.logger.error('Error in HorariosController.getAllHorarios:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener los horarios: ${error.message}`,
      );
    }
  }
}
