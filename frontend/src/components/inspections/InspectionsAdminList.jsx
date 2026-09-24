import { useState } from 'react';
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

function MaterialesDocs({
  inspection,
  materialesDocumentos,
  onLoadDocs,
  onDownloadDoc,
  onPreviewDoc,
  onDownloadDocs,
  compact = false,
}) {
  const [selected, setSelected] = useState(() => new Set());
  const isMateriales = inspection.type === 'entrega-materiales';
  const docs = isMateriales ? materialesDocumentos[inspection.id] : null;
  const hasDocs = Array.isArray(docs) && docs.length > 0;
  const selectedList = hasDocs ? docs.filter((d) => selected.has(d.doc_id)) : [];

  if (!isMateriales) return null;

  const toggleDoc = (docId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const toggleAll = () => {
    if (!hasDocs) return;
    setSelected((prev) => {
      if (prev.size === docs.length) return new Set();
      return new Set(docs.map((d) => d.doc_id));
    });
  };

  return (
    <div className={`inspecciones-materiales-docs${compact ? ' inspecciones-materiales-docs--compact' : ''}`}>
      {!compact ? (
        <p className="inspecciones-materiales-docs__title">Documentos</p>
      ) : null}
      {hasDocs ? (
        <>
          {docs.length > 1 ? (
            <div className="inspecciones-materiales-docs__bulk">
              <label className="inspecciones-materiales-docs__check">
                <input
                  type="checkbox"
                  checked={selected.size === docs.length}
                  onChange={toggleAll}
                />
                <span>Todos</span>
              </label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={selectedList.length === 0}
                onClick={() => onDownloadDocs?.(selectedList)}
              >
                <Download className="w-3.5 h-3.5" aria-hidden />
                Descargar ({selectedList.length || 0})
              </Button>
            </div>
          ) : null}
          <div className="inspecciones-materiales-docs__list">
            {docs.map((doc) => {
              const name = doc.nombre_archivo || `Documento ${doc.material_index + 1}`;
              return (
                <div key={doc.doc_id} className="inspecciones-materiales-docs__row">
                  {docs.length > 1 ? (
                    <input
                      type="checkbox"
                      className="inspecciones-materiales-docs__row-check"
                      checked={selected.has(doc.doc_id)}
                      onChange={() => toggleDoc(doc.doc_id)}
                      aria-label={`Seleccionar ${name}`}
                    />
                  ) : null}
                  <FileText className="w-4 h-4 shrink-0 text-gray-500" aria-hidden />
                  <span className="inspecciones-materiales-docs__name" title={name}>
                    {name}
                  </span>
                  <div className="inspecciones-materiales-docs__row-actions">
                    <button
                      type="button"
                      className="solicitud-admin-btn"
                      title="Vista previa"
                      aria-label={`Vista previa ${name}`}
                      onClick={() => onPreviewDoc?.(doc)}
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="solicitud-admin-btn"
                      title="Descargar"
                      aria-label={`Descargar ${name}`}
                      onClick={() => onDownloadDoc(doc.doc_id, name)}
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
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
  onPreviewDoc,
  onDownloadDocs,
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
          onPreviewDoc={onPreviewDoc}
          onDownloadDocs={onDownloadDocs}
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
  onPreviewDoc,
  onDownloadDocs,
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
            onPreviewDoc={onPreviewDoc}
            onDownloadDocs={onDownloadDocs}
          />
        ))}
      </div>

      <div className="inspecciones-desktop-table solicitud-admin-table-wrap">
        <table className="w-full text-sm inspecciones-admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Inspector</th>
              <th>Trabajador</th>
              <th className="inspecciones-col-centro">Centro</th>
              <th>Estado</th>
              <th className="inspecciones-col-docs">Documentos</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((inspection) => {
              const status = getInspectionStatusBadge(inspection);
              return (
                <tr key={inspection.id}>
                  <td className="font-medium whitespace-nowrap">{inspection.id}</td>
                  <td>
                    <span className={getInspectionTypeBadgeClass(inspection.type)}>
                      {getInspectionTypeLabel(inspection.type)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">{inspection.date}</td>
                  <td>{inspection.isSolicitud ? 'Pendiente' : (inspection.inspector || '—')}</td>
                  <td>{inspection.trabajador || '—'}</td>
                  <td className="inspecciones-col-centro" title={inspection.centro || ''}>
                    {inspection.centro || '—'}
                  </td>
                  <td><span className={status.className}>{status.label}</span></td>
                  <td className="inspecciones-col-docs align-top">
                    {inspection.type === 'entrega-materiales' ? (
                      <MaterialesDocs
                        inspection={inspection}
                        materialesDocumentos={materialesDocumentos}
                        onLoadDocs={onLoadDocs}
                        onDownloadDoc={onDownloadDoc}
                        onPreviewDoc={onPreviewDoc}
                        onDownloadDocs={onDownloadDocs}
                        compact
                      />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
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
