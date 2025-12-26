import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FestivosService {
  private readonly logger = new Logger(FestivosService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Escape SQL pentru prevenirea SQL injection
   */
  private escapeSql(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }
    const str = String(value);
    const escaped = str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }

  /**
   * Obține toate zilele festive pentru un an specific
   * @param year Anul pentru care se extrag zilele festive
   * @returns Array cu zilele festive
   */
  async getFestivos(year: number): Promise<any[]> {
    try {
      if (!year || isNaN(year)) {
        throw new BadRequestException('Year is required and must be a valid number');
      }

      const query = `
        SELECT
          id,
          date,
          name,
          scope,
          ccaa_code,
          observed_date,
          active,
          notes
        FROM fiestas
        WHERE YEAR(date) = ${year}
          AND active = 1
        ORDER BY date ASC
      `;

      this.logger.log(`📅 Fetching festivos for year: ${year}`);

      const festivos = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(`✅ Found ${festivos.length} festivos for year ${year}`);

      return festivos;
    } catch (error: any) {
      this.logger.error(`❌ Error getting festivos for year ${year}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener festivos: ${error.message}`,
      );
    }
  }

  /**
   * Creează o zi festivă nouă
   * @param data Datele zilei festive
   */
  async createFestivo(data: {
    fecha: string;
    nombre: string;
    scope: string;
    ccaa?: string;
    observed_date?: string;
    active?: number | boolean;
    notes?: string;
  }): Promise<{ success: true; id: number }> {
    try {
      if (!data.fecha || !data.nombre || !data.scope) {
        throw new BadRequestException('fecha, nombre, and scope are required');
      }

      // observed_date default la fecha dacă nu este specificat
      const observedDate = data.observed_date || data.fecha;
      const active = data.active !== undefined 
        ? (typeof data.active === 'boolean' ? (data.active ? 1 : 0) : Number(data.active))
        : 1;

      const query = `
        INSERT INTO fiestas
          (date, name, scope, ccaa_code, observed_date, active, notes)
        VALUES
          (
            ${this.escapeSql(data.fecha)},
            ${this.escapeSql(data.nombre)},
            ${this.escapeSql(data.scope)},
            ${data.ccaa ? this.escapeSql(data.ccaa) : 'NULL'},
            ${this.escapeSql(observedDate)},
            ${active},
            ${data.notes ? this.escapeSql(data.notes) : "''"}
          )
      `;

      this.logger.log(`📝 Creating festivo: ${data.nombre} on ${data.fecha}`);

      await this.prisma.$executeRawUnsafe(query);

      // Obține ID-ul inserat
      const inserted = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT id FROM fiestas WHERE date = ${this.escapeSql(data.fecha)} AND name = ${this.escapeSql(data.nombre)} AND scope = ${this.escapeSql(data.scope)} ORDER BY id DESC LIMIT 1`
      );

      const id = inserted && inserted.length > 0 ? inserted[0].id : null;

      this.logger.log(`✅ Festivo created with id: ${id}`);

      return { success: true, id: id || 0 };
    } catch (error: any) {
      this.logger.error('❌ Error creating festivo:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al crear festivo: ${error.message}`,
      );
    }
  }

  /**
   * Actualizează o zi festivă existentă
   * @param data Datele pentru actualizare
   */
  async updateFestivo(data: {
    id: number;
    fecha?: string;
    nombre?: string;
    scope?: string;
    notes?: string;
    active?: number | boolean;
  }): Promise<{ success: true }> {
    try {
      if (!data.id || isNaN(data.id)) {
        throw new BadRequestException('id is required and must be a valid number');
      }

      const updates: string[] = [];

      if (data.fecha !== undefined) {
        updates.push(`date = ${this.escapeSql(data.fecha)}`);
      }
      if (data.nombre !== undefined) {
        updates.push(`name = ${this.escapeSql(data.nombre)}`);
      }
      if (data.scope !== undefined) {
        updates.push(`scope = ${this.escapeSql(data.scope)}`);
      }
      if (data.notes !== undefined) {
        updates.push(`notes = ${this.escapeSql(data.notes)}`);
      }
      if (data.active !== undefined) {
        const active = typeof data.active === 'boolean' 
          ? (data.active ? 1 : 0) 
          : Number(data.active);
        updates.push(`active = ${active}`);
      }

      if (updates.length === 0) {
        throw new BadRequestException('At least one field must be provided for update');
      }

      const query = `
        UPDATE fiestas
        SET ${updates.join(', ')}
        WHERE id = ${Number(data.id)}
      `;

      this.logger.log(`📝 Updating festivo with id: ${data.id}`);

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(`✅ Festivo updated with id: ${data.id}`);

      return { success: true };
    } catch (error: any) {
      this.logger.error(`❌ Error updating festivo with id ${data.id}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar festivo: ${error.message}`,
      );
    }
  }

  /**
   * Șterge o zi festivă
   * @param id ID-ul zilei festive de șters
   */
  async deleteFestivo(id: number): Promise<{ success: true }> {
    try {
      if (!id || isNaN(id)) {
        throw new BadRequestException('id is required and must be a valid number');
      }

      const query = `
        DELETE FROM fiestas
        WHERE id = ${Number(id)}
      `;

      this.logger.log(`🗑️ Deleting festivo with id: ${id}`);

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(`✅ Festivo deleted with id: ${id}`);

      return { success: true };
    } catch (error: any) {
      this.logger.error(`❌ Error deleting festivo with id ${id}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar festivo: ${error.message}`,
      );
    }
  }
}

