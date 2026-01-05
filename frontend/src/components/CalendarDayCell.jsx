import { memo, useMemo } from 'react';

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
  // Helper pentru formatare data
  const pad2 = (n) => n < 10 ? '0' + n : n;
  const formatDateYMD = (year, month, day) => year + '-' + pad2(month) + '-' + pad2(day);
  
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
    if ((cell.tip !== 'T2' && cell.tip !== 'T3') || !fichajes) return [];
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const dataZiUrmatoare = cell.day < daysInMonth 
      ? formatDateYMD(selectedYear, selectedMonth, cell.day + 1)
      : formatDateYMD(selectedYear, selectedMonth + 1, 1);
    return Array.isArray(fichajes) ? fichajes.filter(f => 
      f["TIPO"] === 'Salida' && (f["FECHA"] || '').startsWith(dataZiUrmatoare)
    ) : [];
  }, [fichajes, cell.tip, cell.day, selectedYear, selectedMonth, dataZi]);
  
  // CALCULUL ALERTAFICHAJ ȘI DURATAMUNCA ÎN COMPONENTĂ - cu useMemo pentru optimizare
  const { alertaFichaj, durataMunca, hasRegularizacion } = useMemo(() => {
    let alertaFichaj = false;
    let durataMunca = '';
    
    // LOG pentru ziua 1
    if (cell.day === 1) {
      console.log('🔍 [CELL DAY 1] CalendarDayCell useMemo start:', {
        cellTip: cell.tip,
        dataZi,
        hasRegularizacion: regularizacionesConfirmadas?.get(dataZi),
        loadingRegularizaciones
      });
    }
    
    // Verifică dacă ziua are regularizare confirmată
    const hasRegularizacion = regularizacionesConfirmadas?.get(dataZi) === true;
    
    // Verifică pentru toate tipurile de ture (T1, T2, T3)
    // Dacă nu este tură (T1, T2, T3), nu setăm alertaFichaj (ex: Fiesta, LIBRE, Vacaciones, etc.)
    if (cell.tip !== 'T1' && cell.tip !== 'T2' && cell.tip !== 'T3') {
      if (cell.day === 1) {
        console.log('✅ [CELL DAY 1] Nu este tură, return early (tip:', cell.tip, ')');
      }
      return { alertaFichaj, durataMunca, hasRegularizacion };
    }
    
    const entradas = fichajesZi.filter(f => f["TIPO"] === 'Entrada');
    const salidas = fichajesZi.filter(f => f["TIPO"] === 'Salida');
    
    // Verifică dacă ziua este trecută
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const currentDay = currentDate.getDate();
    
    const isPastDay = selectedYear < currentYear || 
                     (selectedYear === currentYear && selectedMonth < currentMonth) || 
                     (selectedYear === currentYear && selectedMonth === currentMonth && cell.day < currentDay);
    
    // Pentru turele nocturne, regularizarea este pe workday_date (ziua de început)
    // Verificăm regularizarea pe ziua curentă și pe ziua anterioară (pentru turele nocturne)
    let hasRegularizacionAnterioara = false;
    if (cell.day > 1) {
      const dataZiAnterioara = formatDateYMD(selectedYear, selectedMonth, cell.day - 1);
      hasRegularizacionAnterioara = regularizacionesConfirmadas?.get(dataZiAnterioara) === true;
    } else if (selectedMonth > 1) {
      // Dacă suntem pe prima zi a lunii, verificăm ultima zi a lunii anterioare
      const lastDayPrevMonth = new Date(selectedYear, selectedMonth - 1, 0).getDate();
      const dataZiAnterioara = formatDateYMD(selectedYear, selectedMonth - 1, lastDayPrevMonth);
      hasRegularizacionAnterioara = regularizacionesConfirmadas?.get(dataZiAnterioara) === true;
    }
    
    const hasRegularizacionFinal = hasRegularizacion || hasRegularizacionAnterioara;
    
    // Pentru turele nocturne (T2, T3), verificăm dacă există DURACION în ziua următoare
    let hasDuracionZiUrmatoare = false;
    if ((cell.tip === 'T2' || cell.tip === 'T3') && salidasZiUrmatoare.length > 0) {
      hasDuracionZiUrmatoare = salidasZiUrmatoare.some(f => 
        f["DURACION"] && 
        f["DURACION"].trim() !== '' && 
        f["DURACION"] !== '00:00:00'
      );
    }
    
    // Setăm alertaFichaj dacă este necesar
    // IMPORTANT: Afișăm "sin fichar" IMEDIAT dacă nu există regularizare în Map
    // Dacă regularizările se încarcă mai târziu:
    //   - Dacă există regularizare → hasRegularizacionFinal devine true, alertaFichaj devine false
    //   - Dacă NU există regularizare → hasRegularizacionFinal rămâne false, alertaFichaj rămâne true
    // IMPORTANT: Nu setăm alertaFichaj dacă cell.tip este 'Fiesta' SAU cell.planFuente este 'fiesta' (sărbătoare)
    const isFiesta = cell.tip === 'Fiesta' || cell.planFuente === 'fiesta';
    if (!isFiesta && 
        isPastDay && 
        !hasDuracionZiUrmatoare &&
        (entradas.length === 0 || (salidas.length === 0 && !hasDuracionZiUrmatoare))) {
      
      // Dacă NU există regularizare în Map → setăm alertaFichaj IMEDIAT
      // Nu așteptăm loadingRegularizaciones să devină false
      if (!hasRegularizacionFinal) {
        alertaFichaj = true;
        if (cell.day === 1) {
          console.log('⚠️ [CELL DAY 1] Setat alertaFichaj = true (nu este Fiesta, isPastDay, fără regularizare)');
        }
      } else {
        if (cell.day === 1) {
          console.log('✅ [CELL DAY 1] Nu setat alertaFichaj (hasRegularizacionFinal = true)');
        }
      }
      // Dacă hasRegularizacionFinal este true (există regularizare în Map),
      // alertaFichaj rămâne false și durata se calculează din regularizare
    } else {
      if (cell.day === 1) {
        console.log('ℹ️ [CELL DAY 1] Nu setat alertaFichaj (condiții:', {
          isFiesta: isFiesta,
          cellTip: cell.tip,
          cellPlanFuente: cell.planFuente,
          isPastDay,
          hasDuracionZiUrmatoare,
          entradasLength: entradas.length,
          salidasLength: salidas.length
        }, ')');
      }
    }
    
    // Calculăm durata ÎNTOTDEAUNA, indiferent de alertaFichaj
    // Verifică dacă există durată regularizată (effective_minutes sau effective_duration)
    let durataRegularizata = null;
    
    // Pentru turele nocturne (T2, T3), regularizarea poate fi în Salida de pe ziua următoare
    let salidaConRegularizacion = null;
    
    if (cell.tip === 'T2' || cell.tip === 'T3') {
      // Căutăm regularizarea în Salida de pe ziua următoare (pentru turele nocturne)
      salidaConRegularizacion = salidasZiUrmatoare.find(f => 
        f["TIPO"] === 'Salida' && 
        ((f["effective_minutes"] !== null && f["effective_minutes"] !== undefined) ||
         (f["effective_duration"] && f["effective_duration"].trim() !== ''))
      );
    }
    
    // Dacă nu am găsit în ziua următoare (sau e T1), căutăm în ziua curentă
    if (!salidaConRegularizacion) {
      salidaConRegularizacion = fichajesZi.find(f => 
        f["TIPO"] === 'Salida' && 
        ((f["effective_minutes"] !== null && f["effective_minutes"] !== undefined) ||
         (f["effective_duration"] && f["effective_duration"].trim() !== ''))
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
      let salidaConDuracion = null;
      
      if (cell.tip === 'T2' || cell.tip === 'T3') {
        // Pentru turele nocturne, căutăm DURACION în Salida de pe ziua următoare
        salidaConDuracion = salidasZiUrmatoare.find(f => 
          f["DURACION"] && 
          f["DURACION"].trim() !== '' && 
          f["DURACION"] !== '00:00:00'
        );
      }
      
      // Dacă nu am găsit în ziua următoare (sau e T1), căutăm în ziua curentă
      if (!salidaConDuracion) {
        salidaConDuracion = salidas.find(f => 
          f["DURACION"] && 
          f["DURACION"].trim() !== '' && 
          f["DURACION"] !== '00:00:00'
        );
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
        let entradasToUse = [...entradas];
        let salidasToUse = [...salidas];
        
        // Pentru turele nocturne, adăugăm Salida de pe ziua următoare
        if ((cell.tip === 'T2' || cell.tip === 'T3') && salidasZiUrmatoare.length > 0) {
          salidasToUse = [...salidas, ...salidasZiUrmatoare];
        }
        
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
    }
    
    return { alertaFichaj, durataMunca, hasRegularizacion };
  }, [
    cell.tip,
    cell.day,
    selectedYear,
    selectedMonth,
    fichajesZi,
    salidasZiUrmatoare,
    regularizacionesConfirmadas?.get(dataZi),
    loadingRegularizaciones
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
  
  // Determină tipul și culorile
  let bgGradient, borderColor, textColor, shadowColor, glowColor;
  
  // Determină culorile pe baza tipului zilei
  if (isCurrentDay) {
    // Ziua curentă - prioritate maximă
    if (cell.tip === 'Vacaciones') {
      bgGradient = 'linear-gradient(135deg, rgba(59, 130, 246, 0.4) 0%, rgba(37, 99, 235, 0.4) 100%)';
      borderColor = 'rgba(59, 130, 246, 0.7)';
      textColor = '#1e40af';
      shadowColor = 'rgba(59, 130, 246, 0.3)';
      glowColor = '#3b82f6';
    } else if (cell.tip === 'Asunto Propio') {
      bgGradient = 'linear-gradient(135deg, rgba(168, 85, 247, 0.4) 0%, rgba(147, 51, 234, 0.4) 100%)';
      borderColor = 'rgba(168, 85, 247, 0.7)';
      textColor = '#7c3aed';
      shadowColor = 'rgba(168, 85, 247, 0.3)';
      glowColor = '#a855f7';
    } else if (cell.tip === 'Baja Médica') {
      bgGradient = 'linear-gradient(135deg, rgba(232, 121, 249, 0.45) 0%, rgba(217, 70, 239, 0.45) 100%)';
      borderColor = 'rgba(192, 38, 211, 0.8)';
      textColor = '#86198f';
      shadowColor = 'rgba(192, 38, 211, 0.35)';
      glowColor = '#e879f9';
    } else {
      bgGradient = 'linear-gradient(135deg, rgba(59, 130, 246, 0.4) 0%, rgba(37, 99, 235, 0.4) 100%)';
      borderColor = 'rgba(59, 130, 246, 0.7)';
      textColor = '#1e40af';
      shadowColor = 'rgba(59, 130, 246, 0.3)';
      glowColor = '#3b82f6';
    }
  } else if (cell.tip === 'Vacaciones') {
    bgGradient = 'linear-gradient(135deg, rgba(56, 189, 248, 0.3) 0%, rgba(14, 165, 233, 0.3) 100%)';
    borderColor = 'rgba(14, 165, 233, 0.5)';
    textColor = '#075985';
    shadowColor = 'rgba(14, 165, 233, 0.2)';
    glowColor = '#0ea5e9';
  } else if (cell.tip === 'Asunto Propio') {
    bgGradient = 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(147, 51, 234, 0.3) 100%)';
    borderColor = 'rgba(168, 85, 247, 0.5)';
    textColor = '#7c3aed';
    shadowColor = 'rgba(168, 85, 247, 0.2)';
    glowColor = '#a855f7';
  } else if (cell.tip === 'Baja Médica') {
    bgGradient = 'linear-gradient(135deg, rgba(244, 114, 182, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%)';
    borderColor = 'rgba(219, 39, 119, 0.6)';
    textColor = '#9d174d';
    shadowColor = 'rgba(219, 39, 119, 0.25)';
    glowColor = '#f472b6';
  } else if (cell.tip === 'Fiesta') {
    // Fiesta are prioritate peste "sin fichar"
    bgGradient = 'linear-gradient(135deg, rgba(251, 191, 36, 0.3) 0%, rgba(245, 158, 11, 0.3) 100%)';
    borderColor = 'rgba(245, 158, 11, 0.5)';
    textColor = '#92400e';
    shadowColor = 'rgba(245, 158, 11, 0.25)';
    glowColor = '#f59e0b';
  } else if (alertaFichajReal) {
    bgGradient = 'linear-gradient(135deg, rgba(254, 240, 138, 0.3) 0%, rgba(253, 224, 71, 0.3) 100%)';
    borderColor = 'rgba(251, 191, 36, 0.5)';
    textColor = '#92400e';
    shadowColor = 'rgba(251, 191, 36, 0.25)';
    glowColor = '#fbbf24';
  } else if (cell.tip === 'T1' || cell.tip === 'T2' || cell.tip === 'T3') {
    // Toate tipurile de ture (T1, T2, T3) au culoare verde pentru zile lucrătoare
    bgGradient = 'linear-gradient(135deg, rgba(134, 239, 172, 0.2) 0%, rgba(74, 222, 128, 0.2) 100%)';
    borderColor = 'rgba(34, 197, 94, 0.4)';
    textColor = '#15803d';
    shadowColor = 'rgba(34, 197, 94, 0.15)';
    glowColor = '#22c55e';
  } else if (cell.tip === 'LIBRE') {
    bgGradient = 'linear-gradient(135deg, rgba(254, 202, 202, 0.2) 0%, rgba(252, 165, 165, 0.2) 100%)';
    borderColor = 'rgba(239, 68, 68, 0.4)';
    textColor = '#991b1b';
    shadowColor = 'rgba(239, 68, 68, 0.15)';
    glowColor = '#ef4444';
  } else {
    bgGradient = 'linear-gradient(135deg, rgba(243, 244, 246, 0.5) 0%, rgba(229, 231, 235, 0.5) 100%)';
    borderColor = 'rgba(156, 163, 175, 0.3)';
    textColor = '#4b5563';
    shadowColor = 'rgba(0, 0, 0, 0.05)';
    glowColor = '#9ca3af';
  }
  
  return (
    <div
      onClick={() => handleResolveAlert(cell)}
      className={`group/cell relative overflow-hidden min-h-[100px] transition-all duration-300 ${
        canModify ? 'cursor-pointer' : 'cursor-default'
      } ${!canModify && alertaFichajReal ? 'opacity-60' : ''}`}
      style={{
        background: bgGradient,
        backdropFilter: 'blur(8px)',
        borderRadius: '0.75rem',
        border: `2px solid ${borderColor}`,
        boxShadow: `0 4px 12px ${shadowColor}${
          isCurrentDay ? `, 0 0 0 3px rgba(59, 130, 246, 0.4)` : ''
        }`,
        transform: ziSelectata && ziSelectata.day === cell.day ? 'scale(1.02)' : 'scale(1)',
        padding: '0.75rem'
      }}
      onMouseEnter={(e) => {
        if (canModify || !alertaFichajReal || isCurrentDay) {
          e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)';
          e.currentTarget.style.boxShadow = `0 8px 20px ${shadowColor.replace('0.15', '0.25').replace('0.25', '0.35')}${
            isCurrentDay ? `, 0 0 0 4px rgba(59, 130, 246, 0.6)` : ''
          }`;
        }
      }}
      onMouseLeave={(e) => {
        if (ziSelectata && ziSelectata.day === cell.day) {
          e.currentTarget.style.transform = 'scale(1.02)';
        } else {
          e.currentTarget.style.transform = 'scale(1)';
        }
        e.currentTarget.style.boxShadow = `0 4px 12px ${shadowColor}${
          isCurrentDay ? `, 0 0 0 3px rgba(59, 130, 246, 0.4)` : ''
        }`;
      }}
      title={canModify ? '✅ Click para resolver alerta' : 
             alertaFichajReal ? '⚠️ Solo puedes modificar el día actual' : ''}
    >
      {/* Glow animado para alertas și ziua curentă */}
      {(alertaFichajReal || isCurrentDay) && (
        <div 
          className="absolute inset-0 rounded-xl animate-pulse"
          style={{
            background: `radial-gradient(circle at center, ${glowColor}20 0%, transparent 70%)`,
            opacity: isCurrentDay ? 0.7 : 0.5
          }}
        ></div>
      )}
      
      {/* Shimmer effect en hover */}
      {(canModify || isCurrentDay) && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover/cell:translate-x-[200%] transition-transform duration-1000"></div>
      )}
      
      {/* Contenido */}
      <div className="relative text-center h-full flex flex-col justify-between">
        {/* Día */}
        <div 
          className="font-black text-2xl mb-2"
          style={{ color: textColor }}
        >
          {cell.day}
          {isCurrentDay && (
            <span className="ml-2 text-blue-600 text-lg animate-bounce">📍</span>
          )}
        </div>
        
        {/* Tipo */}
        <div 
          className="font-bold text-xs mb-1 px-2 py-1 rounded-lg"
          style={{
            background: `${glowColor}30`,
            color: textColor
          }}
        >
          {cell.tip}
        </div>
        
        {/* Horario */}
        {cell.orar && (
          <div 
            className="text-xs font-semibold rounded px-2 py-1 mb-1"
            style={{
              background: 'rgba(255, 255, 255, 0.7)',
              color: textColor
            }}
          >
            ⏰ {cell.orar}
          </div>
        )}
        
        {/* Alerta */}
        {alertaFichajReal && (
          <div className="mb-2">
            <div className="text-2xl animate-bounce mb-1">⚠️</div>
            {/* Buton "Indicar motivo" pentru zile trecute */}
            {(() => {
              const currentDate = new Date();
              const currentYear = currentDate.getFullYear();
              const currentMonth = currentDate.getMonth() + 1;
              const currentDay = currentDate.getDate();
              const [selectedYear, selectedMonth] = selectedLunaNorm.split('-').map(Number);
              const isPastDay = selectedYear < currentYear || 
                               (selectedYear === currentYear && selectedMonth < currentMonth) || 
                               (selectedYear === currentYear && selectedMonth === currentMonth && cell.day < currentDay);
              
              if (isPastDay) {
                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleIndicarMotivo(cell);
                    }}
                    className="text-xs font-semibold px-2 py-1 rounded bg-yellow-500 hover:bg-yellow-600 text-white transition-colors mt-1"
                    title="Indicar motivo para esta fecha sin fichajes"
                  >
                    📝 Indicar motivo
                  </button>
                );
              }
              return null;
            })()}
          </div>
        )}
        
        {/* Duración */}
        {durataMunca && (
          <div 
            className="text-xs font-bold rounded px-2 py-1"
            style={{
              background: 'rgba(255, 255, 255, 0.8)',
              color: textColor
            }}
          >
            ⏱️ {durataMunca}
          </div>
        )}
        
        {/* Motivo de ausencia */}
        {cell.motivoAusencia && (
          <div 
            className="text-xs font-medium rounded px-2 py-1 mt-1"
            style={{
              background: 'rgba(255, 255, 255, 0.9)',
              color: textColor,
              border: `1px solid ${glowColor}40`
            }}
            title={cell.motivoAusencia}
          >
            📝 {cell.motivoAusencia.length > 15 ? 
              cell.motivoAusencia.substring(0, 15) + '...' : 
              cell.motivoAusencia}
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparator pentru a preveni re-render-uri inutile
  if (prevProps.cell?.day !== nextProps.cell?.day) return false;
  if (prevProps.cell?.tip !== nextProps.cell?.tip) return false;
  if (prevProps.cell?.orar !== nextProps.cell?.orar) return false;
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
