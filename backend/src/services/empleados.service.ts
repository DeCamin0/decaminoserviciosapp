import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmpleadosService {
  private readonly logger = new Logger(EmpleadosService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getEmpleadoByCodigo(codigo: string) {
    if (!codigo) {
      throw new NotFoundException('Employee code is required');
    }

    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT 
        CODIGO,
        \`NOMBRE / APELLIDOS\`,
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
      empleadoNombre:
        empleado['NOMBRE / APELLIDOS'] ??
        empleado.NOMBRE_APELLIDOS ??
        empleado['CORREO ELECTRONICO'] ??
        empleado.CORREO_ELECTRONICO ??
        empleado.CODIGO ??
        null,
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
   * Adaugă un nou empleado în baza de date
   */
  async addEmpleado(empleadoData: {
    CODIGO: string;
    'NOMBRE / APELLIDOS'?: string;
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
  }): Promise<{ success: true; codigo: string }> {
    if (!empleadoData.CODIGO) {
      throw new BadRequestException('CODIGO is required');
    }

    try {
      // Construim query-ul INSERT
      const insertQuery = `
        INSERT INTO DatosEmpleados (
          \`CODIGO\`,
          \`NOMBRE / APELLIDOS\`,
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
        ) VALUES (
          ${this.escapeSql(empleadoData.CODIGO)},
          ${this.escapeSql(empleadoData['NOMBRE / APELLIDOS'] || '')},
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
          ${this.escapeSql(empleadoData.TrabajaFestivos || 'NO')}
        )
      `;

      await this.prisma.$executeRawUnsafe(insertQuery);

      this.logger.log(`✅ Empleado adăugat cu succes: ${empleadoData.CODIGO}`);

      return {
        success: true,
        codigo: empleadoData.CODIGO,
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

      const updateQuery = `
        UPDATE DatosEmpleados SET
          \`NOMBRE / APELLIDOS\`    = ${this.escapeSql(empleadoData['NOMBRE / APELLIDOS'] ?? '')},
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
      const valorViejo = valoresAnteriores[i]?.trim() || '(gol)';
      const valorNuevo = valoresNuevos[i]?.trim() || '(gol)';

      if (valorViejo !== valorNuevo) {
        resultado.push(`${campo}: "${valorViejo}" → "${valorNuevo}"`);
      }
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
  }): Promise<{ success: true; id: string }> {
    try {
      // Formatează modificările (similar cu n8n Code node)
      const camposModificados = data.CAMPO_MODIFICADO.split(',')
        .map((c) => c.trim())
        .filter((c) => c);
      const valoresAnteriores = data.VALOR_ANTERIOR.split(',')
        .map((v) => v.trim())
        .filter((v) => v !== '');
      const valoresNuevos = data.VALOR_NUEVO.split(',')
        .map((v) => v.trim())
        .filter((v) => v !== '');

      const campoFormatat = this.formatModificari(
        camposModificados,
        valoresAnteriores,
        valoresNuevos,
      );

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
}
