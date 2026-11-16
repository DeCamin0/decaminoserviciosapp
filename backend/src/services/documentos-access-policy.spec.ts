import { ForbiddenException } from '@nestjs/common';
import {
  assertDocumentoOwner,
  canManageDocumentos,
  canReadDocumentos,
  documentosDownloadScope,
  documentosListScope,
  documentosUploadOwner,
} from './documentos-access-policy';

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

describe('documentos access policy', () => {
  it('angajatul listează doar propriul codigo, chiar dacă schimbă id-ul sau emailul', () => {
    expect(
      documentosListScope(
        employee,
        { empleadoId: 'VICTIM', email: 'victim@example.com' },
        false,
      ),
    ).toEqual({ empleadoId: 'E10' });
  });

  it('descărcarea angajatului ignoră id-ul și emailul din query', () => {
    expect(
      documentosDownloadScope(
        employee,
        {
          empleadoId: 'VICTIM',
          email: 'victim@example.com',
          fileName: 'justificante.pdf',
        },
        false,
      ),
    ).toEqual({ empleadoId: 'E10', fileName: 'justificante.pdf' });
  });

  it('angajatul nu poate încărca pe alt codigo', () => {
    expect(() => documentosUploadOwner(employee, 'VICTIM', false)).toThrow(
      ForbiddenException,
    );
    expect(documentosUploadOwner(employee, '', false)).toBe('E10');
    expect(documentosUploadOwner(employee, 'E10', false)).toBe('E10');
  });

  it('angajatul poate șterge doar rândul propriu', () => {
    expect(() => assertDocumentoOwner(employee, 'VICTIM', false)).toThrow(
      ForbiddenException,
    );
    expect(() => assertDocumentoOwner(employee, '', false)).toThrow(
      ForbiddenException,
    );
    expect(() => assertDocumentoOwner(employee, 'E10', false)).not.toThrow();
  });

  it('fără codigo în token nu se listează documente', () => {
    expect(() =>
      documentosListScope({ grupo: 'Operario' }, { empleadoId: 'E10' }, false),
    ).toThrow(ForbiddenException);
  });

  it('administratorul fără bifă păstrează filtrul; managerul și supervisorul fără bifă rămân pe propriul cod', () => {
    const query = { empleadoId: 'E10', email: 'ana@example.com' };
    const supervisor = {
      userId: 'S1',
      grupo: 'Supervisor',
      role: 'EMPLEADOS',
      isManager: false,
    };
    expect(documentosListScope(admin, query, false)).toEqual(query);
    expect(documentosUploadOwner(admin, 'E10', false)).toBe('E10');
    expect(() => assertDocumentoOwner(admin, 'E10', false)).not.toThrow();
    for (const actor of [manager, supervisor]) {
      expect(documentosListScope(actor, query, false)).toEqual({
        empleadoId: actor.userId,
      });
      expect(() => documentosUploadOwner(actor, 'E10', false)).toThrow(
        ForbiddenException,
      );
      expect(() => assertDocumentoOwner(actor, 'E10', false)).toThrow(
        ForbiddenException,
      );
    }
  });

  it('un grup cu permisia de documente ale angajaților păstrează listarea, descărcarea, încărcarea și ștergerea', () => {
    const rrhh = {
      userId: 'R1',
      grupo: 'RRHH',
      role: 'EMPLEADOS',
      isManager: false,
    };
    expect(canManageDocumentos(rrhh, true)).toBe(true);
    expect(canReadDocumentos(rrhh, true, false)).toBe(true);
    expect(
      documentosListScope(
        rrhh,
        { empleadoId: 'E10', email: 'ana@example.com' },
        true,
      ),
    ).toEqual({ empleadoId: 'E10', email: 'ana@example.com' });
    expect(documentosUploadOwner(rrhh, 'E10', true)).toBe('E10');
    expect(() => assertDocumentoOwner(rrhh, 'E10', true)).not.toThrow();
  });

  it('cine administrează cererile poate vedea documentele cererii, dar nu le încarcă sau șterge pentru alt angajat', () => {
    const coordinador = {
      userId: 'C1',
      grupo: 'Coordinador',
      role: 'EMPLEADOS',
      isManager: false,
    };
    expect(canReadDocumentos(coordinador, false, true)).toBe(true);
    expect(canManageDocumentos(coordinador, false)).toBe(false);
    expect(
      documentosDownloadScope(
        coordinador,
        {
          empleadoId: 'E10',
          email: 'ana@example.com',
          fileName: 'justificante.pdf',
        },
        true,
      ),
    ).toEqual({
      empleadoId: 'E10',
      email: 'ana@example.com',
      fileName: 'justificante.pdf',
    });
    expect(() => documentosUploadOwner(coordinador, 'E10', false)).toThrow(
      ForbiddenException,
    );
    expect(() => assertDocumentoOwner(coordinador, 'E10', false)).toThrow(
      ForbiddenException,
    );
  });

  it('lipsa permisiunii nu acordă acces la documentele altora', () => {
    const rrhh = {
      userId: 'R1',
      grupo: 'RRHH',
      role: 'EMPLEADOS',
      isManager: false,
    };
    expect(canManageDocumentos(rrhh, false)).toBe(false);
    expect(
      documentosListScope(
        rrhh,
        { empleadoId: 'E10', email: 'ana@example.com' },
        false,
      ),
    ).toEqual({ empleadoId: 'R1' });
    expect(() => documentosUploadOwner(rrhh, 'E10', false)).toThrow(
      ForbiddenException,
    );
    expect(() => assertDocumentoOwner(rrhh, 'E10', false)).toThrow(
      ForbiddenException,
    );
  });
});
