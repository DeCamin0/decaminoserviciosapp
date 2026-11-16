import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import {
  GruposService,
  CreateGrupoDto,
  UpdateGrupoDto,
} from '../services/grupos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmpleadoGrupoScopeService } from '../services/empleado-grupo-scope.service';
import type { JwtUserLike } from '../services/empleado-grupo-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  isImplicitAdmin,
  matrixModuleEnabled,
} from '../services/empleados-operation-access';

@Controller('api/grupos')
@UseGuards(JwtAuthGuard)
export class GruposController {
  private readonly logger = new Logger(GruposController.name);

  constructor(
    private readonly gruposService: GruposService,
    private readonly empleadoGrupoScopeService: EmpleadoGrupoScopeService,
    private readonly prisma: PrismaService,
  ) {}

  private async canReadEmployeeCatalog(user: any): Promise<boolean> {
    const grupo = String(user?.grupo || user?.GRUPO || '').trim();
    const role = String(user?.role || user?.ROLE || '').trim();
    if (isImplicitAdmin({ grupo, role })) return true;
    const empleados = await matrixModuleEnabled(
      this.prisma,
      grupo,
      'empleados',
    );
    const admin = await matrixModuleEnabled(this.prisma, grupo, 'admin');
    return empleados || admin;
  }

  private async assertCatalog(user: any, tipo?: string) {
    const grupo = String(user?.grupo || user?.GRUPO || '').trim();
    const role = String(user?.role || user?.ROLE || '').trim();
    if (tipo === 'servicio_presupuesto') {
      if (
        isImplicitAdmin({ grupo, role }) ||
        (await matrixModuleEnabled(this.prisma, grupo, 'presupuestos-informes'))
      ) {
        return;
      }
      throw new ForbiddenException('Sin permiso para tipos de servicio');
    }
    if (!(await this.canReadEmployeeCatalog(user))) {
      throw new ForbiddenException('Sin permiso para grupos de empleados');
    }
  }

  private payloadFromRequestUser(user: any): JwtUserLike {
    return {
      userId: String(user?.userId ?? user?.CODIGO ?? '').trim(),
      role: user?.role,
      grupo: user?.grupo ?? user?.GRUPO,
    };
  }

  /** Lista nombres GRUPO para dropdowns: con ámbito RRHH solo grupos permitidos. */
  @Get()
  async getGrupos(@CurrentUser() user: any) {
    try {
      this.logger.log('📝 Get grupos request (nombres only)');

      const all = await this.gruposService.getGrupos();
      const allowed =
        await this.empleadoGrupoScopeService.listGruposRestrictivosForPayload(
          this.payloadFromRequestUser(user),
        );
      if (!allowed?.length) {
        return all;
      }
      const filtered = all.filter((g) =>
        this.empleadoGrupoScopeService.grupoMatches(g, allowed),
      );
      if (filtered.length > 0) {
        return filtered;
      }
      return [...allowed].sort((a, b) => a.localeCompare(b, 'es'));
    } catch (error: any) {
      this.logger.error('❌ Error getting grupos:', error);
      throw error;
    }
  }

  @Get('completos')
  async getGruposCompletos(
    @CurrentUser() user: any,
    @Query('tipo') tipo?: 'grupo_empleado' | 'servicio_presupuesto',
  ) {
    try {
      await this.assertCatalog(user, tipo);
      this.logger.log(
        `📝 Get grupos completos request${tipo ? ` (tipo: ${tipo})` : ''}`,
      );

      const grupos = await this.gruposService.getGruposCompletos(tipo);
      if (tipo === 'servicio_presupuesto') {
        return { success: true, grupos };
      }
      const allowed =
        await this.empleadoGrupoScopeService.listGruposRestrictivosForPayload(
          this.payloadFromRequestUser(user),
        );
      if (!allowed?.length) {
        return { success: true, grupos };
      }
      return {
        success: true,
        grupos: grupos.filter((g) =>
          this.empleadoGrupoScopeService.grupoMatches(g.nombre, allowed),
        ),
      };
    } catch (error: any) {
      this.logger.error('❌ Error getting grupos completos:', error);
      throw error;
    }
  }

  @Get(':id')
  async getGrupoById(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    try {
      this.logger.log(`📝 Get grupo by id request: ${id}`);

      const grupo = await this.gruposService.getGrupoById(id);
      await this.assertCatalog(user, grupo?.tipo);
      if (grupo?.tipo !== 'servicio_presupuesto') {
        const allowed =
          await this.empleadoGrupoScopeService.listGruposRestrictivosForPayload(
            this.payloadFromRequestUser(user),
          );
        if (
          allowed?.length &&
          !this.empleadoGrupoScopeService.grupoMatches(grupo?.nombre, allowed)
        ) {
          throw new ForbiddenException('Grupo fuera de ámbito');
        }
      }

      return { success: true, grupo };
    } catch (error: any) {
      this.logger.error(`❌ Error getting grupo ${id}:`, error);
      throw error;
    }
  }

  @Post()
  async createGrupo(
    @Body() body: CreateGrupoDto | { nombre: string },
    @CurrentUser() user: any,
  ) {
    try {
      const allowed =
        await this.empleadoGrupoScopeService.listGruposRestrictivosForPayload(
          this.payloadFromRequestUser(user),
        );
      if (allowed?.length) {
        throw new ForbiddenException(
          'No puede crear grupos con ámbito de empleados restringido.',
        );
      }
      // Backward compatibility: dacă primește doar { nombre }, convertește la CreateGrupoDto
      const dto: CreateGrupoDto =
        'nombre' in body && Object.keys(body).length === 1
          ? { nombre: body.nombre }
          : (body as CreateGrupoDto);

      this.logger.log(`📝 Create grupo request: ${dto.nombre}`);

      const grupo = await this.gruposService.createGrupo(dto);

      return { success: true, grupo };
    } catch (error: any) {
      this.logger.error('❌ Error creating grupo:', error);
      throw error;
    }
  }

  @Put(':id')
  async updateGrupo(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateGrupoDto,
    @CurrentUser() user: any,
  ) {
    try {
      const allowed =
        await this.empleadoGrupoScopeService.listGruposRestrictivosForPayload(
          this.payloadFromRequestUser(user),
        );
      if (allowed?.length) {
        throw new ForbiddenException(
          'No puede modificar el catálogo de grupos con ámbito restringido.',
        );
      }
      this.logger.log(`📝 Update grupo request: ${id}`);

      const grupo = await this.gruposService.updateGrupo(id, body);

      return { success: true, grupo };
    } catch (error: any) {
      this.logger.error(`❌ Error updating grupo ${id}:`, error);
      throw error;
    }
  }

  @Delete(':id')
  async deleteGrupo(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    try {
      const allowed =
        await this.empleadoGrupoScopeService.listGruposRestrictivosForPayload(
          this.payloadFromRequestUser(user),
        );
      if (allowed?.length) {
        throw new ForbiddenException(
          'No puede eliminar grupos con ámbito de empleados restringido.',
        );
      }
      this.logger.log(`📝 Delete grupo request: ${id}`);

      await this.gruposService.deleteGrupo(id);

      return { success: true, message: 'Grupo eliminado correctamente' };
    } catch (error: any) {
      this.logger.error(`❌ Error deleting grupo ${id}:`, error);
      throw error;
    }
  }
}
