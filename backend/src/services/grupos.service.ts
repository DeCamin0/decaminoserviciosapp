import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface GrupoCompleto {
  id: number;
  nombre: string;
  descripcion_operativa: string | null;
  tipo: 'grupo_empleado' | 'servicio_presupuesto';
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateGrupoDto {
  nombre: string;
  descripcion_operativa?: string;
  tipo?: 'grupo_empleado' | 'servicio_presupuesto';
  activo?: boolean;
}

export interface UpdateGrupoDto {
  nombre?: string;
  descripcion_operativa?: string;
  tipo?: 'grupo_empleado' | 'servicio_presupuesto';
  activo?: boolean;
}

@Injectable()
export class GruposService {
  private readonly logger = new Logger(GruposService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getGrupos(): Promise<string[]> {
    try {
      // Lista de grupuri pentru dropdown empleados: valori distincte din DatosEmpleados.GRUPO
      const rows = await this.prisma.user.findMany({
        where: { GRUPO: { not: null } },
        select: { GRUPO: true },
      });

      const grupos = [
        ...new Set(
          (rows || [])
            .map((r) => (r.GRUPO || '').trim())
            .filter((s) => s.length > 0),
        ),
      ].sort((a, b) => a.localeCompare(b, 'es'));

      this.logger.log(
        `✅ Grupos (empleados) from DatosEmpleados: ${grupos.length} grupos`,
      );

      return grupos;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving grupos:', error);
      throw new BadRequestException(
        `Error al obtener grupos: ${error.message}`,
      );
    }
  }

  async getGruposCompletos(
    tipo?: 'grupo_empleado' | 'servicio_presupuesto',
  ): Promise<GrupoCompleto[]> {
    try {
      let query = `
        SELECT 
          \`id\`,
          \`nombre\`,
          \`descripcion_operativa\`,
          \`tipo\`,
          \`activo\`,
          \`created_at\`,
          \`updated_at\`
        FROM servicios_referencia
      `;

      if (tipo) {
        query += ` WHERE \`tipo\` = ?`;
      }

      query += ` ORDER BY \`nombre\` ASC`;

      const rows = tipo
        ? await this.prisma.$queryRawUnsafe<GrupoCompleto[]>(query, tipo)
        : await this.prisma.$queryRawUnsafe<GrupoCompleto[]>(query);

      this.logger.log(`✅ Grupos completos retrieved: ${rows.length} grupos`);

      return rows;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving grupos completos:', error);
      throw new BadRequestException(
        `Error al obtener grupos: ${error.message}`,
      );
    }
  }

  async getGrupoById(id: number): Promise<GrupoCompleto> {
    try {
      const query = `
        SELECT 
          \`id\`,
          \`nombre\`,
          \`descripcion_operativa\`,
          \`tipo\`,
          \`activo\`,
          \`created_at\`,
          \`updated_at\`
        FROM servicios_referencia
        WHERE \`id\` = ?
        LIMIT 1
      `;

      const rows = await this.prisma.$queryRawUnsafe<GrupoCompleto[]>(
        query,
        id,
      );

      if (!rows || rows.length === 0) {
        throw new NotFoundException(`Grupo con id ${id} no encontrado`);
      }

      return rows[0];
    } catch (error: any) {
      this.logger.error(`❌ Error retrieving grupo ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error al obtener grupo: ${error.message}`);
    }
  }

  async createGrupo(dto: CreateGrupoDto): Promise<GrupoCompleto> {
    try {
      if (!dto.nombre || !dto.nombre.trim()) {
        throw new BadRequestException('El nombre del grupo es requerido');
      }

      const nombreTrimmed = dto.nombre.trim();
      const descripcionOperativa = dto.descripcion_operativa?.trim() || null;
      const tipo = dto.tipo || 'grupo_empleado';
      const activo = dto.activo !== undefined ? dto.activo : true;

      // Verifică dacă grupul există deja
      const checkQuery = `
        SELECT \`nombre\`
        FROM servicios_referencia
        WHERE \`nombre\` = ?
        LIMIT 1
      `;

      const existing = await this.prisma.$queryRawUnsafe<
        Array<{ nombre: string }>
      >(checkQuery, nombreTrimmed);

      if (existing && existing.length > 0) {
        throw new BadRequestException(`El grupo "${nombreTrimmed}" ya existe`);
      }

      // Creează grupul nou
      const insertQuery = `
        INSERT INTO servicios_referencia (
          \`nombre\`, 
          \`descripcion_operativa\`, 
          \`tipo\`,
          \`activo\`, 
          \`created_at\`, 
          \`updated_at\`
        )
        VALUES (?, ?, ?, ?, NOW(), NOW())
      `;

      await this.prisma.$executeRawUnsafe(
        insertQuery,
        nombreTrimmed,
        descripcionOperativa,
        tipo,
        activo,
      );

      this.logger.log(`✅ Grupo creado: ${nombreTrimmed}`);

      // Returnează grupul creat
      const idResult = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT LAST_INSERT_ID() as id`,
      );
      const newId = idResult[0]?.id || 0;

      if (newId === 0) {
        throw new BadRequestException(
          'Error al obtener el ID del grupo creado',
        );
      }

      return await this.getGrupoById(newId);
    } catch (error: any) {
      this.logger.error('❌ Error creating grupo:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(`Error al crear grupo: ${error.message}`);
    }
  }

  async updateGrupo(id: number, dto: UpdateGrupoDto): Promise<GrupoCompleto> {
    try {
      // Verifică dacă grupul există
      await this.getGrupoById(id);

      const updates: string[] = [];
      const values: any[] = [];

      if (dto.nombre !== undefined) {
        const nombreTrimmed = dto.nombre.trim();
        if (!nombreTrimmed) {
          throw new BadRequestException(
            'El nombre del grupo no puede estar vacío',
          );
        }

        // Verifică dacă există alt grup cu același nume
        const checkQuery = `
          SELECT \`id\`, \`nombre\`
          FROM servicios_referencia
          WHERE \`nombre\` = ? AND \`id\` != ?
          LIMIT 1
        `;

        const existing = await this.prisma.$queryRawUnsafe<
          Array<{ id: number; nombre: string }>
        >(checkQuery, nombreTrimmed, id);

        if (existing && existing.length > 0) {
          throw new BadRequestException(
            `El grupo "${nombreTrimmed}" ya existe`,
          );
        }

        updates.push('`nombre` = ?');
        values.push(nombreTrimmed);
      }

      if (dto.descripcion_operativa !== undefined) {
        updates.push('`descripcion_operativa` = ?');
        values.push(dto.descripcion_operativa?.trim() || null);
      }

      if (dto.tipo !== undefined) {
        updates.push('`tipo` = ?');
        values.push(dto.tipo);
      }

      if (dto.activo !== undefined) {
        updates.push('`activo` = ?');
        values.push(dto.activo);
      }

      if (updates.length === 0) {
        return await this.getGrupoById(id);
      }

      updates.push('`updated_at` = NOW()');
      values.push(id);

      const updateQuery = `
        UPDATE servicios_referencia
        SET ${updates.join(', ')}
        WHERE \`id\` = ?
      `;

      await this.prisma.$executeRawUnsafe(updateQuery, ...values);

      this.logger.log(`✅ Grupo actualizado: id ${id}`);

      return await this.getGrupoById(id);
    } catch (error: any) {
      this.logger.error(`❌ Error updating grupo ${id}:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar grupo: ${error.message}`,
      );
    }
  }

  async deleteGrupo(id: number): Promise<void> {
    try {
      // Verifică dacă grupul există
      await this.getGrupoById(id);

      // Soft delete: setează activo = false
      const deleteQuery = `
        UPDATE servicios_referencia
        SET \`activo\` = FALSE, \`updated_at\` = NOW()
        WHERE \`id\` = ?
      `;

      await this.prisma.$executeRawUnsafe(deleteQuery, id);

      this.logger.log(`✅ Grupo desactivado (soft delete): id ${id}`);
    } catch (error: any) {
      this.logger.error(`❌ Error deleting grupo ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar grupo: ${error.message}`,
      );
    }
  }
}
