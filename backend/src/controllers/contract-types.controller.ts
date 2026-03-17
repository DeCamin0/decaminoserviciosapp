import { Body, Controller, Get, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/contract-types')
export class ContractTypesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getContractTypes() {
    try {
      const contractTypes = await this.prisma.tiposContrato.findMany({
        orderBy: {
          tipo: 'asc',
        },
      });

      // Mapăm datele pentru compatibilitate cu frontend-ul
      // Frontend-ul așteaptă formatul: { id: number, tipo: string }
      return contractTypes.map((ct) => ({
        id: ct.id,
        tipo: ct.tipo,
      }));
    } catch (error: any) {
      console.error('[ContractTypesController] Error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to load contract types',
      };
    }
  }

  @Post()
  async createContractType(@Body() body: { tipo?: string }) {
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
