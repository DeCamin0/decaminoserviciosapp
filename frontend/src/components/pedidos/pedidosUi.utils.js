import {
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  PackageCheck,
} from 'lucide-react';

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', icon: Clock, className: 'pedidos-status--pending' },
  aprobado: { label: 'Aprobado', icon: CheckCircle2, className: 'pedidos-status--approved' },
  rechazado: { label: 'Rechazado', icon: XCircle, className: 'pedidos-status--rejected' },
  enviado: { label: 'Enviado', icon: Truck, className: 'pedidos-status--sent' },
  entregado: { label: 'Entregado', icon: PackageCheck, className: 'pedidos-status--delivered' },
};

export function getPedidosEstadoConfig(estado) {
  const key = String(estado || '').toLowerCase();
  return ESTADO_CONFIG[key] || {
    label: estado || '—',
    icon: Package,
    className: 'pedidos-status--default',
  };
}

export function pedidosItemsPreview(items, max = 3) {
  if (!items?.length) return 'Sin productos';
  const names = items.slice(0, max).map((i) => i.descripcion || i.numero_articulo || 'Artículo');
  const rest = items.length > max ? ` +${items.length - max}` : '';
  return `${names.join(', ')}${rest}`;
}
