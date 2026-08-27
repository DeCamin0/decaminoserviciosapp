import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

@Injectable()
export class VacacionesService {
  private readonly logger = new Logger(VacacionesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Días de Asuntos Propios anuales (toda la empresa). Configurable en
   * asuntos_propios_disponibilidad_config.dias_anuales.
   */
  private async getAsuntosPropiosDiasAnualesEmpresa(): Promise<number> {
    try {
      const row =
        await this.prisma.asuntosPropiosDisponibilidadConfig.findUnique({
          where: { id: 1 },
        });
      const raw = row ? Number(row.dias_anuales) : 6;
      if (!Number.isFinite(raw)) return 6;
      return Math.min(365, Math.max(0, Math.round(raw)));
    } catch (e: any) {
      this.logger.warn(
        `getAsuntosPropiosDiasAnualesEmpresa fallback 6: ${e?.message}`,
      );
      return 6;
    }
  }

  /**
   * Obtiene el convenio de un empleado según su GRUPO
   */
  private async getConvenioByGrupo(grupo: string | null): Promise<{
    convenio_id: number;
    convenio_nombre: string;
    dias_vacaciones_anuales: number;
    dias_asuntos_propios_anuales: number;
  } | null> {
    if (!grupo || grupo.trim() === '') {
      return null;
    }

    const grupoNormalizado = grupo.trim();

    // Buscar en ConvenioGrupo (case-insensitive matching)
    const query = `
      SELECT 
        cg.id,
        cg.convenio_id,
        cg.grupo_nombre,
        c.id as convenio_id_real,
        c.nombre as convenio_nombre,
        c.activo as convenio_activo,
        cc.dias_vacaciones_anuales,
        cc.dias_asuntos_propios_anuales
      FROM convenio_grupo cg
      INNER JOIN convenios c ON cg.convenio_id = c.id
      LEFT JOIN convenio_config cc ON c.id = cc.convenio_id AND cc.activo = TRUE
      WHERE LOWER(TRIM(cg.grupo_nombre)) = LOWER(${this.escapeSql(grupoNormalizado)})
        AND cg.activo = TRUE
        AND c.activo = TRUE
      LIMIT 1
    `;

    const resultados = await this.prisma.$queryRawUnsafe<any[]>(query);

    if (!resultados || resultados.length === 0) {
      // No log warning - algunos grupos (Developer, Supervisor, etc.) no tienen convenio asignado
      return null;
    }

    const convenioGrupo = resultados[0];

    if (!convenioGrupo.convenio_activo) {
      this.logger.warn(
        `⚠️ Convenio inactivo para grupo: "${grupoNormalizado}"`,
      );
      return null;
    }

    if (!convenioGrupo.dias_vacaciones_anuales) {
      this.logger.warn(
        `⚠️ No se encontró configuración para convenio: ${convenioGrupo.convenio_nombre}`,
      );
      return null;
    }

    return {
      convenio_id: convenioGrupo.convenio_id_real,
      convenio_nombre: convenioGrupo.convenio_nombre,
      dias_vacaciones_anuales: convenioGrupo.dias_vacaciones_anuales || 0,
      dias_asuntos_propios_anuales:
        convenioGrupo.dias_asuntos_propios_anuales || 0,
    };
  }

  /**
   * Parsea una fecha en formato string a Date
   * Soporta formatos: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
   */
  private parseFecha(fechaStr: string | null | undefined): Date | null {
    if (!fechaStr || fechaStr.trim() === '') {
      return null;
    }

    const str = fechaStr.trim();

    // Formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const date = new Date(str);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Formato DD/MM/YYYY o DD-MM-YYYY
    const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // Mes en JS es 0-indexed
      let year = parseInt(match[3], 10);

      // Convertir año de 2 dígitos a 4 dígitos
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year;
      }

      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    this.logger.warn(`⚠️ No se pudo parsear fecha: "${fechaStr}"`);
    return null;
  }

  /**
   * Calcula días generados (devengo mensual) desde fecha inicio hasta hoy
   * Reglas:
   * - Devengo mensual: dias_anuales / 12 por cada mes trabajado
   * - Fecha inicio: max(FECHA_DE_ALTA, 1 enero del año actual)
   * - Mes iniciado = mes completo
   * - Redondeo al múltiplo de 0.5
   */
  private calcularDiasGenerados(
    diasAnuales: number,
    fechaInicio: Date | null,
  ): number {
    if (!fechaInicio) {
      return 0;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Fecha inicio: max(FECHA_DE_ALTA, 1 enero del año actual)
    const primeroEnero = new Date(hoy.getFullYear(), 0, 1);
    const fechaInicioCalculo =
      fechaInicio > primeroEnero ? fechaInicio : primeroEnero;

    if (fechaInicioCalculo > hoy) {
      return 0;
    }

    // Calcular meses completos trabajados
    let meses = 0;
    const fechaActual = new Date(fechaInicioCalculo);

    while (fechaActual <= hoy) {
      // Avanzar al primer día del mes siguiente
      fechaActual.setMonth(fechaActual.getMonth() + 1);
      fechaActual.setDate(1);

      if (fechaActual <= hoy) {
        meses++;
      }
    }

    // Si el mes actual está iniciado, contar como completo
    if (fechaInicioCalculo <= hoy) {
      const mesInicio = fechaInicioCalculo.getMonth();
      const añoInicio = fechaInicioCalculo.getFullYear();
      const mesHoy = hoy.getMonth();
      const añoHoy = hoy.getFullYear();

      if (añoInicio === añoHoy && mesInicio === mesHoy) {
        meses++; // Mes actual iniciado = completo
      }
    }

    // Calcular días: (dias_anuales / 12) * meses
    const diasGenerados = (diasAnuales / 12) * meses;

    // Redondear al múltiplo de 0.5
    const diasRedondeados = Math.round(diasGenerados * 2) / 2;

    return diasRedondeados;
  }

  /**
   * Helper para escapar valores SQL
   */
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

  /**
   * Cuenta días naturales entre dos fechas (ambos inclusive).
   * Si soloDisfrutados=true, solo cuenta días hasta hoy (vacaciones ya disfrutadas).
   */
  private contarDiasPeriodo(
    fechaInicio: Date,
    fechaFin: Date,
    soloDisfrutados: boolean,
  ): number {
    const inicio = new Date(fechaInicio);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(fechaFin);
    fin.setHours(0, 0, 0, 0);

    if (soloDisfrutados) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (inicio > hoy) {
        return 0;
      }
      const finEfectivo = fin <= hoy ? fin : hoy;
      const diffTime = finEfectivo.getTime() - inicio.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    const diffTime = fin.getTime() - inicio.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  /**
   * Calcula días consumidos de solicitudes aprobadas
   * Cuenta días naturales desde fecha_inicio hasta fecha_fin (ambos inclusive).
   * Asuntos propios: solo solicitudes del año en curso (por fecha_inicio).
   */
  private async calcularDiasConsumidos(
    codigo: string,
    tipo: 'Vacaciones' | 'Asunto Propio',
    soloDisfrutados = false,
  ): Promise<number> {
    // Usar query raw para obtener solicitudes aprobadas
    const query =
      tipo === 'Asunto Propio'
        ? `
      SELECT 
        fecha_inicio,
        fecha_fin
      FROM solicitudes
      WHERE codigo = ${this.escapeSql(codigo)}
        AND tipo IN ('Asunto Propio', 'Asuntos Propios')
        AND estado = 'Aprobada'
        AND YEAR(fecha_inicio) = YEAR(CURDATE())
    `
        : `
      SELECT 
        fecha_inicio,
        fecha_fin
      FROM solicitudes
      WHERE codigo = ${this.escapeSql(codigo)}
        AND tipo = ${this.escapeSql(tipo)}
        AND estado = 'Aprobada'
    `;

    const solicitudes = await this.prisma.$queryRawUnsafe<any[]>(query);
    let totalDias = 0;

    for (const solicitud of solicitudes) {
      const fechaInicio = solicitud.fecha_inicio
        ? new Date(solicitud.fecha_inicio)
        : null;
      let fechaFin: Date | null = null;

      // fecha_fin puede ser string o Date
      if (solicitud.fecha_fin) {
        if (typeof solicitud.fecha_fin === 'string') {
          fechaFin = this.parseFecha(solicitud.fecha_fin);
        } else {
          fechaFin = new Date(solicitud.fecha_fin);
        }
      }

      if (
        fechaInicio &&
        fechaFin &&
        !isNaN(fechaInicio.getTime()) &&
        !isNaN(fechaFin.getTime())
      ) {
        totalDias += this.contarDiasPeriodo(
          fechaInicio,
          fechaFin,
          soloDisfrutados,
        );
      }
    }

    return totalDias;
  }

  /**
   * Calcula el saldo de vacaciones y asuntos propios para un empleado
   */
  async calcularSaldo(codigo: string): Promise<{
    vacaciones: {
      dias_anuales: number;
      dias_generados_hasta_hoy: number;
      dias_consumidos_aprobados: number;
      dias_disfrutados_aprobados: number;
      dias_restantes_ano_anterior: number;
      dias_restantes: number;
    };
    asuntos_propios: {
      dias_anuales: number;
      dias_consumidos_aprobados: number;
      dias_restantes: number;
    };
  }> {
    try {
      // Obtener empleado
      const empleado = await this.prisma.user.findUnique({
        where: { CODIGO: codigo },
        select: {
          CODIGO: true,
          GRUPO: true,
          FECHA_DE_ALTA: true,
          ESTADO: true,
          VACACIONES_RESTANTES_ANO_ANTERIOR: true,
        },
      });

      // Obtener valores personalizados (si existen)
      // Folosim query direct pentru a obține valorile din DatosEmpleados
      // CAST la DECIMAL(10,1) pentru a forța conversia corectă
      const empleadoPersonalizado = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          CAST(\`VACACIONES_ANUALES_PERSONALIZADAS\` AS DECIMAL(10,1)) as vacaciones_personalizadas,
          CAST(\`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\` AS DECIMAL(10,1)) as asuntos_personalizados
        FROM DatosEmpleados
        WHERE CODIGO = ${this.escapeSql(codigo)}
        LIMIT 1
      `);

      // Procesează valorile - DECIMAL poate fi returnat ca Decimal object, string sau number
      let vacacionesPersonalizadas: number | null = null;
      let asuntosPersonalizados: number | null = null;

      if (empleadoPersonalizado && empleadoPersonalizado[0]) {
        const vac = empleadoPersonalizado[0].vacaciones_personalizadas;
        const asu = empleadoPersonalizado[0].asuntos_personalizados;

        this.logger.debug(
          `🔍 [calcularSaldo] ${codigo} - Raw valores: vac=${vac} (type: ${typeof vac}), asu=${asu} (type: ${typeof asu})`,
        );

        // Verifică dacă nu sunt NULL (poate fi null, undefined, Decimal object, sau string "NULL")
        // IMPORTANT: 0 este o valoare validă și trebuie procesată (nu trebuie ignorată)
        if (vac !== null && vac !== undefined && vac !== 'NULL' && vac !== '') {
          // Handle Decimal object (from Prisma) - DECIMAL în MySQL este returnat ca Decimal object
          if (typeof vac === 'object' && vac !== null) {
            try {
              // Prisma Decimal object are metode toString() și valueOf()
              // Încearcă toNumber() dacă există (metodă specifică Decimal)
              if (typeof vac.toNumber === 'function') {
                vacacionesPersonalizadas = vac.toNumber();
              }
              // Altfel încearcă valueOf()
              else if (typeof vac.valueOf === 'function') {
                vacacionesPersonalizadas = Number(vac.valueOf());
              }
              // Altfel încearcă toString() și apoi Number()
              else if (typeof vac.toString === 'function') {
                vacacionesPersonalizadas = Number(vac.toString());
              }
              // Ultimul fallback - direct Number()
              else {
                vacacionesPersonalizadas = Number(vac);
              }
            } catch (e: any) {
              this.logger.warn(
                `⚠️ [calcularSaldo] Error converting vacaciones DECIMAL for ${codigo}: ${e.message}`,
              );
              vacacionesPersonalizadas = null;
            }
          } else {
            vacacionesPersonalizadas =
              typeof vac === 'number' ? vac : Number(vac);
          }
          // IMPORTANT: 0 este o valoare validă (nu trebuie să fie null)
          // Doar NaN trebuie să fie null
          if (isNaN(vacacionesPersonalizadas)) {
            vacacionesPersonalizadas = null;
          }
          // Dacă este 0, păstrează-l (0 !== null, deci va fi folosit)
        }

        // IMPORTANT: 0 este o valoare validă și trebuie procesată (nu trebuie ignorată)
        // NULL = folosește convenio, 0 = folosește 0 explicit
        if (asu !== null && asu !== undefined && asu !== 'NULL' && asu !== '') {
          // Handle Decimal object (from Prisma)
          if (typeof asu === 'object' && asu !== null) {
            try {
              if (typeof asu.toNumber === 'function') {
                asuntosPersonalizados = asu.toNumber();
              } else if (typeof asu.valueOf === 'function') {
                asuntosPersonalizados = Number(asu.valueOf());
              } else if (typeof asu.toString === 'function') {
                asuntosPersonalizados = Number(asu.toString());
              } else {
                asuntosPersonalizados = Number(asu);
              }
            } catch (e: any) {
              this.logger.warn(
                `⚠️ [calcularSaldo] Error converting asuntos DECIMAL for ${codigo}: ${e.message}`,
              );
              asuntosPersonalizados = null;
            }
          } else {
            asuntosPersonalizados = typeof asu === 'number' ? asu : Number(asu);
          }
          // IMPORTANT: 0 este o valoare validă (nu trebuie să fie null)
          // Doar NaN sau null efectiv trebuie să fie null
          if (isNaN(asuntosPersonalizados)) {
            asuntosPersonalizados = null;
          }
          // Dacă este 0, păstrează-l (0 !== null, deci va fi folosit)
        }

        this.logger.debug(
          `🔍 [calcularSaldo] ${codigo} - Procesate: vac=${vacacionesPersonalizadas}, asu=${asuntosPersonalizados}`,
        );
      }

      if (!empleado) {
        throw new BadRequestException(
          `Empleado con código ${codigo} no encontrado`,
        );
      }

      // Verificar estado (case-insensitive)
      const estadoNormalizado = String(empleado.ESTADO || '')
        .toUpperCase()
        .trim();
      if (estadoNormalizado !== 'ACTIVO') {
        this.logger.warn(
          `⚠️ Empleado ${codigo} no está activo (ESTADO: ${empleado.ESTADO})`,
        );
        // Retornar valores por defecto si no está activo
        return {
          vacaciones: {
            dias_anuales: 0,
            dias_generados_hasta_hoy: 0,
            dias_consumidos_aprobados: 0,
            dias_disfrutados_aprobados: 0,
            dias_restantes_ano_anterior: 0,
            dias_restantes: 0,
          },
          asuntos_propios: {
            dias_anuales: 0,
            dias_consumidos_aprobados: 0,
            dias_restantes: 0,
          },
        };
      }

      // Obtener convenio según GRUPO (vacaciones) + config empresa (asuntos propios)
      const [convenio, diasApEmpresa] = await Promise.all([
        this.getConvenioByGrupo(empleado.GRUPO),
        this.getAsuntosPropiosDiasAnualesEmpresa(),
      ]);

      // Usar valores personalizados si existen, sino convenio (vacaciones) / config empresa (AP)
      const diasVacacionesAnuales =
        vacacionesPersonalizadas !== null
          ? vacacionesPersonalizadas
          : convenio?.dias_vacaciones_anuales || 0;

      const diasAsuntosPropiosAnuales =
        asuntosPersonalizados !== null ? asuntosPersonalizados : diasApEmpresa;

      if (!convenio && vacacionesPersonalizadas === null) {
        // Sin convenio: vacaciones 0; AP sigue la config global (o personalizado)
        const restantesAnoAnteriorDefault =
          empleado.VACACIONES_RESTANTES_ANO_ANTERIOR
            ? Number(empleado.VACACIONES_RESTANTES_ANO_ANTERIOR)
            : 0;
        const diasConsumidosAp = await this.calcularDiasConsumidos(
          codigo,
          'Asunto Propio',
        );
        return {
          vacaciones: {
            dias_anuales: 0,
            dias_generados_hasta_hoy: 0,
            dias_consumidos_aprobados: 0,
            dias_disfrutados_aprobados: 0,
            dias_restantes_ano_anterior: restantesAnoAnteriorDefault,
            dias_restantes: Math.max(0, restantesAnoAnteriorDefault),
          },
          asuntos_propios: {
            dias_anuales: diasAsuntosPropiosAnuales,
            dias_consumidos_aprobados: diasConsumidosAp,
            dias_restantes: Math.max(
              0,
              diasAsuntosPropiosAnuales - diasConsumidosAp,
            ),
          },
        };
      }

      // Parsear FECHA_DE_ALTA
      const fechaAlta = this.parseFecha(empleado.FECHA_DE_ALTA);

      // Calcular días generados (devengo mensual)
      const diasGeneradosVacaciones = this.calcularDiasGenerados(
        diasVacacionesAnuales,
        fechaAlta,
      );

      // Calcular días consumidos
      // Nota: "Asunto Propio" y "Asuntos Propios" son equivalentes en la BD
      const [
        diasConsumidosVacaciones,
        diasDisfrutadosVacaciones,
        diasConsumidosAsuntosPropios,
      ] = await Promise.all([
        this.calcularDiasConsumidos(codigo, 'Vacaciones'),
        this.calcularDiasConsumidos(codigo, 'Vacaciones', true),
        this.calcularDiasConsumidos(codigo, 'Asunto Propio'),
      ]);

      // Obtener días restantes del año anterior (manual)
      const restantesAnoAnterior = empleado.VACACIONES_RESTANTES_ANO_ANTERIOR
        ? Number(empleado.VACACIONES_RESTANTES_ANO_ANTERIOR)
        : 0;

      // Calcular saldo restante (incluyendo días del año anterior)
      const diasRestantesVacaciones =
        diasGeneradosVacaciones +
        restantesAnoAnterior -
        diasConsumidosVacaciones;

      const diasRestantesAsuntosPropios =
        diasAsuntosPropiosAnuales - diasConsumidosAsuntosPropios;

      this.logger.log(
        `✅ Saldo calculado para ${codigo}: Vacaciones ${diasRestantesVacaciones.toFixed(1)} días (${restantesAnoAnterior.toFixed(1)} del año anterior, anuales: ${diasVacacionesAnuales}${vacacionesPersonalizadas !== null ? ' [personalizado]' : ''}), Asuntos Propios ${diasRestantesAsuntosPropios.toFixed(1)} días (anuales: ${diasAsuntosPropiosAnuales}${asuntosPersonalizados !== null ? ' [personalizado]' : ''})`,
      );

      const resultado = {
        vacaciones: {
          dias_anuales: diasVacacionesAnuales,
          dias_generados_hasta_hoy: diasGeneradosVacaciones,
          dias_consumidos_aprobados: diasConsumidosVacaciones,
          dias_disfrutados_aprobados: diasDisfrutadosVacaciones,
          dias_restantes_ano_anterior: restantesAnoAnterior,
          dias_restantes: Math.max(0, diasRestantesVacaciones),
        },
        asuntos_propios: {
          dias_anuales: diasAsuntosPropiosAnuales,
          dias_consumidos_aprobados: diasConsumidosAsuntosPropios,
          dias_restantes: Math.max(0, diasRestantesAsuntosPropios),
        },
      };

      this.logger.debug(
        `🔍 [calcularSaldo] ${codigo} - Return: vac.dias_anuales=${resultado.vacaciones.dias_anuales}, asu.dias_anuales=${resultado.asuntos_propios.dias_anuales}`,
      );

      return resultado;
    } catch (error: any) {
      this.logger.error(`❌ Error calculando saldo para ${codigo}:`, error);
      throw new BadRequestException(
        `Error al calcular saldo: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene estadísticas de vacaciones y asuntos propios para todos los empleados activos
   */
  async obtenerEstadisticasTodos(): Promise<
    Array<{
      codigo: string;
      nombre: string;
      grupo: string | null;
      vacaciones: {
        dias_anuales: number;
        dias_generados_hasta_hoy: number;
        dias_consumidos_aprobados: number;
        dias_disfrutados_aprobados: number;
        dias_restantes_ano_anterior: number;
        dias_restantes: number;
      };
      asuntos_propios: {
        dias_anuales: number;
        dias_consumidos_aprobados: number;
        dias_restantes: number;
      };
    }>
  > {
    try {
      // Obtener todos los empleados activos (case-insensitive)
      const empleados = await this.prisma.user.findMany({
        where: {
          OR: [{ ESTADO: 'ACTIVO' }, { ESTADO: 'Activo' }],
        },
        select: {
          CODIGO: true,
          NOMBRE_APELLIDOS: true,
          GRUPO: true,
        },
        orderBy: {
          NOMBRE_APELLIDOS: 'asc',
        },
      });

      this.logger.log(
        `📊 Obteniendo estadísticas para ${empleados.length} empleados activos`,
      );

      // Calcular saldo para cada empleado
      const estadisticas = await Promise.all(
        empleados.map(async (empleado) => {
          try {
            const saldo = await this.calcularSaldo(empleado.CODIGO);
            return {
              codigo: empleado.CODIGO,
              nombre:
                empleado.NOMBRE_APELLIDOS || `Empleado ${empleado.CODIGO}`,
              grupo: empleado.GRUPO,
              vacaciones: saldo.vacaciones,
              asuntos_propios: saldo.asuntos_propios,
            };
          } catch (error: any) {
            this.logger.warn(
              `⚠️ Error calculando saldo para ${empleado.CODIGO}: ${error.message}`,
            );
            // Retornar valores por defecto en caso de error
            return {
              codigo: empleado.CODIGO,
              nombre:
                empleado.NOMBRE_APELLIDOS || `Empleado ${empleado.CODIGO}`,
              grupo: empleado.GRUPO,
              vacaciones: {
                dias_anuales: 0,
                dias_generados_hasta_hoy: 0,
                dias_consumidos_aprobados: 0,
                dias_disfrutados_aprobados: 0,
                dias_restantes_ano_anterior: 0,
                dias_restantes: 0,
              },
              asuntos_propios: {
                dias_anuales: 0,
                dias_consumidos_aprobados: 0,
                dias_restantes: 0,
              },
            };
          }
        }),
      );

      this.logger.log(
        `✅ Estadísticas obtenidas para ${estadisticas.length} empleados`,
      );

      return estadisticas;
    } catch (error: any) {
      this.logger.error('❌ Error obteniendo estadísticas:', error);
      throw new BadRequestException(
        `Error al obtener estadísticas: ${error.message}`,
      );
    }
  }

  /**
   * Actualiza las vacaciones restantes del año anterior para un empleado
   */
  async updateRestantesAnoAnterior(
    codigo: string,
    restantes: number,
  ): Promise<void> {
    try {
      // Verificar que el empleado existe
      const empleado = await this.prisma.user.findUnique({
        where: { CODIGO: codigo },
        select: { CODIGO: true },
      });

      if (!empleado) {
        throw new BadRequestException(
          `Empleado con código ${codigo} no encontrado`,
        );
      }

      // Actualizar el campo VACACIONES_RESTANTES_ANO_ANTERIOR
      await this.prisma.user.update({
        where: { CODIGO: codigo },
        data: {
          VACACIONES_RESTANTES_ANO_ANTERIOR: restantes,
        },
      });

      this.logger.log(
        `✅ Restantes año anterior actualizados para ${codigo}: ${restantes} días`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Error actualizando restantes año anterior para ${codigo}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Actualiza las vacaciones anuales personalizadas para un empleado
   */
  async updateVacacionesAnualesPersonalizadas(
    codigo: string,
    diasAnuales: number | null,
  ): Promise<void> {
    try {
      // Verificar que el empleado existe
      const empleado = await this.prisma.user.findUnique({
        where: { CODIGO: codigo },
        select: { CODIGO: true },
      });

      if (!empleado) {
        throw new BadRequestException(
          `Empleado con código ${codigo} no encontrado`,
        );
      }

      // Actualizar el campo VACACIONES_ANUALES_PERSONALIZADAS
      const updateQuery = `
        UPDATE DatosEmpleados
        SET \`VACACIONES_ANUALES_PERSONALIZADAS\` = ${diasAnuales !== null ? diasAnuales : 'NULL'}
        WHERE CODIGO = ${this.escapeSql(codigo)}
      `;

      await this.prisma.$executeRawUnsafe(updateQuery);

      this.logger.log(
        `✅ Vacaciones anuales personalizadas actualizadas para ${codigo}: ${diasAnuales !== null ? diasAnuales + ' días' : 'NULL (usará convenio)'}`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Error actualizando vacaciones anuales personalizadas para ${codigo}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Actualiza los asuntos propios anuales personalizados para un empleado
   */
  async updateAsuntosPropiosAnualesPersonalizadas(
    codigo: string,
    diasAnuales: number | null,
  ): Promise<void> {
    try {
      // Verificar que el empleado existe
      const empleado = await this.prisma.user.findUnique({
        where: { CODIGO: codigo },
        select: { CODIGO: true },
      });

      if (!empleado) {
        throw new BadRequestException(
          `Empleado con código ${codigo} no encontrado`,
        );
      }

      // Actualizar el campo ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS
      const updateQuery = `
        UPDATE DatosEmpleados
        SET \`ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS\` = ${diasAnuales !== null ? diasAnuales : 'NULL'}
        WHERE CODIGO = ${this.escapeSql(codigo)}
      `;

      await this.prisma.$executeRawUnsafe(updateQuery);

      this.logger.log(
        `✅ Asuntos propios anuales personalizados actualizados para ${codigo}: ${diasAnuales !== null ? diasAnuales + ' días' : 'NULL (usará convenio)'}`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Error actualizando asuntos propios anuales personalizados para ${codigo}:`,
        error,
      );
      throw error;
    }
  }

  async exportEstadisticasExcel(): Promise<Buffer> {
    try {
      const estadisticas = await this.obtenerEstadisticasTodos();

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Estadísticas Solicitudes');

      // Headers
      worksheet.columns = [
        { header: 'CODIGO', key: 'codigo', width: 15 },
        { header: 'NOMBRE', key: 'nombre', width: 35 },
        { header: 'GRUPO', key: 'grupo', width: 30 },
        { header: 'VAC. ANUALES', key: 'vac_anuales', width: 12 },
        { header: 'VAC. GENERADOS', key: 'vac_generados', width: 15 },
        { header: 'VAC. CONSUMIDOS', key: 'vac_consumidos', width: 15 },
        { header: 'VAC. DISFRUTADOS', key: 'vac_disfrutados', width: 15 },
        {
          header: 'VAC. REST. AÑO PASADO',
          key: 'vac_rest_ano_pasado',
          width: 20,
        },
        { header: 'VAC. RESTANTES', key: 'vac_restantes', width: 15 },
        { header: 'ASUNTOS ANUALES', key: 'asuntos_anuales', width: 15 },
        { header: 'ASUNTOS CONSUMIDOS', key: 'asuntos_consumidos', width: 18 },
        { header: 'ASUNTOS RESTANTES', key: 'asuntos_restantes', width: 18 },
      ];

      // Style headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Add data
      estadisticas.forEach((emp) => {
        worksheet.addRow({
          codigo: emp.codigo,
          nombre: emp.nombre,
          grupo: emp.grupo || '-',
          vac_anuales: emp.vacaciones.dias_anuales,
          vac_generados: emp.vacaciones.dias_generados_hasta_hoy.toFixed(1),
          vac_consumidos: emp.vacaciones.dias_consumidos_aprobados,
          vac_disfrutados: emp.vacaciones.dias_disfrutados_aprobados,
          vac_rest_ano_pasado: emp.vacaciones.dias_restantes_ano_anterior,
          vac_restantes: emp.vacaciones.dias_restantes.toFixed(1),
          asuntos_anuales: emp.asuntos_propios.dias_anuales,
          asuntos_consumidos: emp.asuntos_propios.dias_consumidos_aprobados,
          asuntos_restantes: emp.asuntos_propios.dias_restantes.toFixed(1),
        });
      });

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    } catch (error: any) {
      this.logger.error(
        `❌ Error en exportEstadisticasExcel: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al exportar Excel: ${error.message}`,
      );
    }
  }

  async exportEstadisticasPDF(): Promise<Buffer> {
    try {
      const estadisticas = await this.obtenerEstadisticasTodos();

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
          size: 'A4',
          layout: 'landscape',
          margin: 50,
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Title
        doc
          .fontSize(18)
          .text('Estadísticas de Solicitudes', { align: 'center' });
        doc.moveDown();

        // Table headers
        const headers = [
          'CODIGO',
          'NOMBRE',
          'GRUPO',
          'VAC. ANUALES',
          'VAC. GEN.',
          'VAC. CONS.',
          'VAC. DISFR.',
          'VAC. REST. AÑO PASADO',
          'VAC. REST.',
          'ASUNT. ANUALES',
          'ASUNT. CONS.',
          'ASUNT. REST.',
        ];
        const colWidths = [50, 120, 80, 60, 60, 60, 60, 80, 60, 70, 70, 70];
        const startY = doc.y;
        let currentY = startY;

        // Draw header
        doc.fontSize(7).font('Helvetica-Bold');
        let x = 50;
        headers.forEach((header, i) => {
          doc.text(header, x, currentY, { width: colWidths[i], align: 'left' });
          x += colWidths[i];
        });
        currentY += 20;

        // Draw rows
        doc.font('Helvetica');
        estadisticas.forEach((emp) => {
          if (currentY > 700) {
            doc.addPage();
            currentY = 50;
            // Redraw headers on new page
            x = 50;
            doc.font('Helvetica-Bold');
            headers.forEach((header, i) => {
              doc.text(header, x, currentY, {
                width: colWidths[i],
                align: 'left',
              });
              x += colWidths[i];
            });
            currentY += 20;
            doc.font('Helvetica');
          }

          const row = [
            emp.codigo || '-',
            (emp.nombre || '-').substring(0, 30),
            (emp.grupo || '-').substring(0, 20),
            emp.vacaciones.dias_anuales.toString(),
            emp.vacaciones.dias_generados_hasta_hoy.toFixed(1),
            emp.vacaciones.dias_consumidos_aprobados.toString(),
            emp.vacaciones.dias_disfrutados_aprobados.toString(),
            emp.vacaciones.dias_restantes_ano_anterior.toString(),
            emp.vacaciones.dias_restantes.toFixed(1),
            emp.asuntos_propios.dias_anuales.toString(),
            emp.asuntos_propios.dias_consumidos_aprobados.toString(),
            emp.asuntos_propios.dias_restantes.toFixed(1),
          ];

          x = 50;
          row.forEach((cell, i) => {
            doc
              .fontSize(6)
              .text(cell, x, currentY, { width: colWidths[i], align: 'left' });
            x += colWidths[i];
          });
          currentY += 15;
        });

        doc.end();
      });
    } catch (error: any) {
      this.logger.error(
        `❌ Error en exportEstadisticasPDF: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Error al exportar PDF: ${error.message}`);
    }
  }
}
