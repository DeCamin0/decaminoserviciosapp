import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/db')
export class DbHealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get('health')
  async getHealth() {
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
