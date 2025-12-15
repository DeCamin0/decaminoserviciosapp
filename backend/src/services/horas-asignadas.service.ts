import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HorasAsignadasService {
  private readonly logger = new Logger(HorasAsignadasService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getHorasAsignadas(
    grupo: string,
  ): Promise<{ anuales?: number; mensuales?: number }> {
    try {
      if (!grupo || grupo.trim() === '') {
        throw new BadRequestException('grupo is required');
      }

      const query = `
        SELECT 
          \`Horas Anuales\` AS anuales,
          \`Horas Mensuales\` AS mensuales
        FROM horaspermitidas
        WHERE GRUPO = ?
        LIMIT 1
      `;

      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        query,
        grupo.trim(),
      );

      if (!rows || rows.length === 0) {
        this.logger.warn(
          `⚠️ Grupo '${grupo}' not found in horaspermitidas table`,
        );
        // Returnează default values ca în n8n
        return { anuales: 1920, mensuales: 160 };
      }

      const row = rows[0];
      const anuales = row.anuales ? parseInt(String(row.anuales), 10) : 1920;
      const mensuales = row.mensuales
        ? parseInt(String(row.mensuales), 10)
        : 160;

      this.logger.log(
        `✅ Horas asignadas retrieved for grupo '${grupo}': anuales=${anuales}, mensuales=${mensuales}`,
      );

      return {
        anuales: isNaN(anuales) ? 1920 : anuales,
        mensuales: isNaN(mensuales) ? 160 : mensuales,
      };
    } catch (error: any) {
      this.logger.error('❌ Error retrieving horas asignadas:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener horas asignadas: ${error.message}`,
      );
    }
  }
}
