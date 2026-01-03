import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);
  private consecutiveDbFailures = 0;
  private lastHealthCheck: Date | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.logger.log('✅ Monitoring service initialized');
    
    // Verifică dacă monitoring-ul este activat
    const monitoringEnabled =
      this.configService.get<string>('MONITORING_ENABLED') === 'true';
    
    if (!monitoringEnabled) {
      this.logger.warn(
        '⚠️ Monitoring is disabled. Set MONITORING_ENABLED=true to enable.',
      );
    }
  }

  /**
   * Health check pentru baza de date
   * Rulează la fiecare 5 minute
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkDatabaseHealth() {
    if (this.configService.get<string>('MONITORING_ENABLED') !== 'true') {
      return;
    }

    try {
      const startTime = Date.now();
      await this.prisma.$queryRawUnsafe('SELECT 1 AS ok');
      const latency = Date.now() - startTime;

      this.lastHealthCheck = new Date();

      // Reset counter dacă DB e OK
      if (this.consecutiveDbFailures > 0) {
        this.logger.log(
          `✅ Database health check recovered after ${this.consecutiveDbFailures} failures`,
        );
        this.consecutiveDbFailures = 0;
      }

      // Alertă dacă latența este prea mare (> 1 secundă)
      if (latency > 1000) {
        await this.sendPerformanceAlert({
          type: 'high_db_latency',
          latency,
          threshold: 1000,
        });
      }
    } catch (error: any) {
      this.consecutiveDbFailures++;
      this.logger.error(
        `❌ Database health check failed (${this.consecutiveDbFailures} consecutive failures): ${error.message}`,
      );

      // Trimite alertă doar după 2 eșecuri consecutive
      if (this.consecutiveDbFailures >= 2) {
        await this.sendDatabaseDownAlert(error);
      }
    }
  }

  /**
   * Verifică dacă backend-ul este accesibil
   * Poate fi extins cu verificări pentru servicii externe (n8n, etc.)
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkBackendHealth() {
    if (this.configService.get<string>('MONITORING_ENABLED') !== 'true') {
      return;
    }

    // Poți adăuga verificări pentru servicii externe aici
    // De exemplu: verifică dacă n8n este accesibil
  }

  /**
   * Trimite alertă când baza de date este down
   */
  private async sendDatabaseDownAlert(error: Error): Promise<void> {
    if (!this.telegramService.isConfigured()) {
      return;
    }

    try {
      const message = `
🔴 *Base de datos inaccesible*

❌ *Error:* ${error.message}
🔄 *Fallos consecutivos:* ${this.consecutiveDbFailures}
⏰ *Último check:* ${this.lastHealthCheck?.toISOString() || 'Nunca'}

⚠️ *Acción requerida:* Verificar conexión a base de datos
      `.trim();

      await this.telegramService.sendMessage(message);
      this.logger.log('✅ Database down alert sent to Telegram');
    } catch (alertError: any) {
      this.logger.error(
        `❌ Error sending database alert: ${alertError.message}`,
      );
    }
  }

  /**
   * Trimite alertă pentru probleme de performanță
   */
  private async sendPerformanceAlert(alert: {
    type: string;
    latency?: number;
    threshold?: number;
  }): Promise<void> {
    if (!this.telegramService.isConfigured()) {
      return;
    }

    try {
      let message = '';
      
      if (alert.type === 'high_db_latency') {
        message = `
⚠️ *Alerta de rendimiento*

🐌 *Latencia DB:* ${alert.latency}ms (umbral: ${alert.threshold}ms)
⏰ *Timestamp:* ${new Date().toISOString()}

⚠️ La base de datos está respondiendo lentamente.
        `.trim();
      }

      if (message) {
        await this.telegramService.sendMessage(message);
        this.logger.log('✅ Performance alert sent to Telegram');
      }
    } catch (error: any) {
      this.logger.error(`❌ Error sending performance alert: ${error.message}`);
    }
  }

  /**
   * Manual health check (poate fi apelat din controller)
   */
  async performHealthCheck(): Promise<{
    db: { ok: boolean; latency?: number; error?: string };
    timestamp: Date;
  }> {
    const result: {
      db: { ok: boolean; latency?: number; error?: string };
      timestamp: Date;
    } = {
      db: { ok: false },
      timestamp: new Date(),
    };

    try {
      const start = Date.now();
      await this.prisma.$queryRawUnsafe('SELECT 1 AS ok');
      result.db.ok = true;
      result.db.latency = Date.now() - start;
    } catch (error: any) {
      result.db.error = error.message;
    }

    return result;
  }
}

