import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SECRET_KEY =
  /password|contrase|token|enlace|reseturl|otp|secreto|hash/i;

function clip(value: unknown, max: number): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max);
}

function sanitizeDetails(
  details: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | undefined {
  if (!details) return undefined;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SECRET_KEY.test(key)) continue;
    if (typeof value === 'string' && /token=|restablecer-contrasena/i.test(value)) {
      continue;
    }
    safe[key] = value;
  }
  return safe as Prisma.InputJsonValue;
}

/** Scrie în Logs. Nu aruncă: jurnalul nu blochează acțiunea. */
export async function writeActivityLog(
  prisma: PrismaService,
  input: {
    action: string;
    user?: string | null;
    email?: string | null;
    grupo?: string | null;
    updateby?: string | null;
    url?: string | null;
    ip?: string | null;
    details?: Record<string, unknown> | null;
  },
): Promise<void> {
  try {
    await prisma.logs.create({
      data: {
        timestamp: new Date().toISOString(),
        action: String(input.action || 'unknown').slice(0, 100),
        user: clip(input.user, 100),
        email: clip(input.email, 255),
        grupo: clip(input.grupo, 100),
        updateby: clip(input.updateby, 2000),
        url: clip(input.url, 2000),
        ip: clip(input.ip, 100),
        details_json: sanitizeDetails(input.details),
      },
    });
  } catch {
    // ignorat
  }
}
