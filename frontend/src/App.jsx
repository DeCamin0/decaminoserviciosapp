import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContextBase';
import { GoogleMapsProvider } from './contexts/GoogleMapsContext';
import { LocationProvider } from './contexts/LocationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import ProtectedRoute from './components/ProtectedRoute';
import ResponsiveLayout from './layouts/ResponsiveLayout';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import BrowserUpdatePrompt from './components/BrowserUpdatePrompt';
import ErrorDisplay from './components/ErrorDisplay';
import OfflineIndicator from './components/OfflineIndicator';
import CertificadoHandicapDialog from './components/CertificadoHandicapDialog';
import { PeriodoProvider } from './contexts/PeriodoContext';
import IdleProvider from './providers/IdleProvider.jsx';
import { usePWAMigration } from './hooks/usePWAMigration';
import { useErrorHandler } from './hooks/useErrorHandler';

// Import doar paginile mici (non-lazy)
import LoginPage from './pages/LoginPage';
import InicioPage from './pages/DashboardPage';
import DatosPage from './pages/DatosPage';

// Import lazy loading pentru paginile mari
import {
  LazyFichajePage,
  LazyEmpleadosPage,
  LazySolicitudesPage,
  LazyCuadrantesPage,
  LazyCuadrantesEmpleadoPage,
  LazyDocumentosPage,
  LazyDocumentosEmpleadosPage,
  LazyAprobacionesPage,
  LazyEstadisticasPage,
  LazyEstadisticasCuadrantesPage,
  LazyEstadisticasEmpleadosPage,
  LazyEstadisticasFichajesPage,
  LazyClientesPage,
  LazyClienteDetallePage,
  LazyProveedorDetallePage,
  LazyAdminDashboard,
  LazyInspeccionesPage,
  LazyMisInspeccionesPage,
  // ⚠️ PAGINI MUTATE ÎN OLD - NU SE FOLOSESC MOMENTAN (LazyTareasPage, LazyControlCorreoPage, LazyIncidenciasPage, LazyPaqueteriaCentroPage, LazyTareasCentroPage, LazyIncidenciasCentroPage)
  LazyCuadernosPage,
  LazyCuadernosPorCentroPage,
  // LazyIncidenciasCentroPage, // ⚠️ ȘTERS - NU SE FOLOSEȘTE
  LazyPedidosPage,
  LazyEmpleadoPedidosPage,
  LazyComunicadosPage,
  LazyComunicadoDetailPage,
  LazyComunicadoCreatePage,
  LazyMensajesEnviadosPage,
  LazyHallOfFamePage,
  LazyPRLDocumentosPage
} from './pages/lazy/LazyPages';

// i18n este deja importat în main.jsx

function App() {
  // Pornește migrarea PWA
  usePWAMigration();

  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
        <GoogleMapsProvider>
          <PeriodoProvider>
            <LocationProvider>
              <IdleProvider>
                <AppRoutes />
                <CertificadoHandicapDialog />
                <PWAUpdatePrompt />
                <BrowserUpdatePrompt />
                <OfflineIndicator />
              </IdleProvider>
            </LocationProvider>
          </PeriodoProvider>
        </GoogleMapsProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const { errors, clearError, clearAllErrors } = useErrorHandler();

  // Log navigation for debugging (doar când se schimbă locația)
  useEffect(() => {
    console.log('Current location:', location.pathname);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <>
      <ErrorDisplay 
        errors={errors} 
        onClearError={clearError} 
        onClearAll={clearAllErrors}
        maxDisplay={3}
        autoHide={true}
        autoHideDelay={5000}
      />
      <Routes>
        {/* Ruta de login - accesibilă doar dacă nu ești logat */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/inicio" replace /> : <LoginPage />
          } 
        />
      
      {/* Rute protejate - folosesc ResponsiveLayout */}
      <Route
                path="/inicio"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <InicioPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para datos del empleado */}
      <Route
        path="/datos"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <DatosPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para gestión de empleados */}
      <Route
        path="/empleados"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyEmpleadosPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      {/* ⚠️ PAGINI MUTATE ÎN OLD - NU SE FOLOSESC MOMENTAN (TareasPage, ControlCorreoPage, IncidenciasPage) */}

      {/* Ruta para Cuadernos (tabs) */}
      <Route
        path="/cuadernos"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyCuadernosPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para Cuadernos Por Centro */}
      <Route
        path="/cuadernos-centro"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyCuadernosPorCentroPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />

      {/* ⚠️ PAGINĂ MUTATĂ ÎN OLD - NU SE FOLOSEȘTE MOMENTAN (TareasCentroPage) */}

      {/* ⚠️ PAGINĂ MUTATĂ ÎN OLD - NU SE FOLOSEȘTE MOMENTAN (PaqueteriaCentroPage) */}
      {/* ⚠️ PAGINĂ ȘTEARSĂ - NU SE FOLOSEȘTE (IncidenciasCentroPage) */}
      
      {/* Ruta para solicitudes */}
      <Route
        path="/solicitudes"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazySolicitudesPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para fichaje */}
      <Route
        path="/fichaje"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyFichajePage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para documentos */}
      <Route
        path="/documentos"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyDocumentosPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para cuadrantes */}
      <Route
        path="/cuadrantes"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyCuadrantesPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para cuadrantes por empleado */}
      <Route
        path="/cuadrantes-empleado"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyCuadrantesEmpleadoPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para aprobaciones */}
      <Route
        path="/aprobaciones"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyAprobacionesPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para estadísticas generales */}
      <Route
        path="/estadisticas"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyEstadisticasPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Rutas para estadísticas específicas */}
      <Route
        path="/estadisticas-cuadrantes"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyEstadisticasCuadrantesPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/estadisticas-empleados"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyEstadisticasEmpleadosPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/estadisticas-fichajes"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyEstadisticasFichajesPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para clientes */}
      <Route
        path="/clientes"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyClientesPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para detalles cliente */}
      <Route
        path="/clientes/:nif"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyClienteDetallePage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para detalles proveedor */}
      <Route
        path="/proveedores/:nif"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyProveedorDetallePage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para Panel de Administración */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyAdminDashboard />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para documentos por empleado */}
      <Route
        path="/documentos-empleados"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyDocumentosEmpleadosPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/prl-documentos"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyPRLDocumentosPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para inspecciones */}
      <Route
        path="/inspecciones"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyInspeccionesPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para mis inspecciones */}
      <Route
        path="/mis-inspecciones"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyMisInspeccionesPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />

      {/* ⚠️ PAGINI MUTATE ÎN OLD - NU SE FOLOSESC MOMENTAN (TareasPage, ControlCorreoPage, IncidenciasPage) */}

      {/* Ruta para cuadernos */}
      <Route
        path="/cuadernos"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyCuadernosPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para pedidos - pentru manageri, admini și developeri */}
      <Route
        path="/pedidos"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyPedidosPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta pentru angajați - doar Nuevo Pedido */}
      <Route
        path="/empleado-pedidos"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyEmpleadoPedidosPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Rutas para Comunicados */}
      <Route
        path="/comunicados"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyComunicadosPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/comunicados/:id"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyComunicadoDetailPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/comunicados/nuevo"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyComunicadoCreatePage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/comunicados/:id/editar"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyComunicadoCreatePage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para Mensajes Enviados (solo para admini/developeri) */}
      <Route
        path="/mensajes-enviados"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyMensajesEnviadosPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para Hall of Fame */}
      <Route
        path="/hall-of-fame"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyHallOfFamePage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Redirect por defecto a inicio si estás logueado, sino a login */}
      <Route 
        path="/" 
        element={
          isAuthenticated ? <Navigate to="/inicio" replace /> : <Navigate to="/login" replace />
        } 
      />
      
      {/* Catch all - redirect a inicio o login */}
      <Route 
        path="*" 
        element={
          isAuthenticated ? <Navigate to="/inicio" replace /> : <Navigate to="/login" replace />
        } 
      />
      </Routes>
    </>
  );
}

export default App; 