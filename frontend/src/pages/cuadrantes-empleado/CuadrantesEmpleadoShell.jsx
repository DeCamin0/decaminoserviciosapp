import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  MessageSquareWarning,
  ArrowDown,
  ArrowUp,
  Stethoscope,
} from 'lucide-react';
import { PageHeader, AlertBanner, Modal, Input } from '../../components/ui';
import CalendarDayCell from '../../components/CalendarDayCell.jsx';
import DeclararNoPunchModal from '../../components/DeclararNoPunchModal.jsx';
import { buildErrorReportMessage, openWhatsAppErrorReport } from '../../utils/reportError';

const LEGEND = [
  { key: 'laborable', label: 'Laborable' },
  { key: 'libre', label: 'Libre' },
  { key: 'alert', label: 'Sin fichar' },
  { key: 'today', label: 'Hoy' },
  { key: 'vacaciones', label: 'Vacaciones' },
  { key: 'asunto', label: 'Asunto propio' },
  { key: 'baja', label: 'Baja médica' },
  { key: 'fiesta', label: 'Festivo' },
];

function SourceCallout({
  cuadrant,
  horarioMulticentroAsignado,
  horarioAsignado,
  selectedLunaNorm,
  currentDayHorarioMulticentro,
  currentDayScheduleFromHorarioMulticentro,
}) {
  if (cuadrant) {
    return (
      <div className="solicitud-admin-callout text-sm">
        <p className="font-medium">Cuadrante asignado · {selectedLunaNorm}</p>
        <p className="text-xs text-gray-500 mt-1">
          {cuadrant.NOMBRE || cuadrant.NOMBRE_APELLIDOS || 'N/A'}
          {cuadrant.CENTRO ? ` · ${cuadrant.CENTRO}` : ''}
        </p>
      </div>
    );
  }
  if (horarioMulticentroAsignado) {
    const currentDate = new Date();
    const currentMonthFormatted = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const isCurrentMonth = selectedLunaNorm === currentMonthFormatted;
    return (
      <div className="solicitud-admin-callout text-sm">
        <p className="font-medium">Horario multicentro · {selectedLunaNorm}</p>
        {isCurrentMonth && currentDayHorarioMulticentro ? (
          <>
            <p className="text-xs text-gray-500 mt-1">
              Cliente: <strong>{currentDayHorarioMulticentro.CLIENTE || 'N/A'}</strong>
            </p>
            <p className="text-xs text-gray-500">
              Horario: <strong>{currentDayHorarioMulticentro.HORARIO || 'N/A'}</strong>
              {currentDayHorarioMulticentro.SERVICIO ? ` · ${currentDayHorarioMulticentro.SERVICIO}` : ''}
            </p>
            {currentDayScheduleFromHorarioMulticentro && (
              <p className="text-xs mt-1 font-semibold">Hoy: {currentDayScheduleFromHorarioMulticentro}</p>
            )}
          </>
        ) : isCurrentMonth ? (
          <p className="text-xs text-amber-700 mt-1">No tienes horario asignado para hoy</p>
        ) : (
          <p className="text-xs text-gray-500 mt-1">
            Cliente: {horarioMulticentroAsignado.CLIENTE || 'N/A'}
            {' · '}
            Horario: {horarioMulticentroAsignado.HORARIO || 'N/A'}
          </p>
        )}
      </div>
    );
  }
  if (horarioAsignado) {
    return (
      <div className="solicitud-admin-callout text-sm">
        <p className="font-medium">Horario: {horarioAsignado.nombre}</p>
        <p className="text-xs text-gray-500 mt-1">
          {horarioAsignado.centroNombre}
          {horarioAsignado.grupoNombre ? ` · ${horarioAsignado.grupoNombre}` : ''}
        </p>
        {horarioAsignado.vigenteDesde && horarioAsignado.vigenteHasta && (
          <p className="text-xs text-gray-500">Vigente: {horarioAsignado.vigenteDesde} – {horarioAsignado.vigenteHasta}</p>
        )}
      </div>
    );
  }
  return (
    <AlertBanner variant="info" title="Sin horario asignado">
      No se encontró cuadrante ni horario para este mes.
    </AlertBanner>
  );
}

export default function CuadrantesEmpleadoShell(props) {
  const {
    identidadDisplay,
    authUser,
    userData,
    cuadrantesUser,
    cuadrant,
    horarioMulticentroAsignado,
    horarioAsignado,
    selectedLunaNorm,
    selectedLuna,
    setSelectedLuna,
    luniDisponibile,
    formatMonthName,
    currentDayHorarioMulticentro,
    currentDayScheduleFromHorarioMulticentro,
    currentBaja,
    erori,
    totalOreMunca,
    showAvisoModal,
    handleCerrarAviso,
    handleAceptarAviso,
    hasDataForMonth,
    loading,
    loadingHorarioMulticentro,
    calendarCells,
    ziSelectata,
    registreZi,
    pendingFichajes,
    handleResolveAlert,
    regularizacionesConfirmadas,
    loadingFichajes,
    loadingRegularizaciones,
    fichajes,
    horariosMulticentroLista,
    todayCell,
    isCurrentMonthSelected,
    showFichajeModal,
    setShowFichajeModal,
    selectedDayForFichaje,
    fichajeType,
    setFichajeType,
    fichajeTime,
    setFichajeTime,
    fichajeAddress,
    setFichajeAddress,
    submittingFichaje,
    handleSubmitFichaje,
    handleAddAnotherFichaje,
    getCurrentLocation,
    showNoPunchModal,
    setShowNoPunchModal,
    selectedDayForNoPunch,
    setSelectedDayForNoPunch,
  } = props;

  const monthIndex = luniDisponibile.indexOf(selectedLunaNorm);
  const goPrevMonth = () => {
    if (monthIndex > 0) setSelectedLuna(luniDisponibile[monthIndex - 1]);
  };
  const goNextMonth = () => {
    if (monthIndex >= 0 && monthIndex < luniDisponibile.length - 1) {
      setSelectedLuna(luniDisponibile[monthIndex + 1]);
    }
  };

  const weekDaysShort = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  const dayDetailPanel = ziSelectata?.day ? (
    <div className="mi-horario-detail-panel app-card app-card--pad">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
        Día {ziSelectata.day}
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        {ziSelectata.tip || '—'} · {registreZi.length} fichaje{registreZi.length === 1 ? '' : 's'}
        {ziSelectata.orar ? ` · ${ziSelectata.orar}` : ''}
      </p>
      {registreZi.length === 0 ? (
        <p className="app-modal__meta text-sm">No hay fichajes para este día.</p>
      ) : (
        <div className="space-y-2">
          {registreZi.map((r, i) => (
            <div key={i} className="mi-horario-fichaje-row">
              <div className="flex items-start gap-2 min-w-0">
                {r.TIPO === 'Entrada' ? (
                  <ArrowDown className="w-4 h-4 text-green-600 shrink-0 mt-0.5" aria-hidden />
                ) : (
                  <ArrowUp className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {r.TIPO} · {r.HORA}
                  </p>
                  {r.DIRECCION && (
                    <p className="text-xs text-gray-500 truncate">{r.DIRECCION}</p>
                  )}
                </div>
              </div>
              <span className={`solicitud-status shrink-0 ${r.ESTADO === 'PENDIENTE' ? 'solicitud-status--pendiente' : 'solicitud-status--ok'}`}>
                {r.ESTADO === 'PENDIENTE' ? 'Pendiente' : 'Aprobado'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="app-page mi-horario-page">
      <PageHeader
        title="Mi Horario"
        subtitle={identidadDisplay || 'Consulta tu programación'}
        backTo="/inicio"
      />

      {isCurrentMonthSelected && todayCell && (
        <section className="mi-horario-hoy app-card app-card--pad" aria-label="Programa de hoy">
          <p className="mi-horario-hoy__title">Hoy</p>
          <p className="mi-horario-hoy__schedule">
            {todayCell.orar || todayCell.tip || 'Sin programación'}
          </p>
          <p className="mi-horario-hoy__meta">
            {todayCell.tip}
            {todayCell.orar ? ` · ${todayCell.orar}` : ''}
          </p>
        </section>
      )}

      <SourceCallout
        cuadrant={cuadrant}
        horarioMulticentroAsignado={horarioMulticentroAsignado}
        horarioAsignado={horarioAsignado}
        selectedLunaNorm={selectedLunaNorm}
        currentDayHorarioMulticentro={currentDayHorarioMulticentro}
        currentDayScheduleFromHorarioMulticentro={currentDayScheduleFromHorarioMulticentro}
      />

      {currentBaja && (
        <AlertBanner variant="warning" title="Estás en Baja Médica">
          <span className="inline-flex items-center gap-1">
            <Stethoscope className="w-4 h-4" aria-hidden />
            Consulta con tu médico y sigue las indicaciones.
          </span>
          {currentBaja.startDate && currentBaja.endDate && (
            <p className="text-xs mt-1 opacity-90">
              Período: {currentBaja.startDate} – {currentBaja.endDate}
              {currentBaja.situacion ? ` · ${currentBaja.situacion}` : ''}
            </p>
          )}
        </AlertBanner>
      )}

      {erori.length > 0 && (
        <AlertBanner variant="warning" title="Atención">
          {erori[0]}
        </AlertBanner>
      )}

      <div className="mi-horario-month-bar app-card app-card--pad">
        <div className="mi-horario-month-nav">
          <button
            type="button"
            className="solicitud-admin-btn"
            onClick={goPrevMonth}
            disabled={monthIndex <= 0}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden />
          </button>
          <select
            id="selected-luna"
            name="selected-luna"
            value={selectedLunaNorm}
            onChange={(e) => setSelectedLuna(e.target.value)}
            className="mi-horario-month-select"
            aria-label="Seleccionar mes"
          >
            {luniDisponibile.map((l) => (
              <option key={l} value={l}>{formatMonthName(l)}</option>
            ))}
          </select>
          <button
            type="button"
            className="solicitud-admin-btn"
            onClick={goNextMonth}
            disabled={monthIndex < 0 || monthIndex >= luniDisponibile.length - 1}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" aria-hidden />
          </button>
        </div>
        {totalOreMunca && (
          <span className="mi-horario-total-hours">{totalOreMunca}</span>
        )}
      </div>

      <AlertBanner variant="info">
        Los horarios y turnos pueden sufrir modificaciones puntuales. Las actualizaciones se comunicarán por los canales oficiales.
      </AlertBanner>

      <div className="flex justify-end">
        <button
          type="button"
          className="solicitud-admin-btn solicitud-admin-btn--primary"
          onClick={() => {
            const cuadranteActual = cuadrantesUser?.find((c) => c.LUNA === selectedLuna) || cuadrantesUser?.[0];
            const horarioInfo = horarioAsignado?.nombre || horarioMulticentroAsignado?.nombre || null;
            const message = buildErrorReportMessage({
              authUser,
              userData,
              pageName: 'Cuadrantes Empleado',
              pageData: {
                additionalInfo: [
                  selectedLuna ? `[MES] ${selectedLuna}` : null,
                  cuadrantesUser?.length > 0 ? `[CUADRANTES] ${cuadrantesUser.length} cuadrantes disponibles` : null,
                  cuadranteActual ? `[CUADRANTE ACTUAL] ${cuadranteActual.LUNA || 'N/A'}` : null,
                  horarioInfo ? `[HORARIO] ${horarioInfo}` : null,
                ].filter(Boolean),
              },
            });
            openWhatsAppErrorReport(message);
          }}
        >
          <MessageSquareWarning className="w-4 h-4" aria-hidden />
          <span>Reportar error</span>
        </button>
      </div>

      <div className="mi-horario-layout">
        <section className="app-card app-card--pad">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-gray-500" aria-hidden />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white m-0">
              Horario · {formatMonthName(selectedLunaNorm)}
            </h2>
          </div>

          <div className="mi-horario-legend" aria-label="Leyenda">
            {LEGEND.map((item) => (
              <span key={item.key} className="mi-horario-legend__item">
                <span className={`mi-horario-legend__dot mi-horario-legend__dot--${item.key}`} />
                {item.label}
              </span>
            ))}
          </div>

          <div className="mi-horario-weekdays" aria-hidden>
            {weekDaysShort.map((wd) => (
              <span key={wd}>{wd}</span>
            ))}
          </div>

          <div className="mi-horario-grid">
            {!hasDataForMonth && !loading && !loadingHorarioMulticentro && (
              <div className="py-10 text-center" style={{ gridColumn: '1 / -1' }}>
                <AlertBanner variant="info" title="Horario pendiente de generación">
                  Tu horario para este mes está en proceso. Contacta con tu supervisor si necesitas información.
                </AlertBanner>
              </div>
            )}
            {hasDataForMonth && calendarCells.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-500" style={{ gridColumn: '1 / -1' }}>
                No hay datos para este mes
              </div>
            )}
            {hasDataForMonth && calendarCells.length > 0 && calendarCells.map((cell, idx) => {
              if (!cell) {
                return <div key={idx} className="min-h-[4.25rem]" aria-hidden />;
              }
              return (
                <CalendarDayCell
                  key={idx}
                  cell={cell}
                  selectedLunaNorm={selectedLunaNorm}
                  ziSelectata={ziSelectata}
                  handleResolveAlert={handleResolveAlert}
                  handleIndicarMotivo={props.handleIndicarMotivo}
                  regularizacionesConfirmadas={regularizacionesConfirmadas}
                  loadingFichajes={loadingFichajes}
                  loadingRegularizaciones={loadingRegularizaciones}
                  fichajes={fichajes}
                  horariosMulticentroLista={horariosMulticentroLista}
                />
              );
            })}
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Los días con alerta necesitan fichajes completos. Solo puedes modificar el día actual.
          </p>
        </section>

        {dayDetailPanel}
      </div>

      {pendingFichajes.length > 0 && (
        <div className="app-card app-card--pad">
          <h3 className="text-sm font-semibold mb-2">
            Fichajes pendientes ({pendingFichajes.length})
          </h3>
          <div className="space-y-2">
            {pendingFichajes.map((f, i) => (
              <div key={i} className="mi-horario-fichaje-row">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{f.TIPO} · {f.HORA} · {f.FECHA}</p>
                  {f.DIRECCION && <p className="text-xs text-gray-500 truncate">{f.DIRECCION}</p>}
                </div>
                <span className="solicitud-status solicitud-status--pendiente">Pendiente</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showAvisoModal}
          onClose={handleCerrarAviso}
          title="Aviso importante"
          showCloseButton={false}
          className="app-modal--form"
          footer={(
            <button type="button" onClick={handleAceptarAviso} className="app-modal__btn app-modal__btn--ok">
              Aceptar
            </button>
          )}
        >
          <div className="space-y-3 app-modal__meta">
            <p>Los horarios de trabajo y turnos asignados pueden estar sujetos a ajustes puntuales por necesidades organizativas o del servicio.</p>
            <p>Cualquier modificación será comunicada con antelación, siempre que sea posible, a través de los canales oficiales de la empresa.</p>
            <p className="font-semibold">Gracias por vuestra comprensión y colaboración.</p>
          </div>
        </Modal>,
        document.body,
      )}

      {typeof document !== 'undefined' && createPortal(
        <Modal
          isOpen={showFichajeModal}
          onClose={() => setShowFichajeModal(false)}
          title={`Resolver alerta · día ${selectedDayForFichaje?.day}`}
          showCloseButton={false}
          className="app-modal--form"
          footer={(
            <div className="app-modal__actions flex-wrap">
              <button
                type="button"
                onClick={handleSubmitFichaje}
                disabled={submittingFichaje || !fichajeTime}
                className="app-modal__btn app-modal__btn--ok"
              >
                {submittingFichaje ? 'Guardando…' : 'Guardar fichaje'}
              </button>
              <button type="button" onClick={handleAddAnotherFichaje} className="app-modal__btn">
                Añadir otro
              </button>
              <button type="button" onClick={() => setShowFichajeModal(false)} className="app-modal__btn">
                Cancelar
              </button>
            </div>
          )}
        >
          <div className="space-y-4">
            <div className="app-modal__field">
              <label htmlFor="fichaje-type" className="app-modal__label">Tipo de fichaje</label>
              <select
                id="fichaje-type"
                value={fichajeType}
                onChange={(e) => setFichajeType(e.target.value)}
                className="app-modal__input w-full"
              >
                <option value="Entrada">Entrada</option>
                <option value="Salida">Salida</option>
              </select>
            </div>
            <div className="app-modal__field">
              <label htmlFor="fichaje-time" className="app-modal__label">Hora</label>
              <Input
                id="fichaje-time"
                name="fichaje-time"
                type="time"
                value={fichajeTime}
                onChange={(e) => setFichajeTime(e.target.value)}
                required
              />
            </div>
            <div className="app-modal__field">
              <label htmlFor="fichaje-address" className="app-modal__label">Dirección</label>
              <div className="flex gap-2">
                <Input
                  id="fichaje-address"
                  name="fichaje-address"
                  type="text"
                  value={fichajeAddress}
                  onChange={(e) => setFichajeAddress(e.target.value)}
                  placeholder="Dirección o ubicación automática"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  className="solicitud-admin-btn shrink-0"
                  title="Obtener ubicación automática"
                >
                  <MapPin className="w-4 h-4" aria-hidden />
                </button>
              </div>
            </div>
            <AlertBanner variant="info">
              Los fichajes registrados estarán pendientes de aprobación por el manager/supervisor.
            </AlertBanner>
          </div>
        </Modal>,
        document.body,
      )}

      <DeclararNoPunchModal
        isOpen={showNoPunchModal}
        onClose={() => {
          setShowNoPunchModal(false);
          setSelectedDayForNoPunch(null);
        }}
        onConfirm={async () => {
          setShowNoPunchModal(false);
          setSelectedDayForNoPunch(null);
        }}
        data={selectedDayForNoPunch || {}}
      />
    </div>
  );
}
