import { SegmentedControl } from '../ui';
import ClientesRowActions from './ClientesRowActions';
import {
  ClientesEmptyState,
  ClientesLoadingState,
  ClientesStatusBadge,
} from './clientesUi';
import {
  formatFecha,
  formatLimiteGasto,
  getContactoPrincipal,
  getNombre,
  useIsMobile,
} from './clientesUi.utils';

function ClienteMobileRow({
  row,
  variant,
  onViewDetails,
  onEdit,
  onDelete,
}) {
  const nombre = getNombre(row);
  const contacto = getContactoPrincipal(row);
  const limite = formatLimiteGasto(row.CuantoPuedeGastar);
  const proxRenov = formatFecha(row['Fecha Proxima Renovacion']);

  return (
    <article className="app-card clientes-list-row">
      <div className="clientes-list-row__head">
        <div className="clientes-list-row__main">
          <h3 className="clientes-list-row__name">{nombre}</h3>
          <p className="clientes-list-row__meta">
            NIF:
            {' '}
            {row.NIF || '—'}
          </p>
          {contacto ? (
            <p className="clientes-list-row__contact">{contacto}</p>
          ) : null}
          {(limite || proxRenov) && variant === 'clientes' ? (
            <p className="clientes-list-row__summary">
              {limite ? `Límite: ${limite}` : null}
              {limite && proxRenov ? ' · ' : null}
              {proxRenov ? `Próx. renov.: ${proxRenov}` : null}
            </p>
          ) : null}
        </div>
        <ClientesStatusBadge row={row} compact />
      </div>
      <div className="clientes-list-row__actions">
        <ClientesRowActions
          onVerDetalle={() => onViewDetails(row)}
          onEditar={() => onEdit(row)}
          onEliminar={() => onDelete(row)}
        />
      </div>
    </article>
  );
}

function ClienteDesktopTable({
  rows,
  variant,
  density,
  onViewDetails,
  onEdit,
  onDelete,
}) {
  const py = density === 'compact' ? 'py-2' : 'py-3';
  const textSize = density === 'compact' ? 'text-[13px]' : '';

  return (
    <div className="clientes-table-wrap">
      <table className={`clientes-table ${textSize}`.trim()}>
        <thead>
          <tr>
            <th>Nombre / NIF</th>
            <th>Contacto</th>
            <th>Dirección</th>
            {variant === 'clientes' ? (
              <>
                <th>Contrato</th>
                <th>Límite</th>
              </>
            ) : (
              <th>Info</th>
            )}
            <th>Estado</th>
            <th className="clientes-table__actions-col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const nombre = getNombre(row);
            const limite = formatLimiteGasto(row.CuantoPuedeGastar);
            return (
              <tr
                key={row.id || row.NIF || index}
                className="clientes-table__row"
                onClick={() => onViewDetails(row)}
              >
                <td className={py}>
                  <div className="clientes-table__primary">{nombre}</div>
                  <div className="clientes-table__secondary">
                    NIF:
                    {' '}
                    {row.NIF || '—'}
                  </div>
                </td>
                <td className={py}>
                  <div className="clientes-table__secondary">{row.EMAIL || '—'}</div>
                  <div className="clientes-table__secondary">{row.TELEFONO || row.MOVIL || '—'}</div>
                </td>
                <td className={py}>
                  <div className="clientes-table__secondary">{row.DIRECCION || '—'}</div>
                  <div className="clientes-table__secondary">
                    {[row['CODIGO POSTAL'], row.POBLACION].filter(Boolean).join(' ') || '—'}
                  </div>
                </td>
                {variant === 'clientes' ? (
                  <>
                    <td className={py}>
                      <div className="clientes-table__secondary">
                        Últ.:
                        {' '}
                        {formatFecha(row['Fecha Ultima Renovacion']) || '—'}
                      </div>
                      <div className="clientes-table__secondary">
                        Próx.:
                        {' '}
                        {formatFecha(row['Fecha Proxima Renovacion']) || '—'}
                      </div>
                    </td>
                    <td className={py}>
                      <div className="clientes-table__secondary">{limite || '—'}</div>
                    </td>
                  </>
                ) : (
                  <td className={py}>
                    <div className="clientes-table__secondary">
                      Desc.:
                      {' '}
                      {row['DESCUENTO POR DEFECTO'] || '0'}%
                    </div>
                  </td>
                )}
                <td className={py}>
                  <ClientesStatusBadge row={row} compact />
                </td>
                <td className={`${py} clientes-table__actions-col`}>
                  <ClientesRowActions
                    onVerDetalle={() => onViewDetails(row)}
                    onEditar={() => onEdit(row)}
                    onEliminar={() => onDelete(row)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ClientesListSection({
  variant,
  rows,
  loading,
  tableView,
  onTableViewChange,
  density,
  onViewDetails,
  onEdit,
  onDelete,
}) {
  const isMobile = useIsMobile();
  const label = variant === 'clientes' ? 'clientes' : 'proveedores';
  const showCards = isMobile || tableView === 'compact';

  return (
    <section className="app-card clientes-list-section">
      <div className="clientes-list-section__head">
        <div>
          <h2 className="clientes-section-title">
            {variant === 'clientes' ? 'Clientes' : 'Proveedores'}
            {' '}
            (
            {rows.length}
            )
          </h2>
        </div>
        {!isMobile ? (
          <SegmentedControl
            value={tableView}
            onChange={onTableViewChange}
            items={[
              { id: 'detailed', label: 'Tabla', shortLabel: 'Tabla' },
              { id: 'compact', label: 'Compacto', shortLabel: 'Comp.' },
            ]}
          />
        ) : null}
      </div>

      {loading ? (
        <ClientesLoadingState label={`Cargando ${label}…`} />
      ) : rows.length === 0 ? (
        <ClientesEmptyState label={`No hay ${label} que coincidan con los criterios.`} />
      ) : showCards ? (
        <div className="clientes-list">
          {rows.map((row, index) => (
            <ClienteMobileRow
              key={row.id || row.NIF || index}
              row={row}
              variant={variant}
              onViewDetails={onViewDetails}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <ClienteDesktopTable
          rows={rows}
          variant={variant}
          density={density}
          onViewDetails={onViewDetails}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </section>
  );
}
