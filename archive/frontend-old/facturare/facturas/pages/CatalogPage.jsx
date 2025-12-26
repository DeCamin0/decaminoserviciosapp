import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Back3DButton from '../../../components/Back3DButton.jsx';
import { CatalogProvider } from '../contexts/CatalogContext';
import ProductList from '../components/ProductList';
import ProductListTable from '../components/ProductListTable';
import CategoryManager from '../components/CategoryManager';

const CatalogPage = () => {
  const [activeTab, setActiveTab] = useState('products');
  const navigate = useNavigate();

  // const handleGoBack = () => {
  //   navigate('/inicio-facturacion');
  // }; // Unused function

  return (
    <CatalogProvider>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header cu buton de revenire */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Back3DButton to="/inicio-facturacion" title="Volver al Inicio de Facturación" className="mr-4" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">Catálogo de Productos</h1>
                  <p className="text-gray-600 mt-2">Gestiona productos, categorías y stock</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-8">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('products')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'products'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Produse
                </button>
                <button
                  onClick={() => setActiveTab('lista-completa')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'lista-completa'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Lista Completă
                </button>
                <button
                  onClick={() => setActiveTab('categories')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'categories'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Categorii
                </button>
              </nav>
            </div>
          </div>

          {/* Content */}
          {activeTab === 'products' ? (
            <ProductList />
          ) : activeTab === 'lista-completa' ? (
            <ProductListTable />
          ) : (
            <CategoryManager />
          )}
        </div>
      </div>
    </CatalogProvider>
  );
};

export default CatalogPage;
