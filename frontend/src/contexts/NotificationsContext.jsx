import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from './AuthContextBase';
import { 
  requestNotificationPermission, 
  isNotificationPermissionGranted,
  showPushNotification 
} from '../utils/pushNotifications';

const NotificationsContext = createContext(null);

/**
 * Provider pentru gestionarea notificărilor în timp real
 * Folosește WebSocket pentru a primi notificări de la server
 */
export const NotificationsProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket, isConnected, joinRoom } = useWebSocket();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Join la room-urile utilizatorului când se conectează
  useEffect(() => {
    if (isConnected && user) {
      // Join la room-ul utilizatorului
      if (user.CODIGO) {
        joinRoom(`user:${user.CODIGO}`);
      }

      // Join la room-ul grupului
      if (user.GRUPO) {
        joinRoom(`grupo:${user.GRUPO}`);
      }

      // Join la room-ul centrului de lucru
      if (user['CENTRO TRABAJO']) {
        const centro = user['CENTRO TRABAJO'].replace(/\s+/g, '_');
        joinRoom(`centro:${centro}`);
      }
    }
  }, [isConnected, user, joinRoom]);

  // Încarcă notificările din baza de date când utilizatorul se conectează
  useEffect(() => {
    if (!user?.CODIGO) return;

    const loadNotifications = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        const baseUrl = import.meta.env.DEV 
          ? 'http://localhost:3000' 
          : (import.meta.env.VITE_API_BASE_URL || 'https://api.decaminoservicios.com');
        const response = await fetch(`${baseUrl}/api/notifications`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Transformă notificările din format BD în format frontend
            const formattedNotifications = data.notifications.map(n => ({
              id: n.id,
              type: n.type,
              title: n.title,
              message: n.message,
              content: n.message,
              timestamp: n.createdAt,
              read: n.read,
              data: n.data,
            }));
            
            setNotifications(formattedNotifications);
            setUnreadCount(data.unreadCount || 0);
          }
        }
      } catch (error) {
        console.error('❌ [Notifications] Error loading notifications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadNotifications();
  }, [user?.CODIGO]);

  // Cere permisiunea pentru notificări push când utilizatorul se conectează
  useEffect(() => {
    if (user && !isNotificationPermissionGranted()) {
      // Cere permisiunea după 2 secunde (pentru a nu deranja imediat)
      const timer = setTimeout(() => {
        requestNotificationPermission();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Ascultă notificări de la server
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notification) => {
      console.log('🔔 [Notifications] Received notification:', notification);
      
      // Adaugă notificarea în listă
      setNotifications((prev) => {
        // Evită duplicate-urile
        const exists = prev.some(n => n.id === notification.id);
        if (exists) return prev;
        
        return [notification, ...prev].slice(0, 50); // Păstrează ultimele 50
      });

      // Incrementează contorul de necitite
      setUnreadCount((prev) => prev + 1);

      // Afișează notificare push nativă (ca la Facebook)
      if (isNotificationPermissionGranted()) {
        showPushNotification(notification);
      }
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket]);

  // Marchează notificarea ca citită
  const markAsRead = useCallback(async (notificationId) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    // Sincronizează cu backend-ul
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const baseUrl = import.meta.env.DEV 
        ? 'http://localhost:3000' 
        : (import.meta.env.VITE_API_BASE_URL || '');
      await fetch(`${baseUrl}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('❌ [Notifications] Error marking as read:', error);
      // Revert optimistic update dacă e nevoie
    }
  }, []);

  // Marchează toate notificările ca citite
  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true }))
    );
    setUnreadCount(0);

    // Sincronizează cu backend-ul
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const baseUrl = import.meta.env.DEV 
        ? 'http://localhost:3000' 
        : (import.meta.env.VITE_API_BASE_URL || '');
      await fetch(`${baseUrl}/api/notifications/read-all`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('❌ [Notifications] Error marking all as read:', error);
    }
  }, []);

  // Șterge o notificare
  const removeNotification = useCallback(async (notificationId) => {
    // Optimistic update
    const notification = notifications.find((n) => n.id === notificationId);
    if (notification && !notification.read) {
      setUnreadCount((prevCount) => Math.max(0, prevCount - 1));
    }
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

    // Sincronizează cu backend-ul
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const baseUrl = import.meta.env.DEV 
        ? 'http://localhost:3000' 
        : (import.meta.env.VITE_API_BASE_URL || '');
      await fetch(`${baseUrl}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('❌ [Notifications] Error deleting notification:', error);
      // Revert optimistic update dacă e nevoie
    }
  }, [notifications]);

  // Șterge toate notificările
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const value = {
    notifications,
    unreadCount,
    isConnected,
    isLoading,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

/**
 * Hook pentru a folosi NotificationsContext
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
};
