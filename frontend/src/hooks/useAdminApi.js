// Hook pentru API-ul de administrare
import { useCallback } from 'react';
import { routes } from '../utils/routes.js';

export const useAdminApi = () => {
  // Statistici generale
  const getAdminStats = async (period = '7d') => {
    // Folosește întotdeauna logurile reale pentru statistici
    console.log('[DEBUG] Generating stats from real activity logs for period:', period);
    return generateStatsFromActivityLogs(period);
  };

  // Funcție pentru generarea statisticilor din logurile de activitate
  const generateStatsFromActivityLogs = async (period = '7d') => {
    try {
      // Obține logurile de activitate
      const activityLogs = await getActivityLog();
      
      if (!Array.isArray(activityLogs) || activityLogs.length === 0) {
        console.log('[DEBUG] No activity logs available');
        return {
          activeUsersToday: 0,
          uniqueUsersWeek: 0,
          totalUsers: 0,
          mostAccessedModules: [],
          loginTrend: []
        };
      }
      
      console.log('[DEBUG] Generating stats from', activityLogs.length, 'activity logs');
      
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      // Calculează perioada în funcție de parametrul period
      const daysToSubtract = period === '30d' ? 30 : 7;
      const periodAgo = new Date(now.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
      
      console.log('[DEBUG] Period:', period, 'Days to subtract:', daysToSubtract);
      console.log('[DEBUG] Period ago date:', periodAgo.toISOString());
      
      // Utilizatori activi azi
      const todayLogs = activityLogs.filter(log => 
        log.timestamp && log.timestamp.startsWith(today)
      );
      const activeUsersToday = new Set(todayLogs.map(log => log.user)).size;
      
      console.log('[DEBUG] Today logs count:', todayLogs.length);
      console.log('[DEBUG] Today logs:', todayLogs.slice(0, 5)); // Afișează primele 5 loguri de azi
      
      // Utilizatori unici în perioada selectată
      const periodLogs = activityLogs.filter(log => 
        log.timestamp && new Date(log.timestamp) >= periodAgo
      );
      const uniqueUsersPeriod = new Set(periodLogs.map(log => log.user)).size;
      
      // Total utilizatori (din toate logurile)
      const totalUsers = new Set(activityLogs.map(log => log.user)).size;
      
      console.log('[DEBUG] Total users calculation:');
      console.log('[DEBUG] - All logs count:', activityLogs.length);
      console.log('[DEBUG] - Unique users found:', totalUsers);
      console.log('[DEBUG] - Sample users:', Array.from(new Set(activityLogs.map(log => log.user))).slice(0, 5));
      
      // Evoluția login-urilor zilnice (ultimele N zile, în funcție de period)
      const trendDays = period === '30d' ? 30 : 7;
      const loginTrend = [];
      for (let i = trendDays - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        const dayLogs = activityLogs.filter(log => 
          log.timestamp && log.timestamp.startsWith(dateStr)
        );
        // Dedup: numărăm o singură dată login-ul per utilizator/zi
        const dayLoginUsers = new Set(dayLogs.filter(log => log.action === 'login').map(log => log.user)).size;
        const loginCount = dayLoginUsers;
        const uniqueUsers = new Set(dayLogs.map(log => log.user)).size;
        
        // Debug pentru azi
        if (dateStr === today) {
          console.log('[DEBUG] Today login count:', loginCount);
          console.log('[DEBUG] Today unique users:', uniqueUsers);
        }
        
        loginTrend.push({
          date: dateStr,
          logins: loginCount,
          uniqueUsers: uniqueUsers
        });
      }
      
      // Modulele cele mai accesate (bazate pe URL-uri din loguri pentru perioada selectată)
      const moduleAccess = {};
      periodLogs.forEach(log => {
        if (log.url) {
          const module = log.url.split('/').pop() || 'dashboard';
          moduleAccess[module] = (moduleAccess[module] || 0) + 1;
        }
      });
      
      const mostAccessedModules = Object.entries(moduleAccess)
        .map(([name, count]) => ({ name, count, percentage: Math.round((count / periodLogs.length) * 100) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      const stats = {
        activeUsersToday,
        uniqueUsersWeek: uniqueUsersPeriod, // Folosește perioada selectată
        totalUsers,
        mostAccessedModules,
        loginTrend
      };
      
      console.log('[DEBUG] Generated stats:', stats);
      return stats;
      
    } catch (error) {
      console.error('Error generating stats from activity logs:', error);
      return {
        activeUsersToday: 0,
        uniqueUsersWeek: 0,
        totalUsers: 0,
        mostAccessedModules: [],
        loginTrend: []
      };
    }
  };

  // Funcție helper pentru permisiuni implicite
  const getDefaultPermissions = () => {
    return {
      Admin: {
        dashboard: true,
        empleados: true,
        fichar: true,
        cuadrantes: true,
        'cuadrantes-empleado': true,
        estadisticas: true,
        clientes: true,
        documentos: true,
        solicitudes: true,
        aprobaciones: true,
        cuadernos: true,
        admin: true
      },
      Developer: {
        dashboard: true,
        empleados: true,
        fichar: true,
        cuadrantes: true,
        'cuadrantes-empleado': true,
        estadisticas: true,
        clientes: true,
        documentos: true,
        solicitudes: true,
        aprobaciones: true,
        cuadernos: true,
        admin: true
      },
      Supervisor: {
        dashboard: true,
        empleados: true,
        fichar: true,
        cuadrantes: true,
        'cuadrantes-empleado': true,
        estadisticas: true,
        clientes: true,
        documentos: true,
        solicitudes: true,
        aprobaciones: true,
        cuadernos: true,
        admin: false
      },
      Manager: {
        dashboard: true,
        empleados: true,
        fichar: true,
        cuadrantes: true,
        'cuadrantes-empleado': true,
        estadisticas: true,
        clientes: true,
        documentos: true,
        solicitudes: true,
        aprobaciones: false,
        cuadernos: true,
        admin: false
      },
      Operario: {
        dashboard: true,
        empleados: false,
        fichar: true,
        cuadrantes: false,
        'cuadrantes-empleado': true,
        estadisticas: false,
        clientes: false,
        documentos: true,
        solicitudes: true,
        aprobaciones: false,
        cuadernos: true,
        admin: false
      },
      Auxiliar: {
        dashboard: true,
        empleados: false,
        fichar: true,
        cuadrantes: false,
        'cuadrantes-empleado': true,
        estadisticas: false,
        clientes: false,
        documentos: true,
        solicitudes: true,
        aprobaciones: false,
        cuadernos: true,
        admin: false
      },
      Empleado: {
        dashboard: true,
        empleados: false,
        fichar: true,
        cuadrantes: false,
        'cuadrantes-empleado': false,
        estadisticas: false,
        clientes: false,
        documentos: true,
        solicitudes: true,
        aprobaciones: false,
        cuadernos: true,
        admin: false
      }
    };
  };

  // Permisiuni universale pentru toți utilizatorii
  const getPermissions = useCallback(async (userGrupo = null) => {
    try {
      // 1) Încearcă backend NestJS (direct DB)
      let urlBackend = routes.permissions;
      if (userGrupo) {
        const params = new URLSearchParams();
        params.set('grupo', userGrupo);
        urlBackend += `?${params.toString()}`;
      }

      console.log('[Permissions] Fetching from backend:', urlBackend);

      const backendRes = await fetch(urlBackend, { headers: { Accept: 'application/json' } });
      if (backendRes.ok) {
        const backendData = await backendRes.json();
        if (backendData?.success && Array.isArray(backendData.permissions)) {
          const permissions = {};
          for (const item of backendData.permissions) {
            const grupoModule = item.grupo_module;
            const permitted = item.permitted;
            if (grupoModule) {
              const parts = String(grupoModule).split('_');
              if (parts.length >= 2) {
                const grupo = parts[0];
                const module = parts.slice(1).join('_');
                if (!permissions[grupo]) permissions[grupo] = {};
                permissions[grupo][module] =
                  permitted === 'true' || permitted === true || permitted === '1' || permitted === 1;
              }
            }
          }
          console.log('[Permissions] From backend processed:', permissions);
          if (Object.keys(permissions).length > 0) {
            return permissions;
          }
        }
      } else {
        console.warn('[Permissions] Backend response not OK:', backendRes.status);
      }

      // Dacă backend-ul nu returnează date valide, folosim permisiuni default
      console.warn('[Permissions] No valid permissions from backend, using defaults');
      return getDefaultPermissions();
    } catch (error) {
      console.error('Error fetching permissions:', error);
      return getDefaultPermissions();
    }
  }, []);

  // Funcție specifică pentru permisiuni empleados (acum folosește același endpoint universal)
  const getPermissionsEmpleados = async () => {
    return await getPermissions(); // Folosește același endpoint universal
  };

  // ✅ MIGRAT: Funcție specifică pentru Control Acces (toate permisiunile)
  // Folosește backend /api/permissions fără parametru grupo pentru a obține toate permisiunile
  const getAllPermissions = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Backend endpoint: /api/permissions (fără parametru grupo = toate permisiunile)
      const url = routes.permissions; // Deja configurat în routes.js
      
      console.debug('[DEBUG] AccessMatrix - Fetching all permissions from backend:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      });

      console.debug('[DEBUG] AccessMatrix - response status:', response.status);
      console.debug('[DEBUG] AccessMatrix - response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error(`Error fetching all permissions: ${response.status}`);
      }

      const data = await response.json();

      console.debug('[DEBUG] AccessMatrix - parsed data type:', typeof data);
      console.debug('[DEBUG] AccessMatrix - parsed data keys:', Object.keys(data || {}));
      
      // Backend returnează: { success: true, count: number, permissions: [...] }
      if (data && data.success && Array.isArray(data.permissions)) {
        console.debug('[DEBUG] AccessMatrix - permissions array length:', data.permissions.length);
        console.debug('[DEBUG] AccessMatrix - parsed data sample:', data.permissions.slice(0, 3));
        
        // Procesează toate permisiunile din array cu noua structură grupo_module
        const permissions = {};
        
        for (const item of data.permissions) {
          const grupoModule = item.grupo_module;
          const permitted = item.permitted;
          
          if (grupoModule) {
            // Separă grupo și module din grupo_module (ex: "Developer_dashboard")
            const parts = grupoModule.split('_');
            
            if (parts.length >= 2) {
              const grupo = parts[0];
              const module = parts.slice(1).join('_'); // Pentru module cu underscore (ex: cuadrantes-empleado)
              
              if (!permissions[grupo]) {
                permissions[grupo] = {};
              }
              const isPermitted = permitted === 'true' || permitted === 'TRUE' || permitted === true || permitted === '1' || permitted === 1;
              permissions[grupo][module] = isPermitted;
            }
          }
        }
        
        console.debug('[DEBUG] AccessMatrix - processed permissions keys:', Object.keys(permissions));
        return permissions;
      } else {
        console.warn('[DEBUG] AccessMatrix - Invalid response format, using defaults');
        return getDefaultPermissions();
      }
    } catch (error) {
      console.error('Error fetching all permissions:', error);
      return getDefaultPermissions();
    }
  };

  // ✅ MIGRAT: folosește backend /api/permissions POST în loc de n8n
  const savePermissions = async (permissions) => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('Saving permissions to backend:', routes.permissions);
      console.log('Permissions to save:', permissions);
      
      // Transformă obiectul de permisiuni în format grupo_module pentru backend
      const permissionsArray = [];
      
      for (const grupo in permissions) {
        for (const module in permissions[grupo]) {
          const grupoModule = `${grupo}_${module}`;
          const permitted = permissions[grupo][module];
          
          permissionsArray.push({
            grupo_module: grupoModule,
            permitted: permitted,
            last_updated: new Date().toISOString().split('T')[0], // YYYY-MM-DD
            updated_by: 'admin@decamino.com'
          });
        }
      }
      
      console.log('Transformed permissions for backend:', permissionsArray);
      console.log('Full request URL:', routes.permissions);
      console.log('Request body:', JSON.stringify(permissionsArray, null, 2));
      
      const response = await fetch(routes.permissions, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(permissionsArray),
        credentials: 'include'
      });

      console.log('Save response status:', response.status);
      console.log('Save response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error saving permissions:', errorText);
        throw new Error(`Error saving permissions: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Save response data:', data);

      // Backend returnează: { success: true, message: string, count: number, permissions: [...] }
      if (data && data.success) {
        return data;
      } else {
        throw new Error('Invalid response format from backend');
      }
    } catch (error) {
      console.error('Error saving permissions:', error);
      throw error;
    }
  };

  // Log activitate
  // Funcție pentru a obține toți utilizatorii din baza de date
  // ✅ MIGRAT: folosește backend /api/empleados în loc de n8n
  const getAllUsers = async () => {
    try {
      console.log('[DEBUG] Fetching all users from backend /api/empleados...');
      
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        'X-Client-Type': 'web-browser',
        'User-Agent': 'DeCamino-Web-Client/1.0'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(routes.getEmpleados, {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      });
      
      console.log('[DEBUG] Users response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('[DEBUG] Users data received:', data);
      console.log('[DEBUG] Sample user data:', data[0]);
      console.log('[DEBUG] User data keys:', data[0] ? Object.keys(data[0]) : 'No data');
      
      if (Array.isArray(data)) {
        console.log('[DEBUG] Total users from database:', data.length);
        return data;
      } else {
        console.log('[DEBUG] Users data is not array:', typeof data);
        return [];
      }
      
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  };

  // ✅ MIGRAT: folosește backend /api/activity-logs în loc de n8n
  const getActivityLog = async (filters = {}) => {
    try {
      console.log('[DEBUG] Fetching activity logs from backend /api/activity-logs...');
      
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Construiește URL-ul pentru backend
      const baseUrl = import.meta.env.DEV
        ? 'http://localhost:3000/api/activity-logs'
        : 'https://api.decaminoservicios.com/api/activity-logs';
      
      const params = new URLSearchParams();
      
      // Adaptează filtrele pentru backend
      // Backend așteaptă: limit, action, email, grupo, dateFrom, dateTo
      // Frontend trimite: limit, action, user, date
      
      if (filters.limit) {
        params.append('limit', filters.limit.toString());
      } else {
        // Default limit mare pentru a obține toate logurile
        params.append('limit', '10000');
      }
      
      if (filters.action && filters.action !== 'todos') {
        params.append('action', filters.action);
      }
      
      // Pentru user, trebuie să găsim email-ul sau să folosim user direct
      // Backend suportă doar email, dar putem căuta după user (nume) în loguri
      // Pentru moment, ignorăm user filter dacă nu e email
      // TODO: Optimizare - adăugă suport pentru user (nume) în backend
      
      if (filters.date) {
        // Transformă date (YYYY-MM-DD) în dateFrom și dateTo pentru aceeași zi
        params.append('dateFrom', filters.date);
        // Adaugă 1 zi pentru a include toată ziua
        const dateObj = new Date(filters.date);
        dateObj.setDate(dateObj.getDate() + 1);
        params.append('dateTo', dateObj.toISOString().split('T')[0]);
      }
      
      const url = `${baseUrl}?${params.toString()}`;
      console.log('[DEBUG] Full URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      });
      
      console.log('[DEBUG] Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('[DEBUG] Response data:', data);
      
      // Backend returnează: { success: true, logs: [...], count: ... }
      let logs = [];
      if (data && data.success && Array.isArray(data.logs)) {
        logs = data.logs;
      } else if (Array.isArray(data)) {
        logs = data;
      } else if (data && Array.isArray(data.data)) {
        logs = data.data;
      }
      
      // Filtrare suplimentară pentru user (nume) dacă e specificat
      // (pentru că backend nu suportă încă filtrare după user/nume)
      if (filters.user && filters.user !== 'todos') {
        logs = logs.filter(log => 
          log.user && log.user.toLowerCase().includes(filters.user.toLowerCase())
        );
      }
      
      console.log('[DEBUG] Filtered logs count:', logs.length);
      console.log('[DEBUG] First 3 logs:', logs.slice(0, 3));
      
      return logs;
      
    } catch (error) {
      console.error('Error fetching activity log:', error);
      console.log('[DEBUG] Error fetching logs, returning empty array');
      return [];
    }
  };

  return {
    getAdminStats,
    getPermissions,
    getPermissionsEmpleados,
    getAllPermissions,
    savePermissions,
    getActivityLog,
    getAllUsers
  };
}; 