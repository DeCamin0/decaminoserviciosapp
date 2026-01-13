import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { EmailService } from './email.service';
import { SentEmailsService } from './sent-emails.service';
import { NotificationsService } from './notifications.service';
import { EmpleadosService } from './empleados.service';
import { BajaVoluntariaPdfService } from './baja-voluntaria-pdf.service';
import { DocumentosService } from './documentos.service';

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
    private readonly bajaVoluntariaPdfService: BajaVoluntariaPdfService,
    private readonly documentosService: DocumentosService,
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
        // Câmpuri pentru BAJA_VOLUNTARIA
        fecha_ultimo_dia_trabajo:
          row.fecha_ultimo_dia_trabajo instanceof Date
            ? row.fecha_ultimo_dia_trabajo.toISOString().split('T')[0]
            : row.fecha_ultimo_dia_trabajo || null,
        dias_preaviso:
          row.dias_preaviso !== null && row.dias_preaviso !== undefined
            ? Number(row.dias_preaviso)
            : null,
        cumple_preaviso_15:
          row.cumple_preaviso_15 === true ||
          row.cumple_preaviso_15 === 1 ||
          row.cumple_preaviso_15 === '1',
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
    fecha_ultimo_dia_trabajo?: string; // Pentru BAJA_VOLUNTARIA
  }): Promise<any> {
    try {
      // Validează câmpurile obligatorii
      if (!data.id || !data.email || !data.codigo || !data.tipo) {
        throw new BadRequestException(
          'id, email, codigo și tipo sunt obligatorii',
        );
      }

      // Pentru BAJA_VOLUNTARIA, estado default este 'Pendiente' (nu 'Aprobada')
      const estado =
        data.estado ||
        (data.tipo === 'BAJA_VOLUNTARIA' ? 'Pendiente' : 'Aprobada');
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

      // Pentru BAJA_VOLUNTARIA: calculează dias_preaviso și cumple_preaviso_15
      let fechaUltimoDiaTrabajoSQL = 'NULL';
      let diasPreavisoSQL = 'NULL';
      let cumplePreaviso15SQL = 'FALSE';
      const origenSQL = this.escapeSql('EMPLEADO');

      if (data.tipo === 'BAJA_VOLUNTARIA' && data.fecha_ultimo_dia_trabajo) {
        const fechaUltimoDiaDate = new Date(data.fecha_ultimo_dia_trabajo);
        if (!isNaN(fechaUltimoDiaDate.getTime())) {
          const fechaUltimoDiaFormatted = fechaUltimoDiaDate
            .toISOString()
            .split('T')[0];
          fechaUltimoDiaTrabajoSQL = this.escapeSql(fechaUltimoDiaFormatted);

          // Calculează dias_preaviso = DATEDIFF(fecha_ultimo_dia_trabajo, fecha_solicitud)
          // Notă: fecha_solicitud este NOW() în momentul creării
          const fechaSolicitud = new Date();
          fechaSolicitud.setHours(0, 0, 0, 0); // Setează la începutul zilei pentru calcul corect
          fechaUltimoDiaDate.setHours(0, 0, 0, 0); // Setează la începutul zilei pentru calcul corect
          const diasPreaviso = Math.ceil(
            (fechaUltimoDiaDate.getTime() - fechaSolicitud.getTime()) /
              (1000 * 60 * 60 * 24),
          );
          diasPreavisoSQL = String(diasPreaviso);
          cumplePreaviso15SQL = diasPreaviso >= 15 ? 'TRUE' : 'FALSE';

          this.logger.log(
            `📊 Calcul dias_preaviso: fecha_solicitud=${fechaSolicitud.toISOString().split('T')[0]}, fecha_ultimo_dia=${fechaUltimoDiaFormatted}, dias_preaviso=${diasPreaviso}`,
          );
        }
      }

      // Query 1: INSERT în solicitudes
      const insertSolicitudQuery = `
        INSERT INTO solicitudes (
          id, codigo, nombre, email, tipo, estado, fecha_inicio, fecha_fin, motivo, fecha_solicitud,
          origen, fecha_ultimo_dia_trabajo, dias_preaviso, cumple_preaviso_15
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
          NOW(),
          ${origenSQL},
          ${fechaUltimoDiaTrabajoSQL},
          ${diasPreavisoSQL},
          ${cumplePreaviso15SQL}
        )
      `;

      this.logger.log(
        `📝 Create solicitud: ${data.id} (${data.tipo}), estado: ${estado}`,
      );

      // Execută operațiile în tranzacție
      await this.prisma.$transaction(async (tx) => {
        // 1) INSERT în solicitudes
        await tx.$executeRawUnsafe(insertSolicitudQuery);

        // 2) INSERT în Ausencias (doar dacă estado = 'Aprobada' și NU este BAJA_VOLUNTARIA)
        if (estado === 'Aprobada' && data.tipo !== 'BAJA_VOLUNTARIA') {
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
      // Pentru BAJA_VOLUNTARIA, folosim fecha_ultimo_dia_trabajo
      let fechaDisplay = 'N/A';
      if (data.tipo === 'BAJA_VOLUNTARIA' && data.fecha_ultimo_dia_trabajo) {
        fechaDisplay = data.fecha_ultimo_dia_trabajo;
      } else if (data.fecha_inicio && data.fecha_fin) {
        fechaDisplay = `${data.fecha_inicio} - ${data.fecha_fin}`;
      } else if (data.fecha_inicio || data.fecha_fin) {
        fechaDisplay = data.fecha_inicio || data.fecha_fin || 'N/A';
      }

      const solicitudNotificationData = {
        codigo: data.codigo,
        nombre: data.nombre,
        tipo: data.tipo,
        fecha: fechaDisplay,
        estado: estado,
        motivo: data.motivo,
        accion: 'create' as const,
        email: data.email,
      };

      setImmediate(() => {
        // Telegram notification (către gestoria)
        this.logger.log(
          `📱 [CREATE] Attempting to send Telegram notification - solicitud: ${solicitudNotificationData.codigo}, tipo: ${solicitudNotificationData.tipo}, accion: ${solicitudNotificationData.accion}`,
        );
        this.telegramService
          .sendSolicitudNotification(solicitudNotificationData)
          .then(() => {
            this.logger.log(
              `✅ [CREATE] Telegram notification sent successfully - solicitud: ${solicitudNotificationData.codigo}, tipo: ${solicitudNotificationData.tipo}`,
            );
          })
          .catch((telegramError: any) => {
            this.logger.error(
              `❌ [CREATE] Error sending Telegram notification (non-blocking): ${telegramError.message}`,
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
   * Generează PDF preview pentru Baja Voluntaria (fără aprobare)
   */
  async generateBajaVoluntariaPreviewPDF(solicitud: any): Promise<Buffer> {
    try {
      const fechaUltimoDiaTrabajo =
        solicitud.fecha_ultimo_dia_trabajo ||
        solicitud.fecha_inicio ||
        solicitud.fecha_fin;
      const diasPreaviso = solicitud.dias_preaviso ?? 0;
      const cumplePreaviso15 = solicitud.cumple_preaviso_15 ?? false;

      if (!fechaUltimoDiaTrabajo) {
        throw new BadRequestException(
          'fecha_ultimo_dia_trabajo no está disponible',
        );
      }

      const pdfBuffer =
        await this.bajaVoluntariaPdfService.generateBajaVoluntariaPDF({
          codigo: solicitud.codigo || '',
          nombre: solicitud.nombre || '',
          fecha_solicitud:
            solicitud.fecha_solicitud || new Date().toISOString(),
          fecha_ultimo_dia_trabajo: fechaUltimoDiaTrabajo,
          dias_preaviso: diasPreaviso,
          cumple_preaviso_15: cumplePreaviso15,
          motivo: solicitud.motivo,
        });

      return pdfBuffer;
    } catch (error: any) {
      this.logger.error(`❌ Eroare la generarea preview PDF: ${error.message}`);
      throw error;
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

        // 2) UPSERT sau DELETE în Ausencias (NU pentru BAJA_VOLUNTARIA)
        if (estado === 'Aprobada' && tipo !== 'BAJA_VOLUNTARIA') {
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
        } else if (estado !== 'Aprobada') {
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

      // Pentru BAJA_VOLUNTARIA aprobată: generează PDF, trimite email, setează fecha_baja_programada
      if (
        solicitud &&
        solicitud.tipo === 'BAJA_VOLUNTARIA' &&
        estado === 'Aprobada' &&
        solicitudBefore?.estado !== 'Aprobada'
      ) {
        // Este prima aprobare (nu era deja Aprobada)
        this.logger.log(
          `🔄 [UPDATE] BAJA_VOLUNTARIA aprobată - procesare PDF și email pentru ${id}`,
        );

        try {
          // Obține fecha_ultimo_dia_trabajo din solicitud
          const fechaUltimoDiaTrabajo =
            solicitud.fecha_ultimo_dia_trabajo ||
            solicitudBefore?.fecha_ultimo_dia_trabajo;
          const diasPreaviso =
            solicitud.dias_preaviso || solicitudBefore?.dias_preaviso || 0;
          const cumplePreaviso15 =
            solicitud.cumple_preaviso_15 ||
            solicitudBefore?.cumple_preaviso_15 ||
            false;

          if (fechaUltimoDiaTrabajo) {
            // Generează PDF
            const pdfBuffer =
              await this.bajaVoluntariaPdfService.generateBajaVoluntariaPDF({
                codigo: codigo,
                nombre: nombre,
                fecha_solicitud:
                  solicitud.fecha_solicitud ||
                  solicitudBefore?.fecha_solicitud ||
                  new Date().toISOString(),
                fecha_ultimo_dia_trabajo: fechaUltimoDiaTrabajo,
                dias_preaviso: diasPreaviso,
                cumple_preaviso_15: cumplePreaviso15,
                motivo: motivo,
              });

            // Formatează email HTML
            const subject = `🟡 Baja Voluntaria Aprobada - ${nombre} (${codigo})`;
            const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background-color: #fff3cd; padding: 20px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107; }
    .info-row { margin: 10px 0; }
    .label { font-weight: bold; color: #555; }
    .value { color: #333; }
    .warning { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; border-radius: 4px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h2>🟡 Baja Voluntaria Aprobada</h2>
  </div>
  
  <div class="info-row">
    <span class="label">👤 Empleado:</span>
    <span class="value">${nombre} (${codigo})</span>
  </div>
  
  <div class="info-row">
    <span class="label">📅 Fecha de solicitud:</span>
    <span class="value">${solicitud.fecha_solicitud || 'N/A'}</span>
  </div>
  
  <div class="info-row">
    <span class="label">📅 Último día de trabajo:</span>
    <span class="value">${fechaUltimoDiaTrabajo}</span>
  </div>
  
  <div class="info-row">
    <span class="label">📊 Días de preaviso:</span>
    <span class="value">${diasPreaviso}</span>
  </div>
  
  <div class="info-row">
    <span class="label">✅ Cumple preaviso de 15 días:</span>
    <span class="value">${cumplePreaviso15 ? 'SÍ' : 'NO'}</span>
  </div>
  
  ${
    motivo
      ? `
  <div class="info-row">
    <span class="label">📝 Motivo:</span>
    <span class="value">${motivo}</span>
  </div>
  `
      : ''
  }
  
  <div class="warning">
    <h3 style="margin-top: 0; color: #856404;">ℹ️ Información importante</h3>
    <p style="color: #856404;">Esta solicitud ha sido aprobada. El PDF adjunto contiene todos los detalles.</p>
  </div>
  
  <hr style="margin-top: 20px; border: none; border-top: 1px solid #ddd;">
  <p style="color: #888; font-size: 12px; margin-top: 20px;">
    Este es un mensaje automático del sistema De Camino Servicios Auxiliares SL.
  </p>
</body>
</html>
            `.trim();

            // Caută documentul încărcat de angajat (dacă există)
            let documentoEmpleadoBuffer: Buffer | null = null;
            let documentoEmpleadoFileName: string | null = null;
            let documentoEmpleadoMimeType: string | null = null;

            try {
              // Obține email-ul angajatului pentru căutarea documentului
              const empleadoEmailQuery = await this.prisma.$queryRawUnsafe<
                Array<{ 'CORREO ELECTRONICO': string | null }>
              >(`
                SELECT \`CORREO ELECTRONICO\`
                FROM DatosEmpleados
                WHERE CODIGO = ${this.escapeSql(codigo)}
                LIMIT 1
              `);

              const empleadoEmail =
                empleadoEmailQuery.length > 0 &&
                empleadoEmailQuery[0]['CORREO ELECTRONICO']
                  ? empleadoEmailQuery[0]['CORREO ELECTRONICO'].trim()
                  : null;

              // Caută documentele cu tipo_documento = 'Baja Voluntaria'
              const documentos = await this.documentosService.getDocumentos(
                codigo,
                empleadoEmail || undefined,
              );

              // Filtrează doar documentele cu tipo_documento = 'Baja Voluntaria'
              const bajaVoluntariaDocs = documentos.filter(
                (doc) =>
                  (doc.tipo_documento || '').toLowerCase() ===
                  'baja voluntaria',
              );

              if (bajaVoluntariaDocs.length > 0) {
                // Sortează după doc_id (cel mai mare = cel mai recent) sau fecha_creacion
                const sortedDocs = bajaVoluntariaDocs.sort((a, b) => {
                  if (b.doc_id && a.doc_id) return b.doc_id - a.doc_id;
                  if (b.fecha_creacion && a.fecha_creacion) {
                    return (
                      new Date(b.fecha_creacion).getTime() -
                      new Date(a.fecha_creacion).getTime()
                    );
                  }
                  return 0;
                });

                // Folosește cel mai recent document
                const documentoMasReciente = sortedDocs[0];

                if (documentoMasReciente.doc_id) {
                  // Descarcă documentul
                  const documentoDescargado =
                    await this.documentosService.downloadDocumento(
                      documentoMasReciente.doc_id,
                      codigo,
                      empleadoEmail || undefined,
                    );

                  documentoEmpleadoBuffer = documentoDescargado.archivo;
                  documentoEmpleadoFileName =
                    documentoDescargado.nombre_archivo;
                  documentoEmpleadoMimeType = documentoDescargado.tipo_mime;

                  this.logger.log(
                    `✅ Documento de empleado encontrado y descargado: ${documentoEmpleadoFileName} (${documentoEmpleadoBuffer.length} bytes)`,
                  );
                }
              } else {
                this.logger.log(
                  `ℹ️ No se encontró documento de empleado para BAJA_VOLUNTARIA ${id}`,
                );
              }
            } catch (docError: any) {
              this.logger.warn(
                `⚠️ Error al buscar/descargar documento de empleado: ${docError.message}. Continuando sin documento...`,
              );
              // Nu oprește procesul dacă nu se găsește documentul
            }

            // Construiește array-ul de attachments
            const attachments: Array<{
              filename: string;
              content: Buffer;
              contentType?: string;
            }> = [
              {
                filename: `Baja_Voluntaria_${codigo}_${new Date().toISOString().split('T')[0]}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
              },
            ];

            // Adaugă documentul încărcat de angajat dacă există
            if (
              documentoEmpleadoBuffer &&
              documentoEmpleadoFileName &&
              documentoEmpleadoMimeType
            ) {
              attachments.push({
                filename: `Documento_Empleado_${documentoEmpleadoFileName}`,
                content: documentoEmpleadoBuffer,
                contentType: documentoEmpleadoMimeType,
              });
            }

            // Trimite email către gestoria cu PDF și documentul angajatului (dacă există)
            const GESTORIA_EMAIL = 'altemprado@gmail.com';
            await this.emailService.sendEmailWithAttachments(
              GESTORIA_EMAIL,
              subject,
              html,
              attachments,
              {
                bcc: [
                  'info@decaminoservicios.com',
                  'mirisjm@gmail.com',
                  'decamino.rrhh@gmail.com',
                ],
              },
            );

            this.logger.log(
              `✅ Email cu ${attachments.length} attachment(s) trimis către gestoria pentru Baja voluntaria ${id}`,
            );

            // Actualizează enviado_gestoria și fecha_envio_gestoria
            await this.prisma.$executeRawUnsafe(`
              UPDATE solicitudes
              SET enviado_gestoria = TRUE,
                  fecha_envio_gestoria = NOW()
              WHERE id = ${this.escapeSql(id)}
            `);

            // Setează fecha_baja_programada în DatosEmpleados
            const fechaUltimoDiaDate = new Date(fechaUltimoDiaTrabajo);
            if (!isNaN(fechaUltimoDiaDate.getTime())) {
              const fechaFormatted = fechaUltimoDiaDate
                .toISOString()
                .split('T')[0];
              await this.prisma.$executeRawUnsafe(`
                UPDATE DatosEmpleados
                SET \`fecha_baja_programada\` = ${this.escapeSql(fechaFormatted)}
                WHERE CODIGO = ${this.escapeSql(codigo)}
              `);
              this.logger.log(
                `✅ fecha_baja_programada actualizată pentru empleado ${codigo}`,
              );
            }

            // Salvează email-ul în BD
            try {
              await this.sentEmailsService.saveSentEmail({
                senderId: codigo,
                recipientType: 'gestoria',
                recipientEmail: GESTORIA_EMAIL,
                recipientName: 'Gestoria',
                subject,
                message: html,
                status: 'sent',
                attachments: attachments.map((att) => ({
                  filename: att.filename,
                  fileContent: att.content,
                  mimeType: att.contentType || 'application/octet-stream',
                  fileSize: att.content.length,
                })),
              });
            } catch (saveError: any) {
              this.logger.warn(
                `⚠️ Eroare la salvarea email-ului în BD: ${saveError.message}`,
              );
            }
          } else {
            this.logger.warn(
              `⚠️ fecha_ultimo_dia_trabajo nu este setată pentru BAJA_VOLUNTARIA ${id}`,
            );
          }
        } catch (error: any) {
          this.logger.error(
            `❌ Eroare la procesarea BAJA_VOLUNTARIA aprobată: ${error.message}`,
          );
          // Nu aruncăm eroarea pentru a nu opri flow-ul principal
        }
      }

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

  /**
   * Creează o solicitare de despido improcedente (doar pentru ADMIN)
   * Poate fi salvată ca borrador sau confirmată direct
   */
  async createDespidoImprocedente(data: {
    codigo: string;
    nombre: string;
    email?: string;
    fecha_efectiva: string; // YYYY-MM-DD
    comentario_empresa?: string;
    created_by_user_id: string;
    confirmar: boolean; // true = confirmar y notificar, false = guardar borrador
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType?: string;
    }>;
  }): Promise<any> {
    try {
      // Validări
      if (!data.codigo || !data.nombre || !data.fecha_efectiva) {
        throw new BadRequestException(
          'codigo, nombre și fecha_efectiva sunt obligatorii',
        );
      }

      // Validează data efectivă
      const fechaEfectivaDate = new Date(data.fecha_efectiva);
      if (isNaN(fechaEfectivaDate.getTime())) {
        throw new BadRequestException(
          'fecha_efectiva trebuie să fie o dată validă',
        );
      }

      // Generează ID unic
      const id = `DESP_${Date.now()}`;

      // Obține email-ul angajatului dacă nu este furnizat
      let empleadoEmail = data.email;
      if (!empleadoEmail) {
        try {
          const empleado = await this.empleadosService.getEmpleadoByCodigo(
            data.codigo,
          );
          empleadoEmail =
            empleado?.['CORREO ELECTRONICO'] ||
            empleado?.CORREO_ELECTRONICO ||
            null;
        } catch (error: any) {
          this.logger.warn(
            `⚠️ Could not fetch empleado email for ${data.codigo}: ${error.message}`,
          );
        }
      }

      // Determină estado în funcție de confirmar
      const estado = data.confirmar ? 'CONFIRMADO' : 'BORRADOR';

      // Format fecha_efectiva pentru MySQL (Date)
      const fechaEfectivaFormatted = fechaEfectivaDate
        .toISOString()
        .split('T')[0];
      const fechaEfectivaSQL = this.escapeSql(fechaEfectivaFormatted);

      // Query INSERT în solicitudes
      const insertQuery = `
        INSERT INTO solicitudes (
          id, codigo, nombre, email, tipo, estado, fecha_inicio, 
          origen, fecha_efectiva, comentario_empresa, created_by_user_id,
          enviado_gestoria, fecha_envio_gestoria, fecha_solicitud
        ) VALUES (
          ${this.escapeSql(id)},
          ${this.escapeSql(data.codigo)},
          ${this.escapeSql(data.nombre)},
          ${empleadoEmail ? this.escapeSql(empleadoEmail) : 'NULL'},
          ${this.escapeSql('DESPIDO_IMPROCEDENTE')},
          ${this.escapeSql(estado)},
          ${fechaEfectivaSQL},
          ${this.escapeSql('EMPRESA')},
          ${fechaEfectivaSQL},
          ${data.comentario_empresa ? this.escapeSql(data.comentario_empresa) : 'NULL'},
          ${this.escapeSql(data.created_by_user_id)},
          ${data.confirmar ? 'TRUE' : 'FALSE'},
          ${data.confirmar ? 'NOW()' : 'NULL'},
          NOW()
        )
      `;

      this.logger.log(
        `📝 Create despido improcedente: ${id} (${data.codigo}), estado: ${estado}, confirmar: ${data.confirmar}`,
      );

      // Execută INSERT
      await this.prisma.$executeRawUnsafe(insertQuery);

      // Dacă este confirmat, actualizează fecha_baja_programada în DatosEmpleados
      if (data.confirmar) {
        const updateFechaBajaQuery = `
          UPDATE DatosEmpleados
          SET \`fecha_baja_programada\` = ${fechaEfectivaSQL}
          WHERE CODIGO = ${this.escapeSql(data.codigo)}
        `;
        await this.prisma.$executeRawUnsafe(updateFechaBajaQuery);
        this.logger.log(
          `✅ fecha_baja_programada actualizată pentru empleado ${data.codigo}`,
        );
      }

      // Dacă este confirmat, trimite email către gestoria
      if (data.confirmar) {
        await this.confirmarYNotificarGestoria(id, data, empleadoEmail);
      }

      // Returnează solicitarea creată
      const created = await this.getSolicitudes({
        codigo: data.codigo,
        limit: 1,
      });
      const solicitud = created.find((s) => s.id === id);

      return {
        success: true,
        status: 'ok',
        solicitud_id: id,
        solicitud: solicitud || null,
      };
    } catch (error: any) {
      this.logger.error('❌ Error creating despido improcedente:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al crear despido improcedente: ${error.message}`,
      );
    }
  }

  /**
   * Confirmă o solicitare de despido și trimite email către gestoria
   */
  async confirmarYNotificarGestoria(
    solicitudId: string,
    data: {
      codigo: string;
      nombre: string;
      fecha_efectiva: string;
      comentario_empresa?: string;
      attachments?: Array<{
        filename: string;
        content: Buffer;
        contentType?: string;
      }>;
    },
    empleadoEmail?: string | null,
  ): Promise<void> {
    try {
      // Actualizează estado și marca enviado_gestoria
      const updateQuery = `
        UPDATE solicitudes
        SET estado = ${this.escapeSql('CONFIRMADO')},
            enviado_gestoria = TRUE,
            fecha_envio_gestoria = NOW()
        WHERE id = ${this.escapeSql(solicitudId)}
      `;
      await this.prisma.$executeRawUnsafe(updateQuery);

      // Actualizează fecha_baja_programada în DatosEmpleados
      const fechaEfectivaDate = new Date(data.fecha_efectiva);
      const fechaEfectivaFormatted = fechaEfectivaDate
        .toISOString()
        .split('T')[0];
      const fechaEfectivaSQL = this.escapeSql(fechaEfectivaFormatted);

      const updateFechaBajaQuery = `
        UPDATE DatosEmpleados
        SET \`fecha_baja_programada\` = ${fechaEfectivaSQL}
        WHERE CODIGO = ${this.escapeSql(data.codigo)}
      `;
      await this.prisma.$executeRawUnsafe(updateFechaBajaQuery);

      // Formatează email HTML
      const subject = `🔴 Despido Improcedente - ${data.nombre} (${data.codigo})`;
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
    .warning { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; border-radius: 4px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h2>🔴 Despido Improcedente</h2>
  </div>
  
  <div class="info-row">
    <span class="label">👤 Empleado:</span>
    <span class="value">${data.nombre} (${data.codigo})</span>
  </div>
  
  <div class="info-row">
    <span class="label">📅 Fecha efectiva del despido:</span>
    <span class="value">${data.fecha_efectiva}</span>
  </div>
  
  ${
    data.comentario_empresa
      ? `
  <div class="info-row">
    <span class="label">📝 Comentario interno:</span>
    <span class="value">${data.comentario_empresa}</span>
  </div>
  `
      : ''
  }
  
  ${
    empleadoEmail
      ? `
  <div class="info-row">
    <span class="label">📧 Email empleado:</span>
    <span class="value">${empleadoEmail}</span>
  </div>
  `
      : ''
  }
  
  <div class="warning">
    <h3 style="margin-top: 0; color: #856404;">⚠️ Acción iniciada por la empresa</h3>
    <p style="color: #856404;">Esta solicitud ha sido creada y confirmada por un administrador del sistema.</p>
  </div>
  
  <hr style="margin-top: 20px; border: none; border-top: 1px solid #ddd;">
  <p style="color: #888; font-size: 12px; margin-top: 20px;">
    Este es un mensaje automático del sistema De Camino Servicios Auxiliares SL.
  </p>
</body>
</html>
      `.trim();

      // Trimite email către gestoria
      const GESTORIA_EMAIL = 'altemprado@gmail.com';

      if (data.attachments && data.attachments.length > 0) {
        await this.emailService.sendEmailWithAttachments(
          GESTORIA_EMAIL,
          subject,
          html,
          data.attachments,
          {
            bcc: [
              'info@decaminoservicios.com',
              'mirisjm@gmail.com',
              'decamino.rrhh@gmail.com',
            ],
          },
        );
      } else {
        await this.emailService.sendEmail(GESTORIA_EMAIL, subject, html, {
          bcc: [
            'info@decaminoservicios.com',
            'mirisjm@gmail.com',
            'decamino.rrhh@gmail.com',
          ],
        });
      }

      this.logger.log(
        `✅ Email trimis către gestoria pentru despido improcedente ${solicitudId}`,
      );

      // Salvează email-ul în BD
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: data.codigo,
          recipientType: 'gestoria',
          recipientEmail: GESTORIA_EMAIL,
          recipientName: 'Gestoria',
          subject,
          message: html,
          status: 'sent',
          attachments: data.attachments
            ? data.attachments.map((att) => ({
                filename: att.filename,
                fileContent: att.content,
                mimeType: att.contentType || 'application/octet-stream',
                fileSize: att.content.length,
              }))
            : undefined,
        });
      } catch (saveError: any) {
        this.logger.warn(
          `⚠️ Eroare la salvarea email-ului în BD: ${saveError.message}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Error confirming and notifying gestoria: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Salvează o solicitare de despido ca borrador (fără a trimite email)
   */
  async guardarBorrador(data: {
    codigo: string;
    nombre: string;
    email?: string;
    fecha_efectiva: string;
    comentario_empresa?: string;
    created_by_user_id: string;
  }): Promise<any> {
    return this.createDespidoImprocedente({
      ...data,
      confirmar: false,
    });
  }
}
