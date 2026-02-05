import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { FichajeRegularizacionController } from './controllers/fichaje-regularizacion.controller';
import { FichajeRegularizacionService } from './services/fichaje-regularizacion.service';
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
import { DocumentosSolicitadosController } from './controllers/documentos-solicitados.controller';
import { DocumentosSolicitadosService } from './services/documentos-solicitados.service';
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
import { SentEmailsController } from './controllers/sent-emails.controller';
import { SentEmailsService } from './services/sent-emails.service';
import { ScheduledMessagesController } from './controllers/scheduled-messages.controller';
import { ScheduledMessagesService } from './services/scheduled-messages.service';
import { ScheduledMessagesCronService } from './services/scheduled-messages-cron.service';
import { DespidoAutomationCronService } from './services/despido-automation-cron.service';
import { BajaVoluntariaPdfService } from './services/baja-voluntaria-pdf.service';
import { GestoriaController } from './controllers/gestoria.controller';
import { GestoriaService } from './services/gestoria.service';
import { VacacionesModule } from './vacaciones/vacaciones.module';
import { AssistantModule } from './assistant/assistant.module';
import { MonitoringService } from './services/monitoring.service';
import { MonitoringController } from './controllers/monitoring.controller';
import { HallOfFameController } from './controllers/hall-of-fame.controller';
import { HallOfFameService } from './services/hall-of-fame.service';
import { EmailIngestionModule } from './email-ingestion/email-ingestion.module';
import { EmployeeExportService } from './services/employee-export.service';
import { PrlDocumentsController } from './controllers/prl-documents.controller';
import { PrlDocumentsService } from './services/prl-documents.service';
import { DiplomasController } from './controllers/diplomas.controller';
import { DiplomasService } from './services/diplomas.service';
import { PedidosNotasController } from './controllers/pedidos-notas.controller';
import { PedidosNotasService } from './services/pedidos-notas.service';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(), // Pentru cron jobs
    // Rate limiting: mărit pentru a evita 429 la documentos-solicitados
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 10000, // 10 secunde
        limit: 100, // 100 request-uri pe 10 secunde (mărit pentru a evita 429)
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minut
        limit: 500, // 500 request-uri pe minut (mărit pentru a evita 429)
      },
      {
        name: 'long',
        ttl: 3600000, // 1 oră
        limit: 1000, // 1000 request-uri pe oră (protecție împotriva atacurilor prelungite)
      },
    ]),
    AuthModule,
    NotificationsModule,
    PrismaModule,
    ComunicadosModule,
    VacacionesModule,
    AssistantModule,
    EmailIngestionModule,
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
    HallOfFameController,
    PushController,
    ClientesController,
    ContractTypesController,
    AusenciasController,
    FichajesController,
    FichajeRegularizacionController,
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
    DocumentosSolicitadosController,
    InspeccionesController,
    HorariosController,
    FestivosController,
    GeocodingController,
    EstadisticasController,
    CatalogoController,
    PedidosController,
    SentEmailsController,
    ScheduledMessagesController,
    GestoriaController,
    MonitoringController,
    PrlDocumentsController,
    DiplomasController,
    PedidosNotasController,
    // AssistantController se importa din AssistantModule
  ],
  providers: [
    // Rate limiting global - aplicat automat la toate endpoint-urile
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AppService,
    N8nProxyService,
    MeService,
    EmpleadosService,
    EmpleadosStatsService,
    AvatarService,
    MonthlyAlertsService,
    HallOfFameService,
    PushService,
    EmailService,
    AusenciasService,
    FichajesService,
    FichajeRegularizacionService,
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
    DocumentosSolicitadosService,
    InspeccionesService,
    HorariosService,
    FestivosService,
    GeocodingService,
    ClientesService,
    EstadisticasService,
    CatalogoService,
    PedidosService,
    SentEmailsService,
    ScheduledMessagesService,
    ScheduledMessagesCronService,
    GestoriaService,
    MonitoringService,
    DespidoAutomationCronService,
    BajaVoluntariaPdfService,
    EmployeeExportService,
    PrlDocumentsService,
    DiplomasService,
    PedidosNotasService,
  ],
})
export class AppModule {}
