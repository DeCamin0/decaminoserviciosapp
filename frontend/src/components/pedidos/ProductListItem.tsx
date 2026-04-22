import React from 'react';
import { Package } from 'lucide-react';
import { QuantityStepper } from './QuantityStepper';

export type PedidoCatalogProduct = {
  id: number;
  numero: string;
  descripcion: string;
  imagen?: string;
  precio?: number;
};

function catalogInitials(numero: string, descripcion: string): string {
  const raw = (numero || descripcion || '?').replace(/\s+/g, '');
  if (raw.length >= 2) return raw.slice(0, 2).toUpperCase();
  return `${raw || '?'}`.slice(0, 2).toUpperCase();
}

export type ProductListItemProps = {
  product: PedidoCatalogProduct;
  /** Quantity currently in the pedido for this product. */
  quantityInCart: number;
  onQuantityInCartChange: (next: number) => void;
  showPrice?: boolean;
  formatPrice?: (n: number) => string;
  /** Only when backend sends real stock text; omit or null to hide. */
  stockLabel?: string | null;
};

/**
 * Simple full-width row: image | name + code | stepper (no Añadir).
 */
export const ProductListItem: React.FC<ProductListItemProps> = ({
  product,
  quantityInCart,
  onQuantityInCartChange,
  showPrice = false,
  formatPrice,
  stockLabel,
}) => {
  const { id, numero, descripcion, imagen, precio } = product;
  const initials = catalogInitials(numero, descripcion);
  const [nameExpanded, setNameExpanded] = React.useState(false);
  const desc = descripcion || '—';
  const qty = Math.max(0, Math.floor(Number(quantityInCart) || 0));

  return (
    <div className="flex gap-4 border-b border-zinc-200/80 py-4 first:pt-0 dark:border-zinc-200/80">
      <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-100">
        {imagen ? (
          <img src={imagen} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-zinc-500 dark:text-zinc-500" aria-hidden>
            <Package className="h-7 w-7 opacity-80" strokeWidth={1.75} />
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-400">{initials}</span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="min-w-0 flex-1 text-zinc-900">
          <button
            type="button"
            className="w-full rounded-md px-0.5 py-0.5 text-left transition hover:bg-zinc-100/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 dark:hover:bg-zinc-100"
            onClick={() => setNameExpanded((v) => !v)}
            aria-expanded={nameExpanded}
            aria-label={nameExpanded ? 'Ocultar nombre completo' : 'Ver nombre completo'}
            title={desc.length > 40 ? `${desc}` : desc}
          >
            {/* line-clamp pe span (nu pe button): evită text invizibil în .dark + WebKit */}
            <span
              className={`block text-lg font-bold leading-snug tracking-tight !text-zinc-950 dark:!text-zinc-950 ${nameExpanded ? 'whitespace-normal break-words' : 'line-clamp-2'}`}
              style={{ color: '#09090b' }}
            >
              {desc}
            </span>
          </button>
          <p className="mt-1 text-sm !text-zinc-600 dark:!text-zinc-600" style={{ color: '#52525b' }}>
            {numero || '—'}
          </p>
          {stockLabel != null && stockLabel !== '' && (
            <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              {stockLabel}
            </span>
          )}
          {showPrice && precio != null && formatPrice && (
            <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-600">{formatPrice(precio)}</p>
          )}
        </div>

        <div className="shrink-0 self-start md:self-center">
          <QuantityStepper
            id={`cantidad-catalogo-${id}`}
            value={qty}
            onChange={onQuantityInCartChange}
            cartAligned
            ariaLabelProduct={descripcion}
          />
        </div>
      </div>
    </div>
  );
};
