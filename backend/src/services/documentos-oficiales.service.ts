import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';

@Injectable()
export class DocumentosOficialesService {
  private readonly logger = new Logger(DocumentosOficialesService.name);

  constructor(private readonly prisma: PrismaService) {}

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
   * Obține documentele oficiale pentru un angajat specificat prin codigo (id) și/sau nombre (nombre_empleado)
   */
  async getDocumentosOficiales(
    codigo?: string,
    nombre?: string,
  ): Promise<any[]> {
    try {
      if (!codigo && !nombre) {
        throw new BadRequestException('Se requiere al menos codigo o nombre');
      }

      // Construim condițiile WHERE
      // IMPORTANT: Verificăm atât `id` cât și `detected_empleado_id` pentru că documentele
      // din folder ingestion pot fi salvate cu `id = 'PENDING'` dacă angajatul nu a fost identificat corect
      const conditions: string[] = [];

      if (codigo) {
        // Căutăm în ambele câmpuri: id (pentru documente salvate manual) și detected_empleado_id (pentru documente din ingestion)
        conditions.push(
          `(\`id\` = ${this.escapeSql(codigo)} OR \`detected_empleado_id\` = ${this.escapeSql(codigo)})`,
        );
      }

      if (nombre) {
        conditions.push(`\`nombre_empleado\` = ${this.escapeSql(nombre)}`);
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
          fecha_creacion,
          \`Permisso Para Empleado\` as permisso_para_empleado,
          detected_empleado_id,
          status
        FROM \`DocumentosOficiales\`
        WHERE ${whereClause}
        ORDER BY fecha_creacion DESC
      `;

      this.logger.log(
        `📝 Get documentos oficiales query: ${query}... (codigo: ${codigo || 'N/A'}, nombre: ${nombre || 'N/A'})`,
      );

      const documentos = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(
        `✅ Documentos oficiales retrieved: ${documentos.length} records (codigo: ${codigo || 'N/A'}, nombre: ${nombre || 'N/A'})`,
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
        permisso_para_empleado: doc.permisso_para_empleado,
      }));
    } catch (error: any) {
      this.logger.error('❌ Error fetching documentos oficiales:', error);
      throw new BadRequestException(
        `Error al obtener los documentos oficiales: ${error.message}`,
      );
    }
  }

  /**
   * Helper function pentru a obține tipul MIME din extensia fișierului
   */
  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
      case '.pdf':
        return 'application/pdf';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      case '.txt':
        return 'text/plain';
      case '.doc':
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.xls':
      case '.xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Descarcă un document oficial specific după doc_id, id (CODIGO) și/sau email
   * @param documentId - doc_id din tabela DocumentosOficiales
   * @param empleadoId - id (CODIGO) pentru validare (opțional)
   * @param email - email pentru validare (opțional)
   * @param fileName - numele fișierului pentru validare (opțional)
   * @returns Buffer cu conținutul fișierului
   */
  async downloadDocumentoOficial(
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
        FROM \`DocumentosOficiales\`
        WHERE ${whereClause}
        LIMIT 1;
      `.trim();

      this.logger.log(
        `📝 Download documento oficial query: WHERE doc_id = ${documentId}${empleadoId ? ` AND id = ${empleadoId}` : ''}${email ? ` AND correo_electronico = ${email}` : ''}${fileName ? ` AND nombre_archivo = ${fileName}` : ''}`,
      );

      const result = await this.prisma.$queryRawUnsafe<any[]>(query);

      if (!result || result.length === 0) {
        throw new NotFoundException(
          `Documento oficial no encontrado para doc_id=${documentId}`,
        );
      }

      const row = result[0];

      if (row.archivo == null) {
        throw new BadRequestException(
          'Columna "archivo" no está disponible para este documento oficial',
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
      const nombreArchivo =
        row.nombre_archivo || `documento_oficial_${documentId}`;
      const mimeType = this.getMimeType(nombreArchivo);

      this.logger.log(
        `✅ Documento oficial descargado: doc_id=${documentId}, nombre=${nombreArchivo}, tamaño=${archivoBuffer.length} bytes`,
      );

      return {
        archivo: archivoBuffer,
        tipo_mime: mimeType,
        nombre_archivo: nombreArchivo,
      };
    } catch (error: any) {
      this.logger.error('❌ Error downloading documento oficial:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al descargar el documento oficial: ${error.message}`,
      );
    }
  }

  /**
   * Helper function pentru eliminarea diacriticelor din numele fișierului (din n8n snapshot)
   */
  private removeDiacritics(str: string | null | undefined): string {
    if (str == null) return str || '';
    // Map explicit pentru cazurile românești, apoi fallback generic
    const map: { [key: string]: string } = {
      Ș: 'S',
      Ş: 'S',
      ș: 's',
      ş: 's',
      Ț: 'T',
      Ţ: 'T',
      ț: 't',
      ţ: 't',
      Ă: 'A',
      ă: 'a',
      Â: 'A',
      â: 'a',
      Î: 'I',
      î: 'i',
    };
    const result = String(str).replace(
      /[ȘŞșşȚŢțţĂăÂâÎî]/g,
      (ch) => map[ch] || ch,
    );
    // Scoate restul de diacritice (ex. é, ü, ñ etc.)
    return result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Curățare minimă a numelui de fișier, fără a schimba extensia (din n8n snapshot)
   */
  private cleanFilenameKeepExt(name: string | null | undefined): string {
    if (!name) return name || 'archivo';
    const lastDot = name.lastIndexOf('.');
    const base = lastDot > 0 ? name.slice(0, lastDot) : name;
    const ext = lastDot > 0 ? name.slice(lastDot) : '';
    let cleaned = this.removeDiacritics(base);
    // înlocuiește caractere problematice pentru fișiere/SQL (fără a exagera)
    cleaned = cleaned
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned + ext;
  }

  /**
   * Parsează data primită în format MySQL 'YYYY-MM-DD HH:MM:SS' (din n8n snapshot)
   */
  private toMysqlDatetime(v: any): string | null {
    if (!v) return null;
    if (typeof v === 'string') {
      // Format: "28/08/2025, 14:33:49" -> "2025-08-28 14:33:49"
      const m = v.match(
        /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})(?:[ ,T]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
      );
      if (m) {
        const [, dd, mm, yyyy, hh = '00', mi = '00', ss = '00'] = m;
        return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
      }
      const d = new Date(v);
      if (!isNaN(d.getTime()))
        return d.toISOString().slice(0, 19).replace('T', ' ');
    } else if (v instanceof Date) {
      return v.toISOString().slice(0, 19).replace('T', ' ');
    }
    return null;
  }

  /**
   * Upload one or more official documents
   * Accepts multipart/form-data with:
   * - archivo_0, archivo_1, ... (files)
   * - id (empleado_id), correo_electronico, nombre_empleado
   * - fecha_creacion (optional, format: DD/MM/YYYY, HH:MM:SS or ISO)
   * - tipo_documento_0, tipo_documento_1, ... (per file)
   * - nombre_archivo_0, nombre_archivo_1, ... (per file, optional)
   */
  async uploadDocumentoOficial(
    files: Express.Multer.File[],
    body: {
      id?: string;
      empleado_id?: string;
      correo_electronico?: string;
      email?: string;
      nombre_empleado?: string;
      nombre?: string;
      fecha_creacion?: string;
      [key: string]: any; // For indexed fields like tipo_documento_0, nombre_archivo_0, etc.
    },
  ): Promise<{ success: true; processed: number; inserted: number }> {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException(
          'Se requiere al menos un archivo para subir',
        );
      }

      // Extract common fields (with fallbacks like n8n snapshot)
      const id = body.id || body.empleado_id || null;
      const correoElectronico = body.correo_electronico || body.email || null;
      const nombreEmpleado = body.nombre_empleado || body.nombre || null;

      if (!id) {
        throw new BadRequestException('Se requiere "id" o "empleado_id"');
      }

      // Parse fecha_creacion
      const fechaMysql = this.toMysqlDatetime(body.fecha_creacion);

      // Helper to read indexed field with fallback (matches n8n logic)
      const readBodyFieldForIndex = (
        baseName: string,
        idx: number,
        defaultValue: string | null = null,
      ): string | null => {
        if (idx !== null && idx !== undefined) {
          // Try indexed version first (tipo_documento_0, nombre_archivo_0)
          const kIndexed = `${baseName}_${idx}`;
          if (body[kIndexed] !== undefined && body[kIndexed] !== null) {
            return String(body[kIndexed]);
          }
        }
        // Try non-indexed version (tipo_documento, nombre_archivo)
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
        const tipoDoc = readBodyFieldForIndex('tipo_documento', index, null);

        // Get nombre_archivo (with cleaning like n8n snapshot)
        const nombreArchivoRaw =
          readBodyFieldForIndex('nombre_archivo', index, null) ||
          file.originalname ||
          `archivo_${index}`;

        // Clean filename (remove diacritics, problematic characters)
        const nombreArchivo = this.cleanFilenameKeepExt(nombreArchivoRaw);

        // Insert into DocumentosOficiales table
        const query = `
          INSERT INTO \`DocumentosOficiales\` (
            \`id\`,
            \`correo_electronico\`,
            \`tipo_documento\`,
            \`nombre_archivo\`,
            \`nombre_empleado\`,
            \`fecha_creacion\`,
            \`archivo\`
          ) VALUES (
            ${this.escapeSql(id)},
            ${this.escapeSql(correoElectronico)},
            ${this.escapeSql(tipoDoc)},
            ${this.escapeSql(nombreArchivo)},
            ${this.escapeSql(nombreEmpleado)},
            ${fechaMysql ? this.escapeSql(fechaMysql) : 'NOW()'},
            ${file.buffer ? `0x${file.buffer.toString('hex')}` : 'NULL'}
          )
        `;

        try {
          await this.prisma.$executeRawUnsafe(query);
          inserted++;
          processed++;
          this.logger.log(
            `✅ Documento oficial ${index + 1}/${files.length} insertado: ${nombreArchivo} (${file.size} bytes, original: ${nombreArchivoRaw})`,
          );
        } catch (insertError: any) {
          this.logger.error(
            `❌ Error insertando documento oficial ${index + 1}/${files.length}: ${insertError.message}`,
          );
          processed++; // Count as processed even if failed
          throw new BadRequestException(
            `Error al insertar documento oficial ${index + 1}: ${insertError.message}`,
          );
        }
      }

      return { success: true, processed, inserted };
    } catch (error: any) {
      this.logger.error('❌ Error uploading documentos oficiales:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al subir documentos oficiales: ${error.message}`,
      );
    }
  }

  /**
   * Delete a documento oficial by doc_id and nombre_archivo
   * @param docId - doc_id of the documento oficial (primary key, Int)
   * @param nombreArchivo - nombre_archivo (filename) of the documento oficial
   */
  async deleteDocumentoOficial(
    docId: number | string,
    nombreArchivo: string,
  ): Promise<{ success: true; message: string; affectedRows: number }> {
    try {
      // Validate docId
      const docIdNumber =
        typeof docId === 'string' ? parseInt(docId, 10) : docId;
      if (isNaN(docIdNumber) || docIdNumber <= 0) {
        throw new BadRequestException(`Parámetro "id" inválido: ${docId}`);
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
      // Note: n8n snapshot uses CAST(id AS UNSIGNED), but we use doc_id (Int primary key)
      const query = `
        DELETE FROM \`DocumentosOficiales\`
        WHERE doc_id = CAST(${docIdNumber} AS UNSIGNED)
          AND TRIM(nombre_archivo) = TRIM(${this.escapeSql(nombreArchivo.trim())})
        LIMIT 1
      `;

      this.logger.log(
        `🗑️ Delete documento oficial request - doc_id: ${docIdNumber}, nombre_archivo: "${nombreArchivo.trim()}"`,
      );

      const result = await this.prisma.$executeRawUnsafe(query);
      const affectedRows = Number(result) || 0;

      if (affectedRows === 0) {
        throw new NotFoundException(
          `Documento oficial no encontrado para doc_id=${docIdNumber} y nombre_archivo="${nombreArchivo.trim()}"`,
        );
      }

      this.logger.log(
        `✅ Documento oficial eliminado: doc_id=${docIdNumber}, nombre_archivo="${nombreArchivo.trim()}"`,
      );

      return {
        success: true,
        message: 'Archivo eliminado correctamente.',
        affectedRows,
      };
    } catch (error: any) {
      this.logger.error('❌ Error deleting documento oficial:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar el documento oficial: ${error.message}`,
      );
    }
  }

  /**
   * Derive nombre_empleado from filename if missing (from n8n snapshot logic)
   */
  private deriveEmployeeNameFromFilename(
    name: string | null | undefined,
  ): string | null {
    if (!name) return null;
    const base = String(name).replace(/\.[^.]+$/, '');
    const s = base
      .replace(/[_-]+/g, ' ')
      .replace(/\d+/g, ' ')
      .replace(
        /\b(ALTA|BAJA|CONTRATO|FIRMADO|FIRMADA|FIRMA|DIGITAL|ANEXO|DOC|DOCUMENTO|PDF|RENOVACION|RENOVACIÓN|NOMINA|NÓMINA)\b/gi,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim();
    return s || null;
  }

  /**
   * Save signed document from AutoFirma to DocumentosOficiales
   * Accepts body with:
   * - signed_b64: PDF signed in Base64 (required)
   * - id: empleado CODIGO (required)
   * - correo_electronico: employee email
   * - tipo_documento: document type
   * - nombre_archivo: filename (required)
   * - nombre_empleado: employee name (optional, derived from filename if missing)
   * - fecha_creacion: creation date (ISO string or date)
   * - mime: MIME type (optional)
   * - doc_id: ignored (original document ID, not used in insert)
   */
  async saveSignedDocument(body: {
    signed_b64: string;
    id: string;
    correo_electronico?: string;
    tipo_documento?: string;
    nombre_archivo: string;
    nombre_empleado?: string;
    fecha_creacion?: string | Date;
    mime?: string;
    doc_id?: number; // ignored
  }): Promise<{ success: true; message: string; doc_id: number }> {
    try {
      // Validate required fields
      if (!body.signed_b64) {
        throw new BadRequestException(
          'Se requiere "signed_b64" (PDF firmado en Base64)',
        );
      }
      if (!body.id) {
        throw new BadRequestException('Se requiere "id" (CODIGO del empleado)');
      }
      if (!body.nombre_archivo) {
        throw new BadRequestException('Se requiere "nombre_archivo"');
      }

      // Normalize base64 (remove data URI prefix if present)
      let b64 = body.signed_b64;
      if (typeof b64 === 'string') {
        b64 = b64
          .trim()
          .replace(/^data:[^;]+;base64,/i, '')
          .replace(/\s+/g, '');
      }

      if (!b64 || b64.length < 100) {
        throw new BadRequestException(
          '"signed_b64" no es válido o está vacío (se requiere Base64 válido)',
        );
      }

      // Extract fields
      const idPayload = String(body.id).trim();
      const correoElectronico = body.correo_electronico || null;
      const tipoDocumento = body.tipo_documento || null;
      const fileNameRaw = body.nombre_archivo;
      let nombreEmpleado = body.nombre_empleado || null;

      // Derive nombre_empleado from filename if missing
      if (!nombreEmpleado || String(nombreEmpleado).trim() === '') {
        nombreEmpleado = this.deriveEmployeeNameFromFilename(fileNameRaw);
      }

      // Parse fecha_creacion
      const fechaMysql = this.toMysqlDatetime(body.fecha_creacion);

      // Build INSERT query (matching n8n snapshot logic)
      // doc_id is NULL to use autoincrement
      const query = `
        INSERT INTO \`DocumentosOficiales\` (
          doc_id,
          \`id\`,
          correo_electronico,
          tipo_documento,
          nombre_archivo,
          nombre_empleado,
          fecha_creacion,
          archivo
        ) VALUES (
          NULL,
          ${this.escapeSql(idPayload)},
          ${this.escapeSql(correoElectronico)},
          ${this.escapeSql(tipoDocumento)},
          ${this.escapeSql(fileNameRaw)},
          ${this.escapeSql(nombreEmpleado)},
          ${fechaMysql ? this.escapeSql(fechaMysql) : 'NOW()'},
          FROM_BASE64(${this.escapeSql(b64)})
        )
      `.trim();

      this.logger.log(
        `💾 Save signed document request - id: ${idPayload}, nombre_archivo: "${fileNameRaw}", nombre_empleado: "${nombreEmpleado || '(derivado)'}"`,
      );

      // Execute INSERT
      await this.prisma.$executeRawUnsafe(query);

      // Get the inserted doc_id (last insert id)
      const result = await this.prisma.$queryRawUnsafe<
        Array<{ LAST_INSERT_ID: bigint }>
      >('SELECT LAST_INSERT_ID() as LAST_INSERT_ID');
      const docId = Number(result[0]?.LAST_INSERT_ID || 0);

      this.logger.log(
        `✅ Documento firmado guardado: doc_id=${docId}, id="${idPayload}", nombre_archivo="${fileNameRaw}"`,
      );

      return {
        success: true,
        message: 'Documento firmado guardado correctamente.',
        doc_id: docId,
      };
    } catch (error: any) {
      this.logger.error('❌ Error saving signed document:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al guardar el documento firmado: ${error.message}`,
      );
    }
  }

  /**
   * Actualizează câmpul Permisso_Para_Empleado pentru un document oficial
   * @param docId - doc_id din tabela DocumentosOficiales
   * @param permissoParaEmpleado - valoarea pentru Permisso_Para_Empleado ('SI' sau 'NO' sau null)
   */
  async updatePermissoParaEmpleado(
    docId: number | string,
    permissoParaEmpleado: string | null,
  ): Promise<{ success: true; message: string; affectedRows: number }> {
    try {
      // Validate docId
      const docIdNumber =
        typeof docId === 'string' ? parseInt(docId, 10) : docId;
      if (isNaN(docIdNumber) || docIdNumber <= 0) {
        throw new BadRequestException(`Parámetro "docId" inválido: ${docId}`);
      }

      // Validate permissoParaEmpleado (acceptă 'SI', 'NO', null, sau string gol)
      let permissoValue: string | null = null;
      if (permissoParaEmpleado !== null && permissoParaEmpleado !== undefined) {
        const trimmed = String(permissoParaEmpleado).trim().toUpperCase();
        if (
          trimmed === 'SI' ||
          trimmed === 'YES' ||
          trimmed === '1' ||
          trimmed === 'TRUE'
        ) {
          permissoValue = 'SI';
        } else if (
          trimmed === 'NO' ||
          trimmed === '0' ||
          trimmed === 'FALSE' ||
          trimmed === ''
        ) {
          permissoValue = null; // null înseamnă "nu este vizibil"
        } else {
          // Dacă este alt string, îl acceptăm ca atare
          permissoValue = trimmed;
        }
      }

      // Build UPDATE query
      const query = `
        UPDATE \`DocumentosOficiales\`
        SET \`Permisso Para Empleado\` = ${permissoValue ? this.escapeSql(permissoValue) : 'NULL'}
        WHERE doc_id = ${docIdNumber}
        LIMIT 1
      `;

      this.logger.log(
        `🔄 Update Permisso_Para_Empleado request - doc_id: ${docIdNumber}, permisso: ${permissoValue || 'NULL'}`,
      );

      const result = await this.prisma.$executeRawUnsafe(query);
      const affectedRows = Number(result) || 0;

      if (affectedRows === 0) {
        throw new NotFoundException(
          `Documento oficial no encontrado para doc_id=${docIdNumber}`,
        );
      }

      this.logger.log(
        `✅ Permisso_Para_Empleado actualizado: doc_id=${docIdNumber}, permisso=${permissoValue || 'NULL'}`,
      );

      return {
        success: true,
        message: 'Permisso_Para_Empleado actualizado correctamente.',
        affectedRows,
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating Permisso_Para_Empleado:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar Permisso_Para_Empleado: ${error.message}`,
      );
    }
  }
}
