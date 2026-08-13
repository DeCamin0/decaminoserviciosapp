/**
 * Self-serve forgot / reset password for employee auth (DatosEmpleados).
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import {
  FORGOT_GENERIC_MESSAGE,
  ForgotPasswordRateLimitError,
  checkForgotPasswordRateLimits,
  checkResetPasswordRateLimits,
  generatePasswordResetTokenPlain,
  hashPasswordResetToken,
  normalizeResetEmail,
  passwordResetExpiresAt,
  PASSWORD_RESET_TTL_MS,
} from '../utils/password-reset.util';
import { hashPassword, validateNewPasswordPair } from '../utils/password.util';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  getGenericMessage(): string {
    return FORGOT_GENERIC_MESSAGE;
  }

  private frontendBaseUrl(): string {
    const company = this.configService.get<{ frontendAppUrl?: string }>(
      'company',
    );
    const url =
      company?.frontendAppUrl ||
      process.env.FRONTEND_APP_URL ||
      process.env.FRONTEND_URL ||
      '';
    return String(url).replace(/\/+$/, '');
  }

  private buildResetUrl(plainToken: string): string {
    const base = this.frontendBaseUrl();
    return `${base}/restablecer-contrasena?token=${encodeURIComponent(plainToken)}`;
  }

  private escapeHtml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private buildResetEmailHtml(opts: {
    resetUrl: string;
    brandName: string;
    brandColor: string;
    ttlMinutes: number;
  }): { subject: string; html: string } {
    const { resetUrl, brandName, brandColor, ttlMinutes } = opts;
    const safeUrl = this.escapeHtml(resetUrl);
    const safeBrand = this.escapeHtml(brandName);
    const subject = `${safeBrand} — Restablecer contraseña`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.55;">
        <h1 style="margin:0 0 12px;font-size:20px;color:#111;">Restablecer contraseña</h1>
        <p style="margin:0 0 14px;font-size:15px;">
          Hemos recibido una solicitud para cambiar la contraseña de tu cuenta en <strong>${safeBrand}</strong>.
        </p>
        <p style="margin:0 0 18px;text-align:center;">
          <a href="${safeUrl}"
             style="display:inline-block;background:${brandColor};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:8px;">
            Elegir nueva contraseña
          </a>
        </p>
        <p style="margin:0 0 10px;font-size:13px;color:#555;">
          Este enlace caduca en <strong>${ttlMinutes} minutos</strong> y solo se puede usar una vez.
        </p>
        <p style="margin:0 0 10px;font-size:13px;color:#555;">
          Si no has solicitado este cambio, ignora este correo: tu contraseña no se modificará.
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#888;word-break:break-all;">
          Si el botón no funciona, copia y pega este enlace:<br/>${safeUrl}
        </p>
      </div>`;
    return { subject, html };
  }

  async requestPasswordReset(opts: {
    email: unknown;
    ip: string;
    userAgent: string | null;
  }): Promise<{ message: string }> {
    const email = normalizeResetEmail(opts.email);
    if (!email) {
      // Same external message; no enumeration via format errors either for empty/invalid
      return { message: FORGOT_GENERIC_MESSAGE };
    }

    const rate = checkForgotPasswordRateLimits({ ip: opts.ip, email });
    if (rate.ok === false) {
      throw new ForgotPasswordRateLimitError(rate.retryAfterHint);
    }

    try {
      const user = await this.prisma.user.findFirst({
        where: { CORREO_ELECTRONICO: email },
        select: {
          CODIGO: true,
          CORREO_ELECTRONICO: true,
          ESTADO: true,
        },
      });

      if (!user?.CODIGO || !user.CORREO_ELECTRONICO) {
        return { message: FORGOT_GENERIC_MESSAGE };
      }

      const estado = String(user.ESTADO || '')
        .trim()
        .toUpperCase();
      if (estado && estado !== 'ACTIVO') {
        return { message: FORGOT_GENERIC_MESSAGE };
      }

      if (!this.emailService.isConfigured()) {
        this.logger.warn(
          '[forgot-password] SMTP not configured; returning generic OK',
        );
        return { message: FORGOT_GENERIC_MESSAGE };
      }

      const plainToken = generatePasswordResetTokenPlain();
      const tokenHash = hashPasswordResetToken(plainToken);
      const expiresAt = passwordResetExpiresAt();
      const usedAt = new Date();

      await this.prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.updateMany({
          where: { userCodigo: user.CODIGO, usedAt: null },
          data: { usedAt },
        });
        await tx.passwordResetToken.create({
          data: {
            userCodigo: user.CODIGO,
            tokenHash,
            expiresAt,
            requestIp: opts.ip || null,
            userAgent: opts.userAgent ? opts.userAgent.slice(0, 512) : null,
          },
        });
      });

      const company = this.configService.get<{
        legalNameShort?: string;
        legalName?: string;
        brandRed?: string;
      }>('company');
      const brandName =
        company?.legalNameShort || company?.legalName || 'DeCamino';
      const brandColor = company?.brandRed || '#CC0000';
      const resetUrl = this.buildResetUrl(plainToken);
      const ttlMinutes = Math.round(PASSWORD_RESET_TTL_MS / 60000);
      const mail = this.buildResetEmailHtml({
        resetUrl,
        brandName,
        brandColor,
        ttlMinutes,
      });

      try {
        await this.emailService.sendEmail(
          user.CORREO_ELECTRONICO,
          mail.subject,
          mail.html,
        );
      } catch (smtpErr: any) {
        this.logger.warn(
          `[forgot-password] SMTP failure (generic response kept): ${smtpErr?.message || smtpErr}`,
        );
      }

      return { message: FORGOT_GENERIC_MESSAGE };
    } catch (err: any) {
      if (err instanceof ForgotPasswordRateLimitError) throw err;
      this.logger.error(
        `[forgot-password] unexpected error (generic response): ${err?.message || err}`,
      );
      return { message: FORGOT_GENERIC_MESSAGE };
    }
  }

  async resetPasswordWithToken(opts: {
    token: unknown;
    newPassword: unknown;
    confirmPassword: unknown;
    ip: string;
  }): Promise<{ success: true; message: string }> {
    const rate = checkResetPasswordRateLimits({ ip: opts.ip });
    if (rate.ok === false) {
      throw new ForgotPasswordRateLimitError(rate.retryAfterHint);
    }

    if (typeof opts.token !== 'string' || !opts.token.trim()) {
      throw Object.assign(new Error('Enlace no válido o caducado.'), {
        status: 400,
      });
    }

    const validated = validateNewPasswordPair(
      opts.newPassword,
      opts.confirmPassword,
    );
    if (validated.ok === false) {
      throw Object.assign(new Error(validated.error), { status: 400 });
    }

    const tokenHash = hashPasswordResetToken(opts.token.trim());
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
      throw Object.assign(new Error('Enlace no válido o caducado.'), {
        status: 400,
      });
    }

    const passwordHash = await hashPassword(validated.password);
    const usedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE DatosEmpleados
         SET \`Contraseña\` = ?, AUTH_VERSION = AUTH_VERSION + 1
         WHERE CODIGO = ?`,
        passwordHash,
        row.userCodigo,
      );
      await tx.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt },
      });
      await tx.passwordResetToken.updateMany({
        where: {
          userCodigo: row.userCodigo,
          usedAt: null,
          id: { not: row.id },
        },
        data: { usedAt },
      });
    });

    this.logger.log(
      `[reset-password] Password updated for user_codigo=${row.userCodigo}`,
    );
    return {
      success: true,
      message:
        'Contraseña actualizada correctamente. Ya puedes iniciar sesión.',
    };
  }
}
