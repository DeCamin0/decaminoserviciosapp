// Tipuri pentru gestionarea orarelor de lucru
// Un orar se aplică pe Centro (comunitate) + Grupo (grup de angajați)

export type DayKey = 'L' | 'M' | 'X' | 'J' | 'V' | 'S' | 'D';

export interface TimeInterval {
  in?: string;  // Format: "HH:MM"
  out?: string; // Format: "HH:MM"
}

export interface DaySchedule {
  intervals: [TimeInterval, TimeInterval, TimeInterval]; // Max 3 sloturi pe zi
}

export interface WeeklySchedule {
  L: DaySchedule;
  M: DaySchedule;
  X: DaySchedule;
  J: DaySchedule;
  V: DaySchedule;
  S: DaySchedule;
  D: DaySchedule;
}

export interface ScheduleData {
  nombre: string;
  centroId: number | null;
  grupoId: number | null;
  // Optional: include readable values for backend convenience
  centroNombre?: string | null;
  grupoNombre?: string | null;
  vigenteDesde: string | null; // YYYY-MM-DD
  vigenteHasta: string | null; // YYYY-MM-DD
  weeklyBreakMinutes: number;
  entryMarginMinutes: number;
  exitMarginMinutes: number;
  days: WeeklySchedule;
}

export interface ScheduleValidationError {
  field: string;
  message: string;
}

// Funcții utilitare pentru calcule

/**
 * Convertește timpul din format "HH:MM" în minute
 */
export function toMinutes(timeStr: string): number | null {
  if (!timeStr || timeStr.trim() === '') return null;
  
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  
  return hours * 60 + minutes;
}

/**
 * Calculează minutele lucrate într-o zi (fără descanso)
 */
export function calcDayMinutes(day: DaySchedule): number {
  let totalMinutes = 0;
  
  for (const interval of day.intervals) {
    if (interval.in && interval.out) {
      const inMinutes = toMinutes(interval.in);
      const outMinutes = toMinutes(interval.out);
      
      if (inMinutes !== null && outMinutes !== null && outMinutes > inMinutes) {
        totalMinutes += outMinutes - inMinutes;
      }
    }
  }
  
  return totalMinutes;
}

/**
 * Calculează minutele lucrate într-o săptămână (fără descanso)
 */
export function calcWeekMinutes(weekly: WeeklySchedule): number {
  const days: DayKey[] = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  let totalMinutes = 0;
  
  for (const day of days) {
    totalMinutes += calcDayMinutes(weekly[day]);
  }
  
  return totalMinutes;
}

/**
 * Convertește minutele în format "Xh Ym"
 */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins}m`;
  } else if (mins === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${mins}m`;
  }
}

/**
 * Verifică dacă două intervale de timp se suprapun
 */
export function intervalsOverlap(interval1: TimeInterval, interval2: TimeInterval): boolean {
  if (!interval1.in || !interval1.out || !interval2.in || !interval2.out) {
    return false;
  }
  
  const start1 = toMinutes(interval1.in);
  const end1 = toMinutes(interval1.out);
  const start2 = toMinutes(interval2.in);
  const end2 = toMinutes(interval2.out);
  
  if (start1 === null || end1 === null || start2 === null || end2 === null) {
    return false;
  }
  
  // Verifică suprapunerea: start1 < end2 && start2 < end1
  return start1 < end2 && start2 < end1;
}

/**
 * Validează un interval de timp
 */
export function validateTimeInterval(interval: TimeInterval): string[] {
  const errors: string[] = [];
  
  if (interval.in && !interval.out) {
    errors.push('Salida es obligatoria cuando hay Entrada');
  }
  
  if (!interval.in && interval.out) {
    errors.push('Entrada es obligatoria cuando hay Salida');
  }
  
  if (interval.in && interval.out) {
    const inMinutes = toMinutes(interval.in);
    const outMinutes = toMinutes(interval.out);
    
    if (inMinutes === null) {
      errors.push('Formato de Entrada inválido (use HH:MM)');
    }
    
    if (outMinutes === null) {
      errors.push('Formato de Salida inválido (use HH:MM)');
    }
    
    // IMPORTANT: Permite ture nocturne (ex: 23:00 - 07:00)
    // Pentru o tura nocturnă, outMinutes < inMinutes e valid (ex: 23:00 = 1380, 07:00 = 420)
    // Verificăm doar cazul în care intervalul e mai mic de 1 minut sau durata totală e prea mare
    if (inMinutes !== null && outMinutes !== null) {
      // Calculăm durata (pentru ture nocturne, adunăm 24 ore)
      let duration = outMinutes - inMinutes;
      if (duration < 0) {
        duration = (24 * 60) + outMinutes - inMinutes; // Tura nocturnă
      }
      
      // Durata minimă validă: 1 minut
      // Durata maximă validă: 24 ore (1440 minute)
      if (duration < 1) {
        errors.push('La duración mínima debe ser de 1 minuto');
      } else if (duration > 24 * 60) {
        errors.push('La duración máxima no puede exceder 24 horas');
      }
    }
  }
  
  return errors;
}

/**
 * Validează o zi completă pentru suprapuneri
 */
export function validateDaySchedule(day: DaySchedule): string[] {
  const errors: string[] = [];
  
  // Validează fiecare interval individual
  for (let i = 0; i < day.intervals.length; i++) {
    const intervalErrors = validateTimeInterval(day.intervals[i]);
    intervalErrors.forEach(error => {
      errors.push(`Slot ${i + 1}: ${error}`);
    });
  }
  
  // Verifică suprapunerile între intervale
  for (let i = 0; i < day.intervals.length; i++) {
    for (let j = i + 1; j < day.intervals.length; j++) {
      if (intervalsOverlap(day.intervals[i], day.intervals[j])) {
        errors.push(`Los slots ${i + 1} y ${j + 1} se superponen`);
      }
    }
  }
  
  return errors;
}

/**
 * Validează datele orarului înainte de trimitere
 */
export function validateScheduleData(data: ScheduleData): string[] {
  const errors: string[] = [];

  if (!data.nombre || data.nombre.trim() === '') {
    errors.push('Nombre del horario es obligatorio');
  }

  if (data.centroId === null || data.centroId === undefined) {
    errors.push('Centro es obligatorio');
  }

  if (data.grupoId === null || data.grupoId === undefined) {
    errors.push('Grupo es obligatorio');
  }

  if (data.weeklyBreakMinutes < 0) {
    errors.push('Descanso semanal no puede ser negativo');
  }

  if (data.entryMarginMinutes < 0) {
    errors.push('Margen entrada no puede ser negativo');
  }

  if (data.exitMarginMinutes < 0) {
    errors.push('Margen salida no puede ser negativo');
  }

  // Validează datele de valabilitate
  if (data.vigenteDesde && data.vigenteHasta) {
    const desde = new Date(data.vigenteDesde);
    const hasta = new Date(data.vigenteHasta);
    
    if (desde >= hasta) {
      errors.push('Fecha "Vigente hasta" debe ser posterior a "Vigente desde"');
    }
  }

  return errors;
}
