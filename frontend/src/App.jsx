import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContextBase';
import { GoogleMapsProvider } from './contexts/GoogleMapsContext';
import { LocationProvider } from './contexts/LocationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/MainLayout';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import BrowserUpdatePrompt from './components/BrowserUpdatePrompt';
import ErrorDisplay from './components/ErrorDisplay';
import OfflineIndicator from './components/OfflineIndicator';
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
  LazyTareasPage,
  LazyControlCorreoPage,
  LazyIncidenciasPage,
  LazyCuadernosPage,
  LazyCuadernosPorCentroPage,
  LazyTareasCentroPage,
  LazyPaqueteriaCentroPage,
  LazyIncidenciasCentroPage,
  LazyPedidosPage,
  LazyEmpleadoPedidosPage,
  LazyChatPage
} from './pages/lazy/LazyPages';

import './i18n';

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
      
      {/* Rute protejate - folosesc MainLayout */}
      <Route
                path="/inicio"
        element={
          <ProtectedRoute>
            <MainLayout>
              <InicioPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para datos del empleado */}
      <Route
        path="/datos"
        element={
          <ProtectedRoute>
            <MainLayout>
              <DatosPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para gestión de empleados */}
      <Route
        path="/empleados"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyEmpleadosPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para tareas diarias */}
      <Route
        path="/tareas"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyTareasPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para Cuadernos (tabs) */}
      <Route
        path="/cuadernos"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyCuadernosPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para CONTROL CORREO/PAQUETERÍA */}
      <Route
        path="/control-correo"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyControlCorreoPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para Incidencias */}
      <Route
        path="/incidencias"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyIncidenciasPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para Cuadernos Por Centro */}
      <Route
        path="/cuadernos-centro"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyCuadernosPorCentroPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para Tareas Por Centro */}
      <Route
        path="/cuadernos-centro/tareas"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyTareasCentroPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para Paquetería Por Centro */}
      <Route
        path="/cuadernos-centro/paqueteria"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyPaqueteriaCentroPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para Incidencias Por Centro */}
      <Route
        path="/cuadernos-centro/incidencias"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyIncidenciasCentroPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para solicitudes */}
      <Route
        path="/solicitudes"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazySolicitudesPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para fichaje */}
      <Route
        path="/fichaje"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyFichajePage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para documentos */}
      <Route
        path="/documentos"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyDocumentosPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para cuadrantes */}
      <Route
        path="/cuadrantes"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyCuadrantesPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para cuadrantes por empleado */}
      <Route
        path="/cuadrantes-empleado"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyCuadrantesEmpleadoPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para aprobaciones */}
      <Route
        path="/aprobaciones"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyAprobacionesPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para estadísticas generales */}
      <Route
        path="/estadisticas"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyEstadisticasPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Rutas para estadísticas específicas */}
      <Route
        path="/estadisticas-cuadrantes"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyEstadisticasCuadrantesPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/estadisticas-empleados"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyEstadisticasEmpleadosPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/estadisticas-fichajes"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyEstadisticasFichajesPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para clientes */}
      <Route
        path="/clientes"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyClientesPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para detalles cliente */}
      <Route
        path="/clientes/:nif"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyClienteDetallePage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para detalles proveedor */}
      <Route
        path="/proveedores/:nif"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyProveedorDetallePage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para Panel de Administración */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyAdminDashboard />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para documentos por empleado */}
      <Route
        path="/documentos-empleados"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyDocumentosEmpleadosPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para inspecciones */}
      <Route
        path="/inspecciones"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyInspeccionesPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para mis inspecciones */}
      <Route
        path="/mis-inspecciones"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyMisInspeccionesPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para tareas diarias */}
      <Route
        path="/tareas"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyTareasPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para control correo */}
      <Route
        path="/control-correo"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyControlCorreoPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para incidencias */}
      <Route
        path="/incidencias"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyIncidenciasPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para cuadernos */}
      <Route
        path="/cuadernos"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyCuadernosPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta para pedidos - pentru manageri, admini și developeri */}
      <Route
        path="/pedidos"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyPedidosPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta pentru angajați - doar Nuevo Pedido */}
      <Route
        path="/empleado-pedidos"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyEmpleadoPedidosPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Ruta para chat */}
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LazyChatPage />
            </MainLayout>
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