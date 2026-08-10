/**
 * Contenedor de sección/tarjeta para dashboards de estadísticas.
 */
export default function SectionCard({
  title,
  actions,
  children,
  className = '',
  bodyClassName = '',
  id,
}) {
  return (
    <section
      id={id}
      className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 pb-2">
          {title ? (
            <h3 className="text-sm sm:text-base font-semibold text-gray-800 truncate">
              {title}
            </h3>
          ) : (
            <span />
          )}
          {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
        </div>
      )}
      <div className={`px-4 sm:px-5 pb-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
