import { useState, useMemo } from 'react';
import { getFormattedNombre } from '../../utils/employeeNameHelper';

export default function CorregirNombresTab({ users, onSave }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [confianzaFilter, setConfianzaFilter] = useState('all'); // 'all' | '0' | '1' | '2'
  const [editingCodigo, setEditingCodigo] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Filtrează utilizatorii
  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Filtrare după confianza
    if (confianzaFilter !== 'all') {
      const confianzaValue = parseInt(confianzaFilter);
      filtered = filtered.filter(u => (u.NOMBRE_SPLIT_CONFIANZA ?? 2) === confianzaValue);
    }

    // Filtrare după căutare
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(u => {
        const nombre = getFormattedNombre(u).toLowerCase();
        const codigo = (u.CODIGO || '').toLowerCase();
        const nombreOriginal = (u['NOMBRE / APELLIDOS'] || '').toLowerCase();
        return nombre.includes(term) || codigo.includes(term) || nombreOriginal.includes(term);
      });
    }

    return filtered;
  }, [users, searchTerm, confianzaFilter]);

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

  const getConfianzaBadge = (confianza) => {
    switch (confianza) {
      case 2:
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">✅ Confiado</span>;
      case 1:
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">⚠️ Incierto</span>;
      case 0:
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">❌ Fallido</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">-</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
        <h2 className="text-xl font-bold text-gray-900 mb-2">✏️ Corregir Nombres Separados</h2>
        <p className="text-sm text-gray-600">
          Corrige manualmente la separación de nombres para empleados donde el algoritmo no funcionó correctamente.
        </p>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="corregir-nombres-search" className="block text-sm font-medium text-gray-700 mb-2">🔍 Buscar</label>
          <input
            type="text"
            id="corregir-nombres-search"
            name="corregir-nombres-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, código..."
            className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <div>
          <label htmlFor="corregir-nombres-confianza" className="block text-sm font-medium text-gray-700 mb-2">📊 Filtrar por Confianza</label>
          <select
            id="corregir-nombres-confianza"
            name="corregir-nombres-confianza"
            value={confianzaFilter}
            onChange={(e) => setConfianzaFilter(e.target.value)}
            className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="all">Todos</option>
            <option value="0">❌ Fallido</option>
            <option value="1">⚠️ Incierto</option>
            <option value="2">✅ Confiado</option>
          </select>
        </div>
      </div>

      {/* Mensaje de éxito */}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          ✅ Campos actualizados correctamente
        </div>
      )}

      {/* Mensaje de error */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          ❌ {saveError}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-500 to-purple-600 text-white sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-bold">Código</th>
                <th className="px-4 py-3 text-left font-bold">Nombre Original</th>
                <th className="px-4 py-3 text-left font-bold">Nombre</th>
                <th className="px-4 py-3 text-left font-bold">Primer Apellido</th>
                <th className="px-4 py-3 text-left font-bold">Segundo Apellido</th>
                <th className="px-4 py-3 text-left font-bold">Confianza</th>
                <th className="px-4 py-3 text-left font-bold">Preview</th>
                <th className="px-4 py-3 text-left font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    No se encontraron empleados
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isEditing = editingCodigo === user.CODIGO;
                  const previewNombre = isEditing
                    ? [editData.NOMBRE, editData.APELLIDO1, editData.APELLIDO2].filter(p => p && p.trim()).join(' ')
                    : getFormattedNombre(user);

                  return (
                    <tr key={user.CODIGO} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm">{user.CODIGO}</td>
                      <td className="px-4 py-3">{user['NOMBRE / APELLIDOS'] || '-'}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <>
                            <label htmlFor={`nombre-edit-${user.CODIGO}`} className="sr-only">Nombre para {user.CODIGO}</label>
                            <input
                              type="text"
                              id={`nombre-edit-${user.CODIGO}`}
                              name={`nombre-edit-${user.CODIGO}`}
                              value={editData.NOMBRE || ''}
                              onChange={(e) => setEditData(prev => ({ ...prev, NOMBRE: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Nombre"
                              aria-label={`Nombre para empleado ${user.CODIGO}`}
                            />
                          </>
                        ) : (
                          <span className={user.NOMBRE ? '' : 'text-gray-400'}>
                            {user.NOMBRE || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <>
                            <label htmlFor={`apellido1-edit-${user.CODIGO}`} className="sr-only">Primer Apellido para {user.CODIGO}</label>
                            <input
                              type="text"
                              id={`apellido1-edit-${user.CODIGO}`}
                              name={`apellido1-edit-${user.CODIGO}`}
                              value={editData.APELLIDO1 || ''}
                              onChange={(e) => setEditData(prev => ({ ...prev, APELLIDO1: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Primer Apellido"
                              aria-label={`Primer Apellido para empleado ${user.CODIGO}`}
                            />
                          </>
                        ) : (
                          <span className={user.APELLIDO1 ? '' : 'text-gray-400'}>
                            {user.APELLIDO1 || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <>
                            <label htmlFor={`apellido2-edit-${user.CODIGO}`} className="sr-only">Segundo Apellido para {user.CODIGO}</label>
                            <input
                              type="text"
                              id={`apellido2-edit-${user.CODIGO}`}
                              name={`apellido2-edit-${user.CODIGO}`}
                              value={editData.APELLIDO2 || ''}
                              onChange={(e) => setEditData(prev => ({ ...prev, APELLIDO2: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Segundo Apellido"
                              aria-label={`Segundo Apellido para empleado ${user.CODIGO}`}
                            />
                          </>
                        ) : (
                          <span className={user.APELLIDO2 ? '' : 'text-gray-400'}>
                            {user.APELLIDO2 || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {getConfianzaBadge(user.NOMBRE_SPLIT_CONFIANZA ?? 2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">{previewNombre || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSave(user.CODIGO)}
                              disabled={saving}
                              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm"
                            >
                              {saving ? 'Guardando...' : '💾 Guardar'}
                            </button>
                            <button
                              onClick={handleCancel}
                              disabled={saving}
                              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 text-sm"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(user)}
                            className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
                          >
                            ✏️ Editar
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

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="text-sm text-gray-600">Total</div>
          <div className="text-2xl font-bold text-gray-900">{filteredUsers.length}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-xl border border-green-200">
          <div className="text-sm text-green-600">✅ Confiado</div>
          <div className="text-2xl font-bold text-green-700">
            {filteredUsers.filter(u => (u.NOMBRE_SPLIT_CONFIANZA ?? 2) === 2).length}
          </div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
          <div className="text-sm text-yellow-600">⚠️ Incierto</div>
          <div className="text-2xl font-bold text-yellow-700">
            {filteredUsers.filter(u => (u.NOMBRE_SPLIT_CONFIANZA ?? 2) === 1).length}
          </div>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-200">
          <div className="text-sm text-red-600">❌ Fallido</div>
          <div className="text-2xl font-bold text-red-700">
            {filteredUsers.filter(u => (u.NOMBRE_SPLIT_CONFIANZA ?? 2) === 0).length}
          </div>
        </div>
      </div>
    </div>
  );
}

