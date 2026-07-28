import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';

type AusenciaProximaRow = {
  id: number;
  solicitud_id: string;
  CODIGO: string;
  NOMBRE: string;
  TIPO: string;
  FECHA_RAW: string | null;
  HORA: Date | string | null;
  LOCACION: string | null;
  MOTIVO: string | null;
  DURACION: string | null;
  UNIDAD_DURACION: string | null;
  created_at: Date | string | null;
  fecha_inicio: Date | string | null;
  fecha_fin: Date | string | null;
};

type SolicitudPendienteRow = {
  id: string;
  CODIGO: string | null;
  NOMBRE: string | null;
  TIPO: string | null;
  estado: string | null;
  fecha_inicio: Date | string | null;
  fecha_fin: string | Date | null;
  MOTIVO: string | null;
  fecha_solicitud: Date | string | null;
};

type PeriodFiltered = {
  nombre: string;
  tipo: string;
  motivo: string;
  _realStart: Date;
  _realEnd: Date;
  _totalDays: number;
  _remainingDays: number;
  extraLine?: string;
};

/** Telegram limit 4096; lăsăm spațiu pentru prefix [Client] */
const TELEGRAM_MAX_CHARS = 3500;

/**
 * Cron absente: (1) Ausencias aprobadas + (2) Solicitudes Pendiente
 * din următoarele 10 zile → Telegram (bot gestoria).
 */
@Injectable()
export class AusenciasProximasCronService {
  private readonly logger = new Logger(AusenciasProximasCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

  /** 09:15 Europe/Madrid */
  @Cron('0 15 9 * * *', { timeZone: 'Europe/Madrid' })
  async handleMorning() {
    this.logger.log('⏰ Cron absente (09:15) declanșat');
    await this.processProximasAusencias();
  }

  /** 19:30 Europe/Madrid */
  @Cron('0 30 19 * * *', { timeZone: 'Europe/Madrid' })
  async handleEvening() {
    this.logger.log('⏰ Cron absente (19:30) declanșat');
    await this.processProximasAusencias();
  }

  /**
   * Trimite 2 tipuri de mesaje: aprobadas (Ausencias) + pendientes (solicitudes).
   */
  async processProximasAusencias(options?: {
    throwOnTelegramError?: boolean;
  }): Promise<{
    count: number;
    chunks: number;
    pendientesCount: number;
    pendientesChunks: number;
  }> {
    const throwOnError = options?.throwOnTelegramError === true;

    try {
      if (!this.telegramService.isConfigured()) {
        const msg =
          'Telegram gestoria bot not configured — cron absente skipped';
        this.logger.warn(`⚠️ ${msg}`);
        if (throwOnError) throw new Error(msg);
        return {
          count: 0,
          chunks: 0,
          pendientesCount: 0,
          pendientesChunks: 0,
        };
      }

      const ausenciaRows = await this.fetchProximasAusencias();
      const ausenciasFiltradas = this.filterAusencias(ausenciaRows);
      const ausenciaChunks = this.buildChunksFromPeriods(
        ausenciasFiltradas,
        '📢 *Ausencias aprobadas (próximos 10 días)*',
        '✅ No hay ausencias aprobadas en los próximos 10 días.',
      );

      const pendienteRows = await this.fetchProximasPendientes();
      const pendientesFiltradas = this.filterPendientes(pendienteRows);
      const pendienteChunks = this.buildChunksFromPeriods(
        pendientesFiltradas,
        '⏳ *Solicitudes pendientes (próximos 10 días)*',
        '✅ No hay solicitudes pendientes en los próximos 10 días.',
      );

      const allChunks = [
        ...ausenciaChunks.map((c, i, arr) =>
          this.withPartSuffix(c, i, arr.length),
        ),
        ...pendienteChunks.map((c, i, arr) =>
          this.withPartSuffix(c, i, arr.length),
        ),
      ];

      for (const chunk of allChunks) {
        await this.telegramService.sendMessage(chunk, { throwOnError: true });
      }

      this.logger.log(
        `✅ Cron absente: aprobadas=${ausenciasFiltradas.length} (${ausenciaChunks.length} msg), pendientes=${pendientesFiltradas.length} (${pendienteChunks.length} msg)`,
      );

      return {
        count: ausenciasFiltradas.length,
        chunks: ausenciaChunks.length,
        pendientesCount: pendientesFiltradas.length,
        pendientesChunks: pendienteChunks.length,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Eroare în cron absente: ${error?.message || error}`,
      );
      if (throwOnError) throw error;
      return {
        count: 0,
        chunks: 0,
        pendientesCount: 0,
        pendientesChunks: 0,
      };
    }
  }

  private withPartSuffix(
    text: string,
    index: number,
    total: number,
  ): string {
    if (total <= 1) return text;
    return `${text}\n\n_(mensaje ${index + 1} de ${total})_`;
  }

  private async fetchProximasAusencias(): Promise<AusenciaProximaRow[]> {
    const query = `
SELECT
  t.id,
  t.solicitud_id,
  t.CODIGO,
  t.NOMBRE,
  t.TIPO,
  t.FECHA        AS FECHA_RAW,
  t.HORA,
  t.LOCACION,
  t.MOTIVO,
  t.DURACION,
  t.UNIDAD_DURACION,
  t.created_at,
  t.fecha_inicio,
  t.fecha_fin
FROM (
  SELECT
    a.id,
    a.solicitud_id,
    a.CODIGO,
    a.NOMBRE,
    a.TIPO,
    a.FECHA,
    a.HORA,
    a.LOCACION,
    a.MOTIVO,
    a.DURACION,
    a.UNIDAD_DURACION,
    a.created_at,
    CASE
      WHEN REPLACE(a.FECHA, '- ', ' - ') LIKE '% - %'
        THEN STR_TO_DATE(TRIM(SUBSTRING_INDEX(REPLACE(a.FECHA, '- ', ' - '), ' - ', 1)), '%Y-%m-%e')
      ELSE STR_TO_DATE(a.FECHA, '%Y-%m-%e')
    END AS fecha_inicio,
    CASE
      WHEN REPLACE(a.FECHA, '- ', ' - ') LIKE '% - %'
        THEN STR_TO_DATE(TRIM(SUBSTRING_INDEX(REPLACE(a.FECHA, '- ', ' - '), ' - ', -1)), '%Y-%m-%e')
      ELSE STR_TO_DATE(a.FECHA, '%Y-%m-%e')
    END AS fecha_fin
  FROM Ausencias a
) AS t
WHERE
  t.fecha_fin   >= CURDATE()
  AND t.fecha_inicio <= DATE_ADD(CURDATE(), INTERVAL 10 DAY)
ORDER BY t.fecha_inicio, t.NOMBRE
`;

    return this.prisma.$queryRawUnsafe<AusenciaProximaRow[]>(query);
  }

  private async fetchProximasPendientes(): Promise<SolicitudPendienteRow[]> {
    // Intersecție cu [azi, azi+10]: sfârșitul >= azi, începutul <= azi+10
    const query = `
SELECT
  s.id,
  s.codigo AS CODIGO,
  s.nombre AS NOMBRE,
  s.tipo AS TIPO,
  s.estado,
  s.fecha_inicio,
  s.fecha_fin,
  s.motivo AS MOTIVO,
  s.fecha_solicitud
FROM solicitudes s
WHERE LOWER(TRIM(COALESCE(s.estado, ''))) = 'pendiente'
  AND s.fecha_inicio IS NOT NULL
  AND DATE(s.fecha_inicio) <= DATE_ADD(CURDATE(), INTERVAL 10 DAY)
  AND COALESCE(
    STR_TO_DATE(TRIM(s.fecha_fin), '%Y-%m-%d'),
    STR_TO_DATE(TRIM(s.fecha_fin), '%Y-%m-%e'),
    DATE(s.fecha_inicio)
  ) >= CURDATE()
ORDER BY s.fecha_inicio, s.nombre
`;

    return this.prisma.$queryRawUnsafe<SolicitudPendienteRow[]>(query);
  }

  private filterAusencias(rows: AusenciaProximaRow[]): PeriodFiltered[] {
    const { today, windowEnd } = this.getWindow();
    if (!today || !windowEnd) return [];

    const out: PeriodFiltered[] = [];
    for (const r of rows) {
      const startRaw = r.fecha_inicio || r.FECHA_RAW;
      const endRaw = r.fecha_fin || startRaw;
      const realStart = this.toDateOnly(startRaw);
      const realEnd = this.toDateOnly(endRaw);
      if (!realStart || !realEnd) continue;
      if (realEnd < today || realStart > windowEnd) continue;

      const totalDays = this.daysInclusive(realStart, realEnd);
      const remainingDays =
        realStart > today
          ? totalDays
          : Math.max(0, this.daysInclusive(today, realEnd));

      const horaFmt = this.formatHora(r.HORA);
      const hora = horaFmt ? ` a las ${horaFmt}` : '';
      const loc = r.LOCACION ? ` – ${r.LOCACION}` : '';

      out.push({
        nombre: r.NOMBRE || r.CODIGO || 'Desconocido',
        tipo: `${r.TIPO || 'Tipo desconocido'}${hora}${loc}`,
        motivo: r.MOTIVO || '',
        _realStart: realStart,
        _realEnd: realEnd,
        _totalDays: totalDays,
        _remainingDays: remainingDays,
        extraLine: `Estado: *Aprobada*`,
      });
    }
    return out;
  }

  private filterPendientes(rows: SolicitudPendienteRow[]): PeriodFiltered[] {
    const { today, windowEnd } = this.getWindow();
    if (!today || !windowEnd) return [];

    const out: PeriodFiltered[] = [];
    for (const r of rows) {
      const realStart = this.toDateOnly(r.fecha_inicio);
      const realEnd = this.toDateOnly(r.fecha_fin || r.fecha_inicio);
      if (!realStart || !realEnd) continue;
      if (realEnd < today || realStart > windowEnd) continue;

      const totalDays = this.daysInclusive(realStart, realEnd);
      const remainingDays =
        realStart > today
          ? totalDays
          : Math.max(0, this.daysInclusive(today, realEnd));

      out.push({
        nombre: r.NOMBRE || r.CODIGO || 'Desconocido',
        tipo: r.TIPO || 'Tipo desconocido',
        motivo: r.MOTIVO || '',
        _realStart: realStart,
        _realEnd: realEnd,
        _totalDays: totalDays,
        _remainingDays: remainingDays,
        extraLine: `Estado: *Pendiente* · ID: \`${r.id}\``,
      });
    }
    return out;
  }

  private getWindow(): { today: Date | null; windowEnd: Date | null } {
    const today = this.toDateOnly(new Date());
    if (!today) return { today: null, windowEnd: null };
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + 10);
    return { today, windowEnd };
  }

  private buildChunksFromPeriods(
    items: PeriodFiltered[],
    header: string,
    emptyMessage: string,
  ): string[] {
    if (!items.length) {
      return [emptyMessage];
    }

    const headerBlock = `${header}\n\n`;
    const entries = items.map((r) => this.formatPeriodEntry(r));
    const chunks: string[] = [];
    let current = headerBlock;

    for (const entry of entries) {
      if (
        current.length + entry.length > TELEGRAM_MAX_CHARS - 80 &&
        current !== headerBlock
      ) {
        chunks.push(current.trimEnd());
        current = headerBlock + `_(continuación)_\n\n` + entry;
      } else {
        current += entry;
      }
    }

    if (current.trim()) {
      chunks.push(current.trimEnd());
    }

    return chunks.length ? chunks : [emptyMessage];
  }

  private formatPeriodEntry(r: PeriodFiltered): string {
    const motivo = r.motivo ? ` – ${r.motivo}` : '';
    const startStr = this.formatYmd(r._realStart);
    const endStr = this.formatYmd(r._realEnd);
    const periodo =
      startStr === endStr
        ? `📅 *${startStr}*`
        : `📅 *${startStr} → ${endStr}*`;

    let text =
      `• ${periodo} – ${r.nombre} – ${r.tipo}${motivo}\n` +
      `   • Días totales: *${r._totalDays}* | Días restantes: *${r._remainingDays}*\n`;
    if (r.extraLine) {
      text += `   • ${r.extraLine}\n`;
    }
    return text + `\n`;
  }

  private toDateOnly(value: unknown): Date | null {
    if (value == null) return null;

    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    let str = String(value).trim();
    if (!str) return null;

    if (str.includes(' - ')) {
      str = str.split(' - ')[0].trim();
    }

    const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymd) {
      const y = Number(ymd[1]);
      const m = Number(ymd[2]) - 1;
      const d = Number(ymd[3]);
      const date = new Date(y, m, d);
      if (isNaN(date.getTime())) return null;
      return date;
    }

    const parsed = new Date(str);
    if (isNaN(parsed.getTime())) return null;
    return new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate(),
    );
  }

  private daysInclusive(a: Date, b: Date): number {
    return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
  }

  private formatYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private formatHora(hora: Date | string | null): string | null {
    if (hora == null) return null;

    if (hora instanceof Date) {
      if (isNaN(hora.getTime())) return null;
      const hh = String(hora.getHours()).padStart(2, '0');
      const mm = String(hora.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }

    const str = String(hora).trim();
    if (!str) return null;

    const match = str.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2]}`;
    }

    return str;
  }
}
