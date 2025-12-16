import { useAuth } from '../contexts/AuthContextBase';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import ChatBot from './ChatBot';
import Footer from './Footer';
import LocationDisplay from './LocationDisplay';
import DemoBadge from './DemoBadge';
import ThemeToggle from './ThemeToggle';
// Folosește logo-ul din public (accesibil prin ngrok)
const getLogoUrl = () => {
  // Verifică dacă suntem pe ngrok și folosește SVG inline
  if (window.location.hostname.includes('ngrok')) {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNFRTM5MzUiLz4KPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+REM8L3RleHQ+Cjwvc3ZnPgo=';
  }
  return '/logo.svg';
};

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const now = useMemo(() => new Date(), []);
  const isHolidaySeason = now.getMonth() === 11 || (now.getMonth() === 0 && now.getDate() <= 6);

  // Gestionare navigare pentru browser back button
  useEffect(() => {
    // Salvează ruta curentă în sessionStorage
    sessionStorage.setItem('lastPath', location.pathname);
    
    // Log pentru debugging
    console.log('Navigated to:', location.pathname);
  }, [location]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };



  // Extrage numele din datele utilizatorului
  const userName = user?.['NOMBRE / APELLIDOS'] || user?.name || 'Utilizator';
  const userGrupo = user?.GRUPO || '';

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-gray-50 dark:bg-gray-900 transition-colors" style={{
      WebkitFlexDirection: 'column',
      msFlexDirection: 'column',
      flexDirection: 'column'
    }}>
      {/* Fundal elegant cu gradient și pattern - același ca la login */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-red-100 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800">
        {/* Pattern decorativ */}
        <div className="absolute inset-0 opacity-5">
          <div 
            className="absolute top-0 left-0 w-full h-full"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='https://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23E53935' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}
          ></div>
        </div>
        
        {/* Elemente decorative */}
        <div className="absolute top-20 left-20 w-32 h-32 bg-red-200 rounded-full opacity-20 blur-xl"></div>
        <div className="absolute bottom-20 right-20 w-40 h-40 bg-red-300 rounded-full opacity-15 blur-xl"></div>
        <div className="absolute top-1/2 left-10 w-24 h-24 bg-red-100 rounded-full opacity-30 blur-lg"></div>
        <div className="absolute top-10 right-10 w-20 h-20 bg-red-200 rounded-full opacity-25 blur-lg"></div>
      </div>

      {/* Stiluri sezoniere (ninsoare și sparkles) */}
      {isHolidaySeason && (
        <style>{`
          .snowflake-main {
            position: absolute;
            top: -10%;
            color: rgba(170, 205, 255, 0.9); /* albastru deschis pe modul normal */
            font-size: 13px;
            animation-name: snowfall-main;
            animation-timing-function: linear;
            animation-iteration-count: infinite;
            pointer-events: none;
          }
          .dark .snowflake-main {
            color: rgba(255,255,255,0.9); /* alb în modul întunecat */
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

      {/* Decor global de sezon */}
      {isHolidaySeason && (
        <>
          {/* Ninsoare globală */}
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

          {/* Halo discret pe fundal */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0">
            <div className="w-[780px] h-[780px] rounded-full bg-gradient-to-br from-amber-200/6 via-red-200/8 to-orange-100/6 blur-3xl animate-pulse" />
          </div>

          {/* Sparkles rare în header */}
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

          {/* Badge Felices Fiestas în header */}
          <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-40">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/18 backdrop-blur-md border border-white/25 shadow-md text-sm text-red-900/80">
              🎄 Felices Fiestas
            </div>
          </div>
        </>
      )}

      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-800/80 backdrop-blur border-b border-gray-200 dark:border-gray-700 relative">
        {/* Desktop layout - rămâne neschimbat */}
        <div className="hidden md:flex items-center min-h-[clamp(56px,6vh,72px)]" style={{
        WebkitAlignItems: 'center',
        msFlexAlign: 'center',
        alignItems: 'center'
      }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between" style={{
          WebkitAlignItems: 'center',
          msFlexAlign: 'center',
          alignItems: 'center',
          WebkitJustifyContent: 'space-between',
          msFlexPack: 'justify',
          justifyContent: 'space-between'
        }}>
          {/* Logo și titlu cu design elegant ca la login */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center">
                {/* Logo elegant cu fundal circular și efect glow */}
                <div className="relative mr-3">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-red-500">
                    <img 
                      src={getLogoUrl()} 
                      alt="DeCamino Logo" 
                        className="h-8 w-8 object-contain"
                      onError={(e) => {
                        // Dacă logo-ul nu se încarcă, afișează textul
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    {/* Fallback text dacă logo-ul nu se încarcă */}
                      <div className="hidden text-red-600 font-bold text-lg">DC</div>
                    </div>
                    {/* Căciulă de Moș pentru sezon */}
                    {isHolidaySeason && (
                      <div className="absolute -top-2 -right-3 w-7 h-5 transform rotate-12">
                        <div className="absolute inset-0 bg-red-500 rounded-tl-2xl rounded-tr-2xl rounded-bl-sm rounded-br-md shadow border border-red-600"></div>
                        <div className="absolute -bottom-1 left-0 right-0 h-2 bg-white rounded-full shadow-sm"></div>
                        <div className="absolute -bottom-3 -right-1 w-3 h-3 bg-white rounded-full shadow-sm"></div>
                      </div>
                    )}
                    {/* Efect de glow */}
                    <div className="absolute inset-0 w-12 h-12 bg-red-400 rounded-full opacity-20 blur-md animate-pulse"></div>
                </div>
                
                  <h1 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">
                    DE CAMINO SERVICIOS AUXILIARES
                  </h1>
                  {isHolidaySeason && (
                    <span className="ml-2 px-3 py-1 rounded-full bg-white/60 text-red-700 text-xs font-semibold shadow-sm backdrop-blur">
                      🎄 Felices Fiestas
                    </span>
                  )}
              </div>
            </div>
          </div>

          {/* Locația curentă */}
            <div className="flex items-center">
            <LocationDisplay />
          </div>

          {/* User info și logout */}
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-700 dark:text-gray-300">
              <div className="font-medium truncate max-w-32 lg:max-w-48">{userName}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {userGrupo || 'Empleado'}
              </div>
            </div>
              
              {/* Theme Toggle */}
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

        {/* Mobile layout - 2 rânduri */}
        <div className="md:hidden">
          {/* Rând 1: Logo + Nume + Buton Salir */}
          <div className="flex items-center justify-between px-4 py-3" style={{
            WebkitAlignItems: 'center',
            msFlexAlign: 'center',
            alignItems: 'center',
            WebkitJustifyContent: 'space-between',
            msFlexPack: 'justify',
            justifyContent: 'space-between'
          }}>
            <div className="flex items-center flex-1 min-w-0">
              {/* Logo mic pentru mobile */}
              <div className="relative mr-2 flex-shrink-0">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-red-500">
                  <img 
                    src={getLogoUrl()} 
                    alt="DeCamino Logo" 
                    className="h-5 w-5 object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                  <div className="hidden text-red-600 font-bold text-xs">DC</div>
                </div>
                {isHolidaySeason && (
                  <div className="absolute -top-1 -right-2 w-5 h-4 transform rotate-12">
                    <div className="absolute inset-0 bg-red-500 rounded-tl-2xl rounded-tr-2xl rounded-bl-sm rounded-br-md shadow border border-red-600"></div>
                    <div className="absolute -bottom-1 left-0 right-0 h-1.5 bg-white rounded-full shadow-sm"></div>
                    <div className="absolute -bottom-2 -right-1 w-2.5 h-2.5 bg-white rounded-full shadow-sm"></div>
                  </div>
                )}
              </div>
              
              {/* Nume firmă - trunchiat dacă e prea lung */}
              <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                DE CAMINO SERVICIOS AUXILIARES
              </h1>
              {isHolidaySeason && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-white/60 text-red-700 text-[11px] font-semibold shadow-sm backdrop-blur whitespace-nowrap">
                  🎄 Felices Fiestas
                </span>
              )}
            </div>

            {/* Theme Toggle și Buton Salir */}
            <div className="flex items-center space-x-2">
              <ThemeToggle className="flex-shrink-0" />
              <button
                onClick={handleLogout}
                className="bg-gray-800 hover:bg-gray-900 text-white font-medium py-2 px-3 rounded-lg transition-colors text-xs flex-shrink-0"
              >
                Salir
              </button>
            </div>
          </div>

          {/* Rând 2: Locația */}
          <div className="px-4 pb-3">
            <LocationDisplay />
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          {children}
        </div>
      </main>
      
      {/* Chat Bot pentru manageri și supervisori */}
      <ChatBot />
      
      {/* DEMO Badge */}
      <DemoBadge />
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default MainLayout; 
