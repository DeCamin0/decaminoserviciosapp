import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { join } from 'path';
import { existsSync } from 'fs';
import n8nConfig from './n8n.config';
import databaseConfig from './database.config';
import jwtConfig from './jwt.config';

const envPath = join(process.cwd(), '.env');
console.log('[ConfigModule] Looking for .env at:', envPath);
console.log('[ConfigModule] .env exists:', existsSync(envPath));
console.log('[ConfigModule] process.cwd():', process.cwd());
console.log('[ConfigModule] DB_HOST from process.env:', process.env.DB_HOST);

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envPath,
      load: [n8nConfig, databaseConfig, jwtConfig],
    }),
  ],
})
export class ConfigModule {}
