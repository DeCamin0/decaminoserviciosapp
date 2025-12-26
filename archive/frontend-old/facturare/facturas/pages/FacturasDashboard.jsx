
import { Link, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { GastosProvider, useGastos } from '../../gastos/contexts/GastosContext';
import PeriodoSelector from '../../../components/PeriodoSelector';
import { usePeriodo } from '../../../contexts/PeriodoContext';
import { FacturasProvider, useFacturas } from '../contexts/FacturasContext';

const FacturasInicioContent = () => {
  const navigate = useNavigate();
  
  // Statistici reale din facturi
  const { getFacturasStats } = useFacturas();
  const facturasStats = getFacturasStats();

  // Statistici reale pentru gastos din context
  const { getGastosStats, gastos } = useGastos();
  const gastosStats = getGastosStats();
  // const { from, to } = usePeriodo(); // Unused variables
  const uniqueFurnizori = useMemo(() => {
    const uniqueKeys = new Set();
    (gastos || []).forEach((g) => {
      const cif = (g?.processedData?.nif || g?.cif || '').toString().trim().toUpperCase();
      const proveedor = (g?.processedData?.proveedor || '').toString().trim().toUpperCase();
      if (cif) uniqueKeys.add(cif);
      else if (proveedor) uniqueKeys.add(proveedor);
    });
    return uniqueKeys.size;
  }, [gastos]);

  return (
    <div className="space-y-6">
      {/* Header principal cu buton regresar */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/inicio')}
              className="mr-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Regresar al Inicio"
            >
              <span className="text-gray-600 text-lg">←</span>
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Inicio de Facturación</h1>
              <p className="text-gray-600 mt-2">Centro de control para facturación y gastos</p>
            </div>
            <div className="ml-4"><PeriodoSelector /></div>
          </div>
          <div className="text-sm text-gray-500">
            Sistema completo de gestión financiera
          </div>
        </div>

        {/* Banner En Desarrollo */}
        <div
          className="relative overflow-hidden rounded-lg border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4 shadow-inner mb-6"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(251,191,36,0.15) 0, rgba(251,191,36,0.15) 10px, rgba(253,230,138,0.15) 10px, rgba(253,230,138,0.15) 20px)'
          }}
        >
          <div className="flex items-center gap-3">
            <div className="text-2xl animate-bounce">🚧</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-orange-700 font-extrabold tracking-tight">
                  Página en construcción · En desarrollo
                </h2>
                <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700 border border-orange-300">
                  Beta
                </span>
              </div>
              <p className="text-sm text-orange-700/80">
                Estamos mejorando esta sección. Algunas funciones pueden no estar disponibles temporalmente.
              </p>
            </div>
          </div>
        </div>

        {/* Statistici generale */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <span className="text-red-600 text-xl">📄</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-red-600">Facturas Emitidas</p>
                <p className="text-2xl font-bold text-red-900">{facturasStats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <span className="text-blue-600 text-xl">🏦</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600">Total Facturado</p>
                <p className="text-2xl font-bold text-blue-900">
                  €{facturasStats.totalAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <span className="text-green-600 text-xl">📊</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600">Gastos Cargados</p>
                <p className="text-2xl font-bold text-green-900">{gastosStats.total}</p>
              </div>
            </div>
          </div>

            <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <span className="text-purple-600 text-xl">🏧</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600">Balance Neto</p>
                <p className="text-2xl font-bold text-purple-900">
                   €{(facturasStats.totalAmount - gastosStats.totalProcessed).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 bg-amber-100 rounded-lg">
                <span className="text-amber-600 text-xl">💰</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-amber-600">Total Procesado</p>
                <p className="text-2xl font-bold text-amber-900">
                  €{gastosStats.totalProcessed.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

             {/* Secțiunea principală cu carduri */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Modulul de Facturación */}
         <div className="bg-white rounded-lg shadow-md p-8">
           <div className="flex items-center mb-6">
                         <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center mr-4">
               <span className="text-red-600 text-3xl">📄</span>
             </div>
            <div>
                             <h2 className="text-2xl font-bold text-gray-800">Facturación</h2>
              <p className="text-sm text-gray-600">Emitir y gestionar facturas</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
                         <Link 
               to="/facturas?view=form"
               className="flex items-center p-4 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
             >
               <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                                 <span className="text-red-600 text-lg">➕</span>
              </div>
              <div>
                                 <h3 className="text-base font-medium text-red-900">Emitir Nueva Factura</h3>
                 <p className="text-sm text-red-600">Crear factura profesional</p>
              </div>
            </Link>

            <Link 
              to="/facturas"
              className="flex items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-blue-600 text-sm">📋</span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-blue-900">Ver Facturas Emitidas</h3>
                <p className="text-xs text-blue-600">Lista completa de facturas</p>
              </div>
            </Link>
          </div>

          {/* Statistici facturación (armonizate cu pagina Facturas) */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-amber-50 rounded">
              <p className="text-xs text-amber-600">⏳ Pendientes</p>
              <p className="text-lg font-bold text-amber-900">{facturasStats.pendiente}</p>
            </div>
            <div className="p-2 bg-green-50 rounded">
              <p className="text-xs font-medium text-green-600">📤 Enviadas</p>
              <p className="text-lg font-bold text-green-900">{facturasStats.enviado}</p>
            </div>
            <div className="p-2 bg-amber-50 rounded">
              <p className="text-xs font-medium text-amber-600">💰 Pagadas</p>
              <p className="text-lg font-bold text-amber-900">{facturasStats.pagado}</p>
            </div>
          </div>
        </div>

                 {/* Modulul de Gastos */}
         <div className="bg-white rounded-lg shadow-md p-8">
           <div className="flex items-center mb-6">
                         <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mr-4">
               <span className="text-green-600 text-3xl">💰</span>
             </div>
            <div>
                             <h2 className="text-2xl font-bold text-gray-800">Gastos</h2>
              <p className="text-sm text-gray-600">Gestionar gastos y proveedores</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <Link 
              to="/gastos"
              className="flex items-center p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border border-green-200"
            >
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-green-600 text-sm">📤</span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-green-900">Cargar Gastos (PDF)</h3>
                <p className="text-xs text-green-600">Subir facturas de proveedores</p>
              </div>
            </Link>

            <Link 
              to="/gastos"
              className="flex items-center p-3 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200"
            >
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-amber-600 text-sm">📋</span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-amber-900">Ver Todos los Gastos</h3>
                <p className="text-xs text-amber-600">Lista de gastos procesados</p>
              </div>
            </Link>
          </div>

          {/* Statistici gastos */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-blue-50 rounded">
              <p className="text-xs text-blue-600">🧾 Cargados</p>
              <p className="text-lg font-bold text-blue-900">{gastosStats.cargado}</p>
            </div>
            <div className="p-2 bg-amber-50 rounded">
              <p className="text-xs text-amber-600">🏪 Furnizorez</p>
              <p className="text-lg font-bold text-amber-900">{uniqueFurnizori}</p>
            </div>
            <div className="p-2 bg-green-50 rounded">
              <p className="text-xs text-green-600">✅ Procesados</p>
              <p className="text-lg font-bold text-green-900">{gastosStats.procesado}</p>
            </div>
          </div>
        </div>

                 {/* Modulul de Catalogo */}
         <div className="bg-white rounded-lg shadow-md p-8">
           <div className="flex items-center mb-6">
                         <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
               <span className="text-purple-600 text-3xl">📚</span>
             </div>
            <div>
                             <h2 className="text-2xl font-bold text-gray-800">Catálogo</h2>
              <p className="text-sm text-gray-600">Gestionar productos y categorías</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <Link 
              to="/catalog"
              className="flex items-center p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200"
            >
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-purple-600 text-sm">📚</span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-purple-900">Gestionar Catálogo</h3>
                <p className="text-xs text-purple-600">Productos, categorías y stock</p>
              </div>
            </Link>

            <Link 
              to="/catalog?tab=categories"
              className="flex items-center p-3 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
            >
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-purple-600 text-sm">🏷️</span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-indigo-900">Categorías</h3>
                <p className="text-xs text-indigo-600">Organizar productos por tipo</p>
              </div>
            </Link>
          </div>

          {/* Statistici catalog - placeholder pentru moment */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-purple-50 rounded">
              <p className="text-xs text-purple-600">📦 Productos</p>
              <p className="text-lg font-bold text-purple-900">-</p>
            </div>
            <div className="p-2 bg-indigo-50 rounded">
              <p className="text-xs text-indigo-600">🏷️ Categorías</p>
              <p className="text-lg font-bold text-indigo-900">-</p>
            </div>
            <div className="p-2 bg-blue-50 rounded">
              <p className="text-xs text-blue-600">📊 Stock</p>
              <p className="text-lg font-bold text-blue-900">-</p>
            </div>
          </div>
        </div>

                 {/* Modulul de Facturas Recibidas */}
         <div className="bg-white rounded-lg shadow-md p-8">
           <div className="flex items-center mb-6">
                         <div className="w-16 h-16 bg-orange-100 rounded-lg flex items-center justify-center mr-4">
               <span className="text-orange-600 text-3xl">📥</span>
             </div>
            <div>
                             <h2 className="text-2xl font-bold text-gray-800">Facturas Recibidas</h2>
              <p className="text-sm text-gray-600">Gestionar facturas de proveedores</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <Link 
              to="/facturas-recibidas"
              className="flex items-center p-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors border border-orange-200"
            >
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-orange-600 text-sm">📥</span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-orange-900">Ver Facturas Recibidas</h3>
              <p className="text-xs text-orange-600">Lista de facturas de proveedores</p>
            </div>
          </Link>

          <Link 
            to="/facturas-recibidas"
            className="flex items-center p-3 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200"
          >
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center mr-3">
              <span className="text-amber-600 text-sm">➕</span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-amber-900">Añadir Factura</h3>
              <p className="text-xs text-amber-600">Introduce factura manual</p>
            </div>
          </Link>
        </div>

        {/* Statistici facturas recibidas - placeholder pentru moment */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-orange-50 rounded">
            <p className="text-xs text-orange-600">📥 Total</p>
            <p className="text-lg font-bold text-orange-900">-</p>
          </div>
          <div className="p-2 bg-yellow-50 rounded">
            <p className="text-xs text-yellow-600">⏳ Pendientes</p>
            <p className="text-lg font-bold text-yellow-900">-</p>
          </div>
          <div className="p-2 bg-green-50 rounded">
            <p className="text-xs text-green-600">✅ Pagadas</p>
            <p className="text-lg font-bold text-green-900">-</p>
          </div>
        </div>
      </div>

             {/* Modulul de Impuestos */}
       <div className="bg-white rounded-lg shadow-md p-8">
         <div className="flex items-center mb-6">
                     <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
             <span className="text-blue-600 text-3xl">🏛️</span>
           </div>
          <div>
                         <h2 className="text-2xl font-bold text-gray-800">Impuestos</h2>
            <p className="text-sm text-gray-600">Gestión de IVA y obligaciones fiscales</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <Link 
            to="/impuestos"
            className="flex items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
          >
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              <span className="text-blue-600 text-sm">📊</span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-900">Dashboard IVA</h3>
              <p className="text-xs text-blue-600">Resumen de obligaciones fiscales</p>
            </div>
          </Link>

          <Link 
            to="/impuestos?tab=iva"
            className="flex items-center p-3 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
          >
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
              <span className="text-indigo-600 text-sm">🧮</span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-indigo-900">Calculadora IVA</h3>
              <p className="text-xs text-indigo-600">Cálculos de impuestos y retenciones</p>
            </div>
          </Link>
        </div>

        {/* Statistici impuestos - placeholder pentru moment */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-blue-50 rounded">
            <p className="text-xs text-blue-600">📊 IVA Devengado</p>
            <p className="text-lg font-bold text-blue-900">-</p>
          </div>
          <div className="p-2 bg-indigo-50 rounded">
            <p className="text-xs text-indigo-600">🧮 IVA Soportado</p>
            <p className="text-lg font-bold text-indigo-900">-</p>
          </div>
          <div className="p-2 bg-purple-50 rounded">
            <p className="text-xs text-purple-600">💰 Resultado</p>
            <p className="text-lg font-bold text-purple-900">-</p>
          </div>
        </div>
      </div>
      </div>

             {/* Secțiunea de acțiuni rapide */}
       <div className="bg-white rounded-lg shadow-md p-8">
                 <h3 className="text-xl font-semibold text-gray-800 mb-6">Acciones Rápidas</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link 
              to="/facturas?view=form"
                         className="p-6 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
          >
            <div className="flex items-center">
                             <span className="text-red-600 text-3xl mr-3">📄</span>
              <div className="text-left">
                                 <h4 className="text-lg font-medium text-red-900">Nueva Factura</h4>
                 <p className="text-base text-red-600">Crear factura rápida</p>
              </div>
            </div>
          </Link>

          <Link 
            to="/gastos"
            className="p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
          >
            <div className="flex items-center">
              <span className="text-green-600 text-2xl mr-3">📤</span>
              <div className="text-left">
                <h4 className="font-medium text-green-900">Cargar Gasto</h4>
                <p className="text-sm text-green-600">Subir PDF de proveedor</p>
              </div>
            </div>
          </Link>

          <Link 
            to="/catalog"
            className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors"
          >
            <div className="flex items-center">
              <span className="text-purple-600 text-2xl mr-3">📚</span>
              <div className="text-left">
                <h4 className="font-medium text-purple-900">Catálogo</h4>
                <p className="text-sm text-purple-600">Gestionar productos</p>
              </div>
            </div>
          </Link>

          <Link 
            to="/facturas-recibidas"
            className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg border border-orange-200 transition-colors"
          >
            <div className="flex items-center">
              <span className="text-orange-600 text-2xl mr-3">📥</span>
              <div className="text-left">
                <h4 className="text-orange-900">Facturas Recibidas</h4>
                <p className="text-sm text-orange-600">Gestionar proveedores</p>
              </div>
            </div>
          </Link>

          <Link 
            to="/impuestos"
            className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
          >
            <div className="flex items-center">
              <span className="text-blue-600 text-2xl mr-3">🏛️</span>
              <div className="text-left">
                <h4 className="font-medium text-blue-900">Impuestos</h4>
                <p className="text-sm text-blue-600">Gestión fiscal</p>
              </div>
            </div>
          </Link>
        </div>
      </div>


      {/* Statistici detaliate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Resumen Facturación</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Facturado:</span>
              <span className="font-semibold">€{facturasStats.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Pagado:</span>
              <span className="font-semibold text-green-600">€{facturasStats.paidAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Pendiente:</span>
              <span className="font-semibold text-amber-600">€{facturasStats.pendingAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Resumen Gastos</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Gastos:</span>
              <span className="font-semibold">{gastosStats.total}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Procesados:</span>
              <span className="font-semibold text-green-600">{gastosStats.procesado}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Procesado:</span>
              <span className="font-semibold text-purple-600">€{gastosStats.totalProcessed.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FacturasInicio = () => {
  return (
    <FacturasProvider>
      <GastosProvider>
        <FacturasInicioContent />
      </GastosProvider>
    </FacturasProvider>
  );
};

export default FacturasInicio; 