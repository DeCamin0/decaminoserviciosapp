import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import {
  FichajeReminderService,
  ReminderProcessOptions,
  ReminderProcessResult,
} from './fichaje-reminder.service';

@Injectable()
export class FichajeReminderCronService {
  private readonly logger = new Logger(FichajeReminderCronService.name);
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly reminderService: FichajeReminderService,
  ) {}

  /** Every 5 minutes, Europe/Madrid */
  @Cron('0 */5 * * * *', { timeZone: 'Europe/Madrid' })
  async handleCron() {
    if (!this.isEnabled()) {
      return;
    }
    await this.runReminders();
  }

  /**
   * Manual / test entrypoint (also used by controller).
   * Respects FICHAJE_REMINDER_DRY_RUN unless options.dryRun is set explicitly.
   */
  async runReminders(
    options: ReminderProcessOptions = {},
  ): Promise<ReminderProcessResult> {
    if (this.running) {
      this.logger.warn('Fichaje reminder already running — skip overlap');
      return {
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
        dryRun: true,
        candidates: [],
        skipped: [],
      };
    }

    this.running = true;
    try {
      this.logger.log('⏰ Cron fichaje reminder started');
      return await this.reminderService.processReminders(options);
    } finally {
      this.running = false;
    }
  }

  isEnabled(): boolean {
    const v = this.config.get<string>('FICHAJE_REMINDER_ENABLED');
    if (!v) return false;
    return ['1', 'true', 'yes', 'on'].includes(String(v).trim().toLowerCase());
  }
}
