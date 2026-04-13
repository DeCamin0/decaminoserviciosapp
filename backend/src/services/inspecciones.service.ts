import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { EmpleadoGrupoScopeService } from './empleado-grupo-scope.service';

@Injectable()
export class InspeccionesService {
  private readonly logger = new Logger(InspeccionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly empleadoGrupoScopeService: EmpleadoGrupoScopeService,
  ) {}

  /** Filtro SQL sobre codigo_empleado; sin ámbito = sin filtro. */
  private buildCodigoEmpleadoScopeSql(
    columnExpr: string,
    allowedCodigos: string[] | null | undefined,
  ): string {
    if (!allowedCodigos) return '1=1';
    const list = allowedCodigos
      .map((c) => String(c).trim())
      .filter((c) => c.length > 0);
    if (list.length === 0) return '1=0';
    return `${columnExpr} IN (${list.map((c) => this.escapeSql(c)).join(', ')})`;
  }

  /**
   * Get inspecciones for a specific empleado by codigo_empleado
   * @param codigoEmpleado - CODIGO of the empleado
   */
  async getMisInspecciones(
    codigoEmpleado: string,
    allowedCodigos?: string[] | null,
  ): Promise<
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
      scor_total: number | null;
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

      this.empleadoGrupoScopeService.assertCodigoEnAmbito(
        allowedCodigos ?? null,
        codigoEmpleado,
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
          Locacion,
          scor_total
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
          scor_total: number | null;
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
        scor_total: row.scor_total !== null ? Number(row.scor_total) : null,
      }));

      this.logger.log(
        `✅ Found ${mappedResults.length} inspecciones for codigo_empleado: ${codigoEmpleado}`,
      );

      return mappedResults;
    } catch (error: any) {
      this.logger.error('❌ Error getting mis inspecciones:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
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
  async getAllInspecciones(allowedCodigos?: string[] | null): Promise<
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
      observaciones: string | null;
      scor_total: number | null;
    }>
  > {
    try {
      this.logger.log('📝 Get all inspecciones request (lista completă)');

      const scopeWhere = this.buildCodigoEmpleadoScopeSql(
        'codigo_empleado',
        allowedCodigos,
      );
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
          Locacion,
          observaciones,
          scor_total
        FROM InspeccionesDocumentos
        WHERE (${scopeWhere})
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
          observaciones: string | null;
          scor_total: number | null;
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
        observaciones: row.observaciones || null,
        scor_total: row.scor_total !== null ? Number(row.scor_total) : null,
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
    allowedCodigos?: string[] | null,
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
      const codigoSupervisor =
        body.supervisor_codigo || body.codigo_supervisor || null;
      const nombreArchivo = body.nr || 'default';
      const tipoInspeccion = body.type || 'necunoscut';
      const empleadoNombre = body.trabajador?.nume || '';
      const codigoEmpleado = body.codigo_empleado || '';
      const centroTrabajo = body.centro || '';
      const locatie = body.locatie || '';
      // Scorul total: media tuturor scorurilor (rango + calidad) pentru toate punctele
      const scorTotal = body.scor_total || null;

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

      const codigoEmpTrim = String(codigoEmpleado || '').trim();
      if (allowedCodigos) {
        if (!codigoEmpTrim) {
          throw new ForbiddenException(
            'Con ámbito restringido se requiere codigo_empleado del inspeccionado.',
          );
        }
        this.empleadoGrupoScopeService.assertCodigoEnAmbito(
          allowedCodigos,
          codigoEmpTrim,
        );
      }

      this.logger.log(`📝 Creating inspeccion with ID: ${inspeccionId}`);

      // Check if inspeccion already exists
      const existing = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          archivo: Buffer | null;
          nombre_archivo: string | null;
        }>
      >(
        `SELECT id, archivo, nombre_archivo FROM InspeccionesDocumentos WHERE id = ${this.escapeSql(inspeccionId)}`,
      );

      // Dacă există și este o inspecție completă (are PDF), aruncă eroare
      if (existing && existing.length > 0 && existing[0].archivo !== null) {
        this.logger.warn(
          `⚠️ Inspeccion with ID ${inspeccionId} already exists and has PDF`,
        );
        throw new BadRequestException('Esta inspección ya existe');
      }

      // Dacă există dar este o cerere (fără PDF), facem UPDATE pentru a transforma cererea în inspecție completă
      if (existing && existing.length > 0 && existing[0].archivo === null) {
        this.logger.log(
          `🔄 Updating solicitud ${inspeccionId} to complete inspeccion`,
        );

        const updateQuery = `
          UPDATE InspeccionesDocumentos SET
            tipo_inspeccion = ${this.escapeSql(tipoInspeccion)},
            codigo_empleado = ${this.escapeSql(codigoEmpleado)},
            nombre_empleado = ${this.escapeSql(empleadoNombre)},
            archivo = ${pdfBuffer ? `0x${pdfBuffer.toString('hex')}` : 'NULL'},
            nombre_archivo = ${this.escapeSql(nombreArchivo)},
            fecha_subida = ${this.escapeSql(timestamp)},
            \`Nombre Supervisor\` = ${this.escapeSql(nombreInspector)},
            codigo_supervisor = ${codigoSupervisor ? this.escapeSql(codigoSupervisor) : 'NULL'},
            Centro = ${this.escapeSql(centroTrabajo)},
            Locacion = ${this.escapeSql(locatie)},
            observaciones = ${body.observaciones ? this.escapeSql(body.observaciones) : 'NULL'},
            scor_total = ${scorTotal !== null ? scorTotal : 'NULL'}
          WHERE id = ${this.escapeSql(inspeccionId)}
        `;

        await this.prisma.$executeRawUnsafe(updateQuery);
        this.logger.log(
          `✅ Solicitud ${inspeccionId} updated to complete inspeccion`,
        );
      } else {
        // Insert inspeccion nouă în database
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
            codigo_supervisor,
            Centro,
            Locacion,
            observaciones,
            scor_total
          ) VALUES (
            ${this.escapeSql(inspeccionId)},
            ${this.escapeSql(tipoInspeccion)},
            ${this.escapeSql(codigoEmpleado)},
            ${this.escapeSql(empleadoNombre)},
            ${pdfBuffer ? `0x${pdfBuffer.toString('hex')}` : 'NULL'},
            ${this.escapeSql(nombreArchivo)},
            ${this.escapeSql(timestamp)},
            ${this.escapeSql(nombreInspector)},
            ${codigoSupervisor ? this.escapeSql(codigoSupervisor) : 'NULL'},
            ${this.escapeSql(centroTrabajo)},
            ${this.escapeSql(locatie)},
            ${body.observaciones ? this.escapeSql(body.observaciones) : 'NULL'},
            ${scorTotal !== null ? scorTotal : 'NULL'}
          )
        `;

        await this.prisma.$executeRawUnsafe(query);
        this.logger.log(`✅ New inspeccion created with ID: ${inspeccionId}`);
      }

      // Dacă este "Entrega de Materiales", salvează documentele materialelor
      if (
        tipoInspeccion === 'entrega-materiales' &&
        body.puncte &&
        Array.isArray(body.puncte)
      ) {
        this.logger.log(
          `📦 Processing ${body.puncte.length} material documents for inspeccion ${inspeccionId}`,
        );

        for (let index = 0; index < body.puncte.length; index++) {
          const material = body.puncte[index];

          // Verifică dacă materialul are document (albarán/factura)
          if (material.documentoBase64 || material.documento) {
            try {
              const documentoBase64 =
                material.documentoBase64 || material.documento;
              // Remove data: prefix if present
              const base64Data = documentoBase64.includes(',')
                ? documentoBase64.split(',')[1]
                : documentoBase64;
              const documentoBuffer = Buffer.from(base64Data, 'base64');

              // Determină tipul documentului din nume sau tip
              let tipoDocumento = 'albaran'; // default
              const nombreArchivo =
                material.documentoNombre ||
                material.documento?.name ||
                `material_${index + 1}.pdf`;
              if (
                nombreArchivo.toLowerCase().includes('factura') ||
                material.documentoType?.toLowerCase().includes('factura')
              ) {
                tipoDocumento = 'factura';
              }

              // Descrierea materialului
              const descripcionMaterial =
                material.descripcion || material.desc || material.text || null;

              // Salvează documentul în MaterialesDocumentos
              const materialQuery = `
                INSERT INTO MaterialesDocumentos (
                  inspeccion_id,
                  material_index,
                  tipo_documento,
                  nombre_archivo,
                  archivo,
                  fecha_creacion,
                  codigo_empleado,
                  nombre_empleado,
                  descripcion_material
                ) VALUES (
                  ${this.escapeSql(inspeccionId)},
                  ${index},
                  ${this.escapeSql(tipoDocumento)},
                  ${this.escapeSql(nombreArchivo)},
                  ${documentoBuffer ? `0x${documentoBuffer.toString('hex')}` : 'NULL'},
                  ${this.escapeSql(timestamp)},
                  ${this.escapeSql(codigoEmpleado)},
                  ${this.escapeSql(empleadoNombre)},
                  ${descripcionMaterial ? this.escapeSql(descripcionMaterial) : 'NULL'}
                )
              `;

              await this.prisma.$executeRawUnsafe(materialQuery);

              this.logger.log(
                `✅ Material document ${index + 1} saved: ${nombreArchivo} (${tipoDocumento})`,
              );
            } catch (materialError: any) {
              this.logger.error(
                `❌ Error saving material document ${index + 1}:`,
                materialError,
              );
              // Continuă cu următorul material chiar dacă unul eșuează
            }
          }
        }
      }

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
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al crear la inspección: ${error.message}`,
      );
    }
  }

  /**
   * Create a solicitud (request) for an inspeccion (without PDF)
   * This is used when a manager wants to request an inspection for an employee
   * @param body - Request body with empleado data and optional notes
   */
  async createSolicitudInspeccion(
    body: {
      codigo_empleado: string;
      nombre_empleado: string;
      tipo_inspeccion?: string;
      centro?: string;
      observaciones?: string;
      solicitado_por?: string;
      codigo_solicitante?: string;
    },
    allowedCodigos?: string[] | null,
  ): Promise<{ success: boolean; message: string; id: string }> {
    try {
      this.logger.log('📝 Create solicitud inspeccion request');

      const {
        codigo_empleado,
        nombre_empleado,
        tipo_inspeccion = 'Solicitada',
        centro = '',
        observaciones = '',
        solicitado_por = '',
        codigo_solicitante = '',
      } = body;

      if (!codigo_empleado || !nombre_empleado) {
        throw new BadRequestException(
          'Se requiere "codigo_empleado" y "nombre_empleado"',
        );
      }

      this.empleadoGrupoScopeService.assertCodigoEnAmbito(
        allowedCodigos ?? null,
        codigo_empleado,
      );

      // Generate unique ID for the solicitud
      const solicitudId = `SOL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();

      // Check if solicitud already exists (unlikely but check anyway)
      const existing = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM InspeccionesDocumentos WHERE id = ${this.escapeSql(solicitudId)}`,
      );

      if (existing && existing.length > 0) {
        this.logger.warn(
          `⚠️ Solicitud with ID ${solicitudId} already exists, generating new ID`,
        );
        // Generate new ID if collision - recursive call will generate a new ID
        return this.createSolicitudInspeccion(
          {
            ...body,
          },
          allowedCodigos,
        );
      }

      // Insert solicitud into database (without PDF, archivo is NULL)
      // Use tipo_inspeccion to indicate it's a solicitud
      // NOTA: Locacion este pentru locația fizică, nu pentru observații
      // Pentru cereri, Locacion este NULL deoarece nu există încă o locație fizică
      // Observaciones se salvează în câmpul dedicat observaciones
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
          codigo_supervisor,
          Centro,
          Locacion,
          observaciones,
          scor_total
        ) VALUES (
          ${this.escapeSql(solicitudId)},
          ${this.escapeSql(tipo_inspeccion)},
          ${this.escapeSql(codigo_empleado)},
          ${this.escapeSql(nombre_empleado)},
          NULL,
          ${this.escapeSql(`SOLICITUD-${solicitudId}`)},
          ${this.escapeSql(timestamp)},
          NULL,
          ${codigo_solicitante ? this.escapeSql(codigo_solicitante) : 'NULL'},
          ${this.escapeSql(centro)},
          NULL,
          ${observaciones ? this.escapeSql(observaciones) : 'NULL'},
          NULL
        )
      `;

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(
        `✅ Solicitud inspeccion created successfully - ID: ${solicitudId}`,
      );

      // Trimite notificare Telegram către gestoria
      try {
        const fechaFormateada = new Date(timestamp).toLocaleDateString(
          'es-ES',
          {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          },
        );

        // Escape-uiește caracterele speciale Markdown pentru Telegram
        const escapeMarkdown = (text: string): string => {
          if (!text) return text;
          return text
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

        const nombreEscaped = escapeMarkdown(nombre_empleado);
        const codigoEscaped = escapeMarkdown(codigo_empleado);
        const tipoEscaped = escapeMarkdown(tipo_inspeccion);
        const centroEscaped = escapeMarkdown(centro || 'N/A');
        const solicitadoPorEscaped = escapeMarkdown(
          solicitado_por || 'Sistema',
        );
        const observacionesEscaped = observaciones
          ? escapeMarkdown(observaciones)
          : '';

        const telegramMessage = `
🔍 *Nueva solicitud de inspección*

👤 *Empleado:* ${nombreEscaped} (${codigoEscaped})
📋 *Tipo:* ${tipoEscaped}
📅 *Fecha solicitud:* ${fechaFormateada}
🏢 *Centro:* ${centroEscaped}
👨‍💼 *Solicitado por:* ${solicitadoPorEscaped}
${observacionesEscaped ? `📝 *Observaciones:* ${observacionesEscaped}` : ''}
🆔 *ID Solicitud:* ${solicitudId}
        `.trim();

        await this.telegramService.sendMessage(telegramMessage);
        this.logger.log(
          `✅ Telegram notification sent for solicitud inspeccion - ID: ${solicitudId}`,
        );
      } catch (telegramError: any) {
        // Nu aruncăm eroarea pentru a nu opri flow-ul principal
        // doar logăm eroarea
        this.logger.error(
          `⚠️ Error sending Telegram notification for solicitud inspeccion: ${telegramError.message}`,
        );
      }

      return {
        success: true,
        message: 'Solicitud de inspección creada correctamente',
        id: solicitudId,
      };
    } catch (error: unknown) {
      this.logger.error(
        'Error in InspeccionesService.createSolicitudInspeccion:',
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new BadRequestException(
        `Error al crear la solicitud de inspección: ${errorMessage}`,
      );
    }
  }

  /**
   * Get material documents for an inspection
   * @param inspeccionId - Inspeccion ID (string)
   */
  async getMaterialesDocumentos(
    inspeccionId: string,
    allowedCodigos?: string[] | null,
  ): Promise<
    Array<{
      doc_id: number;
      material_index: number;
      tipo_documento: string | null;
      nombre_archivo: string | null;
      fecha_creacion: string | null;
      descripcion_material: string | null;
    }>
  > {
    try {
      if (!inspeccionId || inspeccionId.trim() === '') {
        throw new BadRequestException('Se requiere "inspeccionId"');
      }

      this.logger.log(
        `📦 Get materiales documentos request - inspeccionId: ${inspeccionId}`,
      );

      const escapedId = this.escapeSql(inspeccionId.trim());

      await this.assertInspeccionCodigoEnAmbito(
        inspeccionId.trim(),
        allowedCodigos,
      );

      // Query pentru a obține documentele materialelor (fără archivo pentru performanță)
      const query = `
        SELECT 
          doc_id,
          material_index,
          tipo_documento,
          nombre_archivo,
          fecha_creacion,
          descripcion_material
        FROM MaterialesDocumentos
        WHERE inspeccion_id = ${escapedId}
        ORDER BY material_index ASC
      `;

      const result = await this.prisma.$queryRawUnsafe<
        Array<{
          doc_id: number;
          material_index: number;
          tipo_documento: string | null;
          nombre_archivo: string | null;
          fecha_creacion: string | null;
          descripcion_material: string | null;
        }>
      >(query);

      this.logger.log(
        `✅ Found ${result.length} material documents for inspeccion ${inspeccionId}`,
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Error getting materiales documentos:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener los documentos de materiales: ${error.message}`,
      );
    }
  }

  /**
   * Download material document by doc_id
   * @param docId - Document ID (number)
   */
  async downloadMaterialDocumento(
    docId: number,
    allowedCodigos?: string[] | null,
  ): Promise<{
    archivo: Buffer;
    tipo_mime: string;
    nombre_archivo: string;
  }> {
    try {
      if (!docId || docId <= 0) {
        throw new BadRequestException('Se requiere "docId" válido');
      }

      this.logger.log(
        `📥 Download material document request - docId: ${docId}`,
      );

      const linkRows = await this.prisma.$queryRawUnsafe<
        Array<{ inspeccion_id: string | null }>
      >(
        `SELECT inspeccion_id FROM MaterialesDocumentos WHERE doc_id = ${docId} LIMIT 1`,
      );
      const inspId = linkRows?.[0]?.inspeccion_id;
      if (inspId) {
        await this.assertInspeccionCodigoEnAmbito(inspId, allowedCodigos);
      }

      // Query pentru a obține documentul
      const query = `
        SELECT 
          nombre_archivo,
          archivo
        FROM MaterialesDocumentos
        WHERE doc_id = ${docId}
        LIMIT 1
      `;

      const result = await this.prisma.$queryRawUnsafe<
        Array<{
          nombre_archivo: string | null;
          archivo: Buffer | null;
        }>
      >(query);

      if (!result || result.length === 0) {
        throw new NotFoundException(
          `Documento de material con doc_id ${docId} no encontrado`,
        );
      }

      const documento = result[0];

      if (!documento.archivo) {
        throw new NotFoundException(
          `El archivo del documento ${docId} está vacío`,
        );
      }

      const nombreArchivo =
        documento.nombre_archivo || `material_document_${docId}.pdf`;

      // Determină tipul MIME din extensie
      let tipoMime = 'application/pdf';
      if (
        nombreArchivo.toLowerCase().endsWith('.jpg') ||
        nombreArchivo.toLowerCase().endsWith('.jpeg')
      ) {
        tipoMime = 'image/jpeg';
      } else if (nombreArchivo.toLowerCase().endsWith('.png')) {
        tipoMime = 'image/png';
      }

      this.logger.log(
        `✅ Material document downloaded: ${nombreArchivo} (${tipoMime})`,
      );

      return {
        archivo: documento.archivo,
        tipo_mime: tipoMime,
        nombre_archivo: nombreArchivo,
      };
    } catch (error: any) {
      this.logger.error('❌ Error downloading material document:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al descargar el documento de material: ${error.message}`,
      );
    }
  }

  /**
   * Download inspeccion PDF by id
   * @param id - Inspeccion ID (string)
   */
  async downloadInspeccion(
    id: string,
    allowedCodigos?: string[] | null,
  ): Promise<{
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

      await this.assertInspeccionCodigoEnAmbito(id.trim(), allowedCodigos);

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
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al descargar la inspección: ${error.message}`,
      );
    }
  }

  /** Comprueba que la inspección pertenezca a un CODIGO permitido (si hay ámbito). */
  private async assertInspeccionCodigoEnAmbito(
    inspeccionId: string,
    allowedCodigos: string[] | null | undefined,
  ): Promise<void> {
    if (!allowedCodigos) return;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ codigo_empleado: string | null }>
    >(
      `SELECT codigo_empleado FROM InspeccionesDocumentos WHERE id = ${this.escapeSql(inspeccionId)} LIMIT 1`,
    );
    if (!rows?.length) {
      throw new NotFoundException(
        `Inspección no encontrada para id=${inspeccionId}`,
      );
    }
    const codigo = rows[0].codigo_empleado;
    if (codigo == null || String(codigo).trim() === '') {
      throw new ForbiddenException('No puede acceder a esta inspección.');
    }
    this.empleadoGrupoScopeService.assertCodigoEnAmbito(
      allowedCodigos,
      String(codigo),
    );
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
