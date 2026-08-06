import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { InformesFacturaConfigController } from '../controllers/informes-factura-config.controller';
import { InformePdfService } from '../services/informe-pdf.service';
import { EmailService } from '../services/email.service';
import { InformesFirmasStorageService } from '../services/informes-firmas-storage.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [InformesFacturaConfigController],
  providers: [InformePdfService, EmailService, InformesFirmasStorageService],
  exports: [InformePdfService, InformesFirmasStorageService],
})
export class InformesModule {}
