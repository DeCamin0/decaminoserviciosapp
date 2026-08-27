import { RefreshCw, Gift } from 'lucide-react';
import { Button } from '../ui';

export default function HallOfFameAdminActions({
  entry,
  loading,
  onRecalculate,
  onPremio,
  size = 'md',
  showLabels = true,
}) {
  if (!entry) return null;
  const compact = size === 'sm';

  return (
    <div className="hof-admin-actions" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        title="Recalcular"
        disabled={loading}
        onClick={(e) => onRecalculate(entry.empleado_codigo, e)}
      >
        <RefreshCw className={`w-4 h-4${loading ? ' animate-spin' : ''}`} aria-hidden />
        {showLabels && !compact ? <span>Recalcular</span> : null}
      </Button>
      <Button
        type="button"
        variant="primary"
        size="sm"
        title="Dar premio"
        disabled={loading}
        onClick={(e) => {
          e.stopPropagation();
          onPremio(entry);
        }}
      >
        <Gift className="w-4 h-4" aria-hidden />
        {showLabels && !compact ? <span>Premio</span> : null}
      </Button>
    </div>
  );
}
