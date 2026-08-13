import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { EmpleadoGrupoScopeFilter } from './empleado-grupo-scope.service';
import { DocumentosSolicitadosService } from './documentos-solicitados.service';
import { PrlDocumentsService } from './prl-documents.service';
import { CarpetasDocumentosStorageService } from './carpetas-documentos-storage.service';
import { sanitizeFechaEmpleado } from '../utils/fecha-empleado.util';
import {
  generateTemporaryPassword,
  hashPassword,
  isBcryptHash,
  validatePasswordComplexity,
  verifyPassword,
} from '../utils/password.util';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

import * as pdfParseModule from 'pdf-parse';

@Injectable()
export class EmpleadosService {
  private readonly logger = new Logger(EmpleadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly carpetasStorage: CarpetasDocumentosStorageService,
    @Inject(forwardRef(() => DocumentosSolicitadosService))
    private readonly documentosSolicitadosService?: DocumentosSolicitadosService,
    @Optional()
    @Inject(forwardRef(() => PrlDocumentsService))
    private readonly prlDocumentsService?: PrlDocumentsService,
  ) {}

  /**
   * Helper function to get formatted employee name
   * Uses new split columns (NOMBRE, APELLIDO1, APELLIDO2) with fallback to original
   */
  getFormattedNombre(empleado: any): string {
    // If confidence is 0 (failed) or new columns are not available, use original
    const confianza =
      empleado.NOMBRE_SPLIT_CONFIANZA ?? empleado.nombre_split_confianza ?? 2;
    const nombre = empleado.NOMBRE ?? empleado.nombre;
    const apellido1 = empleado.APELLIDO1 ?? empleado.apellido1;
    const apellido2 = empleado.APELLIDO2 ?? empleado.apellido2;

    // Use new columns if confidence is good (1 or 2) and they exist
    if (confianza > 0 && nombre) {
      const parts = [nombre, apellido1, apellido2].filter(
        (p) => p && p.trim() !== '',
      );
      if (parts.length > 0) {
        return parts.join(' ');
      }
    }

    // Fallback to original column
    return (
      empleado['NOMBRE / APELLIDOS'] ??
      empleado.NOMBRE_APELLIDOS ??
      empleado.CODIGO ??
      'Unknown'
    );
  }

  /**
   * Obtiene estadísticas completas de empleados (cuadrante, horario, centro)
   * Con `scope` (user_empleado_grupo_scope): mismos empleados que GET /empleados con ámbito.
   */
  async getEstadisticasEmpleados(
    mes?: string,
    scope?: EmpleadoGrupoScopeFilter | null,
  ): Promise<any[]> {
    // Validăm și normalizăm parametrul mes (format: YYYY-MM)
    let mesParam = mes?.trim();
    if (!mesParam || !/^\d{4}-\d{2}$/.test(mesParam)) {
      // Dacă nu e valid, folosim luna curentă
      const now = new Date();
      mesParam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // Escape SQL pentru siguranță
    const mesEscaped = this.escapeSql(mesParam);

    let scopeWhere = '';
    if (scope?.grupos?.length) {
      const gruposEsc = [
        ...new Set(
          scope.grupos
            .map((g) => String(g || '').trim())
            .filter((g) => g.length > 0),
        ),
      ].map((g) => this.escapeSql(g));
      if (gruposEsc.length === 0) {
        scopeWhere = ' WHERE 1=0';
      } else {
        scopeWhere = ` WHERE (TRIM(de.\`GRUPO\`) IN (${gruposEsc.join(', ')}) OR CAST(de.CODIGO AS CHAR) = ${this.escapeSql(scope.includeSelfCodigo)})`;
      }
    }

    const query = `
      SELECT
        CAST(de.CODIGO AS CHAR) AS CODIGO,
        de.\`NOMBRE / APELLIDOS\` AS nombre,
        de.\`CORREO ELECTRONICO\` AS email,
        de.ESTADO AS estado,
        de.\`FECHA DE ALTA\` AS fecha_alta,
        de.\`CENTRO TRABAJO\` AS centro,
        de.\`GRUPO\` AS grupo,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM cuadrante c 
            WHERE CAST(c.CODIGO AS CHAR) = CAST(de.CODIGO AS CHAR)
              AND c.LUNA = ${mesEscaped}
          ) THEN 'Sí'
          ELSE 'No'
        END AS tiene_cuadrante,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM horarios h
            WHERE h.centro_nombre = de.\`CENTRO TRABAJO\`
              AND h.grupo_nombre = de.\`GRUPO\`
          ) AND EXISTS (
            SELECT 1 FROM horario_multicentro hm
            WHERE CAST(hm.CODIGO AS CHAR) = CAST(de.CODIGO AS CHAR)
              AND hm.LUNA = ${mesEscaped}
          ) THEN 'Ambele'
          WHEN EXISTS (
            SELECT 1 FROM horarios h
            WHERE h.centro_nombre = de.\`CENTRO TRABAJO\`
              AND h.grupo_nombre = de.\`GRUPO\`
          ) THEN 'Normal'
          WHEN EXISTS (
            SELECT 1 FROM horario_multicentro hm
            WHERE CAST(hm.CODIGO AS CHAR) = CAST(de.CODIGO AS CHAR)
              AND hm.LUNA = ${mesEscaped}
          ) THEN 'Multicentro'
          ELSE 'No'
        END AS tiene_horario,
        CASE 
          WHEN de.\`CENTRO TRABAJO\` IS NOT NULL 
            AND TRIM(de.\`CENTRO TRABAJO\`) <> '' 
          THEN 'Sí'
          ELSE 'No'
        END AS tiene_centro,
        -- Doar datos personales faltantes (cuadrante/horario/centro au coloane separate)
        -- Folosim CONCAT_WS pentru a adăuga automat virgule între elemente
        CONCAT_WS(', ',
          CASE WHEN de.\`D.N.I. / NIE\` IS NULL OR TRIM(de.\`D.N.I. / NIE\`) = '' THEN 'Sin DNI/NIE' ELSE NULL END,
          CASE WHEN de.\`CORREO ELECTRONICO\` IS NULL OR TRIM(de.\`CORREO ELECTRONICO\`) = '' THEN 'Sin email' ELSE NULL END,
          CASE WHEN de.TELEFONO IS NULL OR TRIM(de.TELEFONO) = '' THEN 'Sin teléfono' ELSE NULL END,
          CASE WHEN de.DIRECCION IS NULL OR TRIM(de.DIRECCION) = '' THEN 'Sin dirección' ELSE NULL END,
          CASE WHEN de.\`FECHA DE ALTA\` IS NULL OR TRIM(de.\`FECHA DE ALTA\`) = '' THEN 'Sin fecha alta' ELSE NULL END,
          CASE WHEN de.\`SEG. SOCIAL\` IS NULL OR TRIM(de.\`SEG. SOCIAL\`) = '' THEN 'Sin seg. social' ELSE NULL END
        ) AS detalles_faltantes
      FROM DatosEmpleados de
      ${scopeWhere}
      ORDER BY de.\`NOMBRE / APELLIDOS\`
    `;

    try {
      const results = await this.prisma.$queryRawUnsafe<any[]>(query);
      this.logger.log(
        `✅ Estadísticas empleados retornó ${results?.length || 0} resultados`,
      );
      return results || [];
    } catch (error: any) {
      this.logger.error(
        `❌ Error en getEstadisticasEmpleados: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al obtener estadísticas: ${error.message}`,
      );
    }
  }

  async exportEstadisticasEmpleadosExcel(
    mes?: string,
    scope?: EmpleadoGrupoScopeFilter | null,
  ): Promise<Buffer> {
    try {
      const estadisticas = await this.getEstadisticasEmpleados(mes, scope);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Estadísticas Empleados');

      // Headers
      worksheet.columns = [
        { header: 'CODIGO', key: 'CODIGO', width: 15 },
        { header: 'NOMBRE', key: 'nombre', width: 30 },
        { header: 'EMAIL', key: 'email', width: 30 },
        { header: 'ESTADO', key: 'estado', width: 12 },
        { header: 'FECHA ALTA', key: 'fecha_alta', width: 15 },
        { header: 'CENTRO', key: 'centro', width: 40 },
        { header: 'GRUPO', key: 'grupo', width: 25 },
        { header: 'CUADRANTE', key: 'tiene_cuadrante', width: 12 },
        { header: 'HORARIO', key: 'tiene_horario', width: 12 },
        { header: 'CENTRO ASIGNADO', key: 'tiene_centro', width: 15 },
        { header: 'DETALLES FALTANTES', key: 'detalles_faltantes', width: 50 },
      ];

      // Style headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Add data
      estadisticas.forEach((emp) => {
        worksheet.addRow({
          CODIGO: emp.CODIGO,
          nombre: emp.nombre,
          email: emp.email,
          estado: emp.estado,
          fecha_alta: emp.fecha_alta || 'Sin fecha',
          centro: emp.centro || '-',
          grupo: emp.grupo || '-',
          tiene_cuadrante: emp.tiene_cuadrante || 'No',
          tiene_horario: emp.tiene_horario || 'No',
          tiene_centro: emp.tiene_centro || 'No',
          detalles_faltantes: emp.detalles_faltantes || '-',
        });
      });

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    } catch (error: any) {
      this.logger.error(
        `❌ Error en exportEstadisticasEmpleadosExcel: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al exportar Excel: ${error.message}`,
      );
    }
  }

  async exportEstadisticasEmpleadosPDF(
    mes?: string,
    scope?: EmpleadoGrupoScopeFilter | null,
  ): Promise<Buffer> {
    try {
      const estadisticas = await this.getEstadisticasEmpleados(mes, scope);

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
          size: 'A4',
          layout: 'landscape',
          margin: 50,
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Title
        doc.fontSize(18).text('Estadísticas de Empleados', { align: 'center' });
        doc.moveDown();

        // Table headers
        const headers = [
          'CODIGO',
          'NOMBRE',
          'EMAIL',
          'ESTADO',
          'FECHA ALTA',
          'CENTRO',
          'GRUPO',
          'CUADRANTE',
          'HORARIO',
          'CENTRO',
          'DETALLES',
        ];
        const colWidths = [60, 120, 120, 60, 70, 120, 80, 60, 60, 60, 120];
        const startY = doc.y;
        let currentY = startY;

        // Draw header
        doc.fontSize(8).font('Helvetica-Bold');
        let x = 50;
        headers.forEach((header, i) => {
          doc.text(header, x, currentY, { width: colWidths[i], align: 'left' });
          x += colWidths[i];
        });
        currentY += 20;

        // Draw rows
        doc.font('Helvetica');
        estadisticas.forEach((emp) => {
          if (currentY > 700) {
            doc.addPage();
            currentY = 50;
            // Redraw headers on new page
            x = 50;
            doc.font('Helvetica-Bold');
            headers.forEach((header, i) => {
              doc.text(header, x, currentY, {
                width: colWidths[i],
                align: 'left',
              });
              x += colWidths[i];
            });
            currentY += 20;
            doc.font('Helvetica');
          }

          const row = [
            emp.CODIGO || '-',
            (emp.nombre || '-').substring(0, 25),
            (emp.email || '-').substring(0, 25),
            emp.estado || '-',
            emp.fecha_alta || 'Sin fecha',
            (emp.centro || '-').substring(0, 20),
            (emp.grupo || '-').substring(0, 15),
            emp.tiene_cuadrante || 'No',
            emp.tiene_horario || 'No',
            emp.tiene_centro || 'No',
            (emp.detalles_faltantes || '-').substring(0, 20),
          ];

          x = 50;
          row.forEach((cell, i) => {
            doc
              .fontSize(7)
              .text(cell, x, currentY, { width: colWidths[i], align: 'left' });
            x += colWidths[i];
          });
          currentY += 15;
        });

        doc.end();
      });
    } catch (error: any) {
      this.logger.error(
        `❌ Error en exportEstadisticasEmpleadosPDF: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Error al exportar PDF: ${error.message}`);
    }
  }

  async exportListaIbanPDF(): Promise<Buffer> {
    try {
      // CODIGO-uri de utilizatori de exclus din listă (utilizatori de test/admin)
      const excludedCodigos = ['10000002', '10000001'];

      // Obține toți angajații
      const allEmpleados = await this.getAllEmpleados();

      // Filtrează doar cei activi
      // Exclude pe cei cu fecha baja programada (viitoare) și utilizatorii de test/admin
      const activeEmployees = allEmpleados.filter((emp) => {
        const codigo = (emp.CODIGO || emp.codigo || '').toString().trim();
        const estado = (emp.ESTADO || emp.estado || '')
          .toString()
          .trim()
          .toUpperCase();
        const fechaBajaProgramada =
          emp['fecha_baja_programada'] || emp.fecha_baja_programada || '';

        // Exclude utilizatorii de test/admin
        if (excludedCodigos.includes(codigo)) {
          return false;
        }

        // Exclude pe cei cu fecha baja programada
        if (fechaBajaProgramada && fechaBajaProgramada.trim() !== '') {
          return false;
        }

        // Include DOAR pe cei cu ESTADO = 'ACTIVO'
        return estado === 'ACTIVO';
      });

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
          size: 'A4',
          layout: 'landscape',
          margin: 50,
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Title
        doc
          .fontSize(16)
          .text('Lista de IBAN - Empleados Activos', { align: 'center' });
        doc.moveDown(0.5);

        // Table headers - 3 coloane
        const headers = ['CODIGO', 'NOMBRE', 'IBAN'];
        // Lățimi coloane pentru landscape A4 (width ~842px, margin 50px = 742px disponibil)
        const colWidths = [120, 300, 322]; // Total: 742px
        const rowHeight = 18;
        const tableTop = doc.y;
        let currentY = tableTop;

        // Draw header
        doc.fontSize(10).font('Helvetica-Bold');
        let x = 50;
        headers.forEach((header, i) => {
          doc.text(header, x, currentY, { width: colWidths[i], align: 'left' });
          x += colWidths[i];
        });
        currentY += rowHeight;

        // Linie sub header
        doc
          .moveTo(50, currentY)
          .lineTo(50 + colWidths.reduce((a, b) => a + b, 0), currentY)
          .stroke();

        // Draw rows
        doc.font('Helvetica').fontSize(8);
        currentY += 3;

        activeEmployees.forEach((emp) => {
          // Verifică dacă trebuie pagină nouă
          if (currentY > 750) {
            doc.addPage();
            currentY = 50;

            // Redraw headers on new page
            doc.font('Helvetica-Bold').fontSize(10);
            x = 50;
            headers.forEach((header, i) => {
              doc.text(header, x, currentY, {
                width: colWidths[i],
                align: 'left',
              });
              x += colWidths[i];
            });
            currentY += rowHeight;

            // Linie sub header
            doc
              .moveTo(50, currentY)
              .lineTo(50 + colWidths.reduce((a, b) => a + b, 0), currentY)
              .stroke();

            currentY += 3;
            doc.font('Helvetica').fontSize(8);
          }

          const codigo = (emp.CODIGO || emp.codigo || '').toString().trim();
          const nombre =
            this.getFormattedNombre(emp) ||
            emp['NOMBRE / APELLIDOS'] ||
            emp.NOMBRE ||
            '-';
          const iban =
            (emp['Nº Cuenta'] || emp['Nº CUENTA'] || emp.cuenta || '')
              .toString()
              .trim() || '-';

          // Truncate text dacă e prea lung pentru a evita overflow
          const nombreTruncated =
            nombre.length > 40 ? nombre.substring(0, 37) + '...' : nombre;
          const ibanTruncated =
            iban.length > 38 ? iban.substring(0, 35) + '...' : iban;

          const row = [codigo, nombreTruncated, ibanTruncated];

          x = 50;
          row.forEach((cell, i) => {
            doc.text(cell || '-', x, currentY, {
              width: colWidths[i],
              align: 'left',
            });
            x += colWidths[i];
          });

          currentY += rowHeight;
        });

        doc.end();
      });
    } catch (error: any) {
      this.logger.error(
        `❌ Error en exportListaIbanPDF: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Error al exportar PDF: ${error.message}`);
    }
  }

  async getEmpleadoByCodigo(codigo: string) {
    if (!codigo) {
      throw new NotFoundException('Employee code is required');
    }

    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT 
        CODIGO,
        \`NOMBRE / APELLIDOS\`,
        NOMBRE_APELLIDOS_BACKUP,
        NOMBRE,
        APELLIDO1,
        APELLIDO2,
        NOMBRE_SPLIT_CONFIANZA,
        \`NACIONALIDAD\`,
        \`DIRECCION\`,
        \`D.N.I. / NIE\`,
        \`SEG. SOCIAL\`,
        \`Nº Cuenta\`,
        \`TELEFONO\`,
        \`CORREO ELECTRONICO\`,
        \`FECHA NACIMIENTO\`,
        \`FECHA DE ALTA\`,
        \`CENTRO TRABAJO\`,
        \`TIPO DE CONTRATO\`,
        \`SUELDO BRUTO MENSUAL\`,
        \`HORAS DE CONTRATO\`,
        \`EMPRESA\`,
        \`GRUPO\`,
        \`ESTADO\`,
        \`FECHA BAJA\`,
        \`Fecha Antigüedad\`,
        \`Antigüedad\`,
        \`DerechoPedidos\`,
        \`TrabajaFestivos\`,
        certificado_handicap_confirmado,
        CONTACTO_EMERGENCIA_NOMBRE,
        CONTACTO_EMERGENCIA_PARENTESCO,
        CONTACTO_EMERGENCIA_TELEFONO,
        CONTACTO_EMERGENCIA_ACTUALIZADO_AT
      FROM DatosEmpleados
      WHERE CODIGO = ${codigo}
      LIMIT 1
    `;

    const empleado = rows?.[0];

    if (!empleado) {
      throw new NotFoundException('Employee not found');
    }

    // Normalize keys frequently used in frontend (keep originals too)
    const normalized = {
      ...empleado,
      NOMBRE_APELLIDOS:
        empleado['NOMBRE / APELLIDOS'] ?? empleado.NOMBRE_APELLIDOS ?? null,
      ['NOMBRE / APELLIDOS']:
        empleado['NOMBRE / APELLIDOS'] ?? empleado.NOMBRE_APELLIDOS ?? null,
      CORREO_ELECTRONICO:
        empleado['CORREO ELECTRONICO'] ?? empleado.CORREO_ELECTRONICO ?? null,
      DNI_NIE: empleado['D.N.I. / NIE'] ?? empleado.DNI_NIE ?? null,
      SEG_SOCIAL: empleado['SEG. SOCIAL'] ?? empleado.SEG_SOCIAL ?? null,
      NUMERO_CUENTA: empleado['Nº Cuenta'] ?? empleado.NUMERO_CUENTA ?? null,
      CENTRO_TRABAJO:
        empleado['CENTRO TRABAJO'] ?? empleado.CENTRO_TRABAJO ?? null,
      SUELDO_BRUTO_MENSUAL:
        empleado['SUELDO BRUTO MENSUAL'] ??
        empleado.SUELDO_BRUTO_MENSUAL ??
        null,
      HORAS_CONTRATO:
        empleado['HORAS DE CONTRATO'] ?? empleado.HORAS_CONTRATO ?? null,
      FECHA_NACIMIENTO:
        empleado['FECHA NACIMIENTO'] ?? empleado.FECHA_NACIMIENTO ?? null,
      FECHA_DE_ALTA:
        empleado['FECHA DE ALTA'] ?? empleado.FECHA_DE_ALTA ?? null,
      FECHA_BAJA: sanitizeFechaEmpleado(
        empleado['FECHA BAJA'] ?? empleado.FECHA_BAJA ?? null,
      ),
      FECHA_ANTIGUEDAD: sanitizeFechaEmpleado(
        empleado['Fecha Antigüedad'] ?? empleado.FECHA_ANTIGUEDAD ?? null,
      ),
      ANTIGUEDAD: empleado['Antigüedad'] ?? empleado.ANTIGUEDAD ?? null,
      contacto_emergencia_nombre: empleado.CONTACTO_EMERGENCIA_NOMBRE ?? null,
      contacto_emergencia_parentesco:
        empleado.CONTACTO_EMERGENCIA_PARENTESCO ?? null,
      contacto_emergencia_telefono:
        empleado.CONTACTO_EMERGENCIA_TELEFONO ?? null,
      contacto_emergencia_actualizado_at:
        empleado.CONTACTO_EMERGENCIA_ACTUALIZADO_AT ?? null,
      empleadoId: empleado.CODIGO,
      empleadoNombre:
        empleado['NOMBRE / APELLIDOS'] ??
        empleado.NOMBRE_APELLIDOS ??
        empleado['CORREO ELECTRONICO'] ??
        empleado.CORREO_ELECTRONICO ??
        empleado.CODIGO ??
        null,
      email:
        empleado['CORREO ELECTRONICO'] ?? empleado.CORREO_ELECTRONICO ?? null,
    };

    return normalized;
  }

  /**
   * Lista empleados. `scope` solo desde HTTP autenticado con filas en user_empleado_grupo_scope.
   * Sin scope o sin filas en tabla = mismo comportamiento histórico (todos).
   */
  async getAllEmpleados(scope?: EmpleadoGrupoScopeFilter | null) {
    const selectSql = Prisma.sql`
      SELECT 
        CODIGO,
        \`NOMBRE / APELLIDOS\`,
        NOMBRE_APELLIDOS_BACKUP,
        NOMBRE,
        APELLIDO1,
        APELLIDO2,
        NOMBRE_SPLIT_CONFIANZA,
        \`NACIONALIDAD\`,
        \`DIRECCION\`,
        \`D.N.I. / NIE\`,
        \`SEG. SOCIAL\`,
        \`Nº Cuenta\`,
        \`TELEFONO\`,
        \`CORREO ELECTRONICO\`,
        \`FECHA NACIMIENTO\`,
        \`FECHA DE ALTA\`,
        \`CENTRO TRABAJO\`,
        \`TIPO DE CONTRATO\`,
        \`SUELDO BRUTO MENSUAL\`,
        \`HORAS DE CONTRATO\`,
        \`EMPRESA\`,
        \`GRUPO\`,
        \`ESTADO\`,
        \`FECHA BAJA\`,
        \`Fecha Antigüedad\`,
        \`Antigüedad\`,
        \`DerechoPedidos\`,
        \`TrabajaFestivos\`,
        certificado_handicap_confirmado,
        fecha_baja_programada,
        VACACIONES_RESTANTES_ANO_ANTERIOR
      FROM DatosEmpleados
    `;

    let rows: any[];
    if (scope?.grupos?.length) {
      const inList = Prisma.join(scope.grupos.map((g) => Prisma.sql`${g}`));
      rows = await this.prisma.$queryRaw<any[]>`
        ${selectSql}
        WHERE (TRIM(\`GRUPO\`) IN (${inList}) OR CODIGO = ${scope.includeSelfCodigo})
        ORDER BY \`NOMBRE / APELLIDOS\` ASC
      `;
    } else {
      rows = await this.prisma.$queryRaw<any[]>`
        ${selectSql}
        ORDER BY \`NOMBRE / APELLIDOS\` ASC
      `;
    }

    return rows.map((empleado) => ({
      ...empleado,
      NOMBRE_APELLIDOS:
        empleado['NOMBRE / APELLIDOS'] ?? empleado.NOMBRE_APELLIDOS ?? null,
      ['NOMBRE / APELLIDOS']:
        empleado['NOMBRE / APELLIDOS'] ?? empleado.NOMBRE_APELLIDOS ?? null,
      CORREO_ELECTRONICO:
        empleado['CORREO ELECTRONICO'] ?? empleado.CORREO_ELECTRONICO ?? null,
      DNI_NIE: empleado['D.N.I. / NIE'] ?? empleado.DNI_NIE ?? null,
      SEG_SOCIAL: empleado['SEG. SOCIAL'] ?? empleado.SEG_SOCIAL ?? null,
      NUMERO_CUENTA: empleado['Nº Cuenta'] ?? empleado.NUMERO_CUENTA ?? null,
      CENTRO_TRABAJO:
        empleado['CENTRO TRABAJO'] ?? empleado.CENTRO_TRABAJO ?? null,
      SUELDO_BRUTO_MENSUAL:
        empleado['SUELDO BRUTO MENSUAL'] ??
        empleado.SUELDO_BRUTO_MENSUAL ??
        null,
      HORAS_CONTRATO:
        empleado['HORAS DE CONTRATO'] ?? empleado.HORAS_CONTRATO ?? null,
      FECHA_NACIMIENTO:
        empleado['FECHA NACIMIENTO'] ?? empleado.FECHA_NACIMIENTO ?? null,
      FECHA_DE_ALTA:
        empleado['FECHA DE ALTA'] ?? empleado.FECHA_DE_ALTA ?? null,
      FECHA_BAJA: sanitizeFechaEmpleado(
        empleado['FECHA BAJA'] ?? empleado.FECHA_BAJA ?? null,
      ),
      FECHA_ANTIGUEDAD: sanitizeFechaEmpleado(
        empleado['Fecha Antigüedad'] ?? empleado.FECHA_ANTIGUEDAD ?? null,
      ),
      ANTIGUEDAD: empleado['Antigüedad'] ?? empleado.ANTIGUEDAD ?? null,
      empleadoId: empleado.CODIGO,
      empleadoNombre: this.getFormattedNombre(empleado),
      email:
        empleado['CORREO ELECTRONICO'] ?? empleado.CORREO_ELECTRONICO ?? null,
    }));
  }

  /**
   * Helper pentru a escapa valori SQL
   */
  private escapeSql(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    const stringValue = String(value);
    // Escape single quotes
    const escaped = stringValue.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  private generateTemporaryPassword(): string {
    return generateTemporaryPassword(12);
  }

  /** Persist bcrypt hash + bump AUTH_VERSION (invalidates JWTs). */
  private async setPasswordHash(
    codigo: string,
    passwordHash: string,
  ): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE DatosEmpleados
       SET \`Contraseña\` = ?, AUTH_VERSION = AUTH_VERSION + 1
       WHERE CODIGO = ?`,
      passwordHash,
      codigo,
    );
  }

  /**
   * Adaugă un nou empleado în baza de date
   */
  async addEmpleado(empleadoData: {
    CODIGO: string;
    'NOMBRE / APELLIDOS'?: string;
    NOMBRE?: string;
    APELLIDO1?: string;
    APELLIDO2?: string;
    NOMBRE_SPLIT_CONFIANZA?: number;
    NACIONALIDAD?: string;
    DIRECCION?: string;
    'D.N.I. / NIE'?: string;
    'SEG. SOCIAL'?: string;
    'Nº Cuenta'?: string;
    TELEFONO?: string;
    'CORREO ELECTRONICO'?: string;
    'FECHA NACIMIENTO'?: string;
    'FECHA DE ALTA'?: string;
    'FECHA BAJA'?: string;
    'Fecha Antigüedad'?: string;
    Antigüedad?: string;
    'CENTRO TRABAJO'?: string;
    'TIPO DE CONTRATO'?: string;
    'SUELDO BRUTO MENSUAL'?: string;
    'HORAS DE CONTRATO'?: string;
    EMPRESA?: string;
    GRUPO?: string;
    ESTADO?: string;
    DerechoPedidos?: string;
    TrabajaFestivos?: string;
    Contraseña?: string;
  }): Promise<{ success: true; codigo: string; temporaryPassword?: string }> {
    if (!empleadoData.CODIGO) {
      throw new BadRequestException('CODIGO is required');
    }

    try {
      // Parola în clar doar în memorie pentru email one-shot; în DB doar bcrypt.
      const hasPasswordProvided =
        empleadoData.Contraseña && empleadoData.Contraseña.trim() !== '';
      const temporaryPassword = hasPasswordProvided
        ? String(empleadoData.Contraseña).trim()
        : this.generateTemporaryPassword();
      const passwordHash = isBcryptHash(temporaryPassword)
        ? temporaryPassword
        : await hashPassword(temporaryPassword);

      // Construim query-ul INSERT
      const insertQuery = `
        INSERT INTO DatosEmpleados (
          \`CODIGO\`,
          \`NOMBRE / APELLIDOS\`,
          \`NOMBRE\`,
          \`APELLIDO1\`,
          \`APELLIDO2\`,
          \`NOMBRE_SPLIT_CONFIANZA\`,
          \`NACIONALIDAD\`,
          \`DIRECCION\`,
          \`D.N.I. / NIE\`,
          \`SEG. SOCIAL\`,
          \`Nº Cuenta\`,
          \`TELEFONO\`,
          \`CORREO ELECTRONICO\`,
          \`FECHA NACIMIENTO\`,
          \`FECHA DE ALTA\`,
          \`CENTRO TRABAJO\`,
          \`TIPO DE CONTRATO\`,
          \`SUELDO BRUTO MENSUAL\`,
          \`HORAS DE CONTRATO\`,
          \`EMPRESA\`,
          \`GRUPO\`,
          \`ESTADO\`,
          \`FECHA BAJA\`,
          \`Fecha Antigüedad\`,
          \`Antigüedad\`,
          \`DerechoPedidos\`,
          \`TrabajaFestivos\`,
          \`Contraseña\`,
          \`AUTH_VERSION\`
        ) VALUES (
          ${this.escapeSql(empleadoData.CODIGO)},
          ${this.escapeSql(empleadoData['NOMBRE / APELLIDOS'] || '')},
          ${this.escapeSql(empleadoData.NOMBRE || null)},
          ${this.escapeSql(empleadoData.APELLIDO1 || null)},
          ${this.escapeSql(empleadoData.APELLIDO2 || null)},
          ${empleadoData.NOMBRE_SPLIT_CONFIANZA !== undefined ? empleadoData.NOMBRE_SPLIT_CONFIANZA : empleadoData.NOMBRE || empleadoData.APELLIDO1 || empleadoData.APELLIDO2 ? 2 : 0},
          ${this.escapeSql(empleadoData.NACIONALIDAD || '')},
          ${this.escapeSql(empleadoData.DIRECCION || '')},
          ${this.escapeSql(empleadoData['D.N.I. / NIE'] || '')},
          ${this.escapeSql(empleadoData['SEG. SOCIAL'] || '')},
          ${this.escapeSql(empleadoData['Nº Cuenta'] || '')},
          ${this.escapeSql(empleadoData.TELEFONO || '')},
          ${this.escapeSql(empleadoData['CORREO ELECTRONICO'] || '')},
          ${this.escapeSql(empleadoData['FECHA NACIMIENTO'] || '')},
          ${this.escapeSql(empleadoData['FECHA DE ALTA'] || '')},
          ${this.escapeSql(empleadoData['CENTRO TRABAJO'] || '')},
          ${this.escapeSql(empleadoData['TIPO DE CONTRATO'] || '')},
          ${this.escapeSql(empleadoData['SUELDO BRUTO MENSUAL'] || '')},
          ${this.escapeSql(empleadoData['HORAS DE CONTRATO'] || '')},
          ${this.escapeSql(empleadoData.EMPRESA || '')},
          ${this.escapeSql(empleadoData.GRUPO || '')},
          ${this.escapeSql(empleadoData.ESTADO || '')},
          ${this.escapeSql(sanitizeFechaEmpleado(empleadoData['FECHA BAJA']))},
          ${this.escapeSql(sanitizeFechaEmpleado(empleadoData['Fecha Antigüedad']))},
          ${this.escapeSql(empleadoData.Antigüedad || null)},
          ${this.escapeSql(empleadoData.DerechoPedidos || 'NO')},
          ${this.escapeSql(empleadoData.TrabajaFestivos || 'NO')},
          ${this.escapeSql(passwordHash)},
          0
        )
      `;

      await this.prisma.$executeRawUnsafe(insertQuery);

      const wasPasswordGenerated = !hasPasswordProvided;
      this.logger.log(
        `✅ Empleado adăugat cu succes: ${empleadoData.CODIGO}${wasPasswordGenerated ? ' (con contraseña temporal generada)' : ''}`,
      );

      // Aplicăm automat cererile cu aplicar_a_nuevos = true dacă angajatul este activ
      if (this.documentosSolicitadosService) {
        const estado = empleadoData.ESTADO || '';
        const esActivo = estado.toString().trim().toUpperCase() === 'ACTIVO';

        if (esActivo) {
          try {
            const result =
              await this.documentosSolicitadosService.aplicarReglasANuevoEmpleado(
                empleadoData.CODIGO,
              );
            if (result.aplicadas > 0) {
              this.logger.log(
                `✅ ${result.aplicadas} solicitud(es) aplicada(s) automáticamente a nuevo empleado ${empleadoData.CODIGO}`,
              );
            }
          } catch (error: any) {
            // Nu aruncăm eroare pentru a nu bloca crearea angajatului
            this.logger.warn(
              `⚠️ Error aplicando reglas a nuevo empleado ${empleadoData.CODIGO}: ${error.message}`,
            );
          }
        }
      }

      // Documentos PRL del grupo (misma lógica que «Enviar a Empleados»)
      if (this.prlDocumentsService) {
        const estado = empleadoData.ESTADO || '';
        const esActivo = estado.toString().trim().toUpperCase() === 'ACTIVO';
        const grupo = empleadoData.GRUPO?.trim();

        if (esActivo && grupo) {
          try {
            const prlResult =
              await this.prlDocumentsService.enviarDocumentosPrlAlNuevoEmpleado(
                empleadoData.CODIGO,
                grupo,
              );
            if (prlResult && prlResult.documentos_creados > 0) {
              this.logger.log(
                `✅ ${prlResult.documentos_creados} documento(s) PRL asignado(s) automáticamente a ${empleadoData.CODIGO}`,
              );
            }
          } catch (error: any) {
            this.logger.warn(
              `⚠️ Error enviando documentos PRL automáticos a ${empleadoData.CODIGO}: ${error.message}`,
            );
          }
        }
      }

      return {
        success: true,
        codigo: empleadoData.CODIGO,
        // Plain one-shot for welcome email only; never persisted. Skip if input was already a hash.
        temporaryPassword: isBcryptHash(temporaryPassword)
          ? undefined
          : temporaryPassword,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Eroare la adăugarea empleado ${empleadoData.CODIGO}:`,
        error,
      );

      // Verificăm dacă este eroare de duplicate
      if (
        error.code === 'ER_DUP_ENTRY' ||
        error.message?.includes('Duplicate')
      ) {
        throw new BadRequestException(
          `Empleado cu CODIGO ${empleadoData.CODIGO} există deja`,
        );
      }

      throw new BadRequestException(
        `Eroare la adăugarea empleado: ${error.message}`,
      );
    }
  }

  /**
   * Actualizează un empleado existent în baza de date
   */
  async updateEmpleado(
    codigo: string,
    empleadoData: {
      'NOMBRE / APELLIDOS'?: string;
      NOMBRE?: string;
      APELLIDO1?: string;
      APELLIDO2?: string;
      NOMBRE_SPLIT_CONFIANZA?: number;
      NACIONALIDAD?: string;
      DIRECCION?: string;
      'D.N.I. / NIE'?: string;
      'SEG. SOCIAL'?: string;
      'Nº Cuenta'?: string;
      TELEFONO?: string;
      'CORREO ELECTRONICO'?: string;
      'FECHA NACIMIENTO'?: string;
      'FECHA DE ALTA'?: string;
      'FECHA BAJA'?: string;
      'Fecha Antigüedad'?: string;
      Antigüedad?: string;
      'CENTRO TRABAJO'?: string;
      'TIPO DE CONTRATO'?: string;
      'SUELDO BRUTO MENSUAL'?: string;
      'HORAS DE CONTRATO'?: string;
      EMPRESA?: string;
      GRUPO?: string;
      ESTADO?: string;
      DerechoPedidos?: string;
      TrabajaFestivos?: string;
      Contraseña?: string;
      fecha_baja_programada?: string | null;
      VACACIONES_RESTANTES_ANO_ANTERIOR?: number | null;
      certificado_handicap_confirmado?: boolean | null;
    },
  ): Promise<{ success: true; codigo: string }> {
    if (!codigo) {
      throw new BadRequestException('CODIGO is required');
    }

    try {
      // Parola: dacă vine în payload, se hash-uiește cu bcrypt (niciodată plaintext).
      let passwordUpdate = '';
      if (
        empleadoData.Contraseña !== undefined &&
        String(empleadoData.Contraseña).trim() !== ''
      ) {
        const plainOrHash = String(empleadoData.Contraseña).trim();
        const passwordHash = isBcryptHash(plainOrHash)
          ? plainOrHash
          : await hashPassword(plainOrHash);
        passwordUpdate = `\`Contraseña\` = ${this.escapeSql(passwordHash)}, AUTH_VERSION = AUTH_VERSION + 1,`;
      }

      // Construim câmpurile pentru nume separate (doar dacă sunt furnizate explicit)
      // IMPORTANT: Salvăm și stringuri goale pentru a permite ștergerea câmpurilor
      const nombreFields: string[] = [];
      if (empleadoData.NOMBRE !== undefined) {
        const nombreValue =
          empleadoData.NOMBRE === '' || empleadoData.NOMBRE === null
            ? 'NULL'
            : this.escapeSql(empleadoData.NOMBRE);
        nombreFields.push(`\`NOMBRE\` = ${nombreValue}`);
        this.logger.log(
          `🔍 [updateEmpleado] NOMBRE va fi actualizat: ${empleadoData.NOMBRE}`,
        );
      }
      if (empleadoData.APELLIDO1 !== undefined) {
        const apellido1Value =
          empleadoData.APELLIDO1 === '' || empleadoData.APELLIDO1 === null
            ? 'NULL'
            : this.escapeSql(empleadoData.APELLIDO1);
        nombreFields.push(`\`APELLIDO1\` = ${apellido1Value}`);
        this.logger.log(
          `🔍 [updateEmpleado] APELLIDO1 va fi actualizat: ${empleadoData.APELLIDO1}`,
        );
      }
      if (empleadoData.APELLIDO2 !== undefined) {
        const apellido2Value =
          empleadoData.APELLIDO2 === '' || empleadoData.APELLIDO2 === null
            ? 'NULL'
            : this.escapeSql(empleadoData.APELLIDO2);
        nombreFields.push(`\`APELLIDO2\` = ${apellido2Value}`);
        this.logger.log(
          `🔍 [updateEmpleado] APELLIDO2 va fi actualizat: ${empleadoData.APELLIDO2}`,
        );
      }
      if (empleadoData.NOMBRE_SPLIT_CONFIANZA !== undefined) {
        nombreFields.push(
          `\`NOMBRE_SPLIT_CONFIANZA\` = ${empleadoData.NOMBRE_SPLIT_CONFIANZA ?? 0}`,
        );
        this.logger.log(
          `🔍 [updateEmpleado] NOMBRE_SPLIT_CONFIANZA va fi actualizat: ${empleadoData.NOMBRE_SPLIT_CONFIANZA}`,
        );
      }
      const nombreFieldsUpdate =
        nombreFields.length > 0 ? nombreFields.join(', ') + ',' : '';
      this.logger.log(
        `🔍 [updateEmpleado] nombreFieldsUpdate: ${nombreFieldsUpdate}`,
      );

      // Construiește câmpurile opționale noi
      const optionalFields: string[] = [];
      if (empleadoData.fecha_baja_programada !== undefined) {
        let fechaBajaProgramadaValue = null;
        if (
          empleadoData.fecha_baja_programada &&
          empleadoData.fecha_baja_programada.trim()
        ) {
          // Convertește formatul DD/MM/YYYY la YYYY-MM-DD pentru SQL
          const fechaStr = empleadoData.fecha_baja_programada.trim();
          if (fechaStr.includes('/')) {
            const [dd, mm, yyyy] = fechaStr.split('/');
            if (dd && mm && yyyy) {
              fechaBajaProgramadaValue = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
            }
          } else if (fechaStr.includes('-')) {
            // Verifică dacă este deja în format YYYY-MM-DD
            const parts = fechaStr.split('-');
            if (parts[0].length === 4) {
              fechaBajaProgramadaValue = fechaStr;
            } else {
              // Format DD-MM-YYYY
              const [dd, mm, yyyy] = parts;
              if (dd && mm && yyyy) {
                fechaBajaProgramadaValue = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
              }
            }
          }
        }
        optionalFields.push(
          `\`fecha_baja_programada\` = ${fechaBajaProgramadaValue ? this.escapeSql(fechaBajaProgramadaValue) : 'NULL'}`,
        );
      }
      if (empleadoData.VACACIONES_RESTANTES_ANO_ANTERIOR !== undefined) {
        const vacacionesValue = empleadoData.VACACIONES_RESTANTES_ANO_ANTERIOR;
        if (vacacionesValue === null || vacacionesValue === undefined) {
          optionalFields.push(`\`VACACIONES_RESTANTES_ANO_ANTERIOR\` = NULL`);
        } else {
          // Asigură-te că este un număr valid
          const numValue =
            typeof vacacionesValue === 'string'
              ? Number(vacacionesValue)
              : vacacionesValue;
          if (isNaN(numValue) || numValue === null || numValue === undefined) {
            optionalFields.push(`\`VACACIONES_RESTANTES_ANO_ANTERIOR\` = NULL`);
          } else {
            optionalFields.push(
              `\`VACACIONES_RESTANTES_ANO_ANTERIOR\` = ${numValue}`,
            );
          }
        }
      }
      if (empleadoData.certificado_handicap_confirmado !== undefined) {
        optionalFields.push(
          `\`certificado_handicap_confirmado\` = ${empleadoData.certificado_handicap_confirmado ? 1 : 0}`,
        );
      }

      // Construiește ultimul câmp (TrabajaFestivos) cu sau fără virgulă în funcție de câmpurile opționale
      const trabajafestivosField =
        optionalFields.length > 0
          ? `\`TrabajaFestivos\`       = ${this.escapeSql(empleadoData.TrabajaFestivos ?? '')},`
          : `\`TrabajaFestivos\`       = ${this.escapeSql(empleadoData.TrabajaFestivos ?? '')}`;

      const optionalFieldsUpdate =
        optionalFields.length > 0
          ? '\n          ' + optionalFields.join(',\n          ')
          : '';

      const updateQuery = `
        UPDATE DatosEmpleados SET
          \`NOMBRE / APELLIDOS\`    = ${this.escapeSql(empleadoData['NOMBRE / APELLIDOS'] ?? '')},
          ${nombreFieldsUpdate}
          \`NACIONALIDAD\`          = ${this.escapeSql(empleadoData.NACIONALIDAD ?? '')},
          \`DIRECCION\`             = ${this.escapeSql(empleadoData.DIRECCION ?? '')},
          \`D.N.I. / NIE\`          = ${this.escapeSql(empleadoData['D.N.I. / NIE'] ?? '')},
          \`SEG. SOCIAL\`           = ${this.escapeSql(empleadoData['SEG. SOCIAL'] ?? '')},
          \`Nº Cuenta\`             = ${this.escapeSql(empleadoData['Nº Cuenta'] ?? '')},
          \`TELEFONO\`              = ${this.escapeSql(empleadoData.TELEFONO ?? '')},
          \`CORREO ELECTRONICO\`    = ${this.escapeSql(empleadoData['CORREO ELECTRONICO'] ?? '')},
          \`FECHA NACIMIENTO\`      = ${this.escapeSql(empleadoData['FECHA NACIMIENTO'] ?? '')},
          \`FECHA DE ALTA\`         = ${this.escapeSql(empleadoData['FECHA DE ALTA'] ?? '')},
          \`CENTRO TRABAJO\`        = ${this.escapeSql(empleadoData['CENTRO TRABAJO'] ?? '')},
          \`TIPO DE CONTRATO\`      = ${this.escapeSql(empleadoData['TIPO DE CONTRATO'] ?? '')},
          \`SUELDO BRUTO MENSUAL\`  = ${this.escapeSql(empleadoData['SUELDO BRUTO MENSUAL'] ?? '')},
          \`HORAS DE CONTRATO\`     = ${this.escapeSql(empleadoData['HORAS DE CONTRATO'] ?? '')},
          \`EMPRESA\`               = ${this.escapeSql(empleadoData.EMPRESA ?? '')},
          \`GRUPO\`                 = ${this.escapeSql(empleadoData.GRUPO ?? '')},
          \`ESTADO\`                = ${this.escapeSql(empleadoData.ESTADO ?? '')},
          \`FECHA BAJA\`            = ${this.escapeSql(sanitizeFechaEmpleado(empleadoData['FECHA BAJA']))},
          \`Fecha Antigüedad\`      = ${this.escapeSql(sanitizeFechaEmpleado(empleadoData['Fecha Antigüedad']))},
          \`Antigüedad\`            = ${this.escapeSql(empleadoData.Antigüedad ?? null)},
          ${passwordUpdate}
          \`DerechoPedidos\`        = ${this.escapeSql(empleadoData.DerechoPedidos ?? '')},
          ${trabajafestivosField}${optionalFieldsUpdate}
        WHERE
          \`CODIGO\` = ${this.escapeSql(codigo)}
      `;

      this.logger.log(
        `🔍 [updateEmpleado] Generated SQL query (first 500 chars): ${updateQuery.substring(0, 500)}`,
      );
      this.logger.log(`🔍 [updateEmpleado] Full SQL query:\n${updateQuery}`);
      this.logger.log(
        `🔍 [updateEmpleado] trabajafestivosField: "${trabajafestivosField}"`,
      );
      this.logger.log(
        `🔍 [updateEmpleado] optionalFieldsUpdate: "${optionalFieldsUpdate}"`,
      );
      if (optionalFields.length > 0) {
        this.logger.log(
          `🔍 [updateEmpleado] Optional fields: ${optionalFields.join(', ')}`,
        );
      }

      await this.prisma.$executeRawUnsafe(updateQuery);

      this.logger.log(`✅ Empleado actualizat cu succes: ${codigo}`);

      return {
        success: true,
        codigo: codigo,
      };
    } catch (error: any) {
      this.logger.error(`❌ Eroare la actualizarea empleado ${codigo}:`, error);
      throw new BadRequestException(
        `Eroare la actualizarea empleado: ${error.message}`,
      );
    }
  }

  /**
   * Actualizează câmpurile separate pentru nume (NOMBRE, APELLIDO1, APELLIDO2, NOMBRE_SPLIT_CONFIANZA)
   * Folosit pentru corectare manuală a split-urilor
   * Actualizează automat și coloana originală NOMBRE / APELLIDOS cu numele complet formatat
   */
  async updateNombreSplit(
    codigo: string,
    data: {
      NOMBRE?: string;
      APELLIDO1?: string;
      APELLIDO2?: string;
      NOMBRE_SPLIT_CONFIANZA?: number;
    },
  ): Promise<{ success: true; codigo: string }> {
    if (!codigo) {
      throw new BadRequestException('CODIGO is required');
    }

    try {
      const updates: string[] = [];

      // Dacă avem cel puțin un câmp actualizat, construim numele complet
      let nombreCompleto = null;
      if (
        data.NOMBRE !== undefined ||
        data.APELLIDO1 !== undefined ||
        data.APELLIDO2 !== undefined
      ) {
        // Citim valorile actuale din DB pentru a combina cu noile valori
        const empleadoActual = await this.getEmpleadoByCodigo(codigo);

        // Folosim valorile noi dacă sunt furnizate, altfel valorile existente
        const nombreFinal =
          data.NOMBRE !== undefined
            ? (data.NOMBRE || '').trim()
            : (empleadoActual?.NOMBRE || '').trim();
        const apellido1Final =
          data.APELLIDO1 !== undefined
            ? (data.APELLIDO1 || '').trim()
            : (empleadoActual?.APELLIDO1 || '').trim();
        const apellido2Final =
          data.APELLIDO2 !== undefined
            ? (data.APELLIDO2 || '').trim()
            : (empleadoActual?.APELLIDO2 || '').trim();

        // Construim numele complet: NOMBRE APELLIDO1 APELLIDO2 (fără valorile goale)
        const partsFinal = [nombreFinal, apellido1Final, apellido2Final].filter(
          (part) => part && part !== '',
        );
        nombreCompleto = partsFinal.length > 0 ? partsFinal.join(' ') : null;
      }

      if (data.NOMBRE !== undefined) {
        updates.push(`\`NOMBRE\` = ${this.escapeSql(data.NOMBRE || null)}`);
      }
      if (data.APELLIDO1 !== undefined) {
        updates.push(
          `\`APELLIDO1\` = ${this.escapeSql(data.APELLIDO1 || null)}`,
        );
      }
      if (data.APELLIDO2 !== undefined) {
        updates.push(
          `\`APELLIDO2\` = ${this.escapeSql(data.APELLIDO2 || null)}`,
        );
      }
      if (data.NOMBRE_SPLIT_CONFIANZA !== undefined) {
        updates.push(
          `\`NOMBRE_SPLIT_CONFIANZA\` = ${data.NOMBRE_SPLIT_CONFIANZA}`,
        );
      }

      // Actualizăm și coloana originală NOMBRE / APELLIDOS cu numele complet formatat
      // în ordinea corectă: NOMBRE APELLIDO1 APELLIDO2
      if (nombreCompleto !== null) {
        updates.push(
          `\`NOMBRE / APELLIDOS\` = ${this.escapeSql(nombreCompleto)}`,
        );
      }

      if (updates.length === 0) {
        throw new BadRequestException('No fields to update');
      }

      const updateQuery = `
        UPDATE DatosEmpleados SET
          ${updates.join(',\n          ')}
        WHERE \`CODIGO\` = ${this.escapeSql(codigo)}
      `;

      await this.prisma.$executeRawUnsafe(updateQuery);

      this.logger.log(
        `✅ Câmpuri separate actualizate pentru empleado ${codigo}, nombre completo: ${nombreCompleto || '(sin cambios)'}`,
      );

      return {
        success: true,
        codigo: codigo,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Eroare la actualizarea câmpurilor separate pentru ${codigo}:`,
        error,
      );
      throw new BadRequestException(
        `Eroare la actualizarea câmpurilor separate: ${error.message}`,
      );
    }
  }

  /**
   * Salvează PDF-ul în tabela CarpetasDocumentos
   */
  async savePDFToCarpetasDocumentos(
    codigo: string,
    nombreEmpleado: string,
    correoElectronico: string,
    pdfBuffer: Buffer,
    nombreArchivo: string,
    tipoDocumento: string = 'ficha_empleado',
  ): Promise<{ success: true }> {
    try {
      const fechaCreacion = new Date().toISOString().split('T')[0];

      this.logger.log(
        `💾 Salvăm PDF în CarpetasDocumentos: codigo=${codigo}, email=${correoElectronico || '(gol)'}, nombre=${nombreEmpleado || '(gol)'}`,
      );

      const emailValue =
        correoElectronico && correoElectronico.trim() !== ''
          ? correoElectronico.trim()
          : null;

      if (!this.carpetasStorage.isWriteEnabled()) {
        throw new BadRequestException(
          'R2 no está habilitado; no se pueden guardar documentos de carpetas',
        );
      }

      const put = await this.carpetasStorage.putDocumento(
        pdfBuffer,
        codigo,
        nombreArchivo,
        'application/pdf',
      );

      const insertQuery = `
        INSERT INTO CarpetasDocumentos (
          \`id\`,
          \`correo_electronico\`,
          \`tipo_documento\`,
          \`nombre_archivo\`,
          \`nombre_empleado\`,
          \`fecha_creacion\`,
          \`storage_key\`,
          \`storage_bucket\`,
          \`tamano_bytes\`
        ) VALUES (
          ${this.escapeSql(codigo)},
          ${this.escapeSql(emailValue)},
          ${this.escapeSql(tipoDocumento)},
          ${this.escapeSql(nombreArchivo)},
          ${this.escapeSql(nombreEmpleado || '')},
          ${this.escapeSql(fechaCreacion)},
          ${this.escapeSql(put.storage_key)},
          ${this.escapeSql(put.storage_bucket)},
          ${put.tamano_bytes}
        )
      `;

      await this.prisma.$executeRawUnsafe(insertQuery);

      this.logger.log(
        `✅ PDF salvat în CarpetasDocumentos (R2) pentru empleado ${codigo}, email: ${correoElectronico || '(nu s-a salvat email-ul)'}`,
      );

      return { success: true };
    } catch (error: any) {
      this.logger.error(
        `❌ Eroare la salvarea PDF-ului pentru empleado ${codigo}:`,
        error,
      );
      throw new BadRequestException(
        `Eroare la salvarea PDF-ului: ${error.message}`,
      );
    }
  }

  /**
   * Formatează modificările pentru cererea de aprobare
   * Similar cu logica din n8n Code node
   */
  private formatModificari(
    camposModificados: string[],
    valoresAnteriores: string[],
    valoresNuevos: string[],
  ): string {
    const resultado: string[] = [];

    for (let i = 0; i < camposModificados.length; i++) {
      const campo = camposModificados[i]?.trim() || '';
      if (!campo) continue; // Sare peste câmpuri goale

      const valorViejo = valoresAnteriores[i]?.trim() || '(gol)';
      const valorNuevo = valoresNuevos[i]?.trim() || '(gol)';

      // Include toate câmpurile, chiar dacă valorile sunt identice
      // (utilizatorul poate dori să salveze modificări chiar dacă valorile par identice)
      resultado.push(`${campo}: "${valorViejo}" → "${valorNuevo}"`);
    }

    return resultado.join('\n');
  }

  /**
   * Creează o cerere de aprobare pentru modificările datelor personale
   */
  async createCambioAprobacion(data: {
    ID: string;
    CODIGO: string;
    CORREO_ELECTRONICO: string;
    NOMBRE: string;
    CAMPO_MODIFICADO: string;
    VALOR_ANTERIOR: string;
    VALOR_NUEVO: string;
    MOTIVO_CAMBIO: string;
    FECHA_SOLICITUD: string;
    FECHA_APROBACION: string;
    ESTADO: string;
    // Campos separados (opcionales)
    NOMBRE_SEPARADO?: string;
    APELLIDO1?: string;
    APELLIDO2?: string;
    NOMBRE_SPLIT_CONFIANZA?: number;
  }): Promise<{ success: true; id: string }> {
    try {
      // Log pentru debugging
      this.logger.debug(
        `🔍 [createCambioAprobacion] Date primite: CAMPO_MODIFICADO="${data.CAMPO_MODIFICADO}", VALOR_ANTERIOR="${data.VALOR_ANTERIOR}", VALOR_NUEVO="${data.VALOR_NUEVO}"`,
      );
      this.logger.debug(
        `🔍 [createCambioAprobacion] Câmpuri separate: NOMBRE_SEPARADO="${data.NOMBRE_SEPARADO}", APELLIDO1="${data.APELLIDO1}", APELLIDO2="${data.APELLIDO2}"`,
      );

      // Formatează modificările (similar cu n8n Code node)
      // Verifică dacă CAMPO_MODIFICADO există și nu este gol
      let camposModificados: string[] = [];
      let valoresAnteriores: string[] = [];
      let valoresNuevos: string[] = [];

      if (data.CAMPO_MODIFICADO && data.CAMPO_MODIFICADO.trim()) {
        camposModificados = data.CAMPO_MODIFICADO.split(',')
          .map((c) => c.trim())
          .filter((c) => c);
      }

      if (data.VALOR_ANTERIOR && data.VALOR_ANTERIOR.trim()) {
        valoresAnteriores = data.VALOR_ANTERIOR.split(',').map((v) => v.trim());
        // Nu filtram valorile goale, pentru a păstra sincronizarea cu camposModificados
      }

      if (data.VALOR_NUEVO && data.VALOR_NUEVO.trim()) {
        valoresNuevos = data.VALOR_NUEVO.split(',').map((v) => v.trim());
        // Nu filtram valorile goale, pentru a păstra sincronizarea cu camposModificados
      }

      // Dacă nu avem câmpuri modificate din CAMPO_MODIFICADO, dar avem câmpuri separate,
      // construim lista de câmpuri din câmpurile separate
      if (
        camposModificados.length === 0 &&
        (data.NOMBRE_SEPARADO || data.APELLIDO1 || data.APELLIDO2)
      ) {
        this.logger.debug(
          `🔍 [createCambioAprobacion] CAMPO_MODIFICADO este gol, construim din câmpuri separate`,
        );

        // Verifică dacă NOMBRE / APELLIDOS este modificat (prin câmpurile separate)
        if (data.NOMBRE_SEPARADO || data.APELLIDO1 || data.APELLIDO2) {
          camposModificados.push('NOMBRE / APELLIDOS');
          // Folosim VALOR_ANTERIOR dacă există, altfel "(gol)"
          valoresAnteriores.push(data.VALOR_ANTERIOR?.trim() || '(gol)');
          // Construim valoarea nouă din câmpurile separate
          const nombreCompleto = [
            data.NOMBRE_SEPARADO,
            data.APELLIDO1,
            data.APELLIDO2,
          ]
            .filter((v) => v && v.trim())
            .join(' ');
          valoresNuevos.push(nombreCompleto || '(gol)');
        }
      }

      // Adaugă câmpurile separate DOAR dacă NOMBRE / APELLIDOS este efectiv în lista de câmpuri modificate
      // Verifică dacă NOMBRE / APELLIDOS este în lista de câmpuri modificate
      const nombreIndex = camposModificados.findIndex(
        (c) => c === 'NOMBRE / APELLIDOS' || c === 'NOMBRE_APELLIDOS',
      );

      // Dacă NOMBRE / APELLIDOS este modificat (din CAMPO_MODIFICADO sau din câmpuri separate),
      // adaugă și câmpurile separate pentru tracking
      if (nombreIndex >= 0) {
        if (data.NOMBRE_SEPARADO) {
          camposModificados.push('NOMBRE');
          valoresNuevos.push(data.NOMBRE_SEPARADO);
          valoresAnteriores.push('(gol)'); // Va fi populat la aprobare dacă e necesar
        }
        if (data.APELLIDO1) {
          camposModificados.push('APELLIDO1');
          valoresNuevos.push(data.APELLIDO1);
          valoresAnteriores.push('(gol)');
        }
        if (data.APELLIDO2) {
          camposModificados.push('APELLIDO2');
          valoresNuevos.push(data.APELLIDO2);
          valoresAnteriores.push('(gol)');
        }
        if (data.NOMBRE_SPLIT_CONFIANZA !== undefined) {
          camposModificados.push('NOMBRE_SPLIT_CONFIANZA');
          valoresNuevos.push(data.NOMBRE_SPLIT_CONFIANZA.toString());
          valoresAnteriores.push('(gol)');
        }
      }

      // Sincronizează arrays-urile pentru a avea același număr de elemente
      // Folosim lungimea lui camposModificados ca referință (numărul de câmpuri modificate)
      const camposLength = camposModificados.length;

      // Completează arrays-urile de valori până la lungimea câmpurilor
      while (valoresAnteriores.length < camposLength) {
        valoresAnteriores.push('');
      }
      while (valoresNuevos.length < camposLength) {
        valoresNuevos.push('');
      }

      // Tăiem arrays-urile de valori dacă sunt mai lungi decât câmpurile
      // (ignorăm valorile extra care nu au câmpuri corespunzătoare)
      if (valoresAnteriores.length > camposLength) {
        valoresAnteriores = valoresAnteriores.slice(0, camposLength);
      }
      if (valoresNuevos.length > camposLength) {
        valoresNuevos = valoresNuevos.slice(0, camposLength);
      }

      let campoFormatat = this.formatModificari(
        camposModificados,
        valoresAnteriores,
        valoresNuevos,
      );

      this.logger.debug(
        `🔍 [createCambioAprobacion] Rezultat: camposModificados.length=${camposModificados.length}, campoFormatat.length=${campoFormatat ? campoFormatat.length : 0}`,
      );
      if (campoFormatat) {
        this.logger.debug(
          `🔍 [createCambioAprobacion] campoFormatat="${campoFormatat.substring(0, 200)}${campoFormatat.length > 200 ? '...' : ''}"`,
        );
      }

      // Verifică dacă campoFormatat este gol - dacă da, folosește un fallback
      if (!campoFormatat || !campoFormatat.trim()) {
        this.logger.warn(
          `⚠️ [createCambioAprobacion] campoFormatat este gol! Folosim fallback.`,
        );
        // Fallback: construiește din datele disponibile
        if (data.CAMPO_MODIFICADO && data.CAMPO_MODIFICADO.trim()) {
          campoFormatat = `${data.CAMPO_MODIFICADO}: "${data.VALOR_ANTERIOR || '(gol)'}" → "${data.VALOR_NUEVO || '(gol)'}"`;
        } else if (data.NOMBRE_SEPARADO || data.APELLIDO1 || data.APELLIDO2) {
          const nombreCompleto = [
            data.NOMBRE_SEPARADO,
            data.APELLIDO1,
            data.APELLIDO2,
          ]
            .filter((v) => v && v.trim())
            .join(' ');
          campoFormatat = `NOMBRE / APELLIDOS: "${data.VALOR_ANTERIOR || '(gol)'}" → "${nombreCompleto || '(gol)'}"`;
        }
      }

      // Salvează în baza de date
      await this.prisma.solicitudesCambiosPersonales.create({
        data: {
          id: data.ID,
          codigo: data.CODIGO,
          NOMBRE: data.NOMBRE,
          campo: campoFormatat,
          valoare_veche: data.VALOR_ANTERIOR,
          valoare_noua: data.VALOR_NUEVO,
          motiv: data.MOTIVO_CAMBIO,
          status: data.ESTADO || 'in asteptare',
          data_creare: data.FECHA_SOLICITUD,
          data_aprobare: data.FECHA_APROBACION,
          CORREO_ELECTRONICO: data.CORREO_ELECTRONICO,
          // Salvează câmpurile separate direct în coloane
          NOMBRE_SEPARADO: data.NOMBRE_SEPARADO || null,
          APELLIDO1: data.APELLIDO1 || null,
          APELLIDO2: data.APELLIDO2 || null,
          NOMBRE_SPLIT_CONFIANZA: data.NOMBRE_SPLIT_CONFIANZA || null,
        },
      });

      this.logger.log(
        `✅ Cerere de aprobare creată cu succes: ${data.ID} pentru empleado ${data.CODIGO}`,
      );

      return { success: true, id: data.ID };
    } catch (error: any) {
      this.logger.error(`❌ Eroare la crearea cererii de aprobare:`, error);
      throw new BadRequestException(
        `Eroare la crearea cererii de aprobare: ${error.message}`,
      );
    }
  }

  /**
   * Aprobă o cerere de modificare a datelor personale
   * - Actualizează statusul în SolicitudesCambiosPersonales
   * - Actualizează câmpul în DatosEmpleados
   */
  async approveCambio(data: {
    id: string;
    codigo: string;
    campo: string;
    valor: string;
  }): Promise<{ success: true; message: string }> {
    try {
      // Găsește cambio-ul în baza de date
      const cambio = await this.prisma.solicitudesCambiosPersonales.findUnique({
        where: { id: data.id },
      });

      if (!cambio) {
        throw new NotFoundException(
          `Cererea de aprobare cu ID ${data.id} nu a fost găsită`,
        );
      }

      // Actualizează statusul și data_aprobare
      await this.prisma.solicitudesCambiosPersonales.update({
        where: { id: data.id },
        data: {
          status: 'aprobat',
          data_aprobare: new Date().toISOString(),
        },
      });

      // Parsează câmpurile și valorile din cambio
      // cambio.campo conține formatul: "campo: \"valoare_veche\" → \"valoare_noua\"\n..."
      // cambio.valoare_noua conține valorile concatenate cu virgulă: "val1, val2, val3"

      const camposModificados: string[] = [];
      const valoresNuevos: string[] = [];

      // Log pentru debugging - vezi exact ce format are cambio.campo
      this.logger.debug(
        `🔍 [approveCambio] cambio.campo: ${JSON.stringify(cambio.campo)}`,
      );
      this.logger.debug(
        `🔍 [approveCambio] cambio.valoare_noua: ${JSON.stringify(cambio.valoare_noua)}`,
      );
      this.logger.debug(
        `🔍 [approveCambio] cambio.valoare_veche: ${JSON.stringify(cambio.valoare_veche)}`,
      );

      // Parsează cambio.campo pentru a obține lista de câmpuri
      if (cambio.campo) {
        const lineas = cambio.campo.split('\n').filter((l) => l.trim());
        this.logger.debug(
          `🔍 [approveCambio] Liniile parseate din cambio.campo: ${lineas.length}`,
        );

        for (const linea of lineas) {
          // Format: "campo: \"valoare_veche\" → \"valoare_noua\""
          // Regex mai robust care gestionează și caractere speciale în valori
          // Încearcă mai multe formate
          let match = linea.match(/^([^:]+):\s*"[^"]*"\s*→\s*"([^"]*)"/);

          if (!match) {
            // Încearcă fără ghilimele în valoare nouă
            match = linea.match(/^([^:]+):\s*"[^"]*"\s*→\s*(.+)$/);
            if (match) {
              const campo = match[1].trim();
              let valorNuevo = match[2].trim();
              // Elimină ghilimele dacă există
              valorNuevo = valorNuevo.replace(/^["']|["']$/g, '');
              camposModificados.push(campo);
              valoresNuevos.push(valorNuevo);
              this.logger.debug(
                `✅ [approveCambio] Parsat (fără ghilimele): ${campo} → ${valorNuevo}`,
              );
              continue;
            }
          }

          if (!match) {
            // Încearcă format simplu: "campo: valoare_veche → valoare_noua"
            match = linea.match(/^([^:]+):\s*(.+?)\s*→\s*(.+)$/);
            if (match) {
              const campo = match[1].trim();
              let valorNuevo = match[3].trim();
              // Elimină ghilimele dacă există
              valorNuevo = valorNuevo.replace(/^["']|["']$/g, '');
              camposModificados.push(campo);
              valoresNuevos.push(valorNuevo);
              this.logger.debug(
                `✅ [approveCambio] Parsat (format simplu): ${campo} → ${valorNuevo}`,
              );
              continue;
            }
          }

          if (match) {
            const campo = match[1].trim();
            let valorNuevo = match[2]?.trim() || '';
            // Elimină ghilimele dacă există
            valorNuevo = valorNuevo.replace(/^["']|["']$/g, '');
            camposModificados.push(campo);
            valoresNuevos.push(valorNuevo);
            this.logger.debug(
              `✅ [approveCambio] Parsat: ${campo} → ${valorNuevo}`,
            );
          } else {
            // Log pentru debugging dacă nu se poate parsea o linie
            this.logger.warn(
              `⚠️ Nu s-a putut parsea linia din cambio.campo: ${linea}`,
            );
          }
        }
      }

      // Dacă nu am putut parsea din cambio.campo, încercăm să parsez din valoare_noua și valoare_veche
      if (camposModificados.length === 0 && cambio.valoare_noua) {
        this.logger.warn(
          `⚠️ [approveCambio] Nu s-au putut parsea câmpurile din cambio.campo. Încerc fallback...`,
        );

        // Încearcă să parseze din data.campo dacă este furnizat
        if (data.campo && data.campo.trim()) {
          // Dacă data.campo conține virgule, parsează ca listă de câmpuri
          if (data.campo.includes(',')) {
            const camposList = data.campo
              .split(',')
              .map((c) => c.trim())
              .filter((c) => c);
            const valoresList = cambio.valoare_noua
              .split(',')
              .map((v) => v.trim())
              .filter((v) => v);

            // Asigură-te că avem același număr de câmpuri și valori
            const minLength = Math.min(camposList.length, valoresList.length);
            for (let i = 0; i < minLength; i++) {
              if (camposList[i] && valoresList[i] !== undefined) {
                camposModificados.push(camposList[i]);
                valoresNuevos.push(valoresList[i]);
              }
            }

            this.logger.debug(
              `✅ [approveCambio] Parsat din data.campo (multiple): ${camposModificados.length} câmpuri`,
            );
          } else {
            // Un singur câmp - folosește toată valoarea
            camposModificados.push(data.campo.trim());
            valoresNuevos.push(cambio.valoare_noua);
            this.logger.debug(
              `✅ [approveCambio] Parsat din data.campo (singur): ${data.campo}`,
            );
          }
        } else if (!cambio.campo || cambio.campo.trim() === '') {
          // Dacă cambio.campo este gol, încercă să parsez din valoare_veche și valoare_noua
          // dar trebuie să știm lista de câmpuri - nu putem face asta fără informații suplimentare
          this.logger.error(
            `❌ [approveCambio] cambio.campo este gol sau NULL. cambio.valoare_noua: "${cambio.valoare_noua}", cambio.valoare_veche: "${cambio.valoare_veche}"`,
          );
          throw new BadRequestException(
            `Nu s-au putut parsea câmpurile modificate. cambio.campo este gol sau NULL. Verifică dacă cambio-ul a fost salvat corect.`,
          );
        } else {
          // Dacă avem cambio.campo dar nu s-a putut parsea, aruncă eroare descriptivă
          this.logger.error(
            `❌ [approveCambio] Nu s-au putut parsea câmpurile. cambio.campo: "${cambio.campo?.substring(0, 200)}...", cambio.valoare_noua: "${cambio.valoare_noua}"`,
          );
          throw new BadRequestException(
            `Nu s-au putut parsea câmpurile modificate. Formatul cambio.campo nu este recunoscut. Verifică formatul: "${cambio.campo?.substring(0, 100)}..."`,
          );
        }
      }

      // Construim lista de câmpuri de actualizat
      const setClauses: string[] = [];

      // Procesăm fiecare câmp modificat
      for (let i = 0; i < camposModificados.length; i++) {
        const campo = camposModificados[i];
        const valorNuevo = valoresNuevos[i] || '';

        const campoName = this.getCampoName(campo);
        if (!campoName) {
          this.logger.warn(
            `⚠️ Câmpul "${campo}" nu este valid pentru actualizare, se va omite`,
          );
          continue;
        }

        setClauses.push(`\`${campoName}\` = ${this.escapeSql(valorNuevo)}`);
      }

      // Dacă se modifică "NOMBRE / APELLIDOS", verificăm și câmpurile separate
      const nombreIndex = camposModificados.findIndex(
        (c) => c === 'NOMBRE / APELLIDOS' || c === 'NOMBRE_APELLIDOS',
      );

      if (nombreIndex >= 0) {
        // Verificăm dacă există câmpurile separate în cambio
        const cambioDetails =
          await this.prisma.solicitudesCambiosPersonales.findUnique({
            where: { id: data.id },
            select: {
              NOMBRE_SEPARADO: true,
              APELLIDO1: true,
              APELLIDO2: true,
              NOMBRE_SPLIT_CONFIANZA: true,
            },
          });

        // Adăugăm câmpurile separate dacă există
        if (
          cambioDetails?.NOMBRE_SEPARADO !== undefined &&
          cambioDetails.NOMBRE_SEPARADO !== null
        ) {
          setClauses.push(
            `\`NOMBRE\` = ${this.escapeSql(cambioDetails.NOMBRE_SEPARADO)}`,
          );
        }
        if (
          cambioDetails?.APELLIDO1 !== undefined &&
          cambioDetails.APELLIDO1 !== null
        ) {
          setClauses.push(
            `\`APELLIDO1\` = ${this.escapeSql(cambioDetails.APELLIDO1)}`,
          );
        }
        if (
          cambioDetails?.APELLIDO2 !== undefined &&
          cambioDetails.APELLIDO2 !== null
        ) {
          setClauses.push(
            `\`APELLIDO2\` = ${this.escapeSql(cambioDetails.APELLIDO2)}`,
          );
        }
        if (
          cambioDetails?.NOMBRE_SPLIT_CONFIANZA !== undefined &&
          cambioDetails.NOMBRE_SPLIT_CONFIANZA !== null
        ) {
          setClauses.push(
            `\`NOMBRE_SPLIT_CONFIANZA\` = ${cambioDetails.NOMBRE_SPLIT_CONFIANZA}`,
          );
        }
      }

      if (setClauses.length === 0) {
        throw new BadRequestException(
          'Nu s-au găsit câmpuri valide pentru actualizare',
        );
      }

      // Construim query-ul UPDATE cu toate câmpurile
      const setClause = setClauses.join(', ');

      const updateQuery = `
        UPDATE DatosEmpleados
        SET ${setClause}
        WHERE CODIGO = ${this.escapeSql(data.codigo)}
      `;

      await this.prisma.$executeRawUnsafe(updateQuery);

      this.logger.log(
        `✅ Cambio aprobat cu succes: ${data.id} pentru empleado ${data.codigo}, câmpuri: ${camposModificados.join(', ')}`,
      );

      return {
        success: true,
        message: 'Cambio aprobado y actualizado correctamente',
      };
    } catch (error: any) {
      this.logger.error(`❌ Eroare la aprobarea cambio-ului:`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Eroare la aprobarea cambio-ului: ${error.message}`,
      );
    }
  }

  /**
   * Convertește numele câmpului din formatul frontend în numele coloanei din DB
   */
  private getCampoName(campo: string): string | null {
    const campoMap: { [key: string]: string } = {
      'NOMBRE / APELLIDOS': 'NOMBRE / APELLIDOS',
      NOMBRE_APELLIDOS: 'NOMBRE / APELLIDOS',
      NOMBRE: 'NOMBRE',
      APELLIDO1: 'APELLIDO1',
      APELLIDO2: 'APELLIDO2',
      NOMBRE_SPLIT_CONFIANZA: 'NOMBRE_SPLIT_CONFIANZA',
      NACIONALIDAD: 'NACIONALIDAD',
      DIRECCION: 'DIRECCION',
      'D.N.I. / NIE': 'D.N.I. / NIE',
      DNI_NIE: 'D.N.I. / NIE',
      'SEG. SOCIAL': 'SEG. SOCIAL',
      SEG_SOCIAL: 'SEG. SOCIAL',
      'Nº Cuenta': 'Nº Cuenta',
      NUMERO_CUENTA: 'Nº Cuenta',
      IBAN: 'Nº Cuenta', // IBAN este stocat în Nº Cuenta
      TELEFONO: 'TELEFONO',
      'CORREO ELECTRONICO': 'CORREO ELECTRONICO',
      CORREO_ELECTRONICO: 'CORREO ELECTRONICO',
      'FECHA NACIMIENTO': 'FECHA NACIMIENTO',
      'FECHA DE ALTA': 'FECHA DE ALTA',
      'CENTRO TRABAJO': 'CENTRO TRABAJO',
      CENTRO_TRABAJO: 'CENTRO TRABAJO',
      'TIPO DE CONTRATO': 'TIPO DE CONTRATO',
      TIPO_DE_CONTRATO: 'TIPO DE CONTRATO',
      'SUELDO BRUTO MENSUAL': 'SUELDO BRUTO MENSUAL',
      SUELDO_BRUTO_MENSUAL: 'SUELDO BRUTO MENSUAL',
      'HORAS DE CONTRATO': 'HORAS DE CONTRATO',
      HORAS_DE_CONTRATO: 'HORAS DE CONTRATO',
      EMPRESA: 'EMPRESA',
      GRUPO: 'GRUPO',
      ESTADO: 'ESTADO',
      'FECHA BAJA': 'FECHA BAJA',
      FECHA_BAJA: 'FECHA BAJA',
      'Fecha Antigüedad': 'Fecha Antigüedad',
      FECHA_ANTIGUEDAD: 'Fecha Antigüedad',
      Antigüedad: 'Antigüedad',
      ANTIGUEDAD: 'Antigüedad',
      DerechoPedidos: 'DerechoPedidos',
      TRABAJA_FESTIVOS: 'TrabajaFestivos',
      TrabajaFestivos: 'TrabajaFestivos',
    };

    return campoMap[campo] || null;
  }

  /**
   * Respinge o cerere de modificare a datelor personale
   * - Șterge record-ul din SolicitudesCambiosPersonales
   * - (Email-ul se trimite din controller)
   */
  /**
   * Obține lista de cambios pendientes (în așteptare de aprobare)
   * Returnează doar cambios cu status "in asteptare" sau "pendiente"
   */
  async getCambiosPendientes(): Promise<any[]> {
    try {
      const cambios = await this.prisma.solicitudesCambiosPersonales.findMany({
        where: {
          OR: [
            { status: 'in asteptare' },
            { status: 'pendiente' },
            { status: null }, // Include și cambios fără status (default)
          ],
        },
        orderBy: {
          data_creare: 'desc',
        },
      });

      // Mapăm datele pentru compatibilitate cu frontend
      const mappedCambios = cambios.map((cambio) => ({
        id: cambio.id,
        ID: cambio.id,
        codigo: cambio.codigo,
        CODIGO: cambio.codigo,
        nombre: cambio.NOMBRE,
        NOMBRE: cambio.NOMBRE,
        email: cambio.CORREO_ELECTRONICO,
        CORREO_ELECTRONICO: cambio.CORREO_ELECTRONICO,
        campo: cambio.campo,
        CAMPO_MODIFICADO: cambio.campo,
        valor_anterior: cambio.valoare_veche,
        VALOR_ANTERIOR: cambio.valoare_veche,
        valor_nuevo: cambio.valoare_noua,
        VALOR_NUEVO: cambio.valoare_noua,
        valoare_noua: cambio.valoare_noua,
        razon: cambio.motiv,
        RAZON: cambio.motiv,
        MOTIVO_CAMBIO: cambio.motiv,
        estado: cambio.status,
        ESTADO: cambio.status,
        fecha_solicitud: cambio.data_creare,
        FECHA_SOLICITUD: cambio.data_creare,
        data_creare: cambio.data_creare,
      }));

      this.logger.log(`✅ Obținut ${mappedCambios.length} cambios pendientes`);

      return mappedCambios;
    } catch (error: any) {
      this.logger.error(`❌ Eroare la obținerea cambios pendientes:`, error);
      throw new BadRequestException(
        `Eroare la obținerea cambios pendientes: ${error.message}`,
      );
    }
  }

  /**
   * Obține un cambio după ID (helper method)
   */
  async getCambioById(id: string): Promise<any> {
    try {
      const cambio = await this.prisma.solicitudesCambiosPersonales.findUnique({
        where: { id },
      });
      return cambio;
    } catch (error: any) {
      this.logger.error(`❌ Eroare la obținerea cambio-ului: ${error.message}`);
      throw new BadRequestException(
        `Eroare la obținerea cambio-ului: ${error.message}`,
      );
    }
  }

  async rejectCambio(data: {
    id: string;
  }): Promise<{ success: true; message: string }> {
    try {
      // Verifică dacă cambio-ul există
      const cambio = await this.prisma.solicitudesCambiosPersonales.findUnique({
        where: { id: data.id },
      });

      if (!cambio) {
        throw new NotFoundException(
          `Cererea de aprobare cu ID ${data.id} nu a fost găsită`,
        );
      }

      // Șterge record-ul din baza de date
      await this.prisma.solicitudesCambiosPersonales.delete({
        where: { id: data.id },
      });

      this.logger.log(
        `✅ Cambio respins și șters: ${data.id} pentru empleado ${cambio.codigo}`,
      );

      return {
        success: true,
        message: 'Cambio rechazado correctamente',
      };
    } catch (error: any) {
      this.logger.error(`❌ Eroare la respingerea cambio-ului:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Eroare la respingerea cambio-ului: ${error.message}`,
      );
    }
  }

  /**
   * Schimbă parola unui angajat după verificarea vechii parole (bcrypt / legacy).
   * DNI/NIE nu este acceptat ca parolă.
   */
  async changePassword(
    codigo: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ success: true; message: string }> {
    if (!codigo) {
      throw new BadRequestException('CODIGO is required');
    }

    if (!oldPassword || !oldPassword.trim()) {
      throw new BadRequestException('La contraseña actual es obligatoria');
    }

    const complexity = validatePasswordComplexity(newPassword);
    if (complexity.ok === false) {
      throw new BadRequestException(complexity.error);
    }

    try {
      const empleado = await this.getEmpleadoByCodigo(codigo);
      if (!empleado) {
        throw new BadRequestException('Empleado no encontrado');
      }

      const pwdRows = await this.prisma.$queryRawUnsafe<
        Array<{ Contraseña?: string }>
      >(
        `SELECT \`Contraseña\` FROM DatosEmpleados WHERE CODIGO = ? LIMIT 1`,
        codigo,
      );
      const contraseñaPassword = String(pwdRows?.[0]?.Contraseña || '').trim();
      const inputOldPassword = oldPassword.trim();

      const check = await verifyPassword(inputOldPassword, contraseñaPassword);
      if (!check.ok) {
        this.logger.warn(
          `⚠️ [changePassword] Contraseña actual incorrecta para codigo: ${codigo}`,
        );
        throw new BadRequestException('La contraseña actual es incorrecta');
      }

      if (complexity.password === inputOldPassword) {
        throw new BadRequestException(
          'La nueva contraseña debe ser diferente a la contraseña actual',
        );
      }

      const newHash = await hashPassword(complexity.password);
      await this.setPasswordHash(codigo, newHash);

      this.logger.log(
        `✅ Contraseña cambiada exitosamente para empleado: ${codigo}`,
      );

      return {
        success: true,
        message: 'Contraseña cambiada exitosamente',
      };
    } catch (error: any) {
      this.logger.error(`❌ Error al cambiar contraseña:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al cambiar contraseña: ${error.message}`,
      );
    }
  }

  /**
   * @deprecated Passwords are never readable. Kept to fail closed if called.
   */
  async getPassword(_codigo: string): Promise<string | null> {
    throw new BadRequestException(
      'Las contraseñas no se pueden consultar. Usa restablecer contraseña.',
    );
  }

  /**
   * Resetează parola: generează temp în memorie, salvează doar bcrypt, returnează
   * temporaryPassword doar pentru email one-shot (nu pentru afișare din DB).
   */
  async resetPasswordAndSendEmail(
    codigo: string,
  ): Promise<{ success: true; temporaryPassword: string }> {
    try {
      const empleado = await this.getEmpleadoByCodigo(codigo);
      if (!empleado) {
        throw new BadRequestException('Empleado no encontrado');
      }

      const newPassword = this.generateTemporaryPassword();
      const passwordHash = await hashPassword(newPassword);
      await this.setPasswordHash(codigo, passwordHash);

      this.logger.log(`✅ Parolă resetată (bcrypt) pentru angajat: ${codigo}`);

      return {
        success: true,
        temporaryPassword: newPassword,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error resetting password: ${error.message}`);
      throw error;
    }
  }

  /**
   * Confirmă certificatul de handicap pentru un angajat
   * Dacă confirmă că are certificat, creează automat cererea de document
   */
  async confirmarCertificadoHandicap(
    codigo: string,
    tieneCertificado: boolean,
  ): Promise<{ success: true; documentoCreado?: boolean }> {
    try {
      if (!codigo || codigo.trim() === '') {
        throw new BadRequestException('CODIGO is required');
      }

      const codigoClean = codigo.trim();

      // Actualizează câmpul de confirmare
      const query = `
        UPDATE DatosEmpleados
        SET certificado_handicap_confirmado = ${tieneCertificado ? 1 : 0}
        WHERE CODIGO = ${this.escapeSql(codigoClean)}
      `;

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(
        `✅ Certificado handicap confirmado para ${codigoClean}: ${tieneCertificado}`,
      );

      let documentoCreado = false;

      // Dacă confirmă că are certificat, creează automat cererea de document
      if (tieneCertificado && this.documentosSolicitadosService) {
        try {
          // Verifică dacă există deja o cerere activă pentru acest tip de document
          const solicitudExistente = await this.prisma.$queryRawUnsafe<
            Array<{ id: bigint | number }>
          >(
            `
            SELECT id FROM \`documentos_solicitados\`
            WHERE empleado_id = ${this.escapeSql(codigoClean)}
              AND tipo_documento = 'Certificado de Discapacidad'
              AND estado = 'pendiente'
            LIMIT 1
          `,
          );

          if (solicitudExistente.length === 0) {
            // Creează cererea de document
            await this.documentosSolicitadosService.crearSolicitud({
              empleado_id: codigoClean,
              tipo_documento: 'Certificado de Discapacidad',
              solicitado_por: 'system',
              notas: 'Solicitud automática tras confirmación del empleado',
              aplicar_a_nuevos: false,
            });

            documentoCreado = true;
            this.logger.log(
              `✅ Cerere de document creată automat pentru ${codigoClean}`,
            );
          } else {
            this.logger.log(
              `ℹ️ Există deja o cerere activă pentru ${codigoClean}`,
            );
          }
        } catch (error: any) {
          // Nu aruncăm eroarea pentru a nu bloca confirmarea dacă crearea cererii eșuează
          this.logger.warn(
            `⚠️ Error creando solicitud automática: ${error.message}`,
          );
        }
      }

      return {
        success: true,
        documentoCreado,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error confirmando certificado handicap: ${error.message}`,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al confirmar certificado: ${error.message}`,
      );
    }
  }

  /**
   * Extrage textul dintr-un PDF
   * Folosește PDFParse ca clasă (același pattern ca în gestoria.service.ts)
   */
  private async extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
    try {
      // pdf-parse returnează un obiect cu PDFParse ca clasă
      const PDFParse = pdfParseModule.PDFParse;

      if (!PDFParse) {
        throw new Error('PDFParse class not found in pdf-parse module');
      }

      // Creăm instanță PDFParse (același pattern ca în gestoria.service.ts)
      const pdfInstance = new PDFParse({
        data: new Uint8Array(pdfBuffer),
      });

      // Extragem textul
      const textResult = await pdfInstance.getText();

      // Verificăm formatul rezultatului
      if (
        textResult &&
        typeof textResult === 'object' &&
        'text' in textResult
      ) {
        return textResult.text || '';
      } else if (typeof textResult === 'string') {
        return textResult;
      } else {
        return '';
      }
    } catch (error: any) {
      this.logger.error(`❌ Error extrayendo texto del PDF: ${error.message}`);
      this.logger.error(`❌ Error stack: ${error.stack?.substring(0, 500)}`);
      throw error;
    }
  }

  /**
   * Normalizează un IBAN (elimină spații, transformă în majuscule)
   */
  private normalizeIban(iban: string): string {
    if (!iban) return '';
    return iban.replace(/\s+/g, '').toUpperCase().trim();
  }

  /**
   * Validează formatul IBAN (simplu: începe cu 2 litere, urmate de cifre)
   */
  private isValidIban(iban: string): boolean {
    const normalized = this.normalizeIban(iban);
    // IBAN spaniol: ES + 2 cifre + 4 cifre + 20 cifre = 24 caractere total
    // Dar acceptăm și alte formate europene
    return (
      /^[A-Z]{2}\d{2,30}$/.test(normalized) &&
      normalized.length >= 15 &&
      normalized.length <= 34
    );
  }

  /**
   * Extrage IBAN-uri din textul PDF
   * Caută pattern-uri comune: ES + cifre, sau alte formate IBAN
   */
  private extractIbansFromText(text: string): string[] {
    const ibans: string[] = [];
    const lines = text.split('\n').map((line) => line.trim());

    // Pattern pentru IBAN: ES + 2 cifre + 4 cifre + 20 cifre (sau alte formate)
    const ibanPattern = /ES\d{22}|[A-Z]{2}\d{2,30}/g;

    for (const line of lines) {
      // Elimină spații și caractere speciale pentru a găsi IBAN-uri
      const cleanLine = line.replace(/\s+/g, '');
      const matches = cleanLine.match(ibanPattern);

      if (matches) {
        for (const match of matches) {
          const normalized = this.normalizeIban(match);
          if (this.isValidIban(normalized) && !ibans.includes(normalized)) {
            ibans.push(normalized);
          }
        }
      }
    }

    return ibans;
  }

  /**
   * Verifică dacă două cuvinte sunt similare (pentru typo-uri)
   * Returnează true dacă sunt identice sau foarte similare (max 1-2 caractere diferite)
   */
  private areWordsSimilar(word1: string, word2: string): boolean {
    if (word1 === word2) return true;

    // Dacă unul este substring al celuilalt (ex: "MOHAMEN" în "MOHAMED")
    if (word1.length >= 5 && word2.length >= 5) {
      if (
        word1.includes(word2.substring(0, Math.min(5, word2.length))) ||
        word2.includes(word1.substring(0, Math.min(5, word1.length)))
      ) {
        return true;
      }
    }

    // Verifică diferența de lungime (max 1 caracter)
    if (Math.abs(word1.length - word2.length) > 1) return false;

    // Verifică câte caractere diferă (max 1-2 pentru cuvinte de 5+ caractere)
    const minLen = Math.min(word1.length, word2.length);
    if (minLen < 5) return false; // Pentru cuvinte scurte, doar exact match

    let diff = 0;
    for (let i = 0; i < minLen; i++) {
      if (word1[i] !== word2[i]) {
        diff++;
        if (diff > 1) return false; // Max 1 caracter diferit
      }
    }

    return diff <= 1;
  }

  /**
   * Găsește un angajat după CODIGO sau NOMBRE
   */
  private async findEmpleadoByIdentifier(
    identifier: string,
    isCodigo: boolean = false,
  ): Promise<any | null> {
    if (!identifier || identifier.trim().length === 0) {
      return null;
    }

    const cleanId = identifier.trim().toUpperCase();

    // Dacă este CODIGO, încearcă mai multe variante
    if (isCodigo) {
      // Varianta 1: exact match
      try {
        const byCodigo = await this.prisma.$queryRawUnsafe<Array<any>>(
          `SELECT CODIGO, \`NOMBRE / APELLIDOS\` as NOMBRE_APELLIDOS, \`Nº Cuenta\` as IBAN_ACTUAL
           FROM DatosEmpleados 
           WHERE CODIGO = ${this.escapeSql(cleanId)} 
           LIMIT 1`,
        );

        if (byCodigo && byCodigo.length > 0) {
          return byCodigo[0];
        }
      } catch (error: any) {
        this.logger.warn(
          `⚠️ Error buscando por CODIGO ${cleanId}: ${error.message}`,
        );
      }

      // Varianta 2: dacă CODIGO este de 6-7 cifre, adaugă zerouri la început până la 8
      if (cleanId.length >= 6 && cleanId.length < 8) {
        const codigoConZeros = cleanId.padStart(8, '0');
        try {
          const byCodigo = await this.prisma.$queryRawUnsafe<Array<any>>(
            `SELECT CODIGO, \`NOMBRE / APELLIDOS\` as NOMBRE_APELLIDOS, \`Nº Cuenta\` as IBAN_ACTUAL
             FROM DatosEmpleados 
             WHERE CODIGO = ${this.escapeSql(codigoConZeros)} 
             LIMIT 1`,
          );

          if (byCodigo && byCodigo.length > 0) {
            return byCodigo[0];
          }
        } catch (error: any) {
          this.logger.warn(
            `⚠️ Error buscando por CODIGO ${codigoConZeros}: ${error.message}`,
          );
        }
      }

      // Varianta 3: căutare parțială (ultimele cifre)
      if (cleanId.length >= 6) {
        try {
          const byCodigo = await this.prisma.$queryRawUnsafe<Array<any>>(
            `SELECT CODIGO, \`NOMBRE / APELLIDOS\` as NOMBRE_APELLIDOS, \`Nº Cuenta\` as IBAN_ACTUAL
             FROM DatosEmpleados 
             WHERE CODIGO LIKE ${this.escapeSql(`%${cleanId}`)} 
             LIMIT 5`,
          );

          if (byCodigo && byCodigo.length > 0) {
            // Dacă găsește exact un match, îl returnează
            if (byCodigo.length === 1) {
              return byCodigo[0];
            }
            // Dacă găsește mai multe, returnează primul
            return byCodigo[0];
          }
        } catch (error: any) {
          this.logger.warn(
            `⚠️ Error buscando por CODIGO parcial ${cleanId}: ${error.message}`,
          );
        }
      }
    } else {
      // Căutare după NOMBRE
      // Normalizează numele: elimină underscore-uri, spații multiple, etc.
      let nombreNormalizado = cleanId
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Elimină underscore-uri și caractere speciale la început/la final
      nombreNormalizado = nombreNormalizado
        .replace(/^[_\s]+|[_\s]+$/g, '')
        .trim();

      // Extrage cuvintele importante (filtrează cuvinte scurte)
      const palabras = nombreNormalizado.split(' ').filter((p) => p.length > 2);

      if (palabras.length === 0) {
        return null;
      }

      try {
        // Căutare flexibilă: folosește OR pentru a găsi mai mulți candidați
        // Apoi verificăm manual câte cuvinte se potrivesc (inclusiv cu fuzzy matching)
        const condiciones = palabras
          .map(
            (palabra) =>
              `UPPER(REPLACE(REPLACE(\`NOMBRE / APELLIDOS\`, '_', ' '), '  ', ' ')) LIKE ${this.escapeSql(`%${palabra}%`)}`,
          )
          .join(' OR ');

        const byNombre = await this.prisma.$queryRawUnsafe<Array<any>>(
          `SELECT CODIGO, \`NOMBRE / APELLIDOS\` as NOMBRE_APELLIDOS, \`Nº Cuenta\` as IBAN_ACTUAL
           FROM DatosEmpleados 
           WHERE ${condiciones}
           LIMIT 20`,
        );

        if (byNombre && byNombre.length > 0) {
          // Verifică manual câte cuvinte se potrivesc pentru fiecare candidat
          // (inclusiv cu fuzzy matching pentru typo-uri)
          let bestMatch = null;
          let bestScore = 0;

          for (const empleado of byNombre) {
            const nombreEmpleado = (empleado.NOMBRE_APELLIDOS || '')
              .toUpperCase()
              .replace(/_/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            const palabrasEmpleado = nombreEmpleado
              .split(' ')
              .filter((p) => p.length > 2);

            // Verifică câte cuvinte din PDF există în numele din DB
            // (indiferent de ordine, cu fuzzy matching pentru typo-uri)
            let matches = 0;
            for (const palabra of palabras) {
              // Verifică exact match
              if (palabrasEmpleado.includes(palabra)) {
                matches++;
              } else {
                // Verifică fuzzy match (pentru typo-uri)
                for (const palabraEmpleado of palabrasEmpleado) {
                  if (this.areWordsSimilar(palabra, palabraEmpleado)) {
                    matches++;
                    break; // Nu numără de două ori același cuvânt
                  }
                }
              }
            }

            // Verifică dacă TOATE cuvintele din DB se găsesc în PDF
            // (chiar dacă PDF are mai multe cuvinte - ex: "FLORES CORREA ZULLY ANAKELLY" vs "ZULLY ANAKELLY")
            let allDbWordsMatch = true;
            for (const palabraEmpleado of palabrasEmpleado) {
              let found = false;
              for (const palabra of palabras) {
                if (
                  palabra === palabraEmpleado ||
                  this.areWordsSimilar(palabra, palabraEmpleado)
                ) {
                  found = true;
                  break;
                }
              }
              if (!found) {
                allDbWordsMatch = false;
                break;
              }
            }

            // Prioritizează ultimele 2-3 cuvinte (numele și prenumele)
            // Dacă acestea se potrivesc, acceptă match-ul chiar dacă primele cuvinte nu se găsesc
            const ultimasPalabras = palabras.slice(
              -Math.min(3, palabras.length),
            ); // Ultimele 2-3 cuvinte
            let ultimasMatches = 0;
            for (const palabra of ultimasPalabras) {
              if (palabrasEmpleado.includes(palabra)) {
                ultimasMatches++;
              } else {
                for (const palabraEmpleado of palabrasEmpleado) {
                  if (this.areWordsSimilar(palabra, palabraEmpleado)) {
                    ultimasMatches++;
                    break;
                  }
                }
              }
            }

            // Scor: numărul de cuvinte potrivite / numărul total de cuvinte
            const score = matches / palabras.length;

            // Acceptă match dacă:
            // 1. TOATE cuvintele din DB se găsesc în PDF (chiar dacă PDF are mai multe)
            // 2. SAU majoritatea cuvintelor se potrivesc (60%+)
            // 3. SAU toate ultimele 2-3 cuvinte se potrivesc (numele și prenumele)
            const minMatches = Math.max(2, Math.ceil(palabras.length * 0.6)); // Cel puțin 60% din cuvinte
            const allUltimasMatch =
              ultimasMatches === ultimasPalabras.length &&
              ultimasPalabras.length >= 2;

            if (
              (allDbWordsMatch && palabrasEmpleado.length > 0) ||
              (matches >= minMatches && score > bestScore) ||
              (allUltimasMatch && score > bestScore)
            ) {
              // Dacă toate cuvintele din DB se găsesc, acesta este match-ul perfect
              if (allDbWordsMatch && palabrasEmpleado.length > 0) {
                return empleado; // Returnează imediat, este match perfect
              }

              if (
                score > bestScore ||
                (allUltimasMatch && score >= bestScore)
              ) {
                bestMatch = empleado;
                bestScore = score;
              }
            }
          }

          // Dacă găsește un match bun, returnează-l
          if (bestMatch) {
            return bestMatch;
          }

          // Dacă nu găsește cu majoritatea, încearcă cu primele 2 cuvinte importante
          if (palabras.length >= 2) {
            const condiciones2 = palabras
              .slice(0, 2)
              .map(
                (palabra) =>
                  `UPPER(REPLACE(REPLACE(\`NOMBRE / APELLIDOS\`, '_', ' '), '  ', ' ')) LIKE ${this.escapeSql(`%${palabra}%`)}`,
              )
              .join(' OR ');

            const byNombre2 = await this.prisma.$queryRawUnsafe<Array<any>>(
              `SELECT CODIGO, \`NOMBRE / APELLIDOS\` as NOMBRE_APELLIDOS, \`Nº Cuenta\` as IBAN_ACTUAL
               FROM DatosEmpleados 
               WHERE ${condiciones2}
               LIMIT 10`,
            );

            if (byNombre2 && byNombre2.length > 0) {
              // Verifică match-ul pentru fiecare rezultat (cu fuzzy matching)
              for (const empleado of byNombre2) {
                const nombreEmpleado = (empleado.NOMBRE_APELLIDOS || '')
                  .toUpperCase()
                  .replace(/_/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                const palabrasEmpleado = nombreEmpleado
                  .split(' ')
                  .filter((p) => p.length > 2);

                let matches = 0;
                for (const palabra of palabras) {
                  if (palabrasEmpleado.includes(palabra)) {
                    matches++;
                  } else {
                    // Fuzzy match
                    for (const palabraEmpleado of palabrasEmpleado) {
                      if (this.areWordsSimilar(palabra, palabraEmpleado)) {
                        matches++;
                        break;
                      }
                    }
                  }
                }

                // Dacă găsește cel puțin 2 cuvinte (sau majoritatea), returnează-l
                if (matches >= Math.max(2, Math.ceil(palabras.length * 0.6))) {
                  return empleado;
                }
              }
            }
          }
        }
      } catch (error: any) {
        this.logger.warn(
          `⚠️ Error buscando por NOMBRE ${nombreNormalizado}: ${error.message}`,
        );
      }
    }

    return null;
  }

  /**
   * Procesează PDF-ul SOPORTE și extrage IBAN-urile cu asocieri propuse
   */
  async procesarPdfSoportePreview(pdfBuffer: Buffer): Promise<{
    success: boolean;
    asociaciones: Array<{
      codigo?: string;
      nombre?: string;
      ibanExtraido: string;
      empleadoEncontrado?: {
        codigo: string;
        nombre: string;
        ibanActual?: string;
      };
      necesitaConfirmacion: boolean;
    }>;
    errores: string[];
  }> {
    try {
      this.logger.log('📄 Procesando PDF SOPORTE para extraer IBANs...');

      // Extrage textul din PDF
      const pdfText = await this.extractTextFromPdf(pdfBuffer);

      if (!pdfText || pdfText.trim().length === 0) {
        throw new BadRequestException('No se pudo extraer texto del PDF');
      }

      // LOG pentru debugging - primele 3000 caractere
      this.logger.log(`📄 PDF text length: ${pdfText.length}`);
      this.logger.log(`📄 First 3000 chars: ${pdfText.substring(0, 3000)}`);

      // Extrage IBAN-uri
      const ibans = this.extractIbansFromText(pdfText);

      if (ibans.length === 0) {
        throw new BadRequestException('No se encontraron IBANs en el PDF');
      }

      this.logger.log(`✅ Encontrados ${ibans.length} IBANs en el PDF`);

      // LOG primele 5 IBAN-uri și contextul lor
      const lines = pdfText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      for (let i = 0; i < Math.min(5, ibans.length); i++) {
        const iban = ibans[i];
        const ibanNormalizado = this.normalizeIban(iban);

        for (let j = 0; j < lines.length; j++) {
          if (lines[j].replace(/\s+/g, '').includes(ibanNormalizado)) {
            this.logger.log(`\n📋 IBAN ${i + 1}: ${ibanNormalizado}`);
            this.logger.log(`   Line ${j} (with IBAN): ${lines[j]}`);
            this.logger.log(`   Lines BEFORE (3 lines):`);
            for (let k = Math.max(0, j - 3); k < j; k++) {
              this.logger.log(`     [${k}] ${lines[k]}`);
            }
            break;
          }
        }
      }

      // Încearcă să asocieze IBAN-urile cu angajații
      // Strategie: căutăm în text contextul în jurul fiecărui IBAN
      const asociaciones: Array<{
        codigo?: string;
        nombre?: string;
        ibanExtraido: string;
        empleadoEncontrado?: {
          codigo: string;
          nombre: string;
          ibanActual?: string;
        };
        necesitaConfirmacion: boolean;
      }> = [];

      const errores: string[] = [];

      // Structura PDF SOPORTE: fiecare linie are formatul: IBAN \t CODIGO_OPERARIO NOMBRE APELLIDOS IMPORTE
      // (lines este deja declarat mai sus pentru logging)
      // Exemplu: "ES5514650100981740095762	0580002 NEACSU DECEBAL MARIUS 1.338,30"
      // Primul IBAN (linia 6) este singur, fără CODIGO - este IBAN-ul companiei, îl ignorăm

      for (let ibanIndex = 0; ibanIndex < ibans.length; ibanIndex++) {
        const iban = ibans[ibanIndex];
        const ibanNormalizado = this.normalizeIban(iban);
        let contextFound = false;

        // IGNORĂ complet primul IBAN (este IBAN companie)
        if (ibanIndex === 0) {
          this.logger.log(
            `⚠️ Ignorando IBAN companie (primul IBAN): ${ibanNormalizado}`,
          );
          continue; // Skip complet, nu adăugăm în asociaciones
        }

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Verifică dacă linia conține IBAN-ul
          if (line.replace(/\s+/g, '').includes(ibanNormalizado)) {
            // Pattern: IBAN \t CODIGO NOMBRE APELLIDOS IMPORTE
            // Sau: IBAN (singur, fără CODIGO - este IBAN companie)

            // Verifică dacă linia are TAB sau spații multiple (format cu CODIGO și nume)
            const hasTab = line.includes('\t');
            const parts = hasTab ? line.split('\t') : line.split(/\s{2,}/);

            if (parts.length >= 2) {
              // Format: IBAN \t CODIGO NOMBRE APELLIDOS IMPORTE
              const ibanPart = parts[0].trim();

              // Verifică că primul part este IBAN-ul
              if (ibanPart.replace(/\s+/g, '') === ibanNormalizado) {
                const restOfLine = parts.slice(1).join(' ').trim();

                // Extrage CODIGO (6-7 cifre la început, după TAB)
                // Pattern: 0580002 sau 0580003 (6-7 cifre)
                const codigoMatch = restOfLine.match(/^(\d{6,7})\s+/);
                let codigoEncontrado: string | null = null;
                let nombreEncontrado: string | null = null;

                if (codigoMatch) {
                  codigoEncontrado = codigoMatch[1];

                  // Restul liniei după CODIGO este: NOMBRE APELLIDOS IMPORTE
                  const afterCodigo = restOfLine
                    .substring(codigoMatch[0].length)
                    .trim();

                  // Extrage NOMBRE APELLIDOS (până la ultimul număr care este IMPORTE)
                  // IMPORTE este de forma: 1.338,30 sau 3.091,06
                  const importeMatch = afterCodigo.match(
                    /\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/,
                  );

                  if (importeMatch) {
                    // Numele este tot ce este înainte de IMPORTE
                    nombreEncontrado = afterCodigo
                      .substring(0, importeMatch.index)
                      .trim();
                  } else {
                    // Dacă nu găsește IMPORTE, tot ce rămâne este numele
                    nombreEncontrado = afterCodigo;
                  }

                  // Normalizează numele (elimină underscore-uri și caractere speciale)
                  if (nombreEncontrado) {
                    // Elimină underscore-uri și normalizează spațiile
                    nombreEncontrado = nombreEncontrado
                      .replace(/_/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim();
                    // Elimină underscore-uri și spații la început/la final
                    nombreEncontrado = nombreEncontrado
                      .replace(/^[_\s]+|[_\s]+$/g, '')
                      .trim();
                  }
                } else {
                  // Nu are CODIGO, ignorăm (nu ar trebui să ajungă aici pentru IBAN-uri valide)
                  continue;
                }

                // Încearcă să găsească angajatul
                // PRIORITATE: 1) IBAN (cel mai sigur), 2) CODIGO, 3) NOMBRE
                let empleadoEncontrado = null;

                // PRIORITATE 1: Caută mai întâi după IBAN (cel mai sigur match)
                // Dacă IBAN-ul există deja în DB, este cel mai probabil că este pentru acel angajat
                try {
                  const empleadoByIban = await this.prisma.$queryRawUnsafe<
                    Array<any>
                  >(
                    `SELECT CODIGO, \`NOMBRE / APELLIDOS\` as NOMBRE_APELLIDOS, \`Nº Cuenta\` as IBAN_ACTUAL
                     FROM DatosEmpleados 
                     WHERE \`Nº Cuenta\` = ${this.escapeSql(ibanNormalizado)} 
                     LIMIT 1`,
                  );

                  if (empleadoByIban && empleadoByIban.length > 0) {
                    empleadoEncontrado = empleadoByIban[0];
                    this.logger.log(
                      `✅ Empleado encontrado por IBAN: ${empleadoEncontrado.CODIGO} - ${empleadoEncontrado.NOMBRE_APELLIDOS}`,
                    );
                  } else {
                    this.logger.log(
                      `ℹ️ IBAN ${ibanNormalizado} no encontrado en DB, buscando por CODIGO/NOMBRE...`,
                    );
                  }
                } catch (error: any) {
                  this.logger.warn(
                    `⚠️ Error buscando por IBAN ${ibanNormalizado}: ${error.message}`,
                  );
                }

                // PRIORITATE 2: Dacă nu găsește după IBAN, caută după CODIGO
                // IMPORTANT: Verifică dacă IBAN-ul din DB pentru acel CODIGO se potrivește
                if (!empleadoEncontrado && codigoEncontrado) {
                  const empleadoByCodigo = await this.findEmpleadoByIdentifier(
                    codigoEncontrado,
                    true,
                  );
                  if (empleadoByCodigo) {
                    const ibanDbCodigo = empleadoByCodigo.IBAN_ACTUAL
                      ? this.normalizeIban(empleadoByCodigo.IBAN_ACTUAL)
                      : null;

                    // Dacă CODIGO-ul are deja un IBAN diferit în DB, este suspect
                    // Poate că CODIGO-ul din PDF este greșit sau IBAN-ul este pentru alt angajat
                    if (ibanDbCodigo && ibanDbCodigo !== ibanNormalizado) {
                      this.logger.warn(
                        `⚠️ CODIGO ${codigoEncontrado} tiene IBAN diferente en DB (${ibanDbCodigo} vs ${ibanNormalizado}). Buscando por NOMBRE también...`,
                      );

                      // Încearcă să găsească după nume (poate găsește angajatul corect)
                      if (nombreEncontrado) {
                        const empleadoByNombre =
                          await this.findEmpleadoByIdentifier(
                            nombreEncontrado,
                            false,
                          );
                        if (empleadoByNombre) {
                          const ibanDbNombre = empleadoByNombre.IBAN_ACTUAL
                            ? this.normalizeIban(empleadoByNombre.IBAN_ACTUAL)
                            : null;

                          // Dacă numele găsește un angajat cu IBAN-ul corect, folosește-l
                          if (ibanDbNombre === ibanNormalizado) {
                            empleadoEncontrado = empleadoByNombre;
                            this.logger.log(
                              `✅ Empleado encontrado por NOMBRE (IBAN coincide): ${empleadoEncontrado.CODIGO} - ${empleadoEncontrado.NOMBRE_APELLIDOS}`,
                            );
                          } else if (!ibanDbNombre) {
                            // Dacă numele găsește un angajat fără IBAN, este probabil corect
                            empleadoEncontrado = empleadoByNombre;
                            this.logger.log(
                              `✅ Empleado encontrado por NOMBRE (sin IBAN en DB): ${empleadoEncontrado.CODIGO} - ${empleadoEncontrado.NOMBRE_APELLIDOS}`,
                            );
                          } else {
                            // Dacă nici numele nu se potrivește, folosește CODIGO-ul (dar va necesita confirmare)
                            empleadoEncontrado = empleadoByCodigo;
                            this.logger.warn(
                              `⚠️ Usando CODIGO ${codigoEncontrado} pero IBAN no coincide. Requiere confirmación.`,
                            );
                          }
                        } else {
                          // Dacă nu găsește după nume, folosește CODIGO-ul (dar va necesita confirmare)
                          empleadoEncontrado = empleadoByCodigo;
                          this.logger.warn(
                            `⚠️ Usando CODIGO ${codigoEncontrado} pero IBAN no coincide. Requiere confirmación.`,
                          );
                        }
                      } else {
                        // Dacă nu are nume, folosește CODIGO-ul (dar va necesita confirmare)
                        empleadoEncontrado = empleadoByCodigo;
                        this.logger.warn(
                          `⚠️ Usando CODIGO ${codigoEncontrado} pero IBAN no coincide. Requiere confirmación.`,
                        );
                      }
                    } else {
                      // Dacă CODIGO-ul nu are IBAN sau IBAN-ul se potrivește, este OK
                      empleadoEncontrado = empleadoByCodigo;
                      this.logger.log(
                        `✅ Empleado encontrado por CODIGO: ${codigoEncontrado} - ${empleadoEncontrado.NOMBRE_APELLIDOS}`,
                      );
                    }
                  }
                }

                // PRIORITATE 3: Dacă tot nu găsește, încearcă după nume
                if (!empleadoEncontrado && nombreEncontrado) {
                  empleadoEncontrado = await this.findEmpleadoByIdentifier(
                    nombreEncontrado,
                    false,
                  );
                  if (empleadoEncontrado) {
                    this.logger.log(
                      `✅ Empleado encontrado por NOMBRE: ${nombreEncontrado} - ${empleadoEncontrado.NOMBRE_APELLIDOS}`,
                    );
                  }
                }

                // Verifică dacă IBAN-ul din PDF diferă de cel din DB
                const ibanActualNormalizado = empleadoEncontrado?.IBAN_ACTUAL
                  ? this.normalizeIban(empleadoEncontrado.IBAN_ACTUAL)
                  : null;
                const ibanDiferente =
                  empleadoEncontrado && ibanActualNormalizado
                    ? ibanActualNormalizado !== ibanNormalizado
                    : false;

                asociaciones.push({
                  codigo: codigoEncontrado || undefined,
                  nombre: nombreEncontrado || undefined,
                  ibanExtraido: ibanNormalizado,
                  empleadoEncontrado: empleadoEncontrado
                    ? {
                        codigo: empleadoEncontrado.CODIGO,
                        nombre: empleadoEncontrado.NOMBRE_APELLIDOS || '',
                        ibanActual: empleadoEncontrado.IBAN_ACTUAL || undefined,
                      }
                    : undefined,
                  // Necesită confirmare dacă: nu găsește angajatul SAU IBAN-urile diferă
                  necesitaConfirmacion: !empleadoEncontrado || ibanDiferente,
                });

                contextFound = true;
                break;
              }
            }
          }
        }

        if (!contextFound) {
          // Dacă nu găsește context, adaugă IBAN-ul fără asociere
          asociaciones.push({
            ibanExtraido: ibanNormalizado,
            necesitaConfirmacion: true,
          });
          errores.push(
            `IBAN ${iban} encontrado pero no se pudo asociar con ningún empleado`,
          );
        }
      }

      this.logger.log(
        `✅ Procesadas ${asociaciones.length} asociaciones, ${errores.length} errores`,
      );

      return {
        success: true,
        asociaciones,
        errores,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error procesando PDF SOPORTE: ${error.message}`,
        error.stack,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error procesando PDF: ${error.message}`);
    }
  }

  /**
   * Confirma și actualizează IBAN-urile în baza de date
   */
  async confirmarActualizacionIbans(
    actualizaciones: Array<{
      codigo: string;
      iban: string;
    }>,

    _usuarioId: string,
  ): Promise<{
    success: boolean;
    actualizados: number;
    errores: Array<{ codigo: string; error: string }>;
  }> {
    try {
      this.logger.log(
        `💾 Confirmando actualización de ${actualizaciones.length} IBANs...`,
      );

      let actualizados = 0;
      const errores: Array<{ codigo: string; error: string }> = [];

      for (const actualizacion of actualizaciones) {
        try {
          const ibanNormalizado = this.normalizeIban(actualizacion.iban);

          if (!this.isValidIban(ibanNormalizado)) {
            errores.push({
              codigo: actualizacion.codigo,
              error: `IBAN inválido: ${actualizacion.iban}`,
            });
            continue;
          }

          // Actualizează IBAN-ul în baza de date
          const updateQuery = `
            UPDATE DatosEmpleados 
            SET \`Nº Cuenta\` = ${this.escapeSql(ibanNormalizado)}
            WHERE CODIGO = ${this.escapeSql(actualizacion.codigo)}
          `;

          const result = await this.prisma.$executeRawUnsafe(updateQuery);

          if (result > 0) {
            actualizados++;
            this.logger.log(
              `✅ IBAN actualizado para empleado ${actualizacion.codigo}`,
            );
          } else {
            errores.push({
              codigo: actualizacion.codigo,
              error: 'Empleado no encontrado',
            });
          }
        } catch (error: any) {
          this.logger.error(
            `❌ Error actualizando IBAN para ${actualizacion.codigo}: ${error.message}`,
          );
          errores.push({
            codigo: actualizacion.codigo,
            error: error.message,
          });
        }
      }

      this.logger.log(
        `✅ Actualizados ${actualizados} IBANs, ${errores.length} errores`,
      );

      return {
        success: true,
        actualizados,
        errores,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error confirmando actualización de IBANs: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error confirmando actualización: ${error.message}`,
      );
    }
  }
}
