import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InspeccionesService {
  private readonly logger = new Logger(InspeccionesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get inspecciones for a specific empleado by codigo_empleado
   * @param codigoEmpleado - CODIGO of the empleado
   */
  async getMisInspecciones(codigoEmpleado: string): Promise<
    Array<{
      id: string;
      tipo_inspeccion: string | null;
      codigo_empleado: string | null;
      nombre_empleado: string | null;
      archivo: Buffer | null;
      nombre_archivo: string | null;
      fecha_subida: string | null;
      Nombre_Supervisor: string | null;
      Centro: string | null;
      Locacion: string | null;
    }>
  > {
    try {
      if (!codigoEmpleado || codigoEmpleado.trim() === '') {
        throw new BadRequestException(
          'Se requiere "codigo_empleado" (query parameter)',
        );
      }

      this.logger.log(
        `📝 Get mis inspecciones request - codigo_empleado: ${codigoEmpleado}`,
      );

      // Execute query matching n8n snapshot logic (using Prisma escape for security)
      const escapedCodigo = this.escapeSql(codigoEmpleado.trim());
      const query = `
        SELECT 
          id,
          tipo_inspeccion,
          codigo_empleado,
          nombre_empleado,
          archivo,
          nombre_archivo,
          fecha_subida,
          \`Nombre Supervisor\`,
          Centro,
          Locacion
        FROM InspeccionesDocumentos
        WHERE codigo_empleado = ${escapedCodigo}
        ORDER BY fecha_subida DESC
      `;

      const results = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          tipo_inspeccion: string | null;
          codigo_empleado: string | null;
          nombre_empleado: string | null;
          archivo: Buffer | null;
          nombre_archivo: string | null;
          fecha_subida: string | null;
          'Nombre Supervisor': string | null;
          Centro: string | null;
          Locacion: string | null;
        }>
      >(query);

      // Map results to match expected format (convert 'Nombre Supervisor' to Nombre_Supervisor)
      const mappedResults = results.map((row) => ({
        id: row.id,
        tipo_inspeccion: row.tipo_inspeccion,
        codigo_empleado: row.codigo_empleado,
        nombre_empleado: row.nombre_empleado,
        archivo: row.archivo,
        nombre_archivo: row.nombre_archivo,
        fecha_subida: row.fecha_subida,
        Nombre_Supervisor: row['Nombre Supervisor'] || null,
        Centro: row.Centro,
        Locacion: row.Locacion,
      }));

      this.logger.log(
        `✅ Found ${mappedResults.length} inspecciones for codigo_empleado: ${codigoEmpleado}`,
      );

      return mappedResults;
    } catch (error: any) {
      this.logger.error('❌ Error getting mis inspecciones:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener las inspecciones: ${error.message}`,
      );
    }
  }

  /**
   * Get all inspecciones (lista completă) - pentru manageri/supervizori
   * Similar cu snapshot-ul extraerinspeciones.json
   */
  async getAllInspecciones(): Promise<
    Array<{
      id: string;
      tipo_inspeccion: string | null;
      codigo_empleado: string | null;
      nombre_empleado: string | null;
      nombre_archivo: string | null;
      fecha_subida: string | null;
      Nombre_Supervisor: string | null;
      Centro: string | null;
      Locacion: string | null;
    }>
  > {
    try {
      this.logger.log('📝 Get all inspecciones request (lista completă)');

      const query = `
        SELECT
          id,
          tipo_inspeccion,
          codigo_empleado,
          nombre_empleado,
          nombre_archivo,
          fecha_subida,
          \`Nombre Supervisor\`,
          Centro,
          Locacion
        FROM InspeccionesDocumentos
        ORDER BY fecha_subida DESC
      `;

      const results = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          tipo_inspeccion: string | null;
          codigo_empleado: string | null;
          nombre_empleado: string | null;
          nombre_archivo: string | null;
          fecha_subida: string | null;
          'Nombre Supervisor': string | null;
          Centro: string | null;
          Locacion: string | null;
        }>
      >(query);

      // Map results to match expected format
      const mappedResults = results.map((row) => ({
        id: row.id,
        tipo_inspeccion: row.tipo_inspeccion,
        codigo_empleado: row.codigo_empleado,
        nombre_empleado: row.nombre_empleado,
        nombre_archivo: row.nombre_archivo,
        fecha_subida: row.fecha_subida,
        Nombre_Supervisor: row['Nombre Supervisor'] || null,
        Centro: row.Centro,
        Locacion: row.Locacion,
      }));

      this.logger.log(`✅ Found ${mappedResults.length} total inspecciones`);

      return mappedResults;
    } catch (error: any) {
      this.logger.error('❌ Error getting all inspecciones:', error);
      throw new BadRequestException(
        `Error al obtener las inspecciones: ${error.message}`,
      );
    }
  }

  /**
   * Create a new inspeccion
   * @param body - Request body with inspeccion data
   */
  async createInspeccion(
    body: any,
  ): Promise<{ success: boolean; message: string; id?: string }> {
    try {
      this.logger.log('📝 Create inspeccion request');

      // Extract data from body (matching n8n snapshot logic)
      const inspeccionId =
        body.nr ||
        body.meta?.numeroInspeccion ||
        body.inspeccionId ||
        'FARA_ID';
      const timestamp = body.data
        ? new Date(body.data).toISOString()
        : new Date().toISOString();
      const nombreInspector =
        body.supervisor || body.inspector?.nume || 'necunoscut';
      const nombreArchivo = body.nr || 'default';
      const tipoInspeccion = body.type || 'necunoscut';
      const empleadoNombre = body.trabajador?.nume || '';
      const codigoEmpleado = body.codigo_empleado || '';
      const centroTrabajo = body.centro || '';
      const locatie = body.locatie || '';

      // PDF base64 - convert to Buffer
      let pdfBuffer: Buffer | null = null;
      if (body.pdfBase64 || body.pdf) {
        const base64String = body.pdfBase64 || body.pdf;
        // Remove data:application/pdf;base64, prefix if present
        const base64Data = base64String.includes(',')
          ? base64String.split(',')[1]
          : base64String;
        pdfBuffer = Buffer.from(base64Data, 'base64');
      }

      // Validate required fields
      if (!inspeccionId || inspeccionId === 'FARA_ID') {
        throw new BadRequestException(
          'Se requiere "nr" o "inspeccionId" en el body',
        );
      }

      if (!pdfBuffer) {
        throw new BadRequestException(
          'Se requiere "pdfBase64" o "pdf" en el body',
        );
      }

      this.logger.log(`📝 Creating inspeccion with ID: ${inspeccionId}`);

      // Check if inspeccion already exists
      const existing = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM InspeccionesDocumentos WHERE id = ${this.escapeSql(inspeccionId)}`,
      );

      if (existing && existing.length > 0) {
        this.logger.warn(
          `⚠️ Inspeccion with ID ${inspeccionId} already exists`,
        );
        throw new BadRequestException('Esta inspección ya existe');
      }

      // Insert inspeccion into database
      // Use Prisma raw query to match n8n snapshot behavior
      const query = `
        INSERT INTO InspeccionesDocumentos (
          id,
          tipo_inspeccion,
          codigo_empleado,
          nombre_empleado,
          archivo,
          nombre_archivo,
          fecha_subida,
          \`Nombre Supervisor\`,
          Centro,
          Locacion
        ) VALUES (
          ${this.escapeSql(inspeccionId)},
          ${this.escapeSql(tipoInspeccion)},
          ${this.escapeSql(codigoEmpleado)},
          ${this.escapeSql(empleadoNombre)},
          ${pdfBuffer ? `0x${pdfBuffer.toString('hex')}` : 'NULL'},
          ${this.escapeSql(nombreArchivo)},
          ${this.escapeSql(timestamp)},
          ${this.escapeSql(nombreInspector)},
          ${this.escapeSql(centroTrabajo)},
          ${this.escapeSql(locatie)}
        )
      `;

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(
        `✅ Inspeccion created successfully with ID: ${inspeccionId}`,
      );

      return {
        success: true,
        message: 'Inspección creada exitosamente',
        id: inspeccionId,
      };
    } catch (error: any) {
      this.logger.error('❌ Error creating inspeccion:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al crear la inspección: ${error.message}`,
      );
    }
  }

  /**
   * Download inspeccion PDF by id
   * @param id - Inspeccion ID (string)
   */
  async downloadInspeccion(id: string): Promise<{
    archivo: Buffer;
    tipo_mime: string;
    nombre_archivo: string;
  }> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Se requiere "id" (query parameter)');
      }

      this.logger.log(`📥 Download inspeccion request - id: ${id}`);

      const escapedId = this.escapeSql(id.trim());

      // Query matching n8n snapshot logic
      const query = `
        SELECT 
          nombre_archivo,
          archivo
        FROM InspeccionesDocumentos
        WHERE id = ${escapedId}
        LIMIT 1
      `;

      const result = await this.prisma.$queryRawUnsafe<
        Array<{
          nombre_archivo: string | null;
          archivo: Buffer | { type: 'Buffer'; data: number[] } | string | null;
        }>
      >(query);

      if (!result || result.length === 0) {
        throw new NotFoundException(`Inspección no encontrada para id=${id}`);
      }

      const row = result[0];

      if (row.archivo == null) {
        throw new BadRequestException(
          'Columna "archivo" no está disponible para esta inspección',
        );
      }

      // 🔍 LOGGING: Tipul și conținutul inițial al lui row.archivo
      this.logger.log(
        `🔍 [DEBUG] row.archivo type: ${typeof row.archivo}, isBuffer: ${Buffer.isBuffer(row.archivo)}`,
      );
      if (typeof row.archivo === 'object' && row.archivo !== null) {
        this.logger.log(
          `🔍 [DEBUG] row.archivo object keys: ${Object.keys(row.archivo).join(', ')}`,
        );
        if ('type' in row.archivo) {
          this.logger.log(
            `🔍 [DEBUG] row.archivo.type: ${(row.archivo as any).type}`,
          );
        }
        if ('data' in row.archivo && Array.isArray((row.archivo as any).data)) {
          const dataArray = (row.archivo as any).data;
          this.logger.log(
            `🔍 [DEBUG] row.archivo.data length: ${dataArray.length}, first 20 values: ${dataArray.slice(0, 20).join(', ')}`,
          );
        }
      } else if (typeof row.archivo === 'string') {
        const previewStr = row.archivo.substring(0, 50);
        this.logger.log(
          `🔍 [DEBUG] row.archivo string length: ${row.archivo.length}, preview (first 50 chars): ${previewStr}`,
        );
      } else if (Buffer.isBuffer(row.archivo)) {
        this.logger.log(
          `🔍 [DEBUG] row.archivo Buffer length: ${row.archivo.length}, first 20 bytes (hex): ${row.archivo.slice(0, 20).toString('hex')}, first 20 bytes (ascii): ${row.archivo.slice(0, 20).toString('ascii')}`,
        );
      }

      // Convert archivo to Buffer (matching n8n snapshot logic)
      // IMPORTANT: MySQL/Prisma poate returna datele ca Buffer care conține base64 string,
      // sau ca string base64, sau ca binary data. Trebuie să detectăm și să decodăm corect.
      let archivoBuffer: Buffer;
      if (Buffer.isBuffer(row.archivo)) {
        this.logger.log(`🔍 [DEBUG] Branch: Buffer.isBuffer = true`);
        // Verificăm dacă Bufferul conține base64 (începe cu caractere base64 valide)
        const bufferAsString = row.archivo.toString('utf8');
        const firstChars = bufferAsString.substring(0, 20);
        // Dacă primele caractere sunt base64 valide (A-Za-z0-9+/=) și nu începe cu %PDF-,
        // înseamnă că Bufferul conține base64 string, nu binary data
        const isBase64InBuffer =
          /^[A-Za-z0-9+/=]+$/.test(firstChars.trim()) &&
          !firstChars.trim().startsWith('%PDF-') &&
          !firstChars.trim().startsWith('\x89PNG') && // PNG magic bytes
          !firstChars.trim().startsWith('\xFF\xD8'); // JPEG magic bytes

        if (isBase64InBuffer) {
          this.logger.log(
            `🔍 [DEBUG] Buffer contains base64 string, decoding...`,
          );
          archivoBuffer = Buffer.from(bufferAsString.trim(), 'base64');
        } else {
          // Bufferul conține deja binary data
          this.logger.log(
            `🔍 [DEBUG] Buffer contains binary data, using directly...`,
          );
          archivoBuffer = row.archivo;
        }
      } else if (
        typeof row.archivo === 'object' &&
        row.archivo?.type === 'Buffer' &&
        Array.isArray(row.archivo.data)
      ) {
        this.logger.log(
          `🔍 [DEBUG] Branch: object with type='Buffer' and data array`,
        );
        // n8n snapshot logic: reconstruim întâi stringul base64 din array-ul de coduri ASCII
        // apoi reconstruim bufferul din base64
        const base64String = String.fromCharCode(...row.archivo.data);
        this.logger.log(
          `🔍 [DEBUG] base64String length: ${base64String.length}, preview (first 50 chars): ${base64String.substring(0, 50)}`,
        );
        archivoBuffer = Buffer.from(base64String, 'base64');
        this.logger.log(
          `🔍 [DEBUG] After Buffer.from(base64String, 'base64'): length=${archivoBuffer.length}, first 20 bytes (hex): ${archivoBuffer.slice(0, 20).toString('hex')}, first 20 bytes (ascii): ${archivoBuffer.slice(0, 20).toString('ascii')}`,
        );
      } else if (typeof row.archivo === 'string') {
        this.logger.log(`🔍 [DEBUG] Branch: string`);
        // Verificăm dacă stringul este deja base64 sau dacă este binary data
        // Dacă începe cu caractere base64 valide și nu începe cu %PDF-, înseamnă că este base64
        const trimmed = row.archivo.trim();
        const isBase64 =
          /^[A-Za-z0-9+/=]+$/.test(trimmed) &&
          !trimmed.startsWith('%PDF-') &&
          !trimmed.startsWith('\x89PNG') &&
          !trimmed.startsWith('\xFF\xD8');

        if (isBase64) {
          this.logger.log(
            `🔍 [DEBUG] String appears to be base64, decoding...`,
          );
          archivoBuffer = Buffer.from(trimmed, 'base64');
        } else {
          // Dacă nu este base64, poate este deja binary data ca string
          this.logger.log(
            `🔍 [DEBUG] String appears to be binary data, converting directly...`,
          );
          archivoBuffer = Buffer.from(row.archivo, 'binary');
        }

        this.logger.log(
          `🔍 [DEBUG] After conversion: length=${archivoBuffer.length}, first 20 bytes (hex): ${archivoBuffer.slice(0, 20).toString('hex')}, first 20 bytes (ascii): ${archivoBuffer.slice(0, 20).toString('ascii')}`,
        );
      } else {
        this.logger.error(
          `🔍 [DEBUG] Branch: UNKNOWN FORMAT - typeof=${typeof row.archivo}`,
        );
        throw new BadRequestException(
          'Formato desconocido para el campo "archivo"',
        );
      }

      // Nu mai validăm strict pentru %PDF- - acceptăm orice tip de fișier
      // (PDF, imagini, documente, etc.)

      // Detectăm tipul MIME din extensie sau din magic bytes
      const nombreArchivo = row.nombre_archivo || `inspeccion_${id}`;
      const extension = nombreArchivo.split('.').pop()?.toLowerCase() || '';

      // Detectăm tipul MIME din magic bytes (primele bytes ale fișierului)
      let mimeType = 'application/octet-stream'; // default
      const firstBytes = archivoBuffer.slice(0, 10);
      const firstBytesHex = firstBytes.toString('hex');
      const firstBytesAscii = firstBytes.toString('ascii');
      const firstBytesBinary = firstBytes.toString('binary');

      // 🔍 LOGGING: Verificare finală
      this.logger.log(
        `🔍 [DEBUG] archivoBuffer final - length: ${archivoBuffer.length}, first 10 bytes (hex): ${firstBytesHex}, first 10 bytes (ascii): ${firstBytesAscii}, first 10 bytes (binary): ${firstBytesBinary}`,
      );

      // Verificăm magic bytes pentru diferite tipuri de fișiere
      if (firstBytesAscii.startsWith('%PDF-')) {
        mimeType = 'application/pdf';
      } else if (firstBytesHex.startsWith('89504e47')) {
        // PNG: \x89PNG
        mimeType = 'image/png';
      } else if (firstBytesHex.startsWith('ffd8ff')) {
        // JPEG: \xFF\xD8\xFF
        mimeType = 'image/jpeg';
      } else if (firstBytesHex.startsWith('47494638')) {
        // GIF: GIF8
        mimeType = 'image/gif';
      } else if (firstBytesHex.startsWith('52494646')) {
        // WEBP: RIFF
        mimeType = 'image/webp';
      } else {
        // Fallback la extensie dacă magic bytes nu se potrivesc
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
        mimeType = mimeTypes[extension] || 'application/octet-stream';
      }

      // Numele fișierului final - păstrăm extensia originală sau adăugăm una bazată pe MIME type
      let nombreArchivoFinal = nombreArchivo;
      if (!nombreArchivo.includes('.')) {
        // Dacă nu are extensie, adăugăm una bazată pe MIME type
        const extensionMap: { [key: string]: string } = {
          'application/pdf': 'pdf',
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/gif': 'gif',
          'image/webp': 'webp',
          'text/plain': 'txt',
          'application/msword': 'doc',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            'docx',
          'application/vnd.ms-excel': 'xls',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            'xlsx',
        };
        const ext = extensionMap[mimeType] || 'bin';
        nombreArchivoFinal = `${nombreArchivo}.${ext}`;
      }

      this.logger.log(
        `✅ Inspección descargada: id=${id}, nombre=${nombreArchivoFinal}, tamaño=${archivoBuffer.length} bytes`,
      );

      return {
        archivo: archivoBuffer,
        tipo_mime: mimeType,
        nombre_archivo: nombreArchivoFinal,
      };
    } catch (error: any) {
      this.logger.error('❌ Error downloading inspeccion:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al descargar la inspección: ${error.message}`,
      );
    }
  }

  private escapeSql(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    // Escape single quotes and escape characters
    const escaped = String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }
}
