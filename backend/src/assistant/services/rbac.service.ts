import { Injectable, Logger } from '@nestjs/common';
import { AssistantDataScope } from '../constants/assistant-data-scope.const';

export { AssistantDataScope } from '../constants/assistant-data-scope.const';

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
    return this.accessLevelFromRole(rol);
  }

  /**
   * Scope canonic pentru assistant: ALL vs OWN (aceeași hartă ca AccessLevel).
   */
  resolveDataScope(rol: string | null | undefined): AssistantDataScope {
    return this.accessLevelFromRole(rol) === AccessLevel.FULL_ACCESS
      ? AssistantDataScope.ALL
      : AssistantDataScope.OWN;
  }

  /**
   * Scope efectiv: override explicit (ex. teste) sau derivat din rol.
   */
  effectiveDataScope(
    rol: string | null | undefined,
    explicitScope?: AssistantDataScope,
  ): AssistantDataScope {
    /** Empleado / rol necunoscut: mereu OWN, chiar dacă cineva trimite ALL explicit. */
    if (this.resolveDataScope(rol) === AssistantDataScope.OWN) {
      return AssistantDataScope.OWN;
    }
    return explicitScope ?? AssistantDataScope.ALL;
  }

  private accessLevelFromRole(rol: string | null | undefined): AccessLevel {
    if (!rol) {
      this.logger.warn(
        '⚠️ Rol necunoscut sau lipsă, aplicând mod Empleado (fail-closed)',
      );
      return AccessLevel.OWN_DATA_ONLY;
    }

    const rolNormalized = rol.toLowerCase().trim();

    if (
      rolNormalized === 'supervisor' ||
      rolNormalized === 'admin' ||
      rolNormalized === 'manager' ||
      rolNormalized === 'jefe' ||
      rolNormalized === 'developer'
    ) {
      return AccessLevel.FULL_ACCESS;
    }

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
    if (this.resolveDataScope(currentUserRol) === AssistantDataScope.ALL) {
      return true;
    }
    return currentUserId === targetUserId;
  }

  /**
   * Construiește condiția SQL pentru filtrare bazată pe RBAC / scope assistant.
   * @param explicitScope opțional — același scope pe care îl primesc tool-urile (override față de rol).
   */
  buildRbacCondition(
    userId: string,
    rol: string | null | undefined,
    codigoColumn: string = 'CODIGO',
    explicitScope?: AssistantDataScope,
  ): string {
    const scope = this.effectiveDataScope(rol, explicitScope);

    if (scope === AssistantDataScope.ALL) {
      return '1=1';
    }

    return `${codigoColumn} = ${this.escapeSql(userId)}`;
  }

  private escapeSql(value: string): string {
    if (!value) return "''";
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
  }
}
