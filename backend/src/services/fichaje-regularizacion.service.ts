import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { AusenciasService } from './ausencias.service';
import { EmailService } from './email.service';
import { SentEmailsService } from './sent-emails.service';
import { EmpleadosService } from './empleados.service';
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
  private readonly MAX_WORKDAY_HOURS = 20; // Safety cap pentru două ture consecutive (dim + seara/noapte)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly ausenciasService: AusenciasService,
    private readonly emailService: EmailService,
    private readonly sentEmailsService: SentEmailsService,
    private readonly empleadosService: EmpleadosService,
  ) {}
  private readonly MAX_GAP_HOURS = 6; // Gap between Salida and next Entrada
  private readonly CONFIRMATION_THRESHOLD_MINUTES = 15; // If abs(delta) > 15min => needs review/approval

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
    workday_date: Date | string,
  ): Promise<number> {
    try {
      // Normalizează input-ul la string YYYY-MM-DD pentru a evita problemele de timezone
      let fechaStr: string;
      let workdayDateObj: Date;

      if (typeof workday_date === 'string') {
        // Dacă este deja string, folosește-l direct
        fechaStr = workday_date;
        // Construiește Date folosind UTC pentru a evita timezone issues
        const [year, month, day] = fechaStr.split('-').map(Number);
        workdayDateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      } else {
        // Dacă este Date, extrage string-ul folosind metode locale (nu toISOString care e UTC)
        const year = workday_date.getFullYear();
        const month = String(workday_date.getMonth() + 1).padStart(2, '0');
        const day = String(workday_date.getDate()).padStart(2, '0');
        fechaStr = `${year}-${month}-${day}`;
        workdayDateObj = workday_date;
      }

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

      // Fallback la horario_multicentro - caută pentru angajat în luna specificată
      // Mai întâi verificăm dacă există înregistrări pentru acest angajat în această lună (pentru debugging)
      const debugQuery = `
        SELECT CODIGO, LUNA, HORARIO, CLIENTE, 
               ZI_${dia} as zi_${dia}_val,
               CASE WHEN ZI_${dia} IS NULL THEN 'NULL' 
                    WHEN TRIM(ZI_${dia}) = '' THEN 'EMPTY'
                    WHEN ZI_${dia} = '0' THEN 'ZERO'
                    WHEN ZI_${dia} = '0h' THEN 'ZERO_H'
                    ELSE ZI_${dia}
               END as zi_${dia}_status
        FROM horario_multicentro
        WHERE CODIGO = ${this.escapeSql(employee_codigo)}
          AND LUNA = ${this.escapeSql(mesStr)}
        LIMIT 5
      `;
      const debugResult = await this.prisma.$queryRawUnsafe<any[]>(debugQuery);
      if (debugResult && debugResult.length > 0) {
        this.logger.debug(
          `🔍 [DEBUG] horario_multicentro exists for ${employee_codigo}, LUNA=${mesStr}: ${debugResult.length} records. ZI_${dia} status: ${JSON.stringify(debugResult.map((r) => ({ cliente: r.CLIENTE, horario: r.HORARIO, zi_val: r[`zi_${dia}_val`], zi_status: r[`zi_${dia}_status`] })))}`,
        );
      } else {
        this.logger.debug(
          `🔍 [DEBUG] NO horario_multicentro records found for ${employee_codigo}, LUNA=${mesStr}`,
        );
      }

      // Pentru horario_multicentro, trebuie să luăm în considerare că un angajat poate avea
      // mai multe înregistrări pentru aceeași zi (ex: TURNO DIA și TURNO NOCHE)
      // Dacă suntem într-un context de tură nocturnă (workday_date diferit de calendar date),
      // priorităm TURNO NOCHE, altfel TURNO DIA
      // Pentru a detecta dacă este tură nocturnă, verificăm dacă workday_date (data Entrada-ului)
      // este diferită de data curentă (fechaStr) - aceasta indică o tură care începe într-o zi
      // și se termină în următoarea

      // Verifică dacă există mai multe înregistrări pentru aceeași zi
      const checkMultipleQuery = `
        SELECT HORARIO, ZI_${dia} as schedule_horas
        FROM horario_multicentro
        WHERE CODIGO = ${this.escapeSql(employee_codigo)}
          AND LUNA = ${this.escapeSql(mesStr)}
          AND ZI_${dia} IS NOT NULL
          AND TRIM(ZI_${dia}) != ''
          AND ZI_${dia} != '0'
          AND ZI_${dia} != '0h'
        ORDER BY 
          CASE WHEN HORARIO LIKE '%NOCHE%' THEN 1 ELSE 2 END,
          HORARIO
        LIMIT 5
      `;

      const allMatches =
        await this.prisma.$queryRawUnsafe<any[]>(checkMultipleQuery);

      let horarioMulticentro: any[] = [];

      if (allMatches && allMatches.length > 1) {
        // Există multiple înregistrări - trebuie să determinăm care este corectă
        // Pentru horario_multicentro, dacă un angajat are atât TURNO DIA (8h) cât și TURNO NOCHE (12h) în aceeași zi,
        // priorităm TURNO NOCHE (12h) pentru că:
        // 1. Are mai multe ore (12h vs 8h) - probabil este tura principală
        // 2. Pentru turele nocturne, workday_date este deja setat la data Entrada-ului (ziua anterioară),
        //    deci verificăm ZI_6 pentru tura care se termină pe 7 ianuarie dimineața
        // 3. TURNO NOCHE indică explicit o tură nocturnă

        // Prioritizează TURNO NOCHE dacă există (are 12h, care este pentru tură nocturnă)
        const nocheMatch = allMatches.find(
          (m) =>
            m.HORARIO &&
            (m.HORARIO.toUpperCase().includes('NOCHE') ||
              m.HORARIO.toUpperCase().includes('T3')),
        );

        // Verifică și orele - dacă una dintre înregistrări are 12h, probabil este pentru tură nocturnă
        const horarioWithMoreHours = allMatches.reduce((max, current) => {
          const currentHours = this.parseScheduleToMinutes(
            current.schedule_horas || '0',
          );
          const maxHours = this.parseScheduleToMinutes(
            max.schedule_horas || '0',
          );
          return currentHours > maxHours ? current : max;
        }, allMatches[0]);

        // Dacă există TURNO NOCHE, îl folosim (are prioritate)
        if (nocheMatch) {
          horarioMulticentro = [nocheMatch];
          this.logger.debug(
            `🌙 Multiple horarios found - selecting TURNO NOCHE (${nocheMatch.schedule_horas}) for ${employee_codigo} on ${fechaStr} (day ${dia})`,
          );
        } else if (
          horarioWithMoreHours &&
          this.parseScheduleToMinutes(
            horarioWithMoreHours.schedule_horas || '0',
          ) >= 720
        ) {
          // Dacă nu există TURNO NOCHE explicit, dar există o înregistrare cu >= 12h (720 min),
          // probabil este pentru tură nocturnă
          horarioMulticentro = [horarioWithMoreHours];
          this.logger.debug(
            `🌙 Multiple horarios found - selecting horario with more hours (${horarioWithMoreHours.schedule_horas} = ${horarioWithMoreHours.HORARIO}) for ${employee_codigo} on ${fechaStr} (day ${dia})`,
          );
        } else {
          // Dacă nu există TURNO NOCHE și nici o înregistrare cu >= 12h, folosim prima (TURNO DIA)
          horarioMulticentro = [allMatches[0]];
          this.logger.debug(
            `☀️ Multiple horarios found - selecting first (${allMatches[0].HORARIO} = ${allMatches[0].schedule_horas}) for ${employee_codigo} on ${fechaStr} (day ${dia})`,
          );
        }
      } else if (allMatches && allMatches.length === 1) {
        // Există o singură înregistrare - folosim-o
        horarioMulticentro = [allMatches[0]];
      }

      this.logger.debug(
        `🔍 calculateScheduledMinutes - Checking horario_multicentro for ${employee_codigo} on ${fechaStr} (day ${dia}, month ${mesStr}): found ${horarioMulticentro?.length || 0} results`,
      );

      if (
        horarioMulticentro &&
        horarioMulticentro.length > 0 &&
        horarioMulticentro[0].schedule_horas
      ) {
        const scheduleStr = horarioMulticentro[0].schedule_horas;

        // parseScheduleToMinutes acum suportă automat atât formate cu timpi (T1 07:30-19:30) cât și numere simple (8, 12)
        const minutes = this.parseScheduleToMinutes(scheduleStr);

        if (minutes > 0) {
          this.logger.debug(
            `✅ calculateScheduledMinutes - Found horario_multicentro schedule: ${scheduleStr} (${horarioMulticentro[0].horario_tipo || 'N/A'}) = ${minutes} minutes`,
          );
          return minutes;
        }
      }

      // Fallback la horario - folosește CASE pentru ziua săptămânii
      // Folosește STR_TO_DATE pentru a converti string-ul la DATE și a evita timezone issues
      // Pentru datele din trecut, relaxăm condițiile vigente_hasta pentru a permite regularizări
      const fechaDate = new Date(fechaStr + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isPastDate = fechaDate < today;

      // Dacă data este în trecut, folosim orarul cel mai recent care era activ la acea dată
      // (verificăm doar vigente_desde, nu vigente_hasta strict pentru datele din trecut)
      // Dacă data este în prezent sau viitor, folosim condițiile normale de vigencia
      const horarioQuery = `
        SELECT 
          CASE DAYOFWEEK(STR_TO_DATE(${this.escapeSql(fechaStr)}, '%Y-%m-%d'))
            WHEN 2 THEN h.lun_in1 WHEN 3 THEN h.mar_in1 WHEN 4 THEN h.mie_in1
            WHEN 5 THEN h.joi_in1 WHEN 6 THEN h.vin_in1 WHEN 7 THEN h.sam_in1
            WHEN 1 THEN h.dum_in1 ELSE NULL
          END as in1,
          CASE DAYOFWEEK(STR_TO_DATE(${this.escapeSql(fechaStr)}, '%Y-%m-%d'))
            WHEN 2 THEN h.lun_out1 WHEN 3 THEN h.mar_out1 WHEN 4 THEN h.mie_out1
            WHEN 5 THEN h.joi_out1 WHEN 6 THEN h.vin_out1 WHEN 7 THEN h.sam_out1
            WHEN 1 THEN h.dum_out1 ELSE NULL
          END as out1,
          CASE DAYOFWEEK(STR_TO_DATE(${this.escapeSql(fechaStr)}, '%Y-%m-%d'))
            WHEN 2 THEN h.lun_in2 WHEN 3 THEN h.mar_in2 WHEN 4 THEN h.mie_in2
            WHEN 5 THEN h.joi_in2 WHEN 6 THEN h.vin_in2 WHEN 7 THEN h.sam_in2
            WHEN 1 THEN h.dum_in2 ELSE NULL
          END as in2,
          CASE DAYOFWEEK(STR_TO_DATE(${this.escapeSql(fechaStr)}, '%Y-%m-%d'))
            WHEN 2 THEN h.lun_out2 WHEN 3 THEN h.mar_out2 WHEN 4 THEN h.mie_out2
            WHEN 5 THEN h.joi_out2 WHEN 6 THEN h.vin_out2 WHEN 7 THEN h.sam_out2
            WHEN 1 THEN h.dum_out2 ELSE NULL
          END as out2,
          CASE DAYOFWEEK(STR_TO_DATE(${this.escapeSql(fechaStr)}, '%Y-%m-%d'))
            WHEN 2 THEN h.lun_in3 WHEN 3 THEN h.mar_in3 WHEN 4 THEN h.mie_in3
            WHEN 5 THEN h.joi_in3 WHEN 6 THEN h.vin_in3 WHEN 7 THEN h.sam_in3
            WHEN 1 THEN h.dum_in3 ELSE NULL
          END as in3,
          CASE DAYOFWEEK(STR_TO_DATE(${this.escapeSql(fechaStr)}, '%Y-%m-%d'))
            WHEN 2 THEN h.lun_out3 WHEN 3 THEN h.mar_out3 WHEN 4 THEN h.mie_out3
            WHEN 5 THEN h.joi_out3 WHEN 6 THEN h.vin_out3 WHEN 7 THEN h.sam_out3
            WHEN 1 THEN h.dum_out3 ELSE NULL
          END as out3
        FROM horarios h
        JOIN DatosEmpleados de
          ON h.centro_nombre = de.\`CENTRO TRABAJO\`
         AND h.grupo_nombre = de.GRUPO
        WHERE de.CODIGO = ${this.escapeSql(employee_codigo)}
          AND (h.vigente_desde IS NULL OR h.vigente_desde <= STR_TO_DATE(${this.escapeSql(fechaStr)}, '%Y-%m-%d'))
          ${
            isPastDate
              ? `-- Pentru datele din trecut, ignorăm vigente_hasta pentru a permite regularizări`
              : `AND (h.vigente_hasta IS NULL OR h.vigente_hasta >= STR_TO_DATE(${this.escapeSql(fechaStr)}, '%Y-%m-%d'))`
          }
        ORDER BY h.vigente_desde DESC
        LIMIT 1
      `;

      // Folosește query-ul direct fără parametri suplimentari (toate valorile sunt deja în query)
      const horario = await this.prisma.$queryRawUnsafe<any[]>(horarioQuery);

      this.logger.debug(
        `🔍 calculateScheduledMinutes - Checking horario for ${employee_codigo} on ${fechaStr}: found ${horario?.length || 0} results`,
      );

      if (horario && horario.length > 0) {
        const h = horario[0];
        let totalMinutes = 0;
        let segmentsFound = 0;

        // Log datele primite pentru debugging
        this.logger.debug(
          `🔍 calculateScheduledMinutes - Raw horario data: in1=${h.in1} (type: ${typeof h.in1}), out1=${h.out1} (type: ${typeof h.out1}), in2=${h.in2} (type: ${typeof h.in2}), out2=${h.out2} (type: ${typeof h.out2}), in3=${h.in3} (type: ${typeof h.in3}), out3=${h.out3} (type: ${typeof h.out3})`,
        );

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
        if (
          segmentsFound === 3 &&
          h.in1 &&
          h.out1 &&
          h.in2 &&
          h.out2 &&
          h.in3 &&
          h.out3
        ) {
          const seg1 = this.timeDiffMinutes(h.in1, h.out1);
          const seg2 = this.timeDiffMinutes(h.in2, h.out2);
          const seg3 = this.timeDiffMinutes(h.in3, h.out3);
          const correctedSeg1 = seg1 < 0 ? seg1 + 24 * 60 : seg1;
          const correctedSeg2 = seg2 < 0 ? seg2 + 24 * 60 : seg2;
          const correctedSeg3 = seg3 < 0 ? seg3 + 24 * 60 : seg3;
          const totalAllSegments =
            correctedSeg1 + correctedSeg2 + correctedSeg3;

          this.logger.debug(
            `🔍 Checking if all 3 segments sum to 24h: seg1=${seg1} (corrected: ${correctedSeg1}), seg2=${seg2} (corrected: ${correctedSeg2}), seg3=${seg3} (corrected: ${correctedSeg3}), total=${totalAllSegments} minutes`,
          );

          // Dacă suma tuturor segmentelor este 24 ore (1440 minute) sau aproape 24 ore (permite o mică diferență pentru erori de rotunjire),
          // înseamnă că sunt opțiuni de ture, nu ture care trebuie toate lucrate
          // În acest caz, folosim doar prima tură disponibilă
          if (totalAllSegments >= 23 * 60 && totalAllSegments <= 25 * 60) {
            // Suma este aproape 24 ore (permite o diferență de ±1 oră pentru erori de rotunjire)
            this.logger.debug(
              `⚠️ All 3 segments sum to ~24h (${totalAllSegments} minutes) - these are shift options, not all shifts to work. Using only first segment.`,
            );
            const segment1 = this.timeDiffMinutes(h.in1, h.out1);
            const correctedSegment1 =
              segment1 < 0 ? segment1 + 24 * 60 : segment1;
            totalMinutes = correctedSegment1;
            this.logger.debug(
              `  Using Segment 1 only: ${h.in1} - ${h.out1} = ${segment1} minutes (night shift: ${segment1 < 0}, corrected: ${correctedSegment1}, final total: ${totalMinutes})`,
            );
          } else {
            // Dacă suma nu este 24 ore, înseamnă că sunt split shifts care trebuie toate lucrate
            // Sumă toate segmentele
            if (h.in1 && h.out1) {
              const segment1 = this.timeDiffMinutes(h.in1, h.out1);
              const correctedSegment1 =
                segment1 < 0 ? segment1 + 24 * 60 : segment1;
              totalMinutes += correctedSegment1;
              this.logger.debug(
                `  Segment 1: ${h.in1} - ${h.out1} = ${segment1} minutes (night shift: ${segment1 < 0}, corrected: ${correctedSegment1}, total so far: ${totalMinutes})`,
              );
            }
            if (h.in2 && h.out2) {
              const segment2 = this.timeDiffMinutes(h.in2, h.out2);
              const correctedSegment2 =
                segment2 < 0 ? segment2 + 24 * 60 : segment2;
              totalMinutes += correctedSegment2;
              this.logger.debug(
                `  Segment 2: ${h.in2} - ${h.out2} = ${segment2} minutes (night shift: ${segment2 < 0}, corrected: ${correctedSegment2}, total so far: ${totalMinutes})`,
              );
            }
            if (h.in3 && h.out3) {
              const segment3 = this.timeDiffMinutes(h.in3, h.out3);
              const correctedSegment3 =
                segment3 < 0 ? segment3 + 24 * 60 : segment3;
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
            const correctedSegment1 =
              segment1 < 0 ? segment1 + 24 * 60 : segment1;
            totalMinutes += correctedSegment1;
            this.logger.debug(
              `  Segment 1: ${h.in1} - ${h.out1} = ${segment1} minutes (night shift: ${segment1 < 0}, corrected: ${correctedSegment1}, total so far: ${totalMinutes})`,
            );
          }
          if (h.in2 && h.out2) {
            const segment2 = this.timeDiffMinutes(h.in2, h.out2);
            const correctedSegment2 =
              segment2 < 0 ? segment2 + 24 * 60 : segment2;
            totalMinutes += correctedSegment2;
            this.logger.debug(
              `  Segment 2: ${h.in2} - ${h.out2} = ${segment2} minutes (night shift: ${segment2 < 0}, corrected: ${correctedSegment2}, total so far: ${totalMinutes})`,
            );
          }
          if (h.in3 && h.out3) {
            const segment3 = this.timeDiffMinutes(h.in3, h.out3);
            const correctedSegment3 =
              segment3 < 0 ? segment3 + 24 * 60 : segment3;
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

      // Fallback: Dacă nu există nici cuadrante, nici horario_multicentro, nici horario, folosim orele din contract
      // Calculează orele zilnice din contract (presupunem că contractul este pe săptămână)
      // Ordinea verificării: 1. cuadrante, 2. horario_multicentro, 3. horario, 4. contract hours
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
          const dayOfWeek = workdayDateObj.getUTCDay(); // 0 = duminică, 1 = luni, ..., 6 = sâmbătă
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
        `⚠️ No schedule found (checked: cuadrante -> horario_multicentro -> horario -> contract hours) for ${employee_codigo} on ${fechaStr}`,
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

      // Fallback la horario_multicentro - caută pentru angajat în luna specificată
      // (mesStr și dia sunt deja declarate mai sus)
      // Pentru getScheduledEntryTime, verificăm toate înregistrările și alegem prima care are un time range valid
      const horarioMulticentroQuery = `
        SELECT ZI_${dia} as schedule_horas, HORARIO as horario_tipo
        FROM horario_multicentro
        WHERE CODIGO = ${this.escapeSql(employee_codigo)}
          AND LUNA = ${this.escapeSql(mesStr)}
          AND ZI_${dia} IS NOT NULL
          AND TRIM(ZI_${dia}) != ''
          AND ZI_${dia} != '0'
          AND ZI_${dia} != '0h'
        ORDER BY 
          CASE WHEN HORARIO LIKE '%DIA%' THEN 1 
               WHEN HORARIO LIKE '%T1%' THEN 2
               WHEN HORARIO LIKE '%T2%' THEN 3
               WHEN HORARIO LIKE '%NOCHE%' THEN 4
               WHEN HORARIO LIKE '%T3%' THEN 5
               ELSE 6 END,
          HORARIO
        LIMIT 5
      `;

      const horarioMulticentro = await this.prisma.$queryRawUnsafe<any[]>(
        horarioMulticentroQuery,
      );

      if (horarioMulticentro && horarioMulticentro.length > 0) {
        // Încearcă să găsească prima înregistrare care are un time range valid (nu doar număr de ore)
        for (const horario of horarioMulticentro) {
          if (horario.schedule_horas) {
            const scheduleStr = horario.schedule_horas;
            // Parse "08:00-17:00" sau "T1 07:30-19:30" sau "T2 19:30-07:30" -> returnează "08:00", "07:30", sau "19:30"
            // Suportăm atât "T1 07:30-19:30" (cu spațiu) cât și "T1:07:30-19:30" (cu două puncte)
            const timeRangeMatch = scheduleStr.match(
              /(?:T\d+\s*:?)?\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/,
            );
            if (timeRangeMatch) {
              this.logger.debug(
                `✅ getScheduledEntryTime - Found horario_multicentro entry time: ${timeRangeMatch[1]}:${timeRangeMatch[2]} from ${scheduleStr} (${horario.horario_tipo || 'N/A'})`,
              );
              return `${timeRangeMatch[1].padStart(2, '0')}:${timeRangeMatch[2]}`;
            }
          }
        }

        // Dacă niciunul nu are time range valid, verificăm dacă avem doar număr de ore
        const firstSchedule = horarioMulticentro[0].schedule_horas;
        if (firstSchedule && firstSchedule.match(/^(\d+(?:\.\d+)?)(\s*h)?$/i)) {
          this.logger.debug(
            `⚠️ getScheduledEntryTime - horario_multicentro contains only hours (${firstSchedule}), cannot extract entry time`,
          );
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
        const horaTime =
          horaStr instanceof Date
            ? horaStr.toTimeString().slice(0, 8)
            : horaStr;
        const [salidaHours] = horaTime.split(':').map(Number);
        const isMorningSalida = salidaHours < 12; // Salida înainte de 12:00 = dimineața

        if (isMorningSalida) {
          // Verifică dacă există Entrada în ziua ANTERIOARĂ (ziua precedentă zilei Salida-ului) după 17:00
          // Ex: pentru Salida pe 2026-01-07, verifică Entrada pe 2026-01-06 (nu 2026-01-05!)
          // Folosim calcul manual pentru a evita probleme cu timezone
          const [year, month, day] = fechaStr.split('-').map(Number);
          const fechaAnteriorDate = new Date(
            Date.UTC(year, month - 1, day, 0, 0, 0),
          );
          fechaAnteriorDate.setUTCDate(fechaAnteriorDate.getUTCDate() - 1);
          const fechaAnteriorStr = fechaAnteriorDate
            .toISOString()
            .split('T')[0];

          this.logger.debug(
            `🔍 Checking for night shift: Salida on ${fechaStr} at ${horaTime}, checking Entrada on ${fechaAnteriorStr} (calculated from ${fechaStr})`,
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

          const entradas =
            await this.prisma.$queryRawUnsafe<any[]>(entradaQuery);

          this.logger.debug(
            `🔍 Found ${entradas?.length || 0} Entradas on ${fechaAnteriorStr}`,
          );

          if (entradas && entradas.length > 0) {
            const entradaHoraStr =
              entradas[0].HORA instanceof Date
                ? entradas[0].HORA.toTimeString().slice(0, 8)
                : entradas[0].HORA;
            const [entradaHours] = entradaHoraStr.split(':').map(Number);

            this.logger.debug(
              `🔍 Entrada time: ${entradaHoraStr} (${entradaHours} hours), checking if >= 17`,
            );

            if (entradaHours >= 17) {
              // Este tură nocturnă: Entrada în ziua anterioară după 17:00, Salida în ziua următoare dimineața
              // workday_date = ziua de început (ziua Entrada-ului)
              // Folosim fechaAnteriorDate pentru a seta workday_date corect
              workday_date = new Date(fechaAnteriorDate);
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
      // Permite regularizarea doar dacă:
      // 1. Există scheduled_minutes > 0 (există program prevăzut)
      // 2. ȘI există punched_minutes > 0 (ore fichate)
      // 3. ȘI diferența depășește pragul de 15 minute
      const needs_confirmation =
        scheduled_minutes > 0 && punched_minutes > 0
          ? Math.abs(delta_minutes) > this.CONFIRMATION_THRESHOLD_MINUTES
          : false;

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

      // Calculează delta pentru a decide effective_minutes și status corect
      const delta_minutes = punched_minutes - scheduled_minutes;

      // Determină tipul și statusul
      let regularization_type: FichajeRegularizacionType;
      let status: FichajeRegularizacionStatus;
      let effective_minutes: number;
      let reason_code: string;

      // Regula: statusul se decide după pragul de 15 minute, nu după decision
      // - |delta| > 15 min → NEEDS_REVIEW (intră la Aprobări)
      // - |delta| ≤ 15 min → CONFIRMED (nu intră la Aprobări)
      const needsReview =
        Math.abs(delta_minutes) > this.CONFIRMATION_THRESHOLD_MINUTES;

      if (decision === 'no_extra') {
        regularization_type = FichajeRegularizacionType.NO_EXTRA;
        // Statusul se decide după prag, nu după decision
        status = needsReview
          ? FichajeRegularizacionStatus.NEEDS_REVIEW
          : FichajeRegularizacionStatus.CONFIRMED;

        // Logica pentru effective_minutes în cazul NO_EXTRA:
        // - reason='worked_less' sau 'auto_threshold_exceeded_negative' (delta negativă, user confirmă că a lucrat mai puțin sau auto-send) → punched_minutes
        // - reason='punch_error' (delta negativă, user zice că e eroare) → scheduled_minutes
        // - altfel (delta pozitivă, user zice că nu a lucrat mai mult) → scheduled_minutes
        if (
          reason === 'worked_less' ||
          reason === 'auto_threshold_exceeded_negative'
        ) {
          // User confirmă că a lucrat mai puțin sau auto-send pentru delta negativă → salvăm orele fichate
          effective_minutes = punched_minutes;
          reason_code =
            reason === 'auto_threshold_exceeded_negative'
              ? 'employee_declares_less'
              : 'employee_confirmed_worked_less';
        } else if (reason === 'punch_error') {
          // User zice că e eroare de fichaje → salvăm orele prevăzute
          effective_minutes = scheduled_minutes;
          reason_code = 'employee_confirmed_punch_error';
        } else {
          // Delta pozitivă, user zice că nu a lucrat mai mult → salvăm orele prevăzute
          effective_minutes = scheduled_minutes;
          reason_code = 'employee_confirmed_no_extra';
        }

        this.logger.debug(
          `📝 confirmJornada: decision=no_extra, reason=${reason}, |delta|=${Math.abs(delta_minutes)}, threshold=${this.CONFIRMATION_THRESHOLD_MINUTES}, needsReview=${needsReview}, status=${status}, effective_minutes=${effective_minutes}`,
        );
      } else {
        // worked_more - user declară că a lucrat diferit (mai mult sau mai puțin)
        regularization_type = FichajeRegularizacionType.DECLARES_EXTRA;
        // Statusul se decide după prag, nu după decision
        status = needsReview
          ? FichajeRegularizacionStatus.NEEDS_REVIEW
          : FichajeRegularizacionStatus.CONFIRMED;
        // Când user declară explicit că a lucrat diferit (worked_more), salvăm orele fichate (punched_minutes)
        // Indiferent dacă delta e pozitivă sau negativă - user recunoaște diferența
        effective_minutes = punched_minutes;
        reason_code = 'employee_declares_extra';

        this.logger.debug(
          `📝 confirmJornada: decision=worked_more, |delta|=${Math.abs(delta_minutes)}, threshold=${this.CONFIRMATION_THRESHOLD_MINUTES}, needsReview=${needsReview}, status=${status}, effective_minutes=${effective_minutes} (punched)`,
        );
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

      // Logica pentru effective_minutes la aprobare:
      // 1. Dacă regularization_type = NO_EXTRA → păstrează effective_minutes așa cum e (nu modifica)
      // 2. Dacă regularization_type = DECLARES_EXTRA:
      //    - Dacă punched_minutes = 0 (ex: "Olvidó fichar") → folosește scheduled_minutes
      //    - Dacă punched_minutes < scheduled_minutes (delta negativă) → folosește scheduled_minutes (8h, nu 7h38)
      //    - Altfel (delta pozitivă sau zero) → folosește punched_minutes
      // 3. Dacă regularization_type = NO_PUNCH:
      //    - Dacă reason_code = 'OLVIDO_FICHAR' și punched_minutes = 0 → folosește scheduled_minutes (8h, nu 0)
      //    - Pentru alte reason_code-uri (VACACIONES, BAJA, PERMISO, AUSENCIA_INJUSTIFICADA) → rămâne 0
      this.logger.debug(
        `🔍 approveRegularizacion: ID=${id}, regularization_type=${regularizacion.regularization_type}, reason_code=${regularizacion.reason_code}, punched_minutes=${regularizacion.punched_minutes}, scheduled_minutes=${regularizacion.scheduled_minutes}, current effective_minutes=${regularizacion.effective_minutes}`,
      );

      let effective_minutes = regularizacion.effective_minutes; // Păstrează valoarea existentă by default

      if (
        regularizacion.regularization_type ===
        FichajeRegularizacionType.NO_EXTRA
      ) {
        // Când user a zis "No" (nu am lucrat mai mult/mai puțin), păstrăm effective_minutes așa cum e
        // (deja setat la scheduled_minutes în confirmJornada)
        effective_minutes = regularizacion.effective_minutes;
        this.logger.log(
          `📝 Approve regularizacion: regularization_type=NO_EXTRA, keeping existing effective_minutes=${effective_minutes} for employee ${regularizacion.employee_codigo}, date ${regularizacion.workday_date.toISOString().split('T')[0]}`,
        );
      } else if (
        regularizacion.regularization_type ===
        FichajeRegularizacionType.DECLARES_EXTRA
      ) {
        // Când user a zis "Sí" (am lucrat mai mult/mai puțin), păstrăm effective_minutes așa cum e
        // (deja setat la punched_minutes în confirmJornada - user recunoaște diferența)
        // Excepție: dacă punched_minutes = 0 (ex: "Olvidó fichar"), folosim scheduled_minutes
        if (
          regularizacion.punched_minutes === 0 &&
          regularizacion.scheduled_minutes > 0
        ) {
          effective_minutes = regularizacion.scheduled_minutes;
          this.logger.log(
            `📝 Approve regularizacion: DECLARES_EXTRA with punched_minutes=0, using scheduled_minutes=${regularizacion.scheduled_minutes} for employee ${regularizacion.employee_codigo}, date ${regularizacion.workday_date.toISOString().split('T')[0]}`,
          );
        } else {
          // Păstrăm effective_minutes așa cum e (deja setat la punched_minutes în confirmJornada)
          effective_minutes = regularizacion.effective_minutes;
          this.logger.log(
            `📝 Approve regularizacion: DECLARES_EXTRA, keeping existing effective_minutes=${effective_minutes} for employee ${regularizacion.employee_codigo}, date ${regularizacion.workday_date.toISOString().split('T')[0]}`,
          );
        }
      } else if (
        regularizacion.regularization_type ===
        FichajeRegularizacionType.NO_PUNCH
      ) {
        // Pentru NO_PUNCH, verificăm reason_code pentru a determina effective_minutes
        // Pentru OLVIDO_FICHAR, AUSENCIA_INJUSTIFICADA și OTRO cu punched_minutes = 0 → aprobă orele previste
        if (
          (regularizacion.reason_code === 'OLVIDO_FICHAR' ||
            regularizacion.reason_code === 'AUSENCIA_INJUSTIFICADA' ||
            regularizacion.reason_code === 'OTRO') &&
          regularizacion.punched_minutes === 0 &&
          regularizacion.scheduled_minutes > 0
        ) {
          // "Olvidó fichar", "Ausencia injustificada" sau "Otro" → aprobă orele previste (scheduled_minutes) ca ore efective
          effective_minutes = regularizacion.scheduled_minutes;
          this.logger.log(
            `📝 Approve regularizacion: NO_PUNCH with reason_code=${regularizacion.reason_code}, using scheduled_minutes=${regularizacion.scheduled_minutes} for employee ${regularizacion.employee_codigo}, date ${regularizacion.workday_date.toISOString().split('T')[0]}`,
          );
        } else {
          // Pentru VACACIONES, BAJA, PERMISO → rămâne 0
          effective_minutes = regularizacion.effective_minutes || 0;
          this.logger.log(
            `📝 Approve regularizacion: NO_PUNCH with reason_code=${regularizacion.reason_code}, keeping effective_minutes=${effective_minutes} for employee ${regularizacion.employee_codigo}, date ${regularizacion.workday_date.toISOString().split('T')[0]}`,
          );
        }
      }

      this.logger.debug(
        `🔍 approveRegularizacion: Final effective_minutes=${effective_minutes} for ID=${id}`,
      );

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

      // Trimite email către angajat (dacă există email)
      try {
        await this.sendRegularizacionEmailToEmployee(
          regularizacion.employee_codigo,
          regularizacion.workday_date,
          regularizacion.punched_minutes,
          regularizacion.scheduled_minutes,
          regularizacion.effective_minutes || effective_minutes,
          regularizacion.reason_code,
          'approved',
          reviewed_by,
        );
      } catch (emailError: any) {
        // Nu oprește procesul dacă email-ul eșuează
        this.logger.warn(
          `⚠️ Error sending email to employee ${regularizacion.employee_codigo} for approved regularizacion: ${emailError.message}`,
        );
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

      // La respingere, setăm effective_minutes = 0 pentru toate tipurile de regularizări
      const updated = await this.prisma.fichajeRegularizacion.update({
        where: { id },
        data: {
          status: FichajeRegularizacionStatus.REJECTED,
          effective_minutes: 0, // La respingere, setăm 0 ore efective
          reviewed_at: new Date(),
          reviewed_by,
          notes: notes || regularizacion.notes,
        },
      });

      this.logger.log(
        `📝 Reject regularizacion: ID=${id}, employee=${regularizacion.employee_codigo}, date=${regularizacion.workday_date.toISOString().split('T')[0]}, reason_code=${regularizacion.reason_code}, effective_minutes set to 0`,
      );

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

      // Trimite email către angajat (dacă există email)
      try {
        await this.sendRegularizacionEmailToEmployee(
          regularizacion.employee_codigo,
          regularizacion.workday_date,
          regularizacion.punched_minutes,
          regularizacion.scheduled_minutes,
          0, // effective_minutes = 0 la respingere
          regularizacion.reason_code,
          'rejected',
          reviewed_by,
          notes || regularizacion.notes,
        );
      } catch (emailError: any) {
        // Nu oprește procesul dacă email-ul eșuează
        this.logger.warn(
          `⚠️ Error sending email to employee ${regularizacion.employee_codigo} for rejected regularizacion: ${emailError.message}`,
        );
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
    // Sau: "T1 07:30-19:30 / T2 19:30-07:30"
    const separators = /[/,]/;
    if (separators.test(s)) {
      // Split pe separator și calculează fiecare segment
      const segments = s.split(separators);
      let totalMinutes = 0;

      for (const segment of segments) {
        const trimmed = segment.trim();
        if (!trimmed) continue;

        // Format "08:00-17:00" sau "T1 07:30-19:30" sau "T1:08:00-17:00"
        // Suportăm atât "T1 07:30-19:30" (cu spațiu) cât și "T1:07:30-19:30" (cu două puncte)
        const timeRangeMatch = trimmed.match(
          /(?:T\d+\s*:?)?\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/,
        );
        if (timeRangeMatch) {
          const [, h1, m1, h2, m2] = timeRangeMatch;
          const start = parseInt(h1) * 60 + parseInt(m1);
          const end = parseInt(h2) * 60 + parseInt(m2);
          const segmentMinutes =
            end > start ? end - start : 24 * 60 - start + end;
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

    // Format "08:00-17:00" sau "T1 07:30-19:30" sau "T2 19:30-07:30" (un singur interval)
    // Suportăm atât "T1 07:30-19:30" (cu spațiu) cât și "T1:07:30-19:30" (cu două puncte)
    const timeRangeMatch = s.match(
      /(?:T\d+\s*:?)?\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/,
    );
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
    const hoursMatch = s.match(/(\d+(?:\.\d+)?)\s*h/i);
    if (hoursMatch) {
      const minutes = Math.round(parseFloat(hoursMatch[1]) * 60);
      this.logger.debug(
        `✅ parseScheduleToMinutes - Hours format: ${hoursMatch[1]}h = ${minutes} minutes`,
      );
      return minutes;
    }

    // Format număr simplu: "8", "12", "8.5" (număr de ore)
    const numMatch = s.match(/^(\d+(?:\.\d+)?)$/);
    if (numMatch) {
      const minutes = Math.round(parseFloat(numMatch[1]) * 60);
      this.logger.debug(
        `✅ parseScheduleToMinutes - Simple number format: ${numMatch[1]} = ${minutes} minutes`,
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
      if (Math.abs(delta_minutes) <= this.CONFIRMATION_THRESHOLD_MINUTES) {
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
      // Folosim string-uri direct pentru a evita problemele de timezone
      const [startYear, startMonth, startDay] = start_date
        .split('-')
        .map(Number);
      const [endYear, endMonth, endDay] = end_date.split('-').map(Number);
      const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
      const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
      const current = new Date(start);

      while (current <= end) {
        // Extrage data folosind UTC pentru a evita timezone issues
        const year = current.getUTCFullYear();
        const month = String(current.getUTCMonth() + 1).padStart(2, '0');
        const day = String(current.getUTCDate()).padStart(2, '0');
        const fechaStr = `${year}-${month}-${day}`;

        // Calculează scheduled_minutes pentru această zi - pasează string-ul direct
        const scheduled_minutes = await this.calculateScheduledMinutes(
          employee_codigo,
          fechaStr,
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
      // Pasează string-ul direct pentru a evita problemele de timezone
      const scheduled_minutes = await this.calculateScheduledMinutes(
        employee_codigo,
        workday_date,
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

  /**
   * Formatează HTML-ul pentru email-ul de aprobare/respingere regularizare
   */
  private formatRegularizacionEmailHtml(data: {
    empleadoNombre: string;
    fecha: string;
    punchedMinutes: number;
    scheduledMinutes: number;
    effectiveMinutes: number;
    reasonCode: string | null;
    status: 'approved' | 'rejected';
    reviewedBy: string;
    notes?: string | null;
  }): { subject: string; html: string } {
    const formatMinutes = (mins: number) => {
      const h = Math.floor(Math.abs(mins) / 60);
      const m = Math.round(Math.abs(mins) % 60);
      return `${h}h ${String(m).padStart(2, '0')}m`;
    };

    const deltaMinutes = data.punchedMinutes - data.scheduledMinutes;
    const deltaFormatted = formatMinutes(Math.abs(deltaMinutes));
    const isPositive = deltaMinutes > 0;

    const statusText = data.status === 'approved' ? 'Aprobada' : 'Rechazada';
    const statusColor = data.status === 'approved' ? '#10B981' : '#EF4444';
    const statusIcon = data.status === 'approved' ? '✅' : '❌';

    const reasonText = data.reasonCode
      ? {
          employee_confirmed_no_extra: 'Empleado confirmó: No trabajó de más',
          employee_confirmed_punch_error: 'Empleado confirmó: Error de fichaje',
          employee_confirmed_worked_less: 'Empleado confirmó: Trabajó de menos',
          employee_declares_extra: 'Empleado declara: Trabajó de más',
          employee_declares_less: 'Empleado declara: Trabajó de menos',
          AUSENCIA_INJUSTIFICADA: 'Ausencia injustificada',
          OLVIDO_FICHAR: 'Olvidó fichar',
          OTRO: 'Otro motivo',
        }[data.reasonCode] || data.reasonCode
      : 'Sin motivo especificado';

    const subject = `Regularización de jornada ${statusText.toLowerCase()} - ${data.fecha}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: ${statusColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="margin: 0; font-size: 24px;">${statusIcon} Regularización ${statusText}</h2>
        </div>
        
        <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
            <p style="margin: 5px 0;"><strong>Empleado:</strong> ${data.empleadoNombre}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> ${data.fecha}</p>
            <p style="margin: 5px 0;"><strong>Estado:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></p>
          </div>

          <div style="background-color: white; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
            <h3 style="margin-top: 0; color: #374151;">Detalles de la jornada:</h3>
            <p style="margin: 5px 0;"><strong>Horas registradas:</strong> ${formatMinutes(data.punchedMinutes)}</p>
            <p style="margin: 5px 0;"><strong>Horas previstas:</strong> ${formatMinutes(data.scheduledMinutes)}</p>
            <p style="margin: 5px 0;"><strong>Diferencia:</strong> <span style="color: ${isPositive ? '#F59E0B' : '#EF4444'}; font-weight: bold;">${isPositive ? '+' : '-'}${deltaFormatted}</span></p>
            ${data.status === 'approved' ? `<p style="margin: 5px 0;"><strong>Horas efectivas aprobadas:</strong> <span style="color: ${statusColor}; font-weight: bold;">${formatMinutes(data.effectiveMinutes)}</span></p>` : ''}
          </div>

          <div style="background-color: white; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
            <p style="margin: 5px 0;"><strong>Motivo:</strong> ${reasonText}</p>
            ${data.notes ? `<p style="margin: 5px 0;"><strong>Notas:</strong> ${data.notes}</p>` : ''}
          </div>

          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; border-left: 4px solid ${statusColor};">
            <p style="margin: 0; color: #6B7280; font-size: 12px;">
              ${
                data.status === 'approved'
                  ? `Tu regularización ha sido aprobada. Las horas efectivas (${formatMinutes(data.effectiveMinutes)}) se aplicarán en el cálculo de tus horas trabajadas.`
                  : `Tu regularización ha sido rechazada. Las horas efectivas se mantienen en 0. Si tienes dudas, contacta con tu supervisor.`
              }
            </p>
          </div>

          <p style="color: #6B7280; font-size: 12px; margin-top: 20px; text-align: center;">
            Revisado por: ${data.reviewedBy}<br>
            Fecha: ${new Date().toLocaleString('es-ES')}
          </p>
        </div>
      </div>
    `.trim();

    return { subject, html };
  }

  /**
   * Trimite email către angajat când regularizarea este aprobată/respinsă
   */
  private async sendRegularizacionEmailToEmployee(
    employee_codigo: string,
    workday_date: Date,
    punched_minutes: number,
    scheduled_minutes: number,
    effective_minutes: number,
    reason_code: string | null,
    status: 'approved' | 'rejected',
    reviewed_by: string,
    notes?: string | null,
  ): Promise<void> {
    if (!this.emailService.isConfigured()) {
      this.logger.warn(
        `⚠️ Email service not configured. Email notification not sent to employee ${employee_codigo} for ${status} regularizacion`,
      );
      return;
    }

    // Obține datele angajatului
    let empleadoEmail: string | null = null;
    let empleadoNombre: string = employee_codigo;

    try {
      const empleado =
        await this.empleadosService.getEmpleadoByCodigo(employee_codigo);
      empleadoEmail =
        empleado?.['CORREO ELECTRONICO'] ||
        empleado?.CORREO_ELECTRONICO ||
        null;
      empleadoNombre =
        empleado?.['NOMBRE / APELLIDOS'] ||
        empleado?.NOMBRE_APELLIDOS ||
        employee_codigo;
    } catch (error: any) {
      this.logger.warn(
        `⚠️ Could not fetch empleado data for ${employee_codigo}: ${error.message}`,
      );
    }

    if (!empleadoEmail || empleadoEmail.trim() === '') {
      this.logger.warn(
        `⚠️ No email found for empleado ${employee_codigo}, skipping email notification`,
      );
      return;
    }

    try {
      const fechaStr = workday_date.toISOString().split('T')[0];
      const { subject, html } = this.formatRegularizacionEmailHtml({
        empleadoNombre,
        fecha: fechaStr,
        punchedMinutes: punched_minutes,
        scheduledMinutes: scheduled_minutes,
        effectiveMinutes: effective_minutes,
        reasonCode: reason_code,
        status,
        reviewedBy: reviewed_by,
        notes,
      });

      await this.emailService.sendEmail(empleadoEmail, subject, html);
      this.logger.log(
        `✅ Email notification sent to ${empleadoEmail} for ${status} regularizacion (employee: ${employee_codigo}, fecha: ${fechaStr})`,
      );

      // Salvează email-ul în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: reviewed_by || 'system',
          recipientType: 'empleado',
          recipientId: employee_codigo,
          recipientEmail: empleadoEmail,
          recipientName: empleadoNombre,
          subject,
          message: html,
          status: 'sent',
        });
      } catch (saveError: any) {
        this.logger.warn(`⚠️ Error saving email to DB: ${saveError.message}`);
      }
    } catch (emailError: any) {
      this.logger.warn(
        `⚠️ Error sending email to ${empleadoEmail}: ${emailError.message}`,
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
