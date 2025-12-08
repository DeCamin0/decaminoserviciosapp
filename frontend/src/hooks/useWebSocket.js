import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContextBase';

/**
 * Hook pentru gestionarea conexiunii WebSocket
 * Conectează automat la server și gestionează reconexiunea
 */
export const useWebSocket = (namespace = '/notifications') => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // URL-ul backend-ului pentru WebSocket
  const getSocketUrl = () => {
    if (import.meta.env.DEV) {
      return 'http://localhost:3000';
    }
    return import.meta.env.VITE_BACKEND_URL || 'https://api.decaminoservicios.com';
  };

  // Conectare la WebSocket
  const connect = useCallback(() => {
    if (!user) {
      console.log('🔌 [WebSocket] No user, skipping connection');
      return;
    }

    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.log('🔌 [WebSocket] No token, skipping connection');
      return;
    }

    // Dacă există deja o conexiune, o închidem
    if (socket) {
      socket.disconnect();
    }

    const socketUrl = getSocketUrl();
    console.log(`🔌 [WebSocket] Connecting to ${socketUrl}${namespace}`);

    const newSocket = io(`${socketUrl}${namespace}`, {
      auth: {
        token: token,
      },
      query: {
        token: token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts,
    });

    // Event handlers
    newSocket.on('connect', () => {
      console.log('✅ [WebSocket] Connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      
      // Clear any pending reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ [WebSocket] Disconnected:', reason);
      setIsConnected(false);

      // Reconnect dacă nu a fost o deconexiune intenționată
      if (reason === 'io server disconnect') {
        // Server-ul a deconectat, reconectăm manual
        reconnectTimeoutRef.current = setTimeout(() => {
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            console.log(`🔄 [WebSocket] Reconnecting (attempt ${reconnectAttemptsRef.current})...`);
            connect();
          }
        }, 2000);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ [WebSocket] Connection error:', error.message);
      setIsConnected(false);
    });

    newSocket.on('connected', (data) => {
      console.log('✅ [WebSocket] Server confirmed connection:', data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user, namespace]);

  // Deconectare
  const disconnect = useCallback(() => {
    if (socket) {
      console.log('🔌 [WebSocket] Disconnecting...');
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket]);

  // Join room
  const joinRoom = useCallback((room) => {
    if (socket && isConnected) {
      console.log(`🏠 [WebSocket] Joining room: ${room}`);
      socket.emit('join-room', { room });
    }
  }, [socket, isConnected]);

  // Leave room
  const leaveRoom = useCallback((room) => {
    if (socket && isConnected) {
      console.log(`🚪 [WebSocket] Leaving room: ${room}`);
      socket.emit('leave-room', { room });
    }
  }, [socket, isConnected]);

  // Conectare la mount și când user-ul se schimbă
  useEffect(() => {
    if (user) {
      connect();
    }

    return () => {
      disconnect();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user]);

  // Cleanup la unmount
  useEffect(() => {
    return () => {
      disconnect();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    socket,
    isConnected,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
  };
};
