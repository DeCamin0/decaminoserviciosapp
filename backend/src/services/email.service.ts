import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

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

    if (!smtpHost || !smtpUser || !smtpPassword) {
      this.logger.warn(
        '⚠️ SMTP configuration not found. Email sending will be disabled.',
      );
      this.logger.warn(
        '⚠️ Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in .env',
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
      'De Camino Servicios Auxiliares SL <info@decaminoservicios.com>';

    const mailOptions = {
      from: fromEmail,
      to: to,
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
      const info = await this.transporter.sendMail(mailOptions);
      const bccList = options?.bcc?.join(', ') || 'none';
      this.logger.log(`✅ Email sent successfully:`);
      this.logger.log(`   TO: ${to}`);
      this.logger.log(`   BCC: ${bccList}`);
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
      'DE CAMINO Servicios Auxiliares SL <info@decaminoservicios.com>';

    const mailOptions = {
      from: fromEmail,
      to: to,
      bcc: options?.bcc || [],
      subject: subject,
      html: html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      const bccList = options?.bcc?.join(', ') || 'none';
      this.logger.log(`✅ Email sent successfully:`);
      this.logger.log(`   TO: ${to}`);
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
}
