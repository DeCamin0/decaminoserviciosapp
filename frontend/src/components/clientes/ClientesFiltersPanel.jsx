import { Search, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Button, Input } from '../ui';

export default function ClientesFiltersPanel({
  variant,
  searchTerm,
  onSearchChange,
  selectedActivo,
  onActivoChange,
  onRefresh,
  loading,
  resultCount,
  collapsed,
  onToggleCollapsed,
}) {
  const label = variant === 'clientes' ? 'clientes' : 'proveedores';

  return (
    <section className="app-card clientes-filters">
      <div className="clientes-filters__head">
        <div>
          <h2 className="clientes-section-title">Filtros</h2>
          <p className="clientes-filters__count">
            {resultCount}
            {' '}
            {label}
            {' '}
            encontrados
          </p>
        </div>
        <div className="clientes-filters__actions">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
          >
            <SlidersHorizontal className="w-4 h-4" aria-hidden />
            <span>{collapsed ? 'Mostrar filtros' : 'Ocultar filtros'}</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4${loading ? ' animate-spin' : ''}`} aria-hidden />
            <span>Actualizar</span>
          </Button>
        </div>
      </div>

      {!collapsed ? (
        <div className="clientes-filters-grid">
          <div className="clientes-filter-field">
            <label className="clientes-filter-field__label" htmlFor={`clientes-search-${variant}`}>
              Buscar
            </label>
            <div className="clientes-filter-search">
              <Search className="clientes-filter-search__icon" aria-hidden />
              <Input
                id={`clientes-search-${variant}`}
                type="search"
                placeholder={`Nombre, NIF, email…`}
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="clientes-input clientes-filter-search__input"
              />
            </div>
          </div>
          <div className="clientes-filter-field">
            <label className="clientes-filter-field__label" htmlFor={`clientes-estado-${variant}`}>
              Estado
            </label>
            <select
              id={`clientes-estado-${variant}`}
              value={selectedActivo}
              onChange={(e) => onActivoChange(e.target.value)}
              className="clientes-input"
            >
              <option value="todos">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </div>
        </div>
      ) : null}
    </section>
  );
}
