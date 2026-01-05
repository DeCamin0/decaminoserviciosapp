import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentosSolicitadosService } from './documentos-solicitados.service';

@Injectable()
export class DocumentosService {
  private readonly logger = new Logger(DocumentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DocumentosSolicitadosService))
    private readonly documentosSolicitadosService?: DocumentosSolicitadosService,
  ) {}

  /**
   * Helper function pentru a escapa valori SQL (prevenir SQL injection)
   */
  private escapeSql(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    // Escapăm single quotes și escapăm caracterul de escape
    const escaped = String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }

  /**
   * Obține documentele pentru un angajat specificat prin id (CODIGO) și/sau email
   */
  async getDocumentos(empleadoId?: string, email?: string): Promise<any[]> {
    try {
      if (!empleadoId && !email) {
        throw new BadRequestException(
          'Se requiere al menos empleadoId o email',
        );
      }

      // Construim condițiile WHERE
      const conditions: string[] = [];

      if (empleadoId) {
        conditions.push(`\`id\` = ${this.escapeSql(empleadoId)}`);
      }

      if (email) {
        conditions.push(`\`correo_electronico\` = ${this.escapeSql(email)}`);
      }

      const whereClause = conditions.join(' AND ');

      const query = `
        SELECT 
          doc_id,
          id,
          correo_electronico,
          tipo_documento,
          nombre_archivo,
          nombre_empleado,
          fecha_creacion
        FROM \`CarpetasDocumentos\`
        WHERE ${whereClause}
        ORDER BY fecha_creacion DESC
      `;

      this.logger.log(
        `📝 Get documentos query: ${query}... (empleadoId: ${empleadoId || 'N/A'}, email: ${email || 'N/A'})`,
      );

      const documentos = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(
        `✅ Documentos retrieved: ${documentos.length} records (empleadoId: ${empleadoId || 'N/A'}, email: ${email || 'N/A'})`,
      );

      // Mapăm rezultatele la formatul așteptat de frontend
      return documentos.map((doc) => ({
        doc_id: doc.doc_id,
        id: doc.id,
        correo_electronico: doc.correo_electronico,
        tipo_documento: doc.tipo_documento,
        nombre_archivo: doc.nombre_archivo,
        nombre_empleado: doc.nombre_empleado,
        fecha_creacion: doc.fecha_creacion,
      }));
    } catch (error: any) {
      this.logger.error('❌ Error fetching documentos:', error);
      throw new BadRequestException(
        `Error al obtener los documentos: ${error.message}`,
      );
    }
  }

  /**
   * Descarcă un document specific după doc_id, id (CODIGO) și/sau email
   * @param documentId - doc_id din tabela CarpetasDocumentos
   * @param empleadoId - id (CODIGO) pentru validare (opțional)
   * @param email - email pentru validare (opțional)
   * @param fileName - numele fișierului pentru validare (opțional)
   * @returns Buffer cu conținutul fișierului
   */
  async downloadDocumento(
    documentId: number,
    empleadoId?: string,
    email?: string,
    fileName?: string,
  ): Promise<{
    archivo: Buffer;
    tipo_mime: string;
    nombre_archivo: string;
  }> {
    try {
      // Validează documentId
      if (!Number.isFinite(documentId)) {
        throw new BadRequestException(
          `Parámetro "documentId" inválido: ${documentId}`,
        );
      }

      // Construiește condițiile WHERE
      // documentId este un număr, nu trebuie escapat
      const conditions: string[] = [`doc_id = ${Number(documentId)}`];

      if (empleadoId) {
        conditions.push(`\`id\` = ${this.escapeSql(empleadoId)}`);
      }

      if (email) {
        conditions.push(`\`correo_electronico\` = ${this.escapeSql(email)}`);
      }

      if (fileName) {
        conditions.push(`\`nombre_archivo\` = ${this.escapeSql(fileName)}`);
      }

      const whereClause = conditions.join(' AND ');

      const query = `
        SELECT
          doc_id,
          id,
          correo_electronico,
          tipo_documento,
          nombre_archivo,
          nombre_empleado,
          archivo
        FROM \`CarpetasDocumentos\`
        WHERE ${whereClause}
        LIMIT 1;
      `.trim();

      this.logger.log(
        `📝 Download documento query: WHERE doc_id = ${documentId}${empleadoId ? ` AND id = ${empleadoId}` : ''}${email ? ` AND correo_electronico = ${email}` : ''}${fileName ? ` AND nombre_archivo = ${fileName}` : ''}`,
      );

      const result = await this.prisma.$queryRawUnsafe<any[]>(query);

      if (!result || result.length === 0) {
        throw new NotFoundException(
          `Documento no encontrado para doc_id=${documentId}`,
        );
      }

      const row = result[0];

      if (row.archivo == null) {
        throw new BadRequestException(
          'Columna "archivo" no está disponible para este documento',
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

      // Detectează tipul MIME din extensia fișierului
      const nombreArchivo = row.nombre_archivo || `documento_${documentId}`;
      const extension = nombreArchivo.split('.').pop()?.toLowerCase() || 'bin';
      const mimeTypes: { [key: string]: string } = {
        pdf: 'application/pdf',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        txt: 'text/plain',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
      const mimeType = mimeTypes[extension] || 'application/octet-stream';

      this.logger.log(
        `✅ Documento descargado: doc_id=${documentId}, nombre=${nombreArchivo}, tamaño=${archivoBuffer.length} bytes`,
      );

      return {
        archivo: archivoBuffer,
        tipo_mime: mimeType,
        nombre_archivo: nombreArchivo,
      };
    } catch (error: any) {
      this.logger.error('❌ Error downloading documento:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al descargar el documento: ${error.message}`,
      );
    }
  }

  /**
   * Upload one or more documents
   * Accepts multipart/form-data with:
   * - archivo_0, archivo_1, ... (files)
   * - empleado_id, empleado_email, empleado_nombre
   * - fecha_upload (optional, format: DD/MM/YYYY, HH:MM:SS or ISO)
   * - tipo_documento_0, tipo_documento_1, ... (per file)
   * - archivo_0_nombre, archivo_1_nombre, ... (optional, from file name if not provided)
   */
  async uploadDocumento(
    files: Express.Multer.File[],
    body: {
      empleado_id?: string;
      empleado_email?: string;
      empleado_nombre?: string;
      fecha_upload?: string;
      [key: string]: any; // For indexed fields like tipo_documento_0, archivo_0_nombre, etc.
    },
  ): Promise<{ success: true; processed: number; inserted: number }> {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException(
          'Se requiere al menos un archivo para subir',
        );
      }

      // Extract common fields
      const id = body.empleado_id || null;
      const email = body.empleado_email || null;
      const nombreEmpleado = body.empleado_nombre || null;

      if (!id) {
        throw new BadRequestException('Se requiere "empleado_id"');
      }

      // Parse fecha_upload (support multiple formats like n8n snapshot)
      const parseFechaToSql = (
        raw: string | null | undefined,
      ): string | null => {
        if (!raw) return null;
        const s = String(raw).trim();

        // 1) ISO/parse standard
        const ms = Date.parse(s);
        if (!isNaN(ms)) {
          return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
        }

        // 2) DD/MM/YYYY, HH:MM:SS sau DD-MM-YYYY HH:MM:SS
        const m = s.match(
          /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})$/,
        );
        if (m) {
          const [, dd, mm, yyyy, HH, MM, SS] = m;
          const pad = (x: string | number) => String(x).padStart(2, '0');
          return `${yyyy}-${pad(mm)}-${pad(dd)} ${pad(HH)}:${pad(MM)}:${pad(SS)}`;
        }

        // 3) epoch (secunde sau milisecunde)
        if (/^\d+$/.test(s)) {
          const n = Number(s);
          const sec = n > 1e12 ? Math.round(n / 1000) : n; // ms -> s
          return new Date(sec * 1000)
            .toISOString()
            .slice(0, 19)
            .replace('T', ' ');
        }

        // fallback: acum
        return new Date().toISOString().slice(0, 19).replace('T', ' ');
      };

      const fecha = parseFechaToSql(body.fecha_upload);

      // Helper to read indexed field with fallback (matches n8n logic)
      const readBodyFieldForIndex = (
        baseName: string,
        idx: number,
        defaultValue: string | null = null,
      ): string | null => {
        if (idx !== null && idx !== undefined) {
          // Try indexed version first (tipo_documento_0, archivo_nombre_0)
          const kIndexed1 = `${baseName}_${idx}`;
          if (body[kIndexed1] !== undefined && body[kIndexed1] !== null) {
            return String(body[kIndexed1]);
          }
        }
        // Try non-indexed version (tipo_documento, archivo_nombre)
        if (body[baseName] !== undefined && body[baseName] !== null) {
          return String(body[baseName]);
        }
        return defaultValue;
      };

      let processed = 0;
      let inserted = 0;

      // Process each file
      for (let index = 0; index < files.length; index++) {
        const file = files[index];

        // Get tipo_documento for this file
        const tipoDoc =
          readBodyFieldForIndex('tipo_documento', index, null) ||
          readBodyFieldForIndex('documento_tipo', index, null) ||
          readBodyFieldForIndex('tipo', index, null) ||
          null;

        // Get nombre_archivo (try archivo_nombre_0, then archivo_0_nombre from body, then file.originalname)
        let nombreArchivo = readBodyFieldForIndex(
          'archivo_nombre',
          index,
          null,
        );
        if (!nombreArchivo) {
          // Try alternative format: archivo_0_nombre
          const altKey = `archivo_${index}_nombre`;
          if (body[altKey] !== undefined && body[altKey] !== null) {
            nombreArchivo = String(body[altKey]);
          }
        }
        nombreArchivo = nombreArchivo || file.originalname || 'sin-nombre.pdf';

        // Insert into CarpetasDocumentos table
        const query = `
          INSERT INTO \`CarpetasDocumentos\` (
            \`id\`,
            \`correo_electronico\`,
            \`tipo_documento\`,
            \`nombre_archivo\`,
            \`nombre_empleado\`,
            \`fecha_creacion\`,
            \`archivo\`
          ) VALUES (
            ${this.escapeSql(id)},
            ${this.escapeSql(email)},
            ${this.escapeSql(tipoDoc)},
            ${this.escapeSql(nombreArchivo)},
            ${this.escapeSql(nombreEmpleado)},
            ${fecha ? this.escapeSql(fecha) : 'CURRENT_TIMESTAMP'},
            ${file.buffer ? `0x${file.buffer.toString('hex')}` : 'NULL'}
          )
        `;

        try {
          await this.prisma.$executeRawUnsafe(query);
          inserted++;
          processed++;
          this.logger.log(
            `✅ Documento ${index + 1}/${files.length} insertado: ${nombreArchivo} (${file.size} bytes)`,
          );

          // Verificare automată: dacă tipul documentului este DNI, Certificado de titularidad sau Justificantes de banco,
          // marchează cererea ca completată (dacă există)
          if (tipoDoc && this.documentosSolicitadosService) {
            const tipoDocNormalized = tipoDoc.toLowerCase().trim();
            // Normalizăm tipurile pentru matching flexibil
            const tiposSolicitados = [
              'dni',
              'certificado de titularidad',
              'certificado titularidad',
              'titularidad',
              'justificantes de banco',
              'justificante de banco',
              'justificantes banco',
              'justificante banco',
            ];

            // Verificăm dacă tipul documentului se potrivește cu unul dintre tipurile solicitate
            const matchesTipo = tiposSolicitados.some((tipo) => {
              // Matching exact sau dacă tipul documentului conține tipul solicitat
              return (
                tipoDocNormalized === tipo ||
                tipoDocNormalized.includes(tipo) ||
                tipo.includes(tipoDocNormalized)
              );
            });

            if (matchesTipo) {
              try {
                await this.documentosSolicitadosService.marcarCompletado(
                  id,
                  tipoDoc, // Folosim tipul exact trimis, nu cel normalizat
                );
                this.logger.log(
                  `✅ Solicitud marcada como completada automáticamente: empleado ${id}, tipo ${tipoDoc}`,
                );
              } catch (solicitudError: any) {
                // Nu aruncăm eroare dacă verificarea eșuează, doar logăm
                this.logger.warn(
                  `⚠️ No se pudo marcar solicitud como completada: ${solicitudError.message}`,
                );
              }
            }
          }
        } catch (insertError: any) {
          this.logger.error(
            `❌ Error insertando documento ${index + 1}/${files.length}: ${insertError.message}`,
          );
          processed++; // Count as processed even if failed
          throw new BadRequestException(
            `Error al insertar documento ${index + 1}: ${insertError.message}`,
          );
        }
      }

      return { success: true, processed, inserted };
    } catch (error: any) {
      this.logger.error('❌ Error uploading documentos:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al subir documentos: ${error.message}`,
      );
    }
  }

  /**
   * Delete a documento from CarpetasDocumentos by id and nombre_archivo
   * @param id - ID of the documento (empleado ID, from CarpetasDocumentos.id)
   * @param nombreArchivo - nombre_archivo (filename) of the documento
   */
  async deleteDocumento(
    id: string | number,
    nombreArchivo: string,
  ): Promise<{ success: true; message: string; affectedRows: number }> {
    try {
      // Validate id (can be string for empleado ID)
      const idString = String(id);
      if (!idString || idString.trim() === '') {
        throw new BadRequestException(`Parámetro "id" inválido: ${id}`);
      }

      // Validate nombreArchivo
      if (
        !nombreArchivo ||
        typeof nombreArchivo !== 'string' ||
        nombreArchivo.trim() === ''
      ) {
        throw new BadRequestException(
          'Se requiere "nombre_archivo" (nombre del archivo)',
        );
      }

      // Build DELETE query (matching n8n snapshot logic)
      // Note: id is String (VarChar(50)) in CarpetasDocumentos, not UNSIGNED INT
      const query = `
        DELETE FROM \`CarpetasDocumentos\`
        WHERE id = ${this.escapeSql(idString.trim())}
          AND TRIM(nombre_archivo) = TRIM(${this.escapeSql(nombreArchivo.trim())})
        LIMIT 1
      `;

      this.logger.log(
        `🗑️ Delete documento request - id: ${idString.trim()}, nombre_archivo: "${nombreArchivo.trim()}"`,
      );

      const result = await this.prisma.$executeRawUnsafe(query);
      const affectedRows = Number(result) || 0;

      if (affectedRows === 0) {
        throw new NotFoundException(
          `Documento no encontrado para id="${idString.trim()}" y nombre_archivo="${nombreArchivo.trim()}"`,
        );
      }

      this.logger.log(
        `✅ Documento eliminado: id="${idString.trim()}", nombre_archivo="${nombreArchivo.trim()}"`,
      );

      return {
        success: true,
        message: 'Archivo eliminado correctamente.',
        affectedRows,
      };
    } catch (error: any) {
      this.logger.error('❌ Error deleting documento:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar el documento: ${error.message}`,
      );
    }
  }
}
