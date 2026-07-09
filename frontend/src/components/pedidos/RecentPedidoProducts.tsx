import React from 'react';
import { Package, Plus } from 'lucide-react';
import type { PedidoCatalogProduct } from './ProductListItem';

function shortName(text: string, max = 36): string {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function initials(numero: string, descripcion: string): string {
  const raw = (numero || descripcion || '?').replace(/\s+/g, '');
  if (raw.length >= 2) return raw.slice(0, 2).toUpperCase();
  return `${raw || '?'}`.slice(0, 2).toUpperCase();
}

export type RecentPedidoProductsProps = {
  products: PedidoCatalogProduct[];
  onQuickAdd: (p: PedidoCatalogProduct) => void;
  /** When false, still show title + short empty hint (integration pending). */
  hasHistorySource?: boolean;
  title?: string;
  emptyMessage?: string;
};

/**
 * Horizontal "Recientes" strip: thumb, short name, + only.
 */
export const RecentPedidoProducts: React.FC<RecentPedidoProductsProps> = ({
  products,
  onQuickAdd,
  hasHistorySource = true,
  title = 'Recientes',
  emptyMessage,
}) => {
  const defaultEmpty = hasHistorySource
    ? 'Ningún producto de pedidos anteriores está en el catálogo de este centro todavía.'
    : 'Aquí aparecerán productos de tus pedidos anteriores para añadirlos rápido.';

  return (
    <section className="mb-5 border-b border-zinc-200/90 pb-5 text-zinc-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide !text-zinc-700" style={{ color: '#3f3f46' }}>
        {title}
      </h2>
      {products.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed !text-zinc-600" style={{ color: '#52525b' }}>
          {emptyMessage ?? defaultEmpty}
        </p>
      ) : (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex w-[108px] shrink-0 flex-col rounded-xl border border-zinc-200/90 bg-white p-2 shadow-sm"
            >
              <div className="relative mx-auto h-14 w-14 overflow-hidden rounded-lg bg-zinc-100">
                {p.imagen ? (
                  <img src={p.imagen} alt="" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-zinc-500" aria-hidden>
                    <Package className="h-6 w-6 opacity-75" strokeWidth={1.75} />
                    <span className="text-[9px] font-bold text-zinc-400">{initials(p.numero, p.descripcion)}</span>
                  </div>
                )}
              </div>
              <p
                className="mt-2 line-clamp-2 min-h-[2.25rem] text-center text-[11px] font-medium leading-tight !text-zinc-900"
                style={{ color: '#18181b' }}
              >
                {shortName(p.descripcion, 40)}
              </p>
              <button
                type="button"
                onClick={() => onQuickAdd(p)}
                className="mt-2 flex h-9 w-9 items-center justify-center self-center rounded-full border border-zinc-200 bg-zinc-900 text-white shadow-sm transition hover:bg-zinc-800 active:scale-95"
                aria-label={`Añadir ${p.descripcion}`}
              >
                <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
