import { Info } from 'lucide-react';
import { formatHofScore } from './hallOfFameUi.utils';
import { HofPositionBadge } from './hallOfFameUi';
import HallOfFameAdminActions from './HallOfFameAdminActions';

function BreakdownDetails({ data }) {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <details className="hof-rank-row__details">
      <summary className="hof-rank-row__details-summary">
        <Info className="w-3.5 h-3.5" aria-hidden />
        Ver detalles
      </summary>
      <div className="hof-rank-row__details-body">
        <div><strong>Horas fichadas:</strong> {formatHofScore(data.horas_pontate)}h</div>
        <div><strong>Objetivo:</strong> {formatHofScore(data.target_ajustat)}h</div>
        <div><strong>Días neutros:</strong> {data.dias_neutre || 0}</div>
        <div><strong>Fichajes incompletos:</strong> {data.fichajes_incompleto || 0}</div>
        {data.tareas_overdue != null && (
          <div>
            <strong>Tareas overdue:</strong> {data.tareas_overdue || 0}
            {Number(data.penalizacion_tareas) > 0 ? ` (−${data.penalizacion_tareas} cal.)` : ''}
          </div>
        )}
        <div><strong>Acciones:</strong> {formatHofScore(data.acciones_totales)}</div>
      </div>
    </details>
  );
}

function TrimestralMeta({ item }) {
  const bj = item.breakdown_json;
  if (bj?.trimestres?.length > 0) {
    return (
      <span className="hof-rank-row__meta-extra">
        (Últimos {bj.trimestres.length} trimestres: {bj.trimestres.map((t) => t.trimestre).join(', ')})
      </span>
    );
  }
  if (bj?.meses) {
    return (
      <span className="hof-rank-row__meta-extra">
        (Promedio de {bj.meses.length} meses)
      </span>
    );
  }
  return null;
}

export default function HallOfFameRankingList({
  items,
  variant = 'monthly',
  canCalculate,
  loading,
  onSelectEmployee,
  onRecalculate,
  onPremio,
  skipTopThree = false,
}) {
  if (!items?.length) return null;

  return (
    <div className="hof-rank-list">
      {items.map((item, index) => {
        const position = item.ranking || (skipTopThree ? index + 4 : index + 1);
        if (skipTopThree && position <= 3) return null;

        const breakdownData = item.breakdown_json || {};
        const clickable = canCalculate && item.empleado_codigo;

        return (
          <article
            key={item.empleado_codigo || item.id || index}
            className={`hof-rank-row app-card${clickable ? ' is-clickable' : ''}`}
            onClick={clickable ? () => onSelectEmployee(item.empleado_codigo) : undefined}
          >
            <div className="hof-rank-row__main">
              <HofPositionBadge position={position} size="sm" />
              <div className="hof-rank-row__info min-w-0">
                <p className="hof-rank-row__name">{item.empleadoNombre || item.empleado_codigo}</p>
                <p className="hof-rank-row__group">{item.grupo || '—'}</p>
                {variant === 'trimestral' ? (
                  <p className="hof-rank-row__meta">
                    <TrimestralMeta item={item} />
                  </p>
                ) : null}
              </div>
              <div className="hof-rank-row__score">
                <span className="hof-rank-row__score-value">{formatHofScore(item.score_final)}</span>
                <span className="hof-rank-row__score-label">
                  {variant === 'trimestral' ? 'Trimestral' : 'Puntuación'}
                </span>
              </div>
            </div>

            {variant === 'monthly' && (
              <div className="hof-rank-row__kpis">
                <div><span>Horas</span><strong>{formatHofScore(item.score_indeplinire)}</strong></div>
                <div><span>Calidad</span><strong>{formatHofScore(item.score_calitate)}</strong></div>
                <div><span>Puntualidad</span><strong>{formatHofScore(item.score_punctualitate)}</strong></div>
                <div><span>App</span><strong>{formatHofScore(item.score_uso_app)}</strong></div>
                <div><span>Resp. digital</span><strong>{formatHofScore(item.score_responsabilidad_digital || breakdownData.score_responsabilidad_digital)}</strong></div>
              </div>
            )}

            {canCalculate && variant === 'monthly' ? (
              <BreakdownDetails data={breakdownData} />
            ) : null}

            {canCalculate && onRecalculate && onPremio ? (
              <HallOfFameAdminActions
                entry={item}
                loading={loading}
                onRecalculate={onRecalculate}
                onPremio={onPremio}
                size="sm"
                showLabels={false}
              />
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
