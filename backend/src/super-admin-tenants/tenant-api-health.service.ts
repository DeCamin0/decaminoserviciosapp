import { Injectable, Logger } from '@nestjs/common';

/** Values returned to super-admin API; UI displays them as-is (no client-side logic). */
export type TenantApiHealthLabel = 'OK' | 'DOWN' | 'UNKNOWN';

/**
 * Read-only probe of a tenant's public API (GET {base}/health).
 * No auth; used only from super-admin control plane.
 */
@Injectable()
export class TenantApiHealthService {
  private readonly logger = new Logger(TenantApiHealthService.name);

  private readonly timeoutMs = 3500;

  /**
   * @param apiPublicUrl Base URL without trailing slash, e.g. https://api.example.com
   */
  async probe(
    apiPublicUrl: string | null | undefined,
  ): Promise<TenantApiHealthLabel> {
    const raw = apiPublicUrl?.trim();
    if (!raw) {
      return 'UNKNOWN';
    }
    let base: string;
    try {
      const u = new URL(raw);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return 'UNKNOWN';
      }
      base = `${u.protocol}//${u.host}`;
    } catch {
      return 'UNKNOWN';
    }

    const healthUrl = `${base}/health`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (!res.ok) {
        return 'DOWN';
      }
      const text = await res.text();
      if (!text?.trim()) {
        return 'OK';
      }
      try {
        const body = JSON.parse(text) as { status?: string };
        if (typeof body?.status === 'string') {
          const s = body.status.toLowerCase();
          if (s === 'ok') {
            return 'OK';
          }
          return 'DOWN';
        }
      } catch {
        // Non-JSON 200: treat as up
        return 'OK';
      }
      return 'OK';
    } catch (e: unknown) {
      clearTimeout(timer);
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.debug(`Health probe failed for ${healthUrl}: ${msg}`);
      return 'DOWN';
    }
  }
}
