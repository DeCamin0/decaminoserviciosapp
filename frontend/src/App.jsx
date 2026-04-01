import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { COLORS } from './theme';
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
import { SessionExpiredProvider, useSessionExpired } from './contexts/SessionExpiredContext';
import SessionExpiredBanner from './components/SessionExpiredBanner';
import { usePWAMigration } from './hooks/usePWAMigration';
import { useErrorHandler } from './hooks/useErrorHandler';
import { setSessionExpiredCallback } from './utils/tokenRefresh';
import { useTokenMonitor } from './hooks/useTokenMonitor';
import { config } from './config/env';

// Tab title mereu din setări (.env: VITE_APP_NAME sau VITE_COMPANY_NAME)
if (typeof document !== 'undefined') {
  const title = config.APP_NAME || config.COMPANY_NAME;
  if (title) document.title = title;
}

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
  LazyLeadsPage,
  LazyAdminChatAnalyticsPage,
  LazyAdminAssistantFaqEditorPage,
  LazySuperAdminTenantsPage,
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
  LazyPRLDocumentosPage,
  LazyPresupuestosInformesPage
} from './pages/lazy/LazyPages';

// i18n este deja importat în main.jsx

// Component intern pentru a configura session expired callback
function SessionExpiredSetup() {
  const { showSessionExpired } = useSessionExpired();
  
  useEffect(() => {
    setSessionExpiredCallback(showSessionExpired);
    return () => {
      setSessionExpiredCallback(null);
    };
  }, [showSessionExpired]);
  
  return null;
}

// Component pentru monitorizarea periodică a token-ului
// Se montează doar când utilizatorul e autentificat
function TokenMonitor() {
  // Monitorizează token-ul doar dacă utilizatorul e autentificat
  useTokenMonitor(30000); // Verifică la fiecare 30 de secunde
  
  return null;
}

function App() {
  // Pornește migrarea PWA
  usePWAMigration();

  // Setează CSS variables globale pentru culori branding (din config = env per client)
  useEffect(() => {
    const primaryColor = config.PRIMARY_COLOR || COLORS.PRIMARY;
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    
    // Helper pentru conversie hex to RGB
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };
    
    const rgbToHex = (r, g, b) => {
      return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
    };
    
    // Calculează culori derivate pentru gradient
    const primaryRgb = hexToRgb(primaryColor);
    if (primaryRgb) {
      const darker = rgbToHex(
        Math.max(0, primaryRgb.r - 20),
        Math.max(0, primaryRgb.g - 20),
        Math.max(0, primaryRgb.b - 20)
      );
      const darkest = rgbToHex(
        Math.max(0, primaryRgb.r - 40),
        Math.max(0, primaryRgb.g - 40),
        Math.max(0, primaryRgb.b - 40)
      );
      document.documentElement.style.setProperty('--primary-color-darker', darker);
      document.documentElement.style.setProperty('--primary-color-darkest', darkest);
      document.documentElement.style.setProperty('--primary-color-rgb', `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`);
      // Setează rgba variants pentru box-shadow
      document.documentElement.style.setProperty('--primary-color-rgba-05', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.5)`);
      document.documentElement.style.setProperty('--primary-color-rgba-06', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.6)`);
      document.documentElement.style.setProperty('--primary-color-rgba-02', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.2)`);
      document.documentElement.style.setProperty('--primary-color-rgba-04', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.4)`);
      document.documentElement.style.setProperty('--primary-color-rgba-01', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.1)`);
    }
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
        <GoogleMapsProvider>
          <PeriodoProvider>
            <LocationProvider>
              <SessionExpiredProvider>
                <SessionExpiredSetup />
                <TokenMonitor />
                <IdleProvider>
                  <SessionExpiredBanner />
                  <AppRoutes />
                  <CertificadoHandicapDialog />
                  <PWAUpdatePrompt />
                  <BrowserUpdatePrompt />
                  <OfflineIndicator />
                </IdleProvider>
              </SessionExpiredProvider>
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

      <Route
        path="/admin/leads"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyLeadsPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyAdminChatAnalyticsPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/assistant/faq"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyAdminAssistantFaqEditorPage />
            </ResponsiveLayout>
          </ProtectedRoute>
        }
      />

      {/* Super-admin control plane: solo build DeCamino (no HERA). Separado del panel /admin. */}
      {!config.IS_HERA && (
        <>
          <Route
            path="/superadmin/tenants"
            element={
              <ProtectedRoute>
                <ResponsiveLayout>
                  <LazySuperAdminTenantsPage />
                </ResponsiveLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tenants"
            element={<Navigate to="/superadmin/tenants" replace />}
          />
        </>
      )}
      {config.IS_HERA && (
        <Route
          path="/admin/tenants"
          element={<Navigate to="/admin" replace />}
        />
      )}

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

      {/* Ruta para presupuestos e informes */}
      <Route
        path="/presupuestos-informes"
        element={
          <ProtectedRoute>
            <ResponsiveLayout>
              <LazyPresupuestosInformesPage />
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