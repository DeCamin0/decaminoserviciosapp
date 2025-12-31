/**
 * Helper functions pentru calculul orelor din cuadrante/horario
 * Distinge între:
 * 1. Orar cu ture separate (ex: 3×8h) - angajatul lucrează DOAR o tură pe zi
 * 2. Orar compartit (ex: 09:00-15:00 / 16:00-20:00) - angajatul lucrează TOATE turele
 */

/**
 * Calculează orele dintr-un schedule de cuadrante (pentru backend TypeScript)
 * @param daySchedule - Format "08:00-17:00" sau "09:00-15:00 / 16:00-20:00" sau "24h (3×8h)"
 * @returns Orele calculate (per tură pentru ture separate, suma totală pentru orar compartit)
 */
export function calculateCuadranteHours(
  daySchedule: string | null | undefined,
): number {
  if (!daySchedule || daySchedule === 'LIBRE' || daySchedule.trim() === '') {
    return 0;
  }

  const schedule = String(daySchedule).trim();

  // Format "24h (3×8h)" - extrage orele per tură din paranteză
  const format24hMatch = schedule.match(/^(\d+)h\s*\((\d+)×(\d+)h\)/);
  if (format24hMatch) {
    const totalHours = parseInt(format24hMatch[1]);
    const shiftCount = parseInt(format24hMatch[2]);
    const hoursPerShift = parseInt(format24hMatch[3]);

    // Dacă toate turele au aceeași durată și suma > 12h → orar cu ture separate
    if (totalHours > 12 && shiftCount >= 2) {
      return hoursPerShift; // Returnăm orele per tură
    } else {
      return totalHours; // Returnăm suma totală
    }
  }

  // Format simplu "8h" sau "24h"
  // NOTĂ: Dacă e "24h" fără paranteză, probabil e 3 ture de 8h
  // În practică, dacă e 24h, ar trebui să fie "24h (3×8h)"
  // Dar dacă nu există paranteză, presupunem că e 3 ture de 8h → returnăm 8h per tură
  const simpleFormatMatch = schedule.match(/^(\d+)h$/);
  if (simpleFormatMatch) {
    const hours = parseInt(simpleFormatMatch[1]);
    // Dacă e 24h, probabil e 3 ture de 8h → returnăm 8h per tură
    if (hours === 24) {
      return 8; // 3 ture de 8h = 24h total, dar angajatul lucrează doar 8h/zi
    }
    return hours;
  }

  // Format "08:00-17:00" sau "09:00-15:00 / 16:00-20:00"
  const separators = /[,/]/;
  const hasMultipleShifts = separators.test(schedule);

  if (hasMultipleShifts) {
    // Multiple ture - extrage toate turele
    const timeMatches = schedule.match(
      /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g,
    );
    if (timeMatches && timeMatches.length > 0) {
      const shiftHours: number[] = [];

      timeMatches.forEach((timeMatch) => {
        const match = timeMatch.match(
          /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/,
        );
        if (match) {
          const hours = parseIntervalHours(
            `${match[1]}:${match[2]}`,
            `${match[3]}:${match[4]}`,
          );
          shiftHours.push(hours);
        }
      });

      if (shiftHours.length > 0) {
        const firstShiftHours = shiftHours[0];
        const allSame = shiftHours.every(
          (h) => Math.abs(h - firstShiftHours) < 0.01,
        );
        const totalHours = shiftHours.reduce((sum, h) => sum + h, 0);

        // Distingem între:
        // 1. Orar cu ture separate (ex: 3×8h) - toate turele au aceeași durată (ex: 8h) și suma > 12h
        //    → Angajatul lucrează DOAR o tură pe zi → returnăm durata unei ture (8h)
        // 2. Orar compartit (ex: 09:00-15:00 / 16:00-20:00) - ture cu durate diferite sau suma < 12h
        //    → Angajatul lucrează TOATE turele în aceeași zi → returnăm suma totală (10h)

        if (allSame && totalHours > 12 && shiftHours.length >= 2) {
          // Orar cu ture separate (ex: 3×8h = 24h total, dar angajatul lucrează doar 8h/zi)
          return firstShiftHours;
        } else {
          // Orar compartit - returnăm suma totală
          return totalHours;
        }
      }
    }
  } else {
    // O singură tură în formatul "T1 08:00-16:00" sau "08:00-16:00"
    const match = schedule.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (match) {
      return parseIntervalHours(
        `${match[1]}:${match[2]}`,
        `${match[3]}:${match[4]}`,
      );
    }
  }

  return 0;
}

/**
 * Calculează orele dintr-un interval de timp
 * @param startTime - Format "HH:MM"
 * @param endTime - Format "HH:MM"
 * @returns Orele calculate
 */
function parseIntervalHours(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const start = startHour + startMin / 60;
  let end = endHour + endMin / 60;

  // Deal with overnight shifts
  if (end < start) {
    end += 24;
  }

  return end - start;
}

/**
 * Returnează SQL CASE expression pentru calculul orelor dintr-un valor de cuadrante (ZI_X)
 * Folosește logica: dacă toate turele au aceeași durată și suma > 12h → orar cu ture separate (returnă durata unei ture)
 *                   altfel → orar compartit (returnă suma totală)
 *
 * @param valColumn - Numele coloanei cu valoarea (ex: 'cu.val' sau 'val')
 * @returns SQL CASE expression
 */
export function getCuadranteHoursCaseSQL(valColumn: string): string {
  return `
    CASE 
      WHEN UPPER(TRIM(${valColumn})) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
      WHEN TRIM(${valColumn}) LIKE '%:%-%:%' THEN 
        -- Format "08:00-17:00" sau "08:00-12:00,14:00-18:00"
        (
          SELECT COALESCE(
            CASE 
              WHEN COUNT(*) > 1 AND 
                   COUNT(DISTINCT horas) = 1 AND 
                   SUM(horas) > 12 THEN
                -- Orar cu ture separate (ex: 3×8h) - toate turele identice și suma > 12h
                MAX(horas)
              ELSE
                -- Orar compartit - returnă suma totală
                SUM(horas)
            END,
            0
          )
          FROM (
            SELECT 
              CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(${valColumn}), ',', n.n), ',', -1)), '-', 1), ':', 1) AS UNSIGNED) * 60 +
              CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(${valColumn}), ',', n.n), ',', -1)), '-', 1), ':', -1) AS UNSIGNED) AS start_min,
              CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(${valColumn}), ',', n.n), ',', -1)), '-', -1), ':', 1) AS UNSIGNED) * 60 +
              CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(${valColumn}), ',', n.n), ',', -1)), '-', -1), ':', -1) AS UNSIGNED) AS end_min
            FROM (
              SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
            ) n
            WHERE CHAR_LENGTH(TRIM(${valColumn})) - CHAR_LENGTH(REPLACE(TRIM(${valColumn}), ',', '')) >= n.n - 1
              AND TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(${valColumn}), ',', n.n), ',', -1)) LIKE '%:%-%:%'
          ) AS times
          CROSS JOIN (
            SELECT 
              CASE 
                WHEN end_min < start_min THEN (end_min + 1440 - start_min) / 60.0
                ELSE (end_min - start_min) / 60.0
              END AS horas
          ) AS calc
        )
      WHEN TRIM(${valColumn}) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+×[0-9]+h\\)' THEN 
        -- Format "24h (3×8h)" - extrage orele per tură din paranteză (8h)
        CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(${valColumn}), '×', -1), 'h', 1) AS DECIMAL(10,2))
      WHEN TRIM(${valColumn}) REGEXP '^[0-9]+h' THEN 
        -- Format simplu "8h" sau "24h"
        CAST(SUBSTRING_INDEX(TRIM(${valColumn}), 'h', 1) AS DECIMAL(10,2))
      ELSE 0
    END
  `;
}

/**
 * Versiune simplificată pentru calculul orelor dintr-un valor de cuadrante
 * Folosită în query-uri complexe unde nu putem folosi subquery-uri
 *
 * @param valColumn - Numele coloanei cu valoarea
 * @returns SQL CASE expression simplificat
 */
export function getCuadranteHoursSimpleSQL(valColumn: string): string {
  return `
    CASE 
      WHEN UPPER(TRIM(${valColumn})) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
      WHEN TRIM(${valColumn}) LIKE '%:%-%:%' THEN 
        -- Format "08:00-17:00" - calculează diferența de timp
        (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(${valColumn}),' ',-1),'-',-1),' ',1), '%H:%i'))
          - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(${valColumn}),' ',-1),'-', 1),' ',1), '%H:%i'))
          + 86400) % 86400) / 3600)
      WHEN TRIM(${valColumn}) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+×[0-9]+h\\)' THEN 
        -- Format "24h (3×8h)" - extrage orele per tură din paranteză (8h)
        CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(${valColumn}), '×', -1), 'h', 1) AS DECIMAL(10,2))
      WHEN TRIM(${valColumn}) REGEXP '^[0-9]+h' THEN 
        -- Format simplu "8h" sau "24h" - pentru orar compartit, folosește valoarea directă
        -- NOTĂ: Această versiune simplificată nu distinge între ture separate și compartite
        -- Pentru acuratețe completă, folosește getCuadranteHoursCaseSQL
        CAST(SUBSTRING_INDEX(TRIM(${valColumn}), 'h', 1) AS DECIMAL(10,2))
      ELSE 0
    END
  `;
}
