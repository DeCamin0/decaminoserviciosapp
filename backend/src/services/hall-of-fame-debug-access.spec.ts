import { canDebugCuadrante } from './hall-of-fame-debug-access';

describe('hall of fame debug access', () => {
  it('fără sesiune nu se poate deschide debug-ul de cuadrante', () => {
    expect(canDebugCuadrante(null)).toBe(false);
    expect(canDebugCuadrante(undefined)).toBe(false);
  });

  it('un angajat autentificat nu primește debug-ul', () => {
    expect(canDebugCuadrante({ grupo: 'Operario', role: 'EMPLEADOS' })).toBe(
      false,
    );
    expect(canDebugCuadrante({ grupo: 'Admin', role: 'ADMIN' })).toBe(false);
    expect(canDebugCuadrante({ grupo: 'Manager', role: 'MANAGER' })).toBe(
      false,
    );
  });

  it('Developer păstrează debug-ul, clasamentele nu sunt atinse de regula asta', () => {
    expect(canDebugCuadrante({ grupo: 'Developer', role: 'DEVELOPER' })).toBe(
      true,
    );
    expect(canDebugCuadrante({ role: 'DEVELOPER' })).toBe(true);
  });
});
