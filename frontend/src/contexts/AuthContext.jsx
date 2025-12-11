import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import activityLogger from '../utils/activityLogger';
import { clearAvatarCache } from '../utils/avatarCache';
import { routes } from '../utils/routes.js';
import { auth, debug } from '../utils/logger';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { AuthContext } from './AuthContextBase';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('auth_token') || null);
  const navigate = useNavigate();
  const { handleApiError, handleNetworkError } = useErrorHandler();

  useEffect(() => {
    // Verifică dacă există un utilizator salvat în localStorage
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('auth_token');
    setAuthToken(savedToken); // Update authToken state

    const loadMe = async () => {
      // Dacă avem user salvat și pare valid, îl punem imediat pentru a evita flicker
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        const hasCore =
          (parsedUser?.CODIGO || parsedUser?.email || parsedUser?.['CORREO ELECTRONICO']) &&
          (parsedUser?.GRUPO || parsedUser?.role);
        if (hasCore) {
          setUser(parsedUser);
        }
      }

      // Dacă avem token, încercăm refresh la /api/me pentru date canonice
      if (savedToken) {
        try {
          const res = await fetch(routes.me, {
            headers: {
              Authorization: `Bearer ${savedToken}`,
              Accept: 'application/json',
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.success && data?.user) {
              const mergedUser = {
                ...data.user,
                // backward compat pentru câmpuri uzate în UI
                role: data.user.role || data.user.GRUPO || data.user.grupo || data.user.GRUPO || 'EMPLEADOS',
              };
              localStorage.setItem('user', JSON.stringify(mergedUser));
              setUser(mergedUser);
              debug('AuthContext - /api/me refreshed user from backend.');
            }
          } else {
            debug('AuthContext - /api/me failed with status:', res.status);
          }
        } catch (e) {
          console.warn('AuthContext - /api/me error:', e);
        }
      }

      setLoading(false);
    };

    loadMe();
  }, []);

  // Gestionare navigare pentru browser back button
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Salvează starea curentă în sessionStorage
      sessionStorage.setItem('lastPath', window.location.pathname);
    };

    const handlePopState = () => {
      // Gestionează navigarea înapoi
      const lastPath = sessionStorage.getItem('lastPath');
      if (lastPath && lastPath !== window.location.pathname) {
        // Navighează la ultima pagină validă
        navigate(lastPath, { replace: true });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate]);

  const login = async (email, password) => {
    // Ya no se requiere checkbox - el usuario acepta automáticamente al iniciar sesión

    try {
      // Configurar timeout y headers para el request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout

      auth('Intentando login en:', routes.login);
      
      // Usar routes.login que folosește proxy în development
      const loginUrl = routes.login;
      
      auth('Using URL:', loginUrl, 'Production mode:', import.meta.env.PROD);
      
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-App-Source': 'DeCamino-Web-App', // Header para identificar solicitud desde la aplicación
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        },
        signal: controller.signal,
        mode: 'cors', // Especificar modo CORS
        credentials: 'omit', // No enviar cookies para evitar problemas CORS
        body: JSON.stringify({
          email,
          password
        })
      });
      
      clearTimeout(timeoutId);

      auth('Respuesta del servidor:', res.status, res.statusText);

      if (!res.ok) {
        // Intentar leer el cuerpo para extraer mensaje del backend (ej. 401)
        try {
          const errData = await res.json();
          const backendMsg = (Array.isArray(errData) && errData[0]?.body?.error)
            || errData?.error
            || (Array.isArray(errData) && errData[0]?.body?.message)
            || errData?.message
            || `Error del servidor: ${res.status} ${res.statusText}`;
          
          // Gestionează eroarea cu error handler
          handleApiError(new Error(backendMsg), 'Login');
          return { success: false, error: backendMsg };
        } catch (parseError) {
          // Gestionează eroarea de parsing
          handleApiError(parseError, 'Login - JSON Parse');
          if (res.status === 500) {
            return { success: false, error: 'Error interno del servidor. Por favor, contacta al administrador.' };
          } else if (res.status === 0) {
            return { success: false, error: 'Error de conexión. Verifica tu conexión a internet.' };
          } else {
            return { success: false, error: `Error del servidor: ${res.status} ${res.statusText}` };
          }
        }
      }

      // Verificar si la respuesta es JSON válido
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('El servidor no devolvió una respuesta JSON válida');
      }

      const data = await res.json();
      auth('Datos recibidos:', data);
      
      // Nueva estructura soportada: [{ status: 200, body: { success: true, user: {...} } }]
      let found = undefined;
      let successFlag = undefined;
      if (Array.isArray(data) && data.length > 0 && data[0]?.body) {
        successFlag = data[0]?.body?.success;
        if (successFlag && data[0]?.body?.user) {
          found = data[0].body.user;
        }
      } else if (data && data.success !== undefined) {
        successFlag = data.success;
        if (data.success && data.user) {
          found = data.user;
        }
      }

      // Compatibilidad con el backend antiguo (lista de empleados en crudo)
      if (!found) {
      const users = Array.isArray(data) ? data : [data];
      users.forEach(u => {
        const userEmail = u['CORREO ELECTRONICO'] || u[8];
        const userParola = String(u['D.N.I. / NIE'] || u[4]);
        if (userEmail === email && userParola === password) {
          found = u;
        }
      });
      }

      if (!found) {
        const msg = (Array.isArray(data) && data[0]?.body?.message) || data?.message || 'Correo o contraseña incorrecta';
        return { success: false, error: msg };
      }
 
      // Validación de estado activo
      const estadoRaw = (found['ESTADO'] || found.estado || '').toString().trim().toUpperCase();
      if (estadoRaw && estadoRaw !== 'ACTIVO') {
        return { success: false, error: 'Usuario inactivo' };
      }

      const grupo = found['GRUPO'] || found[16] || '';
      
      // Detectar automáticamente el rol desde el backend
      let role = 'EMPLEADOS'; // default
      if (grupo === 'Manager' || grupo === 'Supervisor') {
        role = 'MANAGER';
      } else if (grupo === 'Developer') {
        role = 'DEVELOPER';
      } else if (grupo === 'Admin') {
        role = 'ADMIN';
      }

      // Crear el objeto usuario
      const userObj = {
        email: found['CORREO ELECTRONICO'] || found.email || found[8],
        isManager: grupo === 'Manager' || grupo === 'Supervisor' || grupo === 'Developer',
        role,
        GRUPO: grupo,
        lastLoginIp: found.ip || undefined,
        ...found
      };
      
      // Debug: Verificar si CENTRO TRABAJO se preserva
      debug('AuthContext - found object keys:', Object.keys(found));
      debug('AuthContext - found["CENTRO TRABAJO"]:', found['CENTRO TRABAJO']);
      debug('AuthContext - found["DerechoPedidos"]:', found['DerechoPedidos']);
      debug('AuthContext - userObj keys:', Object.keys(userObj));
      debug('AuthContext - userObj["CENTRO TRABAJO"]:', userObj['CENTRO TRABAJO']);
      debug('AuthContext - userObj["DerechoPedidos"]:', userObj['DerechoPedidos']);
      
      // Verifică dacă DerechoPedidos se salvează corect în userObj
      debug('AuthContext - Verificare finală DerechoPedidos:');
      debug('AuthContext - userObj.DerechoPedidos:', userObj.DerechoPedidos);
      debug('AuthContext - userObj keys final:', Object.keys(userObj));
      
      // Guardar token si user en localStorage y state
      // Salvează token-ul JWT dacă există în răspuns
      if (data.accessToken) {
        localStorage.setItem('auth_token', data.accessToken);
        setAuthToken(data.accessToken); // Update state
        auth('Token salvat în localStorage');
      }
      
      localStorage.setItem('user', JSON.stringify(userObj));
      setUser(userObj);

      // Încercăm să luăm user canonic din backend (/api/me) dacă avem token
      if (data.accessToken) {
        try {
          const meRes = await fetch(routes.me, {
            headers: {
              Authorization: `Bearer ${data.accessToken}`,
              Accept: 'application/json',
            },
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData?.success && meData?.user) {
              const mergedUser = {
                ...meData.user,
                role:
                  meData.user.role ||
                  meData.user.GRUPO ||
                  meData.user.grupo ||
                  userObj.role ||
                  'EMPLEADOS',
              };
              localStorage.setItem('user', JSON.stringify(mergedUser));
              setUser(mergedUser);
              debug('AuthContext - user refreshed from /api/me after login');
            }
          } else {
            auth('AuthContext - /api/me refresh failed', meRes.status, meRes.statusText);
          }
        } catch (e) {
          console.warn('AuthContext - error refreshing /api/me:', e);
        }
      }
      
      // Verifică dacă DerechoPedidos se salvează corect în localStorage
      const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
      debug('AuthContext - localStorage.DerechoPedidos:', savedUser.DerechoPedidos);

      // Log login (con delay para evitar requests simultáneos)
      // Folosește setTimeout cu cleanup pentru a preveni memory leaks
      setTimeout(() => {
        activityLogger.logLogin(userObj).catch(error => {
          console.error('Error logging login:', error);
        });
      }, 1000);
      
      return { success: true, user: userObj };
    } catch (e) {
      console.error('Login error:', e);
      
      // Gestionează eroarea cu error handler
      handleNetworkError(e, 'Login');
      
      // Manejar diferentes tipos de errores
      if (e.name === 'AbortError') {
        return { success: false, error: 'Tiempo de espera agotado. Intenta nuevamente.' };
      } else if (e.message.includes('Failed to fetch')) {
        return { success: false, error: 'Error de conexión. Verifica tu conexión a internet o contacta al administrador.' };
      } else if (e.message.includes('CORS')) {
        return { success: false, error: 'Error de configuración del servidor. Contacta al administrador.' };
      } else {
        return { success: false, error: e.message || 'No se pudo conectar con el servidor.' };
      }
    }
  };

  const logout = async () => {
    // Log logout (non-blocking, nu așteaptă)
    if (user) {
      activityLogger.logLogout(user).catch(error => {
        console.error('Error logging logout:', error);
      });
    }
    
    // Navighează imediat fără să aștepte logging-ul
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token'); // Șterge și token-ul JWT
    setAuthToken(null); // Update state
    clearAvatarCache();
    sessionStorage.removeItem('lastPath');
    navigate('/login', { replace: true });
  };

  // Función para login directo en modo DEMO
  const loginDemo = () => {
    const demoUser = {
      id: "demo_admin",
      email: "admin@demo.com",
      "NOMBRE / APELLIDOS": "Carlos Antonio Rodríguez",
      "CODIGO": "ADM001",
      "GRUPO": "Admin",
      role: "ADMIN",
      isManager: true,
      centro: "Madrid",
      telefono: "+34 600 123 456",
      fechaAlta: "2023-01-15",
      "FECHA DE ALTA": "2023-01-15",
      "Fecha Antigüedad": "2023-01-15",
      "Antigüedad": "2 años, 8 meses",
      activo: true,
      isDemo: true,
      
      // Datos personales completos
      "CORREO ELECTRONICO": "admin@demo.com",
      "NACIONALIDAD": "Española",
      "DIRECCION": "Calle Gran Vía, 123, 28013 Madrid",
      "D.N.I. / NIE": "12345678Z",
      "SEGURIDAD SOCIAL": "12/3456789/01",
      "NUMERO CUENTA": "ES21 2100 0813 6101 2345 6789",
      "TELEFONO": "+34 600 123 456",
      "EMAIL": "admin@demo.com",
      
      // Datos laborales
      "CARGO": "Administrador del Sistema",
      "DEPARTAMENTO": "Administración",
      "SUPERVISOR": "María González López",
      "HORARIO": "Lunes a Viernes 09:00-18:00",
      "TIPO CONTRATO": "Indefinido",
      "SALARIO BASE": "3.200,00€",
      "CATEGORIA": "Administrativo",
      "CENTRO TRABAJO": "Madrid Centro",
      
      // Datos adicionales
      "FECHA NACIMIENTO": "1985-03-15",
      "LUGAR NACIMIENTO": "Madrid, España",
      "ESTADO CIVIL": "Casado",
      "HIJOS": "2",
      "EMERGENCIA CONTACTO": "Ana Rodríguez",
      "EMERGENCIA TELEFONO": "+34 600 987 654",
      "ALERGIA": "Ninguna",
      "MEDICAMENTOS": "Ninguno",
      
      // Permisos y certificados
      "PERMISO CONDUCIR": "B, BTP",
      "VEHICULO PROPIO": "Sí",
      "CERTIFICADO MEDICO": "Vigente hasta 2025-12-31",
      "FORMACION PREVENCIÓN": "Completada",
      "PRIMEROS AUXILIOS": "Certificado vigente"
    };
    
    setUser(demoUser);
    localStorage.setItem('user', JSON.stringify(demoUser));
    navigate('/dashboard');
    
    // Log actividad demo
    activityLogger.logAction('demo_login', {
      user: 'Admin Demo',
      email: 'admin@demo.com',
      sistema: 'DEMO',
      descripcion: 'Inicio de sesión en modo DEMO'
    });
    
    return { success: true };
  };

  const value = {
    user,
    login,
    loginDemo,
    logout,
    isAuthenticated: !!user,
    loading,
    authToken, // Export token for API calls
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 