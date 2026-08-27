import { formatHofScore } from './hallOfFameUi.utils';
import { HofKpiBreakdown, HofPositionBadge } from './hallOfFameUi';
import HallOfFameAdminActions from './HallOfFameAdminActions';

function PodiumSlot({
  entry,
  position,
  slotClass,
  canCalculate,
  loading,
  onSelect,
  onRecalculate,
  onPremio,
  showKpi,
}) {
  if (!entry) return null;
  const clickable = canCalculate && entry.empleado_codigo;

  return (
    <article
      className={`hof-podium__slot ${slotClass}${clickable ? ' is-clickable' : ''}`}
      onClick={clickable ? () => onSelect(entry.empleado_codigo) : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter') onSelect(entry.empleado_codigo); } : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <HofPositionBadge position={position} size="lg" />
      <p className="hof-podium__name">{entry.empleadoNombre || entry.empleado_codigo}</p>
      <p className="hof-podium__group">{entry.grupo || '—'}</p>
      <div className="hof-podium__score-wrap">
        <span className="hof-podium__score-label">Puntuación</span>
        <span className="hof-podium__score">{formatHofScore(entry.score_final)}</span>
      </div>
      {showKpi ? <HofKpiBreakdown item={entry} className="hof-podium__kpi" /> : null}
      {canCalculate ? (
        <HallOfFameAdminActions
          entry={entry}
          loading={loading}
          onRecalculate={onRecalculate}
          onPremio={onPremio}
          size="sm"
          showLabels={false}
        />
      ) : null}
    </article>
  );
}

export default function HallOfFamePodium({
  ranking,
  title = 'Top 3',
  canCalculate,
  loading,
  onSelectEmployee,
  onRecalculate,
  onPremio,
  showKpi = true,
}) {
  if (!ranking || ranking.length < 3) return null;
  const [first, second, third] = ranking;

  return (
    <section className="hof-podium" aria-label={title}>
      <h2 className="hof-podium__title">{title}</h2>
      <div className="hof-podium__grid">
        <PodiumSlot
          entry={second}
          position={2}
          slotClass="hof-podium__slot--silver hof-podium__slot--second"
          canCalculate={canCalculate}
          loading={loading}
          onSelect={onSelectEmployee}
          onRecalculate={onRecalculate}
          onPremio={onPremio}
          showKpi={showKpi}
        />
        <PodiumSlot
          entry={first}
          position={1}
          slotClass="hof-podium__slot--gold hof-podium__slot--first"
          canCalculate={canCalculate}
          loading={loading}
          onSelect={onSelectEmployee}
          onRecalculate={onRecalculate}
          onPremio={onPremio}
          showKpi={showKpi}
        />
        <PodiumSlot
          entry={third}
          position={3}
          slotClass="hof-podium__slot--bronze hof-podium__slot--third"
          canCalculate={canCalculate}
          loading={loading}
          onSelect={onSelectEmployee}
          onRecalculate={onRecalculate}
          onPremio={onPremio}
          showKpi={showKpi}
        />
      </div>
    </section>
  );
}
