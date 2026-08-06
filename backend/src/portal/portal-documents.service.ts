import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { PresupuestosGuardadosService } from '../services/presupuestos-guardados.service';
import { DocumentosOficialesStorageService } from '../services/documentos-oficiales-storage.service';
import { PortalDocumentsStorageService } from './portal-documents-storage.service';
import type { PortalAuthUserPayload } from './portal.types';

@Injectable()
export class PortalDocumentsService {
  private readonly logger = new Logger(PortalDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly presupuestosGuardadosService: PresupuestosGuardadosService,
    private readonly docsOficialesStorage: DocumentosOficialesStorageService,
    private readonly portalDocsStorage: PortalDocumentsStorageService,
  ) {}

  async listContratos(user: PortalAuthUserPayload) {
    const nif = user.nif?.trim();
    if (!nif) {
      return [];
    }
    const rows = await this.prisma.contratosClientes.findMany({
      where: { cliente_nif: nif },
      orderBy: { fecha_subida: 'desc' },
      select: {
        id: true,
        cliente_nif: true,
        tipo_contrato: true,
        fecha_subida: true,
        fecha_renovacion: true,
      },
    });
    return rows;
  }

  async getContratoPdfBuffer(
    user: PortalAuthUserPayload,
    contratoId: number,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const nif = user.nif?.trim();
    if (!nif) {
      throw new NotFoundException('Contrato no encontrado');
    }
    const row = await this.prisma.contratosClientes.findFirst({
      where: { id: contratoId, cliente_nif: nif },
      select: { archivo_base64: true, tipo_contrato: true },
    });
    if (!row?.archivo_base64) {
      throw new NotFoundException('Contrato no encontrado o sin archivo');
    }
    const b64 = String(row.archivo_base64).trim();
    if (!b64) {
      throw new NotFoundException('Contrato sin archivo');
    }
    let buffer: Buffer;
    try {
      buffer = Buffer.from(b64, 'base64');
    } catch {
      throw new NotFoundException('Archivo de contrato inválido');
    }
    const safe = (row.tipo_contrato || 'contrato').replace(/[^\w-]+/g, '_');
    return { buffer, filename: `contrato-${contratoId}-${safe}.pdf` };
  }

  async listPresupuestos(user: PortalAuthUserPayload) {
    const rows = await this.prisma.presupuestos_guardados.findMany({
      where: { cliente_id: user.cliente_id },
      orderBy: { updated_at: 'desc' },
      select: {
        id: true,
        nombre: true,
        numero_presupuesto: true,
        updated_at: true,
        firmas: {
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { created_at: true, pdf_path: true },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      numero_presupuesto: r.numero_presupuesto,
      updated_at: r.updated_at,
      tiene_firma: Boolean(r.firmas?.[0]),
      firma_at: r.firmas?.[0]?.created_at ?? null,
    }));
  }

  async getPresupuestoPdfBuffer(
    user: PortalAuthUserPayload,
    presupuestoId: number,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const p = await this.prisma.presupuestos_guardados.findFirst({
      where: { id: presupuestoId, cliente_id: user.cliente_id },
      select: { id: true },
    });
    if (!p) {
      throw new ForbiddenException('Presupuesto no disponible');
    }

    let buffer =
      await this.presupuestosGuardadosService.getSignedPdfBuffer(presupuestoId);
    if (buffer && buffer.length > 0) {
      return { buffer, filename: `presupuesto-${presupuestoId}-firmado.pdf` };
    }

    const pdfPath =
      await this.presupuestosGuardadosService.getSignedPdfPath(presupuestoId);
    if (!pdfPath) {
      throw new NotFoundException('No hay PDF firmado para este presupuesto');
    }
    const absolutePath = path.join(process.cwd(), pdfPath);
    if (!fs.existsSync(absolutePath)) {
      this.logger.warn(`[portal] PDF firmado no en disco: ${absolutePath}`);
      throw new NotFoundException('Archivo PDF no encontrado');
    }
    buffer = await fs.promises.readFile(absolutePath);
    return { buffer, filename: `presupuesto-${presupuestoId}-firmado.pdf` };
  }

  async listDocumentosGenerales() {
    return this.prisma.portalDocumentoGeneral.findMany({
      where: { estado: 'activo' },
      orderBy: { fecha_subida: 'desc' },
      select: {
        id: true,
        tipo_documento: true,
        nombre_documento: true,
        mime_type: true,
        fecha_subida: true,
        fecha_validez: true,
      },
    });
  }

  async getDocumentoGeneralPdfBuffer(id: number): Promise<{
    buffer: Buffer;
    filename: string;
    mime: string;
  }> {
    const row = await this.prisma.portalDocumentoGeneral.findFirst({
      where: { id, estado: 'activo' },
      select: {
        id: true,
        nombre_documento: true,
        mime_type: true,
        storage_key: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Documento no encontrado');
    }
    const buffer = await this.portalDocsStorage.resolveArchivo(row);
    const mime = row.mime_type?.trim() || 'application/pdf';
    const name = row.nombre_documento || `documento-${id}`;
    const safe = name.replace(/[^\w\-.]+/g, '_').slice(0, 120);
    return { buffer, filename: `${safe}`, mime };
  }

  async listFacturasManuales(user: PortalAuthUserPayload) {
    return this.prisma.clienteFacturaManual.findMany({
      where: { cliente_id: user.cliente_id },
      orderBy: { fecha_emision: 'desc' },
      select: {
        id: true,
        numero_factura: true,
        nombre_archivo: true,
        fecha_emision: true,
        fecha_vencimiento: true,
        importe: true,
        estado: true,
      },
    });
  }

  async getFacturaManualPdfBuffer(
    user: PortalAuthUserPayload,
    id: number,
  ): Promise<{ buffer: Buffer; filename: string; mime: string }> {
    const row = await this.prisma.clienteFacturaManual.findFirst({
      where: { id, cliente_id: user.cliente_id },
      select: {
        nombre_archivo: true,
        mime_type: true,
        storage_key: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Factura no encontrada');
    }
    const buffer = await this.portalDocsStorage.resolveArchivo(row);
    const mime = row.mime_type?.trim() || 'application/pdf';
    return { buffer, filename: row.nombre_archivo, mime };
  }

  async listInspecciones(user: PortalAuthUserPayload) {
    return this.prisma.clienteInspeccionDocumento.findMany({
      where: { cliente_id: user.cliente_id, estado: 'activo' },
      orderBy: { fecha_informe: 'desc' },
      select: {
        id: true,
        titulo: true,
        centro_trabajo: true,
        nombre_archivo: true,
        fecha_informe: true,
      },
    });
  }

  async getInspeccionPdfBuffer(
    user: PortalAuthUserPayload,
    id: number,
  ): Promise<{ buffer: Buffer; filename: string; mime: string }> {
    const row = await this.prisma.clienteInspeccionDocumento.findFirst({
      where: { id, cliente_id: user.cliente_id, estado: 'activo' },
      select: {
        nombre_archivo: true,
        mime_type: true,
        storage_key: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Informe no encontrado');
    }
    const buffer = await this.portalDocsStorage.resolveArchivo(row);
    const mime = row.mime_type?.trim() || 'application/pdf';
    return { buffer, filename: row.nombre_archivo, mime };
  }

  /**
   * Misma idea que `normalizeCentroPortalNeedle` pero solo con separadores típicos
   * que también quitamos en SQL (espacios, guiones, puntos, etc.) para que coincida
   * con `REPLACE(UPPER(TRIM(...)))` en base de datos.
   */
  private normalizeCentroPortalNeedle(s?: string | null): string | null {
    if (!s?.trim()) return null;
    let t = String(s)
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    t = t.replace(/[-.,/\\|:;'"`´]+/g, '').replace(/\s+/g, '');
    t = t.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 200);
    if (t.length < 2) return null;
    return t;
  }

  /** Expresión MySQL alineada con `normalizeCentroPortalNeedle` (quita separadores habituales). */
  private static readonly sqlExprCentroTrabajoNorm = Prisma.raw(
    "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(TRIM(de.`CENTRO TRABAJO`)),' ',''),'-',''),'.',''),',',''),'/',''),'_','')",
  );

  /** Trocea «A - B - C» en variantes útiles para LIKE / igualdad. */
  private expandClientCentroAliases(s?: string | null): string[] {
    const t = String(s || '').trim();
    if (t.length < 2) return [];
    const parts = new Set<string>([t]);
    for (const seg of t.split(/\s*-\s*/)) {
      const p = seg.trim();
      if (p.length >= 3) parts.add(p);
    }
    return [...parts];
  }

  /**
   * Solo `DatosEmpleados`: empleados cuyo `CENTRO TRABAJO` coincide con el cliente
   * del portal (razón social, NIF, servicio entrega) por igualdad, LIKE o clave normalizada.
   * No usa cuadrante ni horario_multicentro.
   */
  async listTrabajadoresComunidad(user: PortalAuthUserPayload) {
    const codigos = new Set<string>();

    const cliente = await this.prisma.clientes.findFirst({
      where: { id: user.cliente_id },
      select: {
        NOMBRE_O_RAZON_SOCIAL: true,
        NIF: true,
        SERVICIO_ENTREGA: true,
      },
    });

    const rawStrings = new Set<string>();
    const pushRaw = (v?: string | null) => {
      for (const x of this.expandClientCentroAliases(v)) {
        if (x.length >= 2) rawStrings.add(x);
      }
    };
    pushRaw(cliente?.NOMBRE_O_RAZON_SOCIAL);
    pushRaw(cliente?.NIF);
    pushRaw(cliente?.SERVICIO_ENTREGA);
    pushRaw(user.clienteNombre);
    pushRaw(user.nif);

    const normStrings = new Set<string>();
    const addNorm = (v?: string | null) => {
      const n = this.normalizeCentroPortalNeedle(v);
      if (n) normStrings.add(n);
    };
    addNorm(cliente?.NOMBRE_O_RAZON_SOCIAL);
    addNorm(cliente?.NIF);
    addNorm(cliente?.SERVICIO_ENTREGA);
    addNorm(user.clienteNombre);
    addNorm(user.nif);
    for (const r of rawStrings) addNorm(r);

    const orParts: Prisma.Sql[] = [];
    const colNorm = PortalDocumentsService.sqlExprCentroTrabajoNorm;

    for (const raw of rawStrings) {
      orParts.push(Prisma.sql`TRIM(de.\`CENTRO TRABAJO\`) = ${raw}`);
      const likePat = `%${raw}%`;
      orParts.push(Prisma.sql`TRIM(de.\`CENTRO TRABAJO\`) LIKE ${likePat}`);
    }
    for (const norm of normStrings) {
      const likeNorm = `%${norm}%`;
      orParts.push(Prisma.sql`(${colNorm}) = ${norm}`);
      orParts.push(Prisma.sql`(${colNorm}) LIKE ${likeNorm}`);
      orParts.push(Prisma.sql`${norm} LIKE CONCAT('%', (${colNorm}), '%')`);
    }

    if (orParts.length === 0) {
      return [];
    }

    const orSql = Prisma.join(orParts, ' OR ');
    const rowsDatos = await this.prisma.$queryRaw<
      { codigo: string }[]
    >(Prisma.sql`
      SELECT DISTINCT TRIM(CAST(de.CODIGO AS CHAR)) AS codigo
      FROM DatosEmpleados de
      WHERE de.CODIGO IS NOT NULL
        AND TRIM(COALESCE(de.\`CENTRO TRABAJO\`, '')) <> ''
        AND (${orSql})
    `);
    for (const r of rowsDatos) {
      const c = String(r.codigo || '').trim();
      if (c) codigos.add(c);
    }

    const lista = [...codigos];
    if (lista.length === 0) {
      return [];
    }

    const empleados = await this.prisma.user.findMany({
      where: { CODIGO: { in: lista } },
      select: {
        CODIGO: true,
        NOMBRE_APELLIDOS: true,
        GRUPO: true,
        ESTADO: true,
        CENTRO_TRABAJO: true,
      },
      orderBy: { NOMBRE_APELLIDOS: 'asc' },
    });
    return empleados
      .filter((e) => {
        const st = String(e.ESTADO || '')
          .trim()
          .toUpperCase();
        return st === 'ACTIVO';
      })
      .map((e) => ({
        codigo: e.CODIGO,
        nombre: e.NOMBRE_APELLIDOS?.trim() || e.CODIGO,
        grupo: e.GRUPO?.trim() || null,
        estado: e.ESTADO?.trim() || null,
        centro_trabajo: e.CENTRO_TRABAJO?.trim() || null,
      }));
  }

  private static permissoEmpleadoSi(v: string | null | undefined): boolean {
    return (
      String(v || '')
        .trim()
        .toUpperCase() === 'SI'
    );
  }

  private static tipoEsContratoLaboralEmpleado(
    tipo: string | null | undefined,
  ): boolean {
    return String(tipo || '')
      .toUpperCase()
      .includes('CONTRATO');
  }

  private static resolveDocCodigoEmpleado(d: {
    id: string;
    detected_empleado_id: string | null;
    confirmed_empleado_id: string | null;
  }): string | null {
    for (const c of [d.confirmed_empleado_id, d.detected_empleado_id, d.id]) {
      const t = String(c || '').trim();
      if (t.length > 0 && t.toUpperCase() !== 'PENDING') {
        return t;
      }
    }
    return null;
  }

  private mimeFromNombreArchivo(nombre: string): string {
    return this.docsOficialesStorage.guessContentType(nombre);
  }

  /**
   * Contratos laborales en `DocumentosOficiales` con permiso al empleado,
   * solo si ese CODIGO está entre el personal de la comunidad (portal).
   */
  async listContratosEmpleadosPortal(user: PortalAuthUserPayload) {
    const workers = await this.listTrabajadoresComunidad(user);
    const codigoSet = new Set(
      workers.map((w) => String(w.codigo || '').trim()).filter((c) => c.length),
    );
    if (codigoSet.size === 0) {
      return [];
    }
    const codigos = [...codigoSet];
    const docs = await this.prisma.documentosOficiales.findMany({
      where: {
        storage_key: { not: null },
        OR: [
          { id: { in: codigos } },
          { detected_empleado_id: { in: codigos } },
          { confirmed_empleado_id: { in: codigos } },
        ],
      },
      select: {
        doc_id: true,
        id: true,
        detected_empleado_id: true,
        confirmed_empleado_id: true,
        tipo_documento: true,
        nombre_archivo: true,
        Permisso_Para_Empleado: true,
        storage_key: true,
      },
      orderBy: { doc_id: 'desc' },
    });
    const out: {
      doc_id: number;
      codigo_empleado: string;
      tipo_documento: string | null;
      nombre_archivo: string | null;
    }[] = [];
    for (const d of docs) {
      if (
        !PortalDocumentsService.permissoEmpleadoSi(d.Permisso_Para_Empleado)
      ) {
        continue;
      }
      if (
        !PortalDocumentsService.tipoEsContratoLaboralEmpleado(d.tipo_documento)
      ) {
        continue;
      }
      const codigo = PortalDocumentsService.resolveDocCodigoEmpleado(d);
      if (!codigo || !codigoSet.has(codigo)) {
        continue;
      }
      out.push({
        doc_id: d.doc_id,
        codigo_empleado: codigo,
        tipo_documento: d.tipo_documento,
        nombre_archivo: d.nombre_archivo,
      });
    }
    return out;
  }

  async getEmpleadoContratoPortalBuffer(
    user: PortalAuthUserPayload,
    docId: number,
  ): Promise<{ buffer: Buffer; filename: string; mime: string }> {
    const workers = await this.listTrabajadoresComunidad(user);
    const codigoSet = new Set(
      workers.map((w) => String(w.codigo || '').trim()).filter((c) => c.length),
    );
    if (codigoSet.size === 0) {
      throw new NotFoundException('Documento no encontrado');
    }
    const row = await this.prisma.documentosOficiales.findFirst({
      where: { doc_id: docId },
      select: {
        doc_id: true,
        id: true,
        detected_empleado_id: true,
        confirmed_empleado_id: true,
        tipo_documento: true,
        nombre_archivo: true,
        Permisso_Para_Empleado: true,
        storage_key: true,
      },
    });
    if (!row?.storage_key) {
      throw new NotFoundException('Documento no encontrado o sin archivo');
    }
    const codigo = PortalDocumentsService.resolveDocCodigoEmpleado(row);
    if (!codigo || !codigoSet.has(codigo)) {
      throw new ForbiddenException('No autorizado para este documento');
    }
    if (
      !PortalDocumentsService.permissoEmpleadoSi(row.Permisso_Para_Empleado)
    ) {
      throw new ForbiddenException('Documento no visible para el empleado');
    }
    if (
      !PortalDocumentsService.tipoEsContratoLaboralEmpleado(row.tipo_documento)
    ) {
      throw new ForbiddenException('Tipo de documento no permitido en portal');
    }
    const buffer = await this.docsOficialesStorage.resolveArchivo(row);
    const nombre =
      row.nombre_archivo?.trim() || `contrato-empleado-${docId}.pdf`;
    const safe = nombre.replace(/[^\w.-]+/g, '_').slice(0, 180);
    const mime = this.mimeFromNombreArchivo(safe);
    return { buffer, filename: safe, mime };
  }

  /** Panel interno: listado sin bytes del archivo. */
  adminListDocumentosGenerales(estado?: string) {
    const where = estado && estado.trim() ? { estado: estado.trim() } : {};
    return this.prisma.portalDocumentoGeneral.findMany({
      where,
      orderBy: { fecha_subida: 'desc' },
      select: {
        id: true,
        tipo_documento: true,
        nombre_documento: true,
        mime_type: true,
        fecha_subida: true,
        fecha_validez: true,
        estado: true,
        created_by: true,
      },
    });
  }

  async adminGetDocumentoGeneralArchivoAnyEstado(id: number): Promise<{
    buffer: Buffer;
    filename: string;
    mime: string;
  }> {
    const row = await this.prisma.portalDocumentoGeneral.findFirst({
      where: { id },
      select: {
        id: true,
        nombre_documento: true,
        mime_type: true,
        storage_key: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Documento no encontrado');
    }
    const buffer = await this.portalDocsStorage.resolveArchivo(row);
    const mime = row.mime_type?.trim() || 'application/pdf';
    const name = row.nombre_documento || `documento-${id}`;
    const safe = name.replace(/[^\w\-.]+/g, '_').slice(0, 120);
    return { buffer, filename: safe, mime };
  }

  /**
   * Sube documentación general. Si `reemplazar` es true, los activos del mismo
   * `tipo_documento` pasan a estado `historico` (histórico de versiones).
   */
  async adminCreateDocumentoGeneral(params: {
    tipo_documento: string;
    nombre_documento: string;
    buffer: Buffer;
    mime_type: string | null;
    fecha_validez: Date | null;
    created_by: string | null;
    reemplazar_version_anterior: boolean;
  }) {
    const tipo = params.tipo_documento?.trim();
    const nombre = params.nombre_documento?.trim();
    if (!tipo || !nombre) {
      throw new BadRequestException(
        'tipo_documento y nombre_documento son obligatorios',
      );
    }
    if (!params.buffer?.length) {
      throw new BadRequestException('Archivo vacío');
    }

    const mime = params.mime_type?.trim() || 'application/pdf';
    const put = await this.portalDocsStorage.putGeneral(
      params.buffer,
      nombre,
      mime,
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        if (params.reemplazar_version_anterior) {
          await tx.portalDocumentoGeneral.updateMany({
            where: { tipo_documento: tipo, estado: 'activo' },
            data: { estado: 'historico' },
          });
        }
        await tx.portalDocumentoGeneral.create({
          data: {
            tipo_documento: tipo,
            nombre_documento: nombre,
            mime_type: mime,
            storage_key: put.storage_key,
            storage_bucket: put.storage_bucket,
            tamano_bytes: put.tamano_bytes,
            fecha_validez: params.fecha_validez,
            estado: 'activo',
            created_by: params.created_by,
          },
        });
      });
    } catch (err) {
      await this.portalDocsStorage.deleteObjectIfAny(put.storage_key);
      throw err;
    }
    return { ok: true as const };
  }

  async adminSetEstadoDocumentoGeneral(id: number, estado: string) {
    const e = estado?.trim();
    if (!e || e.length > 50) {
      throw new BadRequestException('estado no válido');
    }
    const row = await this.prisma.portalDocumentoGeneral.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Documento no encontrado');
    }
    await this.prisma.portalDocumentoGeneral.update({
      where: { id },
      data: { estado: e },
    });
    return { ok: true as const };
  }
}
