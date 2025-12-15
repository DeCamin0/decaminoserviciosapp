import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';

@Injectable()
export class AusenciasService {
  private readonly logger = new Logger(AusenciasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

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
   * Transformă o dată din format string în format YYYY-MM-DD
   */
  private parseFecha(fecha: string | null): {
    inicio: string | null;
    fin: string | null;
  } {
    if (!fecha) {
      return { inicio: null, fin: null };
    }

    const fechaClean = fecha.trim();

    // Detectează formatul: YYYY-MM-DD- YYYY-MM-DD (interval cu aceeași dată, fără spațiu între "-" și "-")
    // Exemplu: "2025-12-08- 2025-12-08" -> tratăm ca interval "2025-12-08 - 2025-12-08"
    const sameDateIntervalPattern = /^(\d{4}-\d{2}-\d{2})-\s*(\1)$/;
    const match = fechaClean.match(sameDateIntervalPattern);
    if (match) {
      const fechaUnica = match[1];
      // Returnează ca interval cu aceeași dată
      return { inicio: fechaUnica, fin: fechaUnica };
    }

    // Verifică dacă este un interval normal (format: "YYYY-MM-DD - YYYY-MM-DD")
    if (fechaClean.includes(' - ')) {
      const partes = fechaClean.split(' - ').map((p) => p.trim());
      const inicio = partes[0] || null;
      const fin = partes[1] || partes[0] || null;
      return { inicio, fin };
    }

    // Dacă nu este interval, este o dată simplă
    return { inicio: fechaClean, fin: fechaClean };
  }

  /**
   * Calculează zilele aprobate pentru tipurile pe zile
   */
  private calculateDiasAprobados(
    tipo: string,
    duracion: string | null,
    fechaInicio: string | null,
    fechaFin: string | null,
  ): number | null {
    // Tipuri de absențe care se calculează în ZILE
    const tipuriZile = [
      'Vacaciones',
      'Asunto Propio',
      'Permiso Retribuido',
      'Permiso Recuperable',
      'Permiso No Retribuido',
      'Permiso sin sueldo',
      'Permiso médico',
      'Permiso',
      'Baja',
    ];

    const tipoLower = tipo.toLowerCase();
    const estePeZile = tipuriZile.some((t) =>
      tipoLower.includes(t.toLowerCase()),
    );

    if (!estePeZile) {
      return null;
    }

    // Dacă avem durata explicită în baza de date, o folosim
    if (duracion !== null && duracion !== undefined && duracion !== '') {
      const duracionNum = Number(duracion);
      if (!isNaN(duracionNum)) {
        return duracionNum;
      }
    }

    // Altfel, calculăm din intervalul de date
    if (fechaInicio && fechaFin) {
      const dInicio = new Date(fechaInicio);
      const dFin = new Date(fechaFin);

      // Verifică dacă datele sunt valide
      if (isNaN(dInicio.getTime()) || isNaN(dFin.getTime())) {
        return null;
      }

      const diffMs = dFin.getTime() - dInicio.getTime();
      const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(1, diffDias); // Minimum 1 zi
    }

    return null;
  }

  /**
   * Normalizează o valoare pentru SQL (tratează 'undefined', '[undefined]', 'null', '', etc. ca NULL)
   */
  private normalizeSqlValue(value: any): any {
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      value === 'undefined' ||
      value === '[undefined]' ||
      value === 'null'
    ) {
      return null;
    }
    return value;
  }

  /**
   * Extrage ora de sfârșit din cuadrante_asignado sau horario_asignado
   */
  private extractFinTime(cuadranteAsignado: any, horarioAsignado: any): string {
    if (cuadranteAsignado?.intervalos?.[0]?.fin) {
      return cuadranteAsignado.intervalos[0].fin;
    }
    if (horarioAsignado?.intervalos?.[0]?.fin) {
      return horarioAsignado.intervalos[0].fin;
    }
    return '00:00';
  }

  /**
   * Extrage orele zilnice din cuadrante_asignado sau horario_asignado
   */
  private extractHorasDiarias(
    cuadranteAsignado: any,
    horarioAsignado: any,
  ): number {
    if (cuadranteAsignado?.horas_diarias) {
      return Number(cuadranteAsignado.horas_diarias) || 0;
    }
    if (horarioAsignado?.horas_diarias) {
      return Number(horarioAsignado.horas_diarias) || 0;
    }
    return 0;
  }

  /**
   * Adaugă o absență nouă (reproduce logica din n8n: registro ausencia.json)
   */
  async addAusencia(ausenciaData: {
    solicitud_id: string;
    codigo: string;
    nombre: string;
    tipo: string;
    data?: string; // pentru dată simplă
    permiso_fecha_inicio?: string; // pentru interval
    permiso_fecha_fin?: string; // pentru interval
    hora: string;
    locatia?: string;
    motivo?: string;
    cuadrante_asignado?: any;
    horario_asignado?: any;
    sin_horario_asignado?: boolean;
  }): Promise<{ success: true; id: number }> {
    try {
      // Validări
      if (
        !ausenciaData.solicitud_id ||
        ausenciaData.solicitud_id.trim() === ''
      ) {
        throw new BadRequestException('solicitud_id is required');
      }
      if (!ausenciaData.codigo || ausenciaData.codigo.trim() === '') {
        throw new BadRequestException('codigo is required');
      }
      if (!ausenciaData.nombre || ausenciaData.nombre.trim() === '') {
        throw new BadRequestException('nombre is required');
      }
      if (!ausenciaData.tipo || ausenciaData.tipo.trim() === '') {
        throw new BadRequestException('tipo is required');
      }
      if (!ausenciaData.hora || ausenciaData.hora.trim() === '') {
        throw new BadRequestException('hora is required');
      }

      // Normalizează datele
      const permisoFechaInicio = this.normalizeSqlValue(
        ausenciaData.permiso_fecha_inicio,
      );
      const permisoFechaFin = this.normalizeSqlValue(
        ausenciaData.permiso_fecha_fin,
      );
      const dataSingle = this.normalizeSqlValue(ausenciaData.data);
      const tipoNorm = (this.normalizeSqlValue(ausenciaData.tipo) || '')
        .toLowerCase()
        .trim();

      // Construiește query-ul SQL exact ca în n8n
      // Folosim SELECT pentru a calcula valorile și apoi INSERT
      const query = `
        INSERT INTO Ausencias (
          solicitud_id,
          CODIGO,
          NOMBRE,
          TIPO,
          FECHA,
          HORA,
          LOCACION,
          MOTIVO,
          DURACION,
          UNIDAD_DURACION
        )
        SELECT
          ${this.escapeSql(ausenciaData.solicitud_id)},
          ${this.escapeSql(ausenciaData.codigo)},
          ${this.escapeSql(ausenciaData.nombre)},
          ${this.escapeSql(ausenciaData.tipo)},
          CASE
            WHEN t.ini IS NOT NULL AND t.fin IS NOT NULL
              THEN CONCAT(DATE_FORMAT(t.ini,'%Y-%m-%d'), ' - ', DATE_FORMAT(t.fin,'%Y-%m-%d'))
            WHEN t.single IS NOT NULL
              THEN DATE_FORMAT(t.single,'%Y-%m-%d')
            ELSE ''
          END AS FECHA,
          ${this.escapeSql(ausenciaData.hora)},
          ${ausenciaData.locatia ? this.escapeSql(ausenciaData.locatia) : 'NULL'},
          CASE
            WHEN t.tipo_norm = 'salida sin regreso'
              THEN CONCAT(${ausenciaData.motivo ? this.escapeSql(ausenciaData.motivo) : "''"}, ' (sin regreso)')
            ELSE ${ausenciaData.motivo ? this.escapeSql(ausenciaData.motivo) : 'NULL'}
          END AS MOTIVO,
          CASE
            WHEN t.tipo_norm = 'salida centro' THEN NULL
            WHEN t.tipo_norm = 'salida sin regreso' THEN
              CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM Fichaje f
                  WHERE f.CODIGO = ${this.escapeSql(ausenciaData.codigo)}
                    AND f.FECHA  = t.single
                )
                THEN
                  SEC_TO_TIME(
                    GREATEST(
                      0,
                      TIME_TO_SEC(
                        TIMEDIFF(
                          STR_TO_DATE(${this.escapeSql(
                            this.extractFinTime(
                              ausenciaData.cuadrante_asignado,
                              ausenciaData.horario_asignado,
                            ),
                          )}, '%H:%i'),
                          STR_TO_DATE(
                            COALESCE(
                              (
                                SELECT MAX(f2.HORA)
                                FROM Fichaje f2
                                WHERE f2.CODIGO = ${this.escapeSql(ausenciaData.codigo)}
                                  AND f2.FECHA  = t.single
                                  AND f2.TIPO   = 'Salida'
                              ),
                              ${this.escapeSql(ausenciaData.hora)}
                            ),
                            '%H:%i:%s'
                          )
                        )
                      )
                    )
                  )
                ELSE
                  SEC_TO_TIME(
                    ${this.extractHorasDiarias(
                      ausenciaData.cuadrante_asignado,
                      ausenciaData.horario_asignado,
                    )} * 3600
                  )
              END
            ELSE
              GREATEST(
                1,
                CASE
                  WHEN t.ini IS NOT NULL AND t.fin IS NOT NULL
                    THEN 1 + ABS(DATEDIFF(t.fin, t.ini))
                  WHEN t.single IS NOT NULL
                    THEN 1
                  ELSE 1
                END
              )
          END AS DURACION,
          CASE
            WHEN t.tipo_norm IN ('salida sin regreso', 'salida centro', 'entrada centro')
              THEN 'horas'
            ELSE 'dias'
          END AS UNIDAD_DURACION
        FROM (
          SELECT
            CAST(${
              permisoFechaInicio ? this.escapeSql(permisoFechaInicio) : 'NULL'
            } AS DATE) AS ini,
            CAST(${
              permisoFechaFin ? this.escapeSql(permisoFechaFin) : 'NULL'
            } AS DATE) AS fin,
            CAST(${
              dataSingle ? this.escapeSql(dataSingle) : 'NULL'
            } AS DATE) AS single,
            ${this.escapeSql(tipoNorm)} AS tipo_norm
        ) AS t;
      `;

      await this.prisma.$executeRawUnsafe(query);

      // Obține ID-ul înregistrării create (folosim solicitud_id care este unic)
      let insertedId: number | null = null;
      try {
        const insertedRows = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT id FROM Ausencias WHERE solicitud_id = ${this.escapeSql(ausenciaData.solicitud_id)} LIMIT 1`,
        );
        insertedId = insertedRows?.[0]?.id ? Number(insertedRows[0].id) : null;
      } catch (idError: any) {
        // Dacă nu putem obține ID-ul, încă returnăm success (înregistrarea a fost creată)
        this.logger.warn(
          `⚠️ Could not retrieve inserted ID: ${idError.message}`,
        );
        insertedId = null;
      }

      this.logger.log(
        `✅ Ausencia added: ID=${insertedId || 'unknown'}, CODIGO=${ausenciaData.codigo}, TIPO=${ausenciaData.tipo}, solicitud_id=${ausenciaData.solicitud_id}`,
      );

      // Trimite notificare pe Telegram (complet async, nu așteptăm răspunsul)
      // Folosim setImmediate pentru a nu bloca răspunsul API-ului
      setImmediate(() => {
        this.telegramService
          .sendAusenciaNotification({
            codigo: ausenciaData.codigo,
            nombre: ausenciaData.nombre,
            tipo: ausenciaData.tipo,
            fecha:
              permisoFechaInicio && permisoFechaFin
                ? `${permisoFechaInicio} - ${permisoFechaFin}`
                : dataSingle || 'N/A',
            motivo: ausenciaData.motivo,
          })
          .catch((telegramError: any) => {
            // Nu aruncăm eroarea, doar logăm
            this.logger.warn(
              `⚠️ Error sending Telegram notification (non-blocking): ${telegramError.message}`,
            );
          });
      });

      return { success: true, id: insertedId || 0 };
    } catch (error: any) {
      this.logger.error('❌ Error adding ausencia:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al agregar ausencia: ${error.message}`,
      );
    }
  }

  /**
   * Obtine lista de ausencias cu filtrare opțională pe codigo și MES
   */
  async getAusencias(codigo?: string, mes?: string): Promise<any[]> {
    try {
      // Construiește query-ul SQL cu filtrare
      const conditions: string[] = [];

      if (codigo && codigo.trim() !== '') {
        conditions.push(`CODIGO = ${this.escapeSql(codigo.trim())}`);
      }

      if (mes && mes.trim() !== '') {
        const mesTrimmed = mes.trim();
        // Filtrare pentru MES: verifică dacă FECHA conține anul-luna specificat
        // Funcționează atât pentru date simple cât și pentru intervale
        conditions.push(
          `(DATE_FORMAT(STR_TO_DATE(SUBSTRING_INDEX(FECHA, ' - ', 1), '%Y-%m-%d'), '%Y-%m') = ${this.escapeSql(mesTrimmed)} OR FECHA LIKE ${this.escapeSql(`${mesTrimmed}%`)})`,
        );
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `SELECT * FROM Ausencias ${whereClause}`;

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      // Transformă datele conform logicii din n8n
      const transformed = rows.map((item: any) => {
        const tipo = item.TIPO || '';
        const fecha = item.FECHA || '';
        const duracion = item.DURACION || null;

        // Parsează FECHA în fecha_inicio și fecha_fin
        const { inicio: fechaInicio, fin: fechaFin } = this.parseFecha(fecha);

        // Construiește FECHA normalizată pentru returnare (format standard cu spații)
        let fechaLimpa = fecha;
        if (fechaInicio && fechaFin) {
          if (fechaInicio === fechaFin) {
            fechaLimpa = fechaInicio; // Dată simplă (aceeași zi)
          } else {
            fechaLimpa = `${fechaInicio} - ${fechaFin}`; // Interval (format standard)
          }
        } else if (fechaInicio) {
          fechaLimpa = fechaInicio;
        }

        // Calculează dias_aprobados pentru tipurile pe zile
        const diasAprobados = this.calculateDiasAprobados(
          tipo,
          duracion,
          fechaInicio,
          fechaFin,
        );

        // Calculează horas_aprobadas pentru tipurile pe ore
        let horasAprobadas = null;
        const tipuriZile = [
          'Vacaciones',
          'Asunto Propio',
          'Permiso Retribuido',
          'Permiso Recuperable',
          'Permiso No Retribuido',
          'Permiso sin sueldo',
          'Permiso médico',
          'Permiso',
          'Baja',
        ];
        const tipoLower = tipo.toLowerCase();
        const estePeZile = tipuriZile.some((t) =>
          tipoLower.includes(t.toLowerCase()),
        );

        if (!estePeZile) {
          // Pentru tipurile pe ore (Entrada Centro, Salida Centro, Salida Sin Regreso, etc.)
          if (duracion !== null && duracion !== undefined && duracion !== '') {
            horasAprobadas = String(duracion); // Păstrăm exact valoarea din DB
          }
        }

        return {
          ...item,
          FECHA: fechaLimpa, // Returnează FECHA curățată
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          dias_aprobados: diasAprobados,
          horas_aprobadas: horasAprobadas,
        };
      });

      this.logger.log(
        `✅ Ausencias retrieved: ${transformed.length} records (codigo: ${codigo || 'all'}, mes: ${mes || 'all'})`,
      );

      return transformed;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving ausencias:', error);
      throw new BadRequestException(
        `Error al obtener ausencias: ${error.message}`,
      );
    }
  }
}
