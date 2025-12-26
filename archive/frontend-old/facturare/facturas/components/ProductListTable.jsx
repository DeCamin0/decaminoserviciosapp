import React, { useState } from 'react';
import { useCatalog } from '../contexts/CatalogContext';
import { Button, Input, Select, Card, Badge } from '../../../components/ui';
import { exportToExcelWithHeader } from '../../../utils/exportExcel';

const ProductListTable = () => {
  const { 
    products, 
    categories, 
    filters, 
    setFilters, 
    resetFilters,
    deleteProduct,
    refreshFromWebhook,
    loading 
  } = useCatalog();

  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  // Sorting function
  const sortedProducts = [...products].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];
    
    // Handle null values
    if (aValue === null) aValue = '';
    if (bValue === null) bValue = '';
    
    // Handle numbers
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    // Handle strings
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue);
    }
    
    return 0;
  });

  // Filtered products - show all products by default, apply filters only when needed
  const filteredProducts = sortedProducts.filter(product => {
    // If no filters are applied, show all products
    if (!filters.search && !filters.category && !filters.inStock) {
      return true;
    }
    
    const matchesSearch = !filters.search || 
      product.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      product.cod.toLowerCase().includes(filters.search.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(filters.search.toLowerCase()));
    
    const matchesCategory = !filters.category || 
      product.categoryId === parseInt(filters.category);
    
    const matchesStock = !filters.inStock || 
      (product.stock !== null && product.stock > 0);
    
    return matchesSearch && matchesCategory && matchesStock;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
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

  const exportToExcel = async () => {
    const columns = [
      { key: 'cod', label: 'Cod', width: 15 },
      { key: 'name', label: 'Nume Produs', width: 35 },
      { key: 'description', label: 'Descriere', width: 40 },
      { key: 'category', label: 'Categorie', width: 25 },
      { key: 'price', label: 'Preț', width: 15, type: 'number' },
      { key: 'currency', label: 'Monedă', width: 10 },
      { key: 'unit', label: 'Unitate', width: 15 },
      { key: 'stock', label: 'Stoc', width: 12, type: 'number' },
      { key: 'minStock', label: 'Stoc Min', width: 12, type: 'number' },
      { key: 'maxStock', label: 'Stoc Max', width: 12, type: 'number' },
      { key: 'pvp', label: 'P.V.P.', width: 15, type: 'number' },
      { key: 'iva', label: 'IVA %', width: 10, type: 'number' },
      { key: 'cost', label: 'Cost', width: 15, type: 'number' },
      { key: 'active', label: 'Activ', width: 10 }
    ];

    const data = filteredProducts.map(product => ({
      ...product,
      active: product.active ? 'Da' : 'Nu',
      stock: product.stock !== null ? product.stock : 'N/A',
      minStock: product.minStock !== null ? product.minStock : 'N/A',
      maxStock: product.maxStock !== null ? product.maxStock : 'N/A',
      cost: product.cost !== null ? product.cost : 'N/A'
    }));

    await exportToExcelWithHeader(
      data, 
      columns, 
      'LISTA COMPLETA PRODUSE', 
      'lista_completa_produse'
    );
  };

  const getStockStatus = (product) => {
    if (product.stock === null) return null;
    
    if (product.stock <= 0) {
      return <Badge variant="destructive">Epuizat</Badge>;
    }
    
    if (product.minStock && product.stock <= product.minStock) {
      return <Badge variant="destructive">Scăzut</Badge>;
    }
    
    return <Badge variant="success">În stoc</Badge>;
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  // Debug logging
  console.log('ProductListTable Debug:', {
    totalProducts: products.length,
    sortedProducts: sortedProducts.length,
    filteredProducts: filteredProducts.length,
    filters,
    sortField,
    sortDirection
  });

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
          <h1 className="text-3xl font-bold text-gray-900">Lista Completă Produse</h1>
          <p className="text-gray-600 mt-2">
            Vizualizează toate produsele într-un format de tabel compact
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={exportToExcel}
            variant="outline"
            className="text-gray-700"
          >
            📊 Export Excel
          </Button>
          <Button
            onClick={async () => {
              try {
                await refreshFromWebhook();
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
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{products.length}</div>
          <div className="text-sm text-gray-600">Total Produse</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {products.filter(p => p.active).length}
          </div>
          <div className="text-sm text-gray-600">Active</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {products.filter(p => p.stock !== null && p.stock > 0).length}
          </div>
          <div className="text-sm text-gray-600">În Stoc</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-red-600">
            {products.filter(p => p.stock !== null && p.stock <= 0).length}
          </div>
          <div className="text-sm text-gray-600">Epuizate</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Căutare
            </label>
            <Input
              placeholder="Caută după nume, cod, descriere..."
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

      {/* Products Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('cod')}
                >
                  <div className="flex items-center gap-2">
                    Cod {getSortIcon('cod')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Nume Produs {getSortIcon('name')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center gap-2">
                    Categorie {getSortIcon('category')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('price')}
                >
                  <div className="flex items-center gap-2">
                    Preț {getSortIcon('price')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('stock')}
                >
                  <div className="flex items-center gap-2">
                    Stoc {getSortIcon('stock')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('pvp')}
                >
                  <div className="flex items-center gap-2">
                    P.V.P. {getSortIcon('pvp')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {product.cod}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {product.name}
                      </div>
                      {product.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {product.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className="bg-gray-100 text-gray-800">
                      {product.category}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-right">
                      <div className="font-medium">€{product.price.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">
                        {product.currency} / {product.unit}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.stock !== null ? (
                      <div className="text-right">
                        <div className="font-medium">{product.stock}</div>
                        {product.minStock && (
                          <div className="text-xs text-gray-500">Min: {product.minStock}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">Serviciu</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-right">
                      <div className="font-medium">€{product.pvp.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">IVA: {product.iva}%</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      {getStockStatus(product)}
                      {!product.active && (
                        <Badge variant="outline" className="text-xs">Inactiv</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Button
                      onClick={() => handleDelete(product)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="p-12 text-center">
            <div className="text-gray-500">
              {products.length === 0 ? (
                <>
                  <p className="text-lg mb-2">Nu sunt produse încărcate</p>
                  <p className="text-sm mb-4">
                    Nu s-au încărcat produse de la webhook sau nu există produse în catalog
                  </p>
                  <Button
                    onClick={async () => {
                      try {
                        await refreshFromWebhook();
                        alert('Produsele au fost reîncărcate cu succes de la webhook!');
                      } catch (error) {
                        alert('Eroare la reîncărcarea produselor: ' + error.message);
                      }
                    }}
                    variant="outline"
                    className="text-blue-700 border-blue-300 hover:bg-blue-50"
                  >
                    🔄 Intenta de nuevo cargar desde Webhook
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-lg mb-2">Nu s-au găsit produse cu filtrele actuale</p>
                  <p className="text-sm">
                    Intenta modificar los filtros o resetear todos los filtros
                  </p>
                  <Button
                    onClick={resetFilters}
                    variant="outline"
                    className="mt-2"
                  >
                    Resetează Toate Filtrele
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
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
        </div>
      )}
    </div>
  );
};

export default ProductListTable;
