import { useState, useRef, useEffect, useContext, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { Bell, ChevronRight } from 'lucide-react';
import { NotificationsContext } from '../contexts/NotificationsContext';
import {
  requestNotificationPermission,
  isNotificationPermissionGranted,
} from '../utils/pushNotifications';
import { resolveNotificationUrl } from '../utils/notificationNavigation';

/**
 * Component pentru afișarea notificărilor în timp real
 * Afișează un icon cu badge pentru notificările necitite
 * și un dropdown cu lista de notificări
 */
const NotificationsBell = () => {
  const navigate = useNavigate();
  const context = useContext(NotificationsContext);
  const [isOpen, setIsOpen] = useState(false);
  const [hasPermission, setHasPermission] = useState(
    isNotificationPermissionGranted(),
  );
  const [panelStyle, setPanelStyle] = useState(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const notifications = useMemo(
    () => context?.notifications || [],
    [context?.notifications],
  );
  const unreadCount = context?.unreadCount || 0;
  const markAsRead = useMemo(
    () => context?.markAsRead || (() => {}),
    [context?.markAsRead],
  );
  const markAllAsRead = context?.markAllAsRead || (() => {});

  useEffect(() => {
    if (!isOpen) return undefined;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 16);
      const right = Math.max(8, window.innerWidth - rect.right);
      setPanelStyle({
        position: 'fixed',
        top: `${rect.bottom + 8}px`,
        right: `${right}px`,
        width: `${width}px`,
        zIndex: 200,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      if (buttonRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Navigare din Service Worker (click pe push când app e deja deschisă)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onMessage = (event) => {
      const msg = event?.data;
      if (!msg || msg.type !== 'NOTIFICATION_NAVIGATE') return;
      const path = resolveNotificationUrl({
        data: { url: msg.url },
        url: msg.url,
      });
      if (path) navigate(path);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () =>
      navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);

  if (!context) {
    return null;
  }

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
    const path = resolveNotificationUrl(notification);
    if (path) {
      navigate(path);
    }
  };

  const dropdown = isOpen && panelStyle
    ? createPortal(
        <div
          ref={dropdownRef}
          style={panelStyle}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 max-h-96 overflow-y-auto"
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Notificaciones
              </h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    markAllAsRead();
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>

            {!hasPermission && (
              <button
                type="button"
                onClick={async () => {
                  const granted = await requestNotificationPermission();
                  setHasPermission(granted);
                  if (granted) {
                    alert(
                      '✅ Las notificaciones push están activadas. Recibirás notificaciones incluso cuando la aplicación esté cerrada.',
                    );
                  }
                }}
                className="w-full mt-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                🔔 Activar notificaciones push
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No tienes notificaciones
              </div>
            ) : (
              notifications.map((notification) => {
                const path = resolveNotificationUrl(notification);
                return (
                  <button
                    type="button"
                    key={notification.id || notification.timestamp}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors ${
                      !notification.read ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium ${
                            !notification.read
                              ? 'text-gray-900 dark:text-gray-100'
                              : 'text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {notification.title || 'Notificación'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {notification.message || notification.content}
                        </p>
                        {notification.timestamp && (
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notification.timestamp).toLocaleString(
                              'es-ES',
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 shrink-0">
                        {!notification.read && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                        {path && (
                          <ChevronRight
                            className="w-4 h-4 text-gray-400"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        aria-label="Notificaciones"
        aria-expanded={isOpen}
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {dropdown}
    </div>
  );
};

export default NotificationsBell;
