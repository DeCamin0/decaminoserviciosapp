function cn(...a){ return a.filter(Boolean).join(' '); }

export function Button({ as:Tag='button', variant='primary', size='md', iconOnly=false, className='', loading, ...props }) {
  const base = 'inline-flex items-center justify-center rounded-xl font-medium focus-visible:outline outline-2 outline-offset-2 outline-sky-500 disabled:opacity-50 disabled:pointer-events-none transition';
  
  const sizes = {
    sm: iconOnly ? 'hit-44 text-sm' : 'hit-44 px-3 py-2 text-sm',
    md: iconOnly ? 'hit-44' : 'hit-44 px-4 py-2',
    lg: iconOnly ? 'hit-48 text-lg' : 'min-h-[48px] px-5 py-3 text-lg',
    tv: iconOnly ? 'hit-64 text-xl' : 'hit-64 px-6 py-4 text-xl',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    outlineDanger: 'border border-red-300 text-red-600 hover:bg-red-50 active:bg-red-100',
  };
  
  const variants = {
    primary: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    ghost: 'bg-transparent hover:bg-red-100 active:bg-red-200',
    outline: 'border border-red-300 hover:bg-red-50 active:bg-red-100',
  };
  
  // Gestionarea atributului loading pentru DOM
  const domProps = { ...props };
  if (loading !== undefined) {
    // Dacă loading este boolean, îl convertim la string pentru DOM
    domProps.loading = loading ? 'true' : 'false';
  }
  
  return (
    <Tag
      className={cn(base, sizes[size] || sizes.md, variants[variant] || variants.primary, className)}
      {...domProps}
    />
  );
}

export function IconButton({ label, size='md', className='', ...props }){
  return (
    <Button aria-label={label} title={label} iconOnly size={size} className={cn('aspect-square', className)} {...props} />
  );
}

export default Button; 