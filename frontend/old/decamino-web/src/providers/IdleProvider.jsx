import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import IdleWarningModal from '@/components/IdleWarningModal.jsx'
import { useAuth } from '@/contexts/AuthContextBase'
import { useLocation, useNavigate } from 'react-router-dom'

export const IdleContext = createContext({
  resetActivityTimer: () => {},
  secondsToLogout: null,
})

const CHANNEL_NAME = 'decamino-idle-channel'

export default function IdleProvider({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get auth context safely - use useContext directly to avoid hook violation
  // IdleProvider is placed AFTER AuthProvider in App.jsx, so context should be available
  const { logout } = useAuth();

  const idleEnabled = (import.meta.env.VITE_IDLE_ENABLED ?? '1') === '1'
  const timeoutMin = Number(import.meta.env.VITE_IDLE_TIMEOUT_MIN ?? '30')
  const warnSec = Number(import.meta.env.VITE_IDLE_WARNING_SEC ?? '60')

  const lastActivityRef = useRef(Date.now())
  const deadlineRef = useRef(Date.now() + timeoutMin * 60 * 1000)
  const warningStartRef = useRef(deadlineRef.current - warnSec * 1000)
  const intervalRef = useRef(null)
  const channelRef = useRef(null)
  // Track last manual reset to avoid race conditions with cross-tab logout
  const lastManualResetRef = useRef(0)

  const [secondsToLogout, setSecondsToLogout] = useState(null)
  const [showWarning, setShowWarning] = useState(false)
  const [isModalSticky, setIsModalSticky] = useState(false)

  const writeStorage = useCallback((ts) => {
    try {
      localStorage.setItem('idle:lastActivityAt', String(ts))
    } catch (e) {
      // ignore
    }
  }, [])

  const readStorage = useCallback(() => {
    try {
      const v = Number(localStorage.getItem('idle:lastActivityAt'))
      return Number.isFinite(v) ? v : null
    } catch (e) {
      return null
    }
  }, [])

  const broadcast = useCallback((type, payload) => {
    try {
      channelRef.current?.postMessage({ type, payload })
    } catch (e) {
      // ignore
    }
  }, [])

  const resetActivityTimer = useCallback(() => {
    const now = Date.now()
    lastManualResetRef.current = now
    lastActivityRef.current = now
    deadlineRef.current = now + timeoutMin * 60 * 1000
    warningStartRef.current = deadlineRef.current - warnSec * 1000
    setShowWarning(false)
    setSecondsToLogout(null)
    setIsModalSticky(false)
    writeStorage(now)
    broadcast('activity', { ts: now })
  }, [timeoutMin, warnSec, writeStorage, broadcast])

  const performLogout = useCallback(async () => {
    try {
      if (logout) {
        await logout()
      }
    } finally {
      navigate('/login', { replace: true, state: { from: location.pathname, reason: 'idle' } })
    }
  }, [logout, navigate, location.pathname])

  useEffect(() => {
    if (!idleEnabled) return

    // sync from storage at mount
    const stored = readStorage()
    if (stored) {
      lastActivityRef.current = stored
      const now = Date.now()
      const elapsed = now - stored
      const remaining = timeoutMin * 60 * 1000 - elapsed
      deadlineRef.current = now + Math.max(remaining, 0)
      warningStartRef.current = deadlineRef.current - warnSec * 1000
    } else {
      writeStorage(lastActivityRef.current)
    }

    // broadcast channel for cross-tab sync
    try { 
      channelRef.current = new BroadcastChannel(CHANNEL_NAME) 
    } catch (e) {
      console.error('Error creating broadcast channel:', e);
    }
    const onMsg = (e) => {
      if (e?.data?.type === 'activity') {
        const ts = e.data.payload?.ts ?? Date.now()
        lastActivityRef.current = ts
        deadlineRef.current = ts + timeoutMin * 60 * 1000
        warningStartRef.current = deadlineRef.current - warnSec * 1000
        setShowWarning(false)
        setSecondsToLogout(null)
        setIsModalSticky(false)
      }
      if (e?.data?.type === 'logout') {
        // Only logout if this tab is actually expired.
        // This prevents another tab's timeout from logging out a tab
        // where the user just clicked "Permanecer conectado".
        const now = Date.now()
        const isExpiredHere = now >= deadlineRef.current
        const justManuallyReset = now - lastManualResetRef.current < 5000 // 5s grace
        if (isExpiredHere && !justManuallyReset) {
          performLogout()
        }
        // Otherwise ignore the cross-tab logout
      }
      if (e?.data?.type === 'modal-sticky') {
        setIsModalSticky(e.data.payload?.sticky ?? false)
      }
    }
    channelRef.current?.addEventListener('message', onMsg)

    // system events considered activity (only if modal is not sticky)
    const markActive = () => {
      if (!isModalSticky) {
        resetActivityTimer()
      }
    }
    const onVisibility = () => { 
      if (!document.hidden && !isModalSticky) {
        resetActivityTimer()
      }
    }
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']
    events.forEach(ev => window.addEventListener(ev, markActive, { passive: true }))
    document.addEventListener('visibilitychange', onVisibility)

    // main loop (once per second) to manage warning and logout
    intervalRef.current = window.setInterval(() => {
      const now = Date.now()
      if (now >= deadlineRef.current) {
        broadcast('logout')
        performLogout()
        return
      }
      if (now >= warningStartRef.current) {
        setShowWarning(true)
        setSecondsToLogout(Math.ceil((deadlineRef.current - now) / 1000))
        // Make modal sticky when warning appears
        if (!isModalSticky) {
          setIsModalSticky(true)
          broadcast('modal-sticky', { sticky: true })
        }
      } else {
        setShowWarning(false)
        setSecondsToLogout(null)
        setIsModalSticky(false)
      }
    }, 1000)

    // listen storage as fallback (Safari older)
    const onStorage = (e) => {
      if (e.key === 'idle:lastActivityAt' && e.newValue) {
        const ts = Number(e.newValue)
        if (Number.isFinite(ts)) {
          lastActivityRef.current = ts
          deadlineRef.current = ts + timeoutMin * 60 * 1000
          warningStartRef.current = deadlineRef.current - warnSec * 1000
          setShowWarning(false)
          setSecondsToLogout(null)
          setIsModalSticky(false)
        }
      }
    }
    window.addEventListener('storage', onStorage)

    return () => {
      events.forEach(ev => window.removeEventListener(ev, markActive))
      document.removeEventListener('visibilitychange', onVisibility)
      if (intervalRef.current) clearInterval(intervalRef.current)
      try { 
        channelRef.current?.removeEventListener('message', onMsg); 
        channelRef.current?.close() 
      } catch (e) {
        console.error('Error closing broadcast channel:', e);
      }
      window.removeEventListener('storage', onStorage)
    }
  }, [idleEnabled, timeoutMin, warnSec, resetActivityTimer, performLogout, readStorage, writeStorage, broadcast, isModalSticky])

  const value = useMemo(() => ({ resetActivityTimer, secondsToLogout }), [resetActivityTimer, secondsToLogout])

  return (
    <IdleContext.Provider value={value}>
      {children}
      {idleEnabled && showWarning && (
        <IdleWarningModal
          secondsLeft={secondsToLogout}
          onStay={resetActivityTimer}
          onLogout={() => { broadcast('logout'); performLogout() }}
        />
      )}
    </IdleContext.Provider>
  )
}


