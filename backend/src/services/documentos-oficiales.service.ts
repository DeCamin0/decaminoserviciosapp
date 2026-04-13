import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import * as path from 'path';

@Injectable()
export class DocumentosOficialesService {
  private readonly logger = new Logger(DocumentosOficialesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
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
   * Obține documentele oficiale pentru un angajat specificat prin codigo (id) și/sau nombre (nombre_empleado)
   */
  async getDocumentosOficiales(
    codigo?: string,
    nombre?: string,
  ): Promise<any[]> {
    try {
      const codigoNorm =
        codigo != null && String(codigo).trim() !== ''
          ? String(codigo).trim()
          : '';
      const nombreNorm =
        nombre != null && String(nombre).trim() !== ''
          ? String(nombre).trim()
          : '';

      if (!codigoNorm && !nombreNorm) {
        throw new BadRequestException('Se requiere al menos codigo o nombre');
      }

      // WHERE aliniat cu portal (`listContratosEmpleadosPortal`): potrivire după CODIGO pe `id`,
      // `detected_empleado_id` sau `confirmed_empleado_id`, cu TRIM (spații / tipuri diferite în UI vs BD).
      // Dacă există `codigo`, nu filtrăm și după `nombre_empleado` — în BD numele poate diferi de
      // `NOMBRE / APELLIDOS` din listă; portalul nu folosește `nombre_empleado` pentru legare.
      const conditions: string[] = [];

      if (codigoNorm) {
        const esc = this.escapeSql(codigoNorm);
        conditions.push(
          `(TRIM(CAST(\`id\` AS CHAR)) = ${esc} OR TRIM(COALESCE(\`detected_empleado_id\`,'')) = ${esc} OR TRIM(COALESCE(\`confirmed_empleado_id\`,'')) = ${esc})`,
        );
      }

      if (nombreNorm && !codigoNorm) {
        conditions.push(
          `TRIM(\`nombre_empleado\`) = ${this.escapeSql(nombreNorm)}`,
        );
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
          necesita_firma,
          detected_empleado_id,
          status
        FROM \`DocumentosOficiales\`
        WHERE ${whereClause}
        ORDER BY fecha_creacion DESC
      `;

      this.logger.log(
        `📝 Get documentos oficiales query: ${query}... (codigo: ${codigoNorm || 'N/A'}, nombre: ${nombreNorm || 'N/A'})`,
      );

      const documentos = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(
        `✅ Documentos oficiales retrieved: ${documentos.length} records (codigo: ${codigoNorm || 'N/A'}, nombre: ${nombreNorm || 'N/A'})`,
      );

      // Mapăm rezultatele la formatul așteptat de frontend
      return documentos.map((doc) => ({
        doc_id:
          doc.doc_id !== undefined && doc.doc_id !== null
            ? Number(doc.doc_id)
            : doc.doc_id,
        id: doc.id,
        correo_electronico: doc.correo_electronico,
        tipo_documento: doc.tipo_documento,
        nombre_archivo: doc.nombre_archivo,
        nombre_empleado: doc.nombre_empleado,
        fecha_creacion: doc.fecha_creacion,
        permisso_para_empleado: doc.permisso_para_empleado,
        necesita_firma: doc.necesita_firma === 1 || doc.necesita_firma === true,
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
        /^(\d{2})[/-](\d{2})[/-](\d{4})(?:[ ,T]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
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

      // Normalize filename using the same method as upload (cleanFilenameKeepExt)
      // This ensures we can find documents even if they were saved with normalized names
      const nombreArchivoNormalized = this.cleanFilenameKeepExt(nombreArchivo);

      this.logger.log(
        `🗑️ Delete documento oficial request - doc_id: ${docIdNumber}, nombre_archivo: "${nombreArchivo.trim()}" (normalized: "${nombreArchivoNormalized}")`,
      );

      // First, check what documents exist with this doc_id for debugging
      const checkQuery = `
        SELECT 
          doc_id,
          id,
          nombre_archivo,
          LENGTH(nombre_archivo) as nombre_length,
          HEX(nombre_archivo) as nombre_hex
        FROM \`DocumentosOficiales\`
        WHERE doc_id = CAST(${docIdNumber} AS UNSIGNED)
        LIMIT 5
      `;

      const existingDocs = await this.prisma.$queryRawUnsafe<any[]>(checkQuery);

      if (existingDocs.length === 0) {
        throw new NotFoundException(
          `Documento oficial no encontrado para doc_id=${docIdNumber}`,
        );
      }

      // Log existing documents for debugging
      this.logger.log(
        `🔍 Found ${existingDocs.length} document(s) with doc_id=${docIdNumber}:`,
      );
      existingDocs.forEach((doc, idx) => {
        this.logger.log(
          `  ${idx + 1}. nombre_archivo: "${doc.nombre_archivo}" (length: ${doc.nombre_length})`,
        );
      });

      // If only one document exists with this doc_id, delete it regardless of filename
      // This handles cases where filename might have slight differences (spaces, encoding, etc.)
      let query: string;
      if (existingDocs.length === 1) {
        this.logger.log(
          `ℹ️ Only one document found with doc_id=${docIdNumber}, deleting by doc_id only`,
        );
        query = `
          DELETE FROM \`DocumentosOficiales\`
          WHERE doc_id = CAST(${docIdNumber} AS UNSIGNED)
          LIMIT 1
        `;
      } else {
        // Multiple documents with same doc_id - need to match by filename
        // Use LIKE for more flexible matching (handles spaces, encoding differences)
        const nombrePattern = nombreArchivoNormalized
          .replace(/%/g, '\\%')
          .replace(/_/g, '\\_');
        query = `
          DELETE FROM \`DocumentosOficiales\`
          WHERE doc_id = CAST(${docIdNumber} AS UNSIGNED)
            AND (
              TRIM(nombre_archivo) = TRIM(${this.escapeSql(nombreArchivoNormalized)})
              OR TRIM(nombre_archivo) = TRIM(${this.escapeSql(nombreArchivo.trim())})
              OR nombre_archivo LIKE ${this.escapeSql(`%${nombrePattern}%`)}
            )
          LIMIT 1
        `;
      }

      const result = await this.prisma.$executeRawUnsafe(query);
      const affectedRows = Number(result) || 0;

      if (affectedRows === 0) {
        // Provide more helpful error message with actual filename from DB
        const actualFilename = existingDocs[0]?.nombre_archivo || 'N/A';
        throw new NotFoundException(
          `Documento oficial no encontrado para doc_id=${docIdNumber} y nombre_archivo="${nombreArchivo.trim()}". ` +
            `Documento existente tiene nombre_archivo: "${actualFilename}"`,
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
    doc_id?: number; // Dacă este prezent, face UPDATE în loc de INSERT
    update_existing?: boolean | number | string; // Flag pentru a forța UPDATE (acceptă boolean, number sau string pentru compatibilitate)
  }): Promise<{ success: true; message: string; doc_id: number }> {
    try {
      // Log imediat ce primește backend-ul
      this.logger.log(
        `🔍 [saveSignedDocument] Request received - id: ${body.id}, nombre_archivo: "${body.nombre_archivo}", update_existing: ${body.update_existing}, doc_id: ${body.doc_id}`,
      );

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

      // Verifică dacă trebuie să facem UPDATE sau INSERT
      this.logger.log(
        `🔍 [saveSignedDocument] Verificando modo de guardado - update_existing: ${body.update_existing}, doc_id: ${body.doc_id}`,
      );

      // Verifică dacă update_existing este boolean true sau un număr valid (pentru compatibilitate)
      const updateExistingFlag =
        body.update_existing === true ||
        body.update_existing === 1 ||
        body.update_existing === 'true' ||
        body.update_existing === '1';
      const shouldUpdate =
        updateExistingFlag && body.doc_id && Number(body.doc_id) > 0;
      const docIdToUpdate = shouldUpdate ? Number(body.doc_id) : null;

      this.logger.log(
        `🔍 [saveSignedDocument] Decisión: shouldUpdate=${shouldUpdate}, docIdToUpdate=${docIdToUpdate}`,
      );

      let finalDocId: number;

      if (shouldUpdate && docIdToUpdate) {
        // UPDATE: Înlocuiește documentul existent cu cel semnat
        // NU schimbăm tipo_documento (rămâne la fel, nu devine "CONTRATO firmado")
        // NU schimbăm necesita_firma (rămâne la fel)
        // NU schimbăm Permisso_Para_Empleado (rămâne la fel)
        // Doar actualizăm archivo (fișierul) cu cel semnat
        const updateQuery = `
          UPDATE \`DocumentosOficiales\`
          SET 
            archivo = FROM_BASE64(${this.escapeSql(b64)}),
            fecha_creacion = ${fechaMysql ? this.escapeSql(fechaMysql) : 'NOW()'}
          WHERE doc_id = ${docIdToUpdate}
        `.trim();

        this.logger.log(
          `💾 Update signed document request - doc_id: ${docIdToUpdate}, id: ${idPayload}, nombre_archivo: "${fileNameRaw}"`,
        );

        try {
          await this.prisma.$executeRawUnsafe(updateQuery);
          finalDocId = docIdToUpdate;
        } catch (updateError: any) {
          this.logger.error(`❌ Error executing UPDATE query:`, updateError);
          this.logger.error(`❌ Query was: ${updateQuery.substring(0, 1000)}`);
          throw updateError;
        }

        this.logger.log(
          `✅ Documento firmado actualizado: doc_id=${finalDocId}, id="${idPayload}", nombre_archivo="${fileNameRaw}"`,
        );

        // IMPORTANT: Nu facem INSERT după UPDATE - returnăm direct
        // Nu continuăm cu logica de INSERT
      } else {
        // INSERT: Creează un document nou (comportament vechi - doar pentru DocumentosPage)
        this.logger.log(
          `⚠️ [saveSignedDocument] Se va hacer INSERT (no UPDATE) - update_existing=${body.update_existing}, doc_id=${body.doc_id}`,
        );
        const query = `
          INSERT INTO \`DocumentosOficiales\` (
            doc_id,
            \`id\`,
            correo_electronico,
            tipo_documento,
            nombre_archivo,
            nombre_empleado,
            fecha_creacion,
            archivo,
            necesita_firma,
            \`Permisso Para Empleado\`
          ) VALUES (
            NULL,
            ${this.escapeSql(idPayload)},
            ${this.escapeSql(correoElectronico)},
            ${this.escapeSql(tipoDocumento)},
            ${this.escapeSql(fileNameRaw)},
            ${this.escapeSql(nombreEmpleado)},
            ${fechaMysql ? this.escapeSql(fechaMysql) : 'NOW()'},
            FROM_BASE64(${this.escapeSql(b64)}),
            0,
            'SI'
          )
        `.trim();

        this.logger.log(
          `💾 Save signed document request - id: ${idPayload}, nombre_archivo: "${fileNameRaw}", nombre_empleado: "${nombreEmpleado || '(derivado)'}"`,
        );

        try {
          await this.prisma.$executeRawUnsafe(query);
        } catch (insertError: any) {
          this.logger.error(`❌ Error executing INSERT query:`, insertError);
          this.logger.error(`❌ Query was: ${query.substring(0, 1000)}`);
          throw insertError;
        }

        // Get the inserted doc_id (last insert id)
        const result = await this.prisma.$queryRawUnsafe<
          Array<{ LAST_INSERT_ID: bigint }>
        >('SELECT LAST_INSERT_ID() as LAST_INSERT_ID');
        finalDocId = Number(result[0]?.LAST_INSERT_ID || 0);

        this.logger.log(
          `✅ Documento firmado guardado: doc_id=${finalDocId}, id="${idPayload}", nombre_archivo="${fileNameRaw}"`,
        );
      }

      // Trimite notificare Telegram către gestoria
      try {
        if (this.telegramService.isConfigured()) {
          const fechaFormateada = new Date().toLocaleDateString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });

          // Escape-uiește caracterele speciale Markdown pentru Telegram
          const escapeMarkdown = (text: string): string => {
            if (!text) return text || 'N/A';
            return String(text)
              .replace(/_/g, '\\_')
              .replace(/\*/g, '\\*')
              .replace(/\[/g, '\\[')
              .replace(/\]/g, '\\]')
              .replace(/\(/g, '\\(')
              .replace(/\)/g, '\\)')
              .replace(/~/g, '\\~')
              .replace(/`/g, '\\`')
              .replace(/>/g, '\\>')
              .replace(/#/g, '\\#')
              .replace(/\+/g, '\\+')
              .replace(/=/g, '\\=')
              .replace(/\|/g, '\\|')
              .replace(/\{/g, '\\{')
              .replace(/\}/g, '\\}')
              .replace(/\./g, '\\.')
              .replace(/!/g, '\\!');
          };

          const nombreEmpleadoEscaped = escapeMarkdown(nombreEmpleado || 'N/A');
          const codigoEscaped = escapeMarkdown(idPayload);
          const fileNameEscaped = escapeMarkdown(fileNameRaw);
          const tipoEscaped = escapeMarkdown(
            tipoDocumento || 'Documento Oficial',
          );

          // Determină dacă este semnat de firmă (UPDATE) sau de angajat (INSERT)
          const esFirmadoPorEmpresa = shouldUpdate;
          const firmadoPor = esFirmadoPorEmpresa
            ? '🏢 *Firmado por:* Empresa'
            : '👤 *Firmado por:* Empleado';

          this.logger.log(
            `🔍 [Telegram] shouldUpdate=${shouldUpdate}, esFirmadoPorEmpresa=${esFirmadoPorEmpresa}, firmadoPor="${firmadoPor}"`,
          );

          const telegramMessage = `✍️ *Documento Firmado*

${firmadoPor}
👤 *Empleado:* ${nombreEmpleadoEscaped}
📋 *Código:* ${codigoEscaped}
📄 *Archivo:* ${fileNameEscaped}
📝 *Tipo:* ${tipoEscaped}
📅 *Fecha:* ${fechaFormateada}
🆔 *Doc ID:* ${String(finalDocId)}

✅ El documento ha sido firmado y guardado exitosamente.`;

          this.logger.log(
            `🔍 [Telegram] Message to send (first 200 chars): ${telegramMessage.substring(0, 200)}`,
          );

          await this.telegramService.sendMessage(telegramMessage);
          this.logger.log(
            `✅ Notificación Telegram enviada a gestoria para documento firmado ${esFirmadoPorEmpresa ? 'por empresa' : 'por empleado'}: ${fileNameRaw}`,
          );
        } else {
          this.logger.warn(
            '⚠️ Telegram service no configurado, no se envió notificación',
          );
        }
      } catch (telegramError: any) {
        this.logger.warn(
          `⚠️ Error enviando notificación Telegram (non-blocking): ${telegramError.message}`,
        );
        // Nu aruncăm eroarea pentru a nu bloca salvarea documentului
      }

      return {
        success: true,
        message: 'Documento firmado guardado correctamente.',
        doc_id: finalDocId,
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

  /**
   * Actualizează câmpul necesita_firma pentru un document oficial
   * @param docId - doc_id din tabela DocumentosOficiales
   * @param necesitaFirma - valoarea boolean pentru necesita_firma
   */
  async updateNecesitaFirma(
    docId: number | string,
    necesitaFirma: boolean,
  ): Promise<{ success: true; message: string; affectedRows: number }> {
    try {
      // Validate docId
      const docIdNumber =
        typeof docId === 'string' ? parseInt(docId, 10) : docId;
      if (isNaN(docIdNumber) || docIdNumber <= 0) {
        throw new BadRequestException(`Parámetro "docId" inválido: ${docId}`);
      }

      // Convert boolean to MySQL TINYINT (0 or 1)
      const necesitaFirmaValue = necesitaFirma ? 1 : 0;

      // Build UPDATE query
      const query = `
        UPDATE \`DocumentosOficiales\`
        SET necesita_firma = ${necesitaFirmaValue}
        WHERE doc_id = ${docIdNumber}
        LIMIT 1
      `;

      this.logger.log(
        `🔄 Update necesita_firma request - doc_id: ${docIdNumber}, necesita_firma: ${necesitaFirmaValue}`,
      );

      const result = await this.prisma.$executeRawUnsafe(query);
      const affectedRows = Number(result) || 0;

      if (affectedRows === 0) {
        throw new NotFoundException(
          `Documento oficial no encontrado para doc_id=${docIdNumber}`,
        );
      }

      this.logger.log(
        `✅ necesita_firma actualizado: doc_id=${docIdNumber}, necesita_firma=${necesitaFirmaValue}`,
      );

      return {
        success: true,
        message: 'necesita_firma actualizado correctamente.',
        affectedRows,
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating necesita_firma:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar necesita_firma: ${error.message}`,
      );
    }
  }

  /**
   * Marchează un contract ca fiind semnat (actualizează tipo_documento la "CONTRATO firmado",
   * necesita_firma la false și Permisso_Para_Empleado la 'SI')
   * @param docId - doc_id din tabela DocumentosOficiales
   */
  async marcarContratoComoFirmado(
    docId: number | string,
  ): Promise<{ success: true; message: string; affectedRows: number }> {
    try {
      // Validate docId
      const docIdNumber =
        typeof docId === 'string' ? parseInt(docId, 10) : docId;
      if (isNaN(docIdNumber) || docIdNumber <= 0) {
        throw new BadRequestException(`Parámetro "docId" inválido: ${docId}`);
      }

      // Build UPDATE query - actualizează tipo_documento, necesita_firma și Permisso_Para_Empleado
      const query = `
        UPDATE \`DocumentosOficiales\`
        SET 
          tipo_documento = ${this.escapeSql('CONTRATO firmado')},
          necesita_firma = 0,
          \`Permisso Para Empleado\` = 'SI'
        WHERE doc_id = ${docIdNumber}
        LIMIT 1
      `;

      this.logger.log(
        `🔄 Marcar contrato como firmado - doc_id: ${docIdNumber}`,
      );

      const result = await this.prisma.$executeRawUnsafe(query);
      const affectedRows = Number(result) || 0;

      if (affectedRows === 0) {
        throw new NotFoundException(
          `Documento oficial no encontrado para doc_id=${docIdNumber}`,
        );
      }

      this.logger.log(
        `✅ Contrato marcado como firmado: doc_id=${docIdNumber}`,
      );

      return {
        success: true,
        message: 'Contrato marcado como firmado correctamente.',
        affectedRows,
      };
    } catch (error: any) {
      this.logger.error('❌ Error marcando contrato como firmado:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al marcar el contrato como firmado: ${error.message}`,
      );
    }
  }

  /**
   * Obține lista tuturor angajaților cu statusul contractelor lor (CONTRATO / CONTRATO firmado)
   */
  async getEmpleadosConStatusContratos(): Promise<
    Array<{
      codigo: string;
      nombre: string;
      email: string;
      estado: string | null;
      tiene_contrato: boolean;
      tiene_contrato_firmado: boolean;
      fecha_contrato?: string;
      fecha_contrato_firmado?: string;
    }>
  > {
    try {
      // Obține toți angajații din DatosEmpleados cu statusul lor
      const empleadosQuery = `
        SELECT 
          CODIGO as codigo,
          \`NOMBRE / APELLIDOS\` as nombre,
          \`CORREO ELECTRONICO\` as email,
          ESTADO as estado
        FROM \`DatosEmpleados\`
        WHERE CODIGO IS NOT NULL AND CODIGO != ''
        ORDER BY \`NOMBRE / APELLIDOS\`
      `;

      const empleados =
        await this.prisma.$queryRawUnsafe<any[]>(empleadosQuery);

      this.logger.log(
        `📝 Get empleados con status contratos - Found ${empleados.length} empleados`,
      );

      // Pentru fiecare angajat, verifică dacă are CONTRATO sau CONTRATO firmado
      const empleadosConStatus = await Promise.all(
        empleados.map(async (empleado) => {
          const codigo = String(empleado.codigo || '').trim();
          if (!codigo) {
            return null;
          }

          // Verifică dacă are CONTRATO (nu firmado)
          const contratoQuery = `
            SELECT doc_id, tipo_documento, fecha_creacion
            FROM \`DocumentosOficiales\`
            WHERE (\`id\` = ${this.escapeSql(codigo)} OR \`detected_empleado_id\` = ${this.escapeSql(codigo)})
              AND tipo_documento = 'CONTRATO'
            ORDER BY fecha_creacion DESC
            LIMIT 1
          `;

          // Verifică dacă are CONTRATO firmado
          const contratoFirmadoQuery = `
            SELECT doc_id, tipo_documento, fecha_creacion
            FROM \`DocumentosOficiales\`
            WHERE (\`id\` = ${this.escapeSql(codigo)} OR \`detected_empleado_id\` = ${this.escapeSql(codigo)})
              AND tipo_documento = 'CONTRATO firmado'
            ORDER BY fecha_creacion DESC
            LIMIT 1
          `;

          const [contratos, contratosFirmados] = await Promise.all([
            this.prisma.$queryRawUnsafe<any[]>(contratoQuery),
            this.prisma.$queryRawUnsafe<any[]>(contratoFirmadoQuery),
          ]);

          return {
            codigo,
            nombre: empleado.nombre || 'Sin nombre',
            email: empleado.email || 'Sin email',
            estado: empleado.estado || null,
            tiene_contrato: contratos.length > 0,
            tiene_contrato_firmado: contratosFirmados.length > 0,
            fecha_contrato:
              contratos.length > 0 ? contratos[0].fecha_creacion : undefined,
            fecha_contrato_firmado:
              contratosFirmados.length > 0
                ? contratosFirmados[0].fecha_creacion
                : undefined,
          };
        }),
      );

      // Filtrează null-urile
      const resultado = empleadosConStatus.filter((e) => e !== null);

      this.logger.log(
        `✅ Empleados con status contratos: ${resultado.length} empleados procesados`,
      );

      return resultado;
    } catch (error: any) {
      this.logger.error(
        '❌ Error getting empleados con status contratos:',
        error,
      );
      throw new BadRequestException(
        `Error al obtener empleados con status de contratos: ${error.message}`,
      );
    }
  }

  /**
   * Numără documentele oficiale care necesită firmă și sunt vizibile pentru un angajat
   * @param codigo - Codigo (id) al angajatului
   * @returns Numărul de documente care necesită firmă
   */
  async countDocumentosNecesitanFirma(codigo: string): Promise<number> {
    try {
      if (!codigo) {
        return 0;
      }

      const query = `
        SELECT COUNT(*) as count
        FROM \`DocumentosOficiales\`
        WHERE (
          \`id\` = ${this.escapeSql(codigo)} 
          OR \`detected_empleado_id\` = ${this.escapeSql(codigo)}
        )
        AND \`necesita_firma\` = 1
        AND \`Permisso Para Empleado\` = 'SI'
      `;

      this.logger.log(
        `📊 Count documentos que necesitan firma - codigo: ${codigo}`,
      );

      const result =
        await this.prisma.$queryRawUnsafe<[{ count: bigint }]>(query);

      const count = result[0]?.count ? Number(result[0].count) : 0;

      this.logger.log(
        `✅ Documentos que necesitan firma: ${count} (codigo: ${codigo})`,
      );

      return count;
    } catch (error: any) {
      this.logger.error(
        `❌ Error counting documentos que necesitan firma: ${error.message}`,
      );
      return 0;
    }
  }
}
