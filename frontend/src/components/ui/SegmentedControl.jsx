export default function SegmentedControl({ items = [], value, onChange, className = '', layout = 'row' }) {
  return (
    <div
      className={`app-segmented${layout === 'grid' ? ' app-segmented--grid' : ''}${className ? ` ${className}` : ''}`}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            title={item.label}
            className={`app-segmented__item ${active ? 'is-active' : ''}`}
            onClick={() => {
              if (item.id !== value) onChange?.(item.id);
            }}
          >
            {item.icon ? <span aria-hidden>{item.icon}</span> : null}
            <span className="truncate max-w-full">
              <span className="sm:hidden">{item.shortLabel || item.label}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
