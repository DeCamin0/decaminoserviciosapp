import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './gateways/notifications.module';
import { N8nProxyService } from './services/n8n-proxy.service';
import { ProxyController } from './controllers/proxy.controller';
import { HealthController } from './controllers/health.controller';

@Module({
  imports: [ConfigModule, DatabaseModule, AuthModule, NotificationsModule],
  controllers: [AppController, ProxyController, HealthController],
  providers: [AppService, N8nProxyService],
})
export class AppModule {}
