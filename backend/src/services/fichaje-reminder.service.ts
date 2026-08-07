import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import {
  NotificationKind,
  getNotificationKindMeta,
} from '../notifications/notification-kinds';
import {
  FichajeScheduleResolverService,
  MadridNow,
  PunchTipo,
  TodaySchedule,
} from './fichaje-schedule-resolver.service';

export type ReminderProcessOptions = {
  /** If true (or env FICHAJE_REMINDER_DRY_RUN), log only — no push / no dedup insert */
  dryRun?: boolean;
  /** Override window minutes (else env / schedule margins) */
  windowMinutes?: number;
};

export type ReminderSkipReason =
  | 'sin_horario'
  | 'ausencia'
  | 'baja_medica'
  | 'fiesta'
  | 'fuera_ventana'
  | 'ya_fichado'
  | 'ya_notificado'
  | 'turno_completo'
  | 'extrabajador';

export type ReminderSkippedRow = {
  codigo: string;
  nombre: string;
  reason: ReminderSkipReason;
  /** Texto legible: Baja médica, Vacaciones, Ausencia: … */
  reasonLabel: string;
  detail?: string | null;
};

export type ReminderProcessResult = {
  scanned: number;
  skippedOff: number;
  skippedAusencia: number;
  skippedBaja: number;
  skippedFiesta: number;
  skippedExtrabajador: number;
  skippedOutsideWindow: number;
  skippedAlreadyPunched: number;
  skippedDedup: number;
  sent: number;
  errors: number;
  dryRun: boolean;
  candidates: Array<{
    codigo: string;
    nombre: string;
    email: string | null;
    tipo: PunchTipo;
    estado: string;
    mensaje: string;
    horario: string;
    wouldSend: boolean;
    /** Reaviso (ya se notificó antes hoy, problema no resuelta) */
    isRetry?: boolean;
  }>;
  /** Personas que no reciben aviso (con motivo). No incluye “fuera de ventana” masivo. */
  skipped: ReminderSkippedRow[];
};

type EmployeeRow = {
  codigo: string;
  nombre: string;
  email: string | null;
  centro: string | null;
  grupo: string | null;
  trabajaFestivos: string | null;
};

type FichajeRow = {
  codigo: string;
  tipo: string | null;
  hora: string | null;
  id: number;
};

@Injectable()
export class FichajeReminderService {
  private readonly logger = new Logger(FichajeReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly resolver: FichajeScheduleResolverService,
  ) {}

  async processReminders(
    options: ReminderProcessOptions = {},
  ): Promise<ReminderProcessResult> {
    const dryRun =
      options.dryRun === true ||
      this.isTruthy(this.config.get<string>('FICHAJE_REMINDER_DRY_RUN'));

    const defaultWindow = Number(
      options.windowMinutes ??
        this.config.get<string>('FICHAJE_REMINDER_WINDOW_MINUTES') ??
        15,
    );

    const retryMinutes = Number(
      this.config.get<string>('FICHAJE_REMINDER_RETRY_MINUTES') ?? 30,
    );

    const result: ReminderProcessResult = {
      scanned: 0,
      skippedOff: 0,
      skippedAusencia: 0,
      skippedBaja: 0,
      skippedFiesta: 0,
      skippedExtrabajador: 0,
      skippedOutsideWindow: 0,
      skippedAlreadyPunched: 0,
      skippedDedup: 0,
      sent: 0,
      errors: 0,
      dryRun,
      candidates: [],
      skipped: [],
    };

    const now = this.resolver.getMadridNow();
    const [employees, extrabajadores] = await Promise.all([
      this.loadActiveEmployees(),
      this.loadActiveExtrabajadores(),
    ]);
    result.scanned = employees.length;

    for (const ex of extrabajadores) {
      result.skippedExtrabajador += 1;
      result.skipped.push({
        codigo: ex.codigo,
        nombre: ex.nombre,
        reason: 'extrabajador',
        reasonLabel: 'Extrabajador',
        detail: ex.grupo,
      });
    }

    if (employees.length === 0) {
      this.logger.log(
        `Fichaje reminder: no active employees (extrabajadores excluidos=${extrabajadores.length})`,
      );
      return result;
    }

    const schedules = await this.resolver.resolveForEmployees(employees, now);
    const codes = employees.map((e) => e.codigo);

    const [fiesta, bajaMap, ausenciaMap, fichajesByCode, lastSentMap] =
      await Promise.all([
        this.loadTodayFiesta(now.dateStr),
        this.loadEnBajaToday(codes, now.dateStr),
        this.loadEnAusenciaNow(codes, now),
        this.loadFichajesToday(codes, now.dateStr),
        this.loadLastSentToday(codes, now.dateStr),
      ]);

    for (const schedule of schedules) {
      try {
        await this.processOne({
          schedule,
          now,
          fiesta,
          bajaInfo: bajaMap.get(schedule.codigo) ?? null,
          ausenciaInfo: ausenciaMap.get(schedule.codigo) ?? null,
          fichajes: fichajesByCode.get(schedule.codigo) ?? [],
          lastSent: lastSentMap.get(schedule.codigo) ?? {},
          defaultWindow,
          retryMinutes: Number.isFinite(retryMinutes) ? Math.max(1, retryMinutes) : 30,
          dryRun,
          result,
        });
      } catch (err: any) {
        result.errors += 1;
        this.logger.error(
          `Fichaje reminder error for ${schedule.codigo}: ${err?.message || err}`,
        );
      }
    }

    this.logger.log(
      `Fichaje reminder done dryRun=${dryRun} scanned=${result.scanned} sent=${result.sent} ` +
        `off=${result.skippedOff} baja=${result.skippedBaja} aus=${result.skippedAusencia} ` +
        `fiesta=${result.skippedFiesta} extrabajador=${result.skippedExtrabajador} ` +
        `window=${result.skippedOutsideWindow} punched=${result.skippedAlreadyPunched} ` +
        `dedup=${result.skippedDedup} errors=${result.errors}`,
    );

    return result;
  }

  private async processOne(ctx: {
    schedule: TodaySchedule;
    now: MadridNow;
    fiesta: { isFiesta: boolean; name: string | null };
    bajaInfo: { situacion: string | null } | null;
    ausenciaInfo: { tipo: string | null } | null;
    fichajes: FichajeRow[];
    /** Minutes since last aviso today (from MySQL TIMESTAMPDIFF) — avoids TZ skew vs Date.now() */
    lastSent: { entradaElapsedMin?: number; salidaElapsedMin?: number };
    defaultWindow: number;
    retryMinutes: number;
    dryRun: boolean;
    result: ReminderProcessResult;
  }): Promise<void> {
    const { schedule, now, result } = ctx;

    const pushSkip = (
      reason: ReminderSkipReason,
      reasonLabel: string,
      detail?: string | null,
    ) => {
      result.skipped.push({
        codigo: schedule.codigo,
        nombre: schedule.nombre,
        reason,
        reasonLabel,
        detail: detail ?? null,
      });
    };

    if (schedule.isOff || schedule.intervals.length === 0) {
      result.skippedOff += 1;
      // No listamos todos los LIBRE (ruido); solo contador
      return;
    }

    if (ctx.ausenciaInfo) {
      result.skippedAusencia += 1;
      const tipo = String(ctx.ausenciaInfo.tipo || 'Ausencia').trim();
      const isVac =
        /vacaci[oó]n/i.test(tipo) || /^vac$/i.test(tipo) || /holiday/i.test(tipo);
      pushSkip(
        'ausencia',
        isVac ? 'Vacaciones' : `Ausencia: ${tipo}`,
        tipo,
      );
      return;
    }

    if (ctx.bajaInfo) {
      result.skippedBaja += 1;
      pushSkip(
        'baja_medica',
        'Baja médica',
        ctx.bajaInfo.situacion || null,
      );
      return;
    }

    const trabajaFestivos = String(schedule.trabajaFestivos || '')
      .trim()
      .toUpperCase();
    if (
      ctx.fiesta.isFiesta &&
      (trabajaFestivos === 'NO' || trabajaFestivos === 'N')
    ) {
      result.skippedFiesta += 1;
      pushSkip(
        'fiesta',
        ctx.fiesta.name
          ? `Festivo: ${ctx.fiesta.name}`
          : 'Festivo (no trabaja festivos)',
        ctx.fiesta.name,
      );
      return;
    }

    const entryMargin =
      schedule.entryMarginMinutes > 0
        ? schedule.entryMarginMinutes
        : ctx.defaultWindow;
    const exitMargin =
      schedule.exitMarginMinutes > 0
        ? schedule.exitMarginMinutes
        : ctx.defaultWindow;

    // Needed punch from REAL fichajes (not clock alone).
    // Avoids: already closed Entrada+Salida → wrongly ask Entrada again before hora_out.
    const needed = this.resolveNeededPunch(
      ctx.fichajes,
      schedule.intervals,
      now.minutesOfDay,
    );

    if (needed.status === 'turno_completo') {
      result.skippedAlreadyPunched += 1;
      pushSkip(
        'turno_completo',
        'Turno completado (Entrada + Salida)',
        needed.detail,
      );
      return;
    }

    const tipo = needed.tipo!;
    const interval = needed.interval!;
    const margin = tipo === 'Entrada' ? entryMargin : exitMargin;

    if (
      !this.resolver.isReminderDueForInterval(
        now.minutesOfDay,
        interval,
        tipo,
        margin,
      )
    ) {
      result.skippedOutsideWindow += 1;
      return;
    }

    const tipKey = tipo === 'Entrada' ? 'entrada' : 'salida';
    const horario = `${interval.horaIn}-${interval.horaOut}`;
    const punchStatus = this.evaluatePunch(ctx.fichajes, tipo);

    if (punchStatus.estado === 'ya_fichado_correcto') {
      result.skippedAlreadyPunched += 1;
      pushSkip(
        'ya_fichado',
        `Ya fichó ${tipo}`,
        punchStatus.fichajeHora
          ? `${punchStatus.fichajeTipo || tipo} ${punchStatus.fichajeHora}`
          : null,
      );
      return;
    }

    // If punches say complete but evaluate disagreed, still block wrong avisos
    if (
      punchStatus.estado === 'fichado_otro_tipo' &&
      this.hasClosedTurno(ctx.fichajes)
    ) {
      result.skippedAlreadyPunched += 1;
      pushSkip(
        'turno_completo',
        'Turno completado (Entrada + Salida)',
        punchStatus.fichajeTipo
          ? `${punchStatus.fichajeTipo} ${punchStatus.fichajeHora || ''}`.trim()
          : null,
      );
      return;
    }

    const lastElapsed =
      tipKey === 'entrada'
        ? ctx.lastSent.entradaElapsedMin
        : ctx.lastSent.salidaElapsedMin;
    let isRetry = false;
    if (lastElapsed != null && Number.isFinite(lastElapsed)) {
      if (lastElapsed < ctx.retryMinutes) {
        const wait = Math.ceil(ctx.retryMinutes - lastElapsed);
        result.skippedDedup += 1;
        pushSkip(
          'ya_notificado',
          `Ya avisado — reintento en ~${wait} min`,
          tipo,
        );
        return;
      }
      isRetry = true;
    }

    const baseMensaje =
      punchStatus.estado === 'debe_fichar'
        ? `Debe fichar: ${tipo} (horario ${horario}).`
        : punchStatus.mensaje;
    const mensaje = isRetry
      ? `Recordatorio: aún no ha fichado correctamente. ${baseMensaje}`
      : baseMensaje;

    const candidate = {
      codigo: schedule.codigo,
      nombre: schedule.nombre,
      email: schedule.email ?? null,
      tipo,
      estado: punchStatus.estado,
      mensaje,
      horario,
      wouldSend: true,
      isRetry,
    };
    result.candidates.push(candidate);

    if (ctx.dryRun) {
      this.logger.log(
        `[DRY-RUN] would push remind ${schedule.codigo} ${tipo} (${punchStatus.estado})${isRetry ? ' [retry]' : ''}`,
      );
      result.sent += 1;
      return;
    }

    await this.sendReminderPush({
      codigo: schedule.codigo,
      nombre: schedule.nombre,
      estado: punchStatus.estado,
      tipo,
      horario,
      mensaje,
      centro: schedule.centro,
      grupo: schedule.grupo,
      fichajeHora: punchStatus.fichajeHora,
      fichajeTipo: punchStatus.fichajeTipo,
      isRetry,
    });

    await this.markSent(schedule.codigo, now.dateStr, tipKey);
    if (tipKey === 'entrada') ctx.lastSent.entradaElapsedMin = 0;
    else ctx.lastSent.salidaElapsedMin = 0;
    result.sent += 1;
  }

  /**
   * What punch is still needed based on today's fichajes + intervals.
   * Closed Entrada→Salida pair(s) for all intervals ⇒ turno completo.
   */
  private resolveNeededPunch(
    fichajes: FichajeRow[],
    intervals: Array<{ horaIn: string; horaOut: string }>,
    nowMinutes: number,
  ): {
    status: 'needs' | 'turno_completo';
    tipo?: PunchTipo;
    interval?: { horaIn: string; horaOut: string };
    detail?: string | null;
  } {
    if (!intervals.length) {
      return { status: 'turno_completo', detail: null };
    }

    // Separate equal long shifts (3×8): employee works ONE → treat as single interval near now
    const effective = this.effectiveIntervalsForReminder(intervals, nowMinutes);

    const chrono = [...fichajes].sort((a, b) => {
      const am = this.horaToMinutes(a.hora) ?? 0;
      const bm = this.horaToMinutes(b.hora) ?? 0;
      if (am !== bm) return am - bm;
      return a.id - b.id;
    });

    let open = false;
    let completedPairs = 0;
    let lastEntradaHora: string | null = null;
    let lastSalidaHora: string | null = null;

    for (const f of chrono) {
      const t = String(f.tipo || '').toUpperCase();
      if (t.startsWith('ENTRADA')) {
        open = true;
        lastEntradaHora = this.cleanHora(f.hora);
      } else if (t.startsWith('SALIDA') && open) {
        open = false;
        completedPairs += 1;
        lastSalidaHora = this.cleanHora(f.hora);
      }
    }

    if (open) {
      const idx = Math.min(completedPairs, effective.length - 1);
      return {
        status: 'needs',
        tipo: 'Salida',
        interval: effective[idx],
        detail: lastEntradaHora ? `Entrada ${lastEntradaHora}` : null,
      };
    }

    if (completedPairs >= effective.length) {
      return {
        status: 'turno_completo',
        detail:
          lastEntradaHora || lastSalidaHora
            ? `Entrada ${lastEntradaHora || '—'} · Salida ${lastSalidaHora || '—'}`
            : null,
      };
    }

    // Need next Entrada for interval[completedPairs]
    return {
      status: 'needs',
      tipo: 'Entrada',
      interval: effective[completedPairs],
      detail: null,
    };
  }

  /** If shifts look like mutually exclusive 3×8, keep the interval closest to now. */
  private effectiveIntervalsForReminder(
    intervals: Array<{ horaIn: string; horaOut: string }>,
    nowMinutes: number,
  ): Array<{ horaIn: string; horaOut: string }> {
    if (intervals.length <= 1) return intervals;

    const durations = intervals.map((i) => {
      const a = this.hmToMinutes(i.horaIn);
      let b = this.hmToMinutes(i.horaOut);
      if (b <= a) b += 1440;
      return b - a;
    });
    const first = durations[0];
    const allSame = durations.every((d) => Math.abs(d - first) < 2);
    const total = durations.reduce((s, d) => s + d, 0);
    if (allSame && total > 12 * 60 && intervals.length >= 2) {
      let best = intervals[0];
      let bestDist = Infinity;
      for (const i of intervals) {
        const mid =
          (this.hmToMinutes(i.horaIn) + this.hmToMinutes(i.horaOut)) / 2;
        const dist = this.minuteDistance(nowMinutes, mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
      return [best];
    }
    return intervals;
  }

  /** At least one Entrada closed by a later Salida today. */
  private hasClosedTurno(fichajes: FichajeRow[]): boolean {
    const chrono = [...fichajes].sort((a, b) => {
      const am = this.horaToMinutes(a.hora) ?? 0;
      const bm = this.horaToMinutes(b.hora) ?? 0;
      if (am !== bm) return am - bm;
      return a.id - b.id;
    });
    let open = false;
    for (const f of chrono) {
      const t = String(f.tipo || '').toUpperCase();
      if (t.startsWith('ENTRADA')) open = true;
      else if (t.startsWith('SALIDA') && open) return true;
    }
    return false;
  }

  private hmToMinutes(hm: string): number {
    const [h, m] = String(hm).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  private evaluatePunch(
    fichajes: FichajeRow[],
    expected: PunchTipo,
  ): {
    estado: 'debe_fichar' | 'ya_fichado_correcto' | 'fichado_otro_tipo';
    mensaje: string;
    fichajeHora: string | null;
    fichajeTipo: string | null;
  } {
    // Valid punches: all Entrada; Salida only if an earlier Entrada exists
    const sorted = [...fichajes].sort((a, b) => b.id - a.id);
    const valid = sorted.filter((f) => {
      const t = String(f.tipo || '').toUpperCase();
      if (t.startsWith('ENTRADA')) return true;
      if (t.startsWith('SALIDA')) {
        const fMin = this.horaToMinutes(f.hora);
        return sorted.some((e) => {
          const et = String(e.tipo || '').toUpperCase();
          if (!et.startsWith('ENTRADA')) return false;
          const eMin = this.horaToMinutes(e.hora);
          if (fMin == null || eMin == null) return e.id < f.id;
          return eMin <= fMin;
        });
      }
      return false;
    });

    const last = valid[0];
    if (!last) {
      return {
        estado: 'debe_fichar',
        mensaje: `Debe fichar: ${expected}`,
        fichajeHora: null,
        fichajeTipo: null,
      };
    }

    const lastTipo = String(last.tipo || '');
    const coincides = lastTipo
      .toUpperCase()
      .startsWith(expected.toUpperCase());

    if (coincides) {
      return {
        estado: 'ya_fichado_correcto',
        mensaje: `Ya tiene ${expected} registrada hoy`,
        fichajeHora: this.cleanHora(last.hora),
        fichajeTipo: lastTipo,
      };
    }

    return {
      estado: 'fichado_otro_tipo',
      mensaje: `Tiene fichaje hoy (${lastTipo} a las ${this.cleanHora(last.hora) || ''}), pero se esperaba ${expected}`,
      fichajeHora: this.cleanHora(last.hora),
      fichajeTipo: lastTipo,
    };
  }

  private async sendReminderPush(args: {
    codigo: string;
    nombre: string;
    estado: string;
    tipo: PunchTipo;
    horario: string;
    mensaje: string;
    centro: string | null;
    grupo: string | null;
    fichajeHora: string | null;
    fichajeTipo: string | null;
    isRetry?: boolean;
  }): Promise<void> {
    const meta = getNotificationKindMeta(NotificationKind.FICHAJE_REMINDER);
    const title = args.isRetry
      ? 'Recordatorio de fichaje (reaviso)'
      : args.estado === 'debe_fichar'
        ? 'Recordatorio de fichaje'
        : args.estado === 'fichado_otro_tipo'
          ? 'Aviso de fichaje'
          : 'Recordatorio de fichaje';

    await this.notificationsService.notifyUser('system', args.codigo, {
      type: meta?.defaultSeverity ?? 'warning',
      title,
      message: args.mensaje,
      data: {
        kind: NotificationKind.FICHAJE_REMINDER,
        tipo: args.tipo,
        horario: args.horario,
        estado: args.estado,
        centro: args.centro,
        grupo: args.grupo,
        fichajeHora: args.fichajeHora,
        fichajeTipo: args.fichajeTipo,
        nombre: args.nombre,
        isRetry: Boolean(args.isRetry),
        url: meta?.defaultUrl ?? '/fichaje',
      },
    });
  }

  private async markSent(
    codigo: string,
    dateStr: string,
    tip: 'entrada' | 'salida',
  ): Promise<void> {
    const empleadoId = this.codigoToEmpleadoId(codigo);
    if (empleadoId == null) {
      this.logger.warn(
        `Cannot dedup NotificariFichaje for non-mappable CODIGO=${codigo}`,
      );
      return;
    }

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO NotificariFichaje (empleado_id, data, tip, trimis_at)
       VALUES (${empleadoId}, ${this.escapeSql(dateStr)}, ${this.escapeSql(tip)}, NOW())
       ON DUPLICATE KEY UPDATE trimis_at = NOW()`,
    );
  }

  private async loadLastSentToday(
    codes: string[],
    dateStr: string,
  ): Promise<
    Map<string, { entradaElapsedMin?: number; salidaElapsedMin?: number }>
  > {
    const map = new Map<
      string,
      { entradaElapsedMin?: number; salidaElapsedMin?: number }
    >();
    const ids = codes
      .map((c) => ({ c, id: this.codigoToEmpleadoId(c) }))
      .filter((x): x is { c: string; id: number } => x.id != null);

    if (ids.length === 0) return map;

    const idToCode = new Map(ids.map((x) => [x.id, x.c]));
    const idList = ids.map((x) => x.id).join(',');

    try {
      // TIMESTAMPDIFF vs NOW() — same clock as markSent(NOW()). Avoids JS Date.now()
      // vs MySQL DATETIME session-TZ skew (was ~+2h → effective retry ~2.5h).
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          empleado_id: number;
          tip: string;
          elapsed_min: number | null;
        }>
      >(
        `SELECT empleado_id, tip,
                TIMESTAMPDIFF(MINUTE, trimis_at, NOW()) AS elapsed_min
         FROM NotificariFichaje
         WHERE data = ${this.escapeSql(dateStr)}
           AND empleado_id IN (${idList})
           AND trimis_at IS NOT NULL`,
      );

      for (const row of rows ?? []) {
        const code = idToCode.get(Number(row.empleado_id));
        if (!code) continue;
        const tip = String(row.tip || '').toLowerCase();
        if (tip !== 'entrada' && tip !== 'salida') continue;
        const entry = map.get(code) ?? {};
        const elapsed = Number(row.elapsed_min);
        if (!Number.isFinite(elapsed)) continue;
        if (tip === 'entrada') entry.entradaElapsedMin = elapsed;
        else entry.salidaElapsedMin = elapsed;
        map.set(code, entry);
      }
    } catch (err: any) {
      this.logger.error(`loadLastSentToday failed: ${err.message}`);
    }

    return map;
  }

  private async loadActiveEmployees(): Promise<EmployeeRow[]> {
    const sql = `
      SELECT
        TRIM(\`CODIGO\`) AS codigo,
        TRIM(\`NOMBRE / APELLIDOS\`) AS nombre,
        NULLIF(TRIM(\`CORREO ELECTRONICO\`), '') AS email,
        TRIM(\`CENTRO TRABAJO\`) AS centro,
        TRIM(\`GRUPO\`) AS grupo,
        TRIM(\`TrabajaFestivos\`) AS trabajaFestivos
      FROM \`DatosEmpleados\`
      WHERE COALESCE(TRIM(\`CODIGO\`), '') <> ''
        AND (
          UPPER(TRIM(\`ESTADO\`)) IN ('ACTIVO', 'ACTIVE', 'ALTA')
          OR \`ESTADO\` = 1
          OR \`ESTADO\` = '1'
        )
        AND UPPER(TRIM(COALESCE(\`GRUPO\`, ''))) <> 'EXTRABAJADOR'
    `;
    try {
      const rows = await this.prisma.$queryRawUnsafe<EmployeeRow[]>(sql);
      return (rows ?? []).filter((r) => r.codigo);
    } catch (err: any) {
      this.logger.error(`loadActiveEmployees failed: ${err.message}`);
      return [];
    }
  }

  /** Activos con GRUPO=EXTRABAJADOR (excluidos del reminder; listados en preview). */
  private async loadActiveExtrabajadores(): Promise<EmployeeRow[]> {
    const sql = `
      SELECT
        TRIM(\`CODIGO\`) AS codigo,
        TRIM(\`NOMBRE / APELLIDOS\`) AS nombre,
        NULLIF(TRIM(\`CORREO ELECTRONICO\`), '') AS email,
        TRIM(\`CENTRO TRABAJO\`) AS centro,
        TRIM(\`GRUPO\`) AS grupo,
        TRIM(\`TrabajaFestivos\`) AS trabajaFestivos
      FROM \`DatosEmpleados\`
      WHERE COALESCE(TRIM(\`CODIGO\`), '') <> ''
        AND (
          UPPER(TRIM(\`ESTADO\`)) IN ('ACTIVO', 'ACTIVE', 'ALTA')
          OR \`ESTADO\` = 1
          OR \`ESTADO\` = '1'
        )
        AND UPPER(TRIM(COALESCE(\`GRUPO\`, ''))) = 'EXTRABAJADOR'
    `;
    try {
      const rows = await this.prisma.$queryRawUnsafe<EmployeeRow[]>(sql);
      return (rows ?? []).filter((r) => r.codigo);
    } catch (err: any) {
      this.logger.error(`loadActiveExtrabajadores failed: ${err.message}`);
      return [];
    }
  }

  private async loadTodayFiesta(
    dateStr: string,
  ): Promise<{ isFiesta: boolean; name: string | null }> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ cnt: number; names: string | null }>
      >(
        `SELECT
           COUNT(*) AS cnt,
           GROUP_CONCAT(DISTINCT name SEPARATOR ', ') AS names
         FROM fiestas
         WHERE active = 1
           AND DATE(COALESCE(observed_date, \`date\`)) = ${this.escapeSql(dateStr)}`,
      );
      const cnt = Number(rows?.[0]?.cnt || 0);
      return {
        isFiesta: cnt > 0,
        name: rows?.[0]?.names || null,
      };
    } catch (err: any) {
      this.logger.error(`loadTodayFiesta failed: ${err.message}`);
      return { isFiesta: false, name: null };
    }
  }

  private async loadEnBajaToday(
    codes: string[],
    dateStr: string,
  ): Promise<Map<string, { situacion: string | null }>> {
    const map = new Map<string, { situacion: string | null }>();
    if (codes.length === 0) return map;

    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ codigo: string; situacion: string | null }>
      >(
        `SELECT
           TRIM(m.\`Codigo_Empleado\`) AS codigo,
           MAX(m.\`Situación\`) AS situacion
         FROM \`MutuaCasos\` m
         WHERE TRIM(m.\`Codigo_Empleado\`) IN (${this.codesInList(codes)})
           AND m.\`Fecha baja\` IS NOT NULL
           AND TRIM(CAST(m.\`Fecha baja\` AS CHAR)) <> ''
           AND ${this.escapeSql(dateStr)} >= DATE(COALESCE(
                 STR_TO_DATE(CAST(m.\`Fecha baja\` AS CHAR), '%Y-%m-%d'),
                 m.\`Fecha baja\`
               ))
           AND (
             m.\`Fecha de alta\` IS NULL
             OR TRIM(CAST(m.\`Fecha de alta\` AS CHAR)) = ''
             OR ${this.escapeSql(dateStr)} <= DATE(COALESCE(
                   STR_TO_DATE(CAST(m.\`Fecha de alta\` AS CHAR), '%Y-%m-%d'),
                   m.\`Fecha de alta\`
                 ))
           )
         GROUP BY TRIM(m.\`Codigo_Empleado\`)`,
      );
      for (const r of rows ?? []) {
        if (r.codigo) {
          map.set(r.codigo, { situacion: r.situacion || null });
        }
      }
    } catch (err: any) {
      this.logger.error(`loadEnBajaToday failed: ${err.message}`);
    }
    return map;
  }

  /**
   * Employees currently in an active ausencia (full-day dias, or horas window covering now).
   * Also covers Aprobada solicitudes (Vacaciones etc.) even if Ausencias row is missing.
   */
  private async loadEnAusenciaNow(
    codes: string[],
    now: MadridNow,
  ): Promise<Map<string, { tipo: string | null }>> {
    const map = new Map<string, { tipo: string | null }>();
    if (codes.length === 0) return map;

    const nowTime = `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}:${String(now.second).padStart(2, '0')}`;

    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ codigo: string; tipo: string | null }>
      >(
        `SELECT
           TRIM(a.CODIGO) AS codigo,
           MAX(a.TIPO) AS tipo
         FROM (
           SELECT
             a.*,
             CASE
               WHEN INSTR(a.FECHA, ' - ') > 0
                 THEN STR_TO_DATE(TRIM(SUBSTRING_INDEX(a.FECHA, ' - ', 1)), '%Y-%m-%d')
               ELSE STR_TO_DATE(TRIM(a.FECHA), '%Y-%m-%d')
             END AS f_ini,
             CASE
               WHEN INSTR(a.FECHA, ' - ') > 0
                 THEN STR_TO_DATE(TRIM(SUBSTRING_INDEX(a.FECHA, ' - ', -1)), '%Y-%m-%d')
               ELSE STR_TO_DATE(TRIM(a.FECHA), '%Y-%m-%d')
             END AS f_fin,
             CASE
               WHEN a.HORA IS NULL OR TRIM(a.HORA) = '' THEN NULL
               WHEN INSTR(a.HORA, '.') > 0 THEN TIME(SUBSTRING_INDEX(a.HORA, '.', 1))
               ELSE TIME(a.HORA)
             END AS clean_hora,
             LOWER(TRIM(COALESCE(a.UNIDAD_DURACION, ''))) AS unidad_norm,
             CASE
               WHEN a.DURACION IS NULL OR TRIM(a.DURACION) = '' THEN NULL
               WHEN INSTR(a.DURACION, ':') > 0 THEN TIME_TO_SEC(TIME(a.DURACION))
               ELSE CAST(a.DURACION AS DECIMAL(10,4)) * 3600
             END AS dur_seg
           FROM Ausencias a
           WHERE TRIM(a.CODIGO) IN (${this.codesInList(codes)})
         ) a
         WHERE ${this.escapeSql(now.dateStr)} BETWEEN a.f_ini AND a.f_fin
           AND (
             a.unidad_norm = 'dias'
             OR (COALESCE(a.DURACION, 0) = 0 AND (a.unidad_norm IS NULL OR a.unidad_norm = ''))
             OR a.clean_hora IS NULL
             OR (
               a.unidad_norm = 'horas'
               AND (
                 (a.dur_seg IS NULL AND TIME(${this.escapeSql(nowTime)}) >= a.clean_hora)
                 OR (
                   a.dur_seg IS NOT NULL
                   AND TIME(${this.escapeSql(nowTime)}) BETWEEN a.clean_hora
                     AND TIME(ADDTIME(a.clean_hora, SEC_TO_TIME(a.dur_seg)))
                 )
               )
             )
           )
         GROUP BY TRIM(a.CODIGO)`,
      );
      for (const r of rows ?? []) {
        if (r.codigo) {
          map.set(r.codigo, { tipo: r.tipo || null });
        }
      }
    } catch (err: any) {
      this.logger.error(`loadEnAusenciaNow failed: ${err.message}`);
    }

    // Fallback: approved solicitudes covering today (Vacaciones / AP / permiso)
    // — if Ausencias insert was skipped historically, reminders must still stop.
    try {
      const solRows = await this.prisma.$queryRawUnsafe<
        Array<{ codigo: string; tipo: string | null }>
      >(
        `SELECT TRIM(s.codigo) AS codigo, MAX(s.tipo) AS tipo
         FROM solicitudes s
         WHERE TRIM(s.codigo) IN (${this.codesInList(codes)})
           AND s.estado = 'Aprobada'
           AND s.tipo IN (
             'Vacaciones',
             'Asunto Propio',
             'Asuntos Propios',
             'Permiso Retribuido'
           )
           AND s.fecha_inicio IS NOT NULL
           AND s.fecha_fin IS NOT NULL
           AND ${this.escapeSql(now.dateStr)} BETWEEN DATE(s.fecha_inicio) AND DATE(s.fecha_fin)
         GROUP BY TRIM(s.codigo)`,
      );
      for (const r of solRows ?? []) {
        if (!r.codigo) continue;
        if (!map.has(r.codigo)) {
          map.set(r.codigo, { tipo: r.tipo || null });
        }
      }
    } catch (err: any) {
      this.logger.error(
        `loadEnAusenciaNow (solicitudes fallback) failed: ${err.message}`,
      );
    }

    return map;
  }

  private async loadFichajesToday(
    codes: string[],
    dateStr: string,
  ): Promise<Map<string, FichajeRow[]>> {
    const map = new Map<string, FichajeRow[]>();
    if (codes.length === 0) return map;

    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          codigo: string;
          tipo: string | null;
          hora: string | null;
          id: number;
        }>
      >(
        `SELECT
           TRIM(\`CODIGO\`) AS codigo,
           \`TIPO\` AS tipo,
           CASE
             WHEN \`HORA\` IS NULL OR TRIM(\`HORA\`) = '' THEN NULL
             WHEN INSTR(\`HORA\`, '.') > 0 THEN SUBSTRING_INDEX(\`HORA\`, '.', 1)
             ELSE TIME_FORMAT(\`HORA\`, '%H:%i:%s')
           END AS hora,
           \`ID\` AS id
         FROM \`Fichaje\`
         WHERE DATE(\`FECHA\`) = ${this.escapeSql(dateStr)}
           AND TRIM(\`CODIGO\`) IN (${this.codesInList(codes)})
         ORDER BY \`ID\` DESC`,
      );

      for (const r of rows ?? []) {
        if (!r.codigo) continue;
        const list = map.get(r.codigo) ?? [];
        list.push({
          codigo: r.codigo,
          tipo: r.tipo,
          hora: r.hora,
          id: Number(r.id),
        });
        map.set(r.codigo, list);
      }
    } catch (err: any) {
      this.logger.error(`loadFichajesToday failed: ${err.message}`);
    }
    return map;
  }

  /** Map CODIGO → Int for NotificariFichaje.empleado_id */
  codigoToEmpleadoId(codigo: string): number | null {
    const raw = String(codigo).trim();
    if (/^\d+$/.test(raw)) {
      const n = Number(raw);
      return Number.isSafeInteger(n) ? n : null;
    }
    // stable 31-bit hash for alphanumeric codes
    let h = 0;
    for (let i = 0; i < raw.length; i++) {
      h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
    }
    const abs = Math.abs(h);
    return abs === 0 ? 1 : abs;
  }

  private minuteDistance(a: number, b: number): number {
    const diff = Math.abs(a - b);
    return Math.min(diff, 1440 - diff);
  }

  private horaToMinutes(hora: string | null): number | null {
    if (!hora) return null;
    const m = String(hora).match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  private cleanHora(hora: string | null): string | null {
    if (!hora) return null;
    const m = String(hora).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return String(hora).trim();
    return `${m[1].padStart(2, '0')}:${m[2]}`;
  }

  private escapeSql(value: string): string {
    return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }

  private codesInList(codes: string[]): string {
    return codes.map((c) => this.escapeSql(c)).join(',');
  }

  private isTruthy(v: string | undefined | null): boolean {
    if (!v) return false;
    return ['1', 'true', 'yes', 'on'].includes(String(v).trim().toLowerCase());
  }
}
