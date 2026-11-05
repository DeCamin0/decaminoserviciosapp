import { useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router';
import {
  Briefcase,
  ChevronDown,
  Home,
  Menu,
  PanelLeft,
  Settings,
  User,
  Users,
} from 'lucide-react';
import { useNavModules } from '../../contexts/NavModulesContext';
import {
  MODULE_CATEGORY_LABELS,
  MODULE_CATEGORY_ORDER,
  groupQuickAccessByCategory,
} from '../inicio-dashboard/categorizeQuickAccess';
import { useDesktopSidebarState } from '../../hooks/useDesktopSidebarState';
import { config } from '../../config/env.js';
import './DesktopSidebar.css';

const CAT_ICONS = {
  personal: User,
  equipo: Users,
  operacion: Briefcase,
  admin: Settings,
  otros: PanelLeft,
};

function pathMatches(href, pathname, search) {
  if (!href) return false;
  try {
    const url = new URL(href, window.location.origin);
    if (url.pathname !== pathname) return false;
    if (!url.search) return true;
    const want = new URLSearchParams(url.search);
    const have = new URLSearchParams(search || '');
    for (const [k, v] of want.entries()) {
      const current = have.get(k);
      if (current === v) continue;
      if (
        current == null &&
        ((k === 'tab' &&
          ['lista', 'cambios', 'empleados', 'clientes', 'generar', 'enviar', 'nuevo-pedido'].includes(
            v,
          )) ||
          (k === 'vista' && v === 'lista') ||
          (k === 'tab' && v === 'mis-pedidos' && pathname.includes('empleado-pedidos')))
      ) {
        continue;
      }
      return false;
    }
    return true;
  } catch {
    return pathname === href;
  }
}

function categoryHasActive(catItems, pathname, search) {
  return catItems.some((item) => {
    try {
      if (new URL(item.href, window.location.origin).pathname === pathname) return true;
    } catch {
      if (item.href === pathname) return true;
    }
    return Boolean(
      item.children?.some((c) => pathMatches(c.href, pathname, search)),
    );
  });
}

/** Same client logo as AppShell header (multi-client LOGO_PATH). */
function getSidebarLogoUrl() {
  const basePath = config.BASE_PATH || '/';
  const logoPath = config.LOGO_PATH || 'logo.svg';
  return `${basePath}${logoPath}`.replace(/\/+/g, '/');
}

/**
 * Global desktop sidebar (≥1200). Permissions via NavModulesProvider.
 * Visual polish only — navigation logic unchanged.
 */
const DesktopSidebar = () => {
  const { items } = useNavModules();
  const location = useLocation();
  const {
    collapsed,
    toggleCollapsed,
    openCategories,
    toggleCategory,
    ensureCategoryOpen,
  } = useDesktopSidebarState();

  const grouped = useMemo(() => groupQuickAccessByCategory(items), [items]);
  const logoUrl = useMemo(() => getSidebarLogoUrl(), []);
  const logoAlt = config.APP_NAME || config.COMPANY_NAME || 'Logo';

  useEffect(() => {
    for (const cat of MODULE_CATEGORY_ORDER) {
      const catItems = grouped[cat] || [];
      if (categoryHasActive(catItems, location.pathname, location.search)) {
        ensureCategoryOpen(cat);
      }
    }
  }, [grouped, location.pathname, location.search, ensureCategoryOpen]);

  const isInicio = location.pathname === '/inicio' || location.pathname === '/';

  return (
    <aside
      className={`desktop-sidebar${collapsed ? ' desktop-sidebar--collapsed' : ''}`}
      aria-label="Menú principal"
    >
      <div className="desktop-sidebar__head">
        <div className="desktop-sidebar__brand-row">
          <img
            src={logoUrl}
            alt={logoAlt}
            className="desktop-sidebar__logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          {!collapsed ? (
            <span className="desktop-sidebar__brand-text">
              <span className="desktop-sidebar__brand-sub">Menú</span>
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="desktop-sidebar__toggle"
          onClick={toggleCollapsed}
          title={collapsed ? 'Extinde' : 'Restrânge'}
          aria-label={collapsed ? 'Extinde meniul' : 'Restrânge meniul'}
        >
          <Menu className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <nav className="desktop-sidebar__scroll">
        {!collapsed ? (
          <div className="desktop-sidebar__section-label">Navegación</div>
        ) : null}

        <NavLink
          to="/inicio"
          className={`desktop-sidebar__link desktop-sidebar__inicio${
            isInicio ? ' desktop-sidebar__link--active' : ''
          }`}
          end
        >
          <span className="desktop-sidebar__icon">
            <Home className="h-5 w-5" aria-hidden />
          </span>
          <span className="desktop-sidebar__label">Inicio</span>
          {collapsed ? <span className="desktop-sidebar__tooltip">Inicio</span> : null}
        </NavLink>

        {MODULE_CATEGORY_ORDER.map((cat) => {
          const catItems = grouped[cat] || [];
          if (!catItems.length) return null;
          const CatIcon = CAT_ICONS[cat] || PanelLeft;
          const isOpen = !collapsed && Boolean(openCategories[cat]);

          return (
            <div key={cat} className="desktop-sidebar__cat">
              <button
                type="button"
                className="desktop-sidebar__cat-btn"
                onClick={() => {
                  if (collapsed) {
                    toggleCollapsed();
                    ensureCategoryOpen(cat);
                  } else {
                    toggleCategory(cat);
                  }
                }}
                aria-expanded={isOpen}
              >
                <span className="desktop-sidebar__icon">
                  <CatIcon className="h-5 w-5" aria-hidden />
                </span>
                <span className="desktop-sidebar__label">
                  {MODULE_CATEGORY_LABELS[cat] || cat}
                </span>
                {!collapsed ? (
                  <ChevronDown
                    className={`desktop-sidebar__chevron h-4 w-4 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                ) : (
                  <span className="desktop-sidebar__tooltip">
                    {MODULE_CATEGORY_LABELS[cat] || cat}
                  </span>
                )}
              </button>

              {collapsed
                ? catItems.map((item) => {
                    const active =
                      pathMatches(item.href, location.pathname, '') ||
                      location.pathname ===
                        (() => {
                          try {
                            return new URL(item.href, window.location.origin).pathname;
                          } catch {
                            return item.href;
                          }
                        })() ||
                      item.children?.some((c) =>
                        pathMatches(c.href, location.pathname, location.search),
                      );
                    return (
                      <NavLink
                        key={`c-${item.id}`}
                        to={item.href}
                        className={`desktop-sidebar__link${
                          active ? ' desktop-sidebar__link--active' : ''
                        }`}
                      >
                        <span className="desktop-sidebar__icon">{item.icon}</span>
                        {item.notificationCount > 0 ? (
                          <span className="desktop-sidebar__badge">
                            {item.notificationCount > 99 ? '99+' : item.notificationCount}
                          </span>
                        ) : null}
                        <span className="desktop-sidebar__tooltip">{item.label}</span>
                      </NavLink>
                    );
                  })
                : null}

              {isOpen ? (
                <div className="desktop-sidebar__cat-modules">
                  {catItems.map((item) => {
                    let itemPath = item.href;
                    try {
                      itemPath = new URL(item.href, window.location.origin).pathname;
                    } catch {
                      /* */
                    }
                    const childActive = item.children?.some((c) =>
                      pathMatches(c.href, location.pathname, location.search),
                    );
                    const selfActive =
                      location.pathname === itemPath && !childActive;
                    const parentOfActive = Boolean(childActive);

                    return (
                      <div key={item.id} className="desktop-sidebar__module">
                        <NavLink
                          to={item.href}
                          className={`desktop-sidebar__link${
                            selfActive ? ' desktop-sidebar__link--active' : ''
                          }${parentOfActive ? ' desktop-sidebar__link--parent-active' : ''}`}
                          title={item.label}
                        >
                          <span className="desktop-sidebar__icon">{item.icon}</span>
                          <span className="desktop-sidebar__label">{item.label}</span>
                          {item.notificationCount > 0 ? (
                            <span className="desktop-sidebar__badge">
                              {item.notificationCount > 99
                                ? '99+'
                                : item.notificationCount}
                            </span>
                          ) : null}
                        </NavLink>
                        {item.children?.length ? (
                          <div className="desktop-sidebar__children">
                            {item.children.map((child) => (
                              <NavLink
                                key={child.id}
                                to={child.href}
                                className={`desktop-sidebar__link desktop-sidebar__child${
                                  pathMatches(
                                    child.href,
                                    location.pathname,
                                    location.search,
                                  )
                                    ? ' desktop-sidebar__link--active'
                                    : ''
                                }`}
                              >
                                <span className="desktop-sidebar__label">
                                  {child.label}
                                </span>
                              </NavLink>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default DesktopSidebar;
