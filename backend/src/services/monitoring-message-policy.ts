import { ForbiddenException } from '@nestjs/common';

const STAFF_GRUPOS = new Set(['Admin', 'Developer', 'Manager', 'Supervisor']);
const STAFF_ROLES = new Set(['ADMIN', 'DEVELOPER', 'MANAGER']);

export type MonitoringActor = {
  userId?: string;
  email?: string;
  grupo?: string;
  role?: string;
  isManager?: boolean;
};

export function isMonitoringStaff(
  actor: MonitoringActor | null | undefined,
): boolean {
  const grupo = String(actor?.grupo || '').trim();
  const role = String(actor?.role || '')
    .trim()
    .toUpperCase();
  return (
    actor?.isManager === true ||
    STAFF_GRUPOS.has(grupo) ||
    STAFF_ROLES.has(role)
  );
}

export function escapeMonitoringHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/** Emailul de confirmare pleacă doar către adresa din sesiune. */
export function bannerConfirmationRecipient(
  actor: MonitoringActor | null | undefined,
  requestedEmail: string | null | undefined,
): string {
  const tokenEmail = normalizeEmail(actor?.email);
  const requested = normalizeEmail(requestedEmail);
  if (!tokenEmail || !requested || tokenEmail !== requested) {
    throw new ForbiddenException(
      'No puedes enviar este correo a otro destinatario',
    );
  }
  return String(requestedEmail).trim();
}

/**
 * Raportul din portal folosește botul general.
 * Doar staff-ul poate alege botul de gestoría.
 */
export function resolveTelegramBot(
  actor: MonitoringActor | null | undefined,
  requested: string | null | undefined,
): 'gestoria' | 'general' {
  if (!isMonitoringStaff(actor)) return 'general';
  return requested === 'general' ? 'general' : 'gestoria';
}

export function assertHealthTelegramTest(
  actor: MonitoringActor | null | undefined,
): void {
  if (!isMonitoringStaff(actor)) {
    throw new ForbiddenException(
      'Solo el personal autorizado puede enviar un mensaje de prueba',
    );
  }
}
