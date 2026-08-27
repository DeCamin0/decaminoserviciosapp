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
          // Mereu din ConfigService (baza clientului curent), nu din process.env.DATABASE_URL – ca HERA să nu folosească niciodată decamino_db
          url: (() => {
            const db = configService?.get<{
              host: string;
              port: number;
              username: string;
              password: string;
              database: string;
            }>('database');
            // connection_limit/pool_timeout: pe VPS cu 1 vCPU Prisma default e ~3 și se epuizează sub load
            const poolQs =
              'charset=utf8mb4&connection_limit=10&pool_timeout=20';
            if (db) {
              return `mysql://${db.username}:${encodeURIComponent(db.password)}@${db.host}:${db.port}/${db.database}?${poolQs}`;
            }
            const host = process.env.DB_HOST || 'localhost';
            const port = process.env.DB_PORT || '3306';
            const user = process.env.DB_USERNAME || 'root';
            const password = process.env.DB_PASSWORD || '';
            const database = process.env.DB_NAME || 'decaminoservicios';
            return `mysql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}?${poolQs}`;
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
