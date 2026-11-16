import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pagePath = path.join(__dirname, '../src/pages/SolicitudesPage.jsx');
let src = fs.readFileSync(pagePath, 'utf8');

if (!src.includes('SolicitudCalendarSection')) {
  src = src.replace(
    "import { LoadingSpinner, PageHeader, AlertBanner, SegmentedControl } from '../components/ui';",
    "import { LoadingSpinner, PageHeader, AlertBanner, SegmentedControl } from '../components/ui';\nimport { SolicitudCalendarSection } from '../components/solicitudes';",
  );
}

const startMarker = '{/* Período Solicitado - Calendar for Vacaciones or Asuntos Propios */}';
const endMarker = '{/* Input date pentru Permiso Retribuido */}';

const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
  console.error('Markers not found', { startIdx, endIdx });
  process.exit(1);
}

const replacement = `{/* Período Solicitado - Calendar for Vacaciones or Asuntos Propios */}
                {(tipo === 'Vacaciones' || tipo === 'Asuntos Propios') && (
                  <SolicitudCalendarSection
                    tipo={tipo}
                    calendarYear={calendarYear}
                    calendarMonth={calendarMonth}
                    monthNames={monthNames}
                    onPrevMonth={() => navigateMonth('prev')}
                    onNextMonth={() => navigateMonth('next')}
                    isDateSelected={isDateSelected}
                    isDateDisabled={isDateDisabled}
                    onToggleDate={toggleDate}
                    isInHolidayBlockPeriod={isInHolidayBlockPeriod}
                    isInAsuntoPropioCalendarBlock={isInAsuntoPropioCalendarBlock}
                    dateAvailability={dateAvailability}
                    editingSolicitud={editingSolicitud}
                    isManager={isManager}
                    canAccessAllTabs={canAccessAllTabs}
                    loadingOccupiedDates={isOperationLoading('occupiedDates')}
                    vacacionesDisponibilidadPct={vacacionesDisponibilidadPct}
                    asuntosPropiosDiasAnuales={asuntosPropiosDiasAnuales}
                    asuntosPropiosMaxPorDia={asuntosPropiosMaxPorDia}
                    totalAsuntoPropioDays={totalAsuntoPropioDays}
                    selectedDates={selectedDates}
                    fechaInicio={fechaInicio}
                    fechaFin={fechaFin}
                    calculateDays={calculateDays}
                    occupiedDaysInRange={occupiedDaysInRange}
                    occupiedDatesCount={occupiedDates.length}
                    authUser={authUser}
                    allUsers={allUsers}
                    normalizeGroup={normalizeGroup}
                  />
                )}

                `;

src = src.slice(0, startIdx) + replacement + src.slice(endIdx);
fs.writeFileSync(pagePath, src, 'utf8');
console.log('Patched SolicitudesPage.jsx — calendar section replaced.');
