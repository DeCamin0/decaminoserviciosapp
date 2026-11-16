import {
  canReadAllPermissions,
  canWritePermissions,
} from './permissions-access';

describe('permissions matrix access', () => {
  it('fără sesiune nu se poate scrie sau citi toată matricea', () => {
    expect(canWritePermissions(null, true)).toBe(false);
    expect(canReadAllPermissions(undefined, true)).toBe(false);
  });

  it('un angajat nu poate rescrie permisiunile', () => {
    const employee = { grupo: 'Operario', role: 'EMPLEADOS' };
    expect(canWritePermissions(employee, false)).toBe(false);
    expect(canReadAllPermissions(employee, false)).toBe(false);
  });

  it('managerul fără modulul admin nu administrează matricea', () => {
    const manager = { grupo: 'Manager', role: 'MANAGER' };
    expect(canWritePermissions(manager, false)).toBe(false);
  });

  it('Admin și Developer păstrează administrarea chiar dacă rândul lipsește', () => {
    expect(canWritePermissions({ grupo: 'Admin', role: 'ADMIN' }, false)).toBe(
      true,
    );
    expect(
      canWritePermissions({ grupo: 'Developer', role: 'DEVELOPER' }, false),
    ).toBe(true);
  });

  it('un grup cu modulul admin păstrează citirea completă și salvarea', () => {
    const custom = { grupo: 'RRHH', role: 'EMPLEADOS' };
    expect(canWritePermissions(custom, true)).toBe(true);
    expect(canReadAllPermissions(custom, true)).toBe(true);
    expect(canWritePermissions(custom, false)).toBe(false);
  });
});
