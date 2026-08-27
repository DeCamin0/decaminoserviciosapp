import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  Res,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PresupuestosV2Service } from './presupuestos-v2.service';
import { PresupuestosV2PdfService } from './pdf/presupuestos-v2-pdf.service';
import { PresupuestosV2ConfigAdminService } from './config/presupuestos-v2-config-admin.service';
import { StorageService } from '../storage/storage.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/v2/presupuestos')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class PresupuestosV2Controller {
  constructor(
    private readonly service: PresupuestosV2Service,
    private readonly pdfService: PresupuestosV2PdfService,
  ) {}

  @Get()
  async list(@Request() req: any) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.listPresupuestos();
    return { success: true, data };
  }

  @Get(':id')
  async getOne(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.getPresupuesto(id);
    return { success: true, data };
  }

  @Post()
  async create(
    @Request() req: any,
    @Body()
    body: {
      cliente_id?: number | null;
      brand_id?: number | null;
      servicio_ids?: number[];
    },
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.createBorrador(req.user, {
      cliente_id: body.cliente_id ?? null,
      brand_id: body.brand_id ?? null,
      servicio_ids: body.servicio_ids ?? [],
    });
    return { success: true, data };
  }

  @Put(':id')
  async update(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      cliente_id?: number | null;
      brand_id?: number;
      servicio_ids?: number[];
    },
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.updateBorrador(req.user, id, body);
    return { success: true, data };
  }

  @Post(':id/calcular')
  async calcular(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      lineas?: Array<{
        servicio_comercial_id: number;
        opcion_id?: number;
        inputs?: Record<string, unknown>;
      }>;
      persist?: boolean;
    },
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.calcularPresupuesto(
      req.user,
      id,
      body || {},
    );
    return { success: true, data };
  }

  @Post(':id/emitir')
  async emitir(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { confirm_changed_totals?: boolean },
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.emitirPresupuesto(req.user, id, {
      confirm_changed_totals: Boolean(body?.confirm_changed_totals),
    });
    return { success: true, data };
  }

  @Post(':id/nueva-version')
  async nuevaVersion(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.crearNuevaVersion(req.user, id);
    return { success: true, data };
  }

  @Post(':id/lineas/:lineaId/opciones')
  async addOpcion(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('lineaId', ParseIntPipe) lineaId: number,
    @Body()
    body: {
      etiqueta?: string;
      source_opcion_id?: number;
      seleccion_tipo?: string;
    },
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.addVariante(
      req.user,
      id,
      lineaId,
      body || {},
    );
    return { success: true, data };
  }

  @Put(':id/opciones/:opcionId')
  async updateOpcion(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('opcionId', ParseIntPipe) opcionId: number,
    @Body()
    body: {
      etiqueta?: string;
      seleccion_tipo?: string;
      descripcion_local?: string | null;
      orden?: number;
      inputs?: Record<string, unknown>;
      jornada?: unknown;
    },
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.updateOpcion(
      req.user,
      id,
      opcionId,
      body || {},
    );
    return { success: true, data };
  }

  @Put(':id/servicios-digitales')
  async updateDigitales(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { servicios_digitales?: unknown },
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.updateServiciosDigitales(
      req.user,
      id,
      body?.servicios_digitales ?? body,
    );
    return { success: true, data };
  }

  @Put(':id/descuento-fidelidad')
  async updateDescuentoFidelidad(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { descuento_fidelidad_pct?: unknown },
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.updateDescuentoFidelidad(
      req.user,
      id,
      body?.descuento_fidelidad_pct,
    );
    return { success: true, data };
  }

  @Put(':id/lineas/:lineaId/contenido')
  async updateLineaContenido(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('lineaId', ParseIntPipe) lineaId: number,
    @Body() body: { contenido_comercial?: unknown },
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.updateLineaContenido(
      req.user,
      id,
      lineaId,
      body?.contenido_comercial ?? body,
    );
    return { success: true, data };
  }

  @Post(':id/lineas/:lineaId/contenido/restaurar')
  async restoreLineaContenido(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('lineaId', ParseIntPipe) lineaId: number,
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.restoreLineaContenido(
      req.user,
      id,
      lineaId,
    );
    return { success: true, data };
  }

  @Post(':id/opciones/:opcionId/duplicar')
  async duplicateOpcion(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('opcionId', ParseIntPipe) opcionId: number,
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.duplicateOpcion(req.user, id, opcionId);
    return { success: true, data };
  }

  @Delete(':id/opciones/:opcionId')
  async deleteOpcion(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('opcionId', ParseIntPipe) opcionId: number,
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.deleteOpcion(req.user, id, opcionId);
    return { success: true, data };
  }

  @Put(':id/lineas/:lineaId/opciones/orden')
  async reorderOpciones(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('lineaId', ParseIntPipe) lineaId: number,
    @Body() body: { orden_ids?: number[] },
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.reorderOpciones(
      req.user,
      id,
      lineaId,
      body?.orden_ids || [],
    );
    return { success: true, data };
  }

  /** PDF preview for BORRADOR (watermark). Always regenerated from working data. */
  @Get(':id/pdf-preview')
  async pdfPreview(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    await this.service.assertCanAccess(req.user);
    const { buffer, filename, contentType } =
      await this.pdfService.generatePreviewPdf(req.user, id);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }

  /** Official PDF for EMITIDO — stored once from snapshot, then served from R2. */
  @Get(':id/pdf')
  async pdfEmitido(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Query('regen') regen: string | undefined,
    @Res() res: Response,
  ) {
    await this.service.assertCanAccess(req.user);
    const { buffer, filename, contentType } =
      await this.pdfService.getOrCreateEmitidoPdf(req.user, id, {
        forceNewVersion: regen === '1' || regen === 'true',
      });
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('X-Presupuesto-V2-Pdf', '1');
    res.send(buffer);
  }

  @Post(':id/cliente/refresh')
  async refreshCliente(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.refreshCliente(req.user, id);
    return { success: true, data };
  }

  @Put(':id/cliente/overrides')
  async clienteOverrides(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.updateClienteOverrides(
      req.user,
      id,
      body || {},
    );
    return { success: true, data };
  }

  @Get(':id/cliente')
  async clienteStatus(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.getClienteStatus(id);
    return { success: true, data };
  }

  @Put(':id/lineas/:servicioId')
  async updateLinea(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('servicioId', ParseIntPipe) servicioId: number,
    @Body()
    body: {
      inputs: Record<string, unknown>;
      recalcular?: boolean;
      opcion_id?: number;
    },
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.updateLineaInputs(
      req.user,
      id,
      servicioId,
      body.inputs || {},
      body.recalcular !== false,
      body.opcion_id,
    );
    return { success: true, data };
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.deleteBorrador(id);
    return data;
  }
}

@Controller('api/v2/config')
@UseGuards(JwtAuthGuard)
/** Config panel loads ~8 endpoints on mount; unstable FE deps used to loop → 429. Skip global throttle. */
@SkipThrottle()
export class PresupuestosV2ConfigController {
  constructor(
    private readonly service: PresupuestosV2Service,
    private readonly configAdmin: PresupuestosV2ConfigAdminService,
    private readonly storage: StorageService,
  ) {}

  @Get('motores')
  async listMotores(@Request() req: any) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.listMotores(true);
    return { success: true, data };
  }

  @Get('motores/:codigo/schema')
  async motorSchema(@Request() req: any, @Param('codigo') codigo: string) {
    await this.service.assertCanAccess(req.user);
    const data = this.service.getMotorSchema(codigo);
    return { success: true, data };
  }

  @Get('parametros')
  async listParametros(@Request() req: any) {
    await this.service.assertCanConfig(req.user);
    const data = await this.configAdmin.listParametros();
    return { success: true, data };
  }

  @Put('parametros/:clave')
  async updateParametro(
    @Request() req: any,
    @Param('clave') clave: string,
    @Body() body: { valor_display: number },
  ) {
    await this.service.assertCanConfig(req.user);
    const data = await this.configAdmin.updateParametro(
      req.user,
      clave,
      Number(body?.valor_display),
    );
    return { success: true, data };
  }

  @Get('parametros-audit')
  async parametrosAudit(@Request() req: any, @Query('clave') clave?: string) {
    await this.service.assertCanConfig(req.user);
    const data = await this.configAdmin.listParamAudit(clave);
    return { success: true, data };
  }

  @Get('companies')
  async listCompanies(@Request() req: any) {
    await this.service.assertCanConfig(req.user);
    const data = await this.configAdmin.listCompanies();
    return { success: true, data };
  }

  @Put('companies/:id')
  async updateCompany(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    await this.service.assertCanConfig(req.user);
    const data = await this.configAdmin.updateCompany(req.user, id, body || {});
    return { success: true, data };
  }

  @Get('brands')
  async listBrands(@Request() req: any) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.listBrands();
    return { success: true, data };
  }

  @Put('brands/:id')
  async updateBrand(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    await this.service.assertCanConfig(req.user);
    const data = await this.configAdmin.updateBrand(req.user, id, {
      nombre: body?.nombre,
      logo_ref: body?.logo_ref,
      activo: body?.activo,
      config: body?.config,
    });
    return { success: true, data };
  }

  @Put('brands/:id/logo-ref')
  async updateBrandLogoRef(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { logo_ref: string | null },
  ) {
    await this.service.assertCanConfig(req.user);
    const data = await this.configAdmin.updateBrand(req.user, id, {
      logo_ref: body?.logo_ref ?? null,
    });
    return { success: true, data };
  }

  @Post('brands/:id/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 3 * 1024 * 1024 },
    }),
  )
  async uploadBrandLogo(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.service.assertCanConfig(req.user);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Falta el archivo de logo');
    }
    const data = await this.configAdmin.uploadBrandLogo(req.user, id, {
      buffer: file.buffer,
      originalname: file.originalname || 'logo.png',
      mimetype: file.mimetype || 'image/png',
    });
    return { success: true, data };
  }

  @Delete('brands/:id/logo')
  async clearBrandLogo(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.assertCanConfig(req.user);
    const data = await this.configAdmin.updateBrand(req.user, id, {
      logo_ref: null,
    });
    return { success: true, data };
  }

  @Get('brands/:id/logo')
  async getBrandLogo(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    await this.service.assertCanAccess(req.user);
    const brand = await this.service.getBrand(id);
    const ref = brand?.logo_ref;
    if (!ref) {
      throw new BadRequestException('La marca no tiene logo');
    }
    // Local asset
    const localCandidates = [
      path.isAbsolute(ref) ? ref : null,
      path.join(process.cwd(), 'assets', ref),
      path.join(process.cwd(), ref),
    ].filter(Boolean) as string[];
    for (const p of localCandidates) {
      if (fs.existsSync(p) && /\.(png|jpe?g|webp)$/i.test(p)) {
        res.setHeader('Cache-Control', 'private, max-age=60');
        return res.sendFile(path.resolve(p));
      }
    }
    if (this.storage.isEnabled()) {
      try {
        const obj = await this.storage.get(ref);
        const buf = Buffer.isBuffer(obj.body)
          ? obj.body
          : Buffer.from(obj.body as any);
        res.setHeader('Content-Type', obj.contentType || 'image/png');
        res.setHeader('Cache-Control', 'private, max-age=60');
        return res.send(buf);
      } catch {
        /* fallthrough */
      }
    }
    throw new BadRequestException('No se pudo cargar el logo');
  }

  @Get('series')
  async listSeries(@Request() req: any) {
    await this.service.assertCanConfig(req.user);
    const data = await this.service.listSeries();
    return { success: true, data };
  }

  @Get('series/presets')
  async seriePresets(@Request() req: any) {
    await this.service.assertCanConfig(req.user);
    return { success: true, data: this.configAdmin.listSeriePresets() };
  }

  @Post('series/preview')
  async seriePreview(@Request() req: any, @Body() body: any) {
    await this.service.assertCanConfig(req.user);
    try {
      const data = this.configAdmin.previewSerie(body || {});
      return { success: true, data };
    } catch (e: any) {
      throw new BadRequestException(e.message || 'Preview inválido');
    }
  }

  @Put('series/:id')
  async updateSerie(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    await this.service.assertCanConfig(req.user);
    const data = await this.configAdmin.updateSerie(req.user, id, body || {});
    return { success: true, data };
  }

  @Get('servicios-comerciales')
  async listServicios(
    @Request() req: any,
    @Query('activos') activos?: string,
    @Query('brand_id') brandId?: string,
  ) {
    await this.service.assertCanAccess(req.user);
    const data = await this.service.listServicios({
      activos: activos === '1' || activos === 'true',
      brandId: brandId ? Number(brandId) : undefined,
    });
    return { success: true, data };
  }

  @Get('servicios-comerciales/:id')
  async getServicio(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.assertCanConfig(req.user);
    const data = await this.service.getServicio(id);
    return { success: true, data };
  }

  @Post('servicios-comerciales')
  async createServicio(@Request() req: any, @Body() body: any) {
    await this.service.assertCanConfig(req.user);
    const data = await this.service.createServicio(body);
    return { success: true, data };
  }

  @Put('servicios-comerciales/:id')
  async updateServicio(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    await this.service.assertCanConfig(req.user);
    const data = await this.service.updateServicio(id, body);
    return { success: true, data };
  }

  @Get('contenido-bloques')
  async listBloques(@Request() req: any) {
    await this.service.assertCanConfig(req.user);
    const data = await this.configAdmin.listBloques();
    return { success: true, data };
  }

  @Put('contenido-bloques/:id')
  async updateBloque(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    await this.service.assertCanConfig(req.user);
    const data = await this.configAdmin.updateBloque(req.user, id, body || {});
    return { success: true, data };
  }
}
