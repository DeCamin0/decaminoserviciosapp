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
          url: (() => {
            const dbUrl = process.env.DATABASE_URL;
            if (dbUrl) {
              // Dacă DATABASE_URL există, asigură-te că are charset=utf8mb4
              if (!dbUrl.includes('charset=')) {
                const separator = dbUrl.includes('?') ? '&' : '?';
                return `${dbUrl}${separator}charset=utf8mb4`;
              }
              return dbUrl;
            }
            // Build DATABASE_URL from separate env vars if not set
            const host = process.env.DB_HOST || 'localhost';
            const port = process.env.DB_PORT || '3306';
            const user = process.env.DB_USERNAME || 'root';
            const password = process.env.DB_PASSWORD || '';
            const database = process.env.DB_NAME || 'decaminoservicios';
            // Adaugă charset=utf8mb4 pentru a păstra caracterele speciale UTF-8
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
