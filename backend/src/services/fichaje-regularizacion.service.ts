import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { AusenciasService } from './ausencias.service';
import {
  FichajeRegularizacionType,
  FichajeRegularizacionStatus,
} from '@prisma/client';

interface WorkdayWindow {
  workday_date: Date;
  window_start: Date;
  window_end: Date;
  fichaje_ids: string[];
  shifts: Array<{ entrada: Date; salida: Date | null }>;
}

interface ConfirmJornadaDto {
  employee_codigo: string;
  fecha: string; // Calendar date YYYY-MM-DD
  decision: 'no_extra' | 'worked_more';
  reason?: string; // Opțional: 'punch_error' pentru eroare de fichaje
  created_by: string;
  ip_address?: string;
  user_agent?: string;
}

@Injectable()
export class FichajeRegularizacionService {
  private readonly logger = new Logger(FichajeRegularizacionService.name);
  private readonly MAX_WORKDAY_HOURS = 16; // Safety cap

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly ausenciasService: AusenciasService,
  ) {}
  private readonly MAX_GAP_HOURS = 6; // Gap between Salida and next Entrada
  private readonly CONFIRMATION_THRESHOLD_MINUTES = 5; // Minimum difference to show confirmation

  /**
   * Detectează workday-ul pentru un angajat și o dată calendaristică
   * Workday_date = DATE of first Entrada (shift start date)
   * Night shifts crossing midnight belong to the start date
   */
  async detectWorkday(
    employee_codigo: string,
    calendar_date: string, // YYYY-MM-DD format
  ): Promise<WorkdayWindow | null> {
    try {
      // Găsește toate fichajes pentru angajat în intervalul [calendar_date 00:00, calendar_date+1 23:59]
      const dateStart = new Date(`${calendar_date} 00:00:00`);
      const dateEnd = new Date(`${calendar_date} 23:59:59`);
      dateEnd.setDate(dateEnd.getDate() + 1); // Next day 23:59:59

      // Format dates pentru MySQL (YYYY-MM-DD HH:MM:SS)
      const dateStartStr = dateStart
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
      const dateEndStr = dateEnd.toISOString().slice(0, 19).replace('T', ' ');

      this.logger.debug(
        `🔍 detectWorkday: employee=${employee_codigo}, calendar_date=${calendar_date}, dateStart=${dateStartStr}, dateEnd=${dateEndStr}`,
      );

      const query = `
        SELECT 
          ID,
          TIPO,
          FECHA,
          HORA,
          DURACION
        FROM Fichaje
        WHERE CODIGO = ${this.escapeSql(employee_codigo)}
          AND STR_TO_DATE(CONCAT(FECHA, ' ', HORA), '%Y-%m-%d %H:%i:%s') >= STR_TO_DATE(${this.escapeSql(dateStartStr)}, '%Y-%m-%d %H:%i:%s')
          AND STR_TO_DATE(CONCAT(FECHA, ' ', HORA), '%Y-%m-%d %H:%i:%s') <= STR_TO_DATE(${this.escapeSql(dateEndStr)}, '%Y-%m-%d %H:%i:%s')
          AND TIPO IN ('Entrada', 'Salida')
        ORDER BY FECHA ASC, HORA ASC
      `;

      const fichajes = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.debug(
        `🔍 detectWorkday: Found ${fichajes.length} fichajes for ${employee_codigo} on ${calendar_date}: ${JSON.stringify(fichajes.map((f) => ({ tipo: f.TIPO, fecha: f.FECHA, hora: f.HORA })))}`,
      );

      if (fichajes.length === 0) {
        this.logger.warn(
          `⚠️ detectWorkday: No fichajes found for ${employee_codigo} on ${calendar_date}`,
        );
        return null;
      }

      // Parse și grupează în perechi IN/OUT
      // IMPORTANT: FECHA și HORA în DB sunt în timezone local (Madrid), nu UTC
      // Trebuie să tratăm datetime-ul ca local time
      const parsedFichajes = fichajes.map((f) => {
        const fechaStr =
          f.FECHA instanceof Date
            ? f.FECHA.toISOString().split('T')[0]
            : f.FECHA;
        const horaStr =
          f.HORA instanceof Date ? f.HORA.toTimeString().slice(0, 8) : f.HORA;
        // Construim manual cu timezone Madrid
        const [year, month, day] = fechaStr.split('-').map(Number);
        const [hours, minutes, seconds = 0] = horaStr.split(':').map(Number);
        // Creăm Date object tratând valorile ca local time (Madrid)
        const datetime = new Date(
          year,
          month - 1,
          day,
          hours,
          minutes,
          seconds,
        );
        return {
          id: f.ID,
          tipo: f.TIPO,
          datetime,
        };
      });

      this.logger.debug(
        `🔍 Parsed fichajes: ${JSON.stringify(parsedFichajes.map((f) => ({ tipo: f.tipo, datetime: f.datetime.toISOString() })))}`,
      );

      // Construiește workday-ul prin chaining shifts consecutive
      const workday = this.buildWorkdayWindow(parsedFichajes);

      if (!workday) {
        return null;
      }

      // Safety cap: window_end must not exceed window_start + 16 hours
      const maxEnd = new Date(workday.window_start);
      maxEnd.setHours(maxEnd.getHours() + this.MAX_WORKDAY_HOURS);

      if (workday.window_end > maxEnd) {
        this.logger.warn(
          `⚠️ Workday window exceeds ${this.MAX_WORKDAY_HOURS}h cap for ${employee_codigo} on ${calendar_date}. Capping at ${maxEnd.toISOString()}`,
        );
        workday.window_end = maxEnd;
      }

      return workday;
    } catch (error: any) {
      this.logger.error(
        `❌ Error detecting workday for ${employee_codigo} on ${calendar_date}:`,
        error,
      );
      throw new BadRequestException(
        `Error detecting workday: ${error.message}`,
      );
    }
  }

  /**
   * Construiește workday window prin chaining shifts consecutive
   * Gap <= 6h între Salida și următoarea Entrada = același workday
   * Gap > 6h = workday nou
   */
  private buildWorkdayWindow(
    fichajes: Array<{ id: string; tipo: string; datetime: Date }>,
  ): WorkdayWindow | null {
    if (fichajes.length === 0) {
      return null;
    }

    // Găsește prima Entrada
    const firstEntrada = fichajes.find((f) => f.tipo === 'Entrada');
    if (!firstEntrada) {
      return null; // Nu există Entrada
    }

    // workday_date = DATE of first Entrada (shift start date)
    // Extragem direct anul, luna, ziua din datetime (local time)
    const workday_date = new Date(
      firstEntrada.datetime.getFullYear(),
      firstEntrada.datetime.getMonth(),
      firstEntrada.datetime.getDate(),
      0,
      0,
      0,
      0,
    ); // Reset to midnight in local time

    const window_start = firstEntrada.datetime;
    let window_end = firstEntrada.datetime;
    const fichaje_ids: string[] = [firstEntrada.id];
    const shifts: Array<{ entrada: Date; salida: Date | null }> = [];

    let currentEntrada: Date | null = firstEntrada.datetime;
    let i = fichajes.indexOf(firstEntrada) + 1;

    while (i < fichajes.length) {
      const fichaje = fichajes[i];

      if (fichaje.tipo === 'Salida' && currentEntrada) {
        // Închide perechea IN/OUT
        shifts.push({
          entrada: currentEntrada,
          salida: fichaje.datetime,
        });
        fichaje_ids.push(fichaje.id);
        window_end = fichaje.datetime;
        currentEntrada = null;
        i++;
      } else if (fichaje.tipo === 'Entrada') {
        if (currentEntrada) {
          // Există deja o Entrada deschisă (fără Salida) - începe workday nou
          break;
        }

        // Verifică gap-ul față de ultima Salida
        if (shifts.length > 0 && shifts[shifts.length - 1].salida) {
          const lastSalida = shifts[shifts.length - 1].salida!;
          const gapHours =
            (fichaje.datetime.getTime() - lastSalida.getTime()) /
            (1000 * 60 * 60);

          if (gapHours > this.MAX_GAP_HOURS) {
            // Gap > 6h = workday nou
            break;
          }
        }

        // Continuă același workday
        currentEntrada = fichaje.datetime;
        fichaje_ids.push(fichaje.id);
        i++;
      } else {
        i++;
      }
    }

    // Dacă există Entrada deschisă fără Salida, o includem
    if (currentEntrada) {
      shifts.push({
        entrada: currentEntrada,
        salida: null,
      });
    }

    return {
      workday_date,
      window_start,
      window_end,
      fichaje_ids,
      shifts,
    };
  }

  /**
   * Calculează punched_minutes din toate perechile IN/OUT din workday window
   */
  async calculatePunchedMinutes(
    employee_codigo: string,
    window_start: Date,
    window_end: Date,
  ): Promise<number> {
    try {
      // Convertim Date objects la string-uri locale (Madrid timezone)
      // FECHA și HORA în DB sunt în format local (Madrid), nu UTC
      const formatLocalDateTime = (date: Date): string => {
        // Folosim toLocaleString cu timezone Europe/Madrid
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };

      // window_start și window_end sunt Date objects create din parsedFichajes
      // parsedFichajes folosește new Date(year, month, day, hours, minutes, seconds) care e local time
      // Deci window_start și window_end sunt deja în local time (Madrid)
      // Trebuie doar să le formatăm corect
      const windowStartStr = formatLocalDateTime(window_start);
      const windowEndStr = formatLocalDateTime(window_end);

      this.logger.debug(
        `🔍 calculatePunchedMinutes: employee=${employee_codigo}, window_start=${windowStartStr} (Date: ${window_start.toString()}), window_end=${windowEndStr} (Date: ${window_end.toString()})`,
      );

      const query = `
        SELECT 
          ID,
          TIPO,
          FECHA,
          HORA,
          DURACION
        FROM Fichaje
        WHERE CODIGO = ${this.escapeSql(employee_codigo)}
          AND STR_TO_DATE(CONCAT(FECHA, ' ', HORA), '%Y-%m-%d %H:%i:%s') >= STR_TO_DATE(${this.escapeSql(windowStartStr)}, '%Y-%m-%d %H:%i:%s')
          AND STR_TO_DATE(CONCAT(FECHA, ' ', HORA), '%Y-%m-%d %H:%i:%s') <= STR_TO_DATE(${this.escapeSql(windowEndStr)}, '%Y-%m-%d %H:%i:%s')
          AND TIPO IN ('Entrada', 'Salida')
        ORDER BY FECHA ASC, HORA ASC
      `;

      const fichajes = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.debug(
        `🔍 Found ${fichajes.length} fichajes in window: ${JSON.stringify(fichajes.map((f) => ({ tipo: f.TIPO, fecha: f.FECHA, hora: f.HORA })))}`,
      );

      // Parse și grupează în perechi
      const parsed = fichajes.map((f) => {
        const fechaStr =
          f.FECHA instanceof Date
            ? f.FECHA.toISOString().split('T')[0]
            : f.FECHA;
        const horaStr =
          f.HORA instanceof Date ? f.HORA.toTimeString().slice(0, 8) : f.HORA;
        const datetimeStr = `${fechaStr} ${horaStr}`;
        return {
          tipo: f.TIPO,
          datetime: new Date(datetimeStr),
          duracion: f.DURACION,
        };
      });

      // Calculează suma duratelor
      let totalMinutes = 0;
      let currentEntrada: Date | null = null;

      for (const f of parsed) {
        if (f.tipo === 'Entrada') {
          currentEntrada = f.datetime;
          this.logger.debug(`🔍 Found Entrada at ${f.datetime.toISOString()}`);
        } else if (f.tipo === 'Salida' && currentEntrada) {
          // Calculează diferența în minute
          const diffMs = f.datetime.getTime() - currentEntrada.getTime();
          const diffMinutes = Math.round(diffMs / (1000 * 60));
          totalMinutes += diffMinutes;
          this.logger.debug(
            `🔍 Calculated shift: ${currentEntrada.toISOString()} -> ${f.datetime.toISOString()} = ${diffMinutes} minutes`,
          );
          currentEntrada = null;
        }
      }

      this.logger.debug(
        `✅ Total punched minutes: ${totalMinutes} (${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m)`,
      );

      return totalMinutes;
    } catch (error: any) {
      this.logger.error(
        `❌ Error calculating punched minutes: ${error.message}`,
      );
      throw new BadRequestException(
        `Error calculating punched minutes: ${error.message}`,
      );
    }
  }

  /**
   * Calculează scheduled_minutes din cuadrante/horario pentru workday_date
   * Sumă multiple segmente dacă e split shift
   */
  async calculateScheduledMinutes(
    employee_codigo: string,
    workday_date: Date,
  ): Promise<number> {
    try {
      const fechaStr = workday_date.toISOString().split('T')[0]; // YYYY-MM-DD
      const mesStr = fechaStr.substring(0, 7); // YYYY-MM
      // Folosește ziua din fechaStr pentru a evita problemele de timezone
      const dia = parseInt(fechaStr.split('-')[2], 10);

      // Încearcă să găsească în cuadrante
      const cuadranteQuery = `
        SELECT ZI_${dia} as schedule
        FROM cuadrante
        WHERE CODIGO = ${this.escapeSql(employee_codigo)}
          AND LUNA = ${this.escapeSql(mesStr)}
        LIMIT 1
      `;

      const cuadrante =
        await this.prisma.$queryRawUnsafe<any[]>(cuadranteQuery);

      this.logger.debug(
        `🔍 calculateScheduledMinutes - Checking cuadrante for ${employee_codigo} on ${fechaStr} (day ${dia}, month ${mesStr}): found ${cuadrante?.length || 0} results`,
      );

      if (cuadrante && cuadrante.length > 0 && cuadrante[0].schedule) {
        // Calculează din cuadrante (folosește helper existent)
        const scheduleStr = cuadrante[0].schedule;
        const minutes = this.parseScheduleToMinutes(scheduleStr);
        this.logger.debug(
          `✅ calculateScheduledMinutes - Found cuadrante schedule: ${scheduleStr} = ${minutes} minutes`,
        );
        return minutes;
      }

      // Fallback la horario - folosește CASE pentru ziua săptămânii
      const horarioQuery = `
        SELECT 
          CASE DAYOFWEEK(?)
            WHEN 2 THEN h.lun_in1 WHEN 3 THEN h.mar_in1 WHEN 4 THEN h.mie_in1
            WHEN 5 THEN h.joi_in1 WHEN 6 THEN h.vin_in1 WHEN 7 THEN h.sam_in1
            WHEN 1 THEN h.dum_in1 ELSE NULL
          END as in1,
          CASE DAYOFWEEK(?)
            WHEN 2 THEN h.lun_out1 WHEN 3 THEN h.mar_out1 WHEN 4 THEN h.mie_out1
            WHEN 5 THEN h.joi_out1 WHEN 6 THEN h.vin_out1 WHEN 7 THEN h.sam_out1
            WHEN 1 THEN h.dum_out1 ELSE NULL
          END as out1,
          CASE DAYOFWEEK(?)
            WHEN 2 THEN h.lun_in2 WHEN 3 THEN h.mar_in2 WHEN 4 THEN h.mie_in2
            WHEN 5 THEN h.joi_in2 WHEN 6 THEN h.vin_in2 WHEN 7 THEN h.sam_in2
            WHEN 1 THEN h.dum_in2 ELSE NULL
          END as in2,
          CASE DAYOFWEEK(?)
            WHEN 2 THEN h.lun_out2 WHEN 3 THEN h.mar_out2 WHEN 4 THEN h.mie_out2
            WHEN 5 THEN h.joi_out2 WHEN 6 THEN h.vin_out2 WHEN 7 THEN h.sam_out2
            WHEN 1 THEN h.dum_out2 ELSE NULL
          END as out2,
          CASE DAYOFWEEK(?)
            WHEN 2 THEN h.lun_in3 WHEN 3 THEN h.mar_in3 WHEN 4 THEN h.mie_in3
            WHEN 5 THEN h.joi_in3 WHEN 6 THEN h.vin_in3 WHEN 7 THEN h.sam_in3
            WHEN 1 THEN h.dum_in3 ELSE NULL
          END as in3,
          CASE DAYOFWEEK(?)
            WHEN 2 THEN h.lun_out3 WHEN 3 THEN h.mar_out3 WHEN 4 THEN h.mie_out3
            WHEN 5 THEN h.joi_out3 WHEN 6 THEN h.vin_out3 WHEN 7 THEN h.sam_out3
            WHEN 1 THEN h.dum_out3 ELSE NULL
          END as out3
        FROM horarios h
        JOIN DatosEmpleados de
          ON h.centro_nombre = de.\`CENTRO TRABAJO\`
         AND h.grupo_nombre = de.GRUPO
        WHERE de.CODIGO = ${this.escapeSql(employee_codigo)}
          AND (h.vigente_desde IS NULL OR h.vigente_desde <= ?)
          AND (h.vigente_hasta IS NULL OR h.vigente_hasta >= ?)
        ORDER BY h.vigente_desde DESC
        LIMIT 1
      `;

      const fechaDate = workday_date.toISOString().split('T')[0];
      const horario = await this.prisma.$queryRawUnsafe<any[]>(
        horarioQuery,
        fechaDate,
        fechaDate,
        fechaDate,
        fechaDate,
        fechaDate,
        fechaDate,
        workday_date,
        workday_date,
      );

      this.logger.debug(
        `🔍 calculateScheduledMinutes - Checking horario for ${employee_codigo} on ${fechaStr}: found ${horario?.length || 0} results`,
      );

      if (horario && horario.length > 0) {
        const h = horario[0];
        let totalMinutes = 0;
        let segmentsFound = 0;

        // Verifică câte segmente sunt definite (nu NULL)
        if (h.in1 && h.out1) segmentsFound++;
        if (h.in2 && h.out2) segmentsFound++;
        if (h.in3 && h.out3) segmentsFound++;

        this.logger.debug(
          `🔍 calculateScheduledMinutes - Found ${segmentsFound} segments in horario for ${employee_codigo} on ${fechaStr}`,
        );

        // Dacă există mai mult de 1 segment, înseamnă că sunt ture multiple (split shifts)
        // În acest caz, toate segmentele trebuie să fie lucrate în aceeași zi
        // Dacă există doar 1 segment, folosim doar acela
        // Dacă există 3 segmente (ex: 07:00-15:00, 15:00-23:00, 23:00-07:00), 
        // acestea reprezintă opțiuni de ture, nu ture care trebuie toate lucrate
        // În acest caz, folosim doar prima tură disponibilă sau verificăm cuadrantele
        
        // Verifică dacă toate cele 3 segmente sunt definite și dacă suma lor este 24 ore
        // Dacă da, înseamnă că sunt opțiuni de ture, nu ture care trebuie toate lucrate
        if (segmentsFound === 3 && h.in1 && h.out1 && h.in2 && h.out2 && h.in3 && h.out3) {
          const seg1 = this.timeDiffMinutes(h.in1, h.out1);
          const seg2 = this.timeDiffMinutes(h.in2, h.out2);
          const seg3 = this.timeDiffMinutes(h.in3, h.out3);
          const correctedSeg1 = seg1 < 0 ? seg1 + 24 * 60 : seg1;
          const correctedSeg2 = seg2 < 0 ? seg2 + 24 * 60 : seg2;
          const correctedSeg3 = seg3 < 0 ? seg3 + 24 * 60 : seg3;
          const totalAllSegments = correctedSeg1 + correctedSeg2 + correctedSeg3;
          
          // Dacă suma tuturor segmentelor este 24 ore (1440 minute), 
          // înseamnă că sunt opțiuni de ture, nu ture care trebuie toate lucrate
          // În acest caz, folosim doar prima tură disponibilă
          if (totalAllSegments === 24 * 60) {
            this.logger.debug(
              `⚠️ All 3 segments sum to 24h - these are shift options, not all shifts to work. Using only first segment.`,
            );
            const segment1 = this.timeDiffMinutes(h.in1, h.out1);
            const correctedSegment1 = segment1 < 0 ? segment1 + 24 * 60 : segment1;
            totalMinutes = correctedSegment1;
            this.logger.debug(
              `  Using Segment 1 only: ${h.in1} - ${h.out1} = ${segment1} minutes (night shift: ${segment1 < 0}, corrected: ${correctedSegment1})`,
            );
          } else {
            // Dacă suma nu este 24 ore, înseamnă că sunt split shifts care trebuie toate lucrate
            // Sumă toate segmentele
            if (h.in1 && h.out1) {
              const segment1 = this.timeDiffMinutes(h.in1, h.out1);
              const correctedSegment1 = segment1 < 0 ? segment1 + 24 * 60 : segment1;
              totalMinutes += correctedSegment1;
              this.logger.debug(
                `  Segment 1: ${h.in1} - ${h.out1} = ${segment1} minutes (night shift: ${segment1 < 0}, corrected: ${correctedSegment1}, total so far: ${totalMinutes})`,
              );
            }
            if (h.in2 && h.out2) {
              const segment2 = this.timeDiffMinutes(h.in2, h.out2);
              const correctedSegment2 = segment2 < 0 ? segment2 + 24 * 60 : segment2;
              totalMinutes += correctedSegment2;
              this.logger.debug(
                `  Segment 2: ${h.in2} - ${h.out2} = ${segment2} minutes (night shift: ${segment2 < 0}, corrected: ${correctedSegment2}, total so far: ${totalMinutes})`,
              );
            }
            if (h.in3 && h.out3) {
              const segment3 = this.timeDiffMinutes(h.in3, h.out3);
              const correctedSegment3 = segment3 < 0 ? segment3 + 24 * 60 : segment3;
              totalMinutes += correctedSegment3;
              this.logger.debug(
                `  Segment 3: ${h.in3} - ${h.out3} = ${segment3} minutes (night shift: ${segment3 < 0}, corrected: ${correctedSegment3}, total so far: ${totalMinutes})`,
              );
            }
          }
        } else {
          // Dacă nu sunt toate cele 3 segmente definite, sumă doar segmentele disponibile
          if (h.in1 && h.out1) {
            const segment1 = this.timeDiffMinutes(h.in1, h.out1);
            const correctedSegment1 = segment1 < 0 ? segment1 + 24 * 60 : segment1;
            totalMinutes += correctedSegment1;
            this.logger.debug(
              `  Segment 1: ${h.in1} - ${h.out1} = ${segment1} minutes (night shift: ${segment1 < 0}, corrected: ${correctedSegment1}, total so far: ${totalMinutes})`,
            );
          }
          if (h.in2 && h.out2) {
            const segment2 = this.timeDiffMinutes(h.in2, h.out2);
            const correctedSegment2 = segment2 < 0 ? segment2 + 24 * 60 : segment2;
            totalMinutes += correctedSegment2;
            this.logger.debug(
              `  Segment 2: ${h.in2} - ${h.out2} = ${segment2} minutes (night shift: ${segment2 < 0}, corrected: ${correctedSegment2}, total so far: ${totalMinutes})`,
            );
          }
          if (h.in3 && h.out3) {
            const segment3 = this.timeDiffMinutes(h.in3, h.out3);
            const correctedSegment3 = segment3 < 0 ? segment3 + 24 * 60 : segment3;
            totalMinutes += correctedSegment3;
            this.logger.debug(
              `  Segment 3: ${h.in3} - ${h.out3} = ${segment3} minutes (night shift: ${segment3 < 0}, corrected: ${correctedSegment3}, total so far: ${totalMinutes})`,
            );
          }
        }

        this.logger.debug(
          `✅ calculateScheduledMinutes - Found horario: total = ${totalMinutes} minutes (${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m)`,
        );
        return totalMinutes;
      }

      // Fallback: Dacă nu există nici cuadrante nici horario, folosim orele din contract
      // Calculează orele zilnice din contract (presupunem că contractul este pe săptămână)
      const contractQuery = `
        SELECT \`HORAS DE CONTRATO\` as horas_contrato
        FROM DatosEmpleados
        WHERE CODIGO = ${this.escapeSql(employee_codigo)}
        LIMIT 1
      `;

      const contract = await this.prisma.$queryRawUnsafe<any[]>(contractQuery);

      if (contract && contract.length > 0 && contract[0].horas_contrato) {
        const horasContrato = parseFloat(contract[0].horas_contrato);
        if (!isNaN(horasContrato) && horasContrato > 0) {
          // Verifică dacă ziua este lucrătoare (luni-vineri = 2-6 în DAYOFWEEK)
          const dayOfWeek = workday_date.getDay(); // 0 = duminică, 1 = luni, ..., 6 = sâmbătă
          const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5; // Luni-Vineri

          if (isWeekday) {
            // Presupunem că contractul este pe săptămână, deci pentru o zi lucrătoare: horas_contrato / 5
            const horasDiarias = horasContrato / 5;
            const minutosDiarios = Math.round(horasDiarias * 60);
            this.logger.debug(
              `📋 Using contract hours as fallback: ${horasContrato}h/week = ${horasDiarias}h/day = ${minutosDiarios}min for ${employee_codigo} on ${fechaStr}`,
            );
            return minutosDiarios;
          } else {
            // Weekend - nu sunt ore programate
            this.logger.debug(
              `📋 Weekend day for ${employee_codigo} on ${fechaStr} - no scheduled hours`,
            );
            return 0;
          }
        }
      }

      this.logger.debug(
        `⚠️ No schedule found (cuadrante, horario, or contract) for ${employee_codigo} on ${fechaStr}`,
      );
      return 0; // Nu există schedule
    } catch (error: any) {
      this.logger.error(
        `❌ Error calculating scheduled minutes: ${error.message}`,
      );
      return 0; // Return 0 dacă nu găsește schedule
    }
  }

  /**
   * Obține ora programată de Entrada pentru o dată
   * Returnează ora (HH:MM) sau null dacă nu există schedule
   */
  async getScheduledEntryTime(
    employee_codigo: string,
    fecha: Date,
  ): Promise<string | null> {
    try {
      const fechaStr = fecha.toISOString().split('T')[0]; // YYYY-MM-DD
      const mesStr = fechaStr.substring(0, 7); // YYYY-MM
      const dia = fecha.getDate();

      // Încearcă să găsească în cuadrante
      const cuadranteQuery = `
        SELECT ZI_${dia} as schedule
        FROM cuadrante
        WHERE CODIGO = ${this.escapeSql(employee_codigo)}
          AND LUNA = ${this.escapeSql(mesStr)}
        LIMIT 1
      `;

      const cuadrante =
        await this.prisma.$queryRawUnsafe<any[]>(cuadranteQuery);

      if (cuadrante && cuadrante.length > 0 && cuadrante[0].schedule) {
        const scheduleStr = cuadrante[0].schedule;
        // Parse "08:00-17:00" -> returnează "08:00"
        const timeRangeMatch = scheduleStr.match(
          /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/,
        );
        if (timeRangeMatch) {
          return `${timeRangeMatch[1].padStart(2, '0')}:${timeRangeMatch[2]}`;
        }
      }

      // Fallback la horario - prima Entrada (in1)
      const horarioQuery = `
        SELECT 
          CASE DAYOFWEEK(?)
            WHEN 2 THEN h.lun_in1 WHEN 3 THEN h.mar_in1 WHEN 4 THEN h.mie_in1
            WHEN 5 THEN h.joi_in1 WHEN 6 THEN h.vin_in1 WHEN 7 THEN h.sam_in1
            WHEN 1 THEN h.dum_in1 ELSE NULL
          END as in1
        FROM horarios h
        JOIN DatosEmpleados de
          ON h.centro_nombre = de.\`CENTRO TRABAJO\`
         AND h.grupo_nombre = de.GRUPO
        WHERE de.CODIGO = ${this.escapeSql(employee_codigo)}
          AND (h.vigente_desde IS NULL OR h.vigente_desde <= ?)
          AND (h.vigente_hasta IS NULL OR h.vigente_hasta >= ?)
        ORDER BY h.vigente_desde DESC
        LIMIT 1
      `;

      const fechaDate = fecha.toISOString().split('T')[0];
      const horario = await this.prisma.$queryRawUnsafe<any[]>(
        horarioQuery,
        fechaDate,
        fecha,
        fecha,
      );

      if (horario && horario.length > 0 && horario[0].in1) {
        const in1 = horario[0].in1;
        // Converteste Time la string HH:MM
        if (in1 instanceof Date) {
          return `${String(in1.getHours()).padStart(2, '0')}:${String(in1.getMinutes()).padStart(2, '0')}`;
        }
        if (typeof in1 === 'string') {
          return in1.substring(0, 5); // "HH:MM"
        }
      }

      return null; // Nu există schedule
    } catch (error: any) {
      this.logger.error(
        `❌ Error getting scheduled entry time: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Verifică dacă trebuie să se afișeze confirmare pentru o dată
   * Returnează diferența în minute dacă e > threshold
   */
  async checkNeedsConfirmation(
    employee_codigo: string,
    fecha: string, // YYYY-MM-DD
  ): Promise<{
    needs_confirmation: boolean;
    delta_minutes: number;
    punched_minutes: number;
    scheduled_minutes: number;
    workday_date: string;
  }> {
    try {
      const workday = await this.detectWorkday(employee_codigo, fecha);

      let punched_minutes = 0;
      let workday_date = new Date(fecha);
      workday_date.setHours(0, 0, 0, 0);

      // Verifică dacă există o Salida cu DURACION pentru data calendaristică specificată
      // Folosim direct string-ul fecha (format YYYY-MM-DD) pentru a evita probleme cu timezone
      const fechaStr = fecha; // fecha vine deja în format YYYY-MM-DD

      const fichajeQuery = `
        SELECT DURACION, HORA
        FROM Fichaje
        WHERE CODIGO = ${this.escapeSql(employee_codigo)}
          AND FECHA = ${this.escapeSql(fechaStr)}
          AND TIPO = 'Salida'
          AND DURACION IS NOT NULL
          AND TRIM(DURACION) != ''
          AND DURACION != '00:00:00'
        ORDER BY HORA DESC
        LIMIT 1
      `;

      const fichajes = await this.prisma.$queryRawUnsafe<any[]>(fichajeQuery);
      this.logger.debug(
        `🔍 Checking DURACION directly for ${employee_codigo} on ${fechaStr}: found ${fichajes?.length || 0} fichajes`,
      );
      if (fichajes && fichajes.length > 0) {
        this.logger.debug(
          `🔍 DURACION query result: ${JSON.stringify(fichajes.map((f) => ({ DURACION: f.DURACION, HORA: f.HORA })))}`,
        );
      }
      const hasDirectDuration =
        fichajes && fichajes.length > 0 && fichajes[0].DURACION;

      if (hasDirectDuration) {
        // Prioritate: folosește DURACION direct din Salida pentru data specificată
        const durationStr = fichajes[0].DURACION;
        const horaStr = fichajes[0].HORA;
        punched_minutes = this.parseDurationToMinutes(durationStr);
        this.logger.debug(
          `✅ Using DURACION directly: ${durationStr} = ${punched_minutes} minutes for ${employee_codigo} on ${fechaStr}`,
        );
        
        // Detectează dacă este tură nocturnă:
        // - Salida este înainte de 12:00 (dimineața)
        // - Există Entrada în ziua anterioară după 17:00
        const horaTime = horaStr instanceof Date 
          ? horaStr.toTimeString().slice(0, 8) 
          : horaStr;
        const [salidaHours] = horaTime.split(':').map(Number);
        const isMorningSalida = salidaHours < 12; // Salida înainte de 12:00 = dimineața
        
        if (isMorningSalida) {
          // Verifică dacă există Entrada în ziua anterioară după 17:00
          const fechaAnterior = new Date(fechaStr + 'T00:00:00');
          fechaAnterior.setDate(fechaAnterior.getDate() - 1);
          const fechaAnteriorStr = fechaAnterior.toISOString().split('T')[0];
          
          this.logger.debug(
            `🔍 Checking for night shift: Salida on ${fechaStr} at ${horaTime}, checking Entrada on ${fechaAnteriorStr}`,
          );
          
          const entradaQuery = `
            SELECT HORA
            FROM Fichaje
            WHERE CODIGO = ${this.escapeSql(employee_codigo)}
              AND FECHA = ${this.escapeSql(fechaAnteriorStr)}
              AND TIPO = 'Entrada'
            ORDER BY HORA DESC
            LIMIT 1
          `;
          
          const entradas = await this.prisma.$queryRawUnsafe<any[]>(entradaQuery);
          
          this.logger.debug(
            `🔍 Found ${entradas?.length || 0} Entradas on ${fechaAnteriorStr}`,
          );
          
          if (entradas && entradas.length > 0) {
            const entradaHoraStr = entradas[0].HORA instanceof Date
              ? entradas[0].HORA.toTimeString().slice(0, 8)
              : entradas[0].HORA;
            const [entradaHours] = entradaHoraStr.split(':').map(Number);
            
            this.logger.debug(
              `🔍 Entrada time: ${entradaHoraStr} (${entradaHours} hours), checking if >= 17`,
            );
            
            if (entradaHours >= 17) {
              // Este tură nocturnă: Entrada în ziua anterioară după 17:00, Salida în ziua următoare dimineața
              // workday_date = ziua de început (ziua Entrada-ului)
              workday_date = fechaAnterior;
              this.logger.debug(
                `🌙 Detected night shift: Entrada on ${fechaAnteriorStr} at ${entradaHoraStr}, Salida on ${fechaStr} at ${horaTime}. Setting workday_date to ${fechaAnteriorStr}`,
              );
            } else {
              // Nu este tură nocturnă, folosește data Salida-ului
              workday_date = new Date(fechaStr + 'T00:00:00');
              this.logger.debug(
                `✅ Not night shift (Entrada at ${entradaHoraStr} < 17:00). Setting workday_date to ${fechaStr}`,
              );
            }
          } else {
            // Nu există Entrada în ziua anterioară, folosește data Salida-ului
            workday_date = new Date(fechaStr + 'T00:00:00');
            this.logger.debug(
              `✅ No Entrada found on ${fechaAnteriorStr}. Setting workday_date to ${fechaStr}`,
            );
          }
        } else {
          // Salida nu este dimineața, nu este tură nocturnă
        // Setează workday_date la data specificată (fechaStr este deja YYYY-MM-DD)
        workday_date = new Date(fechaStr + 'T00:00:00');
        this.logger.debug(
          `✅ Salida is not morning (${horaTime}). Setting workday_date to ${fechaStr}`,
        );
        }
      } else if (workday) {
        // Caz normal: există workday valid și nu există DURACION direct
        punched_minutes = await this.calculatePunchedMinutes(
          employee_codigo,
          workday.window_start,
          workday.window_end,
        );
        workday_date = workday.workday_date;
      } else {
        // Nu există nici workday, nici DURACION direct - returnează false
        this.logger.debug(
          `⚠️ No workday and no DURACION found for ${employee_codigo} on ${fechaStr}`,
        );
        return {
          needs_confirmation: false,
          delta_minutes: 0,
          punched_minutes: 0,
          scheduled_minutes: 0,
          workday_date: fechaStr,
        };
      }

      // Calculează scheduled_minutes din cuadrante/horario
      // IMPORTANT: Pentru a evita problemele de timezone, folosim fechaStr direct când nu este tură nocturnă
      // Verificăm dacă este tură nocturnă comparând workday_date cu fechaStr folosind o metodă care evită timezone
      let dateForCalculation: Date;
      let dateStrForCalculation: string;
      
      // Extrage data din workday_date folosind metode locale pentru a evita problemele de timezone
      const workdayYear = workday_date.getFullYear();
      const workdayMonth = workday_date.getMonth() + 1;
      const workdayDay = workday_date.getDate();
      const workdayDateStr = `${workdayYear}-${String(workdayMonth).padStart(2, '0')}-${String(workdayDay).padStart(2, '0')}`;
      
      this.logger.debug(
        `🔍 workday_date local: ${workdayDateStr}, fechaStr: ${fechaStr}, workday_date ISO: ${workday_date.toISOString()}`,
      );
      
      // Dacă workday_date (extras local) este diferit de fechaStr, înseamnă că este tură nocturnă
      // Pentru zilele normale (nu tură nocturnă), folosim fechaStr direct pentru a evita problemele de timezone
      if (workdayDateStr !== fechaStr) {
        // Este tură nocturnă, folosim workday_date (data Entrada-ului)
        dateStrForCalculation = workdayDateStr;
        dateForCalculation = new Date(workdayDateStr + 'T12:00:00');
        this.logger.debug(
          `🌙 Night shift detected. Using workday_date for calculation: ${dateStrForCalculation}`,
        );
      } else {
        // Nu este tură nocturnă, folosim fechaStr direct pentru a evita problemele de timezone
        dateStrForCalculation = fechaStr;
        dateForCalculation = new Date(fechaStr + 'T12:00:00');
        this.logger.debug(
          `✅ Normal day. Using fechaStr directly for calculation: ${dateStrForCalculation}`,
        );
      }
      
      const scheduled_minutes = await this.calculateScheduledMinutes(
        employee_codigo,
        dateForCalculation,
      );

      const delta_minutes = punched_minutes - scheduled_minutes;
      const needs_confirmation =
        Math.abs(delta_minutes) >= this.CONFIRMATION_THRESHOLD_MINUTES;

      this.logger.debug(
        `🔍 checkNeedsConfirmation result: punched=${punched_minutes}min (${Math.floor(punched_minutes / 60)}h ${punched_minutes % 60}m), scheduled=${scheduled_minutes}min (${Math.floor(scheduled_minutes / 60)}h ${scheduled_minutes % 60}m), delta=${delta_minutes}min, needs_confirmation=${needs_confirmation}`,
      );

      return {
        needs_confirmation,
        delta_minutes,
        punched_minutes,
        scheduled_minutes,
        workday_date: workday_date.toISOString().split('T')[0],
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error checking needs confirmation: ${error.message}`,
      );
      return {
        needs_confirmation: false,
        delta_minutes: 0,
        punched_minutes: 0,
        scheduled_minutes: 0,
        workday_date: fecha,
      };
    }
  }

  /**
   * Confirmă jornada - creează regularizare
   */
  async confirmJornada(dto: ConfirmJornadaDto) {
    try {
      const {
        employee_codigo,
        fecha,
        decision,
        reason,
        created_by,
        ip_address,
        user_agent,
      } = dto;

      // Detectează workday (pentru window_start, window_end și scheduled_minutes)
      const workday = await this.detectWorkday(employee_codigo, fecha);

      // Verifică dacă există o Salida cu DURACION direct pentru data specificată
      const fechaStr = fecha; // fecha vine deja în format YYYY-MM-DD
      const fichajeQuery = `
        SELECT DURACION, ID, HORA
        FROM Fichaje
        WHERE CODIGO = ${this.escapeSql(employee_codigo)}
          AND FECHA = ${this.escapeSql(fechaStr)}
          AND TIPO = 'Salida'
          AND DURACION IS NOT NULL
          AND TRIM(DURACION) != ''
          AND DURACION != '00:00:00'
        ORDER BY HORA DESC
        LIMIT 1
      `;

      const fichajes = await this.prisma.$queryRawUnsafe<any[]>(fichajeQuery);
      const hasDirectDuration =
        fichajes && fichajes.length > 0 && fichajes[0].DURACION;
      const salidaFichajeId =
        fichajes && fichajes.length > 0 ? fichajes[0].ID : null;
      const salidaHora =
        fichajes && fichajes.length > 0 ? fichajes[0].HORA : null;

      let punched_minutes = 0;
      let workday_date = new Date(fechaStr + 'T00:00:00');
      let window_start: Date;
      let window_end: Date;
      let fichaje_ids: string[] = [];

      if (hasDirectDuration) {
        // Prioritate: folosește DURACION direct din Salida pentru data specificată
        const durationStr = fichajes[0].DURACION;
        punched_minutes = this.parseDurationToMinutes(durationStr);
        this.logger.debug(
          `✅ confirmJornada: Using DURACION directly: ${durationStr} = ${punched_minutes} minutes for ${employee_codigo} on ${fechaStr}`,
        );
        workday_date = new Date(fechaStr + 'T00:00:00');

        // IMPORTANT: Când folosim DURACION direct, folosim DOAR ID-ul fichaje-ului "Salida" pentru data specificată
        // NU folosim workday.fichaje_ids pentru că poate include fichaje-uri din zile diferite
        fichaje_ids = salidaFichajeId ? [salidaFichajeId] : [];

        // IMPORTANT: Când folosim DURACION direct, trebuie să setăm window_start la începutul zilei fichaje-ului "Salida"
        // pentru a asigura că query-ul găsește regularizarea
        if (salidaHora) {
          // Setăm window_start la începutul zilei fichaje-ului "Salida" (fechaStr)
          window_start = new Date(fechaStr + 'T00:00:00');
          // Setăm window_end la sfârșitul zilei sau la workday.window_end dacă există (dar folosim doar ID-ul Salida)
          if (workday) {
            window_end = workday.window_end;
          } else {
            window_end = new Date(fechaStr + 'T23:59:59');
          }
        } else if (workday) {
          // Fallback: dacă nu avem HORA, folosim workday-ul detectat
          window_start = workday.window_start;
          window_end = workday.window_end;
          // Dar păstrăm doar ID-ul Salida în fichaje_ids (nu toate din workday)
          if (salidaFichajeId && !fichaje_ids.includes(salidaFichajeId)) {
            fichaje_ids = [salidaFichajeId];
          }
        } else {
          // Dacă nu există workday, folosim fecha ca window
          window_start = new Date(fechaStr + 'T00:00:00');
          window_end = new Date(fechaStr + 'T23:59:59');
          fichaje_ids = salidaFichajeId ? [salidaFichajeId] : [];
        }

        this.logger.debug(
          `✅ confirmJornada: Using ONLY Salida fichaje ID ${salidaFichajeId} in fichaje_ids (not workday.fichaje_ids) for fecha=${fechaStr}`,
        );
      } else if (workday) {
        // Fallback: dacă nu există DURACION direct, folosim workday-ul detectat
        punched_minutes = await this.calculatePunchedMinutes(
          employee_codigo,
          workday.window_start,
          workday.window_end,
        );
        workday_date = workday.workday_date;
        window_start = workday.window_start;
        window_end = workday.window_end;
        fichaje_ids = workday.fichaje_ids || [];
      } else {
        // Nu există nici workday, nici DURACION direct
        throw new BadRequestException(
          'No se encontró workday ni DURACION para esta fecha',
        );
      }

      const scheduled_minutes = await this.calculateScheduledMinutes(
        employee_codigo,
        workday_date,
      );

      // Determină tipul și statusul
      let regularization_type: FichajeRegularizacionType;
      let status: FichajeRegularizacionStatus;
      let effective_minutes: number;
      let reason_code: string;

      if (decision === 'no_extra') {
        regularization_type = FichajeRegularizacionType.NO_EXTRA;
        status = FichajeRegularizacionStatus.CONFIRMED;
        effective_minutes = scheduled_minutes;
        // Dacă e eroare de fichaje, setează reason_code corespunzător
        reason_code =
          reason === 'punch_error'
            ? 'employee_confirmed_punch_error'
            : 'employee_confirmed_no_extra';
      } else {
        // worked_more
        regularization_type = FichajeRegularizacionType.DECLARES_EXTRA;
        status = FichajeRegularizacionStatus.NEEDS_REVIEW;
        effective_minutes = punched_minutes; // Temporar, până aprobă admin
        reason_code = 'employee_declares_extra';
      }

      // IMPORTANT: workday_date trebuie salvat ca DATE (YYYY-MM-DD) fără timezone issues
      // Extragem direct anul, luna, ziua din workday_date pentru a evita conversiile UTC
      const workdayDateStr = `${workday_date.getFullYear()}-${String(workday_date.getMonth() + 1).padStart(2, '0')}-${String(workday_date.getDate()).padStart(2, '0')}`;

      // Formatăm window_start și window_end pentru SQL
      const formatDateTime = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };

      const windowStartStr = formatDateTime(window_start);
      const windowEndStr = formatDateTime(window_end);

      this.logger.debug(
        `🔍 confirmJornada: Saving regularizacion - employee=${employee_codigo}, fecha=${fecha}, workday_date=${workdayDateStr}, window_start=${windowStartStr}, window_end=${windowEndStr}, fichaje_ids=${JSON.stringify(fichaje_ids)}, punched_minutes=${punched_minutes}, scheduled_minutes=${scheduled_minutes}, effective_minutes=${effective_minutes}, status=${status}`,
      );

      // Verifică dacă există deja o regularizare pentru același employee și fecha (data calendaristică a fichaje-ului "Salida")
      // IMPORTANT: Folosim fecha (nu workday_date) pentru că pentru același fichaje "Salida" ar trebui să existe o singură regularizare
      // De asemenea, verificăm dacă fichaje_ids conține ID-ul fichaje-ului "Salida"
      let checkExistingQuery = `
        SELECT id
        FROM FichajeRegularizacion
        WHERE employee_codigo = ${this.escapeSql(employee_codigo)}
      `;

      // Prioritate 1: Verifică dacă există o regularizare care conține ID-ul fichaje-ului "Salida"
      if (salidaFichajeId) {
        checkExistingQuery += `
          AND fichaje_ids IS NOT NULL 
          AND fichaje_ids LIKE ${this.escapeSql(`%${salidaFichajeId}%`)}
        `;
      } else {
        // Fallback: dacă nu avem salidaFichajeId, verificăm după workday_date
        checkExistingQuery += `
          AND workday_date = STR_TO_DATE(${this.escapeSql(workdayDateStr)}, '%Y-%m-%d')
        `;
      }

      checkExistingQuery += `
        ORDER BY id DESC
        LIMIT 1
      `;

      const existing =
        await this.prisma.$queryRawUnsafe<any[]>(checkExistingQuery);

      this.logger.debug(
        `🔍 confirmJornada: Found ${existing?.length || 0} existing regularizacion(s) for employee=${employee_codigo}, workday_date=${workdayDateStr}${salidaFichajeId ? `, fichaje_id=${salidaFichajeId}` : ''}`,
      );

      let created;

      if (existing && existing.length > 0) {
        // Actualizează existent
        const updateQuery = `
          UPDATE FichajeRegularizacion
          SET
            workday_date = STR_TO_DATE(${this.escapeSql(workdayDateStr)}, '%Y-%m-%d'),
            window_end = STR_TO_DATE(${this.escapeSql(windowEndStr)}, '%Y-%m-%d %H:%i:%s'),
            fichaje_ids = ${this.escapeSql(JSON.stringify(fichaje_ids))},
            regularization_type = ${this.escapeSql(regularization_type)},
            status = ${this.escapeSql(status)},
            scheduled_minutes = ${scheduled_minutes},
            punched_minutes = ${punched_minutes},
            effective_minutes = ${effective_minutes !== null ? effective_minutes : 'NULL'},
            reason_code = ${reason_code ? this.escapeSql(reason_code) : 'NULL'},
            confirmed_at = NOW(),
            ip_address = ${ip_address ? this.escapeSql(ip_address) : 'NULL'},
            user_agent = ${user_agent ? this.escapeSql(user_agent) : 'NULL'}
          WHERE id = ${existing[0].id}
        `;

        await this.prisma.$queryRawUnsafe(updateQuery);

        // Recuperăm regularizarea actualizată
        created = await this.prisma.fichajeRegularizacion.findUnique({
          where: { id: existing[0].id },
        });

        this.logger.log(
          `✅ Regularizacion updated: ID=${created.id}, employee=${employee_codigo}, fecha=${fecha}, decision=${decision}`,
        );
      } else {
        // Creează nou
        const insertQuery = `
          INSERT INTO FichajeRegularizacion (
            employee_codigo,
            workday_date,
            window_start,
            window_end,
            fichaje_ids,
            regularization_type,
            status,
            scheduled_minutes,
            punched_minutes,
            effective_minutes,
            reason_code,
            created_by,
            confirmed_at,
            ip_address,
            user_agent
          ) VALUES (
            ${this.escapeSql(employee_codigo)},
            STR_TO_DATE(${this.escapeSql(workdayDateStr)}, '%Y-%m-%d'),
            STR_TO_DATE(${this.escapeSql(windowStartStr)}, '%Y-%m-%d %H:%i:%s'),
            STR_TO_DATE(${this.escapeSql(windowEndStr)}, '%Y-%m-%d %H:%i:%s'),
            ${this.escapeSql(JSON.stringify(fichaje_ids))},
            ${this.escapeSql(regularization_type)},
            ${this.escapeSql(status)},
            ${scheduled_minutes},
            ${punched_minutes},
            ${effective_minutes !== null ? effective_minutes : 'NULL'},
            ${reason_code ? this.escapeSql(reason_code) : 'NULL'},
            ${this.escapeSql(created_by)},
            NOW(),
            ${ip_address ? this.escapeSql(ip_address) : 'NULL'},
            ${user_agent ? this.escapeSql(user_agent) : 'NULL'}
          )
        `;

        await this.prisma.$queryRawUnsafe(insertQuery);

        // Recuperăm regularizarea creată folosind window_start
        const findCreatedQuery = `
          SELECT id
          FROM FichajeRegularizacion
          WHERE employee_codigo = ${this.escapeSql(employee_codigo)}
            AND window_start = STR_TO_DATE(${this.escapeSql(windowStartStr)}, '%Y-%m-%d %H:%i:%s')
          LIMIT 1
        `;

        const createdResult =
          await this.prisma.$queryRawUnsafe<any[]>(findCreatedQuery);

        if (!createdResult || createdResult.length === 0) {
          throw new BadRequestException('Failed to create regularizacion');
        }

        created = await this.prisma.fichajeRegularizacion.findUnique({
          where: { id: createdResult[0].id },
        });

        this.logger.log(
          `✅ Regularizacion created: ID=${created.id}, employee=${employee_codigo}, fecha=${fecha}, decision=${decision}`,
        );
      }

      if (!created) {
        throw new BadRequestException('Failed to create/update regularizacion');
      }

      return created;
    } catch (error: any) {
      this.logger.error(`❌ Error confirming jornada: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error confirming jornada: ${error.message}`,
      );
    }
  }

  /**
   * Obține regularizări pending pentru admin
   */
  async getPendingReviews() {
    try {
      const result = await this.prisma.fichajeRegularizacion.findMany({
        where: {
          status: FichajeRegularizacionStatus.NEEDS_REVIEW,
        },
        orderBy: {
          workday_date: 'desc',
        },
      });

      this.logger.log(
        `📊 getPendingReviews: Found ${result.length} regularizaciones with status NEEDS_REVIEW`,
      );

      // Debug: verifică și alte status-uri
      const allRegularizaciones =
        await this.prisma.fichajeRegularizacion.findMany({
          select: {
            id: true,
            employee_codigo: true,
            workday_date: true,
            status: true,
            regularization_type: true,
          },
          orderBy: {
            workday_date: 'desc',
          },
          take: 10, // Ultimele 10
        });

      this.logger.debug(
        `📊 Last 10 regularizaciones: ${JSON.stringify(allRegularizaciones, null, 2)}`,
      );

      return result;
    } catch (error: any) {
      this.logger.error(`❌ Error getting pending reviews: ${error.message}`);
      throw new BadRequestException(
        `Error getting pending reviews: ${error.message}`,
      );
    }
  }

  /**
   * Obține regularizări confirmed pentru admin
   */
  async getConfirmedRegularizaciones(limit: number = 50) {
    try {
      return await this.prisma.fichajeRegularizacion.findMany({
        where: {
          status: FichajeRegularizacionStatus.CONFIRMED,
        },
        orderBy: {
          workday_date: 'desc',
        },
        take: limit,
      });
    } catch (error: any) {
      this.logger.error(
        `❌ Error getting confirmed regularizaciones: ${error.message}`,
      );
      throw new BadRequestException(
        `Error getting confirmed regularizaciones: ${error.message}`,
      );
    }
  }

  /**
   * Obține toate regularizările (pentru debugging/admin)
   */
  async getAllRegularizaciones(limit: number = 50) {
    try {
      return await this.prisma.fichajeRegularizacion.findMany({
        orderBy: {
          workday_date: 'desc',
        },
        take: limit,
      });
    } catch (error: any) {
      this.logger.error(
        `❌ Error getting all regularizaciones: ${error.message}`,
      );
      throw new BadRequestException(
        `Error getting all regularizaciones: ${error.message}`,
      );
    }
  }

  /**
   * Aprobă regularizare (admin)
   */
  async approveRegularizacion(id: number, reviewed_by: string) {
    try {
      const regularizacion = await this.prisma.fichajeRegularizacion.findUnique(
        {
          where: { id },
        },
      );

      if (!regularizacion) {
        throw new BadRequestException('Regularizacion not found');
      }

      // Dacă punched_minutes = 0 dar există scheduled_minutes > 0 (ex: "Olvidó fichar"),
      // folosește scheduled_minutes în loc de punched_minutes
      let effective_minutes = regularizacion.punched_minutes;
      if (regularizacion.punched_minutes === 0 && regularizacion.scheduled_minutes > 0) {
        effective_minutes = regularizacion.scheduled_minutes;
        this.logger.log(
          `📝 Approve regularizacion: punched_minutes=0, using scheduled_minutes=${regularizacion.scheduled_minutes} for employee ${regularizacion.employee_codigo}, date ${regularizacion.workday_date.toISOString().split('T')[0]}`,
        );
      }

      const updated = await this.prisma.fichajeRegularizacion.update({
        where: { id },
        data: {
          status: FichajeRegularizacionStatus.CONFIRMED,
          effective_minutes: effective_minutes, // Folosește scheduled_minutes dacă punched_minutes = 0
          reviewed_at: new Date(),
          reviewed_by,
        },
      });

      // IMPORTANT: Dacă reason_code este 'AUSENCIA_INJUSTIFICADA', creăm automat o ausencia
      if (regularizacion.reason_code === 'AUSENCIA_INJUSTIFICADA') {
        try {
          // Obține numele angajatului din DatosEmpleados
          const empleadoQuery = `
            SELECT \`NOMBRE / APELLIDOS\` as nombre
            FROM DatosEmpleados
            WHERE CODIGO = ${this.escapeSql(regularizacion.employee_codigo)}
            LIMIT 1
          `;
          const empleadoResult =
            await this.prisma.$queryRawUnsafe<any[]>(empleadoQuery);
          const nombreEmpleado =
            empleadoResult?.[0]?.nombre || regularizacion.employee_codigo;

          // Formatează data pentru ausencia (YYYY-MM-DD)
          const fechaAusencia = regularizacion.workday_date
            .toISOString()
            .split('T')[0];

          // Generează un solicitud_id unic (folosim ID-ul regularizării pentru a evita duplicate)
          const solicitud_id = `AUSENCIA_REG_${regularizacion.id}_${Date.now()}`;

          // Verifică dacă există deja o ausencia pentru această zi
          const checkExistingQuery = `
            SELECT id
            FROM Ausencias
            WHERE CODIGO = ${this.escapeSql(regularizacion.employee_codigo)}
              AND FECHA = ${this.escapeSql(fechaAusencia)}
              AND TIPO = 'Ausencia Injustificada'
            LIMIT 1
          `;
          const existingAusencia =
            await this.prisma.$queryRawUnsafe<any[]>(checkExistingQuery);

          if (!existingAusencia || existingAusencia.length === 0) {
            // Creează ausencia
            await this.ausenciasService.addAusencia({
              solicitud_id,
              codigo: regularizacion.employee_codigo,
              nombre: nombreEmpleado,
              tipo: 'Ausencia Injustificada',
              data: fechaAusencia,
              hora: '00:00:00',
              motivo:
                regularizacion.notes ||
                'Ausencia injustificada aprobada desde regularización',
            });

            this.logger.log(
              `✅ Ausencia creada automáticamente para regularización ID=${id}, employee=${regularizacion.employee_codigo}, fecha=${fechaAusencia}`,
            );
          } else {
            this.logger.debug(
              `⚠️ Ya existe una ausencia para employee=${regularizacion.employee_codigo}, fecha=${fechaAusencia}, no se crea duplicado`,
            );
          }
        } catch (ausenciaError: any) {
          // Nu aruncăm eroare dacă nu putem crea ausencia, doar logăm
          this.logger.warn(
            `⚠️ Error creando ausencia para regularización ID=${id}: ${ausenciaError.message}`,
          );
        }
      }

      this.logger.log(
        `✅ Regularizacion approved: ID=${id}, reviewed_by=${reviewed_by}`,
      );

      return updated;
    } catch (error: any) {
      this.logger.error(`❌ Error approving regularizacion: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error approving regularizacion: ${error.message}`,
      );
    }
  }

  /**
   * Respinge regularizare (admin)
   */
  async rejectRegularizacion(
    id: number,
    reviewed_by: string,
    notes?: string,
    create_ausencia: boolean = false,
  ) {
    try {
      const regularizacion = await this.prisma.fichajeRegularizacion.findUnique(
        {
          where: { id },
        },
      );

      if (!regularizacion) {
        throw new BadRequestException('Regularizacion not found');
      }

      const updated = await this.prisma.fichajeRegularizacion.update({
        where: { id },
        data: {
          status: FichajeRegularizacionStatus.REJECTED,
          effective_minutes: regularizacion.scheduled_minutes, // Folosește scheduled
          reviewed_at: new Date(),
          reviewed_by,
          notes: notes || regularizacion.notes,
        },
      });

      // IMPORTANT: Dacă create_ausencia este true, creăm automat o ausencia injustificada
      if (create_ausencia) {
        try {
          // Obține numele angajatului din DatosEmpleados
          const empleadoQuery = `
            SELECT \`NOMBRE / APELLIDOS\` as nombre
            FROM DatosEmpleados
            WHERE CODIGO = ${this.escapeSql(regularizacion.employee_codigo)}
            LIMIT 1
          `;
          const empleadoResult =
            await this.prisma.$queryRawUnsafe<any[]>(empleadoQuery);
          const nombreEmpleado =
            empleadoResult?.[0]?.nombre || regularizacion.employee_codigo;

          // Formatează data pentru ausencia (YYYY-MM-DD)
          const fechaAusencia = regularizacion.workday_date
            .toISOString()
            .split('T')[0];

          // Generează un solicitud_id unic
          const solicitud_id = `AUSENCIA_REJECT_${regularizacion.id}_${Date.now()}`;

          // Verifică dacă există deja o ausencia pentru această zi
          const checkExistingQuery = `
            SELECT id
            FROM Ausencias
            WHERE CODIGO = ${this.escapeSql(regularizacion.employee_codigo)}
              AND FECHA = ${this.escapeSql(fechaAusencia)}
              AND TIPO = 'Ausencia Injustificada'
            LIMIT 1
          `;
          const existingAusencia =
            await this.prisma.$queryRawUnsafe<any[]>(checkExistingQuery);

          if (!existingAusencia || existingAusencia.length === 0) {
            // Creează ausencia
            await this.ausenciasService.addAusencia({
              solicitud_id,
              codigo: regularizacion.employee_codigo,
              nombre: nombreEmpleado,
              tipo: 'Ausencia Injustificada',
              data: fechaAusencia,
              hora: '00:00:00',
              motivo:
                notes ||
                regularizacion.notes ||
                'Ausencia injustificada registrada al rechazar regularización',
            });

            this.logger.log(
              `✅ Ausencia creada automáticamente al rechazar regularización ID=${id}, employee=${regularizacion.employee_codigo}, fecha=${fechaAusencia}`,
            );
          } else {
            this.logger.debug(
              `⚠️ Ya existe una ausencia para employee=${regularizacion.employee_codigo}, fecha=${fechaAusencia}, no se crea duplicado`,
            );
          }
        } catch (ausenciaError: any) {
          // Nu aruncăm eroare dacă nu putem crea ausencia, doar logăm
          this.logger.warn(
            `⚠️ Error creando ausencia al rechazar regularización ID=${id}: ${ausenciaError.message}`,
          );
        }
      }

      this.logger.log(
        `✅ Regularizacion rejected: ID=${id}, reviewed_by=${reviewed_by}, create_ausencia=${create_ausencia}`,
      );

      return updated;
    } catch (error: any) {
      this.logger.error(`❌ Error rejecting regularizacion: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error rejecting regularizacion: ${error.message}`,
      );
    }
  }

  /**
   * Helper: Parse schedule string (ex: "08:00-17:00" sau "8h") în minute
   */
  private parseScheduleToMinutes(schedule: string): number {
    if (!schedule || schedule.trim() === '' || schedule === 'LIBRE') {
      return 0;
    }

    const s = schedule.trim();

    // Format cu ture multiple separate prin "/" sau ",": "07:00-15:00 / 15:00-23:00 / 23:00-07:00"
    // Sau: "07:00-15:00, 15:00-23:00, 23:00-07:00"
    const separators = /[\/,]/;
    if (separators.test(s)) {
      // Split pe separator și calculează fiecare segment
      const segments = s.split(separators);
      let totalMinutes = 0;
      
      for (const segment of segments) {
        const trimmed = segment.trim();
        if (!trimmed) continue;
        
        // Format "08:00-17:00" sau "T1:08:00-17:00"
        const timeRangeMatch = trimmed.match(/(?:T\d+:)?(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
        if (timeRangeMatch) {
          const [, h1, m1, h2, m2] = timeRangeMatch;
          const start = parseInt(h1) * 60 + parseInt(m1);
          const end = parseInt(h2) * 60 + parseInt(m2);
          const segmentMinutes = end > start ? end - start : 24 * 60 - start + end;
          totalMinutes += segmentMinutes;
          this.logger.debug(
            `  Parsed segment "${trimmed}": ${h1}:${m1}-${h2}:${m2} = ${segmentMinutes} minutes`,
          );
        }
      }
      
      if (totalMinutes > 0) {
        this.logger.debug(
          `✅ parseScheduleToMinutes - Multiple segments total: ${totalMinutes} minutes (${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m)`,
        );
        return totalMinutes;
      }
    }

    // Format "08:00-17:00" (un singur interval)
    const timeRangeMatch = s.match(/(?:T\d+:)?(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (timeRangeMatch) {
      const [, h1, m1, h2, m2] = timeRangeMatch;
      const start = parseInt(h1) * 60 + parseInt(m1);
      const end = parseInt(h2) * 60 + parseInt(m2);
      const minutes = end > start ? end - start : 24 * 60 - start + end;
      this.logger.debug(
        `✅ parseScheduleToMinutes - Single segment: ${h1}:${m1}-${h2}:${m2} = ${minutes} minutes`,
      );
      return minutes;
    }

    // Format "8h" sau "24h (3×8h)"
    const hoursMatch = s.match(/(\d+)h/);
    if (hoursMatch) {
      const minutes = parseInt(hoursMatch[1]) * 60;
      this.logger.debug(
        `✅ parseScheduleToMinutes - Hours format: ${hoursMatch[1]}h = ${minutes} minutes`,
      );
      return minutes;
    }

    this.logger.warn(
      `⚠️ parseScheduleToMinutes - Could not parse schedule: "${s}"`,
    );
    return 0;
  }

  /**
   * Helper: Parse DURACION string (format HH:MM:SS) în minute
   */
  private parseDurationToMinutes(duration: string): number {
    if (!duration || duration.trim() === '' || duration === '00:00:00') {
      return 0;
    }

    const parts = duration.trim().split(':');
    if (parts.length >= 2) {
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      const seconds = parts.length >= 3 ? parseInt(parts[2]) || 0 : 0;
      return hours * 60 + minutes + Math.round(seconds / 60);
    }

    return 0;
  }

  /**
   * Helper: Calculează diferența în minute între două timpuri
   */
  private timeDiffMinutes(time1: Date | string, time2: Date | string): number {
    const t1 =
      typeof time1 === 'string' ? new Date(`2000-01-01 ${time1}`) : time1;
    const t2 =
      typeof time2 === 'string' ? new Date(`2000-01-01 ${time2}`) : time2;
    return Math.round((t2.getTime() - t1.getTime()) / (1000 * 60));
  }

  /**
   * Creează o regularizare cu status NEEDS_REVIEW când supervisor apasă "Regularizar"
   * Trimite notificare la angajat pentru confirmare
   */
  async requestRegularizacionFromSupervisor(
    employee_codigo: string,
    fecha: string, // YYYY-MM-DD
    supervisor_codigo: string,
    supervisor_nombre?: string,
  ) {
    try {
      // Detectează workday
      const workday = await this.detectWorkday(employee_codigo, fecha);
      if (!workday) {
        throw new BadRequestException('No se encontró workday para esta fecha');
      }

      // Calculează minutele
      const punched_minutes = await this.calculatePunchedMinutes(
        employee_codigo,
        workday.window_start,
        workday.window_end,
      );

      const scheduled_minutes = await this.calculateScheduledMinutes(
        employee_codigo,
        workday.workday_date,
      );

      const delta_minutes = punched_minutes - scheduled_minutes;

      // Dacă nu există diferență semnificativă, nu e nevoie de regularizare
      if (Math.abs(delta_minutes) < this.CONFIRMATION_THRESHOLD_MINUTES) {
        throw new BadRequestException(
          'No hay diferencia significativa para regularizar',
        );
      }

      // Creează regularizare cu status NEEDS_REVIEW
      const regularization_type = FichajeRegularizacionType.DECLARES_EXTRA;
      const status = FichajeRegularizacionStatus.NEEDS_REVIEW;
      const effective_minutes = punched_minutes; // Temporar, până confirmă angajat
      const reason_code = 'supervisor_requested_review';

      const workdayDateStr = `${workday.workday_date.getFullYear()}-${String(workday.workday_date.getMonth() + 1).padStart(2, '0')}-${String(workday.workday_date.getDate()).padStart(2, '0')}`;

      const formatDateTime = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };

      const windowStartStr = formatDateTime(workday.window_start);
      const windowEndStr = formatDateTime(workday.window_end);

      // Folosim INSERT ... ON DUPLICATE KEY UPDATE pentru a evita duplicate entries
      const insertOrUpdateQuery = `
        INSERT INTO FichajeRegularizacion (
          employee_codigo,
          workday_date,
          window_start,
          window_end,
          fichaje_ids,
          regularization_type,
          status,
          scheduled_minutes,
          punched_minutes,
          effective_minutes,
          reason_code,
          created_by,
          ip_address,
          user_agent
        ) VALUES (
          ${this.escapeSql(employee_codigo)},
          STR_TO_DATE(${this.escapeSql(workdayDateStr)}, '%Y-%m-%d'),
          STR_TO_DATE(${this.escapeSql(windowStartStr)}, '%Y-%m-%d %H:%i:%s'),
          STR_TO_DATE(${this.escapeSql(windowEndStr)}, '%Y-%m-%d %H:%i:%s'),
          ${this.escapeSql(JSON.stringify(workday.fichaje_ids))},
          ${this.escapeSql(regularization_type)},
          ${this.escapeSql(status)},
          ${scheduled_minutes},
          ${punched_minutes},
          ${effective_minutes !== null ? effective_minutes : 'NULL'},
          ${reason_code ? this.escapeSql(reason_code) : 'NULL'},
          ${this.escapeSql(supervisor_codigo)},
          NULL,
          NULL
        )
        ON DUPLICATE KEY UPDATE
          workday_date = STR_TO_DATE(${this.escapeSql(workdayDateStr)}, '%Y-%m-%d'),
          window_end = STR_TO_DATE(${this.escapeSql(windowEndStr)}, '%Y-%m-%d %H:%i:%s'),
          fichaje_ids = ${this.escapeSql(JSON.stringify(workday.fichaje_ids))},
          regularization_type = ${this.escapeSql(regularization_type)},
          status = ${this.escapeSql(status)},
          scheduled_minutes = ${scheduled_minutes},
          punched_minutes = ${punched_minutes},
          effective_minutes = ${effective_minutes !== null ? effective_minutes : 'NULL'},
          reason_code = ${reason_code ? this.escapeSql(reason_code) : 'NULL'},
          created_by = ${this.escapeSql(supervisor_codigo)}
      `;

      await this.prisma.$queryRawUnsafe(insertOrUpdateQuery);

      // Recuperăm regularizarea creată/actualizată
      const created = await this.prisma.fichajeRegularizacion.findUnique({
        where: {
          employee_codigo_window_start: {
            employee_codigo,
            window_start: workday.window_start,
          },
        },
      });

      if (!created) {
        throw new BadRequestException('Failed to create/update regularizacion');
      }

      // Trimite notificare la angajat
      try {
        const supervisorName = supervisor_nombre || supervisor_codigo;
        const deltaHours = Math.floor(Math.abs(delta_minutes) / 60);
        const deltaMins = Math.abs(delta_minutes) % 60;
        const deltaText =
          delta_minutes > 0
            ? `+${deltaHours > 0 ? `${deltaHours}h ` : ''}${deltaMins}min`
            : `-${deltaHours > 0 ? `${deltaHours}h ` : ''}${deltaMins}min`;

        await this.notificationsService.notifyUser(
          supervisor_codigo,
          employee_codigo,
          {
            type: 'warning',
            title: '⚠️ Regularización de jornada solicitada',
            message: `${supervisorName} ha solicitado la regularización de tu jornada del ${fecha}. Diferencia: ${deltaText}. Por favor, confirma en la aplicación.`,
            data: {
              regularizacion_id: created.id,
              fecha,
              delta_minutes,
              punched_minutes,
              scheduled_minutes,
              supervisor_codigo,
              supervisor_nombre: supervisorName,
            },
          },
        );

        this.logger.log(
          `✅ Notificación enviada a empleado ${employee_codigo} para regularización ID=${created.id}`,
        );
      } catch (notifError: any) {
        // Nu oprește procesul dacă notificarea eșuează
        this.logger.warn(
          `⚠️ Error sending notification to employee ${employee_codigo}: ${notifError.message}`,
        );
      }

      this.logger.log(
        `✅ Regularizacion requested by supervisor: ID=${created.id}, employee=${employee_codigo}, fecha=${fecha}, supervisor=${supervisor_codigo}`,
      );

      return created;
    } catch (error: any) {
      this.logger.error(
        `❌ Error requesting regularizacion from supervisor: ${error.message}`,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error requesting regularizacion: ${error.message}`,
      );
    }
  }

  /**
   * Escapă string pentru SQL
   */
  /**
   * Detectează zile programate (scheduled_minutes > 0) dar cu 0 fichajes
   * Returnează lista de zile care necesită declarație NO_PUNCH
   */
  async detectNoPunchWorkdays(
    employee_codigo: string,
    start_date: string, // YYYY-MM-DD
    end_date: string, // YYYY-MM-DD
  ): Promise<
    Array<{
      workday_date: string; // YYYY-MM-DD
      scheduled_minutes: number;
      scheduled_hours: string; // HH:MM format
    }>
  > {
    try {
      const noPunchDays: Array<{
        workday_date: string;
        scheduled_minutes: number;
        scheduled_hours: string;
      }> = [];

      // Iterăm prin fiecare zi din interval
      const start = new Date(start_date + 'T00:00:00');
      const end = new Date(end_date + 'T23:59:59');
      const current = new Date(start);

      while (current <= end) {
        const fechaStr = current.toISOString().split('T')[0]; // YYYY-MM-DD

        // Calculează scheduled_minutes pentru această zi
        const scheduled_minutes = await this.calculateScheduledMinutes(
          employee_codigo,
          current,
        );

        // Dacă există program (scheduled_minutes > 0), verifică dacă există fichajes
        if (scheduled_minutes > 0) {
          // Verifică dacă există vreun fichaje pentru această zi
          const fichajesQuery = `
            SELECT COUNT(*) as count
            FROM Fichaje
            WHERE CODIGO = ${this.escapeSql(employee_codigo)}
              AND FECHA = ${this.escapeSql(fechaStr)}
          `;

          const fichajesResult =
            await this.prisma.$queryRawUnsafe<any[]>(fichajesQuery);
          const fichajesCount = fichajesResult?.[0]?.count || 0;

          // Dacă nu există fichajes, adaugă ziua la listă
          if (fichajesCount === 0) {
            // Verifică dacă nu există deja o regularizare NO_PUNCH pentru această zi
            const existingRegQuery = `
              SELECT id
              FROM FichajeRegularizacion
              WHERE employee_codigo = ${this.escapeSql(employee_codigo)}
                AND workday_date = STR_TO_DATE(${this.escapeSql(fechaStr)}, '%Y-%m-%d')
                AND regularization_type = 'NO_PUNCH'
              LIMIT 1
            `;

            const existingReg =
              await this.prisma.$queryRawUnsafe<any[]>(existingRegQuery);

            // Dacă nu există deja regularizare NO_PUNCH, adaugă ziua
            if (!existingReg || existingReg.length === 0) {
              const hours = Math.floor(scheduled_minutes / 60);
              const minutes = scheduled_minutes % 60;
              const scheduled_hours = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

              noPunchDays.push({
                workday_date: fechaStr,
                scheduled_minutes,
                scheduled_hours,
              });
            }
          }
        }

        // Trecem la ziua următoare
        current.setDate(current.getDate() + 1);
      }

      return noPunchDays;
    } catch (error: any) {
      this.logger.error(
        `❌ Error detecting no-punch workdays: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Declară motiv pentru zi fără fichajes (NO_PUNCH)
   */
  async declareNoPunch(dto: {
    employee_codigo: string;
    workday_date: string; // YYYY-MM-DD
    reason_code:
      | 'OLVIDO_FICHAR'
      | 'VACACIONES'
      | 'BAJA'
      | 'PERMISO'
      | 'AUSENCIA_INJUSTIFICADA'
      | 'OTRO';
    notes?: string;
    created_by: string;
    ip_address?: string;
    user_agent?: string;
  }) {
    try {
      const {
        employee_codigo,
        workday_date,
        reason_code,
        notes,
        created_by,
        ip_address,
        user_agent,
      } = dto;

      // Calculează scheduled_minutes pentru această zi
      const workdayDateObj = new Date(workday_date + 'T00:00:00');
      const scheduled_minutes = await this.calculateScheduledMinutes(
        employee_codigo,
        workdayDateObj,
      );

      if (scheduled_minutes === 0) {
        throw new BadRequestException(
          'No hay horario programado para esta fecha',
        );
      }

      // Verifică dacă există deja o regularizare pentru această zi
      const workdayDateStr = workday_date;
      const checkExistingQuery = `
        SELECT id
        FROM FichajeRegularizacion
        WHERE employee_codigo = ${this.escapeSql(employee_codigo)}
          AND workday_date = STR_TO_DATE(${this.escapeSql(workdayDateStr)}, '%Y-%m-%d')
        ORDER BY id DESC
        LIMIT 1
      `;

      const existing =
        await this.prisma.$queryRawUnsafe<any[]>(checkExistingQuery);

      // Determină status în funcție de reason_code
      // NOTĂ: VACACIONES, BAJA și PERMISO nu ar trebui să ajungă aici (sunt verificate înainte de alertaFichaj)
      // Dar le păstrăm pentru compatibilitate și pentru cazuri edge
      let status: FichajeRegularizacionStatus;
      let effective_minutes: number;

      if (reason_code === 'AUSENCIA_INJUSTIFICADA') {
        // IMPORTANT: Ausencia injustificada necesită review de la manager pentru control
        status = FichajeRegularizacionStatus.NEEDS_REVIEW;
        effective_minutes = 0;
      } else if (
        reason_code === 'VACACIONES' ||
        reason_code === 'BAJA' ||
        reason_code === 'PERMISO'
      ) {
        // Edge case: dacă ajunge aici (nu ar trebui), confirmăm automat
        status = FichajeRegularizacionStatus.CONFIRMED;
        effective_minutes = 0;
      } else {
        // OLVIDO_FICHAR sau OTRO → necesită review
        status = FichajeRegularizacionStatus.NEEDS_REVIEW;
        effective_minutes = 0; // Temporar, până aprobă admin
      }

      // Setează window_start și window_end pentru întreaga zi
      const window_start = new Date(workday_date + 'T00:00:00');
      const window_end = new Date(workday_date + 'T23:59:59');

      const formatDateTime = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };

      const windowStartStr = formatDateTime(window_start);
      const windowEndStr = formatDateTime(window_end);

      let created;

      if (existing && existing.length > 0) {
        // Actualizează existent
        const updateQuery = `
          UPDATE FichajeRegularizacion
          SET
            regularization_type = 'NO_PUNCH',
            status = ${this.escapeSql(status)},
            scheduled_minutes = ${scheduled_minutes},
            punched_minutes = 0,
            effective_minutes = ${effective_minutes},
            reason_code = ${this.escapeSql(reason_code)},
            notes = ${notes ? this.escapeSql(notes) : 'NULL'},
            window_start = STR_TO_DATE(${this.escapeSql(windowStartStr)}, '%Y-%m-%d %H:%i:%s'),
            window_end = STR_TO_DATE(${this.escapeSql(windowEndStr)}, '%Y-%m-%d %H:%i:%s'),
            confirmed_at = ${status === FichajeRegularizacionStatus.CONFIRMED ? 'NOW()' : 'NULL'}
          WHERE id = ${existing[0].id}
        `;

        await this.prisma.$queryRawUnsafe(updateQuery);

        created = await this.prisma.fichajeRegularizacion.findUnique({
          where: { id: existing[0].id },
        });
      } else {
        // Creează nou
        const insertQuery = `
          INSERT INTO FichajeRegularizacion (
            employee_codigo,
            workday_date,
            window_start,
            window_end,
            fichaje_ids,
            regularization_type,
            status,
            scheduled_minutes,
            punched_minutes,
            effective_minutes,
            reason_code,
            notes,
            created_by,
            confirmed_at,
            ip_address,
            user_agent
          ) VALUES (
            ${this.escapeSql(employee_codigo)},
            STR_TO_DATE(${this.escapeSql(workdayDateStr)}, '%Y-%m-%d'),
            STR_TO_DATE(${this.escapeSql(windowStartStr)}, '%Y-%m-%d %H:%i:%s'),
            STR_TO_DATE(${this.escapeSql(windowEndStr)}, '%Y-%m-%d %H:%i:%s'),
            '[]',
            'NO_PUNCH',
            ${this.escapeSql(status)},
            ${scheduled_minutes},
            0,
            ${effective_minutes},
            ${this.escapeSql(reason_code)},
            ${notes ? this.escapeSql(notes) : 'NULL'},
            ${this.escapeSql(created_by)},
            ${status === FichajeRegularizacionStatus.CONFIRMED ? 'NOW()' : 'NULL'},
            ${ip_address ? this.escapeSql(ip_address) : 'NULL'},
            ${user_agent ? this.escapeSql(user_agent) : 'NULL'}
          )
        `;

        await this.prisma.$queryRawUnsafe(insertQuery);

        // Recuperăm regularizarea creată
        const findCreatedQuery = `
          SELECT id
          FROM FichajeRegularizacion
          WHERE employee_codigo = ${this.escapeSql(employee_codigo)}
            AND workday_date = STR_TO_DATE(${this.escapeSql(workdayDateStr)}, '%Y-%m-%d')
            AND regularization_type = 'NO_PUNCH'
          ORDER BY id DESC
          LIMIT 1
        `;

        const createdResult =
          await this.prisma.$queryRawUnsafe<any[]>(findCreatedQuery);

        if (!createdResult || createdResult.length === 0) {
          throw new BadRequestException(
            'Failed to create NO_PUNCH regularizacion',
          );
        }

        created = await this.prisma.fichajeRegularizacion.findUnique({
          where: { id: createdResult[0].id },
        });
      }

      this.logger.log(
        `✅ NO_PUNCH regularizacion ${existing && existing.length > 0 ? 'updated' : 'created'}: ID=${created.id}, employee=${employee_codigo}, fecha=${workday_date}, reason=${reason_code}`,
      );

      return created;
    } catch (error: any) {
      this.logger.error(`❌ Error declaring NO_PUNCH: ${error.message}`);
      throw new BadRequestException(
        `Error declaring NO_PUNCH: ${error.message}`,
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
