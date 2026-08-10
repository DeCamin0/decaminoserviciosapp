import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmpleadosStatsService {
  private readonly logger = new Logger(EmpleadosStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obține statistici pentru toți angajații.
   * Agregări SQL (câteva query-uri), fără Promise.all per angajat — evită epuizarea pool-ului Prisma.
   */
  async getEmpleadosStats() {
    try {
      const empleados = await this.prisma.$queryRaw<any[]>`
        SELECT
          CODIGO,
          \`NOMBRE / APELLIDOS\`,
          \`CORREO ELECTRONICO\`,
          \`CENTRO TRABAJO\`,
          \`GRUPO\`,
          \`ESTADO\`
        FROM DatosEmpleados
        ORDER BY \`NOMBRE / APELLIDOS\` ASC
      `;

      const fichajeRows = await this.prisma.$queryRaw<
        Array<{ CODIGO: string; cnt: bigint; lastFecha: string | null }>
      >`
        SELECT
          CODIGO,
          COUNT(*) AS cnt,
          MAX(FECHA) AS lastFecha
        FROM Fichaje
        WHERE CODIGO IS NOT NULL AND CODIGO != ''
        GROUP BY CODIGO
      `;

      const loginRows = await this.prisma.$queryRaw<
        Array<{ codigo: string; cnt: bigint; lastLogin: string | null }>
      >`
        SELECT
          e.CODIGO AS codigo,
          COUNT(l.id) AS cnt,
          MAX(l.timestamp) AS lastLogin
        FROM DatosEmpleados e
        LEFT JOIN Logs l
          ON (
            l.action = 'login'
            OR (l.action = 'page_access' AND l.url LIKE '%/inicio%')
          )
          AND (
            (
              e.\`CORREO ELECTRONICO\` IS NOT NULL
              AND TRIM(e.\`CORREO ELECTRONICO\`) != ''
              AND l.email = e.\`CORREO ELECTRONICO\`
            )
            OR (
              e.\`NOMBRE / APELLIDOS\` IS NOT NULL
              AND TRIM(e.\`NOMBRE / APELLIDOS\`) != ''
              AND l.user = e.\`NOMBRE / APELLIDOS\`
            )
          )
        GROUP BY e.CODIGO
      `;

      const fichajeByCodigo = new Map(
        fichajeRows.map((r) => [
          String(r.CODIGO),
          { count: Number(r.cnt || 0), lastFecha: r.lastFecha || null },
        ]),
      );
      const loginByCodigo = new Map(
        loginRows.map((r) => [
          String(r.codigo),
          { count: Number(r.cnt || 0), lastLogin: r.lastLogin || null },
        ]),
      );

      const stats = empleados.map((empleado) => {
        const codigo = String(empleado.CODIGO ?? '');
        const nombre = empleado['NOMBRE / APELLIDOS'] || codigo;
        const email = empleado['CORREO ELECTRONICO'] || null;
        const fichaje = fichajeByCodigo.get(codigo);
        const login = loginByCodigo.get(codigo);

        return {
          codigo,
          nombre: nombre || codigo,
          email: email || null,
          centro: empleado['CENTRO TRABAJO'] || null,
          grupo: empleado.GRUPO || null,
          estado: empleado.ESTADO || null,
          loginCount: login?.count ?? 0,
          fichajesCount: fichaje?.count ?? 0,
          lastLogin: login?.lastLogin ?? null,
          lastFichaje: fichaje?.lastFecha ?? null,
        };
      });

      this.logger.log(
        `✅ Empleados stats retrieved: ${stats.length} empleados`,
      );

      return stats;
    } catch (error: any) {
      this.logger.error('❌ Error getting empleados stats:', error);
      throw error;
    }
  }
}
