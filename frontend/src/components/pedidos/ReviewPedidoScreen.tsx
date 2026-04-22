import React from 'react';
import { ArrowLeft, Package, Trash2 } from 'lucide-react';
import { QuantityStepper } from './QuantityStepper';

export type ReviewPedidoLine = {
  producto_id: number;
  cantidad: number;
  numero_articulo?: string;
  descripcion?: string;
};

export type ReviewPedidoProduct = {
  id: number;
  numero: string;
  descripcion: string;
  imagen?: string;
};

function rowInitials(numero: string, descripcion: string): string {
  const raw = (numero || descripcion || '?').replace(/\s+/g, '');
  if (raw.length >= 2) return raw.slice(0, 2).toUpperCase();
  return `${raw || '?'}`.slice(0, 2).toUpperCase();
}

export type ReviewPedidoScreenProps = {
  lineas: ReviewPedidoLine[];
  products: ReviewPedidoProduct[];
  notas: string;
  onNotasChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void | Promise<void>;
  submitting?: boolean;
  /** Same rules as catalog: one consolidated qty per product id. */
  onSetProductQty: (productId: number, qty: number) => void;
  /** If true, asks for confirmation before removing a line (qty → 0). */
  confirmRemove?: boolean;
  /** When set with subtotal over limit, shows warning and disables submit. */
  limiteGasto?: number | null;
  subtotal?: number;
  notasLabel?: string;
  notasPlaceholder?: string;
  /** Datos de entrega incompletos (horario / teléfono): se muestra arriba y se bloquea enviar. */
  entregaAlert?: string | null;
};

/**
 * Second step of nuevo pedido: review lines, optional note, send.
 * Cart state is owned by the parent; this screen only calls onSetProductQty / onSubmit.
 */
export const ReviewPedidoScreen: React.FC<ReviewPedidoScreenProps> = ({
  lineas,
  products,
  notas,
  onNotasChange,
  onBack,
  onSubmit,
  submitting = false,
  onSetProductQty,
  confirmRemove = false,
  limiteGasto = null,
  subtotal,
  notasLabel = 'Nota (opcional)',
  notasPlaceholder = 'Añade una nota para este pedido…',
  entregaAlert = null,
}) => {
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const productCount = lineas.length;
  const unitCount = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
  const overLimit =
    limiteGasto != null &&
    subtotal != null &&
    Number.isFinite(limiteGasto) &&
    Math.round(subtotal * 100) / 100 > Math.round(limiteGasto * 100) / 100;

  const resolveProduct = (productoId: number) => products.find((p) => p.id === productoId);

  const handleRemove = (line: ReviewPedidoLine) => {
    if (confirmRemove) {
      const p = resolveProduct(line.producto_id);
      const label = p?.descripcion || line.descripcion || 'este producto';
      if (!window.confirm(`¿Eliminar ${label} del pedido?`)) return;
    }
    onSetProductQty(line.producto_id, 0);
  };

  const entregaBloqueada = Boolean(entregaAlert?.trim());

  return (
    <div className="space-y-6 pb-28 max-md:pb-32">
      {entregaBloqueada && (
        <div
          role="alert"
          className="rounded-xl border-2 border-amber-600 bg-amber-50 p-4 text-amber-950 shadow-md ring-1 ring-amber-500/30 dark:border-amber-500 dark:bg-amber-950/50 dark:text-amber-50 dark:ring-amber-400/20"
        >
          <p className="font-semibold text-base">Faltan datos de entrega</p>
          <p className="mt-2 text-sm leading-relaxed">{entregaAlert}</p>
          <p className="mt-3 text-xs font-medium text-amber-900/90 dark:text-amber-200/90">
            Pulsa «Volver» (flecha arriba a la izquierda), completa el formulario y vuelve a «Ver pedido».
          </p>
        </div>
      )}

      <header className="flex items-center gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-700">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Volver al catálogo"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-zinc-900 dark:text-zinc-100">Tu pedido</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Revisa cantidades antes de enviar</p>
        </div>
      </header>

      <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200/90 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40">
        {lineas.map((linea) => {
          const p = resolveProduct(linea.producto_id);
          const nombre = p?.descripcion || linea.descripcion || 'Producto';
          const codigo = p?.numero || linea.numero_articulo || '—';
          const imagen = p?.imagen;
          const initials = rowInitials(codigo, nombre);
          const qty = Math.max(0, Math.floor(Number(linea.cantidad) || 0));

          return (
            <li key={linea.producto_id} className="flex gap-3 p-4 sm:gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                {imagen ? (
                  <img src={imagen} alt="" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-zinc-500" aria-hidden>
                    <Package className="h-7 w-7 opacity-80" strokeWidth={1.75} />
                    <span className="text-[10px] font-bold text-zinc-400">{initials}</span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100">{nombre}</p>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{codigo}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <QuantityStepper
                    id={`review-qty-${linea.producto_id}`}
                    value={qty}
                    cartAligned
                    onChange={(n) => onSetProductQty(linea.producto_id, n)}
                    ariaLabelProduct={nombre}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(linea)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 text-red-600 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                    aria-label={`Eliminar ${nombre}`}
                  >
                    <Trash2 className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div>
        <label htmlFor="review-pedido-notas" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {notasLabel}
        </label>
        <textarea
          id="review-pedido-notas"
          value={notas}
          onChange={(e) => onNotasChange(e.target.value)}
          rows={3}
          placeholder={notasPlaceholder}
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/60">
        <div className="flex justify-between gap-4 text-zinc-800 dark:text-zinc-200">
          <span>Productos</span>
          <span className="font-semibold tabular-nums">{productCount}</span>
        </div>
        <div className="mt-1 flex justify-between gap-4 text-zinc-800 dark:text-zinc-200">
          <span>Unidades totales</span>
          <span className="font-semibold tabular-nums">{unitCount}</span>
        </div>
      </div>

      {overLimit && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          El subtotal supera el límite de gasto del cliente. Ajusta cantidades antes de enviar.
        </div>
      )}

      <div
        className="pointer-events-auto max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-[45] max-md:border-t max-md:border-zinc-200 max-md:bg-white/95 max-md:shadow-[0_-8px_30px_rgba(0,0,0,0.12)] max-md:backdrop-blur-sm dark:max-md:border-zinc-700 dark:max-md:bg-zinc-900/95 md:sticky md:bottom-4"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto flex max-w-7xl px-3 py-3 md:px-0">
          <button
            type="button"
            disabled={submitting || overLimit || productCount === 0 || entregaBloqueada}
            onClick={() => void onSubmit()}
            className="w-full rounded-xl bg-zinc-900 py-3.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {submitting ? 'Enviando…' : 'Enviar pedido'}
          </button>
        </div>
      </div>
    </div>
  );
};
