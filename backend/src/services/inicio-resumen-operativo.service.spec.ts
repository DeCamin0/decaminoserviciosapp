import { InicioResumenOperativoService } from './inicio-resumen-operativo.service';

describe('InicioResumenOperativoService', () => {
  const makeService = (opts: {
    permissions?: Array<{ grupo_module: string; permitted: string }>;
    allowedCodigos?: string[] | null;
    scopeFilter?: { grupos: string[]; includeSelfCodigo: string } | null;
    scan?: {
      dateStr: string;
      programadosHoy: { count: number; codigos: string[] };
      pendientesFichar: { count: number; codigos: string[] };
    };
  }) => {
    const prisma = {
      permissions: {
        findFirst: jest.fn(async ({ where }: any) => {
          const key = where?.grupo_module;
          return (opts.permissions || []).find((p) => p.grupo_module === key);
        }),
      },
    };
    const empleadoGrupoScopeService = {
      resolveScopeFilter: jest.fn(async () => opts.scopeFilter ?? null),
      listAllowedCodigosForPayload: jest.fn(
        async () => opts.allowedCodigos ?? null,
      ),
    };
    const fichajeReminderService = {
      scanHoyForOperativo: jest.fn(async () =>
        opts.scan ?? {
          dateStr: '2026-11-05',
          programadosHoy: { count: 2, codigos: ['A', 'B'] },
          pendientesFichar: { count: 1, codigos: ['A'] },
        },
      ),
    };
    const service = new InicioResumenOperativoService(
      prisma as any,
      empleadoGrupoScopeService as any,
      fichajeReminderService as any,
    );
    return { service, fichajeReminderService, empleadoGrupoScopeService };
  };

  it('omits punch KPIs when user lacks empleados and fichar-admin', async () => {
    const { service, fichajeReminderService } = makeService({
      permissions: [],
    });
    const res = await service.getResumen(
      { userId: '1', grupo: 'Limpiador' },
      'hoy',
    );
    expect(res.omitted).toEqual(
      expect.arrayContaining(['programadosHoy', 'pendientesFichar']),
    );
    expect(res.kpis.programadosHoy).toBeUndefined();
    expect(fichajeReminderService.scanHoyForOperativo).not.toHaveBeenCalled();
  });

  it('returns counts without codigos by default', async () => {
    const { service, fichajeReminderService, empleadoGrupoScopeService } =
      makeService({
        allowedCodigos: ['100', '200'],
        scopeFilter: { grupos: ['Limpiador'], includeSelfCodigo: '99' },
      });
    const res = await service.getResumen(
      { userId: '99', grupo: 'Admin', role: 'ADMIN' },
      'hoy',
    );
    expect(res.success).toBe(true);
    expect(res.kpis.programadosHoy).toEqual({ count: 2 });
    expect(res.kpis.pendientesFichar).toEqual({ count: 1 });
    expect(res.kpis.programadosHoy?.codigos).toBeUndefined();
    expect(res.scope.restricted).toBe(true);
    expect(fichajeReminderService.scanHoyForOperativo).toHaveBeenCalledWith([
      '100',
      '200',
    ]);
    expect(
      empleadoGrupoScopeService.listAllowedCodigosForPayload,
    ).toHaveBeenCalled();
  });

  it('includes codigos only with includeCodigos=1 and punch permission', async () => {
    const { service } = makeService({});
    const res = await service.getResumen(
      { userId: '99', grupo: 'Admin', role: 'ADMIN' },
      'hoy',
      '1',
    );
    expect(res.kpis.programadosHoy).toEqual({
      count: 2,
      codigos: ['A', 'B'],
    });
    expect(res.kpis.pendientesFichar?.codigos).toEqual(['A']);
  });

  it('ignores includeCodigos when user lacks punch permission', async () => {
    const { service, fichajeReminderService } = makeService({
      permissions: [],
    });
    const res = await service.getResumen(
      { userId: '1', grupo: 'Limpiador' },
      'hoy',
      'true',
    );
    expect(res.omitted).toEqual(
      expect.arrayContaining(['programadosHoy', 'pendientesFichar']),
    );
    expect(res.kpis.programadosHoy).toBeUndefined();
    expect(fichajeReminderService.scanHoyForOperativo).not.toHaveBeenCalled();
  });

  it('allows Manager with explicit fichar-admin permission', async () => {
    const { service, fichajeReminderService } = makeService({
      permissions: [{ grupo_module: 'Manager_fichar-admin', permitted: 'true' }],
      allowedCodigos: null,
    });
    const res = await service.getResumen(
      { userId: '50', grupo: 'Manager' },
      'mes',
    );
    expect(res.periodo).toBe('mes');
    expect(res.omitted).toEqual([]);
    expect(fichajeReminderService.scanHoyForOperativo).toHaveBeenCalledWith(
      null,
    );
    expect(res.kpis.programadosHoy).toEqual({ count: 2 });
  });
});
