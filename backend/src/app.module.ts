import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './gateways/notifications.module';
import { N8nProxyService } from './services/n8n-proxy.service';
import { ProxyController } from './controllers/proxy.controller';
import { HealthController } from './controllers/health.controller';
import { DbHealthController } from './controllers/db-health.controller';
import { MeController } from './controllers/me.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { MeService } from './services/me.service';
import { PrismaModule } from './prisma/prisma.module';
import { ChatModule } from './chat/chat.module';
import { EmpleadosController } from './controllers/empleados.controller';
import { EmpleadosService } from './services/empleados.service';
import { AvatarController } from './controllers/avatar.controller';
import { AvatarService } from './services/avatar.service';
import { MonthlyAlertsController } from './controllers/monthly-alerts.controller';
import { MonthlyAlertsService } from './services/monthly-alerts.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    NotificationsModule,
    PrismaModule,
    ChatModule,
  ],
  controllers: [
    AppController,
    ProxyController,
    HealthController,
    DbHealthController,
    MeController,
    PermissionsController,
    EmpleadosController,
    AvatarController,
    MonthlyAlertsController,
  ],
  providers: [
    AppService,
    N8nProxyService,
    MeService,
    EmpleadosService,
    AvatarService,
    MonthlyAlertsService,
  ],
})
export class AppModule {}
