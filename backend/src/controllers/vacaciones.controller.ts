import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { VacacionesService } from '../services/vacaciones.service';

@Controller('api/vacaciones')
@UseGuards(JwtAuthGuard)
export class VacacionesController {
  private readonly logger = new Logger(VacacionesController.name);

  constructor(private readonly vacacionesService: VacacionesService) {}

  /**
   * GET /api/vacaciones/saldo
   * Obtiene el saldo de vacaciones y asuntos propios del usuario autenticado
   */
  @Get('saldo')
  async getSaldo(@CurrentUser() user: any) {
    try {
      const codigo = user?.CODIGO || user?.codigo;
      if (!codigo) {
        throw new BadRequestException('Usuario no autenticado o sin código');
      }

      this.logger.log(`📊 Get saldo request - codigo: ${codigo}`);

      const saldo = await this.vacacionesService.calcularSaldo(codigo);

      return {
        success: true,
        codigo,
        ...saldo,
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting saldo:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener saldo: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/vacaciones/saldo/:empleadoId
   * Obtiene el saldo de vacaciones y asuntos propios de un empleado específico
   * Solo para administradores
   */
  @Get('saldo/:empleadoId')
  async getSaldoEmpleado(
    @Param('empleadoId') empleadoId: string,
    @CurrentUser() user: any,
  ) {
    try {
      // Verificar si el usuario es administrador
      // Por ahora, permitimos a cualquier usuario autenticado
      // TODO: Añadir verificación de permisos de administrador si es necesario

      if (!empleadoId || empleadoId.trim() === '') {
        throw new BadRequestException('Código de empleado no válido');
      }

      this.logger.log(
        `📊 Get saldo empleado request - empleadoId: ${empleadoId}, requested by: ${user?.CODIGO || user?.codigo}`,
      );

      const saldo = await this.vacacionesService.calcularSaldo(
        empleadoId.trim(),
      );

      return {
        success: true,
        codigo: empleadoId.trim(),
        ...saldo,
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting saldo empleado:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener saldo del empleado: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/vacaciones/estadisticas
   * Obtiene estadísticas de vacaciones y asuntos propios para todos los empleados
   * Solo para administradores/gestores
   */
  @Get('estadisticas')
  async getEstadisticas(@CurrentUser() user: any) {
    try {
      this.logger.log(
        `📊 Get estadísticas request - requested by: ${user?.CODIGO || user?.codigo}`,
      );

      const estadisticas =
        await this.vacacionesService.obtenerEstadisticasTodos();

      return {
        success: true,
        estadisticas,
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting estadísticas:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener estadísticas: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/vacaciones/estadisticas/export-excel
   * Exporta estadísticas de vacaciones y asuntos propios a Excel
   */
  @Get('estadisticas/export-excel')
  async exportEstadisticasExcel(@Res() res: any, @CurrentUser() user: any) {
    try {
      this.logger.log(
        `📊 Export estadísticas Excel request - requested by: ${user?.CODIGO || user?.codigo}`,
      );
      const buffer = await this.vacacionesService.exportEstadisticasExcel();
      
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=Estadisticas_Solicitudes_${new Date().toISOString().split('T')[0]}.xlsx`,
        'Content-Length': buffer.length,
      });
      
      res.send(buffer);
    } catch (error: any) {
      this.logger.error('❌ Error exporting estadísticas Excel:', error);
      throw new BadRequestException(
        `Error al exportar Excel: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/vacaciones/estadisticas/export-pdf
   * Exporta estadísticas de vacaciones y asuntos propios a PDF
   */
  @Get('estadisticas/export-pdf')
  async exportEstadisticasPDF(@Res() res: any, @CurrentUser() user: any) {
    try {
      this.logger.log(
        `📊 Export estadísticas PDF request - requested by: ${user?.CODIGO || user?.codigo}`,
      );
      const buffer = await this.vacacionesService.exportEstadisticasPDF();
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=Estadisticas_Solicitudes_${new Date().toISOString().split('T')[0]}.pdf`,
        'Content-Length': buffer.length,
      });
      
      res.send(buffer);
    } catch (error: any) {
      this.logger.error('❌ Error exporting estadísticas PDF:', error);
      throw new BadRequestException(
        `Error al exportar PDF: ${error.message}`,
      );
    }
  }

  /**
   * PUT /api/vacaciones/restantes-ano-anterior/:empleadoId
   * Actualiza las vacaciones restantes del año anterior para un empleado
   */
  @Put('restantes-ano-anterior/:empleadoId')
  async updateRestantesAnoAnterior(
    @Param('empleadoId') empleadoId: string,
    @Body() body: { restantes_ano_anterior: number },
    @CurrentUser() user: any,
  ) {
    try {
      if (!empleadoId || empleadoId.trim() === '') {
        throw new BadRequestException('Código de empleado no válido');
      }

      const restantes = body.restantes_ano_anterior;
      if (restantes === undefined || restantes === null) {
        throw new BadRequestException('restantes_ano_anterior es requerido');
      }

      if (typeof restantes !== 'number' || restantes < 0) {
        throw new BadRequestException(
          'restantes_ano_anterior debe ser un número mayor o igual a 0',
        );
      }

      this.logger.log(
        `📝 Update restantes año anterior - empleadoId: ${empleadoId}, restantes: ${restantes}, requested by: ${user?.CODIGO || user?.codigo}`,
      );

      await this.vacacionesService.updateRestantesAnoAnterior(
        empleadoId.trim(),
        restantes,
      );

      return {
        success: true,
        codigo: empleadoId.trim(),
        restantes_ano_anterior: restantes,
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating restantes año anterior:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar restantes año anterior: ${error.message}`,
      );
    }
  }
}

