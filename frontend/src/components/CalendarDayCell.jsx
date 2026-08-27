import { memo, useMemo, useCallback, useState, useEffect } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { dayScheduleHasOvernightInterval } from '../utils/cuadrante-hours-helper.js';

function getMiHorarioCellClass(cell, isCurrentDay, alertaFichajReal) {
  const classes = ['mi-horario-cell'];
  const tip = cell.tip;
  if (tip === 'Vacaciones') classes.push('mi-horario-cell--vacaciones');
  else if (tip === 'Asunto Propio') classes.push('mi-horario-cell--asunto');
  else if (tip === 'Baja Médica') classes.push('mi-horario-cell--baja');
  else if (tip === 'Fiesta') classes.push('mi-horario-cell--fiesta');
  else if (tip === 'LIBRE') classes.push('mi-horario-cell--libre');
  else if (['T1', 'T2', 'T3', 'TC'].includes(tip)) classes.push('mi-horario-cell--laborable');
  if (alertaFichajReal && tip !== 'Fiesta') classes.push('mi-horario-cell--alert');
  if (isCurrentDay) classes.push('mi-horario-cell--today');
  return classes.join(' ');
}

/**
 * CalendarDayCell - Componentă pentru o zi din calendar
 * Extrasă din CuadrantesEmpleadoPage pentru a reduce AST și rezolva problema OOM la ESLint
 */
const CalendarDayCell = memo(({ 
  cell, 
  selectedLunaNorm, 
  ziSelectata, 
  handleResolveAlert, 
  handleIndicarMotivo,
  regularizacionesConfirmadas,
  loadingFichajes = false,
  loadingRegularizaciones = false,
  fichajes = []
}) => {
  // Detectează dacă e pe mobile portrait
  const [isMobilePortrait, setIsMobilePortrait] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(max-width: 767px) and (orientation: portrait)');
    const handleChange = (e) => setIsMobilePortrait(e.matches);
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }
    
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // Calculează ziua săptămânii pentru ziua curentă
  const dayOfWeek = useMemo(() => {
    const [year, month] = selectedLunaNorm.split('-').map(Number);
    const date = new Date(year, month - 1, cell.day);
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return days[date.getDay()];
  }, [selectedLunaNorm, cell.day]);

  /** Text complet ZI_* (turno compartido) sau reconstruit din tip + orar */
  const rawPlanForCell = useMemo(() => {
    if (cell.ziRaw && String(cell.ziRaw).trim()) return String(cell.ziRaw).trim();
    const t = cell.tip;
    const o = (cell.orar || '').trim();
    if ((t === 'T1' || t === 'T2' || t === 'T3' || t === 'TC') && o) {
      if (t === 'TC') return o;
      return `${t} ${o}`.trim();
    }
    return '';
  }, [cell.ziRaw, cell.tip, cell.orar]);

  /** Reguli fichaje nocturn (Salida ziua următoare, etc.): T2/T3 sau orice interval peste miezul nopții. */
  const overnightPlan = useMemo(() => {
    if (cell.tip === 'T2' || cell.tip === 'T3') return true;
    if (rawPlanForCell) return dayScheduleHasOvernightInterval(rawPlanForCell);
    return false;
  }, [cell.tip, rawPlanForCell]);
  // Helper pentru formatare data - folosim useCallback pentru a evita recrearea la fiecare render
  const pad2 = (n) => n < 10 ? '0' + n : n;
  const formatDateYMD = useCallback((year, month, day) => year + '-' + pad2(month) + '-' + pad2(day), []);
  
  // Calculez dataZi pentru verificarea regularizărilor
  const [selectedYear, selectedMonth] = selectedLunaNorm.split('-').map(Number);
  const dataZi = formatDateYMD(selectedYear, selectedMonth, cell.day);
  
  // Extragem datele relevante pentru ziua specifică înainte de useMemo
  const fichajesZi = useMemo(() => {
    return Array.isArray(fichajes) ? fichajes.filter(f => 
      (f["FECHA"] || '').startsWith(dataZi)
    ) : [];
  }, [fichajes, dataZi]);
  
  // Pentru turele nocturne, extragem și ziua următoare
  const salidasZiUrmatoare = useMemo(() => {
    if (!overnightPlan || !fichajes) return [];
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const dataZiUrmatoare = cell.day < daysInMonth 
      ? formatDateYMD(selectedYear, selectedMonth, cell.day + 1)
      : formatDateYMD(selectedYear, selectedMonth + 1, 1);
    return Array.isArray(fichajes) ? fichajes.filter(f => 
      f["TIPO"] === 'Salida' && (f["FECHA"] || '').startsWith(dataZiUrmatoare)
    ) : [];
  }, [fichajes, overnightPlan, cell.day, selectedYear, selectedMonth, formatDateYMD]);
  
  // CALCULUL ALERTAFICHAJ ȘI DURATAMUNCA ÎN COMPONENTĂ - cu useMemo pentru optimizare
  const { alertaFichaj, durataMunca, hasRegularizacion } = useMemo(() => {
    let alertaFichaj = false;
    let durataMunca = '';
    
    // LOG pentru ziua 1 și ziua 7
      if (cell.day === 1 || cell.day === 7) {
        console.log(`🔍 [CELL DAY ${cell.day}] CalendarDayCell useMemo start:`, {
        cellTip: cell.tip,
        dataZi,
        hasRegularizacion: regularizacionesConfirmadas?.get(dataZi),
          loadingRegularizaciones,
          fichajesZiLength: fichajesZi.length,
          fichajesZi: fichajesZi
      });
    }
    
    // Verifică dacă ziua are regularizare confirmată
    const hasRegularizacion = regularizacionesConfirmadas?.get(dataZi) === true;
    
    // Verifică pentru toate tipurile de ture (T1, T2, T3)
    // Dacă nu este tură (T1, T2, T3), nu setăm alertaFichaj (ex: Fiesta, LIBRE, Vacaciones, etc.)
    if (cell.tip !== 'T1' && cell.tip !== 'T2' && cell.tip !== 'T3' && cell.tip !== 'TC') {
      if (cell.day === 1) {
        console.log('✅ [CELL DAY 1] Nu este tură, return early (tip:', cell.tip, ')');
      }
      return { alertaFichaj, durataMunca, hasRegularizacion };
    }
    
    const entradas = fichajesZi.filter(f => f["TIPO"] === 'Entrada');
    const salidas = fichajesZi.filter(f => f["TIPO"] === 'Salida');
    
    // LOG pentru ziua 25
    if (cell.day === 25) {
      console.log('🔍 [CELL DAY 25] Fichajes pentru ziua 25:', {
        dataZi,
        fichajesZi: fichajesZi.map(f => ({
          TIPO: f["TIPO"],
          FECHA: f["FECHA"],
          HORA: f["HORA"],
          DURACION: f["DURACION"],
          effective_minutes: f["effective_minutes"]
        })),
        entradas: entradas.map(f => ({
          FECHA: f["FECHA"],
          HORA: f["HORA"],
          DURACION: f["DURACION"]
        })),
        salidas: salidas.map(f => ({
          FECHA: f["FECHA"],
          HORA: f["HORA"],
          DURACION: f["DURACION"],
          effective_minutes: f["effective_minutes"]
        }))
      });
    }
    
    // Pentru turele nocturne (T2, T3), verificăm și Entrada de pe ziua anterioară
    let entradasZiAnterioara = [];
    if (overnightPlan) {
      if (cell.day > 1) {
        const dataZiAnterioara = formatDateYMD(selectedYear, selectedMonth, cell.day - 1);
        entradasZiAnterioara = Array.isArray(fichajes) ? fichajes.filter(f => 
          f["TIPO"] === 'Entrada' && (f["FECHA"] || '').startsWith(dataZiAnterioara)
        ) : [];
        
        // LOG pentru ziua 25
        if (cell.day === 25) {
          console.log('🔍 [CELL DAY 25] Entradas ziua anterioară (24):', {
            dataZiAnterioara,
            entradasZiAnterioara: entradasZiAnterioara.map(f => ({
              FECHA: f["FECHA"],
              HORA: f["HORA"],
              DURACION: f["DURACION"]
            }))
          });
        }
      } else if (selectedMonth > 1) {
        // Dacă suntem pe prima zi a lunii, verificăm ultima zi a lunii anterioare
        const lastDayPrevMonth = new Date(selectedYear, selectedMonth - 1, 0).getDate();
        const dataZiAnterioara = formatDateYMD(selectedYear, selectedMonth - 1, lastDayPrevMonth);
        entradasZiAnterioara = Array.isArray(fichajes) ? fichajes.filter(f => 
          f["TIPO"] === 'Entrada' && (f["FECHA"] || '').startsWith(dataZiAnterioara)
        ) : [];
      }
    }
    
    // Verifică dacă ziua este trecută
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const currentDay = currentDate.getDate();
    
    const isPastDay = selectedYear < currentYear || 
                     (selectedYear === currentYear && selectedMonth < currentMonth) || 
                     (selectedYear === currentYear && selectedMonth === currentMonth && cell.day < currentDay);
    
    // Pentru turele nocturne, regularizarea este pe workday_date (ziua de început)
    // Verificăm regularizarea pe ziua anterioară DOAR pentru turele nocturne (T2, T3)
    // Pentru turele normale (T1), regularizarea pentru ziua anterioară NU afectează ziua curentă
    let hasRegularizacionAnterioara = false;
    if (overnightPlan) {
      // DOAR pentru turele nocturne verificăm regularizarea pentru ziua anterioară
    if (cell.day > 1) {
      const dataZiAnterioara = formatDateYMD(selectedYear, selectedMonth, cell.day - 1);
      hasRegularizacionAnterioara = regularizacionesConfirmadas?.get(dataZiAnterioara) === true;
    } else if (selectedMonth > 1) {
      // Dacă suntem pe prima zi a lunii, verificăm ultima zi a lunii anterioare
      const lastDayPrevMonth = new Date(selectedYear, selectedMonth - 1, 0).getDate();
      const dataZiAnterioara = formatDateYMD(selectedYear, selectedMonth - 1, lastDayPrevMonth);
      hasRegularizacionAnterioara = regularizacionesConfirmadas?.get(dataZiAnterioara) === true;
      }
    }
    
    const hasRegularizacionFinal = hasRegularizacion || hasRegularizacionAnterioara;
    
    // Pentru turele nocturne (T2, T3), verificăm dacă există DURACION în ziua următoare SAU pe ziua curentă
    // IMPORTANT: Excludem regularizările NO_PUNCH (HORA = 00:00:00) - acestea nu sunt fichajes reale
    let hasDuracionZiUrmatoare = false;
    let hasDuracionZiCurenta = false;
    if (overnightPlan) {
      // Verifică DURACION în Salida de pe ziua următoare (exclude NO_PUNCH)
      if (salidasZiUrmatoare.length > 0) {
        hasDuracionZiUrmatoare = salidasZiUrmatoare.some(f => 
          f["HORA"] !== '00:00:00' && // Exclude NO_PUNCH regularizations
          f["DURACION"] && 
          f["DURACION"].trim() !== '' && 
          f["DURACION"] !== '00:00:00'
        );
      }
      // Verifică DURACION în Salida de pe ziua curentă (exclude NO_PUNCH)
      if (salidas.length > 0) {
        hasDuracionZiCurenta = salidas.some(f => 
          f["HORA"] !== '00:00:00' && // Exclude NO_PUNCH regularizations
          f["DURACION"] && 
          f["DURACION"].trim() !== '' && 
          f["DURACION"] !== '00:00:00'
        );
      }
    } else {
      // Pentru turele normale (T1), verifică DURACION în Salida de pe ziua curentă (exclude NO_PUNCH)
      if (salidas.length > 0) {
        hasDuracionZiCurenta = salidas.some(f => 
          f["HORA"] !== '00:00:00' && // Exclude NO_PUNCH regularizations
          f["DURACION"] && 
          f["DURACION"].trim() !== '' && 
          f["DURACION"] !== '00:00:00'
        );
      }
    }
    
    // Pentru turele nocturne, considerăm că există fichajes complete dacă:
    // - Există Entrada pe ziua curentă (exclude NO_PUNCH) - pentru turele nocturne, Entrada trebuie să fie pe ziua curentă
    //   SAU există Entrada pe ziua anterioară ȘI Salida cu DURACION pe ziua curentă (tura nocturnă care se termină în ziua curentă)
    // IMPORTANT: Dacă există doar Salida pe ziua curentă (fără Entrada pe ziua curentă), 
    // aceasta este partea finală a unei ture de pe ziua anterioară, NU este fichaje pentru ziua curentă
    // - ȘI există Salida cu DURACION pe ziua curentă SAU pe ziua următoare (exclude NO_PUNCH)
    // Regularizările NO_PUNCH (HORA = 00:00:00) nu sunt considerate fichajes complete
    let hasEntradaCompleta = false;
    if (overnightPlan) {
      // Pentru turele nocturne:
      // - Dacă există Entrada pe ziua curentă → completă
      // - SAU dacă există Entrada pe ziua anterioară ȘI Salida cu DURACION pe ziua curentă → completă (tura nocturnă care se termină în ziua curentă)
      // IMPORTANT: Dacă NU există Entrada pe ziua curentă, Salida de pe ziua curentă este partea finală a turei de pe ziua anterioară,
      // deci ziua curentă NU are fichajes proprii și trebuie să fie galbenă
      const hasEntradaCurenta = entradas.filter(f => f["HORA"] !== '00:00:00').length > 0;
      const hasEntradaAnterioara = entradasZiAnterioara.filter(f => f["HORA"] !== '00:00:00').length > 0;
      const hasSalidaCurenta = hasDuracionZiCurenta;
      
      // LOG pentru ziua 25
      if (cell.day === 25) {
        console.log('🔍 [CELL DAY 25] Verificare fichajes complete:', {
          hasEntradaCurenta,
          hasEntradaAnterioara,
          hasSalidaCurenta,
          hasDuracionZiCurenta,
          hasDuracionZiUrmatoare,
          entradasCount: entradas.length,
          entradasZiAnterioaraCount: entradasZiAnterioara.length,
          salidasCount: salidas.length,
          salidasDetails: salidas.map(f => ({
            FECHA: f["FECHA"],
            HORA: f["HORA"],
            DURACION: f["DURACION"]
          }))
        });
      }
      
      // Pentru turele nocturne, ziua curentă are fichajes complete DOAR dacă:
      // - Există Entrada pe ziua curentă (tura începe în ziua curentă)
      // NU considerăm că ziua curentă este completă dacă are doar Salida (care este partea finală a turei de pe ziua anterioară)
      hasEntradaCompleta = hasEntradaCurenta;
    } else {
      // Pentru turele normale (T1), Entrada trebuie să fie pe ziua curentă
      hasEntradaCompleta = entradas.filter(f => f["HORA"] !== '00:00:00').length > 0;
    }
    const hasSalidaCompleta = hasDuracionZiCurenta || hasDuracionZiUrmatoare;
    
    // IMPORTANT: Nu setăm alertaFichaj dacă cell.tip este 'Fiesta' SAU cell.planFuente este 'fiesta' (sărbătoare)
    const isFiesta = cell.tip === 'Fiesta' || cell.planFuente === 'fiesta';
    
    // LOG pentru ziua 25
    if (cell.day === 25) {
      console.log('🔍 [CELL DAY 25] Rezultat verificare:', {
        hasEntradaCompleta,
        hasSalidaCompleta,
        hasRegularizacionFinal,
        isPastDay,
        isFiesta,
        alertaFichaj: !isFiesta && isPastDay && !hasRegularizacionFinal && (!hasEntradaCompleta || !hasSalidaCompleta)
      });
    }
    
    // Setăm alertaFichaj dacă este necesar
    // IMPORTANT: Afișăm "sin fichar" IMEDIAT dacă nu există regularizare în Map
    // Dacă regularizările se încarcă mai târziu:
    //   - Dacă există regularizare → hasRegularizacionFinal devine true, alertaFichaj devine false
    //   - Dacă NU există regularizare → hasRegularizacionFinal rămâne false, alertaFichaj rămâne true
    if (!isFiesta && 
        isPastDay && 
        !hasRegularizacionFinal &&
        (!hasEntradaCompleta || !hasSalidaCompleta)) {
      
      // Dacă NU există regularizare în Map → setăm alertaFichaj IMEDIAT
      // Nu așteptăm loadingRegularizaciones să devină false
      if (!hasRegularizacionFinal) {
        alertaFichaj = true;
        if (cell.day === 1 || cell.day === 7) {
          console.log(`⚠️ [CELL DAY ${cell.day}] Setat alertaFichaj = true:`, {
            isFiesta,
            isPastDay,
            hasRegularizacionFinal,
            hasEntradaCompleta,
            hasSalidaCompleta,
            entradasLength: entradas.length,
            salidasLength: salidas.length
          });
        }
      } else {
        if (cell.day === 1 || cell.day === 7) {
          console.log(`✅ [CELL DAY ${cell.day}] Nu setat alertaFichaj (hasRegularizacionFinal = true)`);
        }
      }
      // Dacă hasRegularizacionFinal este true (există regularizare în Map),
      // alertaFichaj rămâne false și durata se calculează din regularizare
    } else {
      if (cell.day === 1 || cell.day === 7) {
        console.log(`ℹ️ [CELL DAY ${cell.day}] Nu setat alertaFichaj - Verificare condiții:`);
        console.log(`  - isFiesta: ${isFiesta} (cell.tip=${cell.tip}, cell.planFuente=${cell.planFuente})`);
        console.log(`  - isPastDay: ${isPastDay} (current: ${currentYear}-${currentMonth}-${currentDay}, selected: ${selectedYear}-${selectedMonth}-${cell.day})`);
        console.log(`  - hasRegularizacionFinal: ${hasRegularizacionFinal} (hasRegularizacion: ${hasRegularizacion}, hasRegularizacionAnterioara: ${hasRegularizacionAnterioara})`);
        console.log(`  - hasEntradaCompleta: ${hasEntradaCompleta} (entradas.length: ${entradas.length}, entradas:`, entradas, ')');
        console.log(`  - hasSalidaCompleta: ${hasSalidaCompleta} (hasDuracionZiCurenta: ${hasDuracionZiCurenta}, hasDuracionZiUrmatoare: ${hasDuracionZiUrmatoare}, salidas.length: ${salidas.length}, salidas:`, salidas, ')');
        console.log(`  - Condiție finală: !isFiesta=${!isFiesta} && isPastDay=${isPastDay} && !hasRegularizacionFinal=${!hasRegularizacionFinal} && (!hasEntradaCompleta || !hasSalidaCompleta)=${(!hasEntradaCompleta || !hasSalidaCompleta)}`);
        console.log(`  - Rezultat: ${!isFiesta && isPastDay && !hasRegularizacionFinal && (!hasEntradaCompleta || !hasSalidaCompleta)}`);
      }
    }
    
    // Calculăm durata ÎNTOTDEAUNA, indiferent de alertaFichaj
    // Verifică dacă există durată regularizată (effective_minutes sau effective_duration)
    let durataRegularizata = null;
    
    // Pentru turele nocturne (T2, T3), regularizarea poate fi în Salida de pe ziua următoare
    // IMPORTANT: Regularizările NO_PUNCH (cu FECHA = workday_date și HORA = 00:00:00) 
    // trebuie atribuite doar zilei corespunzătoare workday_date, nu zilei anterioare
    let salidaConRegularizacion = null;
    
    if (overnightPlan) {
      // Căutăm regularizarea în Salida de pe ziua următoare (pentru turele nocturne)
      // EXCLUDE regularizările NO_PUNCH (HORA = 00:00:00) - acestea sunt pentru ziua următoare, nu pentru ziua curentă
      salidaConRegularizacion = salidasZiUrmatoare.find(f => 
        f["TIPO"] === 'Salida' && 
        f["HORA"] !== '00:00:00' && // Exclude NO_PUNCH regularizations
        ((f["effective_minutes"] !== null && f["effective_minutes"] !== undefined) ||
         (f["effective_duration"] && f["effective_duration"].trim() !== ''))
      );
    }
    
    // Dacă nu am găsit în ziua următoare (sau e T1), căutăm în ziua curentă
    // Pentru regularizările NO_PUNCH, verificăm că FECHA corespunde exact cu ziua curentă
    if (!salidaConRegularizacion) {
      salidaConRegularizacion = fichajesZi.find(f => 
        f["TIPO"] === 'Salida' && 
        ((f["effective_minutes"] !== null && f["effective_minutes"] !== undefined) ||
         (f["effective_duration"] && f["effective_duration"].trim() !== '')) &&
        // Pentru NO_PUNCH (HORA = 00:00:00), verificăm că FECHA corespunde exact cu ziua curentă
        (f["HORA"] !== '00:00:00' || (f["FECHA"] || '').startsWith(dataZi))
      );
    }
    
    if (salidaConRegularizacion) {
      // Prioritate: effective_minutes (minute), apoi effective_duration (HH:MM:SS)
      if (salidaConRegularizacion["effective_minutes"] !== null && 
          salidaConRegularizacion["effective_minutes"] !== undefined) {
        const effectiveMinutes = Number(salidaConRegularizacion["effective_minutes"]);
        if (!isNaN(effectiveMinutes) && effectiveMinutes > 0) {
          const ore = Math.floor(effectiveMinutes / 60);
          const minute = effectiveMinutes % 60;
          durataRegularizata = `${ore}h ${minute}m`;
        }
      } else if (salidaConRegularizacion["effective_duration"] && 
                salidaConRegularizacion["effective_duration"].trim() !== '') {
        // Parsează effective_duration (format: HH:MM:SS sau HH:MM)
        const durationStr = salidaConRegularizacion["effective_duration"].trim();
        const parts = durationStr.split(':').map(Number);
        if (parts.length >= 2) {
          const ore = parts[0] || 0;
          const minute = parts[1] || 0;
          if (ore > 0 || minute > 0) {
            durataRegularizata = `${ore}h ${minute}m`;
          }
        }
      }
    }
    
    if (durataRegularizata) {
      // Folosește durata regularizată
      durataMunca = durataRegularizata;
    } else {
      // Când nu există regularizare, folosim DURACION din Salida (dacă există)
      // Pentru turele nocturne (T2, T3), DURACION este în Salida de pe ziua următoare
      // IMPORTANT: Pentru turele nocturne, dacă nu există Entrada pe ziua curentă,
      // Salida de pe ziua curentă este partea finală a turei de pe ziua anterioară,
      // deci NU afișăm timpul pentru ziua curentă
      let salidaConDuracion = null;
      
      if (overnightPlan) {
        // Pentru turele nocturne, căutăm DURACION în Salida de pe ziua următoare
        // DOAR dacă există Entrada pe ziua curentă (tura începe în ziua curentă)
        if (hasEntradaCompleta) {
          salidaConDuracion = salidasZiUrmatoare.find(f => 
            f["HORA"] !== '00:00:00' && // Exclude NO_PUNCH
            f["DURACION"] && 
            f["DURACION"].trim() !== '' && 
            f["DURACION"] !== '00:00:00'
          );
        }
      }
      
      // Dacă nu am găsit în ziua următoare (sau e T1), căutăm în ziua curentă
      // Pentru turele nocturne, DOAR dacă există Entrada pe ziua curentă
      if (!salidaConDuracion) {
        if (overnightPlan) {
          // Pentru turele nocturne, folosim DURACION din ziua curentă DOAR dacă există Entrada pe ziua curentă
          if (hasEntradaCompleta) {
            salidaConDuracion = salidas.find(f => 
              f["HORA"] !== '00:00:00' && // Exclude NO_PUNCH
              f["DURACION"] && 
              f["DURACION"].trim() !== '' && 
              f["DURACION"] !== '00:00:00'
            );
          }
        } else {
          // Pentru turele normale (T1), căutăm DURACION în ziua curentă
          salidaConDuracion = salidas.find(f => 
            f["HORA"] !== '00:00:00' && // Exclude NO_PUNCH
            f["DURACION"] && 
            f["DURACION"].trim() !== '' && 
            f["DURACION"] !== '00:00:00'
          );
        }
      }
      
      if (salidaConDuracion && salidaConDuracion["DURACION"]) {
        // Parsează DURACION (format: HH:MM:SS sau HH:MM)
        const durationStr = salidaConDuracion["DURACION"].trim();
        const parts = durationStr.split(':').map(Number);
        if (parts.length >= 2) {
          const ore = parts[0] || 0;
          const minute = parts[1] || 0;
          if (ore > 0 || minute > 0) {
            durataMunca = `${ore}h ${minute}m`;
          }
        }
      } else {
        // Fallback: Calculează durata manual din Entrada/Salida (doar dacă nu există DURACION)
        // Pentru turele nocturne (T2, T3), combinăm Entrada de pe ziua curentă cu Salida de pe ziua următoare
        // IMPORTANT: Pentru turele nocturne, calculăm durata DOAR dacă există Entrada pe ziua curentă
        // Dacă nu există Entrada pe ziua curentă, Salida de pe ziua curentă este partea finală a turei de pe ziua anterioară
        let entradasToUse = [...entradas];
        let salidasToUse = [...salidas];
        
        // Pentru turele nocturne, adăugăm Salida de pe ziua următoare DOAR dacă există Entrada pe ziua curentă
        if (overnightPlan && hasEntradaCompleta && salidasZiUrmatoare.length > 0) {
          salidasToUse = [...salidas, ...salidasZiUrmatoare];
        }
        
        // Pentru turele nocturne, dacă nu există Entrada pe ziua curentă, nu calculăm durata
        if (overnightPlan && !hasEntradaCompleta) {
          // Nu calculăm durata pentru ziua curentă dacă nu există Entrada pe ziua curentă
          // Salida de pe ziua curentă este partea finală a turei de pe ziua anterioară
          durataMunca = '';
        } else if (entradasToUse.length > 0 && salidasToUse.length > 0) {
          const entradasSorted = entradasToUse.sort((a, b) => a["HORA"].localeCompare(b["HORA"]));
          const salidasSorted = salidasToUse.sort((a, b) => a["HORA"].localeCompare(b["HORA"]));
          
          const perioade = Math.min(entradasSorted.length, salidasSorted.length);
          
          let durataTotala = 0;
          
          for (let j = 0; j < perioade; j++) {
            const entrada = entradasSorted[j]["HORA"];
            const salida = salidasSorted[j]["HORA"];
            
            const [h1, m1] = entrada.split(':').map(Number);
            const [h2, m2] = salida.split(':').map(Number);
            
            let durataMinute = (h2 * 60 + m2) - (h1 * 60 + m1);
            // Pentru turele nocturne, durata poate fi negativă (ex: 19:30 -> 07:30 = -12h = +12h)
            if (durataMinute < 0) durataMinute += 24 * 60;
            
            durataTotala += durataMinute;
          }
          
          if (durataTotala > 0) {
            const ore = Math.floor(durataTotala / 60);
            const minute = durataTotala % 60;
            durataMunca = `${ore}h ${minute}m`;
          }
        }
        
        // IMPORTANT: Pentru horario_multicentro, durataMunca se calculează DOAR din fichajes efective
        // Dacă nu există fichajes, durataMunca rămâne goală și alertaFichaj va afișa "sin fichar"
        // NU folosim orele programate din horario_multicentro pentru durataMunca
      }
    }
    
    return { alertaFichaj, durataMunca, hasRegularizacion };
  }, [
    cell.tip,
    cell.planFuente,
    cell.day,
    selectedYear,
    selectedMonth,
    dataZi,
    fichajesZi,
    fichajes,
    salidasZiUrmatoare,
    overnightPlan,
    regularizacionesConfirmadas,
    loadingRegularizaciones,
    formatDateYMD
  ]);
  
  // Dacă are regularizare confirmată, ignorăm alertaFichaj
  const alertaFichajReal = hasRegularizacion ? false : alertaFichaj;

  if (cell.day === 3) {
    console.log('🎨 [CELL DAY 3] Render CalendarDayCell:', {
      day: cell.day,
      alertaFichaj: cell.alertaFichaj,
      loadingFichajes,
      hasRegularizacion,
      alertaFichajReal,
      tip: cell.tip
    });
  }
  
  // Verifică dacă este ziua curentă
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentDay = currentDate.getDate();
  
  const isCurrentDay = selectedYear === currentYear && 
                      selectedMonth === currentMonth && 
                      cell.day === currentDay;
  
  const canModify = isCurrentDay && alertaFichajReal;
  const isSelected = ziSelectata && ziSelectata.day === cell.day;

  const isPastDay = selectedYear < currentYear
    || (selectedYear === currentYear && selectedMonth < currentMonth)
    || (selectedYear === currentYear && selectedMonth === currentMonth && cell.day < currentDay);

  const cellClassName = [
    getMiHorarioCellClass(cell, isCurrentDay, alertaFichajReal),
    canModify ? 'mi-horario-cell--actionable' : '',
    isSelected ? 'mi-horario-cell--selected' : '',
    !canModify && alertaFichajReal ? 'mi-horario-cell--dimmed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      onClick={() => handleResolveAlert(cell)}
      className={cellClassName}
      title={canModify ? 'Click para resolver alerta' : alertaFichajReal ? 'Solo puedes modificar el día actual' : ''}
    >
      {isMobilePortrait && (
        <div className="mi-horario-cell__dow">{dayOfWeek}</div>
      )}
      <div className="mi-horario-cell__day">{cell.day}</div>
      <div className="mi-horario-cell__tip">{cell.tip}</div>
      {cell.orar && (
        <div className="mi-horario-cell__orar">{cell.orar}</div>
      )}
      {alertaFichajReal && (
        <div className="mi-horario-cell__alert-icon" aria-hidden>
          <AlertTriangle className="w-3.5 h-3.5" />
        </div>
      )}
      {alertaFichajReal && isPastDay && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleIndicarMotivo(cell);
          }}
          className="mi-horario-cell__motivo-btn"
          title="Indicar motivo para esta fecha sin fichajes"
        >
          Indicar motivo
        </button>
      )}
      {durataMunca && (
        <div className="mi-horario-cell__durata">
          <Clock className="inline w-3 h-3 mr-0.5" aria-hidden />
          {durataMunca}
        </div>
      )}
      {cell.motivoAusencia && (
        <div className="mi-horario-cell__orar truncate" title={cell.motivoAusencia}>
          {cell.motivoAusencia.length > 15
            ? `${cell.motivoAusencia.substring(0, 15)}...`
            : cell.motivoAusencia}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparator pentru a preveni re-render-uri inutile
  if (prevProps.cell?.day !== nextProps.cell?.day) return false;
  if (prevProps.cell?.tip !== nextProps.cell?.tip) return false;
  if (prevProps.cell?.orar !== nextProps.cell?.orar) return false;
  if (prevProps.cell?.ziRaw !== nextProps.cell?.ziRaw) return false;
  if (prevProps.selectedLunaNorm !== nextProps.selectedLunaNorm) return false;
  if (prevProps.ziSelectata?.day !== nextProps.ziSelectata?.day) return false;
  if (prevProps.loadingFichajes !== nextProps.loadingFichajes) return false;
  if (prevProps.loadingRegularizaciones !== nextProps.loadingRegularizaciones) return false;
  
  // Comparăm regularizarea pentru ziua specifică
  const [year, month] = nextProps.selectedLunaNorm.split('-').map(Number);
  const pad2 = (n) => n < 10 ? '0' + n : n;
  const dataZi = `${year}-${pad2(month)}-${pad2(nextProps.cell?.day)}`;
  const prevHasReg = prevProps.regularizacionesConfirmadas?.get(dataZi) === true;
  const nextHasReg = nextProps.regularizacionesConfirmadas?.get(dataZi) === true;
  if (prevHasReg !== nextHasReg) return false;
  
  // Comparăm fichajes pentru ziua specifică (doar dacă s-au schimbat)
  const prevFichajesZi = Array.isArray(prevProps.fichajes) ? prevProps.fichajes.filter(f => 
    (f["FECHA"] || '').startsWith(dataZi)
  ) : [];
  const nextFichajesZi = Array.isArray(nextProps.fichajes) ? nextProps.fichajes.filter(f => 
    (f["FECHA"] || '').startsWith(dataZi)
  ) : [];
  
  // Comparăm numărul de fichajes și conținutul lor (simplificat - comparăm doar length și DURACION/effective_minutes)
  if (prevFichajesZi.length !== nextFichajesZi.length) return false;
  
  // Comparăm DURACION și effective_minutes pentru Salida
  const prevSalidas = prevFichajesZi.filter(f => f["TIPO"] === 'Salida');
  const nextSalidas = nextFichajesZi.filter(f => f["TIPO"] === 'Salida');
  if (prevSalidas.length !== nextSalidas.length) return false;
  
  // Comparăm DURACION și effective_minutes
  for (let i = 0; i < prevSalidas.length; i++) {
    const prevSalida = prevSalidas[i];
    const nextSalida = nextSalidas[i];
    if (prevSalida["DURACION"] !== nextSalida["DURACION"]) return false;
    if (prevSalida["effective_minutes"] !== nextSalida["effective_minutes"]) return false;
    if (prevSalida["effective_duration"] !== nextSalida["effective_duration"]) return false;
  }
  
  return true; // Props-urile sunt identice, nu re-renderizăm
});

CalendarDayCell.displayName = 'CalendarDayCell';

export default CalendarDayCell;
