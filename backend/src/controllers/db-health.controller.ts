import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Rute:
 * - GET /api/db/health — canonic
 * - GET /api/db-health — alias (scripturi / monitoring care folosesc cratima)
 */
@Controller('api')
export class DbHealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

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

      const dbConfig = this.configService.get('database');

      return {
        ok: true,
        dbHost: dbConfig?.host,
        dbName: dbConfig?.database,
        latencyMs,
        result:
          Array.isArray(result) && (result as any)[0]?.ok
            ? (result as any)[0]?.ok
            : 1,
      };
    } catch (error: any) {
      return {
        ok: false,
        error: error?.message || 'DB health check failed',
      };
    }
  }
}
