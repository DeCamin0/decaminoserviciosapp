import { memo, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  SOLICITUD_WEEKDAY_LABELS,
  getSolicitudDaysInMonth,
  getSolicitudFirstDayOfMonth,
  getSolicitudDayOfWeekShort,
  solicitudDateStr,
} from './solicitudCalendar.utils';

function buildDayTitle({
  variant,
  isPast,
  isBlocked,
  isFull,
  isLowAvailability,
  isOccupied,
  isToday,
  availability,
  showNumericAvailability,
}) {
  if (isPast) return 'Fecha pasada';
  if (isBlocked) {
    return variant === 'vacaciones'
      ? 'Período bloqueado: 6 Dic - 6 Ene (Empleada)'
      : 'Bloqueado (Empleada)';
  }
  if (isFull) {
    if (showNumericAvailability && availability) {
      const total = availability.total ?? availability.maxAllowed ?? 1;
      const occupied = availability.occupied ?? 0;
      return `Sin disponibilidad (${occupied}/${total} ocupados)`;
    }
    return variant === 'asuntos'
      ? 'Sin disponibilidad para Asuntos Propios en esta fecha'
      : 'Sin disponibilidad';
  }
  if (isOccupied) return 'Fecha ocupada por otra solicitud';
  if (isLowAvailability) {
    if (showNumericAvailability && availability) {
      const total = availability.total ?? availability.maxAllowed ?? 1;
      return `Poca disponibilidad: ${availability.available}/${total} libres`;
    }
    return 'Poca disponibilidad: quedan pocos cupos para este día';
  }
  if (isToday) return 'Hoy';
  if (availability && availability.available > 0) {
    if (showNumericAvailability) {
      const total = availability.total ?? availability.maxAllowed ?? 1;
      return `Disponibilidad: ${availability.available}/${total} libres`;
    }
    return 'Disponible';
  }
  return 'Disponible';
}

const SolicitudDayCell = memo(function SolicitudDayCell({
  day,
  variant,
  dow,
  disabled,
  selected,
  state,
  availability,
  showNumericAvailability,
  onToggle,
}) {
  const classNames = ['solicitud-cal-cell', 'mi-horario-cell'];
  if (!disabled) classNames.push('mi-horario-cell--actionable');
  if (selected) {
    classNames.push(
      variant === 'vacaciones'
        ? 'solicitud-cal-cell--selected-vacaciones'
        : 'solicitud-cal-cell--selected-asuntos',
    );
  } else if (state === 'blocked') classNames.push('solicitud-cal-cell--blocked');
  else if (state === 'full') classNames.push('solicitud-cal-cell--full');
  else if (state === 'occupied') classNames.push('solicitud-cal-cell--occupied');
  else if (state === 'low') classNames.push('solicitud-cal-cell--low');
  else if (state === 'today') classNames.push('solicitud-cal-cell--today');
  else if (state === 'past') classNames.push('solicitud-cal-cell--past');
  else classNames.push('solicitud-cal-cell--available');

  const title = buildDayTitle({
    variant,
    isPast: state === 'past',
    isBlocked: state === 'blocked',
    isFull: state === 'full',
    isLowAvailability: state === 'low',
    isOccupied: state === 'occupied',
    isToday: state === 'today',
    availability,
    showNumericAvailability,
  });

  return (
    <button
      type="button"
      className={classNames.join(' ')}
      disabled={disabled}
      onClick={() => !disabled && onToggle(day)}
      title={title}
      aria-label={title}
      aria-pressed={selected}
    >
      <span className="solicitud-cal-cell__dow">{dow}</span>
      <span className="solicitud-cal-cell__day">{day}</span>
      {state === 'blocked' && <span className="solicitud-cal-cell__badge" aria-hidden>🔒</span>}
      {state === 'full' && !selected && <span className="solicitud-cal-cell__badge" aria-hidden>🈵</span>}
      {state === 'low' && !selected && <span className="solicitud-cal-cell__badge" aria-hidden>⚠️</span>}
      {state === 'occupied' && !selected && <span className="solicitud-cal-cell__badge" aria-hidden>🚫</span>}
      {showNumericAvailability && availability && state !== 'past' && state !== 'blocked' && state !== 'full' && (
        <span className="solicitud-cal-cell__quota">
          {availability.available}/{availability.total ?? availability.maxAllowed}
        </span>
      )}
    </button>
  );
});

/**
 * Calendario mensual para Vacaciones / Asuntos Propios — layout Mi Horario, modo selección.
 */
export function SolicitudMonthCalendar({
  variant = 'vacaciones',
  title,
  calendarYear,
  calendarMonth,
  monthNames,
  onPrevMonth,
  onNextMonth,
  isDateSelected,
  isDateDisabled,
  onToggleDate,
  isDateBlocked,
  dateAvailability = {},
  checkOccupied,
  showNumericAvailability = false,
}) {
  const leadingEmpty = getSolicitudFirstDayOfMonth(calendarYear, calendarMonth);
  const daysInMonth = getSolicitudDaysInMonth(calendarYear, calendarMonth);
  const monthLabel = `${monthNames[calendarMonth]} ${calendarYear}`;

  const dayNumbers = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth],
  );

  const resolveState = (day) => {
    const dateStr = solicitudDateStr(calendarYear, calendarMonth, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentDate = new Date(dateStr);
    currentDate.setHours(0, 0, 0, 0);
    const isToday = currentDate.getTime() === today.getTime();
    const isPast = currentDate < today;
    const isBlocked = isDateBlocked(dateStr);
    const availability = dateAvailability[dateStr];
    const isFull = availability && availability.isFull;
    const isLow =
      availability && availability.available <= 1 && availability.available > 0;
    const isOccupied = checkOccupied ? checkOccupied(day) : false;

    if (isDateSelected(day)) return { state: 'selected', availability, isPast, isBlocked, isFull, isLow, isOccupied, isToday };
    if (isBlocked) return { state: 'blocked', availability, isPast, isBlocked, isFull, isLow, isOccupied, isToday };
    if (isFull) return { state: 'full', availability, isPast, isBlocked, isFull, isLow, isOccupied, isToday };
    if (isOccupied) return { state: 'occupied', availability, isPast, isBlocked, isFull, isLow, isOccupied, isToday };
    if (isLow) return { state: 'low', availability, isPast, isBlocked, isFull, isLow, isOccupied, isToday };
    if (isToday) return { state: 'today', availability, isPast, isBlocked, isFull, isLow, isOccupied, isToday };
    if (isPast) return { state: 'past', availability, isPast, isBlocked, isFull, isLow, isOccupied, isToday };
    return { state: 'available', availability, isPast, isBlocked, isFull, isLow, isOccupied, isToday };
  };

  return (
    <div className={`solicitud-month-calendar solicitud-month-calendar--${variant}`}>
      <div className="solicitud-form__section-head">
        <h3 className="solicitud-form__section-title">{title}</h3>
      </div>

      <div className="mi-horario-month-bar solicitud-month-calendar__nav">
        <div className="mi-horario-month-nav">
          <button
            type="button"
            className="solicitud-admin-btn"
            onClick={onPrevMonth}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden />
          </button>
          <div className="solicitud-month-calendar__month-label" aria-live="polite">
            {monthLabel}
          </div>
          <button
            type="button"
            className="solicitud-admin-btn"
            onClick={onNextMonth}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="mi-horario-legend solicitud-month-calendar__legend-inline" aria-label="Leyenda rápida">
        <span className="mi-horario-legend__item">
          <span className="mi-horario-legend__dot mi-horario-legend__dot--laborable" />
          Disponible
        </span>
        <span className="mi-horario-legend__item">
          <span className="mi-horario-legend__dot solicitud-cal-legend__dot--selected" />
          Seleccionado
        </span>
        <span className="mi-horario-legend__item">
          <span className="mi-horario-legend__dot mi-horario-legend__dot--alert" />
          Poca disp.
        </span>
        <span className="mi-horario-legend__item">
          <span className="mi-horario-legend__dot mi-horario-legend__dot--today" />
          Hoy
        </span>
      </div>

      <div className="solicitud-month-calendar__grid-wrap">
        <div className="mi-horario-weekdays" aria-hidden>
          {SOLICITUD_WEEKDAY_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="mi-horario-grid solicitud-month-calendar__grid" role="grid" aria-label={monthLabel}>
          {Array.from({ length: leadingEmpty }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="solicitud-cal-cell solicitud-cal-cell--empty"
              aria-hidden
            />
          ))}
          {dayNumbers.map((day) => {
            const meta = resolveState(day);
            const selected = isDateSelected(day);
            const disabled = isDateDisabled(day);
            const dow = getSolicitudDayOfWeekShort(calendarYear, calendarMonth, day);
            return (
              <SolicitudDayCell
                key={day}
                day={day}
                variant={variant}
                dow={dow}
                disabled={disabled}
                selected={selected}
                state={selected ? 'selected' : meta.state}
                availability={meta.availability}
                showNumericAvailability={showNumericAvailability}
                onToggle={onToggleDate}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SolicitudCalendarLegend({
  variant = 'vacaciones',
  editingSolicitud,
  isManager,
  vacacionesDisponibilidadPct,
  asuntosPropiosDiasAnuales,
  asuntosPropiosMaxPorDia,
  canAccessAllTabs,
  totalAsuntoPropioDays,
}) {
  if (editingSolicitud !== null) return null;

  const selectedClass =
    variant === 'vacaciones'
      ? 'solicitud-cal-legend__swatch--selected-vacaciones'
      : 'solicitud-cal-legend__swatch--selected-asuntos';

  return (
    <div className="solicitud-cal-legend">
      <div className="solicitud-cal-legend__head">
        <h4 className="solicitud-cal-legend__title">Leyenda del calendario</h4>
        {variant === 'asuntos' && (
          <span className="solicitud-cal-legend__quota">
            Días disponibles: {totalAsuntoPropioDays}/{asuntosPropiosDiasAnuales} (anual)
          </span>
        )}
      </div>
      <div className="solicitud-cal-legend__items">
        <div className="solicitud-cal-legend__item">
          <span className={`solicitud-cal-legend__swatch ${selectedClass}`} />
          <span>Días seleccionados</span>
        </div>
        <div className="solicitud-cal-legend__item">
          <span className="solicitud-cal-legend__swatch solicitud-cal-legend__swatch--today" />
          <span>Hoy</span>
        </div>
        <div className="solicitud-cal-legend__item">
          <span className="solicitud-cal-legend__swatch solicitud-cal-legend__swatch--full" />
          <span>Sin disponibilidad</span>
        </div>
        <div className="solicitud-cal-legend__item">
          <span className="solicitud-cal-legend__swatch solicitud-cal-legend__swatch--low" />
          <span>Poca disponibilidad</span>
        </div>
        {variant === 'vacaciones' && (
          <div className="solicitud-cal-legend__item">
            <span className="solicitud-cal-legend__swatch solicitud-cal-legend__swatch--occupied" />
            <span>Ocupado por otras solicitudes</span>
          </div>
        )}
        <div className="solicitud-cal-legend__item">
          <span className="solicitud-cal-legend__swatch solicitud-cal-legend__swatch--blocked" />
          <span>Bloqueado (Empleada)</span>
        </div>
        <div className="solicitud-cal-legend__item">
          <span className="solicitud-cal-legend__swatch solicitud-cal-legend__swatch--past" />
          <span>Fechas pasadas</span>
        </div>
      </div>
      {isManager && (
        <div className="solicitud-cal-legend__rules">
          <p className="solicitud-cal-legend__rules-title">Reglas de disponibilidad</p>
          <p className="solicitud-cal-legend__rules-text">
            {variant === 'vacaciones'
              ? `${vacacionesDisponibilidadPct}% del grupo puede estar de vacaciones durante todo el año.`
              : `Máximo ${asuntosPropiosDiasAnuales} días por persona por año.`}
          </p>
          {variant === 'asuntos' && (
            <p className="solicitud-cal-legend__rules-text">
              {canAccessAllTabs
                ? `Máximo ${asuntosPropiosMaxPorDia} personas por día (configurable en gestión).`
                : 'Cupo diario a nivel empresa (sin cifras exactas en el calendario).'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
