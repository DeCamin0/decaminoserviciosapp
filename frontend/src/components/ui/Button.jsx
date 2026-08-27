function cn(...a) { return a.filter(Boolean).join(' '); }

export function Button({
  as: Tag = 'button',
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  className = '',
  loading,
  ...props
}) {
  const base = 'inline-flex items-center justify-center rounded-[var(--app-radius-sm,0.65rem)] font-medium focus-visible:outline outline-2 outline-offset-2 outline-[var(--primary-color)] disabled:opacity-50 disabled:pointer-events-none transition-colors';

  const sizes = {
    sm: iconOnly ? 'hit-44 text-sm' : 'hit-44 px-3 py-2 text-sm',
    md: iconOnly ? 'hit-44' : 'hit-44 px-4 py-2 text-sm',
    lg: iconOnly ? 'min-h-[48px] min-w-[48px] text-base' : 'min-h-[48px] px-5 py-3 text-base',
    tv: iconOnly ? 'hit-64 text-xl' : 'hit-64 px-6 py-4 text-xl',
  };

  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800',
    secondary: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700',
    ghost: 'bg-transparent hover:bg-primary-50 active:bg-primary-100 text-gray-800',
    outline: 'border border-primary-300 text-primary-700 hover:bg-primary-50 active:bg-primary-100',
    danger: 'bg-error text-white hover:opacity-90 active:opacity-80',
    outlineDanger: 'border border-error text-error hover:bg-red-50 active:bg-red-100',
  };

  const domProps = { ...props };
  if (loading !== undefined) {
    domProps.loading = loading ? 'true' : 'false';
  }

  return (
    <Tag
      className={cn(base, sizes[size] || sizes.md, variants[variant] || variants.primary, className)}
      {...domProps}
    />
  );
}

export function IconButton({ label, size = 'md', className = '', ...props }) {
  return (
    <Button aria-label={label} title={label} iconOnly size={size} className={cn('aspect-square', className)} {...props} />
  );
}

export default Button;
