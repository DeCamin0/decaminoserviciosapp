import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { publicDbHealthBody } from '../services/public-health-body';

/**
 * Rute:
 * - GET /api/db/health — canonic
 * - GET /api/db-health — alias (scripturi / monitoring care folosesc cratima)
 */
@Controller('api')
export class DbHealthController {
  constructor(private readonly prisma: PrismaService) {}

  @SkipThrottle() // Health checks nu trebuie să fie rate-limited
  @Get('db/health')
  async getHealth() {
    return this.runDbCheck();
  }

  @SkipThrottle()
  @Get('db-health')
  async getHealthAlias() {
    return this.runDbCheck();
  }

  private async runDbCheck() {
    const started = Date.now();
    try {
      const result = await this.prisma.$queryRawUnsafe('SELECT 1 AS ok');
      const latencyMs = Date.now() - started;

      const rows = result as Array<{ ok?: number }>;
      const alive = Array.isArray(rows) && Number(rows[0]?.ok) === 1;
      return publicDbHealthBody({
        ok: alive,
        latencyMs: alive ? latencyMs : undefined,
      });
    } catch {
      return publicDbHealthBody({ ok: false });
    }
  }
}
