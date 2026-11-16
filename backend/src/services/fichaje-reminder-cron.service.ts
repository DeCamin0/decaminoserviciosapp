import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
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
   * Cronul apelează fără opțiuni: toată firma, fereastra din mediu.
   * Apelul manual primește `manual: true` și, la suprapunere, 429 în loc de un rezultat gol.
   */
  async runReminders(
    options: ReminderProcessOptions & { manual?: boolean } = {},
  ): Promise<ReminderProcessResult> {
    if (this.running) {
      this.logger.warn('Fichaje reminder already running — skip overlap');
      if (options.manual) {
        throw new HttpException(
          'Ya hay un recordatorio en curso. Espera a que termine.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
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
      const serviceOptions: ReminderProcessOptions = {
        dryRun: options.dryRun,
        allowedCodigos: options.allowedCodigos,
      };
      if (!options.manual && options.windowMinutes != null) {
        serviceOptions.windowMinutes = options.windowMinutes;
      }
      return await this.reminderService.processReminders(serviceOptions);
    } finally {
      this.running = false;
    }
  }

  isEnabled(): boolean {
    const v = this.config.get<string>('FICHAJE_REMINDER_ENABLED');
    if (!v) return false;
    return ['1', 'true', 'yes', 'on'].includes(String(v).trim().toLowerCase());
  }

  /** FICHAJE_REMINDER_DRY_RUN împiedică trimiterea, inclusiv din query. */
  isEnvDryRun(): boolean {
    const v = this.config.get<string>('FICHAJE_REMINDER_DRY_RUN');
    if (!v) return false;
    return ['1', 'true', 'yes', 'on'].includes(String(v).trim().toLowerCase());
  }

  retryCooldownMs(): number {
    const n = Number(
      this.config.get<string>('FICHAJE_REMINDER_RETRY_MINUTES') ?? 30,
    );
    const minutes = Number.isFinite(n) ? Math.max(1, n) : 30;
    return minutes * 60_000;
  }
}
