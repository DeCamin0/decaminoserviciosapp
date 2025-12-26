/**
 * DemoBadge Component
 * Global DEMO mode indicator with controls
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { setDemoMode } from '../utils/demo';

const DemoBadge = () => {
  const [showMenu, setShowMenu] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const { user, logout } = useAuth();
  const isDemoUser = Boolean(user?.isDemo);

  // Auto-exit timer (30 minutes of inactivity)
  useEffect(() => {
    if (!isDemoUser) {
      return;
    }

    let inactivityTimer = null;
    let countdownTimer = null;
    
    const resetTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (countdownTimer) clearInterval(countdownTimer);
      
      // Set inactivity timeout to 30 minutes
      const timeoutMs = 30 * 60 * 1000; // 30 minutes
      
      inactivityTimer = setTimeout(() => {
        console.log('🎭 DEMO mode auto-exit due to inactivity');
        logout();
      }, timeoutMs);
      
      // Start countdown display 5 minutes before timeout
      const countdownStart = timeoutMs - (5 * 60 * 1000); // 25 minutes
      
      setTimeout(() => {
        let remainingSeconds = 5 * 60; // 5 minutes
        
        countdownTimer = setInterval(() => {
          setTimeLeft(remainingSeconds);
          remainingSeconds--;
          
          if (remainingSeconds < 0) {
            clearInterval(countdownTimer);
            setTimeLeft(null);
          }
        }, 1000);
      }, countdownStart);
    };

    // Reset timer on user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });

    resetTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer, true);
      });
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [isDemoUser, logout]);

  // Only show if user is in DEMO mode
  if (!isDemoUser) {
    return null;
  }

  const handleExitDemo = () => {
    logout();
  };

  const handleResetDemo = () => {
    if (window.confirm('¿Estás seguro de que quieres resetear los datos DEMO? Esto eliminará todos los cambios realizados.')) {
      localStorage.removeItem('__demo_store__');
      setDemoMode(true);
    }
  };

  const handleToggleMenu = () => {
    setShowMenu(!showMenu);
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

      return (
        <>
          {/* Subtle DEMO indicator - moved to avoid overlap with logout button */}
          <div className="fixed top-2 left-2 z-[9999]">
        <div className="relative">
          <button
            onClick={handleToggleMenu}
            className="group flex items-center space-x-2 bg-white/90 backdrop-blur-sm border border-red-200 rounded-full px-3 py-1.5 shadow-sm hover:shadow-md transition-all duration-300"
            title="Modo DEMO activo"
          >
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-red-600 group-hover:text-red-700">DEMO</span>
            {timeLeft && (
              <span className="text-xs text-red-500 font-mono">
                {formatTime(timeLeft)}
              </span>
            )}
            <svg 
              className={`w-3 h-3 text-red-500 transition-transform duration-200 ${showMenu ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-3 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">Modo DEMO</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Usuario: {user["NOMBRE / APELLIDOS"] || user.email}
                </p>
                <p className="text-xs text-gray-500">
                  Los datos son simulados y no se guardan permanentemente
                </p>
                {timeLeft && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-yellow-800">
                        Auto-salida en {formatTime(timeLeft)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="py-2">
                <button
                  onClick={handleResetDemo}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2"
                >
                  <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Resetear datos DEMO</span>
                </button>
                
                <button
                  onClick={handleExitDemo}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2"
                >
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Salir del modo DEMO</span>
                </button>
              </div>
              
              <div className="px-4 py-2 border-t border-gray-100">
                <div className="text-xs text-gray-400">
                  <div className="flex items-center justify-between">
                    <span>Estado:</span>
                    <span className="text-green-600 font-medium">Activo</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>Datos:</span>
                    <span className="text-blue-600 font-medium">Simulados</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>Auto-salida:</span>
                    <span className="text-orange-600 font-medium">30 min</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop to close menu */}
      {showMenu && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
      )}
    </>
  );
};

export default DemoBadge;
