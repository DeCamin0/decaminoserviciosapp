import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationsContext';
import { requestNotificationPermission, isNotificationPermissionGranted } from '../utils/pushNotifications';
import Notification from './ui/Notification';

/**
 * Component pentru afișarea notificărilor în timp real
 * Afișează un icon cu badge pentru notificările necitite
 * și un dropdown cu lista de notificări
 */
const NotificationsBell = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [showNotification, setShowNotification] = useState(null);
  const [hasPermission, setHasPermission] = useState(isNotificationPermissionGranted());
  const dropdownRef = useRef(null);

  // Închide dropdown-ul când se face click în afara lui
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Afișează notificarea când apare una nouă
  useEffect(() => {
    const latestNotification = notifications[0];
    if (latestNotification && !latestNotification.read) {
      setShowNotification({
        type: latestNotification.type || 'info',
        title: latestNotification.title || 'Nouă notificare',
        message: latestNotification.message || latestNotification.content,
        onClose: () => {
          setShowNotification(null);
          if (latestNotification.id) {
            markAsRead(latestNotification.id);
          }
        },
      });
    }
  }, [notifications, markAsRead]);

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
  };

  return (
    <>
      {/* Icon cu badge */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
          aria-label="Notificări"
        >
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown cu notificări */}
        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto"
          >
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">Notificări</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      markAllAsRead();
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Marchează toate ca citite
                  </button>
                )}
              </div>
              
              {/* Buton pentru activarea notificărilor push */}
              {!hasPermission && (
                <button
                  onClick={async () => {
                    const granted = await requestNotificationPermission();
                    setHasPermission(granted);
                    if (granted) {
                      alert('✅ Notificările push sunt acum activate! Vei primi notificări chiar și când aplicația este închisă.');
                    }
                  }}
                  className="w-full mt-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  🔔 Activează notificări push
                </button>
              )}
            </div>

            <div className="divide-y divide-gray-200">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Nu ai notificări
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id || notification.timestamp}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          !notification.read ? 'text-gray-900' : 'text-gray-600'
                        }`}>
                          {notification.title || 'Notificare'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {notification.message || notification.content}
                        </p>
                        {notification.timestamp && (
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notification.timestamp).toLocaleString('ro-RO')}
                          </p>
                        )}
                      </div>
                      {!notification.read && (
                        <div className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notificare popup pentru notificări noi */}
      {showNotification && (
        <Notification
          type={showNotification.type}
          title={showNotification.title}
          message={showNotification.message}
          onClose={showNotification.onClose}
          duration={5000}
        />
      )}
    </>
  );
};

export default NotificationsBell;
