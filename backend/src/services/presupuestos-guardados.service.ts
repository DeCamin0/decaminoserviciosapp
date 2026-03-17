import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PresupuestoGuardadoDto {
  id?: number;
  nombre: string;
  cliente_id?: number | null;
  cliente_nombre?: string | null;
  numero_presupuesto?: string | null;
  payload: Record<string, unknown>;
  created_by?: string | null;
  created_at?: Date;
  updated_at?: Date;
  /** Si el presupuesto fue firmado: fecha/hora de la firma (ISO string del formulario). */
  firma_fecha?: string | null;
  /** Si el presupuesto fue firmado: fecha de registro en BD. */
  firma_at?: Date | null;
  /** Ruta relativa del PDF firmado (el que se envía por email), si existe. */
  firma_pdf_path?: string | null;
}

/** Extrae texto plano del nombre (puede venir con HTML de Quill). */
function servicioNombreTexto(nombre: unknown): string {
  if (nombre == null) return '';
  const s = String(nombre).trim();
  if (s.startsWith('<')) return s.replace(/<[^>]*>/g, '').trim();
  return s;
}

/** Formato: "{prefix} - PRESUPUESTO YYYY - cliente - servicios". prefix din company.legalNameShort (Decamino/HERA). */
function buildNombrePresupuesto(
  clienteNombre: string | null | undefined,
  payload: Record<string, unknown>,
  prefix: string = 'DE CAMINO',
): string {
  const year = new Date().getFullYear();
  const clientePart = (clienteNombre || '').trim() || 'Cliente';
  const servicios =
    (payload?.selectedServiciosPresupuesto as Array<{ nombre?: unknown }>) ||
    [];
  const serviciosPart =
    servicios.length > 0
      ? servicios.map((s) => servicioNombreTexto(s?.nombre)).join(', ')
      : 'Servicios';
  const p = (prefix && String(prefix).trim()) || 'DE CAMINO';
  return `${p} - PRESUPUESTO ${year} - ${clientePart} - ${serviciosPart}`;
}

@Injectable()
export class PresupuestosGuardadosService {
  private readonly logger = new Logger(PresupuestosGuardadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async findAll(): Promise<PresupuestoGuardadoDto[]> {
    const rows = await this.prisma.presupuestos_guardados.findMany({
      orderBy: { updated_at: 'desc' },
      include: {
        firmas: {
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { fecha_hora: true, created_at: true, pdf_path: true },
        },
      },
    });
    return rows.map((r) => {
      const ultimaFirma = (r as any).firmas?.[0];
      return {
        id: r.id,
        nombre: r.nombre,
        cliente_id: r.cliente_id,
        cliente_nombre: r.cliente_nombre,
        numero_presupuesto: r.numero_presupuesto,
        payload: r.payload as Record<string, unknown>,
        created_by: r.created_by,
        created_at: r.created_at,
        updated_at: r.updated_at,
        firma_fecha: ultimaFirma?.fecha_hora ?? null,
        firma_at: ultimaFirma?.created_at ?? null,
        firma_pdf_path: ultimaFirma?.pdf_path ?? null,
      };
    });
  }

  /** Devuelve el buffer del PDF firmado si está guardado en BD (pdf_content). */
  async getSignedPdfBuffer(presupuestoId: number): Promise<Buffer | null> {
    const firma = await this.prisma.presupuestos_firmas.findFirst({
      where: { presupuesto_id: presupuestoId },
      orderBy: { created_at: 'desc' },
      select: { pdf_content: true },
    });
    const raw = firma?.pdf_content;
    if (!raw || (Array.isArray(raw) && raw.length === 0)) return null;
    return Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  }

  /** Devuelve la ruta relativa del PDF firmado (fichero en disco) si existe. Fallback cuando no hay pdf_content en BD. */
  async getSignedPdfPath(presupuestoId: number): Promise<string | null> {
    const firma = await this.prisma.presupuestos_firmas.findFirst({
      where: { presupuesto_id: presupuestoId, pdf_path: { not: null } },
      orderBy: { created_at: 'desc' },
      select: { pdf_path: true },
    });
    return firma?.pdf_path ?? null;
  }

  async findOne(id: number): Promise<PresupuestoGuardadoDto> {
    const row = await this.prisma.presupuestos_guardados.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException(
        `Presupuesto guardado con id ${id} no encontrado`,
      );
    }
    return {
      id: row.id,
      nombre: row.nombre,
      cliente_id: row.cliente_id,
      cliente_nombre: row.cliente_nombre,
      numero_presupuesto: row.numero_presupuesto,
      payload: row.payload as Record<string, unknown>,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async create(dto: {
    nombre: string;
    cliente_id?: number | null;
    cliente_nombre?: string | null;
    payload: Record<string, unknown>;
    created_by?: string | null;
  }): Promise<PresupuestoGuardadoDto> {
    if (!dto.payload || typeof dto.payload !== 'object') {
      throw new BadRequestException('El payload del presupuesto es requerido');
    }
    const companyPrefix =
      (this.configService.get('company') as any)?.legalNameShort?.trim() ||
      'DE CAMINO';
    const nombre = buildNombrePresupuesto(
      dto.cliente_nombre,
      dto.payload,
      companyPrefix,
    );
    const row = await this.prisma.presupuestos_guardados.create({
      data: {
        nombre,
        cliente_id: dto.cliente_id ?? null,
        cliente_nombre: dto.cliente_nombre ?? null,
        payload: dto.payload as Prisma.InputJsonValue,
        created_by: dto.created_by ?? null,
      },
    });
    // Asignar número de presupuesto al crear (MAD + año + id)
    const numeroPresupuesto = `MAD${new Date().getFullYear()}${String(row.id).padStart(4, '0')}`;
    const rowUpdated = await this.prisma.presupuestos_guardados.update({
      where: { id: row.id },
      data: { numero_presupuesto: numeroPresupuesto },
    });
    return {
      id: rowUpdated.id,
      nombre: rowUpdated.nombre,
      cliente_id: rowUpdated.cliente_id,
      cliente_nombre: rowUpdated.cliente_nombre,
      numero_presupuesto: rowUpdated.numero_presupuesto,
      payload: rowUpdated.payload as Record<string, unknown>,
      created_by: rowUpdated.created_by,
      created_at: rowUpdated.created_at,
      updated_at: rowUpdated.updated_at,
    };
  }

  async update(
    id: number,
    dto: {
      nombre?: string;
      cliente_id?: number | null;
      cliente_nombre?: string | null;
      numero_presupuesto?: string | null;
      payload?: Record<string, unknown>;
    },
  ): Promise<PresupuestoGuardadoDto> {
    const existing = await this.prisma.presupuestos_guardados.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(
        `Presupuesto guardado con id ${id} no encontrado`,
      );
    }
    const payload =
      dto.payload !== undefined
        ? dto.payload
        : (existing.payload as Record<string, unknown>);
    const clienteNombre =
      dto.cliente_nombre !== undefined
        ? dto.cliente_nombre
        : existing.cliente_nombre;
    const companyPrefix =
      (this.configService.get('company') as any)?.legalNameShort?.trim() ||
      'DE CAMINO';
    const nombre = buildNombrePresupuesto(
      clienteNombre,
      payload,
      companyPrefix,
    );
    const row = await this.prisma.presupuestos_guardados.update({
      where: { id },
      data: {
        nombre,
        ...(dto.cliente_id !== undefined && { cliente_id: dto.cliente_id }),
        ...(dto.cliente_nombre !== undefined && {
          cliente_nombre: dto.cliente_nombre,
        }),
        ...(dto.numero_presupuesto !== undefined && {
          numero_presupuesto: dto.numero_presupuesto,
        }),
        ...(dto.payload !== undefined && {
          payload: dto.payload as Prisma.InputJsonValue,
        }),
      },
    });
    return {
      id: row.id,
      nombre: row.nombre,
      cliente_id: row.cliente_id,
      cliente_nombre: row.cliente_nombre,
      numero_presupuesto: row.numero_presupuesto,
      payload: row.payload as Record<string, unknown>,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async remove(id: number): Promise<{ success: boolean }> {
    const existing = await this.prisma.presupuestos_guardados.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(
        `Presupuesto guardado con id ${id} no encontrado`,
      );
    }
    await this.prisma.presupuestos_guardados.delete({ where: { id } });
    return { success: true };
  }
}
