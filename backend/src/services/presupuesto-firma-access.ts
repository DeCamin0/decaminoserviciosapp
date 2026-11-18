import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'crypto';

/** 90 de zile de 24 de ore. Valabil și pentru token, și pentru fereastra linkurilor vechi. */
export const FIRMA_LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const MIN_SECRET_LENGTH = 32;
const IAT_FUTURE_SKEW_MS = 2 * 60 * 1000;
const TOKEN_VERSION = 1;

export type PresupuestoFirmaConfig = {
  secret: string | null;
  instanceId: string | null;
  /** null = versiunea nu a fost activată încă pe server. */
  activatedAt: Date | null;
  /** Data din mediu nu poate fi citită. Accesul public se închide. */
  activatedAtError: string | null;
  /** Activarea e setată, dar secretul sau instanța nu pot emite tokenuri. */
  mintError: string | null;
};

export type FirmaDenyReason =
  | 'token-invalid'
  | 'token-expired'
  | 'token-mismatch'
  | 'legacy-expired'
  | 'legacy-requires-token'
  | 'misconfigured'
  | 'missing-id'
  | 'needs-row';

export type FirmaAccessDecision =
  | { ok: true; id: number; mode: 'token' | 'legacy' }
  | { ok: false; reason: FirmaDenyReason };

/**
 * Citește configurația din mediu. Nu există secret implicit.
 * Perioada de tranziție începe la PRESUPUESTO_FIRMA_ACTIVATED_AT, nu la data codului.
 */
export const FIRMA_PURPOSE_PRESUPUESTO = 'presupuesto-firma-v1';
export const FIRMA_PURPOSE_PRESUPUESTO_V2 = 'presupuesto-v2-firma-v1';
export const FIRMA_PURPOSE_INFORME = 'informe-firma-v1';

function readFirmaEnvConfig(
  env: Record<string, string | undefined>,
  prefix: 'PRESUPUESTO_FIRMA' | 'INFORME_FIRMA',
): PresupuestoFirmaConfig {
  const secretRaw = (env[`${prefix}_SECRET`] ?? '').trim();
  const instanceRaw = (env[`${prefix}_INSTANCE`] ?? '').trim();
  const activatedRaw = (env[`${prefix}_ACTIVATED_AT`] ?? '').trim();
  const secret = secretRaw.length >= MIN_SECRET_LENGTH ? secretRaw : null;
  const instanceId = instanceRaw || null;

  if (!activatedRaw) {
    return {
      secret,
      instanceId,
      activatedAt: null,
      activatedAtError: null,
      mintError: null,
    };
  }

  const activatedAt = new Date(activatedRaw);
  if (Number.isNaN(activatedAt.getTime())) {
    return {
      secret: null,
      instanceId: null,
      activatedAt: null,
      activatedAtError: `${prefix}_ACTIVATED_AT no es una fecha ISO válida`,
      mintError: null,
    };
  }

  let mintError: string | null = null;
  if (!secret) {
    mintError = `${prefix}_SECRET falta o tiene menos de 32 caracteres. Use un secreto distinto en DeCamino y en Hera.`;
  } else if (!instanceId) {
    mintError = `${prefix}_INSTANCE falta. Defina un valor distinto en cada instancia.`;
  }

  return {
    secret,
    instanceId,
    activatedAt,
    activatedAtError: null,
    mintError,
  };
}

export function readPresupuestoFirmaConfig(
  env: Record<string, string | undefined>,
): PresupuestoFirmaConfig {
  return readFirmaEnvConfig(env, 'PRESUPUESTO_FIRMA');
}

export function readInformeFirmaConfig(
  env: Record<string, string | undefined>,
): PresupuestoFirmaConfig {
  return readFirmaEnvConfig(env, 'INFORME_FIRMA');
}

function signingKey(
  secret: string,
  instanceId: string,
  purpose: string,
): Buffer {
  return createHmac('sha256', secret)
    .update(`${purpose}:${instanceId}`)
    .digest();
}

function encodeUrl(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeUrl(value: string): Buffer | null {
  if (!value || /[^A-Za-z0-9_-]/.test(value)) return null;
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  try {
    const buffer = Buffer.from(padded, 'base64');
    if (encodeUrl(buffer) !== value) return null;
    return buffer;
  } catch {
    return null;
  }
}

export function createFirmaToken(
  config: PresupuestoFirmaConfig,
  presupuestoId: number,
  issuedAt: Date,
  purpose: string = FIRMA_PURPOSE_PRESUPUESTO,
): string {
  if (
    !config.secret ||
    !config.instanceId ||
    !Number.isInteger(presupuestoId) ||
    presupuestoId <= 0
  ) {
    throw new Error(
      config.mintError ||
        'No se puede emitir el token de firma para esta instancia',
    );
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    signingKey(config.secret, config.instanceId, purpose),
    iv,
  );
  const plain = Buffer.from(
    JSON.stringify({ id: presupuestoId, iat: issuedAt.getTime() }),
    'utf8',
  );
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return encodeUrl(
    Buffer.concat([Buffer.from([TOKEN_VERSION]), iv, tag, encrypted]),
  );
}

export function verifyFirmaToken(
  token: string,
  config: PresupuestoFirmaConfig,
  now: Date,
  purpose: string = FIRMA_PURPOSE_PRESUPUESTO,
):
  | { ok: true; id: number; issuedAt: Date }
  | { ok: false; reason: 'token-invalid' | 'token-expired' } {
  if (!config.secret || !config.instanceId) {
    return { ok: false, reason: 'token-invalid' };
  }
  const packed = decodeUrl(token.trim());
  if (
    !packed ||
    packed.length < 1 + 12 + 16 + 2 ||
    packed[0] !== TOKEN_VERSION
  ) {
    return { ok: false, reason: 'token-invalid' };
  }
  const iv = packed.subarray(1, 13);
  const tag = packed.subarray(13, 29);
  const encrypted = packed.subarray(29);
  let plain: Buffer;
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      signingKey(config.secret, config.instanceId, purpose),
      iv,
    );
    decipher.setAuthTag(tag);
    plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch {
    return { ok: false, reason: 'token-invalid' };
  }

  let parsed: { id?: unknown; iat?: unknown };
  try {
    parsed = JSON.parse(plain.toString('utf8'));
  } catch {
    return { ok: false, reason: 'token-invalid' };
  }
  const id = parsed.id;
  const iat = parsed.iat;
  if (!Number.isInteger(id) || (id as number) <= 0) {
    return { ok: false, reason: 'token-invalid' };
  }
  if (typeof iat !== 'number' || !Number.isFinite(iat)) {
    return { ok: false, reason: 'token-invalid' };
  }
  if (iat > now.getTime() + IAT_FUTURE_SKEW_MS) {
    return { ok: false, reason: 'token-invalid' };
  }
  if (now.getTime() >= iat + FIRMA_LINK_TTL_MS) {
    return { ok: false, reason: 'token-expired' };
  }
  return { ok: true, id: id as number, issuedAt: new Date(iat) };
}

/**
 * Token prezent (inclusiv gol sau expirat): nu se folosește niciodată compatibilitatea linkului vechi.
 * Token absent: link vechi, doar pentru bugete create înainte de activare și doar 90 de zile de la activare.
 */
export function resolveFirmaAccess(input: {
  token: string | null;
  requestedId: number | null;
  createdAt: Date | null;
  config: PresupuestoFirmaConfig;
  now: Date;
  purpose?: string;
}): FirmaAccessDecision {
  if (input.config.activatedAtError) {
    return { ok: false, reason: 'misconfigured' };
  }

  if (input.token !== null) {
    const verified = verifyFirmaToken(
      input.token,
      input.config,
      input.now,
      input.purpose || FIRMA_PURPOSE_PRESUPUESTO,
    );
    if (verified.ok === false) {
      return { ok: false, reason: verified.reason };
    }
    if (input.requestedId !== null && input.requestedId !== verified.id) {
      return { ok: false, reason: 'token-mismatch' };
    }
    return { ok: true, id: verified.id, mode: 'token' };
  }

  if (
    input.requestedId === null ||
    !Number.isInteger(input.requestedId) ||
    input.requestedId <= 0
  ) {
    return { ok: false, reason: 'missing-id' };
  }

  if (input.config.activatedAt === null) {
    return { ok: true, id: input.requestedId, mode: 'legacy' };
  }

  if (
    input.now.getTime() >=
    input.config.activatedAt.getTime() + FIRMA_LINK_TTL_MS
  ) {
    return { ok: false, reason: 'legacy-expired' };
  }

  if (input.createdAt === null) {
    return { ok: false, reason: 'needs-row' };
  }

  if (input.createdAt.getTime() >= input.config.activatedAt.getTime()) {
    return { ok: false, reason: 'legacy-requires-token' };
  }

  return { ok: true, id: input.requestedId, mode: 'legacy' };
}

export function buildPresupuestoFirmarUrl(
  baseUrl: string,
  presupuestoId: number,
  config: PresupuestoFirmaConfig,
  now: Date,
): string {
  const base = baseUrl.replace(/\/+$/g, '');
  if (config.activatedAtError) {
    throw new Error(config.activatedAtError);
  }
  if (config.activatedAt === null) {
    return `${base}/firmar.html?id=${presupuestoId}`;
  }
  if (config.mintError || !config.secret || !config.instanceId) {
    throw new Error(
      config.mintError ||
        'No se puede emitir el token de firma para esta instancia',
    );
  }
  const token = createFirmaToken(
    config,
    presupuestoId,
    now,
    FIRMA_PURPOSE_PRESUPUESTO,
  );
  return `${base}/firmar.html?t=${encodeURIComponent(token)}`;
}

/** Enlace de firma para un presupuesto V2. Siempre con token; el id no se publica. */
export function buildPresupuestoV2FirmarUrl(
  baseUrl: string,
  presupuestoId: number,
  config: PresupuestoFirmaConfig,
  now: Date,
): string {
  const base = baseUrl.replace(/\/+$/g, '');
  if (config.activatedAtError) {
    throw new Error(config.activatedAtError);
  }
  if (config.mintError || !config.secret || !config.instanceId) {
    throw new Error(
      config.mintError ||
        'No se puede emitir el token de firma para esta instancia',
    );
  }
  const token = createFirmaToken(
    config,
    presupuestoId,
    now,
    FIRMA_PURPOSE_PRESUPUESTO_V2,
  );
  return `${base}/firmar.html?t=${encodeURIComponent(token)}`;
}

export function buildInformeFirmarUrl(
  baseUrl: string,
  informeId: number,
  config: PresupuestoFirmaConfig,
  now: Date,
): string {
  const base = baseUrl.replace(/\/+$/g, '');
  if (config.activatedAtError) {
    throw new Error(config.activatedAtError);
  }
  if (config.activatedAt === null) {
    return `${base}/firmar-informe.html?id=${informeId}`;
  }
  if (config.mintError || !config.secret || !config.instanceId) {
    throw new Error(
      config.mintError ||
        'No se puede emitir el token de firma para esta instancia',
    );
  }
  const token = createFirmaToken(config, informeId, now, FIRMA_PURPOSE_INFORME);
  return `${base}/firmar-informe.html?t=${encodeURIComponent(token)}`;
}
