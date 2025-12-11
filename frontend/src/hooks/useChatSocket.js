import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContextBase';

/**
 * Hook pentru gestionarea conexiunii WebSocket pentru chat
 * Conectează automat la server și gestionează reconexiunea
 */
export const useChatSocket = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  // URL-ul backend-ului pentru WebSocket
  const getSocketUrl = () => {
    if (import.meta.env.DEV) {
      return 'http://localhost:3000';
    }
    return 'https://api.decaminoservicios.com';
  };

  // Conectare la WebSocket
  const connect = useCallback(() => {
    if (!user) {
      console.log('💬 [ChatSocket] No user, skipping connection');
      return;
    }

    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.log('💬 [ChatSocket] No token, skipping connection');
      return;
    }

    // Dacă există deja o conexiune, o închidem
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socketUrl = getSocketUrl();
    const namespace = '/chat';
    console.log(`💬 [ChatSocket] Connecting to ${socketUrl}${namespace}`);

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
      reconnectionAttempts: 5,
    });

    // Event handlers
    newSocket.on('connect', () => {
      console.log('✅ [ChatSocket] Connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ [ChatSocket] Disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ [ChatSocket] Connection error:', error.message);
    });

    newSocket.on('connected', (data) => {
      console.log('✅ [ChatSocket] Server confirmed connection:', data);
    });

    newSocket.on('error', (error) => {
      console.error('❌ [ChatSocket] Socket error:', error);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user]);

  // Join la un room
  const joinRoom = useCallback((roomId) => {
    if (!socketRef.current || !isConnected) {
      console.warn('💬 [ChatSocket] Cannot join room: not connected');
      return;
    }

    console.log(`💬 [ChatSocket] Joining room: ${roomId}`);
    socketRef.current.emit('join-room', { roomId });
  }, [isConnected]);

  // Leave dintr-un room
  const leaveRoom = useCallback((roomId) => {
    if (!socketRef.current || !isConnected) {
      return;
    }

    console.log(`💬 [ChatSocket] Leaving room: ${roomId}`);
    socketRef.current.emit('leave-room', { roomId });
  }, [isConnected]);

  // Trimite mesaj
  const sendMessage = useCallback((roomId, message) => {
    if (!socketRef.current || !isConnected) {
      console.warn('💬 [ChatSocket] Cannot send message: not connected');
      return;
    }

    socketRef.current.emit('message', { roomId, message });
  }, [isConnected]);

  // Conectează când userul este disponibil
  useEffect(() => {
    if (user) {
      connect();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [user, connect]);

  return {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
    sendMessage,
  };
};

