import { ForbiddenException } from '@nestjs/common';
import {
  assertCanMutateNominas,
  assertExportAllNominas,
  assertNominaRowAccess,
  assertOwnOrManagedNombre,
  assertUnscopedEmployeeExport,
  canManageNominas,
  nominasListScope,
} from './nominas-access-policy';

const employee = {
  userId: 'E10',
  grupo: 'Operario',
  role: 'EMPLEADOS',
  isManager: false,
};

const manager = {
  userId: 'M1',
  grupo: 'Manager',
  role: 'MANAGER',
  isManager: true,
};

const admin = {
  userId: 'A1',
  grupo: 'Admin',
  role: 'ADMIN',
  isManager: true,
};

describe('nominas access policy', () => {
  it('angajatul primește doar propriul codigo, chiar dacă schimbă parametrii', () => {
    expect(
      nominasListScope(
        employee,
        { codigo: 'VICTIM', nombre: 'Otra Persona' },
        false,
      ),
    ).toEqual({ codigo: 'E10' });
  });

  it('fără codigo în token nu se listează nóminas', () => {
    expect(() =>
      nominasListScope({ grupo: 'Operario' }, { codigo: 'E10' }, false),
    ).toThrow(ForbiddenException);
  });

  it('administratorul fără bifă păstrează lista; managerul fără bifă rămâne pe propriul cod', () => {
    expect(
      nominasListScope(admin, { codigo: 'E10', nombre: 'Ana Lopez' }, false),
    ).toEqual({ codigo: 'E10', nombre: 'Ana Lopez' });
    expect(
      nominasListScope(manager, { codigo: 'E10', nombre: 'Ana Lopez' }, false),
    ).toEqual({ codigo: 'M1' });
  });

  it('supervisorul fără bifa de documente nu primește nóminas din numele grupului', () => {
    expect(
      canManageNominas(
        {
          userId: 'S1',
          grupo: 'Supervisor',
          role: 'EMPLEADOS',
          isManager: false,
        },
        false,
      ),
    ).toBe(false);
  });

  it('un grup cu permisia de documente ale angajaților păstrează accesul', () => {
    const rrhh = {
      userId: 'R1',
      grupo: 'RRHH',
      role: 'EMPLEADOS',
      isManager: false,
    };
    expect(canManageNominas(rrhh, true)).toBe(true);
    expect(
      nominasListScope(rrhh, { codigo: 'E10', nombre: 'Ana' }, true),
    ).toEqual({ codigo: 'E10', nombre: 'Ana' });
  });

  it('fără permisie, același grup nu poate lista alt codigo', () => {
    const rrhh = {
      userId: 'R1',
      grupo: 'RRHH',
      role: 'EMPLEADOS',
      isManager: false,
    };
    expect(canManageNominas(rrhh, false)).toBe(false);
    expect(nominasListScope(rrhh, { codigo: 'E10' }, false)).toEqual({
      codigo: 'R1',
    });
  });

  it('angajatul nu descarcă nómina altui codigo, nici dacă id-ul este al lui', () => {
    expect(() =>
      assertNominaRowAccess(employee, { codigo_empleado: 'VICTIM' }, false),
    ).toThrow(ForbiddenException);
  });

  it('angajatul își descarcă propria nómina, inclusiv rândul vechi cu nume unic', () => {
    expect(() =>
      assertNominaRowAccess(employee, { codigo_empleado: 'E10' }, false),
    ).not.toThrow();
    expect(() =>
      assertNominaRowAccess(employee, { codigo_empleado: null }, false, [
        'E10',
      ]),
    ).not.toThrow();
  });

  it('rândul vechi fără codigo este refuzat când două persoane au același nume', () => {
    expect(() =>
      assertNominaRowAccess(employee, { codigo_empleado: null }, false, [
        'E10',
        'E11',
      ]),
    ).toThrow(ForbiddenException);
  });

  it('angajatul nu exportă toate nóminas și nu exportă dosarul altcuiva', () => {
    expect(() => assertExportAllNominas(employee, false)).toThrow(
      ForbiddenException,
    );
    expect(() => assertExportAllNominas(manager, false)).toThrow(
      ForbiddenException,
    );
    expect(() => assertExportAllNominas(admin, false)).not.toThrow();
    expect(() =>
      assertUnscopedEmployeeExport(employee, 'VICTIM', false),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertUnscopedEmployeeExport(employee, 'E10', false),
    ).not.toThrow();
    expect(() =>
      assertUnscopedEmployeeExport(admin, 'E10', false),
    ).not.toThrow();
  });

  it('angajatul și managerul fără bifă nu încarcă nóminas; administratorul da', () => {
    expect(() => assertCanMutateNominas(employee, false)).toThrow(
      ForbiddenException,
    );
    expect(() => assertCanMutateNominas(manager, false)).toThrow(
      ForbiddenException,
    );
    expect(() => assertCanMutateNominas(manager, true)).not.toThrow();
    expect(() => assertCanMutateNominas(admin, false)).not.toThrow();
  });

  it('descărcarea din gestoría după nume rămâne la propriul nume pentru angajat', () => {
    expect(() =>
      assertOwnOrManagedNombre(employee, 'Otra Persona', 'Ana Lopez', false),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertOwnOrManagedNombre(employee, 'Ana Lopez', 'Ana Lopez', false),
    ).not.toThrow();
    expect(() =>
      assertOwnOrManagedNombre(
        employee,
        'FINIQUITO - Ana Lopez',
        'Ana Lopez',
        false,
      ),
    ).not.toThrow();
    expect(() =>
      assertOwnOrManagedNombre(manager, 'Otra Persona', 'Jefe', false),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertOwnOrManagedNombre(admin, 'Otra Persona', 'Admin', false),
    ).not.toThrow();
  });

  it('managerul și administratorul pot descărca nómina oricărui id', () => {
    for (const actor of [manager, admin]) {
      expect(() =>
        assertNominaRowAccess(actor, { codigo_empleado: 'E10' }, true),
      ).not.toThrow();
    }
  });
});
