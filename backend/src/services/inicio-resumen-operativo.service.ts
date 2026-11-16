import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EmpleadoGrupoScopeService,
  type JwtUserLike,
} from './empleado-grupo-scope.service';
import { FichajeReminderService } from './fichaje-reminder.service';
import { isImplicitAdmin } from './empleados-operation-access';
import { permissionFlag } from './pedidos-access-policy';

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
   * Admin și Developer păstrează indicatorii chiar dacă bifa este false.
   * Restul grupurilor au nevoie de bifa explicită din matrice.
   */
  async hasModule(user: any, module: string): Promise<boolean> {
    const grupo = this.grupoOf(user);
    const role = String(user?.role || user?.ROLE || '').trim();
    if (!module) return false;
    if (isImplicitAdmin({ grupo, role })) return true;
    if (!grupo) return false;
    const row = await this.prisma.permissions.findFirst({
      where: { grupo_module: `${grupo}_${module}` },
    });
    return permissionFlag(row?.permitted);
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
      String(periodoRaw || 'hoy')
        .trim()
        .toLowerCase() === 'mes'
        ? 'mes'
        : 'hoy';

    const grupo = this.grupoOf(user);
    const canEmpleados = await this.hasModule(user, 'empleados');
    const canFicharAdmin = await this.hasModule(user, 'fichar-admin');
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
        this.logger.error(`scanHoyForOperativo failed: ${err?.message || err}`);
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
