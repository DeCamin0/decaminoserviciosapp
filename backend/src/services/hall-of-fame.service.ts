import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HallOfFameService {
  private readonly logger = new Logger(HallOfFameService.name);

  /**
   * Convertește BigInt-urile și Decimal-urile în Number pentru serializare JSON
   */
  private convertBigIntToNumber(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (typeof obj === 'bigint') {
      return Number(obj);
    }
    // Prisma Decimal objects - verifică dacă este un obiect Decimal
    if (obj && typeof obj === 'object') {
      // Verifică dacă are metoda toNumber() (Prisma Decimal)
      if ('toNumber' in obj && typeof obj.toNumber === 'function') {
        try {
          return obj.toNumber();
        } catch {
          // Fallback la toString() dacă toNumber() eșuează
        }
      }
      // Verifică dacă este un obiect Decimal prin constructor name
      if (obj.constructor && obj.constructor.name === 'Decimal') {
        try {
          return Number(obj.toString());
        } catch {
          // Fallback
        }
      }
      // Verifică dacă are proprietatea _value (unele implementări de Decimal)
      if ('_value' in obj) {
        return Number(obj._value);
      }
      // Verifică dacă poate fi convertit direct la Number
      if ('toString' in obj && typeof obj.toString === 'function') {
        const str = obj.toString();
        const num = parseFloat(str);
        if (!isNaN(num) && isFinite(num)) {
          return num;
        }
      }
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.convertBigIntToNumber(item));
    }
    if (typeof obj === 'object') {
      const converted: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          converted[key] = this.convertBigIntToNumber(obj[key]);
        }
      }
      return converted;
    }
    return obj;
  }

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculează și salvează scorul pentru un singur angajat
   */
  async debugCuadranteCalculation(codigo: string, mes: string): Promise<any> {
    if (!codigo || !mes) {
      throw new BadRequestException('codigo and mes are required');
    }

    const mesRegex = /^\d{4}-\d{2}$/;
    if (!mesRegex.test(mes)) {
      throw new BadRequestException('mes must be in format YYYY-MM');
    }

    try {
      // SET variables
      await this.prisma.$executeRawUnsafe(`SET @lunaselectata = '${mes}';`);
      await this.prisma.$executeRawUnsafe(`SET @ccaa_default = 'ES-MD';`);
      await this.prisma.$executeRawUnsafe(
        `SET @d_first := STR_TO_DATE(CONCAT('${mes}','-01'), '%Y-%m-%d');`,
      );
      await this.prisma.$executeRawUnsafe(`SET @d_last := LAST_DAY(@d_first);`);
      await this.prisma.$executeRawUnsafe(`SET @d_today := CURDATE();`);

      const debugQuery = `
WITH cuadrante_unpivot AS (
  SELECT CAST(cq.CODIGO AS CHAR) AS empleadoId, 1 AS dia, cq.CENTRO AS centro_cuadrante, cq.ZI_1 AS val FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 2, cq.CENTRO, cq.ZI_2 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 3, cq.CENTRO, cq.ZI_3 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 4, cq.CENTRO, cq.ZI_4 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 5, cq.CENTRO, cq.ZI_5 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 6, cq.CENTRO, cq.ZI_6 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 7, cq.CENTRO, cq.ZI_7 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 8, cq.CENTRO, cq.ZI_8 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 9, cq.CENTRO, cq.ZI_9 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 10, cq.CENTRO, cq.ZI_10 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 11, cq.CENTRO, cq.ZI_11 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 12, cq.CENTRO, cq.ZI_12 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 13, cq.CENTRO, cq.ZI_13 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 14, cq.CENTRO, cq.ZI_14 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 15, cq.CENTRO, cq.ZI_15 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 16, cq.CENTRO, cq.ZI_16 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 17, cq.CENTRO, cq.ZI_17 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 18, cq.CENTRO, cq.ZI_18 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 19, cq.CENTRO, cq.ZI_19 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 20, cq.CENTRO, cq.ZI_20 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 21, cq.CENTRO, cq.ZI_21 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 22, cq.CENTRO, cq.ZI_22 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 23, cq.CENTRO, cq.ZI_23 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 24, cq.CENTRO, cq.ZI_24 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 25, cq.CENTRO, cq.ZI_25 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 26, cq.CENTRO, cq.ZI_26 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 27, cq.CENTRO, cq.ZI_27 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 28, cq.CENTRO, cq.ZI_28 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 29, cq.CENTRO, cq.ZI_29 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 30, cq.CENTRO, cq.ZI_30 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 31, cq.CENTRO, cq.ZI_31 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
),
cuadrante_dia_debug AS (
  SELECT
    cu.empleadoId,
    cu.dia,
    cu.val AS val_original,
    TRIM(cu.val) AS val_trimmed,
    CASE WHEN cu.val IS NOT NULL AND TRIM(cu.val) <> '' THEN 1 ELSE 0 END AS tiene_cuadrante,
    CASE 
      WHEN UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 'LIBRE'
      WHEN TRIM(cu.val) LIKE '%:%-%:%' THEN 'INTERVAL'
      WHEN TRIM(cu.val) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+×[0-9]+h\\)' THEN 'FORMAT_24H'
      WHEN TRIM(cu.val) REGEXP '^[0-9]+h' THEN 'FORMAT_H'
      ELSE 'UNKNOWN'
    END AS format_type,
    ROUND(
      CASE 
        WHEN UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
        WHEN TRIM(cu.val) LIKE '%:%-%:%' THEN 
          (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-',-1),' ',1), '%H:%i'))
                                           - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-', 1),' ',1), '%H:%i'))
                                           + 86400) % 86400) / 3600)
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+×[0-9]+h\\)' THEN 
          CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val), '×', -1), 'h', 1) AS DECIMAL(10,2))
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h' THEN 
          CAST(SUBSTRING_INDEX(TRIM(cu.val), 'h', 1) AS DECIMAL(10,2))
        ELSE 0
      END
    ,2) AS horas_calculated
  FROM cuadrante_unpivot cu
),
cuadrante_sum_debug AS (
  SELECT
    empleadoId,
    COUNT(*) AS total_zile,
    SUM(CASE WHEN tiene_cuadrante = 1 THEN 1 ELSE 0 END) AS zile_cu_cuadrante,
    SUM(CASE WHEN format_type = 'LIBRE' THEN 1 ELSE 0 END) AS zile_libre,
    SUM(CASE WHEN format_type = 'INTERVAL' THEN 1 ELSE 0 END) AS zile_interval,
    SUM(horas_calculated) AS horas_cuadrante_mes_raw,
    ROUND(SUM(horas_calculated), 2) AS horas_cuadrante_mes
  FROM cuadrante_dia_debug
  GROUP BY empleadoId
)
SELECT 
  cdd.dia,
  cdd.val_original,
  cdd.val_trimmed,
  cdd.format_type,
  cdd.horas_calculated,
  csd.total_zile,
  csd.zile_cu_cuadrante,
  csd.zile_libre,
  csd.zile_interval,
  csd.horas_cuadrante_mes
FROM cuadrante_dia_debug cdd
CROSS JOIN cuadrante_sum_debug csd
WHERE cdd.empleadoId = csd.empleadoId
ORDER BY cdd.dia;
`;

      const results = await this.prisma.$queryRawUnsafe<any[]>(debugQuery);

      this.logger.log(`🔍 DEBUG CUADRANTE para ${codigo} - ${mes}:`);
      this.logger.log(
        `Total días: ${this.convertBigIntToNumber(results[0]?.total_zile) || 0}`,
      );
      this.logger.log(
        `Días con cuadrante: ${this.convertBigIntToNumber(results[0]?.zile_cu_cuadrante) || 0}`,
      );
      this.logger.log(
        `Días LIBRE: ${this.convertBigIntToNumber(results[0]?.zile_libre) || 0}`,
      );
      this.logger.log(
        `Días con intervalo: ${this.convertBigIntToNumber(results[0]?.zile_interval) || 0}`,
      );
      this.logger.log(
        `Horas cuadrante mes: ${this.convertBigIntToNumber(results[0]?.horas_cuadrante_mes) || 0}`,
      );

      for (const row of results) {
        if (row.horas_calculated > 0 || row.val_original) {
          this.logger.log(
            `  Día ${this.convertBigIntToNumber(row.dia)}: "${row.val_original}" (${row.format_type}) = ${this.convertBigIntToNumber(row.horas_calculated)}h`,
          );
        }
      }

      // Debug target_initial
      const targetDebugQuery = `
WITH cuadrante_unpivot AS (
  SELECT CAST(cq.CODIGO AS CHAR) AS empleadoId, 1 AS dia, cq.CENTRO AS centro_cuadrante, cq.ZI_1 AS val FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 2, cq.CENTRO, cq.ZI_2 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 3, cq.CENTRO, cq.ZI_3 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 4, cq.CENTRO, cq.ZI_4 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 5, cq.CENTRO, cq.ZI_5 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 6, cq.CENTRO, cq.ZI_6 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 7, cq.CENTRO, cq.ZI_7 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 8, cq.CENTRO, cq.ZI_8 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 9, cq.CENTRO, cq.ZI_9 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 10, cq.CENTRO, cq.ZI_10 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 11, cq.CENTRO, cq.ZI_11 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 12, cq.CENTRO, cq.ZI_12 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 13, cq.CENTRO, cq.ZI_13 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 14, cq.CENTRO, cq.ZI_14 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 15, cq.CENTRO, cq.ZI_15 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 16, cq.CENTRO, cq.ZI_16 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 17, cq.CENTRO, cq.ZI_17 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 18, cq.CENTRO, cq.ZI_18 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 19, cq.CENTRO, cq.ZI_19 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 20, cq.CENTRO, cq.ZI_20 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 21, cq.CENTRO, cq.ZI_21 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 22, cq.CENTRO, cq.ZI_22 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 23, cq.CENTRO, cq.ZI_23 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 24, cq.CENTRO, cq.ZI_24 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 25, cq.CENTRO, cq.ZI_25 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 26, cq.CENTRO, cq.ZI_26 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 27, cq.CENTRO, cq.ZI_27 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 28, cq.CENTRO, cq.ZI_28 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 29, cq.CENTRO, cq.ZI_29 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 30, cq.CENTRO, cq.ZI_30 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 31, cq.CENTRO, cq.ZI_31 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
),
cuadrante_sum AS (
  SELECT
    cu.empleadoId,
    MAX(cu.centro_cuadrante) AS centro_cuadrante,
    ROUND(SUM(
      CASE 
        WHEN UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
        WHEN TRIM(cu.val) LIKE '%:%-%:%' THEN (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-',-1),' ',1), '%H:%i'))
                                          - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-', 1),' ',1), '%H:%i'))
                                          + 86400) % 86400) / 3600)
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+×[0-9]+h\\)' THEN 
          CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val), '×', -1), 'h', 1) AS DECIMAL(10,2))
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h' THEN 
          CAST(SUBSTRING_INDEX(TRIM(cu.val), 'h', 1) AS DECIMAL(10,2))
        ELSE 0
      END
    ),2) AS horas_cuadrante_mes
  FROM cuadrante_unpivot cu
  GROUP BY cu.empleadoId
)
SELECT 
  cs.empleadoId,
  cs.horas_cuadrante_mes,
  CAST(de.CODIGO AS CHAR) AS codigo_empleado,
  CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) AS horas_contrato
FROM cuadrante_sum cs
LEFT JOIN DatosEmpleados de ON BINARY cs.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
WHERE cs.empleadoId = '${codigo}';
`;

      const targetResults =
        await this.prisma.$queryRawUnsafe<any[]>(targetDebugQuery);

      this.logger.log(`🔍 DEBUG TARGET_INITIAL para ${codigo}:`);
      this.logger.log(
        `cuadrante_sum.horas_cuadrante_mes: ${this.convertBigIntToNumber(targetResults[0]?.horas_cuadrante_mes) || 'NULL'}`,
      );
      this.logger.log(
        `horas_contrato: ${this.convertBigIntToNumber(targetResults[0]?.horas_contrato) || 'NULL'}`,
      );

      // Debug query principal - verifică ce primește target_initial
      // Folosim același cuadrante_unpivot și cuadrante_sum ca în query-ul principal
      const targetInitialDebugQuery = `
WITH cuadrante_unpivot AS (
  SELECT CAST(cq.CODIGO AS CHAR) AS empleadoId, 1 AS dia, cq.CENTRO AS centro_cuadrante, cq.ZI_1 AS val FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 2, cq.CENTRO, cq.ZI_2 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 3, cq.CENTRO, cq.ZI_3 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 4, cq.CENTRO, cq.ZI_4 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 5, cq.CENTRO, cq.ZI_5 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 6, cq.CENTRO, cq.ZI_6 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 7, cq.CENTRO, cq.ZI_7 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 8, cq.CENTRO, cq.ZI_8 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 9, cq.CENTRO, cq.ZI_9 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 10, cq.CENTRO, cq.ZI_10 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 11, cq.CENTRO, cq.ZI_11 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 12, cq.CENTRO, cq.ZI_12 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 13, cq.CENTRO, cq.ZI_13 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 14, cq.CENTRO, cq.ZI_14 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 15, cq.CENTRO, cq.ZI_15 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 16, cq.CENTRO, cq.ZI_16 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 17, cq.CENTRO, cq.ZI_17 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 18, cq.CENTRO, cq.ZI_18 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 19, cq.CENTRO, cq.ZI_19 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 20, cq.CENTRO, cq.ZI_20 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 21, cq.CENTRO, cq.ZI_21 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 22, cq.CENTRO, cq.ZI_22 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 23, cq.CENTRO, cq.ZI_23 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 24, cq.CENTRO, cq.ZI_24 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 25, cq.CENTRO, cq.ZI_25 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 26, cq.CENTRO, cq.ZI_26 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 27, cq.CENTRO, cq.ZI_27 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 28, cq.CENTRO, cq.ZI_28 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 29, cq.CENTRO, cq.ZI_29 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 30, cq.CENTRO, cq.ZI_30 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 31, cq.CENTRO, cq.ZI_31 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
),
cuadrante_sum AS (
  SELECT
    cu.empleadoId,
    MAX(cu.centro_cuadrante) AS centro_cuadrante,
    ROUND(SUM(
      CASE 
        WHEN UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
        WHEN TRIM(cu.val) LIKE '%:%-%:%' THEN (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-',-1),' ',1), '%H:%i'))
                                          - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-', 1),' ',1), '%H:%i'))
                                          + 86400) % 86400) / 3600)
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+×[0-9]+h\\)' THEN 
          CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val), '×', -1), 'h', 1) AS DECIMAL(10,2))
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h' THEN 
          CAST(SUBSTRING_INDEX(TRIM(cu.val), 'h', 1) AS DECIMAL(10,2))
        ELSE 0
      END
    ),2) AS horas_cuadrante_mes
  FROM cuadrante_unpivot cu
  GROUP BY cu.empleadoId
)
SELECT 
  CAST(de.CODIGO AS CHAR) AS empleadoId,
  cs.horas_cuadrante_mes AS cs_horas,
  CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) AS horas_contrato,
  ROUND(CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) * (DAY(@d_last) / 7), 2) AS horas_contrato_mes,
  COALESCE(
    cs.horas_cuadrante_mes,
    ROUND(CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) * (DAY(@d_last) / 7), 2),
    0
  ) AS target_initial
FROM DatosEmpleados de
LEFT JOIN cuadrante_sum cs ON BINARY cs.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
WHERE de.ESTADO = 'ACTIVO'
  AND CAST(de.CODIGO AS CHAR) = '${codigo}';
`;

      const mainTargetResults = await this.prisma.$queryRawUnsafe<any[]>(
        targetInitialDebugQuery,
      );

      this.logger.log(`🔍 DEBUG TARGET_INITIAL din query principal:`);
      this.logger.log(
        `cs.horas_cuadrante_mes: ${this.convertBigIntToNumber(mainTargetResults[0]?.cs_horas) || 'NULL'}`,
      );
      this.logger.log(
        `horas_contrato: ${this.convertBigIntToNumber(mainTargetResults[0]?.horas_contrato) || 'NULL'}`,
      );
      this.logger.log(
        `horas_contrato_mes: ${this.convertBigIntToNumber(mainTargetResults[0]?.horas_contrato_mes) || 'NULL'}`,
      );
      this.logger.log(
        `target_initial FINAL: ${this.convertBigIntToNumber(mainTargetResults[0]?.target_initial) || 'NULL'}`,
      );

      // Verifică dacă există cuadrante duplicate
      const duplicateCheckQuery = `
SELECT 
  CODIGO,
  LUNA,
  COUNT(*) AS cnt
FROM cuadrante
WHERE CAST(CODIGO AS CHAR) = '${codigo}'
  AND LUNA = @lunaselectata
GROUP BY CODIGO, LUNA;
`;

      const duplicateResults =
        await this.prisma.$queryRawUnsafe<any[]>(duplicateCheckQuery);
      this.logger.log(`🔍 DEBUG CUADRANTE DUPLICATE para ${codigo}:`);
      this.logger.log(
        `Número cuadrantes para ${codigo} en ${mes}: ${this.convertBigIntToNumber(duplicateResults[0]?.cnt) || 0}`,
      );

      // Debug cuadrante_sum din query-ul principal
      const cuadranteSumDebugQuery = `
WITH cuadrante_unpivot AS (
  SELECT CAST(cq.CODIGO AS CHAR) AS empleadoId, 1 AS dia, cq.CENTRO AS centro_cuadrante, cq.ZI_1 AS val FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 2, cq.CENTRO, cq.ZI_2 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 3, cq.CENTRO, cq.ZI_3 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 4, cq.CENTRO, cq.ZI_4 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 5, cq.CENTRO, cq.ZI_5 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 6, cq.CENTRO, cq.ZI_6 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 7, cq.CENTRO, cq.ZI_7 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 8, cq.CENTRO, cq.ZI_8 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 9, cq.CENTRO, cq.ZI_9 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 10, cq.CENTRO, cq.ZI_10 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 11, cq.CENTRO, cq.ZI_11 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 12, cq.CENTRO, cq.ZI_12 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 13, cq.CENTRO, cq.ZI_13 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 14, cq.CENTRO, cq.ZI_14 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 15, cq.CENTRO, cq.ZI_15 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 16, cq.CENTRO, cq.ZI_16 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 17, cq.CENTRO, cq.ZI_17 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 18, cq.CENTRO, cq.ZI_18 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 19, cq.CENTRO, cq.ZI_19 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 20, cq.CENTRO, cq.ZI_20 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 21, cq.CENTRO, cq.ZI_21 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 22, cq.CENTRO, cq.ZI_22 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 23, cq.CENTRO, cq.ZI_23 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 24, cq.CENTRO, cq.ZI_24 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 25, cq.CENTRO, cq.ZI_25 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 26, cq.CENTRO, cq.ZI_26 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 27, cq.CENTRO, cq.ZI_27 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 28, cq.CENTRO, cq.ZI_28 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 29, cq.CENTRO, cq.ZI_29 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 30, cq.CENTRO, cq.ZI_30 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 31, cq.CENTRO, cq.ZI_31 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
),
cuadrante_sum AS (
  SELECT
    cu.empleadoId,
    MAX(cu.centro_cuadrante) AS centro_cuadrante,
    ROUND(SUM(
      CASE 
        WHEN UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
        WHEN TRIM(cu.val) LIKE '%:%-%:%' THEN (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-',-1),' ',1), '%H:%i'))
                                          - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-', 1),' ',1), '%H:%i'))
                                          + 86400) % 86400) / 3600)
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+×[0-9]+h\\)' THEN 
          CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val), '×', -1), 'h', 1) AS DECIMAL(10,2))
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h' THEN 
          CAST(SUBSTRING_INDEX(TRIM(cu.val), 'h', 1) AS DECIMAL(10,2))
        ELSE 0
      END
    ),2) AS horas_cuadrante_mes
  FROM cuadrante_unpivot cu
  GROUP BY cu.empleadoId
)
SELECT 
  cs.empleadoId,
  cs.horas_cuadrante_mes,
  CAST(de.CODIGO AS CHAR) AS codigo_empleado,
  CASE WHEN BINARY cs.empleadoId = BINARY CAST(de.CODIGO AS CHAR) THEN 'MATCH' ELSE 'NO_MATCH' END AS join_match
FROM cuadrante_sum cs
LEFT JOIN DatosEmpleados de ON BINARY cs.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
WHERE cs.empleadoId = '${codigo}' OR CAST(de.CODIGO AS CHAR) = '${codigo}'
LIMIT 10;
      `;

      const cuadranteSumDebug = await this.prisma.$queryRawUnsafe<any[]>(
        cuadranteSumDebugQuery,
      );
      this.logger.log(
        `🔍 DEBUG CUADRANTE_SUM din query principal pentru ${codigo}:`,
      );
      if (cuadranteSumDebug && cuadranteSumDebug.length > 0) {
        for (const row of cuadranteSumDebug) {
          this.logger.log(
            `  empleadoId: ${row.empleadoId}, horas_cuadrante_mes: ${this.convertBigIntToNumber(row.horas_cuadrante_mes) || 'NULL'}, codigo_empleado: ${row.codigo_empleado || 'NULL'}, join_match: ${row.join_match || 'NULL'}`,
          );
        }
      } else {
        this.logger.log(
          `  Nu există rânduri în cuadrante_sum pentru ${codigo}`,
        );
      }

      return {
        summary: {
          total_zile: this.convertBigIntToNumber(results[0]?.total_zile) || 0,
          zile_cu_cuadrante:
            this.convertBigIntToNumber(results[0]?.zile_cu_cuadrante) || 0,
          zile_libre: this.convertBigIntToNumber(results[0]?.zile_libre) || 0,
          zile_interval:
            this.convertBigIntToNumber(results[0]?.zile_interval) || 0,
          horas_cuadrante_mes:
            this.convertBigIntToNumber(results[0]?.horas_cuadrante_mes) || 0,
        },
        detalii: results.map((r) => ({
          dia: this.convertBigIntToNumber(r.dia),
          val_original: r.val_original,
          val_trimmed: r.val_trimmed,
          format_type: r.format_type,
          horas_calculated: this.convertBigIntToNumber(r.horas_calculated),
        })),
      };
    } catch (error) {
      this.logger.error(
        `Error in debugCuadranteCalculation: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async calculateEmployeeScore(
    codigo: string,
    mes: string,
  ): Promise<{ success: boolean; processed: number }> {
    if (!codigo) {
      throw new BadRequestException('codigo is required');
    }
    if (!mes) {
      throw new BadRequestException('mes is required');
    }

    const mesRegex = /^\d{4}-\d{2}$/;
    if (!mesRegex.test(mes)) {
      throw new BadRequestException('mes must be in format YYYY-MM');
    }

    this.logger.log(
      `Calculando puntuación Hall of Fame para empleado ${codigo} para ${mes}...`,
    );

    try {
      // Folosim același query, dar filtrăm doar pentru acest angajat
      const [year, month] = mes.split('-');
      const d_first = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const d_last = new Date(parseInt(year, 10), parseInt(month, 10), 0);
      // LUNA în baza de date este stocat ca '2026-01' (cu cratimă), nu '202601'
      const lunaselectata = mes; // Folosim direct '2026-01' în loc de '202601'
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const mesToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const d_today =
        mes === mesToday ? todayStr : d_last.toISOString().split('T')[0];

      // Formatăm datele fără timezone issues - folosim format YYYY-MM-DD direct
      const d_first_str = `${year}-${month}-01`;
      const d_last_str = `${year}-${String(parseInt(month, 10)).padStart(2, '0')}-${String(d_last.getDate()).padStart(2, '0')}`;

      // Execută SET statements
      await this.prisma.$executeRawUnsafe(`SET @d_first = '${d_first_str}';`);
      await this.prisma.$executeRawUnsafe(`SET @d_last = '${d_last_str}';`);
      await this.prisma.$executeRawUnsafe(`SET @d_today = '${d_today}';`);
      await this.prisma.$executeRawUnsafe(
        `SET @lunaselectata = '${lunaselectata}';`,
      );
      await this.prisma.$executeRawUnsafe(`SET @ccaa_default = 'ES-MD';`);

      // Query de debug pentru target_initial - folosește același query principal
      try {
        const mainQuery = this.buildCalculateQuery();
        // Extrage WITH clause și adaugă SELECT de debug pentru target
        const withMatch = mainQuery.match(
          /^(WITH[\s\S]*?),\s*target_initial AS/s,
        );
        if (withMatch) {
          const debugTargetQuery = `${withMatch[1]},
target_initial AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    COALESCE(
      pm.horas_plan_mes,
      ROUND(CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) * (DAY(@d_last) / 7), 2),
      0
    ) AS target_initial,
    CASE 
      WHEN pm.horas_plan_mes IS NULL 
        AND (CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) IS NOT NULL AND CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) > 0) THEN
        COALESCE(CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)), 0) / 7
      ELSE NULL
    END AS horas_pe_zi_contrato
  FROM DatosEmpleados de
  LEFT JOIN plan_mes pm ON pm.empleadoId = CAST(de.CODIGO AS CHAR)
  WHERE de.ESTADO = 'ACTIVO'
),
cuadrante_sum_debug AS (
  SELECT
    empleadoId,
    MAX(centro_cuadrante) AS centro_cuadrante,
    ROUND(SUM(
      CASE 
        WHEN UPPER(TRIM(val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
        WHEN TRIM(val) LIKE '%:%-%:%' THEN (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(val),' ',-1),'-',-1),' ',1), '%H:%i'))
                                      - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(val),' ',-1),'-', 1),' ',1), '%H:%i'))
                                      + 86400) % 86400) / 3600)
        WHEN TRIM(val) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+×[0-9]+h\\)' THEN 
          CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(val), '×', -1), 'h', 1) AS DECIMAL(10,2))
        WHEN TRIM(val) REGEXP '^[0-9]+h' THEN 
          CAST(SUBSTRING_INDEX(TRIM(val), 'h', 1) AS DECIMAL(10,2))
        ELSE 0
      END
    ),2) AS horas_cuadrante_mes
  FROM cuadrante_unpivot
  GROUP BY empleadoId
),
horario_mes_debug AS (
  SELECT empleadoId, ROUND(SUM(horas_horario_dia),2) AS horas_horario_mes
  FROM horario_dia
  GROUP BY empleadoId
)
SELECT 
  ti.empleadoId,
  de.\`NOMBRE / APELLIDOS\` AS nombre,
  cs.horas_cuadrante_mes,
  hm.horas_horario_mes,
  pm.horas_plan_mes,
  CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) AS horas_contrato,
  ti.target_initial
FROM target_initial ti
LEFT JOIN DatosEmpleados de ON CAST(de.CODIGO AS CHAR) = ti.empleadoId
LEFT JOIN cuadrante_sum_debug cs ON cs.empleadoId = ti.empleadoId
LEFT JOIN horario_mes_debug hm ON hm.empleadoId = ti.empleadoId
LEFT JOIN plan_mes pm ON pm.empleadoId = ti.empleadoId
WHERE ti.empleadoId = '${codigo}';
          `;

          const debugResults =
            await this.prisma.$queryRawUnsafe<any[]>(debugTargetQuery);
          if (debugResults && debugResults.length > 0) {
            this.logger.log(
              `🔍 DEBUG TARGET for ${codigo}:`,
              JSON.stringify(debugResults[0], null, 2),
            );
          }
        }
      } catch (debugError) {
        this.logger.error(`Error in debug target query: ${debugError.message}`);
      }

      // Query de debug pentru fichajes_incompleto - folosește același WITH clause
      const mainQuery = this.buildCalculateQuery();
      // Extrage WITH clause - caută până la scoring_final AS (care este pe linie nouă după ),)
      const withMatch =
        mainQuery.match(/^(WITH[\s\S]*?),\s*\n\s*scoring_final AS/s) ||
        mainQuery.match(/^(WITH[\s\S]*?),\s*scoring_final AS/s);
      this.logger.log(`🔍 DEBUG: withMatch found: ${withMatch ? 'YES' : 'NO'}`);
      if (withMatch) {
        const debugQuery = `${withMatch[1]},
calitate_pontaj_debug AS (
  SELECT 
    dp.fecha,
    dp.horas_plan,
    fpd.workday_date AS fichaje_workday_date,
    fpd.tiene_duracion_valida,
    fpd.tipos_count,
    bj.es_baja,
    au.es_vacaciones,
    fd.es_fiesta,
    CASE 
      WHEN dp.horas_plan > 0
        AND dp.fecha <= @d_today
        AND COALESCE(bj.es_baja, 0) = 0
        AND COALESCE(au.es_vacaciones, 0) = 0
        AND COALESCE(fd.es_fiesta, 0) = 0
        AND (
          fpd.workday_date IS NULL
          OR fpd.tiene_duracion_valida = 0
          OR fpd.tipos_count < 2
        )
      THEN 1
      ELSE 0
    END AS es_incompleto
  FROM DatosEmpleados de
  LEFT JOIN daily_plan dp ON BINARY dp.empleadoId = BINARY CAST(de.CODIGO AS CHAR) AND dp.fecha BETWEEN @d_first AND @d_today
  LEFT JOIN fichajes_por_dia fpd ON BINARY fpd.empleadoId = BINARY CAST(de.CODIGO AS CHAR) AND fpd.workday_date = dp.fecha
  LEFT JOIN bajas_dia bj ON BINARY bj.empleadoId = BINARY CAST(de.CODIGO AS CHAR) AND bj.fecha = dp.fecha
  LEFT JOIN aus_dia au ON BINARY au.empleadoId = BINARY CAST(de.CODIGO AS CHAR) AND au.fecha = dp.fecha
  LEFT JOIN fiestas_dia fd ON BINARY fd.empleadoId = BINARY CAST(de.CODIGO AS CHAR) AND fd.fecha = dp.fecha
  WHERE de.ESTADO = 'ACTIVO'
    AND CAST(de.CODIGO AS CHAR) = '${codigo}'
    AND dp.horas_plan > 0
    AND dp.fecha <= @d_today
)
SELECT * FROM calitate_pontaj_debug ORDER BY fecha;
        `;

        try {
          const debugResults = await this.prisma.$queryRawUnsafe(debugQuery);
          this.logger.log(
            `🔍 DEBUG fichajes_incompleto para ${codigo} (${mes}):`,
          );
          this.logger.log(
            `📊 Total filas devueltas: ${(debugResults as any[]).length}`,
          );
          let incompleteCount = 0;
          for (const debugRow of debugResults as any[]) {
            if (debugRow.es_incompleto === 1) {
              incompleteCount++;
              this.logger.log(
                `  ❌ ${debugRow.fecha}: horas_plan=${debugRow.horas_plan}, fichaje_workday_date=${debugRow.fichaje_workday_date}, tiene_duracion_valida=${debugRow.tiene_duracion_valida}, tipos_count=${debugRow.tipos_count}, es_baja=${debugRow.es_baja}, es_vacaciones=${debugRow.es_vacaciones}, es_fiesta=${debugRow.es_fiesta}`,
              );
            } else {
              this.logger.log(
                `  ✅ ${debugRow.fecha}: horas_plan=${debugRow.horas_plan}, fichaje_workday_date=${debugRow.fichaje_workday_date}, tiene_duracion_valida=${debugRow.tiene_duracion_valida}, tipos_count=${debugRow.tipos_count}`,
              );
            }
          }
          this.logger.log(
            `📊 Total días incompletos encontrados: ${incompleteCount}`,
          );
        } catch (debugError: any) {
          this.logger.error(
            `❌ Error in debug query: ${debugError?.message || debugError}`,
          );
          this.logger.error(`Stack: ${debugError?.stack || 'N/A'}`);
        }
      } else {
        this.logger.warn(
          `⚠️ DEBUG: withMatch no encontrado, omitiendo debug fichajes_incompleto`,
        );
      }

      // Debug simplu pentru fichajes_por_dia - verifică direct din baza de date
      const fichajesDebugQuery = `
SELECT 
  CAST(f.CODIGO AS CHAR) AS empleadoId,
  f.FECHA AS fecha_fichaje,
  f.TIPO AS tipo,
  f.HORA AS hora,
  f.DURACION AS duracion,
  CASE
    WHEN f.TIPO = 'Salida' 
      AND f.DURACION IS NOT NULL 
      AND TRIM(f.DURACION) <> '' 
      AND f.DURACION <> '00:00:00'
      AND CAST(TIME(f.HORA) AS TIME) < TIME('12:00:00')
      AND EXISTS (
        SELECT 1
        FROM Fichaje f_entrada
        WHERE f_entrada.CODIGO = f.CODIGO
          AND f_entrada.TIPO = 'Entrada'
          AND f_entrada.FECHA = DATE_SUB(f.FECHA, INTERVAL 1 DAY)
          AND CAST(TIME(f_entrada.HORA) AS TIME) >= TIME('17:00:00')
      )
    THEN DATE_SUB(f.FECHA, INTERVAL 1 DAY)
    ELSE DATE(f.FECHA)
  END AS workday_date
FROM Fichaje f
WHERE CAST(f.CODIGO AS CHAR) = '${codigo}'
  AND f.FECHA >= '${d_first.toISOString().split('T')[0]}'
  AND f.FECHA < DATE_ADD('${d_last.toISOString().split('T')[0]}', INTERVAL 1 DAY)
ORDER BY f.FECHA, f.HORA;
      `;

      try {
        const fichajesDebug =
          await this.prisma.$queryRawUnsafe<any[]>(fichajesDebugQuery);
        this.logger.log(`🔍 DEBUG FICHAJES para ${codigo} (${mes}):`);
        this.logger.log(
          `📊 Total fichajes encontrados: ${fichajesDebug.length}`,
        );
        for (const f of fichajesDebug) {
          this.logger.log(
            `  ${f.tipo} pe ${f.fecha_fichaje} ${f.hora}: DURACION=${f.duracion || 'NULL'}, workday_date=${f.workday_date}`,
          );
        }

        // Grupează pe workday_date pentru a vedea tipos_count și dur_secs
        const workdayGroups = new Map<
          string,
          { tipos: Set<string>; dur_secs: number }
        >();
        for (const f of fichajesDebug) {
          const wd = f.workday_date
            ? typeof f.workday_date === 'string'
              ? f.workday_date
              : f.workday_date.toISOString().split('T')[0]
            : 'NULL';
          if (!workdayGroups.has(wd)) {
            workdayGroups.set(wd, { tipos: new Set(), dur_secs: 0 });
          }
          workdayGroups.get(wd)!.tipos.add(f.tipo);
          if (f.duracion && f.duracion !== '00:00:00') {
            const [h, m, s] = f.duracion.split(':').map(Number);
            workdayGroups.get(wd)!.dur_secs += h * 3600 + m * 60 + (s || 0);
          }
        }

        this.logger.log(`📊 Grupuri pe workday_date:`);
        for (const [wd, data] of workdayGroups.entries()) {
          const cnt_events = data.tipos.size;
          const dur_secs = data.dur_secs;
          const es_incompleto =
            cnt_events > 0 && dur_secs === 0 ? '❌ INCOMPLET' : '✅ COMPLET';
          this.logger.log(
            `  workday_date=${wd}: tipos=[${Array.from(data.tipos).join(', ')}], cnt_events=${cnt_events}, dur_secs=${dur_secs}, ${es_incompleto}`,
          );
        }

        // Verifică exact ce zile din daily_plan au horas_plan > 0 și care nu au fichajes
        // Trebuie să reconstruim daily_plan pentru a vedea ce zile au horas_plan > 0
        const dailyPlanDebugQuery = `
WITH RECURSIVE fechas AS (
  SELECT @d_first AS d
  UNION ALL
  SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM fechas WHERE d < @d_last
),
cuadrante_unpivot AS (
  SELECT CAST(cq.CODIGO AS CHAR) AS empleadoId, 1 AS dia, cq.ZI_1 AS val FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 2, cq.ZI_2 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 3, cq.ZI_3 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 4, cq.ZI_4 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 5, cq.ZI_5 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 6, cq.ZI_6 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 7, cq.ZI_7 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 8, cq.ZI_8 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 9, cq.ZI_9 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 10, cq.ZI_10 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 11, cq.ZI_11 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 12, cq.ZI_12 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 13, cq.ZI_13 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 14, cq.ZI_14 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 15, cq.ZI_15 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 16, cq.ZI_16 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 17, cq.ZI_17 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 18, cq.ZI_18 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 19, cq.ZI_19 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 20, cq.ZI_20 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 21, cq.ZI_21 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 22, cq.ZI_22 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 23, cq.ZI_23 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 24, cq.ZI_24 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 25, cq.ZI_25 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 26, cq.ZI_26 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 27, cq.ZI_27 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 28, cq.ZI_28 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 29, cq.ZI_29 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 30, cq.ZI_30 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 31, cq.ZI_31 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
),
cuadrante_dia_libre AS (
  SELECT
    cu.empleadoId,
    DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) AS fecha,
    1 AS es_libre
  FROM cuadrante_unpivot cu
  WHERE cu.dia >= 1 AND cu.dia <= 31
    AND DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) >= @d_first
    AND DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) <= @d_last
    AND UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X')
),
cuadrante_dia AS (
  SELECT
    cu.empleadoId,
    DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) AS fecha,
    cu.dia,
    CASE WHEN cu.val IS NOT NULL AND TRIM(cu.val) <> '' THEN 1 ELSE 0 END AS tiene_cuadrante,
    ROUND(
      CASE 
        WHEN UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
        WHEN TRIM(cu.val) LIKE '%:%-%:%' THEN 
          -- Format "08:00-17:00" sau "09:00-15:00 / 16:00-20:00" sau "T2 19:30-07:30"
          -- Pentru moment, calculăm doar prima tură (pentru compatibilitate)
          -- Logica completă pentru ture multiple va fi implementată în frontend
          (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-',-1),' ',1), '%H:%i'))
                                           - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-', 1),' ',1), '%H:%i'))
                                           + 86400) % 86400) / 3600)
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+×[0-9]+h\\)' THEN 
          -- Format "24h (3×8h)" - extrage orele per tură din paranteză (8h)
          CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val), '×', -1), 'h', 1) AS DECIMAL(10,2))
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h' THEN 
          CAST(SUBSTRING_INDEX(TRIM(cu.val), 'h', 1) AS DECIMAL(10,2))
        ELSE 0
      END, 2
    ) AS horas_cuadrante_dia
  FROM cuadrante_unpivot cu
  WHERE cu.dia >= 1 AND cu.dia <= 31
    AND DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) >= @d_first
    AND DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) <= @d_last
),
horario_dia_m AS (
  SELECT
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    f.d AS fecha,
    DAY(f.d) AS dia,
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in1), CONCAT(f.d,' ',h.lun_out1)) + 1440) % 1440, 0)
      WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in1), CONCAT(f.d,' ',h.mar_out1)) + 1440) % 1440, 0)
      WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in1), CONCAT(f.d,' ',h.mie_out1)) + 1440) % 1440, 0)
      WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in1), CONCAT(f.d,' ',h.joi_out1)) + 1440) % 1440, 0)
      WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in1), CONCAT(f.d,' ',h.vin_out1)) + 1440) % 1440, 0)
      WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in1), CONCAT(f.d,' ',h.sam_out1)) + 1440) % 1440, 0)
      WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in1), CONCAT(f.d,' ',h.dum_out1)) + 1440) % 1440, 0)
      ELSE 0
    END AS m1,
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in2), CONCAT(f.d,' ',h.lun_out2)) + 1440) % 1440, 0)
      WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in2), CONCAT(f.d,' ',h.mar_out2)) + 1440) % 1440, 0)
      WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in2), CONCAT(f.d,' ',h.mie_out2)) + 1440) % 1440, 0)
      WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in2), CONCAT(f.d,' ',h.joi_out2)) + 1440) % 1440, 0)
      WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in2), CONCAT(f.d,' ',h.vin_out2)) + 1440) % 1440, 0)
      WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in2), CONCAT(f.d,' ',h.sam_out2)) + 1440) % 1440, 0)
      WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in2), CONCAT(f.d,' ',h.dum_out2)) + 1440) % 1440, 0)
      ELSE 0
    END AS m2,
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in3), CONCAT(f.d,' ',h.lun_out3)) + 1440) % 1440, 0)
      WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in3), CONCAT(f.d,' ',h.mar_out3)) + 1440) % 1440, 0)
      WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in3), CONCAT(f.d,' ',h.mie_out3)) + 1440) % 1440, 0)
      WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in3), CONCAT(f.d,' ',h.joi_out3)) + 1440) % 1440, 0)
      WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in3), CONCAT(f.d,' ',h.vin_out3)) + 1440) % 1440, 0)
      WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in3), CONCAT(f.d,' ',h.sam_out3)) + 1440) % 1440, 0)
      WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in3), CONCAT(f.d,' ',h.dum_out3)) + 1440) % 1440, 0)
      ELSE 0
    END AS m3
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  LEFT JOIN horarios h
    ON h.centro_nombre = de.\`CENTRO TRABAJO\`
    AND h.grupo_nombre = de.GRUPO
    AND h.vigente_desde <= f.d
    AND (h.vigente_hasta IS NULL OR f.d <= h.vigente_hasta)
  WHERE de.ESTADO = 'ACTIVO'
    AND f.d >= @d_first
    AND f.d <= @d_last
    AND CAST(de.CODIGO AS CHAR) = '${codigo}'
),
horario_dia AS (
  SELECT
    empleadoId,
    fecha,
    dia,
    ROUND(
      CASE 
        WHEN (m1 + m2 + m3) >= 1320 THEN GREATEST(m1, m2, m3) / 60
        ELSE (m1 + m2 + m3) / 60
      END
    , 2) AS horas_horario_dia
  FROM horario_dia_m
),
empleado_flags_debug_dp AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    CASE 
      WHEN LOWER(TRIM(de.TrabajaFestivos)) IN ('si','sí','s','1','true','da','y') THEN 1
      ELSE 0
    END AS trabaja_festivos
  FROM DatosEmpleados de
  WHERE CAST(de.CODIGO AS CHAR) = '${codigo}'
),
empleado_ccaa_debug_dp AS (
  SELECT CAST(de.CODIGO AS CHAR) AS empleadoId, @ccaa_default AS ccaa
  FROM DatosEmpleados de
  WHERE CAST(de.CODIGO AS CHAR) = '${codigo}'
),
bajas_dia_debug_dp AS (
  SELECT 
    CAST('${codigo}' AS CHAR) AS empleadoId,
    f.d AS fecha,
    0 AS es_baja
  FROM fechas f
  WHERE 1=0  -- Nu verificăm bajas pentru moment în debug
),
aus_dia_debug_dp AS (
  SELECT 
    CAST('${codigo}' AS CHAR) AS empleadoId,
    f.d AS fecha,
    0 AS es_vacaciones,
    0 AS es_ausencia,
    0 AS horas_ausencia_ore
  FROM fechas f
  WHERE 1=0  -- Nu verificăm ausencias pentru moment în debug
),
fiestas_dia_debug_dp AS (
  SELECT 
    ec.empleadoId,
    f.d AS fecha,
    CASE 
      WHEN fi.active = 1
        AND DATE(COALESCE(fi.observed_date, fi.date)) = f.d
        AND (
          LOWER(fi.scope) IN ('nacional', 'national')
          OR (LOWER(fi.scope) IN ('autonómico', 'autonomico', 'ccaa') AND BINARY fi.ccaa_code = BINARY ec.ccaa)
        )
        AND COALESCE(tf.trabaja_festivos, 0) = 0
      THEN 1 ELSE 0
    END AS es_fiesta
  FROM empleado_ccaa_debug_dp ec
  CROSS JOIN fechas f
  LEFT JOIN fiestas fi ON DATE(COALESCE(fi.observed_date, fi.date)) = f.d
  LEFT JOIN empleado_flags_debug_dp tf ON BINARY tf.empleadoId = BINARY ec.empleadoId
),
empleado_fechas AS (
  SELECT CAST('${codigo}' AS CHAR) AS empleadoId, f.d AS fecha, DAY(f.d) AS dia
  FROM fechas f
  WHERE f.d >= @d_first AND f.d <= @d_last
    AND DATE_FORMAT(f.d, '%Y-%m') = @lunaselectata
),
daily_plan AS (
  SELECT
    ef.empleadoId,
    ef.fecha,
    CASE
      WHEN bj.es_baja = 1 THEN 0
      WHEN COALESCE(au.es_vacaciones,0) = 1 THEN 0
      WHEN fd.es_fiesta = 1 AND COALESCE(tf.trabaja_festivos,0) = 0 THEN 0
      WHEN COALESCE(au.es_ausencia,0) = 1 THEN 0
      WHEN cdl.es_libre = 1 THEN 0
      WHEN cd.tiene_cuadrante = 1 THEN cd.horas_cuadrante_dia
      WHEN hd.horas_horario_dia IS NOT NULL AND hd.horas_horario_dia > 0 THEN hd.horas_horario_dia
      ELSE 0
    END AS horas_plan
  FROM empleado_fechas ef
  LEFT JOIN cuadrante_dia_libre cdl ON cdl.empleadoId = ef.empleadoId AND cdl.fecha = ef.fecha
  LEFT JOIN cuadrante_dia cd ON cd.empleadoId = ef.empleadoId AND cd.fecha = ef.fecha
  LEFT JOIN horario_dia hd ON hd.empleadoId = ef.empleadoId AND hd.fecha = ef.fecha
  LEFT JOIN bajas_dia_debug_dp bj ON bj.empleadoId = ef.empleadoId AND bj.fecha = ef.fecha
  LEFT JOIN fiestas_dia_debug_dp fd ON fd.empleadoId = ef.empleadoId AND fd.fecha = ef.fecha
  LEFT JOIN aus_dia_debug_dp au ON au.empleadoId = ef.empleadoId AND au.fecha = ef.fecha
  LEFT JOIN empleado_flags_debug_dp tf ON tf.empleadoId = ef.empleadoId
  WHERE ef.fecha >= @d_first AND ef.fecha <= @d_last
),
fichajes_por_dia_base AS (
  SELECT 
    CAST(f.CODIGO AS CHAR) AS empleadoId,
    f.TIPO AS tipo,
    f.FECHA AS fecha,
    f.DURACION AS duracion,
    CASE
      WHEN f.TIPO = 'Salida' 
        AND f.DURACION IS NOT NULL 
        AND TRIM(f.DURACION) <> '' 
        AND f.DURACION <> '00:00:00'
        AND CAST(TIME(f.HORA) AS TIME) < TIME('12:00:00')
        AND EXISTS (
          SELECT 1
          FROM Fichaje f_entrada
          WHERE f_entrada.CODIGO = f.CODIGO
            AND f_entrada.TIPO = 'Entrada'
            AND f_entrada.FECHA = DATE_SUB(f.FECHA, INTERVAL 1 DAY)
            AND CAST(TIME(f_entrada.HORA) AS TIME) >= TIME('17:00:00')
        )
      THEN DATE_SUB(f.FECHA, INTERVAL 1 DAY)
      ELSE DATE(f.FECHA)
    END AS workday_date
  FROM Fichaje f
  WHERE f.FECHA >= @d_first AND f.FECHA < DATE_ADD(@d_last, INTERVAL 1 DAY)
),
fichajes_por_dia AS (
  SELECT 
    empleadoId,
    workday_date,
    COUNT(*) AS cnt_events,
    COALESCE(SUM(CASE 
      WHEN duracion IS NOT NULL AND TRIM(duracion) <> '' AND duracion <> '00:00:00' 
      THEN TIME_TO_SEC(duracion)
      ELSE 0
    END), 0) AS dur_secs
  FROM fichajes_por_dia_base
  GROUP BY empleadoId, workday_date
)
SELECT 
  dp.fecha,
  dp.horas_plan,
  fpd.workday_date AS fichaje_workday_date,
  fpd.cnt_events,
  fpd.dur_secs,
  CASE 
    WHEN dp.horas_plan > 0
      AND dp.fecha >= @d_first
      AND dp.fecha <= @d_today
      AND (fpd.workday_date IS NULL OR (fpd.cnt_events > 0 AND fpd.dur_secs = 0))
    THEN 1
    ELSE 0
  END AS es_incompleto
FROM daily_plan dp
LEFT JOIN fichajes_por_dia fpd ON BINARY fpd.empleadoId = BINARY dp.empleadoId AND fpd.workday_date = dp.fecha
WHERE BINARY dp.empleadoId = BINARY CAST('${codigo}' AS CHAR)
  AND dp.fecha >= @d_first
  AND dp.fecha <= @d_today
  AND DATE_FORMAT(dp.fecha, '%Y-%m') = @lunaselectata
ORDER BY dp.fecha;
        `;

        try {
          const dailyPlanDebug =
            await this.prisma.$queryRawUnsafe<any[]>(dailyPlanDebugQuery);
          this.logger.log(`📊 DEBUG daily_plan para ${codigo}:`);
          this.logger.log(
            `📊 Total días verificados: ${dailyPlanDebug.length}`,
          );
          let incompleteCount = 0;
          for (const dp of dailyPlanDebug) {
            if (dp.horas_plan > 0) {
              if (dp.es_incompleto === 1) {
                incompleteCount++;
                this.logger.log(
                  `  ❌ ${dp.fecha}: horas_plan=${dp.horas_plan}, fichaje_workday_date=${dp.fichaje_workday_date || 'NULL'}, cnt_events=${dp.cnt_events || 0}, dur_secs=${dp.dur_secs || 0}`,
                );
              } else {
                this.logger.log(
                  `  ✅ ${dp.fecha}: horas_plan=${dp.horas_plan}, fichaje_workday_date=${dp.fichaje_workday_date || 'NULL'}, cnt_events=${dp.cnt_events || 0}, dur_secs=${dp.dur_secs || 0}`,
                );
              }
            } else {
              this.logger.log(
                `  ⚪ ${dp.fecha}: horas_plan=${dp.horas_plan}, fichaje_workday_date=${dp.fichaje_workday_date || 'NULL'}, cnt_events=${dp.cnt_events || 0}, dur_secs=${dp.dur_secs || 0} (sin plan)`,
              );
            }
          }
          this.logger.log(
            `📊 Total días incompletos con horas_plan > 0: ${incompleteCount}`,
          );

          // Debug pentru @d_first
          const dFirstDebugQuery = `SELECT @d_first AS d_first_value, @d_last AS d_last_value, @d_today AS d_today_value, @lunaselectata AS luna_value, CASE WHEN @d_today < @d_last THEN 1 ELSE 0 END AS es_luna_curenta;`;
          try {
            const dFirstDebug =
              await this.prisma.$queryRawUnsafe<any[]>(dFirstDebugQuery);
            if (dFirstDebug && dFirstDebug.length > 0) {
              this.logger.log(`🔍 DEBUG @d_first para ${codigo}:`);
              this.logger.log(
                `  @d_first: ${dFirstDebug[0]?.d_first_value || 'NULL'}`,
              );
              this.logger.log(
                `  @d_last: ${dFirstDebug[0]?.d_last_value || 'NULL'}`,
              );
              this.logger.log(
                `  @d_today: ${dFirstDebug[0]?.d_today_value || 'NULL'}`,
              );
              this.logger.log(
                `  @lunaselectata: ${dFirstDebug[0]?.luna_value || 'NULL'}`,
              );
              this.logger.log(
                `  es_luna_curenta: ${dFirstDebug[0]?.es_luna_curenta || 'NULL'}`,
              );
            }
          } catch (dFirstError: any) {
            this.logger.error(
              `❌ Error in d_first debug query: ${dFirstError?.message || dFirstError}`,
            );
          }

          // Debug pentru horas_neutre din target_ajustat
          const horasNeutreTargetQuery = `
WITH RECURSIVE fechas AS (
  SELECT @d_first AS d
  UNION ALL
  SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM fechas WHERE d < @d_last
),
empleado_orar AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    CASE WHEN cq.CODIGO IS NOT NULL THEN 1 ELSE 0 END AS has_cuadrante,
    CASE WHEN h.id IS NOT NULL THEN 1 ELSE 0 END AS has_horario,
    CASE 
      WHEN cq.CODIGO IS NOT NULL OR h.id IS NOT NULL THEN 1 
      ELSE 0 
    END AS has_orar
  FROM DatosEmpleados de
  LEFT JOIN cuadrante cq 
    ON TRIM(BINARY cq.CODIGO) = TRIM(BINARY CAST(de.CODIGO AS CHAR)) 
    AND cq.LUNA = @lunaselectata
  LEFT JOIN horarios h
    ON h.centro_nombre = de.\`CENTRO TRABAJO\`
    AND h.grupo_nombre = de.GRUPO
    AND h.vigente_desde <= @d_last
    AND (h.vigente_hasta IS NULL OR h.vigente_hasta >= @d_first)
  WHERE de.ESTADO = 'ACTIVO' AND CAST(de.CODIGO AS CHAR) = '${codigo}'
)
SELECT 
  CASE WHEN @d_today < @d_last THEN 'Luna curentă - folosește horas_neutre_hasta_hoy' ELSE 'Luna în trecut - folosește horas_neutre' END AS tip_calcul,
  @d_today AS d_today_val,
  @d_last AS d_last_val,
  CASE WHEN @d_today < @d_last THEN 1 ELSE 0 END AS es_luna_curenta;
          `;
          try {
            const horasNeutreTarget = await this.prisma.$queryRawUnsafe<any[]>(
              horasNeutreTargetQuery,
            );
            if (horasNeutreTarget && horasNeutreTarget.length > 0) {
              this.logger.log(`🔍 DEBUG horas_neutre target para ${codigo}:`);
              this.logger.log(
                `  tipo_calculo: ${horasNeutreTarget[0]?.tip_calcul || 'NULL'}`,
              );
              this.logger.log(
                `  d_today: ${horasNeutreTarget[0]?.d_today_val || 'NULL'}`,
              );
              this.logger.log(
                `  d_last: ${horasNeutreTarget[0]?.d_last_val || 'NULL'}`,
              );
              this.logger.log(
                `  es_luna_curenta: ${horasNeutreTarget[0]?.es_luna_curenta || 'NULL'}`,
              );
            }
          } catch (horasNeutreTargetError: any) {
            this.logger.error(
              `❌ Error in horas_neutre target debug query: ${horasNeutreTargetError?.message || horasNeutreTargetError}`,
            );
          }

          // Debug pentru ziua 4 - verifică cuadrante_dia și cuadrante_dia_libre
          const dia4DebugQuery = `
WITH cuadrante_unpivot AS (
  SELECT CAST(cq.CODIGO AS CHAR) AS empleadoId, 4 AS dia, cq.ZI_4 AS val FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
)
SELECT 
  cu.empleadoId,
  cu.dia,
  cu.val AS val_raw,
  TRIM(cu.val) AS val_trimmed,
  UPPER(TRIM(cu.val)) AS val_upper,
  CASE WHEN UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 1 ELSE 0 END AS es_libre_check,
  CASE WHEN TRIM(cu.val) LIKE '%:%-%:%' THEN 1 ELSE 0 END AS matches_time_pattern,
  @d_first AS d_first_raw,
  DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) AS fecha_calculada,
  DATE_ADD(@d_first, INTERVAL 3 DAY) AS fecha_calculada_direct
FROM cuadrante_unpivot cu;
          `;
          try {
            const dia4Debug =
              await this.prisma.$queryRawUnsafe<any[]>(dia4DebugQuery);
            if (dia4Debug && dia4Debug.length > 0) {
              this.logger.log(`🔍 DEBUG día 4 para ${codigo}:`);
              this.logger.log(`  val_raw: ${dia4Debug[0]?.val_raw || 'NULL'}`);
              this.logger.log(
                `  val_trimmed: ${dia4Debug[0]?.val_trimmed || 'NULL'}`,
              );
              this.logger.log(
                `  val_upper: ${dia4Debug[0]?.val_upper || 'NULL'}`,
              );
              this.logger.log(
                `  es_libre_check: ${dia4Debug[0]?.es_libre_check || 'NULL'}`,
              );
              this.logger.log(
                `  matches_time_pattern: ${dia4Debug[0]?.matches_time_pattern || 'NULL'}`,
              );
              this.logger.log(
                `  fecha_calculada: ${dia4Debug[0]?.fecha_calculada || 'NULL'}`,
              );
            } else {
              this.logger.log(
                `⚠️ DEBUG día 4: No se encontró cuadrante para ${codigo}`,
              );
            }
          } catch (dia4Error: any) {
            this.logger.error(
              `❌ Error in dia4 debug query: ${dia4Error?.message || dia4Error}`,
            );
          }

          // Debug pentru cuadrante_dia pentru ziua 4
          const cuadranteDia4DebugQuery = `
WITH cuadrante_unpivot AS (
  SELECT CAST(cq.CODIGO AS CHAR) AS empleadoId, 4 AS dia, cq.ZI_4 AS val FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
),
cuadrante_dia AS (
  SELECT
    cu.empleadoId,
    DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) AS fecha,
    cu.dia,
    CASE WHEN cu.val IS NOT NULL AND TRIM(cu.val) <> '' THEN 1 ELSE 0 END AS tiene_cuadrante,
    ROUND(
      CASE 
        WHEN UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
        WHEN TRIM(cu.val) LIKE '%:%-%:%' THEN 
          (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-',-1),' ',1), '%H:%i'))
                                           - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-', 1),' ',1), '%H:%i'))
                                           + 86400) % 86400) / 3600)
        ELSE 0
      END, 2
    ) AS horas_cuadrante_dia
  FROM cuadrante_unpivot cu
  WHERE cu.dia >= 1 AND cu.dia <= 31
    AND DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) >= @d_first
    AND DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) <= @d_last
)
SELECT * FROM cuadrante_dia;
          `;
          try {
            const cuadranteDia4Debug = await this.prisma.$queryRawUnsafe<any[]>(
              cuadranteDia4DebugQuery,
            );
            if (cuadranteDia4Debug && cuadranteDia4Debug.length > 0) {
              this.logger.log(`🔍 DEBUG cuadrante_dia para día 4:`);
              this.logger.log(
                `  fecha: ${cuadranteDia4Debug[0]?.fecha || 'NULL'}`,
              );
              this.logger.log(
                `  tiene_cuadrante: ${cuadranteDia4Debug[0]?.tiene_cuadrante || 'NULL'}`,
              );
              this.logger.log(
                `  horas_cuadrante_dia: ${cuadranteDia4Debug[0]?.horas_cuadrante_dia || 'NULL'}`,
              );
            } else {
              this.logger.log(
                `⚠️ DEBUG cuadrante_dia para día 4: No se encontró resultado`,
              );
            }
          } catch (cuadranteDia4Error: any) {
            this.logger.error(
              `❌ Error in cuadrante_dia4 debug query: ${cuadranteDia4Error?.message || cuadranteDia4Error}`,
            );
          }

          // Debug pentru horas_neutre - verifică ce zile sunt neutre și ce ore se calculează
          const horasNeutreDebugQuery = `
WITH RECURSIVE fechas AS (
  SELECT @d_first AS d
  UNION ALL
  SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM fechas WHERE d < @d_last
),
empleado_flags AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    CASE 
      WHEN LOWER(TRIM(de.TrabajaFestivos)) IN ('si','sí','s','1','true','da','y') THEN 1
      ELSE 0
    END AS trabaja_festivos
  FROM DatosEmpleados de
  WHERE de.ESTADO = 'ACTIVO' AND CAST(de.CODIGO AS CHAR) = '${codigo}'
),
empleado_orar AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    CASE WHEN cq.CODIGO IS NOT NULL THEN 1 ELSE 0 END AS has_cuadrante,
    CASE WHEN h.id IS NOT NULL THEN 1 ELSE 0 END AS has_horario,
    CASE 
      WHEN cq.CODIGO IS NOT NULL OR h.id IS NOT NULL THEN 1 
      ELSE 0 
    END AS has_orar
  FROM DatosEmpleados de
  LEFT JOIN cuadrante cq 
    ON TRIM(BINARY cq.CODIGO) = TRIM(BINARY CAST(de.CODIGO AS CHAR)) 
    AND cq.LUNA = @lunaselectata
  LEFT JOIN horarios h
    ON h.centro_nombre = de.\`CENTRO TRABAJO\`
    AND h.grupo_nombre = de.GRUPO
    AND h.vigente_desde <= @d_last
    AND (h.vigente_hasta IS NULL OR h.vigente_hasta >= @d_first)
  WHERE de.ESTADO = 'ACTIVO' AND CAST(de.CODIGO AS CHAR) = '${codigo}'
),
bajas_dia AS (
  SELECT 
    CAST('${codigo}' AS CHAR) AS empleadoId,
    f.d AS fecha,
    0 AS es_baja
  FROM fechas f
  WHERE 1=0  -- Nu verificăm bajas pentru moment
),
aus_raw AS (
  SELECT 
    CAST(a.\`CODIGO\` AS CHAR) AS empleadoId,
    TRIM(a.\`TIPO\`) AS tipo,
    a.\`DURACION\` AS duracion,
    TRIM(REPLACE(REPLACE(a.\`FECHA\`,'–','-'),'—','-')) AS fecha_txt
  FROM Ausencias a
  WHERE CAST(a.\`CODIGO\` AS CHAR) = '${codigo}'
),
aus_parts AS (
  SELECT
    empleadoId,
    tipo,
    duracion,
    CASE 
      WHEN fecha_txt LIKE '% %' 
        THEN TRIM(TRAILING '-' FROM SUBSTRING_INDEX(fecha_txt,' ',1))
      ELSE fecha_txt
    END AS start_raw,
    CASE 
      WHEN fecha_txt LIKE '% %' 
        THEN TRIM(LEADING '-' FROM SUBSTRING_INDEX(fecha_txt,' ',-1))
      ELSE fecha_txt
    END AS end_raw
  FROM aus_raw
),
aus_norm AS (
  SELECT
    empleadoId,
    tipo,
    duracion,
    COALESCE(STR_TO_DATE(start_raw, '%Y-%m-%d'), STR_TO_DATE(start_raw, '%Y-%m-%e')) AS d_start,
    COALESCE(STR_TO_DATE(end_raw, '%Y-%m-%d'), STR_TO_DATE(end_raw, '%Y-%m-%e')) AS d_end,
    CASE
      WHEN UPPER(tipo) = 'VACACIONES' THEN 0
      WHEN UPPER(tipo) LIKE '%ASUNTO PROPIO%' THEN 0
      WHEN UPPER(tipo) LIKE '%PERMISO%' THEN 0
      WHEN UPPER(tipo) LIKE '%BAJA%' THEN 0
      WHEN UPPER(tipo) LIKE '%AUSENCIA INJUSTIFICADA%' THEN 0
      WHEN UPPER(tipo) LIKE '%SALIDA SIN REGRESO%' THEN 1
      WHEN UPPER(tipo) LIKE '%SALIDA CENTRO%' THEN 1
      WHEN UPPER(tipo) LIKE '%ENTRADA CENTRO%' THEN 1
      WHEN duracion IS NOT NULL AND TRIM(duracion) != '' AND duracion != '00:00:00' THEN 1
      ELSE 0
    END AS es_pe_ore
  FROM aus_parts
),
aus_dia AS (
  SELECT 
    f.d AS fecha,
    n.empleadoId,
    MAX(CASE WHEN UPPER(n.tipo)='VACACIONES' AND n.d_start IS NOT NULL AND n.d_end IS NOT NULL THEN 1 ELSE 0 END) AS es_vacaciones,
    MAX(CASE WHEN UPPER(n.tipo)<> 'VACACIONES' AND n.es_pe_ore = 0 AND n.d_start IS NOT NULL AND n.d_end IS NOT NULL THEN 1 ELSE 0 END) AS es_ausencia,
    SUM(CASE WHEN n.es_pe_ore = 1 THEN 
      COALESCE(TIME_TO_SEC(STR_TO_DATE(n.duracion, '%H:%i:%s')) / 3600.0, 0)
      ELSE 0 
    END) AS horas_ausencia_ore
  FROM fechas f
  JOIN aus_norm n
    ON n.d_start IS NOT NULL 
    AND n.d_end IS NOT NULL
    AND f.d BETWEEN n.d_start AND n.d_end
  GROUP BY f.d, n.empleadoId
),
fiestas_dia AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    f.d AS fecha,
    CASE 
      WHEN fi.active = 1
        AND DATE(COALESCE(fi.observed_date, fi.date)) = f.d
        AND COALESCE(tf.trabaja_festivos, 0) = 0
      THEN 1 ELSE 0
    END AS es_fiesta
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  LEFT JOIN fiestas fi ON DATE(COALESCE(fi.observed_date, fi.date)) = f.d
  LEFT JOIN empleado_flags tf ON BINARY tf.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  WHERE de.ESTADO = 'ACTIVO' AND CAST(de.CODIGO AS CHAR) = '${codigo}'
),
cuadrante_unpivot_debug AS (
  SELECT CAST(cq.CODIGO AS CHAR) AS empleadoId, 1 AS dia, cq.ZI_1 AS val FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 2, cq.ZI_2 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 3, cq.ZI_3 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 4, cq.ZI_4 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 5, cq.ZI_5 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 6, cq.ZI_6 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 7, cq.ZI_7 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 8, cq.ZI_8 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 9, cq.ZI_9 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 10, cq.ZI_10 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 11, cq.ZI_11 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 12, cq.ZI_12 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 13, cq.ZI_13 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 14, cq.ZI_14 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 15, cq.ZI_15 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 16, cq.ZI_16 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 17, cq.ZI_17 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 18, cq.ZI_18 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 19, cq.ZI_19 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 20, cq.ZI_20 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 21, cq.ZI_21 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 22, cq.ZI_22 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 23, cq.ZI_23 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 24, cq.ZI_24 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 25, cq.ZI_25 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 26, cq.ZI_26 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 27, cq.ZI_27 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 28, cq.ZI_28 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 29, cq.ZI_29 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 30, cq.ZI_30 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 31, cq.ZI_31 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
),
cuadrante_dia AS (
  SELECT
    cu.empleadoId,
    DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) AS fecha,
    ROUND(
      CASE 
        WHEN TRIM(cu.val) LIKE '%:%-%:%' THEN 
          (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-',-1),' ',1), '%H:%i'))
                                           - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-', 1),' ',1), '%H:%i'))
                                           + 86400) % 86400) / 3600)
        ELSE 0
      END, 2
    ) AS horas_cuadrante_dia
  FROM cuadrante_unpivot_debug cu
  WHERE cu.dia >= 1 AND cu.dia <= 31
    AND DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) >= @d_first
    AND DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) <= @d_last
),
horario_dia AS (
  SELECT
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    f.d AS fecha,
    ROUND(
      CASE DAYOFWEEK(f.d)
        WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in1), CONCAT(f.d,' ',h.lun_out1)) + 1440) % 1440, 0) / 60.0
        WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in1), CONCAT(f.d,' ',h.mar_out1)) + 1440) % 1440, 0) / 60.0
        WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in1), CONCAT(f.d,' ',h.mie_out1)) + 1440) % 1440, 0) / 60.0
        WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in1), CONCAT(f.d,' ',h.joi_out1)) + 1440) % 1440, 0) / 60.0
        WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in1), CONCAT(f.d,' ',h.vin_out1)) + 1440) % 1440, 0) / 60.0
        WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in1), CONCAT(f.d,' ',h.sam_out1)) + 1440) % 1440, 0) / 60.0
        WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in1), CONCAT(f.d,' ',h.dum_out1)) + 1440) % 1440, 0) / 60.0
        ELSE 0
      END, 2
    ) AS horas_horario_dia
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  LEFT JOIN horarios h
    ON h.centro_nombre = de.\`CENTRO TRABAJO\`
    AND h.grupo_nombre = de.GRUPO
    AND h.vigente_desde <= f.d
    AND (h.vigente_hasta IS NULL OR f.d <= h.vigente_hasta)
  WHERE de.ESTADO = 'ACTIVO' AND CAST(de.CODIGO AS CHAR) = '${codigo}'
),
fichaje_base_debug AS (
  SELECT 
    CAST(f.CODIGO AS CHAR) AS empleadoId,
    STR_TO_DATE(f.FECHA, '%Y-%m-%d') AS fecha,
    f.TIPO AS tipo,
    f.HORA AS hora,
    f.DURACION AS duracion,
    CASE
      WHEN f.TIPO = 'Salida' 
        AND f.DURACION IS NOT NULL 
        AND TRIM(f.DURACION) <> '' 
        AND f.DURACION <> '00:00:00'
        AND CAST(TIME(f.HORA) AS TIME) < TIME('12:00:00')
        AND EXISTS (
          SELECT 1
          FROM Fichaje f_entrada
          WHERE f_entrada.CODIGO = f.CODIGO
            AND f_entrada.TIPO = 'Entrada'
            AND f_entrada.FECHA = DATE_SUB(STR_TO_DATE(f.FECHA, '%Y-%m-%d'), INTERVAL 1 DAY)
            AND CAST(TIME(f_entrada.HORA) AS TIME) >= TIME('17:00:00')
        )
      THEN DATE_SUB(STR_TO_DATE(f.FECHA, '%Y-%m-%d'), INTERVAL 1 DAY)
      ELSE STR_TO_DATE(f.FECHA, '%Y-%m-%d')
    END AS workday_date
  FROM Fichaje f
  WHERE f.FECHA >= @d_first AND f.FECHA < DATE_ADD(@d_last, INTERVAL 1 DAY)
    AND CAST(f.CODIGO AS CHAR) = '${codigo}'
),
fichajes_por_dia_debug AS (
  SELECT 
    empleadoId,
    workday_date,
    COUNT(*) AS cnt_events,
    COALESCE(SUM(CASE 
      WHEN duracion IS NOT NULL AND TRIM(duracion) <> '' AND duracion <> '00:00:00' 
      THEN TIME_TO_SEC(duracion)
      ELSE 0
    END), 0) AS dur_secs
  FROM fichaje_base_debug
  GROUP BY empleadoId, workday_date
),
regularizaciones_debug AS (
  SELECT 
    CAST(fr.employee_codigo AS CHAR) AS empleadoId,
    fr.workday_date,
    fr.effective_minutes,
    fr.status
  FROM FichajeRegularizacion fr
  WHERE fr.status = 'CONFIRMED'
    AND CAST(fr.employee_codigo AS CHAR) = '${codigo}'
)
SELECT 
  f.d AS fecha,
  COALESCE(bj.es_baja, 0) AS es_baja,
  COALESCE(au.es_vacaciones, 0) AS es_vacaciones,
  COALESCE(fd.es_fiesta, 0) AS es_fiesta,
  COALESCE(tf.trabaja_festivos, 0) AS trabaja_festivos,
  eo.has_cuadrante,
  eo.has_horario,
  cd.horas_cuadrante_dia,
  hd.horas_horario_dia,
  fpd.workday_date AS fichaje_workday_date,
  fpd.dur_secs AS fichaje_dur_secs,
  fr.effective_minutes AS regularizacion_minutes,
  CASE 
    WHEN COALESCE(au.es_vacaciones, 0) = 1 THEN
      -- Vacaciones: se scade întotdeauna
      CASE 
        WHEN eo.has_cuadrante = 1 THEN COALESCE(cd.horas_cuadrante_dia, 0)
        ELSE COALESCE(cd.horas_cuadrante_dia, hd.horas_horario_dia, 0)
      END
    WHEN (
      COALESCE(fd.es_fiesta, 0) = 1 
      AND COALESCE(tf.trabaja_festivos, 0) = 0
      AND (fpd.workday_date IS NOT NULL OR fr.workday_date IS NOT NULL)
    ) THEN
      -- Festivo cu fichajes/regularizare: se scade orele din regularizare (dacă există) sau din fichajes
      CASE 
        WHEN fr.effective_minutes IS NOT NULL AND fr.effective_minutes > 0 THEN
          -- Folosim orele din regularizare (convertite din minute în ore)
          ROUND(fr.effective_minutes / 60.0, 2)
        WHEN fpd.dur_secs > 0 THEN
          -- Folosim orele din fichajes (convertite din secunde în ore)
          ROUND(fpd.dur_secs / 3600.0, 2)
        ELSE 0
      END
    WHEN (
      COALESCE(fd.es_fiesta, 0) = 1 
      AND COALESCE(tf.trabaja_festivos, 0) = 0
    ) THEN
      -- Festivo fără fichajes: nu se scade nimic
      0
    ELSE 0
  END AS horas_neutre_zi
FROM fechas f
CROSS JOIN empleado_orar eo
LEFT JOIN empleado_flags tf ON BINARY tf.empleadoId = BINARY eo.empleadoId
LEFT JOIN bajas_dia bj ON bj.fecha = f.d
LEFT JOIN aus_dia au ON au.fecha = f.d
LEFT JOIN fiestas_dia fd ON fd.fecha = f.d
LEFT JOIN cuadrante_dia cd ON cd.fecha = f.d
LEFT JOIN horario_dia hd ON hd.fecha = f.d AND eo.has_cuadrante = 0
LEFT JOIN fichajes_por_dia_debug fpd ON BINARY fpd.empleadoId = BINARY eo.empleadoId AND fpd.workday_date = f.d
LEFT JOIN regularizaciones_debug fr ON BINARY fr.empleadoId = BINARY eo.empleadoId AND fr.workday_date = f.d
WHERE f.d <= @d_today
  AND (
    COALESCE(au.es_vacaciones, 0) = 1 
    OR COALESCE(fd.es_fiesta, 0) = 1
  )
ORDER BY f.d;
          `;
          try {
            const horasNeutreDebug = await this.prisma.$queryRawUnsafe<any[]>(
              horasNeutreDebugQuery,
            );
            this.logger.log(`🔍 DEBUG horas_neutre para ${codigo}:`);
            this.logger.log(
              `📊 Total días neutros: ${horasNeutreDebug.length}`,
            );
            let totalHorasNeutre = 0;
            for (const row of horasNeutreDebug) {
              totalHorasNeutre += parseFloat(row.horas_neutre_zi || 0);
              this.logger.log(
                `  ${row.fecha}: es_baja=${row.es_baja}, es_vacaciones=${row.es_vacaciones}, es_fiesta=${row.es_fiesta}, trabaja_festivos=${row.trabaja_festivos}, has_cuadrante=${row.has_cuadrante}, has_horario=${row.has_horario}, horas_cuadrante=${row.horas_cuadrante_dia || 0}, horas_horario=${row.horas_horario_dia || 0}, fichaje_workday_date=${row.fichaje_workday_date || 'NULL'}, fichaje_dur_secs=${row.fichaje_dur_secs || 0}, horas_neutre_zi=${row.horas_neutre_zi || 0}`,
              );
            }
            this.logger.log(
              `📊 Total horas_neutre calculadas: ${totalHorasNeutre}`,
            );

            // Debug pentru horas_pontate
            const horasPontateDebugQuery = `
WITH fichaje_base_debug AS (
  SELECT 
    CAST(f.CODIGO AS CHAR) AS empleadoId,
    STR_TO_DATE(f.FECHA, '%Y-%m-%d') AS fecha,
    f.TIPO AS tipo,
    f.HORA AS hora,
    f.DURACION AS duracion,
    CASE
      WHEN f.TIPO = 'Salida' 
        AND f.DURACION IS NOT NULL 
        AND TRIM(f.DURACION) <> '' 
        AND f.DURACION <> '00:00:00'
        AND CAST(TIME(f.HORA) AS TIME) < TIME('12:00:00')
        AND EXISTS (
          SELECT 1
          FROM Fichaje f_entrada
          WHERE f_entrada.CODIGO = f.CODIGO
            AND f_entrada.TIPO = 'Entrada'
            AND f_entrada.FECHA = DATE_SUB(STR_TO_DATE(f.FECHA, '%Y-%m-%d'), INTERVAL 1 DAY)
            AND CAST(TIME(f_entrada.HORA) AS TIME) >= TIME('17:00:00')
        )
      THEN DATE_SUB(STR_TO_DATE(f.FECHA, '%Y-%m-%d'), INTERVAL 1 DAY)
      ELSE STR_TO_DATE(f.FECHA, '%Y-%m-%d')
    END AS workday_date
  FROM Fichaje f
  WHERE f.FECHA >= @d_first AND f.FECHA < DATE_ADD(@d_last, INTERVAL 1 DAY)
    AND CAST(f.CODIGO AS CHAR) = '${codigo}'
),
fichajes_por_dia_horas_debug AS (
  SELECT 
    fb.empleadoId,
    fb.workday_date,
    -- Prioritate 1: Regularizare CONFIRMED
    MAX(CASE 
      WHEN fr.status = 'CONFIRMED' AND fr.effective_minutes IS NOT NULL
      THEN fr.effective_minutes / 60.0
      ELSE NULL
    END) AS horas_reg,
    -- Fallback: Suma DURACION din fichajes pentru acea zi
    SUM(CASE 
      WHEN fb.DURACION IS NOT NULL AND TRIM(fb.DURACION) <> '' AND fb.DURACION <> '00:00:00'
      THEN TIME_TO_SEC(fb.DURACION) / 3600.0
      ELSE 0
    END) AS horas_fichaje,
    GROUP_CONCAT(CONCAT(fb.tipo, ':', fb.duracion) SEPARATOR ', ') AS fichajes_detail
  FROM fichaje_base_debug fb
  LEFT JOIN FichajeRegularizacion fr 
    ON BINARY fr.employee_codigo = BINARY CAST('${codigo}' AS CHAR)
    AND fr.workday_date = fb.workday_date
    AND fr.status = 'CONFIRMED'
  WHERE fb.workday_date BETWEEN @d_first AND @d_today
  GROUP BY fb.empleadoId, fb.workday_date
)
SELECT 
  fpdh.workday_date,
  fpdh.horas_reg,
  fpdh.horas_fichaje,
  COALESCE(fpdh.horas_reg, fpdh.horas_fichaje, 0) AS horas_zi,
  fpdh.fichajes_detail
FROM fichajes_por_dia_horas_debug fpdh
ORDER BY fpdh.workday_date;
            `;
            try {
              const horasPontateDebug = await this.prisma.$queryRawUnsafe<
                any[]
              >(horasPontateDebugQuery);
              this.logger.log(`🔍 DEBUG horas_pontate para ${codigo}:`);
              this.logger.log(
                `📊 Total días con fichajes: ${horasPontateDebug.length}`,
              );
              let totalHoras = 0;
              for (const row of horasPontateDebug) {
                totalHoras += parseFloat(row.horas_zi || 0);
                this.logger.log(
                  `  ${row.workday_date}: horas_reg=${row.horas_reg || 'NULL'}, horas_fichaje=${row.horas_fichaje || 0}, horas_zi=${row.horas_zi || 0}, fichajes_detail=${row.fichajes_detail || 'NULL'}`,
                );
              }
              this.logger.log(
                `📊 Total horas_pontate calculadas: ${totalHoras}`,
              );
            } catch (horasPontateError: any) {
              this.logger.error(
                `❌ Error in horas_pontate debug query: ${horasPontateError?.message || horasPontateError}`,
              );
            }

            // Debug pentru plan_hasta_hoy
            const planHastaHoyDebugQuery = `
WITH RECURSIVE fechas AS (
  SELECT @d_first AS d
  UNION ALL
  SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM fechas WHERE d < @d_last
),
empleado_fechas AS (
  SELECT CAST('${codigo}' AS CHAR) AS empleadoId, f.d AS fecha, DAY(f.d) AS dia
  FROM fechas f
  WHERE f.d >= @d_first AND f.d <= @d_today
    AND DATE_FORMAT(f.d, '%Y-%m') = @lunaselectata
),
cuadrante_unpivot AS (
  SELECT CAST(cq.CODIGO AS CHAR) AS empleadoId, 1 AS dia, cq.ZI_1 AS val FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 2, cq.ZI_2 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 3, cq.ZI_3 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 4, cq.ZI_4 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 5, cq.ZI_5 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 6, cq.ZI_6 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 7, cq.ZI_7 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 8, cq.ZI_8 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 9, cq.ZI_9 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 10, cq.ZI_10 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 11, cq.ZI_11 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 12, cq.ZI_12 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 13, cq.ZI_13 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 14, cq.ZI_14 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 15, cq.ZI_15 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 16, cq.ZI_16 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 17, cq.ZI_17 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 18, cq.ZI_18 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 19, cq.ZI_19 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 20, cq.ZI_20 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 21, cq.ZI_21 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 22, cq.ZI_22 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 23, cq.ZI_23 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 24, cq.ZI_24 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 25, cq.ZI_25 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 26, cq.ZI_26 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 27, cq.ZI_27 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 28, cq.ZI_28 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 29, cq.ZI_29 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 30, cq.ZI_30 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 31, cq.ZI_31 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
),
cuadrante_dia_libre AS (
  SELECT
    cu.empleadoId,
    DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) AS fecha,
    1 AS es_libre
  FROM cuadrante_unpivot cu
  WHERE cu.dia >= 1 AND cu.dia <= 31
    AND DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) >= @d_first
    AND DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) <= @d_last
    AND UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X')
),
cuadrante_dia AS (
  SELECT
    cu.empleadoId,
    DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) AS fecha,
    cu.dia,
    CASE WHEN cu.val IS NOT NULL AND TRIM(cu.val) <> '' THEN 1 ELSE 0 END AS tiene_cuadrante,
    ROUND(
      CASE 
        WHEN UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
        WHEN TRIM(cu.val) LIKE '%:%-%:%' THEN 
          (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-',-1),' ',1), '%H:%i')) - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-', 1),' ',1), '%H:%i')) + 86400) % 86400) / 3600)
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h' THEN CAST(SUBSTRING_INDEX(TRIM(cu.val), 'h', 1) AS DECIMAL(10,2))
        ELSE 0
      END, 2
    ) AS horas_cuadrante_dia
  FROM cuadrante_unpivot cu
  WHERE cu.dia >= 1 AND cu.dia <= 31
    AND DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) >= @d_first
    AND DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) <= @d_last
),
horario_dia_m AS (
  SELECT
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    f.d AS fecha,
    DAY(f.d) AS dia,
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in1), CONCAT(f.d,' ',h.lun_out1)) + 1440) % 1440, 0)
      WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in1), CONCAT(f.d,' ',h.mar_out1)) + 1440) % 1440, 0)
      WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in1), CONCAT(f.d,' ',h.mie_out1)) + 1440) % 1440, 0)
      WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in1), CONCAT(f.d,' ',h.joi_out1)) + 1440) % 1440, 0)
      WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in1), CONCAT(f.d,' ',h.vin_out1)) + 1440) % 1440, 0)
      WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in1), CONCAT(f.d,' ',h.sam_out1)) + 1440) % 1440, 0)
      WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in1), CONCAT(f.d,' ',h.dum_out1)) + 1440) % 1440, 0)
      ELSE 0
    END AS m1,
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in2), CONCAT(f.d,' ',h.lun_out2)) + 1440) % 1440, 0)
      WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in2), CONCAT(f.d,' ',h.mar_out2)) + 1440) % 1440, 0)
      WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in2), CONCAT(f.d,' ',h.mie_out2)) + 1440) % 1440, 0)
      WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in2), CONCAT(f.d,' ',h.joi_out2)) + 1440) % 1440, 0)
      WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in2), CONCAT(f.d,' ',h.vin_out2)) + 1440) % 1440, 0)
      WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in2), CONCAT(f.d,' ',h.sam_out2)) + 1440) % 1440, 0)
      WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in2), CONCAT(f.d,' ',h.dum_out2)) + 1440) % 1440, 0)
      ELSE 0
    END AS m2,
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in3), CONCAT(f.d,' ',h.lun_out3)) + 1440) % 1440, 0)
      WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in3), CONCAT(f.d,' ',h.mie_out3)) + 1440) % 1440, 0)
      WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in3), CONCAT(f.d,' ',h.mie_out3)) + 1440) % 1440, 0)
      WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in3), CONCAT(f.d,' ',h.joi_out3)) + 1440) % 1440, 0)
      WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in3), CONCAT(f.d,' ',h.vin_out3)) + 1440) % 1440, 0)
      WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in3), CONCAT(f.d,' ',h.sam_out3)) + 1440) % 1440, 0)
      WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in3), CONCAT(f.d,' ',h.dum_out3)) + 1440) % 1440, 0)
      ELSE 0
    END AS m3
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  LEFT JOIN horarios h
    ON h.centro_nombre = de.\`CENTRO TRABAJO\`
    AND h.grupo_nombre = de.GRUPO
    AND h.vigente_desde <= f.d
    AND (h.vigente_hasta IS NULL OR f.d <= h.vigente_hasta)
  WHERE de.ESTADO = 'ACTIVO'
    AND f.d >= @d_first
    AND f.d <= @d_last
    AND CAST(de.CODIGO AS CHAR) = '${codigo}'
),
horario_dia AS (
  SELECT
    empleadoId,
    fecha,
    dia,
    ROUND(
      CASE 
        WHEN (m1 + m2 + m3) >= 1320 THEN GREATEST(m1, m2, m3) / 60
        ELSE (m1 + m2 + m3) / 60
      END
    , 2) AS horas_horario_dia
  FROM horario_dia_m
),
empleado_flags_debug AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    CASE 
      WHEN LOWER(TRIM(de.TrabajaFestivos)) IN ('si','sí','s','1','true','da','y') THEN 1
      ELSE 0
    END AS trabaja_festivos
  FROM DatosEmpleados de
  WHERE CAST(de.CODIGO AS CHAR) = '${codigo}'
),
empleado_ccaa_debug AS (
  SELECT CAST(de.CODIGO AS CHAR) AS empleadoId, @ccaa_default AS ccaa
  FROM DatosEmpleados de
  WHERE CAST(de.CODIGO AS CHAR) = '${codigo}'
),
bajas_dia_debug AS (
  SELECT 
    CAST('${codigo}' AS CHAR) AS empleadoId,
    f.d AS fecha,
    0 AS es_baja
  FROM fechas f
  WHERE 1=0  -- Nu verificăm bajas pentru moment în debug
),
aus_dia_debug AS (
  SELECT 
    CAST('${codigo}' AS CHAR) AS empleadoId,
    f.d AS fecha,
    0 AS es_vacaciones,
    0 AS es_ausencia,
    0 AS horas_ausencia_ore
  FROM fechas f
  WHERE 1=0  -- Nu verificăm ausencias pentru moment în debug
),
fiestas_dia_debug AS (
  SELECT 
    ec.empleadoId,
    f.d AS fecha,
    CASE 
      WHEN fi.active = 1
        AND DATE(COALESCE(fi.observed_date, fi.date)) = f.d
        AND (
          LOWER(fi.scope) IN ('nacional', 'national')
          OR (LOWER(fi.scope) IN ('autonómico', 'autonomico', 'ccaa') AND BINARY fi.ccaa_code = BINARY ec.ccaa)
        )
        AND COALESCE(tf.trabaja_festivos, 0) = 0
      THEN 1 ELSE 0
    END AS es_fiesta
  FROM empleado_ccaa_debug ec
  CROSS JOIN fechas f
  LEFT JOIN fiestas fi ON DATE(COALESCE(fi.observed_date, fi.date)) = f.d
  LEFT JOIN empleado_flags_debug tf ON BINARY tf.empleadoId = BINARY ec.empleadoId
),
daily_plan_debug AS (
  SELECT
    ef.empleadoId,
    ef.fecha,
    CASE
      WHEN bj.es_baja = 1 THEN 0
      WHEN COALESCE(au.es_vacaciones,0) = 1 THEN 0
      WHEN fd.es_fiesta = 1 AND COALESCE(tf.trabaja_festivos,0) = 0 THEN 0
      WHEN COALESCE(au.es_ausencia,0) = 1 THEN 0
      WHEN cdl.es_libre = 1 THEN 0
      WHEN cd.tiene_cuadrante = 1 THEN cd.horas_cuadrante_dia
      WHEN hd.horas_horario_dia IS NOT NULL AND hd.horas_horario_dia > 0 THEN hd.horas_horario_dia
      ELSE 0
    END AS horas_plan
  FROM empleado_fechas ef
  LEFT JOIN cuadrante_dia_libre cdl ON cdl.empleadoId = ef.empleadoId AND cdl.fecha = ef.fecha
  LEFT JOIN cuadrante_dia cd ON cd.empleadoId = ef.empleadoId AND cd.fecha = ef.fecha
  LEFT JOIN horario_dia hd ON hd.empleadoId = ef.empleadoId AND hd.fecha = ef.fecha
  LEFT JOIN bajas_dia_debug bj ON bj.empleadoId = ef.empleadoId AND bj.fecha = ef.fecha
  LEFT JOIN fiestas_dia_debug fd ON fd.empleadoId = ef.empleadoId AND fd.fecha = ef.fecha
  LEFT JOIN aus_dia_debug au ON au.empleadoId = ef.empleadoId AND au.fecha = ef.fecha
  LEFT JOIN empleado_flags_debug tf ON tf.empleadoId = ef.empleadoId
)
SELECT 
  empleadoId,
  ROUND(SUM(horas_plan), 2) AS horas_plan_hasta_hoy,
  COUNT(*) AS total_zile,
  SUM(CASE WHEN horas_plan > 0 THEN 1 ELSE 0 END) AS zile_cu_plan
FROM daily_plan_debug
WHERE fecha <= @d_today
GROUP BY empleadoId;
            `;
            try {
              const planHastaHoyDebug = await this.prisma.$queryRawUnsafe<
                any[]
              >(planHastaHoyDebugQuery);
              this.logger.log(`🔍 DEBUG plan_hasta_hoy para ${codigo}:`);
              if (planHastaHoyDebug.length > 0) {
                const row = planHastaHoyDebug[0];
                this.logger.log(
                  `  horas_plan_hasta_hoy: ${row.horas_plan_hasta_hoy || 0}, total_zile: ${row.total_zile || 0}, zile_cu_plan: ${row.zile_cu_plan || 0}`,
                );
              } else {
                this.logger.log(
                  `  No se encontró resultado para plan_hasta_hoy`,
                );
              }
            } catch (planHastaHoyError: any) {
              this.logger.error(
                `❌ Error in plan_hasta_hoy debug query: ${planHastaHoyError?.message || planHastaHoyError}`,
              );
            }

            // Debug pentru target_ajustat - verificăm HORAS DE CONTRATO și calculul pentru zilele lucrătoare
            const targetAjustatDebugQuery = `
WITH fechas AS (
  SELECT DATE_ADD(@d_first, INTERVAL seq.seq DAY) AS d
  FROM (
    SELECT 0 AS seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL
    SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL
    SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29 UNION ALL SELECT 30
  ) seq
  WHERE DATE_ADD(@d_first, INTERVAL seq.seq DAY) <= @d_last
),
empleado_flags AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    COALESCE(CAST(de.TrabajaFestivos AS UNSIGNED), 0) AS trabaja_festivos
  FROM DatosEmpleados de
  WHERE CAST(de.CODIGO AS CHAR) = '${codigo}'
),
bajas_dia AS (
  SELECT 
    CAST('${codigo}' AS CHAR) AS empleadoId,
    f.d AS fecha,
    0 AS es_baja
  FROM fechas f
  WHERE 1=0
),
aus_dia AS (
  SELECT 
    CAST('${codigo}' AS CHAR) AS empleadoId,
    f.d AS fecha,
    0 AS es_vacaciones
  FROM fechas f
  WHERE 1=0  -- Nu verificăm vacaciones pentru moment în debug
),
empleado_ccaa AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    @ccaa_default AS ccaa
  FROM DatosEmpleados de
  WHERE CAST(de.CODIGO AS CHAR) = '${codigo}'
),
fiestas_dia AS (
  SELECT 
    ec.empleadoId,
    f.d AS fecha,
    CASE WHEN fi.date IS NOT NULL THEN 1 ELSE 0 END AS es_fiesta
  FROM empleado_ccaa ec
  CROSS JOIN fechas f
  LEFT JOIN fiestas fi ON BINARY fi.scope = BINARY 'ccaa' AND BINARY fi.ccaa_code = BINARY ec.ccaa AND DATE(COALESCE(fi.observed_date, fi.date)) = f.d AND fi.active = 1
)
SELECT 
  CAST(de.CODIGO AS CHAR) AS empleadoId,
  CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) AS horas_contrato,
  CASE 
    WHEN CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) IS NOT NULL AND CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) > 0 THEN
      CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) / 5
    ELSE NULL
  END AS horas_pe_zi_contrato,
  COUNT(DISTINCT CASE 
    WHEN f.d <= @d_today
      AND DAYOFWEEK(f.d) BETWEEN 2 AND 6  -- Luni-Vineri
      AND COALESCE(bj.es_baja, 0) = 0
      AND COALESCE(au.es_vacaciones, 0) = 0
      AND (fd.es_fiesta = 0 OR COALESCE(tf.trabaja_festivos, 0) = 1)
    THEN f.d
  END) AS zile_lucratoare_pana_azi,
  ROUND(
    CASE 
      WHEN CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) IS NOT NULL AND CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) > 0 THEN
        (CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) / 5) * 
        COUNT(DISTINCT CASE 
          WHEN f.d <= @d_today
            AND DAYOFWEEK(f.d) BETWEEN 2 AND 6
            AND COALESCE(bj.es_baja, 0) = 0
            AND COALESCE(au.es_vacaciones, 0) = 0
            AND (fd.es_fiesta = 0 OR COALESCE(tf.trabaja_festivos, 0) = 1)
          THEN f.d
        END)
      ELSE 0
    END,
    2
  ) AS target_ajustat_calculat
FROM DatosEmpleados de
CROSS JOIN fechas f
LEFT JOIN empleado_flags tf ON BINARY tf.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
LEFT JOIN bajas_dia bj ON TRIM(BINARY bj.empleadoId) = TRIM(BINARY CAST(de.CODIGO AS CHAR)) AND bj.fecha = f.d
LEFT JOIN aus_dia au ON TRIM(BINARY au.empleadoId) = TRIM(BINARY CAST(de.CODIGO AS CHAR)) AND au.fecha = f.d
LEFT JOIN fiestas_dia fd ON TRIM(BINARY fd.empleadoId) = TRIM(BINARY CAST(de.CODIGO AS CHAR)) AND fd.fecha = f.d
WHERE de.ESTADO = 'ACTIVO'
  AND CAST(de.CODIGO AS CHAR) = '${codigo}'
GROUP BY de.CODIGO, de.\`HORAS DE CONTRATO\`;
`;

            try {
              const targetAjustatResults = await this.prisma.$queryRawUnsafe<
                any[]
              >(targetAjustatDebugQuery);
              this.logger.log(`🔍 DEBUG target_ajustat pentru ${codigo}:`);
              this.logger.log(
                `  horas_contrato: ${this.convertBigIntToNumber(targetAjustatResults[0]?.horas_contrato) || 'NULL'}`,
              );
              this.logger.log(
                `  horas_pe_zi_contrato: ${this.convertBigIntToNumber(targetAjustatResults[0]?.horas_pe_zi_contrato) || 'NULL'}`,
              );
              this.logger.log(
                `  zile_lucratoare_pana_azi: ${this.convertBigIntToNumber(targetAjustatResults[0]?.zile_lucratoare_pana_azi) || 'NULL'}`,
              );
              this.logger.log(
                `  target_ajustat_calculat: ${this.convertBigIntToNumber(targetAjustatResults[0]?.target_ajustat_calculat) || 'NULL'}`,
              );
            } catch (error) {
              this.logger.error(
                `❌ Error in target_ajustat debug query: ${error.message}`,
              );
            }

            // Debug pentru dias_neutre
            const diasNeutreDebugQuery = `
WITH fechas AS (
  SELECT DATE_ADD(@d_first, INTERVAL seq.seq DAY) AS d
  FROM (
    SELECT 0 AS seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL
    SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL
    SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29 UNION ALL SELECT 30
  ) seq
  WHERE DATE_ADD(@d_first, INTERVAL seq.seq DAY) <= @d_last
),
bajas_dia AS (
  SELECT 
    CAST('${codigo}' AS CHAR) AS empleadoId,
    f.d AS fecha,
    0 AS es_baja
  FROM fechas f
  WHERE 1=0  -- Nu verificăm bajas pentru moment
),
aus_raw AS (
  SELECT 
    CAST(a.\`CODIGO\` AS CHAR) AS empleadoId,
    TRIM(a.\`TIPO\`) AS tipo,
    a.\`DURACION\` AS duracion,
    TRIM(REPLACE(REPLACE(a.\`FECHA\`,'–','-'),'—','-')) AS fecha_txt
  FROM Ausencias a
  WHERE CAST(a.\`CODIGO\` AS CHAR) = '${codigo}'
),
aus_parts AS (
  SELECT
    empleadoId,
    tipo,
    duracion,
    CASE 
      WHEN fecha_txt LIKE '% %' 
        THEN TRIM(TRAILING '-' FROM SUBSTRING_INDEX(fecha_txt,' ',1))
      ELSE fecha_txt
    END AS start_raw,
    CASE 
      WHEN fecha_txt LIKE '% %' 
        THEN TRIM(LEADING '-' FROM SUBSTRING_INDEX(fecha_txt,' ',-1))
      ELSE fecha_txt
    END AS end_raw
  FROM aus_raw
),
aus_norm AS (
  SELECT
    empleadoId,
    tipo,
    duracion,
    COALESCE(STR_TO_DATE(start_raw, '%Y-%m-%d'), STR_TO_DATE(start_raw, '%Y-%m-%e')) AS d_start,
    COALESCE(STR_TO_DATE(end_raw, '%Y-%m-%d'), STR_TO_DATE(end_raw, '%Y-%m-%e')) AS d_end,
    CASE
      WHEN UPPER(tipo) = 'VACACIONES' THEN 0
      WHEN UPPER(tipo) LIKE '%ASUNTO PROPIO%' THEN 0
      WHEN UPPER(tipo) LIKE '%PERMISO%' THEN 0
      WHEN UPPER(tipo) LIKE '%BAJA%' THEN 0
      WHEN UPPER(tipo) LIKE '%AUSENCIA INJUSTIFICADA%' THEN 0
      WHEN UPPER(tipo) LIKE '%SALIDA SIN REGRESO%' THEN 1
      WHEN UPPER(tipo) LIKE '%SALIDA CENTRO%' THEN 1
      WHEN UPPER(tipo) LIKE '%ENTRADA CENTRO%' THEN 1
      WHEN duracion IS NOT NULL AND TRIM(duracion) != '' AND duracion != '00:00:00' THEN 1
      ELSE 0
    END AS es_pe_ore
  FROM aus_parts
),
aus_dia AS (
  SELECT 
    f.d AS fecha,
    n.empleadoId,
    MAX(CASE WHEN UPPER(n.tipo)='VACACIONES' AND n.d_start IS NOT NULL AND n.d_end IS NOT NULL THEN 1 ELSE 0 END) AS es_vacaciones,
    MAX(CASE WHEN UPPER(n.tipo)<> 'VACACIONES' AND n.es_pe_ore = 0 AND n.d_start IS NOT NULL AND n.d_end IS NOT NULL THEN 1 ELSE 0 END) AS es_ausencia,
    SUM(CASE WHEN n.es_pe_ore = 1 THEN 
      COALESCE(TIME_TO_SEC(STR_TO_DATE(n.duracion, '%H:%i:%s')) / 3600.0, 0)
      ELSE 0 
    END) AS horas_ausencia_ore
  FROM fechas f
  JOIN aus_norm n
    ON n.d_start IS NOT NULL 
    AND n.d_end IS NOT NULL
    AND f.d BETWEEN n.d_start AND n.d_end
  GROUP BY f.d, n.empleadoId
),
empleado_ccaa AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    @ccaa_default AS ccaa
  FROM DatosEmpleados de
  WHERE de.ESTADO = 'ACTIVO' AND CAST(de.CODIGO AS CHAR) = '${codigo}'
),
empleado_flags AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    CASE 
      WHEN LOWER(TRIM(de.TrabajaFestivos)) IN ('si','sí','s','1','true','da','y') THEN 1
      ELSE 0
    END AS trabaja_festivos
  FROM DatosEmpleados de
  WHERE de.ESTADO = 'ACTIVO' AND CAST(de.CODIGO AS CHAR) = '${codigo}'
),
fiestas_dia AS (
  SELECT 
    ec.empleadoId,
    f.d AS fecha,
    CASE 
      WHEN fi.active = 1
        AND DATE(COALESCE(fi.observed_date, fi.date)) = f.d
        AND (
          LOWER(fi.scope) IN ('nacional', 'national')
          OR (LOWER(fi.scope) IN ('autonómico', 'autonomico', 'ccaa') AND BINARY fi.ccaa_code = BINARY ec.ccaa)
        )
        AND COALESCE(tf.trabaja_festivos, 0) = 0
      THEN 1 ELSE 0
    END AS es_fiesta
  FROM empleado_ccaa ec
  CROSS JOIN fechas f
  LEFT JOIN fiestas fi ON DATE(COALESCE(fi.observed_date, fi.date)) = f.d
  LEFT JOIN empleado_flags tf ON BINARY tf.empleadoId = BINARY ec.empleadoId
  WHERE CAST(ec.empleadoId AS CHAR) = '${codigo}'
)
SELECT 
  f.d AS fecha,
  COALESCE(bj.es_baja, 0) AS es_baja,
  COALESCE(au.es_vacaciones, 0) AS es_vacaciones,
  COALESCE(fd.es_fiesta, 0) AS es_fiesta,
  CASE 
    WHEN f.d <= @d_today AND (COALESCE(bj.es_baja, 0) = 1 OR COALESCE(au.es_vacaciones, 0) = 1 OR COALESCE(fd.es_fiesta, 0) = 1) THEN 1
    ELSE 0
  END AS se_numara_hasta_hoy
FROM fechas f
LEFT JOIN bajas_dia bj ON bj.fecha = f.d AND CAST(bj.empleadoId AS CHAR) = '${codigo}'
LEFT JOIN aus_dia au ON au.fecha = f.d AND CAST(au.empleadoId AS CHAR) = '${codigo}'
LEFT JOIN fiestas_dia fd ON fd.fecha = f.d
WHERE f.d <= @d_today
  AND (COALESCE(bj.es_baja, 0) = 1 OR COALESCE(au.es_vacaciones, 0) = 1 OR COALESCE(fd.es_fiesta, 0) = 1)
ORDER BY f.d;
            `;
            try {
              const diasNeutreDebug =
                await this.prisma.$queryRawUnsafe<any[]>(diasNeutreDebugQuery);
              this.logger.log(`🔍 DEBUG dias_neutre pentru ${codigo}:`);
              this.logger.log(
                `📊 Total zile neutre până la @d_today: ${diasNeutreDebug.length}`,
              );
              let totalDias = 0;
              for (const row of diasNeutreDebug) {
                totalDias++;
                this.logger.log(
                  `  ${row.fecha}: es_baja=${row.es_baja}, es_vacaciones=${row.es_vacaciones}, es_fiesta=${row.es_fiesta}`,
                );
              }
              this.logger.log(`📊 Total dias_neutre calculate: ${totalDias}`);
            } catch (diasNeutreError: any) {
              this.logger.error(
                `❌ Error in dias_neutre debug query: ${diasNeutreError?.message || diasNeutreError}`,
              );
            }
          } catch (horasNeutreError: any) {
            this.logger.error(
              `❌ Error in horas_neutre debug query: ${horasNeutreError?.message || horasNeutreError}`,
            );
          }
        } catch (dailyPlanDebugError: any) {
          this.logger.error(
            `❌ Error in daily_plan debug query: ${dailyPlanDebugError?.message || dailyPlanDebugError}`,
          );
        }
      } catch (debugError: any) {
        this.logger.error(
          `❌ Error in fichajes debug query: ${debugError?.message || debugError}`,
        );
      }

      // Debug cuadrante_sum din query-ul principal
      const cuadranteSumDebugQuery = `
WITH cuadrante_unpivot AS (
  SELECT CAST(cq.CODIGO AS CHAR) AS empleadoId, 1 AS dia, cq.CENTRO AS centro_cuadrante, cq.ZI_1 AS val FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 2, cq.CENTRO, cq.ZI_2 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 3, cq.CENTRO, cq.ZI_3 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 4, cq.CENTRO, cq.ZI_4 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 5, cq.CENTRO, cq.ZI_5 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 6, cq.CENTRO, cq.ZI_6 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 7, cq.CENTRO, cq.ZI_7 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 8, cq.CENTRO, cq.ZI_8 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 9, cq.CENTRO, cq.ZI_9 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 10, cq.CENTRO, cq.ZI_10 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 11, cq.CENTRO, cq.ZI_11 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 12, cq.CENTRO, cq.ZI_12 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 13, cq.CENTRO, cq.ZI_13 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 14, cq.CENTRO, cq.ZI_14 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 15, cq.CENTRO, cq.ZI_15 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 16, cq.CENTRO, cq.ZI_16 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 17, cq.CENTRO, cq.ZI_17 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 18, cq.CENTRO, cq.ZI_18 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 19, cq.CENTRO, cq.ZI_19 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 20, cq.CENTRO, cq.ZI_20 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 21, cq.CENTRO, cq.ZI_21 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 22, cq.CENTRO, cq.ZI_22 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 23, cq.CENTRO, cq.ZI_23 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 24, cq.CENTRO, cq.ZI_24 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 25, cq.CENTRO, cq.ZI_25 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 26, cq.CENTRO, cq.ZI_26 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 27, cq.CENTRO, cq.ZI_27 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 28, cq.CENTRO, cq.ZI_28 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 29, cq.CENTRO, cq.ZI_29 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 30, cq.CENTRO, cq.ZI_30 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 31, cq.CENTRO, cq.ZI_31 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
),
cuadrante_sum AS (
  SELECT
    cu.empleadoId,
    MAX(cu.centro_cuadrante) AS centro_cuadrante,
    ROUND(SUM(
      CASE 
        WHEN UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
        WHEN TRIM(cu.val) LIKE '%:%-%:%' THEN (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-',-1),' ',1), '%H:%i'))
                                          - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-', 1),' ',1), '%H:%i'))
                                          + 86400) % 86400) / 3600)
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+×[0-9]+h\\)' THEN 
          CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val), '×', -1), 'h', 1) AS DECIMAL(10,2))
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h' THEN 
          CAST(SUBSTRING_INDEX(TRIM(cu.val), 'h', 1) AS DECIMAL(10,2))
        ELSE 0
      END
    ),2) AS horas_cuadrante_mes
  FROM cuadrante_unpivot cu
  GROUP BY cu.empleadoId
)
SELECT 
  cs.empleadoId,
  cs.horas_cuadrante_mes,
  CAST(de.CODIGO AS CHAR) AS codigo_empleado,
  CASE WHEN BINARY cs.empleadoId = BINARY CAST(de.CODIGO AS CHAR) THEN 'MATCH' ELSE 'NO_MATCH' END AS join_match
FROM cuadrante_sum cs
LEFT JOIN DatosEmpleados de ON BINARY cs.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
WHERE cs.empleadoId = '${codigo}' OR CAST(de.CODIGO AS CHAR) = '${codigo}'
LIMIT 10;
      `;

      const cuadranteSumDebug = await this.prisma.$queryRawUnsafe<any[]>(
        cuadranteSumDebugQuery,
      );
      this.logger.log(
        `🔍 DEBUG CUADRANTE_SUM din query principal pentru ${codigo}:`,
      );
      if (cuadranteSumDebug && cuadranteSumDebug.length > 0) {
        for (const row of cuadranteSumDebug) {
          this.logger.log(
            `  empleadoId: ${row.empleadoId}, horas_cuadrante_mes: ${this.convertBigIntToNumber(row.horas_cuadrante_mes) || 'NULL'}, codigo_empleado: ${row.codigo_empleado || 'NULL'}, join_match: ${row.join_match || 'NULL'}`,
          );
        }
      } else {
        this.logger.log(
          `  Nu există rânduri în cuadrante_sum pentru ${codigo}`,
        );
      }

      // Debug cuadrante_unpivot din query-ul principal
      const cuadranteUnpivotDebugQuery = `
SELECT 
  CAST(cq.CODIGO AS CHAR) AS empleadoId,
  cq.LUNA AS luna_raw,
  @lunaselectata AS luna_selectata,
  COUNT(*) AS total_rows
FROM cuadrante cq 
WHERE CAST(cq.CODIGO AS CHAR) = '${codigo}'
GROUP BY CAST(cq.CODIGO AS CHAR), cq.LUNA;
      `;

      const cuadranteUnpivotDebug = await this.prisma.$queryRawUnsafe<any[]>(
        cuadranteUnpivotDebugQuery,
      );
      this.logger.log(
        `🔍 DEBUG CUADRANTE_UNPIVOT din query principal pentru ${codigo}:`,
      );
      if (cuadranteUnpivotDebug && cuadranteUnpivotDebug.length > 0) {
        for (const row of cuadranteUnpivotDebug) {
          this.logger.log(
            `  empleadoId: ${row.empleadoId}, total_rows: ${this.convertBigIntToNumber(row.total_rows) || 'NULL'}`,
          );
        }
      } else {
        this.logger.log(
          `  Nu există rânduri în cuadrante pentru ${codigo} în ${mes}`,
        );
      }

      // Debug punctualitate - zile_cu_orar
      const punctualitateDebugQuery = `
WITH fechas AS (
  SELECT DATE_ADD(@d_first, INTERVAL seq.seq DAY) AS d
  FROM (
    SELECT 0 AS seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL
    SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL
    SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29 UNION ALL SELECT 30
  ) seq
  WHERE DATE_ADD(@d_first, INTERVAL seq.seq DAY) <= @d_last
),
empleado_orar AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    CASE WHEN COUNT(DISTINCT cq.CODIGO) > 0 THEN 1 ELSE 0 END AS has_cuadrante,
    CASE WHEN COUNT(DISTINCT h.id) > 0 THEN 1 ELSE 0 END AS has_horario,
    CASE WHEN COUNT(DISTINCT cq.CODIGO) > 0 OR COUNT(DISTINCT h.id) > 0 THEN 1 ELSE 0 END AS has_orar
  FROM DatosEmpleados de
  LEFT JOIN cuadrante cq ON CAST(cq.CODIGO AS CHAR) = CAST(de.CODIGO AS CHAR) AND cq.LUNA = @lunaselectata
  LEFT JOIN horarios h ON h.centro_nombre = de.\`CENTRO TRABAJO\` AND h.grupo_nombre = de.GRUPO
    AND h.vigente_desde <= @d_last AND (h.vigente_hasta IS NULL OR @d_first <= h.vigente_hasta)
  WHERE de.ESTADO = 'ACTIVO' AND CAST(de.CODIGO AS CHAR) = '${codigo}'
  GROUP BY de.CODIGO
),
cuadrante_unpivot_debug AS (
  SELECT CAST(cq.CODIGO AS CHAR) AS empleadoId, 1 AS dia, cq.ZI_1 AS val FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 2, cq.ZI_2 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 3, cq.ZI_3 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 4, cq.ZI_4 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 5, cq.ZI_5 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 6, cq.ZI_6 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 7, cq.ZI_7 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 8, cq.ZI_8 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 9, cq.ZI_9 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 10, cq.ZI_10 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 11, cq.ZI_11 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 12, cq.ZI_12 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 13, cq.ZI_13 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 14, cq.ZI_14 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 15, cq.ZI_15 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 16, cq.ZI_16 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 17, cq.ZI_17 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 18, cq.ZI_18 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 19, cq.ZI_19 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 20, cq.ZI_20 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 21, cq.ZI_21 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 22, cq.ZI_22 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 23, cq.ZI_23 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 24, cq.ZI_24 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 25, cq.ZI_25 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 26, cq.ZI_26 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 27, cq.ZI_27 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 28, cq.ZI_28 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 29, cq.ZI_29 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 30, cq.ZI_30 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 31, cq.ZI_31 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata AND CAST(cq.CODIGO AS CHAR) = '${codigo}'
),
cuadrante_val_dia AS (
  SELECT
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    f.d AS fecha,
    cu.val AS val_cuadrante
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  LEFT JOIN cuadrante_unpivot_debug cu ON BINARY cu.empleadoId = BINARY CAST(de.CODIGO AS CHAR) AND cu.dia = DAY(f.d)
  WHERE de.ESTADO = 'ACTIVO' AND CAST(de.CODIGO AS CHAR) = '${codigo}'
),
horario_start_dia AS (
  SELECT
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    f.d AS fecha,
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN h.lun_in1
      WHEN 3 THEN h.mar_in1
      WHEN 4 THEN h.mie_in1
      WHEN 5 THEN h.joi_in1
      WHEN 6 THEN h.vin_in1
      WHEN 7 THEN h.sam_in1
      WHEN 1 THEN h.dum_in1
      ELSE NULL
    END AS hora_in_planificata
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  LEFT JOIN horarios h
    ON h.centro_nombre = de.\`CENTRO TRABAJO\`
    AND h.grupo_nombre = de.GRUPO
    AND h.vigente_desde <= f.d
    AND (h.vigente_hasta IS NULL OR f.d <= h.vigente_hasta)
  WHERE de.ESTADO = 'ACTIVO' AND CAST(de.CODIGO AS CHAR) = '${codigo}'
)
SELECT 
  f.d AS fecha,
  eo.has_cuadrante,
  eo.has_horario,
  eo.has_orar,
  cvd.val_cuadrante,
  hsd.hora_in_planificata,
  CASE 
    WHEN eo.has_orar = 1
      AND f.d <= @d_today
      AND (
        (eo.has_cuadrante = 1 
         AND cvd.val_cuadrante IS NOT NULL 
         AND TRIM(cvd.val_cuadrante) != ''
         AND UPPER(TRIM(cvd.val_cuadrante)) NOT IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X')
         AND TRIM(cvd.val_cuadrante) LIKE '%:%-%:%')
        OR
        (eo.has_cuadrante = 0 AND hsd.hora_in_planificata IS NOT NULL)
      )
    THEN 1
    ELSE 0
  END AS se_numara
FROM fechas f
CROSS JOIN empleado_orar eo
LEFT JOIN cuadrante_val_dia cvd ON cvd.fecha = f.d
LEFT JOIN horario_start_dia hsd ON hsd.fecha = f.d AND eo.has_cuadrante = 0
WHERE f.d <= @d_today
ORDER BY f.d;
      `;
      try {
        const punctualitateDebug = await this.prisma.$queryRawUnsafe<any[]>(
          punctualitateDebugQuery,
        );
        this.logger.log(
          `🔍 DEBUG punctualitate zile_cu_orar pentru ${codigo}:`,
        );
        this.logger.log(
          `📊 Total zile verificate: ${punctualitateDebug.length}`,
        );
        let zileNumarate = 0;
        for (const row of punctualitateDebug) {
          if (row.se_numara === 1) {
            zileNumarate++;
            this.logger.log(
              `  ✅ ${row.fecha}: has_cuadrante=${row.has_cuadrante}, has_horario=${row.has_horario}, val_cuadrante=${row.val_cuadrante || 'NULL'}, hora_in_planificata=${row.hora_in_planificata || 'NULL'}, SE NUMARA`,
            );
          } else {
            this.logger.log(
              `  ⚪ ${row.fecha}: has_cuadrante=${row.has_cuadrante}, has_horario=${row.has_horario}, val_cuadrante=${row.val_cuadrante || 'NULL'}, hora_in_planificata=${row.hora_in_planificata || 'NULL'}, NU SE NUMARA`,
            );
          }
        }
        this.logger.log(
          `📊 Total zile numărate în zile_cu_orar: ${zileNumarate}`,
        );
      } catch (punctualitateError: any) {
        this.logger.error(
          `❌ Error in punctualitate debug query: ${punctualitateError?.message || punctualitateError}`,
        );
      }

      // Execută query-ul (același ca pentru toți angajații)
      const results = await this.prisma.$queryRawUnsafe(
        this.buildCalculateQuery(),
      );

      let processed = 0;
      for (const row of results as any[]) {
        if (row.empleadoId !== codigo) continue; // Skip dacă nu este angajatul dorit

        try {
          const breakdownJson =
            typeof row.breakdown_json === 'string'
              ? JSON.parse(row.breakdown_json)
              : row.breakdown_json;

          this.logger.log(
            `📊 Breakdown pentru ${codigo}: fichajes_incompleto=${breakdownJson?.fichajes_incompleto || 0}`,
          );
          this.logger.log(
            `🔍 DEBUG target_initial în breakdown_json pentru ${codigo}: ${breakdownJson?.target_initial || 'NULL'}`,
          );
          this.logger.log(
            `🔍 DEBUG target_ajustat în breakdown_json pentru ${codigo}: ${breakdownJson?.target_ajustat || 'NULL'}`,
          );
          this.logger.log(
            `🔍 DEBUG target_initial_debug_val din query pentru ${codigo}: ${row.target_initial_debug_val || 'NULL'}`,
          );
          this.logger.log(
            `🔍 DEBUG ta_cs_horas_debug din query pentru ${codigo}: ${row.ta_cs_horas_debug || 'NULL'}`,
          );
          this.logger.log(
            `🔍 DEBUG ta_hm_horas_debug din query pentru ${codigo}: ${row.ta_hm_horas_debug || 'NULL'}`,
          );
          this.logger.log(
            `🔍 DEBUG cs_horas_debug din query pentru ${codigo}: ${row.cs_horas_debug || 'NULL'}`,
          );
          this.logger.log(
            `🔍 DEBUG hm_horas_debug din query pentru ${codigo}: ${row.hm_horas_debug || 'NULL'}`,
          );
          this.logger.log(
            `🔍 DEBUG score_responsabilidad_digital din query pentru ${codigo}: ${row.score_responsabilidad_digital !== undefined && row.score_responsabilidad_digital !== null ? row.score_responsabilidad_digital : 'NULL/UNDEFINED'}`,
          );

          await this.prisma.hallOfFameMensual.upsert({
            where: {
              empleado_codigo_mes: {
                empleado_codigo: row.empleadoId,
                mes: mes,
              },
            },
            update: {
              ano: parseInt(year, 10),
              score_final: row.score_final ? Number(row.score_final) : null,
              score_indeplinire: row.score_indeplinire
                ? Number(row.score_indeplinire)
                : null,
              score_calitate: row.score_calitate
                ? Number(row.score_calitate)
                : null,
              score_punctualitate: row.score_punctualitate
                ? Number(row.score_punctualitate)
                : null,
              score_uso_app: row.score_uso_app
                ? Number(row.score_uso_app)
                : null,
              score_responsabilidad_digital: row.score_responsabilidad_digital !== undefined && row.score_responsabilidad_digital !== null
                ? Number(row.score_responsabilidad_digital)
                : breakdownJson?.score_responsabilidad_digital !== undefined && breakdownJson?.score_responsabilidad_digital !== null
                  ? Number(breakdownJson.score_responsabilidad_digital)
                  : null,
              horas_pontate: parseFloat(row.breakdown_json?.horas_pontate || 0),
              target_ajustat: parseFloat(
                row.breakdown_json?.target_ajustat || 0,
              ),
              target_initial: parseFloat(
                row.breakdown_json?.target_initial || 0,
              ),
              horas_neutre: parseFloat(row.breakdown_json?.horas_neutre || 0),
              dias_neutre: parseInt(row.breakdown_json?.dias_neutre || 0, 10),
              fichajes_incompleto: parseInt(
                row.breakdown_json?.fichajes_incompleto || 0,
                10,
              ),
              regularizaciones_confirmed: parseInt(
                row.breakdown_json?.regularizaciones_confirmed || 0,
                10,
              ),
              regularizaciones_pendiente: parseInt(
                row.breakdown_json?.regularizaciones_pendiente || 0,
                10,
              ),
              zile_punctuale: parseInt(
                row.breakdown_json?.zile_punctuale || 0,
                10,
              ),
              zile_cu_orar: parseInt(row.breakdown_json?.zile_cu_orar || 0, 10),
              has_orar: Boolean(row.breakdown_json?.has_orar),
              acciones_totales: parseFloat(
                row.breakdown_json?.acciones_totales || 0,
              ),
              max_acciones_mes: parseFloat(
                row.breakdown_json?.max_acciones_mes || 0,
              ),
              breakdown_json: breakdownJson || null,
              ranking: null,
              updated_at: new Date(),
            },
            create: {
              empleado_codigo: row.empleadoId,
              mes: mes,
              ano: parseInt(year, 10),
              score_final: row.score_final ? Number(row.score_final) : null,
              score_indeplinire: row.score_indeplinire
                ? Number(row.score_indeplinire)
                : null,
              score_calitate: row.score_calitate
                ? Number(row.score_calitate)
                : null,
              score_punctualitate: row.score_punctualitate
                ? Number(row.score_punctualitate)
                : null,
              score_uso_app: row.score_uso_app
                ? Number(row.score_uso_app)
                : null,
              score_responsabilidad_digital: row.score_responsabilidad_digital !== undefined && row.score_responsabilidad_digital !== null
                ? Number(row.score_responsabilidad_digital)
                : breakdownJson?.score_responsabilidad_digital !== undefined && breakdownJson?.score_responsabilidad_digital !== null
                  ? Number(breakdownJson.score_responsabilidad_digital)
                  : null,
              horas_pontate: parseFloat(row.breakdown_json?.horas_pontate || 0),
              target_ajustat: parseFloat(
                row.breakdown_json?.target_ajustat || 0,
              ),
              target_initial: parseFloat(
                row.breakdown_json?.target_initial || 0,
              ),
              horas_neutre: parseFloat(row.breakdown_json?.horas_neutre || 0),
              dias_neutre: parseInt(row.breakdown_json?.dias_neutre || 0, 10),
              fichajes_incompleto: parseInt(
                row.breakdown_json?.fichajes_incompleto || 0,
                10,
              ),
              regularizaciones_confirmed: parseInt(
                row.breakdown_json?.regularizaciones_confirmed || 0,
                10,
              ),
              regularizaciones_pendiente: parseInt(
                row.breakdown_json?.regularizaciones_pendiente || 0,
                10,
              ),
              zile_punctuale: parseInt(
                row.breakdown_json?.zile_punctuale || 0,
                10,
              ),
              zile_cu_orar: parseInt(row.breakdown_json?.zile_cu_orar || 0, 10),
              has_orar: Boolean(row.breakdown_json?.has_orar),
              acciones_totales: parseFloat(
                row.breakdown_json?.acciones_totales || 0,
              ),
              max_acciones_mes: parseFloat(
                row.breakdown_json?.max_acciones_mes || 0,
              ),
              breakdown_json: breakdownJson || null,
              ranking: null,
            },
          });

          processed++;
        } catch (error) {
          this.logger.error(
            `Error saving score for ${row.empleadoId}: ${error.message}`,
          );
        }
      }

      // Recalculează ranking-ul după ce scorul este salvat
      await this.recalculateRankings(mes);

      this.logger.log(
        `✅ Calculated and saved score for employee ${codigo} for ${mes}`,
      );
      return { success: true, processed };
    } catch (error) {
      this.logger.error(
        `Error calculating score for ${codigo}/${mes}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error calculating score: ${error.message}`,
      );
    }
  }

  /**
   * Calculează și salvează scorurile lunare pentru toți angajații
   */
  async calculateMonthlyScores(
    mes: string,
  ): Promise<{ success: boolean; processed: number }> {
    if (!mes) {
      throw new BadRequestException('mes is required');
    }

    // Validate mes format (YYYY-MM)
    const mesRegex = /^\d{4}-\d{2}$/;
    if (!mesRegex.test(mes)) {
      throw new BadRequestException('mes must be in format YYYY-MM');
    }

    const [ano] = mes.split('-');
    const anoInt = parseInt(ano, 10);

    try {
      // Execute SET statements first (Prisma doesn't support multiple statements in one call)
      // Each SET must be executed separately
      await this.prisma.$executeRawUnsafe(`SET @lunaselectata = '${mes}'`);
      await this.prisma.$executeRawUnsafe(`SET @ccaa_default = 'ES-MD'`);
      await this.prisma.$executeRawUnsafe(
        `SET @d_first := STR_TO_DATE(CONCAT(@lunaselectata, '-01'), '%Y-%m-%d')`,
      );
      await this.prisma.$executeRawUnsafe(`SET @d_last := LAST_DAY(@d_first)`);
      // Pentru luna curentă, limitează la azi; pentru luni în trecut, folosește @d_last
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const mesToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const d_today = mes === mesToday ? todayStr : `@d_last`;
      await this.prisma.$executeRawUnsafe(
        `SET @d_today = ${d_today === '@d_last' ? '@d_last' : `'${d_today}'`};`,
      );

      // Build and execute main query
      const query = this.buildCalculateQuery();

      this.logger.log(`Calculating Hall of Fame scores for ${mes}...`);
      const results = await this.prisma.$queryRawUnsafe<any[]>(query);

      if (!results || results.length === 0) {
        this.logger.warn(`No results found for ${mes}`);
        return { success: true, processed: 0 };
      }

      // Save results to database
      let processed = 0;
      for (const row of results) {
        try {
          await this.prisma.hallOfFameMensual.upsert({
            where: {
              empleado_codigo_mes: {
                empleado_codigo: row.empleadoId,
                mes: mes,
              },
            },
            create: {
              empleado_codigo: row.empleadoId,
              mes: mes,
              ano: anoInt,
              score_final: row.score_final,
              score_indeplinire: row.score_indeplinire,
              score_calitate: row.score_calitate,
              score_punctualitate: row.score_punctualitate,
              score_uso_app: row.score_uso_app,
              score_responsabilidad_digital: row.score_responsabilidad_digital !== undefined && row.score_responsabilidad_digital !== null
                ? Number(row.score_responsabilidad_digital)
                : null,
              horas_pontate: parseFloat(row.breakdown_json?.horas_pontate || 0),
              target_ajustat: parseFloat(
                row.breakdown_json?.target_ajustat || 0,
              ),
              target_initial: parseFloat(
                row.breakdown_json?.target_initial || 0,
              ),
              horas_neutre: parseFloat(row.breakdown_json?.horas_neutre || 0),
              dias_neutre: parseInt(row.breakdown_json?.dias_neutre || 0, 10),
              fichajes_incompleto: parseInt(
                row.breakdown_json?.fichajes_incompleto || 0,
                10,
              ),
              regularizaciones_confirmed: parseInt(
                row.breakdown_json?.regularizaciones_confirmed || 0,
                10,
              ),
              regularizaciones_pendiente: parseInt(
                row.breakdown_json?.regularizaciones_pendiente || 0,
                10,
              ),
              zile_punctuale: parseInt(
                row.breakdown_json?.zile_punctuale || 0,
                10,
              ),
              zile_cu_orar: parseInt(row.breakdown_json?.zile_cu_orar || 0, 10),
              has_orar: Boolean(row.breakdown_json?.has_orar),
              acciones_totales: parseFloat(
                row.breakdown_json?.acciones_totales || 0,
              ),
              max_acciones_mes: parseFloat(
                row.breakdown_json?.max_acciones_mes || 0,
              ),
              breakdown_json: row.breakdown_json || null,
              ranking: null, // Va fi actualizat în recalculateRankings
            },
            update: {
              score_final: row.score_final,
              score_indeplinire: row.score_indeplinire,
              score_calitate: row.score_calitate,
              score_punctualitate: row.score_punctualitate,
              score_uso_app: row.score_uso_app,
              score_responsabilidad_digital: row.score_responsabilidad_digital !== undefined && row.score_responsabilidad_digital !== null
                ? Number(row.score_responsabilidad_digital)
                : null,
              horas_pontate: parseFloat(row.breakdown_json?.horas_pontate || 0),
              target_ajustat: parseFloat(
                row.breakdown_json?.target_ajustat || 0,
              ),
              target_initial: parseFloat(
                row.breakdown_json?.target_initial || 0,
              ),
              horas_neutre: parseFloat(row.breakdown_json?.horas_neutre || 0),
              dias_neutre: parseInt(row.breakdown_json?.dias_neutre || 0, 10),
              fichajes_incompleto: parseInt(
                row.breakdown_json?.fichajes_incompleto || 0,
                10,
              ),
              regularizaciones_confirmed: parseInt(
                row.breakdown_json?.regularizaciones_confirmed || 0,
                10,
              ),
              regularizaciones_pendiente: parseInt(
                row.breakdown_json?.regularizaciones_pendiente || 0,
                10,
              ),
              zile_punctuale: parseInt(
                row.breakdown_json?.zile_punctuale || 0,
                10,
              ),
              zile_cu_orar: parseInt(row.breakdown_json?.zile_cu_orar || 0, 10),
              has_orar: Boolean(row.breakdown_json?.has_orar),
              acciones_totales: parseFloat(
                row.breakdown_json?.acciones_totales || 0,
              ),
              max_acciones_mes: parseFloat(
                row.breakdown_json?.max_acciones_mes || 0,
              ),
              breakdown_json: row.breakdown_json || null,
              ranking: null, // Va fi actualizat în recalculateRankings
              updated_at: new Date(),
            },
          });

          processed++;
        } catch (error) {
          this.logger.error(
            `Error saving score for ${row.empleadoId}: ${error.message}`,
          );
        }
      }

      // Recalculează ranking-urile după ce toate scorurile sunt salvate
      await this.recalculateRankings(mes);

      this.logger.log(`✅ Calculated and saved ${processed} scores for ${mes}`);
      return { success: true, processed };
    } catch (error) {
      this.logger.error(
        `Error calculating scores for ${mes}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error calculating scores: ${error.message}`,
      );
    }
  }

  /**
   * Returnează clasamentul pentru o lună
   */
  async getRanking(mes: string, limit?: number): Promise<any[]> {
    if (!mes) {
      throw new BadRequestException('mes is required');
    }

    const mesRegex = /^\d{4}-\d{2}$/;
    if (!mesRegex.test(mes)) {
      throw new BadRequestException('mes must be in format YYYY-MM');
    }

    const results = await this.prisma.hallOfFameMensual.findMany({
      where: {
        mes: mes,
        // Excludem angajații pentru probe/teste (ex: 10000001) - doar cei cu ranking valid
        ranking: { not: null },
        empleado_codigo: { not: '10000001' }, // Excludere suplimentară pentru siguranță
      },
      orderBy: [
        { ranking: 'asc' }, // Ordonează după ranking (1, 2, 3...)
        { score_final: 'desc' },
        { score_uso_app: 'desc' },
      ],
      // limit=0 înseamnă "toți" (fără limită)
      take: limit && limit > 0 ? limit : undefined,
    });

    // Enrich with employee names
    const enriched = await Promise.all(
      results.map(async (row) => {
        const empleado = await this.prisma.user.findUnique({
          where: { CODIGO: row.empleado_codigo },
          select: {
            CODIGO: true,
            NOMBRE_APELLIDOS: true,
            GRUPO: true,
          },
        });

        // breakdown_json este deja un obiect în Prisma (tip Json)
        // Convert explicit Decimal fields to numbers
        const breakdownJson = (row.breakdown_json as any) || {};
        const convertedRow = {
          ...row,
          empleadoNombre: empleado?.NOMBRE_APELLIDOS || row.empleado_codigo,
          grupo: empleado?.GRUPO || null,
          breakdown_json: row.breakdown_json || null,
          score_final: row.score_final ? Number(row.score_final) : null,
          score_indeplinire: row.score_indeplinire
            ? Number(row.score_indeplinire)
            : null,
          score_calitate: row.score_calitate
            ? Number(row.score_calitate)
            : null,
          score_punctualitate: row.score_punctualitate
            ? Number(row.score_punctualitate)
            : null,
          score_uso_app: row.score_uso_app ? Number(row.score_uso_app) : null,
          score_responsabilidad_digital: row.score_responsabilidad_digital
            ? Number(row.score_responsabilidad_digital)
            : breakdownJson.score_responsabilidad_digital
              ? Number(breakdownJson.score_responsabilidad_digital)
              : null,
          horas_pontate: row.horas_pontate ? Number(row.horas_pontate) : null,
          target_ajustat: row.target_ajustat
            ? Number(row.target_ajustat)
            : null,
          target_initial: row.target_initial
            ? Number(row.target_initial)
            : null,
          horas_neutre: row.horas_neutre ? Number(row.horas_neutre) : null,
          acciones_totales: row.acciones_totales
            ? Number(row.acciones_totales)
            : null,
          max_acciones_mes: row.max_acciones_mes
            ? Number(row.max_acciones_mes)
            : null,
        };
        return convertedRow;
      }),
    );

    // Convert BigInt to Number for JSON serialization
    return this.convertBigIntToNumber(enriched);
  }

  /**
   * Returnează breakdown-ul pentru un angajat specific
   */
  async getEmployeeBreakdown(codigo: string, mes: string): Promise<any | null> {
    if (!codigo || !mes) {
      throw new BadRequestException('codigo and mes are required');
    }

    const mesRegex = /^\d{4}-\d{2}$/;
    if (!mesRegex.test(mes)) {
      throw new BadRequestException('mes must be in format YYYY-MM');
    }

    const result = await this.prisma.hallOfFameMensual.findUnique({
      where: {
        empleado_codigo_mes: {
          empleado_codigo: codigo,
          mes: mes,
        },
      },
    });

    if (!result) {
      return null;
    }

    const empleado = await this.prisma.user.findUnique({
      where: { CODIGO: codigo },
      select: {
        CODIGO: true,
        NOMBRE_APELLIDOS: true,
        GRUPO: true,
      },
    });

    // breakdown_json este deja un obiect în Prisma (tip Json)
    // Convert explicit Decimal fields to numbers
    const breakdownJson = (result.breakdown_json as any) || {};
    const response = {
      ...result,
      empleadoNombre: empleado?.NOMBRE_APELLIDOS || codigo,
      grupo: empleado?.GRUPO || null,
      breakdown_json: result.breakdown_json || null,
      score_final: result.score_final ? Number(result.score_final) : null,
      score_indeplinire: result.score_indeplinire
        ? Number(result.score_indeplinire)
        : null,
      score_calitate: result.score_calitate
        ? Number(result.score_calitate)
        : null,
      score_punctualitate: result.score_punctualitate
        ? Number(result.score_punctualitate)
        : null,
      score_uso_app: result.score_uso_app ? Number(result.score_uso_app) : null,
      score_responsabilidad_digital: result.score_responsabilidad_digital
        ? Number(result.score_responsabilidad_digital)
        : breakdownJson.score_responsabilidad_digital
          ? Number(breakdownJson.score_responsabilidad_digital)
          : null,
      horas_pontate: result.horas_pontate ? Number(result.horas_pontate) : null,
      target_ajustat: result.target_ajustat
        ? Number(result.target_ajustat)
        : null,
      target_initial: result.target_initial
        ? Number(result.target_initial)
        : null,
      horas_neutre: result.horas_neutre ? Number(result.horas_neutre) : null,
      acciones_totales: result.acciones_totales
        ? Number(result.acciones_totales)
        : null,
      max_acciones_mes: result.max_acciones_mes
        ? Number(result.max_acciones_mes)
        : null,
    };

    // Convert BigInt to Number for JSON serialization
    return this.convertBigIntToNumber(response);
  }

  /**
   * Calculează ranking-ul pentru un scor
   * Ranking-ul se calculează după ce toate scorurile sunt salvate
   */
  private async calculateRanking(
    mes: string,
    scoreFinal: number,
  ): Promise<number> {
    // Numără câte înregistrări au scor mai mare
    const count = await this.prisma.hallOfFameMensual.count({
      where: {
        mes: mes,
        score_final: {
          gt: scoreFinal,
        },
      },
    });

    return count + 1;
  }

  /**
   * Recalculează ranking-urile pentru o lună (după ce toate scorurile sunt salvate)
   */
  private async recalculateRankings(mes: string): Promise<void> {
    const allScores = await this.prisma.hallOfFameMensual.findMany({
      where: { mes: mes },
      orderBy: [{ score_final: 'desc' }, { score_uso_app: 'desc' }],
    });

    // Update ranking pentru fiecare înregistrare
    // Excludem angajații pentru probe/teste (ex: 10000001) - le setăm ranking = NULL
    let rankingCounter = 1;
    for (let i = 0; i < allScores.length; i++) {
      const empleadoCodigo = allScores[i].empleado_codigo;

      // Excludem angajații pentru probe/teste din ranking
      if (empleadoCodigo === '10000001') {
        await this.prisma.hallOfFameMensual.update({
          where: { id: allScores[i].id },
          data: { ranking: null }, // NULL = nu apare în clasament
        });
      } else {
        await this.prisma.hallOfFameMensual.update({
          where: { id: allScores[i].id },
          data: { ranking: rankingCounter },
        });
        rankingCounter++;
      }
    }
  }

  /**
   * Construiește query-ul SQL pentru calcul
   * Notă: Luna este setată prin variabile SQL (@lunaselectata) înainte de apelarea acestei funcții
   */
  private buildCalculateQuery(): string {
    // SET statements are executed separately, so we only need the main query here
    const sqlTemplate = `
WITH RECURSIVE fechas AS (
  SELECT @d_first AS d
  UNION ALL
  SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM fechas WHERE d < @d_last
),

empleado_flags AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    CASE 
      WHEN LOWER(TRIM(de.TrabajaFestivos)) IN ('si','sí','s','1','true','da','y') THEN 1
      ELSE 0
    END AS trabaja_festivos
  FROM DatosEmpleados de
  WHERE de.ESTADO = 'ACTIVO'
),

empleado_ccaa AS (
  SELECT CAST(de.CODIGO AS CHAR)  AS empleadoId, @ccaa_default AS ccaa
  FROM DatosEmpleados de
  WHERE de.ESTADO = 'ACTIVO'
),

cuadrante_unpivot AS (
  SELECT CAST(cq.CODIGO AS CHAR)  AS empleadoId, 1 AS dia, cq.CENTRO AS centro_cuadrante, cq.ZI_1 AS val FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 2, cq.CENTRO, cq.ZI_2 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 3, cq.CENTRO, cq.ZI_3 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 4, cq.CENTRO, cq.ZI_4 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 5, cq.CENTRO, cq.ZI_5 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 6, cq.CENTRO, cq.ZI_6 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 7, cq.CENTRO, cq.ZI_7 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 8, cq.CENTRO, cq.ZI_8 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 9, cq.CENTRO, cq.ZI_9 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 10, cq.CENTRO, cq.ZI_10 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 11, cq.CENTRO, cq.ZI_11 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 12, cq.CENTRO, cq.ZI_12 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 13, cq.CENTRO, cq.ZI_13 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 14, cq.CENTRO, cq.ZI_14 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 15, cq.CENTRO, cq.ZI_15 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 16, cq.CENTRO, cq.ZI_16 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 17, cq.CENTRO, cq.ZI_17 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 18, cq.CENTRO, cq.ZI_18 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 19, cq.CENTRO, cq.ZI_19 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 20, cq.CENTRO, cq.ZI_20 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 21, cq.CENTRO, cq.ZI_21 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 22, cq.CENTRO, cq.ZI_22 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 23, cq.CENTRO, cq.ZI_23 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 24, cq.CENTRO, cq.ZI_24 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 25, cq.CENTRO, cq.ZI_25 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 26, cq.CENTRO, cq.ZI_26 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 27, cq.CENTRO, cq.ZI_27 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 28, cq.CENTRO, cq.ZI_28 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 29, cq.CENTRO, cq.ZI_29 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 30, cq.CENTRO, cq.ZI_30 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR) , 31, cq.CENTRO, cq.ZI_31 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
),

cuadrante_dia AS (
  SELECT
    cu.empleadoId,
    DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) AS fecha,
    cu.dia,
    CASE WHEN cu.val IS NOT NULL AND TRIM(cu.val) <> '' THEN 1 ELSE 0 END AS tiene_cuadrante,
    ROUND(
      CASE 
        WHEN UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
        WHEN TRIM(cu.val) LIKE '%:%-%:%' THEN 
          -- Format "08:00-17:00" sau "09:00-15:00 / 16:00-20:00"
          -- Pentru moment, calculăm doar prima tură (pentru compatibilitate)
          -- Logica completă pentru ture multiple va fi implementată în frontend
          (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-',-1),' ',1), '%H:%i'))
                                           - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-', 1),' ',1), '%H:%i'))
                                           + 86400) % 86400) / 3600)
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+×[0-9]+h\\)' THEN 
          -- Format "24h (3×8h)" - extrage orele per tură din paranteză (8h)
          CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val), '×', -1), 'h', 1) AS DECIMAL(10,2))
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h' THEN 
          CAST(SUBSTRING_INDEX(TRIM(cu.val), 'h', 1) AS DECIMAL(10,2))
        ELSE 0
      END
    ,2) AS horas_cuadrante_dia
  FROM cuadrante_unpivot cu
  WHERE cu.dia >= 1 AND cu.dia <= 31
    AND DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) >= @d_first
    AND DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) <= @d_last
),

horario_dia_m AS (
  SELECT
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    f.d AS fecha,
    DAY(f.d) AS dia,
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in1), CONCAT(f.d,' ',h.lun_out1)) + 1440) % 1440, 0)
      WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in1), CONCAT(f.d,' ',h.mar_out1)) + 1440) % 1440, 0)
      WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in1), CONCAT(f.d,' ',h.mie_out1)) + 1440) % 1440, 0)
      WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in1), CONCAT(f.d,' ',h.joi_out1)) + 1440) % 1440, 0)
      WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in1), CONCAT(f.d,' ',h.vin_out1)) + 1440) % 1440, 0)
      WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in1), CONCAT(f.d,' ',h.sam_out1)) + 1440) % 1440, 0)
      WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in1), CONCAT(f.d,' ',h.dum_out1)) + 1440) % 1440, 0)
      ELSE 0
    END AS m1,
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in2), CONCAT(f.d,' ',h.lun_out2)) + 1440) % 1440, 0)
      WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in2), CONCAT(f.d,' ',h.mar_out2)) + 1440) % 1440, 0)
      WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in2), CONCAT(f.d,' ',h.mie_out2)) + 1440) % 1440, 0)
      WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in2), CONCAT(f.d,' ',h.joi_out2)) + 1440) % 1440, 0)
      WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in2), CONCAT(f.d,' ',h.vin_out2)) + 1440) % 1440, 0)
      WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in2), CONCAT(f.d,' ',h.sam_out2)) + 1440) % 1440, 0)
      WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in2), CONCAT(f.d,' ',h.dum_out2)) + 1440) % 1440, 0)
      ELSE 0
    END AS m2,
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in3), CONCAT(f.d,' ',h.lun_out3)) + 1440) % 1440, 0)
      WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in3), CONCAT(f.d,' ',h.mar_out3)) + 1440) % 1440, 0)
      WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in3), CONCAT(f.d,' ',h.mie_out3)) + 1440) % 1440, 0)
      WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in3), CONCAT(f.d,' ',h.joi_out3)) + 1440) % 1440, 0)
      WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in3), CONCAT(f.d,' ',h.vin_out3)) + 1440) % 1440, 0)
      WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in3), CONCAT(f.d,' ',h.sam_out3)) + 1440) % 1440, 0)
      WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in3), CONCAT(f.d,' ',h.dum_out3)) + 1440) % 1440, 0)
      ELSE 0
    END AS m3
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  LEFT JOIN horarios h
    ON h.centro_nombre = de.\`CENTRO TRABAJO\`
    AND h.grupo_nombre = de.GRUPO
    AND h.vigente_desde <= f.d
    AND (h.vigente_hasta IS NULL OR f.d <= h.vigente_hasta)
  WHERE de.ESTADO = 'ACTIVO'
    AND f.d >= @d_first
    AND f.d <= @d_last
),

horario_dia AS (
  SELECT
    empleadoId,
    fecha,
    dia,
    ROUND(
      CASE 
        WHEN (m1 + m2 + m3) >= 1320 THEN GREATEST(m1, m2, m3) / 60
        ELSE (m1 + m2 + m3) / 60
      END
    , 2) AS horas_horario_dia
  FROM horario_dia_m
),

bajas_raw AS (
  SELECT
    TRIM(CAST(mc.Codigo_Empleado AS CHAR)) AS empleadoId,
    mc.\`Fecha baja\` AS fecha_baja_raw,
    mc.\`Fecha de alta\` AS fecha_alta_raw
  FROM MutuaCasos mc
),

bajas_intervalos AS (
  SELECT
    empleadoId,
    CASE 
      WHEN NULLIF(fecha_baja_raw, '') IS NULL THEN NULL
      WHEN fecha_baja_raw REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN DATE(fecha_baja_raw)
      WHEN fecha_baja_raw LIKE '__/__/____' THEN STR_TO_DATE(fecha_baja_raw, '%d/%m/%Y')
      ELSE NULL
    END AS d_ini,
    COALESCE(
      CASE 
        WHEN NULLIF(fecha_alta_raw, '') IS NULL THEN NULL
        WHEN fecha_alta_raw REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN DATE(fecha_alta_raw)
        WHEN fecha_alta_raw LIKE '__/__/____' THEN STR_TO_DATE(fecha_alta_raw, '%d/%m/%Y')
        ELSE NULL
      END,
      @d_last
    ) AS d_fin
  FROM bajas_raw
  WHERE 
    CASE 
      WHEN NULLIF(fecha_baja_raw, '') IS NULL THEN NULL
      WHEN fecha_baja_raw REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN DATE(fecha_baja_raw)
      WHEN fecha_baja_raw LIKE '__/__/____' THEN STR_TO_DATE(fecha_baja_raw, '%d/%m/%Y')
      ELSE NULL
    END IS NOT NULL
    AND 
    CASE 
      WHEN NULLIF(fecha_baja_raw, '') IS NULL THEN NULL
      WHEN fecha_baja_raw REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN DATE(fecha_baja_raw)
      WHEN fecha_baja_raw LIKE '__/__/____' THEN STR_TO_DATE(fecha_baja_raw, '%d/%m/%Y')
      ELSE NULL
    END <= @d_last
    AND COALESCE(
      CASE 
        WHEN NULLIF(fecha_alta_raw, '') IS NULL THEN NULL
        WHEN fecha_alta_raw REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN DATE(fecha_alta_raw)
        WHEN fecha_alta_raw LIKE '__/__/____' THEN STR_TO_DATE(fecha_alta_raw, '%d/%m/%Y')
        ELSE NULL
      END,
      @d_last
    ) >= @d_first
),

bajas_dia AS (
  SELECT 
    bi.empleadoId,
    f.d AS fecha,
    CASE WHEN f.d BETWEEN bi.d_ini AND bi.d_fin THEN 1 ELSE 0 END AS es_baja
  FROM bajas_intervalos bi
  CROSS JOIN fechas f
  WHERE bi.d_ini IS NOT NULL
),

aus_raw AS (
  SELECT 
    CAST(a.\`CODIGO\` AS CHAR) AS empleadoId,
    TRIM(a.\`TIPO\`) AS tipo,
    a.\`DURACION\` AS duracion,
    TRIM(REPLACE(REPLACE(a.\`FECHA\`,'–','-'),'—','-')) AS fecha_txt
  FROM Ausencias a
),

aus_parts AS (
  SELECT
    empleadoId,
    tipo,
    duracion,
    CASE 
      WHEN fecha_txt LIKE '% %' 
        THEN TRIM(TRAILING '-' FROM SUBSTRING_INDEX(fecha_txt,' ',1))
      ELSE fecha_txt
    END AS start_raw,
    CASE 
      WHEN fecha_txt LIKE '% %' 
        THEN TRIM(LEADING '-' FROM SUBSTRING_INDEX(fecha_txt,' ',-1))
      ELSE fecha_txt
    END AS end_raw
  FROM aus_raw
),

aus_norm AS (
  SELECT
    empleadoId,
    tipo,
    duracion,
    COALESCE(STR_TO_DATE(start_raw, '%Y-%m-%d'), STR_TO_DATE(start_raw, '%Y-%m-%e')) AS d_start,
    COALESCE(STR_TO_DATE(end_raw, '%Y-%m-%d'), STR_TO_DATE(end_raw, '%Y-%m-%e')) AS d_end,
    CASE
      WHEN UPPER(tipo) = 'VACACIONES' THEN 0
      WHEN UPPER(tipo) LIKE '%ASUNTO PROPIO%' THEN 0
      WHEN UPPER(tipo) LIKE '%PERMISO%' THEN 0
      WHEN UPPER(tipo) LIKE '%BAJA%' THEN 0
      WHEN UPPER(tipo) LIKE '%AUSENCIA INJUSTIFICADA%' THEN 0
      WHEN UPPER(tipo) LIKE '%SALIDA SIN REGRESO%' THEN 1
      WHEN UPPER(tipo) LIKE '%SALIDA CENTRO%' THEN 1
      WHEN UPPER(tipo) LIKE '%ENTRADA CENTRO%' THEN 1
      WHEN duracion IS NOT NULL AND TRIM(duracion) != '' AND duracion != '00:00:00' THEN 1
      ELSE 0
    END AS es_pe_ore
  FROM aus_parts
),

aus_dia AS (
  SELECT 
    f.d AS fecha,
    n.empleadoId,
    MAX(CASE WHEN UPPER(n.tipo)='VACACIONES' AND n.d_start IS NOT NULL AND n.d_end IS NOT NULL THEN 1 ELSE 0 END) AS es_vacaciones,
    MAX(CASE WHEN UPPER(n.tipo)<> 'VACACIONES' AND n.es_pe_ore = 0 AND n.d_start IS NOT NULL AND n.d_end IS NOT NULL THEN 1 ELSE 0 END) AS es_ausencia,
    SUM(CASE WHEN n.es_pe_ore = 1 THEN 
      COALESCE(TIME_TO_SEC(STR_TO_DATE(n.duracion, '%H:%i:%s')) / 3600.0, 0)
      ELSE 0 
    END) AS horas_ausencia_ore
  FROM fechas f
  JOIN aus_norm n
    ON n.d_start IS NOT NULL 
    AND n.d_end IS NOT NULL
    AND f.d BETWEEN n.d_start AND n.d_end
  GROUP BY f.d, n.empleadoId
),

fiestas_dia AS (
  SELECT 
    ec.empleadoId,
    f.d AS fecha,
    CASE 
      WHEN fi.active = 1
        AND DATE(COALESCE(fi.observed_date, fi.date)) = f.d
        AND (
          LOWER(fi.scope) IN ('nacional', 'national')
          OR (LOWER(fi.scope) IN ('autonómico', 'autonomico', 'ccaa') AND BINARY fi.ccaa_code = BINARY ec.ccaa)
        )
        AND COALESCE(tf.trabaja_festivos, 0) = 0
      THEN 1 ELSE 0
    END AS es_fiesta
  FROM empleado_ccaa ec
  CROSS JOIN fechas f
  LEFT JOIN fiestas fi ON DATE(COALESCE(fi.observed_date, fi.date)) = f.d
  LEFT JOIN empleado_flags tf ON BINARY tf.empleadoId = BINARY ec.empleadoId ),

empleado_fechas AS (
  SELECT CAST(de.CODIGO AS CHAR) AS empleadoId, f.d AS fecha, DAY(f.d) AS dia
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  WHERE de.ESTADO = 'ACTIVO'
    AND f.d >= @d_first
    AND f.d <= @d_last
),

daily_plan AS (
  SELECT
    ef.empleadoId,
    ef.fecha,
    ef.dia,
    CASE
      WHEN bj.es_baja = 1 THEN 0
      WHEN COALESCE(au.es_vacaciones,0) = 1 THEN 0
      WHEN fd2.es_fiesta = 1 AND COALESCE(tf.trabaja_festivos,0) = 0 THEN 0
      WHEN COALESCE(au.es_ausencia,0) = 1 THEN 0
      ELSE GREATEST(
        COALESCE(
          CASE WHEN cd.tiene_cuadrante = 1 THEN cd.horas_cuadrante_dia ELSE NULL END,
          CASE WHEN hd.horas_horario_dia IS NOT NULL THEN hd.horas_horario_dia ELSE NULL END,
          0
        ) - COALESCE(au.horas_ausencia_ore, 0),
        0
      )
    END AS horas_plan,
    CASE
      WHEN bj.es_baja = 1 THEN 'baja_medica'
      WHEN COALESCE(au.es_vacaciones,0) = 1 THEN 'vacaciones'
      WHEN fd2.es_fiesta = 1 AND COALESCE(tf.trabaja_festivos,0) = 0 THEN 'fiesta'
      WHEN COALESCE(au.es_ausencia,0) = 1 THEN 'ausencia'
      WHEN cd.tiene_cuadrante = 1 THEN 'cuadrante'
      WHEN hd.horas_horario_dia IS NOT NULL AND hd.horas_horario_dia > 0 THEN 'horario'
      ELSE 'none'
    END AS fuente
  FROM empleado_fechas ef
  LEFT JOIN cuadrante_dia cd
    ON cd.empleadoId = ef.empleadoId AND cd.fecha = ef.fecha
  LEFT JOIN horario_dia hd
    ON hd.empleadoId = ef.empleadoId AND hd.fecha = ef.fecha
  LEFT JOIN bajas_dia bj
    ON bj.empleadoId = ef.empleadoId AND bj.fecha = ef.fecha
  LEFT JOIN fiestas_dia fd2
    ON fd2.empleadoId = ef.empleadoId AND fd2.fecha = ef.fecha
  LEFT JOIN aus_dia au
    ON au.empleadoId = ef.empleadoId AND au.fecha = ef.fecha
  LEFT JOIN empleado_flags tf
    ON tf.empleadoId = ef.empleadoId
),

plan_mes AS (
  SELECT 
    empleadoId,
    ROUND(SUM(horas_plan), 2) AS horas_plan_mes,
    ROUND(SUM(CASE WHEN fuente='cuadrante' THEN horas_plan ELSE 0 END), 2) AS horas_cuadrante_mes,
    ROUND(SUM(CASE WHEN fuente='horario' THEN horas_plan ELSE 0 END), 2) AS horas_horario_mes,
    SUM(CASE WHEN fuente='cuadrante' THEN 1 ELSE 0 END) AS cnt_cuadrante,
    SUM(CASE WHEN fuente='horario' THEN 1 ELSE 0 END) AS cnt_horario
  FROM daily_plan
  GROUP BY empleadoId
),

plan_hasta_hoy AS (
  SELECT 
    empleadoId,
    ROUND(SUM(horas_plan), 2) AS horas_plan_hasta_hoy
  FROM daily_plan
  WHERE fecha <= @d_today
  GROUP BY empleadoId
),

cuadrante_sum AS (
  SELECT
    cu.empleadoId,
    MAX(cu.centro_cuadrante) AS centro_cuadrante,
    ROUND(SUM(
      CASE 
        WHEN UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
        WHEN TRIM(cu.val) LIKE '%:%-%:%' THEN (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-',-1),' ',1), '%H:%i'))
                                          - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-', 1),' ',1), '%H:%i'))
                                          + 86400) % 86400) / 3600)
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+×[0-9]+h\\)' THEN 
          -- Format "24h (3×8h)" - extrage orele per tură din paranteză (8h)
          CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val), '×', -1), 'h', 1) AS DECIMAL(10,2))
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h' THEN 
          CAST(SUBSTRING_INDEX(TRIM(cu.val), 'h', 1) AS DECIMAL(10,2))
        ELSE 0
      END
    ),2) AS horas_cuadrante_mes
  FROM cuadrante_unpivot cu
  GROUP BY cu.empleadoId
),

horario_mes AS (
  SELECT empleadoId, ROUND(SUM(horas_horario_dia),2) AS horas_horario_mes
  FROM horario_dia
  GROUP BY empleadoId
),

cuadrante_hasta_hoy AS (
  SELECT
    empleadoId,
    ROUND(SUM(horas_cuadrante_dia), 2) AS horas_cuadrante_hasta_hoy
  FROM cuadrante_dia
  WHERE fecha <= @d_today
  GROUP BY empleadoId
),

horario_hasta_hoy AS (
  SELECT empleadoId, ROUND(SUM(horas_horario_dia),2) AS horas_horario_hasta_hoy
  FROM horario_dia
  WHERE fecha <= @d_today
  GROUP BY empleadoId
),

empleado_orar AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    CASE WHEN cq.CODIGO IS NOT NULL THEN 1 ELSE 0 END AS has_cuadrante,
    CASE WHEN h.id IS NOT NULL THEN 1 ELSE 0 END AS has_horario,
    CASE 
      WHEN cq.CODIGO IS NOT NULL OR h.id IS NOT NULL THEN 1 
      ELSE 0 
    END AS has_orar
  FROM DatosEmpleados de
  LEFT JOIN cuadrante cq 
    ON TRIM(BINARY cq.CODIGO) = TRIM(BINARY CAST(de.CODIGO AS CHAR)) 
    AND cq.LUNA = @lunaselectata
  LEFT JOIN horarios h
    ON h.centro_nombre = de.\`CENTRO TRABAJO\`
    AND h.grupo_nombre = de.GRUPO
    AND h.vigente_desde <= @d_last
    AND (h.vigente_hasta IS NULL OR h.vigente_hasta >= @d_first)
  WHERE de.ESTADO = 'ACTIVO'
),

target_initial AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    -- Prioritate: cuadrante > horario > HORAS_CONTRATO
    -- Folosim cuadrante_sum/horario_mes direct (fără ajustări) pentru target_initial
    -- plan_mes deja aplică ajustări (scade zilele neutre), deci nu e potrivit pentru target_initial
    COALESCE(
      cs.horas_cuadrante_mes,
      hm.horas_horario_mes,
      -- Pentru contract: calculăm zilele lucrătoare (luni-vineri) din lună și înmulțim cu orele pe zi
      CASE 
        WHEN CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) IS NOT NULL AND CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) > 0 THEN
          ROUND(
            (CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) / 5) * 
            COUNT(DISTINCT CASE 
              WHEN DAYOFWEEK(f.d) BETWEEN 2 AND 6  -- Luni-Vineri
              THEN f.d
            END),
            2
          )
        ELSE 0
      END,
      0
    ) AS target_initial,
    cs.horas_cuadrante_mes AS cs_horas_debug,
    hm.horas_horario_mes AS hm_horas_debug,
    CASE 
      WHEN COALESCE(cs.horas_cuadrante_mes, 0) = 0 
        AND COALESCE(hm.horas_horario_mes, 0) = 0 
        AND (CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) IS NOT NULL AND CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)) > 0) THEN
        COALESCE(CAST(de.\`HORAS DE CONTRATO\` AS DECIMAL(10,2)), 0) / 5  -- 5 zile lucrătoare (luni-vineri)
      ELSE NULL
    END AS horas_pe_zi_contrato
  FROM DatosEmpleados de
  LEFT JOIN cuadrante_sum cs ON BINARY cs.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  LEFT JOIN horario_mes hm ON BINARY hm.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  CROSS JOIN fechas f
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO, cs.horas_cuadrante_mes, hm.horas_horario_mes, de.\`HORAS DE CONTRATO\`
),

zile_neutre AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    COUNT(DISTINCT CASE 
      WHEN bj.es_baja = 1 THEN f.d
    END) AS dias_baja,
    COUNT(DISTINCT CASE 
      WHEN au.es_vacaciones = 1 THEN f.d
    END) AS dias_vacaciones,
    COUNT(DISTINCT CASE 
      WHEN fd.es_fiesta = 1 THEN f.d
    END) AS dias_fiesta
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  LEFT JOIN bajas_dia bj ON TRIM(BINARY bj.empleadoId) = TRIM(BINARY CAST(de.CODIGO AS CHAR)) AND bj.fecha = f.d
  LEFT JOIN aus_dia au ON TRIM(BINARY au.empleadoId) = TRIM(BINARY CAST(de.CODIGO AS CHAR)) AND au.fecha = f.d
  LEFT JOIN fiestas_dia fd ON TRIM(BINARY fd.empleadoId) = TRIM(BINARY CAST(de.CODIGO AS CHAR)) AND fd.fecha = f.d
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),

zile_neutre_hasta_hoy AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    COUNT(DISTINCT CASE 
      WHEN f.d <= @d_today AND bj.es_baja = 1 THEN f.d
    END) AS dias_baja_hasta_hoy,
    COUNT(DISTINCT CASE 
      WHEN f.d <= @d_today AND au.es_vacaciones = 1 THEN f.d
    END) AS dias_vacaciones_hasta_hoy,
    COUNT(DISTINCT CASE 
      WHEN f.d <= @d_today AND fd.es_fiesta = 1 THEN f.d
    END) AS dias_fiesta_hasta_hoy
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  LEFT JOIN bajas_dia bj ON TRIM(BINARY bj.empleadoId) = TRIM(BINARY CAST(de.CODIGO AS CHAR)) AND bj.fecha = f.d
  LEFT JOIN aus_dia au ON TRIM(BINARY au.empleadoId) = TRIM(BINARY CAST(de.CODIGO AS CHAR)) AND au.fecha = f.d
  LEFT JOIN fiestas_dia fd ON TRIM(BINARY fd.empleadoId) = TRIM(BINARY CAST(de.CODIGO AS CHAR)) AND fd.fecha = f.d
  WHERE de.ESTADO = 'ACTIVO'
    AND f.d <= @d_today
  GROUP BY de.CODIGO
),

ore_zile_neutre AS (
  SELECT 
    zn.empleadoId,
    CASE 
      WHEN eo.has_orar = 1 THEN
        ROUND(SUM(
          CASE 
            WHEN bj.es_baja = 1 THEN
              -- Bajas: se scade întotdeauna
              CASE 
                WHEN eo.has_cuadrante = 1 THEN COALESCE(cd.horas_cuadrante_dia, 0)
                ELSE COALESCE(cd.horas_cuadrante_dia, hd.horas_horario_dia, 0)
              END
            WHEN au.es_vacaciones = 1 THEN
              -- Vacaciones: se scade întotdeauna
              CASE 
                WHEN eo.has_cuadrante = 1 THEN COALESCE(cd.horas_cuadrante_dia, 0)
                ELSE COALESCE(cd.horas_cuadrante_dia, hd.horas_horario_dia, 0)
              END
            WHEN fd.es_fiesta = 1 
              AND COALESCE(tf.trabaja_festivos, 0) = 0
              AND (fpd.workday_date IS NOT NULL OR fr.workday_date IS NOT NULL) THEN
              -- Festivo cu fichajes/regularizare: se scade orele din regularizare (dacă există) sau din fichajes
              CASE 
                WHEN fr.effective_minutes IS NOT NULL AND fr.effective_minutes > 0 THEN
                  -- Folosim orele din regularizare (convertite din minute în ore)
                  ROUND(fr.effective_minutes / 60.0, 2)
                WHEN fpd.dur_secs > 0 THEN
                  -- Folosim orele din fichajes (convertite din secunde în ore)
                  ROUND(fpd.dur_secs / 3600.0, 2)
                ELSE 0
              END
            WHEN fd.es_fiesta = 1 
              AND COALESCE(tf.trabaja_festivos, 0) = 0 THEN
              -- Festivo fără fichajes: nu se scade nimic
              0
            ELSE 0
          END
        ), 2)
      ELSE
        -- Pentru angajații fără cuadrante/horario: horas_neutre = 0 pentru fiestas (nu folosim contractul)
        -- Doar bajas și vacaciones folosesc horas_pe_zi_contrato
        (zn.dias_baja + zn.dias_vacaciones) * ti.horas_pe_zi_contrato
    END AS horas_neutre
  FROM zile_neutre zn
  JOIN empleado_orar eo ON TRIM(BINARY eo.empleadoId) = TRIM(BINARY zn.empleadoId)
  JOIN target_initial ti ON TRIM(BINARY ti.empleadoId) = TRIM(BINARY zn.empleadoId)
  LEFT JOIN empleado_flags tf ON TRIM(BINARY tf.empleadoId) = TRIM(BINARY zn.empleadoId)
  CROSS JOIN fechas f
  LEFT JOIN bajas_dia bj ON TRIM(BINARY bj.empleadoId) = TRIM(BINARY zn.empleadoId) AND bj.fecha = f.d
  LEFT JOIN aus_dia au ON TRIM(BINARY au.empleadoId) = TRIM(BINARY zn.empleadoId) AND au.fecha = f.d
  LEFT JOIN fiestas_dia fd ON TRIM(BINARY fd.empleadoId) = TRIM(BINARY zn.empleadoId) AND fd.fecha = f.d
  LEFT JOIN cuadrante_dia cd ON TRIM(BINARY cd.empleadoId) = TRIM(BINARY zn.empleadoId) AND cd.fecha = f.d
  LEFT JOIN horario_dia hd ON TRIM(BINARY hd.empleadoId) = TRIM(BINARY zn.empleadoId) AND hd.fecha = f.d
    AND eo.has_cuadrante = 0  -- Doar dacă nu are cuadrante, verificăm horario
  LEFT JOIN fichajes_por_dia fpd ON TRIM(BINARY fpd.empleadoId) = TRIM(BINARY zn.empleadoId) AND fpd.workday_date = f.d
  LEFT JOIN FichajeRegularizacion fr ON TRIM(BINARY CAST(fr.employee_codigo AS CHAR)) = TRIM(BINARY zn.empleadoId) AND fr.workday_date = f.d AND fr.status = 'CONFIRMED'
  WHERE (bj.es_baja = 1 OR au.es_vacaciones = 1 OR (fd.es_fiesta = 1 AND COALESCE(tf.trabaja_festivos, 0) = 0))
  GROUP BY zn.empleadoId
),

ore_zile_neutre_hasta_hoy AS (
  SELECT 
    zn.empleadoId,
    CASE 
      WHEN eo.has_orar = 1 THEN
        ROUND(SUM(
          CASE 
            WHEN f.d <= @d_today AND bj.es_baja = 1 THEN
              -- Bajas: se scade întotdeauna
              CASE 
                WHEN eo.has_cuadrante = 1 THEN COALESCE(cd.horas_cuadrante_dia, 0)
                ELSE COALESCE(cd.horas_cuadrante_dia, hd.horas_horario_dia, 0)
              END
            WHEN f.d <= @d_today AND au.es_vacaciones = 1 THEN
              -- Vacaciones: se scade întotdeauna
              CASE 
                WHEN eo.has_cuadrante = 1 THEN COALESCE(cd.horas_cuadrante_dia, 0)
                ELSE COALESCE(cd.horas_cuadrante_dia, hd.horas_horario_dia, 0)
              END
            WHEN f.d <= @d_today
              AND fd.es_fiesta = 1 
              AND COALESCE(tf.trabaja_festivos, 0) = 0
              AND (fpd.workday_date IS NOT NULL OR fr.workday_date IS NOT NULL) THEN
              -- Festivo cu fichajes/regularizare: se scade orele din regularizare (dacă există) sau din fichajes
              CASE 
                WHEN fr.effective_minutes IS NOT NULL AND fr.effective_minutes > 0 THEN
                  -- Folosim orele din regularizare (convertite din minute în ore)
                  ROUND(fr.effective_minutes / 60.0, 2)
                WHEN fpd.dur_secs > 0 THEN
                  -- Folosim orele din fichajes (convertite din secunde în ore)
                  ROUND(fpd.dur_secs / 3600.0, 2)
                ELSE 0
              END
            WHEN f.d <= @d_today
              AND fd.es_fiesta = 1 
              AND COALESCE(tf.trabaja_festivos, 0) = 0 THEN
              -- Festivo fără fichajes: nu se scade nimic
              0
            ELSE 0
          END
        ), 2)
      ELSE
        -- Pentru angajații fără cuadrante/horario: horas_neutre = 0 pentru fiestas (nu folosim contractul)
        -- Doar bajas și vacaciones folosesc horas_pe_zi_contrato
        COUNT(DISTINCT CASE 
          WHEN f.d <= @d_today
            AND (bj.es_baja = 1 OR au.es_vacaciones = 1)
          THEN
            f.d
        END) * ti.horas_pe_zi_contrato
    END AS horas_neutre_hasta_hoy
  FROM zile_neutre zn
  JOIN empleado_orar eo ON TRIM(BINARY eo.empleadoId) = TRIM(BINARY zn.empleadoId)
  JOIN target_initial ti ON TRIM(BINARY ti.empleadoId) = TRIM(BINARY zn.empleadoId)
  LEFT JOIN empleado_flags tf ON TRIM(BINARY tf.empleadoId) = TRIM(BINARY zn.empleadoId)
  CROSS JOIN fechas f
  LEFT JOIN bajas_dia bj ON TRIM(BINARY bj.empleadoId) = TRIM(BINARY zn.empleadoId) AND bj.fecha = f.d
  LEFT JOIN aus_dia au ON TRIM(BINARY au.empleadoId) = TRIM(BINARY zn.empleadoId) AND au.fecha = f.d
  LEFT JOIN fiestas_dia fd ON TRIM(BINARY fd.empleadoId) = TRIM(BINARY zn.empleadoId) AND fd.fecha = f.d
  LEFT JOIN cuadrante_dia cd ON TRIM(BINARY cd.empleadoId) = TRIM(BINARY zn.empleadoId) AND cd.fecha = f.d
  LEFT JOIN horario_dia hd ON TRIM(BINARY hd.empleadoId) = TRIM(BINARY zn.empleadoId) AND hd.fecha = f.d
    AND eo.has_cuadrante = 0  -- Doar dacă nu are cuadrante, verificăm horario
  LEFT JOIN fichajes_por_dia fpd ON TRIM(BINARY fpd.empleadoId) = TRIM(BINARY zn.empleadoId) AND fpd.workday_date = f.d
  LEFT JOIN FichajeRegularizacion fr ON TRIM(BINARY CAST(fr.employee_codigo AS CHAR)) = TRIM(BINARY zn.empleadoId) AND fr.workday_date = f.d AND fr.status = 'CONFIRMED'
  WHERE f.d <= @d_today
    AND (bj.es_baja = 1 OR au.es_vacaciones = 1 OR (fd.es_fiesta = 1 AND COALESCE(tf.trabaja_festivos, 0) = 0))
  GROUP BY zn.empleadoId
),

target_ajustat AS (
  SELECT 
    ti.empleadoId,
    ti.target_initial,
    ti.cs_horas_debug,
    ti.hm_horas_debug,
    ti.horas_pe_zi_contrato,
    -- Pentru luna curentă: folosim plan_hasta_hoy (până la azi, exclude LIBRE)
    -- Pentru luni în trecut: folosim plan_mes (toată luna, exclude LIBRE)
    -- Dacă nu există cuadrante/horario, folosim orele din contract pentru zilele lucrătoare (luni-vineri)
    CASE 
      WHEN @d_today < @d_last THEN
        -- Luna curentă: folosim plan_hasta_hoy (până la azi)
        CASE
          WHEN COALESCE(phh.horas_plan_hasta_hoy, 0) > 0 THEN
            phh.horas_plan_hasta_hoy
          WHEN ti.horas_pe_zi_contrato IS NOT NULL AND ti.horas_pe_zi_contrato > 0 THEN
            -- Nu există cuadrante/horario: folosim contractul pentru zilele lucrătoare (luni-vineri) până la azi
            ROUND(
              ti.horas_pe_zi_contrato * 
              COUNT(DISTINCT CASE 
                WHEN f.d <= @d_today
                  AND DAYOFWEEK(f.d) BETWEEN 2 AND 6  -- Luni-Vineri (2=luni, 6=vineri)
                  AND COALESCE(bj.es_baja, 0) = 0
                  AND COALESCE(au.es_vacaciones, 0) = 0
                  AND (fd.es_fiesta = 0 OR COALESCE(tf.trabaja_festivos, 0) = 1)
                THEN f.d
              END),
              2
            )
          ELSE 0
        END
      ELSE
        -- Luna în trecut: folosim plan_mes (toată luna)
        CASE
          WHEN COALESCE(pm.horas_plan_mes, 0) > 0 THEN
            pm.horas_plan_mes
          WHEN ti.horas_pe_zi_contrato IS NOT NULL AND ti.horas_pe_zi_contrato > 0 THEN
            -- Nu există cuadrante/horario: folosim contractul pentru zilele lucrătoare (luni-vineri) din toată luna
            ROUND(
              ti.horas_pe_zi_contrato * 
              COUNT(DISTINCT CASE 
                WHEN DAYOFWEEK(f.d) BETWEEN 2 AND 6  -- Luni-Vineri
                  AND COALESCE(bj.es_baja, 0) = 0
                  AND COALESCE(au.es_vacaciones, 0) = 0
                  AND (fd.es_fiesta = 0 OR COALESCE(tf.trabaja_festivos, 0) = 1)
                THEN f.d
              END),
              2
            )
          ELSE 0
        END
    END AS target_ajustat,
    -- Pentru luna curentă: folosim horas_neutre_hasta_hoy (până la azi)
    -- Pentru luni în trecut: folosim horas_neutre (toată luna)
    CASE 
      WHEN @d_today < @d_last THEN
        COALESCE(oznh.horas_neutre_hasta_hoy, 0)
      ELSE
        COALESCE(ozn.horas_neutre, 0)
    END AS horas_neutre
  FROM target_initial ti
  LEFT JOIN plan_hasta_hoy phh ON BINARY phh.empleadoId = BINARY ti.empleadoId
  LEFT JOIN plan_mes pm ON BINARY pm.empleadoId = BINARY ti.empleadoId
  LEFT JOIN ore_zile_neutre ozn ON BINARY ozn.empleadoId = BINARY ti.empleadoId
  LEFT JOIN ore_zile_neutre_hasta_hoy oznh ON BINARY oznh.empleadoId = BINARY ti.empleadoId
  LEFT JOIN empleado_flags tf ON BINARY tf.empleadoId = BINARY ti.empleadoId
  CROSS JOIN fechas f
  LEFT JOIN bajas_dia bj ON TRIM(BINARY bj.empleadoId) = TRIM(BINARY ti.empleadoId) AND bj.fecha = f.d
  LEFT JOIN aus_dia au ON TRIM(BINARY au.empleadoId) = TRIM(BINARY ti.empleadoId) AND au.fecha = f.d
  LEFT JOIN fiestas_dia fd ON TRIM(BINARY fd.empleadoId) = TRIM(BINARY ti.empleadoId) AND fd.fecha = f.d
  GROUP BY 
    ti.empleadoId, 
    ti.target_initial, 
    ti.cs_horas_debug, 
    ti.hm_horas_debug, 
    ti.horas_pe_zi_contrato,
    phh.horas_plan_hasta_hoy,
    pm.horas_plan_mes,
    ozn.horas_neutre,
    oznh.horas_neutre_hasta_hoy ),

fichaje_base AS (
  SELECT 
    CAST(f.CODIGO AS CHAR) AS empleadoId,
    STR_TO_DATE(f.FECHA, '%Y-%m-%d') AS fecha,
    f.TIPO AS tipo,
    STR_TO_DATE(f.HORA, '%H:%i:%s') AS hora,
    f.DURACION AS duracion,
    -- Logica pentru turele de noapte (identică cu horas-trabajadas.service.ts):
    -- Pentru Salida: dacă are DURACION, HORA < 12:00 și există Entrada în ziua anterioară după 17:00,
    -- atribuim la data de Entrada (workday_date), nu la data de Salida
    -- Pentru Entrada: folosim data Entrada-ului (fecha) direct
    CASE
      WHEN f.TIPO = 'Salida' 
        AND f.DURACION IS NOT NULL 
        AND TRIM(f.DURACION) <> '' 
        AND f.DURACION <> '00:00:00'
        AND CAST(TIME(f.HORA) AS TIME) < TIME('12:00:00') -- Salida înainte de 12:00 (dimineața) = tură de noapte
        AND EXISTS (
          SELECT 1
          FROM Fichaje f_entrada
          WHERE f_entrada.CODIGO = f.CODIGO
            AND f_entrada.TIPO = 'Entrada'
            AND f_entrada.FECHA = DATE_SUB(f.FECHA, INTERVAL 1 DAY)
            AND CAST(TIME(f_entrada.HORA) AS TIME) >= TIME('17:00:00') -- Entrada după 17:00 = tură de noapte
        )
      THEN DATE_SUB(f.FECHA, INTERVAL 1 DAY) -- Tură de noapte: atribuie la data de început (workday_date)
      ELSE DATE(f.FECHA) -- Tură normală sau Entrada: folosește data fichaje-ului
    END AS workday_date
  FROM Fichaje f
  WHERE f.FECHA >= @d_first AND f.FECHA < DATE_ADD(@d_last, INTERVAL 1 DAY)
),

-- Include și zilele cu regularizări dar fără fichajes
regularizaciones_sin_fichajes AS (
  SELECT
    CAST(fr.employee_codigo AS CHAR) AS empleadoId,
    fr.workday_date,
    fr.effective_minutes / 60.0 AS horas_reg,
    0 AS horas_fichaje
  FROM FichajeRegularizacion fr
  WHERE fr.status = 'CONFIRMED'
    AND fr.effective_minutes IS NOT NULL
    AND fr.workday_date >= @d_first
    AND fr.workday_date <= @d_today
    -- Exclude zilele care au deja fichajes (vor fi incluse în fichaje_base)
    AND NOT EXISTS (
      SELECT 1
      FROM fichaje_base fb
      WHERE BINARY fb.empleadoId = BINARY CAST(fr.employee_codigo AS CHAR)
        AND fb.workday_date = fr.workday_date
    )
),
fichajes_por_dia_horas AS (
  SELECT 
    f.empleadoId,
    f.workday_date,
    -- Prioritate 1: Regularizare CONFIRMED
    MAX(CASE 
      WHEN fr.status = 'CONFIRMED' AND fr.effective_minutes IS NOT NULL
      THEN fr.effective_minutes / 60.0
      ELSE NULL
    END) AS horas_reg,
    -- Fallback: Suma DURACION din fichajes pentru acea zi
    SUM(CASE 
      WHEN f.DURACION IS NOT NULL AND TRIM(f.DURACION) <> '' AND f.DURACION <> '00:00:00'
      THEN TIME_TO_SEC(f.DURACION) / 3600.0
      ELSE 0
    END) AS horas_fichaje
  FROM fichaje_base f
  LEFT JOIN FichajeRegularizacion fr 
    ON BINARY fr.employee_codigo = BINARY f.empleadoId
    AND fr.workday_date = f.workday_date
    AND fr.status = 'CONFIRMED'
  WHERE f.workday_date BETWEEN @d_first AND @d_today
  GROUP BY f.empleadoId, f.workday_date
  
  UNION ALL
  
  -- Include zilele cu regularizări dar fără fichajes
  SELECT
    rsf.empleadoId,
    rsf.workday_date,
    rsf.horas_reg,
    rsf.horas_fichaje
  FROM regularizaciones_sin_fichajes rsf
),

horas_pontate AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    ROUND(SUM(
      COALESCE(fpdh.horas_reg, fpdh.horas_fichaje, 0)
    ), 2) AS horas_pontate
  FROM DatosEmpleados de
  LEFT JOIN fichajes_por_dia_horas fpdh ON BINARY fpdh.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),

regularizaciones_empleado AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    COUNT(DISTINCT CASE 
      WHEN fr.status = 'CONFIRMED' 
        AND fr.workday_date BETWEEN @d_first AND @d_last
      THEN fr.workday_date
    END) AS regularizaciones_confirmed,
    COUNT(DISTINCT CASE 
      WHEN fr.status IN ('PENDING', 'NEEDS_REVIEW')
        AND fr.workday_date BETWEEN @d_first AND @d_last
      THEN fr.workday_date
    END) AS regularizaciones_pendiente
  FROM DatosEmpleados de
  LEFT JOIN FichajeRegularizacion fr 
    ON BINARY fr.employee_codigo = BINARY CAST(de.CODIGO AS CHAR)
    AND fr.workday_date BETWEEN @d_first AND @d_last
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),

fichajes_por_dia_base AS (
  SELECT 
    CAST(f.CODIGO AS CHAR) AS empleadoId,
    f.TIPO AS tipo,
    f.FECHA AS fecha,
    f.DURACION AS duracion,
    -- Logica pentru turele de noapte (identică cu horas-trabajadas.service.ts):
    -- Pentru Salida: dacă are DURACION, HORA < 12:00 și există Entrada în ziua anterioară după 17:00,
    -- atribuim la data de Entrada (workday_date), nu la data de Salida
    -- Pentru Entrada: folosim data Entrada-ului (fecha) direct
    CASE
      WHEN f.TIPO = 'Salida' 
        AND f.DURACION IS NOT NULL 
        AND TRIM(f.DURACION) <> '' 
        AND f.DURACION <> '00:00:00'
        AND CAST(TIME(f.HORA) AS TIME) < TIME('12:00:00') -- Salida înainte de 12:00 (dimineața) = tură de noapte
        AND EXISTS (
          SELECT 1
          FROM Fichaje f_entrada
          WHERE f_entrada.CODIGO = f.CODIGO
            AND f_entrada.TIPO = 'Entrada'
            AND f_entrada.FECHA = DATE_SUB(f.FECHA, INTERVAL 1 DAY)
            AND CAST(TIME(f_entrada.HORA) AS TIME) >= TIME('17:00:00') -- Entrada după 17:00 = tură de noapte
        )
      THEN DATE_SUB(f.FECHA, INTERVAL 1 DAY) -- Tură de noapte: atribuie la data de început (workday_date)
      ELSE DATE(f.FECHA) -- Tură normală sau Entrada: folosește data fichaje-ului
    END AS workday_date
  FROM Fichaje f
  WHERE f.FECHA >= @d_first AND f.FECHA < DATE_ADD(@d_last, INTERVAL 1 DAY)
),
fichajes_por_dia AS (
  SELECT 
    empleadoId,
    workday_date,
    COUNT(*) AS cnt_events,
    COALESCE(SUM(CASE 
      WHEN duracion IS NOT NULL AND TRIM(duracion) <> '' AND duracion <> '00:00:00' 
      THEN TIME_TO_SEC(duracion)
      ELSE 0
    END), 0) AS dur_secs
  FROM fichajes_por_dia_base
  GROUP BY empleadoId, workday_date
),

-- Numără zilele cu fichele fără adresă (DIRECCION NULL sau gol)
fichajes_sin_direccion AS (
  SELECT 
    CAST(f.CODIGO AS CHAR) AS empleadoId,
    CASE
      WHEN f.TIPO = 'Salida' 
        AND f.DURACION IS NOT NULL 
        AND TRIM(f.DURACION) <> '' 
        AND f.DURACION <> '00:00:00'
        AND CAST(TIME(f.HORA) AS TIME) < TIME('12:00:00')
        AND EXISTS (
          SELECT 1
          FROM Fichaje f_entrada
          WHERE f_entrada.CODIGO = f.CODIGO
            AND f_entrada.TIPO = 'Entrada'
            AND f_entrada.FECHA = DATE_SUB(f.FECHA, INTERVAL 1 DAY)
            AND CAST(TIME(f_entrada.HORA) AS TIME) >= TIME('17:00:00')
        )
      THEN DATE_SUB(f.FECHA, INTERVAL 1 DAY)
      ELSE DATE(f.FECHA)
    END AS workday_date
  FROM Fichaje f
  WHERE f.FECHA >= @d_first AND f.FECHA < DATE_ADD(@d_last, INTERVAL 1 DAY)
    AND (f.DIRECCION IS NULL OR TRIM(f.DIRECCION) = '')
  GROUP BY empleadoId, workday_date
),

fichajes_sin_direccion_empleado AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    COUNT(DISTINCT fsd.workday_date) AS dias_sin_direccion
  FROM DatosEmpleados de
  LEFT JOIN fichajes_sin_direccion fsd ON BINARY fsd.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
    AND fsd.workday_date BETWEEN @d_first AND @d_today
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),

calitate_pontaj AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    COUNT(DISTINCT CASE 
      WHEN dp.horas_plan > 0
        AND dp.fecha >= @d_first
        AND dp.fecha <= @d_today
        AND COALESCE(bj.es_baja, 0) = 0
        AND COALESCE(au.es_vacaciones, 0) = 0
        AND COALESCE(fd.es_fiesta, 0) = 0
        -- Exclude zilele cu regularizări CONFIRMED (sunt considerate complete)
        AND fr_confirmed.id IS NULL
        AND (
          fpd.workday_date IS NULL
          OR (fpd.cnt_events > 0 AND fpd.dur_secs = 0)
        )
      THEN dp.fecha
    END) AS fichajes_incompleto,
    COALESCE(re.regularizaciones_confirmed, 0) AS regularizaciones_confirmed,
    COALESCE(re.regularizaciones_pendiente, 0) AS regularizaciones_pendiente,
    COALESCE(fsde.dias_sin_direccion, 0) AS fichajes_sin_direccion
  FROM DatosEmpleados de
  LEFT JOIN daily_plan dp ON BINARY dp.empleadoId = BINARY CAST(de.CODIGO AS CHAR) 
    AND dp.fecha >= @d_first 
    AND dp.fecha <= @d_today
  LEFT JOIN fichajes_por_dia fpd ON BINARY fpd.empleadoId = BINARY CAST(de.CODIGO AS CHAR) AND fpd.workday_date = dp.fecha
  LEFT JOIN FichajeRegularizacion fr_confirmed ON BINARY fr_confirmed.employee_codigo = BINARY CAST(de.CODIGO AS CHAR) 
    AND fr_confirmed.workday_date = dp.fecha 
    AND fr_confirmed.status = 'CONFIRMED'
    AND fr_confirmed.effective_minutes IS NOT NULL
    AND fr_confirmed.effective_minutes > 0
  LEFT JOIN regularizaciones_empleado re ON BINARY re.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  LEFT JOIN fichajes_sin_direccion_empleado fsde ON BINARY fsde.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  LEFT JOIN bajas_dia bj ON BINARY bj.empleadoId = BINARY CAST(de.CODIGO AS CHAR) AND bj.fecha = dp.fecha
  LEFT JOIN aus_dia au ON BINARY au.empleadoId = BINARY CAST(de.CODIGO AS CHAR) AND au.fecha = dp.fecha
  LEFT JOIN fiestas_dia fd ON BINARY fd.empleadoId = BINARY CAST(de.CODIGO AS CHAR) AND fd.fecha = dp.fecha
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO, fsde.dias_sin_direccion
),

horario_start_dia AS (
  SELECT
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    f.d AS fecha,
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN h.lun_in1
      WHEN 3 THEN h.mar_in1
      WHEN 4 THEN h.mie_in1
      WHEN 5 THEN h.joi_in1
      WHEN 6 THEN h.vin_in1
      WHEN 7 THEN h.sam_in1
      WHEN 1 THEN h.dum_in1
      ELSE NULL
    END AS hora_in_planificata
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  LEFT JOIN horarios h
    ON h.centro_nombre = de.\`CENTRO TRABAJO\`
    AND h.grupo_nombre = de.GRUPO
    AND h.vigente_desde <= f.d
    AND (h.vigente_hasta IS NULL OR f.d <= h.vigente_hasta)
  WHERE de.ESTADO = 'ACTIVO'
),

cuadrante_val_dia AS (
  SELECT
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    f.d AS fecha,
    cu.val AS val_cuadrante
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  LEFT JOIN cuadrante_unpivot cu ON BINARY cu.empleadoId = BINARY CAST(de.CODIGO AS CHAR)  AND cu.dia = DAY(f.d)
  WHERE de.ESTADO = 'ACTIVO'
),

punctualitate AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    COUNT(DISTINCT CASE 
      WHEN eo.has_orar = 1
        AND f.d <= @d_today
        AND (
          -- Caz 1: Există fichaje Entrada punctual
          (fb.tipo = 'Entrada'
           AND (
             -- Dacă are cuadrante, verifică doar cuadrante (exclude LIBRE și alte valori de liber)
             (eo.has_cuadrante = 1 
              AND cvd.val_cuadrante IS NOT NULL 
              AND TRIM(cvd.val_cuadrante) != ''
              AND UPPER(TRIM(cvd.val_cuadrante)) NOT IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X')
              AND TRIM(cvd.val_cuadrante) LIKE '%:%-%:%'
              AND TIME(fb.hora) BETWEEN 
                TIME(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cvd.val_cuadrante),' ',-1),'-', 1),' ',1)) - INTERVAL 15 MINUTE
                AND TIME(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cvd.val_cuadrante),' ',-1),'-', 1),' ',1)) + INTERVAL 30 MINUTE)
             OR
             -- Dacă nu are cuadrante, verifică horario
             (eo.has_cuadrante = 0
              AND hsd.hora_in_planificata IS NOT NULL 
              AND TIME(fb.hora) BETWEEN 
                TIME(hsd.hora_in_planificata) - INTERVAL 15 MINUTE
                AND TIME(hsd.hora_in_planificata) + INTERVAL 30 MINUTE)
           ))
          OR
          -- Caz 2: Există regularizare CONFIRMED (se consideră punctual pentru că a lucrat, chiar dacă nu a fichat la timp)
          (fr.status = 'CONFIRMED' 
           AND fr.effective_minutes IS NOT NULL 
           AND fr.effective_minutes > 0
           AND (
             -- Dacă are cuadrante, verifică că există cuadrante valid
             (eo.has_cuadrante = 1 
              AND cvd.val_cuadrante IS NOT NULL 
              AND TRIM(cvd.val_cuadrante) != ''
              AND UPPER(TRIM(cvd.val_cuadrante)) NOT IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X')
              AND TRIM(cvd.val_cuadrante) LIKE '%:%-%:%')
             OR
             -- Dacă nu are cuadrante, verifică că există horario
             (eo.has_cuadrante = 0 AND hsd.hora_in_planificata IS NOT NULL)
           ))
        )
        AND COALESCE(bj.es_baja, 0) = 0
        AND COALESCE(au.es_vacaciones, 0) = 0
        AND COALESCE(fd.es_fiesta, 0) = 0
      THEN f.d
    END) AS zile_punctuale,
    COUNT(DISTINCT CASE 
      WHEN eo.has_orar = 1
        AND f.d <= @d_today
        -- Dacă are cuadrante, numără doar zilele cu cuadrante valid (exclude LIBRE și alte valori de liber)
        -- Dacă nu are cuadrante, numără zilele cu horario
        AND (
          (eo.has_cuadrante = 1 
           AND cvd.val_cuadrante IS NOT NULL 
           AND TRIM(cvd.val_cuadrante) != ''
           AND UPPER(TRIM(cvd.val_cuadrante)) NOT IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X')
           AND TRIM(cvd.val_cuadrante) LIKE '%:%-%:%')
          OR
          (eo.has_cuadrante = 0 AND hsd.hora_in_planificata IS NOT NULL)
        )
        AND COALESCE(bj.es_baja, 0) = 0
        AND COALESCE(au.es_vacaciones, 0) = 0
        AND COALESCE(fd.es_fiesta, 0) = 0
      THEN f.d
    END) AS zile_cu_orar
  FROM DatosEmpleados de
  JOIN empleado_orar eo ON BINARY eo.empleadoId = BINARY CAST(de.CODIGO AS CHAR)   CROSS JOIN fechas f
  LEFT JOIN fichaje_base fb ON BINARY fb.empleadoId = BINARY CAST(de.CODIGO AS CHAR)  AND fb.fecha = f.d
  LEFT JOIN FichajeRegularizacion fr ON BINARY fr.employee_codigo = BINARY CAST(de.CODIGO AS CHAR) AND fr.workday_date = f.d AND fr.status = 'CONFIRMED'
  LEFT JOIN cuadrante_val_dia cvd ON BINARY cvd.empleadoId = BINARY CAST(de.CODIGO AS CHAR)  AND cvd.fecha = f.d
  LEFT JOIN horario_start_dia hsd ON BINARY hsd.empleadoId = BINARY CAST(de.CODIGO AS CHAR)  AND hsd.fecha = f.d AND eo.has_cuadrante = 0
  LEFT JOIN bajas_dia bj ON BINARY bj.empleadoId = BINARY CAST(de.CODIGO AS CHAR)  AND bj.fecha = f.d
  LEFT JOIN aus_dia au ON BINARY au.empleadoId = BINARY CAST(de.CODIGO AS CHAR)  AND au.fecha = f.d
  LEFT JOIN fiestas_dia fd ON BINARY fd.empleadoId = BINARY CAST(de.CODIGO AS CHAR)  AND fd.fecha = f.d
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),

acciones_empleado AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    -- Fichajes: COUNT(*) - numără toate acțiunile (nu doar distinct per zi)
    COUNT(CASE 
      WHEN l.action IN ('fichaje_created', 'fichaje_updated', 'fichaje_deleted', 'fichaje_approved', 'fichaje_rejected')
        AND (
          DATE(STR_TO_DATE(REPLACE(REPLACE(l.timestamp, 'T', ' '), 'Z', ''), '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
          OR DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
          OR DATE(STR_TO_DATE(SUBSTRING(l.timestamp, 1, 10), '%Y-%m-%d')) BETWEEN @d_first AND @d_last
        )
        AND BINARY l.email = BINARY de.\`CORREO ELECTRONICO\`
        AND l.email IS NOT NULL
        AND l.email != ''
        AND de.\`CORREO ELECTRONICO\` IS NOT NULL
        AND de.\`CORREO ELECTRONICO\` != ''
      THEN 1
    END) * 1.0 AS puntos_fichajes,
    -- Solicitudes: COUNT(*) - numără toate acțiunile
    COUNT(CASE 
      WHEN l.action IN ('solicitud_created', 'solicitud_updated', 'solicitud_deleted', 'solicitud_approved', 'solicitud_rejected')
        AND (
          DATE(STR_TO_DATE(REPLACE(REPLACE(l.timestamp, 'T', ' '), 'Z', ''), '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
          OR DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
          OR DATE(STR_TO_DATE(SUBSTRING(l.timestamp, 1, 10), '%Y-%m-%d')) BETWEEN @d_first AND @d_last
        )
        AND BINARY l.email = BINARY de.\`CORREO ELECTRONICO\`
        AND l.email IS NOT NULL
        AND l.email != ''
        AND de.\`CORREO ELECTRONICO\` IS NOT NULL
        AND de.\`CORREO ELECTRONICO\` != ''
      THEN 1
    END) * 2.0 AS puntos_solicitudes,
    -- Documentos: COUNT(*) - numără toate acțiunile
    COUNT(CASE 
      WHEN l.action IN ('documento_uploaded', 'documento_upload', 'documento_oficial_uploaded', 'documento_downloaded', 'documento_oficial_downloaded')
        AND (
          DATE(STR_TO_DATE(REPLACE(REPLACE(l.timestamp, 'T', ' '), 'Z', ''), '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
          OR DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
          OR DATE(STR_TO_DATE(SUBSTRING(l.timestamp, 1, 10), '%Y-%m-%d')) BETWEEN @d_first AND @d_last
        )
        AND BINARY l.email = BINARY de.\`CORREO ELECTRONICO\`
        AND l.email IS NOT NULL
        AND l.email != ''
        AND de.\`CORREO ELECTRONICO\` IS NOT NULL
        AND de.\`CORREO ELECTRONICO\` != ''
      THEN 1
    END) * 3.0 AS puntos_documentos,
    -- Formularios: COUNT(*) - numără toate acțiunile
    COUNT(CASE 
      WHEN l.action IN ('user_updated', 'cambio_personal_created', 'tarea_created', 'tarea_updated', 'user_created', 'user_created_with_pdf')
        AND (
          DATE(STR_TO_DATE(REPLACE(REPLACE(l.timestamp, 'T', ' '), 'Z', ''), '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
          OR DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
          OR DATE(STR_TO_DATE(SUBSTRING(l.timestamp, 1, 10), '%Y-%m-%d')) BETWEEN @d_first AND @d_last
        )
        AND BINARY l.email = BINARY de.\`CORREO ELECTRONICO\`
        AND l.email IS NOT NULL
        AND l.email != ''
        AND de.\`CORREO ELECTRONICO\` IS NOT NULL
        AND de.\`CORREO ELECTRONICO\` != ''
      THEN 1
    END) * 3.0 AS puntos_formularios,
    -- Login: DISTINCT per zi (maxim 1 punct pe zi) - pentru a evita spam-ul
    LEAST(
      COUNT(DISTINCT CASE 
        WHEN l.action IN ('login', 'demo_login')
          AND (
            DATE(STR_TO_DATE(REPLACE(REPLACE(l.timestamp, 'T', ' '), 'Z', ''), '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
            OR DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
            OR DATE(STR_TO_DATE(SUBSTRING(l.timestamp, 1, 10), '%Y-%m-%d')) BETWEEN @d_first AND @d_last
          )
          AND BINARY l.email = BINARY de.\`CORREO ELECTRONICO\`
          AND l.email IS NOT NULL
          AND l.email != ''
          AND de.\`CORREO ELECTRONICO\` IS NOT NULL
          AND de.\`CORREO ELECTRONICO\` != ''
        THEN COALESCE(
          DATE(STR_TO_DATE(REPLACE(REPLACE(l.timestamp, 'T', ' '), 'Z', ''), '%Y-%m-%d %H:%i:%s')),
          DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')),
          DATE(STR_TO_DATE(SUBSTRING(l.timestamp, 1, 10), '%Y-%m-%d'))
        )
      END) * 1.0,
      DAY(@d_last) * 1.0
    ) AS puntos_login
  FROM DatosEmpleados de
  LEFT JOIN Logs l ON BINARY l.email = BINARY de.\`CORREO ELECTRONICO\`
    AND l.email IS NOT NULL
    AND l.email != ''
    AND de.\`CORREO ELECTRONICO\` IS NOT NULL
    AND de.\`CORREO ELECTRONICO\` != ''
    AND (
      DATE(STR_TO_DATE(REPLACE(REPLACE(l.timestamp, 'T', ' '), 'Z', ''), '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
      OR DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
      OR DATE(STR_TO_DATE(SUBSTRING(l.timestamp, 1, 10), '%Y-%m-%d')) BETWEEN @d_first AND @d_last
    )
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),

acciones_totales AS (
  SELECT 
    empleadoId,
    COALESCE(puntos_fichajes, 0) + 
    COALESCE(puntos_solicitudes, 0) + 
    COALESCE(puntos_documentos, 0) + 
    COALESCE(puntos_formularios, 0) + 
    COALESCE(puntos_login, 0) AS acciones_totales
  FROM acciones_empleado
),

max_acciones_mes AS (
  SELECT MAX(acciones_totales) AS max_acciones
  FROM acciones_totales
),

uso_app AS (
  SELECT 
    at.empleadoId,
    at.acciones_totales,
    CASE 
      WHEN mam.max_acciones > 0 THEN
        (at.acciones_totales / mam.max_acciones) * 100
      ELSE 0
    END AS score_uso_app
  FROM acciones_totales at
  CROSS JOIN max_acciones_mes mam
),

-- Responsabilidad digital: Comunicaciones pendientes (3%)
comunicaciones_pendientes AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    CASE 
      -- Dacă nu are comunicados asignate (nu există comunicados publicate), primește 3 puncte
      WHEN NOT EXISTS (
        SELECT 1 FROM comunicados c 
        WHERE c.publicado = 1
      ) THEN 3
      -- Dacă are comunicados necitite, primește 0
      WHEN EXISTS (
        SELECT 1 
        FROM comunicados c
        WHERE c.publicado = 1
          AND NOT EXISTS (
            SELECT 1 
            FROM comunicados_leidos cl 
            WHERE cl.comunicado_id = c.id 
              AND BINARY cl.user_id = BINARY CAST(de.CODIGO AS CHAR)
          )
      ) THEN 0
      -- Dacă toate comunicados sunt citite, primește 3 puncte
      ELSE 3
    END AS score_comunicaciones
  FROM DatosEmpleados de
  WHERE de.ESTADO = 'ACTIVO'
),

-- Responsabilidad digital: Documentos pendientes (3%)
documentos_pendientes AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    CASE 
      -- Dacă nu are cereri de documente, primește 3 puncte
      WHEN NOT EXISTS (
        SELECT 1 FROM documentos_solicitados ds 
        WHERE BINARY ds.empleado_id = BINARY CAST(de.CODIGO AS CHAR)
      ) THEN 3
      -- Dacă are cereri și nu le-a urcat (estado = 'pendiente'), primește 0
      WHEN EXISTS (
        SELECT 1 FROM documentos_solicitados ds 
        WHERE BINARY ds.empleado_id = BINARY CAST(de.CODIGO AS CHAR)
          AND BINARY ds.estado = BINARY 'pendiente'
      ) THEN 0
      -- Dacă totul este urcat (nu are cereri pendiente), primește 3 puncte
      ELSE 3
    END AS score_documentos
  FROM DatosEmpleados de
  WHERE de.ESTADO = 'ACTIVO'
),

-- Responsabilidad digital: Inspecciones (4%)
-- Pentru supervizori: minim 1 inspecție pe zi lucrătoare
-- Pentru angajați normali: scorul mediu al inspecțiilor
-- Calculăm zilele lucrătoare per angajat, excluzând vacaciones, bajas, festivos, ausencias
dias_laborables_mes AS (
  SELECT 
    dp.empleadoId,
    COUNT(*) AS dias_laborables
  FROM daily_plan dp
  WHERE dp.fecha >= @d_first 
    -- Pentru luna curentă, folosim @d_today; pentru luni trecute, folosim @d_last
    AND dp.fecha <= CASE WHEN @d_today < @d_last THEN @d_today ELSE @d_last END
    -- Exclude weekend-uri (în MySQL: Duminică = 1, Sâmbătă = 7)
    AND DAYOFWEEK(dp.fecha) NOT IN (1, 7)
    -- Exclude zilele neutre: bajas, vacaciones, festivos (pentru cei care nu lucrează în festivos), ausencias
    -- O zi este lucrătoare dacă are horas_plan > 0 (adică nu este baja, vacaciones, festivo sau ausencia)
    AND dp.horas_plan > 0
  GROUP BY dp.empleadoId
),
inspecciones_count_mes AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    COUNT(id.id) AS num_inspecciones
  FROM DatosEmpleados de
  LEFT JOIN InspeccionesDocumentos id 
    ON (
      -- Pentru supervizori: verifică codigo_supervisor
      (BINARY UPPER(TRIM(de.GRUPO)) = BINARY 'SUPERVISOR' 
        AND BINARY id.codigo_supervisor = BINARY CAST(de.CODIGO AS CHAR))
      OR
      -- Pentru angajați normali: verifică codigo_empleado
      (BINARY UPPER(TRIM(de.GRUPO)) <> BINARY 'SUPERVISOR' 
        AND BINARY id.codigo_empleado = BINARY CAST(de.CODIGO AS CHAR))
    )
    AND id.fecha_subida IS NOT NULL
    AND TRIM(id.fecha_subida) <> ''
    AND (
      DATE(STR_TO_DATE(id.fecha_subida, '%Y-%m-%d')) >= @d_first 
      AND DATE(STR_TO_DATE(id.fecha_subida, '%Y-%m-%d')) <= @d_last
      OR DATE(STR_TO_DATE(id.fecha_subida, '%Y-%m-%d %H:%i:%s')) >= @d_first 
      AND DATE(STR_TO_DATE(id.fecha_subida, '%Y-%m-%d %H:%i:%s')) <= @d_last
    )
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),
inspecciones_score AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    CASE 
      -- Pentru supervizori: verifică dacă au minim 1 inspecție pe zi lucrătoare
      WHEN BINARY UPPER(TRIM(de.GRUPO)) = BINARY 'SUPERVISOR' THEN
        CASE 
          -- Dacă nu are zile lucrătoare în lună (ex: toată luna în vacanță), primește 4 puncte
          WHEN COALESCE(dlm.dias_laborables, 0) = 0 THEN 4
          -- Calculează: (număr_inspecții / zile_lucrătoare) * 4, maxim 4
          -- Dacă are cel puțin 1 inspecție pe zi lucrătoare, primește 4 puncte
          ELSE LEAST(4, 
            (COALESCE(icm.num_inspecciones, 0) / GREATEST(dlm.dias_laborables, 1)) * 4
          )
        END
      -- Pentru angajați normali: dacă nu are inspecții, primește 4 puncte
      WHEN NOT EXISTS (
        SELECT 1 FROM InspeccionesDocumentos id 
        WHERE BINARY id.codigo_empleado = BINARY CAST(de.CODIGO AS CHAR)
          AND id.fecha_subida IS NOT NULL
          AND TRIM(id.fecha_subida) <> ''
          AND (
            DATE(STR_TO_DATE(id.fecha_subida, '%Y-%m-%d')) >= @d_first 
            AND DATE(STR_TO_DATE(id.fecha_subida, '%Y-%m-%d')) <= @d_last
            OR DATE(STR_TO_DATE(id.fecha_subida, '%Y-%m-%d %H:%i:%s')) >= @d_first 
            AND DATE(STR_TO_DATE(id.fecha_subida, '%Y-%m-%d %H:%i:%s')) <= @d_last
          )
      ) THEN 4
      -- Pentru angajați normali: normalizăm scorul mediu de la 0-5 la 0-4 (KPI-ul pentru inspecții este 4%)
      -- Formula: (scor_mediu / 5) * 4, maxim 4 puncte
      ELSE LEAST(4, 
        COALESCE((
          SELECT (AVG(id.scor_total) / 5.0) * 4.0
          FROM InspeccionesDocumentos id 
          WHERE BINARY id.codigo_empleado = BINARY CAST(de.CODIGO AS CHAR)
            AND id.scor_total IS NOT NULL
            AND id.scor_total >= 0
            AND id.scor_total <= 5
            AND id.fecha_subida IS NOT NULL
            AND TRIM(id.fecha_subida) <> ''
            AND (
              DATE(STR_TO_DATE(id.fecha_subida, '%Y-%m-%d')) >= @d_first 
              AND DATE(STR_TO_DATE(id.fecha_subida, '%Y-%m-%d')) <= @d_last
              OR DATE(STR_TO_DATE(id.fecha_subida, '%Y-%m-%d %H:%i:%s')) >= @d_first 
              AND DATE(STR_TO_DATE(id.fecha_subida, '%Y-%m-%d %H:%i:%s')) <= @d_last
            )
        ), 4)
      )
    END AS score_inspecciones
  FROM DatosEmpleados de
  LEFT JOIN dias_laborables_mes dlm ON BINARY dlm.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  LEFT JOIN inspecciones_count_mes icm ON BINARY icm.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  WHERE de.ESTADO = 'ACTIVO'
),

-- Responsabilidad digital: Detalii pentru breakdown
responsabilidad_digital_detalle AS (
  SELECT 
    cp.empleadoId,
    COALESCE(cp.score_comunicaciones, 0) + 
    COALESCE(dp.score_documentos, 0) + 
    COALESCE(ins.score_inspecciones, 0) AS score_responsabilidad_digital,
    -- Detalii comunicaciones
    (
      SELECT COUNT(*) 
      FROM comunicados c
      WHERE c.publicado = 1
        AND NOT EXISTS (
          SELECT 1 FROM comunicados_leidos cl 
          WHERE cl.comunicado_id = c.id 
            AND BINARY cl.user_id = BINARY cp.empleadoId
        )
    ) AS comunicaciones_no_leidas,
    (
      SELECT COUNT(*) 
      FROM comunicados c
      WHERE c.publicado = 1
        AND EXISTS (
          SELECT 1 FROM comunicados_leidos cl 
          WHERE cl.comunicado_id = c.id 
            AND BINARY cl.user_id = BINARY cp.empleadoId
        )
    ) AS comunicaciones_leidas,
    (
      SELECT COUNT(*) 
      FROM comunicados c
      WHERE c.publicado = 1
    ) AS comunicaciones_totales,
    -- Detalii documentos
    (
      SELECT COUNT(*) 
      FROM documentos_solicitados ds 
      WHERE BINARY ds.empleado_id = BINARY cp.empleadoId
        AND BINARY ds.estado = BINARY 'pendiente'
    ) AS documentos_pendientes_count,
    (
      SELECT COUNT(*) 
      FROM documentos_solicitados ds 
      WHERE BINARY ds.empleado_id = BINARY cp.empleadoId
        AND BINARY ds.estado = BINARY 'completado'
    ) AS documentos_completados_count,
    (
      SELECT COUNT(*) 
      FROM documentos_solicitados ds 
      WHERE BINARY ds.empleado_id = BINARY cp.empleadoId
    ) AS documentos_totales_count,
    -- Detalii inspecciones
    COALESCE(icm.num_inspecciones, 0) AS inspecciones_count,
    COALESCE(dlm.dias_laborables, 0) AS dias_laborables_mes,
    (
      SELECT AVG(id.scor_total) 
      FROM InspeccionesDocumentos id 
      WHERE BINARY id.codigo_empleado = BINARY cp.empleadoId
        AND id.scor_total IS NOT NULL
        AND id.scor_total >= 0
        AND id.scor_total <= 100
        AND id.fecha_subida IS NOT NULL
        AND TRIM(id.fecha_subida) <> ''
        AND (
          DATE(STR_TO_DATE(id.fecha_subida, '%Y-%m-%d')) >= @d_first 
          AND DATE(STR_TO_DATE(id.fecha_subida, '%Y-%m-%d')) <= @d_last
          OR DATE(STR_TO_DATE(id.fecha_subida, '%Y-%m-%d %H:%i:%s')) >= @d_first 
          AND DATE(STR_TO_DATE(id.fecha_subida, '%Y-%m-%d %H:%i:%s')) <= @d_last
        )
    ) AS inspecciones_scor_medio,
    COALESCE(cp.score_comunicaciones, 0) AS score_comunicaciones,
    COALESCE(dp.score_documentos, 0) AS score_documentos,
    COALESCE(ins.score_inspecciones, 0) AS score_inspecciones
  FROM comunicaciones_pendientes cp
  LEFT JOIN documentos_pendientes dp ON BINARY dp.empleadoId = BINARY cp.empleadoId
  LEFT JOIN inspecciones_score ins ON BINARY ins.empleadoId = BINARY cp.empleadoId
  LEFT JOIN inspecciones_count_mes icm ON BINARY icm.empleadoId = BINARY cp.empleadoId
  LEFT JOIN dias_laborables_mes dlm ON BINARY dlm.empleadoId = BINARY cp.empleadoId
),

scoring AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    de.\`NOMBRE / APELLIDOS\` AS empleadoNombre,
    de.GRUPO AS grupo,
    GREATEST(0, 
      CASE 
        WHEN ta.target_ajustat > 0 AND COALESCE(hp.horas_pontate, 0) > 0 THEN
          CASE 
            WHEN (COALESCE(hp.horas_pontate, 0) / ta.target_ajustat) < 0.8 THEN
              LEAST(75, (COALESCE(hp.horas_pontate, 0) / ta.target_ajustat) * 100)
            ELSE
              LEAST(100, (COALESCE(hp.horas_pontate, 0) / ta.target_ajustat) * 100)
          END
        WHEN ta.target_ajustat > 0 AND COALESCE(hp.horas_pontate, 0) = 0 THEN
          0
        ELSE 0
      END - 
      (COALESCE(cp.fichajes_sin_direccion, 0) * 2) -
      (COALESCE(cp.regularizaciones_confirmed, 0) * 1.5)
    ) AS score_indeplinire,
    GREATEST(0, 100 - 
      (GREATEST(0, cp.fichajes_incompleto - (cp.regularizaciones_confirmed * 0.5)) * 5) - 
      (cp.regularizaciones_pendiente * 5) -
      (COALESCE(cp.fichajes_sin_direccion, 0) * 3) -
      (COALESCE(cp.regularizaciones_confirmed, 0) * 2)
    ) AS score_calitate,
    CASE 
      WHEN eo.has_orar = 1 AND p.zile_cu_orar > 0 THEN
        (p.zile_punctuale / p.zile_cu_orar) * 100
      WHEN eo.has_orar = 0 THEN
        50  -- Scor neutru pentru angajații fără orar (nu pot fi evaluați la punctualitate)
      ELSE 100
    END AS score_punctualitate,
    COALESCE(ua.score_uso_app, 0) AS score_uso_app,
    COALESCE(rd.score_responsabilidad_digital, 0) AS score_responsabilidad_digital,
    ta.target_ajustat AS target_ajustat_val,
    ta.target_initial AS target_initial_debug_val,
    ta.cs_horas_debug AS ta_cs_horas_debug,
    ta.hm_horas_debug AS ta_hm_horas_debug,
    cs.horas_cuadrante_mes AS cs_horas_debug,
    hm.horas_horario_mes AS hm_horas_debug,
    -- Pentru luna curentă, folosim zile_neutre_hasta_hoy; pentru luni trecute, zile_neutre
    CASE
      WHEN @d_today < @d_last THEN
        COALESCE(znh.dias_baja_hasta_hoy, 0) + COALESCE(znh.dias_vacaciones_hasta_hoy, 0) + COALESCE(znh.dias_fiesta_hasta_hoy, 0)
      ELSE
        COALESCE(zn.dias_baja, 0) + COALESCE(zn.dias_vacaciones, 0) + COALESCE(zn.dias_fiesta, 0)
    END AS dias_neutre_val,
    JSON_OBJECT(
      'horas_pontate', COALESCE(hp.horas_pontate, 0),
      'target_ajustat', ta.target_ajustat,
      'target_initial', COALESCE(ta.target_initial, 0),
      'target_initial_debug', ta.target_initial,
      'horas_neutre', ta.horas_neutre,
      'dias_neutre', CASE
        WHEN @d_today < @d_last THEN
          COALESCE(znh.dias_baja_hasta_hoy, 0) + COALESCE(znh.dias_vacaciones_hasta_hoy, 0) + COALESCE(znh.dias_fiesta_hasta_hoy, 0)
        ELSE
          COALESCE(zn.dias_baja, 0) + COALESCE(zn.dias_vacaciones, 0) + COALESCE(zn.dias_fiesta, 0)
      END,
      'fichajes_incompleto', COALESCE(cp.fichajes_incompleto, 0),
      'regularizaciones_confirmed', COALESCE(cp.regularizaciones_confirmed, 0),
      'regularizaciones_pendiente', COALESCE(cp.regularizaciones_pendiente, 0),
      'fichajes_sin_direccion', COALESCE(cp.fichajes_sin_direccion, 0),
      'zile_punctuale', COALESCE(p.zile_punctuale, 0),
      'zile_cu_orar', COALESCE(p.zile_cu_orar, 0),
      'has_orar', eo.has_orar,
      'acciones_totales', COALESCE(ua.acciones_totales, 0),
      'max_acciones_mes', COALESCE(mam.max_acciones, 0),
      'score_responsabilidad_digital', COALESCE(rd.score_responsabilidad_digital, 0),
      'comunicaciones_no_leidas', COALESCE(rd.comunicaciones_no_leidas, 0),
      'comunicaciones_leidas', COALESCE(rd.comunicaciones_leidas, 0),
      'comunicaciones_totales', COALESCE(rd.comunicaciones_totales, 0),
      'documentos_pendientes', COALESCE(rd.documentos_pendientes_count, 0),
      'documentos_completados', COALESCE(rd.documentos_completados_count, 0),
      'documentos_totales', COALESCE(rd.documentos_totales_count, 0),
      'inspecciones_count', COALESCE(rd.inspecciones_count, 0),
      'dias_laborables_mes', COALESCE(rd.dias_laborables_mes, 0),
      'inspecciones_scor_medio', COALESCE(rd.inspecciones_scor_medio, NULL),
      'score_comunicaciones', COALESCE(rd.score_comunicaciones, 0),
      'score_documentos', COALESCE(rd.score_documentos, 0),
      'score_inspecciones', COALESCE(rd.score_inspecciones, 0)
    ) AS breakdown_json
  FROM DatosEmpleados de
  JOIN empleado_orar eo ON BINARY eo.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  JOIN target_ajustat ta ON BINARY ta.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  LEFT JOIN cuadrante_sum cs ON BINARY cs.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  LEFT JOIN horario_mes hm ON BINARY hm.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  LEFT JOIN horas_pontate hp ON BINARY hp.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  LEFT JOIN calitate_pontaj cp ON BINARY cp.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  LEFT JOIN zile_neutre zn ON BINARY zn.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  LEFT JOIN zile_neutre_hasta_hoy znh ON BINARY znh.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  LEFT JOIN punctualitate p ON BINARY p.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  LEFT JOIN uso_app ua ON BINARY ua.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  LEFT JOIN responsabilidad_digital_detalle rd ON BINARY rd.empleadoId = BINARY CAST(de.CODIGO AS CHAR)
  CROSS JOIN max_acciones_mes mam
  WHERE de.ESTADO = 'ACTIVO'
),

scoring_final AS (
  SELECT 
    s.empleadoId,
    s.empleadoNombre,
    s.grupo,
    ROUND(
      (s.score_indeplinire * 0.50) + 
      (s.score_calitate * 0.20) + 
      (s.score_punctualitate * 0.10) + 
      (s.score_uso_app * 0.10) +
      (s.score_responsabilidad_digital * 0.10),
      2
    ) AS score_final,
    s.score_indeplinire,
    s.score_calitate,
    s.score_punctualitate,
    s.score_uso_app,
    s.score_responsabilidad_digital,
    s.breakdown_json,
    s.target_ajustat_val,
    s.target_initial_debug_val,
    s.ta_cs_horas_debug,
    s.ta_hm_horas_debug,
    s.cs_horas_debug,
    s.hm_horas_debug,
    s.dias_neutre_val
  FROM scoring s
)

SELECT 
  empleadoId,
  empleadoNombre,
  grupo,
  score_final,
  score_indeplinire,
  score_calitate,
  score_punctualitate,
  score_uso_app,
  score_responsabilidad_digital,
  breakdown_json,
  target_initial_debug_val,
  ta_cs_horas_debug,
  ta_hm_horas_debug,
  cs_horas_debug,
  hm_horas_debug
FROM scoring_final
-- Excludem angajații care au fost în concediu medical/vacanțe toată luna
-- (dias_neutre = toate zilele lunii)
-- Excludem și angajații pentru probe/teste (ex: ALEXANDRU MIHAI PAULET - 10000001)
WHERE dias_neutre_val < DAY(@d_last)
  AND empleadoId != '10000001'
ORDER BY 
  score_final DESC,
  score_uso_app DESC;
`;

    return sqlTemplate;
  }

  /**
   * Returnează ultima lună disponibilă (cea mai recentă cu date)
   */
  async getLatestMonth(): Promise<string | null> {
    try {
      const latest = await this.prisma.hallOfFameMensual.findFirst({
        orderBy: {
          mes: 'desc',
        },
        select: {
          mes: true,
        },
      });

      return latest?.mes || null;
    } catch (error) {
      this.logger.error(
        `Error getting latest month: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }
}
