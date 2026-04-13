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
} from '@nestjs/common';
import { HorasPermitidasService } from '../services/horas-permitidas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmpleadoGrupoScopeService } from '../services/empleado-grupo-scope.service';

@Controller('api/horas-permitidas')
@UseGuards(JwtAuthGuard)
export class HorasPermitidasController {
  private readonly logger = new Logger(HorasPermitidasController.name);

  constructor(
    private readonly horasPermitidasService: HorasPermitidasService,
    private readonly empleadoGrupoScopeService: EmpleadoGrupoScopeService,
  ) {}

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
      this.logger.log(`📝 Delete horas permitidas request - id: ${id}`);

      const allowedGrupos =
        await this.empleadoGrupoScopeService.listGruposRestrictivosForPayload(
          this.scopePayload(user),
        );

      const result = await this.horasPermitidasService.delete(
        id,
        allowedGrupos,
      );

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
