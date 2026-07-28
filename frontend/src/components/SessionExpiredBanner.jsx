import { useEffect, useState, useRef } from 'react';
import { useSessionExpired } from '../contexts/SessionExpiredContext';
import { useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContextBase';
import { AlertTriangle, LogOut } from 'lucide-react';

/**
 * Modal profesional pentru expirarea sesiunii
 * Se afișează când token-ul expiră sau refresh-ul eșuează
 * Cu countdown vizual și logout automat
 */
const SessionExpiredBanner = () => {
  const { isSessionExpired, message, hideSessionExpired } = useSessionExpired();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  // Inițializăm state-ul bazat pe isSessionExpired
  const [countdown, setCountdown] = useState(() => isSessionExpired ? 5 : 5);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const prevIsSessionExpired = useRef(isSessionExpired);

  // Reset state când apare modal-ul - folosim useLayoutEffect pentru sincronizare
  useEffect(() => {
    if (isSessionExpired && !prevIsSessionExpired.current) {
      // Modal-ul tocmai a apărut - resetăm state-ul într-un setTimeout pentru a evita cascading renders
      setTimeout(() => {
        setCountdown(5);
        setIsLoggingOut(false);
      }, 0);
      prevIsSessionExpired.current = true;
    } else if (!isSessionExpired) {
      prevIsSessionExpired.current = false;
    }
  }, [isSessionExpired]);

  useEffect(() => {
    if (isSessionExpired) {

      // Countdown timer
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // După 5 secunde, redirectăm automat la login
      const logoutTimer = setTimeout(() => {
        setIsLoggingOut(true);
        // Folosim logout() din context pentru a actualiza corect starea
        hideSessionExpired();
        logout();
      }, 5000);

      return () => {
        clearTimeout(logoutTimer);
        clearInterval(countdownInterval);
      };
    }
  }, [isSessionExpired, message, logout, hideSessionExpired]);

  const handleLogoutNow = () => {
    setIsLoggingOut(true);
    // Folosim logout() din context pentru a actualiza corect starea
    hideSessionExpired();
    logout();
  };

  // Nu afișa modal-ul dacă:
  // 1. Nu e sesiune expirată
  // 2. Utilizatorul nu e autentificat (deja pe login)
  // 3. Suntem deja pe pagina de login
  if (!isSessionExpired || !isAuthenticated || location.pathname === '/login') {
    return null;
  }

  const progress = ((5 - countdown) / 5) * 100;
  const isUrgent = countdown <= 2;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop cu blur – culori primary (client) */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/30 via-primary-600/40 to-primary-700/50 backdrop-blur-md animate-fade-in" />
      
      {/* Modal container */}
      <div className="relative w-full max-w-md transform transition-all duration-500 ease-out animate-scale-in">
        {/* Glassmorphism card */}
        <div className="relative overflow-hidden rounded-3xl bg-white/95 backdrop-blur-xl border-2 border-primary-100 shadow-2xl">
          {/* Animated gradient border pentru urgent */}
          {isUrgent && (
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 p-[2px] animate-pulse">
              <div className="h-full w-full rounded-3xl bg-white/95 backdrop-blur-xl" />
            </div>
          )}
          
          {/* Content */}
          <div className="relative p-8">
            {/* Header cu icon */}
            <div className="flex items-center justify-center mb-6">
              <div className={`relative ${isUrgent ? 'animate-pulse' : ''}`}>
                {/* Warning icon cu glow effect */}
                <div className={`w-20 h-20 rounded-full ${isLoggingOut ? 'bg-gradient-to-br from-gray-500 to-gray-600' : 'bg-gradient-to-br from-primary-500 to-primary-600'} flex items-center justify-center shadow-lg`}>
                  {isLoggingOut ? (
                    <LogOut className="w-10 h-10 text-white" />
                  ) : (
                    <AlertTriangle className="w-10 h-10 text-white" />
                  )}
                </div>
                {/* Glow effect */}
                {!isLoggingOut && (
                  <div className="absolute inset-0 rounded-full bg-primary-500/30 blur-xl animate-ping" />
                )}
              </div>
            </div>

            {/* Title */}
            <h3 className="text-3xl font-bold text-center text-gray-900 mb-2">
              {isLoggingOut ? 'Cerrando sesión...' : 'Sesión Expirada'}
            </h3>
            
            {/* Subtitle */}
            <p className="text-center text-gray-600 text-sm mb-6">
              {isLoggingOut 
                ? 'Redirigiendo al inicio de sesión...'
                : (message || 'Tu sesión ha expirado. Serás redirigido automáticamente al inicio de sesión.')
              }
            </p>

            {/* Countdown circle sau logout message */}
            <div className="flex justify-center mb-8">
              {isLoggingOut ? (
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-gray-500/20 flex items-center justify-center animate-spin">
                    <LogOut className="w-12 h-12 text-gray-600" />
                  </div>
                </div>
              ) : (
                <div className="relative w-32 h-32">
                  {/* Background circle – primary cu opacitate */}
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      strokeWidth="8"
                      fill="none"
                      style={{ stroke: 'var(--primary-color)', strokeOpacity: 0.2 }}
                    />
                    {/* Progress circle – culoare primary client */}
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      strokeWidth="8"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 45}`}
                      strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                      className="transition-all duration-1000 ease-out"
                      style={{ stroke: 'var(--primary-color-darker, var(--primary-color))' }}
                    />
                  </svg>
                  
                  {/* Countdown number */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-5xl font-bold ${isUrgent ? 'text-primary-600' : 'text-gray-900'}`}>
                      {countdown}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Warning message */}
            <div className="text-center mb-8">
              {isLoggingOut ? (
                <div>
                  <p className="text-gray-700 text-lg mb-2">
                    Por favor, espera...
                  </p>
                  <p className="text-gray-500 text-sm">
                    Iniciando sesión nuevamente
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-gray-700 text-lg mb-2">
                    Serás redirigido automáticamente en
                  </p>
                  <p className="text-gray-600 text-base font-semibold">
                    {countdown === 1 ? '1 segundo' : `${countdown} segundos`}
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons - doar dacă nu e în proces de logout */}
            {!isLoggingOut && (
              <div className="flex flex-col gap-3">
                {/* Logout imediat button */}
                <button
                  type="button"
                  onClick={handleLogoutNow}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 px-8 py-4 text-white font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 ease-out"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-primary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative flex items-center justify-center gap-2">
                    <LogOut className="w-5 h-5" />
                    Ir al inicio de sesión ahora
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes session-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes session-scale-in {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-fade-in {
          animation: session-fade-in 0.3s ease-out;
        }
        .animate-scale-in {
          animation: session-scale-in 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};

export default SessionExpiredBanner;
