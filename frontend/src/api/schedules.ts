// Serviciu API pentru gestionarea orarelor prin callApi (consistent cu restul aplicației)
import { ScheduleData } from '../types/schedule';

// URL-ul pentru backend-ul NestJS pentru horarios (MIGRAT de la n8n)
const HORARIOS_BACKEND_URL = import.meta.env.DEV
  ? 'http://localhost:3000/api/horarios'
  : 'https://api.decaminoservicios.com/api/horarios';
// Old n8n endpoint: 'https://n8n.decaminoservicios.com/webhook/orar/36c95b72-cc22-4783-a749-521bdb666a58';

// Interface pentru callApi function
interface CallApiFunction {
  (endpoint: string, data?: any): Promise<any>;
}

// Interface pentru răspuns API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Interface pentru răspuns JSON din API
interface ApiJsonResponse {
  success?: boolean;
  data?: any;
  error?: string;
  message?: string;
  [key: string]: any; // Pentru alte proprietăți dinamic
}

// Interface pentru orar din API
interface ScheduleApiItem {
  id: number;
  centro: string;
  vigenteDesde?: string;
  vigenteHasta?: string;
  lunes?: string;
  martes?: string;
  miercoles?: string;
  jueves?: string;
  viernes?: string;
  sabado?: string;
  domingo?: string;
  [key: string]: any; // Pentru alte proprietăți dinamic
}

/**
 * Creează un orar nou prin webhook n8n
 */
export async function createSchedule(callApi: CallApiFunction, scheduleData: ScheduleData): Promise<ApiResponse<ScheduleData>> {
  try {
    // Normalizează stringurile goale la null
    const normalizedData: ScheduleData = {
      ...scheduleData,
      vigenteDesde: scheduleData.vigenteDesde || null,
      vigenteHasta: scheduleData.vigenteHasta || null,
    };

    console.log('📤 Enviando orar a backend:', normalizedData);
    console.log('🔗 Backend URL:', HORARIOS_BACKEND_URL);

    // Obține JWT token pentru autentificare
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Trimite la backend-ul NestJS
    const response = await fetch(HORARIOS_BACKEND_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'create',
        payload: normalizedData,
      }),
    });

    // Încearcă să parsezi JSON-ul chiar și pe erori 4xx/5xx pentru a extrage mesajul backend-ului
    let result: ApiJsonResponse | null = null;
    try {
      result = await response.json();
    } catch (_) {
      // Ignoră dacă nu e JSON
    }

    const messageFromBackend = result?.message || result?.msg || result?.error;

    if (!response.ok) {
      const errorMessage = messageFromBackend || `HTTP ${response.status}: ${response.statusText}`;
      return {
        success: false,
        data: result || undefined,
        error: errorMessage,
        message: errorMessage
      };
    }

    console.log('✅ Orar creat cu succes via backend:', result);
    
    return {
      success: true,
      data: result,
      message: messageFromBackend || 'Horario creado'
    };

  } catch (error) {
    console.error('❌ Eroare la crearea orarului:', error);
    
    const humanMessage = 'No se pudo conectar con el servidor (Failed to fetch)';
    return {
      success: false,
      error: error instanceof Error ? error.message : humanMessage,
      message: humanMessage
    };
  }
}

/**
 * Obține un orar existent prin callApi
 */
export async function getSchedule(callApi: CallApiFunction, scheduleId: string | number): Promise<ApiResponse<ScheduleData>> {
  try {
    console.log('📥 Obținând orarul:', scheduleId);

    const result = await callApi({
      action: 'get',
      table: 'horarios',
      id: scheduleId
    });
    
    console.log('✅ Orar obținut cu succes:', result);
    
    return {
      success: true,
      data: result,
      message: 'Orar obținut cu succes'
    };

  } catch (error) {
    console.error('❌ Eroare la obținerea orarului:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Eroare necunoscută la obținerea orarului'
    };
  }
}

/**
 * Lista toate orarele prin callApi
 */
export async function listSchedules(_callApi: CallApiFunction): Promise<ApiResponse<ScheduleData[]>> {
  try {
    console.log('📋 Listando orarele via backend');

    // Obține JWT token pentru autentificare
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Poți folosi fie GET, fie POST cu action='get'
    const response = await fetch(HORARIOS_BACKEND_URL, {
      method: 'GET',
      headers,
    });

    let result: ApiJsonResponse | null = null;
    try { result = await response.json(); } catch (_) {}
    console.log('📦 RAW horarios response:', result);

    const messageFromBackend = result?.message || result?.msg || result?.error;

    if (!response.ok) {
      return {
        success: false,
        error: messageFromBackend || `HTTP ${response.status}: ${response.statusText}`,
        message: messageFromBackend
      };
    }

    const raw = Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []);
    console.log('🧾 RAW horarios array:', raw);

    // Normalizează răspunsul backend-ului în format unitar pentru UI
    const toHHMM = (v: string | number | Date | null | undefined): string | null => {
      if (!v) return null;
      
      // Dacă e Date, extrage doar ora (verifică înainte de string pentru că Date.toString() poate da string)
      if (v instanceof Date) {
        // Verifică dacă e un Date valid (nu epoch 0)
        if (v.getTime() === 0 || isNaN(v.getTime())) {
          return null;
        }
        const hours = String(v.getHours()).padStart(2, '0');
        const minutes = String(v.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      }
      
      // Dacă e string, extrage doar HH:MM
      if (typeof v === 'string') {
        // Elimină spații și verifică formatul
        const trimmed = v.trim();
        if (trimmed.length === 0) return null;
        
        // Verifică dacă e un string ISO date (ex: "1970-01-01T08:00:00.000Z")
        // În acest caz, extragem doar partea de timp
        if (trimmed.includes('T') && trimmed.includes('Z')) {
          const isoMatch = trimmed.match(/T(\d{2}):(\d{2}):(\d{2})/);
          if (isoMatch) {
            const hours = parseInt(isoMatch[1], 10);
            const minutes = parseInt(isoMatch[2], 10);
            
            // Validare: orele trebuie să fie între 0-23, minutele între 0-59
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
              return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
          }
          return null;
        }
        
        // Suportă format HH:MM:SS sau HH:MM
        const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          
          // Validare: orele trebuie să fie între 0-23, minutele între 0-59
          if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          }
        }
        
        return null;
      }
      
      // Dacă e number (timestamp), încearcă să-l convertească
      if (typeof v === 'number') {
        // Verifică dacă nu e epoch 0 sau invalid
        if (v === 0 || isNaN(v)) {
          return null;
        }
        const date = new Date(v);
        if (!isNaN(date.getTime()) && date.getTime() !== 0) {
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${hours}:${minutes}`;
        }
      }
      
      return null;
    };

    const normalized = raw.map((it: ScheduleApiItem, idx: number) => {
      // Debug: log primul orar pentru a vedea formatul exact
      if (idx === 0) {
        console.log('🔍 DEBUG schedules.ts - Primul orar RAW din backend:', it);
        console.log('🔍 DEBUG schedules.ts - lun_in1 RAW:', it.lun_in1, 'type:', typeof it.lun_in1);
        console.log('🔍 DEBUG schedules.ts - lun_out1 RAW:', it.lun_out1, 'type:', typeof it.lun_out1);
        console.log('🔍 DEBUG schedules.ts - lun_in1 normalized:', toHHMM(it.lun_in1));
        console.log('🔍 DEBUG schedules.ts - lun_out1 normalized:', toHHMM(it.lun_out1));
      }
      
      // Hărți pentru zile (ro -> sp/keys L..D dacă vom extinde pe viitor)
      const mapDay = (prefix: string) => {
        const result = {
          in1: toHHMM(it[`${prefix}_in1`]), out1: toHHMM(it[`${prefix}_out1`]),
          in2: toHHMM(it[`${prefix}_in2`]), out2: toHHMM(it[`${prefix}_out2`]),
          in3: toHHMM(it[`${prefix}_in3`]), out3: toHHMM(it[`${prefix}_out3`])
        };
        
        // Debug pentru prima zi (Luni)
        if (idx === 0 && prefix === 'lun') {
          console.log('🔍 DEBUG schedules.ts - mapDay(lun) result:', result);
        }
        
        return result;
      };

      const days = {
        L: mapDay('lun'), // posibil să nu existe în toate payload-urile; e ok dacă e undefined
        M: mapDay('mar'),
        X: mapDay('mie'),
        J: mapDay('joi'),
        V: mapDay('vin'),
        S: mapDay('sam'),
        D: mapDay('dum')
      };
      
      // Debug pentru primul orar
      if (idx === 0) {
        console.log('🔍 DEBUG schedules.ts - days object:', days);
        console.log('🔍 DEBUG schedules.ts - days.L:', days.L);
      }

      const totalMinutes = it.total_minutos_semanales ?? it.totalMinutes ?? null;
      // Calculăm orele corecte din minute (1050 min = 17.5 ore)
      const calculatedHours = typeof totalMinutes === 'number' ? Number((totalMinutes / 60).toFixed(2)) : null;
      // Folosim calculul din minute dacă există, altfel folosim valoarea din backend
      // Dacă backend-ul returnează un număr rotunjit greșit (ex: 18 în loc de 17.5), preferăm calculul corect
      const totalHours = calculatedHours ?? it.total_horas_semanales ?? null;

      // Helper pentru a normaliza datele ISO la format YYYY-MM-DD pentru input-uri de tip date
      const normalizeDateForInput = (date: string | null | undefined): string | null => {
        if (!date) return null;
        // Dacă e deja în format YYYY-MM-DD, returnează-l direct
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
        // Dacă e în format ISO (2025-12-18T00:00:00.000Z), extrage doar partea de dată
        if (date.includes('T')) {
          return date.split('T')[0];
        }
        return date;
      };

      return {
        id: it.id || it._id || idx,
        nombre: it.nombre || it.name || '-',
        centroNombre: it.centro_nombre || it.centroNombre || it.centro || it.centroId || '-',
        grupoNombre: it.grupo_nombre || it.grupoNombre || it.grupo || it.grupoId || '-',
        vigenteDesde: normalizeDateForInput(it.vigente_desde || it.vigenteDesde || it.desde),
        vigenteHasta: normalizeDateForInput(it.vigente_hasta || it.vigenteHasta || it.hasta),
        createdAt: it.created_at || it.createdAt || null,
        totalWeekMinutes: totalMinutes,
        totalWeekHours: totalHours,
        entryMarginMinutes: it.entry_margin_minutes ?? it.entryMarginMinutes ?? null,
        exitMarginMinutes: it.exit_margin_minutes ?? it.exitMarginMinutes ?? null,
        weeklyBreakMinutes: it.weekly_break_minutes ?? it.weeklyBreakMinutes ?? null,
        days
      } as any;
    });

    return {
      success: true,
      data: normalized as any,
      message: messageFromBackend || 'Orarele obținute cu succes'
    };

  } catch (error) {
    console.error('❌ Eroare la obținerea orarelor:', error);
    const humanMessage = 'No se pudo conectar con el servidor (Failed to fetch)';
    return {
      success: false,
      error: error instanceof Error ? error.message : humanMessage,
      message: humanMessage
    };
  }
}

/**
 * Actualizează un orar prin callApi
 */
export async function updateSchedule(callApi: CallApiFunction, scheduleId: string | number, scheduleData: ScheduleData): Promise<ApiResponse<ScheduleData>> {
  try {
    // Normalizează stringurile goale la null
    const normalizedData: ScheduleData = {
      ...scheduleData,
      vigenteDesde: scheduleData.vigenteDesde || null,
      vigenteHasta: scheduleData.vigenteHasta || null,
    };

    console.log('📝 Actualizando orar:', scheduleId, normalizedData);

    // Obține JWT token pentru autentificare
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Folosește backend-ul NestJS
    const response = await fetch(HORARIOS_BACKEND_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'update',
        payload: {
          id: scheduleId,
          ...normalizedData
        },
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Orar actualizat cu succes:', result);
    
    return {
      success: true,
      data: result,
      message: 'Orar actualizat cu succes'
    };

  } catch (error) {
    console.error('❌ Eroare la actualizarea orarului:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Eroare necunoscută la actualizarea orarului'
    };
  }
}

/**
 * Șterge un orar prin n8n webhook direct (cu verificare ID + Centro)
 */
export async function deleteSchedule(callApi: CallApiFunction, scheduleId: string | number, centroNombre: string): Promise<ApiResponse<null>> {
  try {
    console.log('🗑️ Eliminando orar:', scheduleId, 'desde centro:', centroNombre);

    // Obține JWT token pentru autentificare
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Folosește backend-ul NestJS
    const response = await fetch(HORARIOS_BACKEND_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'delete',
        payload: {
          id: scheduleId,
          centroNombre: centroNombre
        },
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Orar eliminat cu succes:', result);

    return {
      success: true,
      data: null,
      message: (result && (result.message || result.msg)) || 'Horario eliminado'
    };
  } catch (error) {
    console.error('❌ Eroare la eliminarea orarului:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Eroare necunoscută la eliminare'
    };
  }
}

