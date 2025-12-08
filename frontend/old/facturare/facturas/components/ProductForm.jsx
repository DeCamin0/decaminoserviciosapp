import { useState, useEffect } from 'react';
import { useCatalog } from '../contexts/CatalogContext';
import { Button, Input, Select, Card, Separator } from '../../../components/ui';

const ProductForm = ({ product = null, onSave, onCancel }) => {
  const { categories, addProduct, updateProduct } = useCatalog();
  
  const [formData, setFormData] = useState({
    cod: '',
    name: '',
    description: '',
    categoryId: '',
    price: '',
    currency: 'EUR',
    unit: '',
    stock: '',
    minStock: '',
    maxStock: '',
    active: true
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (product) {
      setFormData({
        cod: product.cod || '',
        name: product.name || '',
        description: product.description || '',
        categoryId: product.categoryId || '',
        price: product.price || '',
        currency: product.currency || 'EUR',
        unit: product.unit || '',
        stock: product.stock !== null ? product.stock : '',
        minStock: product.minStock !== null ? product.minStock : '',
        maxStock: product.maxStock !== null ? product.maxStock : '',
        active: product.active !== undefined ? product.active : true
      });
    }
  }, [product]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.cod.trim()) {
      newErrors.cod = 'Codul produsului este obligatoriu';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Numele produsului este obligatoriu';
    }

    if (!formData.categoryId) {
      newErrors.categoryId = 'Categoria este obligatorie';
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      newErrors.price = 'Prețul trebuie să fie mai mare decât 0';
    }

    if (!formData.unit.trim()) {
      newErrors.unit = 'Unitatea de măsură este obligatorie';
    }

    // Validate stock values
    if (formData.stock !== '' && parseFloat(formData.stock) < 0) {
      newErrors.stock = 'Stocul nu poate fi negativ';
    }

    if (formData.minStock !== '' && parseFloat(formData.minStock) < 0) {
      newErrors.minStock = 'Stocul minim nu poate fi negativ';
    }

    if (formData.maxStock !== '' && parseFloat(formData.maxStock) < 0) {
      newErrors.maxStock = 'Stocul maxim nu poate fi negativ';
    }

    if (formData.minStock !== '' && formData.maxStock !== '') {
      if (parseFloat(formData.minStock) > parseFloat(formData.maxStock)) {
        newErrors.maxStock = 'Stocul maxim trebuie să fie mai mare decât minimul';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        stock: formData.stock !== '' ? parseFloat(formData.stock) : null,
        minStock: formData.minStock !== '' ? parseFloat(formData.minStock) : null,
        maxStock: formData.maxStock !== '' ? parseFloat(formData.maxStock) : null,
        category: categories.find(c => c.id === parseInt(formData.categoryId))?.name || ''
      };

      if (product) {
        await updateProduct(product.id, productData);
      } else {
        await addProduct(productData);
      }

      onSave();
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const isService = formData.categoryId && 
    categories.find(c => c.id === parseInt(formData.categoryId))?.name === 'Servicii';

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {product ? 'Editar Producto' : 'Añadir Producto Nuevo'}
        </h2>
        <Button
          variant="outline"
          onClick={onCancel}
          className="text-gray-600"
        >
          Anulează
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cod Produs *
            </label>
            <Input
              value={formData.cod}
              onChange={(e) => handleInputChange('cod', e.target.value)}
              placeholder="ex: PROD001"
              className={errors.cod ? 'border-red-500' : ''}
            />
            {errors.cod && (
              <p className="text-red-500 text-sm mt-1">{errors.cod}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nume Produs *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Numele produsului"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descriere
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Descrierea produsului"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        <Separator />

        {/* Category and Pricing */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categorie *
            </label>
            <Select
              value={formData.categoryId}
              onChange={(e) => handleInputChange('categoryId', e.target.value)}
              className={errors.categoryId ? 'border-red-500' : ''}
            >
              <option value="">Selectează categoria</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            {errors.categoryId && (
              <p className="text-red-500 text-sm mt-1">{errors.categoryId}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preț *
            </label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => handleInputChange('price', e.target.value)}
                placeholder="0.00"
                className={errors.price ? 'border-red-500 pr-16' : 'pr-16'}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <Select
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  className="border-0 bg-transparent text-gray-500"
                >
                  <option value="EUR">EUR</option>
                  <option value="RON">RON</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
            </div>
            {errors.price && (
              <p className="text-red-500 text-sm mt-1">{errors.price}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unitate de Măsură *
            </label>
            <Input
              value={formData.unit}
              onChange={(e) => handleInputChange('unit', e.target.value)}
              placeholder="ex: bucată, oră, kg"
              className={errors.unit ? 'border-red-500' : ''}
            />
            {errors.unit && (
              <p className="text-red-500 text-sm mt-1">{errors.unit}</p>
            )}
          </div>
        </div>

        {/* Stock Management - Only for products, not services */}
        {!isService && (
          <>
            <Separator />
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Gestionare Stoc
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stoc Actual
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => handleInputChange('stock', e.target.value)}
                    placeholder="0"
                  />
                  {errors.stock && (
                    <p className="text-red-500 text-sm mt-1">{errors.stock}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stoc Minim
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.minStock}
                    onChange={(e) => handleInputChange('minStock', e.target.value)}
                    placeholder="0"
                  />
                  {errors.minStock && (
                    <p className="text-red-500 text-sm mt-1">{errors.minStock}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stoc Maxim
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.maxStock}
                    onChange={(e) => handleInputChange('maxStock', e.target.value)}
                    placeholder="0"
                  />
                  {errors.maxStock && (
                    <p className="text-red-500 text-sm mt-1">{errors.maxStock}</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Status */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="active"
            checked={formData.active}
            onChange={(e) => handleInputChange('active', e.target.checked)}
            className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
          />
          <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
            Produs activ
          </label>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="px-6"
          >
            Anulează
          </Button>
          <Button
            type="submit"
            className="px-6 bg-red-600 hover:bg-red-700"
          >
            {product ? 'Actualizar' : 'Añadir'} Producto
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default ProductForm;
