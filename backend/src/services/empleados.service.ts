import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentosSolicitadosService } from './documentos-solicitados.service';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

@Injectable()
export class EmpleadosService {
  private readonly logger = new Logger(EmpleadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DocumentosSolicitadosService))
    private readonly documentosSolicitadosService?: DocumentosSolicitadosService,
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
   * Nota: Acest endpoint este accesibil doar pentru manageri (protejat în frontend cu canManageEmployees)
   */
  async getEstadisticasEmpleados(): Promise<any[]> {
    // Nu aplicăm RBAC aici - doar managerii pot accesa tab-ul în frontend
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
              AND c.LUNA = DATE_FORMAT(NOW(), '%Y-%m')
          ) THEN 'Sí'
          ELSE 'No'
        END AS tiene_cuadrante,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM horarios h
            WHERE h.centro_nombre = de.\`CENTRO TRABAJO\`
              AND h.grupo_nombre = de.\`GRUPO\`
          ) THEN 'Sí'
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

  async exportEstadisticasEmpleadosExcel(): Promise<Buffer> {
    try {
      const estadisticas = await this.getEstadisticasEmpleados();

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

  async exportEstadisticasEmpleadosPDF(): Promise<Buffer> {
    try {
      const estadisticas = await this.getEstadisticasEmpleados();

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
        \`Contraseña\`
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
      FECHA_BAJA: empleado['FECHA BAJA'] ?? empleado.FECHA_BAJA ?? null,
      FECHA_ANTIGUEDAD:
        empleado['Fecha Antigüedad'] ?? empleado.FECHA_ANTIGUEDAD ?? null,
      ANTIGUEDAD: empleado['Antigüedad'] ?? empleado.ANTIGUEDAD ?? null,
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

  async getAllEmpleados() {
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
        \`TrabajaFestivos\`
      FROM DatosEmpleados
      ORDER BY \`NOMBRE / APELLIDOS\` ASC
    `;

    // Mapăm câmpurile pentru compatibilitate cu frontend-ul
    return rows.map((empleado) => ({
      ...empleado,
      // Alias-uri pentru compatibilitate
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
      FECHA_BAJA: empleado['FECHA BAJA'] ?? empleado.FECHA_BAJA ?? null,
      FECHA_ANTIGUEDAD:
        empleado['Fecha Antigüedad'] ?? empleado.FECHA_ANTIGUEDAD ?? null,
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

  /**
   * Generează o parolă provizorie aleatorie și sigură
   */
  private generateTemporaryPassword(): string {
    // Generează o parolă de 12 caractere cu:
    // - 2 majuscule
    // - 2 minuscule
    // - 2 cifre
    // - 2 caractere speciale
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnpqrstuvwxyz';
    const numbers = '23456789';
    const special = '!@#$%&*';

    let password = '';
    // Adaugă câte un caracter din fiecare categorie
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Completează până la 12 caractere cu caractere aleatorii
    const allChars = uppercase + lowercase + numbers + special;
    while (password.length < 12) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Amestecă caracterele pentru a fi mai aleatorie
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
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
      // Generează parolă provizorie dacă nu este furnizată sau este golă
      const hasPasswordProvided =
        empleadoData.Contraseña && empleadoData.Contraseña.trim() !== '';
      const temporaryPassword = hasPasswordProvided
        ? empleadoData.Contraseña
        : this.generateTemporaryPassword();

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
          \`Contraseña\`
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
          ${this.escapeSql(empleadoData['FECHA BAJA'] || null)},
          ${this.escapeSql(empleadoData['Fecha Antigüedad'] || null)},
          ${this.escapeSql(empleadoData.Antigüedad || null)},
          ${this.escapeSql(empleadoData.DerechoPedidos || 'NO')},
          ${this.escapeSql(empleadoData.TrabajaFestivos || 'NO')},
          ${this.escapeSql(temporaryPassword)}
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

      return {
        success: true,
        codigo: empleadoData.CODIGO,
        temporaryPassword: wasPasswordGenerated ? temporaryPassword : undefined, // Returnează parola provizorie doar dacă a fost generată
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
    },
  ): Promise<{ success: true; codigo: string }> {
    if (!codigo) {
      throw new BadRequestException('CODIGO is required');
    }

    try {
      // Construim query-ul UPDATE
      // Parola este inclusă în query doar dacă este furnizată în empleadoData
      const passwordUpdate =
        empleadoData.Contraseña !== undefined
          ? `\`Contraseña\`            = ${this.escapeSql(empleadoData.Contraseña)},`
          : '';

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
          \`FECHA BAJA\`            = ${this.escapeSql(empleadoData['FECHA BAJA'] ?? null)},
          \`Fecha Antigüedad\`      = ${this.escapeSql(empleadoData['Fecha Antigüedad'] ?? null)},
          \`Antigüedad\`            = ${this.escapeSql(empleadoData.Antigüedad ?? null)},
          ${passwordUpdate}
          \`DerechoPedidos\`        = ${this.escapeSql(empleadoData.DerechoPedidos ?? '')},
          \`TrabajaFestivos\`       = ${this.escapeSql(empleadoData.TrabajaFestivos ?? '')}
        WHERE
          \`CODIGO\` = ${this.escapeSql(codigo)}
      `;

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
      // Convertim buffer-ul la base64 pentru a-l salva în baza de date
      const base64Data = pdfBuffer.toString('base64');

      // Folosim Prisma pentru a insera în CarpetasDocumentos
      // ID-ul se generează automat (autoincrement), dar putem folosi și codigo ca id
      const fechaCreacion = new Date().toISOString().split('T')[0];

      this.logger.log(
        `💾 Salvăm PDF în CarpetasDocumentos: codigo=${codigo}, email=${correoElectronico || '(gol)'}, nombre=${nombreEmpleado || '(gol)'}`,
      );

      // Tratăm email-ul: dacă este gol sau null, salvăm NULL în baza de date
      const emailValue =
        correoElectronico && correoElectronico.trim() !== ''
          ? correoElectronico.trim()
          : null;

      this.logger.log(
        `💾 Email value pentru CarpetasDocumentos: original="${correoElectronico}", processed="${emailValue}", will save as: ${emailValue === null ? 'NULL' : `'${emailValue}'`}`,
      );

      const insertQuery = `
        INSERT INTO CarpetasDocumentos (
          \`id\`,
          \`correo_electronico\`,
          \`tipo_documento\`,
          \`nombre_archivo\`,
          \`nombre_empleado\`,
          \`fecha_creacion\`,
          \`archivo\`
        ) VALUES (
          ${this.escapeSql(codigo)},
          ${this.escapeSql(emailValue)},
          ${this.escapeSql(tipoDocumento)},
          ${this.escapeSql(nombreArchivo)},
          ${this.escapeSql(nombreEmpleado || '')},
          ${this.escapeSql(fechaCreacion)},
          FROM_BASE64(${this.escapeSql(base64Data)})
        )
      `;

      await this.prisma.$executeRawUnsafe(insertQuery);

      this.logger.log(
        `✅ PDF salvat în CarpetasDocumentos pentru empleado ${codigo}, email: ${correoElectronico || '(nu s-a salvat email-ul)'}`,
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
   * Schimbă parola unui angajat după verificarea vechii parole
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

    if (!newPassword || !newPassword.trim()) {
      throw new BadRequestException('La nueva contraseña es obligatoria');
    }

    // Validări pentru noua parolă - condiții minime de securitate
    const password = newPassword.trim();

    // Longitudine minimă: 9 caractere (12 recomandat)
    if (password.length < 9) {
      throw new BadRequestException(
        'La nueva contraseña debe tener al menos 9 caracteres (se recomienda 12)',
      );
    }

    if (password.length > 100) {
      throw new BadRequestException(
        'La nueva contraseña no puede tener más de 100 caracteres',
      );
    }

    // Verifică complexitatea parolei
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
      password,
    );

    const errors: string[] = [];
    if (!hasUpperCase) {
      errors.push('al menos 1 letra mayúscula (A-Z)');
    }
    if (!hasLowerCase) {
      errors.push('al menos 1 letra minúscula (a-z)');
    }
    if (!hasNumber) {
      errors.push('al menos 1 número (0-9)');
    }
    if (!hasSpecialChar) {
      errors.push('al menos 1 carácter especial (! @ # $ % ^ & * ( ) _ + - =)');
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `La nueva contraseña debe contener: ${errors.join(', ')}`,
      );
    }

    try {
      // Obține angajatul din baza de date
      const empleado = await this.getEmpleadoByCodigo(codigo);
      if (!empleado) {
        throw new BadRequestException('Empleado no encontrado');
      }

      // Verifică vechea parolă - compară cu DNI_NIE sau Contraseña
      const dniPassword = String(
        empleado['D.N.I. / NIE'] || empleado.DNI_NIE || '',
      ).trim();
      const contraseñaPassword = String(
        empleado.Contraseña ||
          empleado['Contraseña'] ||
          empleado.CONTRASENA ||
          '',
      ).trim();
      const inputOldPassword = oldPassword.trim();

      this.logger.debug(
        `🔍 [changePassword] Verificando contraseña - DNI: ${dniPassword ? '***' : 'empty'}, Contraseña: ${contraseñaPassword ? '***' : 'empty'}, Input length: ${inputOldPassword.length}`,
      );

      if (
        dniPassword !== inputOldPassword &&
        contraseñaPassword !== inputOldPassword
      ) {
        this.logger.warn(
          `⚠️ [changePassword] Contraseña actual incorrecta para codigo: ${codigo}`,
        );
        throw new BadRequestException('La contraseña actual es incorrecta');
      }

      // Verifică dacă noua parolă este diferită de vechea parolă
      if (newPassword.trim() === inputOldPassword) {
        throw new BadRequestException(
          'La nueva contraseña debe ser diferente a la contraseña actual',
        );
      }

      // Actualizează parola în baza de date
      const query = `
        UPDATE DatosEmpleados
        SET \`Contraseña\` = ${this.escapeSql(newPassword.trim())}
        WHERE CODIGO = ${this.escapeSql(codigo)}
      `;

      await this.prisma.$executeRawUnsafe(query);

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
   * Obtiene la contraseña de un empleado (solo para managers/admins)
   */
  async getPassword(codigo: string): Promise<string | null> {
    try {
      if (!codigo || codigo.trim() === '') {
        throw new BadRequestException('CODIGO is required');
      }

      const codigoClean = codigo.trim();

      const query = `
        SELECT \`Contraseña\`
        FROM DatosEmpleados
        WHERE CODIGO = ${this.escapeSql(codigoClean)}
        LIMIT 1
      `;

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      if (rows.length > 0 && rows[0].Contraseña) {
        this.logger.log(`✅ Contraseña retrieved for codigo: ${codigoClean}`);
        return String(rows[0].Contraseña);
      } else {
        this.logger.log(
          `🔍 No se encontró contraseña para codigo: ${codigoClean}`,
        );
        return null;
      }
    } catch (error: any) {
      this.logger.error('❌ Error retrieving password:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener la contraseña: ${error.message}`,
      );
    }
  }

  /**
   * Resetează parola unui angajat și trimite email cu noua parolă
   */
  async resetPasswordAndSendEmail(
    codigo: string,
  ): Promise<{ success: true; temporaryPassword: string }> {
    try {
      // Obține angajatul
      const empleado = await this.getEmpleadoByCodigo(codigo);
      if (!empleado) {
        throw new BadRequestException('Empleado no encontrado');
      }

      // Generează o parolă nouă
      const newPassword = this.generateTemporaryPassword();

      // Actualizează parola în baza de date
      const query = `
        UPDATE DatosEmpleados
        SET \`Contraseña\` = ${this.escapeSql(newPassword)}
        WHERE CODIGO = ${this.escapeSql(codigo)}
      `;

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(`✅ Parolă resetată pentru angajat: ${codigo}`);

      return {
        success: true,
        temporaryPassword: newPassword,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error resetting password: ${error.message}`);
      throw error;
    }
  }
}
