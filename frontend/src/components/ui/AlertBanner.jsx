const VARIANT_ICON = {
  warning: '⚠️',
  info: 'ℹ️',
  success: '✅',
  danger: '⛔',
  loading: null,
};

export default function AlertBanner({
  variant = 'warning',
  title,
  children,
  loading = false,
  icon,
  compact = false,
  className = '',
}) {
  const resolvedVariant = loading ? 'loading' : variant;
  const resolvedIcon = icon ?? VARIANT_ICON[resolvedVariant];

  return (
    <div
      className={`app-alert app-alert--${resolvedVariant}${compact ? ' app-alert--compact' : ''}${className ? ` ${className}` : ''}`}
      role={loading ? 'status' : 'alert'}
    >
      {loading ? (
        <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : resolvedIcon ? (
        <div className="app-alert__icon" aria-hidden>{resolvedIcon}</div>
      ) : null}
      <div className="min-w-0">
        {title ? <p className="app-alert__title">{title}</p> : null}
        {children ? <div className={title || compact ? 'app-alert__body' : 'text-sm'}>{children}</div> : null}
      </div>
    </div>
  );
}
