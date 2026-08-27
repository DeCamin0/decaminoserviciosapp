import { Copy, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui';

function formatFestivoDate(festivo) {
  const dateObj = new Date(festivo.date);
  if (Number.isNaN(dateObj.getTime())) return festivo.date;
  return dateObj.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatFestivoWeekday(festivo) {
  const dateObj = new Date(festivo.date);
  if (Number.isNaN(dateObj.getTime())) return '-';
  return dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
}

export default function CuadrantesFestivosList({
  items,
  getScopeBadgeClasses,
  getScopeLabel,
  CCAA_NAMES,
  onEdit,
  onCopyNextYear,
  onDelete,
}) {
  if (!items.length) {
    return (
      <div className="cuadrantes-festivos-empty app-card app-card--pad text-center text-sm text-gray-500">
        No se han encontrado festivos para el año seleccionado.
      </div>
    );
  }

  return (
    <>
      <div className="cuadrantes-festivos-mobile solicitud-admin-mobile-list">
        {items.map((festivo) => {
          const inactive = festivo.active === 0;
          return (
            <article
              key={festivo.id}
              className={`cuadrantes-festivo-card app-card app-card--pad solicitud-admin-mobile-card${inactive ? ' opacity-60' : ''}`}
            >
              <div className="cuadrantes-festivo-card__head">
                <div>
                  <p className="cuadrantes-festivo-card__date">{formatFestivoDate(festivo)}</p>
                  <p className="cuadrantes-festivo-card__weekday capitalize">{formatFestivoWeekday(festivo)}</p>
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  <span className={`cuadrantes-badge ${inactive ? 'cuadrantes-badge--hidden' : 'cuadrantes-badge--visible'}`}>
                    {inactive ? 'Inactivo' : 'Activo'}
                  </span>
                </div>
              </div>
              <p className="cuadrantes-festivo-card__name">{festivo.name}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${getScopeBadgeClasses(festivo.scope)}`}>
                  {getScopeLabel(festivo.scope)}
                </span>
                {festivo.ccaa ? (
                  <span className="cuadrantes-badge">{CCAA_NAMES[festivo.ccaa] || festivo.ccaa}</span>
                ) : null}
              </div>
              {festivo.notes ? (
                <p className="text-xs text-gray-500 mt-2">{festivo.notes}</p>
              ) : null}
              <div className="cuadrantes-festivo-card__actions solicitud-admin-toolbar mt-3">
                <button type="button" className="solicitud-admin-btn" onClick={() => onCopyNextYear(festivo)} aria-label="Crear para el año siguiente">
                  <Copy className="w-4 h-4" aria-hidden />
                  <span>Siguiente año</span>
                </button>
                <button type="button" className="solicitud-admin-btn" onClick={() => onEdit(festivo)} aria-label="Editar festivo">
                  <Pencil className="w-4 h-4" aria-hidden />
                  <span>Editar</span>
                </button>
                <button type="button" className="solicitud-admin-btn solicitud-admin-btn--danger" onClick={() => onDelete(festivo)} aria-label="Eliminar festivo">
                  <Trash2 className="w-4 h-4" aria-hidden />
                  <span>Eliminar</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="cuadrantes-festivos-desktop solicitud-admin-table-wrap overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold">Día</th>
              <th className="px-4 py-3 text-left font-semibold">Festividad</th>
              <th className="px-4 py-3 text-left font-semibold">Ámbito</th>
              <th className="px-4 py-3 text-left font-semibold">Observaciones</th>
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map((festivo) => (
              <tr key={festivo.id} className={festivo.active === 0 ? 'opacity-60' : ''}>
                <td className="px-4 py-3 font-medium">{formatFestivoDate(festivo)}</td>
                <td className="px-4 py-3 capitalize text-gray-600">{formatFestivoWeekday(festivo)}</td>
                <td className="px-4 py-3">{festivo.name}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getScopeBadgeClasses(festivo.scope)}`}>
                      {getScopeLabel(festivo.scope)}
                    </span>
                    {festivo.ccaa ? (
                      <span className="cuadrantes-badge">{CCAA_NAMES[festivo.ccaa] || festivo.ccaa}</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{festivo.notes || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" className="solicitud-admin-btn" onClick={() => onCopyNextYear(festivo)} aria-label="Crear para el año siguiente">
                      <Copy className="w-4 h-4" aria-hidden />
                    </button>
                    <button type="button" className="solicitud-admin-btn" onClick={() => onEdit(festivo)} aria-label="Editar festivo">
                      <Pencil className="w-4 h-4" aria-hidden />
                    </button>
                    <Button variant="outlineDanger" className="h-9 w-9 rounded-full p-0" onClick={() => onDelete(festivo)} aria-label="Eliminar festivo">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
