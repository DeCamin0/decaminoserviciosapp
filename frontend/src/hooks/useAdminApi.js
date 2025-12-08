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
  const getPermissions = useCallback(async (userGrupo = null, module = null) => {
    try {
      // Construiește URL-ul cu parametrul grupo_module în format "Grupo_Module"
      let url = routes.getPermissions;
      if (userGrupo && module) {
        const grupoModule = `${userGrupo}_${module}`;
        url += `?grupo_module=${encodeURIComponent(grupoModule)}`;
      } else if (userGrupo) {
        url += `?grupo_module=${encodeURIComponent(userGrupo)}`;
      }
      
      console.log('Fetching permissions from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        throw new Error(`Error fetching permissions: ${response.status}`);
      }

      const responseText = await response.text();
      console.log('Raw response text:', responseText);

      if (!responseText || responseText.trim() === '') {
        console.warn('Empty response received, using defaults');
        return getDefaultPermissions();
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        console.error('Response text was:', responseText);
        throw new Error('Invalid JSON response from server');
      }

      console.log('Permissions data received:', data);
      
      // Verifică dacă răspunsul conține un array de permisiuni
      if (data && Array.isArray(data)) {
        console.log('Processing array of permissions:', data.length, 'items');
        
        // Procesează toate permisiunile din array cu noua structură grupo_module
        const permissions = {};
        
        for (const item of data) {
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
              permissions[grupo][module] = permitted === 'true' || permitted === true || permitted === '1' || permitted === 1;
            }
          }
        }
        
        console.log('Processed all permissions:', permissions);
        return permissions;
      } else if (data && typeof data === 'object') {
        console.log('Processing single permission object:', data);
        
        // Creează obiectul de permisiuni din obiectul primit cu noua structură
        const permissions = {};
        const grupoModule = data.grupo_module;
        const permitted = data.permitted;
        
        if (grupoModule) {
          const parts = grupoModule.split('_');
          if (parts.length >= 2) {
            const grupo = parts[0];
            const module = parts.slice(1).join('_');
            
            if (!permissions[grupo]) {
              permissions[grupo] = {};
            }
            permissions[grupo][module] = permitted === 'true' || permitted === true || permitted === '1' || permitted === 1;
          }
        }
        
        console.log('Processed single permission:', permissions);
        return permissions;
      } else {
        console.warn('No permissions found in response, using defaults');
        return getDefaultPermissions();
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      return getDefaultPermissions();
    }
  }, []);

  // Funcție specifică pentru permisiuni empleados (acum folosește același endpoint universal)
  const getPermissionsEmpleados = async () => {
    return await getPermissions(); // Folosește același endpoint universal
  };

  // Funcție specifică pentru Control Acces (toate permisiunile)
  const getAllPermissions = async () => {
    try {
      const response = await fetch(routes.getPermissionsAdmin, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      console.debug('[DEBUG] AccessMatrix - response status:', response.status);
      console.debug('[DEBUG] AccessMatrix - response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error(`Error fetching all permissions: ${response.status}`);
      }

      const responseText = await response.text();

      console.debug('[DEBUG] AccessMatrix - raw response length:', responseText.length);
      console.debug('[DEBUG] AccessMatrix - raw response sample:', responseText.slice(0, 200));

      if (!responseText || responseText.trim() === '') {
        return getDefaultPermissions();
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[DEBUG] AccessMatrix - JSON parse error:', parseError);
        console.error('[DEBUG] AccessMatrix - response text that failed:', responseText);
        throw new Error('Invalid JSON response from server');
      }
      
      console.debug('[DEBUG] AccessMatrix - parsed data type:', Array.isArray(data) ? 'array' : typeof data);
      if (Array.isArray(data)) {
        console.debug('[DEBUG] AccessMatrix - parsed data sample:', data.slice(0, 3));
      } else {
        console.debug('[DEBUG] AccessMatrix - parsed data keys:', Object.keys(data || {}));
      }
      
      // Verifică dacă răspunsul conține un array de permisiuni
      if (data && Array.isArray(data)) {
        // Procesează toate permisiunile din array cu noua structură grupo_module
        const permissions = {};
        
        for (const item of data) {
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
        
        return permissions;
      } else {
        return getDefaultPermissions();
      }
    } catch (error) {
      console.error('Error fetching all permissions:', error);
      return getDefaultPermissions();
    }
  };

  const savePermissions = async (permissions) => {
    try {
      console.log('Saving permissions to:', routes.savePermissions);
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
      console.log('Full request URL:', routes.savePermissions);
      console.log('Request body:', JSON.stringify(permissionsArray, null, 2));
      
      const response = await fetch(routes.savePermissions, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permissionsArray)
      });

      console.log('Save response status:', response.status);
      console.log('Save response headers:', response.headers);
      console.log('Save response url:', response.url);

      if (!response.ok) {
        throw new Error(`Error saving permissions: ${response.status}`);
      }

      const responseText = await response.text();
      console.log('Raw save response text:', responseText);

      if (!responseText || responseText.trim() === '') {
        console.warn('Empty save response received, assuming success');
        return { success: true, message: 'Permissions saved successfully' };
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse save JSON response:', parseError);
        console.error('Save response text was:', responseText);
        return { success: true, message: 'Permissions saved (no confirmation received)' };
      }

      console.log('Save response data:', data);
      return data;
    } catch (error) {
      console.error('Error saving permissions:', error);
      throw error;
    }
  };

  // Log activitate
  // Funcție pentru a obține toți utilizatorii din baza de date
  const getAllUsers = async () => {
    try {
      console.log('[DEBUG] Fetching all users from database...');
      
      const response = await fetch(routes.getUsuarios, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Source': 'DeCamino-Web-App',
          'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
          'X-Client-Type': 'web-browser',
          'User-Agent': 'DeCamino-Web-Client/1.0'
        }
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

  const getActivityLog = async (filters = {}) => {
    try {
      // Încearcă mai întâi endpoint-ul original
      console.log('[DEBUG] Trying original endpoint:', routes.getActivityLog);
      
      let url = routes.getActivityLog;
      const params = new URLSearchParams();
      
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.offset) params.append('offset', filters.offset);
      if (filters.user) params.append('user', filters.user);
      if (filters.action) params.append('action', filters.action);
      if (filters.date) params.append('date', filters.date);
      
      // Adaugă parametri pentru a obține toate logurile
      params.append('all', 'true');
      params.append('limit', '10000'); // Mărește limita pentru a obține toate logurile
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      console.log('[DEBUG] Full URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('[DEBUG] Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const responseText = await response.text();
      console.log('[DEBUG] Response length:', responseText.length);
      
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response');
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Invalid JSON response');
      }
      
      console.log('[DEBUG] Data type:', typeof data);
      console.log('[DEBUG] Data length:', Array.isArray(data) ? data.length : 'not array');
      
      // Folosește doar datele reale din backend
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        console.log('[DEBUG] Received single log, converting to array');
        return [data];
      } else if (Array.isArray(data) && data.length > 0) {
        console.log('[DEBUG] Received array with', data.length, 'real logs');
        console.log('[DEBUG] First 3 logs:', data.slice(0, 3));
        return data;
      } else {
        console.log('[DEBUG] No valid data received, returning empty array');
        return [];
      }
      
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