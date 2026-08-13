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
import { PlantillasController } from './controllers/plantillas.controller';
import { PlantillasService } from './services/plantillas.service';
import { PresupuestosGuardadosController } from './controllers/presupuestos-guardados.controller';
import { PresupuestosFirmadoController } from './controllers/presupuestos-firmado.controller';
import { InformesFirmadoController } from './controllers/informes-firmado.controller';
import { InformesItemsController } from './controllers/informes-items.controller';
import { InformesModule } from './informes/informes.module';
import { PresupuestosGuardadosService } from './services/presupuestos-guardados.service';
import { PresupuestoDocumentoService } from './services/presupuesto-documento.service';
import { HorasTrabajadasController } from './controllers/horas-trabajadas.controller';
import { HorasTrabajadasService } from './services/horas-trabajadas.service';
import { SolicitudesController } from './controllers/solicitudes.controller';
import { SolicitudesService } from './services/solicitudes.service';
import { ActivityLogsController } from './controllers/activity-logs.controller';
import { ActivityLogsService } from './services/activity-logs.service';
import { NominasController } from './controllers/nominas.controller';
import { NominasService } from './services/nominas.service';
import { NominasStorageService } from './services/nominas-storage.service';
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
import { CatalogoStorageService } from './services/catalogo-storage.service';
import { PedidosController } from './controllers/pedidos.controller';
import { PedidosService } from './services/pedidos.service';
import { PedidosAlbaranesStorageService } from './services/pedidos-albaranes-storage.service';
import { InspeccionesMaterialesStorageService } from './services/inspecciones-materiales-storage.service';
import { SentEmailsController } from './controllers/sent-emails.controller';
import { SentEmailsService } from './services/sent-emails.service';
import { ScheduledMessagesController } from './controllers/scheduled-messages.controller';
import { ScheduledMessagesService } from './services/scheduled-messages.service';
import { ScheduledMessagesCronService } from './services/scheduled-messages-cron.service';
import { DespidoAutomationCronService } from './services/despido-automation-cron.service';
import { AusenciasProximasCronService } from './services/ausencias-proximas-cron.service';
import { FichajeScheduleResolverService } from './services/fichaje-schedule-resolver.service';
import { FichajeReminderService } from './services/fichaje-reminder.service';
import { FichajeReminderCronService } from './services/fichaje-reminder-cron.service';
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
import { PrlDocumentsStorageService } from './services/prl-documents-storage.service';
import { DiplomasController } from './controllers/diplomas.controller';
import { DiplomasService } from './services/diplomas.service';
import { DiplomasStorageService } from './services/diplomas-storage.service';
import { PresupuestosFirmasStorageService } from './services/presupuestos-firmas-storage.service';
import { InformesFirmasStorageService } from './services/informes-firmas-storage.service';
import { AvatarStorageService } from './services/avatar-storage.service';
import { CertificadosRetencionesController } from './controllers/certificados-retenciones.controller';
import { CertificadosRetencionesService } from './services/certificados-retenciones.service';
import { CertificadosRetencionesStorageService } from './services/certificados-retenciones-storage.service';
import { CarpetasDocumentosStorageService } from './services/carpetas-documentos-storage.service';
import { DocumentosOficialesStorageService } from './services/documentos-oficiales-storage.service';
import { PedidosNotasController } from './controllers/pedidos-notas.controller';
import { PedidosNotasService } from './services/pedidos-notas.service';
import { PedidosNotasStorageService } from './services/pedidos-notas-storage.service';
import { ServiciosPeriodicosController } from './controllers/servicios-periodicos.controller';
import { ServiciosPeriodicosService } from './services/servicios-periodicos.service';
import { SuperAdminTenantsModule } from './super-admin-tenants/super-admin-tenants.module';
import { LeadsController } from './controllers/leads.controller';
import { LeadsService } from './services/leads.service';
import { EmpleadoGrupoScopeService } from './services/empleado-grupo-scope.service';
import { PortalModule } from './portal/portal.module';
import { StorageModule } from './storage/storage.module';
import { FotosTrabajoModule } from './fotos-trabajo/fotos-trabajo.module';
import { TareasModule } from './tareas/tareas.module';
import { PresupuestosV2Module } from './presupuestos-v2/presupuestos-v2.module';

@Module({
  imports: [
    ConfigModule,
    StorageModule,
    FotosTrabajoModule,
    TareasModule,
    PresupuestosV2Module,
    ScheduleModule.forRoot(), // Pentru cron jobs
    // Rate limiting: generos pentru app internă (Todas/Aprobación fac multe request-uri per empleado → 429)
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 10000, // 10 secunde
        limit: 300, // 300 req/10s (batch documentos/ausencias justificadas)
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minut
        limit: 1500, // 1500 req/min
      },
      {
        name: 'long',
        ttl: 3600000, // 1 oră
        limit: 5000, // 5000 req/oră
      },
    ]),
    AuthModule,
    NotificationsModule,
    PrismaModule,
    InformesModule,
    ComunicadosModule,
    VacacionesModule,
    AssistantModule,
    EmailIngestionModule,
    SuperAdminTenantsModule,
    PortalModule,
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
    PlantillasController,
    PresupuestosGuardadosController,
    PresupuestosFirmadoController,
    InformesFirmadoController,
    InformesItemsController,
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
    CertificadosRetencionesController,
    PedidosNotasController,
    ServiciosPeriodicosController,
    LeadsController,
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
    AvatarStorageService,
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
    PlantillasService,
    PresupuestosGuardadosService,
    PresupuestoDocumentoService,
    HorasTrabajadasService,
    SolicitudesService,
    ActivityLogsService,
    NominasService,
    NominasStorageService,
    DocumentosService,
    DocumentosOficialesService,
    DocumentosSolicitadosService,
    InspeccionesService,
    InspeccionesMaterialesStorageService,
    HorariosService,
    FestivosService,
    GeocodingService,
    ClientesService,
    EstadisticasService,
    CatalogoService,
    CatalogoStorageService,
    PedidosService,
    PedidosAlbaranesStorageService,
    SentEmailsService,
    ScheduledMessagesService,
    ScheduledMessagesCronService,
    GestoriaService,
    MonitoringService,
    DespidoAutomationCronService,
    AusenciasProximasCronService,
    FichajeScheduleResolverService,
    FichajeReminderService,
    FichajeReminderCronService,
    BajaVoluntariaPdfService,
    EmployeeExportService,
    PrlDocumentsService,
    PrlDocumentsStorageService,
    DiplomasService,
    DiplomasStorageService,
    PresupuestosFirmasStorageService,
    InformesFirmasStorageService,
    CertificadosRetencionesService,
    CertificadosRetencionesStorageService,
    CarpetasDocumentosStorageService,
    DocumentosOficialesStorageService,
    PedidosNotasService,
    PedidosNotasStorageService,
    ServiciosPeriodicosService,
    LeadsService,
    EmpleadoGrupoScopeService,
  ],
})
export class AppModule {}
