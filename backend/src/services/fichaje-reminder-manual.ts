import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import {
  canManageOtherFichajes,
  type EmpleadoActor,
  type EmpleadoModuleFlags,
} from './empleados-operation-access';

/**
 * Query-ul cererii manuale. Lipsa parametrului rămâne previzualizare.
 * Doar valorile explicite false/0/no/off cer trimitere reală.
 */
export function wantsRealReminderSend(dryRunQuery: unknown): boolean {
  if (dryRunQuery == null || String(dryRunQuery).trim() === '') return false;
  return ['0', 'false', 'no', 'off'].includes(
    String(dryRunQuery).trim().toLowerCase(),
  );
}

/** Admin/Developer sau bifa `fichar-admin`. Aruncă înainte de scanare. */
export function assertManualReminderPermission(
  actor: EmpleadoActor | null | undefined,
  flags: EmpleadoModuleFlags,
): void {
  if (!canManageOtherFichajes(actor, flags)) {
    throw new ForbiddenException(
      'No tienes permiso para lanzar recordatorios de fichaje.',
    );
  }
}

/**
 * Previzualizarea rămâne disponibilă.
 * Trimiterea reală cere cronul pornit și nu poate trece peste dry-run-ul din mediu.
 */
export function resolveManualReminderMode(input: {
  requestedReal: boolean;
  enabled: boolean;
  envForcesDryRun: boolean;
}): { dryRun: boolean } {
  if (!input.requestedReal) return { dryRun: true };
  if (!input.enabled) {
    throw new ForbiddenException(
      'El envío de recordatorios está desactivado en el servidor.',
    );
  }
  if (input.envForcesDryRun) {
    throw new ForbiddenException(
      'El servidor está en modo de prueba y no envía notificaciones.',
    );
  }
  return { dryRun: false };
}

/**
 * null = toată firma (Admin/Developer sau niciun rând de scope).
 * Lista, inclusiv goală, limitează destinatarii.
 */
export function reminderAudienceCodigos(
  bypass: boolean,
  hasScopeRows: boolean,
  listed: string[] | null | undefined,
): string[] | null {
  if (bypass || !hasScopeRows) return null;
  return listed ?? [];
}

export function restrictReminderRows<T extends { codigo: string }>(
  rows: T[],
  allowedCodigos: string[] | null | undefined,
): T[] {
  if (allowedCodigos == null) return rows;
  const set = new Set(
    allowedCodigos.map((codigo) => String(codigo).trim()).filter(Boolean),
  );
  return rows.filter((row) => set.has(String(row.codigo || '').trim()));
}

/**
 * Doar pentru apelurile manuale. Cronul nu trece prin această limită.
 * Un al doilea apel al aceluiași utilizator, cât timp primul lucrează, este refuzat.
 * Trimiterea reală are pauză; previzualizarea nu.
 */
export class ManualReminderLimiter {
  private readonly inFlight = new Set<string>();
  private readonly lastRealAt = new Map<string, number>();

  start(userId: string, real: boolean, now: number, cooldownMs: number): void {
    const id = String(userId || '').trim();
    if (!id) {
      throw new ForbiddenException('Sesión inválida');
    }
    if (this.inFlight.has(id)) {
      throw new HttpException(
        'Ya hay un recordatorio en curso. Espera a que termine.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (real) {
      const last = this.lastRealAt.get(id);
      if (last != null && now - last < cooldownMs) {
        const waitMin = Math.max(
          1,
          Math.ceil((cooldownMs - (now - last)) / 60000),
        );
        throw new HttpException(
          `Espera unos ${waitMin} min antes de volver a enviar recordatorios.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    this.inFlight.add(id);
  }

  finish(userId: string, armRealCooldown: boolean, now: number): void {
    const id = String(userId || '').trim();
    this.inFlight.delete(id);
    if (armRealCooldown && id) this.lastRealAt.set(id, now);
  }
}
