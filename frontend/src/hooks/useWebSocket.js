import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContextBase';
import { useSessionExpired } from '../contexts/SessionExpiredContext';
import { isTokenFullyExpired } from '../utils/tokenRefresh';
import { BASE_URL } from '../utils/routes';

/**
 * Hook pentru gestionarea conexiunii WebSocket
 * Conectează automat la server și gestionează reconexiunea
 * Folosește același BASE_URL ca restul app (routes) ca să meargă și în producție.
 */
export const useWebSocket = (namespace = '/notifications') => {
  const { user } = useAuth();
  const { isSessionExpired } = useSessionExpired();
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const connectRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const getSocketUrl = () => {
    return BASE_URL || '';
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

    // Verifică dacă token-ul e expirat înainte de a încerca conexiunea
    if (isTokenFullyExpired()) {
      console.log('🔌 [WebSocket] Token expired, skipping connection');
      return;
    }

    // Dacă există deja o conexiune, o închidem curat
    if (socketRef.current) {
      // Elimină event listener-ele pentru a evita warning-uri
      socketRef.current.removeAllListeners();
      // Închide conexiunea fără reconectare
      socketRef.current.disconnect();
      socketRef.current = null;
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

      // Nu reconectăm dacă token-ul e expirat
      if (isTokenFullyExpired()) {
        console.log('🔌 [WebSocket] Token expired, not reconnecting');
        return;
      }

      // Reconnect dacă nu a fost o deconexiune intenționată
      if (reason === 'io server disconnect') {
        // Server-ul a deconectat, reconectăm manual
        reconnectTimeoutRef.current = setTimeout(() => {
          // Verifică din nou dacă token-ul e expirat înainte de reconectare
          if (isTokenFullyExpired()) {
            console.log('🔌 [WebSocket] Token expired during reconnect attempt, aborting');
            return;
          }
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            console.log(`🔄 [WebSocket] Reconnecting (attempt ${reconnectAttemptsRef.current})...`);
            if (connectRef.current) {
              connectRef.current();
            }
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

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user, namespace]);

  // Actualizează ref-ul pentru apelul recursiv (în useEffect pentru a evita actualizarea în timpul render-ului)
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Deconectare
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 [WebSocket] Disconnecting...');
      // Verifică dacă socket-ul este conectat sau în proces de conectare
      if (socketRef.current.connected || socketRef.current.connecting) {
        // Elimină event listener-ele pentru a evita warning-uri
        socketRef.current.removeAllListeners();
        // Închide conexiunea fără reconectare
        socketRef.current.disconnect();
      }
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  }, []);

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

  // Deconectează WebSocket-ul când sesiunea expiră
  useEffect(() => {
    if (isSessionExpired && socketRef.current) {
      console.log('🔌 [WebSocket] Session expired, disconnecting...');
      // Mutăm apelul într-un setTimeout pentru a evita cascading renders
      setTimeout(() => {
        disconnect();
      }, 0);
    }
  }, [isSessionExpired, disconnect]);

  // Conectare la mount și când user-ul se schimbă
  useEffect(() => {
    if (user) {
      // Verifică dacă token-ul e valid înainte de a încerca conexiunea
      const token = localStorage.getItem('auth_token');
      if (!token || isTokenFullyExpired()) {
        console.log('🔌 [WebSocket] Token missing or expired, skipping connection');
        return;
      }

      // Nu conectăm dacă sesiunea e expirată
      if (isSessionExpired) {
        console.log('🔌 [WebSocket] Session expired, skipping connection');
        return;
      }

      // Amânăm apelul connect() pentru a evita cascading renders
      // Folosim setTimeout pentru a amâna după ce render-ul s-a terminat
      const timeoutId = setTimeout(() => {
        connect();
      }, 0);

      return () => {
        clearTimeout(timeoutId);
      };
    }

    return () => {
      // Cleanup: închide conexiunea și anulează timeout-urile
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        if (socketRef.current.connected || socketRef.current.connecting) {
          socketRef.current.disconnect();
        }
        socketRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
    };
  }, [user, connect, isSessionExpired]);

  return {
    socket,
    isConnected,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
  };
};
