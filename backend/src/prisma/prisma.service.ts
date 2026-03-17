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
            if (db) {
              return `mysql://${db.username}:${encodeURIComponent(db.password)}@${db.host}:${db.port}/${db.database}?charset=utf8mb4`;
            }
            const host = process.env.DB_HOST || 'localhost';
            const port = process.env.DB_PORT || '3306';
            const user = process.env.DB_USERNAME || 'root';
            const password = process.env.DB_PASSWORD || '';
            const database = process.env.DB_NAME || 'decaminoservicios';
            return `mysql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}?charset=utf8mb4`;
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
