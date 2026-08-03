import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServiciosPeriodicosService {
  private readonly logger = new Logger(ServiciosPeriodicosService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listTipos(includeInactive = false) {
    try {
      return await this.prisma.servicioPeriodicoTipo.findMany({
        where: includeInactive ? undefined : { activo: true },
        orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      });
    } catch (error: any) {
      this.logger.error('Error listing tipos:', error);
      throw new BadRequestException(`Error al listar tipos: ${error.message}`);
    }
  }

  async createTipo(data: { nombre: string; orden?: number; color?: string }) {
    const nombre = (data.nombre || '').trim();
    if (!nombre) {
      throw new BadRequestException('El nombre del tipo es requerido');
    }
    const color =
      this.normalizeColor(data.color) || this.defaultColorForOrden(data.orden);
    try {
      let orden = data.orden;
      if (orden == null || Number.isNaN(Number(orden))) {
        const agg = await this.prisma.servicioPeriodicoTipo.aggregate({
          _max: { orden: true },
        });
        orden = (agg._max.orden ?? 0) + 1;
      }
      return await this.prisma.servicioPeriodicoTipo.create({
        data: {
          nombre,
          orden: Number(orden),
          activo: true,
          color: color || this.defaultColorForOrden(orden),
        },
      });
    } catch (error: any) {
      this.logger.error('Error creating tipo:', error);
      throw new BadRequestException(`Error al crear tipo: ${error.message}`);
    }
  }

  async updateTipo(
    id: number,
    data: { nombre?: string; activo?: boolean; orden?: number; color?: string },
  ) {
    const existing = await this.prisma.servicioPeriodicoTipo.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Tipo ${id} no encontrado`);
    }
    const patch: {
      nombre?: string;
      activo?: boolean;
      orden?: number;
      color?: string;
    } = {};
    if (data.nombre != null) {
      const nombre = String(data.nombre).trim();
      if (!nombre)
        throw new BadRequestException('El nombre no puede estar vacío');
      patch.nombre = nombre;
    }
    if (typeof data.activo === 'boolean') patch.activo = data.activo;
    if (data.orden != null && !Number.isNaN(Number(data.orden))) {
      patch.orden = Number(data.orden);
    }
    if (data.color != null) {
      const color = this.normalizeColor(data.color);
      if (!color) throw new BadRequestException('Color inválido (usa #RRGGBB)');
      patch.color = color;
    }
    try {
      return await this.prisma.servicioPeriodicoTipo.update({
        where: { id },
        data: patch,
      });
    } catch (error: any) {
      this.logger.error(`Error updating tipo ${id}:`, error);
      throw new BadRequestException(
        `Error al actualizar tipo: ${error.message}`,
      );
    }
  }

  private normalizeColor(raw?: string | null): string | null {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
    if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
      const r = s[1];
      const g = s[2];
      const b = s[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return null;
  }

  private defaultColorForOrden(orden?: number): string {
    const palette = [
      '#0ea5e9',
      '#f59e0b',
      '#a855f7',
      '#14b8a6',
      '#f43f5e',
      '#22c55e',
      '#f97316',
      '#6366f1',
    ];
    const i = Math.max(0, Number(orden) || 1) - 1;
    return palette[i % palette.length];
  }

  async deleteTipo(id: number) {
    // Soft delete: desactivar (conserva historial de checks)
    return this.updateTipo(id, { activo: false });
  }

  async getMatrix(an: number) {
    if (!an || an < 2000 || an > 2100) {
      throw new BadRequestException('Año inválido');
    }
    try {
      const [tipos, clientesRaw, checks] = await Promise.all([
        this.prisma.servicioPeriodicoTipo.findMany({
          where: { activo: true },
          orderBy: [{ orden: 'asc' }, { id: 'asc' }],
        }),
        this.prisma.clientes.findMany({
          select: {
            id: true,
            NOMBRE_O_RAZON_SOCIAL: true,
            NIF: true,
            POBLACION: true,
            ESTADO: true,
            TIPO: true,
          },
          orderBy: { NOMBRE_O_RAZON_SOCIAL: 'asc' },
        }),
        this.prisma.servicioPeriodicoCheck.findMany({
          where: { an },
        }),
      ]);

      const clientes = clientesRaw
        .filter((c) => (c.TIPO || '').toLowerCase() !== 'proveedor')
        .map((c) => ({
          id: c.id,
          nombre: c.NOMBRE_O_RAZON_SOCIAL || `Cliente #${c.id}`,
          nif: c.NIF || '',
          poblacion: c.POBLACION || '',
          estado: c.ESTADO || '',
        }));

      return {
        an,
        tipos,
        clientes,
        checks: checks.map((ch) => ({
          id: ch.id,
          cliente_id: ch.cliente_id,
          tipo_id: ch.tipo_id,
          an: ch.an,
          mes: ch.mes,
          hecho: ch.hecho,
          fecha_realizacion: ch.fecha_realizacion,
          hecho_por: ch.hecho_por,
          nota: ch.nota,
        })),
      };
    } catch (error: any) {
      this.logger.error(`Error getting matrix ${an}:`, error);
      throw new BadRequestException(
        `Error al obtener matriz: ${error.message}`,
      );
    }
  }

  async upsertCheck(data: {
    cliente_id: number;
    tipo_id: number;
    an: number;
    mes: number;
    hecho: boolean;
    nota?: string | null;
    hecho_por?: string | null;
  }) {
    const clienteId = Number(data.cliente_id);
    const tipoId = Number(data.tipo_id);
    const an = Number(data.an);
    const mes = Number(data.mes);
    if (!clienteId || !tipoId || !an || mes < 1 || mes > 12) {
      throw new BadRequestException(
        'cliente_id, tipo_id, an y mes (1-12) son requeridos',
      );
    }

    const tipo = await this.prisma.servicioPeriodicoTipo.findUnique({
      where: { id: tipoId },
    });
    if (!tipo) throw new NotFoundException(`Tipo ${tipoId} no encontrado`);

    const hecho = Boolean(data.hecho);
    try {
      return await this.prisma.servicioPeriodicoCheck.upsert({
        where: {
          cliente_id_tipo_id_an_mes: {
            cliente_id: clienteId,
            tipo_id: tipoId,
            an,
            mes,
          },
        },
        create: {
          cliente_id: clienteId,
          tipo_id: tipoId,
          an,
          mes,
          hecho,
          fecha_realizacion: hecho ? new Date() : null,
          hecho_por: data.hecho_por || null,
          nota: data.nota ?? null,
        },
        update: {
          hecho,
          fecha_realizacion: hecho ? new Date() : null,
          hecho_por: data.hecho_por || null,
          ...(data.nota !== undefined ? { nota: data.nota } : {}),
        },
      });
    } catch (error: any) {
      this.logger.error('Error upserting check:', error);
      throw new BadRequestException(`Error al guardar: ${error.message}`);
    }
  }
}
