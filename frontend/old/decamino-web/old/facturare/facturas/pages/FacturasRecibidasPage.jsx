import { useNavigate } from 'react-router-dom';
import Back3DButton from '../../../components/Back3DButton.jsx';
import { FacturasRecibidasProvider } from '../contexts/FacturasRecibidasContext';
import FacturasRecibidasList from '../components/FacturasRecibidasList';

const FacturasRecibidasPage = () => {
  const navigate = useNavigate();

  // const handleGoBack = () => {
  //   navigate('/inicio-facturacion');
  // }; // Unused function

  return (
    <FacturasRecibidasProvider>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header cu buton de revenire */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Back3DButton to="/inicio-facturacion" title="Volver al Inicio de Facturación" className="mr-4" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">Facturas Recibidas</h1>
                  <p className="text-gray-600 mt-2">Gestiona facturile primite de la furnizori</p>
                </div>
              </div>
            </div>
          </div>

          <FacturasRecibidasList />
        </div>
      </div>
    </FacturasRecibidasProvider>
  );
};

export default FacturasRecibidasPage;
