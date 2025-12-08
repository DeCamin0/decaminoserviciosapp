import { useEffect, useState } from 'react'

export default function IdleWarningModal({ secondsLeft, onStay, onLogout }) {
  const [isVisible, setIsVisible] = useState(false)
  const [pulse, setPulse] = useState(false)
  const [isDisconnected, setIsDisconnected] = useState(false)

  useEffect(() => {
    if (secondsLeft != null) {
      setIsVisible(true)
      setIsDisconnected(false)
      
      // Pulse animation every 10 seconds
      if (secondsLeft <= 10) {
        setPulse(true)
        const timer = setTimeout(() => setPulse(false), 1000)
        return () => clearTimeout(timer)
      }
      
      // Când ajunge la 0, afișează mesajul de deconectare
      if (secondsLeft === 0) {
        setIsDisconnected(true)
        // După 3 secunde, execută logout-ul
        const logoutTimer = setTimeout(() => {
          onLogout()
        }, 3000)
        return () => clearTimeout(logoutTimer)
      }
    } else {
      setIsVisible(false)
      setIsDisconnected(false)
    }
  }, [secondsLeft, onLogout])

  if (!isVisible || secondsLeft == null) return null;

  const progress = (60 - secondsLeft) / 60 * 100
  const isUrgent = secondsLeft <= 10

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 via-red-600/30 to-red-700/40 backdrop-blur-md" />
      
      {/* Modal container */}
      <div className="relative w-full max-w-md transform transition-all duration-500 ease-out">
        {/* Glassmorphism card */}
        <div className="relative overflow-hidden rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
          {/* Animated gradient border */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-red-500/50 via-red-600/50 to-red-700/50 p-[2px]">
            <div className="h-full w-full rounded-3xl bg-white/10 backdrop-blur-xl" />
          </div>
          
          {/* Content */}
          <div className="relative p-8">
            {/* Header with icon */}
            <div className="flex items-center justify-center mb-6">
              <div className={`relative ${pulse || isDisconnected ? 'animate-pulse' : ''}`}>
                {/* Warning icon with glow effect */}
                <div className={`w-16 h-16 rounded-full ${isDisconnected ? 'bg-gradient-to-br from-gray-600 to-gray-700' : 'bg-gradient-to-br from-red-500 to-red-600'} flex items-center justify-center shadow-lg`}>
                  {isDisconnected ? (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  )}
                </div>
                {/* Glow effect */}
                <div className={`absolute inset-0 rounded-full ${isDisconnected ? 'bg-gray-500/30' : 'bg-red-500/30'} blur-xl animate-ping`} />
              </div>
            </div>

            {/* Title */}
            <h3 className="text-2xl font-bold text-center text-white mb-2">
              {isDisconnected ? 'Sesión desconectada' : 'Sesión inactiva'}
            </h3>
            
            {/* Subtitle */}
            <p className="text-center text-white/80 text-sm mb-6">
              {isDisconnected ? 'Has sido desconectado por inactividad' : 'Se detectó inactividad en tu sesión'}
            </p>

            {/* Countdown circle or disconnected message */}
            <div className="flex justify-center mb-8">
              {isDisconnected ? (
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-gray-600/50 flex items-center justify-center">
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
              ) : (
                <div className="relative w-32 h-32">
                  {/* Background circle */}
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="8"
                      fill="none"
                    />
                    {/* Progress circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      stroke={isUrgent ? '#ef4444' : '#f59e0b'}
                      strokeWidth="8"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 45}`}
                      strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  
                  {/* Countdown number */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-4xl font-bold ${isUrgent ? 'text-red-400' : 'text-white'}`}>
                      {secondsLeft}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Warning message */}
            <div className="text-center mb-8">
              {isDisconnected ? (
                <div>
                  <p className="text-white/90 text-lg mb-2">
                    Redirigiendo al inicio de sesión...
                  </p>
                  <p className="text-white/70 text-sm">
                    Por favor, inicia sesión nuevamente
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-white/90 text-lg mb-2">
                    Serás desconectado automáticamente en
                  </p>
                  <p className="text-white/70 text-sm">
                    {secondsLeft === 1 ? '1 segundo' : `${secondsLeft} segundos`}
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons - only show if not disconnected */}
            {!isDisconnected && (
              <>
                <div className="flex flex-col gap-3">
                  {/* Stay connected button */}
                  <button
                    type="button"
                    onClick={onStay}
                    className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-500 to-green-600 px-8 py-4 text-white font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 ease-out"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <span className="relative flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Permanecer conectado
                    </span>
                  </button>

                  {/* Logout now button */}
                  <button
                    type="button"
                    onClick={onLogout}
                    className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 px-8 py-3 text-white/80 font-medium hover:bg-white/20 hover:text-white transition-all duration-300 ease-out"
                  >
                    <span className="relative flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Cerrar sesión ahora
                    </span>
                  </button>
                </div>

                {/* Footer note */}
                <div className="mt-6 text-center">
                  <p className="text-white/60 text-xs">
                    Mueve el mouse o presiona cualquier tecla para mantenerte activo
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


