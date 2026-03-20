import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limit para POST /api/assistant/message por usuario autenticado (JWT),
 * no solo por IP — evita que varios usuarios tras un NAT compartan el mismo bucket.
 * Si no hay userId (no debería ocurrir tras JwtAuthGuard), cae a IP.
 */
@Injectable()
export class AssistantUserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const uid = req?.user?.userId;
    if (uid != null && String(uid).trim() !== '') {
      return `asst:${String(uid).trim()}`;
    }
    const ip =
      req?.ip ||
      req?.connection?.remoteAddress ||
      req?.socket?.remoteAddress ||
      'unknown';
    return `asst:ip:${ip}`;
  }
}
