import { Controller, Get } from '@nestjs/common';
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
}
