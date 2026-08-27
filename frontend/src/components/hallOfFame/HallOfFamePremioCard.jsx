import { Calendar, Gift, Trophy, Award } from 'lucide-react';

export default function HallOfFamePremioCard({ premio }) {
  const fechaPremio = premio.FECHA || '';
  const fechaFormateada = fechaPremio
    ? new Date(fechaPremio).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    : '';

  return (
    <article className="hof-premio-card app-card">
      <div className="hof-premio-card__head">
        <div className="hof-premio-card__icon-wrap" aria-hidden>
          <Gift className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="hof-premio-card__eyebrow">Premio otorgado</p>
          <h3 className="hof-premio-card__name">
            {premio.NOMBRE || premio.empleado_nombre_completo || premio.CODIGO}
          </h3>
          <p className="hof-premio-card__centro">{premio.centro_trabajo || '—'}</p>
        </div>
      </div>

      <div className="hof-premio-card__body">
        <div className="hof-premio-card__row">
          <Calendar className="w-4 h-4 shrink-0" aria-hidden />
          <div>
            <span className="hof-premio-card__label">Día libre</span>
            <span className="hof-premio-card__value">{fechaFormateada || premio.FECHA || '—'}</span>
          </div>
        </div>
        <div className="hof-premio-card__row">
          <Trophy className="w-4 h-4 shrink-0" aria-hidden />
          <div>
            <span className="hof-premio-card__label">Motivo</span>
            <span className="hof-premio-card__value">
              {premio.MOTIVO || 'Reconocimiento por tu destacado desempeño en el Salón de la Fama'}
            </span>
          </div>
        </div>
        <div className="hof-premio-card__row">
          <Award className="w-4 h-4 shrink-0" aria-hidden />
          <div>
            <span className="hof-premio-card__label">Duración</span>
            <span className="hof-premio-card__value">
              {premio.DURACION ? `${premio.DURACION} ${premio.UNIDAD_DURACION || 'días'}` : '1 día'}
            </span>
          </div>
        </div>
      </div>

      <p className="hof-premio-card__footer">
        Permiso retribuido como reconocimiento a tu esfuerzo y dedicación.
      </p>
    </article>
  );
}
