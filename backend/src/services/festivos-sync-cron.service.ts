import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FestivosService } from './festivos.service';
import { FestivosZonaService } from './festivos-zona.service';

/**
 * Sync lunar festivos Nacional + Comunidad de Madrid
 * din calendariosnacionales.com → tabela fiestas.
 */
@Injectable()
export class FestivosSyncCronService {
  private readonly logger = new Logger(FestivosSyncCronService.name);

  constructor(
    private readonly festivosService: FestivosService,
    private readonly festivosZonaService: FestivosZonaService,
  ) {}

  /** Ziua 1 a fiecărei luni, 06:00 Europe/Madrid */
  @Cron('0 0 6 1 * *', { timeZone: 'Europe/Madrid' })
  async handleMonthlySync() {
    this.logger.log('⏰ Cron festivos sync (lunar) declanșat');
    try {
      const result = await this.festivosService.syncFromCalendariosNacionales();
      const year = new Date().getFullYear();
      const local = await this.festivosZonaService.syncLocalHolidays([
        year,
        year + 1,
      ]);
      this.logger.log(
        `✅ Cron festivos OK: inserted=${result.totals.inserted} updated=${result.totals.updated} unchanged=${result.totals.unchanged} local=${local.inserted}/${local.updated}`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Cron festivos sync failed: ${error?.message || error}`,
      );
    }
  }
}
