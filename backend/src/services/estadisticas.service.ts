import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HorasTrabajadasService } from './horas-trabajadas.service';

@Injectable()
export class EstadisticasService {
  private readonly logger = new Logger(EstadisticasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly horasTrabajadasService: HorasTrabajadasService,
  ) {}

  /**
   * Obține statistici pentru ore lucrate pe lună (pentru grafice)
   * Replică funcționalitatea n8n pentru tipoRaport: 'horasTrabajadasMensuales'
   */
  async getHorasTrabajadasMensuales(
    tipo: 'mensual' | 'anual',
    ano: number,
    mes?: number,
    centro?: string,
  ): Promise<any[]> {
    try {
      this.logger.log(
        `📊 Get horas trabajadas mensuales - tipo: ${tipo}, ano: ${ano}, mes: ${mes}, centro: ${centro || 'todos'}`,
      );

      if (tipo === 'mensual' && mes) {
        const mesStr = `${ano}-${String(mes).padStart(2, '0')}`;
        const resumen =
          await this.horasTrabajadasService.getResumenMensual(mesStr);

        // Transformă datele în formatul așteptat de ChartsSection.jsx
        // ChartsSection.jsx așteaptă: { luna: "2025-10", ore_lucrate: 160, totalHoras: 160, mesNumero: 10 }
        const transformed = resumen.map((item) => ({
          luna: item.mes || mesStr,
          mesNumero: mes,
          ore_lucrate:
            typeof item.horasTrabajadas === 'number'
              ? item.horasTrabajadas
              : parseFloat(item.horasTrabajadas || '0'),
          totalHoras:
            typeof item.horasTrabajadas === 'number'
              ? item.horasTrabajadas
              : parseFloat(item.horasTrabajadas || '0'),
          empleadoId: item.empleadoId,
          empleadoNombre: item.empleadoNombre,
          grupo: item.grupo,
          centroTrabajo: item.centroTrabajo,
        }));

        // Filtrează pe centru dacă este specificat
        if (centro && centro !== 'todos') {
          return transformed.filter((item) => item.centroTrabajo === centro);
        }

        return transformed;
      }

      if (tipo === 'anual') {
        const resumen = await this.horasTrabajadasService.getResumenAnual(
          String(ano),
        );

        // Transformă datele pentru raport anual
        const transformed = resumen.map((item) => ({
          luna: item.mes || `${ano}-01`,
          mesNumero: item.mes ? parseInt(item.mes.split('-')[1], 10) : 1,
          ore_lucrate:
            typeof item.horasTrabajadas === 'number'
              ? item.horasTrabajadas
              : parseFloat(item.horasTrabajadas || '0'),
          totalHoras:
            typeof item.horasTrabajadas === 'number'
              ? item.horasTrabajadas
              : parseFloat(item.horasTrabajadas || '0'),
          empleadoId: item.empleadoId,
          empleadoNombre: item.empleadoNombre,
          grupo: item.grupo,
          centroTrabajo: item.centroTrabajo,
        }));

        // Filtrează pe centru dacă este specificat
        if (centro && centro !== 'todos') {
          return transformed.filter((item) => item.centroTrabajo === centro);
        }

        return transformed;
      }

      throw new BadRequestException(
        'Invalid tipo: must be "mensual" or "anual"',
      );
    } catch (error: any) {
      this.logger.error('❌ Error getting horas trabajadas mensuales:', error);
      throw error;
    }
  }

  /**
   * Obține statistici agregate pentru fichajes
   * Replică funcționalitatea n8n pentru tipoRaport: 'fichajes'
   * Returnează: { intrari_total, iesiri_total, fara_iesire_total, fara_iesire_detaliat }
   */
  async getFichajesAgregados(
    tipo: 'mensual' | 'anual' | 'rango',
    ano?: number,
    mes?: number,
    desde?: string,
    hasta?: string,
    centro?: string,
  ): Promise<any> {
    try {
      this.logger.log(
        `📊 Get fichajes agregados - tipo: ${tipo}, ano: ${ano}, mes: ${mes}, centro: ${centro || 'todos'}`,
      );

      // Construiește condițiile de filtrare pentru perioadă
      let fechaInicio: string;
      let fechaFin: string;

      if (tipo === 'mensual' && ano && mes) {
        fechaInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const lastDay = new Date(ano, mes, 0).getDate();
        fechaFin = `${ano}-${String(mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      } else if (tipo === 'anual' && ano) {
        fechaInicio = `${ano}-01-01`;
        fechaFin = `${ano}-12-31`;
      } else if (tipo === 'rango' && desde && hasta) {
        fechaInicio = desde;
        fechaFin = hasta;
      } else {
        throw new BadRequestException(
          'Invalid parameters: tipo mensual requires ano and mes, tipo anual requires ano, tipo rango requires desde and hasta',
        );
      }

      // Construiește query-ul pentru statistici fichajes
      let centroFilter = '';
      if (centro && centro !== 'todos' && typeof centro === 'string') {
        centroFilter = `AND de.\`CENTRO TRABAJO\` = ${this.escapeSql(String(centro))}`;
      }

      const query = `
        WITH fichajes_por_dia AS (
          SELECT
            f.CODIGO,
            DATE(f.FECHA) AS fecha,
            f.TIPO,
            de.\`NOMBRE / APELLIDOS\` AS nombre,
            de.\`CENTRO TRABAJO\` AS centro
          FROM Fichaje f
          INNER JOIN DatosEmpleados de ON f.CODIGO = de.CODIGO
          WHERE f.FECHA >= ${this.escapeSql(fechaInicio)}
            AND f.FECHA <= ${this.escapeSql(fechaFin)}
            ${centroFilter}
        ),
        entradas AS (
          SELECT CODIGO, fecha, nombre, centro
          FROM fichajes_por_dia
          WHERE TIPO = 'Entrada'
        ),
        salidas AS (
          SELECT CODIGO, fecha, nombre, centro
          FROM fichajes_por_dia
          WHERE TIPO = 'Salida'
        ),
          -- Sin salida completă (fără salida deloc)
          fara_iesire AS (
            SELECT e.CODIGO, e.fecha, e.nombre, e.centro
            FROM entradas e
            LEFT JOIN salidas s1 ON e.CODIGO = s1.CODIGO AND e.fecha = s1.fecha
            LEFT JOIN salidas s2 ON e.CODIGO = s2.CODIGO AND s2.fecha = DATE_ADD(e.fecha, INTERVAL 1 DAY)
            LEFT JOIN salidas s3 ON e.CODIGO = s3.CODIGO AND s3.fecha > DATE_ADD(e.fecha, INTERVAL 1 DAY)
            WHERE s1.CODIGO IS NULL AND s2.CODIGO IS NULL AND s3.CODIGO IS NULL
          ),
          -- Salida întârziată (salida după 2+ zile)
          salida_intarziata AS (
            SELECT e.CODIGO, e.fecha, e.nombre, e.centro, MIN(s.fecha) AS fecha_salida
            FROM entradas e
            LEFT JOIN salidas s1 ON e.CODIGO = s1.CODIGO AND e.fecha = s1.fecha
            LEFT JOIN salidas s2 ON e.CODIGO = s2.CODIGO AND s2.fecha = DATE_ADD(e.fecha, INTERVAL 1 DAY)
            INNER JOIN salidas s ON e.CODIGO = s.CODIGO AND s.fecha > DATE_ADD(e.fecha, INTERVAL 1 DAY)
            WHERE s1.CODIGO IS NULL AND s2.CODIGO IS NULL
            GROUP BY e.CODIGO, e.fecha, e.nombre, e.centro
          )
        SELECT
          (SELECT COUNT(*) FROM entradas) AS intrari_total,
          (SELECT COUNT(*) FROM salidas) AS iesiri_total,
          (SELECT COUNT(*) FROM fara_iesire) AS fara_iesire_total,
          (SELECT COUNT(*) FROM salida_intarziata) AS salida_intarziata_total
      `;

      this.logger.log(
        `📊 Executing fichajes agregados query for periodo: ${fechaInicio} to ${fechaFin}, centro: ${centro || 'todos'}`,
      );
      this.logger.debug(`📝 Query: ${query.substring(0, 200)}...`);
      try {
        const result = await this.prisma.$queryRawUnsafe<any[]>(query);
        this.logger.log(
          `✅ Query executed successfully, result count: ${result?.length || 0}`,
        );
        const data = result?.[0] || {};

        // ✅ Query separat pentru fara_iesire_detaliat (JSON_ARRAYAGG nu este disponibil în MySQL < 5.7.22)
        const detalleQuery = `
          WITH fichajes_por_dia AS (
            SELECT
              f.CODIGO,
              DATE(f.FECHA) AS fecha,
              f.TIPO,
              de.\`NOMBRE / APELLIDOS\` AS nombre,
              de.\`CENTRO TRABAJO\` AS centro
            FROM Fichaje f
            INNER JOIN DatosEmpleados de ON f.CODIGO = de.CODIGO
            WHERE f.FECHA >= ${this.escapeSql(fechaInicio)}
              AND f.FECHA <= ${this.escapeSql(fechaFin)}
              ${centroFilter}
          ),
          entradas AS (
            SELECT CODIGO, fecha, nombre, centro
            FROM fichajes_por_dia
            WHERE TIPO = 'Entrada'
          ),
          salidas AS (
            SELECT CODIGO, fecha, nombre, centro
            FROM fichajes_por_dia
            WHERE TIPO = 'Salida'
          ),
          -- Sin salida completă (fără salida deloc)
          fara_iesire AS (
            SELECT e.CODIGO, e.fecha, e.nombre, e.centro
            FROM entradas e
            LEFT JOIN salidas s1 ON e.CODIGO = s1.CODIGO AND e.fecha = s1.fecha
            LEFT JOIN salidas s2 ON e.CODIGO = s2.CODIGO AND s2.fecha = DATE_ADD(e.fecha, INTERVAL 1 DAY)
            LEFT JOIN salidas s3 ON e.CODIGO = s3.CODIGO AND s3.fecha > DATE_ADD(e.fecha, INTERVAL 1 DAY)
            WHERE s1.CODIGO IS NULL AND s2.CODIGO IS NULL AND s3.CODIGO IS NULL
          ),
          -- Salida întârziată (salida după 2+ zile)
          salida_intarziata AS (
            SELECT e.CODIGO, e.fecha, e.nombre, e.centro, MIN(s.fecha) AS fecha_salida
            FROM entradas e
            LEFT JOIN salidas s1 ON e.CODIGO = s1.CODIGO AND e.fecha = s1.fecha
            LEFT JOIN salidas s2 ON e.CODIGO = s2.CODIGO AND s2.fecha = DATE_ADD(e.fecha, INTERVAL 1 DAY)
            INNER JOIN salidas s ON e.CODIGO = s.CODIGO AND s.fecha > DATE_ADD(e.fecha, INTERVAL 1 DAY)
            WHERE s1.CODIGO IS NULL AND s2.CODIGO IS NULL
            GROUP BY e.CODIGO, e.fecha, e.nombre, e.centro
          )
          SELECT
            fi.CODIGO AS codigo,
            fi.nombre AS nombre,
            DATE_FORMAT(fi.fecha, '%Y-%m-%d') AS fecha,
            fi.centro AS centro,
            f.HORA AS hora,
            f.DIRECCION AS direccion,
            NULL AS fecha_salida,
            'sin_salida' AS tipo
          FROM fara_iesire fi
          INNER JOIN Fichaje f ON f.CODIGO = fi.CODIGO 
            AND DATE(f.FECHA) = fi.fecha 
            AND f.TIPO = 'Entrada'
          UNION ALL
          SELECT
            si.CODIGO AS codigo,
            si.nombre AS nombre,
            DATE_FORMAT(si.fecha, '%Y-%m-%d') AS fecha,
            si.centro AS centro,
            f2.HORA AS hora,
            f2.DIRECCION AS direccion,
            DATE_FORMAT(si.fecha_salida, '%Y-%m-%d') AS fecha_salida,
            'salida_intarziata' AS tipo
          FROM salida_intarziata si
          INNER JOIN Fichaje f2 ON f2.CODIGO = si.CODIGO 
            AND DATE(f2.FECHA) = si.fecha 
            AND f2.TIPO = 'Entrada'
          ORDER BY fecha DESC, nombre ASC
        `;

        let faraIesireDetaliat: any[] = [];
        let salidaIntarziataDetaliat: any[] = [];
        try {
          const detalleResult =
            await this.prisma.$queryRawUnsafe<any[]>(detalleQuery);
          const rawRecords = Array.isArray(detalleResult) ? detalleResult : [];
          this.logger.log(
            `✅ Fara iesire detaliat retrieved: ${rawRecords.length} records`,
          );

          // ✅ Grupează datele pe angajat și separă "sin salida" de "salida întârziată"
          // Frontend așteaptă: { CODIGO, NOMBRE, ZILE_FARA_IESIRE: [{ FECHA, HORA, DIRECCION }, ...] }
          const groupedByEmpleadoSinSalida = new Map<
            string,
            {
              CODIGO: string;
              NOMBRE: string;
              ZILE_FARA_IESIRE: Array<{
                FECHA: string;
                HORA: string | null;
                DIRECCION: string | null;
              }>;
            }
          >();
          const groupedByEmpleadoSalidaIntarziata = new Map<
            string,
            {
              CODIGO: string;
              NOMBRE: string;
              ZILE_FARA_IESIRE: Array<{
                FECHA: string;
                HORA: string | null;
                DIRECCION: string | null;
                FECHA_SALIDA: string | null;
              }>;
            }
          >();

          for (const record of rawRecords) {
            const codigo = record.codigo || record.CODIGO || '';
            const nombre = record.nombre || record.NOMBRE || '';
            const fecha = record.fecha || '';
            const hora = record.hora || record.HORA || '';
            const direccion = record.direccion || record.DIRECCION || '';
            const tipo = record.tipo || 'sin_salida';

            if (!codigo || !fecha) continue;

            // Separă în funcție de tip
            if (tipo === 'salida_intarziata') {
              if (!groupedByEmpleadoSalidaIntarziata.has(codigo)) {
                groupedByEmpleadoSalidaIntarziata.set(codigo, {
                  CODIGO: codigo,
                  NOMBRE: nombre,
                  ZILE_FARA_IESIRE: [],
                });
              }

              const empleado = groupedByEmpleadoSalidaIntarziata.get(codigo)!;
              const existingDay = empleado.ZILE_FARA_IESIRE.find(
                (day) => day.FECHA === fecha,
              );

              if (!existingDay) {
                empleado.ZILE_FARA_IESIRE.push({
                  FECHA: fecha,
                  HORA: hora || null,
                  DIRECCION: direccion || null,
                  FECHA_SALIDA: record.fecha_salida || null,
                });
              }
            } else {
              if (!groupedByEmpleadoSinSalida.has(codigo)) {
                groupedByEmpleadoSinSalida.set(codigo, {
                  CODIGO: codigo,
                  NOMBRE: nombre,
                  ZILE_FARA_IESIRE: [],
                });
              }

              const empleado = groupedByEmpleadoSinSalida.get(codigo)!;
              const existingDay = empleado.ZILE_FARA_IESIRE.find(
                (day) => day.FECHA === fecha,
              );

              if (!existingDay) {
                empleado.ZILE_FARA_IESIRE.push({
                  FECHA: fecha,
                  HORA: hora || null,
                  DIRECCION: direccion || null,
                });
              }
            }
          }

          // Sortează zilele pentru fiecare angajat (după FECHA)
          for (const empleado of groupedByEmpleadoSinSalida.values()) {
            empleado.ZILE_FARA_IESIRE.sort((a, b) => {
              if (a.FECHA < b.FECHA) return -1;
              if (a.FECHA > b.FECHA) return 1;
              return 0;
            });
          }

          for (const empleado of groupedByEmpleadoSalidaIntarziata.values()) {
            empleado.ZILE_FARA_IESIRE.sort((a, b) => {
              if (a.FECHA < b.FECHA) return -1;
              if (a.FECHA > b.FECHA) return 1;
              return 0;
            });
          }

          faraIesireDetaliat = Array.from(groupedByEmpleadoSinSalida.values());
          salidaIntarziataDetaliat = Array.from(
            groupedByEmpleadoSalidaIntarziata.values(),
          );
          this.logger.log(
            `✅ Fara iesire detaliat grouped: ${faraIesireDetaliat.length} empleados (sin salida), ${salidaIntarziataDetaliat.length} empleados (salida întârziată)`,
          );

          // Debug: log primul angajat pentru a verifica structura
          if (faraIesireDetaliat.length > 0) {
            this.logger.debug(
              `📝 Sample empleado structure:`,
              JSON.stringify(faraIesireDetaliat[0], null, 2),
            );
          }
        } catch (detalleError: any) {
          this.logger.warn(
            '⚠️ Error fetching fara_iesire_detaliat:',
            detalleError,
          );
          faraIesireDetaliat = [];
        }

        return {
          intrari_total: Number(data.intrari_total || 0),
          iesiri_total: Number(data.iesiri_total || 0),
          fara_iesire_total: Number(data.fara_iesire_total || 0),
          fara_iesire_detaliat: faraIesireDetaliat,
          salida_intarziata_total: Number(data.salida_intarziata_total || 0),
          salida_intarziata_detaliat: salidaIntarziataDetaliat,
        };
      } catch (queryError: any) {
        this.logger.error('❌ SQL Query error:', queryError);
        this.logger.error('❌ Query was:', query);
        throw queryError;
      }
    } catch (error: any) {
      this.logger.error('❌ Error getting fichajes agregados:', error);
      this.logger.error('❌ Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Helper pentru a escapa string-uri SQL (prevenire SQL injection)
   */
  private escapeSql(value: any): string {
    if (value === null || value === undefined) return 'NULL';
    const str = String(value);
    if (!str || str.trim() === '') return 'NULL';
    return `'${str.replace(/'/g, "''")}'`;
  }
}
