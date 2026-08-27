import { Calendar, Download, Eye, MapPin, Star, User, Building2 } from 'lucide-react';
import { Button } from '../ui';
import { getInspectionTypeLabel } from './inspectionUi.utils';
import { InspectionTypeIcon } from './inspectionUi';

export default function MisInspeccionesList({ items, onPreview, onDownload }) {
  if (!items.length) {
    return (
      <div className="inspecciones-empty app-card app-card--pad">
        <p className="inspecciones-empty__title">No tienes inspecciones</p>
        <p className="inspecciones-empty__text">Aparecerán aquí cuando estén disponibles.</p>
      </div>
    );
  }

  return (
    <div className="mis-inspecciones-list">
      {items.map((inspection, index) => (
        <article key={inspection.id || index} className="mis-inspeccion-row app-card app-card--pad">
          <div className="mis-inspeccion-row__main">
            <div className="mis-inspeccion-row__head">
              <InspectionTypeIcon type={inspection.type} className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <p className="mis-inspeccion-row__id">{inspection.id}</p>
                <p className="mis-inspeccion-row__type">{getInspectionTypeLabel(inspection.type)}</p>
              </div>
              <span className="inspecciones-badge inspecciones-badge--done">{inspection.status || 'Completada'}</span>
            </div>

            <dl className="mis-inspeccion-row__meta solicitud-admin-kv">
              <dt><Calendar className="inline w-3 h-3 mr-1" aria-hidden />Fecha</dt>
              <dd>{inspection.date || '—'}</dd>
              {inspection.centro ? (
                <>
                  <dt><Building2 className="inline w-3 h-3 mr-1" aria-hidden />Centro</dt>
                  <dd className="truncate">{inspection.centro}</dd>
                </>
              ) : null}
              {inspection.location ? (
                <>
                  <dt><MapPin className="inline w-3 h-3 mr-1" aria-hidden />Ubicación</dt>
                  <dd className="truncate">{inspection.location}</dd>
                </>
              ) : null}
              {inspection.inspector ? (
                <>
                  <dt><User className="inline w-3 h-3 mr-1" aria-hidden />Inspector</dt>
                  <dd className="truncate">{inspection.inspector}</dd>
                </>
              ) : null}
            </dl>

            {inspection.scor_total != null ? (
              <p className="mis-inspeccion-row__score">
                <Star className="w-3.5 h-3.5" aria-hidden />
                {Number(inspection.scor_total).toFixed(2)}/5
              </p>
            ) : null}
          </div>

          <div className="mis-inspeccion-row__actions">
            <Button type="button" variant="primary" size="sm" className="w-full min-h-[44px]" onClick={() => onPreview(inspection)}>
              <Eye className="w-4 h-4" aria-hidden />
              Ver PDF
            </Button>
            <Button type="button" variant="secondary" size="sm" className="w-full min-h-[44px]" onClick={() => onDownload(inspection)}>
              <Download className="w-4 h-4" aria-hidden />
              Descargar
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
