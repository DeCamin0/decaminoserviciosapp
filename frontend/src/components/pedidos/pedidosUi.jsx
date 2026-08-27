import { Loader2, Package } from 'lucide-react';
import { getPedidosEstadoConfig } from './pedidosUi.utils';

export function PedidosStatusBadge({ estado, compact = false, className = '' }) {
  const cfg = getPedidosEstadoConfig(estado);
  const Icon = cfg.icon;
  return (
    <span className={`pedidos-status ${cfg.className}${compact ? ' pedidos-status--compact' : ''}${className ? ` ${className}` : ''}`.trim()}>
      <Icon className="pedidos-status__icon" aria-hidden />
      <span>{cfg.label}</span>
    </span>
  );
}

export function PedidosLoadingState({ message = 'Cargando pedidos…' }) {
  return (
    <div className="app-card app-card--pad pedidos-state pedidos-state--loading">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-color)] mx-auto" aria-hidden />
      <p>{message}</p>
    </div>
  );
}

export function PedidosEmptyState({ title = 'No hay pedidos', message = 'No se encontraron pedidos con los filtros seleccionados.' }) {
  return (
    <div className="app-card app-card--pad pedidos-state pedidos-state--empty">
      <Package className="w-10 h-10 text-gray-400 mx-auto" aria-hidden />
      <h3 className="pedidos-state__title">{title}</h3>
      <p className="pedidos-state__message">{message}</p>
    </div>
  );
}
