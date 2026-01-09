import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, ClipboardList, Clock, MoreHorizontal, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContextBase';
import { useAdminApi } from '../../hooks/useAdminApi';
import { useComunicadosApi } from '../../hooks/useComunicadosApi';
import { useState, useEffect, useMemo } from 'react';
import MobileMoreDrawer from './MobileMoreDrawer';

/**
 * MobileBottomNav - Bottom navigation bar pentru mobile
 * Afișează 5 iteme principale cu navigare funcțională
 */
const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getPermissions } = useAdminApi();
  const { getUnreadCount } = useComunicadosApi();
  const [userPermissions, setUserPermissions] = useState(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [comunicadosUnreadCount, setComunicadosUnreadCount] = useState(0);
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);

  const userGrupo = user?.GRUPO || '';

  // Încarcă permisiunile
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const permissions = await getPermissions();
        setUserPermissions(permissions);
      } catch (error) {
        console.error('Error loading permissions:', error);
      } finally {
        setLoadingPermissions(false);
      }
    };

    loadPermissions();
  }, [getPermissions]);

  // Obține numărul de comunicados necitite
  useEffect(() => {
    if (!user?.userId && !user?.CODIGO) return;

    const loadUnreadCount = async () => {
      try {
        const count = await getUnreadCount();
        setComunicadosUnreadCount(count);
      } catch (err) {
        console.error('[MobileBottomNav] Error loading unread comunicados count:', err);
        setComunicadosUnreadCount(0);
      }
    };

    loadUnreadCount();
    // Reîncarcă la fiecare 30 de secunde pentru a actualiza badge-ul
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user?.userId, user?.CODIGO, getUnreadCount]);

  // Helper pentru verificarea permisiunilor
  const findGrupoKey = (grupo, permissions) => {
    if (!permissions || !grupo) return null;
    const keys = Object.keys(permissions);
    return keys.find(key => key.toLowerCase() === grupo.toLowerCase()) || null;
  };

  const hasPermission = useMemo(() => {
    if (!userPermissions || !userGrupo) return () => false;
    const grupoKey = findGrupoKey(userGrupo, userPermissions);
    if (!grupoKey) return () => false;
    const grupoPerms = userPermissions[grupoKey];
    return (perm) => grupoPerms && grupoPerms[perm] === true;
  }, [userPermissions, userGrupo]);

  // Verifică dacă utilizatorul este manager/admin
  const isManager = useMemo(() => {
    const managerGroups = ['Manager', 'Supervisor', 'Admin', 'Developer'];
    return managerGroups.some(g => g.toLowerCase() === userGrupo.toLowerCase());
  }, [userGrupo]);

  // Verifică permisiunile pentru fiecare item
  const canAccessEmpleados = useMemo(() => {
    if (loadingPermissions) return false;
    if (!userPermissions || Object.keys(userPermissions).length === 0) {
      return isManager; // Fallback pentru manageri
    }
    const grupoKey = findGrupoKey(userGrupo, userPermissions);
    if (!grupoKey) return isManager;
    return hasPermission('empleados') || isManager;
  }, [userPermissions, userGrupo, hasPermission, isManager, loadingPermissions]);

  const canAccessSolicitudes = useMemo(() => {
    if (loadingPermissions) return true; // Default permis
    if (!userPermissions || Object.keys(userPermissions).length === 0) {
      return true; // Fallback - permis pentru toți
    }
    const grupoKey = findGrupoKey(userGrupo, userPermissions);
    if (!grupoKey) return true;
    return hasPermission('solicitudes') || hasPermission('dashboard') || true;
  }, [userPermissions, userGrupo, hasPermission, loadingPermissions]);

  const canAccessFichar = useMemo(() => {
    if (loadingPermissions) return true; // Default permis
    if (!userPermissions || Object.keys(userPermissions).length === 0) {
      return true; // Fallback - permis pentru toți (fichar e disponibil pentru toți)
    }
    const grupoKey = findGrupoKey(userGrupo, userPermissions);
    if (!grupoKey) return true;
    return hasPermission('fichar') || hasPermission('dashboard') || true;
  }, [userPermissions, userGrupo, hasPermission, loadingPermissions]);

  // Itemele de navigare
  const navItems = useMemo(() => {
    const items = [];

    // Inicio - primul
    items.push({
      id: 'inicio',
      label: 'Inicio',
      icon: Home,
      path: '/inicio',
      show: true,
    });

    // Registro de Jornada - al doilea
    if (canAccessFichar) {
      items.push({
        id: 'fichaje',
        label: 'Registro de Jornada',
        icon: Clock,
        path: '/fichaje',
        show: true,
      });
    }

    // Solicitudes - al treilea
    if (canAccessSolicitudes) {
      items.push({
        id: 'solicitudes',
        label: 'Solicitudes',
        icon: ClipboardList,
        path: '/solicitudes',
        show: true,
      });
    }

    // Empleados sau Comunicados - înainte de Más
    // Dacă are acces la Empleados, afișează Empleados
    // Dacă nu are acces, afișează Comunicados (disponibil pentru toți)
    if (canAccessEmpleados) {
      items.push({
        id: 'empleados',
        label: 'Empleados',
        icon: Users,
        path: '/empleados',
        show: true,
      });
    } else {
      // Comunicados - disponibil pentru toți utilizatorii
      items.push({
        id: 'comunicados',
        label: 'Comunicados',
        icon: FileText,
        path: '/comunicados',
        show: true,
        notificationCount: comunicadosUnreadCount > 0 ? comunicadosUnreadCount : undefined,
      });
    }

    // "Más" - întotdeauna ultimul
    items.push({
      id: 'mas',
      label: 'Más',
      icon: MoreHorizontal,
      path: '/inicio', // Va deschide QuickAccessOrb sau drawer
      show: true,
      isMore: true,
    });

    return items;
  }, [canAccessEmpleados, canAccessSolicitudes, canAccessFichar, comunicadosUnreadCount]);

  // Verifică dacă o rută este activă
  const isActive = (path) => {
    if (path === '/inicio') {
      return location.pathname === '/inicio' || location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // Handler pentru click
  const handleNavClick = (item) => {
    if (item.isMore) {
      // Pentru "Más", deschide drawer-ul cu toate opțiunile
      setIsMoreDrawerOpen(true);
    } else {
      navigate(item.path);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-800/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 safe-area-bottom" style={{ position: 'fixed' }}>
      <div className="flex items-center justify-around h-16 px-2 max-w-screen-xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={`
                flex flex-col items-center justify-center flex-1 min-w-0 px-2 py-1
                transition-colors duration-200
                ${active 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }
              `}
              aria-label={item.label}
            >
              <div className="relative">
                <Icon 
                  className={`w-6 h-6 transition-transform ${active ? 'scale-110' : ''}`}
                  strokeWidth={active ? 2.5 : 2}
                />
                {active && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-red-600 dark:bg-red-400 rounded-full"></div>
                )}
                {/* Badge pentru comunicări necitite */}
                {item.notificationCount && item.notificationCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow-md border-2 border-white dark:border-gray-800">
                    {item.notificationCount > 99 ? '99+' : item.notificationCount}
                  </div>
                )}
              </div>
              <span 
                className={`
                  text-[10px] mt-0.5 font-medium truncate w-full text-center
                  ${active ? 'font-semibold' : 'font-normal'}
                `}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Drawer pentru "Más" */}
      <MobileMoreDrawer
        isOpen={isMoreDrawerOpen}
        onClose={() => setIsMoreDrawerOpen(false)}
      />
    </nav>
  );
};

export default MobileBottomNav;
