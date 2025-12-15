import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatApi } from '../hooks/useChatApi';
import { useChatSocket } from '../hooks/useChatSocket';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../contexts/AuthContextBase';
import { ArrowLeft, X, Trash2, Users, Building2, Plus, Check, CheckCheck, Shield } from 'lucide-react';
import Notification from '../components/ui/Notification';
import { routes } from '../utils/routes';

// Memoized messages list to avoid re-rendering the input while messages update
const MessageList = memo(function MessageList({
  messages,
  selectedRoom,
  colleagues,
  supervisors,
  user,
  loadingMessages,
  messagesContainerRef,
  handleScroll,
  messagesEndRef,
}) {
  const currentUserId = Number(user?.CODIGO || user?.codigo || user?.id || user?.empleadoId);

  return (
    <div
      ref={messagesContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900"
    >
      {loadingMessages && messages.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">Cargando mensajes...</div>
      ) : messages.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">No hay mensajes todavía. ¡Envía el primer mensaje!</div>
      ) : (
        messages.map((msg) => {
          const msgUserId = Number(msg.user_id);
          const isOwn = msgUserId === currentUserId;

          let senderName = `Usuario ${msg.user_id}`;
          if (!isOwn) {
            // For supervisor group DM rooms (centro_id < 0), regular DM rooms, or centro rooms
            // Always check both colleagues and supervisors lists
            const senderColleague = colleagues.find((c) => c.codigo === msgUserId);
            const senderSupervisor = supervisors.find((s) => s.codigo === msgUserId);
            if (senderColleague) {
              senderName = senderColleague.nombre || senderName;
            } else if (senderSupervisor) {
              senderName = senderSupervisor.nombre || senderName;
            }
          }

          return (
            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg shadow-sm ${
                  isOwn
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {!isOwn && (
                  <div className="text-xs font-semibold mb-1 text-gray-600 dark:text-gray-400">
                    {senderName}
                  </div>
                )}
                <div
                  className={`text-sm whitespace-pre-wrap ${isOwn ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}
                >
                  {msg.message}
                </div>
                <div
                  className={`flex items-center justify-between mt-2 ${
                    isOwn ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <span className="text-xs">
                    {new Date(msg.created_at).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isOwn && (
                    <span className="ml-2 flex items-center">
                      {(() => {
                        if (selectedRoom?.tipo === 'dm' && selectedRoom?.members) {
                          const otherMember = selectedRoom.members.find(
                            (m) => Number(m.user_id) !== currentUserId,
                          );
                          if (otherMember) {
                            const otherUserId = Number(otherMember.user_id);
                            const isReadByOther = msg.read_by?.some(
                              (read) => Number(read.user_id) === otherUserId,
                            );
                            return isReadByOther ? (
                              <CheckCheck className="h-3.5 w-3.5 text-blue-400" title="Leído" />
                            ) : (
                              <Check className="h-3.5 w-3.5" title="Enviado" />
                            );
                          }
                        }
                        return <Check className="h-3.5 w-3.5" title="Enviado" />;
                      })()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  );
});

// Memoized chat input to keep focus stable while messages update
const ChatInput = memo(function ChatInput({
  textareaRef,
  newMessage,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  onSubmit,
  loading,
  error,
}) {
  return (
    <form onSubmit={onSubmit} className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
      {error && <div className="mb-2 text-red-600 dark:text-red-400 text-sm">{error}</div>}
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={newMessage}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 resize-none min-h-[44px] max-h-32"
          disabled={loading}
          rows={1}
          style={{
            overflowY: 'auto',
            scrollbarWidth: 'thin',
          }}
        />
        <button
          type="submit"
          disabled={loading || !newMessage.trim()}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Enviar
        </button>
      </div>
    </form>
  );
});

const ChatPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { fetchRooms, fetchMessages, sendMessage, createDMRoom, createCentroRoom, createSupervisorGroupRoom, fetchColleagues, fetchSupervisors, deleteRoom, markMessagesAsRead, loading, error } = useChatApi();
  const { socket: chatSocket, isConnected: isChatConnected } = useChatSocket();
  // Use notifications socket for presence events (it's always connected when user is logged in)
  const { socket: notificationsSocket, isConnected: isNotificationsConnected } = useWebSocket('/notifications');
  const [rooms, setRooms] = useState([]);
  const [colleagues, setColleagues] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const cursorPosRef = useRef(null); // track cursor position to restore focus
  const wasFocusedRef = useRef(false); // track if textarea was focused
  const [loadingMessages, setLoadingMessages] = useState(false);
  const shouldAutoScroll = useRef(true);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, roomId: null });
  const [chatMode, setChatMode] = useState('centro'); // centro, empleado, or supervisor
  const [showCreateCentro, setShowCreateCentro] = useState(false);
  const [showCreateEmpleado, setShowCreateEmpleado] = useState(false);
  // const [showCreateSupervisor, setShowCreateSupervisor] = useState(false); // Not used currently
  // const [allEmployees, setAllEmployees] = useState([]); // Not used currently
  const [allCentros, setAllCentros] = useState([]);
  const [userCentro, setUserCentro] = useState(null); // user's centro from backend
  const [searchCentro, setSearchCentro] = useState('');
  const [searchEmpleado, setSearchEmpleado] = useState('');
  // const [searchSupervisor, setSearchSupervisor] = useState(''); // Not used currently
  // Presence state: Map<userId, {online: boolean, lastSeen: string | null}>
  const [presences, setPresences] = useState(new Map());

  const loadColleagues = async () => {
    console.log('💬 [ChatPage] Loading colleagues...');
    const result = await fetchColleagues();
    console.log('💬 [ChatPage] Fetch colleagues result:', result);
    if (result.success) {
      console.log('💬 [ChatPage] Colleagues loaded:', result.data);
      setColleagues(result.data || []);
      
      // Initialize presences from colleagues response (includes presence from backend)
      if (result.data && result.data.length > 0) {
        const newPresences = new Map(presences);
        result.data.forEach(colleague => {
          if (colleague.presence) {
            newPresences.set(String(colleague.codigo), {
              online: colleague.presence.online || false,
              lastSeen: colleague.presence.lastSeen || null,
            });
          } else {
            newPresences.set(String(colleague.codigo), {
              online: false,
              lastSeen: null,
            });
          }
        });
        setPresences(newPresences);
      }
    } else {
      console.error('💬 [ChatPage] Failed to load colleagues:', result.error);
    }
  };

  const loadSupervisors = async () => {
    console.log('💬 [ChatPage] Loading supervisors...');
    const result = await fetchSupervisors();
    console.log('💬 [ChatPage] Fetch supervisors result:', result);
    if (result.success) {
      console.log('💬 [ChatPage] Supervisors loaded:', result.data);
      setSupervisors(result.data || []);
      
      // Initialize presences from supervisors response (includes presence from backend)
      if (result.data && result.data.length > 0) {
        const newPresences = new Map(presences);
        result.data.forEach(supervisor => {
          if (supervisor.presence) {
            newPresences.set(String(supervisor.codigo), {
              online: supervisor.presence.online || false,
              lastSeen: supervisor.presence.lastSeen || null,
            });
          } else {
            newPresences.set(String(supervisor.codigo), {
              online: false,
              lastSeen: null,
            });
          }
        });
        setPresences(newPresences);
      }
    } else {
      console.error('💬 [ChatPage] Failed to load supervisors:', result.error);
    }
  };

  useEffect(() => {
    loadRooms();
    loadColleagues();
    loadSupervisors(); // Need to load supervisors to display names in supervisor group chat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally run only once on mount

  // Listen to presence events from Socket.IO - use notifications socket (always connected when logged in)
  useEffect(() => {
    // Use notifications socket for presence events (it's connected when user is logged in, not just when chat is open)
    const socketToUse = notificationsSocket || chatSocket;
    const isConnectedToUse = isNotificationsConnected || isChatConnected;
    
    if (!socketToUse || !isConnectedToUse) {
      return;
    }

    const handlePresenceOnline = (data) => {
      console.log('💬 [ChatPage] User came online:', data);
      setPresences(prev => {
        const newPresences = new Map(prev);
        newPresences.set(String(data.userId), {
          online: true,
          lastSeen: null,
        });
        return newPresences;
      });
    };

    const handlePresenceOffline = (data) => {
      console.log('💬 [ChatPage] User went offline:', data);
      setPresences(prev => {
        const newPresences = new Map(prev);
        newPresences.set(String(data.userId), {
          online: false,
          lastSeen: data.lastSeen || new Date().toISOString(),
        });
        return newPresences;
      });
    };

    socketToUse.on('presence:online', handlePresenceOnline);
    socketToUse.on('presence:offline', handlePresenceOffline);

    return () => {
      socketToUse.off('presence:online', handlePresenceOnline);
      socketToUse.off('presence:offline', handlePresenceOffline);
    };
  }, [notificationsSocket, chatSocket, isNotificationsConnected, isChatConnected]);

  // Check if user is near bottom (within 100px) - currently not used
  // const isNearBottom = useCallback(() => {
  //   if (!messagesContainerRef.current) return true;
  //   const container = messagesContainerRef.current;
  //   const threshold = 100;
  //   return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  // }, []);

  // Handle scroll - auto-scroll disabled, just track scroll position
  const handleScroll = useCallback(() => {
    // Auto-scroll disabled - user controls scroll manually
    // shouldAutoScroll.current = isNearBottom();
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    // Smooth scroll inside the chat container only (no page scroll)
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  // Polling for new messages - separate effect to avoid re-creating interval
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  
  const loadRooms = async () => {
    console.log('💬 [ChatPage] Loading rooms...');
    const result = await fetchRooms();
    console.log('💬 [ChatPage] Fetch rooms result:', result);
    if (result.success) {
      console.log('💬 [ChatPage] Rooms loaded:', result.data);
      setRooms(result.data || []);
      // Store user_centro if returned by backend
      if (result.user_centro) {
        console.log('💬 [ChatPage] User centro from backend:', result.user_centro);
        setUserCentro(result.user_centro);
        // For employees, populate centros immediately
        if (!isDeveloper) {
          setAllCentros([result.user_centro]);
        }
      }
    } else {
      console.error('💬 [ChatPage] Failed to load rooms:', result.error);
    }
  };

  const loadMessages = useCallback(async (roomId) => {
    setLoadingMessages(true);
    const result = await fetchMessages(roomId);
    if (result.success) {
      // Replace all messages (always) to get updated read receipts
      setMessages(result.data);
      // After initial load of a room, allow auto-scroll to bottom once
      shouldAutoScroll.current = true;
    }
    setLoadingMessages(false);
  }, [fetchMessages]);

  // Initial load when room changes
  useEffect(() => {
    if (selectedRoom) {
      loadMessages(selectedRoom.id);
    }
  }, [selectedRoom, loadMessages]);

  // Polling effect
  useEffect(() => {
    if (!selectedRoom) return;
    
    const interval = setInterval(() => {
      loadMessages(selectedRoom.id).catch(err => {
        console.error('💬 [ChatPage] Error polling messages:', err);
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, [selectedRoom, loadMessages]);

  // Auto-scroll when explicitly requested (e.g., after sending a message)
  useEffect(() => {
    if (shouldAutoScroll.current) {
      scrollToBottom();
      shouldAutoScroll.current = false;
    }
  }, [messages, scrollToBottom]);

  // Auto-scroll disabled when switching rooms - user controls scroll manually
  // useEffect(() => {
  //   shouldAutoScroll.current = true;
  //   if (selectedRoom && messagesContainerRef.current) {
  //     // Small delay to ensure messages are rendered
  //     setTimeout(() => {
  //       scrollToBottom();
  //     }, 100);
  //   }
  // }, [selectedRoom, scrollToBottom]);

  // Mark messages as read when they become visible - with debounce
  const markReadTimeoutRef = useRef(null);
  useEffect(() => {
    if (!selectedRoom || !messages.length) return;
    
    // Don't mark as read if user is typing
    if (isTypingRef.current) {
      return;
    }

    // Clear previous timeout
    if (markReadTimeoutRef.current) {
      clearTimeout(markReadTimeoutRef.current);
    }

    const currentUserId = Number(user?.CODIGO || user?.codigo || user?.id || user?.empleadoId);
    console.log('💬 [ChatPage] Checking messages for read receipts. Current userId:', currentUserId);
    console.log('💬 [ChatPage] Messages:', messages.map(m => ({ id: m.id, user_id: m.user_id, read_by: m.read_by })));
    
    const unreadMessageIds = messages
      .filter(msg => {
        // Only mark messages as read if they're not from current user
        const msgUserId = Number(msg.user_id);
        if (msgUserId === currentUserId) return false;
        
        // Check if message is already read by current user
        const isRead = msg.read_by?.some(read => Number(read.user_id) === currentUserId);
        if (!isRead) {
          console.log('💬 [ChatPage] Message', msg.id, 'is unread by user', currentUserId);
        }
        return !isRead;
      })
      .map(msg => msg.id);

    console.log('💬 [ChatPage] Unread message IDs:', unreadMessageIds);

    if (unreadMessageIds.length > 0) {
      // Debounce: mark as read after 1 second delay to avoid interfering with user typing
      markReadTimeoutRef.current = setTimeout(() => {
        // Double-check user is not typing before marking as read
        if (!isTypingRef.current) {
          console.log('💬 [ChatPage] Calling markMessagesAsRead for room', selectedRoom.id, 'messages:', unreadMessageIds);
          markMessagesAsRead(selectedRoom.id, unreadMessageIds).then(result => {
            console.log('💬 [ChatPage] markMessagesAsRead result:', result);
            // Reload messages to get updated read status
            if (result.success) {
              setTimeout(() => {
                loadMessages(selectedRoom.id);
              }, 300);
            }
          });
        }
      }, 1000);
    }

    return () => {
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current);
      }
    };
  }, [messages, selectedRoom, user, markMessagesAsRead, loadMessages]);

  const handleSendMessage = useCallback(async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedRoom) return;

    const messageToSend = newMessage.trim();
    setNewMessage(''); // Clear input immediately
    // Reset cursor tracking
    cursorPosRef.current = null;
    
    // For new outgoing messages, allow scroll to bottom
    shouldAutoScroll.current = true;

    // Mark as not typing since message is sent
    isTypingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    const result = await sendMessage(selectedRoom.id, messageToSend);
    if (result.success) {
      // Reload messages to show the new one (after a small delay to ensure it's saved)
      setTimeout(() => {
        loadMessages(selectedRoom.id).then(() => {
          // Force scroll to bottom right after sending
          scrollToBottom();
        });
      }, 200);
    } else {
      // Restore message if send failed
      setNewMessage(messageToSend);
    }
  }, [newMessage, selectedRoom, sendMessage, loadMessages, scrollToBottom]);

  const handleKeyDown = useCallback((e) => {
    // Mark as typing
    isTypingRef.current = true;
    // Track cursor position
    cursorPosRef.current = e.target.selectionStart;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 2000); // Reset after 2 seconds of no typing
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  }, [handleSendMessage]);

  const handleInputChange = useCallback((e) => {
    setNewMessage(e.target.value);
    // Track cursor position
    cursorPosRef.current = e.target.selectionStart;
    // Mark as typing
    isTypingRef.current = true;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 2000); // Reset after 2 seconds of no typing
  }, []);


  // Auto-resize textarea - preserve focus during resize and prevent scroll
  // This effect only runs when newMessage changes, NOT when messages update
  useEffect(() => {
    if (!textareaRef.current) return;
    
    const isFocused = document.activeElement === textareaRef.current;
    
    // Save current state before any DOM manipulation
    const cursorPosition = textareaRef.current.selectionStart;
    const scrollTop = textareaRef.current.scrollTop;
    const messagesScrollTop = messagesContainerRef.current?.scrollTop || 0;
    
    // Resize textarea (this is needed when user types)
    textareaRef.current.style.height = 'auto';
    const newHeight = Math.min(textareaRef.current.scrollHeight, 128);
    textareaRef.current.style.height = `${newHeight}px`;
    
    // Restore cursor and focus ONLY if textarea was focused
    if (isFocused) {
      // Use double requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            // Restore focus and cursor position
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
            textareaRef.current.scrollTop = scrollTop;
            // Restore messages container scroll position
            if (messagesContainerRef.current) {
              messagesContainerRef.current.scrollTop = messagesScrollTop;
            }
          }
        });
      });
    }
  }, [newMessage]); // Only depends on newMessage, NOT on messages

  // Restore focus after messages update if user was focused
  useEffect(() => {
    if (!wasFocusedRef.current || !textareaRef.current) return;
    const el = textareaRef.current;
    if (document.activeElement !== el) {
      el.focus();
      const pos = cursorPosRef.current ?? el.value.length;
      try {
        el.setSelectionRange(pos, pos);
      } catch (err) {
        // ignore selection errors on unsupported inputs
      }
    }
  }, [messages]);

  const getRoomDisplayName = (room) => {
    if (room.tipo === 'centro') {
      return room.centro_nombre ? `Chat ${room.centro_nombre}` : `Chat Centro #${room.centro_id}`;
    }
    if (room.tipo === 'dm') {
      // Check if this is a supervisor group room (centro_id is negative, indicating a user-specific supervisor group)
      const currentUserId = Number(user?.CODIGO || user?.codigo || user?.id);
      if (room.centro_id !== null && room.centro_id < 0) {
        // This is a supervisor group DM for the current user
        return 'Chat con Supervisores y Administrativo';
      }
      // Find the other user's name from members
      const otherMember = room.members?.find(m => m.user_id !== currentUserId);
      if (otherMember) {
        const colleague = colleagues.find(c => c.codigo === otherMember.user_id);
        const supervisor = supervisors.find(s => s.codigo === otherMember.user_id);
        return colleague?.nombre || supervisor?.nombre || `Usuario ${otherMember.user_id}`;
      }
      return 'Mensaje directo';
    }
    return 'Direct Message';
  };

  // Check if user is developer - memoized to prevent unnecessary re-renders
  const isDeveloper = useMemo(() => {
    return user?.GRUPO === 'Developer' || user?.grupo === 'Developer';
  }, [user?.GRUPO, user?.grupo]);

  const handleDeleteRoom = async (roomId, e) => {
    if (e) {
      e.stopPropagation(); // Prevent room selection when clicking delete
      e.preventDefault(); // Prevent any default behavior
    }
    console.log('💬 [ChatPage] handleDeleteRoom called for room:', roomId);
    setDeleteConfirm({ show: true, roomId });
  };

  const confirmDeleteRoom = async () => {
    if (!deleteConfirm.roomId) return;
    
    const result = await deleteRoom(deleteConfirm.roomId);
    setDeleteConfirm({ show: false, roomId: null });
    
    if (result.success) {
      // If deleted room was selected, deselect it
      if (selectedRoom?.id === deleteConfirm.roomId) {
        setSelectedRoom(null);
      }
      // Reload rooms list
      await loadRooms();
    }
  };


  // Helper function to get user's centro_trabajo
  const getUserCentroTrabajo = useCallback((u) => {
    if (!u) {
      console.log('💬 [ChatPage] getUserCentroTrabajo: no user object');
      return '';
    }
    
    console.log('💬 [ChatPage] getUserCentroTrabajo: checking user object, keys:', Object.keys(u));
    
    // First, check the exact key used in DatosPage
    if (u['CENTRO TRABAJO'] && String(u['CENTRO TRABAJO']).trim()) {
      console.log('💬 [ChatPage] getUserCentroTrabajo: found CENTRO TRABAJO:', u['CENTRO TRABAJO']);
      return String(u['CENTRO TRABAJO']).trim();
    }
    
    const preferredKeys = [
      'CENTRO DE TRABAJO',
      'centro de trabajo',
      'CENTRO_DE_TRABAJO',
      'centroDeTrabajo',
      'centro_trabajo',
      'CENTRO',
      'centro',
      'CENTER',
      'center',
      'DEPARTAMENTO',
      'departamento'
    ];
        for (const k of preferredKeys) {
          if (u[k] && String(u[k]).trim()) {
            return String(u[k]).trim();
          }
        }
    // Heurística: primer campo cuyo nombre contiene 'centro' o 'trabajo'
    try {
      const allKeys = Object.keys(u || {});
      const key = allKeys.find(key => {
        const lk = key.toLowerCase();
        return (lk.includes('centro') || lk.includes('trabajo') || lk.includes('depart')) && String(u[key]).trim();
      });
      if (key) {
        return String(u[key]).trim();
      }
    } catch (e) {
      // Silent fail - centro not found
    }
    
    return '';
  }, []);

  // Load centros - for developers: all centros, for employees: only their centro
  const loadAllCentros = useCallback(async () => {
    console.log('💬 [ChatPage] loadAllCentros called, isDeveloper:', isDeveloper);
    // For employees: try to get centro from user object (from /api/me), backend response, or existing rooms
    if (!isDeveloper) {
      // First priority: try to get from user object (from /api/me endpoint)
      let centroName = getUserCentroTrabajo(user);
      
      // Second priority: use centro from backend response (userCentro state - fallback)
      if (!centroName && userCentro) {
        centroName = userCentro;
      }
      
      // Third priority: try to get from existing rooms
      if (!centroName && rooms.length > 0) {
        const centroRoom = rooms.find(r => r.tipo === 'centro' && r.centro_nombre);
        if (centroRoom && centroRoom.centro_nombre) {
          centroName = centroRoom.centro_nombre;
        }
      }
      
      if (centroName) {
        setAllCentros([centroName]);
      } else {
        console.log('💬 [ChatPage] No centro found for employee');
        setAllCentros([]);
      }
      return;
    }
    
    // For developers: load all centros
    try {
      const response = await fetch(routes.getUsuarios, {
        headers: {
          'X-App-Source': 'DeCamino-Web-App',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      console.log('💬 [ChatPage] Centros response status:', response.status);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      console.log('💬 [ChatPage] Centros raw data:', data);
      const employees = Array.isArray(data) ? data : (data?.data || data?.body?.data || []);
      console.log('💬 [ChatPage] Employees array length:', employees.length);
      
      // Extract unique centros
      const centros = [...new Set(
        employees
          .map(emp => emp['CENTRO TRABAJO'] || emp.CENTRO_TRABAJO || emp['CENTRO DE TRABAJO'])
          .filter(c => c && String(c).trim() !== '')
      )].sort();
      
      console.log('💬 [ChatPage] Extracted centros:', centros.length);
      setAllCentros(centros);
    } catch (error) {
      console.error('💬 [ChatPage] Error loading centros:', error);
      setAllCentros([]);
    }
  }, [isDeveloper, user, getUserCentroTrabajo, rooms, userCentro]);

  // Load all employees for developer - currently not used
  // const loadAllEmployees = useCallback(async () => {
  //   console.log('💬 [ChatPage] loadAllEmployees called');
  //   try {
  //     const response = await fetch(routes.getUsuarios, {
  //       headers: {
  //         'X-App-Source': 'DeCamino-Web-App',
  //         'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
  //       },
  //     });
  //     console.log('💬 [ChatPage] Employees response status:', response.status);
  //     if (!response.ok) {
  //       throw new Error(`HTTP ${response.status}`);
  //     }
  //     const data = await response.json();
  //     console.log('💬 [ChatPage] Employees raw data:', data);
  //     const employees = Array.isArray(data) ? data : (data?.data || data?.body?.data || []);
  //     console.log('💬 [ChatPage] Employees array length:', employees.length);
  //     
  //     // Filter out current user
  //     const currentUserId = user?.CODIGO || user?.codigo;
  //     console.log('💬 [ChatPage] Current user ID:', currentUserId);
  //     const filtered = employees.filter(emp => {
  //       const empId = emp.CODIGO || emp.codigo;
  //       return String(empId) !== String(currentUserId);
  //     });
  //     
  //     console.log('💬 [ChatPage] Filtered employees count:', filtered.length);
  //     setAllEmployees(filtered);
  //   } catch (error) {
  //     console.error('💬 [ChatPage] Error loading employees:', error);
  //     setAllEmployees([]);
  //   }
  // }, [user]);

  // Load centros when needed (for all users when they want to create centro chat)
  // For employees: load centro immediately when in centro mode (on mount and when mode changes)
  // For developers: load only when opening create panel
  useEffect(() => {
    if (chatMode === 'centro') {
      if (!isDeveloper) {
        // For employees: load centro immediately when in centro mode or when rooms change
        console.log('💬 [ChatPage] useEffect: Loading centro for employee (chatMode or rooms changed)');
        loadAllCentros();
      } else if (showCreateCentro) {
        // For developers: load only when opening create panel
        console.log('💬 [ChatPage] useEffect: Loading centros for developer');
        loadAllCentros();
      }
    }
  }, [chatMode, showCreateCentro, loadAllCentros, isDeveloper, user]); // Use user instead of userCentro to avoid race condition

  // Load colleagues (for all users - empleados see their centro + supervisors/developers)
  useEffect(() => {
    if (chatMode === 'empleado' && showCreateEmpleado) {
      console.log('💬 [ChatPage] useEffect: Loading colleagues');
      // For all users, colleagues are loaded via fetchColleagues (already done on mount)
      // This is just for triggering the create panel display
    }
  }, [chatMode, showCreateEmpleado]);

  const handleCreateCentroChat = async (centroName) => {
    if (!centroName) return;
    
    try {
      const result = await createCentroRoom(centroName);
      if (result.success) {
        await loadRooms();
        setSelectedRoom(result.data);
        setShowCreateCentro(false);
        setChatMode('centro'); // Switch to centro mode to show the new chat
      } else {
        console.error('Error creating centro chat:', result.error);
      }
    } catch (error) {
      console.error('Error creating centro chat:', error);
    }
  };

  const handleCreateEmpleadoChat = async (empleadoId) => {
    const currentUserId = Number(user?.CODIGO || user?.codigo || user?.id);
    const result = await createDMRoom(empleadoId, currentUserId);
    if (result.success) {
      await loadRooms();
      setSelectedRoom(result.data);
      setShowCreateEmpleado(false);
      setChatMode('empleado'); // Switch to empleado mode to show the new chat
    }
  };

  // Currently not used
  // const handleCreateSupervisorChat = async (supervisorId, supervisorName) => {
  //   const currentUserId = Number(user?.CODIGO || user?.codigo || user?.id);
  //   const result = await createDMRoom(supervisorId, currentUserId);
  //   if (result.success) {
  //     await loadRooms();
  //     setSelectedRoom(result.data);
  //     setShowCreateSupervisor(false);
  //     setChatMode('supervisor'); // Switch to supervisor mode to show the new chat
  //   }
  // };

  return (
    <>
      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <Notification
          type="warning"
          title="Confirmar eliminación"
          message="¿Estás seguro de que quieres eliminar este chat? Esta acción no se puede deshacer."
          isConfirmDialog={true}
          show={deleteConfirm.show}
          onConfirm={confirmDeleteRoom}
          onCancel={() => setDeleteConfirm({ show: false, roomId: null })}
          confirmText="Eliminar"
          cancelText="Cancelar"
          duration={0} // Don't auto-close
        />
      )}

      <div className="flex h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - Room List */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Chat</h2>
          <button
            onClick={() => navigate('/inicio')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Volver al inicio"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Tabs pentru Centro / Empleado / Supervisor - pentru toți utilizatorii */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <button
              onClick={() => setChatMode('centro')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                chatMode === 'centro'
                  ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Building2 className="h-4 w-4 inline mr-2" />
              Centro
            </button>
            <button
              onClick={() => setChatMode('empleado')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                chatMode === 'empleado'
                  ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Empleado
            </button>
            <button
              onClick={() => setChatMode('supervisor')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                chatMode === 'supervisor'
                  ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Shield className="h-4 w-4 inline mr-2" />
              Supervisor
            </button>
          </div>
        </div>

        {/* Create Chat Section - pentru toți utilizatorii */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            {chatMode === 'centro' ? (
              <>
                <button
                  onClick={() => setShowCreateCentro(!showCreateCentro)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Crear Chat Centro
                </button>
                {showCreateCentro && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    {isDeveloper && (
                      <div className="mb-2">
                        <input
                          type="text"
                          placeholder="Buscar centro..."
                          value={searchCentro}
                          onChange={(e) => setSearchCentro(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-100"
                        />
                      </div>
                    )}
                    <div className="max-h-48 overflow-y-auto">
                      {allCentros.length === 0 ? (
                        <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                          Cargando centros...
                        </div>
                      ) : (
                        allCentros
                          .filter(centro => isDeveloper ? centro.toLowerCase().includes(searchCentro.toLowerCase()) : true)
                          .map((centro, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleCreateCentroChat(centro)}
                              className="w-full text-left p-2 hover:bg-blue-50 dark:hover:bg-blue-900 rounded text-sm text-gray-800 dark:text-white"
                            >
                              <Building2 className="h-4 w-4 inline mr-2" />
                              {centro}
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : chatMode === 'empleado' ? (
              <>
                <button
                  onClick={() => setShowCreateEmpleado(!showCreateEmpleado)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Crear Chat Empleado
                </button>
                {showCreateEmpleado && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="mb-2">
                      <input
                        type="text"
                        placeholder="Buscar empleado..."
                        value={searchEmpleado}
                        onChange={(e) => setSearchEmpleado(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-100"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {colleagues.length === 0 ? (
                        <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">Cargando empleados...</div>
                      ) : (
                        colleagues
                          .filter(colleague => {
                            const search = searchEmpleado.toLowerCase();
                            const name = (colleague.nombre || '').toLowerCase();
                            const email = (colleague.correo || '').toLowerCase();
                            return name.includes(search) || email.includes(search);
                          })
                          .map((colleague) => {
                            const colleagueId = colleague.codigo;
                            const colleagueName = colleague.nombre || 'Sin nombre';
                            const colleagueGrupo = colleague.grupo || '';
                            // Check if DM already exists - must have BOTH current user and colleague as members
                            const currentUserId = Number(user?.CODIGO || user?.codigo || user?.id);
                            const existingDm = rooms.find(room => {
                              if (room.tipo !== 'dm') return false;
                              const members = room.members || [];
                              const hasCurrentUser = members.some(m => m.user_id === currentUserId);
                              const hasColleague = members.some(m => m.user_id === colleagueId);
                              // DM exists only if BOTH users are members
                              return hasCurrentUser && hasColleague && members.length === 2;
                            });
                            
                            // Get presence status
                            const presence = presences.get(String(colleagueId)) || { online: false, lastSeen: null };
                            
                            return (
                              <button
                                key={colleagueId}
                                onClick={() => {
                                  if (existingDm) {
                                    setSelectedRoom(existingDm);
                                    setShowCreateEmpleado(false);
                                  } else {
                                    handleCreateEmpleadoChat(colleagueId, colleagueName);
                                  }
                                }}
                                disabled={!!existingDm}
                                className={`w-full text-left p-2 rounded text-sm text-gray-800 dark:text-white ${
                                  existingDm 
                                    ? 'opacity-50 cursor-not-allowed' 
                                    : 'hover:bg-green-50 dark:hover:bg-green-900'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="relative flex items-center">
                                    <Users className="h-4 w-4 mr-2" />
                                    {/* Online/Offline indicator */}
                                    <span
                                      className={`absolute left-3 top-0 w-2.5 h-2.5 rounded-full border-2 ${
                                        presence.online
                                          ? 'bg-green-500 border-green-600 dark:border-green-400'
                                          : 'bg-gray-400 border-gray-500 dark:border-gray-600'
                                      }`}
                                      title={
                                        presence.online
                                          ? 'Online'
                                          : presence.lastSeen
                                            ? `Last seen: ${new Date(presence.lastSeen).toLocaleString()}`
                                            : 'Offline'
                                      }
                                    />
                                  </div>
                                  <span className="flex-1">{colleagueName}</span>
                                </div>
                                {colleagueGrupo && (
                                  <div className="ml-6 text-xs text-gray-500">({colleagueGrupo})</div>
                                )}
                                {existingDm && (
                                  <div className="ml-6 text-xs text-gray-400">(Ya existe)</div>
                                )}
                              </button>
                            );
                          })
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={async () => {
                    const result = await createSupervisorGroupRoom();
                    if (result.success) {
                      console.log('💬 [ChatPage] Supervisor group room created:', result.data);
                      console.log('💬 [ChatPage] Members in room:', result.data.members?.map(m => ({ user_id: m.user_id, rol: m.rol_in_room })));
                      await loadRooms();
                      setSelectedRoom(result.data);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Chat con Supervisores y Administrativo
                </button>
              </>
            )}
        </div>

        {/* Active Chats List - Separated from creation options */}
        <div className="flex-1 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {chatMode === 'centro' ? 'Chats de Centro Activos' : chatMode === 'empleado' ? 'Chats con Empleados Activos' : 'Chats con Supervisores Activos'}
                  </h3>
                </div>
          
          {loading && rooms.length === 0 ? (
            <div className="p-4 text-center text-gray-500">Cargando...</div>
          ) : (
            <>
              {/* Centro rooms - show when chatMode is 'centro' */}
              {chatMode === 'centro' && rooms
                .filter(room => room.tipo === 'centro')
                .map((room) => (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoom(room)}
                    className={`p-4 cursor-pointer border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      selectedRoom?.id === room.id ? 'bg-blue-50 dark:bg-blue-900' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800 dark:text-gray-100">
                          {getRoomDisplayName(room)}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                          <span>👥</span>
                          <span>Todos los usuarios del centro tienen acceso</span>
                        </div>
                      </div>
                      {isDeveloper ? (
                        <button
                          onClick={(e) => {
                            console.log('💬 [ChatPage] Delete button clicked for centro room:', room.id, 'Event:', e);
                            handleDeleteRoom(room.id, e);
                          }}
                          onMouseDown={(e) => {
                            // Prevent the onClick from the parent div
                            e.stopPropagation();
                          }}
                          className="ml-2 p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600 dark:text-red-400 transition-colors relative z-10 flex-shrink-0"
                          title="Eliminar chat"
                          type="button"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}

              {/* Employee/DM rooms - show when chatMode is 'empleado' */}
              {chatMode === 'empleado' && rooms
                .filter(room => {
                  if (room.tipo !== 'dm') return false;
                  // Filter out supervisor/developer DMs (they should be in supervisor tab)
                  const otherMember = room.members?.find(m => m.user_id !== Number(user?.CODIGO || user?.codigo || user?.id));
                  if (!otherMember) return false;
                  const otherUser = colleagues.find(c => c.codigo === otherMember.user_id) || supervisors.find(s => s.codigo === otherMember.user_id);
                  if (!otherUser) return false;
                  const grupo = otherUser.grupo || '';
                  // Exclude supervisors/developers from empleado tab
                  return grupo !== 'Supervisor' && grupo !== 'Manager' && grupo !== 'Developer';
                })
                .map((room) => {
                  // Find colleague from members
                  const colleagueMember = room.members?.find(m => m.user_id !== Number(user?.CODIGO || user?.codigo || user?.id));
                  const colleague = colleagueMember ? colleagues.find(c => c.codigo === colleagueMember.user_id) : null;
                  return (
                    <div
                      key={room.id}
                      onClick={() => setSelectedRoom(room)}
                      className={`p-3 cursor-pointer border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        selectedRoom?.id === room.id ? 'bg-blue-50 dark:bg-blue-900' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-800 dark:text-gray-100">
                            {colleague?.nombre || `Usuario ${colleagueMember?.user_id}`}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Mensaje directo</div>
                        </div>
                        {isDeveloper && (
                          <button
                            onClick={(e) => handleDeleteRoom(room.id, e)}
                            className="ml-2 p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600 dark:text-red-400 transition-colors"
                            title="Eliminar chat"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

              {/* Supervisor group room and DM chats with Developer/Supervisor/Manager - show when chatMode is 'supervisor' */}
              {chatMode === 'supervisor' && rooms
                .filter(room => {
                  const currentUserId = Number(user?.CODIGO || user?.codigo || user?.id);
                  
                  // Supervisor group room is identified by centro_id < 0 (negative userId as special identifier)
                  if (room.tipo === 'dm' && room.centro_id !== null && room.centro_id < 0 && room.centro_id === -currentUserId) {
                    return true;
                  }
                  
                  // Also show DM chats with Developer/Supervisor/Manager
                  if (room.tipo === 'dm') {
                    const otherMember = room.members?.find(m => m.user_id !== currentUserId);
                    if (!otherMember) return false;
                    const otherUser = colleagues.find(c => c.codigo === otherMember.user_id) || supervisors.find(s => s.codigo === otherMember.user_id);
                    if (!otherUser) return false;
                    const grupo = otherUser.grupo || '';
                    // Include supervisors/developers/managers in supervisor tab
                    return grupo === 'Supervisor' || grupo === 'Manager' || grupo === 'Developer';
                  }
                  
                  return false;
                })
                .map((room) => {
                  const currentUserId = Number(user?.CODIGO || user?.codigo || user?.id);
                  const memberCount = room.members?.length || 0;
                  
                  // Check if this is a supervisor group room or a DM with Developer/Supervisor/Manager
                  const isSupervisorGroup = room.centro_id !== null && room.centro_id < 0 && room.centro_id === -currentUserId;
                  
                  // For DM chats, find the other member
                  const otherMember = !isSupervisorGroup ? room.members?.find(m => m.user_id !== currentUserId) : null;
                  const otherUser = otherMember ? (colleagues.find(c => c.codigo === otherMember.user_id) || supervisors.find(s => s.codigo === otherMember.user_id)) : null;
                  
                  return (
                    <div
                      key={room.id}
                      onClick={() => setSelectedRoom(room)}
                      className={`p-3 cursor-pointer border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        selectedRoom?.id === room.id ? 'bg-blue-50 dark:bg-blue-900' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-800 dark:text-gray-100">
                            {isSupervisorGroup 
                              ? 'Chat con Supervisores y Administrativo'
                              : (otherUser?.nombre || `Usuario ${otherMember?.user_id}`)
                            }
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {isSupervisorGroup 
                              ? `${memberCount} ${memberCount === 1 ? 'miembro' : 'miembros'}`
                              : 'Mensaje directo'
                            }
                          </div>
                        </div>
                        {isDeveloper && (
                          <button
                            onClick={(e) => handleDeleteRoom(room.id, e)}
                            className="ml-2 p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600 dark:text-red-400 transition-colors"
                            title="Eliminar chat"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

            </>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {getRoomDisplayName(selectedRoom)}
                </h3>
                <button
                  onClick={() => setSelectedRoom(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Cerrar sala"
                >
                  <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              {selectedRoom.tipo === 'centro' && (
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  <span>👥</span>
                  <span>Todos los usuarios del centro tienen acceso a este chat</span>
                </div>
              )}
              {selectedRoom.tipo === 'dm' && selectedRoom.centro_id !== null && selectedRoom.centro_id < 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  <span>👥</span>
                  <span>Chat con todos los supervisores y personal administrativo</span>
                </div>
              )}
            </div>

            {/* Messages */}
            <MessageList
              messages={messages}
              selectedRoom={selectedRoom}
              colleagues={colleagues}
              supervisors={supervisors}
              user={user}
              loadingMessages={loadingMessages}
              messagesContainerRef={messagesContainerRef}
              handleScroll={handleScroll}
              messagesEndRef={messagesEndRef}
            />

            {/* Message Input */}
            <ChatInput
              textareaRef={textareaRef}
              newMessage={newMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                // Do not block read receipts when merely focusing
                wasFocusedRef.current = true;
              }}
              onBlur={() => {
                // No-op; typing state is controlled by key events
              }}
              onSubmit={handleSendMessage}
              loading={loading}
              error={error}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Selecciona una sala para comenzar
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default ChatPage;
