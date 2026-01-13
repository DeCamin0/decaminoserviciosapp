import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DespidoAutomationCronService {
  private readonly logger = new Logger(DespidoAutomationCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cron job zilnic la 00:00 pentru automatizarea statusului angajaților
   * cu fecha_baja_programada în trecut
   */
  @Cron('0 0 * * *') // Zilnic la 00:00
  async handleDespidoAutomation() {
    this.logger.log(
      '⏰ Cron job declanșat automat pentru automatizare despido',
    );
    await this.processDespidoAutomation();
  }

  /**
   * Procesează automatizarea statusului (folosit și pentru testare manuală)
   */
  async processDespidoAutomation() {
    this.logger.log(
      '🔄 Verificare angajați cu fecha_baja_programada în trecut...',
    );

    try {
      // Găsește angajații cu fecha_baja_programada < CURDATE() și ESTADO = 'ACTIVO'
      const query = `
        SELECT 
          CODIGO,
          \`NOMBRE / APELLIDOS\` AS nombre,
          \`fecha_baja_programada\` AS fecha_baja_programada,
          ESTADO,
          \`FECHA BAJA\` AS fecha_baja
        FROM DatosEmpleados
        WHERE \`fecha_baja_programada\` IS NOT NULL
          AND DATE(\`fecha_baja_programada\`) < CURDATE()
          AND ESTADO = 'ACTIVO'
      `;

      const empleados = await this.prisma.$queryRawUnsafe<any[]>(query);

      if (empleados.length === 0) {
        this.logger.log(
          'ℹ️ Nu există angajați cu fecha_baja_programada în trecut',
        );
        return;
      }

      this.logger.log(
        `📋 Găsiți ${empleados.length} angajați pentru automatizare status`,
      );

      let processed = 0;
      let errors = 0;

      for (const empleado of empleados) {
        try {
          const codigo = empleado.CODIGO;
          const fechaBajaProgramada = empleado.fecha_baja_programada;

          // Format fecha_baja_programada pentru UPDATE
          let fechaBajaSQL = 'NULL';
          if (fechaBajaProgramada) {
            const fechaDate = new Date(fechaBajaProgramada);
            if (!isNaN(fechaDate.getTime())) {
              const fechaFormatted = fechaDate.toISOString().split('T')[0];
              fechaBajaSQL = this.escapeSql(fechaFormatted);
            }
          }

          // Actualizează ESTADO și FECHA_BAJA
          const updateQuery = `
            UPDATE DatosEmpleados
            SET ESTADO = ${this.escapeSql('INACTIVO')},
                \`FECHA BAJA\` = ${fechaBajaSQL}
            WHERE CODIGO = ${this.escapeSql(codigo)}
              AND ESTADO = ${this.escapeSql('ACTIVO')}
          `;

          await this.prisma.$executeRawUnsafe(updateQuery);

          this.logger.log(
            `✅ Angajat ${codigo} (${empleado.nombre || 'N/A'}) actualizat: ESTADO = INACTIVO, FECHA_BAJA = ${fechaBajaSQL}`,
          );

          processed++;
        } catch (error: any) {
          this.logger.error(
            `❌ Eroare la actualizarea angajatului ${empleado.CODIGO}: ${error.message}`,
          );
          errors++;
        }
      }

      this.logger.log(
        `✅ Automatizare completă: ${processed} procesați, ${errors} erori`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Eroare în cron job pentru automatizare despido: ${error.message}`,
      );
    }
  }

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
}
