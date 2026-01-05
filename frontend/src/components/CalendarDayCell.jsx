
/**
 * CalendarDayCell - Componentă pentru o zi din calendar
 * Extrasă din CuadrantesEmpleadoPage pentru a reduce AST și rezolva problema OOM la ESLint
 */
const CalendarDayCell = ({ 
  cell, 
  selectedLunaNorm, 
  ziSelectata, 
  handleResolveAlert, 
  handleIndicarMotivo,
  regularizacionesConfirmadas,
  loadingFichajes = false
}) => {
  // Helper pentru formatare data
  const pad2 = (n) => n < 10 ? '0' + n : n;
  const formatDateYMD = (year, month, day) => year + '-' + pad2(month) + '-' + pad2(day);
  
  // Calculez dataZi pentru verificarea regularizărilor
  const [selectedYear, selectedMonth] = selectedLunaNorm.split('-').map(Number);
  const dataZi = formatDateYMD(selectedYear, selectedMonth, cell.day);
  
  // Verifică dacă ziua are regularizare confirmată
  const hasRegularizacion = regularizacionesConfirmadas?.get(dataZi) === true;
  
  // Dacă are regularizare confirmată sau fichajes sunt încă în proces de încărcare, ignorăm alertaFichaj
  const alertaFichajReal = (hasRegularizacion || loadingFichajes) ? false : cell.alertaFichaj;

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
  } else if (alertaFichajReal) {
    bgGradient = 'linear-gradient(135deg, rgba(254, 240, 138, 0.3) 0%, rgba(253, 224, 71, 0.3) 100%)';
    borderColor = 'rgba(251, 191, 36, 0.5)';
    textColor = '#92400e';
    shadowColor = 'rgba(251, 191, 36, 0.25)';
    glowColor = '#fbbf24';
  } else if (cell.tip === 'T1') {
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
        {cell.durataMunca && (
          <div 
            className="text-xs font-bold rounded px-2 py-1"
            style={{
              background: 'rgba(255, 255, 255, 0.8)',
              color: textColor
            }}
          >
            ⏱️ {cell.durataMunca}
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
};

export default CalendarDayCell;
