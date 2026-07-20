import { useAuth } from '../contexts/AuthContextBase';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import LocationDisplay from '../components/LocationDisplay';
import ThemeToggle from '../components/ThemeToggle';
import NotificationsBell from '../components/NotificationsBell';
import MobileBottomNav from '../components/navigation/MobileBottomNav';
import ChatBot from '../components/ChatBot';
import Footer from '../components/Footer';
import DemoBadge from '../components/DemoBadge';
import { config } from '../config/env.js';

// Logo din config (multi-client). La ngrok folosim logo DC doar dacă nu e client 2 (HERA).
const getLogoUrl = () => {
  const basePath = config.BASE_PATH || '/';
  const logoPath = config.LOGO_PATH || 'logo.svg';
  const isClient2 = (logoPath || '').toLowerCase().includes('hera');
  if (window.location.hostname.includes('ngrok') && !isClient2) {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNFRTM5MzUiLz4KPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+REM8L3RleHQ+Cjwvc3ZnPgo=';
  }
  return `${basePath}${logoPath}`.replace(/\/+/g, '/');
};
const isClient2Logo = () => (config.LOGO_PATH || '').toLowerCase().includes('hera');

/**
 * AppShell - un singur layout stabil.
 * Chrome-ul (header / nav / footer) se schimbă după isMobile,
 * dar {children} rămân montați — fără pierdere de state la resize / rotație / split screen.
 */
const AppShell = ({ isMobile, children }) => {
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

  return (
    <div
      className={`min-h-screen flex flex-col relative bg-gray-50 dark:bg-gray-900 transition-colors ${
        isMobile ? '' : 'overflow-hidden'
      }`}
      style={{
        WebkitFlexDirection: 'column',
        msFlexDirection: 'column',
        flexDirection: 'column'
      }}
    >
      {/* Fundal */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30px 30px, var(--primary-color, #E53935) 1px, transparent 0)',
            backgroundSize: '60px 60px'
          }}
        />
        <div className="absolute top-20 left-20 w-32 h-32 rounded-full opacity-20 blur-xl" style={{ backgroundColor: 'var(--primary-color)' }} />
        <div className="absolute bottom-20 right-20 w-40 h-40 rounded-full opacity-15 blur-xl" style={{ backgroundColor: 'var(--primary-color)' }} />
        <div className="absolute top-1/2 left-10 w-24 h-24 rounded-full opacity-25 blur-lg" style={{ backgroundColor: 'var(--primary-color)' }} />
        <div className="absolute top-10 right-10 w-20 h-20 rounded-full opacity-20 blur-lg" style={{ backgroundColor: 'var(--primary-color)' }} />
      </div>

      {isHolidaySeason && (
        <style>{`
          .snowflake-main {
            position: absolute;
            top: -10%;
            color: rgba(170, 205, 255, 0.9);
            font-size: 13px;
            animation-name: snowfall-main;
            animation-timing-function: linear;
            animation-iteration-count: infinite;
            pointer-events: none;
          }
          .dark .snowflake-main {
            color: rgba(255,255,255,0.9);
          }
          @keyframes snowfall-main {
            0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            100% { transform: translateY(110vh) translateX(26px) rotate(360deg); opacity: 0; }
          }
          @keyframes sparkle-main {
            0%, 100% { opacity: 0; transform: scale(0.6) translateY(0); }
            10% { opacity: 1; transform: scale(1) translateY(-2px); }
            50% { opacity: 0.8; transform: scale(1.05) translateY(0); }
            90% { opacity: 0.4; transform: scale(0.8) translateY(2px); }
          }
        `}</style>
      )}

      {isHolidaySeason && (
        <>
          <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
            {Array.from({ length: 60 }).map((_, idx) => (
              <span
                key={idx}
                className="snowflake-main"
                style={{
                  left: `${(idx * 100) / 60}%`,
                  animationDuration: `${6 + (idx % 5)}s`,
                  animationDelay: `${idx * 0.18}s`,
                  fontSize: `${10 + (idx % 5) * 2}px`
                }}
              >
                ❄
              </span>
            ))}
          </div>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0">
            <div className="w-[780px] h-[780px] rounded-full bg-gradient-to-br from-amber-200/6 via-red-200/8 to-orange-100/6 blur-3xl animate-pulse" />
          </div>

          <div className="pointer-events-none absolute inset-0 z-30">
            {Array.from({ length: 8 }).map((_, idx) => (
              <span
                key={idx}
                className="absolute text-white/80"
                style={{
                  top: `${6 + idx * 7}%`,
                  left: `${12 + (idx * 9) % 70}%`,
                  filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.7))',
                  animation: `sparkle-main ${6 + idx}s ease-in-out ${idx * 1.5}s infinite`
                }}
              >
                ✨
              </span>
            ))}
          </div>

          <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-40">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/18 backdrop-blur-md border border-white/25 shadow-md text-sm text-red-900/80">
              🎄 Felices Fiestas
            </div>
          </div>
        </>
      )}

      {isMobile ? (
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-800/80 backdrop-blur border-b border-gray-200 dark:border-gray-700 relative">
          <div
            className="flex items-center justify-between px-4 py-3 landscape:max-md:py-2"
            style={{
              WebkitAlignItems: 'center',
              msFlexAlign: 'center',
              alignItems: 'center',
              WebkitJustifyContent: 'space-between',
              msFlexPack: 'justify',
              justifyContent: 'space-between'
            }}
          >
            <div className="flex items-center flex-1 min-w-0">
              <div className="relative mr-2 flex-shrink-0">
                {isClient2Logo() ? (
                  <img
                    src={getLogoUrl()}
                    alt={`${config.APP_NAME || config.COMPANY_NAME || 'App'} Logo`}
                    className="h-11 w-auto max-w-[180px] object-contain drop-shadow-[0_1px_6px_rgba(0,0,0,0.1)]"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <>
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-primary-500">
                      <img
                        src={getLogoUrl()}
                        alt="DeCamino Logo"
                        className="h-5 w-5 object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'block';
                        }}
                      />
                      <div className="hidden text-primary-600 font-bold text-xs">DC</div>
                    </div>
                    {isHolidaySeason && (
                      <div className="absolute -top-1 -right-2 w-5 h-4 transform rotate-12">
                        <div className="absolute inset-0 bg-primary-500 rounded-tl-2xl rounded-tr-2xl rounded-bl-sm rounded-br-md shadow border border-primary-600"></div>
                        <div className="absolute -bottom-1 left-0 right-0 h-1.5 bg-white rounded-full shadow-sm"></div>
                        <div className="absolute -bottom-2 -right-1 w-2.5 h-2.5 bg-white rounded-full shadow-sm"></div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                {config.COMPANY_NAME}
              </h1>
              {isHolidaySeason && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-white/60 text-red-700 text-[11px] font-semibold shadow-sm backdrop-blur whitespace-nowrap">
                  🎄 Felices Fiestas
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <NotificationsBell />
              <ThemeToggle className="flex-shrink-0" />
              <button
                onClick={handleLogout}
                className="bg-gray-800 hover:bg-gray-900 text-white font-medium py-2 px-3 rounded-lg transition-colors text-xs flex-shrink-0"
              >
                Salir
              </button>
            </div>
          </div>

          <div className="px-4 pb-3 landscape:max-md:pb-2 landscape:max-md:pt-0">
            <LocationDisplay />
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-800/80 backdrop-blur border-b border-gray-200 dark:border-gray-700 relative">
          <div
            className="flex items-center min-h-[clamp(56px,6vh,72px)]"
            style={{
              WebkitAlignItems: 'center',
              msFlexAlign: 'center',
              alignItems: 'center'
            }}
          >
            <div
              className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between"
              style={{
                WebkitAlignItems: 'center',
                msFlexAlign: 'center',
                alignItems: 'center',
                WebkitJustifyContent: 'space-between',
                msFlexPack: 'justify',
                justifyContent: 'space-between'
              }}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex items-center">
                    <div className="relative mr-3">
                      {isClient2Logo() ? (
                        <img
                          src={getLogoUrl()}
                          alt={`${config.APP_NAME || config.COMPANY_NAME || 'App'} Logo`}
                          className="h-14 w-auto max-w-[260px] object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-primary-500">
                            <img
                              src={getLogoUrl()}
                              alt="DeCamino Logo"
                              className="h-8 w-8 object-contain"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <div className="hidden text-primary-600 font-bold text-lg">DC</div>
                          </div>
                          {isHolidaySeason && (
                            <div className="absolute -top-2 -right-3 w-7 h-5 transform rotate-12">
                              <div className="absolute inset-0 bg-primary-500 rounded-tl-2xl rounded-tr-2xl rounded-bl-sm rounded-br-md shadow border border-primary-600"></div>
                              <div className="absolute -bottom-1 left-0 right-0 h-2 bg-white rounded-full shadow-sm"></div>
                              <div className="absolute -bottom-3 -right-1 w-3 h-3 bg-white rounded-full shadow-sm"></div>
                            </div>
                          )}
                          <div className="absolute inset-0 w-12 h-12 bg-primary-400 rounded-full opacity-20 blur-md animate-pulse"></div>
                        </>
                      )}
                    </div>

                    <h1 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">
                      {config.COMPANY_NAME}
                    </h1>
                    {isHolidaySeason && (
                      <span className="ml-2 px-3 py-1 rounded-full bg-white/60 text-red-700 text-xs font-semibold shadow-sm backdrop-blur">
                        🎄 Felices Fiestas
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center">
                <LocationDisplay />
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <div className="font-medium truncate max-w-32 lg:max-w-48">{userName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {userGrupo || 'Empleado'}
                  </div>
                </div>

                <NotificationsBell />
                <ThemeToggle />

                <button
                  onClick={handleLogout}
                  className="bg-gray-800 hover:bg-gray-900 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  Salir
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Content stabil — același <main> indiferent de breakpoint */}
      <main
        className={
          isMobile
            ? 'flex-1 relative z-10 pb-20 landscape:max-md:pb-16'
            : 'flex-1 relative z-10'
        }
      >
        <div
          className={
            isMobile
              ? 'w-full px-4 sm:px-6 py-4 sm:py-6 landscape:max-md:py-2'
              : 'w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8'
          }
        >
          {children}
        </div>
      </main>

      {isMobile && <MobileBottomNav />}

      <ChatBot />

      {!isMobile && (
        <>
          <DemoBadge />
          <Footer />
        </>
      )}
    </div>
  );
};

export default AppShell;
