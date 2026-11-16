import { ForbiddenException } from '@nestjs/common';
import {
  guardSolicitudCreate,
  guardSolicitudDelete,
  guardSolicitudUpdate,
} from './solicitudes-actor-policy';

const employee = {
  userId: 'E10',
  email: 'ana@decamino.test',
  role: 'EMPLEADOS',
  grupo: 'Operario',
  isManager: false,
};

const manager = {
  userId: 'M1',
  email: 'jefe@decamino.test',
  role: 'MANAGER',
  grupo: 'Manager',
  isManager: true,
  solicitudesAdmin: true,
};

const supervisor = {
  userId: 'S1',
  email: 'sup@decamino.test',
  role: 'MANAGER',
  grupo: 'Supervisor',
  isManager: true,
  solicitudesAdmin: true,
};

const admin = {
  userId: 'A1',
  email: 'admin@decamino.test',
  role: 'ADMIN',
  grupo: 'Admin',
  isManager: true,
};

describe('solicitud actor policy', () => {
  it('angajatul nu poate crea în numele altcuiva și nu poate forța origen MANAGER', () => {
    const guarded = guardSolicitudCreate(employee, {
      id: '1',
      codigo: 'VICTIM',
      email: 'victim@decamino.test',
      nombre: 'Victima',
      tipo: 'Vacaciones',
      estado: 'Aprobada',
      origen: 'MANAGER',
      creado_por: 'Atac',
      creado_por_email: 'atac@decamino.test',
    });

    expect(guarded.codigo).toBe('E10');
    expect(guarded.email).toBe('ana@decamino.test');
    expect(guarded.origen).toBe('EMPLEADO');
    expect(guarded.creado_por).toBeUndefined();
    expect(guarded.estado).toBe('Aprobada');
  });

  it('angajatul nu poate aproba tipurile care cer aprobare de manager', () => {
    for (const tipo of [
      'BAJA_VOLUNTARIA',
      'Permiso Retribuido',
      'Ausencias justificada',
    ]) {
      const guarded = guardSolicitudCreate(employee, {
        tipo,
        estado: 'Aprobada',
        origen: 'MANAGER',
        codigo: 'VICTIM',
        email: 'victim@decamino.test',
      });
      expect(guarded.estado).toBe('Pendiente');
      expect(guarded.origen).toBe('EMPLEADO');
      expect(guarded.codigo).toBe('E10');
    }
  });

  it('managerul fără bifa solicitudes-admin rămâne pe propria cerere', () => {
    const plain = { ...manager, solicitudesAdmin: false };
    const guarded = guardSolicitudCreate(plain, {
      codigo: 'VICTIM',
      email: 'victim@decamino.test',
      tipo: 'Permiso Retribuido',
      estado: 'Aprobada',
      origen: 'MANAGER',
    });
    expect(guarded.codigo).toBe('M1');
    expect(guarded.estado).toBe('Pendiente');
    expect(guarded.origen).toBe('EMPLEADO');
  });

  it('managerul, supervisorul și administratorul cu drept pot crea și aproba pentru alt angajat', () => {
    for (const actor of [manager, supervisor, admin]) {
      const guarded = guardSolicitudCreate(actor, {
        codigo: 'E10',
        email: 'ana@decamino.test',
        tipo: 'Permiso Retribuido',
        estado: 'Aprobada',
        origen: 'MANAGER',
        creado_por: 'Responsable',
      });
      expect(guarded.codigo).toBe('E10');
      expect(guarded.email).toBe('ana@decamino.test');
      expect(guarded.estado).toBe('Aprobada');
      expect(guarded.origen).toBe('MANAGER');
      expect(guarded.creado_por).toBe('Responsable');
    }
  });

  it('angajatul nu poate modifica sau aproba solicitarea altcuiva', () => {
    expect(() =>
      guardSolicitudUpdate(
        employee,
        { codigo: 'VICTIM', estado: 'Pendiente', tipo: 'Vacaciones' },
        { codigo: 'VICTIM', estado: 'Aprobada' },
      ),
    ).toThrow(ForbiddenException);
  });

  it('angajatul nu poate trece în Aprobada un tip care așteaptă managerul', () => {
    expect(() =>
      guardSolicitudUpdate(
        employee,
        { codigo: 'E10', estado: 'Pendiente', tipo: 'Permiso Retribuido' },
        { estado: 'Aprobada', codigo: 'VICTIM', email: 'victim@decamino.test' },
      ),
    ).toThrow(ForbiddenException);
  });

  it('angajatul își poate edita propria vacanță deja aprobată, fără să schimbe identitatea', () => {
    const guarded = guardSolicitudUpdate(
      employee,
      { codigo: 'E10', estado: 'Aprobada', tipo: 'Vacaciones' },
      {
        estado: 'Aprobada',
        codigo: 'VICTIM',
        email: 'victim@decamino.test',
        nombre: 'Victima',
        motivo: 'Cita',
      },
    );
    expect(guarded.codigo).toBeUndefined();
    expect(guarded.email).toBeUndefined();
    expect(guarded.nombre).toBeUndefined();
    expect(guarded.estado).toBe('Aprobada');
    expect(guarded.motivo).toBe('Cita');
  });

  it('angajatul nu poate respinge o solicitare', () => {
    expect(() =>
      guardSolicitudUpdate(
        employee,
        { codigo: 'E10', estado: 'Pendiente', tipo: 'Vacaciones' },
        { estado: 'Rechazada' },
      ),
    ).toThrow(ForbiddenException);
  });

  it('managerul și administratorul pot aproba orice solicitare', () => {
    for (const actor of [manager, admin]) {
      const guarded = guardSolicitudUpdate(
        actor,
        { codigo: 'E10', estado: 'Pendiente', tipo: 'BAJA_VOLUNTARIA' },
        { estado: 'Aprobada' },
      );
      expect(guarded.estado).toBe('Aprobada');
    }
  });

  it('angajatul nu poate șterge solicitarea altcuiva și o poate șterge doar pe a lui', () => {
    expect(() =>
      guardSolicitudDelete(employee, { codigo: 'VICTIM' }, 'VICTIM'),
    ).toThrow(ForbiddenException);

    expect(guardSolicitudDelete(employee, { codigo: 'E10' }, 'VICTIM')).toBe(
      'E10',
    );
  });

  it('administratorul poate șterge solicitarea unui angajat', () => {
    expect(guardSolicitudDelete(admin, { codigo: 'E10' }, 'E10')).toBe('E10');
  });

  it('fără identitate în token nu se creează, nu se modifică și nu se șterge', () => {
    expect(() => guardSolicitudCreate({}, { tipo: 'Vacaciones' })).toThrow(
      ForbiddenException,
    );
    expect(() =>
      guardSolicitudUpdate(null, { codigo: 'E10' }, { estado: 'Aprobada' }),
    ).toThrow(ForbiddenException);
    expect(() =>
      guardSolicitudDelete(undefined, { codigo: 'E10' }, 'E10'),
    ).toThrow(ForbiddenException);
  });
});
