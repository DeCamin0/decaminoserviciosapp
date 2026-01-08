import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { EmailService } from './email.service';
import { SentEmailsService } from './sent-emails.service';
import { NotificationsService } from './notifications.service';
import { EmpleadosService } from './empleados.service';

@Injectable()
export class SolicitudesService {
  private readonly logger = new Logger(SolicitudesService.name);
  private readonly EMAIL_RECIPIENT = 'solicitudes@decaminoservicios.com';

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly emailService: EmailService,
    private readonly sentEmailsService: SentEmailsService,
    private readonly notificationsService: NotificationsService,
    private readonly empleadosService: EmpleadosService,
  ) {}

  /**
   * Formatează mesajul pentru email (HTML) din datele solicitării
   */
  private formatSolicitudEmailHtml(solicitudData: {
    codigo: string;
    nombre: string;
    tipo: string;
    fecha: string;
    estado: string;
    motivo?: string;
    accion: 'create' | 'update' | 'delete';
    tipoAnterior?: string;
    tipoNuevo?: string;
  }): { subject: string; html: string } {
    const actionEmoji =
      solicitudData.accion === 'create'
        ? '🟢'
        : solicitudData.accion === 'update'
          ? '🔵'
          : '🔴';
    // Mesaj special pentru conversia tipului de ausencia
    let actionText = '';
    if (solicitudData.accion === 'create') {
      actionText = 'Nueva solicitud creada';
    } else if (
      solicitudData.accion === 'update' &&
      solicitudData.tipoAnterior &&
      solicitudData.tipoNuevo
    ) {
      actionText = 'Ausencia convertida';
    } else if (solicitudData.accion === 'update') {
      actionText = 'Solicitud actualizada';
    } else {
      actionText = 'Solicitud eliminada';
    }

    const subject = `${actionEmoji} ${actionText} - ${solicitudData.nombre} (${solicitudData.codigo})`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background-color: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
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
    <span class="value">${solicitudData.nombre} (${solicitudData.codigo})</span>
  </div>
  
  <div class="info-row">
    <span class="label">📋 Tipo:</span>
    <span class="value">${solicitudData.tipo}</span>
  </div>
  
  ${
    solicitudData.tipoAnterior && solicitudData.tipoNuevo
      ? `
  <div class="info-row" style="background-color: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; border-radius: 4px; margin: 15px 0;">
    <span class="label" style="color: #856404; font-weight: bold;">🔄 Cambio de tipo:</span>
    <span class="value" style="color: #856404;">
      De "${solicitudData.tipoAnterior}" a "${solicitudData.tipoNuevo}"
    </span>
  </div>
  `
      : ''
  }
  
  <div class="info-row">
    <span class="label">📆 Fecha:</span>
    <span class="value">${solicitudData.fecha}</span>
  </div>
  
  <div class="info-row">
    <span class="label">✅ Estado:</span>
    <span class="value">${solicitudData.estado}</span>
  </div>
  
  ${
    solicitudData.motivo
      ? `
  <div class="info-row">
    <span class="label">📝 Motivo:</span>
    <span class="value">${solicitudData.motivo}</span>
  </div>
  `
      : ''
  }
  
  ${
    solicitudData.tipo === 'Vacaciones' || solicitudData.tipo === 'Vacación'
      ? `
  <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
  <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
    <h3 style="margin-top: 0; color: #856404; font-size: 14px; font-weight: bold;">ℹ️ Información importante sobre vacaciones:</h3>
    <div style="color: #856404; font-size: 12px; line-height: 1.8;">
      <p style="margin: 8px 0;">Las vacaciones deberán solicitarse e iniciarse exclusivamente en días laborables según el turno de trabajo asignado.</p>
      <p style="margin: 8px 0;">No podrán iniciarse en días de descanso semanal ni días no laborables.</p>
      <p style="margin: 8px 0; font-weight: bold;">Las solicitudes de vacaciones deberán presentarse con un mínimo de dos meses de antelación.</p>
      <p style="margin: 8px 0;">En caso contrario, la empresa podrá ajustar las fechas solicitadas en función de las necesidades organizativas, adecuando el inicio al primer día laborable disponible.</p>
      <p style="margin: 8px 0;">Dicha adaptación no supondrá en ningún caso la reducción del número total de días de vacaciones del trabajador.</p>
    </div>
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
   * Trimite email către angajat când i se schimbă solicitarea
   */
  private async sendSolicitudEmailToEmpleado(solicitudData: {
    codigo: string;
    nombre: string;
    tipo: string;
    fecha: string;
    estado: string;
    motivo?: string;
    accion: 'create' | 'update' | 'delete';
    email?: string;
    tipoAnterior?: string;
    tipoNuevo?: string;
  }): Promise<void> {
    this.logger.log(
      `📧 [sendSolicitudEmailToEmpleado] Called for ${solicitudData.accion} - solicitud: ${solicitudData.codigo}`,
    );

    if (!this.emailService.isConfigured()) {
      this.logger.warn(
        `⚠️ [sendSolicitudEmailToEmpleado] Email service not configured. Email notification not sent to empleado for ${solicitudData.accion} - solicitud: ${solicitudData.codigo}`,
      );
      return;
    }

    // Obține email-ul angajatului
    let empleadoEmail = solicitudData.email;
    if (!empleadoEmail && solicitudData.codigo) {
      try {
        const empleado = await this.empleadosService.getEmpleadoByCodigo(
          solicitudData.codigo,
        );
        empleadoEmail =
          empleado?.['CORREO ELECTRONICO'] ||
          empleado?.CORREO_ELECTRONICO ||
          null;
      } catch (error: any) {
        this.logger.warn(
          `⚠️ [sendSolicitudEmailToEmpleado] Could not fetch empleado email for ${solicitudData.codigo}: ${error.message}`,
        );
      }
    }

    if (!empleadoEmail || empleadoEmail.trim() === '') {
      this.logger.warn(
        `⚠️ [sendSolicitudEmailToEmpleado] No email found for empleado ${solicitudData.codigo}, skipping email notification`,
      );
      return;
    }

    // Definește variabilele înainte de try pentru a fi disponibile în catch
    let subject = '';
    let html = '';

    try {
      const emailData = this.formatSolicitudEmailHtml(solicitudData);
      subject = emailData.subject;
      html = emailData.html;

      this.logger.log(
        `📧 [sendSolicitudEmailToEmpleado] Sending email to empleado ${empleadoEmail} for ${solicitudData.accion} - subject: ${subject}`,
      );
      await this.emailService.sendEmail(empleadoEmail, subject, html);
      this.logger.log(
        `✅ [sendSolicitudEmailToEmpleado] Email notification sent to ${empleadoEmail} for ${solicitudData.accion} - solicitud ${solicitudData.codigo}`,
      );

      // Salvează email-ul în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: 'system',
          recipientType: 'empleado',
          recipientId: solicitudData.codigo,
          recipientEmail: empleadoEmail,
          recipientName: solicitudData.nombre,
          subject,
          message: html,
          status: 'sent',
        });
      } catch (saveError: any) {
        this.logger.warn(
          `⚠️ [sendSolicitudEmailToEmpleado] Eroare la salvarea email-ului în BD: ${saveError.message}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `❌ [sendSolicitudEmailToEmpleado] Error sending email notification to empleado for ${solicitudData.accion} (non-blocking): ${error.message}`,
      );

      // Salvează și email-urile eșuate în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: 'system',
          recipientType: 'empleado',
          recipientId: solicitudData.codigo,
          recipientEmail: empleadoEmail,
          recipientName: solicitudData.nombre,
          subject:
            subject ||
            `Solicitud ${solicitudData.accion} - ${solicitudData.codigo}`,
          message: html || '',
          status: 'failed',
          errorMessage: error.message || String(error),
        });
      } catch (saveError: any) {
        this.logger.warn(
          `⚠️ [sendSolicitudEmailToEmpleado] Eroare la salvarea email-ului eșuat în BD: ${saveError.message}`,
        );
      }

      // Nu aruncăm eroarea pentru a nu opri flow-ul principal
    }
  }

  /**
   * Trimite email pentru notificare solicitare (către gestoria)
   */
  private async sendSolicitudEmail(solicitudData: {
    codigo: string;
    nombre: string;
    tipo: string;
    fecha: string;
    estado: string;
    motivo?: string;
    accion: 'create' | 'update' | 'delete';
  }): Promise<void> {
    this.logger.log(
      `📧 [sendSolicitudEmail] Called for ${solicitudData.accion} - solicitud: ${solicitudData.codigo}`,
    );

    if (!this.emailService.isConfigured()) {
      this.logger.warn(
        `⚠️ [sendSolicitudEmail] Email service not configured. Email notification not sent for ${solicitudData.accion} - solicitud: ${solicitudData.codigo}`,
      );
      return;
    }

    // Definește variabilele înainte de try pentru a fi disponibile în catch
    let subject = '';
    let html = '';

    try {
      const emailData = this.formatSolicitudEmailHtml(solicitudData);
      subject = emailData.subject;
      html = emailData.html;

      this.logger.log(
        `📧 [sendSolicitudEmail] Sending email for ${solicitudData.accion} - subject: ${subject}`,
      );
      await this.emailService.sendEmail(this.EMAIL_RECIPIENT, subject, html, {
        bcc: ['decamino.rrhh@gmail.com'],
      });
      this.logger.log(
        `✅ [sendSolicitudEmail] Email notification sent to ${this.EMAIL_RECIPIENT} for ${solicitudData.accion} - solicitud ${solicitudData.codigo}`,
      );

      // Salvează email-ul în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: solicitudData.codigo || 'system',
          recipientType: 'gestoria',
          recipientEmail: this.EMAIL_RECIPIENT,
          recipientName: 'Solicitudes',
          subject,
          message: html,
          status: 'sent',
        });
      } catch (saveError: any) {
        this.logger.warn(
          `⚠️ [sendSolicitudEmail] Eroare la salvarea email-ului în BD: ${saveError.message}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `❌ [sendSolicitudEmail] Error sending email notification for ${solicitudData.accion} (non-blocking): ${error.message}`,
      );

      // Salvează și email-urile eșuate în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: solicitudData.codigo || 'system',
          recipientType: 'gestoria',
          recipientEmail: this.EMAIL_RECIPIENT,
          recipientName: 'Solicitudes',
          subject:
            subject ||
            `Solicitud ${solicitudData.accion} - ${solicitudData.codigo}`,
          message: html || '',
          status: 'failed',
          errorMessage: error.message || String(error),
        });
      } catch (saveError: any) {
        this.logger.warn(
          `⚠️ [sendSolicitudEmail] Eroare la salvarea email-ului eșuat în BD: ${saveError.message}`,
        );
      }

      // Nu aruncăm eroarea pentru a nu opri flow-ul principal
    }
  }

  private escapeSql(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    const str = String(value);
    const escaped = str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }

  /**
   * Obține lista de solicitări cu filtrare opțională
   * @param filters - Filtre pentru query (email, codigo, MES, TIPO, ESTADO, limit)
   * @returns Array de solicitări
   */
  async getSolicitudes(filters: {
    email?: string;
    codigo?: string;
    MES?: string;
    TIPO?: string;
    ESTADO?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      const conditions: string[] = [];

      // Filtrare pe email
      if (filters.email && filters.email.trim() !== '') {
        conditions.push(`email = ${this.escapeSql(filters.email.trim())}`);
      }

      // Filtrare pe codigo
      if (filters.codigo && filters.codigo.trim() !== '') {
        conditions.push(`codigo = ${this.escapeSql(filters.codigo.trim())}`);
      }

      // Filtrare pe tip (TIPO)
      if (filters.TIPO && filters.TIPO.trim() !== '') {
        conditions.push(`tipo = ${this.escapeSql(filters.TIPO.trim())}`);
      }

      // Filtrare pe status (ESTADO)
      if (filters.ESTADO && filters.ESTADO.trim() !== '') {
        conditions.push(`estado = ${this.escapeSql(filters.ESTADO.trim())}`);
      }

      // Filtrare pe lună (MES) - format: YYYY-MM
      if (filters.MES && filters.MES.trim() !== '') {
        const mesTrimmed = filters.MES.trim();

        // Verifică formatul MES (trebuie să fie YYYY-MM)
        if (!/^\d{4}-\d{2}$/.test(mesTrimmed)) {
          throw new BadRequestException(
            `Formato MES inválido. Debe ser YYYY-MM (ej: 2025-12)`,
          );
        }

        // Filtrare bazată pe fecha_inicio (DateTime) - verifică dacă începe în luna respectivă
        // Frontend-ul face filtrarea finală pentru suprapuneri (vezi filterSolicitudesByMonth)
        // Asta e mai simplu și mai performant
        conditions.push(
          `(fecha_inicio IS NOT NULL AND DATE_FORMAT(fecha_inicio, '%Y-%m') = ${this.escapeSql(mesTrimmed)})`,
        );
      }

      // Construiește query-ul SQL
      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // LIMIT cu validare
      let limitClause = '';
      if (filters.limit !== undefined) {
        const limitNum = Number(filters.limit);
        if (isNaN(limitNum) || limitNum < 1) {
          throw new BadRequestException(
            'El parámetro limit debe ser un número positivo',
          );
        }
        // Limitează la maximum 10000 pentru siguranță
        const safeLimit = Math.min(limitNum, 10000);
        limitClause = `LIMIT ${safeLimit}`;
      } else {
        // Default limit pentru a preveni query-uri prea mari
        limitClause = 'LIMIT 1000';
      }

      const query = `SELECT * FROM solicitudes ${whereClause} ORDER BY fecha_solicitud DESC ${limitClause}`;

      this.logger.log(
        `📝 Get solicitudes query: ${query.substring(0, 200)}... (filters: ${JSON.stringify(filters)})`,
      );

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(
        `✅ Solicitudes retrieved: ${rows.length} records (filters: ${JSON.stringify(filters)})`,
      );

      // Transformă datele pentru compatibilitate cu frontend
      return rows.map((row) => ({
        id: row.id || row.ID,
        codigo: row.codigo || row.CODIGO,
        nombre: row.nombre || row.NOMBRE,
        email: row.email || row.EMAIL || row.CORREO_ELECTRONICO,
        tipo: row.tipo || row.TIPO,
        estado: row.estado || row.ESTADO,
        fecha_inicio:
          row.fecha_inicio instanceof Date
            ? row.fecha_inicio.toISOString().split('T')[0]
            : row.fecha_inicio || row.FECHA_INICIO,
        fecha_fin: row.fecha_fin || row.FECHA_FIN,
        motivo: row.motivo || row.MOTIVO,
        fecha_solicitud:
          row.fecha_solicitud instanceof Date
            ? row.fecha_solicitud.toISOString().replace('T', ' ').split('.')[0]
            : row.fecha_solicitud || row.FECHA_SOLICITUD,
      }));
    } catch (error: any) {
      this.logger.error('❌ Error retrieving solicitudes:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener solicitudes: ${error.message}`,
      );
    }
  }

  /**
   * Creează o solicitare nouă
   * INSEREAZĂ în ambele tabele: solicitudes + Ausencias (dacă estado = 'Aprobada')
   */
  async createSolicitud(data: {
    id: string;
    email: string;
    codigo: string;
    nombre: string;
    tipo: string;
    estado: string;
    motivo?: string;
    fecha_inicio: string;
    fecha_fin: string;
    ip?: string; // IP pentru LOCACION în Ausencias
  }): Promise<any> {
    try {
      // Validează câmpurile obligatorii
      if (!data.id || !data.email || !data.codigo || !data.tipo) {
        throw new BadRequestException(
          'id, email, codigo și tipo sunt obligatorii',
        );
      }

      const estado = data.estado || 'Aprobada';
      const ip = data.ip || '';

      // Format fecha_inicio pentru MySQL (Date)
      let fechaInicioSQL = 'NULL';
      if (data.fecha_inicio) {
        const fechaInicioDate = new Date(data.fecha_inicio);
        if (!isNaN(fechaInicioDate.getTime())) {
          const fechaFormatted = fechaInicioDate.toISOString().split('T')[0];
          fechaInicioSQL = this.escapeSql(fechaFormatted);
        }
      }

      // Format fecha_fin (poate fi String sau Date)
      const fechaFinSQL = data.fecha_fin
        ? this.escapeSql(data.fecha_fin)
        : 'NULL';

      // Query 1: INSERT în solicitudes
      const insertSolicitudQuery = `
        INSERT INTO solicitudes (
          id, codigo, nombre, email, tipo, estado, fecha_inicio, fecha_fin, motivo, fecha_solicitud
        ) VALUES (
          ${this.escapeSql(data.id)},
          ${this.escapeSql(data.codigo)},
          ${this.escapeSql(data.nombre || '')},
          ${this.escapeSql(data.email)},
          ${this.escapeSql(data.tipo)},
          ${this.escapeSql(estado)},
          ${fechaInicioSQL},
          ${fechaFinSQL},
          ${data.motivo ? this.escapeSql(data.motivo) : 'NULL'},
          NOW()
        )
      `;

      this.logger.log(
        `📝 Create solicitud: ${data.id} (${data.tipo}), estado: ${estado}`,
      );

      // Execută operațiile în tranzacție
      await this.prisma.$transaction(async (tx) => {
        // 1) INSERT în solicitudes
        await tx.$executeRawUnsafe(insertSolicitudQuery);

        // 2) INSERT în Ausencias (doar dacă estado = 'Aprobada')
        if (estado === 'Aprobada') {
          const insertAusenciaQuery = `
            INSERT INTO Ausencias (
              solicitud_id, CODIGO, NOMBRE, TIPO, FECHA, HORA, LOCACION, MOTIVO, DURACION, created_at
            ) VALUES (
              ${this.escapeSql(data.id)},
              ${this.escapeSql(data.codigo)},
              ${this.escapeSql(data.nombre || '')},
              ${this.escapeSql(data.tipo)},
              CONCAT(${fechaInicioSQL}, ' - ', ${fechaFinSQL}),
              TIME_FORMAT(NOW(), '%H:%i:%s'),
              ${ip ? this.escapeSql(ip) : "''"},
              ${data.motivo ? this.escapeSql(data.motivo) : 'NULL'},
              TIMESTAMPDIFF(DAY, ${fechaInicioSQL}, ${fechaFinSQL}) + 1,
              NOW()
            )
          `;
          await tx.$executeRawUnsafe(insertAusenciaQuery);
        }
      });

      // Returnează solicitarea creată
      const created = await this.getSolicitudes({
        email: data.email,
        codigo: data.codigo,
        limit: 1,
      });

      // Trimite notificare pe Telegram și Email (complet async, nu așteptăm răspunsul)
      const solicitudNotificationData = {
        codigo: data.codigo,
        nombre: data.nombre,
        tipo: data.tipo,
        fecha:
          data.fecha_inicio && data.fecha_fin
            ? `${data.fecha_inicio} - ${data.fecha_fin}`
            : data.fecha_inicio || data.fecha_fin || 'N/A',
        estado: estado,
        motivo: data.motivo,
        accion: 'create' as const,
        email: data.email,
      };

      setImmediate(() => {
        // Telegram notification (către gestoria)
        this.telegramService
          .sendSolicitudNotification(solicitudNotificationData)
          .catch((telegramError: any) => {
            this.logger.warn(
              `⚠️ Error sending Telegram notification (non-blocking): ${telegramError.message}`,
            );
          });

        // Email notification către gestoria
        this.logger.log(
          `📧 [CREATE] Attempting to send email notification to gestoria - solicitud: ${solicitudNotificationData.codigo}, tipo: ${solicitudNotificationData.tipo}, accion: ${solicitudNotificationData.accion}`,
        );
        this.sendSolicitudEmail(solicitudNotificationData)
          .then(() => {
            this.logger.log(
              `✅ [CREATE] Email notification sent to gestoria successfully - solicitud: ${solicitudNotificationData.codigo}`,
            );
          })
          .catch((emailError: any) => {
            this.logger.error(
              `❌ [CREATE] Error sending email notification to gestoria (non-blocking): ${emailError.message}`,
            );
          });

        // Email notification către angajat
        this.logger.log(
          `📧 [CREATE] Attempting to send email notification to empleado - solicitud: ${solicitudNotificationData.codigo}`,
        );
        this.sendSolicitudEmailToEmpleado(solicitudNotificationData)
          .then(() => {
            this.logger.log(
              `✅ [CREATE] Email notification sent to empleado successfully - solicitud: ${solicitudNotificationData.codigo}`,
            );
          })
          .catch((emailError: any) => {
            this.logger.error(
              `❌ [CREATE] Error sending email notification to empleado (non-blocking): ${emailError.message}`,
            );
          });

        // Notificare în aplicație către angajat
        if (solicitudNotificationData.codigo) {
          this.logger.log(
            `📬 [CREATE] Attempting to send in-app notification to empleado - solicitud: ${solicitudNotificationData.codigo}`,
          );
          this.notificationsService
            .notifyUser('system', solicitudNotificationData.codigo, {
              type: 'success',
              title: 'Solicitud creada',
              message: `Tu solicitud de ${solicitudNotificationData.tipo} (${solicitudNotificationData.fecha}) ha sido creada. Estado: ${solicitudNotificationData.estado}`,
              data: {
                solicitudId: data.id,
                tipo: solicitudNotificationData.tipo,
                fecha: solicitudNotificationData.fecha,
                estado: solicitudNotificationData.estado,
                motivo: solicitudNotificationData.motivo,
              },
            })
            .then(() => {
              this.logger.log(
                `✅ [CREATE] In-app notification sent to empleado successfully - solicitud: ${solicitudNotificationData.codigo}`,
              );
            })
            .catch((notifError: any) => {
              this.logger.error(
                `❌ [CREATE] Error sending in-app notification to empleado (non-blocking): ${notifError.message}`,
              );
            });
        }
      });

      return {
        success: true,
        status: 'ok',
        solicitud_ok: 1,
        solicitud_id: data.id,
        ip_used: ip,
        solicitud: created[0] || null,
      };
    } catch (error: any) {
      this.logger.error('❌ Error creating solicitud:', error);
      // Prisma $transaction face automat rollback la eroare, nu e nevoie de manual rollback
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al crear solicitud: ${error.message}`,
      );
    }
  }

  /**
   * Actualizează o solicitare existentă
   * UPDATE în solicitudes + UPSERT/DELETE în Ausencias (după estado)
   */
  async updateSolicitud(
    id: string,
    data: {
      email?: string;
      codigo?: string;
      nombre?: string;
      tipo?: string;
      estado?: string;
      motivo?: string;
      fecha_inicio?: string;
      fecha_fin?: string;
      ip?: string; // IP pentru LOCACION în Ausencias
    },
  ): Promise<any> {
    try {
      if (!id) {
        throw new BadRequestException('id este obligatoriu pentru update');
      }

      // Obține solicitarea înainte de update pentru a verifica estado vechi
      // Folosim query direct pentru a obține solicitud-ul exact
      let solicitudBefore: any = null;
      try {
        const beforeQuery = `SELECT * FROM solicitudes WHERE id = ${this.escapeSql(id)} LIMIT 1`;
        const beforeResult = await this.prisma.$queryRawUnsafe(beforeQuery);
        solicitudBefore =
          Array.isArray(beforeResult) && beforeResult.length > 0
            ? beforeResult[0]
            : null;
      } catch (error: any) {
        this.logger.warn(
          `⚠️ [UPDATE] Error fetching solicitud before update: ${error.message}`,
        );
        // Fallback la metoda veche
        const beforeUpdate = await this.getSolicitudes({ limit: 1000 });
        solicitudBefore = beforeUpdate.find((s) => s.id === id);
      }

      const codigo = data.codigo || solicitudBefore?.codigo || '';

      this.logger.log(
        `🔍 [UPDATE] Solicitud before update - id: ${id}, tipo: ${solicitudBefore?.tipo || 'N/A'}, codigo: ${codigo}, found: ${!!solicitudBefore}`,
      );
      this.logger.log(
        `🔍 [UPDATE] Data update - tipo: ${data.tipo || 'N/A'}, codigo: ${data.codigo || 'N/A'}`,
      );

      // Construiește SET clause dinamic pentru solicitudes
      const updates: string[] = [];

      if (data.codigo !== undefined) {
        updates.push(`codigo = ${this.escapeSql(data.codigo)}`);
      }
      if (data.nombre !== undefined) {
        updates.push(`nombre = ${this.escapeSql(data.nombre)}`);
      }
      if (data.email !== undefined) {
        updates.push(`email = ${this.escapeSql(data.email)}`);
      }
      if (data.tipo !== undefined) {
        updates.push(`tipo = ${this.escapeSql(data.tipo)}`);
      }
      if (data.estado !== undefined) {
        updates.push(`estado = ${this.escapeSql(data.estado)}`);
      }
      if (data.motivo !== undefined) {
        updates.push(
          `motivo = ${data.motivo ? this.escapeSql(data.motivo) : 'NULL'}`,
        );
      }
      if (data.fecha_inicio !== undefined) {
        if (data.fecha_inicio) {
          const fechaInicioDate = new Date(data.fecha_inicio);
          if (!isNaN(fechaInicioDate.getTime())) {
            const fechaFormatted = fechaInicioDate.toISOString().split('T')[0];
            updates.push(`fecha_inicio = ${this.escapeSql(fechaFormatted)}`);
          }
        } else {
          updates.push('fecha_inicio = NULL');
        }
      }
      if (data.fecha_fin !== undefined) {
        updates.push(
          `fecha_fin = ${data.fecha_fin ? this.escapeSql(data.fecha_fin) : 'NULL'}`,
        );
      }

      // Actualizează fecha_solicitud doar dacă nu există (IFNULL)
      updates.push(`fecha_solicitud = IFNULL(fecha_solicitud, NOW())`);

      if (updates.length === 0) {
        throw new BadRequestException(
          'Nu s-au furnizat câmpuri pentru actualizare',
        );
      }

      const estado = data.estado || solicitudBefore?.estado || 'Aprobada';
      const ip = data.ip || '';
      const nombre = data.nombre || solicitudBefore?.nombre || '';
      const tipo = data.tipo || solicitudBefore?.tipo || '';
      const motivo =
        data.motivo !== undefined ? data.motivo : solicitudBefore?.motivo || '';

      // Obține fecha_inicio și fecha_fin (actualizate sau vechi)
      let fechaInicioSQL = 'NULL';
      if (data.fecha_inicio !== undefined) {
        if (data.fecha_inicio) {
          const fechaInicioDate = new Date(data.fecha_inicio);
          if (!isNaN(fechaInicioDate.getTime())) {
            const fechaFormatted = fechaInicioDate.toISOString().split('T')[0];
            fechaInicioSQL = this.escapeSql(fechaFormatted);
          }
        }
      } else if (solicitudBefore?.fecha_inicio) {
        const fechaInicioDate = new Date(solicitudBefore.fecha_inicio);
        if (!isNaN(fechaInicioDate.getTime())) {
          const fechaFormatted = fechaInicioDate.toISOString().split('T')[0];
          fechaInicioSQL = this.escapeSql(fechaFormatted);
        }
      }

      let fechaFinSQL = 'NULL';
      if (data.fecha_fin !== undefined) {
        fechaFinSQL = data.fecha_fin ? this.escapeSql(data.fecha_fin) : 'NULL';
      } else if (solicitudBefore?.fecha_fin) {
        fechaFinSQL = this.escapeSql(solicitudBefore.fecha_fin);
      }

      // Query 1: UPDATE în solicitudes
      const updateSolicitudQuery = `
        UPDATE solicitudes
        SET ${updates.join(', ')}
        WHERE id = ${this.escapeSql(id)}
          AND codigo = ${this.escapeSql(codigo)}
      `;

      this.logger.log(`📝 Update solicitud: ${id}, estado: ${estado}`);

      // Execută operațiile în tranzacție
      await this.prisma.$transaction(async (tx) => {
        // 1) UPDATE în solicitudes
        await tx.$executeRawUnsafe(updateSolicitudQuery);

        // 2) UPSERT sau DELETE în Ausencias
        if (estado === 'Aprobada') {
          // UPSERT în Ausencias
          const upsertAusenciaQuery = `
            INSERT INTO Ausencias (
              solicitud_id, CODIGO, NOMBRE, TIPO, FECHA, HORA, LOCACION, MOTIVO, DURACION, created_at
            )
            SELECT
              ${this.escapeSql(id)},
              ${this.escapeSql(codigo)},
              ${this.escapeSql(nombre)},
              ${this.escapeSql(tipo)},
              CONCAT(${fechaInicioSQL}, ' - ', ${fechaFinSQL}) AS FECHA,
              TIME_FORMAT(NOW(), '%H:%i:%s') AS HORA,
              ${ip ? this.escapeSql(ip) : "''"} AS LOCACION,
              ${motivo ? this.escapeSql(motivo) : 'NULL'} AS MOTIVO,
              TIMESTAMPDIFF(DAY, ${fechaInicioSQL}, ${fechaFinSQL}) + 1 AS DURACION,
              NOW()
            FROM DUAL
            WHERE ${this.escapeSql(estado)} = 'Aprobada'
            ON DUPLICATE KEY UPDATE
              NOMBRE   = VALUES(NOMBRE),
              TIPO     = VALUES(TIPO),
              FECHA    = VALUES(FECHA),
              HORA     = VALUES(HORA),
              LOCACION = VALUES(LOCACION),
              MOTIVO   = VALUES(MOTIVO),
              DURACION = VALUES(DURACION)
          `;
          await tx.$executeRawUnsafe(upsertAusenciaQuery);
        } else {
          // DELETE din Ausencias (dacă estado != 'Aprobada')
          const deleteAusenciaQuery = `
            DELETE FROM Ausencias
            WHERE solicitud_id = ${this.escapeSql(id)}
              AND CODIGO = ${this.escapeSql(codigo)}
          `;
          await tx.$executeRawUnsafe(deleteAusenciaQuery);
        }
      });

      // Verifică dacă s-a actualizat ceva - folosim query direct
      let solicitud: any = null;
      try {
        const afterQuery = `SELECT * FROM solicitudes WHERE id = ${this.escapeSql(id)} LIMIT 1`;
        const afterResult = await this.prisma.$queryRawUnsafe(afterQuery);
        solicitud =
          Array.isArray(afterResult) && afterResult.length > 0
            ? afterResult[0]
            : null;
      } catch (error: any) {
        this.logger.warn(
          `⚠️ [UPDATE] Error fetching solicitud after update: ${error.message}`,
        );
        // Fallback la metoda veche
        const updated = await this.getSolicitudes({ limit: 1000 });
        solicitud = updated.find((s) => s.id === id);
      }

      this.logger.log(
        `🔍 [UPDATE] Solicitud after update - found: ${!!solicitud}, id: ${id}, tipo: ${solicitud?.tipo || 'N/A'}`,
      );

      // Trimite notificare pe Telegram și Email pentru update (complet async, nu așteptăm răspunsul)
      if (solicitud) {
        // Detectează dacă s-a schimbat tipul între "Ausencias justificada" și "Ausencia Injustificada"
        const tipoAnterior = (solicitudBefore?.tipo || '').trim();
        const tipoNuevo = (solicitud.tipo || tipo || '').trim();
        const esCambioTipoAusencia =
          (tipoAnterior === 'Ausencias justificada' &&
            tipoNuevo === 'Ausencia Injustificada') ||
          (tipoAnterior === 'Ausencia Injustificada' &&
            tipoNuevo === 'Ausencias justificada');

        this.logger.log(
          `🔍 [UPDATE] Detección cambio tipo - tipoAnterior: "${tipoAnterior}", tipoNuevo: "${tipoNuevo}", esCambio: ${esCambioTipoAusencia}`,
        );

        const solicitudNotificationData = {
          codigo: solicitud.codigo || codigo || '',
          nombre: solicitud.nombre || nombre || '',
          tipo: solicitud.tipo || tipo || '',
          fecha:
            solicitud.fecha_inicio && solicitud.fecha_fin
              ? `${solicitud.fecha_inicio} - ${solicitud.fecha_fin}`
              : solicitud.fecha_inicio || solicitud.fecha_fin || 'N/A',
          estado: solicitud.estado || estado || '',
          motivo: solicitud.motivo || motivo || '',
          accion: 'update' as const,
          email: solicitud.email || data.email,
          tipoAnterior: esCambioTipoAusencia ? tipoAnterior : undefined,
          tipoNuevo: esCambioTipoAusencia ? tipoNuevo : undefined,
        };

        this.logger.log(
          `📬 [UPDATE] Preparando notificaciones - codigo: ${solicitudNotificationData.codigo}, tipoAnterior: ${solicitudNotificationData.tipoAnterior || 'N/A'}, tipoNuevo: ${solicitudNotificationData.tipoNuevo || 'N/A'}, email: ${solicitudNotificationData.email || 'N/A'}`,
        );

        setImmediate(() => {
          // Telegram notification (către gestoria)
          this.logger.log(
            `📱 [UPDATE] Sending Telegram notification - codigo: ${solicitudNotificationData.codigo}`,
          );
          this.telegramService
            .sendSolicitudNotification(solicitudNotificationData)
            .then(() => {
              this.logger.log(
                `✅ [UPDATE] Telegram notification sent successfully - codigo: ${solicitudNotificationData.codigo}`,
              );
            })
            .catch((telegramError: any) => {
              this.logger.error(
                `❌ [UPDATE] Error sending Telegram notification: ${telegramError.message}`,
              );
            });

          // Email notification către gestoria
          this.logger.log(
            `📧 [UPDATE] Attempting to send email notification to gestoria - solicitud: ${solicitudNotificationData.codigo}, tipo: ${solicitudNotificationData.tipo}, accion: ${solicitudNotificationData.accion}`,
          );
          this.sendSolicitudEmail(solicitudNotificationData)
            .then(() => {
              this.logger.log(
                `✅ [UPDATE] Email notification sent to gestoria successfully - solicitud: ${solicitudNotificationData.codigo}`,
              );
            })
            .catch((emailError: any) => {
              this.logger.error(
                `❌ [UPDATE] Error sending email notification to gestoria (non-blocking): ${emailError.message}`,
              );
            });

          // Email notification către angajat
          this.logger.log(
            `📧 [UPDATE] Attempting to send email notification to empleado - solicitud: ${solicitudNotificationData.codigo}, email: ${solicitudNotificationData.email || 'N/A'}`,
          );
          if (!solicitudNotificationData.email) {
            this.logger.warn(
              `⚠️ [UPDATE] No email provided for empleado, will try to fetch from codigo: ${solicitudNotificationData.codigo}`,
            );
          }
          this.sendSolicitudEmailToEmpleado(solicitudNotificationData)
            .then(() => {
              this.logger.log(
                `✅ [UPDATE] Email notification sent to empleado successfully - solicitud: ${solicitudNotificationData.codigo}`,
              );
            })
            .catch((emailError: any) => {
              this.logger.error(
                `❌ [UPDATE] Error sending email notification to empleado: ${emailError.message}`,
              );
            });

          // Notificare în aplicație către angajat
          if (solicitudNotificationData.codigo) {
            this.logger.log(
              `📬 [UPDATE] Attempting to send in-app notification to empleado - solicitud: ${solicitudNotificationData.codigo}`,
            );

            // Mesaj personalizat pentru schimbarea tipului de ausencia
            let notificationTitle = 'Solicitud actualizada';
            let notificationMessage = `Tu solicitud de ${solicitudNotificationData.tipo} (${solicitudNotificationData.fecha}) ha sido actualizada. Estado: ${solicitudNotificationData.estado}`;

            if (
              solicitudNotificationData.tipoAnterior &&
              solicitudNotificationData.tipoNuevo
            ) {
              notificationTitle = 'Ausencia convertida';
              if (
                solicitudNotificationData.tipoNuevo === 'Ausencia Injustificada'
              ) {
                notificationMessage = `Tu ausencia ha sido convertida de "${solicitudNotificationData.tipoAnterior}" a "${solicitudNotificationData.tipoNuevo}" (${solicitudNotificationData.fecha}).`;
              } else {
                notificationMessage = `Tu ausencia ha sido convertida de "${solicitudNotificationData.tipoAnterior}" a "${solicitudNotificationData.tipoNuevo}" (${solicitudNotificationData.fecha}).`;
              }
            }

            this.notificationsService
              .notifyUser('system', solicitudNotificationData.codigo, {
                type: 'info',
                title: notificationTitle,
                message: notificationMessage,
                data: {
                  solicitudId: id,
                  tipo: solicitudNotificationData.tipo,
                  fecha: solicitudNotificationData.fecha,
                  estado: solicitudNotificationData.estado,
                  motivo: solicitudNotificationData.motivo,
                  tipoAnterior: solicitudNotificationData.tipoAnterior,
                  tipoNuevo: solicitudNotificationData.tipoNuevo,
                },
              })
              .then(() => {
                this.logger.log(
                  `✅ [UPDATE] In-app notification sent to empleado successfully - solicitud: ${solicitudNotificationData.codigo}`,
                );
              })
              .catch((notifError: any) => {
                this.logger.error(
                  `❌ [UPDATE] Error sending in-app notification to empleado (non-blocking): ${notifError.message}`,
                );
              });
          }
        });
      } else {
        this.logger.error(
          `❌ [UPDATE] Solicitud not found after update (id: ${id}), skipping notifications.`,
        );
        // Încercăm totuși să trimitem notificări cu datele disponibile
        // Folosim datele din `data` și `solicitudBefore` dacă există
        const tipoAnterior = solicitudBefore?.tipo
          ? (solicitudBefore.tipo || '').trim()
          : '';
        const tipoNuevo = data.tipo ? (data.tipo || '').trim() : '';
        const esCambioTipoAusencia =
          (tipoAnterior === 'Ausencias justificada' &&
            tipoNuevo === 'Ausencia Injustificada') ||
          (tipoAnterior === 'Ausencia Injustificada' &&
            tipoNuevo === 'Ausencias justificada');

        this.logger.log(
          `🔍 [UPDATE] Fallback - tipoAnterior: "${tipoAnterior}", tipoNuevo: "${tipoNuevo}", esCambio: ${esCambioTipoAusencia}`,
        );

        if (codigo && (solicitudBefore || data.tipo)) {
          this.logger.warn(
            `⚠️ [UPDATE] Attempting to send notifications with fallback data - codigo: ${codigo}`,
          );

          const fallbackNotificationData = {
            codigo: codigo || '',
            nombre: nombre || solicitudBefore?.nombre || '',
            tipo: tipo || solicitudBefore?.tipo || '',
            fecha:
              data.fecha_inicio && data.fecha_fin
                ? `${data.fecha_inicio} - ${data.fecha_fin}`
                : data.fecha_inicio ||
                  data.fecha_fin ||
                  solicitudBefore?.fecha_inicio ||
                  'N/A',
            estado: estado || solicitudBefore?.estado || '',
            motivo: motivo || solicitudBefore?.motivo || '',
            accion: 'update' as const,
            email: data.email || solicitudBefore?.email,
            tipoAnterior: esCambioTipoAusencia ? tipoAnterior : undefined,
            tipoNuevo: esCambioTipoAusencia ? tipoNuevo : undefined,
          };

          this.logger.log(
            `📬 [UPDATE] Fallback notification data - codigo: ${fallbackNotificationData.codigo}, tipoAnterior: ${fallbackNotificationData.tipoAnterior || 'N/A'}, tipoNuevo: ${fallbackNotificationData.tipoNuevo || 'N/A'}`,
          );

          setImmediate(() => {
            this.logger.log(
              `📬 [UPDATE] Sending fallback notifications - codigo: ${fallbackNotificationData.codigo}`,
            );

            // Telegram notification
            this.telegramService
              .sendSolicitudNotification(fallbackNotificationData)
              .then(() => {
                this.logger.log(
                  `✅ [UPDATE] Fallback Telegram notification sent`,
                );
              })
              .catch((e) =>
                this.logger.error(`❌ Telegram fallback error: ${e.message}`),
              );

            // Email către gestoria
            this.sendSolicitudEmail(fallbackNotificationData)
              .then(() => {
                this.logger.log(`✅ [UPDATE] Fallback email to gestoria sent`);
              })
              .catch((e) =>
                this.logger.error(
                  `❌ Email gestoria fallback error: ${e.message}`,
                ),
              );

            // Email către angajat
            this.sendSolicitudEmailToEmpleado(fallbackNotificationData)
              .then(() => {
                this.logger.log(`✅ [UPDATE] Fallback email to empleado sent`);
              })
              .catch((e) =>
                this.logger.error(
                  `❌ Email empleado fallback error: ${e.message}`,
                ),
              );

            // Notificare în aplicație
            if (fallbackNotificationData.codigo) {
              let notificationTitle = 'Solicitud actualizada';
              let notificationMessage = `Tu solicitud de ${fallbackNotificationData.tipo} (${fallbackNotificationData.fecha}) ha sido actualizada. Estado: ${fallbackNotificationData.estado}`;

              if (
                fallbackNotificationData.tipoAnterior &&
                fallbackNotificationData.tipoNuevo
              ) {
                notificationTitle = 'Ausencia convertida';
                notificationMessage = `Tu ausencia ha sido convertida de "${fallbackNotificationData.tipoAnterior}" a "${fallbackNotificationData.tipoNuevo}" (${fallbackNotificationData.fecha}).`;
              }

              this.notificationsService
                .notifyUser('system', fallbackNotificationData.codigo, {
                  type: 'info',
                  title: notificationTitle,
                  message: notificationMessage,
                  data: {
                    solicitudId: id,
                    tipo: fallbackNotificationData.tipo,
                    fecha: fallbackNotificationData.fecha,
                    estado: fallbackNotificationData.estado,
                    motivo: fallbackNotificationData.motivo,
                    tipoAnterior: fallbackNotificationData.tipoAnterior,
                    tipoNuevo: fallbackNotificationData.tipoNuevo,
                  },
                })
                .then(() => {
                  this.logger.log(
                    `✅ [UPDATE] Fallback in-app notification sent`,
                  );
                })
                .catch((e) =>
                  this.logger.error(
                    `❌ In-app notification fallback error: ${e.message}`,
                  ),
                );
            }
          });
        } else {
          this.logger.warn(
            `⚠️ [UPDATE] Cannot send fallback notifications - missing codigo or tipo. codigo: ${codigo}, tipo: ${data.tipo}`,
          );
        }
      }

      return {
        success: true,
        status: 'ok',
        solicitud_ok: 1,
        solicitud_id: id,
        solicitud: solicitud || null,
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating solicitud:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar solicitud: ${error.message}`,
      );
    }
  }

  /**
   * Șterge o solicitare
   * ȘTERGE din ambele tabele: Ausencias + solicitudes (în tranzacție)
   */
  async deleteSolicitud(id: string, codigo?: string): Promise<any> {
    try {
      if (!id) {
        throw new BadRequestException('id este obligatoriu pentru delete');
      }

      // Obține informațiile solicitării înainte de ștergere pentru notificare Telegram
      let solicitudInfo: any = null;
      try {
        const beforeDelete = await this.getSolicitudes({ limit: 1000 });
        solicitudInfo = beforeDelete.find((s) => s.id === id);
        // Dacă nu avem codigo, îl luăm din solicitarea găsită
        if (!codigo && solicitudInfo) {
          codigo = solicitudInfo.codigo;
        }
      } catch {
        this.logger.warn(
          '⚠️ Could not fetch solicitud info for Telegram notification',
        );
      }

      if (!codigo) {
        throw new BadRequestException('codigo este obligatoriu pentru delete');
      }

      // Query-uri separate pentru DELETE
      const deleteAusenciaQuery = `
        DELETE FROM Ausencias
        WHERE solicitud_id = ${this.escapeSql(id)}
          AND CODIGO = ${this.escapeSql(codigo)}
      `;

      const deleteSolicitudQuery = `
        DELETE FROM solicitudes
        WHERE id = ${this.escapeSql(id)}
          AND codigo = ${this.escapeSql(codigo)}
      `;

      this.logger.log(`📝 Delete solicitud: ${id} (codigo: ${codigo})`);

      // Execută operațiile în tranzacție
      await this.prisma.$transaction(async (tx) => {
        // 1) DELETE din Ausencias
        await tx.$executeRawUnsafe(deleteAusenciaQuery);

        // 2) DELETE din solicitudes
        await tx.$executeRawUnsafe(deleteSolicitudQuery);
      });

      // Trimite notificare pe Telegram și Email pentru delete (complet async, nu așteptăm răspunsul)
      if (solicitudInfo) {
        const solicitudNotificationData = {
          codigo: solicitudInfo.codigo || codigo || '',
          nombre: solicitudInfo.nombre || '',
          tipo: solicitudInfo.tipo || '',
          fecha:
            solicitudInfo.fecha_inicio && solicitudInfo.fecha_fin
              ? `${solicitudInfo.fecha_inicio} - ${solicitudInfo.fecha_fin}`
              : solicitudInfo.fecha_inicio || solicitudInfo.fecha_fin || 'N/A',
          estado: solicitudInfo.estado || '',
          motivo: solicitudInfo.motivo,
          accion: 'delete' as const,
        };

        setImmediate(() => {
          // Telegram notification
          this.telegramService
            .sendSolicitudNotification(solicitudNotificationData)
            .catch((telegramError: any) => {
              this.logger.warn(
                `⚠️ Error sending Telegram notification (non-blocking): ${telegramError.message}`,
              );
            });

          // Email notification
          this.sendSolicitudEmail(solicitudNotificationData).catch(
            (emailError: any) => {
              this.logger.warn(
                `⚠️ Error sending email notification (non-blocking): ${emailError.message}`,
              );
            },
          );
        });
      }

      return {
        success: true,
        status: 'ok',
        solicitud_ok: 1,
        solicitud_id: id,
        deleted_id: id,
        codigo: codigo,
      };
    } catch (error: any) {
      this.logger.error('❌ Error deleting solicitud:', error);
      // Prisma $transaction face automat rollback la eroare, nu e nevoie de manual rollback
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar solicitud: ${error.message}`,
      );
    }
  }
}
