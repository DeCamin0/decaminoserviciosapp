import { Trophy, Medal, Award, Loader2 } from 'lucide-react';
import { formatHofScore } from './hallOfFameUi.utils';

export function HofLoadingState() {
  return (
    <div className="hof-state">
      <Loader2 className="hof-state__icon animate-spin" aria-hidden />
      <p className="hof-state__message">Cargando clasificación…</p>
    </div>
  );
}

export function HofEmptyState({
  icon: Icon = Trophy,
  title,
  message,
  hint,
  action,
}) {
  return (
    <div className="hof-empty app-card">
      <Icon className="hof-empty__icon" aria-hidden />
      <h3 className="hof-empty__title">{title}</h3>
      {message ? <p className="hof-empty__message">{message}</p> : null}
      {hint ? <p className="hof-empty__hint">{hint}</p> : null}
      {action ? <div className="hof-empty__action">{action}</div> : null}
    </div>
  );
}

export function HofPositionBadge({ position, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'hof-pos-badge--sm' : size === 'lg' ? 'hof-pos-badge--lg' : '';
  const posClass = position === 1 ? 'hof-pos-badge--gold'
    : position === 2 ? 'hof-pos-badge--silver'
      : position === 3 ? 'hof-pos-badge--bronze'
        : position <= 10 ? 'hof-pos-badge--top10' : 'hof-pos-badge--default';

  if (position === 1) {
    return (
      <div className={`hof-pos-badge ${sizeClass} ${posClass}`} aria-label="Posición 1">
        <Trophy className="hof-pos-badge__icon" aria-hidden />
        <span className="hof-pos-badge__num">1</span>
      </div>
    );
  }
  if (position === 2) {
    return (
      <div className={`hof-pos-badge ${sizeClass} ${posClass}`} aria-label="Posición 2">
        <Medal className="hof-pos-badge__icon" aria-hidden />
        <span className="hof-pos-badge__num">2</span>
      </div>
    );
  }
  if (position === 3) {
    return (
      <div className={`hof-pos-badge ${sizeClass} ${posClass}`} aria-label="Posición 3">
        <Award className="hof-pos-badge__icon" aria-hidden />
        <span className="hof-pos-badge__num">3</span>
      </div>
    );
  }
  return (
    <div className={`hof-pos-badge ${sizeClass} ${posClass}`}>
      <span className="hof-pos-badge__hash">#{position}</span>
    </div>
  );
}

export function HofKpiBreakdown({ item, className = '' }) {
  const rd = item?.score_responsabilidad_digital
    ?? item?.breakdown_json?.score_responsabilidad_digital;
  return (
    <div className={`hof-kpi-breakdown ${className}`.trim()}>
      <div>Horas (30%): {formatHofScore(item?.score_indeplinire)}</div>
      <div>Calidad (20%): {formatHofScore(item?.score_calitate)}</div>
      <div>Puntualidad (10%): {formatHofScore(item?.score_punctualitate)}</div>
      <div>Uso App (10%): {formatHofScore(item?.score_uso_app)}</div>
      <div>Responsabilidad Digital (30%): {formatHofScore(rd)}</div>
    </div>
  );
}
