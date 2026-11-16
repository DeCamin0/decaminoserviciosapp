import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  canManageContractTypes,
  isContractTypeStaff,
  type ContractTypeActor,
} from '../services/contract-types-access';

@Controller('api/contract-types')
@UseGuards(JwtAuthGuard)
export class ContractTypesController {
  constructor(private readonly prisma: PrismaService) {}

  private async actorCanManage(
    actor: ContractTypeActor | null | undefined,
  ): Promise<boolean> {
    if (isContractTypeStaff(actor)) return true;
    const grupo = String(actor?.grupo || '').trim();
    if (!grupo) return false;
    try {
      const row = await this.prisma.permissions.findUnique({
        where: { grupo_module: `${grupo}_empleados` },
        select: { permitted: true },
      });
      const permitted = String(row?.permitted ?? '')
        .trim()
        .toLowerCase();
      return canManageContractTypes(
        actor,
        permitted === 'true' || permitted === '1',
      );
    } catch {
      return false;
    }
  }

  private async assertCanManage(actor: ContractTypeActor | undefined) {
    if (!(await this.actorCanManage(actor))) {
      throw new ForbiddenException('No puedes gestionar los tipos de contrato');
    }
  }

  @Get()
  async getContractTypes(@CurrentUser() user?: ContractTypeActor) {
    await this.assertCanManage(user);
    try {
      const contractTypes = await this.prisma.tiposContrato.findMany({
        orderBy: {
          tipo: 'asc',
        },
      });

      return contractTypes.map((ct) => ({
        id: ct.id,
        tipo: ct.tipo,
      }));
    } catch (error: any) {
      if (error instanceof ForbiddenException) throw error;
      console.error('[ContractTypesController] Error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to load contract types',
      };
    }
  }

  @Post()
  async createContractType(
    @Body() body: { tipo?: string },
    @CurrentUser() user?: ContractTypeActor,
  ) {
    await this.assertCanManage(user);
    const tipo = (body?.tipo ?? '').trim();
    if (!tipo) {
      return { success: false, error: 'tipo es obligatorio' };
    }
    try {
      const created = await this.prisma.tiposContrato.create({
        data: { tipo },
      });
      return { id: created.id, tipo: created.tipo };
    } catch (error: any) {
      if (error instanceof ForbiddenException) throw error;
      if (error?.code === 'P2002') {
        return {
          success: false,
          error: 'Ya existe un tipo de contrato con ese nombre',
        };
      }
      console.error('[ContractTypesController] Create error:', error);
      return {
        success: false,
        error: error?.message || 'Error al crear tipo de contrato',
      };
    }
  }
}
