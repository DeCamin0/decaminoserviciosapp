import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EmpleadoGrupoScopeService,
  type JwtUserLike,
} from './empleado-grupo-scope.service';
import { FichajeReminderService } from './fichaje-reminder.service';

export type InicioOperativoKpiPayload = {
  count: number;
  /** Only present when includeCodigos=true and caller has empleados|fichar-admin */
  codigos?: string[];
};

export type InicioResumenOperativoResponse = {
  success: true;
  periodo: 'hoy' | 'mes';
  dateStr: string;
  scope: { restricted: boolean; grupos: string[] };
  kpis: {
    programadosHoy?: InicioOperativoKpiPayload;
    pendientesFichar?: InicioOperativoKpiPayload;
  };
  omitted: string[];
};

@Injectable()
export class InicioResumenOperativoService {
  private readonly logger = new Logger(InicioResumenOperativoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly empleadoGrupoScopeService: EmpleadoGrupoScopeService,
    private readonly fichajeReminderService: FichajeReminderService,
  ) {}

  private grupoOf(user: any): string {
    return String(user?.grupo || user?.GRUPO || '').trim();
  }

  /**
   * Same matrix semantics as FE hasPermission: Admin/Developer default allow
   * unless explicit permitted=false; others need explicit true.
   */
  async hasModule(grupo: string, module: string): Promise<boolean> {
    if (!grupo || !module) return false;
    const key = `${grupo}_${module}`;
    const row = await this.prisma.permissions.findFirst({
      where: { grupo_module: key },
    });
    if (grupo === 'Admin' || grupo === 'Developer') {
      if (row && String(row.permitted).toLowerCase() === 'false') return false;
      return true;
    }
    return Boolean(row && String(row.permitted).toLowerCase() === 'true');
  }

  private wantsIncludeCodigos(raw?: string): boolean {
    const v = String(raw || '')
      .trim()
      .toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
  }

  private toKpiPayload(
    bucket: { count: number; codigos: string[] },
    withCodigos: boolean,
  ): InicioOperativoKpiPayload {
    if (withCodigos) {
      return { count: bucket.count, codigos: bucket.codigos };
    }
    return { count: bucket.count };
  }

  async getResumen(
    user: any,
    periodoRaw?: string,
    includeCodigosRaw?: string,
  ): Promise<InicioResumenOperativoResponse> {
    const periodo: 'hoy' | 'mes' =
      String(periodoRaw || 'hoy').trim().toLowerCase() === 'mes' ? 'mes' : 'hoy';

    const grupo = this.grupoOf(user);
    const canEmpleados = await this.hasModule(grupo, 'empleados');
    const canFicharAdmin = await this.hasModule(grupo, 'fichar-admin');
    const canPunchKpis = canEmpleados || canFicharAdmin;
    /** Audit lists: opt-in query + same modules that unlock the KPIs */
    const withCodigos =
      canPunchKpis && this.wantsIncludeCodigos(includeCodigosRaw);

    const payload: JwtUserLike = {
      userId: String(user?.userId || user?.CODIGO || user?.codigo || '').trim(),
      grupo,
      role: String(user?.role || '').trim(),
    };

    const scopeFilter =
      await this.empleadoGrupoScopeService.resolveScopeFilter(payload);
    const allowedCodigos =
      await this.empleadoGrupoScopeService.listAllowedCodigosForPayload(
        payload,
      );

    const omitted: string[] = [];
    const kpis: InicioResumenOperativoResponse['kpis'] = {};
    let dateStr = '';

    if (!canPunchKpis) {
      omitted.push('programadosHoy', 'pendientesFichar');
    } else {
      try {
        const scan =
          await this.fichajeReminderService.scanHoyForOperativo(allowedCodigos);
        dateStr = scan.dateStr;
        kpis.programadosHoy = this.toKpiPayload(
          scan.programadosHoy,
          withCodigos,
        );
        kpis.pendientesFichar = this.toKpiPayload(
          scan.pendientesFichar,
          withCodigos,
        );
      } catch (err: any) {
        this.logger.error(
          `scanHoyForOperativo failed: ${err?.message || err}`,
        );
        omitted.push('programadosHoy', 'pendientesFichar');
      }
    }

    return {
      success: true,
      periodo,
      dateStr:
        dateStr ||
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Europe/Madrid',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date()),
      scope: {
        restricted: Boolean(scopeFilter),
        grupos: scopeFilter?.grupos ?? [],
      },
      kpis,
      omitted,
    };
  }
}
