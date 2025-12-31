import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { sheetToJson } from '../utils/excel-helper';

@Injectable()
export class BajasMedicasService {
  private readonly logger = new Logger(BajasMedicasService.name);

  constructor(private readonly prisma: PrismaService) {}

  private escapeSql(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    const str = String(value);
    const escaped = str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }

  async getBajasMedicas(codigo?: string): Promise<any[]> {
    try {
      let query = 'SELECT * FROM `MutuaCasos`';
      const conditions: string[] = [];

      if (codigo && codigo.trim() !== '') {
        conditions.push(
          `\`Codigo_Empleado\` = ${this.escapeSql(codigo.trim())}`,
        );
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ' ORDER BY `Fecha baja` DESC';

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(
        `✅ Bajas médicas retrieved: ${rows.length} records (codigo: ${codigo || 'all'})`,
      );

      return rows;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving bajas médicas:', error);
      throw new BadRequestException(
        `Error al obtener bajas médicas: ${error.message}`,
      );
    }
  }

  /**
   * Parsează date în format YYYY-MM-DD, MM/DD/YY sau MM/DD/YYYY către MySQL DATE
   */
  private parseExcelDate(dateStr: string | null | undefined): string {
    if (!dateStr || dateStr === '') return 'NULL';

    const str = String(dateStr).trim();

    // Format YYYY-MM-DD (ISO format - deja în format MySQL)
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);

      // Validează că datele sunt corecte
      if (
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= 31 &&
        year >= 1900 &&
        year <= 2100
      ) {
        const formatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return this.escapeSql(formatted);
      }
    }

    // Format MM/DD/YY sau MM/DD/YYYY
    const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (match) {
      const month = parseInt(match[1], 10);
      const day = parseInt(match[2], 10);
      let year = parseInt(match[3], 10);

      // Convert 2-digit year to 4-digit (assume 2000-2099)
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year;
      }

      // Format pentru MySQL DATE
      const formatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return this.escapeSql(formatted);
    }

    this.logger.warn(`⚠️ Date format neprevăzut: ${str}`);
    return 'NULL';
  }

  /**
   * Convertește "No"/"Si" către boolean SQL
   */
  private parseBoolean(value: string | null | undefined): string {
    if (!value) return 'NULL';
    const normalized = String(value).toLowerCase().trim();
    if (
      normalized === 'si' ||
      normalized === 'sí' ||
      normalized === 'yes' ||
      normalized === 'true' ||
      normalized === '1'
    ) {
      return '1';
    }
    if (normalized === 'no' || normalized === 'false' || normalized === '0') {
      return '0';
    }
    return 'NULL';
  }

  /**
   * Parsează număr din string (returnează NULL dacă nu e valid)
   */
  private parseNumber(value: string | null | undefined): string {
    if (!value || value === '') return 'NULL';
    const num = parseFloat(String(value));
    if (isNaN(num)) return 'NULL';
    return String(num);
  }

  /**
   * Upload și procesare Excel cu bajas médicas
   */
  async uploadBajasMedicas(fileBuffer: Buffer): Promise<{
    success: true;
    processed: number;
    inserted: number;
    updated: number;
    errors: number;
  }> {
    try {
      // Citește Excel-ul
      const workbook = new ExcelJS.Workbook();
      // exceljs acceptă Buffer, dar TypeScript are probleme cu tipurile
      // Folosim type assertion pentru a rezolva incompatibilitatea de tipuri
      await workbook.xlsx.load(fileBuffer as any);

      // Găsește sheet-ul "Común"
      const sheetName =
        workbook.worksheets.find(
          (sheet) =>
            sheet.name.toLowerCase().includes('común') ||
            sheet.name.toLowerCase().includes('comun'),
        )?.name || workbook.worksheets[0]?.name;

      if (!sheetName) {
        throw new BadRequestException('Nu s-a găsit niciun sheet în Excel');
      }

      this.logger.log(`📄 Procesez sheet: "${sheetName}"`);

      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        throw new BadRequestException(`Sheet "${sheetName}" nu a fost găsit`);
      }

      const rows = sheetToJson(worksheet, {
        raw: false,
        defval: '',
      });

      if (rows.length === 0) {
        throw new BadRequestException('Excel-ul nu conține date');
      }

      this.logger.log(`📊 Rânduri găsite în Excel: ${rows.length}`);

      let processed = 0;
      let inserted = 0;
      let updated = 0;
      let errors = 0;

      // Procesează fiecare rând
      for (const row of rows as any[]) {
        try {
          // Normalizează Id.Caso și Id.Posición (elimină zerouri leading și spații)
          const idCaso =
            String(row['Id.Caso'] || '')
              .trim()
              .replace(/^0+/, '') || '0';
          const idPosicion =
            String(row['Id.Posición'] || row['Id.Posicion'] || '')
              .trim()
              .replace(/^0+/, '') || '0';

          // Verifică dacă există "Fecha de alta" pentru a seta "Situación" = "Alta"
          const fechaAltaParsed = this.parseExcelDate(row['Fecha de alta']);
          const tieneFechaAlta = fechaAltaParsed !== 'NULL';
          const situacionValue = tieneFechaAlta
            ? this.escapeSql('Alta')
            : this.escapeSql(row.Situación || '');

          // Construiește query-ul INSERT cu lookup Codigo_Empleado
          const query = `
            INSERT INTO \`MutuaCasos\` (
              \`NIF\`, \`NASS\`, \`Trabajador\`, \`Régimen\`, \`CIF\`, \`CCC\`, \`Razón Social\`, \`Tipo\`,
              \`Recaída\`, \`Fecha baja\`, \`Fecha de alta prevista SPS\`, \`Fecha de alta\`,
              \`Días de baja\`, \`Días previstos Servicio Público de Salud\`,
              \`Fecha inicio subrogación\`,
              \`Jornadas perdidas desde la subrogación\`, \`Jornadas perdidas fijos discontinuos\`,
              \`Situación\`, \`Inicio pago delegado\`, \`Fin pago delegado\`,
              \`Pendiente validación INSS\`, \`Última gestión Mutua\`, \`Próxima gestión Mutua\`,
              \`Demora recepción del parte de baja\`, \`Último Parte de Confirmación\`,
              \`Código Nacional de Ocupación\`, \`Id.Caso\`, \`Id.Posición\`,
              \`Codigo_Empleado\`, \`fuente\`, \`updated_at\`
            )
            VALUES (
              ${this.escapeSql(row.NIF || '')},
              ${this.escapeSql(row.NASS || '')},
              ${this.escapeSql(row.Trabajador || '')},
              ${this.escapeSql(row.Régimen || '')},
              ${this.escapeSql(row.CIF || '')},
              ${this.escapeSql(row.CCC || '')},
              ${this.escapeSql(row['Razón Social'] || '')},
              ${this.escapeSql(row.Tipo || '')},
              ${this.parseBoolean(row.Recaída)},
              ${this.parseExcelDate(row['Fecha baja'])},
              ${this.parseExcelDate(row['Fecha de alta prevista SPS'])},
              ${fechaAltaParsed},
              ${this.parseNumber(row['Días de baja'])},
              ${this.parseNumber(row['Días previstos Servicio Público de Salud'])},
              ${this.parseExcelDate(row['Fecha inicio subrogación'])},
              ${this.parseNumber(row['Jornadas perdidas desde la subrogación'])},
              ${this.parseNumber(row['Jornadas perdidas fijos discontinuos'])},
              ${situacionValue},
              ${this.parseExcelDate(row['Inicio pago delegado'])},
              ${this.parseExcelDate(row['Fin pago delegado'])},
              ${this.parseBoolean(row['Pendiente validación INSS'])},
              ${this.parseExcelDate(row['Última gestión Mutua'])},
              ${this.parseExcelDate(row['Próxima gestión Mutua'])},
              ${this.parseNumber(row['Demora recepción del parte de baja'])},
              ${this.parseExcelDate(row['Último Parte de Confirmación'])},
              ${this.escapeSql(row['Código Nacional de Ocupación'] || '')},
              ${this.escapeSql(idCaso)},
              ${this.escapeSql(idPosicion)},
              (
                SELECT de.\`CODIGO\`
                FROM \`DatosEmpleados\` de
                WHERE
                  (
                    ${this.escapeSql(row.NIF || '')} <> '' AND
                    REPLACE(REPLACE(UPPER(de.\`D.N.I. / NIE\`),' ',''),'-','') =
                    REPLACE(REPLACE(UPPER(${this.escapeSql(row.NIF || '')}),' ',''),'-','')
                  )
                  OR
                  (
                    ${this.escapeSql(row.NASS || '')} <> '' AND
                    REPLACE(REPLACE(de.\`SEG. SOCIAL\`,' ',''),'-','') =
                    REPLACE(REPLACE(${this.escapeSql(row.NASS || '')},' ',''),'-','')
                  )
                  OR
                  (
                    ${this.escapeSql(row.Trabajador || '')} <> '' AND
                    UPPER(TRIM(de.\`NOMBRE / APELLIDOS\`)) = UPPER(TRIM(${this.escapeSql(row.Trabajador || '')}))
                  )
                  AND (
                    ${this.escapeSql(row['Razón Social'] || '')} = '' OR
                    UPPER(TRIM(de.\`EMPRESA\`)) = UPPER(TRIM(${this.escapeSql(row['Razón Social'] || '')}))
                  )
                ORDER BY (de.\`ESTADO\` = 'ACTIVO') DESC, de.\`FECHA BAJA\` IS NULL DESC
                LIMIT 1
              ),
              'MUTUA',
              NOW()
            )
            ON DUPLICATE KEY UPDATE
              \`NIF\`=VALUES(\`NIF\`), \`NASS\`=VALUES(\`NASS\`), \`Trabajador\`=VALUES(\`Trabajador\`),
              \`Régimen\`=VALUES(\`Régimen\`), \`CIF\`=VALUES(\`CIF\`), \`CCC\`=VALUES(\`CCC\`),
              \`Razón Social\`=VALUES(\`Razón Social\`), \`Tipo\`=VALUES(\`Tipo\`), \`Recaída\`=VALUES(\`Recaída\`),
              \`Fecha baja\`=VALUES(\`Fecha baja\`), \`Fecha de alta prevista SPS\`=VALUES(\`Fecha de alta prevista SPS\`),
              \`Fecha de alta\`=COALESCE(VALUES(\`Fecha de alta\`), \`Fecha de alta\`), \`Días de baja\`=VALUES(\`Días de baja\`),
              \`Días previstos Servicio Público de Salud\`=VALUES(\`Días previstos Servicio Público de Salud\`),
              \`Fecha inicio subrogación\`=VALUES(\`Fecha inicio subrogación\`),
              \`Jornadas perdidas desde la subrogación\`=VALUES(\`Jornadas perdidas desde la subrogación\`),
              \`Jornadas perdidas fijos discontinuos\`=VALUES(\`Jornadas perdidas fijos discontinuos\`),
              \`Situación\`=CASE 
                WHEN COALESCE(VALUES(\`Fecha de alta\`), \`Fecha de alta\`) IS NOT NULL THEN 'Alta'
                ELSE COALESCE(VALUES(\`Situación\`), \`Situación\`)
              END, \`Inicio pago delegado\`=VALUES(\`Inicio pago delegado\`),
              \`Fin pago delegado\`=VALUES(\`Fin pago delegado\`), \`Pendiente validación INSS\`=VALUES(\`Pendiente validación INSS\`),
              \`Última gestión Mutua\`=VALUES(\`Última gestión Mutua\`), \`Próxima gestión Mutua\`=VALUES(\`Próxima gestión Mutua\`),
              \`Demora recepción del parte de baja\`=VALUES(\`Demora recepción del parte de baja\`),
              \`Último Parte de Confirmación\`=VALUES(\`Último Parte de Confirmación\`),
              \`Código Nacional de Ocupación\`=VALUES(\`Código Nacional de Ocupación\`),
              \`Codigo_Empleado\`=VALUES(\`Codigo_Empleado\`),
              \`fuente\`=VALUES(\`fuente\`), \`updated_at\`=NOW();
          `;

          const result = await this.prisma.$executeRawUnsafe(query);

          // Verifică dacă a fost INSERT sau UPDATE (prin ON DUPLICATE KEY UPDATE)
          // MySQL returnează: 1 pentru INSERT, 2 pentru UPDATE, 0 dacă nu s-a schimbat nimic
          // Prisma $executeRawUnsafe returnează numărul direct, nu un obiect cu affectedRows
          const affectedRows = Number(result) || 0;
          if (affectedRows === 1) {
            inserted++;
          } else if (affectedRows === 2) {
            updated++;
          } else if (affectedRows > 0) {
            // Fallback: dacă e > 0 dar nu 1 sau 2, considerăm că s-a actualizat
            updated++;
          }

          processed++;
        } catch (rowError: any) {
          errors++;
          this.logger.warn(
            `⚠️ Eroare la procesarea rândului ${processed + 1}: ${rowError.message}`,
          );
        }
      }

      this.logger.log(
        `✅ Upload complet: ${processed} procesate, ${inserted} inserate, ${updated} actualizate, ${errors} erori`,
      );

      return {
        success: true,
        processed,
        inserted,
        updated,
        errors,
      };
    } catch (error: any) {
      this.logger.error('❌ Error uploading bajas médicas:', error);
      throw new BadRequestException(
        `Error al cargar bajas médicas: ${error.message}`,
      );
    }
  }

  /**
   * Actualizează Fecha baja sau Fecha de alta pentru un caz de baja médica
   */
  async updateBajaMedica(
    idCaso: string,
    idPosicion: string,
    updates: { fechaBaja?: string; fechaAlta?: string; situacion?: string },
  ): Promise<any> {
    try {
      if (!idCaso || !idPosicion) {
        throw new BadRequestException(
          'Id.Caso și Id.Posición sunt obligatorii',
        );
      }

      const updateFields: string[] = [];

      if (updates.fechaBaja !== undefined) {
        const fechaBajaSQL = this.parseExcelDate(updates.fechaBaja);
        updateFields.push('`Fecha baja` = ' + fechaBajaSQL);
      }

      if (updates.fechaAlta !== undefined) {
        const fechaAltaSQL = this.parseExcelDate(updates.fechaAlta);
        updateFields.push('`Fecha de alta` = ' + fechaAltaSQL);

        // Dacă se setează "Fecha de alta" (nu este NULL), setăm automat "Situación" = "Alta"
        if (fechaAltaSQL !== 'NULL') {
          updateFields.push('`Situación` = ' + this.escapeSql('Alta'));
        }
      }

      if (updates.situacion !== undefined) {
        updateFields.push(
          '`Situación` = ' + this.escapeSql(updates.situacion || ''),
        );
      }

      if (updateFields.length === 0) {
        throw new BadRequestException(
          'Nu s-au specificat câmpuri pentru actualizare',
        );
      }

      // Adaugă updated_at
      updateFields.push('`updated_at` = NOW()');

      const query = `
        UPDATE \`MutuaCasos\`
        SET ${updateFields.join(', ')}
        WHERE \`Id.Caso\` = ${this.escapeSql(idCaso)}
          AND \`Id.Posición\` = ${this.escapeSql(idPosicion)}
      `;

      const result = await this.prisma.$executeRawUnsafe(query);
      const affectedRows = Number(result) || 0;

      if (affectedRows === 0) {
        throw new BadRequestException(
          `Nu s-a găsit cazul cu Id.Caso=${idCaso} și Id.Posición=${idPosicion}`,
        );
      }

      this.logger.log(
        `✅ Baja médica actualizată: Id.Caso=${idCaso}, Id.Posición=${idPosicion}, affectedRows=${affectedRows}`,
      );

      return {
        success: true,
        message: 'Baja médica actualizată cu succes',
        affectedRows,
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating baja médica:', error);
      throw new BadRequestException(
        `Error al actualizar baja médica: ${error.message}`,
      );
    }
  }

  /**
   * Actualizează automat "Situación" = "Alta" pentru toate cazurile care au "Fecha de alta" dar "Situación" nu este "Alta"
   */
  async fixSituacionForFechaAlta(): Promise<{
    success: true;
    updated: number;
  }> {
    try {
      const query = `
        UPDATE \`MutuaCasos\`
        SET \`Situación\` = 'Alta',
            \`updated_at\` = NOW()
        WHERE \`Fecha de alta\` IS NOT NULL
          AND \`Fecha de alta\` != ''
          AND (\`Situación\` IS NULL OR \`Situación\` != 'Alta')
      `;

      const result = await this.prisma.$executeRawUnsafe(query);
      const affectedRows = Number(result) || 0;

      this.logger.log(
        `✅ Actualizat "Situación" = "Alta" pentru ${affectedRows} cazuri cu "Fecha de alta"`,
      );

      return {
        success: true,
        updated: affectedRows,
      };
    } catch (error: any) {
      this.logger.error('❌ Error fixing Situación for Fecha de alta:', error);
      throw new BadRequestException(
        `Error al actualizar Situación: ${error.message}`,
      );
    }
  }
}
