import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MonitoringService } from '../services/monitoring.service';
import { TelegramService } from '../services/telegram.service';
import { EmailService } from '../services/email.service';
import { SentEmailsService } from '../services/sent-emails.service';
import { ActivityLogsService } from '../services/activity-logs.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Controller pentru raportarea erorilor din frontend
 * și verificări manuale de health
 */
/** Activo / oculto (genérico). La clave antigua sigue leyéndose por compatibilidad. */
const RENTA_BANNER_SETTING_KEY = 'renta_campana_banner_enabled';
const RENTA_BANNER_LEGACY_KEY = 'renta_campana_2025_banner_enabled';
/** Valor numérico del ejercicio fiscal de la renta (ej. 2025 → campaign_key renta_2025). */
const RENTA_EJERCICIO_SETTING_KEY = 'renta_campana_ejercicio';

function rentaCampaignKeyFromEjercicio(ejercicio: number): string {
  return `renta_${ejercicio}`;
}

@Controller('api/monitoring')
export class MonitoringController {
  private readonly logger = new Logger(MonitoringController.name);

  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly telegramService: TelegramService,
    private readonly emailService: EmailService,
    private readonly sentEmailsService: SentEmailsService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private getCompanyName(): string {
    const company = this.configService.get<{
      legalNameShort?: string;
      legalName?: string;
    }>('company');
    return (company?.legalNameShort ?? company?.legalName ?? '').trim();
  }

  /** Igual que en SolicitudesService: COMPANY_GESTORIA_EMAIL o COMPANY_EMAIL. */
  private getGestoriaEmail(): string {
    const c = this.configService.get<{
      gestoriaEmail?: string;
      email?: string;
    }>('company');
    return ((c?.gestoriaEmail || c?.email) ?? '').trim();
  }

  private escapeHtml(s: string): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Año del ejercicio de la campaña: app_settings, env RENTA_CAMPANA_EJERCICIO, o año anterior al calendario (típico ES).
   */
  private async getRentaEjercicio(): Promise<number> {
    const row = await this.prisma.appSetting.findUnique({
      where: { setting_key: RENTA_EJERCICIO_SETTING_KEY },
    });
    if (row?.value) {
      const n = parseInt(String(row.value).trim(), 10);
      if (Number.isFinite(n) && n >= 2000 && n <= 2100) {
        return n;
      }
    }
    const envEj = this.configService.get<string>('RENTA_CAMPANA_EJERCICIO');
    if (envEj) {
      const n = parseInt(String(envEj).trim(), 10);
      if (Number.isFinite(n) && n >= 2000 && n <= 2100) {
        return n;
      }
    }
    const y = new Date().getFullYear();
    return y - 1;
  }

  /**
   * Email + Telegram (bot gestoría) cuando un empleado confirma la renta (ejercicio dinámico).
   * No bloquea la respuesta HTTP si falla.
   */
  private async notifyGestoriaRentaCampana(payload: {
    ejercicio: number;
    codigo: string;
    nombreCompleto: string;
    dni: string;
    segSocial: string;
    emailEmpleado: string;
  }): Promise<void> {
    const ej = payload.ejercicio;
    const company = this.getCompanyName() || 'Empresa';
    const lines = [
      `📋 Nueva solicitud — Campaña Renta ${ej} (declaración con gestoría)`,
      '',
      `Empresa: ${company}`,
      `Nombre completo: ${payload.nombreCompleto}`,
      `Código empleado: ${payload.codigo}`,
      `DNI / NIE: ${payload.dni || '—'}`,
      `Seg. Social: ${payload.segSocial || '—'}`,
      `Email empleado: ${payload.emailEmpleado || '—'}`,
    ];
    const plainText = lines.join('\n');

    try {
      if (this.telegramService.isConfigured()) {
        await this.telegramService.sendMessage(plainText, {
          disableMarkdown: true,
        });
        this.logger.log(
          `✅ Telegram gestoría: notificación renta ${ej} para ${payload.codigo}`,
        );
      } else {
        this.logger.warn(
          '⚠️ Telegram gestoría no configurado — no se envió aviso renta campaña',
        );
      }
    } catch (e: any) {
      this.logger.error(
        `❌ Telegram renta ${ej} (${payload.codigo}): ${e?.message}`,
      );
    }

    const gestoriaTo = this.getGestoriaEmail();
    if (!gestoriaTo) {
      this.logger.warn(
        '⚠️ COMPANY_GESTORIA_EMAIL / COMPANY_EMAIL vacío — no se envió email renta campaña',
      );
      return;
    }
    if (!this.emailService.isConfigured()) {
      this.logger.warn(
        '⚠️ SMTP no configurado — no se envió email renta campaña',
      );
      return;
    }

    const subject = `📋 Renta ${ej} — Solicitud empleado ${payload.codigo}`;
    const html = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
  <p>Un empleado ha confirmado en el portal que desea la <strong>declaración de la renta ${ej}</strong> con la gestoría.</p>
  <table style="border-collapse: collapse; margin-top: 12px;">
    <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Empresa</td><td>${this.escapeHtml(company)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Nombre completo</td><td>${this.escapeHtml(payload.nombreCompleto)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Código</td><td>${this.escapeHtml(payload.codigo)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">DNI / NIE</td><td>${this.escapeHtml(payload.dni || '—')}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Seg. Social</td><td>${this.escapeHtml(payload.segSocial || '—')}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Email empleado</td><td>${this.escapeHtml(payload.emailEmpleado || '—')}</td></tr>
  </table>
  <p style="margin-top: 16px; color: #666; font-size: 12px;">Mensaje automático — Campaña Renta ${ej}</p>
</body></html>`.trim();

    try {
      await this.emailService.sendEmail(gestoriaTo, subject, html, {
        bcc: this.emailService.getDefaultBcc(),
      });
      this.logger.log(
        `✅ Email gestoría renta ${ej} enviado a ${gestoriaTo} (${payload.codigo})`,
      );
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: 'system',
          recipientType: 'gestoria',
          recipientId: payload.codigo,
          recipientEmail: gestoriaTo,
          recipientName: 'Gestoría',
          subject,
          message: html,
          status: 'sent',
        });
      } catch (saveErr: any) {
        this.logger.warn(
          `⚠️ No se pudo guardar sent_emails renta ${ej}: ${saveErr.message}`,
        );
      }
    } catch (e: any) {
      this.logger.error(
        `❌ Email gestoría renta ${ej} (${payload.codigo}): ${e?.message}`,
      );
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: 'system',
          recipientType: 'gestoria',
          recipientId: payload.codigo,
          recipientEmail: gestoriaTo,
          recipientName: 'Gestoría',
          subject,
          message: '',
          status: 'failed',
          errorMessage: e?.message || String(e),
        });
      } catch {
        // ignore
      }
    }
  }

  /**
   * Endpoint pentru raportarea erorilor din frontend
   * Poate fi apelat din frontend când apare o eroare critică
   */
  @Post('frontend-error')
  async reportFrontendError(
    @Body()
    errorData: {
      message: string;
      stack?: string;
      url?: string;
      userAgent?: string;
      userId?: string;
      timestamp?: string;
    },
  ) {
    // Folosim bot-ul general pentru erori (dacă e configurat)
    // Altfel folosim bot-ul de gestoria ca fallback
    const useGeneralBot = this.telegramService.isGeneralConfigured();
    if (!useGeneralBot && !this.telegramService.isConfigured()) {
      return { success: false, message: 'Telegram not configured' };
    }

    try {
      const message = `
🚨 *Error crítico en frontend*

❌ *Mensaje:* ${errorData.message}
🔗 *URL:* ${errorData.url || 'N/A'}
👤 *Usuario:* ${errorData.userId || 'Anónimo'}
🌐 *User Agent:* ${errorData.userAgent?.substring(0, 100) || 'N/A'}

\`\`\`
${errorData.stack?.substring(0, 500) || 'No stack trace'}
\`\`\`

⏰ *Timestamp:* ${errorData.timestamp || new Date().toISOString()}
      `.trim();

      if (useGeneralBot) {
        await this.telegramService.sendGeneralMessage(message);
      } else {
        await this.telegramService.sendMessage(message);
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Manual health check
   */
  @Post('health-check')
  @UseGuards(JwtAuthGuard)
  async performHealthCheck() {
    return await this.monitoringService.performHealthCheck();
  }

  /**
   * Endpoint pentru trimiterea mesajelor pe Telegram
   * Folosit pentru notificări importante (ex: banner baja médica închis)
   * @param botType - 'gestoria' (default) sau 'general' pentru a alege bot-ul
   */
  @Post('telegram')
  async sendTelegramMessage(
    @Body()
    data: {
      message: string;
      botType?: 'gestoria' | 'general'; // Nou: permite alegerea bot-ului
      userId?: string;
      userName?: string;
      userEmail?: string;
      userGrupo?: string;
    },
  ) {
    const botType = data.botType || 'gestoria';

    // Verifică configurarea bot-ului ales
    const isConfigured =
      botType === 'general'
        ? this.telegramService.isGeneralConfigured()
        : this.telegramService.isConfigured();

    if (!isConfigured) {
      return {
        success: false,
        message: `Telegram ${botType} bot not configured`,
      };
    }

    try {
      if (botType === 'general') {
        await this.telegramService.sendGeneralMessage(data.message);
      } else {
        await this.telegramService.sendMessage(data.message);
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Endpoint pentru trimiterea email-ului de confirmare către angajat
   * când închide banner-ul despre baja médica
   * Trimite email către angajat + BCC din company config (getDefaultBcc)
   */
  @Post('banner-baja-medica-confirmation')
  async sendBannerConfirmationEmail(
    @Body()
    data: {
      userEmail: string;
      userName: string;
      userCodigo: string;
      userGrupo?: string;
    },
  ) {
    if (!this.emailService.isConfigured()) {
      return { success: false, message: 'Email service not configured' };
    }

    if (!data.userEmail || !data.userName) {
      return {
        success: false,
        message: 'userEmail and userName are required',
      };
    }

    try {
      const subject = '✅ Confirmación de conocimiento - Baja Médica';

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #E53935 0%, #C62828 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background-color: #ffffff; padding: 30px 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
    .info-box { background-color: #f8f9fa; border-left: 4px solid #E53935; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .highlight { color: #E53935; font-weight: bold; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #888; font-size: 12px; text-align: center; }
    .signature { margin-top: 30px; color: #555; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">🩺 ${this.getCompanyName()}</h1>
  </div>
  
  <div class="content">
    <p>Estimado/a <strong>${data.userName}</strong>,</p>
    
    <p>Le confirmamos que ha tomado conocimiento del recordatorio sobre la <strong class="highlight">obligación de comunicar bajas médicas</strong> a través de la aplicación.</p>
    
    <div class="info-box">
      <h3 style="margin-top: 0; color: #E53935;">📋 Recordatorio importante:</h3>
      <p style="margin-bottom: 10px;">En caso de baja médica, es <strong>obligatorio</strong> comunicarlo a la empresa lo antes posible a través de la aplicación.</p>
      <p style="margin: 0;">Puede hacerlo desde la página <strong>Fichaje</strong> → botón <strong>"Anunciar Baja Médica"</strong></p>
    </div>
    
    <p>Esta confirmación queda registrada en nuestro sistema como prueba de que ha sido informado/a sobre esta obligación.</p>
    
    <p>Si tiene alguna pregunta o necesita asistencia, no dude en contactarnos.</p>
    
    <div class="signature">
      <p style="margin: 5px 0;"><strong>${this.getCompanyName()}</strong></p>
      <p style="margin: 5px 0; color: #888; font-size: 14px;">Sistema de Gestión de Empleados</p>
    </div>
    
    <div class="footer">
      <p>Este es un mensaje automático del sistema. Por favor, no responda a este correo.</p>
      <p>Fecha de confirmación: ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'long', timeStyle: 'short' })}</p>
    </div>
  </div>
</body>
</html>
      `.trim();

      // Trimite email către angajat cu BCC din company config
      await this.emailService.sendEmail(data.userEmail, subject, html, {
        bcc: this.emailService.getDefaultBcc(),
      });

      // Salvează email-ul în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: 'system',
          recipientType: 'empleado',
          recipientId: data.userCodigo,
          recipientEmail: data.userEmail,
          recipientName: data.userName,
          subject,
          message: html,
          status: 'sent',
        });
      } catch (saveError: any) {
        // Nu aruncăm eroarea dacă salvarea eșuează, email-ul a fost trimis
        console.warn(`⚠️ Error saving email to database: ${saveError.message}`);
      }

      return { success: true, message: 'Email sent successfully' };
    } catch (error: any) {
      // Salvează și email-urile eșuate în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: 'system',
          recipientType: 'empleado',
          recipientId: data.userCodigo,
          recipientEmail: data.userEmail,
          recipientName: data.userName,
          subject: '✅ Confirmación de conocimiento - Baja Médica',
          message: '',
          status: 'failed',
          errorMessage: error.message || String(error),
        });
      } catch {
        // Ignorăm eroarea de salvare
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Verifică dacă angajatul a închis deja banner-ul despre baja médica
   * Verifică în ActivityLog dacă există un log cu action='banner_baja_medica_dismissed'
   */
  @Get('banner-baja-medica-status')
  @UseGuards(JwtAuthGuard)
  async getBannerStatus(
    @Query('email') email?: string,
    @Query('codigo') codigo?: string,
  ) {
    try {
      if (!email && !codigo) {
        return { dismissed: false, message: 'email or codigo required' };
      }

      // Verifică în ActivityLog dacă există un log cu acțiunea 'banner_baja_medica_dismissed'
      // pentru acest angajat
      const where: any = {
        action: 'banner_baja_medica_dismissed',
      };

      if (email) {
        where.email = email;
      }

      // Dacă avem codigo, trebuie să verificăm prin email-ul asociat codigo-ului
      if (codigo && !email) {
        try {
          const empleado = await this.prisma.user.findUnique({
            where: { CODIGO: codigo },
            select: { CORREO_ELECTRONICO: true },
          });
          if (empleado?.CORREO_ELECTRONICO) {
            where.email = empleado.CORREO_ELECTRONICO;
          } else {
            // Dacă nu găsim email, verificăm direct prin codigo în details
            // (dar ActivityLog nu stochează codigo direct, doar email)
            return { dismissed: false };
          }
        } catch {
          return { dismissed: false };
        }
      }

      const log = await this.prisma.logs.findFirst({
        where,
        orderBy: { timestamp: 'desc' },
      });

      return {
        dismissed: !!log,
        dismissedAt: log?.timestamp || null,
      };
    } catch (err: any) {
      return { dismissed: false, error: err.message };
    }
  }

  /**
   * Verifică dacă angajatul a închis deja banner-ul despre modificări de horarios
   * Verifică în ActivityLog dacă există un log cu action='banner_horarios_dismissed'
   */
  @Get('banner-horarios-status')
  @UseGuards(JwtAuthGuard)
  async getBannerHorariosStatus(
    @Query('email') email?: string,
    @Query('codigo') codigo?: string,
  ) {
    try {
      if (!email && !codigo) {
        return { dismissed: false, message: 'email or codigo required' };
      }

      // Verifică în ActivityLog dacă există un log cu acțiunea 'banner_horarios_dismissed'
      // pentru acest angajat
      const where: any = {
        action: 'banner_horarios_dismissed',
      };

      if (email) {
        where.email = email;
      }

      // Dacă avem codigo, trebuie să verificăm prin email-ul asociat codigo-ului
      if (codigo && !email) {
        try {
          const empleado = await this.prisma.user.findUnique({
            where: { CODIGO: codigo },
            select: { CORREO_ELECTRONICO: true },
          });
          if (empleado?.CORREO_ELECTRONICO) {
            where.email = empleado.CORREO_ELECTRONICO;
          } else {
            // Dacă nu găsim email, verificăm direct prin codigo în details
            // (dar ActivityLog nu stochează codigo direct, doar email)
            return { dismissed: false };
          }
        } catch {
          return { dismissed: false };
        }
      }

      const log = await this.prisma.logs.findFirst({
        where,
        orderBy: { timestamp: 'desc' },
      });

      return {
        dismissed: !!log,
        dismissedAt: log?.timestamp || null,
      };
    } catch (err: any) {
      return { dismissed: false, error: err.message };
    }
  }

  private assertDeveloper(req: { user?: { grupo?: string } }) {
    if (req.user?.grupo !== 'Developer') {
      throw new ForbiddenException(
        'Solo usuarios Developer pueden realizar esta acción.',
      );
    }
  }

  private async isRentaBannerEnabled(): Promise<boolean> {
    const rowNew = await this.prisma.appSetting.findUnique({
      where: { setting_key: RENTA_BANNER_SETTING_KEY },
    });
    if (rowNew) {
      const v = (rowNew.value || '').trim().toLowerCase();
      return v === 'true' || v === '1' || v === 'yes';
    }
    const rowLegacy = await this.prisma.appSetting.findUnique({
      where: { setting_key: RENTA_BANNER_LEGACY_KEY },
    });
    if (rowLegacy) {
      const v = (rowLegacy.value || '').trim().toLowerCase();
      return v === 'true' || v === '1' || v === 'yes';
    }
    return true;
  }

  /**
   * Estado del aviso y si el empleado ya solicitó para el ejercicio actual (renta_YYYY).
   * Rutas duplicadas: /renta-campana/* y /renta-campana-2025/* (compat).
   */
  @Get(['renta-campana/status', 'renta-campana-2025/status'])
  @UseGuards(JwtAuthGuard)
  async getRentaCampanaStatus(
    @Request() req: { user?: { userId?: string; grupo?: string } },
  ) {
    const codigo = req.user?.userId;
    if (!codigo) {
      return { enabled: false, solicited: false, error: 'no_user' };
    }
    try {
      const ejercicio = await this.getRentaEjercicio();
      const campaignKey = rentaCampaignKeyFromEjercicio(ejercicio);
      const enabled = await this.isRentaBannerEnabled();
      const existing = await this.prisma.rentaCampanaSolicitud.findFirst({
        where: { user_codigo: codigo, campaign_key: campaignKey },
      });
      const isDev = req.user?.grupo === 'Developer';
      let totalSolicitudes: number | undefined;
      if (isDev) {
        totalSolicitudes = await this.prisma.rentaCampanaSolicitud.count({
          where: { campaign_key: campaignKey },
        });
      }
      return {
        enabled,
        ejercicio,
        campaignKey,
        solicited: !!existing,
        solicitedAt: existing?.created_at
          ? existing.created_at.toISOString()
          : null,
        totalSolicitudes,
      };
    } catch (err: any) {
      return {
        enabled: false,
        solicited: false,
        error: err.message,
      };
    }
  }

  /**
   * El empleado confirma que quiere la declaración de la renta con la gestoría.
   */
  @Post(['renta-campana/solicitar', 'renta-campana-2025/solicitar'])
  @UseGuards(JwtAuthGuard)
  async postRentaCampanaSolicitar(
    @Request() req: { user?: { userId?: string } },
  ) {
    const codigo = req.user?.userId;
    if (!codigo) {
      return { ok: false, message: 'Usuario no identificado' };
    }
    const enabled = await this.isRentaBannerEnabled();
    if (!enabled) {
      return { ok: false, message: 'La campaña no está activa' };
    }
    const ejercicio = await this.getRentaEjercicio();
    const campaignKey = rentaCampaignKeyFromEjercicio(ejercicio);
    const empleado = await this.prisma.user.findUnique({
      where: { CODIGO: codigo },
      select: {
        NOMBRE_APELLIDOS: true,
        CORREO_ELECTRONICO: true,
        DNI_NIE: true,
        SEG__SOCIAL: true,
      },
    });
    const nombre =
      empleado?.NOMBRE_APELLIDOS?.trim() ||
      empleado?.CORREO_ELECTRONICO ||
      codigo;
    const dni = (empleado?.DNI_NIE ?? '').trim();
    const segSocial = (empleado?.SEG__SOCIAL ?? '').trim();
    const emailEmpleado = (empleado?.CORREO_ELECTRONICO ?? '').trim();

    try {
      await this.prisma.rentaCampanaSolicitud.create({
        data: {
          user_codigo: codigo,
          campaign_key: campaignKey,
          nombre_snapshot: nombre,
        },
      });
      void this.notifyGestoriaRentaCampana({
        ejercicio,
        codigo,
        nombreCompleto: nombre,
        dni,
        segSocial,
        emailEmpleado,
      }).catch((err) =>
        this.logger.error(`notifyGestoriaRentaCampana: ${err?.message || err}`),
      );
      return { ok: true, alreadyHad: false, ejercicio, campaignKey };
    } catch (e: any) {
      if (e?.code === 'P2002') {
        return { ok: true, alreadyHad: true, ejercicio, campaignKey };
      }
      throw e;
    }
  }

  /**
   * Activar / desactivar aviso y opcionalmente fijar ejercicio (año de la renta). Solo Developer.
   */
  @Patch(['renta-campana/banner', 'renta-campana-2025/banner'])
  @UseGuards(JwtAuthGuard)
  async patchRentaCampanaBanner(
    @Request() req: { user?: { userId?: string; grupo?: string } },
    @Body() body: { enabled?: boolean; ejercicio?: number },
  ) {
    this.assertDeveloper(req);
    if (body?.ejercicio !== undefined && body?.ejercicio !== null) {
      const y = Number(body.ejercicio);
      if (!Number.isInteger(y) || y < 2000 || y > 2100) {
        throw new BadRequestException(
          'ejercicio debe ser un número entero entre 2000 y 2100',
        );
      }
      await this.prisma.appSetting.upsert({
        where: { setting_key: RENTA_EJERCICIO_SETTING_KEY },
        create: {
          setting_key: RENTA_EJERCICIO_SETTING_KEY,
          value: String(y),
        },
        update: { value: String(y) },
      });
    }
    if (body?.enabled !== undefined) {
      const enabled = body.enabled === true;
      await this.prisma.appSetting.upsert({
        where: { setting_key: RENTA_BANNER_SETTING_KEY },
        create: {
          setting_key: RENTA_BANNER_SETTING_KEY,
          value: enabled ? 'true' : 'false',
        },
        update: { value: enabled ? 'true' : 'false' },
      });
    }
    const ejercicio = await this.getRentaEjercicio();
    const enabled = await this.isRentaBannerEnabled();
    return {
      ok: true,
      enabled,
      ejercicio,
      campaignKey: rentaCampaignKeyFromEjercicio(ejercicio),
    };
  }

  /**
   * Lista de solicitudes para la gestoría (solo Developer).
   */
  @Get(['renta-campana/solicitudes', 'renta-campana-2025/solicitudes'])
  @UseGuards(JwtAuthGuard)
  async getRentaCampanaSolicitudes(
    @Request() req: { user?: { grupo?: string } },
  ) {
    this.assertDeveloper(req);
    const ejercicio = await this.getRentaEjercicio();
    const campaignKey = rentaCampaignKeyFromEjercicio(ejercicio);
    const rows = await this.prisma.rentaCampanaSolicitud.findMany({
      where: { campaign_key: campaignKey },
      orderBy: { created_at: 'desc' },
    });
    const codigos = [...new Set(rows.map((r) => r.user_codigo))];
    const users =
      codigos.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: { CODIGO: { in: codigos } },
            select: {
              CODIGO: true,
              NOMBRE_APELLIDOS: true,
              CORREO_ELECTRONICO: true,
            },
          });
    const byCodigo = Object.fromEntries(users.map((u) => [u.CODIGO, u]));
    return {
      ejercicio,
      campaignKey,
      items: rows.map((r) => {
        const u = byCodigo[r.user_codigo];
        return {
          id: r.id.toString(),
          user_codigo: r.user_codigo,
          nombre_snapshot: r.nombre_snapshot,
          nombre_actual: u?.NOMBRE_APELLIDOS ?? null,
          email: u?.CORREO_ELECTRONICO ?? null,
          created_at: r.created_at.toISOString(),
        };
      }),
    };
  }
}
