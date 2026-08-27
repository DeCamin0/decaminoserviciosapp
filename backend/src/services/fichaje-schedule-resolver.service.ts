import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type PunchTipo = 'Entrada' | 'Salida';

export type ScheduleInterval = {
  horaIn: string; // HH:MM
  horaOut: string; // HH:MM
};

export type ScheduleSource = 'cuadrante' | 'multicentro' | 'horarios' | 'none';

export type TodaySchedule = {
  codigo: string;
  nombre: string;
  email: string;
  centro: string | null;
  grupo: string | null;
  trabajaFestivos: string | null;
  source: ScheduleSource;
  slotRaw: string | null;
  intervals: ScheduleInterval[];
  /** Off / libre / marker fără ore punchabile */
  isOff: boolean;
  entryMarginMinutes: number;
  exitMarginMinutes: number;
};

export type MadridNow = {
  dateStr: string; // YYYY-MM-DD
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number;
  minute: number;
  second: number;
  minutesOfDay: number;
  lunaYyyyMm: string; // YYYY-MM
  weekdayJs: number; // 0=Sun..6=Sat (JS)
};

const OFF_MARKERS = new Set([
  'LIB',
  'LIBRE',
  'L',
  'DESCANSO',
  'FESTIVO',
  'VAC',
  'VACACIONES',
  'BAJA',
  'X',
  '0',
  '0H',
]);

const TIME_RANGE_RE = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;

@Injectable()
export class FichajeScheduleResolverService {
  private readonly logger = new Logger(FichajeScheduleResolverService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Current wall-clock in Europe/Madrid. */
  getMadridNow(ref: Date = new Date()): MadridNow {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'short',
    }).formatToParts(ref);

    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? '';

    const year = Number(get('year'));
    const month = Number(get('month'));
    const day = Number(get('day'));
    let hour = Number(get('hour'));
    if (hour === 24) hour = 0;
    const minute = Number(get('minute'));
    const second = Number(get('second'));

    // weekday from Madrid calendar date
    const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const weekdayJs = utcNoon.getUTCDay();

    return {
      dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      year,
      month,
      day,
      hour,
      minute,
      second,
      minutesOfDay: hour * 60 + minute,
      lunaYyyyMm: `${year}-${String(month).padStart(2, '0')}`,
      weekdayJs,
    };
  }

  /**
   * Parse a ZI_* / slot string into punchable intervals.
   * Supports: "T1 09:00-17:00", "08:00-17:00", "09:00-15:00 / 16:00-20:00".
   * Hours-only ("8h", "24h (3×8h)") → no intervals (cannot remind by clock).
   */
  parseSlotRaw(slotRaw: string | null | undefined): {
    isOff: boolean;
    intervals: ScheduleInterval[];
  } {
    if (slotRaw == null || String(slotRaw).trim() === '') {
      return { isOff: true, intervals: [] };
    }

    const trimmed = String(slotRaw).trim();
    const upper = trimmed.toUpperCase();

    if (OFF_MARKERS.has(upper)) {
      return { isOff: true, intervals: [] };
    }

    // Hours-only encodings have no clock times
    if (/^\d+h(\s*\(\d+[×x]\d+h\))?$/i.test(trimmed)) {
      return { isOff: false, intervals: [] };
    }

    const intervals: ScheduleInterval[] = [];
    let match: RegExpExecArray | null;
    const re = new RegExp(TIME_RANGE_RE.source, 'g');
    while ((match = re.exec(trimmed)) !== null) {
      intervals.push({
        horaIn: this.padHm(match[1], match[2]),
        horaOut: this.padHm(match[3], match[4]),
      });
    }

    if (intervals.length === 0) {
      return { isOff: true, intervals: [] };
    }

    return { isOff: false, intervals };
  }

  /**
   * Expected punch type for an interval at `nowMinutes` (minutes from midnight).
   * Same-day shift: before out → Entrada, else Salida.
   * Overnight (out <= in): until out → Salida, else Entrada.
   */
  expectedTipoForInterval(
    interval: ScheduleInterval,
    nowMinutes: number,
  ): PunchTipo {
    const inM = this.hmToMinutes(interval.horaIn);
    const outM = this.hmToMinutes(interval.horaOut);

    if (outM > inM) {
      return nowMinutes < outM ? 'Entrada' : 'Salida';
    }
    // overnight
    return nowMinutes <= outM ? 'Salida' : 'Entrada';
  }

  /**
   * Target clock for reminder window: Entrada → horaIn, Salida → horaOut.
   */
  targetMinutesForTipo(interval: ScheduleInterval, tipo: PunchTipo): number {
    return this.hmToMinutes(
      tipo === 'Entrada' ? interval.horaIn : interval.horaOut,
    );
  }

  isWithinWindow(
    nowMinutes: number,
    targetMinutes: number,
    marginMinutes: number,
  ): boolean {
    const diff = Math.abs(nowMinutes - targetMinutes);
    // also handle midnight wrap (e.g. 23:55 vs 00:05)
    const wrap = Math.min(diff, 1440 - diff);
    return wrap <= marginMinutes;
  }

  /**
   * Reminder due from (target − margin) onward (includes late punches).
   * Too early = before target − margin → false.
   * Same-day only; for overnight intervals use {@link isReminderDueForInterval}.
   */
  isReminderDue(
    nowMinutes: number,
    targetMinutes: number,
    marginMinutes: number,
  ): boolean {
    const openAt = targetMinutes - marginMinutes;
    if (openAt >= 0) {
      return nowMinutes >= openAt;
    }
    // openAt wraps before midnight (e.g. target 00:10, margin 15 → 23:55)
    const wrappedOpen = openAt + 1440;
    return (
      nowMinutes >= wrappedOpen || nowMinutes <= targetMinutes + marginMinutes
    );
  }

  /**
   * Reminder window that respects overnight shifts (e.g. 19:30–07:30).
   * Entrada and Salida NEVER open early — only from horaIn / horaOut onward.
   * Overnight Salida: only from horaOut in the morning until before the next Entrada (horaIn).
   * Overnight Entrada: only from horaIn in the evening (not during morning Salida window).
   */
  isReminderDueForInterval(
    nowMinutes: number,
    interval: ScheduleInterval,
    tipo: PunchTipo,
    _marginMinutes: number, // kept for callers; early-open is disabled (open at target only)
  ): boolean {
    const inM = this.hmToMinutes(interval.horaIn);
    const outM = this.hmToMinutes(interval.horaOut);
    const overnight = outM <= inM;
    const target = tipo === 'Entrada' ? inM : outM;

    if (!overnight) {
      return this.isReminderDue(nowMinutes, target, 0);
    }

    const openAt = target;

    if (tipo === 'Entrada') {
      // Morning is still the previous night's Salida window
      if (nowMinutes <= outM) return false;
      return nowMinutes >= openAt;
    }

    // Overnight Salida (morning): never in the evening after horaIn
    if (nowMinutes >= inM) return false;
    return nowMinutes >= openAt;
  }

  /**
   * Resolve today's schedule for many employees (batch).
   * Priority: cuadrante → horario_multicentro → horarios (centro+grupo).
   */
  async resolveForEmployees(
    employees: Array<{
      codigo: string;
      nombre: string;
      email: string;
      centro: string | null;
      grupo: string | null;
      trabajaFestivos: string | null;
    }>,
    now: MadridNow = this.getMadridNow(),
  ): Promise<TodaySchedule[]> {
    if (employees.length === 0) return [];

    const codes = employees.map((e) => e.codigo);
    const ziCol = `ZI_${now.day}`;
    const luna = now.lunaYyyyMm;

    const [cuadrantes, multicentros, horarios] = await Promise.all([
      this.loadCuadrantesToday(codes, luna, ziCol),
      this.loadMulticentroToday(codes, luna, ziCol),
      this.loadHorariosVigentes(now.dateStr),
    ]);

    const cuMap = new Map(cuadrantes.map((r) => [r.codigo, r]));
    const mcMap = new Map<string, typeof multicentros>();
    for (const row of multicentros) {
      const list = mcMap.get(row.codigo) ?? [];
      list.push(row);
      mcMap.set(row.codigo, list);
    }

    const weekdayPrefix = this.weekdayPrefix(now.weekdayJs);

    return employees.map((emp) => {
      const base: TodaySchedule = {
        codigo: emp.codigo,
        nombre: emp.nombre,
        email: emp.email,
        centro: emp.centro,
        grupo: emp.grupo,
        trabajaFestivos: emp.trabajaFestivos,
        source: 'none',
        slotRaw: null,
        intervals: [],
        isOff: true,
        entryMarginMinutes: 15,
        exitMarginMinutes: 15,
      };

      // 1) cuadrante
      const cu = cuMap.get(emp.codigo);
      if (cu && cu.slot != null && String(cu.slot).trim() !== '') {
        const parsed = this.parseSlotRaw(cu.slot);
        return {
          ...base,
          source: 'cuadrante' as const,
          slotRaw: String(cu.slot).trim(),
          intervals: parsed.intervals,
          isOff: parsed.isOff || parsed.intervals.length === 0,
          centro: cu.centro || emp.centro,
        };
      }

      // 2) multicentro — merge all non-off slots for today
      const mcRows = mcMap.get(emp.codigo) ?? [];
      const mcIntervals: ScheduleInterval[] = [];
      const mcRaws: string[] = [];
      for (const row of mcRows) {
        if (row.slot == null || String(row.slot).trim() === '') continue;
        const parsed = this.parseSlotRaw(row.slot);
        if (parsed.isOff) continue;
        if (parsed.intervals.length === 0) continue;
        mcRaws.push(String(row.slot).trim());
        mcIntervals.push(...parsed.intervals);
      }
      if (mcIntervals.length > 0) {
        return {
          ...base,
          source: 'multicentro' as const,
          slotRaw: mcRaws.join(' | '),
          intervals: mcIntervals,
          isOff: false,
        };
      }

      // 3) weekly horarios by centro + grupo
      if (emp.centro && emp.grupo) {
        const key = `${emp.centro.trim()}||${emp.grupo.trim()}`.toLowerCase();
        const h = horarios.find(
          (x) => `${x.centro_nombre}||${x.grupo_nombre}`.toLowerCase() === key,
        );
        if (h) {
          const inKey = `${weekdayPrefix}_in1` as keyof typeof h;
          const outKey = `${weekdayPrefix}_out1` as keyof typeof h;
          const in2Key = `${weekdayPrefix}_in2` as keyof typeof h;
          const out2Key = `${weekdayPrefix}_out2` as keyof typeof h;
          const in3Key = `${weekdayPrefix}_in3` as keyof typeof h;
          const out3Key = `${weekdayPrefix}_out3` as keyof typeof h;

          const intervals: ScheduleInterval[] = [];
          const pushPair = (a: unknown, b: unknown) => {
            const ha = this.normalizeSqlTime(a);
            const hb = this.normalizeSqlTime(b);
            if (ha && hb) intervals.push({ horaIn: ha, horaOut: hb });
          };
          pushPair(h[inKey], h[outKey]);
          pushPair(h[in2Key], h[out2Key]);
          pushPair(h[in3Key], h[out3Key]);

          const entryMargin =
            h.entry_margin_minutes != null
              ? Number(h.entry_margin_minutes)
              : 15;
          const exitMargin =
            h.exit_margin_minutes != null ? Number(h.exit_margin_minutes) : 15;

          if (intervals.length > 0) {
            return {
              ...base,
              source: 'horarios' as const,
              slotRaw: intervals
                .map((i) => `${i.horaIn}-${i.horaOut}`)
                .join(' / '),
              intervals,
              isOff: false,
              entryMarginMinutes: Number.isFinite(entryMargin)
                ? entryMargin
                : 15,
              exitMarginMinutes: Number.isFinite(exitMargin) ? exitMargin : 15,
            };
          }

          return {
            ...base,
            source: 'horarios' as const,
            slotRaw: null,
            intervals: [],
            isOff: true,
            entryMarginMinutes: Number.isFinite(entryMargin) ? entryMargin : 15,
            exitMarginMinutes: Number.isFinite(exitMargin) ? exitMargin : 15,
          };
        }
      }

      return base;
    });
  }

  private weekdayPrefix(weekdayJs: number): string {
    // JS: 0=Sun … 6=Sat → dum, lun, mar, mie, joi, vin, sam
    const map = ['dum', 'lun', 'mar', 'mie', 'joi', 'vin', 'sam'];
    return map[weekdayJs] ?? 'lun';
  }

  private padHm(h: string, m: string): string {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  hmToMinutes(hm: string): number {
    const [h, m] = hm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  private normalizeSqlTime(value: unknown): string | null {
    if (value == null) return null;
    const s = String(value).trim();
    if (!s || s.toLowerCase() === 'null') return null;
    // TIME / Date / "HH:MM:SS" / "HH:MM"
    const match = s.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return this.padHm(match[1], match[2]);
  }

  private escapeSql(value: string): string {
    return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }

  private codesInList(codes: string[]): string {
    return codes.map((c) => this.escapeSql(c)).join(',');
  }

  private async loadCuadrantesToday(
    codes: string[],
    lunaYyyyMm: string,
    ziCol: string,
  ): Promise<
    Array<{ codigo: string; slot: string | null; centro: string | null }>
  > {
    if (!/^\d{4}-\d{2}$/.test(lunaYyyyMm) || !/^ZI_\d{1,2}$/.test(ziCol)) {
      return [];
    }
    const monthNum = String(Number(lunaYyyyMm.slice(5, 7)));
    const monthPad = lunaYyyyMm.slice(5, 7);
    const year = lunaYyyyMm.slice(0, 4);

    const sql = `
      SELECT
        TRIM(CODIGO) AS codigo,
        \`${ziCol}\` AS slot,
        CENTRO AS centro
      FROM cuadrante
      WHERE TRIM(CODIGO) IN (${this.codesInList(codes)})
        AND (visible IS NULL OR visible = 1)
        AND (
          CONVERT(CAST(LUNA AS CHAR) USING utf8mb4) = ${this.escapeSql(lunaYyyyMm)}
          OR CONVERT(CAST(LUNA AS CHAR) USING utf8mb4) = ${this.escapeSql(monthPad)}
          OR CONVERT(CAST(LUNA AS CHAR) USING utf8mb4) = ${this.escapeSql(monthNum)}
          OR CONVERT(CAST(LUNA AS CHAR) USING utf8mb4) = ${this.escapeSql(`${monthPad}/${year}`)}
        )
    `;

    try {
      const rows =
        await this.prisma.$queryRawUnsafe<
          Array<{ codigo: string; slot: string | null; centro: string | null }>
        >(sql);
      return rows ?? [];
    } catch (err: any) {
      this.logger.error(`loadCuadrantesToday failed: ${err.message}`);
      return [];
    }
  }

  private async loadMulticentroToday(
    codes: string[],
    lunaYyyyMm: string,
    ziCol: string,
  ): Promise<
    Array<{ codigo: string; slot: string | null; cliente: string | null }>
  > {
    if (!/^\d{4}-\d{2}$/.test(lunaYyyyMm) || !/^ZI_\d{1,2}$/.test(ziCol)) {
      return [];
    }
    const monthNum = String(Number(lunaYyyyMm.slice(5, 7)));
    const monthPad = lunaYyyyMm.slice(5, 7);
    const year = lunaYyyyMm.slice(0, 4);

    const sql = `
      SELECT
        TRIM(CODIGO) AS codigo,
        \`${ziCol}\` AS slot,
        CLIENTE AS cliente
      FROM horario_multicentro
      WHERE TRIM(CODIGO) IN (${this.codesInList(codes)})
        AND (
          CONVERT(CAST(LUNA AS CHAR) USING utf8mb4) = ${this.escapeSql(lunaYyyyMm)}
          OR CONVERT(CAST(LUNA AS CHAR) USING utf8mb4) = ${this.escapeSql(monthPad)}
          OR CONVERT(CAST(LUNA AS CHAR) USING utf8mb4) = ${this.escapeSql(monthNum)}
          OR CONVERT(CAST(LUNA AS CHAR) USING utf8mb4) = ${this.escapeSql(`${monthPad}/${year}`)}
        )
    `;

    try {
      const rows =
        await this.prisma.$queryRawUnsafe<
          Array<{ codigo: string; slot: string | null; cliente: string | null }>
        >(sql);
      return rows ?? [];
    } catch (err: any) {
      this.logger.error(`loadMulticentroToday failed: ${err.message}`);
      return [];
    }
  }

  private async loadHorariosVigentes(dateStr: string): Promise<
    Array<{
      centro_nombre: string;
      grupo_nombre: string;
      entry_margin_minutes: number | null;
      exit_margin_minutes: number | null;
      [key: string]: unknown;
    }>
  > {
    const sql = `
      SELECT *
      FROM horarios
      WHERE (vigente_desde IS NULL OR vigente_desde <= ${this.escapeSql(dateStr)})
        AND (vigente_hasta IS NULL OR vigente_hasta >= ${this.escapeSql(dateStr)})
    `;
    try {
      return (await this.prisma.$queryRawUnsafe(sql)) ?? [];
    } catch (err: any) {
      this.logger.error(`loadHorariosVigentes failed: ${err.message}`);
      return [];
    }
  }
}
