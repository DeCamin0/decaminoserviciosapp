import {
  canManageContractTypes,
  isContractTypeStaff,
} from './contract-types-access';

const employee = {
  userId: 'E10',
  grupo: 'Operario',
  role: 'EMPLEADOS',
  isManager: false,
};

describe('contract types access', () => {
  it('fără sesiune nu se pot gestiona tipurile de contract', () => {
    expect(canManageContractTypes(null, true)).toBe(false);
    expect(canManageContractTypes(undefined, false)).toBe(false);
  });

  it('un angajat fără permisiunea de angajați nu poate crea tipuri', () => {
    expect(canManageContractTypes(employee, false)).toBe(false);
    expect(isContractTypeStaff(employee)).toBe(false);
  });

  it('un grup cu permisiunea empleados păstrează crearea', () => {
    const rrhh = {
      userId: 'R1',
      grupo: 'RRHH',
      role: 'EMPLEADOS',
      isManager: false,
    };
    expect(canManageContractTypes(rrhh, true)).toBe(true);
    expect(canManageContractTypes(rrhh, false)).toBe(false);
  });

  it('administratorul și developerul păstrează gestiunea cu bifa false; managerul și supervisorul nu', () => {
    for (const actor of [
      { userId: 'A1', grupo: 'Admin', role: 'ADMIN', isManager: true },
      {
        userId: 'D1',
        grupo: 'Developer',
        role: 'DEVELOPER',
        isManager: true,
      },
    ]) {
      expect(canManageContractTypes(actor, false)).toBe(true);
    }
    expect(
      canManageContractTypes(
        { userId: 'M1', grupo: 'Manager', role: 'MANAGER', isManager: true },
        false,
      ),
    ).toBe(false);
    expect(
      canManageContractTypes(
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
});
