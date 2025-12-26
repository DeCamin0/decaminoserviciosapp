import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmpleadosStatsService {
  private readonly logger = new Logger(EmpleadosStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obține statistici pentru toți angajații
   * Returnează: logins count, fichajes count, ultimul login, etc.
   */
  async getEmpleadosStats() {
    try {
      // Obține toți angajații
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

      // Pentru fiecare angajat, obține statistici
      const statsPromises = empleados.map(async (empleado) => {
        const codigo = empleado.CODIGO;
        const email = empleado['CORREO ELECTRONICO'] || null;
        const nombre = empleado['NOMBRE / APELLIDOS'] || codigo;

        // Numără logins (action = 'login' sau 'page_access' pentru prima pagină)
        const loginCount = await this.prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count
          FROM Logs
          WHERE (action = 'login' OR (action = 'page_access' AND url LIKE '%/inicio%'))
            AND (email = ${email} OR user = ${nombre} OR user LIKE ${`%${nombre}%`})
        `;

        // Numără fichajes (registros) - tabela se numește Fichaje
        const fichajesCount = await this.prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count
          FROM Fichaje
          WHERE CODIGO = ${codigo}
        `;

        // Ultimul login
        const lastLogin = await this.prisma.$queryRaw<any[]>`
          SELECT timestamp, action, url
          FROM Logs
          WHERE (action = 'login' OR (action = 'page_access' AND url LIKE '%/inicio%'))
            AND (email = ${email} OR user = ${nombre} OR user LIKE ${`%${nombre}%`})
          ORDER BY timestamp DESC
          LIMIT 1
        `;

        // Ultimul fichaje
        const lastFichaje = await this.prisma.$queryRaw<any[]>`
          SELECT FECHA, HORA
          FROM Fichaje
          WHERE CODIGO = ${codigo}
          ORDER BY FECHA DESC, HORA DESC
          LIMIT 1
        `;

        return {
          codigo,
          nombre: nombre || codigo,
          email: email || null,
          centro: empleado['CENTRO TRABAJO'] || null,
          grupo: empleado.GRUPO || null,
          estado: empleado.ESTADO || null,
          loginCount: Number(loginCount[0]?.count || 0),
          fichajesCount: Number(fichajesCount[0]?.count || 0),
          lastLogin: lastLogin[0]?.timestamp || null,
          lastFichaje: lastFichaje[0]?.FECHA || null,
        };
      });

      const stats = await Promise.all(statsPromises);

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
