import React from 'react';
import { ShoppingCart } from 'lucide-react';

export type StickyCartBarProps = {
  productCount: number;
  unitCount: number;
  ctaLabel?: string;
  onCtaClick: () => void;
  className?: string;
};

/**
 * Mobile-first summary bar; fixed on small screens, inline block on md+.
 */
export const StickyCartBar: React.FC<StickyCartBarProps> = ({
  productCount,
  unitCount,
  ctaLabel = 'Ver pedido',
  onCtaClick,
  className = '',
}) => {
  if (productCount <= 0) return null;

  return (
    <div
      className={`pointer-events-auto max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-[45] max-md:border-t max-md:border-gray-200 max-md:bg-white/95 max-md:shadow-[0_-8px_30px_rgba(0,0,0,0.12)] max-md:backdrop-blur-sm dark:max-md:border-gray-700 dark:max-md:bg-gray-900/95 md:mt-4 md:rounded-xl md:border md:border-gray-200 md:bg-gray-50 md:shadow-sm dark:md:border-gray-700 dark:md:bg-gray-800/80 ${className}`}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 md:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
            aria-hidden
          >
            <ShoppingCart className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {productCount} producto{productCount !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{unitCount} unidad{unitCount !== 1 ? 'es' : ''}</p>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-xl border border-zinc-800 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-100 md:px-6 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
          onClick={onCtaClick}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
};
