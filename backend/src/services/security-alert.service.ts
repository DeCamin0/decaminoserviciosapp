import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';

type LoginFailBucket = {
  count: number;
  windowStart: number;
  emails: Set<string>;
};

type ThrottleEntry = {
  lastSentAt: number;
  suppressed: number;
};

/**
 * Alerte de securitate → Telegram (bot general), cu anti-spam.
 * - Burst login eșuat
 * - 403 pe rute sensibile
 */
@Injectable()
export class SecurityAlertService {
  private readonly logger = new Logger(SecurityAlertService.name);

  /** 5 eșecuri în 5 minute → alertă */
  private readonly loginFailThreshold = 5;
  private readonly loginFailWindowMs = 5 * 60 * 1000;
  /** Max 1 Telegram / cheie / 3 minute */
  private readonly throttleMs = 3 * 60 * 1000;

  private readonly loginByIp = new Map<string, LoginFailBucket>();
  private readonly loginByEmail = new Map<string, LoginFailBucket>();
  private readonly throttleMap = new Map<string, ThrottleEntry>();

  private readonly sensitivePathPrefixes = [
    '/api/empleados',
    '/api/permissions',
    '/api/documentos',
    '/api/documentos-oficiales',
    '/api/documentos-solicitados',
    '/api/vacaciones',
    '/api/festivos',
    '/api/super-admin',
    '/api/prl',
    '/api/assistant/admin',
    '/api/nominas',
    '/api/activity-logs',
    '/api/gestoria',
    '/api/leads',
  ];

  constructor(private readonly telegramService: TelegramService) {}

  /**
   * Înregistrează un login eșuat; alertează dacă pragul e atins.
   */
  recordLoginFailure(opts: {
    email?: string;
    ip?: string;
    reason?: string;
  }): void {
    const ip = (opts.ip || 'unknown').trim() || 'unknown';
    const email = String(opts.email || '')
      .trim()
      .toLowerCase();
    const now = Date.now();

    const ipHit = this.bumpLoginBucket(this.loginByIp, ip, email, now);
    const emailHit = email
      ? this.bumpLoginBucket(this.loginByEmail, email, email, now)
      : { triggered: false, count: 0, emails: [] as string[] };

    if (!ipHit.triggered && !emailHit.triggered) {
      return;
    }

    const scope = ipHit.triggered ? `IP ${ip}` : `email ${email}`;
    const count = ipHit.triggered ? ipHit.count : emailHit.count;
    const tried = [
      ...new Set([...(ipHit.emails || []), ...(emailHit.emails || [])]),
    ]
      .filter(Boolean)
      .slice(0, 5);

    void this.sendThrottled(
      `login_burst:${ipHit.triggered ? ip : email}`,
      [
        '⚠️ [SECURITY] Login fallido (burst)',
        '',
        `Alcance: ${scope}`,
        `Intentos en ventana: ${count}+ (umbral ${this.loginFailThreshold} / 5 min)`,
        `IP: ${ip}`,
        tried.length ? `Emails intentados: ${tried.join(', ')}` : '',
        opts.reason ? `Último error: ${String(opts.reason).slice(0, 120)}` : '',
        `Timestamp: ${new Date().toISOString()}`,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  /**
   * Alertă pe 403 Forbidden pentru path-uri sensibile.
   */
  recordForbidden(opts: {
    method: string;
    path: string;
    ip?: string;
    userLabel?: string;
    message?: string;
  }): void {
    const pathOnly = String(opts.path || '').split('?')[0];
    if (!this.isSensitivePath(pathOnly)) {
      return;
    }

    const ip = (opts.ip || 'unknown').trim() || 'unknown';
    const key = `403:${opts.method}:${pathOnly}:${ip}`;

    void this.sendThrottled(
      key,
      [
        '⚠️ [SECURITY] 403 FORBIDDEN',
        '',
        `${opts.method} ${pathOnly}`,
        `Usuario: ${opts.userLabel || 'anónimo / sin JWT'}`,
        `IP: ${ip}`,
        opts.message
          ? `Mensaje: ${String(opts.message).slice(0, 200)}`
          : '',
        `Timestamp: ${new Date().toISOString()}`,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  isSensitivePath(path: string): boolean {
    const p = String(path || '').toLowerCase().split('?')[0];
    return this.sensitivePathPrefixes.some(
      (prefix) => p === prefix || p.startsWith(`${prefix}/`),
    );
  }

  private bumpLoginBucket(
    map: Map<string, LoginFailBucket>,
    key: string,
    email: string,
    now: number,
  ): { triggered: boolean; count: number; emails: string[] } {
    let bucket = map.get(key);
    if (!bucket || now - bucket.windowStart > this.loginFailWindowMs) {
      bucket = { count: 0, windowStart: now, emails: new Set() };
      map.set(key, bucket);
    }
    bucket.count += 1;
    if (email) bucket.emails.add(email);

    const triggered = bucket.count === this.loginFailThreshold;
    // Re-trigger every threshold multiples inside window (still throttled on send)
    const reTrigger =
      bucket.count > this.loginFailThreshold &&
      bucket.count % this.loginFailThreshold === 0;

    return {
      triggered: triggered || reTrigger,
      count: bucket.count,
      emails: [...bucket.emails],
    };
  }

  private async sendThrottled(key: string, message: string): Promise<void> {
    const now = Date.now();
    const entry = this.throttleMap.get(key);

    if (entry && now - entry.lastSentAt < this.throttleMs) {
      entry.suppressed += 1;
      this.throttleMap.set(key, entry);
      this.logger.debug(
        `Security alert throttled (${key}), suppressed=${entry.suppressed}`,
      );
      return;
    }

    const suppressed = entry?.suppressed || 0;
    this.throttleMap.set(key, { lastSentAt: now, suppressed: 0 });

    const finalMessage =
      suppressed > 0
        ? `${message}\n\n(+${suppressed} similares omitidos por throttle)`
        : message;

    try {
      if (this.telegramService.isGeneralConfigured()) {
        await this.telegramService.sendGeneralMessage(finalMessage, {
          disableMarkdown: true,
        });
      } else if (this.telegramService.isConfigured()) {
        await this.telegramService.sendMessage(finalMessage, {
          disableMarkdown: true,
        });
      } else {
        this.logger.warn(
          '⚠️ Security alert skipped — Telegram not configured',
        );
        return;
      }
      this.logger.log(`✅ Security alert sent (${key})`);
    } catch (error: any) {
      this.logger.error(
        `❌ Security alert Telegram failed: ${error?.message || error}`,
      );
    }
  }
}
