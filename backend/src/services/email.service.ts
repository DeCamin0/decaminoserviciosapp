import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private pedidosTransporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  /**
   * Inițializează transporter-ul nodemailer cu configurația SMTP
   */
  private initializeTransporter() {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT') || 587;
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD');
    const smtpSecure = this.configService.get<string>('SMTP_SECURE') === 'true';

    // Logging detaliat pentru debugging
    this.logger.log('🔍 Checking SMTP configuration...');
    this.logger.log(`   SMTP_HOST: ${smtpHost ? '✅ Set' : '❌ MISSING'}`);
    this.logger.log(
      `   SMTP_PORT: ${smtpPort || '❌ MISSING (using default 587)'}`,
    );
    this.logger.log(`   SMTP_USER: ${smtpUser ? '✅ Set' : '❌ MISSING'}`);
    this.logger.log(
      `   SMTP_PASSWORD: ${smtpPassword ? '✅ Set (hidden)' : '❌ MISSING'}`,
    );
    this.logger.log(`   SMTP_SECURE: ${smtpSecure}`);

    if (!smtpHost || !smtpUser || !smtpPassword) {
      this.logger.warn(
        '⚠️ SMTP configuration not found. Email sending will be disabled.',
      );
      this.logger.warn(
        '⚠️ Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in .env',
      );
      this.logger.warn(
        `⚠️ Missing variables: ${!smtpHost ? 'SMTP_HOST ' : ''}${!smtpUser ? 'SMTP_USER ' : ''}${!smtpPassword ? 'SMTP_PASSWORD' : ''}`,
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true pentru 465, false pentru alte porturi
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    this.logger.log('✅ SMTP transporter initialized');
  }

  /**
   * Trimite email cu attachment (PDF)
   */
  async sendEmailWithAttachment(
    to: string,
    subject: string,
    html: string,
    pdfBuffer: Buffer,
    pdfFileName: string,
    options?: {
      from?: string;
      cc?: string[];
      bcc?: string[];
    },
  ): Promise<void> {
    if (!this.transporter) {
      throw new Error(
        'SMTP transporter not initialized. Check SMTP configuration.',
      );
    }

    const fromEmail =
      options?.from ||
      this.configService.get<string>('SMTP_FROM') ||
      this.getDefaultFromEmail();

    const mailOptions = {
      from: fromEmail,
      to: to,
      cc: options?.cc || [],
      bcc: options?.bcc || [],
      subject: subject,
      html: html,
      attachments: [
        {
          filename: pdfFileName,
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
          encoding: 'base64',
        },
      ],
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      const ccList = options?.cc?.join(', ') || 'none';
      const bccList = options?.bcc?.join(', ') || 'none';
      this.logger.log(`✅ Email sent successfully:`);
      this.logger.log(`   TO: ${to}`);
      this.logger.log(`   CC: ${ccList}`);
      this.logger.log(`   BCC: ${bccList}`);
      this.logger.log(`   MessageId: ${info.messageId}`);
    } catch (error: any) {
      this.logger.error(`❌ Error sending email to ${to}:`, error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Trimite email cu multiple attachments
   */
  async sendEmailWithAttachments(
    to: string,
    subject: string,
    html: string,
    attachments: Array<{
      filename: string;
      content: Buffer;
      contentType?: string;
    }>,
    options?: {
      from?: string;
      cc?: string[];
      bcc?: string[];
    },
  ): Promise<void> {
    if (!this.transporter) {
      throw new Error(
        'SMTP transporter not initialized. Check SMTP configuration.',
      );
    }

    const fromEmail =
      options?.from ||
      this.configService.get<string>('SMTP_FROM') ||
      this.getDefaultFromEmail();

    const mailOptions = {
      from: fromEmail,
      to: to,
      cc: options?.cc || [],
      bcc: options?.bcc || [],
      subject: subject,
      html: html,
      attachments: attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType || 'application/octet-stream',
      })),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      const ccList = options?.cc?.join(', ') || 'none';
      const bccList = options?.bcc?.join(', ') || 'none';
      this.logger.log(
        `✅ Email sent successfully with ${attachments.length} attachments:`,
      );
      this.logger.log(`   TO: ${to}`);
      this.logger.log(`   CC: ${ccList}`);
      this.logger.log(`   BCC: ${bccList}`);
      this.logger.log(
        `   Attachments: ${attachments.map((a) => a.filename).join(', ')}`,
      );
      this.logger.log(`   MessageId: ${info.messageId}`);
    } catch (error: any) {
      this.logger.error(`❌ Error sending email to ${to}:`, error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Trimite email simplu (fără attachment)
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    options?: {
      from?: string;
      cc?: string[];
      bcc?: string[];
    },
  ): Promise<void> {
    if (!this.transporter) {
      throw new Error(
        'SMTP transporter not initialized. Check SMTP configuration.',
      );
    }

    const fromEmail =
      options?.from ||
      this.configService.get<string>('SMTP_FROM') ||
      this.getDefaultFromEmail();

    const mailOptions = {
      from: fromEmail,
      to: to,
      cc: options?.cc || [],
      bcc: options?.bcc || [],
      subject: subject,
      html: html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      const ccList = options?.cc?.join(', ') || 'none';
      const bccList = options?.bcc?.join(', ') || 'none';
      this.logger.log(`✅ Email sent successfully:`);
      this.logger.log(`   TO: ${to}`);
      this.logger.log(`   CC: ${ccList}`);
      this.logger.log(`   BCC: ${bccList}`);
      this.logger.log(`   MessageId: ${info.messageId}`);
    } catch (error: any) {
      this.logger.error(`❌ Error sending email to ${to}:`, error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Verifică dacă SMTP este configurat
   */
  isConfigured(): boolean {
    return this.transporter !== null;
  }

  /**
   * Returnează transporter-ul pentru pedidos
   * Dacă SMTP_PEDIDOS_USER și SMTP_PEDIDOS_PASSWORD sunt setate, creează transporter separat
   * Altfel, folosește transporter-ul principal (backward compatible)
   */
  private getPedidosTransporter(): nodemailer.Transporter {
    // Dacă deja există, returnează-l
    if (this.pedidosTransporter) {
      return this.pedidosTransporter;
    }

    const pedidosUser = this.configService.get<string>('SMTP_PEDIDOS_USER');
    const pedidosPassword = this.configService.get<string>(
      'SMTP_PEDIDOS_PASSWORD',
    );

    // Dacă nu sunt setate variabilele pedidos, folosește transporter-ul principal
    if (!pedidosUser || !pedidosPassword) {
      if (!this.transporter) {
        throw new Error(
          'SMTP transporter not initialized. Check SMTP configuration.',
        );
      }
      this.logger.log(
        '📧 Using main SMTP transporter for pedidos (SMTP_PEDIDOS_* not configured)',
      );
      return this.transporter;
    }

    // Creează transporter separat pentru pedidos (folosește același host/port/secure)
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT') || 587;
    const smtpSecure = this.configService.get<string>('SMTP_SECURE') === 'true';

    if (!smtpHost) {
      throw new Error(
        'SMTP_HOST not configured. Cannot create pedidos transporter.',
      );
    }

    this.pedidosTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: pedidosUser,
        pass: pedidosPassword,
      },
    });

    this.logger.log('✅ SMTP pedidos transporter initialized');
    this.logger.log(`   SMTP_PEDIDOS_USER: ${pedidosUser}`);
    return this.pedidosTransporter;
  }

  /**
   * Returnează adresa "From" pentru pedidos
   * Backward compatible: dacă SMTP_PEDIDOS_FROM lipsește, folosește SMTP_FROM sau default
   */
  private getPedidosFromEmail(): string {
    const pedidosFrom = this.configService.get<string>('SMTP_PEDIDOS_FROM');
    if (pedidosFrom) {
      return pedidosFrom;
    }
    // Fallback la SMTP_FROM sau default
    return (
      this.configService.get<string>('SMTP_FROM') || this.getDefaultFromEmail()
    );
  }

  /**
   * Returnează adresele BCC default din env var
   * Backward compatible: dacă EMAIL_BCC lipsește, folosește valorile vechi
   */
  getDefaultBcc(): string[] {
    const emailBcc = this.configService.get<string>('EMAIL_BCC');
    if (emailBcc) {
      // Suportă multiple adrese separate prin virgulă
      return emailBcc
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
    }
    // Backward compatible: folosește valorile vechi dacă env var lipsește
    return ['decamino.rrhh@gmail.com'];
  }

  /**
   * Returnează adresa "From" default pentru email-uri
   * Backward compatible: dacă COMPANY_NAME sau COMPANY_EMAIL lipsesc, folosește valorile vechi
   */
  getDefaultFromEmail(): string {
    const companyName =
      this.configService.get<string>('COMPANY_NAME') ||
      'DE CAMINO Servicios Auxiliares SL';
    const companyEmail =
      this.configService.get<string>('COMPANY_EMAIL') ||
      'info@decaminoservicios.com';
    return `${companyName} <${companyEmail}>`;
  }

  /**
   * Trimite email cu attachment pentru pedidos
   * Folosește transporter-ul pedidos (dacă configurat) sau principal (backward compatible)
   */
  async sendEmailWithAttachmentForPedidos(
    to: string,
    subject: string,
    html: string,
    pdfBuffer: Buffer,
    pdfFileName: string,
    options?: {
      cc?: string[];
      bcc?: string[];
    },
  ): Promise<void> {
    const transporter = this.getPedidosTransporter();
    const fromEmail = this.getPedidosFromEmail();

    const mailOptions = {
      from: fromEmail,
      to: to,
      cc: options?.cc || [],
      bcc: options?.bcc || [],
      subject: subject,
      html: html,
      attachments: [
        {
          filename: pdfFileName,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      const ccList = options?.cc?.join(', ') || 'none';
      const bccList = options?.bcc?.join(', ') || 'none';
      this.logger.log(`✅ Email pedidos sent successfully:`);
      this.logger.log(`   FROM: ${fromEmail}`);
      this.logger.log(`   TO: ${to}`);
      this.logger.log(`   CC: ${ccList}`);
      this.logger.log(`   BCC: ${bccList}`);
      this.logger.log(`   MessageId: ${info.messageId}`);
    } catch (error: any) {
      this.logger.error(`❌ Error sending pedidos email to ${to}:`, error);
      throw new Error(`Failed to send pedidos email: ${error.message}`);
    }
  }

  /**
   * Trimite email simplu pentru pedidos
   * Folosește transporter-ul pedidos (dacă configurat) sau principal (backward compatible)
   */
  async sendEmailForPedidos(
    to: string,
    subject: string,
    html: string,
    options?: {
      cc?: string[];
      bcc?: string[];
    },
  ): Promise<void> {
    const transporter = this.getPedidosTransporter();
    const fromEmail = this.getPedidosFromEmail();

    const mailOptions = {
      from: fromEmail,
      to: to,
      cc: options?.cc || [],
      bcc: options?.bcc || [],
      subject: subject,
      html: html,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      const ccList = options?.cc?.join(', ') || 'none';
      const bccList = options?.bcc?.join(', ') || 'none';
      this.logger.log(`✅ Email pedidos sent successfully:`);
      this.logger.log(`   FROM: ${fromEmail}`);
      this.logger.log(`   TO: ${to}`);
      this.logger.log(`   CC: ${ccList}`);
      this.logger.log(`   BCC: ${bccList}`);
      this.logger.log(`   MessageId: ${info.messageId}`);
    } catch (error: any) {
      this.logger.error(`❌ Error sending pedidos email to ${to}:`, error);
      throw new Error(`Failed to send pedidos email: ${error.message}`);
    }
  }
}
