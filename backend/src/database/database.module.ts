import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { Notification } from '../entities/notification.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get('database');
        console.log('[DatabaseModule] Connecting to:', {
          host: dbConfig.host,
          port: dbConfig.port,
          database: dbConfig.database,
          username: dbConfig.username,
        });
        return {
          type: 'mysql',
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
          entities: [User, Notification],
          synchronize: dbConfig.synchronize, // false in production!
          logging: dbConfig.logging,
          retryAttempts: 3,
          retryDelay: 3000,
          extra: {
            // Same settings as n8n uses
            connectionLimit: 10,
            connectTimeout: 10000, // 10 seconds (same as n8n)
            ssl: false, // SSL is off in n8n
          },
        };
      },
    }),
    TypeOrmModule.forFeature([User, Notification]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
