import React from 'react';

export type QuantityStepperProps = {
  id: string;
  value: number;
  onChange: (next: number) => void;
  /** When true, empty or 0 on blur is coerced back to 1 (legacy draft mode). */
  blurDefaultOne?: boolean;
  /** When true: show 0 as "0", do not coerce 1 on blur; for cart quantity. */
  cartAligned?: boolean;
  ariaLabelProduct?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Quantity pill: soft neutrals, + is subtle (not loud red).
 */
export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  id,
  value,
  onChange,
  blurDefaultOne = false,
  cartAligned = false,
  ariaLabelProduct,
  disabled = false,
  className = '',
}) => {
  const effectiveBlurOne = blurDefaultOne && !cartAligned;
  const display =
    value === 0 && !cartAligned ? '' : String(Math.max(0, Math.floor(Number(value) || 0)));

  const circleBtn =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg font-semibold leading-none transition select-none active:scale-[0.94] disabled:pointer-events-none disabled:opacity-40';

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-zinc-200/90 bg-white px-1 py-1 shadow-sm dark:border-zinc-200 dark:bg-white ${className}`}
      role="group"
      aria-label={ariaLabelProduct ? `Cantidad: ${ariaLabelProduct}` : 'Cantidad'}
    >
      <button
        type="button"
        disabled={disabled || (cartAligned && value <= 0)}
        className={`${circleBtn} border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-800 dark:hover:bg-zinc-200`}
        aria-label="Restar cantidad"
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        −
      </button>
      <input
        id={id}
        type="number"
        min={0}
        disabled={disabled}
        value={display}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') onChange(0);
          else {
            const n = parseInt(v, 10);
            if (!Number.isNaN(n) && n >= 0) onChange(n);
          }
        }}
        onBlur={() => {
          if (effectiveBlurOne && (value === 0 || value === undefined)) onChange(1);
        }}
        className="h-9 w-10 min-w-10 border-0 bg-transparent text-center text-[15px] font-semibold tabular-nums text-zinc-900 outline-none ring-0 focus:ring-2 focus:ring-zinc-400/50 focus:ring-offset-0 dark:text-zinc-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label={ariaLabelProduct ? `Cantidad para ${ariaLabelProduct}` : 'Cantidad'}
      />
      <button
        type="button"
        disabled={disabled}
        className={`${circleBtn} border-zinc-300 bg-zinc-800 text-white shadow-sm hover:bg-zinc-700 dark:border-zinc-300 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700`}
        aria-label="Sumar cantidad"
        onClick={() => onChange((value || 0) + 1)}
      >
        +
      </button>
    </div>
  );
};
