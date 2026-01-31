import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import AdmZip from 'adm-zip';
import * as iconv from 'iconv-lite';
import * as mammoth from 'mammoth';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { TelegramService } from './telegram.service';

type PrlDocumentType =
  | 'EVALUACION_RIESGOS'
  | 'ACTA_INFORMATIVA'
  | 'ENTREGA_EPIS'
  | 'RENUNCIA_RM'
  | 'MANUAL_TEST';

@Injectable()
export class PrlDocumentsService {
  private readonly logger = new Logger(PrlDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly telegramService: TelegramService,
  ) {}

  /**
   * Helper function pentru a escapa valori SQL
   * Asigură că string-urile sunt în UTF-8 corect și păstrează caracterele speciale
   */
  private escapeSql(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    // Folosește direct string-ul (nu String() care poate corupe encoding-ul)
    let str = value;

    // CORECTARE FINALĂ: Dacă încă conține "mdico" sau "medico" (fără accent), corectează
    // Aceasta este o ultimă verificare înainte de salvare în MySQL
    // IMPORTANT: Verifică DOAR pentru string-uri care conțin efectiv "mdico" sau "medico" sau replacement character în context
    const hasMdico = /mdico|medico/i.test(str);
    const hasReplacementInContext =
      /m[\uFFFD]dico|reconocimiento m[\uFFFD]dico/i.test(str);
    const strBytes = Buffer.from(str).toString('hex');
    const hasReplacementBytesInContext = strBytes.includes('6defbfbd6469636f'); // "m" + replacement + "dico"

    if (
      (hasMdico || hasReplacementInContext || hasReplacementBytesInContext) &&
      !str.includes('médico')
    ) {
      const beforeFix = str;

      this.logger.log(
        `🔧 escapeSql: Corrigiendo pattern en "${str.substring(0, 50)}..." (hasMdico: ${hasMdico}, hasReplacementInContext: ${hasReplacementInContext}, hasReplacementBytes: ${hasReplacementBytesInContext})`,
      );

      // Corectează replacement character în contextul "médico"
      if (hasReplacementInContext || hasReplacementBytesInContext) {
        str = str.replace(/m[\uFFFD]dico/gi, 'médico');
        str = str.replace(
          /reconocimiento m[\uFFFD]dico/gi,
          'reconocimiento médico',
        );
        // Dacă bytes conține efbfbd în contextul "mdico"
        if (hasReplacementBytesInContext) {
          str = str.replace(/m[\uFFFD]?dico/gi, 'médico');
        }
      }

      // Corectează pattern-uri fără accent
      str = str.replace(/mdico/gi, 'médico');
      str = str.replace(/medico/gi, 'médico');
      str = str.replace(/reconocimiento mdico/gi, 'reconocimiento médico');
      str = str.replace(/reconocimiento medico/gi, 'reconocimiento médico');

      if (str !== beforeFix) {
        const afterBytes = Buffer.from(str).toString('hex');
        this.logger.log(
          `🔧 escapeSql: Resultado corregido (bytes: ${afterBytes.substring(0, 100)})`,
        );
      }
    }

    // Escape pentru SQL - păstrează caracterele UTF-8
    // Folosim replace doar pentru caracterele speciale SQL, nu pentru encoding
    const escaped = str
      .replace(/\\/g, '\\\\') // Escape backslash
      .replace(/'/g, "\\'") // Escape single quote
      .replace(/\0/g, '\\0') // Escape null
      .replace(/\n/g, '\\n') // Escape newline
      .replace(/\r/g, '\\r') // Escape carriage return
      .replace(/\x1a/g, '\\Z'); // Escape Ctrl+Z

    return `'${escaped}'`;
  }

  /**
   * Decodează numele fișierului din ZIP folosind CP437 (encoding vechi Windows)
   * Dacă rawEntryName există, îl decodăm corect; altfel folosim entryName
   */
  public decodificarNombreDesdeZip(entry: any): string {
    try {
      // Dacă există rawEntryName (bytes raw), îl decodăm folosind CP437
      if (entry.rawEntryName && Buffer.isBuffer(entry.rawEntryName)) {
        // CP437 este encoding-ul standard pentru ZIP-uri vechi Windows
        const decoded = iconv.decode(entry.rawEntryName, 'cp437');
        this.logger.log(
          `🔧 Decodificado desde CP437: "${entry.entryName}" -> "${decoded}"`,
        );
        return decoded;
      }

      // Fallback: folosim entryName direct
      return entry.entryName;
    } catch (e) {
      this.logger.warn(
        `⚠️ Error decodificando nombre desde ZIP: ${e.message}, usando entryName`,
      );
      return entry.entryName;
    }
  }

  /**
   * Normalizează numele fișierului pentru a păstra caracterele speciale UTF-8
   * AdmZip poate să nu păstreze corect encoding-ul, deci normalizăm
   */
  public normalizarNombreArchivo(nombreArchivo: string): string {
    if (!nombreArchivo) return nombreArchivo;

    try {
      let normalized = String(nombreArchivo);
      const originalBytes = Buffer.from(normalized).toString('hex');

      // LOG pentru debugging
      this.logger.log(
        `🔍 Normalizando: "${nombreArchivo}" (length: ${normalized.length}, bytes: ${originalBytes.substring(0, 100)})`,
      );

      // CORECTARE: "mÃ©dico" (latin1 interpretat greșit ca UTF-8) -> "médico"
      // "mÃ©dico" = "m" + "Ã©" (care este "é" în latin1) + "dico"
      // "Ã©" în UTF-8 bytes = C3 A9, dar dacă e interpretat greșit ca latin1 -> "Ã©"
      if (normalized.includes('mÃ©dico') || normalized.includes('mÃ©dico')) {
        this.logger.log(
          `🔧 Detectado "mÃ©dico" (encoding error), corrigiendo...`,
        );
        normalized = normalized.replace(/mÃ©dico/gi, 'médico');
        normalized = normalized.replace(/mÃ©dico/gi, 'médico');
      }

      // CORECTARE: "reconocimiento mÃ©dico" -> "reconocimiento médico"
      if (
        normalized.includes('reconocimiento mÃ©dico') ||
        normalized.includes('reconocimiento mÃ©dico')
      ) {
        normalized = normalized.replace(
          /reconocimiento mÃ©dico/gi,
          'reconocimiento médico',
        );
        normalized = normalized.replace(
          /reconocimiento mÃ©dico/gi,
          'reconocimiento médico',
        );
      }

      // DETECTARE: Verifică dacă conține replacement character () sau bytes efbfbd
      const hasReplacementChar =
        normalized.includes('') ||
        normalized.includes('') ||
        originalBytes.includes('efbfbd');

      if (hasReplacementChar) {
        this.logger.log(`⚠️ Detectado replacement character () en nombre`);

        // CORECTARE: Înlocuiește pattern-urile cu replacement character
        // "mdico" sau "m[replacement]dico" -> "médico"
        normalized = normalized.replace(/m[\uFFFD]dico/gi, 'médico');
        normalized = normalized.replace(/m[\uFFFD]dico/gi, 'médico');
        normalized = normalized.replace(/medico/gi, 'médico');
        normalized = normalized.replace(
          /reconocimiento m[\uFFFD]dico/gi,
          'reconocimiento médico',
        );
        normalized = normalized.replace(
          /reconocimiento medico/gi,
          'reconocimiento médico',
        );

        // Dacă încă conține replacement character, încercă să-l înlocuiești direct
        if (normalized.includes('') || normalized.includes('')) {
          // Înlocuiește replacement character-ul din contextul "médico"
          normalized = normalized.replace(
            /(reconocimiento )m[\uFFFD]dico/gi,
            '$1médico',
          );
          normalized = normalized.replace(/m[\uFFFD]dico/gi, 'médico');
        }

        this.logger.log(
          `🔧 Después de corregir replacement char: "${normalized}"`,
        );
      }

      // CORECTARE DIRECTĂ: Pattern-uri comune (fallback)
      const beforePatternFix = normalized;
      normalized = normalized.replace(/mdico/gi, 'médico');
      normalized = normalized.replace(/medico/gi, 'médico');
      normalized = normalized.replace(
        /reconocimiento mdico/gi,
        'reconocimiento médico',
      );
      normalized = normalized.replace(
        /reconocimiento medico/gi,
        'reconocimiento médico',
      );

      if (normalized !== beforePatternFix) {
        this.logger.log(
          `✅ Pattern corregido: "${beforePatternFix}" -> "${normalized}"`,
        );
      }

      // Verificare finală - doar pentru string-uri care conțin "mdico" sau "medico"
      const finalBytes = Buffer.from(normalized).toString('hex');
      if (normalized.includes('médico')) {
        this.logger.log(
          `✅ Nombre final contiene "médico" correctamente: "${normalized}" (bytes: ${finalBytes.substring(0, 100)})`,
        );
      } else if (/mdico|medico|m[\uFFFD]dico/i.test(normalized)) {
        this.logger.warn(
          `⚠️ Nombre final todavía tiene problemas: "${normalized}" (bytes: ${finalBytes.substring(0, 100)})`,
        );
        // Ultimă încercare: forțează corectarea
        normalized = normalized.replace(/m[\uFFFD]?dico/gi, 'médico');
        normalized = normalized.replace(/medico/gi, 'médico');
        this.logger.log(`🔧 Forzando corrección final: "${normalized}"`);
      }

      return normalized;
    } catch {
      // Dacă nu funcționează, aplică doar corectarea pattern-urilor
      let fallback = String(nombreArchivo);
      fallback = fallback.replace(/m[\uFFFD]?dico/gi, 'médico');
      fallback = fallback.replace(/mdico/gi, 'médico');
      fallback = fallback.replace(/medico/gi, 'médico');
      this.logger.warn(
        `⚠️ Fallback aplicado: "${nombreArchivo}" -> "${fallback}"`,
      );
      return fallback;
    }
  }

  /**
   * Detectează tipul documentului după numele fișierului
   */
  private detectarTipoDocumento(nombreArchivo: string): PrlDocumentType {
    const nombre = nombreArchivo.toUpperCase();

    if (nombre.includes('ACTA') && nombre.includes('INFORMATIVA')) {
      return 'ACTA_INFORMATIVA';
    }
    if (nombre.includes('EPIS') || nombre.includes('EPI')) {
      return 'ENTREGA_EPIS';
    }
    if (nombre.includes('RENUNCIA') || nombre.includes('RECONOCIMIENTO')) {
      return 'RENUNCIA_RM';
    }
    if (nombre.includes('MANUAL')) {
      return 'MANUAL_TEST';
    }
    if (
      nombre.includes('EVALUACION') ||
      nombre.includes('EVALUACIÓN') ||
      nombre.includes('RIESGOS')
    ) {
      return 'EVALUACION_RIESGOS';
    }

    // Default: Evaluación de Riesgos
    return 'EVALUACION_RIESGOS';
  }

  /**
   * Determină dacă un tip de document necesită semnătură
   */
  private requiereFirma(tipo: PrlDocumentType): boolean {
    return (
      tipo === 'ACTA_INFORMATIVA' ||
      tipo === 'ENTREGA_EPIS' ||
      tipo === 'RENUNCIA_RM' ||
      tipo === 'MANUAL_TEST' // Manual trebuie semnat după autoevaluare
    );
  }

  /**
   * Procesează un ZIP și extrage documentele pentru un GRUPO
   */
  async procesarZipUpload(
    grupoNombre: string,
    zipBuffer: Buffer,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _usuarioId: string,
  ): Promise<{
    success: boolean;
    documentos: Array<{
      nombreArchivo: string;
      tipoDetectado: PrlDocumentType;
      requiereFirma: boolean;
      esRenunciaRm: boolean;
      esManualTest: boolean;
      tamaño: number;
    }>;
  }> {
    try {
      if (!grupoNombre || grupoNombre.trim() === '') {
        throw new BadRequestException('grupo_nombre es requerido');
      }

      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();

      const documentos: Array<{
        nombreArchivo: string;
        tipoDetectado: PrlDocumentType;
        requiereFirma: boolean;
        esRenunciaRm: boolean;
        esManualTest: boolean;
        tamaño: number;
      }> = [];

      for (const entry of zipEntries) {
        // Ignorăm directoarele
        if (entry.isDirectory) {
          continue;
        }

        // Decodează numele corect din ZIP (CP437 -> UTF-8)
        const entryNameDecodificado = this.decodificarNombreDesdeZip(entry);

        // Doar PDF-uri
        if (!entryNameDecodificado.toLowerCase().endsWith('.pdf')) {
          this.logger.warn(
            `⚠️ Archivo ignorado (no es PDF): ${entryNameDecodificado}`,
          );
          continue;
        }

        let nombreArchivo =
          entryNameDecodificado.split('/').pop() || entryNameDecodificado;
        // Normalizează encoding-ul numelui fișierului (pentru pattern-uri comune)
        nombreArchivo = this.normalizarNombreArchivo(nombreArchivo);
        const tipoDetectado = this.detectarTipoDocumento(nombreArchivo);
        const requiereFirma = this.requiereFirma(tipoDetectado);
        const esRenunciaRm = tipoDetectado === 'RENUNCIA_RM';
        const esManualTest = tipoDetectado === 'MANUAL_TEST';

        const fileData = entry.getData();

        documentos.push({
          nombreArchivo,
          tipoDetectado,
          requiereFirma,
          esRenunciaRm,
          esManualTest,
          tamaño: fileData.length,
        });
      }

      if (documentos.length === 0) {
        throw new BadRequestException(
          'No se encontraron archivos PDF en el ZIP',
        );
      }

      this.logger.log(
        `✅ ZIP procesado: ${documentos.length} documentos detectados para GRUPO ${grupoNombre}`,
      );

      return {
        success: true,
        documentos,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error procesando ZIP para GRUPO ${grupoNombre}:`,
        error,
      );
      throw new BadRequestException(`Error procesando ZIP: ${error.message}`);
    }
  }

  /**
   * Confirma și salvează documentele din ZIP
   */
  async confirmarUploadZip(
    grupoNombre: string,
    documentos: Array<{
      nombreArchivo: string;
      tipo: PrlDocumentType;
      archivoBuffer: Buffer;
    }>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _usuarioId: string,
  ): Promise<{
    success: boolean;
    templatesCreados: number;
    templatesActualizados: number;
  }> {
    try {
      let templatesCreados = 0;
      let templatesActualizados = 0;

      for (const doc of documentos) {
        const tipo = doc.tipo;
        const requiereFirma = this.requiereFirma(tipo);
        const esRenunciaRm = tipo === 'RENUNCIA_RM';
        const esManualTest = tipo === 'MANUAL_TEST';

        // Verifică dacă există deja un template pentru acest GRUPO + tipo (activ sau inactiv)
        const existingTemplate = await this.prisma.$queryRawUnsafe<
          Array<{ id: number; activo: number }>
        >(
          `
          SELECT id, activo FROM prl_document_templates
          WHERE grupo_nombre = ${this.escapeSql(grupoNombre)}
            AND tipo_documento = ${this.escapeSql(tipo)}
          LIMIT 1
          `,
        );

        if (existingTemplate && existingTemplate.length > 0) {
          // Actualizează template-ul existent (nouă versiune)
          const templateId = existingTemplate[0].id;

          // Obține versiunea actuală
          const currentVersion = await this.prisma.$queryRawUnsafe<
            Array<{ version: number }>
          >(
            `
            SELECT version FROM prl_document_templates
            WHERE id = ${templateId}
            `,
          );

          const nuevaVersion = (currentVersion[0]?.version || 1) + 1;

          // Normalizează numele înainte de salvare
          const nombreNormalizado = this.normalizarNombreArchivo(
            doc.nombreArchivo,
          );
          // Convertim buffer-ul la hex pentru MySQL
          const archivoHex = `0x${doc.archivoBuffer.toString('hex')}`;
          const isInactivo = existingTemplate[0].activo === 0;

          // Setează charset UTF-8 pentru această sesiune
          await this.prisma.$executeRawUnsafe(
            `SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci`,
          );

          await this.prisma.$executeRawUnsafe(
            `
            UPDATE prl_document_templates
            SET 
              nombre = ${this.escapeSql(nombreNormalizado)},
              archivo = ${archivoHex},
              nombre_archivo = ${this.escapeSql(nombreNormalizado)},
              requiere_firma = ${requiereFirma ? 1 : 0},
              es_renuncia_rm = ${esRenunciaRm ? 1 : 0},
              es_manual_test = ${esManualTest ? 1 : 0},
              version = ${nuevaVersion},
              activo = 1,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${templateId}
            `,
          );

          templatesActualizados++;
          this.logger.log(
            `✅ Template ${isInactivo ? 'reactivado y actualizado' : 'actualizado'}: ${nombreNormalizado} (versión ${nuevaVersion})`,
          );
        } else {
          // Creează template nou
          // Normalizează numele înainte de salvare (dacă nu a fost deja normalizat)
          const nombreNormalizado = this.normalizarNombreArchivo(
            doc.nombreArchivo,
          );
          const nombreBytes = Buffer.from(nombreNormalizado).toString('hex');
          this.logger.log(
            `📝 Guardando con nombre normalizado: "${doc.nombreArchivo}" -> "${nombreNormalizado}"`,
          );
          this.logger.log(
            `📝 Bytes del nombre normalizado: ${nombreBytes.substring(0, 100)}`,
          );

          // Verifică dacă numele normalizat conține "médico" corect
          const tieneMedico = nombreNormalizado.includes('médico');
          const tieneMdico =
            nombreNormalizado.includes('mdico') ||
            nombreNormalizado.includes('medico');
          const tieneReplacement = nombreBytes.includes('efbfbd');

          if (tieneMedico) {
            this.logger.log(
              `✅ Nombre contiene "médico" correctamente (bytes: ${nombreBytes.substring(0, 100)})`,
            );
          } else if (tieneMdico || tieneReplacement) {
            this.logger.warn(
              `⚠️ Nombre todavía tiene problemas después de normalización!`,
            );
            this.logger.warn(
              `⚠️ tieneMdico: ${tieneMdico}, tieneReplacement: ${tieneReplacement}`,
            );
            this.logger.warn(
              `⚠️ Nombre: "${nombreNormalizado}", Bytes: ${nombreBytes.substring(0, 100)}`,
            );
          }

          // Convertim buffer-ul la hex pentru MySQL
          const archivoHex = `0x${doc.archivoBuffer.toString('hex')}`;

          // Setează charset UTF-8 pentru această sesiune
          await this.prisma.$executeRawUnsafe(
            `SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci`,
          );

          // Log înainte de INSERT
          this.logger.log(
            `💾 Intentando INSERT para: "${nombreNormalizado}" (tipo: ${tipo})`,
          );

          try {
            await this.prisma.$executeRawUnsafe(
              `
              INSERT INTO prl_document_templates (
                grupo_nombre,
                tipo_documento,
                nombre,
                archivo,
                nombre_archivo,
                requiere_firma,
                es_renuncia_rm,
                es_manual_test,
                version,
                activo,
                created_at,
                updated_at
              ) VALUES (
                ${this.escapeSql(grupoNombre)},
                ${this.escapeSql(tipo)},
                ${this.escapeSql(nombreNormalizado)},
                ${archivoHex},
                ${this.escapeSql(nombreNormalizado)},
                ${requiereFirma ? 1 : 0},
                ${esRenunciaRm ? 1 : 0},
                ${esManualTest ? 1 : 0},
                1,
                1,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              )
              `,
            );

            templatesCreados++;
            this.logger.log(
              `✅ Template creado: ${nombreNormalizado} para GRUPO ${grupoNombre}`,
            );
          } catch (insertError: any) {
            this.logger.error(
              `❌ Error INSERT para "${nombreNormalizado}":`,
              insertError,
            );
            throw insertError;
          }
        }
      }

      return {
        success: true,
        templatesCreados,
        templatesActualizados,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error confirmando upload ZIP para GRUPO ${grupoNombre}:`,
        error,
      );
      throw new BadRequestException(
        `Error guardando documentos: ${error.message}`,
      );
    }
  }

  /**
   * Upload un document individual
   */
  async uploadDocumentoIndividual(
    grupoNombre: string,
    tipo: PrlDocumentType,
    nombreArchivo: string,
    archivoBuffer: Buffer,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _usuarioId: string,
  ): Promise<{ success: boolean; templateId: number }> {
    try {
      // Normalizează numele fișierului pentru a păstra caracterele speciale
      nombreArchivo = this.normalizarNombreArchivo(nombreArchivo);

      if (!grupoNombre || grupoNombre.trim() === '') {
        throw new BadRequestException('grupo_nombre es requerido');
      }

      const requiereFirma = this.requiereFirma(tipo);
      const esRenunciaRm = tipo === 'RENUNCIA_RM';
      const esManualTest = tipo === 'MANUAL_TEST';

      // Verifică dacă există deja (activ sau inactiv)
      const existingTemplate = await this.prisma.$queryRawUnsafe<
        Array<{ id: number; activo: number }>
      >(
        `
        SELECT id, activo FROM prl_document_templates
        WHERE grupo_nombre = ${this.escapeSql(grupoNombre)}
          AND tipo_documento = ${this.escapeSql(tipo)}
        LIMIT 1
        `,
      );

      const archivoHex = `0x${archivoBuffer.toString('hex')}`;

      if (existingTemplate && existingTemplate.length > 0) {
        // Actualizează
        const templateId = existingTemplate[0].id;
        const currentVersion = await this.prisma.$queryRawUnsafe<
          Array<{ version: number }>
        >(
          `
          SELECT version FROM prl_document_templates
          WHERE id = ${templateId}
          `,
        );

        const nuevaVersion = (currentVersion[0]?.version || 1) + 1;
        const isInactivo = existingTemplate[0]?.activo === 0;
        // Asigură că numele este normalizat (deși ar trebui să fie deja)
        const nombreFinal = this.normalizarNombreArchivo(nombreArchivo);

        await this.prisma.$executeRawUnsafe(
          `
          UPDATE prl_document_templates
          SET 
            nombre = ${this.escapeSql(nombreFinal)},
            archivo = ${archivoHex},
            nombre_archivo = ${this.escapeSql(nombreFinal)},
            requiere_firma = ${requiereFirma ? 1 : 0},
            es_renuncia_rm = ${esRenunciaRm ? 1 : 0},
            es_manual_test = ${esManualTest ? 1 : 0},
            version = ${nuevaVersion},
            activo = 1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${templateId}
          `,
        );

        this.logger.log(
          `✅ Template ${isInactivo ? 'reactivado y actualizado' : 'actualizado'}: ${nombreFinal} (versión ${nuevaVersion})`,
        );

        return { success: true, templateId };
      } else {
        // Creează nou
        // Asigură că numele este normalizat (deși ar trebui să fie deja)
        const nombreFinal = this.normalizarNombreArchivo(nombreArchivo);
        // Setează charset UTF-8 pentru această sesiune
        await this.prisma.$executeRawUnsafe(
          `SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci`,
        );

        await this.prisma.$executeRawUnsafe(
          `
          INSERT INTO prl_document_templates (
            grupo_nombre,
            tipo_documento,
            nombre,
            archivo,
            nombre_archivo,
            requiere_firma,
            es_renuncia_rm,
            es_manual_test,
            version,
            activo,
            created_at,
            updated_at
          ) VALUES (
            ${this.escapeSql(grupoNombre)},
            ${this.escapeSql(tipo)},
            ${this.escapeSql(nombreFinal)},
            ${archivoHex},
            ${this.escapeSql(nombreFinal)},
            ${requiereFirma ? 1 : 0},
            ${esRenunciaRm ? 1 : 0},
            ${esManualTest ? 1 : 0},
            1,
            1,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          `,
        );

        const lastInsertId = await this.prisma.$queryRawUnsafe<
          Array<{ id: number }>
        >(`SELECT LAST_INSERT_ID() as id`);

        const templateId = Number(lastInsertId[0]?.id);

        this.logger.log(
          `✅ Template creado: ${nombreArchivo} para GRUPO ${grupoNombre}`,
        );

        return { success: true, templateId };
      }
    } catch (error: any) {
      this.logger.error(`❌ Error subiendo documento individual:`, error);
      throw new BadRequestException(
        `Error subiendo documento: ${error.message}`,
      );
    }
  }

  /**
   * Listă toate template-urile pentru un GRUPO
   */
  async listarTemplatesPorGrupo(grupoNombre: string): Promise<
    Array<{
      id: number;
      tipo_documento: PrlDocumentType;
      nombre: string;
      nombre_archivo: string;
      requiere_firma: boolean;
      es_renuncia_rm: boolean;
      es_manual_test: boolean;
      version: number;
      activo: boolean;
      created_at: Date;
      updated_at: Date;
    }>
  > {
    try {
      const templates = await this.prisma.$queryRawUnsafe<
        Array<{
          id: number;
          tipo_documento: string;
          nombre: string;
          nombre_archivo: string;
          requiere_firma: boolean;
          es_renuncia_rm: boolean;
          es_manual_test: boolean;
          version: number;
          activo: boolean;
          created_at: Date;
          updated_at: Date;
        }>
      >(
        `
        SELECT 
          id,
          tipo_documento,
          nombre,
          nombre_archivo,
          requiere_firma,
          es_renuncia_rm,
          es_manual_test,
          version,
          activo,
          created_at,
          updated_at
        FROM prl_document_templates
        WHERE grupo_nombre = ${this.escapeSql(grupoNombre)}
          AND activo = 1
        ORDER BY tipo_documento, version DESC
        `,
      );

      return templates.map((t) => ({
        ...t,
        tipo_documento: t.tipo_documento as PrlDocumentType,
      }));
    } catch (error: any) {
      this.logger.error(
        `❌ Error listando templates para GRUPO ${grupoNombre}:`,
        error,
      );
      throw new BadRequestException(
        `Error listando templates: ${error.message}`,
      );
    }
  }

  /**
   * Listă toate GRUPO-urile din DatosEmpleados + numărul de template-uri PRL (dacă există)
   */
  async listarGruposConTemplates(): Promise<
    Array<{ grupo_nombre: string; count: number; empleados_count: number }>
  > {
    try {
      // Obține toate GRUPO-urile distincte din DatosEmpleados
      const gruposEmpleados = await this.prisma.$queryRawUnsafe<
        Array<{ GRUPO: string; empleados_count: bigint | number }>
      >(
        `
        SELECT 
          \`GRUPO\`,
          COUNT(*) as empleados_count
        FROM DatosEmpleados
        WHERE \`GRUPO\` IS NOT NULL 
          AND \`GRUPO\` != ''
          AND \`ESTADO\` = 'ACTIVO'
        GROUP BY \`GRUPO\`
        ORDER BY \`GRUPO\`
        `,
      );

      // Obține numărul de template-uri PRL pentru fiecare GRUPO
      const gruposTemplates = await this.prisma.$queryRawUnsafe<
        Array<{ grupo_nombre: string; count: bigint | number }>
      >(
        `
        SELECT 
          grupo_nombre,
          COUNT(*) as count
        FROM prl_document_templates
        WHERE activo = 1
        GROUP BY grupo_nombre
        `,
      );

      // Creează un map pentru template-uri
      const templatesMap = new Map<string, number>();
      gruposTemplates.forEach((g) => {
        templatesMap.set(
          g.grupo_nombre,
          typeof g.count === 'bigint' ? Number(g.count) : g.count,
        );
      });

      // Combină datele: toate GRUPO-urile din empleados + count de template-uri
      return gruposEmpleados.map((g) => ({
        grupo_nombre: g.GRUPO,
        count: templatesMap.get(g.GRUPO) || 0, // Număr de template-uri PRL (0 dacă nu are)
        empleados_count:
          typeof g.empleados_count === 'bigint'
            ? Number(g.empleados_count)
            : g.empleados_count,
      }));
    } catch (error: any) {
      this.logger.error(`❌ Error listando grupos:`, error);
      throw new BadRequestException(`Error listando grupos: ${error.message}`);
    }
  }

  /**
   * Șterge (dezactivează) toate template-urile pentru un GRUPO
   */
  async eliminarTodosTemplatesPorGrupo(
    grupoNombre: string,
    usuarioId: string,
  ): Promise<{ success: boolean; eliminados: number; message?: string }> {
    try {
      // Verifică câte template-uri există pentru acest GRUPO
      const countResult = await this.prisma.$queryRawUnsafe<
        Array<{ count: bigint | number }>
      >(
        `
        SELECT COUNT(*) as count
        FROM prl_document_templates
        WHERE grupo_nombre = ${this.escapeSql(grupoNombre)}
          AND activo = 1
        `,
      );

      const count =
        countResult && countResult.length > 0
          ? typeof countResult[0].count === 'bigint'
            ? Number(countResult[0].count)
            : countResult[0].count
          : 0;

      if (count === 0) {
        return { success: true, eliminados: 0 };
      }

      // Verifică dacă există documente PRL care folosesc aceste template-uri
      const documentosUsandoTemplates = await this.prisma.$queryRawUnsafe<
        Array<{ template_id: number; count: bigint }>
      >(
        `
        SELECT template_id, COUNT(*) as count
        FROM prl_employee_documents
        WHERE template_id IN (
          SELECT id FROM prl_document_templates
          WHERE grupo_nombre = ${this.escapeSql(grupoNombre)} AND activo = 1
        )
        GROUP BY template_id
        `,
      );

      const templatesConDocumentos = new Set(
        documentosUsandoTemplates.map((d) => d.template_id),
      );

      if (templatesConDocumentos.size > 0) {
        // Soft delete: marchează template-urile ca inactive
        await this.prisma.$executeRawUnsafe(
          `
          UPDATE prl_document_templates
          SET activo = false,
              updated_at = CURRENT_TIMESTAMP
          WHERE grupo_nombre = ${this.escapeSql(grupoNombre)}
            AND activo = 1
          `,
        );

        const totalDocumentos = documentosUsandoTemplates.reduce(
          (sum, d) => sum + Number(d.count || 0),
          0,
        );

        this.logger.log(
          `✅ ${count} templates desactivados (soft delete) para GRUPO ${grupoNombre} por usuario ${usuarioId}. ${totalDocumentos} documento(s) PRL existentes que usan estos templates.`,
        );

        return {
          success: true,
          eliminados: count,
          message: `${count} templates desactivados. Existen ${totalDocumentos} documento(s) PRL que usan estos templates, por lo que no se pueden eliminar permanentemente.`,
        };
      } else {
        // Hard delete: dacă nu există documente, se pot șterge fizic
        await this.prisma.$executeRawUnsafe(
          `
          DELETE FROM prl_document_templates
          WHERE grupo_nombre = ${this.escapeSql(grupoNombre)}
            AND activo = 1
          `,
        );

        this.logger.log(
          `✅ ${count} templates eliminados permanentemente para GRUPO ${grupoNombre} por usuario ${usuarioId} (no hay documentos que los usen)`,
        );

        return { success: true, eliminados: count };
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Error eliminando templates para GRUPO ${grupoNombre}:`,
        error,
      );
      throw new BadRequestException(
        `Error eliminando templates: ${error.message}`,
      );
    }
  }

  /**
   * Șterge (dezactivează) un template
   */
  async eliminarTemplate(
    templateId: number,
    usuarioId: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      // Verifică dacă template-ul există
      const template = await this.prisma.$queryRawUnsafe<
        Array<{ id: number; activo: boolean }>
      >(
        `
        SELECT id, activo
        FROM prl_document_templates
        WHERE id = ${templateId}
        LIMIT 1
        `,
      );

      if (!template || template.length === 0) {
        throw new NotFoundException(`Template ${templateId} no encontrado`);
      }

      // Verifică dacă există documente PRL care folosesc acest template
      const documentosUsandoTemplate = await this.prisma.$queryRawUnsafe<
        Array<{ count: bigint }>
      >(
        `
        SELECT COUNT(*) as count
        FROM prl_employee_documents
        WHERE template_id = ${templateId}
        `,
      );

      const count = Number(documentosUsandoTemplate[0]?.count || 0);

      if (count > 0) {
        // Soft delete: marchează template-ul ca inactiv (nu se poate șterge fizic din cauza foreign key)
        await this.prisma.$executeRawUnsafe(
          `
          UPDATE prl_document_templates
          SET activo = false,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${templateId}
          `,
        );

        this.logger.log(
          `✅ Template ${templateId} desactivado (soft delete) por usuario ${usuarioId}. ${count} documento(s) PRL existente que usan este template.`,
        );

        return {
          success: true,
          message: `Template desactivado. Existen ${count} documento(s) PRL que usan este template, por lo que no se puede eliminar permanentemente.`,
        };
      } else {
        // Hard delete: dacă nu există documente, se poate șterge fizic
        await this.prisma.$executeRawUnsafe(
          `
          DELETE FROM prl_document_templates
          WHERE id = ${templateId}
          `,
        );

        this.logger.log(
          `✅ Template ${templateId} eliminado permanentemente por usuario ${usuarioId} (no hay documentos que lo usen)`,
        );

        return { success: true };
      }
    } catch (error: any) {
      this.logger.error(`❌ Error eliminando template ${templateId}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error eliminando template: ${error.message}`,
      );
    }
  }

  /**
   * Creează un audit log pentru o acțiune pe un document de angajat
   */
  async crearAuditLog(
    employeeDocId: number,
    usuarioId: string,
    accion:
      | 'DESCARGADO'
      | 'VISUALIZADO'
      | 'FIRMADO'
      | 'TEST_COMPLETADO'
      | 'CERTIFICADO_UPLOAD'
      | 'RECHAZADO',
    ipAddress?: string,
    userAgent?: string,
    detalles?: string,
  ): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `
        INSERT INTO prl_audit_logs (
          employee_doc_id,
          usuario_id,
          accion,
          ip_address,
          user_agent,
          detalles,
          created_at
        ) VALUES (
          ${employeeDocId},
          ${this.escapeSql(usuarioId)},
          ${this.escapeSql(accion)},
          ${ipAddress ? this.escapeSql(ipAddress) : 'NULL'},
          ${userAgent ? this.escapeSql(userAgent) : 'NULL'},
          ${detalles ? this.escapeSql(detalles) : 'NULL'},
          CURRENT_TIMESTAMP
        )
        `,
      );

      this.logger.log(
        `📝 Audit log creado: ${accion} para employee_doc_id ${employeeDocId} por usuario ${usuarioId}`,
      );
    } catch (error: any) {
      // Nu aruncăm eroare pentru audit log - doar logăm
      this.logger.warn(`⚠️ Error creando audit log: ${error.message}`);
    }
  }

  /**
   * Descarcă un template (pentru preview)
   * NOTA: Template-urile sunt pentru admin, nu pentru angajați
   * Audit log-ul se va crea când un angajat descarcă un document atribuit (PrlEmployeeDocument)
   */
  async descargarTemplate(
    templateId: number,
    usuarioId?: string,
  ): Promise<{ archivo: Buffer; nombre_archivo: string }> {
    try {
      const template = await this.prisma.$queryRawUnsafe<
        Array<{
          archivo: Buffer;
          nombre_archivo: string;
          grupo_nombre: string;
        }>
      >(
        `
        SELECT archivo, nombre_archivo, grupo_nombre
        FROM prl_document_templates
        WHERE id = ${templateId}
          AND activo = 1
        LIMIT 1
        `,
      );

      if (!template || template.length === 0) {
        throw new NotFoundException(`Template ${templateId} no encontrado`);
      }

      // Log pentru audit (template download de către admin)
      if (usuarioId) {
        this.logger.log(
          `📥 Template descargado: ${template[0].nombre_archivo} (ID: ${templateId}, GRUPO: ${template[0].grupo_nombre}) por usuario ${usuarioId}`,
        );
      }

      return {
        archivo: template[0].archivo,
        nombre_archivo: template[0].nombre_archivo,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error descargando template ${templateId}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error descargando template: ${error.message}`,
      );
    }
  }

  /**
   * Generează documentul DOCX cu placeholder-urile completate
   */
  private async generarDocumentoConPlaceholders(
    templateBuffer: Buffer,
    empleadoNombre: string,
    empleadoDNI: string,
    empleadoGrupo: string,
  ): Promise<Buffer> {
    try {
      const zip = new AdmZip(templateBuffer);
      let xml = zip.readAsText('word/document.xml');

      // Formatează data actuală în format spaniol: "a de de 2026" -> "a 15 de enero de 2026"
      const ahora = new Date();
      const dia = ahora.getDate();
      const meses = [
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
      const mes = meses[ahora.getMonth()];
      const año = ahora.getFullYear();
      const fechaFormateada = `a ${dia} de ${mes} de ${año}`;

      // Valori default pentru firmă
      const empresaDefault = 'De Camino Servicios Auxiliares SL';
      const cifDefault = 'B85524536';

      // Log pentru debugging
      const beforeReplace = {
        trabajador: (xml.match(/\{\{TRABAJADOR\}\}/g) || []).length,
        dni: (xml.match(/\{\{DNI\}\}/g) || []).length,
        empresa: (xml.match(/\{\{EMPRESA\}\}/g) || []).length,
        cif: (xml.match(/\{\{CIF\}\}/g) || []).length,
        puesto: (xml.match(/\{\{PUESTO_TRABAJO\}\}/g) || []).length,
        fecha: (xml.match(/\{\{FECHA\}\}/g) || []).length,
        firma: (xml.match(/\{\{FIRMA\}\}/g) || []).length,
      };

      this.logger.log(
        `🔍 Placeholder-uri găsite înainte de înlocuire: ${JSON.stringify(beforeReplace)}`,
      );

      // Înlocuiește placeholder-urile - TOATE variantele posibile (cu sau fără spații)
      // Varianta standard: {{PLACEHOLDER}}
      xml = xml.replace(/\{\{TRABAJADOR\}\}/g, empleadoNombre || '');
      xml = xml.replace(/\{\{DNI\}\}/g, empleadoDNI || '');
      xml = xml.replace(/\{\{EMPRESA\}\}/g, empresaDefault);
      xml = xml.replace(/\{\{CIF\}\}/g, cifDefault);
      xml = xml.replace(/\{\{PUESTO_TRABAJO\}\}/g, empleadoGrupo || '');
      xml = xml.replace(/\{\{FECHA\}\}/g, fechaFormateada);
      // NOTĂ: {{FIRMA}} NU se înlocuiește aici - rămâne placeholder pentru ca agregarFirmaADocx să-l înlocuiască cu imaginea semnăturii

      // Variante cu spații (dacă Word a adăugat spații): { { PLACEHOLDER } }
      xml = xml.replace(/\{\s*{\s*TRABAJADOR\s*}\s*\}/g, empleadoNombre || '');
      xml = xml.replace(/\{\s*{\s*DNI\s*}\s*\}/g, empleadoDNI || '');
      xml = xml.replace(/\{\s*{\s*EMPRESA\s*}\s*\}/g, empresaDefault);
      xml = xml.replace(/\{\s*{\s*CIF\s*}\s*\}/g, cifDefault);
      xml = xml.replace(
        /\{\s*{\s*PUESTO_TRABAJO\s*}\s*\}/g,
        empleadoGrupo || '',
      );
      xml = xml.replace(/\{\s*{\s*FECHA\s*}\s*\}/g, fechaFormateada);
      // NOTĂ: {{FIRMA}} NU se înlocuiește aici - rămâne placeholder pentru ca agregarFirmaADocx să-l înlocuiască cu imaginea semnăturii

      // Variante când placeholder-urile sunt separate în tag-uri diferite în XML
      // Ex: <w:t>{{</w:t><w:t>EMPRESA</w:t><w:t>}}</w:t>
      // Strategie: înlocuiește placeholder-ul chiar dacă este între tag-uri diferite
      const replacePlaceholderInTags = (
        placeholder: string,
        replacement: string,
      ) => {
        // Pattern 1: placeholder într-un singur tag: <w:t>{{PLACEHOLDER}}</w:t>
        xml = xml.replace(
          new RegExp(`(<w:t[^>]*>)\\{\\{${placeholder}\\}\\}(</w:t>)`, 'gi'),
          `$1${replacement}$2`,
        );
        // Pattern 2: placeholder separat în tag-uri: <w:t>{{</w:t><w:t>PLACEHOLDER</w:t><w:t>}}</w:t>
        // Înlocuiește întregul pattern cu replacement-ul
        xml = xml.replace(
          new RegExp(
            `(<w:t[^>]*>)\\{\\{</w:t>\\s*<w:t[^>]*>${placeholder}</w:t>\\s*<w:t[^>]*>\\}\\}(</w:t>)`,
            'gi',
          ),
          `$1${replacement}$2`,
        );
        // Pattern 3: placeholder poate fi și fără tag-uri de închidere/deschidere între ele
        // {{PLACEHOLDER}} poate fi: {{</w:t><w:t>PLACEHOLDER</w:t><w:t>}}
        xml = xml.replace(
          new RegExp(
            `\\{\\{</w:t>\\s*<w:t[^>]*>${placeholder}</w:t>\\s*<w:t[^>]*>\\}\\}`,
            'gi',
          ),
          replacement,
        );
      };

      replacePlaceholderInTags('TRABAJADOR', empleadoNombre || '');
      replacePlaceholderInTags('DNI', empleadoDNI || '');
      replacePlaceholderInTags('EMPRESA', empresaDefault);
      replacePlaceholderInTags('CIF', cifDefault);
      replacePlaceholderInTags('PUESTO_TRABAJO', empleadoGrupo || '');
      replacePlaceholderInTags('FECHA', fechaFormateada);
      // NOTĂ: {{FIRMA}} NU se înlocuiește aici - rămâne placeholder pentru ca agregarFirmaADocx să-l înlocuiască cu imaginea semnăturii

      // Verifică dacă s-au înlocuit toate
      const afterReplace = {
        trabajador: (xml.match(/\{\{TRABAJADOR\}\}/g) || []).length,
        dni: (xml.match(/\{\{DNI\}\}/g) || []).length,
        empresa: (xml.match(/\{\{EMPRESA\}\}/g) || []).length,
        cif: (xml.match(/\{\{CIF\}\}/g) || []).length,
        puesto: (xml.match(/\{\{PUESTO_TRABAJO\}\}/g) || []).length,
        fecha: (xml.match(/\{\{FECHA\}\}/g) || []).length,
        firma: (xml.match(/\{\{FIRMA\}\}/g) || []).length,
      };

      // Verifică și variantele cu spații
      const afterReplaceSpaces = {
        trabajador: (xml.match(/\{\s*{\s*TRABAJADOR\s*}\s*\}/g) || []).length,
        dni: (xml.match(/\{\s*{\s*DNI\s*}\s*\}/g) || []).length,
        empresa: (xml.match(/\{\s*{\s*EMPRESA\s*}\s*\}/g) || []).length,
        cif: (xml.match(/\{\s*{\s*CIF\s*}\s*\}/g) || []).length,
        puesto: (xml.match(/\{\s*{\s*PUESTO_TRABAJO\s*}\s*\}/g) || []).length,
        fecha: (xml.match(/\{\s*{\s*FECHA\s*}\s*\}/g) || []).length,
        firma: (xml.match(/\{\s*{\s*FIRMA\s*}\s*\}/g) || []).length,
      };

      const totalRemaining =
        Object.values(afterReplace).reduce((a, b) => a + b, 0) +
        Object.values(afterReplaceSpaces).reduce((a, b) => a + b, 0);

      if (totalRemaining > 0) {
        this.logger.warn(
          `⚠️ Au rămas ${totalRemaining} placeholder-uri neînlocuite: ${JSON.stringify(afterReplace)} + ${JSON.stringify(afterReplaceSpaces)}`,
        );
      } else {
        this.logger.log(
          `✅ Toate placeholder-urile au fost înlocuite cu succes!`,
        );
      }

      // Actualizează document.xml în ZIP
      zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));

      // Returnează buffer-ul DOCX generat
      return zip.toBuffer();
    } catch (error: any) {
      this.logger.error(
        `❌ Error generando documento con placeholders: ${error.message}`,
      );
      // Dacă apare eroare, returnează template-ul original
      return templateBuffer;
    }
  }

  /**
   * Trimite documentele PRL la toți angajații activi dintr-un grup
   * Creează PrlEmployeeDocument pentru fiecare angajat + template
   * Trimite email/notificare la fiecare angajat
   */
  async enviarDocumentosAGrupo(
    grupoNombre: string,
    usuarioId: string,
  ): Promise<{
    success: boolean;
    empleados_procesados: number;
    documentos_creados: number;
    documentos_existentes: number;
    emails_enviados: number;
    notificaciones_enviadas: number;
  }> {
    try {
      // 1. Obține toți angajații activi din grup (cu DNI și GRUPO)
      const empleados = await this.prisma.$queryRawUnsafe<
        Array<{
          CODIGO: string;
          'NOMBRE / APELLIDOS': string;
          'CORREO ELECTRONICO': string;
          'D.N.I. / NIE': string;
          GRUPO: string;
        }>
      >(
        `
        SELECT 
          CODIGO,
          \`NOMBRE / APELLIDOS\`,
          \`CORREO ELECTRONICO\`,
          \`D.N.I. / NIE\`,
          \`GRUPO\`
        FROM DatosEmpleados
        WHERE \`GRUPO\` = ${this.escapeSql(grupoNombre)}
          AND \`ESTADO\` = 'ACTIVO'
        ORDER BY \`NOMBRE / APELLIDOS\`
        `,
      );

      if (empleados.length === 0) {
        throw new BadRequestException(
          `No se encontraron empleados activos en el grupo "${grupoNombre}"`,
        );
      }

      // 2. Obține toate template-urile active pentru grup
      const templates = await this.prisma.$queryRawUnsafe<
        Array<{
          id: number;
          tipo_documento: string;
          nombre: string;
          nombre_archivo: string;
          archivo: Buffer;
          requiere_firma: number;
          es_renuncia_rm: number;
          es_manual_test: number;
        }>
      >(
        `
        SELECT 
          id,
          tipo_documento,
          nombre,
          nombre_archivo,
          archivo,
          requiere_firma,
          es_renuncia_rm,
          es_manual_test
        FROM prl_document_templates
        WHERE grupo_nombre = ${this.escapeSql(grupoNombre)}
          AND activo = 1
        ORDER BY tipo_documento
        `,
      );

      if (templates.length === 0) {
        throw new BadRequestException(
          `No se encontraron templates PRL activos para el grupo "${grupoNombre}"`,
        );
      }

      this.logger.log(
        `📤 Enviando ${templates.length} documentos PRL a ${empleados.length} empleados del grupo "${grupoNombre}"`,
      );

      let documentosCreados = 0;
      let documentosExistentes = 0;
      let emailsEnviados = 0;
      let notificacionesEnviadas = 0;

      // 3. Pentru fiecare angajat + template, creează PrlEmployeeDocument
      for (const empleado of empleados) {
        const empleadoCodigo = empleado.CODIGO;
        const empleadoNombre = empleado['NOMBRE / APELLIDOS'] || 'Empleado';
        const empleadoEmail = empleado['CORREO ELECTRONICO'] || null;
        const empleadoDNI = empleado['D.N.I. / NIE'] || '';
        const empleadoGrupo = empleado.GRUPO || grupoNombre;

        for (const template of templates) {
          // Verifică dacă există deja un document pentru această combinație
          const existingDoc = await this.prisma.$queryRawUnsafe<
            Array<{ id: number }>
          >(
            `
            SELECT id
            FROM prl_employee_documents
            WHERE empleado_id = ${this.escapeSql(empleadoCodigo)}
              AND template_id = ${template.id}
            LIMIT 1
            `,
          );

          if (existingDoc && existingDoc.length > 0) {
            documentosExistentes++;
            continue; // Skip dacă există deja
          }

          // Determină status-ul inițial
          let estadoInicial = 'PENDIENTE';
          if (template.tipo_documento === 'EVALUACION_RIESGOS') {
            estadoInicial = 'INFORMATIVO';
          } else if (template.es_renuncia_rm === 1) {
            // Renuncia RM: NO_APLICA până când angajatul refuză RM
            estadoInicial = 'NO_APLICA';
          } else if (template.requiere_firma === 1) {
            // Documente care necesită semnătură: PENDIENTE (trebuie să se întoarcă semnate)
            estadoInicial = 'PENDIENTE';
          }

          // Generează documentul cu placeholder-urile completate
          let archivoFinal = template.archivo;
          try {
            archivoFinal = await this.generarDocumentoConPlaceholders(
              template.archivo,
              empleadoNombre,
              empleadoDNI,
              empleadoGrupo,
            );
            this.logger.log(
              `✅ Documento generado con placeholders para ${empleadoNombre} (${template.nombre})`,
            );
          } catch (genError: any) {
            this.logger.warn(
              `⚠️ Error generando documento con placeholders, usando template original: ${genError.message}`,
            );
            // Continuă cu template-ul original dacă generarea eșuează
          }

          // Creează PrlEmployeeDocument cu documentul generat
          const archivoHex = `0x${archivoFinal.toString('hex')}`;

          await this.prisma.$executeRawUnsafe(
            `
            INSERT INTO prl_employee_documents (
              empleado_id,
              grupo_nombre,
              template_id,
              tipo_documento,
              estado,
              archivo_original,
              nombre_archivo_original,
              asignado_por,
              asignado_en
            ) VALUES (
              ${this.escapeSql(empleadoCodigo)},
              ${this.escapeSql(grupoNombre)},
              ${template.id},
              ${this.escapeSql(template.tipo_documento)},
              ${this.escapeSql(estadoInicial)},
              ${archivoHex},
              ${this.escapeSql(template.nombre_archivo)},
              ${this.escapeSql(usuarioId)},
              CURRENT_TIMESTAMP
            )
            `,
          );

          documentosCreados++;
        }

        // 4. Trimite email și notificare la angajat (doar o dată per angajat, nu per document)
        // Separează documentele care necesită semnătură de cele informativo
        const documentosConFirma = templates.filter(
          (t) => t.requiere_firma === 1 && t.es_renuncia_rm === 0,
        );
        const documentosInformativo = templates.filter(
          (t) => t.tipo_documento === 'EVALUACION_RIESGOS',
        );
        const documentosRenunciaRM = templates.filter(
          (t) => t.es_renuncia_rm === 1,
        );
        const documentosManualTest = templates.filter(
          (t) => t.es_manual_test === 1,
        );

        if (empleadoEmail && empleadoEmail.trim() !== '') {
          try {
            const subject = `Documentos PRL disponibles - ${grupoNombre}`;
            let html = `
              <h2>Hola ${empleadoNombre},</h2>
              <p>Se han asignado nuevos documentos PRL a tu perfil:</p>
            `;

            // Documente care necesită semnătură (trebuie să se întoarcă semnate)
            if (documentosConFirma.length > 0) {
              html += `
                <div style="margin: 15px 0; padding: 10px; background-color: #fff3cd; border-left: 4px solid #ffc107;">
                  <h3 style="margin-top: 0; color: #856404;">⚠️ Documentos que requieren firma (debes devolverlos firmados):</h3>
                  <ul>
                    ${documentosConFirma
                      .map(
                        (t) =>
                          `<li><strong>${t.nombre}</strong> - <span style="color: #856404; font-weight: bold;">REQUIERE FIRMA</span></li>`,
                      )
                      .join('')}
                  </ul>
                </div>
              `;
            }

            // Documente informativo
            if (documentosInformativo.length > 0) {
              html += `
                <div style="margin: 15px 0;">
                  <h3>📄 Documentos informativos:</h3>
                  <ul>
                    ${documentosInformativo
                      .map((t) => `<li><strong>${t.nombre}</strong></li>`)
                      .join('')}
                  </ul>
                </div>
              `;
            }

            // Renuncia RM
            if (documentosRenunciaRM.length > 0) {
              html += `
                <div style="margin: 15px 0; padding: 10px; background-color: #ffeaa7; border-left: 4px solid #f39c12;">
                  <h3 style="margin-top: 0; color: #d68910;">ℹ️ Renuncia Reconocimiento Médico:</h3>
                  <ul>
                    ${documentosRenunciaRM
                      .map(
                        (t) =>
                          `<li><strong>${t.nombre}</strong> - Solo se firma si rechazas el Reconocimiento Médico</li>`,
                      )
                      .join('')}
                  </ul>
                </div>
              `;
            }

            // Manual + Test
            if (documentosManualTest.length > 0) {
              html += `
                <div style="margin: 15px 0;">
                  <h3>📚 Manual del Puesto + Test:</h3>
                  <ul>
                    ${documentosManualTest
                      .map(
                        (t) =>
                          `<li><strong>${t.nombre}</strong> - Debes completar el test en la aplicación</li>`,
                      )
                      .join('')}
                  </ul>
                </div>
              `;
            }

            html += `
              <p style="margin-top: 20px;">Puedes acceder a estos documentos desde tu portal de empleados.</p>
              ${documentosConFirma.length > 0 ? `<p style="color: #856404; font-weight: bold;">⚠️ IMPORTANTE: Los documentos marcados como "REQUIERE FIRMA" deben ser descargados, firmados y devueltos a través del portal.</p>` : ''}
              <p>Saludos,<br>Equipo De Camino Servicios</p>
            `;

            if (this.emailService.isConfigured()) {
              await this.emailService.sendEmail(empleadoEmail, subject, html);
              emailsEnviados++;
              this.logger.log(
                `✅ Email enviado a ${empleadoEmail} (${empleadoNombre})`,
              );
            } else {
              this.logger.warn(
                `⚠️ Email service no configurado, no se envió email a ${empleadoEmail}`,
              );
            }
          } catch (emailError: any) {
            this.logger.warn(
              `⚠️ Error enviando email a ${empleadoEmail}: ${emailError.message}`,
            );
          }
        }

        // Trimite notificare generală în aplicație
        try {
          const documentosPendientesFirma = documentosConFirma.length;
          const mensajeNotificacion =
            documentosPendientesFirma > 0
              ? `Se han asignado ${templates.length} documento(s) PRL. ${documentosPendientesFirma} requieren firma y deben devolverse.`
              : `Se han asignado ${templates.length} documento(s) PRL a tu perfil`;

          await this.notificationsService.notifyUser(
            usuarioId,
            empleadoCodigo,
            {
              type: documentosPendientesFirma > 0 ? 'warning' : 'info',
              title: 'Nuevos documentos PRL disponibles',
              message: mensajeNotificacion,
              data: {
                grupo: grupoNombre,
                documentos_count: templates.length,
                documentos_pendientes_firma: documentosPendientesFirma,
                tipo: 'prl_documentos_asignados',
              },
            },
          );
          notificacionesEnviadas++;

          // Trimite notificare separată pentru fiecare document care necesită semnătură
          for (const template of documentosConFirma) {
            try {
              await this.notificationsService.notifyUser(
                usuarioId,
                empleadoCodigo,
                {
                  type: 'warning',
                  title: `Documento PRL pendiente de firma: ${template.nombre}`,
                  message: `Debes descargar, firmar y devolver este documento: ${template.nombre}`,
                  data: {
                    grupo: grupoNombre,
                    template_id: template.id,
                    tipo_documento: template.tipo_documento,
                    tipo: 'prl_documento_pendiente_firma',
                  },
                },
              );
              notificacionesEnviadas++;
            } catch (notifError: any) {
              this.logger.warn(
                `⚠️ Error enviando notificación específica para documento ${template.id}: ${notifError.message}`,
              );
            }
          }
        } catch (notifError: any) {
          this.logger.warn(
            `⚠️ Error enviando notificación a ${empleadoCodigo}: ${notifError.message}`,
          );
        }
      }

      this.logger.log(
        `✅ Documentos PRL enviados: ${documentosCreados} creados, ${documentosExistentes} ya existían, ${emailsEnviados} emails, ${notificacionesEnviadas} notificaciones`,
      );

      return {
        success: true,
        empleados_procesados: empleados.length,
        documentos_creados: documentosCreados,
        documentos_existentes: documentosExistentes,
        emails_enviados: emailsEnviados,
        notificaciones_enviadas: notificacionesEnviadas,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error enviando documentos PRL al grupo "${grupoNombre}":`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error enviando documentos: ${error.message}`,
      );
    }
  }

  /**
   * Obține toate documentele PRL atribuite unui angajat
   */
  async listarDocumentosEmpleado(empleadoId: string): Promise<
    Array<{
      id: number;
      template_id: number;
      tipo_documento: PrlDocumentType;
      estado: string;
      nombre_archivo_original: string;
      nombre_archivo_firmado: string | null;
      fecha_firma: Date | null;
      requiere_firma: boolean;
      es_renuncia_rm: boolean;
      es_manual_test: boolean;
      test_completado: boolean;
      test_puntuacion: number | null;
      certificado_nombre: string | null;
      asignado_en: Date;
      template_nombre: string;
    }>
  > {
    try {
      const documentos = await this.prisma.$queryRawUnsafe<
        Array<{
          id: number;
          template_id: number;
          tipo_documento: string;
          estado: string;
          nombre_archivo_original: string;
          nombre_archivo_firmado: string | null;
          fecha_firma: Date | null;
          requiere_firma: number;
          es_renuncia_rm: number;
          es_manual_test: number;
          test_completado: number;
          test_puntuacion: number | null;
          certificado_nombre: string | null;
          asignado_en: Date;
          template_nombre: string;
        }>
      >(
        `
        SELECT 
          ed.id,
          ed.template_id,
          ed.tipo_documento,
          ed.estado,
          ed.nombre_archivo_original,
          ed.nombre_archivo_firmado,
          ed.fecha_firma,
          t.requiere_firma,
          t.es_renuncia_rm,
          t.es_manual_test,
          ed.test_completado,
          ed.test_puntuacion,
          ed.certificado_nombre,
          ed.asignado_en,
          t.nombre as template_nombre
        FROM prl_employee_documents ed
        INNER JOIN prl_document_templates t ON ed.template_id = t.id
        WHERE ed.empleado_id = ${this.escapeSql(empleadoId)}
        ORDER BY ed.asignado_en DESC
        `,
      );

      return documentos.map((doc) => ({
        id: doc.id,
        template_id: doc.template_id,
        tipo_documento: doc.tipo_documento as PrlDocumentType,
        estado: doc.estado,
        nombre_archivo_original: doc.nombre_archivo_original,
        nombre_archivo_firmado: doc.nombre_archivo_firmado,
        fecha_firma: doc.fecha_firma,
        requiere_firma: doc.requiere_firma === 1,
        es_renuncia_rm: doc.es_renuncia_rm === 1,
        es_manual_test: doc.es_manual_test === 1,
        test_completado: doc.test_completado === 1,
        test_puntuacion: doc.test_puntuacion,
        certificado_nombre: doc.certificado_nombre,
        asignado_en: doc.asignado_en,
        template_nombre: doc.template_nombre,
      }));
    } catch (error: any) {
      this.logger.error(
        `❌ Error listando documentos PRL para empleado ${empleadoId}:`,
        error,
      );
      throw new BadRequestException(
        `Error listando documentos: ${error.message}`,
      );
    }
  }

  /**
   * Descarcă un document PRL atribuit unui angajat
   */
  async descargarDocumentoEmpleado(
    documentoId: number,
    empleadoId: string,
  ): Promise<{ archivo: Buffer; nombre_archivo: string }> {
    try {
      const documento = await this.prisma.$queryRawUnsafe<
        Array<{
          archivo_original: Buffer;
          nombre_archivo_original: string;
          empleado_id: string;
        }>
      >(
        `
        SELECT 
          archivo_original,
          nombre_archivo_original,
          empleado_id
        FROM prl_employee_documents
        WHERE id = ${documentoId}
          AND empleado_id = ${this.escapeSql(empleadoId)}
        LIMIT 1
        `,
      );

      if (!documento || documento.length === 0) {
        throw new NotFoundException(
          `Documento ${documentoId} no encontrado o no tienes acceso`,
        );
      }

      // Creează audit log pentru descărcare
      await this.crearAuditLog(documentoId, empleadoId, 'DESCARGADO');

      return {
        archivo: documento[0].archivo_original,
        nombre_archivo: documento[0].nombre_archivo_original,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error descargando documento PRL ${documentoId}:`,
        error,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error descargando documento: ${error.message}`,
      );
    }
  }

  /**
   * Descarcă documentul firmat (dacă există)
   */
  async descargarDocumentoFirmado(
    documentoId: number,
    empleadoId: string,
  ): Promise<{ archivo: Buffer; nombre_archivo: string }> {
    try {
      const documento = await this.prisma.$queryRawUnsafe<
        Array<{
          archivo_firmado: Buffer;
          nombre_archivo_firmado: string;
          empleado_id: string;
          estado: string;
        }>
      >(
        `
        SELECT 
          archivo_firmado,
          nombre_archivo_firmado,
          empleado_id,
          estado
        FROM prl_employee_documents
        WHERE id = ${documentoId}
          AND empleado_id = ${this.escapeSql(empleadoId)}
        LIMIT 1
        `,
      );

      if (!documento || documento.length === 0) {
        throw new NotFoundException(
          `Documento ${documentoId} no encontrado o no tienes acceso`,
        );
      }

      if (!documento[0].archivo_firmado) {
        throw new NotFoundException(
          `Documento ${documentoId} no tiene archivo firmado`,
        );
      }

      // Creează audit log pentru descărcare
      await this.crearAuditLog(
        documentoId,
        empleadoId,
        'VISUALIZADO', // Folosim VISUALIZADO pentru descărcarea documentului firmat
      );

      return {
        archivo: documento[0].archivo_firmado,
        nombre_archivo:
          documento[0].nombre_archivo_firmado || 'documento_firmado.pdf',
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error descargando documento firmado ${documentoId}:`,
        error,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error descargando documento firmado: ${error.message}`,
      );
    }
  }

  /**
   * Marchează că angajatul renunță la Reconocimiento Médico
   * Schimbă statusul din NO_APLICA în PENDIENTE
   */
  async renunciarReconocimientoMedico(
    documentoId: number,
    empleadoId: string,
  ): Promise<void> {
    try {
      // Verifică că documentul există și aparține angajatului
      const documento = await this.prisma.$queryRawUnsafe<
        Array<{
          id: number;
          empleado_id: string;
          tipo_documento: string;
          estado: string;
        }>
      >(
        `
        SELECT id, empleado_id, tipo_documento, estado
        FROM prl_employee_documents
        WHERE id = ${documentoId}
          AND empleado_id = ${this.escapeSql(empleadoId)}
        LIMIT 1
        `,
      );

      if (!documento || documento.length === 0) {
        throw new NotFoundException(
          `Documento ${documentoId} no encontrado o no tienes acceso`,
        );
      }

      // Verifică că este de tip RENUNCIA_RM și are status NO_APLICA
      if (documento[0].tipo_documento !== 'RENUNCIA_RM') {
        throw new BadRequestException(
          'Este documento no es de tipo Renuncia Reconocimiento Médico',
        );
      }

      if (documento[0].estado !== 'NO_APLICA') {
        throw new BadRequestException(
          `El documento ya tiene estado ${documento[0].estado}. Solo se puede renunciar si el estado es NO_APLICA`,
        );
      }

      // Actualizează statusul în PENDIENTE
      await this.prisma.$executeRawUnsafe(
        `
        UPDATE prl_employee_documents
        SET estado = 'PENDIENTE',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${documentoId}
          AND empleado_id = ${this.escapeSql(empleadoId)}
        `,
      );

      // Creează audit log
      await this.crearAuditLog(
        documentoId,
        empleadoId,
        'RECHAZADO', // Folosim RECHAZADO pentru a indica că a renunțat la RM
      );

      this.logger.log(
        `✅ Empleado ${empleadoId} renunció a RM para documento ${documentoId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Error renunciando a RM para documento ${documentoId}:`,
        error,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(`Error renunciando a RM: ${error.message}`);
    }
  }

  /**
   * Adaugă semnătura (imagine) în DOCX înlocuind placeholder-ul {{FIRMA}}
   */
  async agregarFirmaADocx(
    docxBuffer: Buffer,
    firmaImageBuffer: Buffer,
  ): Promise<Buffer> {
    try {
      const zip = new AdmZip(docxBuffer);
      let documentXml = zip.readAsText('word/document.xml');
      let relsXml = zip.readAsText('word/_rels/document.xml.rels');

      // Verifică dacă există placeholder-ul {{FIRMA}} în diferite formate
      const hasFirma1 = documentXml.includes('{{FIRMA}}');
      const hasFirma2 = documentXml.includes('{ { FIRMA } }');
      const hasFirma3 = documentXml.match(
        /<w:t[^>]*>\{\{<\/w:t>.*?<w:t[^>]*>FIRMA<\/w:t>/,
      );

      this.logger.log(`🔍 [Agregar Firma] Căutare placeholder {{FIRMA}}:`);
      this.logger.log(`   - {{FIRMA}} direct: ${hasFirma1}`);
      this.logger.log(`   - { { FIRMA } } cu spații: ${hasFirma2}`);
      this.logger.log(
        `   - {{FIRMA}} în tag-uri separate: ${hasFirma3 ? 'DA' : 'NU'}`,
      );

      if (!hasFirma1 && !hasFirma2 && !hasFirma3) {
        // Caută și alte variante posibile
        const firmaMatches = documentXml.match(/FIRMA/gi);
        this.logger.warn(
          `⚠️ Placeholder {{FIRMA}} nu a fost găsit în document. Cuvântul "FIRMA" apare ${firmaMatches ? firmaMatches.length : 0} ori.`,
        );

        // Log un fragment din document pentru debugging
        const sampleXml = documentXml.substring(0, 2000);
        this.logger.warn(
          `📄 Fragment XML (primele 2000 caractere): ${sampleXml}`,
        );

        return docxBuffer; // Returnează documentul original dacă nu există placeholder
      }

      // Găsește rId disponibil
      const rIdMatches = relsXml.match(/rId(\d+)/g);
      let maxRId = 0;
      if (rIdMatches) {
        rIdMatches.forEach((match) => {
          const id = parseInt(match.replace('rId', ''));
          if (id > maxRId) maxRId = id;
        });
      }
      const newRId = `rId${maxRId + 1}`;
      const imageId = maxRId + 1;

      // Adaugă imaginea semnăturii în ZIP
      const imageName = `signature_${Date.now()}.png`;
      const imagePath = `word/media/${imageName}`;
      zip.addFile(imagePath, firmaImageBuffer);
      this.logger.log(`✅ Imagine semnătură adăugată: ${imagePath}`);

      // Adaugă relația în document.xml.rels
      const newRelationship = `  <Relationship Id="${newRId}" Target="media/${imageName}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"/>`;
      relsXml = relsXml.replace(
        '</Relationships>',
        `${newRelationship}\n</Relationships>`,
      );
      this.logger.log(`✅ Relație adăugată: ${newRId} -> media/${imageName}`);

      // Structură XML pentru imagine în DOCX (dimensiuni standard pentru semnătură)
      const imageDrawing = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="3000000" cy="1500000"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${imageId}" name="Firma"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${imageId}" name="Firma"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${newRId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3000000" cy="1500000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;

      // Înlocuiește placeholder-ul {{FIRMA}} cu imaginea
      let replacementsCount = 0;

      // Strategie: înlocuim placeholder-ul împreună cu orice spațiu sau structură XML care îl înconjoară
      // pentru a asigura că imaginea se inserează exact în locul placeholder-ului, fără spațiu suplimentar

      // Varianta 1: placeholder într-un singur tag <w:t>{{FIRMA}}</w:t>
      // Strategie: înlocuim doar tag-ul <w:t> pentru a evita coruperea structurii XML
      // Nu înlocuim paragrafe sau celule întregi pentru a evita probleme de validitate XML
      const before1 = documentXml;
      documentXml = documentXml.replace(
        /<w:t[^>]*>\{\{FIRMA\}\}<\/w:t>/g,
        (match) => {
          replacementsCount++;
          this.logger.log(
            `✅ Înlocuit placeholder (varianta 1 - exact w:t): ${match.substring(0, 50)}...`,
          );
          return imageDrawing;
        },
      );
      if (before1 !== documentXml) {
        this.logger.log(`✅ Varianta 1: ${replacementsCount} înlocuiri`);
      }

      // Varianta 2: placeholder separat în tag-uri ({{FIRMA}} poate fi în tag-uri diferite)
      // Înlocuiește toate tag-urile <w:t> care conțin părți din placeholder
      const before2 = documentXml;
      documentXml = documentXml.replace(
        /<w:t[^>]*>\{\{<\/w:t>\s*<w:t[^>]*>FIRMA<\/w:t>\s*<w:t[^>]*>\}\}<\/w:t>/gs,
        (match) => {
          replacementsCount++;
          this.logger.log(
            `✅ Înlocuit placeholder (varianta 2 - tag-uri separate): ${match.substring(0, 100)}...`,
          );
          return imageDrawing;
        },
      );
      if (before2 !== documentXml) {
        this.logger.log(`✅ Varianta 2: ${replacementsCount} înlocuiri`);
      }

      // Varianta 3: placeholder cu spații { { FIRMA } } - fallback
      const before3 = documentXml;
      documentXml = documentXml.replace(
        /<w:t[^>]*>\{\s*{\s*FIRMA\s*}\s*\}<\/w:t>/g,
        (match) => {
          replacementsCount++;
          this.logger.log(
            `✅ Înlocuit placeholder (varianta 3 - cu spații): ${match}`,
          );
          return imageDrawing;
        },
      );
      if (before3 !== documentXml) {
        this.logger.log(`✅ Varianta 3: ${replacementsCount} înlocuiri`);
      }

      // Varianta 4: placeholder într-un <w:r> complet - doar dacă nu s-a găsit în variantele anterioare
      // Aceasta este o ultimă opțiune pentru cazuri complexe
      const before4 = documentXml;
      if (replacementsCount === 0) {
        documentXml = documentXml.replace(
          /<w:r[^>]*>.*?<w:t[^>]*>\{\{FIRMA\}\}<\/w:t>.*?<\/w:r>/gs,
          (match) => {
            replacementsCount++;
            this.logger.log(
              `✅ Înlocuit placeholder (varianta 4 - întreg w:r fallback): ${match.substring(0, 80)}...`,
            );
            return imageDrawing;
          },
        );
        if (before4 !== documentXml) {
          this.logger.log(`✅ Varianta 4: ${replacementsCount} înlocuiri`);
        }
      }

      if (replacementsCount === 0) {
        this.logger.error(
          '❌ Niciun placeholder {{FIRMA}} nu a fost înlocuit!',
        );
      } else {
        this.logger.log(`✅ Total înlocuiri: ${replacementsCount}`);
      }

      // Verifică dacă XML-ul este valid (are tag-uri închise corect)
      const openTags = (documentXml.match(/<w:[^>]+>/g) || []).length;
      const closeTags = (documentXml.match(/<\/w:[^>]+>/g) || []).length;
      const selfClosingTags = (documentXml.match(/<w:[^>]+\/>/g) || []).length;

      // Verifică dacă există tag-uri neechilibrate (fără să numărăm self-closing tags)
      const balancedTags = openTags - selfClosingTags === closeTags;

      if (!balancedTags) {
        this.logger.warn(
          `⚠️ XML-ul poate fi neechilibrat: ${openTags} tag-uri deschise, ${closeTags} tag-uri închise, ${selfClosingTags} self-closing`,
        );
      }

      // Verifică dacă există caractere invalide sau probleme de encoding
      if (documentXml.includes('\0') || documentXml.includes('\uFFFD')) {
        this.logger.warn(
          '⚠️ XML-ul conține caractere invalide sau probleme de encoding',
        );
      }

      // Actualizează fișierele în ZIP
      try {
        zip.updateFile('word/document.xml', Buffer.from(documentXml, 'utf8'));
        zip.updateFile(
          'word/_rels/document.xml.rels',
          Buffer.from(relsXml, 'utf8'),
        );

        this.logger.log('✅ Semnătura adăugată în DOCX');

        // Returnează DOCX-ul modificat
        const resultBuffer = zip.toBuffer();

        // Verifică dacă buffer-ul este valid (nu este gol)
        if (!resultBuffer || resultBuffer.length === 0) {
          this.logger.error('❌ Buffer-ul DOCX generat este gol!');
          throw new Error('Buffer-ul DOCX generat este gol');
        }

        this.logger.log(
          `✅ DOCX generat cu succes: ${resultBuffer.length} bytes`,
        );
        return resultBuffer;
      } catch (zipError: any) {
        this.logger.error(`❌ Error actualizando ZIP: ${zipError.message}`);
        throw zipError;
      }
    } catch (error: any) {
      this.logger.error(`❌ Error agregando firma a DOCX: ${error.message}`);
      // Dacă apare eroare, returnează documentul original
      return docxBuffer;
    }
  }

  /**
   * Încarcă documentul semnat pentru Renuncia RM
   */
  async subirDocumentoFirmado(
    documentoId: number,
    empleadoId: string,
    archivoFirmado: Buffer,
    nombreArchivo: string,
  ): Promise<void> {
    try {
      // Verifică că documentul există și aparține angajatului
      // Obține și informații despre template pentru notificare
      const documento = await this.prisma.$queryRawUnsafe<
        Array<{
          id: number;
          empleado_id: string;
          tipo_documento: string;
          estado: string;
          template_nombre: string | null;
        }>
      >(
        `
        SELECT 
          ed.id, 
          ed.empleado_id, 
          ed.tipo_documento, 
          ed.estado,
          t.nombre as template_nombre
        FROM prl_employee_documents ed
        LEFT JOIN prl_document_templates t ON ed.template_id = t.id
        WHERE ed.id = ${documentoId}
          AND ed.empleado_id = ${this.escapeSql(empleadoId)}
        LIMIT 1
        `,
      );

      if (!documento || documento.length === 0) {
        throw new NotFoundException(
          `Documento ${documentoId} no encontrado o no tienes acceso`,
        );
      }

      // Verifică că statusul este PENDIENTE
      if (documento[0].estado !== 'PENDIENTE') {
        throw new BadRequestException(
          `El documento debe tener estado PENDIENTE para poder subir la firma. Estado actual: ${documento[0].estado}`,
        );
      }

      // Normalizează numele fișierului
      const nombreNormalizado = this.normalizarNombreArchivo(nombreArchivo);

      // Convertim buffer-ul la hex pentru MySQL
      const archivoHex = `0x${archivoFirmado.toString('hex')}`;

      // Actualizează documentul cu fișierul semnat
      await this.prisma.$executeRawUnsafe(
        `
        UPDATE prl_employee_documents
        SET archivo_firmado = ${archivoHex},
            nombre_archivo_firmado = ${this.escapeSql(nombreNormalizado)},
            estado = 'FIRMADO',
            fecha_firma = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${documentoId}
          AND empleado_id = ${this.escapeSql(empleadoId)}
        `,
      );

      // Creează audit log
      await this.crearAuditLog(documentoId, empleadoId, 'FIRMADO');

      this.logger.log(
        `✅ Documento ${documentoId} firmado y subido por empleado ${empleadoId}`,
      );

      // Trimite notificare Telegram la gestoria
      try {
        // Obține numele angajatului
        const empleadoInfo = await this.prisma.$queryRawUnsafe<
          Array<{
            nombre: string;
          }>
        >(
          `
          SELECT CONCAT(\`NOMBRE / APELLIDOS\`) as nombre
          FROM DatosEmpleados
          WHERE CODIGO = ${this.escapeSql(empleadoId)}
          LIMIT 1
          `,
        );

        const empleadoNombre =
          empleadoInfo && empleadoInfo.length > 0
            ? empleadoInfo[0].nombre
            : empleadoId;

        const templateNombre =
          documento[0].template_nombre ||
          documento[0].tipo_documento ||
          'Documento PRL';
        const fechaFirma = new Date().toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const mensajeTelegram = `✅ *Documento PRL Firmado*

👤 *Empleado:* ${empleadoNombre}
📄 *Documento:* ${templateNombre}
📅 *Fecha:* ${fechaFirma}
🆔 *ID Documento:* ${documentoId}

El documento ha sido firmado y guardado correctamente.`;

        if (this.telegramService.isConfigured()) {
          await this.telegramService.sendMessage(mensajeTelegram);
          this.logger.log(
            `📱 Notificación Telegram enviada a gestoria para documento ${documentoId}`,
          );
        } else {
          this.logger.warn(
            '⚠️ Telegram service no configurado, no se envió notificación',
          );
        }
      } catch (telegramError: any) {
        // Nu aruncăm eroare dacă Telegram eșuează - doar logăm
        this.logger.warn(
          `⚠️ Error enviando notificación Telegram: ${telegramError.message}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Error subiendo documento firmado ${documentoId}:`,
        error,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error subiendo documento firmado: ${error.message}`,
      );
    }
  }

  /**
   * Obține toți angajații cu documentele lor PRL organizate pentru tabel/matrix
   * Returnează datele organizate pentru afișare în tabel (angajați pe rânduri, documente pe coloane)
   */
  async listarEmpleadosConDocumentosPRL(): Promise<
    Array<{
      empleado_id: string;
      empleado_nombre: string;
      grupo_nombre: string;
      documentos: Array<{
        tipo_documento: PrlDocumentType;
        estado: string;
        fecha_firma: Date | null;
        requiere_firma: boolean;
        template_id: number;
        documento_id: number;
      }>;
    }>
  > {
    try {
      // Obține toți angajații activi
      const empleados = await this.prisma.$queryRawUnsafe<
        Array<{
          CODIGO: string;
          'NOMBRE / APELLIDOS': string;
          GRUPO: string;
        }>
      >(
        `
        SELECT 
          CODIGO,
          \`NOMBRE / APELLIDOS\`,
          \`GRUPO\`
        FROM DatosEmpleados
        WHERE \`ESTADO\` = 'ACTIVO'
          AND \`GRUPO\` IS NOT NULL
          AND \`GRUPO\` != ''
        ORDER BY \`NOMBRE / APELLIDOS\`
        `,
      );

      // Obține toate documentele PRL pentru toți angajații
      const documentos = await this.prisma.$queryRawUnsafe<
        Array<{
          empleado_id: string;
          tipo_documento: string;
          estado: string;
          fecha_firma: Date | null;
          requiere_firma: number;
          template_id: number;
          id: number;
        }>
      >(
        `
        SELECT 
          ed.empleado_id,
          ed.tipo_documento,
          ed.estado,
          ed.fecha_firma,
          t.requiere_firma,
          ed.template_id,
          ed.id
        FROM prl_employee_documents ed
        INNER JOIN prl_document_templates t ON ed.template_id = t.id
        WHERE t.activo = 1
        ORDER BY ed.empleado_id, ed.tipo_documento
        `,
      );

      // Organizează documentele pe angajat
      const documentosMap = new Map<
        string,
        Array<{
          tipo_documento: PrlDocumentType;
          estado: string;
          fecha_firma: Date | null;
          requiere_firma: boolean;
          template_id: number;
          documento_id: number;
        }>
      >();

      for (const doc of documentos) {
        if (!documentosMap.has(doc.empleado_id)) {
          documentosMap.set(doc.empleado_id, []);
        }
        documentosMap.get(doc.empleado_id)!.push({
          tipo_documento: doc.tipo_documento as PrlDocumentType,
          estado: doc.estado,
          fecha_firma: doc.fecha_firma,
          requiere_firma: doc.requiere_firma === 1,
          template_id: doc.template_id,
          documento_id: doc.id,
        });
      }

      // Construiește rezultatul final
      return empleados.map((emp) => ({
        empleado_id: emp.CODIGO,
        empleado_nombre: emp['NOMBRE / APELLIDOS'] || 'Sin nombre',
        grupo_nombre: emp.GRUPO || 'Sin grupo',
        documentos: documentosMap.get(emp.CODIGO) || [],
      }));
    } catch (error: any) {
      this.logger.error(
        `❌ Error listando empleados con documentos PRL:`,
        error,
      );
      throw new BadRequestException(
        `Error listando empleados con documentos: ${error.message}`,
      );
    }
  }

  /**
   * Actualizează template-urile MANUAL_TEST existente pentru a seta requiere_firma = true
   * (pentru că manualul trebuie semnat după autoevaluare)
   */
  async actualizarManualesRequiereFirma(): Promise<{
    actualizados: number;
  }> {
    try {
      const result = await this.prisma.$executeRawUnsafe(
        `
        UPDATE prl_document_templates
        SET requiere_firma = 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE tipo_documento = 'MANUAL_TEST'
          AND requiere_firma = 0
        `,
      );

      this.logger.log(
        `✅ Actualizados ${result} templates MANUAL_TEST para requerir firma`,
      );

      return {
        actualizados: result as number,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error actualizando templates MANUAL_TEST:`, error);
      throw new BadRequestException(
        `Error actualizando templates: ${error.message}`,
      );
    }
  }

  /**
   * Convertește un buffer DOCX la HTML folosind mammoth
   */
  async convertirDocxAHtml(docxBuffer: Buffer): Promise<{ html: string }> {
    try {
      this.logger.log(
        `🔄 Convirtiendo DOCX a HTML, tamaño: ${docxBuffer.length} bytes`,
      );

      // În Node.js, mammoth acceptă direct Buffer
      const result = await mammoth.convertToHtml({ buffer: docxBuffer });

      if (!result || !result.value) {
        throw new BadRequestException(
          'La conversión de DOCX no devolvió resultados válidos',
        );
      }

      this.logger.log(
        `✅ DOCX convertido a HTML exitosamente, longitud: ${result.value.length} caracteres`,
      );

      return {
        html: result.value,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error convirtiendo DOCX a HTML:`, error);
      throw new BadRequestException(
        `Error al convertir DOCX a HTML: ${error.message || error}`,
      );
    }
  }
}
