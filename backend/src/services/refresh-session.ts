import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** '30m', '2h', '7d'. La o valoare necunoscută se folosește fallback-ul. */
export function refreshTtlMs(spec: string, fallbackMs: number): number {
  const match = /^(\d+)([smhd])$/.exec(String(spec || '').trim());
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return fallbackMs;
  return amount * UNIT_MS[match[2]];
}

export type RefreshSessionRow = {
  userCodigo: string;
  revokedAt: Date | null;
  expiresAt: Date;
};

export function decideRefreshSession(input: {
  sid: unknown;
  userId: unknown;
  session: RefreshSessionRow | null;
  now: Date;
}):
  | { ok: true }
  | {
      ok: false;
      reason: 'missing-sid' | 'missing' | 'revoked' | 'expired' | 'mismatch';
    } {
  if (typeof input.sid !== 'string' || input.sid.trim() === '') {
    return { ok: false, reason: 'missing-sid' };
  }
  if (!input.session) return { ok: false, reason: 'missing' };
  if (input.session.revokedAt) return { ok: false, reason: 'revoked' };
  if (input.session.expiresAt.getTime() <= input.now.getTime()) {
    return { ok: false, reason: 'expired' };
  }
  if (
    typeof input.userId !== 'string' ||
    input.session.userCodigo !== input.userId
  ) {
    return { ok: false, reason: 'mismatch' };
  }
  return { ok: true };
}

export async function createRefreshSession(
  prisma: PrismaService,
  input: {
    userCodigo: string;
    expiresAt: Date;
    impersonation?: boolean;
    impersonatedBy?: string | null;
  },
): Promise<string> {
  const id = randomUUID();
  await prisma.authRefreshSession.create({
    data: {
      id,
      userCodigo: input.userCodigo,
      expiresAt: input.expiresAt,
      impersonation: input.impersonation === true,
      impersonatedBy: input.impersonatedBy ?? null,
    },
  });
  return id;
}

export async function findRefreshSession(
  prisma: PrismaService,
  id: string,
): Promise<RefreshSessionRow | null> {
  return prisma.authRefreshSession.findUnique({
    where: { id },
    select: { userCodigo: true, revokedAt: true, expiresAt: true },
  });
}

export async function revokeRefreshSession(
  prisma: PrismaService,
  id: string,
): Promise<void> {
  await prisma.authRefreshSession.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllRefreshSessions(
  prisma: PrismaService,
  userCodigo: string,
): Promise<void> {
  await prisma.authRefreshSession.updateMany({
    where: { userCodigo, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
