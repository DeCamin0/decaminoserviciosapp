import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService, AccessLevel } from '../assistant/services/rbac.service';

const MAX_SNOOZE = 3;

export type ObligationStateDto = {
  codigo_empleado: string;
  apariciones: number;
  snooze_count: number;
  snooze_max: number;
  hard_locked: boolean;
  last_shown_at: string | null;
  last_snooze_at: string | null;
  hard_locked_at: string | null;
  resolved_at: string | null;
};

@Injectable()
export class DocumentoObligationService {
  private readonly logger = new Logger(DocumentoObligationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {}

  private toIso(d: Date | null | undefined): string | null {
    if (!d) return null;
    try {
      return new Date(d).toISOString();
    } catch {
      return null;
    }
  }

  private mapRow(row: {
    codigo_empleado: string;
    apariciones: number;
    snooze_count: number;
    last_shown_at: Date | null;
    last_snooze_at: Date | null;
    hard_locked_at: Date | null;
    resolved_at: Date | null;
  }): ObligationStateDto {
    return {
      codigo_empleado: row.codigo_empleado,
      apariciones: row.apariciones ?? 0,
      snooze_count: row.snooze_count ?? 0,
      snooze_max: MAX_SNOOZE,
      hard_locked:
        !!row.hard_locked_at || (row.snooze_count ?? 0) >= MAX_SNOOZE,
      last_shown_at: this.toIso(row.last_shown_at),
      last_snooze_at: this.toIso(row.last_snooze_at),
      hard_locked_at: this.toIso(row.hard_locked_at),
      resolved_at: this.toIso(row.resolved_at),
    };
  }

  private emptyState(codigo: string): ObligationStateDto {
    return {
      codigo_empleado: codigo,
      apariciones: 0,
      snooze_count: 0,
      snooze_max: MAX_SNOOZE,
      hard_locked: false,
      last_shown_at: null,
      last_snooze_at: null,
      hard_locked_at: null,
      resolved_at: null,
    };
  }

  async getMyState(codigo: string): Promise<ObligationStateDto> {
    const row = await this.prisma.documentoObligationSnooze.findUnique({
      where: { codigo_empleado: codigo },
    });
    if (!row) return this.emptyState(codigo);
    return this.mapRow(row);
  }

  /**
   * Înregistrează o apariție a modalului.
   * Dacă ciclul anterior era resolved, pornește ciclu nou (reset snooze).
   */
  async recordShown(codigo: string): Promise<ObligationStateDto> {
    const existing = await this.prisma.documentoObligationSnooze.findUnique({
      where: { codigo_empleado: codigo },
    });

    const now = new Date();

    if (!existing) {
      const created = await this.prisma.documentoObligationSnooze.create({
        data: {
          codigo_empleado: codigo,
          apariciones: 1,
          snooze_count: 0,
          last_shown_at: now,
          resolved_at: null,
        },
      });
      return this.mapRow(created);
    }

    const newCycle = !!existing.resolved_at;
    const updated = await this.prisma.documentoObligationSnooze.update({
      where: { codigo_empleado: codigo },
      data: {
        apariciones: { increment: 1 },
        last_shown_at: now,
        ...(newCycle
          ? {
              snooze_count: 0,
              hard_locked_at: null,
              resolved_at: null,
              last_snooze_at: null,
            }
          : {}),
      },
    });
    return this.mapRow(updated);
  }

  async recordSnooze(codigo: string): Promise<ObligationStateDto> {
    const existing = await this.prisma.documentoObligationSnooze.findUnique({
      where: { codigo_empleado: codigo },
    });
    const now = new Date();

    if (!existing) {
      const created = await this.prisma.documentoObligationSnooze.create({
        data: {
          codigo_empleado: codigo,
          apariciones: 1,
          snooze_count: 1,
          last_shown_at: now,
          last_snooze_at: now,
          hard_locked_at: null,
        },
      });
      return this.mapRow(created);
    }

    if (existing.hard_locked_at || existing.snooze_count >= MAX_SNOOZE) {
      return this.mapRow(existing);
    }

    const nextCount = Math.min(MAX_SNOOZE, (existing.snooze_count || 0) + 1);
    const hardLock = nextCount >= MAX_SNOOZE;

    const updated = await this.prisma.documentoObligationSnooze.update({
      where: { codigo_empleado: codigo },
      data: {
        snooze_count: nextCount,
        last_snooze_at: now,
        ...(hardLock ? { hard_locked_at: now } : {}),
        resolved_at: null,
      },
    });
    this.logger.log(
      `Snooze ${nextCount}/${MAX_SNOOZE} for ${codigo}${hardLock ? ' → HARD LOCK' : ''}`,
    );
    return this.mapRow(updated);
  }

  async recordResolved(codigo: string): Promise<ObligationStateDto> {
    const now = new Date();
    const existing = await this.prisma.documentoObligationSnooze.findUnique({
      where: { codigo_empleado: codigo },
    });

    if (!existing) {
      const created = await this.prisma.documentoObligationSnooze.create({
        data: {
          codigo_empleado: codigo,
          apariciones: 0,
          snooze_count: 0,
          resolved_at: now,
          hard_locked_at: null,
        },
      });
      return this.mapRow(created);
    }

    const updated = await this.prisma.documentoObligationSnooze.update({
      where: { codigo_empleado: codigo },
      data: {
        resolved_at: now,
        hard_locked_at: null,
        snooze_count: 0,
      },
    });
    return this.mapRow(updated);
  }

  async listForAdmin(grupo: string): Promise<ObligationStateDto[]> {
    const level = this.rbacService.getAccessLevel(grupo);
    if (level !== AccessLevel.FULL_ACCESS) {
      throw new ForbiddenException('Acceso denegado');
    }

    const rows = await this.prisma.documentoObligationSnooze.findMany({
      orderBy: [{ snooze_count: 'desc' }, { last_shown_at: 'desc' }],
      take: 500,
    });
    return rows.map((r) => this.mapRow(r));
  }
}
