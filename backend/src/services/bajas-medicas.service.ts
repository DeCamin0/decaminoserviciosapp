import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BajasMedicasService {
  private readonly logger = new Logger(BajasMedicasService.name);

  constructor(private readonly prisma: PrismaService) {}

  private escapeSql(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    const str = String(value);
    const escaped = str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }

  async getBajasMedicas(codigo?: string): Promise<any[]> {
    try {
      let query = 'SELECT * FROM `MutuaCasos`';
      const conditions: string[] = [];

      if (codigo && codigo.trim() !== '') {
        conditions.push(
          `\`Codigo_Empleado\` = ${this.escapeSql(codigo.trim())}`,
        );
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ' ORDER BY `Fecha baja` DESC';

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(
        `✅ Bajas médicas retrieved: ${rows.length} records (codigo: ${codigo || 'all'})`,
      );

      return rows;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving bajas médicas:', error);
      throw new BadRequestException(
        `Error al obtener bajas médicas: ${error.message}`,
      );
    }
  }
}
