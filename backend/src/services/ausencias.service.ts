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
          UNIDAD_DURACION
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
          END AS UNIDAD_DURACION
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

      // Dacă este un premiu, trimite notificări (async, non-blocking)
      if (esPremio) {
        this.sendPremioDeletedNotifications(
          codigo,
          nombre,
          fecha,
          motivo,
        ).catch((error) => {
          // Nu aruncăm eroare dacă notificările eșuează - doar logăm
          this.logger.warn(
            `⚠️ Error sending premio deleted notifications (non-blocking): ${error.message}`,
          );
        });
      }

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
}
