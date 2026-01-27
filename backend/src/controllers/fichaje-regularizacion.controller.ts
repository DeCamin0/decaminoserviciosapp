import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FichajeRegularizacionService } from '../services/fichaje-regularizacion.service';

@Controller('api/registros')
export class FichajeRegularizacionController {
  private readonly logger = new Logger(FichajeRegularizacionController.name);

  constructor(
    private readonly regularizacionService: FichajeRegularizacionService,
  ) {}

  /**
   * POST /api/registros/confirmar-jornada
   * Confirmă jornada după Salida (no_extra sau worked_more)
   */
  @Post('confirmar-jornada')
  @UseGuards(JwtAuthGuard)
  async confirmarJornada(
    @Body()
    body: {
      employee_codigo: string;
      fecha: string; // YYYY-MM-DD
      decision: 'no_extra' | 'worked_more';
      reason?: string; // Opțional: 'punch_error' pentru eroare de fichaje
    },
    @CurrentUser() user: any,
  ) {
    try {
      this.logger.log(
        `📝 Confirm jornada request - employee: ${body.employee_codigo}, fecha: ${body.fecha}, decision: ${body.decision}, reason: ${body.reason || 'none'}`,
      );

      if (!body.employee_codigo || !body.fecha || !body.decision) {
        throw new BadRequestException(
          'employee_codigo, fecha and decision are required',
        );
      }

      if (!['no_extra', 'worked_more'].includes(body.decision)) {
        throw new BadRequestException(
          'decision must be "no_extra" or "worked_more"',
        );
      }

      // Extrage IP și user agent din request (dacă e disponibil)
      const ip_address = (user as any).ip || null;
      const user_agent = (user as any).userAgent || null;

      const result = await this.regularizacionService.confirmJornada({
        employee_codigo: body.employee_codigo,
        fecha: body.fecha,
        decision: body.decision,
        reason: body.reason,
        created_by: user?.userId || user?.CODIGO || 'unknown',
        ip_address,
        user_agent,
      });

      return {
        success: true,
        regularizacion: result,
        message:
          body.decision === 'no_extra'
            ? 'Jornada confirmada correctamente.'
            : 'Jornada enviada para revisión.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error confirming jornada:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error confirming jornada: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/registros/regularizaciones/pendientes
   * Obține regularizări pending pentru admin
   */
  @Get('regularizaciones/pendientes')
  @UseGuards(JwtAuthGuard)
  async getPendientes() {
    try {
      this.logger.log('📝 Get pending regularizaciones request');

      const pendientes = await this.regularizacionService.getPendingReviews();

      return {
        success: true,
        pendientes,
        count: pendientes.length,
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting pendientes:', error);
      throw new BadRequestException(
        `Error getting pendientes: ${error.message}`,
      );
    }
  }

  /**
   * POST /api/registros/regularizaciones/:id/aprobar
   * Aprobă regularizare (admin)
   */
  @Post('regularizaciones/:id/aprobar')
  @UseGuards(JwtAuthGuard)
  async aprobarRegularizacion(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    try {
      const idNum = parseInt(id, 10);
      if (isNaN(idNum)) {
        throw new BadRequestException('Invalid ID');
      }

      this.logger.log(
        `📝 Approve regularizacion request - ID: ${idNum}, reviewed_by: ${user?.userId || user?.CODIGO}`,
      );

      const result = await this.regularizacionService.approveRegularizacion(
        idNum,
        user?.userId || user?.CODIGO || 'unknown',
      );

      return {
        success: true,
        regularizacion: result,
        message: 'Regularizacion aprobada correctamente.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error approving regularizacion:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error approving regularizacion: ${error.message}`,
      );
    }
  }

  /**
   * POST /api/registros/regularizaciones/:id/rechazar
   * Respinge regularizare (admin)
   */
  @Post('regularizaciones/:id/rechazar')
  @UseGuards(JwtAuthGuard)
  async rechazarRegularizacion(
    @Param('id') id: string,
    @Body() body: { notes?: string; create_ausencia?: boolean },
    @CurrentUser() user: any,
  ) {
    try {
      const idNum = parseInt(id, 10);
      if (isNaN(idNum)) {
        throw new BadRequestException('Invalid ID');
      }

      this.logger.log(
        `📝 Reject regularizacion request - ID: ${idNum}, reviewed_by: ${user?.userId || user?.CODIGO}, create_ausencia: ${body.create_ausencia || false}`,
      );

      const result = await this.regularizacionService.rejectRegularizacion(
        idNum,
        user?.userId || user?.CODIGO || 'unknown',
        body.notes,
        body.create_ausencia || false,
      );

      return {
        success: true,
        regularizacion: result,
        message: 'Regularizacion rechazada correctamente.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error rejecting regularizacion:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error rejecting regularizacion: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/registros/check-confirmation/:codigo/:fecha
   * Verifică dacă trebuie să se afișeze confirmare
   */
  @Throttle({
    short: { ttl: 10000, limit: 100 }, // 100 request-uri pe 10 secunde
    medium: { ttl: 60000, limit: 500 }, // 500 request-uri pe minut
  })
  @Get('check-confirmation/:codigo/:fecha')
  @UseGuards(JwtAuthGuard)
  async checkConfirmation(
    @Param('codigo') codigo: string,
    @Param('fecha') fecha: string,
  ) {
    try {
      this.logger.log(
        `📝 Check confirmation request - codigo: ${codigo}, fecha: ${fecha}`,
      );

      const result = await this.regularizacionService.checkNeedsConfirmation(
        codigo,
        fecha,
      );

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error checking confirmation:', error);
      throw new BadRequestException(
        `Error checking confirmation: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/registros/regularizaciones/confirmed
   * Obține regularizări confirmed pentru admin
   */
  @Get('regularizaciones/confirmed')
  @UseGuards(JwtAuthGuard)
  async getConfirmed() {
    try {
      this.logger.log('📝 Get confirmed regularizaciones request');

      const confirmed =
        await this.regularizacionService.getConfirmedRegularizaciones(50);

      return {
        success: true,
        regularizaciones: confirmed,
        count: confirmed.length,
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting confirmed regularizaciones:', error);
      throw new BadRequestException(
        `Error getting confirmed regularizaciones: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/registros/regularizaciones/all
   * Obține toate regularizările (pentru debugging/admin)
   */
  @Get('regularizaciones/all')
  @UseGuards(JwtAuthGuard)
  async getAllRegularizaciones() {
    try {
      this.logger.log('📝 Get all regularizaciones request');

      const all = await this.regularizacionService.getAllRegularizaciones(50);

      return {
        success: true,
        regularizaciones: all,
        count: all.length,
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting all regularizaciones:', error);
      throw new BadRequestException(
        `Error getting all regularizaciones: ${error.message}`,
      );
    }
  }

  /**
   * POST /api/registros/request-regularizacion
   * Supervisor solicită regularizare pentru un angajat (creează NEEDS_REVIEW)
   */
  @Post('request-regularizacion')
  @UseGuards(JwtAuthGuard)
  async requestRegularizacion(
    @Body()
    body: {
      employee_codigo: string;
      fecha: string; // YYYY-MM-DD
    },
    @CurrentUser() user: any,
  ) {
    try {
      this.logger.log(
        `📝 Request regularizacion from supervisor - employee: ${body.employee_codigo}, fecha: ${body.fecha}, supervisor: ${user?.userId || user?.CODIGO}`,
      );

      if (!body.employee_codigo || !body.fecha) {
        throw new BadRequestException('employee_codigo and fecha are required');
      }

      // Verifică dacă utilizatorul este manager/supervisor
      if (!user?.isManager) {
        throw new BadRequestException(
          'Solo supervisores y managers pueden solicitar regularizaciones',
        );
      }

      const supervisor_codigo = user?.userId || user?.CODIGO || 'unknown';
      const supervisor_nombre =
        user?.nombre || user?.['NOMBRE / APELLIDOS'] || supervisor_codigo;

      const result =
        await this.regularizacionService.requestRegularizacionFromSupervisor(
          body.employee_codigo,
          body.fecha,
          supervisor_codigo,
          supervisor_nombre,
        );

      return {
        success: true,
        regularizacion: result,
        message:
          'Regularización solicitada. El empleado recibirá una notificación para confirmar.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error requesting regularizacion:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error requesting regularizacion: ${error.message}`,
      );
    }
  }

  /**
   * GET /api/registros/no-punch
   * Listă zile programate cu 0 fichajes pentru angajatul curent
   */
  @Get('no-punch')
  @UseGuards(JwtAuthGuard)
  async getNoPunchDays(
    @CurrentUser() user: any,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    try {
      const employee_codigo = user?.CODIGO || user?.userId;
      if (!employee_codigo) {
        throw new BadRequestException('User CODIGO not found');
      }

      // Obține start și end din query params (default: luna curentă)
      const today = new Date();
      const start_date =
        start ||
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const end_date =
        end ||
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

      this.logger.log(
        `📝 Get no-punch days request - employee: ${employee_codigo}, start: ${start_date}, end: ${end_date}`,
      );

      const noPunchDays =
        await this.regularizacionService.detectNoPunchWorkdays(
          employee_codigo,
          start_date,
          end_date,
        );

      return {
        success: true,
        no_punch_days: noPunchDays,
        count: noPunchDays.length,
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting no-punch days:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error getting no-punch days: ${error.message}`,
      );
    }
  }

  /**
   * POST /api/registros/no-punch/declare
   * Declară motiv pentru zi fără fichajes
   */
  @Post('no-punch/declare')
  @UseGuards(JwtAuthGuard)
  async declareNoPunch(
    @Body()
    body: {
      workday_date: string; // YYYY-MM-DD
      reason_code:
        | 'OLVIDO_FICHAR'
        | 'VACACIONES'
        | 'BAJA'
        | 'PERMISO'
        | 'AUSENCIA_INJUSTIFICADA'
        | 'OTRO';
      notes?: string;
      employee_codigo?: string; // Opțional: pentru admin care regularizează pentru alt angajat
    },
    @CurrentUser() user: any,
  ) {
    try {
      // Dacă este specificat employee_codigo în body (pentru admin), îl folosim
      // Altfel, folosim CODIGO din context (pentru angajat care regularizează pentru el însuși)
      const employee_codigo =
        body.employee_codigo || user?.CODIGO || user?.userId;
      if (!employee_codigo) {
        throw new BadRequestException('User CODIGO not found');
      }

      if (!body.workday_date || !body.reason_code) {
        throw new BadRequestException(
          'workday_date and reason_code are required',
        );
      }

      // NOTĂ: VACACIONES, BAJA și PERMISO nu ar trebui să ajungă aici (sunt verificate înainte de alertaFichaj)
      // Dar le păstrăm pentru compatibilitate
      const validReasons = [
        'OLVIDO_FICHAR',
        'AUSENCIA_INJUSTIFICADA',
        'OTRO',
        'VACACIONES',
        'BAJA',
        'PERMISO',
      ];
      if (!validReasons.includes(body.reason_code)) {
        throw new BadRequestException(
          `reason_code must be one of: ${validReasons.join(', ')}`,
        );
      }

      this.logger.log(
        `📝 Declare NO_PUNCH request - employee: ${employee_codigo}, fecha: ${body.workday_date}, reason: ${body.reason_code}`,
      );

      const ip_address = (user as any).ip || null;
      const user_agent = (user as any).userAgent || null;

      const result = await this.regularizacionService.declareNoPunch({
        employee_codigo,
        workday_date: body.workday_date,
        reason_code: body.reason_code,
        notes: body.notes,
        created_by: employee_codigo,
        ip_address,
        user_agent,
      });

      return {
        success: true,
        regularizacion: result,
        message:
          result.status === 'CONFIRMED'
            ? 'Motivo registrado correctamente.'
            : 'Motivo enviado para revisión.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error declaring NO_PUNCH:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error declaring NO_PUNCH: ${error.message}`,
      );
    }
  }
}
