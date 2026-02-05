import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { EmailService } from './email.service';
import { SentEmailsService } from './sent-emails.service';
import { EmpleadosService } from './empleados.service';

@Injectable()
export class AusenciasService {
  private readonly logger = new Logger(AusenciasService.name);
  private readonly EMAIL_RECIPIENT = 'solicitudes@decaminoservicios.com';

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly emailService: EmailService,
    private readonly sentEmailsService: SentEmailsService,
    private readonly empleadosService: EmpleadosService,
  ) {}

  /**
   * Formatează mesajul pentru email de reamintire justificante (HTML)
   */
  private formatRecordatorioJustificanteEmailHtml(ausenciaData: {
    codigo: string;
    nombre: string;
    tipo: string;
    fecha: string;
    motivo?: string;
    managerName?: string;
  }): { subject: string; html: string } {
    const subject = `📋 Recordatorio: Cargar Justificante - ${ausenciaData.nombre} (${ausenciaData.codigo})`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background-color: #fff3cd; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
    .info-row { margin: 10px 0; }
    .label { font-weight: bold; color: #555; }
    .value { color: #333; }
    .reminder { background-color: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196F3; }
    .action { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h2>📋 Recordatorio: Cargar Justificante</h2>
  </div>
  
  <div class="reminder">
    <p style="margin: 0; font-size: 16px; font-weight: bold; color: #2196F3;">
      Por favor, recuerda cargar el justificante para tu ausencia.
    </p>
  </div>
  
  <div class="info-row">
    <span class="label">👤 Empleado:</span>
    <span class="value">${ausenciaData.nombre} (${ausenciaData.codigo})</span>
  </div>
  
  <div class="info-row">
    <span class="label">📅 Tipo de Ausencia:</span>
    <span class="value">${ausenciaData.tipo}</span>
  </div>
  
  <div class="info-row">
    <span class="label">📆 Fecha:</span>
    <span class="value">${ausenciaData.fecha}</span>
  </div>
  
  ${
    ausenciaData.motivo
      ? `
  <div class="info-row">
    <span class="label">📝 Motivo:</span>
    <span class="value">${ausenciaData.motivo}</span>
  </div>
  `
      : ''
  }
  
  <div class="action">
    <p style="margin: 0; font-weight: bold;">📤 Acción requerida:</p>
    <p style="margin: 5px 0 0 0;">
      Por favor, accede a la aplicación y carga el justificante correspondiente en la sección "Mis Solicitudes".
    </p>
  </div>
  
  ${
    ausenciaData.managerName
      ? `
  <div class="info-row" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd;">
    <span class="label">👨‍💼 Recordatorio enviado por:</span>
    <span class="value">${ausenciaData.managerName}</span>
  </div>
  `
      : ''
  }
  
  <hr style="margin-top: 20px; border: none; border-top: 1px solid #ddd;">
  <p style="color: #888; font-size: 12px; margin-top: 20px;">
    Este es un mensaje automático del sistema De Camino Servicios Auxiliares SL.
  </p>
</body>
</html>
    `.trim();

    return { subject, html };
  }

  /**
   * Formatează mesajul pentru email (HTML) din datele absenței
   */
  private formatAusenciaEmailHtml(ausenciaData: {
    codigo: string;
    nombre: string;
    tipo: string;
    fecha: string;
    motivo?: string;
  }): { subject: string; html: string } {
    const subject = `🟡 Nueva ausencia registrada - ${ausenciaData.nombre} (${ausenciaData.codigo})`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background-color: #fff3cd; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
    .info-row { margin: 10px 0; }
    .label { font-weight: bold; color: #555; }
    .value { color: #333; }
  </style>
</head>
<body>
  <div class="header">
    <h2>🟡 Nueva ausencia registrada</h2>
  </div>
  
  <div class="info-row">
    <span class="label">👤 Empleado:</span>
    <span class="value">${ausenciaData.nombre} (${ausenciaData.codigo})</span>
  </div>
  
  <div class="info-row">
    <span class="label">📅 Tipo:</span>
    <span class="value">${ausenciaData.tipo}</span>
  </div>
  
  <div class="info-row">
    <span class="label">📆 Fecha:</span>
    <span class="value">${ausenciaData.fecha}</span>
  </div>
  
  ${
    ausenciaData.motivo
      ? `
  <div class="info-row">
    <span class="label">📝 Motivo:</span>
    <span class="value">${ausenciaData.motivo}</span>
  </div>
  `
      : ''
  }
  
  ${
    ausenciaData.tipo === 'Ausencias justificada' ||
    ausenciaData.tipo === 'Ausencia Justificada'
      ? `
  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #856404; font-size: 16px; font-weight: bold;">⚠️ Importante - Esta ausencia sirve como aviso</h3>
    <p style="color: #856404; margin-bottom: 10px;">
      Esta ausencia justificada sirve como aviso previo. Sin embargo, es importante que también registres en el día de la ausencia:
    </p>
    <ul style="color: #856404; margin-bottom: 10px; padding-left: 20px;">
      <li><strong>"Salida del Centro"</strong> cuando salgas</li>
      <li>O el registro correspondiente según tu situación</li>
    </ul>
    <p style="color: #856404; font-weight: bold; margin-bottom: 0;">
      Si no registras la salida del centro o el registro correspondiente en el día de la ausencia, se te descontará el día completo.
    </p>
  </div>
  `
      : ''
  }
  
  <hr style="margin-top: 20px; border: none; border-top: 1px solid #ddd;">
  <p style="color: #888; font-size: 12px; margin-top: 20px;">
    Este es un mensaje automático del sistema De Camino Servicios Auxiliares SL.
  </p>
</body>
</html>
    `.trim();

    return { subject, html };
  }

  /**
   * Trimite email către angajat când înregistrează o ausencia
   */
  private async sendAusenciaEmailToEmpleado(ausenciaData: {
    codigo: string;
    nombre: string;
    tipo: string;
    fecha: string;
    motivo?: string;
  }): Promise<void> {
    this.logger.log(
      `📧 [sendAusenciaEmailToEmpleado] Called for ausencia - codigo: ${ausenciaData.codigo}`,
    );

    if (!this.emailService.isConfigured()) {
      this.logger.warn(
        `⚠️ [sendAusenciaEmailToEmpleado] Email service not configured. Email notification not sent to empleado for ausencia - codigo: ${ausenciaData.codigo}`,
      );
      return;
    }

    // Obține email-ul angajatului
    let empleadoEmail: string | null = null;
    if (ausenciaData.codigo) {
      try {
        const empleado = await this.empleadosService.getEmpleadoByCodigo(
          ausenciaData.codigo,
        );
        empleadoEmail =
          empleado?.['CORREO ELECTRONICO'] ||
          empleado?.CORREO_ELECTRONICO ||
          null;
      } catch (error: any) {
        this.logger.warn(
          `⚠️ [sendAusenciaEmailToEmpleado] Could not fetch empleado email for ${ausenciaData.codigo}: ${error.message}`,
        );
      }
    }

    if (!empleadoEmail || empleadoEmail.trim() === '') {
      this.logger.warn(
        `⚠️ [sendAusenciaEmailToEmpleado] No email found for empleado ${ausenciaData.codigo}, skipping email notification`,
      );
      return;
    }

    // Definește variabilele înainte de try pentru a fi disponibile în catch
    let subject = '';
    let html = '';

    try {
      const emailData = this.formatAusenciaEmailHtml(ausenciaData);
      subject = emailData.subject;
      html = emailData.html;

      this.logger.log(
        `📧 [sendAusenciaEmailToEmpleado] Sending email to empleado ${empleadoEmail} - subject: ${subject}`,
      );
      await this.emailService.sendEmail(empleadoEmail, subject, html);
      this.logger.log(
        `✅ [sendAusenciaEmailToEmpleado] Email notification sent to ${empleadoEmail} for ausencia ${ausenciaData.codigo}`,
      );

      // Salvează email-ul în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: 'system',
          recipientType: 'empleado',
          recipientId: ausenciaData.codigo,
          recipientEmail: empleadoEmail,
          recipientName: ausenciaData.nombre,
          subject,
          message: html,
          status: 'sent',
        });
      } catch (saveError: any) {
        this.logger.warn(
          `⚠️ [sendAusenciaEmailToEmpleado] Eroare la salvarea email-ului în BD: ${saveError.message}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `❌ [sendAusenciaEmailToEmpleado] Error sending email notification to empleado (non-blocking): ${error.message}`,
      );

      // Salvează și email-urile eșuate în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: 'system',
          recipientType: 'empleado',
          recipientId: ausenciaData.codigo,
          recipientEmail: empleadoEmail,
          recipientName: ausenciaData.nombre,
          subject: subject || `Ausencia ${ausenciaData.codigo}`,
          message: html || '',
          status: 'failed',
          errorMessage: error.message || String(error),
        });
      } catch (saveError: any) {
        this.logger.warn(
          `⚠️ [sendAusenciaEmailToEmpleado] Eroare la salvarea email-ului eșuat în BD: ${saveError.message}`,
        );
      }

      // Nu aruncăm eroarea pentru a nu opri flow-ul principal
    }
  }

  /**
   * Trimite email pentru notificare absență (către gestoria)
   */
  private async sendAusenciaEmail(ausenciaData: {
    codigo: string;
    nombre: string;
    tipo: string;
    fecha: string;
    motivo?: string;
  }): Promise<void> {
    if (!this.emailService.isConfigured()) {
      this.logger.warn(
        '⚠️ Email service not configured. Email notification not sent.',
      );
      return;
    }

    // Definește variabilele înainte de try pentru a fi disponibile în catch
    let subject = '';
    let html = '';

    try {
      const emailData = this.formatAusenciaEmailHtml(ausenciaData);
      subject = emailData.subject;
      html = emailData.html;

      await this.emailService.sendEmail(this.EMAIL_RECIPIENT, subject, html, {
        bcc: ['decamino.rrhh@gmail.com'],
      });
      this.logger.log(
        `✅ Email notification sent to ${this.EMAIL_RECIPIENT} for ausencia ${ausenciaData.codigo}`,
      );

      // Salvează email-ul în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: ausenciaData.codigo || 'system',
          recipientType: 'gestoria',
          recipientEmail: this.EMAIL_RECIPIENT,
          recipientName: 'Solicitudes',
          subject,
          message: html,
          status: 'sent',
        });
      } catch (saveError: any) {
        this.logger.warn(
          `⚠️ Eroare la salvarea email-ului în BD: ${saveError.message}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Error sending email notification (non-blocking): ${error.message}`,
      );

      // Salvează și email-urile eșuate în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: ausenciaData.codigo || 'system',
          recipientType: 'gestoria',
          recipientEmail: this.EMAIL_RECIPIENT,
          recipientName: 'Solicitudes',
          subject: subject || `Ausencia ${ausenciaData.codigo}`,
          message: html || '',
          status: 'failed',
          errorMessage: error.message || String(error),
        });
      } catch (saveError: any) {
        this.logger.warn(
          `⚠️ Eroare la salvarea email-ului eșuat în BD: ${saveError.message}`,
        );
      }

      // Nu aruncăm eroarea pentru a nu opri flow-ul principal
    }
  }

  /**
   * Formatează mesajul pentru email (HTML) pentru ștergerea unei ausencias
   */
  private formatAusenciaDeletedEmailHtml(ausenciaData: {
    codigo: string;
    nombre: string;
    tipo: string;
    fecha: string;
    motivo?: string;
  }): { subject: string; html: string } {
    const actionEmoji = '🔴';
    const actionText = 'Ausencia eliminada';

    const subject = `${actionEmoji} ${actionText} - ${ausenciaData.nombre} (${ausenciaData.codigo})`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background-color: #fee; padding: 20px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #dc3545; }
    .info-row { margin: 10px 0; }
    .label { font-weight: bold; color: #555; }
    .value { color: #333; }
  </style>
</head>
<body>
  <div class="header">
    <h2>${actionEmoji} ${actionText}</h2>
  </div>
  
  <div class="info-row">
    <span class="label">👤 Empleado:</span>
    <span class="value">${ausenciaData.nombre} (${ausenciaData.codigo})</span>
  </div>
  
  <div class="info-row">
    <span class="label">📋 Tipo:</span>
    <span class="value">${ausenciaData.tipo}</span>
  </div>
  
  <div class="info-row">
    <span class="label">📆 Fecha:</span>
    <span class="value">${ausenciaData.fecha}</span>
  </div>
  
  ${
    ausenciaData.motivo
      ? `
  <div class="info-row">
    <span class="label">📝 Motivo:</span>
    <span class="value">${ausenciaData.motivo}</span>
  </div>
  `
      : ''
  }
  
  <hr style="margin-top: 20px; border: none; border-top: 1px solid #ddd;">
  <p style="color: #888; font-size: 12px; margin-top: 20px;">
    Este es un mensaje automático del sistema De Camino Servicios Auxiliares SL.
  </p>
</body>
</html>
    `.trim();

    return { subject, html };
  }

  /**
   * Trimite email către angajat când se șterge o ausencia
   */
  private async sendAusenciaDeletedEmailToEmpleado(ausenciaData: {
    codigo: string;
    nombre: string;
    tipo: string;
    fecha: string;
    motivo?: string;
  }): Promise<void> {
    this.logger.log(
      `📧 [sendAusenciaDeletedEmailToEmpleado] Called for ausencia delete - codigo: ${ausenciaData.codigo}`,
    );

    if (!this.emailService.isConfigured()) {
      this.logger.warn(
        `⚠️ [sendAusenciaDeletedEmailToEmpleado] Email service not configured. Email notification not sent to empleado for ausencia delete - codigo: ${ausenciaData.codigo}`,
      );
      return;
    }

    // Obține email-ul angajatului
    let empleadoEmail: string | null = null;
    if (ausenciaData.codigo) {
      try {
        const empleado = await this.empleadosService.getEmpleadoByCodigo(
          ausenciaData.codigo,
        );
        empleadoEmail =
          empleado?.['CORREO ELECTRONICO'] ||
          empleado?.CORREO_ELECTRONICO ||
          null;
      } catch (error: any) {
        this.logger.warn(
          `⚠️ [sendAusenciaDeletedEmailToEmpleado] Could not fetch empleado email for ${ausenciaData.codigo}: ${error.message}`,
        );
      }
    }

    if (!empleadoEmail || empleadoEmail.trim() === '') {
      this.logger.warn(
        `⚠️ [sendAusenciaDeletedEmailToEmpleado] No email found for empleado ${ausenciaData.codigo}, skipping email notification`,
      );
      return;
    }

    // Definește variabilele înainte de try pentru a fi disponibile în catch
    let subject = '';
    let html = '';

    try {
      const emailData = this.formatAusenciaDeletedEmailHtml(ausenciaData);
      subject = emailData.subject;
      html = emailData.html;

      this.logger.log(
        `📧 [sendAusenciaDeletedEmailToEmpleado] Sending email to empleado ${empleadoEmail} for ausencia delete - subject: ${subject}`,
      );
      await this.emailService.sendEmail(empleadoEmail, subject, html);
      this.logger.log(
        `✅ [sendAusenciaDeletedEmailToEmpleado] Email notification sent to ${empleadoEmail} for ausencia delete ${ausenciaData.codigo}`,
      );

      // Salvează email-ul în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: 'system',
          recipientType: 'empleado',
          recipientId: ausenciaData.codigo,
          recipientEmail: empleadoEmail,
          recipientName: ausenciaData.nombre,
          subject,
          message: html,
          status: 'sent',
        });
      } catch (saveError: any) {
        this.logger.warn(
          `⚠️ [sendAusenciaDeletedEmailToEmpleado] Eroare la salvarea email-ului în BD: ${saveError.message}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `❌ [sendAusenciaDeletedEmailToEmpleado] Error sending email notification to empleado for ausencia delete (non-blocking): ${error.message}`,
      );

      // Salvează și email-urile eșuate în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: 'system',
          recipientType: 'empleado',
          recipientId: ausenciaData.codigo,
          recipientEmail: empleadoEmail,
          recipientName: ausenciaData.nombre,
          subject: subject || `Ausencia eliminada ${ausenciaData.codigo}`,
          message: html || '',
          status: 'failed',
          errorMessage: error.message || String(error),
        });
      } catch (saveError: any) {
        this.logger.warn(
          `⚠️ [sendAusenciaDeletedEmailToEmpleado] Eroare la salvarea email-ului eșuat în BD: ${saveError.message}`,
        );
      }

      // Nu aruncăm eroarea pentru a nu opri flow-ul principal
    }
  }

  /**
   * Trimite email pentru notificare ștergere ausencia (către gestoria)
   */
  private async sendAusenciaDeletedEmail(ausenciaData: {
    codigo: string;
    nombre: string;
    tipo: string;
    fecha: string;
    motivo?: string;
  }): Promise<void> {
    this.logger.log(
      `📧 [sendAusenciaDeletedEmail] Called for ausencia delete - codigo: ${ausenciaData.codigo}`,
    );

    if (!this.emailService.isConfigured()) {
      this.logger.warn(
        `⚠️ [sendAusenciaDeletedEmail] Email service not configured. Email notification not sent for ausencia delete - codigo: ${ausenciaData.codigo}`,
      );
      return;
    }

    // Definește variabilele înainte de try pentru a fi disponibile în catch
    let subject = '';
    let html = '';

    try {
      const emailData = this.formatAusenciaDeletedEmailHtml(ausenciaData);
      subject = emailData.subject;
      html = emailData.html;

      this.logger.log(
        `📧 [sendAusenciaDeletedEmail] Sending email for ausencia delete - subject: ${subject}`,
      );
      await this.emailService.sendEmail(this.EMAIL_RECIPIENT, subject, html, {
        bcc: ['decamino.rrhh@gmail.com'],
      });
      this.logger.log(
        `✅ [sendAusenciaDeletedEmail] Email notification sent to ${this.EMAIL_RECIPIENT} for ausencia delete ${ausenciaData.codigo}`,
      );

      // Salvează email-ul în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: ausenciaData.codigo || 'system',
          recipientType: 'gestoria',
          recipientEmail: this.EMAIL_RECIPIENT,
          recipientName: 'Solicitudes',
          subject,
          message: html,
          status: 'sent',
        });
      } catch (saveError: any) {
        this.logger.warn(
          `⚠️ [sendAusenciaDeletedEmail] Eroare la salvarea email-ului în BD: ${saveError.message}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `❌ [sendAusenciaDeletedEmail] Error sending email notification for ausencia delete (non-blocking): ${error.message}`,
      );

      // Salvează și email-urile eșuate în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: ausenciaData.codigo || 'system',
          recipientType: 'gestoria',
          recipientEmail: this.EMAIL_RECIPIENT,
          recipientName: 'Solicitudes',
          subject: subject || `Ausencia eliminada ${ausenciaData.codigo}`,
          message: html || '',
          status: 'failed',
          errorMessage: error.message || String(error),
        });
      } catch (saveError: any) {
        this.logger.warn(
          `⚠️ [sendAusenciaDeletedEmail] Eroare la salvarea email-ului eșuat în BD: ${saveError.message}`,
        );
      }

      // Nu aruncăm eroarea pentru a nu opri flow-ul principal
    }
  }

  /**
   * Escapă un string pentru SQL
   */
  private escapeSql(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    const str = String(value);
    // Escape single quotes și backslashes
    const escaped = str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }

  /**
   * Transformă o dată din format string în format YYYY-MM-DD
   */
  private parseFecha(fecha: string | null): {
    inicio: string | null;
    fin: string | null;
  } {
    if (!fecha) {
      return { inicio: null, fin: null };
    }

    const fechaClean = fecha.trim();

    // Detectează formatul: YYYY-MM-DD- YYYY-MM-DD (interval cu aceeași dată, fără spațiu între "-" și "-")
    // Exemplu: "2025-12-08- 2025-12-08" -> tratăm ca interval "2025-12-08 - 2025-12-08"
    const sameDateIntervalPattern = /^(\d{4}-\d{2}-\d{2})-\s*(\1)$/;
    const match = fechaClean.match(sameDateIntervalPattern);
    if (match) {
      const fechaUnica = match[1];
      // Returnează ca interval cu aceeași dată
      return { inicio: fechaUnica, fin: fechaUnica };
    }

    // Verifică dacă este un interval normal (format: "YYYY-MM-DD - YYYY-MM-DD")
    if (fechaClean.includes(' - ')) {
      const partes = fechaClean.split(' - ').map((p) => p.trim());
      const inicio = partes[0] || null;
      const fin = partes[1] || partes[0] || null;
      return { inicio, fin };
    }

    // Dacă nu este interval, este o dată simplă
    return { inicio: fechaClean, fin: fechaClean };
  }

  /**
   * Calculează zilele aprobate pentru tipurile pe zile
   */
  private calculateDiasAprobados(
    tipo: string,
    duracion: string | null,
    fechaInicio: string | null,
    fechaFin: string | null,
  ): number | null {
    // Tipuri de absențe care se calculează în ZILE
    const tipuriZile = [
      'Vacaciones',
      'Asunto Propio',
      'Permiso Retribuido',
      'Permiso Recuperable',
      'Permiso No Retribuido',
      'Permiso sin sueldo',
      'Permiso médico',
      'Permiso',
      'Baja',
    ];

    const tipoLower = tipo.toLowerCase();
    const estePeZile = tipuriZile.some((t) =>
      tipoLower.includes(t.toLowerCase()),
    );

    if (!estePeZile) {
      return null;
    }

    // Dacă avem durata explicită în baza de date, o folosim
    if (duracion !== null && duracion !== undefined && duracion !== '') {
      const duracionNum = Number(duracion);
      if (!isNaN(duracionNum)) {
        return duracionNum;
      }
    }

    // Altfel, calculăm din intervalul de date
    if (fechaInicio && fechaFin) {
      const dInicio = new Date(fechaInicio);
      const dFin = new Date(fechaFin);

      // Verifică dacă datele sunt valide
      if (isNaN(dInicio.getTime()) || isNaN(dFin.getTime())) {
        return null;
      }

      const diffMs = dFin.getTime() - dInicio.getTime();
      const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(1, diffDias); // Minimum 1 zi
    }

    return null;
  }

  /**
   * Normalizează o valoare pentru SQL (tratează 'undefined', '[undefined]', 'null', '', etc. ca NULL)
   */
  private normalizeSqlValue(value: any): any {
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      value === 'undefined' ||
      value === '[undefined]' ||
      value === 'null'
    ) {
      return null;
    }
    return value;
  }

  /**
   * Extrage ora de sfârșit din cuadrante_asignado sau horario_asignado
   */
  private extractFinTime(cuadranteAsignado: any, horarioAsignado: any): string {
    if (cuadranteAsignado?.intervalos?.[0]?.fin) {
      return cuadranteAsignado.intervalos[0].fin;
    }
    if (horarioAsignado?.intervalos?.[0]?.fin) {
      return horarioAsignado.intervalos[0].fin;
    }
    return '00:00';
  }

  /**
   * Extrage orele zilnice din cuadrante_asignado sau horario_asignado
   */
  private extractHorasDiarias(
    cuadranteAsignado: any,
    horarioAsignado: any,
  ): number {
    if (cuadranteAsignado?.horas_diarias) {
      return Number(cuadranteAsignado.horas_diarias) || 0;
    }
    if (horarioAsignado?.horas_diarias) {
      return Number(horarioAsignado.horas_diarias) || 0;
    }
    return 0;
  }

  /**
   * Adaugă o absență nouă (reproduce logica din n8n: registro ausencia.json)
   */
  async addAusencia(ausenciaData: {
    solicitud_id: string;
    codigo: string;
    nombre: string;
    tipo: string;
    data?: string; // pentru dată simplă
    permiso_fecha_inicio?: string; // pentru interval
    permiso_fecha_fin?: string; // pentru interval
    hora: string;
    locatia?: string;
    motivo?: string;
    cuadrante_asignado?: any;
    horario_asignado?: any;
    sin_horario_asignado?: boolean;
    no_necesita_justificante?: boolean; // Flag pentru a marca că nu necesită justificante (ex: premii Hall of Fame)
  }): Promise<{ success: true; id: number }> {
    try {
      // Validări
      if (
        !ausenciaData.solicitud_id ||
        ausenciaData.solicitud_id.trim() === ''
      ) {
        throw new BadRequestException('solicitud_id is required');
      }
      if (!ausenciaData.codigo || ausenciaData.codigo.trim() === '') {
        throw new BadRequestException('codigo is required');
      }
      if (!ausenciaData.nombre || ausenciaData.nombre.trim() === '') {
        throw new BadRequestException('nombre is required');
      }
      if (!ausenciaData.tipo || ausenciaData.tipo.trim() === '') {
        throw new BadRequestException('tipo is required');
      }
      if (!ausenciaData.hora || ausenciaData.hora.trim() === '') {
        throw new BadRequestException('hora is required');
      }

      // Normalizează datele
      const permisoFechaInicio = this.normalizeSqlValue(
        ausenciaData.permiso_fecha_inicio,
      );
      const permisoFechaFin = this.normalizeSqlValue(
        ausenciaData.permiso_fecha_fin,
      );
      const dataSingle = this.normalizeSqlValue(ausenciaData.data);
      const tipoNorm = (this.normalizeSqlValue(ausenciaData.tipo) || '')
        .toLowerCase()
        .trim();

      // Construiește query-ul SQL exact ca în n8n
      // Folosim SELECT pentru a calcula valorile și apoi INSERT
      const noNecesitaJustificante =
        ausenciaData.no_necesita_justificante === true ? 1 : 0;
      const query = `
        INSERT INTO Ausencias (
          solicitud_id,
          CODIGO,
          NOMBRE,
          TIPO,
          FECHA,
          HORA,
          LOCACION,
          MOTIVO,
          DURACION,
          UNIDAD_DURACION,
          no_necesita_justificante
        )
        SELECT
          ${this.escapeSql(ausenciaData.solicitud_id)},
          ${this.escapeSql(ausenciaData.codigo)},
          ${this.escapeSql(ausenciaData.nombre)},
          ${this.escapeSql(ausenciaData.tipo)},
          CASE
            WHEN t.ini IS NOT NULL AND t.fin IS NOT NULL
              THEN CONCAT(DATE_FORMAT(t.ini,'%Y-%m-%d'), ' - ', DATE_FORMAT(t.fin,'%Y-%m-%d'))
            WHEN t.single IS NOT NULL
              THEN DATE_FORMAT(t.single,'%Y-%m-%d')
            ELSE ''
          END AS FECHA,
          ${this.escapeSql(ausenciaData.hora)},
          ${ausenciaData.locatia ? this.escapeSql(ausenciaData.locatia) : 'NULL'},
          CASE
            WHEN t.tipo_norm = 'salida sin regreso'
              THEN CONCAT(${ausenciaData.motivo ? this.escapeSql(ausenciaData.motivo) : "''"}, ' (sin regreso)')
            ELSE ${ausenciaData.motivo ? this.escapeSql(ausenciaData.motivo) : 'NULL'}
          END AS MOTIVO,
          CASE
            WHEN t.tipo_norm = 'salida centro' THEN NULL
            WHEN t.tipo_norm = 'salida sin regreso' THEN
              CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM Fichaje f
                  WHERE f.CODIGO = ${this.escapeSql(ausenciaData.codigo)}
                    AND f.FECHA  = t.single
                )
                THEN
                  SEC_TO_TIME(
                    GREATEST(
                      0,
                      TIME_TO_SEC(
                        TIMEDIFF(
                          STR_TO_DATE(${this.escapeSql(
                            this.extractFinTime(
                              ausenciaData.cuadrante_asignado,
                              ausenciaData.horario_asignado,
                            ),
                          )}, '%H:%i'),
                          STR_TO_DATE(
                            COALESCE(
                              (
                                SELECT MAX(f2.HORA)
                                FROM Fichaje f2
                                WHERE f2.CODIGO = ${this.escapeSql(ausenciaData.codigo)}
                                  AND f2.FECHA  = t.single
                                  AND f2.TIPO   = 'Salida'
                              ),
                              ${this.escapeSql(ausenciaData.hora)}
                            ),
                            '%H:%i:%s'
                          )
                        )
                      )
                    )
                  )
                ELSE
                  SEC_TO_TIME(
                    ${this.extractHorasDiarias(
                      ausenciaData.cuadrante_asignado,
                      ausenciaData.horario_asignado,
                    )} * 3600
                  )
              END
            ELSE
              GREATEST(
                1,
                CASE
                  WHEN t.ini IS NOT NULL AND t.fin IS NOT NULL
                    THEN 1 + ABS(DATEDIFF(t.fin, t.ini))
                  WHEN t.single IS NOT NULL
                    THEN 1
                  ELSE 1
                END
              )
          END AS DURACION,
          CASE
            WHEN t.tipo_norm IN ('salida sin regreso', 'salida centro', 'entrada centro')
              THEN 'horas'
            ELSE 'dias'
          END AS UNIDAD_DURACION,
          ${noNecesitaJustificante} AS no_necesita_justificante
        FROM (
          SELECT
            CAST(${
              permisoFechaInicio ? this.escapeSql(permisoFechaInicio) : 'NULL'
            } AS DATE) AS ini,
            CAST(${
              permisoFechaFin ? this.escapeSql(permisoFechaFin) : 'NULL'
            } AS DATE) AS fin,
            CAST(${
              dataSingle ? this.escapeSql(dataSingle) : 'NULL'
            } AS DATE) AS single,
            ${this.escapeSql(tipoNorm)} AS tipo_norm
        ) AS t;
      `;

      await this.prisma.$executeRawUnsafe(query);

      // Obține ID-ul înregistrării create (folosim solicitud_id care este unic)
      let insertedId: number | null = null;
      try {
        const insertedRows = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT id FROM Ausencias WHERE solicitud_id = ${this.escapeSql(ausenciaData.solicitud_id)} LIMIT 1`,
        );
        insertedId = insertedRows?.[0]?.id ? Number(insertedRows[0].id) : null;
      } catch (idError: any) {
        // Dacă nu putem obține ID-ul, încă returnăm success (înregistrarea a fost creată)
        this.logger.warn(
          `⚠️ Could not retrieve inserted ID: ${idError.message}`,
        );
        insertedId = null;
      }

      this.logger.log(
        `✅ Ausencia added: ID=${insertedId || 'unknown'}, CODIGO=${ausenciaData.codigo}, TIPO=${ausenciaData.tipo}, solicitud_id=${ausenciaData.solicitud_id}`,
      );

      // Trimite notificare pe Telegram și Email (complet async, nu așteptăm răspunsul)
      // Folosim setImmediate pentru a nu bloca răspunsul API-ului
      const ausenciaNotificationData = {
        codigo: ausenciaData.codigo,
        nombre: ausenciaData.nombre,
        tipo: ausenciaData.tipo,
        fecha:
          permisoFechaInicio && permisoFechaFin
            ? `${permisoFechaInicio} - ${permisoFechaFin}`
            : dataSingle || 'N/A',
        motivo: ausenciaData.motivo,
      };

      setImmediate(() => {
        // Telegram notification
        this.telegramService
          .sendAusenciaNotification(ausenciaNotificationData)
          .catch((telegramError: any) => {
            // Nu aruncăm eroarea, doar logăm
            this.logger.warn(
              `⚠️ Error sending Telegram notification (non-blocking): ${telegramError.message}`,
            );
          });

        // Email notification către gestoria
        this.sendAusenciaEmail(ausenciaNotificationData).catch(
          (emailError: any) => {
            this.logger.warn(
              `⚠️ Error sending email notification to gestoria (non-blocking): ${emailError.message}`,
            );
          },
        );

        // Email notification către angajat
        this.logger.log(
          `📧 [ADD] Attempting to send email notification to empleado - ausencia: ${ausenciaNotificationData.codigo}`,
        );
        this.sendAusenciaEmailToEmpleado(ausenciaNotificationData)
          .then(() => {
            this.logger.log(
              `✅ [ADD] Email notification sent to empleado successfully - ausencia: ${ausenciaNotificationData.codigo}`,
            );
          })
          .catch((emailError: any) => {
            this.logger.error(
              `❌ [ADD] Error sending email notification to empleado (non-blocking): ${emailError.message}`,
            );
          });
      });

      return { success: true, id: insertedId || 0 };
    } catch (error: any) {
      this.logger.error('❌ Error adding ausencia:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al agregar ausencia: ${error.message}`,
      );
    }
  }

  /**
   * Obtine lista de ausencias cu filtrare opțională pe codigo și MES
   */
  /**
   * Șterge o ausencia din baza de date
   */
  async deleteAusencia(
    id: number,
  ): Promise<{ success: true; message: string }> {
    try {
      if (!id) {
        throw new BadRequestException('id is required');
      }

      // Verifică dacă ausencia există
      const ausencia = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT id, CODIGO, NOMBRE, TIPO, FECHA, MOTIVO
        FROM Ausencias
        WHERE id = ${Number(id)}
        LIMIT 1
      `);

      if (!ausencia || ausencia.length === 0) {
        throw new BadRequestException(`Ausencia cu ID ${id} nu a fost găsită`);
      }

      const ausenciaData = ausencia[0];
      const codigo = ausenciaData.CODIGO;
      const nombre = ausenciaData.NOMBRE;
      const tipo = ausenciaData.TIPO;
      const fecha = ausenciaData.FECHA;
      const motivo = ausenciaData.MOTIVO || '';

      // Verifică dacă este un premiu (Permiso Retribuido cu MOTIVO care conține "Premio - Salón de la Fama")
      const esPremio =
        tipo === 'Permiso Retribuido' &&
        motivo.includes('Premio - Salón de la Fama');

      // Șterge ausencia
      await this.prisma.$executeRawUnsafe(`
        DELETE FROM Ausencias
        WHERE id = ${Number(id)}
      `);

      this.logger.log(`✅ Ausencia ${id} eliminada exitosamente`);

      // Trimite notificări pentru toate ausencias (async, non-blocking)
      setImmediate(() => {
        // Dacă este un premiu, folosește metoda specială pentru premii
        if (esPremio) {
          this.sendPremioDeletedNotifications(
            codigo,
            nombre,
            fecha,
            motivo,
          ).catch((error) => {
            this.logger.warn(
              `⚠️ Error sending premio deleted notifications (non-blocking): ${error.message}`,
            );
          });
        } else {
          // Pentru ausencias normale, trimite notificări standard
          const ausenciaNotificationData = {
            codigo: codigo,
            nombre: nombre,
            tipo: tipo,
            fecha: fecha,
            estado: 'Eliminada',
            motivo: motivo,
            accion: 'delete' as const,
          };

          // Telegram notification
          this.telegramService
            .sendSolicitudNotification(ausenciaNotificationData)
            .catch((telegramError: any) => {
              this.logger.warn(
                `⚠️ Error sending Telegram notification (non-blocking): ${telegramError.message}`,
              );
            });

          // Email notification către gestore
          this.sendAusenciaDeletedEmail(ausenciaNotificationData).catch(
            (emailError: any) => {
              this.logger.warn(
                `⚠️ Error sending email notification to gestore (non-blocking): ${emailError.message}`,
              );
            },
          );

          // Email notification către angajat
          this.sendAusenciaDeletedEmailToEmpleado(
            ausenciaNotificationData,
          ).catch((emailError: any) => {
            this.logger.warn(
              `⚠️ Error sending email notification to empleado (non-blocking): ${emailError.message}`,
            );
          });
        }
      });

      return {
        success: true,
        message: 'Ausencia eliminada correctamente',
      };
    } catch (error: any) {
      this.logger.error(`❌ Error deleting ausencia ${id}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar la ausencia: ${error.message}`,
      );
    }
  }

  /**
   * Actualizează flag-ul no_necesita_justificante pentru o ausencia
   */
  async updateNoNecesitaJustificante(
    id: number,
    noNecesitaJustificante: boolean,
  ): Promise<{ success: true; message: string }> {
    try {
      if (!id) {
        throw new BadRequestException('id is required');
      }

      // Verifică dacă ausencia există
      const ausencia = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT id, CODIGO, NOMBRE, TIPO
        FROM Ausencias
        WHERE id = ${Number(id)}
        LIMIT 1
      `);

      if (!ausencia || ausencia.length === 0) {
        throw new BadRequestException(`Ausencia cu ID ${id} nu a fost găsită`);
      }

      // Actualizează flag-ul
      await this.prisma.$executeRawUnsafe(`
        UPDATE Ausencias
        SET no_necesita_justificante = ${noNecesitaJustificante ? 1 : 0}
        WHERE id = ${Number(id)}
      `);

      this.logger.log(
        `✅ Ausencia ${id} actualizada: no_necesita_justificante = ${noNecesitaJustificante}`,
      );

      return {
        success: true,
        message: noNecesitaJustificante
          ? 'Ausencia marcada como "No necesita justificante"'
          : 'Flag "No necesita justificante" eliminado',
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error updating no_necesita_justificante for ausencia ${id}:`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar ausencia: ${error.message}`,
      );
    }
  }

  /**
   * Recalculează durata unei ausencias bazat pe intervalul de date din FECHA
   */
  async recalcularDuracion(id: number): Promise<{
    success: true;
    message: string;
    duracion: number;
    unidad?: string;
  }> {
    try {
      if (!id) {
        throw new BadRequestException('id is required');
      }

      // Obține ausencia cu FECHA și TIPO
      const ausencia = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT id, CODIGO, NOMBRE, TIPO, FECHA, DURACION, UNIDAD_DURACION
        FROM Ausencias
        WHERE id = ${Number(id)}
        LIMIT 1
      `);

      if (!ausencia || ausencia.length === 0) {
        throw new BadRequestException(`Ausencia cu ID ${id} nu a fost găsită`);
      }

      const ausenciaData = ausencia[0];
      const tipo = (ausenciaData.TIPO || '').toLowerCase();
      const fecha = ausenciaData.FECHA || '';
      const codigo = ausenciaData.CODIGO || '';

      // Verifică dacă este "Ausencias justificada" - calculează în ore
      const esAusenciaJustificada =
        (tipo.includes('ausencia') && tipo.includes('justificada')) ||
        tipo === 'ausencias justificada' ||
        tipo === 'ausencia justificada';

      if (esAusenciaJustificada) {
        // Calculează durata în ore pentru "Ausencias justificada"
        return await this.recalcularDuracionHoras(
          id,
          ausenciaData,
          codigo,
          fecha,
        );
      }

      // Verifică dacă este un tip pe zile
      const esTipoZile =
        tipo.includes('permiso') ||
        tipo.includes('asunto propio') ||
        tipo.includes('vacacion') ||
        tipo.includes('ausencia');

      if (!esTipoZile) {
        throw new BadRequestException(
          `Este tipo de ausencia (${ausenciaData.TIPO}) no se recalcula automáticamente`,
        );
      }

      // Parsează FECHA pentru a extrage intervalul
      let fechaInicio: string | null = null;
      let fechaFin: string | null = null;

      if (fecha.includes(' - ')) {
        // Interval de date
        const partes = fecha.split(' - ');
        fechaInicio = partes[0]?.trim() || null;
        fechaFin = partes[1]?.trim() || null;
      } else if (fecha) {
        // O singură dată
        fechaInicio = fecha.trim();
        fechaFin = fecha.trim();
      }

      if (!fechaInicio) {
        throw new BadRequestException(
          'No se puede calcular la duración: FECHA no válida',
        );
      }

      // Calculează durata
      let nuevaDuracion: number;
      const esPermisoRetribuido = tipo.includes('permiso retribuido');

      if (fechaInicio === fechaFin) {
        // Pentru o singură dată, verifică dacă este zi lucrătoare
        if (esPermisoRetribuido) {
          // Verifică dacă este zi lucrătoare și dacă angajatul are programat să lucreze
          const diaLaborableQuery = `
            SELECT 
              CASE 
                WHEN DAYOFWEEK(${this.escapeSql(fechaInicio)}) BETWEEN 2 AND 6 
                  AND NOT EXISTS (
                    SELECT 1 FROM fiestas f
                    WHERE DATE(COALESCE(f.observed_date, f.date)) = ${this.escapeSql(fechaInicio)}
                      AND f.active = 1
                      AND (
                        LOWER(f.scope) IN ('nacional', 'national')
                        OR (LOWER(f.scope) IN ('autonómico', 'autonomico', 'ccaa') 
                            AND f.ccaa_code = '')
                      )
                      AND NOT EXISTS (
                        SELECT 1 FROM DatosEmpleados de
                        WHERE de.CODIGO = ${this.escapeSql(codigo)}
                          AND LOWER(TRIM(de.TrabajaFestivos)) IN ('si','sí','s','1','true','da','y')
                      )
                  )
                  AND (
                    -- Are cuadrante cu valoare validă pentru ziua respectivă
                    EXISTS (
                      SELECT 1 FROM cuadrante cq
                      WHERE BINARY cq.CODIGO = ${this.escapeSql(codigo)}
                        AND BINARY cq.LUNA = DATE_FORMAT(${this.escapeSql(fechaInicio)}, '%Y-%m')
                        AND CASE DAY(${this.escapeSql(fechaInicio)})
                          WHEN 1 THEN cq.ZI_1 WHEN 2 THEN cq.ZI_2 WHEN 3 THEN cq.ZI_3 WHEN 4 THEN cq.ZI_4
                          WHEN 5 THEN cq.ZI_5 WHEN 6 THEN cq.ZI_6 WHEN 7 THEN cq.ZI_7 WHEN 8 THEN cq.ZI_8
                          WHEN 9 THEN cq.ZI_9 WHEN 10 THEN cq.ZI_10 WHEN 11 THEN cq.ZI_11 WHEN 12 THEN cq.ZI_12
                          WHEN 13 THEN cq.ZI_13 WHEN 14 THEN cq.ZI_14 WHEN 15 THEN cq.ZI_15 WHEN 16 THEN cq.ZI_16
                          WHEN 17 THEN cq.ZI_17 WHEN 18 THEN cq.ZI_18 WHEN 19 THEN cq.ZI_19 WHEN 20 THEN cq.ZI_20
                          WHEN 21 THEN cq.ZI_21 WHEN 22 THEN cq.ZI_22 WHEN 23 THEN cq.ZI_23 WHEN 24 THEN cq.ZI_24
                          WHEN 25 THEN cq.ZI_25 WHEN 26 THEN cq.ZI_26 WHEN 27 THEN cq.ZI_27 WHEN 28 THEN cq.ZI_28
                          WHEN 29 THEN cq.ZI_29 WHEN 30 THEN cq.ZI_30 WHEN 31 THEN cq.ZI_31
                          ELSE NULL
                        END IS NOT NULL
                        AND TRIM(CASE DAY(${this.escapeSql(fechaInicio)})
                          WHEN 1 THEN cq.ZI_1 WHEN 2 THEN cq.ZI_2 WHEN 3 THEN cq.ZI_3 WHEN 4 THEN cq.ZI_4
                          WHEN 5 THEN cq.ZI_5 WHEN 6 THEN cq.ZI_6 WHEN 7 THEN cq.ZI_7 WHEN 8 THEN cq.ZI_8
                          WHEN 9 THEN cq.ZI_9 WHEN 10 THEN cq.ZI_10 WHEN 11 THEN cq.ZI_11 WHEN 12 THEN cq.ZI_12
                          WHEN 13 THEN cq.ZI_13 WHEN 14 THEN cq.ZI_14 WHEN 15 THEN cq.ZI_15 WHEN 16 THEN cq.ZI_16
                          WHEN 17 THEN cq.ZI_17 WHEN 18 THEN cq.ZI_18 WHEN 19 THEN cq.ZI_19 WHEN 20 THEN cq.ZI_20
                          WHEN 21 THEN cq.ZI_21 WHEN 22 THEN cq.ZI_22 WHEN 23 THEN cq.ZI_23 WHEN 24 THEN cq.ZI_24
                          WHEN 25 THEN cq.ZI_25 WHEN 26 THEN cq.ZI_26 WHEN 27 THEN cq.ZI_27 WHEN 28 THEN cq.ZI_28
                          WHEN 29 THEN cq.ZI_29 WHEN 30 THEN cq.ZI_30 WHEN 31 THEN cq.ZI_31
                          ELSE NULL
                        END) != ''
                        AND UPPER(TRIM(CASE DAY(${this.escapeSql(fechaInicio)})
                          WHEN 1 THEN cq.ZI_1 WHEN 2 THEN cq.ZI_2 WHEN 3 THEN cq.ZI_3 WHEN 4 THEN cq.ZI_4
                          WHEN 5 THEN cq.ZI_5 WHEN 6 THEN cq.ZI_6 WHEN 7 THEN cq.ZI_7 WHEN 8 THEN cq.ZI_8
                          WHEN 9 THEN cq.ZI_9 WHEN 10 THEN cq.ZI_10 WHEN 11 THEN cq.ZI_11 WHEN 12 THEN cq.ZI_12
                          WHEN 13 THEN cq.ZI_13 WHEN 14 THEN cq.ZI_14 WHEN 15 THEN cq.ZI_15 WHEN 16 THEN cq.ZI_16
                          WHEN 17 THEN cq.ZI_17 WHEN 18 THEN cq.ZI_18 WHEN 19 THEN cq.ZI_19 WHEN 20 THEN cq.ZI_20
                          WHEN 21 THEN cq.ZI_21 WHEN 22 THEN cq.ZI_22 WHEN 23 THEN cq.ZI_23 WHEN 24 THEN cq.ZI_24
                          WHEN 25 THEN cq.ZI_25 WHEN 26 THEN cq.ZI_26 WHEN 27 THEN cq.ZI_27 WHEN 28 THEN cq.ZI_28
                          WHEN 29 THEN cq.ZI_29 WHEN 30 THEN cq.ZI_30 WHEN 31 THEN cq.ZI_31
                          ELSE NULL
                        END)) NOT IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X')
                        AND (CASE DAY(${this.escapeSql(fechaInicio)})
                          WHEN 1 THEN cq.ZI_1 WHEN 2 THEN cq.ZI_2 WHEN 3 THEN cq.ZI_3 WHEN 4 THEN cq.ZI_4
                          WHEN 5 THEN cq.ZI_5 WHEN 6 THEN cq.ZI_6 WHEN 7 THEN cq.ZI_7 WHEN 8 THEN cq.ZI_8
                          WHEN 9 THEN cq.ZI_9 WHEN 10 THEN cq.ZI_10 WHEN 11 THEN cq.ZI_11 WHEN 12 THEN cq.ZI_12
                          WHEN 13 THEN cq.ZI_13 WHEN 14 THEN cq.ZI_14 WHEN 15 THEN cq.ZI_15 WHEN 16 THEN cq.ZI_16
                          WHEN 17 THEN cq.ZI_17 WHEN 18 THEN cq.ZI_18 WHEN 19 THEN cq.ZI_19 WHEN 20 THEN cq.ZI_20
                          WHEN 21 THEN cq.ZI_21 WHEN 22 THEN cq.ZI_22 WHEN 23 THEN cq.ZI_23 WHEN 24 THEN cq.ZI_24
                          WHEN 25 THEN cq.ZI_25 WHEN 26 THEN cq.ZI_26 WHEN 27 THEN cq.ZI_27 WHEN 28 THEN cq.ZI_28
                          WHEN 29 THEN cq.ZI_29 WHEN 30 THEN cq.ZI_30 WHEN 31 THEN cq.ZI_31
                          ELSE NULL
                        END LIKE '%:%-%:%' OR CASE DAY(${this.escapeSql(fechaInicio)})
                          WHEN 1 THEN cq.ZI_1 WHEN 2 THEN cq.ZI_2 WHEN 3 THEN cq.ZI_3 WHEN 4 THEN cq.ZI_4
                          WHEN 5 THEN cq.ZI_5 WHEN 6 THEN cq.ZI_6 WHEN 7 THEN cq.ZI_7 WHEN 8 THEN cq.ZI_8
                          WHEN 9 THEN cq.ZI_9 WHEN 10 THEN cq.ZI_10 WHEN 11 THEN cq.ZI_11 WHEN 12 THEN cq.ZI_12
                          WHEN 13 THEN cq.ZI_13 WHEN 14 THEN cq.ZI_14 WHEN 15 THEN cq.ZI_15 WHEN 16 THEN cq.ZI_16
                          WHEN 17 THEN cq.ZI_17 WHEN 18 THEN cq.ZI_18 WHEN 19 THEN cq.ZI_19 WHEN 20 THEN cq.ZI_20
                          WHEN 21 THEN cq.ZI_21 WHEN 22 THEN cq.ZI_22 WHEN 23 THEN cq.ZI_23 WHEN 24 THEN cq.ZI_24
                          WHEN 25 THEN cq.ZI_25 WHEN 26 THEN cq.ZI_26 WHEN 27 THEN cq.ZI_27 WHEN 28 THEN cq.ZI_28
                          WHEN 29 THEN cq.ZI_29 WHEN 30 THEN cq.ZI_30 WHEN 31 THEN cq.ZI_31
                          ELSE NULL
                        END REGEXP '^[0-9]+h')
                    )
                    OR
                    -- Sau are horario_multicentro cu valoare validă pentru ziua respectivă
                    (NOT EXISTS (
                      SELECT 1 FROM cuadrante cq2
                      WHERE BINARY cq2.CODIGO = ${this.escapeSql(codigo)}
                        AND BINARY cq2.LUNA = DATE_FORMAT(${this.escapeSql(fechaInicio)}, '%Y-%m')
                    )
                    AND EXISTS (
                      SELECT 1 FROM horario_multicentro hm
                      WHERE BINARY hm.CODIGO = ${this.escapeSql(codigo)}
                        AND BINARY hm.LUNA = DATE_FORMAT(${this.escapeSql(fechaInicio)}, '%Y-%m')
                        AND CASE DAY(${this.escapeSql(fechaInicio)})
                          WHEN 1 THEN hm.ZI_1 WHEN 2 THEN hm.ZI_2 WHEN 3 THEN hm.ZI_3 WHEN 4 THEN hm.ZI_4
                          WHEN 5 THEN hm.ZI_5 WHEN 6 THEN hm.ZI_6 WHEN 7 THEN hm.ZI_7 WHEN 8 THEN hm.ZI_8
                          WHEN 9 THEN hm.ZI_9 WHEN 10 THEN hm.ZI_10 WHEN 11 THEN hm.ZI_11 WHEN 12 THEN hm.ZI_12
                          WHEN 13 THEN hm.ZI_13 WHEN 14 THEN hm.ZI_14 WHEN 15 THEN hm.ZI_15 WHEN 16 THEN hm.ZI_16
                          WHEN 17 THEN hm.ZI_17 WHEN 18 THEN hm.ZI_18 WHEN 19 THEN hm.ZI_19 WHEN 20 THEN hm.ZI_20
                          WHEN 21 THEN hm.ZI_21 WHEN 22 THEN hm.ZI_22 WHEN 23 THEN hm.ZI_23 WHEN 24 THEN hm.ZI_24
                          WHEN 25 THEN hm.ZI_25 WHEN 26 THEN hm.ZI_26 WHEN 27 THEN hm.ZI_27 WHEN 28 THEN hm.ZI_28
                          WHEN 29 THEN hm.ZI_29 WHEN 30 THEN hm.ZI_30 WHEN 31 THEN hm.ZI_31
                          ELSE NULL
                        END IS NOT NULL
                        AND TRIM(CASE DAY(${this.escapeSql(fechaInicio)})
                          WHEN 1 THEN hm.ZI_1 WHEN 2 THEN hm.ZI_2 WHEN 3 THEN hm.ZI_3 WHEN 4 THEN hm.ZI_4
                          WHEN 5 THEN hm.ZI_5 WHEN 6 THEN hm.ZI_6 WHEN 7 THEN hm.ZI_7 WHEN 8 THEN hm.ZI_8
                          WHEN 9 THEN hm.ZI_9 WHEN 10 THEN hm.ZI_10 WHEN 11 THEN hm.ZI_11 WHEN 12 THEN hm.ZI_12
                          WHEN 13 THEN hm.ZI_13 WHEN 14 THEN hm.ZI_14 WHEN 15 THEN hm.ZI_15 WHEN 16 THEN hm.ZI_16
                          WHEN 17 THEN hm.ZI_17 WHEN 18 THEN hm.ZI_18 WHEN 19 THEN hm.ZI_19 WHEN 20 THEN hm.ZI_20
                          WHEN 21 THEN hm.ZI_21 WHEN 22 THEN hm.ZI_22 WHEN 23 THEN hm.ZI_23 WHEN 24 THEN hm.ZI_24
                          WHEN 25 THEN hm.ZI_25 WHEN 26 THEN hm.ZI_26 WHEN 27 THEN hm.ZI_27 WHEN 28 THEN hm.ZI_28
                          WHEN 29 THEN hm.ZI_29 WHEN 30 THEN hm.ZI_30 WHEN 31 THEN hm.ZI_31
                          ELSE NULL
                        END) != ''
                        AND UPPER(TRIM(CASE DAY(${this.escapeSql(fechaInicio)})
                          WHEN 1 THEN hm.ZI_1 WHEN 2 THEN hm.ZI_2 WHEN 3 THEN hm.ZI_3 WHEN 4 THEN hm.ZI_4
                          WHEN 5 THEN hm.ZI_5 WHEN 6 THEN hm.ZI_6 WHEN 7 THEN hm.ZI_7 WHEN 8 THEN hm.ZI_8
                          WHEN 9 THEN hm.ZI_9 WHEN 10 THEN hm.ZI_10 WHEN 11 THEN hm.ZI_11 WHEN 12 THEN hm.ZI_12
                          WHEN 13 THEN hm.ZI_13 WHEN 14 THEN hm.ZI_14 WHEN 15 THEN hm.ZI_15 WHEN 16 THEN hm.ZI_16
                          WHEN 17 THEN hm.ZI_17 WHEN 18 THEN hm.ZI_18 WHEN 19 THEN hm.ZI_19 WHEN 20 THEN hm.ZI_20
                          WHEN 21 THEN hm.ZI_21 WHEN 22 THEN hm.ZI_22 WHEN 23 THEN hm.ZI_23 WHEN 24 THEN hm.ZI_24
                          WHEN 25 THEN hm.ZI_25 WHEN 26 THEN hm.ZI_26 WHEN 27 THEN hm.ZI_27 WHEN 28 THEN hm.ZI_28
                          WHEN 29 THEN hm.ZI_29 WHEN 30 THEN hm.ZI_30 WHEN 31 THEN hm.ZI_31
                          ELSE NULL
                        END)) NOT IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X')
                        AND (CASE DAY(${this.escapeSql(fechaInicio)})
                          WHEN 1 THEN hm.ZI_1 WHEN 2 THEN hm.ZI_2 WHEN 3 THEN hm.ZI_3 WHEN 4 THEN hm.ZI_4
                          WHEN 5 THEN hm.ZI_5 WHEN 6 THEN hm.ZI_6 WHEN 7 THEN hm.ZI_7 WHEN 8 THEN hm.ZI_8
                          WHEN 9 THEN hm.ZI_9 WHEN 10 THEN hm.ZI_10 WHEN 11 THEN hm.ZI_11 WHEN 12 THEN hm.ZI_12
                          WHEN 13 THEN hm.ZI_13 WHEN 14 THEN hm.ZI_14 WHEN 15 THEN hm.ZI_15 WHEN 16 THEN hm.ZI_16
                          WHEN 17 THEN hm.ZI_17 WHEN 18 THEN hm.ZI_18 WHEN 19 THEN hm.ZI_19 WHEN 20 THEN hm.ZI_20
                          WHEN 21 THEN hm.ZI_21 WHEN 22 THEN hm.ZI_22 WHEN 23 THEN hm.ZI_23 WHEN 24 THEN hm.ZI_24
                          WHEN 25 THEN hm.ZI_25 WHEN 26 THEN hm.ZI_26 WHEN 27 THEN hm.ZI_27 WHEN 28 THEN hm.ZI_28
                          WHEN 29 THEN hm.ZI_29 WHEN 30 THEN hm.ZI_30 WHEN 31 THEN hm.ZI_31
                          ELSE NULL
                        END LIKE '%:%-%:%' OR CASE DAY(${this.escapeSql(fechaInicio)})
                          WHEN 1 THEN hm.ZI_1 WHEN 2 THEN hm.ZI_2 WHEN 3 THEN hm.ZI_3 WHEN 4 THEN hm.ZI_4
                          WHEN 5 THEN hm.ZI_5 WHEN 6 THEN hm.ZI_6 WHEN 7 THEN hm.ZI_7 WHEN 8 THEN hm.ZI_8
                          WHEN 9 THEN hm.ZI_9 WHEN 10 THEN hm.ZI_10 WHEN 11 THEN hm.ZI_11 WHEN 12 THEN hm.ZI_12
                          WHEN 13 THEN hm.ZI_13 WHEN 14 THEN hm.ZI_14 WHEN 15 THEN hm.ZI_15 WHEN 16 THEN hm.ZI_16
                          WHEN 17 THEN hm.ZI_17 WHEN 18 THEN hm.ZI_18 WHEN 19 THEN hm.ZI_19 WHEN 20 THEN hm.ZI_20
                          WHEN 21 THEN hm.ZI_21 WHEN 22 THEN hm.ZI_22 WHEN 23 THEN hm.ZI_23 WHEN 24 THEN hm.ZI_24
                          WHEN 25 THEN hm.ZI_25 WHEN 26 THEN hm.ZI_26 WHEN 27 THEN hm.ZI_27 WHEN 28 THEN hm.ZI_28
                          WHEN 29 THEN hm.ZI_29 WHEN 30 THEN hm.ZI_30 WHEN 31 THEN hm.ZI_31
                          ELSE NULL
                        END REGEXP '^[0-9]+h')
                    ))
                    OR
                    -- Sau are horario programat pentru ziua respectivă
                    (NOT EXISTS (
                      SELECT 1 FROM cuadrante cq3
                      WHERE BINARY cq3.CODIGO = ${this.escapeSql(codigo)}
                        AND BINARY cq3.LUNA = DATE_FORMAT(${this.escapeSql(fechaInicio)}, '%Y-%m')
                    )
                    AND NOT EXISTS (
                      SELECT 1 FROM horario_multicentro hm2
                      WHERE BINARY hm2.CODIGO = ${this.escapeSql(codigo)}
                        AND BINARY hm2.LUNA = DATE_FORMAT(${this.escapeSql(fechaInicio)}, '%Y-%m')
                    )
                    AND EXISTS (
                      SELECT 1 FROM DatosEmpleados de
                      LEFT JOIN horarios h
                        ON h.centro_nombre = de.\`CENTRO TRABAJO\`
                        AND h.grupo_nombre = de.GRUPO
                        AND h.vigente_desde <= ${this.escapeSql(fechaInicio)}
                        AND (h.vigente_hasta IS NULL OR ${this.escapeSql(fechaInicio)} <= h.vigente_hasta)
                      WHERE de.CODIGO = ${this.escapeSql(codigo)}
                        AND CASE DAYOFWEEK(${this.escapeSql(fechaInicio)})
                          WHEN 2 THEN h.lun_in1 WHEN 3 THEN h.mar_in1 WHEN 4 THEN h.mie_in1
                          WHEN 5 THEN h.joi_in1 WHEN 6 THEN h.vin_in1
                          WHEN 7 THEN h.sam_in1 WHEN 1 THEN h.dum_in1
                          ELSE NULL
                        END IS NOT NULL
                    ))
                THEN 1
                ELSE 0
              END AS es_laborable
          `;
          const laborableResult =
            await this.prisma.$queryRawUnsafe<any[]>(diaLaborableQuery);
          nuevaDuracion = Number(laborableResult[0]?.es_laborable) || 0;
        } else {
          nuevaDuracion = 1;
        }
      } else {
        // Pentru interval de date
        if (esPermisoRetribuido) {
          // Calculează doar zilele lucrătoare unde angajatul are programat să lucreze
          const diasLaborablesQuery = `
            WITH RECURSIVE fechas AS (
              SELECT ${this.escapeSql(fechaInicio)} AS d
              UNION ALL
              SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM fechas 
              WHERE d < ${this.escapeSql(fechaFin || fechaInicio)}
            ),
            empleado_ccaa AS (
              SELECT '' AS ccaa
            ),
            empleado_trabaja_festivos AS (
              SELECT 
                CASE 
                  WHEN LOWER(TRIM(TrabajaFestivos)) IN ('si','sí','s','1','true','da','y') THEN 1
                  ELSE 0
                END AS trabaja_festivos
              FROM DatosEmpleados
              WHERE CODIGO = ${this.escapeSql(codigo)}
              LIMIT 1
            ),
            cuadrante_dia AS (
              SELECT 
                f.d AS fecha,
                CASE 
                  WHEN cq.CODIGO IS NOT NULL THEN
                    CASE DAY(f.d)
                      WHEN 1 THEN cq.ZI_1 WHEN 2 THEN cq.ZI_2 WHEN 3 THEN cq.ZI_3 WHEN 4 THEN cq.ZI_4
                      WHEN 5 THEN cq.ZI_5 WHEN 6 THEN cq.ZI_6 WHEN 7 THEN cq.ZI_7 WHEN 8 THEN cq.ZI_8
                      WHEN 9 THEN cq.ZI_9 WHEN 10 THEN cq.ZI_10 WHEN 11 THEN cq.ZI_11 WHEN 12 THEN cq.ZI_12
                      WHEN 13 THEN cq.ZI_13 WHEN 14 THEN cq.ZI_14 WHEN 15 THEN cq.ZI_15 WHEN 16 THEN cq.ZI_16
                      WHEN 17 THEN cq.ZI_17 WHEN 18 THEN cq.ZI_18 WHEN 19 THEN cq.ZI_19 WHEN 20 THEN cq.ZI_20
                      WHEN 21 THEN cq.ZI_21 WHEN 22 THEN cq.ZI_22 WHEN 23 THEN cq.ZI_23 WHEN 24 THEN cq.ZI_24
                      WHEN 25 THEN cq.ZI_25 WHEN 26 THEN cq.ZI_26 WHEN 27 THEN cq.ZI_27 WHEN 28 THEN cq.ZI_28
                      WHEN 29 THEN cq.ZI_29 WHEN 30 THEN cq.ZI_30 WHEN 31 THEN cq.ZI_31
                      ELSE NULL
                    END
                  ELSE NULL
                END AS val_cuadrante
              FROM fechas f
              LEFT JOIN cuadrante cq 
                ON BINARY cq.CODIGO = ${this.escapeSql(codigo)}
                AND BINARY cq.LUNA = DATE_FORMAT(f.d, '%Y-%m')
            ),
            horario_dia AS (
              SELECT 
                f.d AS fecha,
                CASE DAYOFWEEK(f.d)
                  WHEN 2 THEN h.lun_in1 WHEN 3 THEN h.mar_in1 WHEN 4 THEN h.mie_in1
                  WHEN 5 THEN h.joi_in1 WHEN 6 THEN h.vin_in1
                  WHEN 7 THEN h.sam_in1 WHEN 1 THEN h.dum_in1
                  ELSE NULL
                END AS hora_in_planificata
              FROM fechas f
              LEFT JOIN DatosEmpleados de ON de.CODIGO = ${this.escapeSql(codigo)}
              LEFT JOIN horarios h
                ON h.centro_nombre = de.\`CENTRO TRABAJO\`
                AND h.grupo_nombre = de.GRUPO
                AND h.vigente_desde <= f.d
                AND (h.vigente_hasta IS NULL OR f.d <= h.vigente_hasta)
            ),
            horario_multicentro_dia AS (
              SELECT 
                f.d AS fecha,
                CASE 
                  WHEN hm.CODIGO IS NOT NULL THEN
                    CASE DAY(f.d)
                      WHEN 1 THEN hm.ZI_1 WHEN 2 THEN hm.ZI_2 WHEN 3 THEN hm.ZI_3 WHEN 4 THEN hm.ZI_4
                      WHEN 5 THEN hm.ZI_5 WHEN 6 THEN hm.ZI_6 WHEN 7 THEN hm.ZI_7 WHEN 8 THEN hm.ZI_8
                      WHEN 9 THEN hm.ZI_9 WHEN 10 THEN hm.ZI_10 WHEN 11 THEN hm.ZI_11 WHEN 12 THEN hm.ZI_12
                      WHEN 13 THEN hm.ZI_13 WHEN 14 THEN hm.ZI_14 WHEN 15 THEN hm.ZI_15 WHEN 16 THEN hm.ZI_16
                      WHEN 17 THEN hm.ZI_17 WHEN 18 THEN hm.ZI_18 WHEN 19 THEN hm.ZI_19 WHEN 20 THEN hm.ZI_20
                      WHEN 21 THEN hm.ZI_21 WHEN 22 THEN hm.ZI_22 WHEN 23 THEN hm.ZI_23 WHEN 24 THEN hm.ZI_24
                      WHEN 25 THEN hm.ZI_25 WHEN 26 THEN hm.ZI_26 WHEN 27 THEN hm.ZI_27 WHEN 28 THEN hm.ZI_28
                      WHEN 29 THEN hm.ZI_29 WHEN 30 THEN hm.ZI_30 WHEN 31 THEN hm.ZI_31
                      ELSE NULL
                    END
                  ELSE NULL
                END AS val_multicentro
              FROM fechas f
              LEFT JOIN horario_multicentro hm 
                ON BINARY hm.CODIGO = ${this.escapeSql(codigo)}
                AND BINARY hm.LUNA = DATE_FORMAT(f.d, '%Y-%m')
            )
            SELECT COUNT(*) AS dias_laborables
            FROM fechas f
            CROSS JOIN empleado_ccaa ec
            CROSS JOIN empleado_trabaja_festivos etf
            LEFT JOIN cuadrante_dia cd ON cd.fecha = f.d
            LEFT JOIN horario_dia hd ON hd.fecha = f.d
            LEFT JOIN horario_multicentro_dia hmd ON hmd.fecha = f.d
            WHERE DAYOFWEEK(f.d) BETWEEN 2 AND 6  -- Luni-Vineri
              AND NOT EXISTS (
                SELECT 1 FROM fiestas fi
                WHERE DATE(COALESCE(fi.observed_date, fi.date)) = f.d
                  AND fi.active = 1
                  AND (
                    LOWER(fi.scope) IN ('nacional', 'national')
                    OR (LOWER(fi.scope) IN ('autonómico', 'autonomico', 'ccaa') 
                        AND BINARY fi.ccaa_code = BINARY ec.ccaa)
                  )
                  AND etf.trabaja_festivos = 0
              )
              AND (
                -- Are cuadrante cu valoare validă (nu LIB/LIBRE/etc.)
                (cd.val_cuadrante IS NOT NULL 
                 AND TRIM(cd.val_cuadrante) != ''
                 AND UPPER(TRIM(cd.val_cuadrante)) NOT IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X')
                 AND (cd.val_cuadrante LIKE '%:%-%:%' OR cd.val_cuadrante REGEXP '^[0-9]+h'))
                OR
                -- Sau are horario_multicentro cu valoare validă
                (cd.val_cuadrante IS NULL 
                 AND hmd.val_multicentro IS NOT NULL 
                 AND TRIM(hmd.val_multicentro) != ''
                 AND UPPER(TRIM(hmd.val_multicentro)) NOT IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X')
                 AND (hmd.val_multicentro LIKE '%:%-%:%' OR hmd.val_multicentro REGEXP '^[0-9]+h'))
                OR
                -- Sau are horario programat
                (cd.val_cuadrante IS NULL AND hmd.val_multicentro IS NULL AND hd.hora_in_planificata IS NOT NULL)
              )
          `;
          const diasLaborablesResult =
            await this.prisma.$queryRawUnsafe<any[]>(diasLaborablesQuery);
          nuevaDuracion = Number(diasLaborablesResult[0]?.dias_laborables) || 0;
        } else {
          // Pentru alte tipuri, calculează toate zilele
          const duracionQuery = `
            SELECT GREATEST(1, DATEDIFF(
              ${this.escapeSql(fechaFin || fechaInicio)}, 
              ${this.escapeSql(fechaInicio)}
            ) + 1) AS duracion
          `;
          const duracionResult =
            await this.prisma.$queryRawUnsafe<any[]>(duracionQuery);
          nuevaDuracion = Number(duracionResult[0]?.duracion) || 1;
        }
      }

      // Asigură că durata este minim 1 (dacă nu este Permiso Retribuido)
      if (!esPermisoRetribuido && nuevaDuracion < 1) {
        nuevaDuracion = 1;
      }

      // Actualizează durata
      await this.prisma.$executeRawUnsafe(`
        UPDATE Ausencias
        SET DURACION = ${nuevaDuracion},
            UNIDAD_DURACION = 'dias'
        WHERE id = ${Number(id)}
      `);

      this.logger.log(
        `✅ Ausencia ${id} - Duración recalculada: ${nuevaDuracion} días (FECHA: ${fecha})`,
      );

      // Asigură că duracion este un număr normal (nu BigInt)
      const duracionNum = Number(nuevaDuracion);

      return {
        success: true,
        message: `Duración recalculada: ${duracionNum} ${duracionNum === 1 ? 'día' : 'días'}`,
        duracion: duracionNum,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error recalculando duración para ausencia ${id}:`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al recalcular duración: ${error.message}`,
      );
    }
  }

  /**
   * Actualizează manual durata unei ausencias
   */
  async updateDuracion(
    id: number,
    duracion: number | string,
    unidad: 'dias' | 'horas' = 'dias',
  ): Promise<{
    success: true;
    message: string;
    duracion: number | string;
    unidad: string;
  }> {
    try {
      if (!id) {
        throw new BadRequestException('id is required');
      }

      // Verifică dacă ausencia există
      const ausencia = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT id, TIPO, DURACION, UNIDAD_DURACION
        FROM Ausencias
        WHERE id = ${Number(id)}
        LIMIT 1
      `);

      if (!ausencia || ausencia.length === 0) {
        throw new BadRequestException(`Ausencia cu ID ${id} nu a fost găsită`);
      }

      // Validează durata
      if (unidad === 'horas') {
        // Pentru ore, durata trebuie să fie un string în format TIME sau un număr
        let duracionTime: string;
        if (typeof duracion === 'string') {
          // Verifică dacă este în format TIME (HH:MM:SS)
          if (!/^\d{2}:\d{2}:\d{2}$/.test(duracion)) {
            throw new BadRequestException(
              'Formato de duración inválido para horas. Use formato HH:MM:SS (ej: 05:30:00)',
            );
          }
          duracionTime = duracion;
        } else {
          // Convertim numărul de ore în format TIME
          const horas = Math.floor(duracion);
          const minutos = Math.round((duracion - horas) * 60);
          duracionTime = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:00`;
        }

        await this.prisma.$executeRawUnsafe(`
          UPDATE Ausencias
          SET DURACION = ${this.escapeSql(duracionTime)},
              UNIDAD_DURACION = 'horas'
          WHERE id = ${Number(id)}
        `);

        this.logger.log(
          `✅ Ausencia ${id} - Duración actualizada manualmente: ${duracionTime} horas`,
        );

        return {
          success: true,
          message: `Duración actualizada: ${duracionTime} horas`,
          duracion: duracionTime,
          unidad: 'horas',
        };
      } else {
        // Pentru zile, durata trebuie să fie un număr
        const duracionNum =
          typeof duracion === 'number' ? duracion : Number(duracion);
        if (isNaN(duracionNum) || duracionNum < 0) {
          throw new BadRequestException('Duración debe ser un número positivo');
        }

        await this.prisma.$executeRawUnsafe(`
          UPDATE Ausencias
          SET DURACION = ${duracionNum},
              UNIDAD_DURACION = 'dias'
          WHERE id = ${Number(id)}
        `);

        this.logger.log(
          `✅ Ausencia ${id} - Duración actualizada manualmente: ${duracionNum} días`,
        );

        return {
          success: true,
          message: `Duración actualizada: ${duracionNum} ${duracionNum === 1 ? 'día' : 'días'}`,
          duracion: duracionNum,
          unidad: 'dias',
        };
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Error actualizando duración manualmente para ausencia ${id}:`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar duración: ${error.message}`,
      );
    }
  }

  /**
   * Normalizează o dată din format DD/MM/YYYY sau YYYY-MM-DD la format YYYY-MM-DD
   */
  private normalizeFechaToISO(fechaStr: string): string | null {
    if (!fechaStr || fechaStr.trim() === '') return null;

    const str = fechaStr.trim();

    // Format YYYY-MM-DD (deja normalizat)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }

    // Format DD/MM/YYYY sau DD-MM-YYYY
    const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      let year = parseInt(match[3], 10);

      // Convert 2-digit year to 4-digit
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year;
      }

      // Validează
      if (
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= 31 &&
        year >= 1900 &&
        year <= 2100
      ) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    this.logger.warn(`⚠️ No se pudo normalizar fecha: "${fechaStr}"`);
    return null;
  }

  /**
   * Recalculează durata în ore pentru "Ausencias justificada"
   * Calculează diferența între orele programate și orele fichadas
   */
  private async recalcularDuracionHoras(
    id: number,
    ausenciaData: any,
    codigo: string,
    fecha: string,
  ): Promise<{
    success: true;
    message: string;
    duracion: number;
    unidad: string;
  }> {
    try {
      // Parsează FECHA pentru a extrage data
      let fechaInicio: string | null = null;
      // Nota: Pentru moment, calculăm doar pentru o singură dată (nu interval)
      // Dacă este interval, luăm prima dată
      // let fechaFin: string | null = null; // Nu este folosit încă

      if (fecha.includes(' - ')) {
        const partes = fecha.split(' - ');
        fechaInicio = partes[0]?.trim() || null;
        // fechaFin = partes[1]?.trim() || null; // Nu este folosit încă
      } else if (fecha) {
        fechaInicio = fecha.trim();
        // fechaFin = fecha.trim(); // Nu este folosit încă
      }

      if (!fechaInicio) {
        throw new BadRequestException(
          'No se puede calcular la duración: FECHA no válida',
        );
      }

      // Normalizează data la format YYYY-MM-DD
      const fechaInicioNormalizada = this.normalizeFechaToISO(fechaInicio);
      if (!fechaInicioNormalizada) {
        throw new BadRequestException(
          `No se puede calcular la duración: FECHA no válida o formato incorrecto: "${fechaInicio}"`,
        );
      }

      // Pentru moment, calculăm doar pentru o singură dată (nu interval)
      // Dacă este interval, luăm prima dată
      const fechaCalculo = fechaInicioNormalizada;

      this.logger.log(
        `🔍 [recalcularDuracionHoras] Calculando para ausencia ${id}, codigo ${codigo}, fecha: ${fechaCalculo} (original: ${fecha})`,
      );

      // Verifică dacă există "Salida Sin Regreso" sau "Salida Centro" asociată
      const ausenciaAsociadaQuery = `
        SELECT id, TIPO, DURACION, UNIDAD_DURACION
        FROM Ausencias
        WHERE ausencia_asociada_id = ${Number(id)}
          AND (LOWER(TIPO) LIKE '%salida sin regreso%' OR LOWER(TIPO) LIKE '%salida centro%')
        LIMIT 1
      `;
      const ausenciaAsociada = await this.prisma.$queryRawUnsafe<any[]>(
        ausenciaAsociadaQuery,
      );
      const tieneSalidaSinRegreso =
        ausenciaAsociada && ausenciaAsociada.length > 0;

      // Calculează orele fichadas pentru data respectivă
      const fichajesQuery = `
        SELECT 
          f.TIPO,
          f.FECHA,
          f.HORA,
          f.DURACION,
          CASE
            WHEN f.TIPO = 'Salida' 
              AND f.DURACION IS NOT NULL 
              AND TRIM(f.DURACION) <> '' 
              AND f.DURACION <> '00:00:00'
              AND CAST(TIME(f.HORA) AS TIME) < TIME('12:00:00')
              AND EXISTS (
                SELECT 1
                FROM Fichaje f_entrada
                WHERE BINARY f_entrada.CODIGO = BINARY ${this.escapeSql(codigo)}
                  AND f_entrada.TIPO = 'Entrada'
                  AND f_entrada.FECHA = DATE_SUB(f.FECHA, INTERVAL 1 DAY)
                  AND CAST(TIME(f_entrada.HORA) AS TIME) >= TIME('17:00:00')
              )
            THEN DATE_SUB(f.FECHA, INTERVAL 1 DAY)
            ELSE DATE(f.FECHA)
          END AS workday_date
        FROM Fichaje f
        WHERE BINARY f.CODIGO = BINARY ${this.escapeSql(codigo)}
          AND DATE(f.FECHA) = DATE(${this.escapeSql(fechaCalculo)})
        ORDER BY f.FECHA, f.HORA
      `;
      const fichajes = await this.prisma.$queryRawUnsafe<any[]>(fichajesQuery);

      this.logger.log(
        `🔍 [recalcularDuracionHoras] Fichajes encontrados: ${fichajes.length} para fecha ${fechaCalculo}`,
      );

      // Verifică dacă există regularizare CONFIRMED pentru data respectivă
      const regularizacionQuery = `
        SELECT effective_minutes
        FROM FichajeRegularizacion
        WHERE BINARY employee_codigo = BINARY ${this.escapeSql(codigo)}
          AND workday_date = DATE(${this.escapeSql(fechaCalculo)})
          AND status = 'CONFIRMED'
          AND effective_minutes IS NOT NULL
        LIMIT 1
      `;
      const regularizacion =
        await this.prisma.$queryRawUnsafe<any[]>(regularizacionQuery);

      this.logger.log(
        `🔍 [recalcularDuracionHoras] Regularizacion encontrada: ${regularizacion && regularizacion.length > 0 ? 'Sí' : 'No'}`,
      );

      // Calculează orele fichadas
      let horasFichadas = 0;
      if (
        regularizacion &&
        regularizacion.length > 0 &&
        regularizacion[0].effective_minutes
      ) {
        // Folosește orele din regularizare
        horasFichadas = Number(regularizacion[0].effective_minutes) / 60.0;
      } else if (fichajes && fichajes.length > 0) {
        // Calculează suma DURACION din fichajes pentru workday_date
        const fichajesPorDia = new Map<string, number>();
        for (const f of fichajes) {
          const workdayDate = f.workday_date
            ? new Date(f.workday_date).toISOString().split('T')[0]
            : fechaCalculo;
          if (f.DURACION && f.DURACION !== '00:00:00') {
            const horas = this.parseTimeToHours(f.DURACION);
            fichajesPorDia.set(
              workdayDate,
              (fichajesPorDia.get(workdayDate) || 0) + horas,
            );
          }
        }
        horasFichadas = fichajesPorDia.get(fechaCalculo) || 0;
      }

      // Calculează orele programate pentru data respectivă
      // Folosim aceeași logică ca în FichajeRegularizacionService pentru consistență
      const mesStr = fechaCalculo.substring(0, 7); // YYYY-MM
      const dia = parseInt(fechaCalculo.split('-')[2], 10);

      // Verifică cuadrante
      const cuadranteQuery = `
        SELECT ZI_${dia} as schedule
        FROM cuadrante
        WHERE BINARY CODIGO = BINARY ${this.escapeSql(codigo)}
          AND BINARY LUNA = ${this.escapeSql(mesStr)}
        LIMIT 1
      `;
      const cuadrante =
        await this.prisma.$queryRawUnsafe<any[]>(cuadranteQuery);

      if (cuadrante && cuadrante.length > 0 && cuadrante[0].schedule) {
        const scheduleStr = cuadrante[0].schedule;
        if (
          scheduleStr &&
          scheduleStr.trim() !== '' &&
          ![
            'LIB',
            'LIBRE',
            'L',
            'DESCANSO',
            'FESTIVO',
            'VAC',
            'VACACIONES',
            'BAJA',
            'X',
          ].includes(scheduleStr.trim().toUpperCase())
        ) {
          // Parsează schedule-ul din cuadrante
          let horasCuadrante = 0;
          if (scheduleStr.includes(':') && scheduleStr.includes('-')) {
            // Format "08:00-17:00" sau "T1 08:00-17:00"
            const timeMatch = scheduleStr.match(
              /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/,
            );
            if (timeMatch) {
              const [, h1, m1, h2, m2] = timeMatch;
              const start = parseInt(h1) * 60 + parseInt(m1);
              const end = parseInt(h2) * 60 + parseInt(m2);
              const diff = (end - start + 1440) % 1440; // Handle overnight shifts
              horasCuadrante = diff / 60.0;
            }
          } else if (/^\d+h/.test(scheduleStr.trim())) {
            // Format "8h" sau "8h 30m"
            const match = scheduleStr.trim().match(/^(\d+)h/);
            if (match) {
              horasCuadrante = parseFloat(match[1]);
            }
          }

          if (horasCuadrante > 0) {
            this.logger.log(
              `✅ [recalcularDuracionHoras] Found cuadrante: ${scheduleStr} = ${horasCuadrante.toFixed(2)}h`,
            );
            const horasPlan = horasCuadrante;

            // Continuă cu calculul duratei folosind horasPlan
            const nuevaDuracionHoras =
              fichajes.length === 0
                ? horasPlan
                : Math.max(0, horasPlan - horasFichadas);

            const horas = Math.floor(nuevaDuracionHoras);
            const minutos = Math.round((nuevaDuracionHoras - horas) * 60);
            const duracionTime = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:00`;

            await this.prisma.$executeRawUnsafe(`
              UPDATE Ausencias
              SET DURACION = ${this.escapeSql(duracionTime)},
                  UNIDAD_DURACION = 'horas'
              WHERE id = ${Number(id)}
            `);

            return {
              success: true,
              message: `Duración recalculada: ${nuevaDuracionHoras.toFixed(2)} horas (Plan: ${horasPlan.toFixed(2)}h, Fichadas: ${horasFichadas.toFixed(2)}h)`,
              duracion: nuevaDuracionHoras,
              unidad: 'horas',
            };
          }
        }
      }

      // Fallback la horario_multicentro
      const horarioMulticentroQuery = `
        SELECT ZI_${dia} as schedule
        FROM horario_multicentro
        WHERE BINARY CODIGO = BINARY ${this.escapeSql(codigo)}
          AND BINARY LUNA = ${this.escapeSql(mesStr)}
        LIMIT 1
      `;
      const horarioMulticentro = await this.prisma.$queryRawUnsafe<any[]>(
        horarioMulticentroQuery,
      );

      if (
        horarioMulticentro &&
        horarioMulticentro.length > 0 &&
        horarioMulticentro[0].schedule
      ) {
        const scheduleStr = horarioMulticentro[0].schedule;
        if (
          scheduleStr &&
          scheduleStr.trim() !== '' &&
          ![
            'LIB',
            'LIBRE',
            'L',
            'DESCANSO',
            'FESTIVO',
            'VAC',
            'VACACIONES',
            'BAJA',
            'X',
          ].includes(scheduleStr.trim().toUpperCase())
        ) {
          // Parsează schedule-ul din horario_multicentro (aceeași logică ca pentru cuadrante)
          let horasMulticentro = 0;
          if (scheduleStr.includes(':') && scheduleStr.includes('-')) {
            const timeMatch = scheduleStr.match(
              /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/,
            );
            if (timeMatch) {
              const [, h1, m1, h2, m2] = timeMatch;
              const start = parseInt(h1) * 60 + parseInt(m1);
              const end = parseInt(h2) * 60 + parseInt(m2);
              const diff = (end - start + 1440) % 1440;
              horasMulticentro = diff / 60.0;
            }
          } else if (/^\d+h/.test(scheduleStr.trim())) {
            const match = scheduleStr.trim().match(/^(\d+)h/);
            if (match) {
              horasMulticentro = parseFloat(match[1]);
            }
          }

          if (horasMulticentro > 0) {
            this.logger.log(
              `✅ [recalcularDuracionHoras] Found horario_multicentro: ${scheduleStr} = ${horasMulticentro.toFixed(2)}h`,
            );
            const horasPlan = horasMulticentro;

            const nuevaDuracionHoras =
              fichajes.length === 0
                ? horasPlan
                : Math.max(0, horasPlan - horasFichadas);

            const horas = Math.floor(nuevaDuracionHoras);
            const minutos = Math.round((nuevaDuracionHoras - horas) * 60);
            const duracionTime = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:00`;

            await this.prisma.$executeRawUnsafe(`
              UPDATE Ausencias
              SET DURACION = ${this.escapeSql(duracionTime)},
                  UNIDAD_DURACION = 'horas'
              WHERE id = ${Number(id)}
            `);

            return {
              success: true,
              message: `Duración recalculada: ${nuevaDuracionHoras.toFixed(2)} horas (Plan: ${horasPlan.toFixed(2)}h, Fichadas: ${horasFichadas.toFixed(2)}h)`,
              duracion: nuevaDuracionHoras,
              unidad: 'horas',
            };
          }
        }
      }

      // Fallback la horario normal (din DatosEmpleados + horarios)
      const horarioQuery = `
        SELECT 
          CASE DAYOFWEEK(${this.escapeSql(fechaCalculo)})
            WHEN 2 THEN h.lun_in1 WHEN 3 THEN h.mar_in1 WHEN 4 THEN h.mie_in1
            WHEN 5 THEN h.joi_in1 WHEN 6 THEN h.vin_in1
            WHEN 7 THEN h.sam_in1 WHEN 1 THEN h.dum_in1
            ELSE NULL
          END AS hora_in,
          CASE DAYOFWEEK(${this.escapeSql(fechaCalculo)})
            WHEN 2 THEN h.lun_out1 WHEN 3 THEN h.mar_out1 WHEN 4 THEN h.mie_out1
            WHEN 5 THEN h.joi_out1 WHEN 6 THEN h.vin_out1
            WHEN 7 THEN h.sam_out1 WHEN 1 THEN h.dum_out1
            ELSE NULL
          END AS hora_out
        FROM DatosEmpleados de
        LEFT JOIN horarios h
          ON h.centro_nombre = de.\`CENTRO TRABAJO\`
          AND h.grupo_nombre = de.GRUPO
          AND h.vigente_desde <= ${this.escapeSql(fechaCalculo)}
          AND (h.vigente_hasta IS NULL OR ${this.escapeSql(fechaCalculo)} <= h.vigente_hasta)
        WHERE de.CODIGO = ${this.escapeSql(codigo)}
        LIMIT 1
      `;
      const horario = await this.prisma.$queryRawUnsafe<any[]>(horarioQuery);

      let horasPlan = 0;
      if (
        horario &&
        horario.length > 0 &&
        horario[0].hora_in &&
        horario[0].hora_out
      ) {
        // Calculează diferența între hora_in și hora_out
        const horaIn = horario[0].hora_in;
        const horaOut = horario[0].hora_out;

        // Parsează orele (format TIME: HH:MM:SS sau Date object)
        let hIn = 0,
          mIn = 0,
          hOut = 0,
          mOut = 0;

        if (horaIn instanceof Date) {
          hIn = horaIn.getHours();
          mIn = horaIn.getMinutes();
        } else {
          const partsIn = horaIn.toString().split(':');
          hIn = parseInt(partsIn[0]) || 0;
          mIn = parseInt(partsIn[1]) || 0;
        }

        if (horaOut instanceof Date) {
          hOut = horaOut.getHours();
          mOut = horaOut.getMinutes();
        } else {
          const partsOut = horaOut.toString().split(':');
          hOut = parseInt(partsOut[0]) || 0;
          mOut = parseInt(partsOut[1]) || 0;
        }

        const start = hIn * 60 + mIn;
        const end = hOut * 60 + mOut;
        const diff = (end - start + 1440) % 1440; // Handle overnight shifts
        horasPlan = diff / 60.0;

        this.logger.log(
          `✅ [recalcularDuracionHoras] Found horario: ${horaIn} - ${horaOut} = ${horasPlan.toFixed(2)}h`,
        );
      }

      // Dacă nu am găsit ore programate, încercăm să folosim orele contractului ca fallback
      if (horasPlan === 0) {
        this.logger.log(
          `⚠️ [recalcularDuracionHoras] No scheduled hours found in cuadrante, horario_multicentro, or horario. Using contract hours as fallback.`,
        );
        // Obține orele contractului (40h/săptămână = 8h/zi pentru 5 zile)
        const contractQuery = `
          SELECT horas_contrato
          FROM DatosEmpleados
          WHERE CODIGO = ${this.escapeSql(codigo)}
          LIMIT 1
        `;
        const contract =
          await this.prisma.$queryRawUnsafe<any[]>(contractQuery);
        if (contract && contract.length > 0 && contract[0].horas_contrato) {
          const horasContrato = Number(contract[0].horas_contrato) || 0;
          // Presupunem 5 zile lucrătoare pe săptămână
          horasPlan = horasContrato / 5.0;
          this.logger.log(
            `✅ [recalcularDuracionHoras] Using contract hours: ${horasContrato}h/week = ${horasPlan.toFixed(2)}h/day`,
          );
        }
      }

      // Log pentru debugging
      this.logger.log(
        `🔍 [recalcularDuracionHoras] Resultados: horasPlan=${horasPlan.toFixed(2)}h, horasFichadas=${horasFichadas.toFixed(2)}h, tieneSalidaSinRegreso=${tieneSalidaSinRegreso}, fichajes.length=${fichajes.length}`,
      );

      // Calculează durata (diferența)
      // Dacă nu există fichajes sau nu există "Salida Sin Regreso" sau "Salida Centro",
      // punem toată ziua (orele programate)
      let nuevaDuracionHoras = 0;

      // Dacă nu a fichat deloc (nu există fichajes sau nu are ore fichadas)
      // ȘI nu există "Salida Sin Regreso/Centro" asociată
      // → punem toată ziua (orele programate)
      if (!tieneSalidaSinRegreso && fichajes.length === 0) {
        // Nu a fichat deloc și nu există "Salida Sin Regreso/Centro" - punem toată ziua
        nuevaDuracionHoras = horasPlan;
        this.logger.log(
          `✅ [recalcularDuracionHoras] No fichajes y no Salida Sin Regreso - usando horasPlan: ${horasPlan.toFixed(2)}h`,
        );
      } else if (
        !tieneSalidaSinRegreso &&
        horasFichadas === 0 &&
        fichajes.length > 0
      ) {
        // Există fichajes dar nu au DURACION (fichaje incomplete) - punem toată ziua
        nuevaDuracionHoras = horasPlan;
        this.logger.log(
          `✅ [recalcularDuracionHoras] Fichajes sin DURACION - usando horasPlan: ${horasPlan.toFixed(2)}h`,
        );
      } else {
        // Calculează diferența: ore programate - ore fichadas
        nuevaDuracionHoras = Math.max(0, horasPlan - horasFichadas);
        this.logger.log(
          `✅ [recalcularDuracionHoras] Calculando diferencia: ${horasPlan.toFixed(2)}h - ${horasFichadas.toFixed(2)}h = ${nuevaDuracionHoras.toFixed(2)}h`,
        );
      }

      // Asigură că durata este minim 0
      if (nuevaDuracionHoras < 0) {
        nuevaDuracionHoras = 0;
      }

      // Dacă durata este 0 dar ar trebui să fie mai mare (are ore programate), folosim orele programate
      if (nuevaDuracionHoras === 0 && horasPlan > 0 && fichajes.length === 0) {
        nuevaDuracionHoras = horasPlan;
        this.logger.log(
          `⚠️ [recalcularDuracionHoras] Durata era 0 pero tiene horasPlan - usando horasPlan: ${horasPlan.toFixed(2)}h`,
        );
      }

      // Actualizează durata în format TIME (HH:MM:SS)
      const horas = Math.floor(nuevaDuracionHoras);
      const minutos = Math.round((nuevaDuracionHoras - horas) * 60);
      const duracionTime = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:00`;

      await this.prisma.$executeRawUnsafe(`
        UPDATE Ausencias
        SET DURACION = ${this.escapeSql(duracionTime)},
            UNIDAD_DURACION = 'horas'
        WHERE id = ${Number(id)}
      `);

      this.logger.log(
        `✅ Ausencia ${id} - Duración recalculada: ${nuevaDuracionHoras.toFixed(2)} horas (FECHA: ${fecha}, Plan: ${horasPlan.toFixed(2)}h, Fichadas: ${horasFichadas.toFixed(2)}h)`,
      );

      return {
        success: true,
        message: `Duración recalculada: ${nuevaDuracionHoras.toFixed(2)} horas (Plan: ${horasPlan.toFixed(2)}h, Fichadas: ${horasFichadas.toFixed(2)}h)`,
        duracion: nuevaDuracionHoras,
        unidad: 'horas',
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error recalculando duración en horas para ausencia ${id}:`,
        error,
      );
      throw new BadRequestException(
        `Error al recalcular duración en horas: ${error.message}`,
      );
    }
  }

  /**
   * Parsează un string TIME (HH:MM:SS) în ore (decimal)
   */
  private parseTimeToHours(timeStr: string): number {
    if (!timeStr || timeStr === '00:00:00') return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    const hours = Number(parts[0]) || 0;
    const minutes = Number(parts[1]) || 0;
    return hours + minutes / 60.0;
  }

  /**
   * Marchează o ausencia ca "sin ausencia" (durata = 0) - indica că nu a lipsit de la muncă
   */
  async marcarSinAusencia(
    id: number,
  ): Promise<{ success: true; message: string }> {
    try {
      if (!id) {
        throw new BadRequestException('id is required');
      }

      // Verifică dacă ausencia există
      const ausencia = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT id, CODIGO, NOMBRE, TIPO, DURACION, UNIDAD_DURACION
        FROM Ausencias
        WHERE id = ${Number(id)}
        LIMIT 1
      `);

      if (!ausencia || ausencia.length === 0) {
        throw new BadRequestException(`Ausencia cu ID ${id} nu a fost găsită`);
      }

      // Actualizează durata la 0 și unitatea la 'horas'
      await this.prisma.$executeRawUnsafe(`
        UPDATE Ausencias
        SET DURACION = 0,
            UNIDAD_DURACION = 'horas'
        WHERE id = ${Number(id)}
      `);

      this.logger.log(
        `✅ Ausencia ${id} marcada como sin ausencia (DURACION = 0)`,
      );

      return {
        success: true,
        message:
          'Ausencia marcada como sin ausencia. Duración actualizada a 0 horas.',
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error marcando ausencia ${id} como sin ausencia:`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al marcar ausencia como sin ausencia: ${error.message}`,
      );
    }
  }

  /**
   * Trimite notificări pentru ștergerea unui premiu (email către angajat și Telegram către gestoria)
   */
  private async sendPremioDeletedNotifications(
    codigo: string,
    nombre: string,
    fecha: string,
    motivo: string,
  ): Promise<void> {
    try {
      // Obține datele angajatului pentru email
      let empleadoEmail: string | null = null;
      let empleadoNombreFormatted: string = nombre;

      try {
        const empleado =
          await this.empleadosService.getEmpleadoByCodigo(codigo);
        if (empleado) {
          empleadoEmail =
            empleado['CORREO ELECTRONICO'] ||
            empleado.CORREO_ELECTRONICO ||
            null;
          empleadoNombreFormatted =
            this.empleadosService.getFormattedNombre(empleado) || nombre;
        }
      } catch (error: any) {
        this.logger.warn(
          `⚠️ Could not fetch empleado data for ${codigo}: ${error.message}`,
        );
      }

      // Formatează data pentru afișare
      const fechaFormatted = new Date(fecha).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Extrage luna premiului din MOTIVO (ex: "Premio - Salón de la Fama - 2026-02 (Otorgado por: Admin)")
      let mesFormatted = '';
      const mesMatch = motivo.match(/(\d{4}-\d{2})/);
      if (mesMatch) {
        const meses = [
          'Enero',
          'Febrero',
          'Marzo',
          'Abril',
          'Mayo',
          'Junio',
          'Julio',
          'Agosto',
          'Septiembre',
          'Octubre',
          'Noviembre',
          'Diciembre',
        ];
        const [year, month] = mesMatch[1].split('-');
        const mesNombre = meses[parseInt(month, 10) - 1] || month;
        mesFormatted = `${mesNombre} ${year}`;
      }

      // Trimite email către angajat (dacă are email configurat)
      if (empleadoEmail && this.emailService.isConfigured()) {
        try {
          const subject = `⚠️ Premio Cancelado - Salón de la Fama`;
          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body {
                  font-family: Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                }
                .header {
                  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                  color: white;
                  padding: 30px;
                  text-align: center;
                  border-radius: 10px 10px 0 0;
                }
                .header h1 {
                  margin: 0;
                  font-size: 28px;
                }
                .content {
                  background: #ffffff;
                  padding: 30px;
                  border: 1px solid #e5e7eb;
                  border-top: none;
                }
                .premio-box {
                  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
                  border-left: 4px solid #dc2626;
                  padding: 20px;
                  margin: 20px 0;
                  border-radius: 5px;
                }
                .premio-box h2 {
                  margin-top: 0;
                  color: #991b1b;
                }
                .info-item {
                  margin: 15px 0;
                  padding: 10px;
                  background: #f9fafb;
                  border-radius: 5px;
                }
                .info-item strong {
                  color: #1f2937;
                }
                .footer {
                  text-align: center;
                  padding: 20px;
                  color: #6b7280;
                  font-size: 14px;
                  border-top: 1px solid #e5e7eb;
                  margin-top: 20px;
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>⚠️ Premio Cancelado</h1>
                <p style="margin: 10px 0 0 0; font-size: 18px;">Se ha cancelado tu premio</p>
              </div>
              <div class="content">
                <p>Hola <strong>${empleadoNombreFormatted}</strong>,</p>
                
                <p>Te informamos que se ha cancelado el premio que habías recibido del <strong>Salón de la Fama</strong>${mesFormatted ? ` del mes de <strong>${mesFormatted}</strong>` : ''}.</p>
                
                <div class="premio-box">
                  <h2>📅 Premio Cancelado</h2>
                  <div class="info-item">
                    <strong>📅 Día Libre:</strong> ${fechaFormatted}
                  </div>
                  ${
                    mesFormatted
                      ? `<div class="info-item">
                    <strong>📊 Período:</strong> ${mesFormatted}
                  </div>`
                      : ''
                  }
                </div>
                
                <p>El día libre que habías recibido como premio ha sido cancelado y ya no está disponible.</p>
                
                <p>Si tienes alguna pregunta o necesitas más información, por favor contacta con RRHH.</p>
                
                <p style="margin-top: 30px;">
                  <strong>Atentamente,</strong><br>
                  <strong>RRHH</strong><br>
                  <strong>DE CAMINO SERVICIOS AUXILIARES SL</strong>
                </p>
              </div>
              <div class="footer">
                <p>Este es un mensaje automático. Por favor, no respondas a este correo.</p>
              </div>
            </body>
            </html>
          `;

          await this.emailService.sendEmail(empleadoEmail, subject, html, {
            bcc: ['decamino.rrhh@gmail.com'],
          });

          this.logger.log(
            `✅ Email de premio cancelado enviado a ${empleadoEmail} (${empleadoNombreFormatted})`,
          );
        } catch (emailError: any) {
          this.logger.warn(
            `⚠️ Error enviando email de premio cancelado (non-blocking): ${emailError.message}`,
          );
        }
      } else if (!empleadoEmail) {
        this.logger.warn(
          `⚠️ Empleado ${codigo} no tiene email configurado, no se envió email de premio cancelado`,
        );
      }

      // Trimite notificare Telegram către gestoria
      if (this.telegramService.isConfigured()) {
        try {
          const telegramMessage = `⚠️ *Premio Cancelado - Salón de la Fama*

🏆 *Empleado:* ${empleadoNombreFormatted}
📋 *Código:* ${codigo}
📅 *Día Libre Cancelado:* ${fechaFormatted}
${mesFormatted ? `📊 *Período:* ${mesFormatted}\n` : ''}❌ Se ha cancelado el día de permiso retribuido que había sido otorgado como premio por su desempeño en el Salón de la Fama.`;

          await this.telegramService.sendMessage(telegramMessage);

          this.logger.log(
            `✅ Notificación Telegram enviada a gestoria para cancelación de premio de ${empleadoNombreFormatted}`,
          );
        } catch (telegramError: any) {
          this.logger.warn(
            `⚠️ Error enviando notificación Telegram (non-blocking): ${telegramError.message}`,
          );
        }
      } else {
        this.logger.warn(
          '⚠️ Telegram service no configurado, no se envió notificación',
        );
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Error en sendPremioDeletedNotifications: ${error.message}`,
        error.stack,
      );
      // Nu aruncăm eroare - doar logăm
    }
  }

  async getAusencias(codigo?: string, mes?: string): Promise<any[]> {
    try {
      // Construiește query-ul SQL cu filtrare
      const conditions: string[] = [];

      if (codigo && codigo.trim() !== '') {
        conditions.push(`CODIGO = ${this.escapeSql(codigo.trim())}`);
      }

      if (mes && mes.trim() !== '') {
        const mesTrimmed = mes.trim();
        // Filtrare pentru MES: verifică dacă FECHA conține anul-luna specificat
        // Funcționează atât pentru date simple cât și pentru intervale
        conditions.push(
          `(DATE_FORMAT(STR_TO_DATE(SUBSTRING_INDEX(FECHA, ' - ', 1), '%Y-%m-%d'), '%Y-%m') = ${this.escapeSql(mesTrimmed)} OR FECHA LIKE ${this.escapeSql(`${mesTrimmed}%`)})`,
        );
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `SELECT * FROM Ausencias ${whereClause}`;

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      // Transformă datele conform logicii din n8n
      const transformed = rows.map((item: any) => {
        const tipo = item.TIPO || '';
        const fecha = item.FECHA || '';
        const duracion = item.DURACION || null;

        // Parsează FECHA în fecha_inicio și fecha_fin
        const { inicio: fechaInicio, fin: fechaFin } = this.parseFecha(fecha);

        // Construiește FECHA normalizată pentru returnare (format standard cu spații)
        let fechaLimpa = fecha;
        if (fechaInicio && fechaFin) {
          if (fechaInicio === fechaFin) {
            fechaLimpa = fechaInicio; // Dată simplă (aceeași zi)
          } else {
            fechaLimpa = `${fechaInicio} - ${fechaFin}`; // Interval (format standard)
          }
        } else if (fechaInicio) {
          fechaLimpa = fechaInicio;
        }

        // Calculează dias_aprobados pentru tipurile pe zile
        const diasAprobados = this.calculateDiasAprobados(
          tipo,
          duracion,
          fechaInicio,
          fechaFin,
        );

        // Calculează horas_aprobadas pentru tipurile pe ore
        let horasAprobadas = null;
        const tipuriZile = [
          'Vacaciones',
          'Asunto Propio',
          'Permiso Retribuido',
          'Permiso Recuperable',
          'Permiso No Retribuido',
          'Permiso sin sueldo',
          'Permiso médico',
          'Permiso',
          'Baja',
        ];
        const tipoLower = tipo.toLowerCase();
        const estePeZile = tipuriZile.some((t) =>
          tipoLower.includes(t.toLowerCase()),
        );

        if (!estePeZile) {
          // Pentru tipurile pe ore (Entrada Centro, Salida Centro, Salida Sin Regreso, etc.)
          if (duracion !== null && duracion !== undefined && duracion !== '') {
            horasAprobadas = String(duracion); // Păstrăm exact valoarea din DB
          }
        }

        return {
          ...item,
          FECHA: fechaLimpa, // Returnează FECHA curățată
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          dias_aprobados: diasAprobados,
          horas_aprobadas: horasAprobadas,
          no_necesita_justificante: item.no_necesita_justificante || false,
          ausencia_asociada_id: item.ausencia_asociada_id || null,
        };
      });

      this.logger.log(
        `✅ Ausencias retrieved: ${transformed.length} records (codigo: ${codigo || 'all'}, mes: ${mes || 'all'})`,
      );

      return transformed;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving ausencias:', error);
      throw new BadRequestException(
        `Error al obtener ausencias: ${error.message}`,
      );
    }
  }

  /**
   * Trimite reamintire pentru justificante către angajat
   * - Email la angajat
   * - Telegram la gestori
   * - Salvează email-ul în istoric
   */
  async recordarJustificante(
    ausenciaId: number,
    managerCodigo?: string,
    managerNombre?: string,
  ): Promise<{ success: true; message: string }> {
    try {
      this.logger.log(
        `📋 [recordarJustificante] Called for ausencia ID: ${ausenciaId}, manager: ${managerCodigo || 'system'}`,
      );

      // Obține ausencia din BD
      const ausencia = await this.prisma.ausencias.findUnique({
        where: { id: ausenciaId },
      });

      if (!ausencia) {
        throw new BadRequestException(
          `Ausencia cu ID ${ausenciaId} nu a fost găsită`,
        );
      }

      const codigo = ausencia.CODIGO || '';
      const nombre = ausencia.NOMBRE || '';
      const tipo = ausencia.TIPO || '';

      // Formatează data corect folosind parseFecha (care parsează string-uri de tip "YYYY-MM-DD" sau "YYYY-MM-DD - YYYY-MM-DD")
      let fecha = '';
      if (ausencia.FECHA) {
        try {
          const fechaStr = String(ausencia.FECHA).trim();

          // Folosește parseFecha pentru a obține fecha_inicio și fecha_fin
          const { inicio: fechaInicio, fin: fechaFin } =
            this.parseFecha(fechaStr);

          // Construiește string-ul de afișare
          if (fechaInicio && fechaFin) {
            if (fechaInicio === fechaFin) {
              // Dată simplă (aceeași zi)
              const fechaDate = new Date(fechaInicio);
              if (!isNaN(fechaDate.getTime())) {
                fecha = fechaDate.toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                });
              } else {
                fecha = fechaInicio; // Folosește valoarea originală dacă nu poate fi formatată
              }
            } else {
              // Interval de date
              const fechaInicioDate = new Date(fechaInicio);
              const fechaFinDate = new Date(fechaFin);
              if (
                !isNaN(fechaInicioDate.getTime()) &&
                !isNaN(fechaFinDate.getTime())
              ) {
                const inicioFormatted = fechaInicioDate.toLocaleDateString(
                  'es-ES',
                  {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  },
                );
                const finFormatted = fechaFinDate.toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                });
                fecha = `${inicioFormatted} - ${finFormatted}`;
              } else {
                fecha = `${fechaInicio} - ${fechaFin}`; // Folosește valorile originale
              }
            }
          } else if (fechaInicio) {
            // Doar fecha_inicio
            const fechaDate = new Date(fechaInicio);
            if (!isNaN(fechaDate.getTime())) {
              fecha = fechaDate.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              });
            } else {
              fecha = fechaInicio; // Folosește valoarea originală
            }
          } else {
            // Nu s-a putut parsa, folosește valoarea originală
            fecha = fechaStr;
            this.logger.warn(
              `⚠️ [recordarJustificante] Could not parse fecha, using raw value: ${fechaStr}`,
            );
          }
        } catch (error: any) {
          this.logger.warn(
            `⚠️ [recordarJustificante] Error formatting fecha: ${error.message}, fecha value: ${ausencia.FECHA}`,
          );
          fecha =
            typeof ausencia.FECHA === 'string' ? String(ausencia.FECHA) : '';
        }
      }

      const motivo = ausencia.MOTIVO || undefined;

      if (!codigo || !nombre) {
        throw new BadRequestException(
          'Ausencia nu are codigo sau nombre complet',
        );
      }

      // Obține email-ul angajatului
      let empleadoEmail: string | null = null;
      try {
        const empleado =
          await this.empleadosService.getEmpleadoByCodigo(codigo);
        empleadoEmail =
          empleado?.['CORREO ELECTRONICO'] ||
          empleado?.CORREO_ELECTRONICO ||
          null;
      } catch (error: any) {
        this.logger.warn(
          `⚠️ [recordarJustificante] Could not fetch empleado email for ${codigo}: ${error.message}`,
        );
      }

      if (!empleadoEmail || empleadoEmail.trim() === '') {
        throw new BadRequestException(
          `No se encontró email para el empleado ${codigo}`,
        );
      }

      // Formatează și trimite email-ul
      let subject = '';
      let html = '';

      try {
        const emailData = this.formatRecordatorioJustificanteEmailHtml({
          codigo,
          nombre,
          tipo,
          fecha,
          motivo,
          managerName: managerNombre,
        });
        subject = emailData.subject;
        html = emailData.html;

        this.logger.log(
          `📧 [recordarJustificante] Sending reminder email to ${empleadoEmail}`,
        );
        await this.emailService.sendEmail(empleadoEmail, subject, html);
        this.logger.log(
          `✅ [recordarJustificante] Reminder email sent to ${empleadoEmail}`,
        );

        // Salvează email-ul în BD
        try {
          await this.sentEmailsService.saveSentEmail({
            senderId: managerCodigo || 'system',
            recipientType: 'empleado',
            recipientId: codigo,
            recipientEmail: empleadoEmail,
            recipientName: nombre,
            subject,
            message: html,
            status: 'sent',
          });
        } catch (saveError: any) {
          this.logger.warn(
            `⚠️ [recordarJustificante] Eroare la salvarea email-ului în BD: ${saveError.message}`,
          );
        }
      } catch (error: any) {
        this.logger.error(
          `❌ [recordarJustificante] Error sending email: ${error.message}`,
        );

        // Salvează și email-urile eșuate în BD
        try {
          await this.sentEmailsService.saveSentEmail({
            senderId: managerCodigo || 'system',
            recipientType: 'empleado',
            recipientId: codigo,
            recipientEmail: empleadoEmail,
            recipientName: nombre,
            subject: subject || `Recordatorio Justificante ${codigo}`,
            message: html || '',
            status: 'failed',
            errorMessage: error.message || String(error),
          });
        } catch (saveError: any) {
          this.logger.warn(
            `⚠️ [recordarJustificante] Eroare la salvarea email-ului eșuat în BD: ${saveError.message}`,
          );
        }

        throw error;
      }

      // Trimite notificare Telegram la gestori
      try {
        const telegramMessage =
          `📋 *Recordatorio de Justificante enviado*\n\n` +
          `👤 *Empleado:* ${nombre} (${codigo})\n` +
          `📅 *Tipo:* ${tipo}\n` +
          `📆 *Fecha:* ${fecha}\n` +
          `${managerNombre ? `👨‍💼 *Enviado por:* ${managerNombre}\n` : ''}` +
          `\nSe ha enviado un recordatorio por email al empleado para que cargue el justificante.`;

        await this.telegramService.sendMessage(telegramMessage);
        this.logger.log(
          `✅ [recordarJustificante] Telegram notification sent to gestoria`,
        );
      } catch (telegramError: any) {
        // Nu aruncăm eroarea pentru Telegram, doar logăm
        this.logger.warn(
          `⚠️ [recordarJustificante] Error sending Telegram notification (non-blocking): ${telegramError.message}`,
        );
      }

      return {
        success: true,
        message: `Recordatorio enviado a ${nombre} (${empleadoEmail})`,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ [recordarJustificante] Error: ${error.message}`,
        error.stack,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al enviar recordatorio: ${error.message}`,
      );
    }
  }

  /**
   * Actualizează tipul unei absențe și trimite notificare pe email
   */
  async updateTipo(
    ausenciaId: number,
    nuevoTipo: string,
    mensajePersonalizado?: string,
    fechaInicio?: string,
    fechaFin?: string,
  ): Promise<{ success: true; message: string }> {
    try {
      this.logger.log(
        `📝 [updateTipo] Called for ausencia ID: ${ausenciaId}, nuevo tipo: ${nuevoTipo}, mensaje: ${mensajePersonalizado ? 'yes' : 'no'}`,
      );

      // Verifică dacă absența există
      const ausencia = await this.prisma.ausencias.findUnique({
        where: { id: ausenciaId },
      });

      if (!ausencia) {
        throw new BadRequestException(
          `Ausencia cu ID ${ausenciaId} nu a fost găsită`,
        );
      }

      // Validează tipul nou
      const tiposValidos = [
        'Ausencia Injustificada',
        'Ausencia Justificada',
        'Ausencias justificada',
        'Asuntos Propios',
        'Asunto Propio',
        'Permiso Retribuido',
      ];

      if (!tiposValidos.includes(nuevoTipo)) {
        throw new BadRequestException(
          `Tipo inválido: ${nuevoTipo}. Tipos válidos: ${tiposValidos.join(', ')}`,
        );
      }

      const tipoAnterior = ausencia.TIPO || '';
      const codigo = ausencia.CODIGO || '';
      const nombre = ausencia.NOMBRE || '';

      // Normalizează tipul pentru baza de date
      const tipoNormalizado = this.normalizeSqlValue(nuevoTipo) || nuevoTipo;

      // Construiește query-ul de actualizare
      let updateQuery = `UPDATE Ausencias SET TIPO = ${this.escapeSql(tipoNormalizado)}`;
      const updates: string[] = [];

      // Dacă se furnizează date, actualizează și FECHA și DURACION
      if (fechaInicio) {
        const fechaFinValue = fechaFin || fechaInicio;
        if (fechaInicio === fechaFinValue) {
          // O singură dată
          updates.push(`FECHA = ${this.escapeSql(fechaInicio)}`);
          const tipoLower = nuevoTipo.toLowerCase();
          if (tipoLower.includes('permiso retribuido')) {
            // Pentru "Permiso Retribuido", verifică dacă este zi lucrătoare și dacă angajatul are programat să lucreze
            // Folosim aceeași logică ca în recalcularDuracion pentru o singură dată
            const esLaborableSubquery = `
              (SELECT 
                CASE 
                  WHEN DAYOFWEEK(${this.escapeSql(fechaInicio)}) BETWEEN 2 AND 6 
                    AND NOT EXISTS (
                      SELECT 1 FROM fiestas f
                      WHERE DATE(COALESCE(f.observed_date, f.date)) = ${this.escapeSql(fechaInicio)}
                        AND f.active = 1
                        AND (
                          LOWER(f.scope) IN ('nacional', 'national')
                          OR (LOWER(f.scope) IN ('autonómico', 'autonomico', 'ccaa') 
                              AND f.ccaa_code = '')
                        )
                        AND NOT EXISTS (
                          SELECT 1 FROM DatosEmpleados de
                          WHERE de.CODIGO = ${this.escapeSql(codigo)}
                            AND LOWER(TRIM(de.TrabajaFestivos)) IN ('si','sí','s','1','true','da','y')
                        )
                    )
                    AND (
                      -- Are cuadrante cu valoare validă pentru ziua respectivă
                      EXISTS (
                        SELECT 1 FROM cuadrante cq
                        WHERE BINARY cq.CODIGO = ${this.escapeSql(codigo)}
                          AND BINARY cq.LUNA = DATE_FORMAT(${this.escapeSql(fechaInicio)}, '%Y-%m')
                          AND CASE DAY(${this.escapeSql(fechaInicio)})
                            WHEN 1 THEN cq.ZI_1 WHEN 2 THEN cq.ZI_2 WHEN 3 THEN cq.ZI_3 WHEN 4 THEN cq.ZI_4
                            WHEN 5 THEN cq.ZI_5 WHEN 6 THEN cq.ZI_6 WHEN 7 THEN cq.ZI_7 WHEN 8 THEN cq.ZI_8
                            WHEN 9 THEN cq.ZI_9 WHEN 10 THEN cq.ZI_10 WHEN 11 THEN cq.ZI_11 WHEN 12 THEN cq.ZI_12
                            WHEN 13 THEN cq.ZI_13 WHEN 14 THEN cq.ZI_14 WHEN 15 THEN cq.ZI_15 WHEN 16 THEN cq.ZI_16
                            WHEN 17 THEN cq.ZI_17 WHEN 18 THEN cq.ZI_18 WHEN 19 THEN cq.ZI_19 WHEN 20 THEN cq.ZI_20
                            WHEN 21 THEN cq.ZI_21 WHEN 22 THEN cq.ZI_22 WHEN 23 THEN cq.ZI_23 WHEN 24 THEN cq.ZI_24
                            WHEN 25 THEN cq.ZI_25 WHEN 26 THEN cq.ZI_26 WHEN 27 THEN cq.ZI_27 WHEN 28 THEN cq.ZI_28
                            WHEN 29 THEN cq.ZI_29 WHEN 30 THEN cq.ZI_30 WHEN 31 THEN cq.ZI_31
                            ELSE NULL
                          END IS NOT NULL
                          AND TRIM(CASE DAY(${this.escapeSql(fechaInicio)})
                            WHEN 1 THEN cq.ZI_1 WHEN 2 THEN cq.ZI_2 WHEN 3 THEN cq.ZI_3 WHEN 4 THEN cq.ZI_4
                            WHEN 5 THEN cq.ZI_5 WHEN 6 THEN cq.ZI_6 WHEN 7 THEN cq.ZI_7 WHEN 8 THEN cq.ZI_8
                            WHEN 9 THEN cq.ZI_9 WHEN 10 THEN cq.ZI_10 WHEN 11 THEN cq.ZI_11 WHEN 12 THEN cq.ZI_12
                            WHEN 13 THEN cq.ZI_13 WHEN 14 THEN cq.ZI_14 WHEN 15 THEN cq.ZI_15 WHEN 16 THEN cq.ZI_16
                            WHEN 17 THEN cq.ZI_17 WHEN 18 THEN cq.ZI_18 WHEN 19 THEN cq.ZI_19 WHEN 20 THEN cq.ZI_20
                            WHEN 21 THEN cq.ZI_21 WHEN 22 THEN cq.ZI_22 WHEN 23 THEN cq.ZI_23 WHEN 24 THEN cq.ZI_24
                            WHEN 25 THEN cq.ZI_25 WHEN 26 THEN cq.ZI_26 WHEN 27 THEN cq.ZI_27 WHEN 28 THEN cq.ZI_28
                            WHEN 29 THEN cq.ZI_29 WHEN 30 THEN cq.ZI_30 WHEN 31 THEN cq.ZI_31
                            ELSE NULL
                          END) != ''
                          AND UPPER(TRIM(CASE DAY(${this.escapeSql(fechaInicio)})
                            WHEN 1 THEN cq.ZI_1 WHEN 2 THEN cq.ZI_2 WHEN 3 THEN cq.ZI_3 WHEN 4 THEN cq.ZI_4
                            WHEN 5 THEN cq.ZI_5 WHEN 6 THEN cq.ZI_6 WHEN 7 THEN cq.ZI_7 WHEN 8 THEN cq.ZI_8
                            WHEN 9 THEN cq.ZI_9 WHEN 10 THEN cq.ZI_10 WHEN 11 THEN cq.ZI_11 WHEN 12 THEN cq.ZI_12
                            WHEN 13 THEN cq.ZI_13 WHEN 14 THEN cq.ZI_14 WHEN 15 THEN cq.ZI_15 WHEN 16 THEN cq.ZI_16
                            WHEN 17 THEN cq.ZI_17 WHEN 18 THEN cq.ZI_18 WHEN 19 THEN cq.ZI_19 WHEN 20 THEN cq.ZI_20
                            WHEN 21 THEN cq.ZI_21 WHEN 22 THEN cq.ZI_22 WHEN 23 THEN cq.ZI_23 WHEN 24 THEN cq.ZI_24
                            WHEN 25 THEN cq.ZI_25 WHEN 26 THEN cq.ZI_26 WHEN 27 THEN cq.ZI_27 WHEN 28 THEN cq.ZI_28
                            WHEN 29 THEN cq.ZI_29 WHEN 30 THEN cq.ZI_30 WHEN 31 THEN cq.ZI_31
                            ELSE NULL
                          END)) NOT IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X')
                          AND (CASE DAY(${this.escapeSql(fechaInicio)})
                            WHEN 1 THEN cq.ZI_1 WHEN 2 THEN cq.ZI_2 WHEN 3 THEN cq.ZI_3 WHEN 4 THEN cq.ZI_4
                            WHEN 5 THEN cq.ZI_5 WHEN 6 THEN cq.ZI_6 WHEN 7 THEN cq.ZI_7 WHEN 8 THEN cq.ZI_8
                            WHEN 9 THEN cq.ZI_9 WHEN 10 THEN cq.ZI_10 WHEN 11 THEN cq.ZI_11 WHEN 12 THEN cq.ZI_12
                            WHEN 13 THEN cq.ZI_13 WHEN 14 THEN cq.ZI_14 WHEN 15 THEN cq.ZI_15 WHEN 16 THEN cq.ZI_16
                            WHEN 17 THEN cq.ZI_17 WHEN 18 THEN cq.ZI_18 WHEN 19 THEN cq.ZI_19 WHEN 20 THEN cq.ZI_20
                            WHEN 21 THEN cq.ZI_21 WHEN 22 THEN cq.ZI_22 WHEN 23 THEN cq.ZI_23 WHEN 24 THEN cq.ZI_24
                            WHEN 25 THEN cq.ZI_25 WHEN 26 THEN cq.ZI_26 WHEN 27 THEN cq.ZI_27 WHEN 28 THEN cq.ZI_28
                            WHEN 29 THEN cq.ZI_29 WHEN 30 THEN cq.ZI_30 WHEN 31 THEN cq.ZI_31
                            ELSE NULL
                          END LIKE '%:%-%:%' OR CASE DAY(${this.escapeSql(fechaInicio)})
                            WHEN 1 THEN cq.ZI_1 WHEN 2 THEN cq.ZI_2 WHEN 3 THEN cq.ZI_3 WHEN 4 THEN cq.ZI_4
                            WHEN 5 THEN cq.ZI_5 WHEN 6 THEN cq.ZI_6 WHEN 7 THEN cq.ZI_7 WHEN 8 THEN cq.ZI_8
                            WHEN 9 THEN cq.ZI_9 WHEN 10 THEN cq.ZI_10 WHEN 11 THEN cq.ZI_11 WHEN 12 THEN cq.ZI_12
                            WHEN 13 THEN cq.ZI_13 WHEN 14 THEN cq.ZI_14 WHEN 15 THEN cq.ZI_15 WHEN 16 THEN cq.ZI_16
                            WHEN 17 THEN cq.ZI_17 WHEN 18 THEN cq.ZI_18 WHEN 19 THEN cq.ZI_19 WHEN 20 THEN cq.ZI_20
                            WHEN 21 THEN cq.ZI_21 WHEN 22 THEN cq.ZI_22 WHEN 23 THEN cq.ZI_23 WHEN 24 THEN cq.ZI_24
                            WHEN 25 THEN cq.ZI_25 WHEN 26 THEN cq.ZI_26 WHEN 27 THEN cq.ZI_27 WHEN 28 THEN cq.ZI_28
                            WHEN 29 THEN cq.ZI_29 WHEN 30 THEN cq.ZI_30 WHEN 31 THEN cq.ZI_31
                            ELSE NULL
                          END REGEXP '^[0-9]+h')
                      )
                      OR
                      -- Sau are horario_multicentro cu valoare validă
                      (NOT EXISTS (
                        SELECT 1 FROM cuadrante cq2
                        WHERE BINARY cq2.CODIGO = ${this.escapeSql(codigo)}
                          AND BINARY cq2.LUNA = DATE_FORMAT(${this.escapeSql(fechaInicio)}, '%Y-%m')
                      )
                      AND EXISTS (
                        SELECT 1 FROM horario_multicentro hm
                        WHERE BINARY hm.CODIGO = ${this.escapeSql(codigo)}
                          AND BINARY hm.LUNA = DATE_FORMAT(${this.escapeSql(fechaInicio)}, '%Y-%m')
                          AND CASE DAY(${this.escapeSql(fechaInicio)})
                            WHEN 1 THEN hm.ZI_1 WHEN 2 THEN hm.ZI_2 WHEN 3 THEN hm.ZI_3 WHEN 4 THEN hm.ZI_4
                            WHEN 5 THEN hm.ZI_5 WHEN 6 THEN hm.ZI_6 WHEN 7 THEN hm.ZI_7 WHEN 8 THEN hm.ZI_8
                            WHEN 9 THEN hm.ZI_9 WHEN 10 THEN hm.ZI_10 WHEN 11 THEN hm.ZI_11 WHEN 12 THEN hm.ZI_12
                            WHEN 13 THEN hm.ZI_13 WHEN 14 THEN hm.ZI_14 WHEN 15 THEN hm.ZI_15 WHEN 16 THEN hm.ZI_16
                            WHEN 17 THEN hm.ZI_17 WHEN 18 THEN hm.ZI_18 WHEN 19 THEN hm.ZI_19 WHEN 20 THEN hm.ZI_20
                            WHEN 21 THEN hm.ZI_21 WHEN 22 THEN hm.ZI_22 WHEN 23 THEN hm.ZI_23 WHEN 24 THEN hm.ZI_24
                            WHEN 25 THEN hm.ZI_25 WHEN 26 THEN hm.ZI_26 WHEN 27 THEN hm.ZI_27 WHEN 28 THEN hm.ZI_28
                            WHEN 29 THEN hm.ZI_29 WHEN 30 THEN hm.ZI_30 WHEN 31 THEN hm.ZI_31
                            ELSE NULL
                          END IS NOT NULL
                          AND TRIM(CASE DAY(${this.escapeSql(fechaInicio)})
                            WHEN 1 THEN hm.ZI_1 WHEN 2 THEN hm.ZI_2 WHEN 3 THEN hm.ZI_3 WHEN 4 THEN hm.ZI_4
                            WHEN 5 THEN hm.ZI_5 WHEN 6 THEN hm.ZI_6 WHEN 7 THEN hm.ZI_7 WHEN 8 THEN hm.ZI_8
                            WHEN 9 THEN hm.ZI_9 WHEN 10 THEN hm.ZI_10 WHEN 11 THEN hm.ZI_11 WHEN 12 THEN hm.ZI_12
                            WHEN 13 THEN hm.ZI_13 WHEN 14 THEN hm.ZI_14 WHEN 15 THEN hm.ZI_15 WHEN 16 THEN hm.ZI_16
                            WHEN 17 THEN hm.ZI_17 WHEN 18 THEN hm.ZI_18 WHEN 19 THEN hm.ZI_19 WHEN 20 THEN hm.ZI_20
                            WHEN 21 THEN hm.ZI_21 WHEN 22 THEN hm.ZI_22 WHEN 23 THEN hm.ZI_23 WHEN 24 THEN hm.ZI_24
                            WHEN 25 THEN hm.ZI_25 WHEN 26 THEN hm.ZI_26 WHEN 27 THEN hm.ZI_27 WHEN 28 THEN hm.ZI_28
                            WHEN 29 THEN hm.ZI_29 WHEN 30 THEN hm.ZI_30 WHEN 31 THEN hm.ZI_31
                            ELSE NULL
                          END) != ''
                          AND UPPER(TRIM(CASE DAY(${this.escapeSql(fechaInicio)})
                            WHEN 1 THEN hm.ZI_1 WHEN 2 THEN hm.ZI_2 WHEN 3 THEN hm.ZI_3 WHEN 4 THEN hm.ZI_4
                            WHEN 5 THEN hm.ZI_5 WHEN 6 THEN hm.ZI_6 WHEN 7 THEN hm.ZI_7 WHEN 8 THEN hm.ZI_8
                            WHEN 9 THEN hm.ZI_9 WHEN 10 THEN hm.ZI_10 WHEN 11 THEN hm.ZI_11 WHEN 12 THEN hm.ZI_12
                            WHEN 13 THEN hm.ZI_13 WHEN 14 THEN hm.ZI_14 WHEN 15 THEN hm.ZI_15 WHEN 16 THEN hm.ZI_16
                            WHEN 17 THEN hm.ZI_17 WHEN 18 THEN hm.ZI_18 WHEN 19 THEN hm.ZI_19 WHEN 20 THEN hm.ZI_20
                            WHEN 21 THEN hm.ZI_21 WHEN 22 THEN hm.ZI_22 WHEN 23 THEN hm.ZI_23 WHEN 24 THEN hm.ZI_24
                            WHEN 25 THEN hm.ZI_25 WHEN 26 THEN hm.ZI_26 WHEN 27 THEN hm.ZI_27 WHEN 28 THEN hm.ZI_28
                            WHEN 29 THEN hm.ZI_29 WHEN 30 THEN hm.ZI_30 WHEN 31 THEN hm.ZI_31
                            ELSE NULL
                          END)) NOT IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X')
                          AND (CASE DAY(${this.escapeSql(fechaInicio)})
                            WHEN 1 THEN hm.ZI_1 WHEN 2 THEN hm.ZI_2 WHEN 3 THEN hm.ZI_3 WHEN 4 THEN hm.ZI_4
                            WHEN 5 THEN hm.ZI_5 WHEN 6 THEN hm.ZI_6 WHEN 7 THEN hm.ZI_7 WHEN 8 THEN hm.ZI_8
                            WHEN 9 THEN hm.ZI_9 WHEN 10 THEN hm.ZI_10 WHEN 11 THEN hm.ZI_11 WHEN 12 THEN hm.ZI_12
                            WHEN 13 THEN hm.ZI_13 WHEN 14 THEN hm.ZI_14 WHEN 15 THEN hm.ZI_15 WHEN 16 THEN hm.ZI_16
                            WHEN 17 THEN hm.ZI_17 WHEN 18 THEN hm.ZI_18 WHEN 19 THEN hm.ZI_19 WHEN 20 THEN hm.ZI_20
                            WHEN 21 THEN hm.ZI_21 WHEN 22 THEN hm.ZI_22 WHEN 23 THEN hm.ZI_23 WHEN 24 THEN hm.ZI_24
                            WHEN 25 THEN hm.ZI_25 WHEN 26 THEN hm.ZI_26 WHEN 27 THEN hm.ZI_27 WHEN 28 THEN hm.ZI_28
                            WHEN 29 THEN hm.ZI_29 WHEN 30 THEN hm.ZI_30 WHEN 31 THEN hm.ZI_31
                            ELSE NULL
                          END LIKE '%:%-%:%' OR CASE DAY(${this.escapeSql(fechaInicio)})
                            WHEN 1 THEN hm.ZI_1 WHEN 2 THEN hm.ZI_2 WHEN 3 THEN hm.ZI_3 WHEN 4 THEN hm.ZI_4
                            WHEN 5 THEN hm.ZI_5 WHEN 6 THEN hm.ZI_6 WHEN 7 THEN hm.ZI_7 WHEN 8 THEN hm.ZI_8
                            WHEN 9 THEN hm.ZI_9 WHEN 10 THEN hm.ZI_10 WHEN 11 THEN hm.ZI_11 WHEN 12 THEN hm.ZI_12
                            WHEN 13 THEN hm.ZI_13 WHEN 14 THEN hm.ZI_14 WHEN 15 THEN hm.ZI_15 WHEN 16 THEN hm.ZI_16
                            WHEN 17 THEN hm.ZI_17 WHEN 18 THEN hm.ZI_18 WHEN 19 THEN hm.ZI_19 WHEN 20 THEN hm.ZI_20
                            WHEN 21 THEN hm.ZI_21 WHEN 22 THEN hm.ZI_22 WHEN 23 THEN hm.ZI_23 WHEN 24 THEN hm.ZI_24
                            WHEN 25 THEN hm.ZI_25 WHEN 26 THEN hm.ZI_26 WHEN 27 THEN hm.ZI_27 WHEN 28 THEN hm.ZI_28
                            WHEN 29 THEN hm.ZI_29 WHEN 30 THEN hm.ZI_30 WHEN 31 THEN hm.ZI_31
                            ELSE NULL
                          END REGEXP '^[0-9]+h')
                      ))
                      OR
                      -- Sau are horario programat
                      (NOT EXISTS (
                        SELECT 1 FROM cuadrante cq3
                        WHERE BINARY cq3.CODIGO = ${this.escapeSql(codigo)}
                          AND BINARY cq3.LUNA = DATE_FORMAT(${this.escapeSql(fechaInicio)}, '%Y-%m')
                      )
                      AND NOT EXISTS (
                        SELECT 1 FROM horario_multicentro hm2
                        WHERE BINARY hm2.CODIGO = ${this.escapeSql(codigo)}
                          AND BINARY hm2.LUNA = DATE_FORMAT(${this.escapeSql(fechaInicio)}, '%Y-%m')
                      )
                      AND EXISTS (
                        SELECT 1 FROM DatosEmpleados de
                        LEFT JOIN horarios h
                          ON h.centro_nombre = de.\`CENTRO TRABAJO\`
                          AND h.grupo_nombre = de.GRUPO
                          AND h.vigente_desde <= ${this.escapeSql(fechaInicio)}
                          AND (h.vigente_hasta IS NULL OR ${this.escapeSql(fechaInicio)} <= h.vigente_hasta)
                        WHERE de.CODIGO = ${this.escapeSql(codigo)}
                          AND CASE DAYOFWEEK(${this.escapeSql(fechaInicio)})
                            WHEN 2 THEN h.lun_in1 WHEN 3 THEN h.mar_in1 WHEN 4 THEN h.mie_in1
                            WHEN 5 THEN h.joi_in1 WHEN 6 THEN h.vin_in1
                            WHEN 7 THEN h.sam_in1 WHEN 1 THEN h.dum_in1
                            ELSE NULL
                          END IS NOT NULL
                      ))
                  THEN 1
                  ELSE 0
                END AS es_laborable
              )
            `;
            updates.push(`DURACION = ${esLaborableSubquery}`);
            updates.push(`UNIDAD_DURACION = 'dias'`);
          } else if (
            tipoLower.includes('permiso') ||
            tipoLower.includes('asunto propio') ||
            tipoLower.includes('vacacion')
          ) {
            // Pentru alte tipuri pe zile, durata este 1 zi
            updates.push(`DURACION = 1`);
            updates.push(`UNIDAD_DURACION = 'dias'`);
          }
        } else {
          // Interval de date
          updates.push(
            `FECHA = CONCAT(${this.escapeSql(fechaInicio)}, ' - ', ${this.escapeSql(fechaFinValue)})`,
          );
          // Calculează durata în zile pentru tipuri pe zile
          const tipoLower = nuevoTipo.toLowerCase();
          if (tipoLower.includes('permiso retribuido')) {
            // Pentru "Permiso Retribuido", calculează doar zilele lucrătoare unde angajatul are programat să lucreze
            // Verifică în cuadrante sau horario dacă are ore programate
            const diasLaborablesSubquery = `
              (SELECT COUNT(*) 
               FROM (
                 WITH RECURSIVE fechas AS (
                   SELECT ${this.escapeSql(fechaInicio)} AS d
                   UNION ALL
                   SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM fechas 
                   WHERE d < ${this.escapeSql(fechaFinValue)}
                 ),
                 empleado_ccaa AS (
                   SELECT COALESCE(CCAA, '') AS ccaa
                   FROM DatosEmpleados
                   WHERE CODIGO = ${this.escapeSql(codigo)}
                   LIMIT 1
                 ),
                 empleado_trabaja_festivos AS (
                   SELECT 
                     CASE 
                       WHEN LOWER(TRIM(TrabajaFestivos)) IN ('si','sí','s','1','true','da','y') THEN 1
                       ELSE 0
                     END AS trabaja_festivos
                   FROM DatosEmpleados
                   WHERE CODIGO = ${this.escapeSql(codigo)}
                   LIMIT 1
                 ),
                 cuadrante_dia AS (
                   SELECT 
                     f.d AS fecha,
                     CASE 
                       WHEN cq.CODIGO IS NOT NULL THEN
                         CASE DAY(f.d)
                           WHEN 1 THEN cq.ZI_1 WHEN 2 THEN cq.ZI_2 WHEN 3 THEN cq.ZI_3 WHEN 4 THEN cq.ZI_4
                           WHEN 5 THEN cq.ZI_5 WHEN 6 THEN cq.ZI_6 WHEN 7 THEN cq.ZI_7 WHEN 8 THEN cq.ZI_8
                           WHEN 9 THEN cq.ZI_9 WHEN 10 THEN cq.ZI_10 WHEN 11 THEN cq.ZI_11 WHEN 12 THEN cq.ZI_12
                           WHEN 13 THEN cq.ZI_13 WHEN 14 THEN cq.ZI_14 WHEN 15 THEN cq.ZI_15 WHEN 16 THEN cq.ZI_16
                           WHEN 17 THEN cq.ZI_17 WHEN 18 THEN cq.ZI_18 WHEN 19 THEN cq.ZI_19 WHEN 20 THEN cq.ZI_20
                           WHEN 21 THEN cq.ZI_21 WHEN 22 THEN cq.ZI_22 WHEN 23 THEN cq.ZI_23 WHEN 24 THEN cq.ZI_24
                           WHEN 25 THEN cq.ZI_25 WHEN 26 THEN cq.ZI_26 WHEN 27 THEN cq.ZI_27 WHEN 28 THEN cq.ZI_28
                           WHEN 29 THEN cq.ZI_29 WHEN 30 THEN cq.ZI_30 WHEN 31 THEN cq.ZI_31
                           ELSE NULL
                         END
                       ELSE NULL
                     END AS val_cuadrante
                   FROM fechas f
                   LEFT JOIN cuadrante cq 
                     ON BINARY cq.CODIGO = ${this.escapeSql(codigo)}
                     AND BINARY cq.LUNA = DATE_FORMAT(f.d, '%Y-%m')
                 ),
                 horario_dia AS (
                   SELECT 
                     f.d AS fecha,
                     CASE DAYOFWEEK(f.d)
                       WHEN 2 THEN h.lun_in1 WHEN 3 THEN h.mar_in1 WHEN 4 THEN h.mie_in1
                       WHEN 5 THEN h.joi_in1 WHEN 6 THEN h.vin_in1
                       WHEN 7 THEN h.sam_in1 WHEN 1 THEN h.dum_in1
                       ELSE NULL
                     END AS hora_in_planificata
                   FROM fechas f
                   LEFT JOIN DatosEmpleados de ON de.CODIGO = ${this.escapeSql(codigo)}
                   LEFT JOIN horarios h
                     ON h.centro_nombre = de.\`CENTRO TRABAJO\`
                     AND h.grupo_nombre = de.GRUPO
                     AND h.vigente_desde <= f.d
                     AND (h.vigente_hasta IS NULL OR f.d <= h.vigente_hasta)
                 ),
                 horario_multicentro_dia AS (
                   SELECT 
                     f.d AS fecha,
                     CASE 
                       WHEN hm.CODIGO IS NOT NULL THEN
                         CASE DAY(f.d)
                           WHEN 1 THEN hm.ZI_1 WHEN 2 THEN hm.ZI_2 WHEN 3 THEN hm.ZI_3 WHEN 4 THEN hm.ZI_4
                           WHEN 5 THEN hm.ZI_5 WHEN 6 THEN hm.ZI_6 WHEN 7 THEN hm.ZI_7 WHEN 8 THEN hm.ZI_8
                           WHEN 9 THEN hm.ZI_9 WHEN 10 THEN hm.ZI_10 WHEN 11 THEN hm.ZI_11 WHEN 12 THEN hm.ZI_12
                           WHEN 13 THEN hm.ZI_13 WHEN 14 THEN hm.ZI_14 WHEN 15 THEN hm.ZI_15 WHEN 16 THEN hm.ZI_16
                           WHEN 17 THEN hm.ZI_17 WHEN 18 THEN hm.ZI_18 WHEN 19 THEN hm.ZI_19 WHEN 20 THEN hm.ZI_20
                           WHEN 21 THEN hm.ZI_21 WHEN 22 THEN hm.ZI_22 WHEN 23 THEN hm.ZI_23 WHEN 24 THEN hm.ZI_24
                           WHEN 25 THEN hm.ZI_25 WHEN 26 THEN hm.ZI_26 WHEN 27 THEN hm.ZI_27 WHEN 28 THEN hm.ZI_28
                           WHEN 29 THEN hm.ZI_29 WHEN 30 THEN hm.ZI_30 WHEN 31 THEN hm.ZI_31
                           ELSE NULL
                         END
                       ELSE NULL
                     END AS val_multicentro
                   FROM fechas f
                   LEFT JOIN horario_multicentro hm 
                     ON BINARY hm.CODIGO = ${this.escapeSql(codigo)}
                     AND BINARY hm.LUNA = DATE_FORMAT(f.d, '%Y-%m')
                 )
                 SELECT f.d
                 FROM fechas f
                 CROSS JOIN empleado_ccaa ec
                 CROSS JOIN empleado_trabaja_festivos etf
                 LEFT JOIN cuadrante_dia cd ON cd.fecha = f.d
                 LEFT JOIN horario_dia hd ON hd.fecha = f.d
                 LEFT JOIN horario_multicentro_dia hmd ON hmd.fecha = f.d
                 WHERE DAYOFWEEK(f.d) BETWEEN 2 AND 6  -- Luni-Vineri
                   AND NOT EXISTS (
                     SELECT 1 FROM fiestas fi
                     WHERE DATE(COALESCE(fi.observed_date, fi.date)) = f.d
                       AND fi.active = 1
                       AND (
                         LOWER(fi.scope) IN ('nacional', 'national')
                         OR (LOWER(fi.scope) IN ('autonómico', 'autonomico', 'ccaa') 
                             AND BINARY fi.ccaa_code = BINARY ec.ccaa)
                       )
                       AND etf.trabaja_festivos = 0
                   )
                   AND (
                     -- Are cuadrante cu valoare validă (nu LIB/LIBRE/etc.)
                     (cd.val_cuadrante IS NOT NULL 
                      AND TRIM(cd.val_cuadrante) != ''
                      AND UPPER(TRIM(cd.val_cuadrante)) NOT IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X')
                      AND (cd.val_cuadrante LIKE '%:%-%:%' OR cd.val_cuadrante REGEXP '^[0-9]+h'))
                     OR
                     -- Sau are horario_multicentro cu valoare validă
                     (cd.val_cuadrante IS NULL 
                      AND hmd.val_multicentro IS NOT NULL 
                      AND TRIM(hmd.val_multicentro) != ''
                      AND UPPER(TRIM(hmd.val_multicentro)) NOT IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X')
                      AND (hmd.val_multicentro LIKE '%:%-%:%' OR hmd.val_multicentro REGEXP '^[0-9]+h'))
                     OR
                     -- Sau are horario programat
                     (cd.val_cuadrante IS NULL AND hmd.val_multicentro IS NULL AND hd.hora_in_planificata IS NOT NULL)
                   )
               ) AS dias_laborables
              )
            `;
            updates.push(`DURACION = GREATEST(1, ${diasLaborablesSubquery})`);
            updates.push(`UNIDAD_DURACION = 'dias'`);
          } else if (
            tipoLower.includes('permiso') ||
            tipoLower.includes('asunto propio') ||
            tipoLower.includes('vacacion')
          ) {
            // Pentru alte tipuri pe zile, calculează toate zilele
            updates.push(
              `DURACION = GREATEST(1, DATEDIFF(${this.escapeSql(fechaFinValue)}, ${this.escapeSql(fechaInicio)}) + 1)`,
            );
            updates.push(`UNIDAD_DURACION = 'dias'`);
          }
        }
      }

      if (updates.length > 0) {
        updateQuery += `, ${updates.join(', ')}`;
      }

      updateQuery += ` WHERE id = ${ausenciaId}`;

      // Actualizează tipul (și eventual data) în baza de date
      await this.prisma.$executeRawUnsafe(updateQuery);

      this.logger.log(
        `✅ [updateTipo] Ausencia ${ausenciaId} actualizada: ${tipoAnterior} -> ${nuevoTipo}`,
      );

      // Formatează data pentru notificare (folosește data actualizată dacă există, altfel data veche)
      let fechaParaNotificacion = '';
      if (fechaInicio) {
        const fechaFinValue = fechaFin || fechaInicio;
        if (fechaInicio === fechaFinValue) {
          fechaParaNotificacion = new Date(fechaInicio).toLocaleDateString(
            'es-ES',
          );
        } else {
          fechaParaNotificacion = `${new Date(fechaInicio).toLocaleDateString('es-ES')} - ${new Date(fechaFinValue).toLocaleDateString('es-ES')}`;
        }
      } else {
        // Folosește data veche din ausencia
        fechaParaNotificacion = ausencia.FECHA
          ? ausencia.FECHA.includes(' - ')
            ? ausencia.FECHA
            : new Date(ausencia.FECHA).toLocaleDateString('es-ES')
          : '';
      }

      // Trimite email de notificare către angajat
      try {
        await this.sendTipoChangedNotification(
          codigo,
          nombre,
          tipoAnterior,
          nuevoTipo,
          fechaParaNotificacion,
          mensajePersonalizado,
        );
      } catch (emailError: any) {
        this.logger.warn(
          `⚠️ [updateTipo] Error sending email notification: ${emailError.message}`,
        );
        // Nu aruncăm eroare dacă email-ul eșuează, doar logăm
      }

      return {
        success: true,
        message: `Ausencia convertida de "${tipoAnterior}" a "${nuevoTipo}"`,
      };
    } catch (error: any) {
      this.logger.error(`❌ [updateTipo] Error:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar tipo: ${error.message}`,
      );
    }
  }

  /**
   * Trimite email de notificare când tipul absenței este schimbat
   */
  private async sendTipoChangedNotification(
    codigo: string,
    nombre: string,
    tipoAnterior: string,
    tipoNuevo: string,
    fecha: string,
    mensajePersonalizado?: string,
  ): Promise<void> {
    try {
      // Obține email-ul angajatului
      let empleadoEmail: string | null = null;
      let empleadoNombreFormatted: string = nombre;

      try {
        const empleado =
          await this.empleadosService.getEmpleadoByCodigo(codigo);
        if (empleado) {
          empleadoEmail =
            empleado['CORREO ELECTRONICO'] ||
            empleado.CORREO_ELECTRONICO ||
            null;
          empleadoNombreFormatted =
            this.empleadosService.getFormattedNombre(empleado) || nombre;
        }
      } catch (error: any) {
        this.logger.warn(
          `⚠️ Could not fetch empleado data for ${codigo}: ${error.message}`,
        );
      }

      if (!empleadoEmail || empleadoEmail.trim() === '') {
        throw new BadRequestException(
          `No se encontró email para el empleado ${codigo}`,
        );
      }

      // Formatează email-ul
      const subject = `Cambio de tipo de ausencia - ${tipoNuevo}`;

      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
            .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #667eea; border-radius: 4px; }
            .mensaje-box { background: #fef3c7; padding: 15px; margin: 15px 0; border-left: 4px solid #f59e0b; border-radius: 4px; }
            .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
            .badge-old { background: #fee2e2; color: #991b1b; }
            .badge-new { background: #dbeafe; color: #1e40af; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Cambio de Tipo de Ausencia</h2>
            </div>
            <div class="content">
              <p>Estimado/a <strong>${empleadoNombreFormatted}</strong>,</p>
              
              <p>Le informamos que se ha modificado el tipo de su ausencia:</p>
              
              <div class="info-box">
                <p><strong>Fecha:</strong> ${fecha || 'N/A'}</p>
                <p><strong>Tipo anterior:</strong> <span class="badge badge-old">${tipoAnterior}</span></p>
                <p><strong>Tipo nuevo:</strong> <span class="badge badge-new">${tipoNuevo}</span></p>
              </div>
      `;

      if (mensajePersonalizado && mensajePersonalizado.trim() !== '') {
        html += `
              <div class="mensaje-box">
                <p><strong>Mensaje personalizado:</strong></p>
                <p style="white-space: pre-wrap;">${mensajePersonalizado.replace(/\n/g, '<br>')}</p>
              </div>
        `;
      }

      html += `
              <p>Si tiene alguna pregunta o necesita más información, no dude en contactarnos.</p>
              
              <p>Saludos cordiales,<br>Equipo de De Camino Servicios Auxiliares S.L.</p>
            </div>
            <div class="footer">
              <p>Este es un mensaje automático. Por favor, no responda a este correo.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Trimite email-ul
      await this.emailService.sendEmail(empleadoEmail, subject, html);

      // Salvează email-ul în istoric
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: 'system',
          recipientType: 'empleado',
          recipientId: codigo,
          recipientEmail: empleadoEmail,
          recipientName: empleadoNombreFormatted,
          subject: subject,
          message: html,
          status: 'sent',
        });
      } catch (saveError: any) {
        this.logger.warn(`⚠️ Could not save sent email: ${saveError.message}`);
      }

      this.logger.log(
        `✅ Email de cambio de tipo enviado a ${empleadoEmail} para ausencia ${codigo}`,
      );

      // Trimite notificare Telegram către gestorie
      if (this.telegramService.isConfigured()) {
        try {
          let telegramMessage = `🔄 *Cambio de Tipo de Ausencia*\n\n`;
          telegramMessage += `👤 *Empleado:* ${empleadoNombreFormatted}\n`;
          telegramMessage += `📋 *Código:* ${codigo}\n`;
          telegramMessage += `📅 *Fecha:* ${fecha || 'N/A'}\n`;
          telegramMessage += `❌ *Tipo anterior:* ${tipoAnterior}\n`;
          telegramMessage += `✅ *Tipo nuevo:* ${tipoNuevo}\n`;

          if (mensajePersonalizado && mensajePersonalizado.trim() !== '') {
            telegramMessage += `\n💬 *Mensaje personalizado:*\n${mensajePersonalizado}\n`;
          }

          await this.telegramService.sendMessage(telegramMessage);

          this.logger.log(
            `✅ Notificación Telegram enviada a gestoria para cambio de tipo de ausencia de ${empleadoNombreFormatted}`,
          );
        } catch (telegramError: any) {
          this.logger.warn(
            `⚠️ Error enviando notificación Telegram (non-blocking): ${telegramError.message}`,
          );
          // Nu aruncăm eroare - doar logăm
        }
      } else {
        this.logger.warn(
          '⚠️ Telegram service no configurado, no se envió notificación',
        );
      }
    } catch (error: any) {
      this.logger.error(`❌ Error sending tipo changed notification:`, error);
      throw error;
    }
  }

  /**
   * Asociază sau desasociază o ausencia cu alta
   * @param ausenciaId ID-ul ausencias care va fi asociată
   * @param ausenciaAsociadaId ID-ul ausencias cu care se asociază (sau null pentru desasociere)
   */
  async asociarAusencia(
    ausenciaId: number,
    ausenciaAsociadaId: number | null,
  ): Promise<{ success: true; message: string }> {
    try {
      // Verifică că ausencia există
      const ausencia = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, CODIGO, TIPO, FECHA, DURACION, UNIDAD_DURACION FROM Ausencias WHERE id = ${ausenciaId}`,
      );

      if (!ausencia || ausencia.length === 0) {
        throw new BadRequestException(
          `Ausencia con ID ${ausenciaId} no existe`,
        );
      }

      // Dacă se asociază cu alta, verifică că există
      if (ausenciaAsociadaId !== null) {
        const ausenciaAsociada = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT id, CODIGO, TIPO, FECHA, DURACION, UNIDAD_DURACION FROM Ausencias WHERE id = ${ausenciaAsociadaId}`,
        );

        if (!ausenciaAsociada || ausenciaAsociada.length === 0) {
          throw new BadRequestException(
            `Ausencia con ID ${ausenciaAsociadaId} no existe`,
          );
        }

        // Verifică că nu se auto-asociază
        if (ausenciaId === ausenciaAsociadaId) {
          throw new BadRequestException(
            'No se puede asociar una ausencia consigo misma',
          );
        }

        // Verifică dacă trebuie să actualizăm durata
        // Dacă "Ausencias justificada" (pe zile) se asociază cu "Salida Sin Regreso" sau "Salida Centro" (pe ore),
        // actualizăm durata "Ausencias justificada" cu durata reală din "Salida Sin Regreso"
        const ausenciaActual = ausencia[0];
        const ausenciaAsociadaData = ausenciaAsociada[0];

        const tipoActual = (ausenciaActual.TIPO || '').toLowerCase();
        const tipoAsociada = (ausenciaAsociadaData.TIPO || '').toLowerCase();
        const unidadActual = (
          ausenciaActual.UNIDAD_DURACION || 'dias'
        ).toLowerCase();
        const unidadAsociada = (
          ausenciaAsociadaData.UNIDAD_DURACION || 'dias'
        ).toLowerCase();
        const duracionAsociada = ausenciaAsociadaData.DURACION || null;

        // Log pentru debugging
        this.logger.log(
          `🔍 [asociarAusencia] Verificando actualización de duración:`,
          {
            ausenciaId,
            ausenciaAsociadaId,
            tipoActual,
            tipoAsociada,
            unidadActual,
            unidadAsociada,
            duracionAsociada,
          },
        );

        // Verifică dacă este "Ausencias justificada" sau "Ausencia Justificada" (singular sau plural)
        const esAusenciaJustificada =
          (tipoActual.includes('ausencia') &&
            tipoActual.includes('justificada')) ||
          tipoActual === 'ausencias justificada' ||
          tipoActual === 'ausencia justificada';

        // Verifică dacă este "Salida Sin Regreso" sau "Salida Centro"
        const esSalidaSinRegreso =
          tipoAsociada.includes('salida sin regreso') ||
          tipoAsociada.includes('salida centro');

        // Pentru "Salida Sin Regreso/Centro", durata este de obicei în format TIME (HH:MM:SS)
        // Dacă UNIDAD_DURACION este NULL sau altceva, dar durata este în format TIME, considerăm că este pe ore
        const duracionEsTime =
          typeof duracionAsociada === 'string' &&
          duracionAsociada.includes(':') &&
          duracionAsociada.match(/^\d{1,2}:\d{2}:\d{2}$/);

        const esPeOre =
          unidadAsociada === 'horas' ||
          unidadAsociada === 'hora' ||
          duracionEsTime ||
          (esSalidaSinRegreso && duracionAsociada); // Dacă este "Salida Sin Regreso" și are durată, considerăm că este pe ore

        // Dacă "Ausencias justificada" (pe zile) se asociază cu "Salida Sin Regreso/Centro" (pe ore)
        if (
          esAusenciaJustificada &&
          esSalidaSinRegreso &&
          esPeOre &&
          duracionAsociada
        ) {
          // Normalizează durata: dacă este TIME object sau string, convertim la format HH:MM:SS
          let duracionNormalizada = duracionAsociada;
          if (
            typeof duracionAsociada === 'object' &&
            duracionAsociada !== null
          ) {
            // Dacă este TIME object din MySQL, convertim la string
            if (duracionAsociada.hours !== undefined) {
              const h = String(duracionAsociada.hours || 0).padStart(2, '0');
              const m = String(duracionAsociada.minutes || 0).padStart(2, '0');
              const s = String(duracionAsociada.seconds || 0).padStart(2, '0');
              duracionNormalizada = `${h}:${m}:${s}`;
            }
          } else if (typeof duracionAsociada === 'string') {
            // Dacă este deja string, verificăm formatul
            if (!duracionAsociada.includes(':')) {
              // Dacă este număr (ore), convertim la format HH:MM:SS
              const horas = parseFloat(duracionAsociada);
              if (!isNaN(horas)) {
                const h = Math.floor(horas);
                const m = Math.floor((horas - h) * 60);
                const s = Math.floor(((horas - h) * 60 - m) * 60);
                duracionNormalizada = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
              }
            }
          }

          // Actualizează durata "Ausencias justificada" cu durata reală din "Salida Sin Regreso"
          const updateQueryConDuracion = `
            UPDATE Ausencias
            SET ausencia_asociada_id = ${ausenciaAsociadaId},
                DURACION = ${this.escapeSql(duracionNormalizada)},
                UNIDAD_DURACION = 'horas'
            WHERE id = ${ausenciaId}
          `;

          await this.prisma.$executeRawUnsafe(updateQueryConDuracion);

          this.logger.log(
            `✅ Ausencia ${ausenciaId} asociada con ${ausenciaAsociadaId} y duración actualizada a ${duracionNormalizada} (horas)`,
          );

          return {
            success: true,
            message: `Ausencia asociada correctamente. Duración actualizada a ${duracionNormalizada} (horas).`,
          };
        } else {
          // Log pentru debugging dacă nu se actualizează
          this.logger.log(`⚠️ [asociarAusencia] No se actualiza duración:`, {
            esAusenciaJustificada,
            esSalidaSinRegreso,
            unidadAsociada,
            tieneDuracion: !!duracionAsociada,
          });
        }
      }

      // Actualizează doar ausencia_asociada_id (fără modificare de durată)
      const updateQuery = `
        UPDATE Ausencias
        SET ausencia_asociada_id = ${ausenciaAsociadaId === null ? 'NULL' : ausenciaAsociadaId}
        WHERE id = ${ausenciaId}
      `;

      await this.prisma.$executeRawUnsafe(updateQuery);

      const message =
        ausenciaAsociadaId === null
          ? 'Ausencia desasociada correctamente'
          : 'Ausencia asociada correctamente';

      this.logger.log(
        `✅ Ausencia ${ausenciaId} ${ausenciaAsociadaId === null ? 'desasociada' : `asociada con ${ausenciaAsociadaId}`}`,
      );

      return { success: true, message };
    } catch (error: any) {
      this.logger.error('❌ Error asociando ausencia:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al asociar ausencia: ${error.message}`,
      );
    }
  }
}
