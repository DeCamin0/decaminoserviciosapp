/**
 * Helper functions pentru calculul orelor din cuadrante/horario
 * Distinge între:
 * 1. Orar cu ture separate (ex: 3×8h) - angajatul lucrează DOAR o tură pe zi
 * 2. Orar compartit (ex: 09:00-15:00 / 16:00-20:00) - angajatul lucrează TOATE turele
 */

/**
 * Extrage toate intervalele HH:MM–HH:MM dintr-o celulă ZI (ex. Castillo:
 * "T1 08:00-14:00 / T2 15:00-19:00 / T3 23:00-06:00"). Ignoră prefixele T1/T2/T3.
 * @param {string|null|undefined} daySchedule
 * @returns {{ start: string, end: string }[]}
 */
export function parseCuadranteDayIntervals(daySchedule) {
  if (!daySchedule || daySchedule === 'LIBRE' || String(daySchedule).trim() === '') {
    return [];
  }
  const s = String(daySchedule).trim();
  const re = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;
  const out = [];
  const pad = (n) => String(Number(n)).padStart(2, '0');
  let m;
  while ((m = re.exec(s)) !== null) {
    out.push({
      start: `${pad(m[1])}:${pad(m[2])}`,
      end: `${pad(m[3])}:${pad(m[4])}`,
    });
  }
  return out;
}

/**
 * @param {string} start - "HH:MM"
 * @param {string} end - "HH:MM"
 */
export function intervalCrossesMidnight(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return false;
  const smin = sh * 60 + sm;
  const emin = eh * 60 + em;
  return emin <= smin;
}

/** Cel puțin un interval HH:MM–HH:MM din text trece peste miezul nopții (ex. 23:00–06:00). */
export function dayScheduleHasOvernightInterval(daySchedule) {
  if (!daySchedule || daySchedule === 'LIBRE') return false;
  const intervals = parseCuadranteDayIntervals(daySchedule);
  return intervals.some(({ start, end }) => intervalCrossesMidnight(start, end));
}

/** Turno compartido: mai multe franje sau mai multe etichete T1/T2/T3 în aceeași celulă ZI. */
export function isCuadranteTurnoCompartidoDisplay(daySchedule) {
  if (!daySchedule || daySchedule === 'LIBRE') return false;
  const s = String(daySchedule).trim();
  const tLabels = s.match(/T[123]/g);
  if (tLabels && tLabels.length > 1) return true;
  return parseCuadranteDayIntervals(s).length > 1;
}

/**
 * Text pentru UI (fichaje, etc.): "08:00 - 14:00 / 15:00 - 19:00 / …"
 */
export function formatCuadranteIntervalsForDisplay(daySchedule) {
  const intervals = parseCuadranteDayIntervals(daySchedule);
  if (intervals.length === 0) {
    return null;
  }
  return intervals.map((i) => `${i.start} - ${i.end}`).join(' / ');
}

/**
 * Calculează orele dintr-un interval de timp
 * @param {string} startTime - Format "HH:MM"
 * @param {string} endTime - Format "HH:MM"
 * @returns {number} Orele calculate
 */
function parseIntervalHours(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let start = startHour + startMin / 60;
  let end = endHour + endMin / 60;
  
  // Deal with overnight shifts
  if (end < start) {
    end += 24;
  }
  
  return end - start;
}

/**
 * Calculează orele dintr-un schedule de cuadrante
 * @param {string} daySchedule - Format "08:00-17:00" sau "09:00-15:00 / 16:00-20:00" sau "24h (3×8h)"
 * @returns {number} Orele calculate (per tură pentru ture separate, suma totală pentru orar compartit)
 */
export function calculateCuadranteHours(daySchedule) {
  if (!daySchedule || daySchedule === 'LIBRE' || daySchedule.trim() === '') {
    return 0;
  }
  
  const s = String(daySchedule).trim();
  
  // Format "24h (3×8h)" - extrage orele per tură din paranteză
  const format24hMatch = s.match(/^(\d+)h\s*\((\d+)×(\d+)h\)/);
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
  const simpleFormatMatch = s.match(/^(\d+(?:\.\d+)?)h$/i);
  if (simpleFormatMatch) {
    return parseFloat(simpleFormatMatch[1]);
  }
  
  // Format simplu numeric: "8", "12", "8.5" (fără "h")
  const numericMatch = s.match(/^(\d+(?:\.\d+)?)$/);
  if (numericMatch) {
    return parseFloat(numericMatch[1]);
  }
  
  // Format "08:00-17:00" sau "09:00-15:00 / 16:00-20:00" sau "T1 07:30-19:30"
  const separators = /[,/]/;
  const hasMultipleShifts = separators.test(s);
  
  if (hasMultipleShifts) {
    // Multiple ture - extrage toate turele
    // Suportă atât "T1 07:30-19:30" (cu spațiu) cât și "T1:07:30-19:30" (cu două puncte)
    const timeMatches = s.match(/(?:T\d+\s*:?)?\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g);
    if (timeMatches && timeMatches.length > 0) {
      const shiftHours = [];
      
      timeMatches.forEach(timeMatch => {
        // Suportă atât "T1 07:30-19:30" (cu spațiu) cât și "T1:07:30-19:30" (cu două puncte)
        const match = timeMatch.match(/(?:T\d+\s*:?)?\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
        if (match) {
          const hours = parseIntervalHours(`${match[1]}:${match[2]}`, `${match[3]}:${match[4]}`);
          shiftHours.push(hours);
        }
      });
      
      if (shiftHours.length > 0) {
        const firstShiftHours = shiftHours[0];
        const allSame = shiftHours.every(h => Math.abs(h - firstShiftHours) < 0.01);
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
    // O singură tură în formatul "T1 08:00-16:00" sau "08:00-16:00" sau "T2 19:30-07:30"
    // Suportă atât "T1 07:30-19:30" (cu spațiu) cât și "T1:07:30-19:30" (cu două puncte)
    const match = s.match(/(?:T\d+\s*:?)?\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (match) {
      return parseIntervalHours(`${match[1]}:${match[2]}`, `${match[3]}:${match[4]}`);
    }
  }
  
  return 0;
}

/**
 * Calculează orele dintr-un schedule de horario (cu in1/out1, in2/out2, in3/out3)
 * @param {object} daySchedule - Object cu in1, out1, in2, out2, in3, out3
 * @returns {number} Orele calculate (per tură pentru ture separate, suma totală pentru orar compartit)
 */
export function calculateHorarioHours(daySchedule) {
  if (!daySchedule) {
    return 0;
  }
  
  const shiftHours = [];
  
  // Helper pentru a calcula orele dintr-un interval
  const calculateIntervalHours = (inTime, outTime) => {
    if (!inTime || !outTime) {
      return 0;
    }
    
    // Extrage doar HH:MM dacă e în format HH:MM:SS
    const inStr = inTime.substring(0, 5);
    const outStr = outTime.substring(0, 5);
    
    const [startHour, startMin] = inStr.split(':').map(Number);
    const [endHour, endMin] = outStr.split(':').map(Number);
    
    if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
      return 0;
    }
    
    let start = startHour + startMin / 60;
    let end = endHour + endMin / 60;
    
    if (end < start) {
      end += 24; // overnight shift
    }
    
    return end - start;
  };
  
  // Calculează orele pentru fiecare interval
  if (daySchedule.in1 && daySchedule.out1) {
    shiftHours.push(calculateIntervalHours(daySchedule.in1, daySchedule.out1));
  }
  
  if (daySchedule.in2 && daySchedule.out2) {
    shiftHours.push(calculateIntervalHours(daySchedule.in2, daySchedule.out2));
  }
  
  if (daySchedule.in3 && daySchedule.out3) {
    shiftHours.push(calculateIntervalHours(daySchedule.in3, daySchedule.out3));
  }
  
  if (shiftHours.length > 0) {
    const firstShiftHours = shiftHours[0];
    const allSame = shiftHours.every(h => Math.abs(h - firstShiftHours) < 0.01);
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
  
  return 0;
}

