/**
 * KPI compacto para dashboards de estadísticas.
 */
export default function StatCard({
  label,
  value,
  icon = '•',
  accent = 'red',
  onClick,
  title,
}) {
  const accents = {
    red: 'border-red-100 bg-red-50/60 text-red-600',
    green: 'border-green-100 bg-green-50/60 text-green-600',
    amber: 'border-amber-100 bg-amber-50/60 text-amber-600',
    orange: 'border-orange-100 bg-orange-50/60 text-orange-600',
    blue: 'border-blue-100 bg-blue-50/60 text-blue-600',
    slate: 'border-slate-100 bg-slate-50 text-slate-600',
  };
  const accentClass = accents[accent] || accents.red;

  const content = (
    <>
      <div
        className={`w-9 h-9 rounded-lg border flex items-center justify-center text-sm shrink-0 ${accentClass}`}
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900 leading-none tabular-nums">
          {value ?? 0}
        </div>
        <div className="text-xs text-gray-500 mt-1 truncate">{label}</div>
      </div>
    </>
  );

  const baseClass =
    'flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title || label}
        className={`${baseClass} w-full text-left cursor-pointer hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400`}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClass}>{content}</div>;
}
