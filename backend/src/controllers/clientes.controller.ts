import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/clientes')
export class ClientesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getClientes() {
    try {
      const clientes = await this.prisma.clientes.findMany({
        orderBy: {
          NOMBRE_O_RAZON_SOCIAL: 'asc',
        },
      });

      // Mapează câmpurile pentru compatibilitate cu frontend-ul/n8n
      const mapped = clientes.map((c: any) => ({
        ...c,
        // n8n trimitea `tipo` cu lowercase - păstrăm același nume de câmp
        tipo: c.TIPO ?? c.tipo ?? null,
        // Frontend-ul așteaptă câmpul cu spații, nu cu underscore
        'NOMBRE O RAZON SOCIAL':
          c.NOMBRE_O_RAZON_SOCIAL ?? c['NOMBRE O RAZON SOCIAL'] ?? null,
        // Păstrăm și varianta cu underscore pentru compatibilitate
        NOMBRE_O_RAZON_SOCIAL: c.NOMBRE_O_RAZON_SOCIAL ?? null,
      }));

      return mapped;
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Failed to load clients',
      };
    }
  }
}
