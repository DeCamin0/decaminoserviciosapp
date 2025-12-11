import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private configService?: ConfigService) {
    super({
      datasources: {
        db: {
          url:
            process.env.DATABASE_URL ||
            (() => {
              // Build DATABASE_URL from separate env vars if not set
              const host = process.env.DB_HOST || 'localhost';
              const port = process.env.DB_PORT || '3306';
              const user = process.env.DB_USERNAME || 'root';
              const password = process.env.DB_PASSWORD || '';
              const database = process.env.DB_NAME || 'decaminoservicios';
              return `mysql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
            })(),
        },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
