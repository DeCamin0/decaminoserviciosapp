import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PresupuestosV2Service } from './presupuestos-v2.service';
import {
  PresupuestosV2Controller,
  PresupuestosV2ConfigController,
} from './presupuestos-v2.controller';
import { CalculadoraV2Service } from './calculadora/calculadora-v2.service';
import { EmitirV2Service } from './emit/emitir-v2.service';
import { PresupuestosV2PdfService } from './pdf/presupuestos-v2-pdf.service';
import { PresupuestosV2StorageService } from './pdf/presupuestos-v2-storage.service';
import { PresupuestosV2ConfigAdminService } from './config/presupuestos-v2-config-admin.service';
import { ContenidoSeedService } from './config/contenido-seed.service';

@Module({
  imports: [PrismaModule],
  controllers: [PresupuestosV2Controller, PresupuestosV2ConfigController],
  providers: [
    PresupuestosV2Service,
    CalculadoraV2Service,
    EmitirV2Service,
    PresupuestosV2PdfService,
    PresupuestosV2StorageService,
    PresupuestosV2ConfigAdminService,
    ContenidoSeedService,
  ],
  exports: [
    PresupuestosV2Service,
    CalculadoraV2Service,
    EmitirV2Service,
    PresupuestosV2PdfService,
    PresupuestosV2ConfigAdminService,
  ],
})
export class PresupuestosV2Module {}
