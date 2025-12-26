import React, { useState } from 'react';
import { useCatalog } from '../contexts/CatalogContext';
import { Button, Input, Select, Card, Badge, Modal } from '../../../components/ui';
import ProductForm from './ProductForm';
import { exportToExcelWithHeader } from '../../../utils/exportExcel';

const ProductList = () => {
  const { 
    filteredProducts, 
    categories, 
    filters, 
    setFilters, 
    resetFilters,
    deleteProduct,
    refreshFromWebhook,
    loading 
  } = useCatalog();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);

  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowAddModal(true);
  };

  const handleDelete = (product) => {
    setShowDeleteModal(product);
  };

  const confirmDelete = async () => {
    if (showDeleteModal) {
      try {
        await deleteProduct(showDeleteModal.id);
        setShowDeleteModal(null);
      } catch (error) {
        console.error('Error deleting product:', error);
      }
    }
  };

  const handleSave = () => {
    setShowAddModal(false);
    setEditingProduct(null);
  };

  const handleCancel = () => {
    setShowAddModal(false);
    setEditingProduct(null);
  };

  const exportToExcel = async () => {
    const columns = [
      { key: 'cod', label: 'Cod', width: 15 },
      { key: 'name', label: 'Nume Produs', width: 30 },
      { key: 'description', label: 'Descriere', width: 40 },
      { key: 'category', label: 'Categorie', width: 20 },
      { key: 'price', label: 'Preț', width: 15, type: 'number' },
      { key: 'currency', label: 'Monedă', width: 10 },
      { key: 'unit', label: 'Unitate', width: 15 },
      { key: 'stock', label: 'Stoc', width: 12, type: 'number' },
      { key: 'minStock', label: 'Stoc Min', width: 12, type: 'number' },
      { key: 'maxStock', label: 'Stoc Max', width: 12, type: 'number' },
      { key: 'active', label: 'Activ', width: 10 }
    ];

    const data = filteredProducts.map(product => ({
      ...product,
      active: product.active ? 'Da' : 'Nu',
      stock: product.stock !== null ? product.stock : 'N/A',
      minStock: product.minStock !== null ? product.minStock : 'N/A',
      maxStock: product.maxStock !== null ? product.maxStock : 'N/A'
    }));

    await exportToExcelWithHeader(
      data, 
      columns, 
      'CATALOG PRODUSE', 
      'catalog_produse'
    );
  };

  const getStockStatus = (product) => {
    if (product.stock === null) return null; // Service
    
    if (product.stock <= 0) {
      return <Badge variant="destructive">Stoc epuizat</Badge>;
    }
    
    if (product.minStock && product.stock <= product.minStock) {
      return <Badge variant="destructive">Stoc scăzut</Badge>;
    }
    
    if (product.maxStock && product.stock >= product.maxStock) {
      return <Badge variant="success">Stoc optim</Badge>;
    }
    
    return <Badge variant="success">În stoc</Badge>;
  };

  const getCategoryColor = (categoryName) => {
    switch (categoryName) {
      case 'Servicii':
        return 'bg-blue-100 text-blue-800';
      case 'Produse':
        return 'bg-green-100 text-green-800';
      case 'Consumabile':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catalog Produse</h1>
          <p className="text-gray-600 mt-2">
            Gestionează produsele și serviciile din catalog
          </p>
        </div>
                 <div className="flex gap-3">
           <Button
             onClick={exportToExcel}
             variant="outline"
             className="text-gray-700"
           >
             Export Excel
           </Button>
           <Button
             onClick={async () => {
               try {
                 await refreshFromWebhook();
                 // Show success message
                 alert('Produsele au fost reîncărcate cu succes de la webhook!');
               } catch (error) {
                 alert('Eroare la reîncărcarea produselor: ' + error.message);
               }
             }}
             variant="outline"
             className="text-blue-700 border-blue-300 hover:bg-blue-50"
           >
             🔄 Refresh Webhook
           </Button>
           <Button
             onClick={() => setShowAddModal(true)}
             className="bg-red-600 hover:bg-red-700"
           >
             Añadir Producto
           </Button>
         </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Căutare
            </label>
            <Input
              placeholder="Caută după nume sau cod..."
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categorie
            </label>
            <Select
              value={filters.category}
              onChange={(e) => setFilters({ category: e.target.value })}
            >
              <option value="">Toate categoriile</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.inStock}
                onChange={(e) => setFilters({ inStock: e.target.checked })}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">
                Doar în stoc
              </span>
            </label>
          </div>

          <div className="flex items-end">
            <Button
              onClick={resetFilters}
              variant="outline"
              className="w-full"
            >
              Resetează Filtrele
            </Button>
          </div>
        </div>
      </Card>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map(product => (
          <Card key={product.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getCategoryColor(product.category)}>
                    {product.category}
                  </Badge>
                  {!product.active && (
                    <Badge variant="outline">Inactiv</Badge>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {product.name}
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  Cod: {product.cod}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-red-600">
                  {product.price.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">
                  {product.currency} / {product.unit}
                </div>
              </div>
            </div>

            {product.description && (
              <p className="text-gray-700 text-sm mb-4 line-clamp-2">
                {product.description}
              </p>
            )}

            {/* Stock Information */}
            {product.stock !== null && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Stoc:</span>
                  {getStockStatus(product)}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                  <div>Actual: {product.stock}</div>
                  {product.minStock && <div>Min: {product.minStock}</div>}
                  {product.maxStock && <div>Max: {product.maxStock}</div>}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-gray-200">
              <Button
                onClick={() => handleEdit(product)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Editar
              </Button>
              <Button
                onClick={() => handleDelete(product)}
                variant="outline"
                size="sm"
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                Eliminar
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <Card className="p-12 text-center">
          <div className="text-gray-500">
            <p className="text-lg mb-2">Nu s-au găsit produse</p>
            <p className="text-sm">
              Intenta modificar los filtros o añadir un producto nuevo
            </p>
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={handleCancel}
        size="4xl"
      >
        <ProductForm
          product={editingProduct}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteModal}
        onClose={() => setShowDeleteModal(null)}
        size="md"
      >
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Confirmar eliminación
          </h3>
          <p className="text-gray-600 mb-6">
            Ești sigur că vrei să ștergi produsul &quot;{showDeleteModal?.name}&quot;? 
            Această acțiune nu poate fi anulată.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(null)}
            >
              Anulează
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
  );
};

export default ProductList;
