import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

@Injectable()
export class NominasService {
  private readonly logger = new Logger(NominasService.name);
  private readonly months = new Set([
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'setiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Helper functions (ported from n8n)
   */
  private norm(s: any): string {
    return (s ?? '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private stripExt(s: any): string {
    return (s ?? '').toString().replace(/\.[^.]+$/, '');
  }

  private isYear(s: any): boolean {
    return /^\d{4}$/.test((s ?? '').toString());
  }

  private candidateNames(j: any): string[] {
    const c: string[] = [];
    if (j.nombre_empleado) c.push(j.nombre_empleado);
    if (j.empleado) c.push(j.empleado);
    if (j.employee_name) c.push(j.employee_name);

    const nombre = j.nombre ?? '';
    c.push(nombre);

    const base = this.stripExt(nombre);
    const tokens = base.split('_');
    c.push(tokens.join(' '));

    if (tokens.length >= 2) {
      const maybeAno = tokens[tokens.length - 1];
      const maybeMes = tokens[tokens.length - 2];
      if (this.isYear(maybeAno) && this.months.has(this.norm(maybeMes))) {
        c.push(tokens.slice(0, -2).join(' '));
      }
    }
    return c.filter(Boolean).map(this.norm);
  }

  private extractNombreEmpleado(nomina: any): string | null {
    const base = this.stripExt(nomina.nombre ?? '');
    const parts = base.split('_');

    if (
      parts.length >= 2 &&
      this.isYear(parts[parts.length - 1]) &&
      this.months.has(this.norm(parts[parts.length - 2]))
    ) {
      return parts.slice(0, -2).join(' ');
    }
    return base.replace(/_/g, ' ');
  }

  /**
   * Obține lista de nóminas cu filtrare bazată pe nume
   * @param nombre - Numele angajatului pentru filtrare (opțional)
   * @returns Array de nóminas filtrate
   */
  async getNominas(nombre?: string): Promise<any[]> {
    try {
      // Obține toate nóminas din baza de date
      const nominas = await this.prisma.nominas.findMany({
        select: {
          id: true,
          nombre: true,
          tipo_mime: true,
          fecha_subida: true,
          Mes: true,
          Ano: true,
        },
        orderBy: {
          fecha_subida: 'desc',
        },
      });

      // Dacă nu există filtru de nume, returnează toate
      if (!nombre || nombre.trim() === '') {
        return nominas.map((nomina) => ({
          id: nomina.id,
          nombre_empleado: this.extractNombreEmpleado(nomina),
          archivo: nomina.nombre,
          mes: nomina.Mes ?? null,
          ano: nomina.Ano ?? null,
          fecha_subida: nomina.fecha_subida,
        }));
      }

      // Normalizează numele căutat
      const needle = this.norm(nombre);

      // Filtrează nóminas care corespund numelui căutat
      const filtered = nominas
        .filter((n) => {
          const cands = this.candidateNames(n);
          return cands.some((c) => c.includes(needle));
        })
        .map((n) => {
          let mes = n.Mes ?? null;
          let ano = n.Ano ?? null;

          const base = this.stripExt(n.nombre ?? '');
          const parts = base.split('_');
          if ((!mes || !ano) && parts.length >= 2) {
            const maybeAno = parts[parts.length - 1];
            const maybeMes = parts[parts.length - 2];
            if (!mes) mes = maybeMes || null;
            if (!ano && this.isYear(maybeAno)) ano = maybeAno;
          }

          return {
            id: n.id,
            nombre_empleado: this.extractNombreEmpleado(n),
            archivo: n.nombre,
            mes,
            ano,
            fecha_subida: n.fecha_subida,
          };
        });

      return filtered;
    } catch (error) {
      this.logger.error('Error fetching nominas:', error);
      throw new BadRequestException('Error al obtener las nóminas');
    }
  }

  /**
   * Helper function pentru a escapa valori SQL (prevenir SQL injection)
   */
  private escapeSql(value: string | number | null | undefined): string {
    if (typeof value === 'number') {
      return value.toString();
    }
    if (value === null || value === undefined) {
      return 'NULL';
    }
    // Escapăm single quotes și escapăm caracterul de escape
    const escaped = String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }

  /**
   * Descarcă o nómina specifică după ID și nume
   * @param id - ID-ul nóminas
   * @param nombre - Numele angajatului (pentru validare)
   * @returns Buffer cu conținutul PDF-ului
   */
  async downloadNomina(
    id: number,
    nombre: string,
  ): Promise<{
    archivo: Buffer;
    tipo_mime: string;
    nombre_archivo: string;
  }> {
    try {
      // Validează ID-ul
      if (!Number.isFinite(id)) {
        throw new BadRequestException(`Parámetro "id" inválido: ${id}`);
      }

      // Validează numele
      const nombreTrimmed = (nombre ?? '').toString().trim();
      if (!nombreTrimmed) {
        throw new BadRequestException('Parámetro "nombre" requerido');
      }

      // Construiește query-ul SQL (similar cu n8n)
      const query = `
        SELECT
          id,
          nombre,
          archivo,
          tipo_mime,
          fecha_subida,
          Mes,
          Ano
        FROM Nominas
        WHERE id = ${id}
          AND LOWER(nombre) = LOWER(${this.escapeSql(nombreTrimmed)})
        LIMIT 1;
      `.trim();

      this.logger.log(
        `📝 Download nomina query: WHERE id = ${id} AND LOWER(nombre) = LOWER(${nombreTrimmed})`,
      );

      const result = await this.prisma.$queryRawUnsafe<any[]>(query);

      if (!result || result.length === 0) {
        throw new NotFoundException(
          `Nómina no encontrada para id=${id} y nombre=${nombreTrimmed}`,
        );
      }

      const row = result[0];

      if (row.archivo == null) {
        throw new BadRequestException(
          'Columna "archivo" no está disponible para esta nómina',
        );
      }

      // Convertește archivo la Buffer
      let archivoBuffer: Buffer;
      if (Buffer.isBuffer(row.archivo)) {
        archivoBuffer = row.archivo;
      } else if (
        typeof row.archivo === 'object' &&
        row.archivo?.type === 'Buffer' &&
        Array.isArray(row.archivo.data)
      ) {
        archivoBuffer = Buffer.from(row.archivo.data);
      } else if (typeof row.archivo === 'string') {
        // Dacă vine deja base64, decodează
        archivoBuffer = Buffer.from(row.archivo, 'base64');
      } else {
        throw new BadRequestException(
          'Formato desconocido para el campo "archivo"',
        );
      }

      const fileName = row.nombre ? `${row.nombre}.pdf` : `nomina_${id}.pdf`;
      const mimeType = row.tipo_mime || 'application/pdf';

      this.logger.log(
        `✅ Nómina descargada: id=${id}, nombre=${nombreTrimmed}, tamaño=${archivoBuffer.length} bytes`,
      );

      return {
        archivo: archivoBuffer,
        tipo_mime: mimeType,
        nombre_archivo: fileName,
      };
    } catch (error: any) {
      this.logger.error('❌ Error downloading nomina:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al descargar la nómina: ${error.message}`,
      );
    }
  }

  /**
   * Obține accesurile pentru o nómina specifică sau toate accesurile (cu filtrare)
   * @param filters - Filtre opționale: nominaId, empleadoCodigo, tipoAcceso, fechaDesde, fechaHasta
   */
  async getNominasAccesos(filters?: {
    nominaId?: number;
    empleadoCodigo?: string;
    tipoAcceso?: 'preview' | 'download' | 'email';
    fechaDesde?: string;
    fechaHasta?: string;
    limit?: number;
  }): Promise<
    Array<{
      id: number;
      nomina_id: number;
      empleado_codigo: string;
      empleado_nombre: string;
      tipo_acceso: string;
      fecha_acceso: Date;
      ip: string | null;
      user_agent: string | null;
      nomina_nombre?: string;
      nomina_mes?: string;
      nomina_ano?: string;
    }>
  > {
    try {
      const conditions: string[] = [];

      if (filters?.nominaId) {
        const nominaIdValue = filters.nominaId;
        const nominaIdNum =
          typeof nominaIdValue === 'number'
            ? nominaIdValue
            : parseInt(String(nominaIdValue), 10);
        if (!isNaN(nominaIdNum)) {
          conditions.push(`na.\`nomina_id\` = ${nominaIdNum}`);
        }
      }

      if (filters?.empleadoCodigo) {
        conditions.push(
          `na.\`empleado_codigo\` = ${this.escapeSql(filters.empleadoCodigo)}`,
        );
      }

      if (filters?.tipoAcceso) {
        conditions.push(
          `na.\`tipo_acceso\` = ${this.escapeSql(filters.tipoAcceso)}`,
        );
      }

      if (filters?.fechaDesde) {
        conditions.push(
          `na.\`fecha_acceso\` >= ${this.escapeSql(filters.fechaDesde)}`,
        );
      }

      if (filters?.fechaHasta) {
        conditions.push(
          `na.\`fecha_acceso\` <= ${this.escapeSql(filters.fechaHasta)}`,
        );
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitClause = filters?.limit
        ? `LIMIT ${Math.min(filters.limit, 1000)}`
        : 'LIMIT 500';

      const query = `
        SELECT 
          na.\`id\`,
          na.\`nomina_id\`,
          na.\`empleado_codigo\`,
          na.\`empleado_nombre\`,
          na.\`tipo_acceso\`,
          na.\`fecha_acceso\`,
          na.\`ip\`,
          na.\`user_agent\`,
          n.\`nombre\` as nomina_nombre,
          n.\`Mes\` as nomina_mes,
          n.\`Ano\` as nomina_ano
        FROM \`NominasAccesos\` na
        LEFT JOIN \`Nominas\` n ON na.\`nomina_id\` = n.\`id\`
        ${whereClause}
        ORDER BY na.\`fecha_acceso\` DESC
        ${limitClause}
      `;

      this.logger.debug(
        `📝 [getNominasAccesos] Query: ${query.substring(0, 300)}...`,
      );
      this.logger.debug(
        `📝 [getNominasAccesos] Filters: ${JSON.stringify(filters)}`,
      );

      const result = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.debug(
        `📝 [getNominasAccesos] Found ${result.length} accesos`,
      );

      return result.map((row) => ({
        id: Number(row.id),
        nomina_id: Number(row.nomina_id),
        empleado_codigo: row.empleado_codigo,
        empleado_nombre: row.empleado_nombre,
        tipo_acceso: row.tipo_acceso,
        fecha_acceso: new Date(row.fecha_acceso),
        ip: row.ip || null,
        user_agent: row.user_agent || null,
        nomina_nombre: row.nomina_nombre || null,
        nomina_mes: row.nomina_mes || null,
        nomina_ano: row.nomina_ano || null,
      }));
    } catch (error: any) {
      this.logger.error('❌ Error getting nominas accesos:', error);
      throw new BadRequestException(
        `Error al obtener accesos: ${error.message}`,
      );
    }
  }

  /**
   * Loghează accesul la o nómina (preview, download, email)
   * @param nominaId - ID-ul nóminas
   * @param empleadoCodigo - CODIGO-ul angajatului
   * @param empleadoNombre - Numele angajatului
   * @param tipoAcceso - Tipul accesului: 'preview', 'download', 'email'
   * @param ip - IP-ul utilizatorului (opțional)
   * @param userAgent - User agent (opțional)
   */
  async logNominaAcceso(
    nominaId: number,
    empleadoCodigo: string,
    empleadoNombre: string,
    tipoAcceso: 'preview' | 'download' | 'email',
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `📝 Logging acces: nómina ${nominaId}, empleado ${empleadoCodigo}, tipo: ${tipoAcceso}`,
      );

      const insertQuery = `
        INSERT INTO \`NominasAccesos\` (
          \`nomina_id\`,
          \`empleado_codigo\`,
          \`empleado_nombre\`,
          \`tipo_acceso\`,
          \`fecha_acceso\`,
          \`ip\`,
          \`user_agent\`
        ) VALUES (
          ${this.escapeSql(nominaId.toString())},
          ${this.escapeSql(empleadoCodigo)},
          ${this.escapeSql(empleadoNombre)},
          ${this.escapeSql(tipoAcceso)},
          NOW(),
          ${ip ? this.escapeSql(ip) : 'NULL'},
          ${userAgent ? this.escapeSql(userAgent) : 'NULL'}
        )
      `;

      this.logger.debug(
        `📝 Executing query: ${insertQuery.substring(0, 200)}...`,
      );
      const result = await this.prisma.$executeRawUnsafe(insertQuery);
      this.logger.debug(`📝 Query result: ${JSON.stringify(result)}`);
      this.logger.log(
        `✅ Acces logat cu succes: nómina ${nominaId}, empleado ${empleadoCodigo}, tipo: ${tipoAcceso}`,
      );
    } catch (error: any) {
      // Nu aruncăm eroarea - logging-ul nu trebuie să blocheze operațiunile principale
      this.logger.error(
        `❌ Eroare la logarea accesului pentru nómina ${nominaId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Trimite nómina prin email către angajat
   * @param id - ID-ul nóminas
   * @param nombre - Numele angajatului (pentru validare)
   * @param email - Email-ul destinatarului
   * @param empleadoNombre - Numele complet al angajatului (pentru template)
   * @returns Success message
   */
  async sendNominaByEmail(
    id: number,
    nombre: string,
    email: string,
    empleadoNombre: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validează ID-ul
      if (!Number.isFinite(id)) {
        throw new BadRequestException(`Parámetro "id" inválido: ${id}`);
      }

      // Validează numele
      const nombreTrimmed = (nombre ?? '').toString().trim();
      if (!nombreTrimmed) {
        throw new BadRequestException('Parámetro "nombre" requerido');
      }

      // Validează email-ul
      const emailTrimmed = (email ?? '').toString().trim();
      if (!emailTrimmed || !emailTrimmed.includes('@')) {
        throw new BadRequestException('Email inválido');
      }

      // Obține nómina (folosim logica din downloadNomina)
      const { archivo, nombre_archivo } = await this.downloadNomina(
        id,
        nombreTrimmed,
      );

      // Obține informații despre mes și an din baza de date
      const query = `
        SELECT Mes, Ano
        FROM Nominas
        WHERE id = ${id}
          AND LOWER(nombre) = LOWER(${this.escapeSql(nombreTrimmed)})
        LIMIT 1;
      `;

      const result = await this.prisma.$queryRawUnsafe<any[]>(query);
      const mes = result?.[0]?.Mes || '';
      const ano = result?.[0]?.Ano || '';

      // Template HTML frumos pentru email
      const mesesNombres = [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ];
      const mesNombre =
        typeof mes === 'string' && mesesNombres.includes(mes.toLowerCase())
          ? mes.charAt(0).toUpperCase() + mes.slice(1).toLowerCase()
          : mes;

      const htmlTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              padding: 30px 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content {
              padding: 30px 20px;
            }
            .greeting {
              font-size: 18px;
              color: #1f2937;
              margin-bottom: 20px;
            }
            .message {
              font-size: 16px;
              color: #4b5563;
              margin-bottom: 25px;
              line-height: 1.8;
            }
            .nomina-info {
              background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
              border-left: 4px solid #10b981;
              padding: 20px;
              border-radius: 8px;
              margin: 25px 0;
            }
            .nomina-info h2 {
              margin: 0 0 10px 0;
              color: #065f46;
              font-size: 20px;
            }
            .nomina-info p {
              margin: 5px 0;
              color: #047857;
              font-size: 15px;
            }
            .footer {
              background-color: #f9fafb;
              padding: 20px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              margin: 5px 0;
              color: #6b7280;
              font-size: 14px;
            }
            .footer strong {
              color: #1f2937;
            }
            .attachment-note {
              background-color: #eff6ff;
              border-left: 4px solid #3b82f6;
              padding: 15px;
              border-radius: 8px;
              margin-top: 20px;
              font-size: 14px;
              color: #1e40af;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💰 Tu Nómina</h1>
            </div>
            <div class="content">
              <div class="greeting">
                Hola <strong>${empleadoNombre}</strong>,
              </div>
              <div class="message">
                Te enviamos tu recibo de sueldo adjunto en este correo electrónico.
              </div>
              <div class="nomina-info">
                <h2>📊 Información de la Nómina</h2>
                ${mesNombre && ano ? `<p><strong>Período:</strong> ${mesNombre} ${ano}</p>` : ''}
                <p><strong>Archivo:</strong> ${nombre_archivo}</p>
              </div>
              <div class="message">
                Puedes descargar y revisar tu nómina desde el archivo PDF adjunto.
              </div>
              <div class="attachment-note">
                📎 <strong>Nota:</strong> Tu nómina está adjunta como archivo PDF en este correo.
              </div>
            </div>
            <div class="footer">
              <p><strong>Atentamente,</strong></p>
              <p><strong>RRHH</strong></p>
              <p><strong>DE CAMINO SERVICIOS AUXILIARES SL</strong></p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Trimite email cu attachment
      const subject = `Tu Nómina${mesNombre && ano ? ` - ${mesNombre} ${ano}` : ''}`;
      await this.emailService.sendEmailWithAttachment(
        emailTrimmed,
        subject,
        htmlTemplate,
        archivo,
        nombre_archivo,
        {
          bcc: ['decamino.rrhh@gmail.com'],
        },
      );

      this.logger.log(
        `✅ Nómina enviada por email: id=${id}, email=${emailTrimmed}, nombre=${nombreTrimmed}`,
      );

      return {
        success: true,
        message: `Nómina enviada exitosamente a ${emailTrimmed}`,
      };
    } catch (error: any) {
      this.logger.error('❌ Error sending nomina by email:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al enviar la nómina por email: ${error.message}`,
      );
    }
  }

  /**
   * Upload one or more nóminas
   * Accepts multipart/form-data with:
   * - archivo_0, archivo_1, ... (files)
   * - nombre_empleado (or nombre, empleado_nombre)
   * - mes (or Mes)
   * - año (or ano, Ano, anio, year)
   * - Optional: empleado_id, id (for metadata, not used in DB)
   */
  async uploadNomina(
    files: Express.Multer.File[],
    body: {
      nombre_empleado?: string;
      nombre?: string;
      empleado_nombre?: string;
      mes?: string;
      Mes?: string;
      año?: string;
      ano?: string;
      Ano?: string;
      anio?: string;
      year?: string;
      empleado_id?: string;
      id?: string;
      [key: string]: any; // For indexed fields like archivo_0_tipo
    },
  ): Promise<{ success: true; processed: number; inserted: number }> {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException(
          'Se requiere al menos un archivo para subir',
        );
      }

      // Extract nombre with fallbacks (same as n8n logic)
      const nombre =
        body.nombre || body.nombre_empleado || body.empleado_nombre || null;

      if (!nombre) {
        throw new BadRequestException(
          'Se requiere "nombre" o "nombre_empleado"',
        );
      }

      // Extract mes with fallbacks
      const mes = body.Mes || body.mes || body.month || null;

      // Extract año with fallbacks (support 'año', 'Año', 'ano', 'An', etc.)
      const ano =
        body.Ano ||
        body.ano ||
        body.anio ||
        body.year ||
        body['Año'] ||
        body['año'] ||
        body.An ||
        body.an ||
        null;

      let processed = 0;
      let inserted = 0;

      // Process each file
      for (let index = 0; index < files.length; index++) {
        const file = files[index];

        // Get MIME type: first try indexed field (archivo_0_tipo), then file.mimetype
        const tipoMime =
          body[`archivo_${index}_tipo`] ||
          body[`archivo_tipo_${index}`] ||
          file.mimetype ||
          'application/octet-stream';

        // Insert into Nominas table
        // Note: id is auto-increment, so we don't insert it
        // fecha_subida has default now(), so we don't insert it either
        const query = `
          INSERT INTO \`Nominas\` (
            \`nombre\`,
            \`archivo\`,
            \`tipo_mime\`,
            \`Mes\`,
            \`Ano\`
          ) VALUES (
            ${this.escapeSql(nombre)},
            ${file.buffer ? `0x${file.buffer.toString('hex')}` : 'NULL'},
            ${this.escapeSql(tipoMime)},
            ${this.escapeSql(mes)},
            ${this.escapeSql(ano)}
          )
        `;

        try {
          await this.prisma.$executeRawUnsafe(query);
          inserted++;
          processed++;
          this.logger.log(
            `✅ Nómina ${index + 1}/${files.length} insertada: ${file.originalname} (${file.size} bytes)`,
          );
        } catch (insertError: any) {
          this.logger.error(
            `❌ Error insertando nómina ${index + 1}/${files.length}: ${insertError.message}`,
          );
          processed++; // Count as processed even if failed
          throw new BadRequestException(
            `Error al insertar nómina ${index + 1}: ${insertError.message}`,
          );
        }
      }

      return { success: true, processed, inserted };
    } catch (error: any) {
      this.logger.error('❌ Error uploading nóminas:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al subir nóminas: ${error.message}`);
    }
  }

  /**
   * Delete a nomina by id and nombre
   * @param id - ID of the nomina (from Nominas.id)
   * @param nombre - nombre (filename) of the nomina
   */
  async deleteNomina(
    id: number | string,
    nombre: string,
  ): Promise<{ success: true; message: string; affectedRows: number }> {
    try {
      // Validate id
      const idNumber = typeof id === 'string' ? parseInt(id, 10) : id;
      if (isNaN(idNumber) || idNumber <= 0) {
        throw new BadRequestException(`Parámetro "id" inválido: ${id}`);
      }

      // Validate nombre
      if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
        throw new BadRequestException(
          'Se requiere "nombre" (nombre del archivo)',
        );
      }

      // Build DELETE query (matching n8n snapshot logic)
      const query = `
        DELETE FROM \`Nominas\`
        WHERE id = CAST(${idNumber} AS UNSIGNED)
          AND TRIM(nombre) = TRIM(${this.escapeSql(nombre.trim())})
        LIMIT 1
      `;

      this.logger.log(
        `🗑️ Delete nomina request - id: ${idNumber}, nombre: "${nombre.trim()}"`,
      );

      const result = await this.prisma.$executeRawUnsafe(query);
      const affectedRows = Number(result) || 0;

      if (affectedRows === 0) {
        throw new NotFoundException(
          `Nómina no encontrada para id=${idNumber} y nombre="${nombre.trim()}"`,
        );
      }

      this.logger.log(
        `✅ Nómina eliminada: id=${idNumber}, nombre="${nombre.trim()}"`,
      );

      return {
        success: true,
        message: 'Archivo eliminado correctamente.',
        affectedRows,
      };
    } catch (error: any) {
      this.logger.error('❌ Error deleting nomina:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar la nómina: ${error.message}`,
      );
    }
  }
}
