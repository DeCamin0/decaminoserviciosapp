import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { HorasPermitidasService } from '../services/horas-permitidas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmpleadoGrupoScopeService } from '../services/empleado-grupo-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  isImplicitAdmin,
  matrixModuleEnabled,
} from '../services/empleados-operation-access';
import { writeActivityLog } from '../utils/activity-log-write';

@Controller('api/horas-permitidas')
@UseGuards(JwtAuthGuard)
export class HorasPermitidasController {
  private readonly logger = new Logger(HorasPermitidasController.name);

  constructor(
    private readonly horasPermitidasService: HorasPermitidasService,
    private readonly empleadoGrupoScopeService: EmpleadoGrupoScopeService,
    private readonly prisma: PrismaService,
  ) {}

  private async assertFicharAdmin(user: any) {
    const grupo = String(user?.grupo || user?.GRUPO || '').trim();
    const role = String(user?.role || user?.ROLE || '').trim();
    if (isImplicitAdmin({ grupo, role })) return;
    const allowed = await matrixModuleEnabled(
      this.prisma,
      grupo,
      'fichar-admin',
    );
    if (!allowed) {
      throw new ForbiddenException('Sin permiso para horas permitidas');
    }
  }

  private scopePayload(user: any) {
    return {
      userId: user?.userId,
      role: user?.role,
      grupo: user?.grupo,
    };
  }

  @Get()
  async getAll(@CurrentUser() user: any) {
    try {
      await this.assertFicharAdmin(user);
      this.logger.log('📝 Get all horas permitidas request');

      const allowedGrupos =
        await this.empleadoGrupoScopeService.listGruposRestrictivosForPayload(
          this.scopePayload(user),
        );
      const result = await this.horasPermitidasService.getAll(allowedGrupos);

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error getting horas permitidas:', error);
      throw error;
    }
  }

  @Post()
  async create(
    @CurrentUser() user: any,
    @Body()
    body: {
      grupo: string;
      horasAnuales: number;
      horasMensuales: number;
    },
  ) {
    try {
      await this.assertFicharAdmin(user);
      this.logger.log(
        `📝 Create horas permitidas request - grupo: ${body.grupo || 'missing'}`,
      );

      const allowedGrupos =
        await this.empleadoGrupoScopeService.listGruposRestrictivosForPayload(
          this.scopePayload(user),
        );

      const result = await this.horasPermitidasService.create(
        {
          grupo: body.grupo,
          horasAnuales: body.horasAnuales,
          horasMensuales: body.horasMensuales,
        },
        allowedGrupos,
      );
      await writeActivityLog(this.prisma, {
        action: 'horas_permitidas_created',
        user: user?.userId || user?.CODIGO || null,
        grupo: user?.grupo || user?.GRUPO || null,
        updateby: user?.userId || user?.CODIGO || null,
        url: '/api/horas-permitidas',
        details: {
          grupo: body.grupo,
          horasAnuales: body.horasAnuales,
          horasMensuales: body.horasMensuales,
        },
      });

      return {
        status: 'success',
        message: 'Nuevo grupo agregado correctamente',
        data: result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error creating horas permitidas:', error);
      throw error;
    }
  }

  @Put(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: { grupo: string; horasAnuales: number; horasMensuales: number },
  ) {
    try {
      await this.assertFicharAdmin(user);
      this.logger.log(
        `📝 Update horas permitidas request - id: ${id}, grupo: ${body.grupo || 'missing'}`,
      );

      const allowedGrupos =
        await this.empleadoGrupoScopeService.listGruposRestrictivosForPayload(
          this.scopePayload(user),
        );

      const result = await this.horasPermitidasService.update(
        id,
        {
          grupo: body.grupo,
          horasAnuales: body.horasAnuales,
          horasMensuales: body.horasMensuales,
        },
        allowedGrupos,
      );
      await writeActivityLog(this.prisma, {
        action: 'horas_permitidas_updated',
        user: user?.userId || user?.CODIGO || null,
        grupo: user?.grupo || user?.GRUPO || null,
        updateby: user?.userId || user?.CODIGO || null,
        url: '/api/horas-permitidas',
        details: {
          id,
          grupo: body.grupo,
          horasAnuales: body.horasAnuales,
          horasMensuales: body.horasMensuales,
        },
      });

      return {
        status: 'success',
        message: 'Grupo actualizado correctamente',
        data: result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating horas permitidas:', error);
      throw error;
    }
  }

  @Delete(':id')
  async delete(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    try {
      await this.assertFicharAdmin(user);
      this.logger.log(`📝 Delete horas permitidas request - id: ${id}`);

      const allowedGrupos =
        await this.empleadoGrupoScopeService.listGruposRestrictivosForPayload(
          this.scopePayload(user),
        );

      const result = await this.horasPermitidasService.delete(
        id,
        allowedGrupos,
      );
      await writeActivityLog(this.prisma, {
        action: 'horas_permitidas_deleted',
        user: user?.userId || user?.CODIGO || null,
        grupo: user?.grupo || user?.GRUPO || null,
        updateby: user?.userId || user?.CODIGO || null,
        url: '/api/horas-permitidas',
        details: { id },
      });

      return {
        status: 'success',
        message: 'Grupo eliminado correctamente',
        data: result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error deleting horas permitidas:', error);
      throw error;
    }
  }
}
