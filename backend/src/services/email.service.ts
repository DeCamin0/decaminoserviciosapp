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

    // Creează transporter separat pentru pedidos
    // Preferă SMTP_PEDIDOS_HOST/PORT/SECURE (permite Client 2 doar pedidos fără SMTP general)
    const smtpHost =
      this.configService.get<string>('SMTP_PEDIDOS_HOST') ||
      this.configService.get<string>('SMTP_HOST');
    const smtpPort =
      this.configService.get<number>('SMTP_PEDIDOS_PORT') ||
      this.configService.get<number>('SMTP_PORT') ||
      587;
    const smtpSecure =
      (this.configService.get<string>('SMTP_PEDIDOS_SECURE') ||
        this.configService.get<string>('SMTP_SECURE')) === 'true';

    if (!smtpHost) {
      throw new Error(
        'SMTP (SMTP_PEDIDOS_HOST sau SMTP_HOST) not configured. Cannot create pedidos transporter.',
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
   * BCC din env-ul clientului activ (EMAIL_BCC sau COMPANY_EMAIL_BCC via company config).
   * Fără fallback la process.env — evită scurgerea BCC Decamino când HERA rulează cu .env.client2.
   */
  getDefaultBcc(): string[] {
    const emailBcc = this.configService.get<string>('EMAIL_BCC');
    let list: string[] = [];
    if (emailBcc) {
      list = emailBcc
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
    } else {
      const company = this.configService.get<{ emailBcc?: string }>('company');
      const companyBcc = company?.emailBcc?.trim() || '';
      list = companyBcc
        ? companyBcc
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean)
        : [];
    }
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of list) {
      const n = this.normalizeEmailAddress(raw);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(raw.trim());
    }
    return out;
  }

  /** Pentru comparare TO vs BCC (inclusiv format "Name <addr@x.com>"). */
  private normalizeEmailAddress(addr: string): string {
    const s = (addr || '').trim();
    const m = s.match(/<([^>]+)>/);
    const raw = (m ? m[1] : s).trim();
    return raw.toLowerCase();
  }

  /**
   * Elimină din BCC adresele care coincid cu destinatarul TO.
   * Dacă nu, unii servere SMTP / clienți livrează două mesaje identice aceluiași inbox.
   */
  excludeBccOverlappingTo(to: string, bcc: string[]): string[] {
    if (!bcc?.length) return [];
    const toNorm = this.normalizeEmailAddress(to);
    return bcc.filter((b) => this.normalizeEmailAddress(b) !== toNorm);
  }

  /**
   * Returnează adresa "From" default pentru email-uri
   * Backward compatible: dacă COMPANY_NAME sau COMPANY_EMAIL lipsesc, folosește valorile vechi
   */
  getDefaultFromEmail(): string {
    const company = this.configService.get<{
      emailFromName?: string;
      email?: string;
    }>('company');
    const companyName =
      company?.emailFromName ||
      this.configService.get<string>('COMPANY_NAME') ||
      process.env.COMPANY_EMAIL_FROM_NAME ||
      process.env.COMPANY_LEGAL_NAME_SHORT ||
      '';
    const companyEmail =
      company?.email ||
      this.configService.get<string>('COMPANY_EMAIL') ||
      process.env.COMPANY_EMAIL ||
      '';
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
