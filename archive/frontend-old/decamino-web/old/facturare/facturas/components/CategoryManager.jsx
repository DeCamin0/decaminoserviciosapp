import { useState } from 'react';
import { useCatalog } from '../contexts/CatalogContext';
import { Button, Input, Card, Modal, Badge } from '../../../components/ui';

const CategoryManager = () => {
  const { categories, addCategory, updateCategory, deleteCategory } = useCatalog();
  
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, formData);
      } else {
        await addCategory(formData);
      }
      
      handleClose();
    } catch (error) {
      console.error('Error saving category:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Numele categoriei este obligatoriu';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({ name: category.name, description: category.description || '' });
    setShowModal(true);
  };

  const handleDelete = async (categoryId) => {
    if (window.confirm('Ești sigur că vrei să ștergi această categorie?')) {
      try {
        await deleteCategory(categoryId);
      } catch (error) {
        console.error('Error deleting category:', error);
      }
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({ name: '', description: '' });
    setErrors({});
  };

  const handleAddNew = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '' });
    setErrors({});
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestionare Categorii</h2>
          <p className="text-gray-600 mt-2">
            Gestionează categoriile de produse și servicii
          </p>
        </div>
        <Button onClick={handleAddNew} className="bg-red-600 hover:bg-red-700">
          Añadir Categoría
        </Button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map(category => (
          <Card key={category.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="text-gray-600 text-sm">
                    {category.description}
                  </p>
                )}
              </div>
              <Badge variant="outline" className="ml-2">
                {category.id}
              </Badge>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-gray-200">
              <Button
                onClick={() => handleEdit(category)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Editar
              </Button>
              <Button
                onClick={() => handleDelete(category.id)}
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

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleClose}
        size="md"
      >
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {editingCategory ? 'Editar Categoría' : 'Añadir Categoría Nueva'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nume Categorie *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="ex: Servicii, Produse, Consumabile"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descriere
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrierea categoriei (opțional)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                Anulează
              </Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700"
              >
                {editingCategory ? 'Actualizar' : 'Añadir'} Categoría
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};

export default CategoryManager;
