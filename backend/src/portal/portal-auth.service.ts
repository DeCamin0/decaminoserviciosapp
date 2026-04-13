import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../services/email.service';

function normalizeEmail(email: string): string {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Portal «general»: solo contactos con rol administrador y acceso al portal. */
const PORTAL_GESTOR_CARGO = 'administrador';

@Injectable()
export class PortalAuthService {
  private readonly logger = new Logger(PortalAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private otpPepper(): string {
    return (
      this.configService.get<string>('PORTAL_OTP_PEPPER') ||
      this.configService.get<string>('jwt.portalSecret') ||
      'portal-otp'
    );
  }

  private hashOtp(code: string): string {
    return crypto
      .createHash('sha256')
      .update(`${this.otpPepper()}:${code}`, 'utf8')
      .digest('hex');
  }

  private otpTtlMs(): number {
    const minutes = Number(
      this.configService.get<string>('PORTAL_OTP_TTL_MINUTES') || '10',
    );
    const safe =
      Number.isFinite(minutes) && minutes > 0 && minutes <= 30 ? minutes : 10;
    return safe * 60_000;
  }

  /**
   * OTP solo con `portal_token` (URL/QR de la comunidad): el mismo email puede existir
   * en varias comunidades; el token acota el cliente.
   */
  async requestCode(
    rawEmail: string,
    portalToken?: string | null,
  ): Promise<{ ok: true }> {
    const emailNorm = normalizeEmail(rawEmail);
    if (!emailNorm || !emailNorm.includes('@')) {
      throw new BadRequestException('Email no válido');
    }

    const tokenTrim = portalToken ? String(portalToken).trim() : '';
    if (tokenTrim.length < 16) {
      throw new BadRequestException(
        'El acceso al portal debe hacerse desde el enlace o código QR de su comunidad.',
      );
    }

    const cliente = await this.prisma.clientes.findFirst({
      where: { portal_invite_token: tokenTrim },
      select: { id: true },
    });
    if (!cliente) {
      this.logger.log(`[portal-otp] request-code: token inválido`);
      return { ok: true };
    }

    const candidatos = await this.prisma.clienteContacto.findMany({
      where: {
        cliente_id: cliente.id,
        acceso_portal: true,
        estado: 'activo',
        email: { not: null },
      },
      select: { id: true, email: true, nombre: true, cliente_id: true },
    });
    const matches = candidatos.filter(
      (c) => c.email && normalizeEmail(c.email) === emailNorm,
    );

    if (matches.length === 0) {
      this.logger.log(
        `[portal-otp] request-code: sin contacto para ${emailNorm} (cliente ${cliente.id})`,
      );
      return { ok: true };
    }
    if (matches.length > 1) {
      throw new BadRequestException(
        'Hay más de un contacto con el mismo email y acceso al portal en esta comunidad. Corrija los datos o desactive accesos duplicados.',
      );
    }

    const contacto = matches[0];
    const code = generateOtpCode();
    const codeHash = this.hashOtp(code);
    const expiresAt = new Date(Date.now() + this.otpTtlMs());

    await this.prisma.$transaction([
      this.prisma.portalOtpChallenge.updateMany({
        where: {
          contacto_id: contacto.id,
          consumed_at: null,
        },
        data: { consumed_at: new Date() },
      }),
      this.prisma.portalOtpChallenge.create({
        data: {
          contacto_id: contacto.id,
          code_hash: codeHash,
          expires_at: expiresAt,
        },
      }),
    ]);

    const company =
      this.configService.get<string>('COMPANY_LEGAL_NAME_SHORT') ||
      this.configService.get<string>('COMPANY_LEGAL_NAME') ||
      'De Camino';

    const html = `
      <p>Hola${contacto.nombre ? ` ${escapeHtml(contacto.nombre)}` : ''},</p>
      <p>Tu código de acceso al área de clientes de <strong>${escapeHtml(company)}</strong> es:</p>
      <p style="font-size:22px;font-weight:bold;letter-spacing:4px;">${escapeHtml(code)}</p>
      <p>Caduca en unos minutos. Si no has solicitado este acceso, ignora este mensaje.</p>
    `;

    try {
      await this.emailService.sendEmail(
        emailNorm,
        `Código de acceso — ${company}`,
        html,
      );
    } catch (e: any) {
      this.logger.error(`[portal-otp] fallo envío email: ${e?.message}`);
      throw new ServiceUnavailableException(
        'No se pudo enviar el email. Inténtelo más tarde o verifique la configuración SMTP.',
      );
    }

    return { ok: true };
  }

  async verifyCode(
    rawEmail: string,
    rawCode: string,
    portalToken?: string | null,
  ): Promise<{ accessToken: string; expiresIn: string }> {
    const emailNorm = normalizeEmail(rawEmail);
    const code = String(rawCode || '')
      .trim()
      .replace(/\s+/g, '');
    if (!emailNorm || !code || code.length < 6) {
      throw new BadRequestException('Email o código no válido');
    }

    const tokenTrim = portalToken ? String(portalToken).trim() : '';
    if (tokenTrim.length < 16) {
      throw new BadRequestException(
        'El acceso al portal debe hacerse desde el enlace o código QR de su comunidad.',
      );
    }

    const cliente = await this.prisma.clientes.findFirst({
      where: { portal_invite_token: tokenTrim },
      select: { id: true },
    });
    if (!cliente) {
      throw new BadRequestException('Código o email incorrecto');
    }
    const candidatos = await this.prisma.clienteContacto.findMany({
      where: {
        cliente_id: cliente.id,
        acceso_portal: true,
        estado: 'activo',
        email: { not: null },
      },
      select: { id: true, email: true, cliente_id: true },
    });
    const matches = candidatos.filter(
      (c) => c.email && normalizeEmail(c.email) === emailNorm,
    );
    if (matches.length !== 1) {
      throw new BadRequestException('Código o email incorrecto');
    }

    const contacto = matches[0];
    const codeHash = this.hashOtp(code);

    const challenge = await this.prisma.portalOtpChallenge.findFirst({
      where: {
        contacto_id: contacto.id,
        consumed_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { id: 'desc' },
    });

    if (!challenge) {
      throw new BadRequestException('Código caducado o ya utilizado');
    }

    const a = Buffer.from(challenge.code_hash, 'hex');
    const b = Buffer.from(codeHash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new BadRequestException('Código incorrecto');
    }

    await this.prisma.portalOtpChallenge.update({
      where: { id: challenge.id },
      data: { consumed_at: new Date() },
    });

    const expiresIn =
      this.configService.get<string>('jwt.portalExpiresIn') || '12h';
    const accessToken = await this.jwtService.signAsync(
      {
        typ: 'portal',
        contacto_id: contacto.id,
        cliente_id: contacto.cliente_id,
        email: emailNorm,
      },
      { expiresIn: expiresIn as StringValue },
    );

    return { accessToken, expiresIn };
  }

  /**
   * Contactos administrador con portal, una fila por comunidad (cliente_id),
   * solo clientes con enlace de portal configurado.
   */
  private async listAdminPortalContactsByEmail(emailNorm: string): Promise<
    Array<{
      id: number;
      cliente_id: number;
      nombre: string | null;
      portal_token: string;
      comunidad_nombre: string | null;
    }>
  > {
    const rows = await this.prisma.clienteContacto.findMany({
      where: {
        acceso_portal: true,
        estado: 'activo',
        email: { not: null },
        cargo_codigo: { not: null },
      },
      select: {
        id: true,
        cliente_id: true,
        nombre: true,
        email: true,
        cargo_codigo: true,
        cliente: {
          select: {
            NOMBRE_O_RAZON_SOCIAL: true,
            portal_invite_token: true,
          },
        },
      },
    });

    const byCliente = new Map<
      number,
      {
        id: number;
        cliente_id: number;
        nombre: string | null;
        portal_token: string;
        comunidad_nombre: string | null;
      }
    >();

    for (const r of rows) {
      if (String(r.cargo_codigo || '').toLowerCase() !== PORTAL_GESTOR_CARGO) {
        continue;
      }
      if (!r.email || normalizeEmail(r.email) !== emailNorm) continue;
      const token = r.cliente?.portal_invite_token
        ? String(r.cliente.portal_invite_token).trim()
        : '';
      if (token.length < 16) continue;
      const nombreCom = r.cliente?.NOMBRE_O_RAZON_SOCIAL?.trim() || null;
      if (!byCliente.has(r.cliente_id)) {
        byCliente.set(r.cliente_id, {
          id: r.id,
          cliente_id: r.cliente_id,
          nombre: r.nombre,
          portal_token: token,
          comunidad_nombre: nombreCom,
        });
      }
    }

    return [...byCliente.values()].sort((a, b) =>
      (a.comunidad_nombre || '').localeCompare(b.comunidad_nombre || '', 'es'),
    );
  }

  /**
   * Portal gestores: email sin `portal_token`. Solo administradores con acceso al portal.
   */
  async requestAdminPortalCode(rawEmail: string): Promise<{ ok: true }> {
    const emailNorm = normalizeEmail(rawEmail);
    if (!emailNorm || !emailNorm.includes('@')) {
      throw new BadRequestException('Email no válido');
    }

    const comunidades = await this.listAdminPortalContactsByEmail(emailNorm);
    if (comunidades.length === 0) {
      this.logger.log(
        `[portal-otp-admin] request-code: sin administrador portal para ${emailNorm}`,
      );
      return { ok: true };
    }

    const code = generateOtpCode();
    const codeHash = this.hashOtp(code);
    const expiresAt = new Date(Date.now() + this.otpTtlMs());

    await this.prisma.$transaction([
      this.prisma.portalOtpEmailChallenge.updateMany({
        where: { email_norm: emailNorm, consumed_at: null },
        data: { consumed_at: new Date() },
      }),
      this.prisma.portalOtpEmailChallenge.create({
        data: {
          email_norm: emailNorm,
          code_hash: codeHash,
          expires_at: expiresAt,
        },
      }),
    ]);

    const company =
      this.configService.get<string>('COMPANY_LEGAL_NAME_SHORT') ||
      this.configService.get<string>('COMPANY_LEGAL_NAME') ||
      'De Camino';

    const html = `
      <p>Hola,</p>
      <p>Tu código para el <strong>portal de gestores</strong> (${escapeHtml(company)}) — acceso a tus comunidades como administrador — es:</p>
      <p style="font-size:22px;font-weight:bold;letter-spacing:4px;">${escapeHtml(code)}</p>
      <p>Caduca en unos minutos. Si no has solicitado este acceso, ignora este mensaje.</p>
    `;

    try {
      await this.emailService.sendEmail(
        emailNorm,
        `Código portal gestores — ${company}`,
        html,
      );
    } catch (e: any) {
      this.logger.error(`[portal-otp-admin] fallo envío email: ${e?.message}`);
      throw new ServiceUnavailableException(
        'No se pudo enviar el email. Inténtelo más tarde o verifique la configuración SMTP.',
      );
    }

    return { ok: true };
  }

  async verifyAdminPortalCode(
    rawEmail: string,
    rawCode: string,
  ): Promise<{
    accessToken?: string;
    expiresIn?: string;
    /** Presente cuando hay una sola comunidad (clave de sessionStorage en el front). */
    portal_token?: string;
    selectionToken?: string;
    communities?: Array<{
      cliente_id: number;
      nombre: string;
      portal_token: string;
    }>;
  }> {
    const emailNorm = normalizeEmail(rawEmail);
    const code = String(rawCode || '')
      .trim()
      .replace(/\s+/g, '');
    if (!emailNorm || !code || code.length < 6) {
      throw new BadRequestException('Email o código no válido');
    }

    const codeHash = this.hashOtp(code);
    const challenge = await this.prisma.portalOtpEmailChallenge.findFirst({
      where: {
        email_norm: emailNorm,
        consumed_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { id: 'desc' },
    });

    if (!challenge) {
      throw new BadRequestException('Código caducado o ya utilizado');
    }

    const a = Buffer.from(challenge.code_hash, 'hex');
    const b = Buffer.from(codeHash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new BadRequestException('Código incorrecto');
    }

    await this.prisma.portalOtpEmailChallenge.update({
      where: { id: challenge.id },
      data: { consumed_at: new Date() },
    });

    const comunidades = await this.listAdminPortalContactsByEmail(emailNorm);
    if (comunidades.length === 0) {
      throw new BadRequestException('Código o email incorrecto');
    }

    const expiresIn =
      this.configService.get<string>('jwt.portalExpiresIn') || '12h';

    if (comunidades.length === 1) {
      const c = comunidades[0];
      const accessToken = await this.jwtService.signAsync(
        {
          typ: 'portal',
          contacto_id: c.id,
          cliente_id: c.cliente_id,
          email: emailNorm,
        },
        { expiresIn: expiresIn as StringValue },
      );
      return { accessToken, expiresIn, portal_token: c.portal_token };
    }

    const contactoIds = comunidades.map((c) => c.id);
    const selectionExpires =
      this.configService.get<string>('jwt.portalSelectExpiresIn') || '15m';
    const selectionToken = await this.jwtService.signAsync(
      {
        typ: 'portal-select',
        email: emailNorm,
        contacto_ids: contactoIds,
      },
      { expiresIn: selectionExpires as StringValue },
    );

    return {
      selectionToken,
      communities: comunidades.map((c) => ({
        cliente_id: c.cliente_id,
        nombre: c.comunidad_nombre?.trim() || `Comunidad #${c.cliente_id}`,
        portal_token: c.portal_token,
      })),
    };
  }

  async selectAdminCommunity(
    selectionToken: string,
    clienteId: number,
  ): Promise<{ accessToken: string; expiresIn: string }> {
    let payload: {
      typ?: string;
      email?: string;
      contacto_ids?: number[];
    };
    try {
      payload = await this.jwtService.verifyAsync(selectionToken, {
        secret: this.configService.getOrThrow<string>('jwt.portalSecret'),
      });
    } catch {
      throw new BadRequestException('Sesión de selección caducada o inválida');
    }

    if (
      payload.typ !== 'portal-select' ||
      typeof payload.email !== 'string' ||
      !Array.isArray(payload.contacto_ids)
    ) {
      throw new BadRequestException('Token de selección inválido');
    }

    const emailNorm = normalizeEmail(payload.email);
    const ids = payload.contacto_ids.filter(
      (x): x is number => typeof x === 'number' && Number.isFinite(x),
    );
    if (!emailNorm || ids.length === 0) {
      throw new BadRequestException('Token de selección inválido');
    }

    const contacto = await this.prisma.clienteContacto.findFirst({
      where: {
        id: { in: ids },
        cliente_id: clienteId,
        acceso_portal: true,
        estado: 'activo',
        email: { not: null },
      },
    });

    if (
      !contacto?.email ||
      normalizeEmail(contacto.email) !== emailNorm ||
      String(contacto.cargo_codigo || '').toLowerCase() !== PORTAL_GESTOR_CARGO
    ) {
      throw new BadRequestException('Comunidad no disponible para este acceso');
    }

    const expiresIn =
      this.configService.get<string>('jwt.portalExpiresIn') || '12h';
    const accessToken = await this.jwtService.signAsync(
      {
        typ: 'portal',
        contacto_id: contacto.id,
        cliente_id: contacto.cliente_id,
        email: emailNorm,
      },
      { expiresIn: expiresIn as StringValue },
    );

    return { accessToken, expiresIn };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
