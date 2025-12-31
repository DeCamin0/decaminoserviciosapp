import { Injectable, Logger } from '@nestjs/common';

export enum UserRole {
  EMPLEADO = 'empleado',
  SUPERVISOR = 'supervisor',
  ADMIN = 'admin',
  MANAGER = 'manager',
  JEFE = 'jefe',
}

export enum AccessLevel {
  OWN_DATA_ONLY = 'own_data_only', // Doar propriile date
  FULL_ACCESS = 'full_access', // Acces total
}

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  /**
   * Determină nivelul de acces bazat pe rol
   * RBAC: Empleado = doar propriile date, Supervisor/Admin/Manager/Jefe = acces total
   * Fail-closed: rol necunoscut → mod Empleado
   */
  getAccessLevel(rol: string | null | undefined): AccessLevel {
    if (!rol) {
      this.logger.warn(
        '⚠️ Rol necunoscut sau lipsă, aplicând mod Empleado (fail-closed)',
      );
      return AccessLevel.OWN_DATA_ONLY;
    }

    const rolNormalized = rol.toLowerCase().trim();

    // Supervisor, Admin, Manager, Jefe → acces total
    if (
      rolNormalized === 'supervisor' ||
      rolNormalized === 'admin' ||
      rolNormalized === 'manager' ||
      rolNormalized === 'jefe' ||
      rolNormalized === 'developer'
    ) {
      return AccessLevel.FULL_ACCESS;
    }

    // Empleado sau orice alt rol necunoscut → doar propriile date (fail-closed)
    this.logger.log(`✅ Rol "${rol}" → Acces: OWN_DATA_ONLY`);
    return AccessLevel.OWN_DATA_ONLY;
  }

  /**
   * Verifică dacă utilizatorul are acces la datele unui alt utilizator
   */
  canAccessUserData(
    currentUserId: string,
    targetUserId: string,
    currentUserRol: string | null | undefined,
  ): boolean {
    const accessLevel = this.getAccessLevel(currentUserRol);

    // Acces total → poate accesa orice
    if (accessLevel === AccessLevel.FULL_ACCESS) {
      return true;
    }

    // Doar propriile date → doar dacă e același utilizator
    return currentUserId === targetUserId;
  }

  /**
   * Construiește condiția SQL pentru filtrare bazată pe RBAC
   */
  buildRbacCondition(
    userId: string,
    rol: string | null | undefined,
    codigoColumn: string = 'CODIGO',
  ): string {
    const accessLevel = this.getAccessLevel(rol);

    if (accessLevel === AccessLevel.FULL_ACCESS) {
      // Acces total → fără restricții
      return '1=1';
    }

    // Doar propriile date → filtrează după CODIGO
    return `${codigoColumn} = ${this.escapeSql(userId)}`;
  }

  private escapeSql(value: string): string {
    if (!value) return "''";
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
  }
}
