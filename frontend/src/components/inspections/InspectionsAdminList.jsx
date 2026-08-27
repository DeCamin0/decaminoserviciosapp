import {
  Calendar,
  Download,
  Eye,
  FileText,
  MapPin,
  Play,
  User,
  Building2,
  Star,
} from 'lucide-react';
import { Button } from '../ui';
import {
  getInspectionTypeLabel,
  getInspectionTypeBadgeClass,
  getInspectionStatusBadge,
} from './inspectionUi.utils';
import { InspectionTypeIcon } from './inspectionUi';

function InspectionMeta({ icon: Icon, label, value }) {
  if (!value || value === 'N/A') return null;
  return (
    <div className="inspecciones-meta-row">
      <Icon className="inspecciones-meta-row__icon" aria-hidden />
      <span className="inspecciones-meta-row__label">{label}</span>
      <span className="inspecciones-meta-row__value">{value}</span>
    </div>
  );
}

function MaterialesDocs({ inspection, materialesDocumentos, onLoadDocs, onDownloadDoc }) {
  if (inspection.type !== 'entrega-materiales') return null;
  const docs = materialesDocumentos[inspection.id];

  return (
    <div className="inspecciones-materiales-docs">
      <p className="inspecciones-materiales-docs__title">Documentos</p>
      {docs?.length ? (
        <div className="inspecciones-materiales-docs__list">
          {docs.map((doc) => (
            <button
              key={doc.doc_id}
              type="button"
              className="inspecciones-materiales-docs__item"
              onClick={() => onDownloadDoc(doc.doc_id, doc.nombre_archivo || '')}
            >
              <FileText className="w-4 h-4 shrink-0" aria-hidden />
              <span className="truncate">{doc.nombre_archivo || `Documento ${doc.material_index + 1}`}</span>
              <Download className="w-4 h-4 shrink-0" aria-hidden />
            </button>
          ))}
        </div>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => onLoadDocs(inspection.id)}>
          Cargar documentos
        </Button>
      )}
    </div>
  );
}

function InspectionActions({ inspection, onPreview, onDownload, onStartSolicitud }) {
  if (inspection.isSolicitud) {
    return (
      <Button type="button" variant="primary" size="sm" className="w-full min-h-[44px]" onClick={() => onStartSolicitud(inspection)}>
        <Play className="w-4 h-4" aria-hidden />
        Iniciar inspección
      </Button>
    );
  }

  return (
    <div className="inspecciones-card-actions">
      <Button type="button" variant="secondary" size="sm" className="flex-1 min-h-[44px]" onClick={() => onPreview(inspection)}>
        <Eye className="w-4 h-4" aria-hidden />
        Preview
      </Button>
      <Button type="button" variant="primary" size="sm" className="flex-1 min-h-[44px]" onClick={() => onDownload(inspection)}>
        <Download className="w-4 h-4" aria-hidden />
        Descargar
      </Button>
    </div>
  );
}

function InspectionCard({
  inspection,
  materialesDocumentos,
  onPreview,
  onDownload,
  onStartSolicitud,
  onLoadDocs,
  onDownloadDoc,
}) {
  const status = getInspectionStatusBadge(inspection);

  return (
    <article className="inspecciones-card app-card app-card--pad">
      <div className="inspecciones-card__head">
        <div className="inspecciones-card__title-wrap">
          <InspectionTypeIcon type={inspection.type} className="w-4 h-4 shrink-0" />
          <h3 className="inspecciones-card__title">{inspection.id}</h3>
        </div>
        <div className="inspecciones-card__badges">
          <span className={status.className}>{status.label}</span>
          <span className={getInspectionTypeBadgeClass(inspection.type)}>
            {getInspectionTypeLabel(inspection.type)}
          </span>
          {inspection.employeeCode ? (
            <span className="inspecciones-badge">{inspection.employeeCode}</span>
          ) : null}
          {inspection.scor_total != null ? (
            <span className="inspecciones-badge inspecciones-badge--score">
              <Star className="w-3 h-3" aria-hidden />
              {Number(inspection.scor_total).toFixed(2)}/5
            </span>
          ) : null}
        </div>
      </div>

      <div className="inspecciones-card__body">
        <InspectionMeta icon={Calendar} label="Fecha" value={inspection.date} />
        <InspectionMeta icon={User} label="Inspector" value={inspection.isSolicitud ? 'Pendiente' : inspection.inspector} />
        <InspectionMeta icon={User} label="Trabajador" value={inspection.trabajador} />
        <InspectionMeta icon={MapPin} label="Ubicación" value={inspection.location} />
        <InspectionMeta icon={Building2} label="Centro" value={inspection.centro} />
        {inspection.observaciones ? (
          <p className="inspecciones-card__notes">{inspection.observaciones}</p>
        ) : null}
        <MaterialesDocs
          inspection={inspection}
          materialesDocumentos={materialesDocumentos}
          onLoadDocs={onLoadDocs}
          onDownloadDoc={onDownloadDoc}
        />
      </div>

      <InspectionActions
        inspection={inspection}
        onPreview={onPreview}
        onDownload={onDownload}
        onStartSolicitud={onStartSolicitud}
      />
    </article>
  );
}

export default function InspectionsAdminList({
  items,
  materialesDocumentos,
  onPreview,
  onDownload,
  onStartSolicitud,
  onLoadDocs,
  onDownloadDoc,
}) {
  if (!items.length) {
    return (
      <div className="inspecciones-empty app-card app-card--pad">
        <p className="inspecciones-empty__title">No se encontraron inspecciones</p>
        <p className="inspecciones-empty__text">Prueba ajustando los filtros de búsqueda.</p>
      </div>
    );
  }

  return (
    <>
      <div className="inspecciones-mobile-list solicitud-admin-mobile-list">
        {items.map((inspection) => (
          <InspectionCard
            key={inspection.id}
            inspection={inspection}
            materialesDocumentos={materialesDocumentos}
            onPreview={onPreview}
            onDownload={onDownload}
            onStartSolicitud={onStartSolicitud}
            onLoadDocs={onLoadDocs}
            onDownloadDoc={onDownloadDoc}
          />
        ))}
      </div>

      <div className="inspecciones-desktop-table solicitud-admin-table-wrap">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Inspector</th>
              <th>Trabajador</th>
              <th>Centro</th>
              <th>Estado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((inspection) => {
              const status = getInspectionStatusBadge(inspection);
              return (
                <tr key={inspection.id}>
                  <td className="font-medium">{inspection.id}</td>
                  <td>
                    <span className={getInspectionTypeBadgeClass(inspection.type)}>
                      {getInspectionTypeLabel(inspection.type)}
                    </span>
                  </td>
                  <td>{inspection.date}</td>
                  <td>{inspection.isSolicitud ? 'Pendiente' : (inspection.inspector || '—')}</td>
                  <td>{inspection.trabajador || '—'}</td>
                  <td className="max-w-[160px] truncate">{inspection.centro || '—'}</td>
                  <td><span className={status.className}>{status.label}</span></td>
                  <td>
                    <div className="inspecciones-table-actions">
                      {inspection.isSolicitud ? (
                        <Button type="button" variant="primary" size="sm" onClick={() => onStartSolicitud(inspection)}>
                          Iniciar
                        </Button>
                      ) : (
                        <>
                          <button type="button" className="solicitud-admin-btn" onClick={() => onPreview(inspection)} aria-label="Preview">
                            <Eye className="w-4 h-4" aria-hidden />
                          </button>
                          <button type="button" className="solicitud-admin-btn" onClick={() => onDownload(inspection)} aria-label="Descargar">
                            <Download className="w-4 h-4" aria-hidden />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
