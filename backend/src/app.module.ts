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
import { ComunicadosModule } from './comunicados/comunicados.module';
import { EmpleadosController } from './controllers/empleados.controller';
import { EmpleadosService } from './services/empleados.service';
import { EmpleadosStatsService } from './services/empleados-stats.service';
import { AvatarController } from './controllers/avatar.controller';
import { AvatarService } from './services/avatar.service';
import { MonthlyAlertsController } from './controllers/monthly-alerts.controller';
import { MonthlyAlertsService } from './services/monthly-alerts.service';
import { PushController } from './controllers/push.controller';
import { PushService } from './services/push.service';
import { ClientesController } from './controllers/clientes.controller';
import { ClientesService } from './services/clientes.service';
import { ContractTypesController } from './controllers/contract-types.controller';
import { EmailService } from './services/email.service';
import { AusenciasController } from './controllers/ausencias.controller';
import { AusenciasService } from './services/ausencias.service';
import { FichajesController } from './controllers/fichajes.controller';
import { FichajesService } from './services/fichajes.service';
import { CuadrantesController } from './controllers/cuadrantes.controller';
import { CuadrantesService } from './services/cuadrantes.service';
import { TelegramService } from './services/telegram.service';
import { BajasMedicasController } from './controllers/bajas-medicas.controller';
import { BajasMedicasService } from './services/bajas-medicas.service';
import { HorasAsignadasController } from './controllers/horas-asignadas.controller';
import { HorasAsignadasService } from './services/horas-asignadas.service';
import { HorasPermitidasController } from './controllers/horas-permitidas.controller';
import { HorasPermitidasService } from './services/horas-permitidas.service';
import { GruposController } from './controllers/grupos.controller';
import { GruposService } from './services/grupos.service';
import { HorasTrabajadasController } from './controllers/horas-trabajadas.controller';
import { HorasTrabajadasService } from './services/horas-trabajadas.service';
import { SolicitudesController } from './controllers/solicitudes.controller';
import { SolicitudesService } from './services/solicitudes.service';
import { ActivityLogsController } from './controllers/activity-logs.controller';
import { ActivityLogsService } from './services/activity-logs.service';
import { NominasController } from './controllers/nominas.controller';
import { NominasService } from './services/nominas.service';
import { DocumentosController } from './controllers/documentos.controller';
import { DocumentosService } from './services/documentos.service';
import { DocumentosOficialesController } from './controllers/documentos-oficiales.controller';
import { DocumentosOficialesService } from './services/documentos-oficiales.service';
import { InspeccionesController } from './controllers/inspecciones.controller';
import { InspeccionesService } from './services/inspecciones.service';
import { HorariosController } from './controllers/horarios.controller';
import { HorariosService } from './services/horarios.service';
import { FestivosController } from './controllers/festivos.controller';
import { FestivosService } from './services/festivos.service';
import { GeocodingController } from './controllers/geocoding.controller';
import { GeocodingService } from './services/geocoding.service';
import { EstadisticasController } from './controllers/estadisticas.controller';
import { EstadisticasService } from './services/estadisticas.service';
import { CatalogoController } from './controllers/catalogo.controller';
import { CatalogoService } from './services/catalogo.service';
import { PedidosController } from './controllers/pedidos.controller';
import { PedidosService } from './services/pedidos.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    NotificationsModule,
    PrismaModule,
    ComunicadosModule,
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
    PushController,
    ClientesController,
    ContractTypesController,
    AusenciasController,
    FichajesController,
    CuadrantesController,
    BajasMedicasController,
    HorasAsignadasController,
    HorasPermitidasController,
    GruposController,
    HorasTrabajadasController,
    SolicitudesController,
    ActivityLogsController,
    NominasController,
    DocumentosController,
    DocumentosOficialesController,
    InspeccionesController,
    HorariosController,
    FestivosController,
    GeocodingController,
    EstadisticasController,
    CatalogoController,
    PedidosController,
  ],
  providers: [
    AppService,
    N8nProxyService,
    MeService,
    EmpleadosService,
    EmpleadosStatsService,
    AvatarService,
    MonthlyAlertsService,
    PushService,
    EmailService,
    AusenciasService,
    FichajesService,
    CuadrantesService,
    TelegramService,
    BajasMedicasService,
    HorasAsignadasService,
    HorasPermitidasService,
    GruposService,
    HorasTrabajadasService,
    SolicitudesService,
    ActivityLogsService,
    NominasService,
    DocumentosService,
    DocumentosOficialesService,
    InspeccionesService,
    HorariosService,
    FestivosService,
    GeocodingService,
    ClientesService,
    EstadisticasService,
    CatalogoService,
    PedidosService,
  ],
})
export class AppModule {}
