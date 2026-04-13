import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { PortalJwtAuthGuard } from './portal-jwt.guard';
import { PortalJwtOrSelectGuard } from './portal-jwt-or-select.guard';
import { PortalUser } from './portal-user.decorator';
import type { PortalAuthUserPayload } from './portal.types';
import { PortalDocumentsService } from './portal-documents.service';

@Controller('api/portal')
export class PortalClienteController {
  constructor(private readonly portalDocuments: PortalDocumentsService) {}

  @Get('me')
  @UseGuards(PortalJwtAuthGuard)
  me(@PortalUser() user: PortalAuthUserPayload) {
    return {
      success: true,
      data: {
        contacto_id: user.contacto_id,
        cliente_id: user.cliente_id,
        nombre: user.nombre,
        email: user.email,
        comunidad: user.clienteNombre,
        nif: user.nif,
      },
    };
  }

  @Get('trabajadores')
  @UseGuards(PortalJwtAuthGuard)
  trabajadores(@PortalUser() user: PortalAuthUserPayload) {
    return this.portalDocuments
      .listTrabajadoresComunidad(user)
      .then((data) => ({
        success: true,
        data,
      }));
  }

  /** Contratos laborales (DocumentosOficiales) visibles para el empleado, solo personal de la comunidad. */
  @Get('empleados/contratos')
  @UseGuards(PortalJwtAuthGuard)
  empleadosContratos(@PortalUser() user: PortalAuthUserPayload) {
    return this.portalDocuments
      .listContratosEmpleadosPortal(user)
      .then((data) => ({
        success: true,
        data,
      }));
  }

  @Get('empleados/contratos/:docId/pdf')
  @UseGuards(PortalJwtAuthGuard)
  async empleadoContratoPdf(
    @PortalUser() user: PortalAuthUserPayload,
    @Param('docId', ParseIntPipe) docId: number,
    @Res() res: Response,
  ) {
    const { buffer, filename, mime } =
      await this.portalDocuments.getEmpleadoContratoPortalBuffer(user, docId);
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(buffer);
  }

  @Get('contratos')
  @UseGuards(PortalJwtAuthGuard)
  contratos(@PortalUser() user: PortalAuthUserPayload) {
    return this.portalDocuments.listContratos(user).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('contratos/:id/pdf')
  @UseGuards(PortalJwtAuthGuard)
  async contratoPdf(
    @PortalUser() user: PortalAuthUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { buffer, filename } =
      await this.portalDocuments.getContratoPdfBuffer(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(buffer);
  }

  @Get('presupuestos')
  @UseGuards(PortalJwtAuthGuard)
  presupuestos(@PortalUser() user: PortalAuthUserPayload) {
    return this.portalDocuments.listPresupuestos(user).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('presupuestos/:id/pdf-firmado')
  @UseGuards(PortalJwtAuthGuard)
  async presupuestoPdfFirmado(
    @PortalUser() user: PortalAuthUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { buffer, filename } =
      await this.portalDocuments.getPresupuestoPdfBuffer(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(buffer);
  }

  @Get('documentos/generales')
  @UseGuards(PortalJwtOrSelectGuard)
  documentosGenerales() {
    return this.portalDocuments.listDocumentosGenerales().then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('documentos/generales/:id/archivo')
  @UseGuards(PortalJwtOrSelectGuard)
  async documentoGeneralArchivo(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { buffer, filename, mime } =
      await this.portalDocuments.getDocumentoGeneralPdfBuffer(id);
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(buffer);
  }

  @Get('facturas')
  @UseGuards(PortalJwtAuthGuard)
  facturas(@PortalUser() user: PortalAuthUserPayload) {
    return this.portalDocuments.listFacturasManuales(user).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('facturas/:id/archivo')
  @UseGuards(PortalJwtAuthGuard)
  async facturaArchivo(
    @PortalUser() user: PortalAuthUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { buffer, filename, mime } =
      await this.portalDocuments.getFacturaManualPdfBuffer(user, id);
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(buffer);
  }

  @Get('inspecciones')
  @UseGuards(PortalJwtAuthGuard)
  inspecciones(@PortalUser() user: PortalAuthUserPayload) {
    return this.portalDocuments.listInspecciones(user).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('inspecciones/:id/archivo')
  @UseGuards(PortalJwtAuthGuard)
  async inspeccionArchivo(
    @PortalUser() user: PortalAuthUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { buffer, filename, mime } =
      await this.portalDocuments.getInspeccionPdfBuffer(user, id);
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(buffer);
  }
}
