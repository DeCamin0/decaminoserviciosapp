import { useState, useMemo } from 'react';
import { Pencil, Save, X } from 'lucide-react';
import { AlertBanner } from '../ui';
import { getFormattedNombre } from '../../utils/employeeNameHelper';

function confianzaStatusClass(confianza) {
  switch (confianza) {
    case 2:
      return 'solicitud-status--ok';
    case 1:
      return 'solicitud-status--pendiente';
    case 0:
      return 'solicitud-status--anulada';
    default:
      return 'solicitud-status--neutral';
  }
}

function confianzaLabel(confianza) {
  switch (confianza) {
    case 2:
      return 'Confiado';
    case 1:
      return 'Incierto';
    case 0:
      return 'Fallido';
    default:
      return '—';
  }
}

export default function CorregirNombresTab({ users, onSave }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [confianzaFilter, setConfianzaFilter] = useState('all');
  const [editingCodigo, setEditingCodigo] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const filteredUsers = useMemo(() => {
    let filtered = users;

    if (confianzaFilter !== 'all') {
      const confianzaValue = parseInt(confianzaFilter, 10);
      filtered = filtered.filter((u) => (u.NOMBRE_SPLIT_CONFIANZA ?? 2) === confianzaValue);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((u) => {
        const nombre = getFormattedNombre(u).toLowerCase();
        const codigo = (u.CODIGO || '').toLowerCase();
        const nombreOriginal = (u['NOMBRE / APELLIDOS'] || '').toLowerCase();
        return nombre.includes(term) || codigo.includes(term) || nombreOriginal.includes(term);
      });
    }

    return filtered;
  }, [users, searchTerm, confianzaFilter]);

  const confiadoCount = filteredUsers.filter((u) => (u.NOMBRE_SPLIT_CONFIANZA ?? 2) === 2).length;
  const inciertoCount = filteredUsers.filter((u) => (u.NOMBRE_SPLIT_CONFIANZA ?? 2) === 1).length;
  const fallidoCount = filteredUsers.filter((u) => (u.NOMBRE_SPLIT_CONFIANZA ?? 2) === 0).length;

  const handleEdit = (user) => {
    setEditingCodigo(user.CODIGO);
    setEditData({
      NOMBRE: user.NOMBRE || '',
      APELLIDO1: user.APELLIDO1 || '',
      APELLIDO2: user.APELLIDO2 || '',
    });
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleCancel = () => {
    setEditingCodigo(null);
    setEditData({});
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSave = async (codigo) => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await onSave(codigo, editData);
      setSaveSuccess(true);
      setEditingCodigo(null);
      setEditData({});
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setSaveError(error.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="corregir-nombres-tab">
      <div className="app-card app-card--pad">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Corregir nombres separados</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          Corrige manualmente la separación de nombres cuando el algoritmo no funcionó correctamente.
        </p>
      </div>

      <div className="empleados-filter-bar app-card app-card--pad">
        <input
          type="search"
          id="corregir-nombres-search"
          name="corregir-nombres-search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por nombre, código…"
          aria-label="Buscar empleados"
        />
        <select
          id="corregir-nombres-confianza"
          name="corregir-nombres-confianza"
          value={confianzaFilter}
          onChange={(e) => setConfianzaFilter(e.target.value)}
          aria-label="Filtrar por confianza"
        >
          <option value="all">Todas las confianzas</option>
          <option value="0">Fallido</option>
          <option value="1">Incierto</option>
          <option value="2">Confiado</option>
        </select>
      </div>

      {saveSuccess && (
        <AlertBanner variant="success" compact>
          Campos actualizados correctamente
        </AlertBanner>
      )}
      {saveError && (
        <AlertBanner variant="danger" compact title="Error">
          {saveError}
        </AlertBanner>
      )}

      <div className="empleados-kpi-strip" role="group" aria-label="Resumen confianza">
        <div className="empleados-kpi empleados-kpi--static">
          <span className="empleados-kpi__value">{filteredUsers.length}</span>
          <span className="empleados-kpi__label">Total</span>
        </div>
        <div className="empleados-kpi empleados-kpi--static">
          <span className="empleados-kpi__value">{confiadoCount}</span>
          <span className="empleados-kpi__label">Confiado</span>
        </div>
        <div className="empleados-kpi empleados-kpi--static">
          <span className="empleados-kpi__value">{inciertoCount}</span>
          <span className="empleados-kpi__label">Incierto</span>
        </div>
        <div className="empleados-kpi empleados-kpi--static">
          <span className="empleados-kpi__value">{fallidoCount}</span>
          <span className="empleados-kpi__label">Fallido</span>
        </div>
      </div>

      <div className="corregir-nombres-table-wrap app-card">
        <div className="overflow-x-auto max-h-[min(70vh,36rem)]">
          <table className="corregir-nombres-table w-full text-sm">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre original</th>
                <th>Nombre</th>
                <th>Primer apellido</th>
                <th>Segundo apellido</th>
                <th>Confianza</th>
                <th>Preview</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-gray-500 py-8">
                    No se encontraron empleados
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isEditing = editingCodigo === user.CODIGO;
                  const previewNombre = isEditing
                    ? [editData.NOMBRE, editData.APELLIDO1, editData.APELLIDO2].filter((p) => p && p.trim()).join(' ')
                    : getFormattedNombre(user);
                  const confianza = user.NOMBRE_SPLIT_CONFIANZA ?? 2;

                  return (
                    <tr key={user.CODIGO}>
                      <td className="font-mono">{user.CODIGO}</td>
                      <td>{user['NOMBRE / APELLIDOS'] || '—'}</td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            id={`nombre-edit-${user.CODIGO}`}
                            value={editData.NOMBRE || ''}
                            onChange={(e) => setEditData((prev) => ({ ...prev, NOMBRE: e.target.value }))}
                            className="app-modal__input w-full min-w-[7rem]"
                            placeholder="Nombre"
                            aria-label={`Nombre para empleado ${user.CODIGO}`}
                          />
                        ) : (
                          <span className={user.NOMBRE ? '' : 'text-gray-400'}>{user.NOMBRE || '—'}</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            id={`apellido1-edit-${user.CODIGO}`}
                            value={editData.APELLIDO1 || ''}
                            onChange={(e) => setEditData((prev) => ({ ...prev, APELLIDO1: e.target.value }))}
                            className="app-modal__input w-full min-w-[7rem]"
                            placeholder="Primer apellido"
                            aria-label={`Primer apellido para empleado ${user.CODIGO}`}
                          />
                        ) : (
                          <span className={user.APELLIDO1 ? '' : 'text-gray-400'}>{user.APELLIDO1 || '—'}</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            id={`apellido2-edit-${user.CODIGO}`}
                            value={editData.APELLIDO2 || ''}
                            onChange={(e) => setEditData((prev) => ({ ...prev, APELLIDO2: e.target.value }))}
                            className="app-modal__input w-full min-w-[7rem]"
                            placeholder="Segundo apellido"
                            aria-label={`Segundo apellido para empleado ${user.CODIGO}`}
                          />
                        ) : (
                          <span className={user.APELLIDO2 ? '' : 'text-gray-400'}>{user.APELLIDO2 || '—'}</span>
                        )}
                      </td>
                      <td>
                        <span className={`solicitud-status ${confianzaStatusClass(confianza)}`}>
                          {confianzaLabel(confianza)}
                        </span>
                      </td>
                      <td className="font-medium">{previewNombre || '—'}</td>
                      <td>
                        {isEditing ? (
                          <div className="solicitud-admin-toolbar flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleSave(user.CODIGO)}
                              disabled={saving}
                              className="solicitud-admin-btn solicitud-admin-btn--primary"
                            >
                              <Save className="w-4 h-4" aria-hidden />
                              <span>{saving ? 'Guardando…' : 'Guardar'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleCancel}
                              disabled={saving}
                              className="solicitud-admin-btn"
                            >
                              <X className="w-4 h-4" aria-hidden />
                              <span>Cancelar</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleEdit(user)}
                            className="solicitud-admin-btn"
                          >
                            <Pencil className="w-4 h-4" aria-hidden />
                            <span>Editar</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
