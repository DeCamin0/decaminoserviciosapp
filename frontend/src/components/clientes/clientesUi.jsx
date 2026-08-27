import { Building2, Users, Loader2 } from 'lucide-react';
import { getEstadoLabel, isComunidadCliente } from './clientesUi.utils';

export function ClientesEmptyState({ label }) {
  return (
    <div className="clientes-state">
      <Users className="clientes-state__icon" aria-hidden />
      <p className="clientes-state__title">Sin resultados</p>
      <p className="clientes-state__text">
        {label || 'No hay registros que coincidan con los criterios.'}
      </p>
    </div>
  );
}

export function ClientesLoadingState({ label }) {
  return (
    <div className="clientes-state">
      <Loader2 className="clientes-state__icon animate-spin" aria-hidden />
      <p className="clientes-state__title">{label || 'Cargando…'}</p>
    </div>
  );
}

export function ClientesStatusBadge({ row, compact = false }) {
  const { label, tone } = getEstadoLabel(row);
  const comunidad = isComunidadCliente(row);
  return (
    <div className="clientes-badges">
      <span className={`clientes-status clientes-status--${tone}${compact ? ' clientes-status--compact' : ''}`}>
        {label}
      </span>
      {comunidad ? (
        <span className={`clientes-status clientes-status--comunidad${compact ? ' clientes-status--compact' : ''}`}>
          Comunidad
        </span>
      ) : null}
    </div>
  );
}

export function ClientesStatsStrip({ variant, total, activos, comunidades, otros }) {
  const isClientes = variant === 'clientes';
  return (
    <div className="clientes-stats">
      <div className="clientes-stats__item">
        <span className="clientes-stats__label">Total</span>
        <span className="clientes-stats__value">{total}</span>
      </div>
      <div className="clientes-stats__item">
        <span className="clientes-stats__label">Activos</span>
        <span className="clientes-stats__value">{activos}</span>
      </div>
      {isClientes ? (
        <>
          <div className="clientes-stats__item">
            <span className="clientes-stats__label">Comunidades</span>
            <span className="clientes-stats__value">{comunidades}</span>
          </div>
          <div className="clientes-stats__item">
            <span className="clientes-stats__label">Otros</span>
            <span className="clientes-stats__value">{otros}</span>
          </div>
        </>
      ) : (
        <div className="clientes-stats__item clientes-stats__item--wide">
          <Building2 className="clientes-stats__icon" aria-hidden />
          <span className="clientes-stats__label">Proveedores registrados</span>
        </div>
      )}
    </div>
  );
}
