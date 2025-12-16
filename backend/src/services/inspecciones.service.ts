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

      // Convert archivo to Buffer (matching n8n snapshot logic)
      let archivoBuffer: Buffer;
      if (Buffer.isBuffer(row.archivo)) {
        archivoBuffer = row.archivo;
      } else if (
        typeof row.archivo === 'object' &&
        row.archivo?.type === 'Buffer' &&
        Array.isArray(row.archivo.data)
      ) {
        // n8n snapshot logic: reconstruim întâi stringul base64 din array-ul de coduri ASCII
        // apoi reconstruim bufferul din base64
        const base64String = String.fromCharCode(...row.archivo.data);
        archivoBuffer = Buffer.from(base64String, 'base64');
      } else if (typeof row.archivo === 'string') {
        // Dacă vine deja base64, decodează
        archivoBuffer = Buffer.from(row.archivo, 'base64');
      } else {
        throw new BadRequestException(
          'Formato desconocido para el campo "archivo"',
        );
      }

      // Validare: verifică dacă începe cu %PDF- (matching n8n snapshot logic)
      if (!archivoBuffer.slice(0, 5).toString().startsWith('%PDF-')) {
        this.logger.warn(
          `⚠️ Preview first 10 bytes: ${archivoBuffer.slice(0, 10).toString()}`,
        );
        throw new BadRequestException(
          'El archivo decodado desde base64 no comienza con %PDF-',
        );
      }

      // Numele fișierului
      const nombreArchivo = row.nombre_archivo || `inspeccion_${id}.pdf`;
      // Asigură că are extensia .pdf
      const nombreArchivoFinal = nombreArchivo.endsWith('.pdf')
        ? nombreArchivo
        : `${nombreArchivo}.pdf`;

      const mimeType = 'application/pdf';

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
