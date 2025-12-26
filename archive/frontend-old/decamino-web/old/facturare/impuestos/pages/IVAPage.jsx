import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useImpuestos } from '../contexts/ImpuestosContext';
import { Card, Button, Select, Badge, Modal } from '../../../components/ui';
import { exportToExcelWithHeader } from '../../../utils/exportExcel';
import IVAForm from '../components/IVAForm';

const IVAPage = () => {
  const navigate = useNavigate();
  const { 
    filteredImpuestos, 
    addImpuesto, 
    updateImpuesto, 
    deleteImpuesto,
    setFilters,
    filters,
    loading 
  } = useImpuestos();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIVA, setEditingIVA] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);

  // Filter IVA declarations only
  const ivaDeclarations = filteredImpuestos.filter(imp => imp.type === 'IVA');

  const handleGoBack = () => {
    navigate('/impuestos');
  };

  const handleEdit = (iva) => {
    setEditingIVA(iva);
    setShowAddModal(true);
  };

  const handleDelete = (iva) => {
    setShowDeleteModal(iva);
  };

  const confirmDelete = async () => {
    if (showDeleteModal) {
      try {
        await deleteImpuesto(showDeleteModal.id);
        setShowDeleteModal(null);
      } catch (error) {
        console.error('Error deleting IVA declaration:', error);
      }
    }
  };

  const handleSave = async (ivaData) => {
    try {
      if (editingIVA) {
        await updateImpuesto(editingIVA.id, ivaData);
      } else {
        await addImpuesto({
          ...ivaData,
          type: 'IVA'
        });
      }
      setShowAddModal(false);
      setEditingIVA(null);
    } catch (error) {
      console.error('Error saving IVA declaration:', error);
    }
  };

  const handleCancel = () => {
    setShowAddModal(false);
    setEditingIVA(null);
  };

  const exportToExcel = async () => {
    const columns = [
      { key: 'model', label: 'Modelo', width: 10 },
      { key: 'period', label: 'Período', width: 15 },
      { key: 'year', label: 'Año', width: 10 },
      { key: 'status', label: 'Estado', width: 15 },
      { key: 'fechaPresentacion', label: 'Fecha Presentación', width: 20 },
      { key: 'fechaVencimiento', label: 'Fecha Vencimiento', width: 20 },
      { key: 'baseImponible', label: 'Base Imponible', width: 15, type: 'number' },
      { key: 'ivaRepercutido', label: 'IVA Repercutido', width: 15, type: 'number' },
      { key: 'ivaSoportado', label: 'IVA Soportado', width: 15, type: 'number' },
      { key: 'resultado', label: 'Resultado', width: 15, type: 'number' }
    ];

    const data = ivaDeclarations.map(iva => ({
      ...iva,
      fechaPresentacion: iva.fechaPresentacion ? new Date(iva.fechaPresentacion).toLocaleDateString('es-ES') : '',
      fechaVencimiento: iva.fechaVencimiento ? new Date(iva.fechaVencimiento).toLocaleDateString('es-ES') : '',
      baseImponible: iva.baseImponible?.toFixed(2) || '0.00',
      ivaRepercutido: iva.ivaRepercutido?.toFixed(2) || '0.00',
      ivaSoportado: iva.ivaSoportado?.toFixed(2) || '0.00',
      resultado: iva.resultado?.toFixed(2) || '0.00'
    }));

    await exportToExcelWithHeader(
      data, 
      columns, 
      'DECLARACIONES IVA', 
      'declaraciones_iva'
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'presentado':
        return 'bg-green-100 text-green-800';
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'vencido':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'presentado':
        return 'Presentado';
      case 'pendiente':
        return 'Pendiente';
      case 'vencido':
        return 'Vencido';
      default:
        return status;
    }
  };

  const getModelText = (model) => {
    switch (model) {
      case '303':
        return '303 - Trimestral';
      case '390':
        return '390 - Anual';
      default:
        return model;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <button
                onClick={handleGoBack}
                className="mr-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="Volver al Dashboard de Impuestos"
              >
                <span className="text-gray-600 text-lg">←</span>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">IVA (303, 390)</h1>
                <p className="text-gray-600 mt-2">Gestión de declaraciones de IVA trimestrales y anuales</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Año</label>
              <Select
                value={filters.year || ''}
                onChange={(e) => setFilters({ year: e.target.value ? parseInt(e.target.value) : '' })}
              >
                <option value="">Todos los años</option>
                {[2024, 2023, 2022, 2021, 2020].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Modelo</label>
              <Select
                value={filters.type || ''}
                onChange={(e) => setFilters({ type: e.target.value })}
              >
                <option value="">Todos los modelos</option>
                <option value="IVA">IVA</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
              <Select
                value={filters.status || ''}
                onChange={(e) => setFilters({ status: e.target.value })}
              >
                <option value="">Todos los estados</option>
                <option value="presentado">Presentado</option>
                <option value="pendiente">Pendiente</option>
                <option value="vencido">Vencido</option>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => setFilters({})}
                variant="outline"
                className="w-full"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              Declaraciones IVA ({ivaDeclarations.length})
            </h2>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={exportToExcel}
              variant="outline"
              className="text-green-700 border-green-300 hover:bg-green-50"
            >
              📊 Exportar Excel
            </Button>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              📝 Nueva Declaración
            </Button>
          </div>
        </div>

        {/* IVA Declarations List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ivaDeclarations.map(iva => (
            <Card key={iva.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getStatusColor(iva.status)}>
                      {getStatusText(iva.status)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {getModelText(iva.model)}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {iva.period} {iva.year}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    {iva.notes || 'Sin observaciones'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Base Imponible:</span>
                  <span className="font-medium">€{iva.baseImponible?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">IVA Repercutido:</span>
                  <span className="font-medium">€{iva.ivaRepercutido?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">IVA Soportado:</span>
                  <span className="font-medium">€{iva.ivaSoportado?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span className="text-gray-800">Resultado:</span>
                  <span className={`${iva.resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{iva.resultado?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleEdit(iva)}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  ✏️ Editar
                </Button>
                <Button
                  onClick={() => handleDelete(iva)}
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  🗑️ Eliminar
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {ivaDeclarations.length === 0 && (
          <Card className="p-12 text-center">
            <div className="text-gray-500">
              <span className="text-4xl mb-4 block">📊</span>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay declaraciones IVA</h3>
              <p className="text-gray-600">Crea tu primera declaración de IVA haciendo clic en &quot;Nueva Declaración&quot;</p>
            </div>
          </Card>
        )}

        {/* Add/Edit Modal */}
        <Modal isOpen={showAddModal} onClose={handleCancel} size="4xl">
          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingIVA ? 'Editar Declaración IVA' : 'Nueva Declaración IVA'}
            </h2>
            
            <IVAForm
              iva={editingIVA}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal isOpen={!!showDeleteModal} onClose={() => setShowDeleteModal(null)} size="md">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confirmar Eliminación</h2>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que quieres eliminar la declaración de IVA &quot;{showDeleteModal?.period} {showDeleteModal?.year}&quot;?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => setShowDeleteModal(null)}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Eliminar
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default IVAPage;
