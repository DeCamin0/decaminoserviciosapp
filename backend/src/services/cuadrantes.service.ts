import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CuadrantesService {
  private readonly logger = new Logger(CuadrantesService.name);

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
    const escaped = str.replace(/\\/g, '\\\\\\\\').replace(/'/g, "\\\\'");
    return `'${escaped}'`;
  }

  /**
   * Obține lista de cuadrantes cu filtrare opțională pe centro, empleado (CODIGO) și nombre
   * EXACT ca n8n: listeaza cuadrante.json
   */
  async getCuadrantes(
    centro?: string,
    empleado?: string,
    nombre?: string,
  ): Promise<any[]> {
    try {
      const conditions: string[] = [];

      // Filtrare pe centro (dacă este specificat)
      if (centro && centro.trim() !== '') {
        conditions.push(`CENTRO = ${this.escapeSql(centro.trim())}`);
      }

      // Filtrare pe empleado (CODIGO) (dacă este specificat)
      if (empleado && empleado.trim() !== '') {
        conditions.push(`CODIGO = ${this.escapeSql(empleado.trim())}`);
      }

      // Filtrare pe nombre (dacă este specificat)
      if (nombre && nombre.trim() !== '') {
        conditions.push(`NOMBRE = ${this.escapeSql(nombre.trim())}`);
      }

      // Construiește query-ul SQL (exact ca n8n)
      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `SELECT * FROM cuadrante ${whereClause}`;

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(
        `✅ Cuadrantes retrieved: ${rows.length} records (centro: ${centro || 'all'}, empleado: ${empleado || 'all'}, nombre: ${nombre || 'all'})`,
      );

      return rows;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving cuadrantes:', error);
      throw new BadRequestException(
        `Error al obtener cuadrantes: ${error.message}`,
      );
    }
  }
}
