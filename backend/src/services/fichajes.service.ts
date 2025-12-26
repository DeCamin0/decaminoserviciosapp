import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FichajesService {
  private readonly logger = new Logger(FichajesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Escapă un string pentru SQL
   */
  private escapeSql(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    const str = String(value);
    // Escape single quotes și backslashes
    const escaped = str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }

  /**
   * Obtine lista de registros (fichajes) cu filtrare pe CODIGO și MES
   */
  async getRegistros(codigo: string, mes: string): Promise<any[]> {
    try {
      if (!codigo || codigo.trim() === '') {
        throw new BadRequestException('CODIGO is required');
      }

      if (!mes || mes.trim() === '') {
        throw new BadRequestException('MES is required');
      }

      const codigoClean = codigo.trim();
      const mesClean = mes.trim();

      // Validăm formatul MES (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(mesClean)) {
        throw new BadRequestException(
          'MES must be in format YYYY-MM (e.g., 2025-12)',
        );
      }

      // Construim query-ul SQL similar cu n8n
      // FECHA >= prima zi a lunii (MES-01)
      // FECHA < prima zi a lunii următoare (MES+1 lună)
      const query = `
        SELECT *
        FROM Fichaje
        WHERE CODIGO = ${this.escapeSql(codigoClean)}
          AND FECHA >= STR_TO_DATE(CONCAT(${this.escapeSql(mesClean)}, '-01'), '%Y-%m-%d')
          AND FECHA < DATE_ADD(STR_TO_DATE(CONCAT(${this.escapeSql(mesClean)}, '-01'), '%Y-%m-%d'), INTERVAL 1 MONTH)
        ORDER BY FECHA DESC, HORA DESC
      `;

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(
        `✅ Registros retrieved: ${rows.length} records (codigo: ${codigoClean}, mes: ${mesClean})`,
      );

      return rows;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving registros:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener registros: ${error.message}`,
      );
    }
  }

  /**
   * Obtine toate registros (fichajes) pentru TOȚI angajații pentru o lună specifică
   * Folosit pentru manageri/supervisori pentru a vedea toate marcajele dintr-o lună
   */
  async getRegistrosEmpleados(mes: string): Promise<any[]> {
    try {
      if (!mes || mes.trim() === '') {
        throw new BadRequestException('mes is required');
      }

      const mesClean = mes.trim();

      // Validăm formatul MES (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(mesClean)) {
        throw new BadRequestException(
          'mes must be in format YYYY-MM (e.g., 2025-12)',
        );
      }

      // Query SQL: toate registros pentru luna specificată (FĂRĂ filtrare pe CODIGO)
      const query = `
        SELECT *
        FROM Fichaje
        WHERE FECHA >= STR_TO_DATE(CONCAT(${this.escapeSql(mesClean)}, '-01'), '%Y-%m-%d')
          AND FECHA < DATE_ADD(STR_TO_DATE(CONCAT(${this.escapeSql(mesClean)}, '-01'), '%Y-%m-%d'), INTERVAL 1 MONTH)
        ORDER BY FECHA DESC, HORA DESC
      `;

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(
        `✅ Registros empleados retrieved: ${rows.length} records (mes: ${mesClean})`,
      );

      return rows;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving registros empleados:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener registros empleados: ${error.message}`,
      );
    }
  }

  /**
   * Obtine registros pentru o perioadă personalizată (fecha_inicio - fecha_fin)
   * Poate fi filtrat opțional pe un codigo specific
   */
  async getRegistrosPeriodo(
    fechaInicio: string,
    fechaFin: string,
    codigo?: string,
  ): Promise<any[]> {
    try {
      if (!fechaInicio || fechaInicio.trim() === '') {
        throw new BadRequestException('fecha_inicio is required');
      }

      if (!fechaFin || fechaFin.trim() === '') {
        throw new BadRequestException('fecha_fin is required');
      }

      const fechaInicioClean = fechaInicio.trim();
      const fechaFinClean = fechaFin.trim();
      const codigoClean = codigo?.trim();

      // Validăm formatul datelor (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicioClean)) {
        throw new BadRequestException(
          'fecha_inicio must be in format YYYY-MM-DD (e.g., 2025-12-01)',
        );
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaFinClean)) {
        throw new BadRequestException(
          'fecha_fin must be in format YYYY-MM-DD (e.g., 2025-12-31)',
        );
      }

      // Validăm că fecha_inicio <= fecha_fin
      const dateInicio = new Date(fechaInicioClean);
      const dateFin = new Date(fechaFinClean);
      if (dateInicio > dateFin) {
        throw new BadRequestException(
          'fecha_inicio must be less than or equal to fecha_fin',
        );
      }

      // Construim query-ul SQL
      let query = `
        SELECT *
        FROM Fichaje
        WHERE FECHA >= STR_TO_DATE(${this.escapeSql(fechaInicioClean)}, '%Y-%m-%d')
          AND FECHA <= STR_TO_DATE(${this.escapeSql(fechaFinClean)}, '%Y-%m-%d')
      `;

      // Dacă este specificat codigo, adăugăm filtrare
      if (codigoClean && codigoClean !== '') {
        query += ` AND CODIGO = ${this.escapeSql(codigoClean)}`;
      }

      query += ` ORDER BY FECHA DESC, HORA DESC`;

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(
        `✅ Registros periodo retrieved: ${rows.length} records (fecha_inicio: ${fechaInicioClean}, fecha_fin: ${fechaFinClean}, codigo: ${codigoClean || 'all'})`,
      );

      return rows;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving registros periodo:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener registros periodo: ${error.message}`,
      );
    }
  }

  /**
   * Adaugă un nou marcaje (fichaje) în baza de date
   */
  async addFichaje(fichajeData: {
    id: string;
    codigo: string;
    nombre: string;
    email: string;
    tipo: string;
    hora: string;
    address: string | null;
    modificatDe: string;
    data: string;
    motivo: string;
  }): Promise<{ success: true; id: string }> {
    try {
      // Validări
      if (!fichajeData.id || fichajeData.id.trim() === '') {
        throw new BadRequestException('ID is required');
      }

      if (!fichajeData.codigo || fichajeData.codigo.trim() === '') {
        throw new BadRequestException('CODIGO is required');
      }

      if (!fichajeData.nombre || fichajeData.nombre.trim() === '') {
        throw new BadRequestException('NOMBRE is required');
      }

      if (!fichajeData.tipo || fichajeData.tipo.trim() === '') {
        throw new BadRequestException('TIPO is required');
      }

      if (!fichajeData.hora || fichajeData.hora.trim() === '') {
        throw new BadRequestException('HORA is required');
      }

      if (!fichajeData.data || fichajeData.data.trim() === '') {
        throw new BadRequestException('FECHA (data) is required');
      }

      // Construiește query-ul INSERT (EXACT ca n8n: Entrada_Salida-para registros registrados manual.json)
      // n8n folosește ON DUPLICATE KEY UPDATE pentru a actualiza dacă ID-ul există deja
      const query = `
        INSERT INTO \`Fichaje\`
        (
          \`CODIGO\`,
          \`NOMBRE / APELLIDOS\`,
          \`CORREO ELECTRONICO\`,
          \`TIPO\`,
          \`HORA\`,
          \`DIRECCION\`,
          \`MODIFICADO_POR\`,
          \`FECHA\`,
          \`DURACION\`,
          \`Estado\`,
          \`Motivo\`,
          \`ID\`
        )
        VALUES
        (
          ${this.escapeSql(fichajeData.codigo.trim())},
          ${this.escapeSql(fichajeData.nombre.trim())},
          ${this.escapeSql(fichajeData.email?.trim() || '')},
          ${this.escapeSql(fichajeData.tipo.trim())},
          ${this.escapeSql(fichajeData.hora.trim())},
          ${fichajeData.address ? this.escapeSql(fichajeData.address.trim()) : 'NULL'},
          ${this.escapeSql(fichajeData.modificatDe?.trim() || 'Empleado')},
          ${this.escapeSql(fichajeData.data.trim())},
          NULL,
          'Aprobado',
          NULL,
          ${this.escapeSql(fichajeData.id.trim())}
        )
        ON DUPLICATE KEY UPDATE
          \`HORA\` = VALUES(\`HORA\`),
          \`DIRECCION\` = VALUES(\`DIRECCION\`),
          \`MODIFICADO_POR\` = VALUES(\`MODIFICADO_POR\`),
          \`FECHA\` = VALUES(\`FECHA\`),
          \`Estado\` = 'Aprobado'
      `;

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(
        `✅ Fichaje added: ID=${fichajeData.id}, CODIGO=${fichajeData.codigo}, TIPO=${fichajeData.tipo}, FECHA=${fichajeData.data}`,
      );

      return { success: true, id: fichajeData.id };
    } catch (error: any) {
      this.logger.error('❌ Error adding fichaje:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al agregar fichaje: ${error.message}`,
      );
    }
  }

  /**
   * Actualizează un marcaje (fichaje) existent în baza de date
   */
  async updateFichaje(
    id: string,
    fichajeData: {
      codigo?: string;
      nombre?: string;
      email?: string;
      tipo?: string;
      hora?: string;
      address?: string | null;
      modificatDe?: string;
      data?: string;
      duration?: string;
    },
  ): Promise<{ success: true; id: string; message: string }> {
    try {
      // Validări
      if (!id || id.trim() === '') {
        throw new BadRequestException('ID is required');
      }

      // Verifică dacă marcajele există
      const checkQuery = `SELECT ID FROM Fichaje WHERE ID = ${this.escapeSql(id.trim())} LIMIT 1`;
      const existing = await this.prisma.$queryRawUnsafe<any[]>(checkQuery);

      if (!existing || existing.length === 0) {
        throw new BadRequestException(`Fichaje with ID ${id} not found`);
      }

      // Construiește query-ul UPDATE doar cu câmpurile care sunt trimise
      const updateFields: string[] = [];

      if (fichajeData.codigo !== undefined) {
        updateFields.push(
          `CODIGO = ${this.escapeSql(fichajeData.codigo.trim())}`,
        );
      }

      if (fichajeData.nombre !== undefined) {
        updateFields.push(
          `\`NOMBRE / APELLIDOS\` = ${this.escapeSql(fichajeData.nombre.trim())}`,
        );
      }

      if (fichajeData.email !== undefined) {
        updateFields.push(
          `\`CORREO ELECTRONICO\` = ${this.escapeSql(fichajeData.email.trim())}`,
        );
      }

      if (fichajeData.tipo !== undefined) {
        updateFields.push(`TIPO = ${this.escapeSql(fichajeData.tipo.trim())}`);
      }

      if (fichajeData.hora !== undefined) {
        updateFields.push(`HORA = ${this.escapeSql(fichajeData.hora.trim())}`);
      }

      if (fichajeData.address !== undefined) {
        if (fichajeData.address === null || fichajeData.address === '') {
          updateFields.push('DIRECCION = NULL');
        } else {
          updateFields.push(
            `DIRECCION = ${this.escapeSql(fichajeData.address.trim())}`,
          );
        }
      }

      if (fichajeData.modificatDe !== undefined) {
        updateFields.push(
          `MODIFICADO_POR = ${this.escapeSql(fichajeData.modificatDe.trim())}`,
        );
      }

      if (fichajeData.data !== undefined) {
        updateFields.push(`FECHA = ${this.escapeSql(fichajeData.data.trim())}`);
      }

      if (fichajeData.duration !== undefined) {
        if (fichajeData.duration === null || fichajeData.duration === '') {
          updateFields.push('DURACION = NULL');
        } else {
          updateFields.push(
            `DURACION = ${this.escapeSql(fichajeData.duration.trim())}`,
          );
        }
      }

      if (updateFields.length === 0) {
        throw new BadRequestException('No fields to update');
      }

      const updateQuery = `
        UPDATE Fichaje
        SET ${updateFields.join(', ')}
        WHERE ID = ${this.escapeSql(id.trim())}
      `;

      await this.prisma.$executeRawUnsafe(updateQuery);

      this.logger.log(
        `✅ Fichaje updated: ID=${id}, fields updated: ${updateFields.length}`,
      );

      return {
        success: true,
        id: id.trim(),
        message: 'Registro actualizado correctamente.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating fichaje:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar fichaje: ${error.message}`,
      );
    }
  }

  /**
   * Șterge un marcaje (fichaje) din baza de date
   */
  async deleteFichaje(id: string): Promise<{ success: true; message: string }> {
    try {
      // Validări
      if (!id || id.trim() === '') {
        throw new BadRequestException('ID is required');
      }

      // Verifică dacă marcajele există
      const checkQuery = `SELECT ID FROM Fichaje WHERE ID = ${this.escapeSql(id.trim())} LIMIT 1`;
      const existing = await this.prisma.$queryRawUnsafe<any[]>(checkQuery);

      if (!existing || existing.length === 0) {
        throw new BadRequestException(`Fichaje with ID ${id} not found`);
      }

      // Construiește query-ul DELETE
      const deleteQuery = `
        DELETE FROM Fichaje
        WHERE ID = ${this.escapeSql(id.trim())}
      `;

      await this.prisma.$executeRawUnsafe(deleteQuery);

      this.logger.log(`✅ Fichaje deleted: ID=${id}`);

      return {
        success: true,
        message: 'Registro eliminado correctamente.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error deleting fichaje:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar fichaje: ${error.message}`,
      );
    }
  }
}
