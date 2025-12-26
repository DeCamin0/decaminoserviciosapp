import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextBase';
import { useEffect, useState, useRef } from 'react';
import { useAdminApi } from '../hooks/useAdminApi';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const { getPermissions } = useAdminApi();
  const location = useLocation();
  const [checkingPermissions, setCheckingPermissions] = useState(false);
  const lastCheckedPath = useRef('');

  // Gestionare navigare pentru browser back button
  useEffect(() => {
    if (isAuthenticated && !loading) {
      // Salvează ruta curentă în sessionStorage
      sessionStorage.setItem('lastPath', location.pathname);
      
      // Log pentru debugging
      console.log('Protected route accessed:', location.pathname);
    }
  }, [location, isAuthenticated, loading]);

  // Verifică permisiunile când se navighează
  useEffect(() => {
    // Se execută doar când se schimbă ruta și utilizatorul este autentificat
    if (isAuthenticated && user && location.pathname !== lastCheckedPath.current) {
      const checkPermissions = async () => {
        setCheckingPermissions(true);
        lastCheckedPath.current = location.pathname;
        
        try {
          // Determină modulul din URL
          const path = location.pathname;
          let module = 'inicio'; // default
          
          if (path.includes('/empleados')) module = 'empleados';
          else if (path.includes('/fichar')) module = 'fichar';
          else if (path.includes('/cuadrantes')) module = 'cuadrantes';
          else if (path.includes('/estadisticas')) module = 'estadisticas';
          else if (path.includes('/clientes')) module = 'clientes';
          else if (path.includes('/documentos')) module = 'documentos';
          else if (path.includes('/solicitudes')) module = 'solicitudes';
          else if (path.includes('/aprobaciones')) module = 'aprobaciones';
          else if (path.includes('/cuadernos')) module = 'cuadernos';
          else if (path.includes('/admin')) module = 'admin';
          
          console.log('🔐 ProtectedRoute: Checking permissions for module:', module);
          console.log('👤 ProtectedRoute: User grupo:', user?.GRUPO);
          console.log('📍 ProtectedRoute: Current path:', location.pathname);
          
          // Verifică permisiunile pentru modulul curent
          const permissionsData = await getPermissions(user?.GRUPO, module);
          
          console.log('✅ ProtectedRoute: Permissions received:', permissionsData);
          
        } catch (error) {
          console.error('❌ ProtectedRoute: Error checking permissions:', error);
        } finally {
          setCheckingPermissions(false);
        }
      };
      
      checkPermissions();
    }
  }, [location.pathname, isAuthenticated, user, getPermissions]); // Doar când se schimbă ruta

  if (loading || checkingPermissions) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Salvează ruta curentă pentru a reveni după login
    sessionStorage.setItem('redirectAfterLogin', location.pathname);
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute; 