import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { sheetToJson } from '../utils/excel-helper';

type ManualBajaInput = {
  codigoEmpleado: string;
  fechaBaja: string; // YYYY-MM-DD
  fechaAlta?: string; // YYYY-MM-DD
  situacion?: string;
  tipo?: string;
  recaida?: boolean;
};

type BajasConflict = {
  codigoEmpleado: string;
  trabajador?: string;
  fechaBaja?: string | null;
  fechaAltaManual?: string | null;
  fechaAltaMutua?: string | null;
  manual: { idCaso: string; idPosicion: string };
  mutua: { idCaso: string; idPosicion: string };
};

type ConflictResolution = {
  action: 'keep_manual' | 'use_mutua' | 'merge';
  manualIdCaso: string;
  manualIdPosicion: string;
  mutuaIdCaso: string;
  mutuaIdPosicion: string;
};

@Injectable()
export class BajasMedicasService {
  private readonly logger = new Logger(BajasMedicasService.name);

  constructor(private readonly prisma: PrismaService) {}

  private parseISODateOnlyToUtc(value: string): Date | null {
    const s = String(value || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!y || !mo || !d) return null;
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return isNaN(dt.getTime()) ? null : dt;
  }

  private calculateInclusiveDays(
    fechaBajaISO: string,
    fechaAltaISO: string,
  ): number | null {
    const start = this.parseISODateOnlyToUtc(fechaBajaISO);
    const end = this.parseISODateOnlyToUtc(fechaAltaISO);
    if (!start || !end) return null;
    const diff =
      Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (!isFinite(diff) || diff < 1) return null;
    return diff;
  }

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

  private formatDbDateToISO(value: any): string | null {
    if (!value) return null;
    try {
      const d = value instanceof Date ? value : new Date(value);
      if (isNaN(d.getTime())) return null;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch {
      return null;
    }
  }

  private generateManualIdCaso(): string {
    // Numeric-ish unique ID (no leading zeros) to avoid collisions with Mutua ids.
    // Example: 1700000000000 + random 3 digits.
    const base = Date.now();
    const rnd = Math.floor(Math.random() * 900) + 100;
    return `${base}${rnd}`;
  }

  private normalizeCodigoEmpleado(codigo: string): string {
    return String(codigo || '').trim();
  }

  private async getEmpleadoSnapshotByCodigo(codigoEmpleado: string): Promise<{
    codigoEmpleado: string;
    nif: string | null;
    nass: string | null;
    nombre: string | null;
    empresa: string | null;
  }> {
    const codigo = this.normalizeCodigoEmpleado(codigoEmpleado);
    if (!codigo) {
      throw new BadRequestException('codigoEmpleado es obligatorio');
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        de.\`CODIGO\` as CODIGO,
        de.\`D.N.I. / NIE\` as NIF,
        de.\`SEG. SOCIAL\` as NASS,
        de.\`NOMBRE / APELLIDOS\` as NOMBRE,
        de.\`EMPRESA\` as EMPRESA,
        de.\`ESTADO\` as ESTADO,
        de.\`FECHA BAJA\` as FECHA_BAJA
      FROM \`DatosEmpleados\` de
      WHERE de.\`CODIGO\` = ${this.escapeSql(codigo)}
      ORDER BY (de.\`ESTADO\` = 'ACTIVO') DESC, de.\`FECHA BAJA\` IS NULL DESC
      LIMIT 1
    `);

    const row = rows?.[0] || null;
    return {
      codigoEmpleado: codigo,
      nif: row?.NIF ? String(row.NIF) : null,
      nass: row?.NASS ? String(row.NASS) : null,
      nombre: row?.NOMBRE ? String(row.NOMBRE) : null,
      empresa: row?.EMPRESA ? String(row.EMPRESA) : null,
    };
  }

  async createManualBaja(input: ManualBajaInput): Promise<{
    message: string;
    idCaso: string;
    idPosicion: string;
  }> {
    try {
      const codigoEmpleado = this.normalizeCodigoEmpleado(input.codigoEmpleado);
      if (!codigoEmpleado) {
        throw new BadRequestException('codigoEmpleado es obligatorio');
      }
      if (!input.fechaBaja) {
        throw new BadRequestException('fechaBaja es obligatoria (YYYY-MM-DD)');
      }

      const empleado = await this.getEmpleadoSnapshotByCodigo(codigoEmpleado);

      const idCaso = this.generateManualIdCaso();
      const idPosicion = '1';

      const fechaBajaSQL = this.parseExcelDate(input.fechaBaja);
      if (fechaBajaSQL === 'NULL') {
        throw new BadRequestException(
          'fechaBaja inválida. Usa YYYY-MM-DD (ej: 2026-01-07)',
        );
      }

      const fechaAltaSQL = input.fechaAlta
        ? this.parseExcelDate(input.fechaAlta)
        : 'NULL';

      // Only compute days if both dates are present and valid
      const diasBaja =
        input.fechaAlta && fechaAltaSQL !== 'NULL'
          ? this.calculateInclusiveDays(input.fechaBaja, input.fechaAlta)
          : null;
      if (input.fechaAlta && fechaAltaSQL !== 'NULL' && diasBaja === null) {
        throw new BadRequestException(
          'fechaAlta inválida (o anterior a fechaBaja). Usa YYYY-MM-DD (ej: 2026-01-10)',
        );
      }

      const situacion =
        input.situacion && input.situacion.trim() !== ''
          ? input.situacion.trim()
          : fechaAltaSQL !== 'NULL'
            ? 'Alta'
            : 'Baja';

      const query = `
        INSERT INTO \`MutuaCasos\` (
          \`Codigo_Empleado\`,
          \`NIF\`,
          \`NASS\`,
          \`Trabajador\`,
          \`Razón Social\`,
          \`Tipo\`,
          \`Recaída\`,
          \`Fecha baja\`,
          \`Fecha de alta\`,
          \`Días de baja\`,
          \`Situación\`,
          \`Id.Caso\`,
          \`Id.Posición\`,
          \`fuente\`,
          \`updated_at\`
        ) VALUES (
          ${this.escapeSql(empleado.codigoEmpleado)},
          ${this.escapeSql(empleado.nif || '')},
          ${this.escapeSql(empleado.nass || '')},
          ${this.escapeSql(empleado.nombre || '')},
          ${this.escapeSql(empleado.empresa || '')},
          ${this.escapeSql(input.tipo || 'Baja Médica')},
          ${input.recaida === undefined ? 'NULL' : input.recaida ? '1' : '0'},
          ${fechaBajaSQL},
          ${fechaAltaSQL},
          ${diasBaja === null ? 'NULL' : String(diasBaja)},
          ${this.escapeSql(situacion)},
          ${this.escapeSql(idCaso)},
          ${this.escapeSql(idPosicion)},
          'MANUAL',
          NOW()
        )
      `;

      await this.prisma.$executeRawUnsafe(query);

      return {
        message: 'Baja médica manual creada correctamente',
        idCaso,
        idPosicion,
      };
    } catch (error: any) {
      this.logger.error('❌ Error creating manual baja médica:', error);
      throw new BadRequestException(
        `Error al crear baja médica manual: ${error.message}`,
      );
    }
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
    conflicts: BajasConflict[];
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
      const conflicts: BajasConflict[] = [];
      const conflictsSeen = new Set<string>();

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

          // Detectează conflict: există deja un record MANUAL pentru același (Codigo_Empleado + Fecha baja)
          // și acum a venit recordul MUTUA (excel) cu alt (Id.Caso + Id.Posición).
          try {
            const conflictRows = await this.prisma.$queryRawUnsafe<any[]>(`
              SELECT
                m.\`Codigo_Empleado\` as codigoEmpleado,
                m.\`Trabajador\` as trabajador,
                m.\`Fecha baja\` as fechaBaja,
                m.\`Fecha de alta\` as fechaAltaMutua,
                man.\`Id.Caso\` as manualIdCaso,
                man.\`Id.Posición\` as manualIdPosicion,
                man.\`Fecha de alta\` as fechaAltaManual
              FROM \`MutuaCasos\` m
              LEFT JOIN \`MutuaCasos\` man
                ON man.\`fuente\` = 'MANUAL'
                AND man.\`Codigo_Empleado\` = m.\`Codigo_Empleado\`
                AND man.\`Fecha baja\` = m.\`Fecha baja\`
              WHERE m.\`Id.Caso\` = ${this.escapeSql(idCaso)}
                AND m.\`Id.Posición\` = ${this.escapeSql(idPosicion)}
              LIMIT 1
            `);

            const c = conflictRows?.[0];
            const manualIdCaso = c?.manualIdCaso ? String(c.manualIdCaso) : '';
            const manualIdPos = c?.manualIdPosicion
              ? String(c.manualIdPosicion)
              : '';

            if (manualIdCaso && manualIdPos) {
              // Evită să raportezi conflict dacă, din greșeală, e același record
              if (
                String(manualIdCaso) !== String(idCaso) ||
                String(manualIdPos) !== String(idPosicion)
              ) {
                const key = `${manualIdCaso}_${manualIdPos}__${idCaso}_${idPosicion}`;
                if (!conflictsSeen.has(key)) {
                  conflictsSeen.add(key);
                  conflicts.push({
                    codigoEmpleado: c?.codigoEmpleado
                      ? String(c.codigoEmpleado)
                      : '',
                    trabajador: c?.trabajador
                      ? String(c.trabajador)
                      : undefined,
                    fechaBaja: this.formatDbDateToISO(c?.fechaBaja),
                    fechaAltaManual: this.formatDbDateToISO(c?.fechaAltaManual),
                    fechaAltaMutua: this.formatDbDateToISO(c?.fechaAltaMutua),
                    manual: { idCaso: manualIdCaso, idPosicion: manualIdPos },
                    mutua: {
                      idCaso: String(idCaso),
                      idPosicion: String(idPosicion),
                    },
                  });
                }
              }
            }
          } catch (conflictError: any) {
            // Nu blocăm upload-ul dacă conflict detection eșuează
            this.logger.warn(
              `⚠️ Conflict detection failed for Id.Caso=${idCaso}, Id.Posición=${idPosicion}: ${conflictError.message}`,
            );
          }
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
        conflicts,
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

      // If dates change and both dates are present, recompute "Días de baja".
      // Otherwise keep existing value (important for MUTUA open cases which may already include a running day count).
      if (updates.fechaBaja !== undefined || updates.fechaAlta !== undefined) {
        updateFields.push(
          '`Días de baja` = CASE ' +
            'WHEN `Fecha baja` IS NOT NULL AND `Fecha de alta` IS NOT NULL ' +
            'THEN (DATEDIFF(`Fecha de alta`, `Fecha baja`) + 1) ' +
            'ELSE `Días de baja` END',
        );
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

  async resolveConflicts(resolutions: ConflictResolution[]): Promise<{
    resolved: number;
    updatedMutua: number;
    deletedManual: number;
  }> {
    let resolved = 0;
    let updatedMutua = 0;
    let deletedManual = 0;

    for (const r of resolutions || []) {
      const action = r?.action;
      const manualIdCaso = String(r?.manualIdCaso || '').trim();
      const manualIdPos = String(r?.manualIdPosicion || '').trim();
      const mutuaIdCaso = String(r?.mutuaIdCaso || '').trim();
      const mutuaIdPos = String(r?.mutuaIdPosicion || '').trim();

      if (
        !action ||
        !manualIdCaso ||
        !manualIdPos ||
        !mutuaIdCaso ||
        !mutuaIdPos
      ) {
        continue;
      }

      // Fetch dates (authoritative)
      const rows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          m.\`Fecha de alta\` as fechaAltaMutua,
          man.\`Fecha de alta\` as fechaAltaManual
        FROM \`MutuaCasos\` m
        LEFT JOIN \`MutuaCasos\` man
          ON man.\`Id.Caso\` = ${this.escapeSql(manualIdCaso)}
          AND man.\`Id.Posición\` = ${this.escapeSql(manualIdPos)}
        WHERE m.\`Id.Caso\` = ${this.escapeSql(mutuaIdCaso)}
          AND m.\`Id.Posición\` = ${this.escapeSql(mutuaIdPos)}
        LIMIT 1
      `);
      const row = rows?.[0] || {};
      const fechaAltaMutuaISO = this.formatDbDateToISO(row?.fechaAltaMutua);
      const fechaAltaManualISO = this.formatDbDateToISO(row?.fechaAltaManual);

      // Apply decision
      if (action === 'use_mutua') {
        // Keep MUTUA as-is; delete MANUAL duplicate
      } else if (action === 'keep_manual') {
        // Force MUTUA Fecha de alta = MANUAL (even if null), and set Situación accordingly
        const fechaAltaSQL =
          fechaAltaManualISO !== null
            ? this.escapeSql(fechaAltaManualISO)
            : 'NULL';
        const situacionSQL =
          fechaAltaManualISO !== null
            ? this.escapeSql('Alta')
            : this.escapeSql('Baja');

        const updateRes = await this.prisma.$executeRawUnsafe(`
          UPDATE \`MutuaCasos\`
          SET \`Fecha de alta\` = ${fechaAltaSQL},
              \`Situación\` = ${situacionSQL},
              \`updated_at\` = NOW()
          WHERE \`Id.Caso\` = ${this.escapeSql(mutuaIdCaso)}
            AND \`Id.Posición\` = ${this.escapeSql(mutuaIdPos)}
        `);
        if (Number(updateRes) > 0) updatedMutua++;
      } else if (action === 'merge') {
        // Default merge: if MUTUA has no Fecha de alta but MANUAL does, copy it to MUTUA
        if (!fechaAltaMutuaISO && fechaAltaManualISO) {
          const updateRes = await this.prisma.$executeRawUnsafe(`
            UPDATE \`MutuaCasos\`
            SET \`Fecha de alta\` = ${this.escapeSql(fechaAltaManualISO)},
                \`Situación\` = ${this.escapeSql('Alta')},
                \`updated_at\` = NOW()
            WHERE \`Id.Caso\` = ${this.escapeSql(mutuaIdCaso)}
              AND \`Id.Posición\` = ${this.escapeSql(mutuaIdPos)}
          `);
          if (Number(updateRes) > 0) updatedMutua++;
        }
      }

      // Always delete MANUAL duplicate after resolution
      const delRes = await this.prisma.$executeRawUnsafe(`
        DELETE FROM \`MutuaCasos\`
        WHERE \`Id.Caso\` = ${this.escapeSql(manualIdCaso)}
          AND \`Id.Posición\` = ${this.escapeSql(manualIdPos)}
          AND \`fuente\` = 'MANUAL'
      `);
      if (Number(delRes) > 0) deletedManual++;

      resolved++;
    }

    return { resolved, updatedMutua, deletedManual };
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
