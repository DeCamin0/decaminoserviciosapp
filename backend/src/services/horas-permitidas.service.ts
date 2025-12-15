import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HorasPermitidasService {
  private readonly logger = new Logger(HorasPermitidasService.name);

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

  async getAll(): Promise<any[]> {
    try {
      const query = 'SELECT * FROM horaspermitidas ORDER BY GRUPO ASC';
      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(`✅ Horas permitidas retrieved: ${rows.length} records`);

      return rows.map((row) => ({
        id: row.id,
        GRUPO: row.GRUPO,
        'Horas Anuales': row['Horas Anuales'] || row.Horas_Anuales,
        'Horas Mensuales': row['Horas Mensuales'] || row.Horas_Mensuales,
      }));
    } catch (error: any) {
      this.logger.error('❌ Error retrieving horas permitidas:', error);
      throw new BadRequestException(
        `Error al obtener horas permitidas: ${error.message}`,
      );
    }
  }

  async create(data: {
    grupo: string;
    horasAnuales: number;
    horasMensuales: number;
  }): Promise<any> {
    try {
      if (!data.grupo || data.grupo.trim() === '') {
        throw new BadRequestException('grupo is required');
      }

      const grupo = data.grupo.trim();
      const horasAnuales = Number(data.horasAnuales) || 0;
      const horasMensuales = Number(data.horasMensuales) || 0;

      const query = `
        INSERT INTO horaspermitidas (\`GRUPO\`, \`Horas Anuales\`, \`Horas Mensuales\`)
        VALUES (
          ${this.escapeSql(grupo)},
          ${horasAnuales},
          ${horasMensuales}
        )
      `;

      await this.prisma.$executeRawUnsafe(query);

      // Obține ID-ul înregistrării create
      const insertedRows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM horaspermitidas WHERE GRUPO = ${this.escapeSql(grupo)} ORDER BY id DESC LIMIT 1`,
      );

      const inserted = insertedRows?.[0];
      if (!inserted) {
        throw new BadRequestException('Failed to retrieve inserted record');
      }

      this.logger.log(
        `✅ Horas permitidas created: ID=${inserted.id}, GRUPO=${grupo}`,
      );

      return {
        id: inserted.id,
        grupo: inserted.GRUPO,
        horasAnuales: Number(
          inserted['Horas Anuales'] || inserted.Horas_Anuales || 0,
        ),
        horasMensuales: Number(
          inserted['Horas Mensuales'] || inserted.Horas_Mensuales || 0,
        ),
      };
    } catch (error: any) {
      this.logger.error('❌ Error creating horas permitidas:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al crear horas permitidas: ${error.message}`,
      );
    }
  }

  async update(
    id: number,
    data: {
      grupo: string;
      horasAnuales: number;
      horasMensuales: number;
    },
  ): Promise<any> {
    try {
      if (!id) {
        throw new BadRequestException('id is required');
      }

      // Verifică dacă există înregistrarea
      const existingRows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM horaspermitidas WHERE id = ${id} LIMIT 1`,
      );

      if (!existingRows || existingRows.length === 0) {
        throw new NotFoundException(`Horas permitidas with id ${id} not found`);
      }

      if (!data.grupo || data.grupo.trim() === '') {
        throw new BadRequestException('grupo is required');
      }

      const grupo = data.grupo.trim();
      const horasAnuales = Number(data.horasAnuales) || 0;
      const horasMensuales = Number(data.horasMensuales) || 0;

      const query = `
        UPDATE horaspermitidas
        SET 
          \`GRUPO\` = ${this.escapeSql(grupo)},
          \`Horas Anuales\` = ${horasAnuales},
          \`Horas Mensuales\` = ${horasMensuales}
        WHERE id = ${id}
      `;

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(`✅ Horas permitidas updated: ID=${id}, GRUPO=${grupo}`);

      return {
        id: id,
        grupo: grupo,
        horasAnuales: horasAnuales,
        horasMensuales: horasMensuales,
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating horas permitidas:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar horas permitidas: ${error.message}`,
      );
    }
  }

  async delete(id: number): Promise<any> {
    try {
      if (!id) {
        throw new BadRequestException('id is required');
      }

      // Verifică dacă există înregistrarea
      const existingRows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM horaspermitidas WHERE id = ${id} LIMIT 1`,
      );

      if (!existingRows || existingRows.length === 0) {
        throw new NotFoundException(`Horas permitidas with id ${id} not found`);
      }

      const grupo = existingRows[0].GRUPO;

      const query = `DELETE FROM horaspermitidas WHERE id = ${id}`;

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(`✅ Horas permitidas deleted: ID=${id}, GRUPO=${grupo}`);

      return {
        id: id,
        grupo: grupo,
      };
    } catch (error: any) {
      this.logger.error('❌ Error deleting horas permitidas:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar horas permitidas: ${error.message}`,
      );
    }
  }
}
