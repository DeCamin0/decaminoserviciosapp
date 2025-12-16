import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui';
import InspectionForm from '../components/inspections/InspectionForm';
import InspectionList from '../components/inspections/InspectionList'; // Updated import
import { routes } from '../utils/routes';
import { API_ENDPOINTS } from '../utils/constants';
import Back3DButton from '../components/Back3DButton.jsx';
import { usePolling } from '../hooks/usePolling';

export default function InspeccionesPage() {
  const { user: authUser } = useAuth();
  const [selectedType, setSelectedType] = useState(null);
  const [centrosStats, setCentrosStats] = useState({
    totalCentros: 0,
    totalEmpleados: 0,
    centrosActivos: 0
  });

  // Verific dacă utilizatorul este supervisor
  // isManager is now calculated in backend (/api/me) and includes Manager, Supervisor, Developer, Admin
  const isSupervisor = authUser?.isManager || false;

  // Demo data for InspeccionesPage
  const setDemoCentrosStats = () => {
    const demoStats = {
      totalCentros: 3,
      totalEmpleados: 6,
      centrosActivos: 3
    };
    setCentrosStats(demoStats);
  };

  // Încarcă statisticile centrelor
  useEffect(() => {
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo centros stats instead of fetching from backend');
      setDemoCentrosStats();
      return;
    }

    const loadCentrosStats = async () => {
      try {
        const response = await fetch(routes.getEmpleados, {
          headers: {
            'X-App-Source': 'DeCamino-Web-App',
            'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
            'X-Client-Type': 'web-browser',
            'User-Agent': 'DeCamino-Web-Client/1.0'
          }
        });

        if (response.status === 403) {
          console.warn('🚫 403 Forbidden la getEmpleados în InspeccionesPage. Setez statistici 0.');
          setCentrosStats({ totalCentros: 0, totalEmpleados: 0, centrosActivos: 0 });
          return;
        }

        const empleadosData = await response.json();
        const empleadosArray = Array.isArray(empleadosData) ? empleadosData : [empleadosData];
        
        // Extrage centrele unice
        const centrosUnicos = [...new Set(empleadosArray.map(emp => {
          const centroProps = [
            emp['CENTRO TRABAJO'], 
            emp.CENTRO_TRABAJO, 
            emp.CENTRO, 
            emp.centro,
            emp['CENTRO_DE_TRABAJO'], 
            emp['CENTRO LABORAL']
          ];
          return centroProps.find(prop => prop) || 'Sin centro';
        }).filter(centro => centro && centro !== 'Sin centro'))];
        
        setCentrosStats({
          totalCentros: centrosUnicos.length,
          totalEmpleados: empleadosArray.length,
          centrosActivos: centrosUnicos.length
        });
      } catch (error) {
        console.error('Error loading centros stats:', error);
      }
    };

    loadCentrosStats();
  }, [authUser?.isDemo]);

  if (!isSupervisor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Acceso Restringido
          </h1>
          <p className="text-gray-600 mb-6">
            Solo los supervisores pueden acceder a las inspecciones.
          </p>
          <Link 
            to="/inicio"
            className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            ← Volver al Inicio
          </Link>
        </div>
      </div>
    );
  }

  if (!selectedType) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        {/* ULTRA MODERN Header con efectos 3D */}
        <div className="mb-12 relative">
          {/* Background glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-purple-500/10 to-blue-500/10 blur-3xl"></div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Back3DButton to="/inicio" title="Regresar al Dashboard" />
              <div>
                <h1 className="text-5xl font-black bg-gradient-to-r from-red-600 via-red-500 to-orange-500 bg-clip-text text-transparent mb-3 animate-pulse">
                  Inspecciones
                </h1>
                <p className="text-gray-600 text-lg font-medium">
                  Selecciona el tipo de inspección que deseas realizar
                </p>
              </div>
            </div>
            
            {/* Buton Reportar error */}
            <button
              onClick={() => window.open('https://wa.me/34635289087?text=Hola, tengo un problema con el sistema de inspecciones', '_blank')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
              title="Reportar error"
            >
              <span className="text-lg">📱</span>
              <span>Reportar error</span>
            </button>
          </div>
        </div>

        {/* SUPER WOW 3D Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 perspective-1000">
          {/* Card 1 - Limpieza con efectos 3D ULTRA */}
          <div
            onClick={() => setSelectedType('limpieza')}
            className="group relative cursor-pointer transform-gpu transition-all duration-700 hover:scale-110 hover:-translate-y-4 hover:rotate-y-12"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Glow effect ultra potente */}
            <div className="absolute -inset-4 bg-gradient-to-r from-red-500 via-pink-500 to-red-600 rounded-3xl opacity-0 group-hover:opacity-30 blur-2xl transition-all duration-700 group-hover:blur-3xl animate-pulse"></div>
            
            {/* Card principal con glassmorphism */}
            <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-red-100 overflow-hidden transition-all duration-700 group-hover:border-red-300 group-hover:shadow-red-500/50"
                 style={{
                   background: 'linear-gradient(135deg, rgba(254, 202, 202, 0.4) 0%, rgba(252, 165, 165, 0.3) 50%, rgba(248, 113, 113, 0.2) 100%)',
                   backdropFilter: 'blur(20px)',
                   boxShadow: '0 20px 60px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
                 }}>
              
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              
              {/* Icon 3D con múltiples capas */}
              <div className="relative mx-auto mb-6 w-24 h-24 transform group-hover:scale-125 group-hover:rotate-12 transition-all duration-700"
                   style={{ transformStyle: 'preserve-3d' }}>
                <div className="absolute inset-0 bg-gradient-to-br from-red-400 to-red-600 rounded-full blur-xl opacity-50 animate-pulse"></div>
                <div className="relative w-24 h-24 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center shadow-2xl"
                     style={{
                       boxShadow: '0 15px 35px rgba(239, 68, 68, 0.5), inset 0 -5px 15px rgba(0,0,0,0.2), inset 0 5px 15px rgba(255,255,255,0.3)'
                     }}>
                  <span className="text-5xl transform group-hover:scale-110 transition-transform duration-500">🧹</span>
                </div>
              </div>
              
              <h2 className="text-2xl font-black text-red-600 mb-3 group-hover:text-red-500 transition-colors">
                Inspección de Limpieza
              </h2>
              <p className="text-gray-700 mb-4 font-medium">
                Formulario para inspeccionar servicios de limpieza en edificios y espacios.
              </p>
              <div className="space-y-2 text-sm text-gray-600 font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span>17 zonas de inspección</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span>Evaluación de calidad</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span>Firmas digitales</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2 - Servicios Auxiliares ULTRA 3D */}
          <div
            onClick={() => setSelectedType('servicios')}
            className="group relative cursor-pointer transform-gpu transition-all duration-700 hover:scale-110 hover:-translate-y-4 hover:rotate-y-12"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Glow effect ultra potente */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 rounded-3xl opacity-0 group-hover:opacity-30 blur-2xl transition-all duration-700 group-hover:blur-3xl animate-pulse"></div>
            
            {/* Card principal con glassmorphism */}
            <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-blue-100 overflow-hidden transition-all duration-700 group-hover:border-blue-300 group-hover:shadow-blue-500/50"
                 style={{
                   background: 'linear-gradient(135deg, rgba(191, 219, 254, 0.4) 0%, rgba(147, 197, 253, 0.3) 50%, rgba(96, 165, 250, 0.2) 100%)',
                   backdropFilter: 'blur(20px)',
                   boxShadow: '0 20px 60px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
                 }}>
              
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              
              {/* Icon 3D con múltiples capas */}
              <div className="relative mx-auto mb-6 w-24 h-24 transform group-hover:scale-125 group-hover:rotate-12 transition-all duration-700"
                   style={{ transformStyle: 'preserve-3d' }}>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full blur-xl opacity-50 animate-pulse"></div>
                <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center shadow-2xl"
                     style={{
                       boxShadow: '0 15px 35px rgba(59, 130, 246, 0.5), inset 0 -5px 15px rgba(0,0,0,0.2), inset 0 5px 15px rgba(255,255,255,0.3)'
                     }}>
                  <span className="text-5xl transform group-hover:scale-110 transition-transform duration-500">🛡️</span>
                </div>
              </div>
              
              <h2 className="text-2xl font-black text-blue-600 mb-3 group-hover:text-blue-500 transition-colors">
                Inspección de Servicios Auxiliares
              </h2>
              <p className="text-gray-700 mb-4 font-medium">
                Formulario para inspeccionar servicios auxiliares como vigilancia y logística.
              </p>
              <div className="space-y-2 text-sm text-gray-600 font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span>6 zonas de inspección</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span>Evaluación de calidad</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span>Firmas digitales</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3 - Inspección Personalizada ULTRA 3D */}
          <div
            onClick={() => setSelectedType('personalizada')}
            className="group relative cursor-pointer transform-gpu transition-all duration-700 hover:scale-110 hover:-translate-y-4 hover:rotate-y-12"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Glow effect ultra potente */}
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-500 via-violet-500 to-purple-600 rounded-3xl opacity-0 group-hover:opacity-30 blur-2xl transition-all duration-700 group-hover:blur-3xl animate-pulse"></div>
            
            {/* Card principal con glassmorphism */}
            <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-purple-100 overflow-hidden transition-all duration-700 group-hover:border-purple-300 group-hover:shadow-purple-500/50"
                 style={{
                   background: 'linear-gradient(135deg, rgba(196, 181, 253, 0.4) 0%, rgba(167, 139, 250, 0.3) 50%, rgba(139, 92, 246, 0.2) 100%)',
                   backdropFilter: 'blur(20px)',
                   boxShadow: '0 20px 60px rgba(139, 92, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
                 }}>
              
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              
              {/* Icon 3D con múltiples capas */}
              <div className="relative mx-auto mb-6 w-24 h-24 transform group-hover:scale-125 group-hover:rotate-12 transition-all duration-700"
                   style={{ transformStyle: 'preserve-3d' }}>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full blur-xl opacity-50 animate-pulse"></div>
                <div className="relative w-24 h-24 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center shadow-2xl"
                     style={{
                       boxShadow: '0 15px 35px rgba(139, 92, 246, 0.5), inset 0 -5px 15px rgba(0,0,0,0.2), inset 0 5px 15px rgba(255,255,255,0.3)'
                     }}>
                  <span className="text-5xl transform group-hover:scale-110 transition-transform duration-500">⚙️</span>
                </div>
              </div>
              
              <h2 className="text-2xl font-black text-purple-600 mb-3 group-hover:text-purple-500 transition-colors">
                Inspección Personalizada
              </h2>
              <p className="text-gray-700 mb-4 font-medium">
                Crea inspecciones personalizadas con puntos de inspección a medida.
              </p>
              <div className="space-y-2 text-sm text-gray-600 font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <span>Puntos personalizables</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <span>Configuración flexible</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <span>Firmas digitales</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4 - Lista Inspecciones MEGA 3D */}
          <div
            onClick={() => setSelectedType('pdf-generator')}
            className="group relative cursor-pointer transform-gpu transition-all duration-700 hover:scale-110 hover:-translate-y-4 hover:rotate-y-12"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Glow effect ultra potente */}
            <div className="absolute -inset-4 bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 rounded-3xl opacity-0 group-hover:opacity-30 blur-2xl transition-all duration-700 group-hover:blur-3xl animate-pulse"></div>
            
            {/* Card principal con glassmorphism */}
            <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-green-100 overflow-hidden transition-all duration-700 group-hover:border-green-300 group-hover:shadow-green-500/50"
                 style={{
                   background: 'linear-gradient(135deg, rgba(187, 247, 208, 0.4) 0%, rgba(134, 239, 172, 0.3) 50%, rgba(74, 222, 128, 0.2) 100%)',
                   backdropFilter: 'blur(20px)',
                   boxShadow: '0 20px 60px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
                 }}>
              
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              
              {/* Icon 3D con múltiples capas */}
              <div className="relative mx-auto mb-6 w-24 h-24 transform group-hover:scale-125 group-hover:rotate-12 transition-all duration-700"
                   style={{ transformStyle: 'preserve-3d' }}>
                <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-green-600 rounded-full blur-xl opacity-50 animate-pulse"></div>
                <div className="relative w-24 h-24 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center shadow-2xl"
                     style={{
                       boxShadow: '0 15px 35px rgba(34, 197, 94, 0.5), inset 0 -5px 15px rgba(0,0,0,0.2), inset 0 5px 15px rgba(255,255,255,0.3)'
                     }}>
                  <span className="text-5xl transform group-hover:scale-110 transition-transform duration-500">📄</span>
                </div>
              </div>
              
              <h2 className="text-2xl font-black text-green-600 mb-3 group-hover:text-green-500 transition-colors">
                Lista de Inspecciones
              </h2>
              <p className="text-gray-700 mb-4 font-medium">
                Ver todas las inspecciones existentes y descargar los PDF.
              </p>
              <div className="space-y-2 text-sm text-gray-600 font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Lista completa de inspecciones</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Descarga de PDF individual</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Búsqueda y filtrado</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ULTRA Statistics Glassmorphism */}
        <div className="mt-16">
          <h3 className="text-3xl font-black bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-8">
            Estadísticas del Sistema
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 - Centros */}
            <div className="group relative overflow-hidden">
              {/* Animated background glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-cyan-500 opacity-20 group-hover:opacity-30 blur-xl transition-all duration-500"></div>
              
              <div className="relative bg-gradient-to-br from-blue-50/80 to-cyan-50/80 backdrop-blur-xl border border-blue-200/50 rounded-2xl p-6 shadow-xl group-hover:shadow-2xl transition-all duration-500 group-hover:scale-105"
                   style={{ backdropFilter: 'blur(20px)' }}>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500 rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity"></div>
                    <div className="relative w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                      <span className="text-3xl">🏢</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-600 uppercase tracking-wide">Centros de Trabajo</p>
                    <p className="text-4xl font-black text-blue-900 tabular-nums">{centrosStats.totalCentros}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Card 2 - Empleados */}
            <div className="group relative overflow-hidden">
              {/* Animated background glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-500 opacity-20 group-hover:opacity-30 blur-xl transition-all duration-500"></div>
              
              <div className="relative bg-gradient-to-br from-green-50/80 to-emerald-50/80 backdrop-blur-xl border border-green-200/50 rounded-2xl p-6 shadow-xl group-hover:shadow-2xl transition-all duration-500 group-hover:scale-105"
                   style={{ backdropFilter: 'blur(20px)' }}>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-500 rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity"></div>
                    <div className="relative w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                      <span className="text-3xl">👥</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-600 uppercase tracking-wide">Total Empleados</p>
                    <p className="text-4xl font-black text-green-900 tabular-nums">{centrosStats.totalEmpleados}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Card 3 - Centros Activos */}
            <div className="group relative overflow-hidden">
              {/* Animated background glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-amber-500 opacity-20 group-hover:opacity-30 blur-xl transition-all duration-500"></div>
              
              <div className="relative bg-gradient-to-br from-orange-50/80 to-amber-50/80 backdrop-blur-xl border border-orange-200/50 rounded-2xl p-6 shadow-xl group-hover:shadow-2xl transition-all duration-500 group-hover:scale-105"
                   style={{ backdropFilter: 'blur(20px)' }}>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-orange-500 rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity"></div>
                    <div className="relative w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                      <span className="text-3xl">✅</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-orange-600 uppercase tracking-wide">Centros Activos</p>
                    <p className="text-4xl font-black text-orange-900 tabular-nums">{centrosStats.centrosActivos}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Inspections */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Inspecciones Recientes
          </h3>
          <RecentInspections />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header with back button - doar pentru formulare, nu pentru pdf-generator */}
      {selectedType !== 'pdf-generator' && (
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div onClick={() => setSelectedType(null)}>
              <Back3DButton to="#" title="Volver a selección" onClick={(e) => { e.preventDefault(); setSelectedType(null); }} />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-red-600 via-red-500 to-orange-500 bg-clip-text text-transparent">
                {selectedType === 'limpieza' ? 'Inspección de Limpieza' : 
                 selectedType === 'servicios' ? 'Inspección de Servicios Auxiliares' : 
                 selectedType === 'personalizada' ? 'Inspección Personalizada' : 'Inspección'}
              </h1>
              <p className="text-gray-600 text-sm sm:text-base font-medium">
                Completa todos los campos y envía la inspección
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Content based on selected type */}
      {selectedType === 'pdf-generator' ? (
        <InspectionList onBackToSelection={() => setSelectedType(null)} />
      ) : (
        <InspectionForm type={selectedType} />
      )}
    </div>
  );
}

// Component to show recent inspections
function RecentInspections() {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadInspections = useCallback(async () => {
    setLoading(true);
    try {
      console.log('🔍 Loading inspections from:', API_ENDPOINTS.GET_INSPECCIONES);
      
      // Încearcă să încarci de la API - schimb la GET pentru a testa
      const response = await fetch(API_ENDPOINTS.GET_INSPECCIONES, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);

      if (response.ok) {
        const apiInspections = await response.json();
        console.log('✅ API Inspections received:', apiInspections);
        
        // Verificăm dacă este array sau un obiect cu status
        if (!Array.isArray(apiInspections)) {
          if (apiInspections.status === 'not-modified') {
            console.log('📋 No changes in inspections (not-modified)');
            // Nu actualizăm lista dacă nu sunt modificări
            return;
          }
          console.warn('⚠️ Unexpected API response format:', apiInspections);
          setInspections([]);
          return;
        }
        
        // Mapare date pentru noul endpoint
        const mappedInspections = apiInspections.map(inspection => ({
          id: inspection.id,
          tipo: inspection.tipo_inspeccion,
          inspector: inspection.nombre_empleado,
          trabajador: inspection.nombre_empleado,
          location: inspection.Locacion,
          fecha: inspection.fecha_subida,
          centro: inspection.Centro,
          supervisor: inspection['Nombre Supervisor']
        }));
        
        console.log('✅ Mapped inspections:', mappedInspections);
        
        // Filtrează inspecțiile care au date complete
        const validInspections = mappedInspections.filter(inspection => 
          inspection.id && 
          inspection.tipo && 
          inspection.trabajador && 
          inspection.centro
        );
        
        setInspections(validInspections.slice(-5).reverse());
      } else {
        console.log('❌ No inspections available from API. Status:', response.status);
        setInspections([]);
      }
    } catch (error) {
      console.error('Error loading inspections:', error);
      setInspections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInspections();
  }, [loadInspections]);

  // Polling cu pause/resume automat când tab-ul nu e activ + jitter
  usePolling(loadInspections, 30000, true, 6000); // 30s base + max 6s jitter

  if (loading) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Cargando inspecciones...</p>
        </div>
      </Card>
    );
  }

  if (inspections.length === 0) {
    return (
      <Card>
        <div className="text-center py-8 text-gray-500">
          <span className="text-4xl mb-4 block">📋</span>
          <p>No se encontraron inspecciones</p>
          <p className="text-sm">Las inspecciones aparecerán aquí después de ser enviadas</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-gray-800">Inspecciones Recientes</h4>
        
        {/* SUPER 3D Refresh Button - SOLO ICONITA */}
        <button
          onClick={loadInspections}
          disabled={loading}
          className="group relative w-12 h-12 rounded-2xl transition-all duration-500 transform hover:scale-110 hover:-translate-y-1 shadow-xl hover:shadow-blue-500/50 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
            boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
          }}
          title="Actualizar inspecciones"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-blue-400 opacity-0 group-hover:opacity-40 blur-xl transition-all duration-500"></div>
          
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          
          {/* Icon con animație de rotire */}
          <div className="relative flex items-center justify-center h-full">
            <span className="text-2xl transform group-hover:rotate-180 transition-transform duration-500">🔄</span>
          </div>
        </button>
      </div>
      {inspections.map((inspection, index) => (
        <Card key={index} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-gray-800">
                  {inspection.type === 'limpieza' ? '🧹 Limpieza' : '🛡️ Servicios Auxiliares'}
                </h4>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  Completada
                </span>
              </div>
              <p className="text-sm text-gray-600">
                <strong>Centro:</strong> {inspection.centro}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Trabajador:</strong> {inspection.trabajador}
              </p>
              <p className="text-xs text-gray-500">
                {inspection.fecha} • {inspection.hora} • Supervisor: {inspection.supervisor || 'N/A'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {inspection.signatures?.trabajador && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  ✓ Firma T
                </span>
              )}
              {inspection.signatures?.cliente && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  ✓ Firma C
                </span>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
} 