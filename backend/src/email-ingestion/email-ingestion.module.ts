import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../gateways/notifications.module';
import { ImapConnector } from './connectors/imap.connector';
import { DocumentIngestionService } from './services/document-ingestion.service';
import { DocumentReviewService } from './services/document-review.service';
import { DocumentDistributionService } from './services/document-distribution.service';
import { DocumentReviewController } from './controllers/document-review.controller';
import { EmailService } from '../services/email.service';
import { SentEmailsService } from '../services/sent-emails.service';
import { EmpleadosService } from '../services/empleados.service';
import { DocumentosSolicitadosService } from '../services/documentos-solicitados.service';
import { CarpetasDocumentosStorageService } from '../services/carpetas-documentos-storage.service';
import { DocumentosOficialesStorageService } from '../services/documentos-oficiales-storage.service';
import { NominasStorageService } from '../services/nominas-storage.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    NotificationsModule, // Provides NotificationsService
  ],
  controllers: [DocumentReviewController],
  providers: [
    ImapConnector,
    DocumentIngestionService,
    DocumentReviewService,
    DocumentDistributionService,
    EmailService,
    SentEmailsService, // Required by DocumentosSolicitadosService
    DocumentosSolicitadosService, // Required by EmpleadosService
    CarpetasDocumentosStorageService, // Required by EmpleadosService (R2 carpetas)
    DocumentosOficialesStorageService, // Required by DocumentIngestionService (R2)
    NominasStorageService, // Required by DocumentIngestionService (finiquito → Nominas R2)
    EmpleadosService,
  ],
  exports: [
    DocumentIngestionService,
    DocumentReviewService,
    DocumentDistributionService,
  ],
})
export class EmailIngestionModule {}
