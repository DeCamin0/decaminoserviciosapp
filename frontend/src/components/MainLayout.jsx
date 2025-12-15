import { useAuth } from '../contexts/AuthContextBase';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import ChatBot from './ChatBot';
import Footer from './Footer';
import LocationDisplay from './LocationDisplay';
import DemoBadge from './DemoBadge';
import ThemeToggle from './ThemeToggle';
import NotificationsBell from './NotificationsBell';
// Folosește logo-ul din public (accesibil prin ngrok)
const getLogoUrl = () => {
  // Verifică dacă suntem pe ngrok și folosește SVG inline
  if (window.location.hostname.includes('ngrok')) {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNFRTM5MzUiLz4KPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+REM8L3RleHQ+Cjwvc3ZnPgo=';
  }
  // Folosește base path-ul din environment pentru path-uri relative
  const basePath = import.meta.env.VITE_BASE_PATH || '/';
  return `${basePath}logo.svg`.replace(/\/+/g, '/'); // Remove duplicate slashes
};

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
                    {/* Efect de glow */}
                    <div className="absolute inset-0 w-12 h-12 bg-red-400 rounded-full opacity-20 blur-md animate-pulse"></div>
                </div>
                
                  <h1 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">
                    DE CAMINO SERVICIOS AUXILIARES V2
                  </h1>
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
              
              {/* Notifications Bell */}
              <NotificationsBell />
              
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
              </div>
              
              {/* Nume firmă - trunchiat dacă e prea lung */}
              <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                DE CAMINO SERVICIOS AUXILIARES V2
              </h1>
            </div>

            {/* Notifications, Theme Toggle și Buton Salir */}
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
