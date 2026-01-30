import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
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
@Controller('api/monitoring')
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly telegramService: TelegramService,
    private readonly emailService: EmailService,
    private readonly sentEmailsService: SentEmailsService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly prisma: PrismaService,
  ) {}

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
   * Trimite email către angajat + BCC la app@decaminoservicios.com
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
    <h1 style="margin: 0; font-size: 24px;">🩺 DE CAMINO SERVICIOS AUXILIARES SL</h1>
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
      <p style="margin: 5px 0;"><strong>DE CAMINO SERVICIOS AUXILIARES SL</strong></p>
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

      // Trimite email către angajat cu BCC la app@decaminoservicios.com
      await this.emailService.sendEmail(data.userEmail, subject, html, {
        bcc: ['app@decaminoservicios.com'],
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
}
