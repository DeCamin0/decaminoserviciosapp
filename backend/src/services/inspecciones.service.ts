import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { EmpleadoGrupoScopeService } from './empleado-grupo-scope.service';
import { InspeccionesMaterialesStorageService } from './inspecciones-materiales-storage.service';

@Injectable()
export class InspeccionesService {
  private readonly logger = new Logger(InspeccionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly empleadoGrupoScopeService: EmpleadoGrupoScopeService,
    private readonly inspeccionesStorage: InspeccionesMaterialesStorageService,
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
      archivo: null;
      tiene_archivo: boolean;
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

      const escapedCodigo = this.escapeSql(codigoEmpleado.trim());
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
          scor_total,
          storage_key
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
          nombre_archivo: string | null;
          fecha_subida: string | null;
          'Nombre Supervisor': string | null;
          Centro: string | null;
          Locacion: string | null;
          scor_total: number | null;
          storage_key: string | null;
        }>
      >(query);

      const mappedResults = results.map((row) => {
        const tiene = Boolean(
          row.storage_key && String(row.storage_key).trim(),
        );
        return {
          id: row.id,
          tipo_inspeccion: row.tipo_inspeccion,
          codigo_empleado: row.codigo_empleado,
          nombre_empleado: row.nombre_empleado,
          archivo: null as null,
          tiene_archivo: tiene,
          nombre_archivo: row.nombre_archivo,
          fecha_subida: row.fecha_subida,
          Nombre_Supervisor: row['Nombre Supervisor'] || null,
          Centro: row.Centro,
          Locacion: row.Locacion,
          scor_total: row.scor_total !== null ? Number(row.scor_total) : null,
        };
      });

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

      if (!this.inspeccionesStorage.isWriteEnabled()) {
        throw new ServiceUnavailableException(
          'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
        );
      }

      const put = await this.inspeccionesStorage.putInspeccionPdf(
        pdfBuffer,
        inspeccionId,
        nombreArchivo.endsWith('.pdf') ? nombreArchivo : `${nombreArchivo}.pdf`,
      );

      // Check if inspeccion already exists
      const existing = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          storage_key: string | null;
          nombre_archivo: string | null;
        }>
      >(
        `SELECT id, storage_key, nombre_archivo FROM InspeccionesDocumentos WHERE id = ${this.escapeSql(inspeccionId)}`,
      );

      const hasFile = (row: { storage_key: string | null }) =>
        Boolean(row.storage_key && String(row.storage_key).trim());

      // Dacă există și este o inspecție completă (are PDF pe R2), aruncă eroare
      if (existing && existing.length > 0 && hasFile(existing[0])) {
        await this.inspeccionesStorage.deleteObjectIfAny(put.storage_key);
        this.logger.warn(
          `⚠️ Inspeccion with ID ${inspeccionId} already exists and has PDF`,
        );
        throw new BadRequestException('Esta inspección ya existe');
      }

      // Dacă există dar este o cerere (fără PDF), facem UPDATE pentru a transforma cererea în inspecție completă
      if (existing && existing.length > 0 && !hasFile(existing[0])) {
        this.logger.log(
          `🔄 Updating solicitud ${inspeccionId} to complete inspeccion`,
        );

        const updateQuery = `
          UPDATE InspeccionesDocumentos SET
            tipo_inspeccion = ${this.escapeSql(tipoInspeccion)},
            codigo_empleado = ${this.escapeSql(codigoEmpleado)},
            nombre_empleado = ${this.escapeSql(empleadoNombre)},
            storage_key = ${this.escapeSql(put.storage_key)},
            storage_bucket = ${this.escapeSql(put.storage_bucket)},
            tamano_bytes = ${put.tamano_bytes},
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
        const query = `
          INSERT INTO InspeccionesDocumentos (
            id,
            tipo_inspeccion,
            codigo_empleado,
            nombre_empleado,
            storage_key,
            storage_bucket,
            tamano_bytes,
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
            ${this.escapeSql(put.storage_key)},
            ${this.escapeSql(put.storage_bucket)},
            ${put.tamano_bytes},
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

              // Salvează documentul în MaterialesDocumentos (R2)
              const matPut = await this.inspeccionesStorage.putMaterialArchivo(
                documentoBuffer,
                inspeccionId,
                nombreArchivo,
              );
              const materialQuery = `
                INSERT INTO MaterialesDocumentos (
                  inspeccion_id,
                  material_index,
                  tipo_documento,
                  nombre_archivo,
                  storage_key,
                  storage_bucket,
                  tamano_bytes,
                  fecha_creacion,
                  codigo_empleado,
                  nombre_empleado,
                  descripcion_material
                ) VALUES (
                  ${this.escapeSql(inspeccionId)},
                  ${index},
                  ${this.escapeSql(tipoDocumento)},
                  ${this.escapeSql(nombreArchivo)},
                  ${this.escapeSql(matPut.storage_key)},
                  ${this.escapeSql(matPut.storage_bucket)},
                  ${matPut.tamano_bytes},
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
        error instanceof ForbiddenException ||
        error instanceof ServiceUnavailableException
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

      // Insert solicitud (fără PDF → storage_key NULL)
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
          storage_key,
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

      const query = `
        SELECT 
          nombre_archivo,
          storage_key
        FROM MaterialesDocumentos
        WHERE doc_id = ${docId}
        LIMIT 1
      `;

      const result = await this.prisma.$queryRawUnsafe<
        Array<{
          nombre_archivo: string | null;
          storage_key: string | null;
        }>
      >(query);

      if (!result || result.length === 0) {
        throw new NotFoundException(
          `Documento de material con doc_id ${docId} no encontrado`,
        );
      }

      const documento = result[0];
      const archivoBuffer =
        await this.inspeccionesStorage.resolveArchivo(documento);

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
        archivo: archivoBuffer,
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

      const query = `
        SELECT nombre_archivo, storage_key
        FROM InspeccionesDocumentos
        WHERE id = ${escapedId}
        LIMIT 1
      `;

      const result = await this.prisma.$queryRawUnsafe<
        Array<{
          nombre_archivo: string | null;
          storage_key: string | null;
        }>
      >(query);

      if (!result || result.length === 0) {
        throw new NotFoundException(`Inspección no encontrada para id=${id}`);
      }

      const row = result[0];
      const archivoBuffer = await this.inspeccionesStorage.resolveArchivo(row);
      const nombreArchivo = row.nombre_archivo || `inspeccion_${id}`;
      const extension = nombreArchivo.includes('.')
        ? nombreArchivo.split('.').pop()?.toLowerCase() || ''
        : '';

      let mimeType = 'application/pdf';
      const firstBytes = archivoBuffer.slice(0, 10);
      const firstBytesHex = firstBytes.toString('hex');
      const firstBytesAscii = firstBytes.toString('ascii');

      if (firstBytesAscii.startsWith('%PDF-')) mimeType = 'application/pdf';
      else if (firstBytesHex.startsWith('89504e47')) mimeType = 'image/png';
      else if (firstBytesHex.startsWith('ffd8ff')) mimeType = 'image/jpeg';
      else if (firstBytesHex.startsWith('47494638')) mimeType = 'image/gif';
      else if (firstBytesHex.startsWith('52494646')) mimeType = 'image/webp';
      else {
        const mimeTypes: { [key: string]: string } = {
          pdf: 'application/pdf',
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          webp: 'image/webp',
        };
        mimeType = mimeTypes[extension] || 'application/octet-stream';
      }

      let nombreArchivoFinal = nombreArchivo;
      if (!nombreArchivo.includes('.')) {
        const extensionMap: { [key: string]: string } = {
          'application/pdf': 'pdf',
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/gif': 'gif',
          'image/webp': 'webp',
        };
        nombreArchivoFinal = `${nombreArchivo}.${extensionMap[mimeType] || 'bin'}`;
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
        error instanceof ForbiddenException ||
        error instanceof ServiceUnavailableException
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
