import { useAuth } from '../contexts/AuthContextBase';
import { useNavigate, useLocation } from 'react-router';
import { useEffect, useMemo } from 'react';
import ChatBot from './ChatBot';
import Footer from './Footer';
import LocationDisplay from './LocationDisplay';
import DemoBadge from './DemoBadge';
import ThemeToggle from './ThemeToggle';
import NotificationsBell from './NotificationsBell';
import { config } from '../config/env.js';

const getLogoUrl = () => {
  const basePath = config.BASE_PATH || '/';
  const logoPath = config.LOGO_PATH || 'logo.svg';
  return `${basePath}${logoPath}`.replace(/\/+/g, '/');
};

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const now = useMemo(() => new Date(), []);
  const isHolidaySeason = now.getMonth() === 11 || (now.getMonth() === 0 && now.getDate() <= 6);

  useEffect(() => {
    sessionStorage.setItem('lastPath', location.pathname);
    console.log('Navigated to:', location.pathname);
  }, [location]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userName = user?.['NOMBRE / APELLIDOS'] || user?.name || 'Utilizator';
  const userGrupo = user?.GRUPO || '';
  const brandName = config.COMPANY_NAME || config.APP_NAME || '';
  const logoAlt = `${config.APP_NAME || config.COMPANY_NAME || 'App'} Logo`;

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-x-hidden bg-gray-50 transition-colors dark:bg-gray-900"
      style={{
        WebkitFlexDirection: 'column',
        msFlexDirection: 'column',
        flexDirection: 'column',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, var(--primary-color) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <div
          className="absolute -left-16 top-24 h-48 w-48 rounded-full opacity-[0.08] blur-3xl"
          style={{ backgroundColor: 'var(--primary-color)' }}
        />
        <div
          className="absolute -right-20 bottom-28 h-56 w-56 rounded-full opacity-[0.07] blur-3xl"
          style={{
            backgroundColor: 'var(--primary-color-darkest, var(--primary-color))',
          }}
        />
      </div>

      {isHolidaySeason && (
        <style>{`
          .snowflake-main {
            position: absolute;
            top: -10%;
            color: color-mix(in srgb, var(--primary-color) 35%, #fff);
            font-size: 11px;
            animation-name: snowfall-main;
            animation-timing-function: linear;
            animation-iteration-count: infinite;
            pointer-events: none;
            opacity: 0.55;
          }
          .dark .snowflake-main {
            color: color-mix(in srgb, #fff 70%, var(--primary-color));
          }
          @keyframes snowfall-main {
            0% { transform: translateY(0) translateX(0); opacity: 0; }
            12% { opacity: 0.55; }
            100% { transform: translateY(110vh) translateX(18px); opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .snowflake-main { animation: none; opacity: 0.35; }
          }
        `}</style>
      )}

      {isHolidaySeason && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, idx) => (
            <span
              key={idx}
              className="snowflake-main"
              style={{
                left: `${(idx * 100) / 24}%`,
                animationDuration: `${8 + (idx % 5)}s`,
                animationDelay: `${idx * 0.28}s`,
                fontSize: `${9 + (idx % 4)}px`,
              }}
            >
              ❄
            </span>
          ))}
        </div>
      )}

      <header className="sticky top-0 z-50 border-b border-gray-200/90 bg-white/90 shadow-sm backdrop-blur-md dark:border-gray-700/90 dark:bg-gray-800/90">
        {/* Desktop */}
        <div
          className="hidden min-h-[3.5rem] items-center md:flex"
          style={{
            WebkitAlignItems: 'center',
            msFlexAlign: 'center',
            alignItems: 'center',
          }}
        >
          <div
            className="flex w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
            style={{
              WebkitAlignItems: 'center',
              msFlexAlign: 'center',
              alignItems: 'center',
              WebkitJustifyContent: 'space-between',
              msFlexPack: 'justify',
              justifyContent: 'space-between',
            }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary-500/40 bg-white shadow-sm dark:bg-gray-100">
                <img
                  src={getLogoUrl()}
                  alt={logoAlt}
                  className="h-7 w-7 object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                {isHolidaySeason && (
                  <span
                    className="absolute -right-1 -top-1 text-[10px]"
                    aria-hidden="true"
                    title="Felices Fiestas"
                  >
                    🎄
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold tracking-tight text-gray-900 dark:text-white lg:text-lg">
                  {brandName}
                </h1>
                {isHolidaySeason && (
                  <span className="mt-0.5 inline-flex items-center rounded-full border border-primary-500/25 bg-primary-500/10 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:text-gray-200">
                    🎄 Felices Fiestas
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center">
              <LocationDisplay />
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <div className="hidden text-right text-sm text-gray-700 dark:text-gray-300 lg:block">
                <div className="max-w-[12rem] truncate font-medium xl:max-w-[14rem]">{userName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{userGrupo || 'Empleado'}</div>
              </div>
              <div className="text-right text-sm text-gray-700 dark:text-gray-300 lg:hidden">
                <div className="max-w-[7rem] truncate font-medium">{userName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{userGrupo || 'Empleado'}</div>
              </div>
              <NotificationsBell />
              <ThemeToggle />
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg bg-gray-800 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] focus-visible:ring-offset-2 dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                Salir
              </button>
            </div>
          </div>
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          <div
            className="flex items-center justify-between gap-2 px-3 py-2.5"
            style={{
              WebkitAlignItems: 'center',
              msFlexAlign: 'center',
              alignItems: 'center',
              WebkitJustifyContent: 'space-between',
              msFlexPack: 'justify',
              justifyContent: 'space-between',
            }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary-500/40 bg-white shadow-sm">
                <img
                  src={getLogoUrl()}
                  alt={logoAlt}
                  className="h-5 w-5 object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                {isHolidaySeason && (
                  <span className="absolute -right-0.5 -top-0.5 text-[9px]" aria-hidden="true">
                    🎄
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                  {config.APP_NAME || config.COMPANY_NAME || ''}
                </h1>
                <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                  {userName}
                  {userGrupo ? ` · ${userGrupo}` : ''}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <NotificationsBell />
              <ThemeToggle className="flex-shrink-0" />
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] dark:bg-gray-700"
              >
                Salir
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-700/80">
            <LocationDisplay />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <div className="w-full px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">{children}</div>
      </main>

      <ChatBot />
      <DemoBadge />
      <Footer />
    </div>
  );
};

export default MainLayout;
