import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { Button } from '../ui';

export default function InspectionFiltersPanel({
  showFilters,
  onToggleFilters,
  searchTerm,
  onSearchTermChange,
  filterType,
  onFilterTypeChange,
  selectedEmployee,
  onSelectedEmployeeChange,
  employeeSearchTerm,
  onEmployeeSearchTermChange,
  showEmployeeDropdown,
  onShowEmployeeDropdownChange,
  filteredEmployees,
  selectedCentro,
  onSelectedCentroChange,
  centroSearchTerm,
  onCentroSearchTermChange,
  showCentroDropdown,
  onShowCentroDropdownChange,
  filteredCentros,
  inspectorSearchTerm,
  onInspectorSearchTermChange,
  selectedMonthYear,
  onSelectedMonthYearChange,
  monthYearOptions,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  onResetFilters,
  loadingEmployees,
  onlySolicitudes = false,
}) {
  return (
    <section className="inspecciones-filters app-card app-card--pad">
      <div className="inspecciones-filters__head">
        <h2 className="inspecciones-section-title">Búsqueda y filtros</h2>
        <Button type="button" variant="secondary" size="sm" onClick={onToggleFilters}>
          {showFilters ? <ChevronUp className="w-4 h-4" aria-hidden /> : <ChevronDown className="w-4 h-4" aria-hidden />}
          {showFilters ? 'Ocultar' : 'Mostrar'}
        </Button>
      </div>

      {showFilters ? (
        <div className="inspecciones-filters__body">
          <div className="inspecciones-filter-field inspecciones-filter-field--full">
            <label htmlFor="search-inspections">Búsqueda</label>
            <div className="inspecciones-search-wrap">
              <Search className="inspecciones-search-wrap__icon" aria-hidden />
              <input
                id="search-inspections"
                name="search-inspections"
                type="search"
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                placeholder="ID, inspector, trabajador, ubicación…"
                className="inspecciones-input"
              />
              {searchTerm ? (
                <button type="button" className="inspecciones-search-wrap__clear" onClick={() => onSearchTermChange('')} aria-label="Limpiar búsqueda">
                  <X className="w-4 h-4" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>

          <div className="inspecciones-filters-grid">
            {!onlySolicitudes ? (
              <div className="inspecciones-filter-field">
                <label htmlFor="filter-type">Tipo</label>
                <select id="filter-type" value={filterType} onChange={(e) => onFilterTypeChange(e.target.value)} className="inspecciones-input">
                  <option value="all">Todos</option>
                  <option value="limpieza">Limpieza</option>
                  <option value="servicios">Servicios Auxiliares</option>
                  <option value="personalizada">Personalizada</option>
                  <option value="entrega-materiales">Entrega de Materiales</option>
                </select>
              </div>
            ) : null}

            <div className="inspecciones-filter-field group/field">
              <label htmlFor="filter-employee">Trabajador</label>
              <input
                id="filter-employee"
                type="text"
                value={employeeSearchTerm || selectedEmployee}
                onChange={(e) => {
                  onEmployeeSearchTermChange(e.target.value);
                  onSelectedEmployeeChange('');
                  onShowEmployeeDropdownChange(true);
                }}
                onFocus={() => onShowEmployeeDropdownChange(true)}
                placeholder={loadingEmployees ? 'Cargando…' : 'Buscar empleado…'}
                disabled={loadingEmployees}
                className="inspecciones-input"
              />
              {showEmployeeDropdown && filteredEmployees.length > 0 ? (
                <div className="app-picker-dropdown inspecciones-picker-dropdown">
                  {filteredEmployees.slice(0, 12).map((emp) => (
                    <button
                      key={emp.code}
                      type="button"
                      className="app-picker-option"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onSelectedEmployeeChange(emp.code);
                        onEmployeeSearchTermChange(`${emp.name} (${emp.code})`);
                        onShowEmployeeDropdownChange(false);
                      }}
                    >
                      {emp.name} ({emp.code})
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="inspecciones-filter-field group/field">
              <label htmlFor="filter-centro">Centro</label>
              <input
                id="filter-centro"
                type="text"
                value={centroSearchTerm || selectedCentro}
                onChange={(e) => {
                  onCentroSearchTermChange(e.target.value);
                  onSelectedCentroChange('');
                  onShowCentroDropdownChange(true);
                }}
                onFocus={() => onShowCentroDropdownChange(true)}
                placeholder="Buscar centro…"
                className="inspecciones-input"
              />
              {showCentroDropdown && filteredCentros.length > 0 ? (
                <div className="app-picker-dropdown inspecciones-picker-dropdown">
                  {filteredCentros.slice(0, 12).map((centro) => (
                    <button
                      key={centro}
                      type="button"
                      className="app-picker-option"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onSelectedCentroChange(centro);
                        onCentroSearchTermChange(centro);
                        onShowCentroDropdownChange(false);
                      }}
                    >
                      {centro}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="inspecciones-filter-field">
              <label htmlFor="filter-inspector">Inspector</label>
              <input
                id="filter-inspector"
                type="text"
                value={inspectorSearchTerm}
                onChange={(e) => onInspectorSearchTermChange(e.target.value)}
                placeholder="Nombre inspector…"
                className="inspecciones-input"
              />
            </div>

            <div className="inspecciones-filter-field">
              <label htmlFor="filter-month">Mes / año</label>
              <select id="filter-month" value={selectedMonthYear} onChange={(e) => onSelectedMonthYearChange(e.target.value)} className="inspecciones-input">
                <option value="all">Todos</option>
                {monthYearOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="inspecciones-filter-field">
              <label htmlFor="filter-sort">Ordenar por</label>
              <select id="filter-sort" value={sortBy} onChange={(e) => onSortByChange(e.target.value)} className="inspecciones-input">
                <option value="fecha">Fecha</option>
                <option value="tipo">Tipo</option>
                <option value="inspector">Inspector</option>
                <option value="trabajador">Trabajador</option>
                <option value="centro">Centro</option>
              </select>
            </div>

            <div className="inspecciones-filter-field">
              <label htmlFor="filter-order">Orden</label>
              <select id="filter-order" value={sortOrder} onChange={(e) => onSortOrderChange(e.target.value)} className="inspecciones-input">
                <option value="desc">Más reciente</option>
                <option value="asc">Más antiguo</option>
              </select>
            </div>
          </div>

          <div className="inspecciones-filters__actions">
            <Button type="button" variant="ghost" size="sm" onClick={onResetFilters}>
              Limpiar filtros
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
