import { readFileSync } from 'fs';
import { join } from 'path';
import { ForbiddenException } from '@nestjs/common';
import { loadEmpleadosForUser } from './empleados-list-access';
import {
  assertFichajeWrite,
  bindOwnChangeRequest,
  canApproveEmployeeChange,
  canManageOtherFichajes,
  canReadEmpleadoStatus,
  canWriteEmployeeFile,
  canWriteOwnFichaje,
  filterRowsByCodigos,
  isImplicitAdmin,
  employeeDirectoryProjection,
  emptyEmpleadoModuleFlags,
  flagsFromPermissionRows,
  loadEmpleadoModuleFlags,
  operationAudience,
  projectEmpleadoForFicharAdmin,
  resolveDirectoryListAccess,
  resolvePunchReadCodigos,
  resolvePunchWriteCodigos,
  type EmpleadoModuleFlags,
} from './empleados-operation-access';

const none = emptyEmpleadoModuleFlags();
const empleados: EmpleadoModuleFlags = { ...none, empleados: true };
const ficharAdmin: EmpleadoModuleFlags = { ...none, ficharAdmin: true };
const ficharEmpleados: EmpleadoModuleFlags = { ...none, ficharEmpleados: true };
const aprobaciones: EmpleadoModuleFlags = { ...none, aprobaciones: true };
const adminPanel: EmpleadoModuleFlags = { ...none, admin: true };
const allDenied: EmpleadoModuleFlags = {
  empleados: false,
  ficharAdmin: false,
  ficharEmpleados: false,
  aprobaciones: false,
  admin: false,
};
const scope = { grupos: ['Limpieza'], includeSelfCodigo: 'M1' };

const fila = {
  CODIGO: 'E1',
  'NOMBRE / APELLIDOS': 'Ana Ruiz',
  'CORREO ELECTRONICO': 'ana@example.com',
  GRUPO: 'Limpieza',
  'CENTRO TRABAJO': 'Centro 1',
  ESTADO: 'ACTIVO',
  'SUELDO BRUTO MENSUAL': '1800',
  SUELDO_BRUTO_MENSUAL: '1800',
  'Nº Cuenta': 'ES123',
  NUMERO_CUENTA: 'ES123',
  'D.N.I. / NIE': '12345678A',
  DNI_NIE: '12345678A',
  TELEFONO: '600',
  'HORAS DE CONTRATO': '40',
};

function listDeps(scopeResult: unknown) {
  const getAllEmpleados = jest.fn().mockResolvedValue([{ ...fila }]);
  return {
    getAllEmpleados,
    api: {
      resolveScopeFilter: jest.fn().mockResolvedValue(scopeResult),
      getAllEmpleados,
    },
  };
}

describe('H4 drept de operațiune și scope', () => {
  const fichajes = readFileSync(
    join(__dirname, '../controllers/fichajes.controller.ts'),
    'utf8',
  );
  const empleadosController = readFileSync(
    join(__dirname, '../controllers/empleados.controller.ts'),
    'utf8',
  );

  it('test-trigger cere fichar-admin sau Admin/Developer și aplică scope-ul', () => {
    const start = fichajes.indexOf("@Post('fichaje-reminder/test-trigger')");
    const body = fichajes.slice(start);
    expect(body).toContain('@UseGuards(JwtAuthGuard)');
    expect(body).toContain('assertManualReminderPermission');
    expect(body).toContain('reminderAudienceCodigos');
    expect(body).toContain('allowedCodigos');
    expect(body).not.toContain('readCodigos');
    expect(body).not.toContain('resolvePunch');
    expect(body).not.toContain('windowMinutes');
  });

  it('legătura de scriere a fișei și a pontajului este în controllere', () => {
    expect(empleadosController).toContain('requireFileWrite');
    expect(empleadosController).toContain('bindOwnChangeRequest');
    expect(empleadosController).toContain('assertCanApproveEmployeeChange');
    expect(empleadosController).toContain('assertCanReadEmpleadoStatus');
    expect(fichajes).toContain('resolvePunchReadCodigos');
    expect(fichajes).toContain('assertFichajeWrite');
  });

  it('Admin și Developer păstrează administrarea chiar dacă toate bifele sunt false', () => {
    for (const actor of [
      { userId: 'A1', grupo: 'Admin', role: 'ADMIN', isManager: true },
      { userId: 'D1', grupo: 'Developer', role: 'DEVELOPER', isManager: true },
      { userId: 'A2', grupo: 'Altul', role: 'ADMIN', isManager: false },
    ]) {
      expect(isImplicitAdmin(actor)).toBe(true);
      expect(canWriteEmployeeFile(actor, allDenied)).toBe(true);
      expect(canApproveEmployeeChange(actor, allDenied)).toBe(true);
      expect(canManageOtherFichajes(actor, allDenied)).toBe(true);
      expect(canReadEmpleadoStatus(actor, allDenied)).toBe(true);
      expect(employeeDirectoryProjection(actor, allDenied)).toBe('full');
    }
  });

  it('Manager, Supervisor, RRHH și Jefe nu primesc drepturi din nume sau isManager', () => {
    for (const grupo of ['Manager', 'Supervisor', 'RRHH', 'Jefe']) {
      const actor = {
        userId: 'L1',
        grupo,
        role:
          grupo === 'Manager' || grupo === 'Supervisor'
            ? 'MANAGER'
            : 'EMPLEADOS',
        isManager: grupo === 'Manager' || grupo === 'Supervisor',
      };
      expect(isImplicitAdmin(actor)).toBe(false);
      expect(canWriteEmployeeFile(actor, allDenied)).toBe(false);
      expect(canApproveEmployeeChange(actor, allDenied)).toBe(false);
      expect(canManageOtherFichajes(actor, allDenied)).toBe(false);
      expect(canReadEmpleadoStatus(actor, allDenied)).toBe(false);
    }
    expect(
      canWriteEmployeeFile(
        { userId: 'M1', grupo: 'Manager', role: 'MANAGER', isManager: true },
        empleados,
      ),
    ).toBe(true);
    expect(
      canApproveEmployeeChange(
        { userId: 'M1', grupo: 'Manager', role: 'MANAGER', isManager: true },
        empleados,
      ),
    ).toBe(false);
    expect(
      canApproveEmployeeChange(
        { userId: 'S1', grupo: 'Supervisor', role: 'MANAGER', isManager: true },
        aprobaciones,
      ),
    ).toBe(true);
    expect(
      canReadEmpleadoStatus(
        { userId: 'M1', grupo: 'Manager', role: 'MANAGER', isManager: true },
        adminPanel,
      ),
    ).toBe(true);
    expect(
      canWriteEmployeeFile({ userId: 'M1', grupo: 'Manager' }, adminPanel),
    ).toBe(false);
  });

  it('grupul personalizat cu empleados scrie fișa; doar fichar-admin nu', () => {
    const custom = { userId: 'C1', grupo: 'Contabilidad', role: 'EMPLEADOS' };
    expect(canWriteEmployeeFile(custom, empleados)).toBe(true);
    expect(employeeDirectoryProjection(custom, empleados)).toBe('full');
    expect(canWriteEmployeeFile(custom, ficharAdmin)).toBe(false);
    expect(canManageOtherFichajes(custom, ficharAdmin)).toBe(true);
    expect(employeeDirectoryProjection(custom, ficharAdmin)).toBe('fichar');
    expect(canApproveEmployeeChange(custom, aprobaciones)).toBe(true);
    expect(canWriteEmployeeFile(custom, aprobaciones)).toBe(false);
    expect(canWriteOwnFichaje(custom, ficharEmpleados)).toBe(true);
    expect(canManageOtherFichajes(custom, ficharEmpleados)).toBe(false);
  });

  it('angajatul obișnuit nu scrie fișa, nu aprobă și nu pontă pe altcineva', () => {
    const actor = { userId: 'E10', grupo: 'Operario', role: 'EMPLEADOS' };
    expect(canWriteEmployeeFile(actor, none)).toBe(false);
    expect(canApproveEmployeeChange(actor, none)).toBe(false);
    expect(canManageOtherFichajes(actor, none)).toBe(false);
    expect(canWriteOwnFichaje(actor, none)).toBe(false);
    expect(() => assertFichajeWrite(actor, none, 'E10')).toThrow(
      ForbiddenException,
    );
    expect(() => assertFichajeWrite(actor, ficharEmpleados, 'E11')).toThrow(
      ForbiddenException,
    );
    expect(() =>
      assertFichajeWrite(actor, ficharEmpleados, 'E10'),
    ).not.toThrow();
  });

  it('rândurile de scope limitează conducerea și nu deschid firma pentru un angajat', () => {
    expect(
      operationAudience({
        bypass: false,
        hasScopeRows: true,
        companyRight: true,
      }),
    ).toBe('scope');
    expect(
      operationAudience({
        bypass: false,
        hasScopeRows: true,
        companyRight: false,
      }),
    ).toBe('self');
    expect(
      operationAudience({
        bypass: true,
        hasScopeRows: true,
        companyRight: false,
      }),
    ).toBe('all');
    expect(
      operationAudience({
        bypass: false,
        hasScopeRows: false,
        companyRight: true,
      }),
    ).toBe('all');
  });

  it('lista: bifa deschide fișa, numele de Manager nu, fichar-admin e filtrat', () => {
    expect(
      resolveDirectoryListAccess(
        { userId: 'M1', grupo: 'Manager', role: 'MANAGER', isManager: true },
        null,
        none,
      ),
    ).toEqual({ kind: 'self', codigo: 'M1' });
    expect(
      resolveDirectoryListAccess(
        { userId: 'M1', grupo: 'Manager' },
        null,
        empleados,
      ),
    ).toEqual({ kind: 'all' });
    expect(
      resolveDirectoryListAccess(
        { userId: 'M1', grupo: 'Manager' },
        scope,
        empleados,
      ),
    ).toEqual({ kind: 'scope', scope });
    expect(
      resolveDirectoryListAccess(
        { userId: 'A1', grupo: 'Admin', role: 'ADMIN' },
        null,
        allDenied,
      ),
    ).toEqual({ kind: 'all' });
    expect(
      resolveDirectoryListAccess(
        { userId: 'C1', grupo: 'Contabilidad', role: 'EMPLEADOS' },
        null,
        ficharAdmin,
      ),
    ).toEqual({ kind: 'all' });
    expect(
      resolveDirectoryListAccess(
        { userId: 'E10', grupo: 'Operario', role: 'EMPLEADOS' },
        scope,
        none,
      ),
    ).toEqual({ kind: 'self', codigo: 'E10' });
    expect(
      resolveDirectoryListAccess(
        { userId: 'F1', grupo: 'Vigilancia', role: 'EMPLEADOS' },
        scope,
        ficharAdmin,
      ),
    ).toEqual({ kind: 'scope', scope });
  });

  it('proiecția fichar-admin păstrează pontajul și scoate salariul, IBAN-ul și DNI-ul', () => {
    const projected = projectEmpleadoForFicharAdmin(fila);
    expect(projected.CODIGO).toBe('E1');
    expect(projected['NOMBRE / APELLIDOS']).toBe('Ana Ruiz');
    expect(projected.GRUPO).toBe('Limpieza');
    expect(projected['CENTRO TRABAJO']).toBe('Centro 1');
    expect(projected['CORREO ELECTRONICO']).toBe('ana@example.com');
    expect(projected.ESTADO).toBe('ACTIVO');
    expect(projected['SUELDO BRUTO MENSUAL']).toBeUndefined();
    expect(projected.SUELDO_BRUTO_MENSUAL).toBeUndefined();
    expect(projected['Nº Cuenta']).toBeUndefined();
    expect(projected.NUMERO_CUENTA).toBeUndefined();
    expect(projected['D.N.I. / NIE']).toBeUndefined();
    expect(projected.DNI_NIE).toBeUndefined();
    expect(projected.TELEFONO).toBeUndefined();
    expect(projected['HORAS DE CONTRATO']).toBeUndefined();
  });

  it('cererea proprie rămâne pendiente și nu poate viza alt cod', () => {
    const actor = { userId: 'E10', grupo: 'Operario' };
    expect(bindOwnChangeRequest(actor, none, 'E10')).toEqual({
      codigo: 'E10',
      estado: 'pendiente',
    });
    expect(() => bindOwnChangeRequest(actor, none, 'E11')).toThrow(
      ForbiddenException,
    );
    expect(() =>
      bindOwnChangeRequest(
        { userId: 'M1', grupo: 'Manager', role: 'MANAGER', isManager: true },
        none,
        'E11',
      ),
    ).toThrow(ForbiddenException);
    expect(
      bindOwnChangeRequest(
        { userId: 'M1', grupo: 'Manager' },
        empleados,
        'E11',
      ),
    ).toEqual({ codigo: 'E11', estado: 'pendiente' });
    expect(
      bindOwnChangeRequest(
        { userId: 'A1', grupo: 'Admin', role: 'ADMIN' },
        allDenied,
        'E11',
      ),
    ).toEqual({ codigo: 'E11', estado: 'pendiente' });
  });

  it('bifa true sau 1 acordă modulul; lipsa rândului și eroarea de citire nu acordă', async () => {
    expect(
      flagsFromPermissionRows('Contabilidad', [
        { grupo_module: 'Contabilidad_empleados', permitted: '1' },
        { grupo_module: 'Contabilidad_fichar-admin', permitted: 'false' },
        { grupo_module: 'Altele_aprobaciones', permitted: 'true' },
      ]),
    ).toMatchObject({
      empleados: true,
      ficharAdmin: false,
      aprobaciones: false,
    });

    await expect(
      loadEmpleadoModuleFlags('Contabilidad', async () => {
        throw new Error('db');
      }),
    ).resolves.toEqual(none);
  });

  it('pontajele urmează bifa, iar scope-ul gol de angajați nu deschide firma', async () => {
    const listScopeCodigos = jest.fn().mockResolvedValue(['E1', 'M1']);
    await expect(
      resolvePunchReadCodigos({
        actor: {
          userId: 'M1',
          grupo: 'Manager',
          role: 'MANAGER',
          isManager: true,
        },
        flags: ficharAdmin,
        bypass: false,
        scope: null,
        listScopeCodigos,
      }),
    ).resolves.toBeNull();
    await expect(
      resolvePunchReadCodigos({
        actor: { userId: 'M1', grupo: 'Manager', isManager: true },
        flags: none,
        bypass: false,
        scope: null,
        listScopeCodigos,
      }),
    ).resolves.toEqual(['M1']);
    await expect(
      resolvePunchReadCodigos({
        actor: { userId: 'M1', grupo: 'Manager' },
        flags: ficharAdmin,
        bypass: false,
        scope,
        listScopeCodigos,
      }),
    ).resolves.toEqual(['E1', 'M1']);
    const emptyScope = jest.fn().mockResolvedValue([]);
    await expect(
      resolvePunchReadCodigos({
        actor: { userId: 'M1', grupo: 'Manager' },
        flags: ficharAdmin,
        bypass: false,
        scope,
        listScopeCodigos: emptyScope,
      }),
    ).resolves.toEqual([]);
    await expect(
      resolvePunchReadCodigos({
        actor: { userId: 'A1', grupo: 'Admin', role: 'ADMIN' },
        flags: allDenied,
        bypass: true,
        scope,
        listScopeCodigos,
      }),
    ).resolves.toBeNull();
    await expect(
      resolvePunchReadCodigos({
        actor: { userId: 'E10', grupo: 'Operario' },
        flags: none,
        bypass: false,
        scope: null,
        listScopeCodigos,
      }),
    ).resolves.toEqual(['E10']);
    await expect(
      resolvePunchWriteCodigos({
        actor: { userId: 'E10', grupo: 'Operario' },
        flags: ficharEmpleados,
        bypass: false,
        scope: null,
        listScopeCodigos,
      }),
    ).resolves.toEqual(['E10']);
    await expect(
      resolvePunchWriteCodigos({
        actor: { userId: 'E10', grupo: 'Operario' },
        flags: none,
        bypass: false,
        scope: null,
        listScopeCodigos,
      }),
    ).resolves.toEqual([]);
    expect(listScopeCodigos).toHaveBeenCalledTimes(1);
    expect(
      filterRowsByCodigos(
        [{ codigo: 'E1' }, { codigo: 'E2' }],
        [],
        (row) => row.codigo,
      ),
    ).toEqual([]);
    expect(
      filterRowsByCodigos(
        [
          { codigo: 'E1', nombre: 'Ana' },
          { codigo: 'E9', nombre: 'Luis' },
        ],
        ['E1'],
        (row) => row.codigo,
      ),
    ).toEqual([{ codigo: 'E1', nombre: 'Ana' }]);
  });
});

describe('GET /api/empleados cu drepturile H4', () => {
  it('fichar-admin fără scope primește lista, fără salariu', async () => {
    const { api, getAllEmpleados } = listDeps(null);
    const rows = (await loadEmpleadosForUser(
      { userId: 'F1', grupo: 'Vigilancia', role: 'EMPLEADOS' },
      api,
      ficharAdmin,
    )) as Array<Record<string, unknown>>;
    expect(getAllEmpleados).toHaveBeenCalledWith(null);
    expect(rows[0]['SUELDO BRUTO MENSUAL']).toBeUndefined();
    expect(rows[0]['Nº Cuenta']).toBeUndefined();
    expect(rows[0].CODIGO).toBe('E1');
  });

  it('grupul cu empleados primește salariul', async () => {
    const { api, getAllEmpleados } = listDeps(null);
    const rows = (await loadEmpleadosForUser(
      { userId: 'C1', grupo: 'Contabilidad', role: 'EMPLEADOS' },
      api,
      empleados,
    )) as Array<Record<string, unknown>>;
    expect(getAllEmpleados).toHaveBeenCalledWith(null);
    expect(rows[0]['SUELDO BRUTO MENSUAL']).toBe('1800');
  });

  it('angajatul obișnuit, chiar cu rânduri de scope, rămâne pe propriul cod și își vede fișa', async () => {
    const { api, getAllEmpleados } = listDeps(scope);
    const rows = (await loadEmpleadosForUser(
      { userId: 'E10', grupo: 'Operario', role: 'EMPLEADOS' },
      api,
      none,
    )) as Array<Record<string, unknown>>;
    expect(getAllEmpleados).toHaveBeenCalledWith(null, 'E10');
    expect(rows[0]['SUELDO BRUTO MENSUAL']).toBe('1800');
  });

  it('managerul cu empleados și scope rămâne filtrat și primește fișa completă', async () => {
    const { api, getAllEmpleados } = listDeps(scope);
    const rows = (await loadEmpleadosForUser(
      { userId: 'M1', grupo: 'Manager', role: 'MANAGER', isManager: true },
      api,
      empleados,
    )) as Array<Record<string, unknown>>;
    expect(getAllEmpleados).toHaveBeenCalledWith(scope);
    expect(rows[0].DNI_NIE).toBe('12345678A');
  });

  it('Admin cu toate bifele false și cu scope primește lista completă', async () => {
    const { api, getAllEmpleados } = listDeps(scope);
    const rows = (await loadEmpleadosForUser(
      { userId: 'A1', grupo: 'Admin', role: 'ADMIN' },
      api,
      allDenied,
    )) as Array<Record<string, unknown>>;
    expect(getAllEmpleados).toHaveBeenCalledWith(null);
    expect(rows[0]['SUELDO BRUTO MENSUAL']).toBe('1800');
  });
});
