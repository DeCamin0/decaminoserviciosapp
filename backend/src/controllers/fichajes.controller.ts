import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FichajesService } from '../services/fichajes.service';
import { EmpleadoGrupoScopeService } from '../services/empleado-grupo-scope.service';
import { FichajeReminderCronService } from '../services/fichaje-reminder-cron.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertFichajeWrite,
  loadEmpleadoModuleFlags,
  resolvePunchReadCodigos,
  resolvePunchWriteCodigos,
  toEmpleadoActor,
} from '../services/empleados-operation-access';
import {
  assertManualReminderPermission,
  ManualReminderLimiter,
  reminderAudienceCodigos,
  resolveManualReminderMode,
  wantsRealReminderSend,
} from '../services/fichaje-reminder-manual';

@Controller('api/registros')
export class FichajesController {
  private readonly logger = new Logger(FichajesController.name);
  private readonly manualReminderLimiter = new ManualReminderLimiter();

  constructor(
    private readonly fichajesService: FichajesService,
    private readonly empleadoGrupoScopeService: EmpleadoGrupoScopeService,
    private readonly fichajeReminderCronService: FichajeReminderCronService,
    private readonly prisma: PrismaService,
  ) {}

  private scopePayload(user: any) {
    return {
      userId: user?.userId,
      role: user?.role,
      grupo: user?.grupo,
    };
  }

  private async punchContext(user: any) {
    const actor = toEmpleadoActor(user);
    const flags = await loadEmpleadoModuleFlags(user?.grupo, (keys) =>
      this.prisma.permissions.findMany({
        where: { grupo_module: { in: keys } },
        select: { grupo_module: true, permitted: true },
      }),
    );
    const payload = this.scopePayload(user);
    const bypass = this.empleadoGrupoScopeService.bypassesScope(payload);
    const scope =
      await this.empleadoGrupoScopeService.resolveScopeFilter(payload);
    return {
      actor,
      flags,
      bypass,
      scope,
      listScopeCodigos: () =>
        this.empleadoGrupoScopeService.listAllowedCodigosForPayload(payload),
    };
  }

  private async readCodigos(user: any) {
    return resolvePunchReadCodigos(await this.punchContext(user));
  }

  private async writeCodigos(user: any) {
    return resolvePunchWriteCodigos(await this.punchContext(user));
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getRegistros(
    @CurrentUser() user: any,
    @Query('CODIGO') codigo: string,
    @Query('MES') mes: string,
  ) {
    try {
      this.logger.log(
        `📝 Get registros request - codigo: ${codigo || 'missing'}, mes: ${mes || 'missing'}`,
      );

      const allowed = await this.readCodigos(user);
      this.empleadoGrupoScopeService.assertCodigoEnAmbito(allowed, codigo);

      const registros = await this.fichajesService.getRegistros(codigo, mes);

      return registros;
    } catch (error: any) {
      this.logger.error('❌ Error getting registros:', error);
      throw error;
    }
  }

  @Get('ultimo')
  @UseGuards(JwtAuthGuard)
  async getUltimoRegistro(
    @CurrentUser() user: any,
    @Query('codigo') codigo: string,
  ) {
    try {
      this.logger.log(
        `📝 Get ultimo registro request - codigo: ${codigo || 'missing'}`,
      );

      const allowed = await this.readCodigos(user);
      this.empleadoGrupoScopeService.assertCodigoEnAmbito(allowed, codigo);

      const ultimoRegistro =
        await this.fichajesService.getUltimoRegistro(codigo);

      // Returnează întotdeauna un obiect JSON valid, chiar dacă nu există registru
      return ultimoRegistro || null;
    } catch (error: any) {
      this.logger.error('❌ Error getting ultimo registro:', error);
      throw error;
    }
  }

  @Get('empleados')
  @UseGuards(JwtAuthGuard)
  async getRegistrosEmpleados(
    @CurrentUser() user: any,
    @Query('mes') mes: string,
  ) {
    try {
      this.logger.log(
        `📝 Get registros empleados request - mes: ${mes || 'missing'}`,
      );

      const allowed = await this.readCodigos(user);
      const registros = await this.fichajesService.getRegistrosEmpleados(
        mes,
        allowed,
      );

      return registros;
    } catch (error: any) {
      this.logger.error('❌ Error getting registros empleados:', error);
      throw error;
    }
  }

  @Get('periodo')
  @UseGuards(JwtAuthGuard)
  async getRegistrosPeriodo(
    @CurrentUser() user: any,
    @Query('fecha_inicio') fechaInicio: string,
    @Query('fecha_fin') fechaFin: string,
    @Query('codigo') codigo?: string,
  ) {
    try {
      this.logger.log(
        `📝 Get registros periodo request - fecha_inicio: ${fechaInicio || 'missing'}, fecha_fin: ${fechaFin || 'missing'}, codigo: ${codigo || 'all'}`,
      );

      const allowed = await this.readCodigos(user);
      if (codigo?.trim()) {
        this.empleadoGrupoScopeService.assertCodigoEnAmbito(allowed, codigo);
      }

      const registros = await this.fichajesService.getRegistrosPeriodo(
        fechaInicio,
        fechaFin,
        codigo,
        allowed,
      );

      return registros;
    } catch (error: any) {
      this.logger.error('❌ Error getting registros periodo:', error);
      throw error;
    }
  }

  @Get('all')
  @UseGuards(JwtAuthGuard)
  async getAllFichajes(@CurrentUser() user: any) {
    try {
      this.logger.log('📝 Get all fichajes request (for statistics)');

      const allowed = await this.readCodigos(user);
      const fichajes = await this.fichajesService.getAllFichajes(allowed);

      return fichajes;
    } catch (error: any) {
      this.logger.error('❌ Error getting all fichajes:', error);
      throw error;
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async addFichaje(@Body() body: any, @CurrentUser() user: any) {
    try {
      this.logger.log(
        `📝 Add fichaje request - ID: ${body.id || 'missing'}, CODIGO: ${body.codigo || 'missing'}, TIPO: ${body.tipo || 'missing'}`,
      );

      const context = await this.punchContext(user);
      assertFichajeWrite(context.actor, context.flags, body.codigo);
      const allowed = await resolvePunchWriteCodigos(context);

      const result = await this.fichajesService.addFichaje(
        {
          id: body.id,
          codigo: body.codigo,
          nombre: body.nombre || body.empleado, // Acceptă ambele: nombre sau empleado
          email: body.email,
          tipo: body.tipo,
          hora: body.hora,
          address: body.address,
          modificatDe: body.modificatDe,
          data: body.data,
          motivo: body.motivo || '',
        },
        allowed,
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error adding fichaje:', error);
      throw error;
    }
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  async updateFichaje(@Body() body: any, @CurrentUser() user: any) {
    try {
      this.logger.log(
        `📝 Update fichaje request - ID: ${body.id || 'missing'}, CODIGO: ${body.codigo || 'missing'}, TIPO: ${body.tipo || 'missing'}`,
      );

      if (!body.id) {
        throw new BadRequestException('ID is required for update');
      }

      const context = await this.punchContext(user);
      assertFichajeWrite(context.actor, context.flags, body.codigo);
      const allowed = await resolvePunchWriteCodigos(context);

      const result = await this.fichajesService.updateFichaje(
        body.id,
        {
          codigo: body.codigo,
          nombre: body.empleado || body.nombre,
          email: body.email,
          tipo: body.tipo,
          hora: body.hora,
          address: body.address,
          modificatDe: body.modificatDe,
          data: body.data,
          duration: body.duration,
        },
        allowed,
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error updating fichaje:', error);
      throw error;
    }
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  async deleteFichaje(@Body() body: any, @CurrentUser() user: any) {
    try {
      this.logger.log(
        `📝 Delete fichaje request - ID: ${body.id || 'missing'}`,
      );

      if (!body.id) {
        throw new BadRequestException('ID is required for delete');
      }

      const allowed = await this.writeCodigos(user);

      const result = await this.fichajesService.deleteFichaje(body.id, allowed);

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error deleting fichaje:', error);
      throw error;
    }
  }

  /**
   * Rulare manuală a reminderului de pontaj.
   * dryRun lipsește sau este true: doar previzualizare.
   * dryRun=false: trimitere, doar dacă reminderul este pornit pe server.
   * Fereastra de minute rămâne în configurația serverului.
   */
  @Post('fichaje-reminder/test-trigger')
  @UseGuards(JwtAuthGuard)
  async triggerFichajeReminder(
    @CurrentUser() user: any,
    @Query('dryRun') dryRun?: string,
  ) {
    const actor = toEmpleadoActor(user);
    const flags = await loadEmpleadoModuleFlags(user?.grupo, (keys) =>
      this.prisma.permissions.findMany({
        where: { grupo_module: { in: keys } },
        select: { grupo_module: true, permitted: true },
      }),
    );
    assertManualReminderPermission(actor, flags);

    const requestedReal = wantsRealReminderSend(dryRun);
    const mode = resolveManualReminderMode({
      requestedReal,
      enabled: this.fichajeReminderCronService.isEnabled(),
      envForcesDryRun: this.fichajeReminderCronService.isEnvDryRun(),
    });

    const payload = this.scopePayload(user);
    const bypass = this.empleadoGrupoScopeService.bypassesScope(payload);
    const scope =
      await this.empleadoGrupoScopeService.resolveScopeFilter(payload);
    const allowedCodigos = reminderAudienceCodigos(
      bypass,
      !!scope?.grupos?.length,
      bypass || !scope?.grupos?.length
        ? null
        : await this.empleadoGrupoScopeService.listAllowedCodigosForPayload(
            payload,
          ),
    );

    this.manualReminderLimiter.start(
      actor.userId || '',
      requestedReal,
      Date.now(),
      this.fichajeReminderCronService.retryCooldownMs(),
    );
    let armRealCooldown = false;
    try {
      this.logger.log(
        `🧪 Manual trigger: fichaje reminder dryRun=${mode.dryRun} user=${actor.userId}`,
      );
      const result = await this.fichajeReminderCronService.runReminders({
        dryRun: mode.dryRun,
        allowedCodigos,
        manual: true,
      });
      armRealCooldown = requestedReal && result.dryRun === false;
      return {
        ok: true,
        enabled: this.fichajeReminderCronService.isEnabled(),
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error triggering fichaje reminder:', error);
      if (error instanceof HttpException) throw error;
      throw new BadRequestException(
        `Error al trigger reminder fichaje: ${error.message}`,
      );
    } finally {
      this.manualReminderLimiter.finish(
        actor.userId || '',
        armRealCooldown,
        Date.now(),
      );
    }
  }
}
