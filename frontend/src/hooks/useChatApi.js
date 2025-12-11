import { useState, useCallback } from 'react';
import { routes } from '../utils/routes';
import { useAuth } from '../contexts/AuthContextBase';

export const useChatApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { authToken } = useAuth();

  const getAuthHeaders = useCallback(() => {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
  }, [authToken]);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('💬 [Chat] Fetching rooms from:', routes.chatRooms);
      console.log('💬 [Chat] Auth token present:', !!authToken);
      const response = await fetch(routes.chatRooms, {
        headers: getAuthHeaders(),
      });
      console.log('💬 [Chat] Response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('💬 [Chat] Error response:', errorText);
        throw new Error(`Failed to fetch rooms: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log('💬 [Chat] Rooms data received:', data);
      return { 
        success: true, 
        data: data.rooms || [],
        user_centro: data.user_centro || null // Include user's centro from backend
      };
    } catch (err) {
      console.error('💬 [Chat] fetchRooms error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, authToken]);

  const fetchMessages = useCallback(async (roomId, after, limit = 50) => {
    setLoading(true);
    setError(null);
    try {
      const url = routes.chatRoomMessages(roomId, after, limit);
      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }
      const data = await response.json();
      return { success: true, data: data.messages || [] };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const sendMessage = useCallback(async (roomId, message) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(routes.chatSendMessage(roomId), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ message }),
      });
      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }
      const data = await response.json();
      return { success: true, data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const createCentroRoom = useCallback(async (centroNombre) => {
    setLoading(true);
    setError(null);
    try {
      console.log('💬 [Chat] Creating centro room:', centroNombre);
      const response = await fetch(routes.chatCreateCentro, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          centro_nombre: centroNombre,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('💬 [Chat] Error creating centro room:', errorText);
        throw new Error(`Failed to create centro room: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log('💬 [Chat] Centro room created:', data);
      return { success: true, data: data.room };
    } catch (err) {
      console.error('💬 [Chat] createCentroRoom error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const createDMRoom = useCallback(async (colleagueId, currentUserId) => {
    setLoading(true);
    setError(null);
    try {
      console.log('💬 [Chat] Creating DM room with colleague:', colleagueId);
      const response = await fetch(routes.chatCreateDM, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          colleague_id: colleagueId,
          user_id: currentUserId, // Optional, can be omitted
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('💬 [Chat] Error creating DM:', errorText);
        throw new Error(`Failed to create DM room: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log('💬 [Chat] DM room created:', data);
      return { success: true, data: data.room };
    } catch (err) {
      console.error('💬 [Chat] createDMRoom error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const fetchColleagues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('💬 [Chat] Fetching colleagues from:', routes.chatColleagues);
      const response = await fetch(routes.chatColleagues, {
        headers: getAuthHeaders(),
      });
      console.log('💬 [Chat] Colleagues response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('💬 [Chat] Error response:', errorText);
        throw new Error(`Failed to fetch colleagues: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log('💬 [Chat] Colleagues data received:', data);
      return { success: true, data: data.colleagues || [] };
    } catch (err) {
      console.error('💬 [Chat] fetchColleagues error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const fetchSupervisors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('💬 [Chat] Fetching supervisors from:', routes.chatSupervisors);
      const response = await fetch(routes.chatSupervisors, {
        headers: getAuthHeaders(),
      });
      console.log('💬 [Chat] Supervisors response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('💬 [Chat] Error response:', errorText);
        throw new Error(`Failed to fetch supervisors: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log('💬 [Chat] Supervisors data received:', data);
      return { success: true, data: data.supervisors || [] };
    } catch (err) {
      console.error('💬 [Chat] fetchSupervisors error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const deleteRoom = useCallback(async (roomId) => {
    setLoading(true);
    setError(null);
    try {
      console.log('💬 [Chat] Deleting room:', roomId);
      const response = await fetch(routes.chatDeleteRoom(roomId), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('💬 [Chat] Error deleting room:', errorText);
        throw new Error(`Failed to delete room: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log('💬 [Chat] Room deleted successfully:', data);
      return { success: true, data };
    } catch (err) {
      console.error('💬 [Chat] deleteRoom error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const fetchPresence = useCallback(async (roomId) => {
    setLoading(true);
    setError(null);
    try {
      console.log('💬 [Chat] Fetching presence for room:', roomId);
      const response = await fetch(routes.chatRoomPresence(roomId), {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('💬 [Chat] Error fetching presence:', errorText);
        throw new Error(`Failed to fetch presence: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log('💬 [Chat] Presence data received:', data);
      return { success: true, data: data.presences || [] };
    } catch (err) {
      console.error('💬 [Chat] fetchPresence error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const createSupervisorGroupRoom = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('💬 [Chat] Creating supervisor group room');
      const response = await fetch(routes.chatCreateSupervisorGroup, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('💬 [Chat] Error creating supervisor group room:', errorText);
        throw new Error(`Failed to create supervisor group room: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log('💬 [Chat] Supervisor group room created:', data);
      return { success: true, data: data.room };
    } catch (err) {
      console.error('💬 [Chat] createSupervisorGroupRoom error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const markMessagesAsRead = useCallback(async (roomId, messageIds) => {
    setError(null);
    try {
      if (!messageIds || messageIds.length === 0) {
        console.log('💬 [Chat] No message IDs to mark as read');
        return { success: true };
      }
      console.log('💬 [Chat] Marking messages as read. Room:', roomId, 'Message IDs:', messageIds);
      const url = routes.chatMarkMessagesRead(roomId);
      console.log('💬 [Chat] POST to:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ messageIds }),
      });
      console.log('💬 [Chat] markMessagesAsRead response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('💬 [Chat] Error marking messages as read:', response.status, errorText);
        // Don't throw - this is not critical
        return { success: false, error: errorText };
      }
      const data = await response.json();
      console.log('💬 [Chat] markMessagesAsRead success:', data);
      return { success: true, data };
    } catch (err) {
      console.error('💬 [Chat] markMessagesAsRead error:', err);
      // Don't set error state - this is not critical for user experience
      return { success: false, error: err.message };
    }
  }, [getAuthHeaders]);

  return {
    loading,
    error,
    fetchRooms,
    fetchMessages,
    sendMessage,
    createDMRoom,
    createCentroRoom,
    createSupervisorGroupRoom,
    fetchColleagues,
    fetchSupervisors,
    deleteRoom,
    fetchPresence,
    markMessagesAsRead,
    clearError: () => setError(null),
  };
};
