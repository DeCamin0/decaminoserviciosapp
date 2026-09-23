import { SolicitudMonthCalendar, SolicitudCalendarLegend } from './SolicitudMonthCalendar';

function getUserCenter(user) {
  if (!user) return '';
  if (user['CENTRO TRABAJO'] && String(user['CENTRO TRABAJO']).trim()) {
    return String(user['CENTRO TRABAJO']).trim();
  }
  const preferredKeys = [
    'CENTRO DE TRABAJO',
    'centro de trabajo',
    'CENTRO_DE_TRABAJO',
    'centroDeTrabajo',
    'centro_trabajo',
    'CENTRO',
    'centro',
    'CENTER',
    'center',
    'DEPARTAMENTO',
    'departamento',
  ];
  for (const k of preferredKeys) {
    if (user[k] && String(user[k]).trim()) return String(user[k]).trim();
  }
  try {
    const allKeys = Object.keys(user || {});
    const key = allKeys.find((field) => {
      const lk = field.toLowerCase();
      return (lk.includes('centro') || lk.includes('trabajo') || lk.includes('depart')) && String(user[field]).trim();
    });
    if (key) return String(user[key]).trim();
  } catch {
    /* ignore */
  }
  return '';
}

/**
 * Calendario unificado Vacaciones / Asuntos Propios (layout Mi Horario).
 */
export function SolicitudCalendarSection({
  tipo,
  calendarYear,
  calendarMonth,
  monthNames,
  onPrevMonth,
  onNextMonth,
  isDateSelected,
  isDateDisabled,
  onToggleDate,
  isInHolidayBlockPeriod,
  isInAsuntoPropioCalendarBlock,
  dateAvailability,
  editingSolicitud,
  isManager,
  canAccessAllTabs,
  loadingOccupiedDates,
  vacacionesDisponibilidadPct,
  asuntosPropiosDiasAnuales,
  asuntosPropiosMaxPorDia,
  totalAsuntoPropioDays,
  selectedDates,
  fechaInicio,
  fechaFin,
  calculateDays,
  occupiedDaysInRange,
  occupiedDatesCount,
  authUser,
  allUsers,
  normalizeGroup,
}) {
  const isVacaciones = tipo === 'Vacaciones';
  const variant = isVacaciones ? 'vacaciones' : 'asuntos';

  const isDateBlocked = (dateStr) => {
    if (
      editingSolicitud !== null &&
      (tipo === 'Vacaciones' || tipo === 'Asuntos Propios')
    ) {
      return false;
    }
    return isVacaciones
      ? isInHolidayBlockPeriod(dateStr)
      : isInAsuntoPropioCalendarBlock(dateStr);
  };

  const firstAvailability =
    Object.keys(dateAvailability).length > 0
      ? dateAvailability[Object.keys(dateAvailability)[0]]
      : null;

  return (
    <div className="app-card app-card--pad solicitud-form__section">
      <SolicitudMonthCalendar
        variant={variant}
        title={
          isVacaciones
            ? 'Selecciona tus Vacaciones'
            : 'Selecciona tus Asuntos Propios'
        }
        calendarYear={calendarYear}
        calendarMonth={calendarMonth}
        monthNames={monthNames}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        isDateSelected={isDateSelected}
        isDateDisabled={isDateDisabled}
        onToggleDate={onToggleDate}
        isDateBlocked={isDateBlocked}
        dateAvailability={dateAvailability}
        showNumericAvailability={isVacaciones ? true : canAccessAllTabs}
      />

      {loadingOccupiedDates && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-blue-800 flex items-center">
            <span className="animate-spin mr-2">⏳</span>
            Cargando fechas ocupadas...
          </p>
        </div>
      )}

      {editingSolicitud === null &&
        isManager &&
        !loadingOccupiedDates &&
        firstAvailability && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-blue-800 mb-2">
                  📊 Disponibilidad del Grupo
                </p>
                <div className="text-xs text-blue-600 space-y-1">
                  <p>
                    <strong>Grupo:</strong> {firstAvailability.group || 'N/A'}
                  </p>
                  <p>
                    <strong>Centro:</strong>{' '}
                    {firstAvailability.center || 'No definido'}
                  </p>
                  <p>
                    <strong>Límite por fecha:</strong> {firstAvailability.total}{' '}
                    personas
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-800 mb-2">
                  📅 Resumen del Grupo
                </p>
                {(() => {
                  const currentUserCenter = firstAvailability.center || '';
                  const currentUserGroup =
                    authUser?.GRUPO || authUser?.grupo || '';
                  const normalizedCurrentUserGroup =
                    normalizeGroup(currentUserGroup);
                  let totalInGroup = 0;
                  let totalInCenter = 0;

                  if (allUsers && allUsers.length > 0) {
                    totalInGroup = allUsers.filter((user) => {
                      const userGroup = user.GRUPO || user.grupo || '';
                      return normalizeGroup(userGroup) === normalizedCurrentUserGroup;
                    }).length;
                    totalInCenter = allUsers.filter((user) => {
                      const userCenter = getUserCenter(user);
                      return (
                        userCenter &&
                        currentUserCenter &&
                        userCenter === currentUserCenter
                      );
                    }).length;
                  } else {
                    const percentage = vacacionesDisponibilidadPct / 100;
                    totalInGroup = Math.ceil(
                      firstAvailability.maxAllowed / percentage,
                    );
                    totalInCenter = 'N/A';
                  }

                  return (
                    <div className="text-xs text-blue-600 space-y-1">
                      <p>
                        <strong>Total empleados en centro:</strong>{' '}
                        {totalInCenter !== 'N/A'
                          ? totalInCenter
                          : 'Calculando...'}
                      </p>
                      <p>
                        <strong>Total empleados en grupo:</strong> {totalInGroup}
                      </p>
                      <p>
                        <strong>Límite per grup:</strong> {firstAvailability.total}{' '}
                        personas
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

      {!isVacaciones &&
        editingSolicitud === null &&
        firstAvailability && (
          <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm font-medium text-purple-800">
              📊 Disponibilidad de Asuntos Propios
            </p>
            {canAccessAllTabs ? (
              <>
                <p className="text-xs text-purple-600 mt-1">
                  Total empleados en grupo:{' '}
                  {firstAvailability.groupSize ?? 0}
                </p>
                <p className="text-xs text-purple-600">
                  Límite permitido: {firstAvailability.maxAllowed ?? 0} personas
                </p>
              </>
            ) : (
              <p className="text-xs text-purple-600 mt-1">
                El calendario indica si el día está disponible; en amarillo hay
                poca disponibilidad. El cupo diario lo gestiona la empresa y no
                se muestra el número exacto.
              </p>
            )}
            <p className="text-xs text-purple-600">
              Días disponibles: {totalAsuntoPropioDays}/
              {asuntosPropiosDiasAnuales} días (anual)
            </p>
          </div>
        )}

      <SolicitudCalendarLegend
        variant={variant}
        editingSolicitud={editingSolicitud}
        isManager={isManager}
        vacacionesDisponibilidadPct={vacacionesDisponibilidadPct}
        asuntosPropiosDiasAnuales={asuntosPropiosDiasAnuales}
        asuntosPropiosMaxPorDia={asuntosPropiosMaxPorDia}
        canAccessAllTabs={canAccessAllTabs}
        totalAsuntoPropioDays={totalAsuntoPropioDays}
      />

      {!loadingOccupiedDates && !isVacaciones && occupiedDatesCount > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">
            🚫 {occupiedDatesCount} días ocupados este mes
          </p>
          <p className="text-xs text-red-600 mt-1">
            Las fechas en rojo están ocupadas por otras solicitudes
          </p>
        </div>
      )}

      {selectedDates.length > 0 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-800">
            📅 Días seleccionados:{' '}
            {fechaInicio && fechaFin
              ? calculateDays(fechaInicio, fechaFin)
              : selectedDates.length}{' '}
            días
          </p>
          <p className="text-xs text-green-600 mt-1">
            Desde: {fechaInicio} hasta: {fechaFin}
          </p>
        </div>
      )}

      {occupiedDaysInRange.length > 0 && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
          <p className="text-sm font-medium text-amber-800">
            ⚠️ No puedes incluir en el intervalo días ya ocupados
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Los siguientes días están ocupados por otras solicitudes o sin
            disponibilidad: {occupiedDaysInRange.join(', ')}. Elige solo días
            disponibles o cambia el rango.
          </p>
          <p className="text-xs text-amber-600 mt-1">
            No se podrá enviar la solicitud hasta que el rango no incluya días
            ocupados.
          </p>
        </div>
      )}

      {!isVacaciones && editingSolicitud === null && (
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-xs text-purple-700 font-medium">
            📊 Reglas para Asuntos Propios:
          </p>
          <ul className="text-xs text-purple-600 mt-1 space-y-0.5 list-disc pl-4">
            <li>Máximo {asuntosPropiosDiasAnuales} días por persona por año</li>
            <li>
              {canAccessAllTabs
                ? `Máximo ${asuntosPropiosMaxPorDia} personas por día en total`
                : 'Cupo diario a nivel empresa'}
            </li>
            <li>Máximo 1 persona del mismo centro por día</li>
            <li>Máximo {asuntosPropiosDiasAnuales} días consecutivos</li>
            <li>Mínimo 5 días de adelanto</li>
          </ul>
        </div>
      )}
    </div>
  );
}
