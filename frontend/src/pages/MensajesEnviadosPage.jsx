import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getFormattedNombre } from '../utils/employeeNameHelper';
import { useAuth } from '../contexts/AuthContextBase';
import { Card, Button, Input, Modal } from '../components/ui';
import { TableLoading } from '../components/ui/LoadingStates';
import Back3DButton from '../components/Back3DButton';
import { routes } from '../utils/routes';
import activityLogger from '../utils/activityLogger';
import { useWebSocket } from '../hooks/useWebSocket';
import { config } from '../config/env';

export default function MensajesEnviadosPage() {
  const { user: authUser } = useAuth();
  
  // State pentru formular trimitere email
  const [activeTab, setActiveTab] = useState('enviar'); // 'enviar' | 'historial' | 'automaticos' | 'chatAi' | 'fichajeReminders'
  /** Historical Chat AI (arhiva asistent) */
  const [chatAiEmpleadoSearch, setChatAiEmpleadoSearch] = useState('');
  const [chatAiSelectedEmpleado, setChatAiSelectedEmpleado] = useState(null);
  const [chatAiShowDropdown, setChatAiShowDropdown] = useState(false);
  const [chatAiConversations, setChatAiConversations] = useState([]);
  const [chatAiLoadingList, setChatAiLoadingList] = useState(false);
  const [chatAiError, setChatAiError] = useState(null);
  const [chatAiSelectedConvoId, setChatAiSelectedConvoId] = useState(null);
  const [chatAiMessages, setChatAiMessages] = useState([]);
  const [chatAiLoadingMessages, setChatAiLoadingMessages] = useState(false);
  /** Lista API: empleados que ya tienen conversaciones archivadas */
  const [chatAiEmpleadosConHistorial, setChatAiEmpleadosConHistorial] = useState([]);
  const [chatAiLoadingEmpleadosConHistorial, setChatAiLoadingEmpleadosConHistorial] = useState(false);
  const [recipientType, setRecipientType] = useState('empleado'); // 'empleado' | 'toti' | 'grupo' | 'gestoria'
  const [selectedEmpleado, setSelectedEmpleado] = useState(null);
  const [selectedGrupo, setSelectedGrupo] = useState('');
  const [empleadoSearchTerm, setEmpleadoSearchTerm] = useState('');
  const [showEmpleadoDropdown, setShowEmpleadoDropdown] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [additionalMessage, setAdditionalMessage] = useState(''); // Pentru gestorie
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [emailProgress, setEmailProgress] = useState(null); // { total, current, success, failed, status }
  const sendInFlightRef = useRef(false);

  // WebSocket pentru progres email
  const { socket } = useWebSocket('/notifications');
  
  // State pentru istoric
  const [sentEmails, setSentEmails] = useState([]);
  const [totalEmails, setTotalEmails] = useState(0);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Note: currentOffset is set but not read - offset is calculated from sentEmails.length
  // setCurrentOffset is used to track offset, but the value itself is not read
  // eslint-disable-next-line no-unused-vars
  const [currentOffset, setCurrentOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  // Ref pentru a preveni re-executarea simultană
  const isLoadingRef = useRef(false);
  const [filters, setFilters] = useState({
    recipientType: '',
    status: '',
    startDate: '',
    endDate: '',
  });
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Historial recordatorios fichaje (push)
  const [fichajeReminders, setFichajeReminders] = useState([]);
  const [fichajeRemindersTotal, setFichajeRemindersTotal] = useState(0);
  const [loadingFichajeReminders, setLoadingFichajeReminders] = useState(false);
  const [fichajeReminderFilters, setFichajeReminderFilters] = useState({
    q: '',
    startDate: '',
    endDate: '',
  });
  
  // Helper function pentru traducerea tipului de destinatar
  const translateRecipientType = (type) => {
    if (!type) return '';
    const translations = {
      'toti': 'Todos los Empleados',
      'empleado': 'Empleado',
      'grupo': 'Grupo',
      'gestoria': 'Gestoria',
    };
    return translations[type] || type;
  };

  // State pentru liste
  const [empleados, setEmpleados] = useState([]);
  const [grupos, setGrupos] = useState([]);
  
  // State pentru mesaje automate
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [showScheduledModal, setShowScheduledModal] = useState(false);
  const [editingScheduled, setEditingScheduled] = useState(null);
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [recipientsData, setRecipientsData] = useState(null);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [showToast, setShowToast] = useState(null); // { type: 'success'|'error', message: string }
  const [scheduledForm, setScheduledForm] = useState({
    name: '',
    recipientType: 'toti',
    recipientId: '',
    recipientEmail: '',
    subject: '',
    message: '',
    additionalMessage: '',
    startDate: '',
    endDate: '',
    sendTime: '09:00',
    recurrence: 'daily',
    recurrenceDayOfWeek: 1,
    recurrenceDayOfMonth: 1,
    isActive: true,
  });
  
  // Verifică permisiuni
  const canManageEmails = useMemo(() => {
    const grupo = authUser?.GRUPO || authUser?.grupo || '';
    return ['Developer', 'Admin', 'Manager', 'Supervisor'].includes(grupo);
  }, [authUser]);

  // Încarcă angajații și grupurile
  useEffect(() => {
    if (!canManageEmails) return;

    const loadData = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        const baseUrl = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';

        // Încarcă angajații
        const empleadosRes = await fetch(`${baseUrl}/api/empleados`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (empleadosRes.ok) {
          const empleadosData = await empleadosRes.json();
          // Backend returnează direct array sau obiect cu empleados
          const empleadosList = Array.isArray(empleadosData) 
            ? empleadosData 
            : (empleadosData.empleados || empleadosData.data || []);
          setEmpleados(empleadosList);
          console.log('✅ Empleados loaded:', empleadosList.length);
        } else {
          console.error('❌ Error loading empleados:', empleadosRes.status, empleadosRes.statusText);
        }

        // Încarcă grupurile
        const gruposRes = await fetch(`${baseUrl}/api/grupos`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (gruposRes.ok) {
          const gruposData = await gruposRes.json();
          // Backend returnează direct array sau obiect cu grupos
          const gruposList = Array.isArray(gruposData) 
            ? gruposData 
            : (gruposData.grupos || gruposData.data || []);
          setGrupos(gruposList);
          console.log('✅ Grupos loaded:', gruposList.length);
        } else {
          console.error('❌ Error loading grupos:', gruposRes.status, gruposRes.statusText);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, [canManageEmails]);

  // Încarcă istoricul mesajelor
  const loadSentEmails = useCallback(async (loadMore = false) => {
    if (!canManageEmails) return;
    
    // Previne re-executarea simultană
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    // Dacă încărcăm mai multe, folosim loadingMore, altfel loadingEmails
    if (loadMore) {
      if (loadingMore || !hasMore) {
        isLoadingRef.current = false;
        return;
      }
      setLoadingMore(true);
    } else {
      // Previne re-încărcarea dacă deja se încarcă
      if (loadingEmails) {
        isLoadingRef.current = false;
        return;
      }
      setLoadingEmails(true);
      setCurrentOffset(0);
      setSentEmails([]);
      setHasMore(true);
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        isLoadingRef.current = false;
        if (loadMore) {
          setLoadingMore(false);
        } else {
          setLoadingEmails(false);
        }
        return;
      }

      const baseUrl = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';

      const queryParams = new URLSearchParams();
      // Nu trimite recipientType dacă este gol sau "all" pentru a obține toate mesajele
      if (filters.recipientType && filters.recipientType.trim() !== '' && filters.recipientType !== 'all') {
        queryParams.append('recipientType', filters.recipientType);
      }
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      queryParams.append('limit', '100');
      
      // Pentru loadMore, folosim offset-ul din state-ul curent
      // Folosim funcțional update pentru a obține valoarea curentă
      if (loadMore) {
        // Obținem offset-ul din state folosind funcțional update
        let offsetValue = 0;
        setSentEmails(prev => {
          offsetValue = prev.length;
          return prev; // Nu modificăm state-ul, doar citim valoarea
        });
        queryParams.append('offset', offsetValue.toString());
      } else {
        queryParams.append('offset', '0');
      }

      const response = await fetch(`${baseUrl}/api/sent-emails?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const newEmails = data.emails || [];
        
        if (loadMore) {
          // Adaugă mesajele noi la lista existentă
          setSentEmails(prev => {
            const updated = [...prev, ...newEmails];
            setCurrentOffset(updated.length);
            setHasMore(updated.length < (data.total || 0));
            return updated;
          });
        } else {
          // Resetează lista cu mesajele noi
          setSentEmails(newEmails);
          setCurrentOffset(newEmails.length);
          setHasMore(newEmails.length < (data.total || 0));
        }
        setTotalEmails(data.total || 0);
      }
    } catch (error) {
      console.error('Error loading sent emails:', error);
    } finally {
      isLoadingRef.current = false;
      if (loadMore) {
        setLoadingMore(false);
      } else {
        setLoadingEmails(false);
      }
    }
  // Eliminăm sentEmails din dependențe pentru a preveni re-crearea funcției la fiecare modificare
  // Folosim sentEmails.length direct în funcție, care va fi actualizat la fiecare render
  }, [canManageEmails, loadingMore, loadingEmails, hasMore, filters.recipientType, filters.status, filters.startDate, filters.endDate]);

  useEffect(() => {
    if (activeTab === 'historial' && canManageEmails) {
      // Resetează când se schimbă filtrele sau tab-ul
      // Folosim un flag pentru a preveni re-executarea dacă deja se încarcă
      if (loadingEmails) return;
      
      setCurrentOffset(0);
      setSentEmails([]);
      setHasMore(true);
      loadSentEmails(false);
    } else if (activeTab === 'automaticos') {
      loadScheduledMessages();
    } else if (activeTab === 'fichajeReminders' && canManageEmails) {
      loadFichajeReminders();
    }
    // Eliminăm loadSentEmails din dependențe pentru a preveni loop-ul infinit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filters.recipientType, filters.status, filters.startDate, filters.endDate, canManageEmails, fichajeReminderFilters.startDate, fichajeReminderFilters.endDate]);

  const loadFichajeReminders = useCallback(async () => {
    setLoadingFichajeReminders(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      const response = await fetch(
        routes.fichajeRemindersHistorial({
          limit: 100,
          offset: 0,
          q: fichajeReminderFilters.q || undefined,
          startDate: fichajeReminderFilters.startDate || undefined,
          endDate: fichajeReminderFilters.endDate || undefined,
        }),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        setFichajeReminders([]);
        setFichajeRemindersTotal(0);
        return;
      }
      setFichajeReminders(Array.isArray(data.items) ? data.items : []);
      setFichajeRemindersTotal(Number(data.total) || 0);
    } catch (err) {
      console.error('Error loading fichaje reminders:', err);
      setFichajeReminders([]);
      setFichajeRemindersTotal(0);
    } finally {
      setLoadingFichajeReminders(false);
    }
  }, [fichajeReminderFilters.q, fichajeReminderFilters.startDate, fichajeReminderFilters.endDate]);

  // Infinite scroll - detectează când utilizatorul ajunge jos (opțional - funcționează în background)
  useEffect(() => {
    // Dezactivăm infinite scroll automat, folosim doar butonul "Cargar más"
    // Dacă vrei să reactivezi infinite scroll, decomentează codul de mai jos
    return;
    
    // ARCHIVED: Infinite scroll logic (commented to avoid unreachable code)
    // if (activeTab !== 'historial' || !hasMore || loadingMore || loadingEmails) return;

    // const setupObserver = () => {
    //   const sentinel = document.getElementById('email-sentinel');
    //   if (!sentinel) {
    //     // Dacă sentinel-ul nu există încă, încearcă din nou după un scurt delay
    //     const timeout = setTimeout(setupObserver, 200);
    //     return () => clearTimeout(timeout);
    //   }

    //   const observer = new IntersectionObserver(
    //     (entries) => {
    //       if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loadingEmails) {
    //         loadSentEmails(true);
    //       }
    //     },
    //     { threshold: 0.1, rootMargin: '50px' }
    //   );

    //   try {
    //     observer.observe(sentinel);
    //   } catch (error) {
    //     console.warn('IntersectionObserver error:', error);
    //   }

    //   return () => {
    //     try {
    //       observer.disconnect();
    //     } catch (error) {
    //       // Ignoră erorile la disconnect
    //     }
    //   };
    // };

    // const cleanup = setupObserver();
    // return cleanup;
  }, [activeTab, hasMore, loadingMore, loadingEmails, loadSentEmails]);

  // Încarcă mesajele automate
  const loadScheduledMessages = async () => {
    setLoadingScheduled(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const baseUrl = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';

      const response = await fetch(`${baseUrl}/api/scheduled-messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        setScheduledMessages(result.data || []);
      }
    } catch (error) {
      console.error('Error loading scheduled messages:', error);
    } finally {
      setLoadingScheduled(false);
    }
  };
  
  // Helper pentru a afișa toast
  const showToastMessage = (type, message) => {
    setShowToast({ type, message });
    setTimeout(() => setShowToast(null), 4000);
  };

  // Helper pentru confirmare modernă
  const showConfirm = (message, onConfirm) => {
    setConfirmMessage(message);
    setConfirmAction(() => onConfirm);
    setShowConfirmModal(true);
  };

  // Creează sau actualizează mesaj automat
  const handleSaveScheduledMessage = async () => {
    if (!scheduledForm.name || !scheduledForm.subject || !scheduledForm.message || !scheduledForm.startDate || !scheduledForm.endDate || !scheduledForm.sendTime) {
      showToastMessage('error', 'Completa todos los campos obligatorios');
      return;
    }
    if (scheduledForm.recurrence === 'weekly' && (scheduledForm.recurrenceDayOfWeek == null || scheduledForm.recurrenceDayOfWeek === '')) {
      showToastMessage('error', 'Selecciona el día de la semana para mensaje semanal');
      return;
    }
    if (scheduledForm.recurrence === 'monthly' && (scheduledForm.recurrenceDayOfMonth == null || scheduledForm.recurrenceDayOfMonth < 1 || scheduledForm.recurrenceDayOfMonth > 31)) {
      showToastMessage('error', 'Selecciona el día del mes (1-31) para mensaje mensual');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const baseUrl = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';

      const url = editingScheduled 
        ? `${baseUrl}/api/scheduled-messages/${editingScheduled.id}`
        : `${baseUrl}/api/scheduled-messages`;
      
      const method = editingScheduled ? 'PUT' : 'POST';

      // Elimina espacios al inicio y final antes de guardar
      const formDataToSend = {
        ...scheduledForm,
        name: (scheduledForm.name || '').trim(),
        subject: (scheduledForm.subject || '').trim(),
        message: (scheduledForm.message || '').trim(),
        additionalMessage: (scheduledForm.additionalMessage || '').trim(),
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formDataToSend),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setShowScheduledModal(false);
        setEditingScheduled(null);
        setScheduledForm({
          name: '',
          recipientType: 'toti',
          recipientId: '',
          recipientEmail: '',
          subject: '',
          message: '',
          additionalMessage: '',
          startDate: '',
          endDate: '',
          sendTime: '09:00',
          recurrence: 'daily',
          recurrenceDayOfWeek: 1,
          recurrenceDayOfMonth: 1,
          isActive: true,
        });
        loadScheduledMessages();
        showToastMessage('success', editingScheduled ? 'Mensaje automático actualizado con éxito' : 'Mensaje automático creado con éxito');
      } else {
        showToastMessage('error', result.message || 'Error al guardar el mensaje automático');
      }
    } catch (error) {
      console.error('Error saving scheduled message:', error);
      showToastMessage('error', 'Error al guardar el mensaje automático');
    }
  };
  
  // Șterge mesaj automat
  const handleDeleteScheduledMessage = async (id) => {
    showConfirm('¿Estás seguro de que quieres eliminar este mensaje automático?', async () => {

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const baseUrl = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';

      const response = await fetch(`${baseUrl}/api/scheduled-messages/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        loadScheduledMessages();
        showToastMessage('success', 'Mensaje automático eliminado con éxito');
      } else {
        showToastMessage('error', 'Error al eliminar el mensaje automático');
      }
    } catch (error) {
      console.error('Error deleting scheduled message:', error);
      showToastMessage('error', 'Error al eliminar el mensaje automático');
    }
    });
  };

  // Ascultă progresul email-urilor prin WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleEmailProgress = (notification) => {
      // Verifică dacă este un eveniment de progres email
      if (notification.type === 'email_progress') {
        console.log('📧 [Email Progress]', notification);
        setEmailProgress({
          total: notification.total,
          current: notification.current,
          success: notification.success,
          failed: notification.failed,
          status: notification.status, // 'starting', 'sending', 'completed'
        });

        // Dacă s-a finalizat, resetează după 2 secunde
        if (notification.status === 'completed') {
          setTimeout(() => {
            setSendSuccess(true);
            setTimeout(() => {
              setEmailProgress(null);
              setSendSuccess(false);
            }, 2000);
          }, 1000);
        }
      }
    };

    socket.on('notification', handleEmailProgress);

    return () => {
      socket.off('notification', handleEmailProgress);
    };
  }, [socket]);

  // Trimite email
  const handleSendEmail = async () => {
    if (sendInFlightRef.current) return;
    if (!subject.trim() || !message.trim()) {
      setSendError('El asunto y el mensaje son obligatorios');
      return;
    }

    if (recipientType === 'empleado' && !selectedEmpleado) {
      setSendError('Selecciona un empleado');
      return;
    }

    if (recipientType === 'grupo' && !selectedGrupo) {
      setSendError('Selecciona un grupo');
      return;
    }

    sendInFlightRef.current = true;
    setSending(true);
    setSendError(null);
    setSendSuccess(false);
    setEmailProgress(null); // Reset progres

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No estás autenticado');
      }

      const baseUrl = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';

      const formData = new FormData();
      formData.append('recipientType', recipientType);
      if (recipientType === 'empleado' && selectedEmpleado) {
        formData.append('recipientId', selectedEmpleado.CODIGO);
      }
      if (recipientType === 'grupo') {
        formData.append('grupo', selectedGrupo);
      }
      if (recipientType === 'gestoria') {
        formData.append('recipientEmail', config.COMPANY_GESTORIA_EMAIL || config.COMPANY_EMAIL || '');
      }
      formData.append('subject', subject);
      formData.append('message', message);
      if (additionalMessage) {
        formData.append('additionalMessage', additionalMessage);
      }

      // Adaugă attachments
      console.log('📎 Attachments to send:', attachments.length);
      attachments.forEach((file, idx) => {
        console.log(`📎 Attachment ${idx + 1}:`, file.name, file.size, file.type);
        formData.append('attachments', file);
      });

      const response = await fetch(`${baseUrl}/api/sent-emails/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSendSuccess(true);
        setSubject('');
        setMessage('');
        setAdditionalMessage('');
        setAttachments([]);
        setSelectedEmpleado(null);
        setSelectedGrupo('');
        
        // Log activitate
        await activityLogger.logAction('email_sent', {
          recipientType,
          recipientId: selectedEmpleado?.CODIGO || selectedGrupo || 'gestoria',
          subject,
          user: getFormattedNombre(authUser) || authUser?.nombre,
          email: authUser?.email,
        });

        // Reîncarcă istoricul dacă suntem pe tab-ul de istoric
        if (activeTab === 'historial') {
          setTimeout(() => loadSentEmails(), 1000);
        }
      } else {
        throw new Error(result.message || 'Error al enviar el email');
      }
    } catch (error) {
      setSendError(error.message || 'Error al enviar el email');
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  };

  // Descarcă attachment
  const handleDownloadAttachment = async (attachmentId) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const url = routes.downloadAttachment(attachmentId);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = contentDisposition
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || 'attachment'
          : 'attachment';
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading attachment:', error);
    }
  };

  // Filtrează angajații activi
  const activeEmpleados = useMemo(() => {
    return empleados.filter(e => (e.ESTADO || e.estado) === 'ACTIVO');
  }, [empleados]);


  // Filtrează angajații după termenul de căutare
  const filteredEmpleados = useMemo(() => {
    if (!empleadoSearchTerm.trim()) {
      return activeEmpleados;
    }
    const searchLower = empleadoSearchTerm.toLowerCase();
    return activeEmpleados.filter(emp => {
      const nombre = getFormattedNombre(emp).toLowerCase();
      const codigo = (emp.CODIGO || '').toLowerCase();
      const email = (emp['CORREO ELECTRONICO'] || emp.CORREO_ELECTRONICO || '').toLowerCase();
      return nombre.includes(searchLower) || codigo.includes(searchLower) || email.includes(searchLower);
    });
  }, [activeEmpleados, empleadoSearchTerm]);

  const filteredChatAiEmpleados = useMemo(() => {
    const list = empleados || [];
    if (!chatAiEmpleadoSearch.trim()) return list.slice(0, 150);
    const searchLower = chatAiEmpleadoSearch.toLowerCase();
    return list.filter((emp) => {
      const nombre = getFormattedNombre(emp).toLowerCase();
      const codigo = (emp.CODIGO || '').toLowerCase();
      const email = (emp['CORREO ELECTRONICO'] || emp.CORREO_ELECTRONICO || '').toLowerCase();
      return nombre.includes(searchLower) || codigo.includes(searchLower) || email.includes(searchLower);
    }).slice(0, 100);
  }, [empleados, chatAiEmpleadoSearch]);

  const loadChatAiConversationsFor = useCallback(async (empleado) => {
    const codigo = empleado?.CODIGO;
    if (!codigo) return;
    setChatAiLoadingList(true);
    setChatAiError(null);
    setChatAiSelectedConvoId(null);
    setChatAiMessages([]);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('No estás autenticado');
      const res = await fetch(routes.assistantAdminEmpleadoConversations(codigo), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || `Error ${res.status}`);
      }
      setChatAiConversations(data.conversations || []);
    } catch (e) {
      console.error(e);
      setChatAiError(e.message || 'Error al cargar el historial');
      setChatAiConversations([]);
    } finally {
      setChatAiLoadingList(false);
    }
  }, []);

  const loadChatAiEmpleadosConHistorial = useCallback(async () => {
    setChatAiLoadingEmpleadosConHistorial(true);
    setChatAiError(null);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      const res = await fetch(routes.assistantAdminEmpleadosConConversaciones, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || `Error ${res.status}`);
      }
      setChatAiEmpleadosConHistorial(data.empleados || []);
    } catch (e) {
      console.error(e);
      setChatAiEmpleadosConHistorial([]);
      setChatAiError(e.message || 'No se pudo cargar la lista de empleados con historial');
    } finally {
      setChatAiLoadingEmpleadosConHistorial(false);
    }
  }, []);

  const selectChatAiEmpleadoFromHistorial = useCallback(
    (row) => {
      const emp = {
        CODIGO: row.codigo,
        'NOMBRE / APELLIDOS': row.nombre,
        ESTADO: row.estado,
      };
      setChatAiSelectedEmpleado(emp);
      setChatAiEmpleadoSearch(`${row.nombre} (${row.codigo})`);
      setChatAiShowDropdown(false);
      setChatAiError(null);
      loadChatAiConversationsFor(emp);
    },
    [loadChatAiConversationsFor],
  );

  const loadChatAiMessagesFor = useCallback(async (empleado, conversationId) => {
    const codigo = empleado?.CODIGO;
    if (!codigo || !conversationId) return;
    setChatAiLoadingMessages(true);
    setChatAiError(null);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('No estás autenticado');
      const res = await fetch(routes.assistantAdminEmpleadoConversationMessages(codigo, conversationId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || `Error ${res.status}`);
      }
      setChatAiMessages(data.messages || []);
      setChatAiSelectedConvoId(conversationId);
    } catch (e) {
      console.error(e);
      setChatAiError(e.message || 'Error al cargar mensajes');
      setChatAiMessages([]);
    } finally {
      setChatAiLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'chatAi' && canManageEmails) {
      loadChatAiEmpleadosConHistorial();
    }
  }, [activeTab, canManageEmails, loadChatAiEmpleadosConHistorial]);

  if (!canManageEmails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Acces Restriccionat</h2>
          <p className="text-gray-600">No tienes permiso para acceder a esta página.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Back3DButton />
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">
              📧 Mensajes Enviados
            </h1>
            <p className="text-gray-600">Gestiona y visualiza todos los mensajes enviados</p>
          </div>
        </div>

        {/* Tabs */}
        <Card>
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => setActiveTab('enviar')}
              className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
                activeTab === 'enviar'
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                  : 'bg-white text-green-600 border-2 border-green-200 hover:bg-green-50'
              }`}
            >
              ✉️ Enviar Mensaje
            </button>
            <button
              onClick={() => setActiveTab('historial')}
              className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
                activeTab === 'historial'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                  : 'bg-white text-blue-600 border-2 border-blue-200 hover:bg-blue-50'
              }`}
            >
              📋 Historial
            </button>
            <button
              onClick={() => setActiveTab('automaticos')}
              className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
                activeTab === 'automaticos'
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                  : 'bg-white text-purple-600 border-2 border-purple-200 hover:bg-purple-50'
              }`}
            >
              ⏰ Mensajes Automáticos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('fichajeReminders')}
              className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
                activeTab === 'fichajeReminders'
                  ? 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg'
                  : 'bg-white text-violet-600 border-2 border-violet-200 hover:bg-violet-50'
              }`}
            >
              🔔 Recordatorios fichaje
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chatAi')}
              className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
                activeTab === 'chatAi'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg'
                  : 'bg-white text-indigo-600 border-2 border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              🤖 Historical Chat AI
            </button>
          </div>

          {/* Tab: Enviar Mensaje */}
          {activeTab === 'enviar' && (
            <div className="space-y-6">
              {/* Tip destinatar */}
              <div>
                <div id="recipient-type-label" className="block text-sm font-medium text-gray-700 mb-2">
                  Destinatario
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="group" aria-labelledby="recipient-type-label">
                  <button
                    onClick={() => setRecipientType('empleado')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      recipientType === 'empleado'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    👤 Empleado
                  </button>
                  <button
                    onClick={() => setRecipientType('toti')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      recipientType === 'toti'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    👥 Todos
                  </button>
                  <button
                    onClick={() => setRecipientType('grupo')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      recipientType === 'grupo'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    🏢 Grupo
                  </button>
                  <button
                    onClick={() => setRecipientType('gestoria')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      recipientType === 'gestoria'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    📋 Gestoria
                  </button>
                </div>
              </div>

              {/* Selector angajat cu căutare */}
              {recipientType === 'empleado' && (
                <div className="relative">
                  <label htmlFor="select-empleado" className="block text-sm font-medium text-gray-700 mb-2">
                    Seleccionar Empleado
                  </label>
                  <input
                    id="select-empleado"
                    name="empleado"
                    type="text"
                    value={empleadoSearchTerm || (selectedEmpleado ? getFormattedNombre(selectedEmpleado) : '') || selectedEmpleado?.CODIGO || ''}
                    onChange={(e) => {
                      setEmpleadoSearchTerm(e.target.value);
                      setShowEmpleadoDropdown(true);
                      if (!e.target.value) {
                        setSelectedEmpleado(null);
                      }
                    }}
                    onFocus={() => setShowEmpleadoDropdown(true)}
                    onBlur={() => {
                      // Delay pentru a permite click pe dropdown items
                      setTimeout(() => setShowEmpleadoDropdown(false), 200);
                    }}
                    placeholder="Buscar empleado por nombre, código o email..."
                    className="w-full px-4 py-2 pr-10 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    <span className="text-gray-400 text-lg">🔍</span>
                  </div>
                  
                  {/* Dropdown cu rezultate */}
                  {showEmpleadoDropdown && filteredEmpleados.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredEmpleados.slice(0, 20).map((emp) => (
                        <div
                          key={emp.CODIGO}
                          onClick={() => {
                            setSelectedEmpleado(emp);
                            setEmpleadoSearchTerm('');
                            setShowEmpleadoDropdown(false);
                          }}
                          className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-800">
                            {getFormattedNombre(emp) || emp.CODIGO}
                          </div>
                          <div className="text-sm text-gray-500">
                            {emp.CODIGO} {emp['CORREO ELECTRONICO'] || emp.CORREO_ELECTRONICO ? `• ${emp['CORREO ELECTRONICO'] || emp.CORREO_ELECTRONICO}` : ''}
                          </div>
                        </div>
                      ))}
                      {filteredEmpleados.length > 20 && (
                        <div className="px-4 py-2 text-sm text-gray-500 text-center bg-gray-50">
                          Mostrando 20 de {filteredEmpleados.length} resultados
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Mesaj când nu se găsesc rezultate */}
                  {showEmpleadoDropdown && empleadoSearchTerm && filteredEmpleados.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
                      No se encontraron empleados
                    </div>
                  )}
                  
                  {/* Afișează angajatul selectat */}
                  {selectedEmpleado && !showEmpleadoDropdown && (
                    <div className="mt-2 text-sm text-gray-600">
                      Seleccionado: <strong>{getFormattedNombre(selectedEmpleado) || selectedEmpleado.CODIGO}</strong>
                      <button
                        onClick={() => {
                          setSelectedEmpleado(null);
                          setEmpleadoSearchTerm('');
                        }}
                        className="ml-2 text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Selector grup */}
              {recipientType === 'grupo' && (
                <div>
                  <label htmlFor="select-grupo" className="block text-sm font-medium text-gray-700 mb-2">
                    Seleccionar Grupo
                  </label>
                  <select
                    id="select-grupo"
                    name="grupo"
                    value={selectedGrupo}
                    onChange={(e) => setSelectedGrupo(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Selecciona un grupo...</option>
                    {grupos.map((grupo) => (
                      <option key={grupo} value={grupo}>
                        {grupo}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subiect */}
              <div>
                <label htmlFor="email-subject" className="block text-sm font-medium text-gray-700 mb-2">
                  Asunto *
                </label>
                <Input
                  id="email-subject"
                  name="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Asunto del mensaje"
                />
              </div>

              {/* Mesaj */}
              <div>
                <label htmlFor="email-message" className="block text-sm font-medium text-gray-700 mb-2">
                  Mensaje *
                </label>
                <textarea
                  id="email-message"
                  name="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe tu mensaje aquí..."
                  rows={8}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Mesaj adițional (pentru gestorie) */}
              {(recipientType === 'gestoria' || recipientType === 'empleado') && (
                <div>
                  <label htmlFor="additional-message" className="block text-sm font-medium text-gray-700 mb-2">
                    Mensaje Adicional (opcional)
                  </label>
                  <textarea
                    id="additional-message"
                    name="additionalMessage"
                    value={additionalMessage}
                    onChange={(e) => setAdditionalMessage(e.target.value)}
                    placeholder="Mensaje adicional que aparecerá destacado..."
                    rows={4}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
              )}

              {/* Attachments */}
              <div>
                <label htmlFor="email-attachments" className="block text-sm font-medium text-gray-700 mb-2">
                  Archivos Adjuntos (opcional)
                </label>
                <input
                  id="email-attachments"
                  name="attachments"
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setAttachments(files);
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="text-sm text-gray-600 flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span>📎 {file.name}</span>
                        <button
                          onClick={() => {
                            setAttachments(attachments.filter((_, i) => i !== idx));
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Buton trimitere */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSendEmail}
                  variant="primary"
                  size="lg"
                  loading={sending && !emailProgress}
                  disabled={sending}
                >
                  {sending && !emailProgress ? 'Enviando...' : '📧 Enviar Mensaje'}
                </Button>
              </div>

              {/* Bară de progres pentru trimiterea email-urilor */}
              {emailProgress && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-blue-900">
                        {emailProgress.status === 'starting' && '⏳ Preparando...'}
                        {emailProgress.status === 'sending' && '📧 Enviando correos...'}
                        {emailProgress.status === 'completed' && '✅ ¡Finalizado!'}
                      </span>
                      <span className="text-sm font-bold text-blue-700">
                        {emailProgress.current} / {emailProgress.total}
                      </span>
                    </div>
                    
                    {/* Bară de progres */}
                    <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300 ease-out"
                        style={{
                          width: `${(emailProgress.current / emailProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                    
                    {/* Statistici */}
                    <div className="mt-3 flex items-center justify-between text-xs text-blue-700">
                      <span>✅ Correctos: {emailProgress.success}</span>
                      {emailProgress.failed > 0 && (
                        <span className="text-red-600">❌ Fallidos: {emailProgress.failed}</span>
                      )}
                      <span className="font-semibold">
                        {Math.round((emailProgress.current / emailProgress.total) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Mesaje eroare/succes */}
              {sendError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {sendError}
                </div>
              )}
              {sendSuccess && !emailProgress && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  ✅ Mensaje enviado correctamente!
                </div>
              )}
            </div>
          )}

          {/* Tab: Historial */}
          {activeTab === 'historial' && (
            <div className="space-y-6">
              {/* Filtre */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="filter-recipient-type" className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo Destinatario
                  </label>
                  <select
                    id="filter-recipient-type"
                    name="recipientType"
                    value={filters.recipientType}
                    onChange={(e) => setFilters({ ...filters, recipientType: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg"
                  >
                    <option value="">All</option>
                    <option value="empleado">Empleado</option>
                    <option value="toti">Todos los Empleados</option>
                    <option value="grupo">Grupo</option>
                    <option value="gestoria">Gestoria</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="filter-status" className="block text-sm font-medium text-gray-700 mb-2">
                    Estado
                  </label>
                  <select
                    id="filter-status"
                    name="status"
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg"
                  >
                    <option value="">Todos</option>
                    <option value="sent">Enviado</option>
                    <option value="failed">Fallido</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="filter-start-date" className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha Inicio
                  </label>
                  <input
                    id="filter-start-date"
                    name="startDate"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="filter-end-date" className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha Fin
                  </label>
                  <input
                    id="filter-end-date"
                    name="endDate"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Tabel mesaje */}
              {loadingEmails ? (
                <TableLoading columns={6} rows={5} />
              ) : sentEmails.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay mensajes enviados
                </div>
              ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-[600px] border border-gray-300 rounded-lg">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">Fecha</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Destinatario</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Asunto</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Tipo</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Estado</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sentEmails.map((email) => (
                        <tr key={email.id} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-2">
                            {new Date(email.created_at).toLocaleString('es-ES')}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {email.recipient_name || email.recipient_email}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">{email.subject}</td>
                          <td className="border border-gray-300 px-4 py-2">{translateRecipientType(email.recipient_type)}</td>
                          <td className="border border-gray-300 px-4 py-2">
                            <span className={`px-2 py-1 rounded text-sm ${
                              email.status === 'sent' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {email.status === 'sent' ? '✅ Enviado' : '❌ Fallido'}
                            </span>
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setSelectedEmail(email);
                                  setShowEmailModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Ver Detalles
                              </button>
                              <button
                                onClick={async () => {
                                  showConfirm('¿Estás seguro de que quieres eliminar este email de la base de datos?', async () => {
                                    try {
                                      const token = localStorage.getItem('auth_token');
                                      if (!token) {
                                        showToastMessage('error', 'No estás autenticado');
                                        return;
                                      }

                                    const baseUrl = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';

                                    const response = await fetch(`${baseUrl}/api/sent-emails/${email.id}`, {
                                      method: 'DELETE',
                                      headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'Content-Type': 'application/json',
                                      },
                                    });

                                    const result = await response.json();

                                      if (response.ok && result.success) {
                                        showToastMessage('success', 'Email eliminado con éxito');
                                        loadSentEmails();
                                      } else {
                                        showToastMessage('error', result.message || 'Error al eliminar el email');
                                      }
                                    } catch (error) {
                                      console.error('Error deleting email:', error);
                                      showToastMessage('error', 'Error al eliminar el email');
                                    }
                                  });
                                }}
                                className="text-red-600 hover:text-red-800 underline text-sm"
                                title="Eliminar email de la base de datos"
                              >
                                🗑️ Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Buton "Cargar más" */}
                  <div className="flex flex-col items-center justify-center py-4 gap-2">
                    {hasMore && !loadingMore && (
                      <button
                        onClick={() => loadSentEmails(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Cargar más mensajes
                      </button>
                    )}
                    {loadingMore && (
                      <div className="text-gray-500 text-sm">Cargando más mensajes...</div>
                    )}
                    {!hasMore && sentEmails.length > 0 && (
                      <div className="text-gray-500 text-sm">No hay más mensajes</div>
                    )}
                    {/* Sentinel pentru infinite scroll (ascuns, folosit doar dacă se reactivează infinite scroll) */}
                    <div id="email-sentinel" className="h-10 w-full opacity-0 pointer-events-none"></div>
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="text-sm text-gray-600">
                Total: {totalEmails} mensajes {sentEmails.length < totalEmails && `(mostrando ${sentEmails.length})`}
              </div>
            </div>
          )}

          {/* Tab Recordatorios fichaje */}
          {activeTab === 'fichajeReminders' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Recordatorios de fichaje</h2>
                  <p className="text-sm text-gray-600">
                    Historial de avisos push / in-app enviados a empleados
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => loadFichajeReminders()}
                  disabled={loadingFichajeReminders}
                  loading={loadingFichajeReminders}
                >
                  Actualizar
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Buscar"
                  value={fichajeReminderFilters.q}
                  onChange={(e) =>
                    setFichajeReminderFilters((prev) => ({ ...prev, q: e.target.value }))
                  }
                  placeholder="Nombre, código, mensaje…"
                />
                <Input
                  label="Desde"
                  type="date"
                  value={fichajeReminderFilters.startDate}
                  onChange={(e) =>
                    setFichajeReminderFilters((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                />
                <Input
                  label="Hasta"
                  type="date"
                  value={fichajeReminderFilters.endDate}
                  onChange={(e) =>
                    setFichajeReminderFilters((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={() => loadFichajeReminders()}
                  disabled={loadingFichajeReminders}
                >
                  Filtrar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFichajeReminderFilters({ q: '', startDate: '', endDate: '' });
                  }}
                >
                  Limpiar
                </Button>
              </div>

              {loadingFichajeReminders ? (
                <TableLoading rows={6} />
              ) : fichajeReminders.length === 0 ? (
                <div className="py-12 text-center text-gray-500 rounded-xl border border-dashed border-gray-200">
                  No hay recordatorios de fichaje registrados aún.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-violet-50 text-violet-900">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold">Fecha</th>
                        <th className="text-left px-3 py-2 font-semibold">Empleado</th>
                        <th className="text-left px-3 py-2 font-semibold">Tipo</th>
                        <th className="text-left px-3 py-2 font-semibold">Horario</th>
                        <th className="text-left px-3 py-2 font-semibold">Mensaje</th>
                        <th className="text-left px-3 py-2 font-semibold">Leído</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fichajeReminders.map((row) => (
                        <tr key={row.id} className="border-t border-gray-100 hover:bg-slate-50">
                          <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                            {row.createdAt
                              ? new Date(row.createdAt).toLocaleString('es-ES')
                              : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900">
                              {row.nombre || '—'}
                            </div>
                            <div className="text-xs text-gray-500">{row.userId}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800">
                              {row.tipo || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-700">{row.horario || '—'}</td>
                          <td className="px-3 py-2 text-gray-700 max-w-xs">
                            <div className="font-medium text-gray-800">{row.title}</div>
                            <div className="text-xs text-gray-500 line-clamp-2">{row.message}</div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {row.read ? (
                              <div>
                                <span className="text-emerald-700 text-xs font-semibold">Sí</span>
                                {row.readAt && (
                                  <div className="text-[11px] text-gray-500 mt-0.5">
                                    {new Date(row.readAt).toLocaleString('es-ES')}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-amber-700 text-xs font-semibold">No</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="text-sm text-gray-600">
                Total: {fichajeRemindersTotal} recordatorio
                {fichajeRemindersTotal === 1 ? '' : 's'}
                {fichajeReminders.length < fichajeRemindersTotal
                  ? ` (mostrando ${fichajeReminders.length})`
                  : ''}
              </div>
            </div>
          )}

          {/* Tab Mesaje Automate */}
          {activeTab === 'automaticos' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Mensajes Automáticos</h2>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('auth_token');
                        if (!token) {
                          showToastMessage('error', 'No estás autenticado');
                          return;
                        }

                        const baseUrl = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';

                        const response = await fetch(`${baseUrl}/api/scheduled-messages/test-trigger`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                          },
                        });

                        const result = await response.json();

                        if (response.ok && result.success) {
                          showToastMessage('success', 'Cron job ejecutado con éxito. Verifica el tab Historial para ver los emails enviados.');
                          setTimeout(() => loadScheduledMessages(), 2000);
                        } else {
                          showToastMessage('error', result.message || 'Error al ejecutar el cron job');
                        }
                      } catch (error) {
                        console.error('Error testing cron:', error);
                        showToastMessage('error', 'Error al ejecutar el cron job');
                      }
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-green-700 shadow-md text-sm"
                    title="Ejecutar manualmente el cron para enviar los mensajes automáticos ahora"
                  >
                    ⚡ Probar ahora
                  </button>
                  <button
                    onClick={() => {
                      setEditingScheduled(null);
                      setScheduledForm({
                        name: '',
                        recipientType: 'toti',
                        recipientId: '',
                        recipientEmail: '',
                        subject: '',
                        message: '',
                        additionalMessage: '',
                        startDate: '',
                        endDate: '',
                        sendTime: '09:00',
                        isActive: true,
                      });
                      setShowScheduledModal(true);
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-bold hover:from-purple-600 hover:to-purple-700 shadow-lg"
                  >
                    ➕ Crear Mensaje Automático
                  </button>
                </div>
              </div>

              {loadingScheduled ? (
                <TableLoading />
              ) : scheduledMessages.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">No hay mensajes automáticos</p>
                  <p className="text-sm mt-2">Crea un mensaje automático para comenzar</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse bg-white rounded-lg shadow">
                    <thead>
                      <tr className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                        <th className="p-4 text-left">Nombre</th>
                        <th className="p-4 text-left">Destinatarios</th>
                        <th className="p-4 text-left">Asunto</th>
                        <th className="p-4 text-left">Período</th>
                        <th className="p-4 text-left">Hora</th>
                        <th className="p-4 text-left">Estado</th>
                        <th className="p-4 text-left">Último envío</th>
                        <th className="p-4 text-left">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduledMessages.map((msg) => {
                        // Backend returnează câmpuri în snake_case
                        const startDate = msg.start_date || msg.startDate;
                        const endDate = msg.end_date || msg.endDate;
                        const sendTime = msg.send_time || msg.sendTime;
                        const recipientType = msg.recipient_type || msg.recipientType;
                        const recipientId = msg.recipient_id || msg.recipientId;
                        const recipientEmail = msg.recipient_email || msg.recipientEmail;
                        const isActive = msg.is_active !== undefined ? msg.is_active : msg.isActive;
                        
                        return (
                          <tr key={msg.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="p-4 font-medium">{(msg.name || '').trim()}</td>
                            <td className="p-4">
                              {recipientType === 'toti' && 'Todos los Empleados'}
                              {recipientType === 'empleado' && `Empleado: ${recipientId}`}
                              {recipientType === 'grupo' && `Grupo: ${recipientId}`}
                              {recipientType === 'gestoria' && `Gestoria: ${recipientEmail}`}
                            </td>
                            <td className="p-4">{(msg.subject || '').trim()}</td>
                            <td className="p-4">
                              {startDate && endDate ? (() => {
                                try {
                                  const start = new Date(startDate);
                                  const end = new Date(endDate);
                                  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                                    return 'N/A';
                                  }
                                  const rec = msg.recurrence || 'daily';
                                  const recLabel = rec === 'weekly'
                                    ? ` · Semanal (${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][msg.recurrence_day_of_week ?? 0]})`
                                    : rec === 'monthly'
                                      ? ` · Mensual (día ${msg.recurrence_day_of_month ?? 1})`
                                      : ' · Diario';
                                  return `${start.toLocaleDateString('es-ES')} - ${end.toLocaleDateString('es-ES')}${recLabel}`;
                                } catch {
                                  return 'N/A';
                                }
                              })() : (
                                'N/A'
                              )}
                            </td>
                            <td className="p-4">{sendTime || 'N/A'}</td>
                            <td className="p-4">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                isActive 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {isActive ? '✅ Activo' : '⏸️ Inactivo'}
                              </span>
                            </td>
                            <td className="p-4">
                              {msg.last_sent_at 
                                ? new Date(msg.last_sent_at).toLocaleString('es-ES')
                                : 'Nunca'}
                            </td>
                            <td className="p-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={async () => {
                                    try {
                                      setLoadingRecipients(true);
                                      const token = localStorage.getItem('auth_token');
                                      if (!token) {
                                        showToastMessage('error', 'No estás autenticado');
                                        return;
                                      }

                                      const baseUrl = config.BACKEND_BASE || config.API_BASE_URL || config.API_URL || '';

                                      const response = await fetch(`${baseUrl}/api/scheduled-messages/${msg.id}/recipients`, {
                                        headers: {
                                          'Authorization': `Bearer ${token}`,
                                          'Content-Type': 'application/json',
                                        },
                                      });

                                      const result = await response.json();

                                      if (response.ok && result.success) {
                                        setRecipientsData(result.data);
                                        setShowRecipientsModal(true);
                                      } else {
                                        showToastMessage('error', result.message || 'Error al cargar los destinatarios');
                                      }
                                    } catch (error) {
                                      console.error('Error loading recipients:', error);
                                      showToastMessage('error', 'Error al cargar los destinatarios');
                                    } finally {
                                      setLoadingRecipients(false);
                                    }
                                  }}
                                  className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                                  title="Ver destinatarios"
                                  disabled={loadingRecipients}
                                >
                                  {loadingRecipients ? '⏳' : '👁️'} Destinatarios
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingScheduled(msg);
                                    const rec = msg.recurrence || 'daily';
                                    setScheduledForm({
                                      name: msg.name,
                                      recipientType: recipientType,
                                      recipientId: recipientId || '',
                                      recipientEmail: recipientEmail || '',
                                      subject: msg.subject,
                                      message: msg.message,
                                      additionalMessage: msg.additional_message || '',
                                      startDate: startDate ? (typeof startDate === 'string' ? startDate.split('T')[0] : new Date(startDate).toISOString().split('T')[0]) : '',
                                      endDate: endDate ? (typeof endDate === 'string' ? endDate.split('T')[0] : new Date(endDate).toISOString().split('T')[0]) : '',
                                      sendTime: sendTime || '09:00',
                                      recurrence: rec,
                                      recurrenceDayOfWeek: msg.recurrence_day_of_week ?? 1,
                                      recurrenceDayOfMonth: msg.recurrence_day_of_month ?? 1,
                                      isActive: isActive,
                                    });
                                    setShowScheduledModal(true);
                                  }}
                                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteScheduledMessage(msg.id)}
                                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                                >
                                  🗑️ Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Historical Chat AI — arhiva conversațiilor asistent (per empleado) */}
          {activeTab === 'chatAi' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Consulta el historial archivado del chat del asistente (misma app) por empleado. Solo lectura.
              </p>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-indigo-900">
                    Empleados con historial de chat
                    {!chatAiLoadingEmpleadosConHistorial && (
                      <span className="ml-2 font-normal text-indigo-600">
                        ({chatAiEmpleadosConHistorial.length})
                      </span>
                    )}
                  </h3>
                  <button
                    type="button"
                    onClick={() => loadChatAiEmpleadosConHistorial()}
                    disabled={chatAiLoadingEmpleadosConHistorial}
                    className="text-xs font-semibold text-indigo-700 underline hover:text-indigo-900 disabled:opacity-50"
                  >
                    Actualizar lista
                  </button>
                </div>
                {chatAiLoadingEmpleadosConHistorial ? (
                  <div className="py-4">
                    <TableLoading columns={2} rows={3} />
                  </div>
                ) : chatAiEmpleadosConHistorial.length === 0 ? (
                  <p className="text-sm text-indigo-800/80">
                    Nadie tiene conversaciones archivadas todavía, o la tabla aún no tiene datos.
                  </p>
                ) : (
                  <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
                    {chatAiEmpleadosConHistorial.map((row) => (
                      <li key={row.codigo}>
                        <button
                          type="button"
                          onClick={() => selectChatAiEmpleadoFromHistorial(row)}
                          className={`flex w-full flex-col rounded-lg border px-3 py-2 text-left text-sm transition-colors sm:flex-row sm:items-center sm:justify-between ${
                            chatAiSelectedEmpleado?.CODIGO === row.codigo
                              ? 'border-indigo-500 bg-white shadow-sm'
                              : 'border-indigo-100 bg-white/80 hover:bg-white'
                          }`}
                        >
                          <span className="font-medium text-gray-900">
                            {row.nombre}{' '}
                            <span className="text-gray-500">({row.codigo})</span>
                          </span>
                          <span className="text-xs text-gray-500">
                            {row.conversationCount} hilo{row.conversationCount === 1 ? '' : 's'}
                            {row.lastActivity
                              ? ` · ${new Date(row.lastActivity).toLocaleDateString('es-ES')}`
                              : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="relative">
                <label htmlFor="chat-ai-empleado-search" className="block text-sm font-medium text-gray-700 mb-2">
                  O buscar otro empleado
                </label>
                <div className="relative">
                  <Input
                    id="chat-ai-empleado-search"
                    name="chatAiEmpleadoSearch"
                    value={chatAiEmpleadoSearch}
                    onChange={(e) => {
                      setChatAiEmpleadoSearch(e.target.value);
                      setChatAiShowDropdown(true);
                    }}
                    onFocus={() => setChatAiShowDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => setChatAiShowDropdown(false), 200);
                    }}
                    placeholder="Nombre, código o email..."
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                </div>
                {chatAiShowDropdown && filteredChatAiEmpleados.length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {filteredChatAiEmpleados.map((emp) => (
                      <li key={emp.CODIGO}>
                        <button
                          type="button"
                          className="w-full px-4 py-2 text-left text-sm hover:bg-indigo-50"
                          onClick={() => {
                            setChatAiSelectedEmpleado(emp);
                            setChatAiEmpleadoSearch(`${getFormattedNombre(emp)} (${emp.CODIGO})`);
                            setChatAiShowDropdown(false);
                            loadChatAiConversationsFor(emp);
                          }}
                        >
                          <span className="font-medium">{getFormattedNombre(emp)}</span>
                          <span className="text-gray-500"> — {emp.CODIGO}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {chatAiSelectedEmpleado && (
                <p className="text-sm text-gray-700">
                  Empleado: <strong>{getFormattedNombre(chatAiSelectedEmpleado)}</strong> ({chatAiSelectedEmpleado.CODIGO})
                </p>
              )}

              {chatAiError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {chatAiError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                  <h3 className="mb-3 text-sm font-bold text-gray-800">Conversaciones</h3>
                  {chatAiLoadingList ? (
                    <TableLoading columns={1} rows={4} />
                  ) : !chatAiSelectedEmpleado ? (
                    <p className="text-sm text-gray-500">Selecciona un empleado para cargar sus hilos.</p>
                  ) : chatAiConversations.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay conversaciones archivadas para este empleado.</p>
                  ) : (
                    <ul className="max-h-72 space-y-2 overflow-y-auto">
                      {chatAiConversations.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => loadChatAiMessagesFor(chatAiSelectedEmpleado, c.id)}
                            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                              chatAiSelectedConvoId === c.id
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                                : 'border-gray-200 bg-white hover:bg-white'
                            }`}
                          >
                            <div className="font-medium text-gray-900 line-clamp-2">{c.title || 'Sin título'}</div>
                            <div className="text-xs text-gray-500">
                              {c.updatedAt ? new Date(c.updatedAt).toLocaleString('es-ES') : ''}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h3 className="mb-3 text-sm font-bold text-gray-800">Mensajes</h3>
                  {chatAiLoadingMessages ? (
                    <TableLoading columns={1} rows={6} />
                  ) : !chatAiSelectedConvoId ? (
                    <p className="text-sm text-gray-500">Elige una conversación a la izquierda.</p>
                  ) : chatAiMessages.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay mensajes en este hilo.</p>
                  ) : (
                    <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                      {chatAiMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`rounded-lg px-3 py-2 text-sm ${
                            m.role === 'user'
                              ? 'ml-4 border border-blue-100 bg-blue-50 text-gray-900'
                              : 'mr-4 border border-violet-100 bg-violet-50 text-gray-900'
                          }`}
                        >
                          <div className="mb-1 text-xs font-semibold text-gray-500">
                            {m.role === 'user' ? '👤 Empleado' : '🤖 Asistente'}{' '}
                            {m.createdAt ? new Date(m.createdAt).toLocaleString('es-ES') : ''}
                          </div>
                          <div className="whitespace-pre-wrap break-words">{m.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Modal pentru creare/editare mesaj automat */}
      <Modal
        isOpen={showScheduledModal}
        onClose={() => {
          setShowScheduledModal(false);
          setEditingScheduled(null);
        }}
        title={editingScheduled ? 'Editar Mensaje Automático' : 'Crear Mensaje Automático'}
        size="xl"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="scheduled-name" className="block text-sm font-medium text-gray-700 mb-2">
              Nume Mesaj *
            </label>
            <Input
              id="scheduled-name"
              name="scheduledName"
              value={scheduledForm.name}
              onChange={(e) => setScheduledForm({ ...scheduledForm, name: e.target.value })}
              placeholder="Ex: Recordatorio Aplicación"
            />
          </div>

          <div>
            <label htmlFor="scheduled-recipient" className="block text-sm font-medium text-gray-700 mb-2">
              Destinatari *
            </label>
            <select
              id="scheduled-recipient"
              name="scheduledRecipient"
              value={scheduledForm.recipientType}
              onChange={(e) => {
                setScheduledForm({ 
                  ...scheduledForm, 
                  recipientType: e.target.value,
                  recipientId: '',
                  recipientEmail: '',
                });
              }}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="toti">Todos los Empleados</option>
              <option value="empleado">Un Empleado</option>
              <option value="grupo">Un Grupo</option>
              <option value="gestoria">Gestoria</option>
            </select>
          </div>

          {scheduledForm.recipientType === 'empleado' && (
            <div>
              <label htmlFor="scheduled-empleado" className="block text-sm font-medium text-gray-700 mb-2">
                Selecciona empleado
              </label>
              <select
                id="scheduled-empleado"
                name="scheduledEmpleado"
                value={scheduledForm.recipientId}
                onChange={(e) => setScheduledForm({ ...scheduledForm, recipientId: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Selecciona...</option>
                {activeEmpleados.map((emp) => (
                  <option key={emp.CODIGO} value={emp.CODIGO}>
                    {getFormattedNombre(emp)} ({emp.CODIGO})
                  </option>
                ))}
              </select>
            </div>
          )}

          {scheduledForm.recipientType === 'grupo' && (
            <div>
              <label htmlFor="scheduled-grupo" className="block text-sm font-medium text-gray-700 mb-2">
                Selecciona grupo
              </label>
              <select
                id="scheduled-grupo"
                name="scheduledGrupo"
                value={scheduledForm.recipientId}
                onChange={(e) => setScheduledForm({ ...scheduledForm, recipientId: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Selecciona...</option>
                {grupos.map((grupo) => (
                  <option key={grupo} value={grupo}>
                    {grupo}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scheduledForm.recipientType === 'gestoria' && (
            <div>
              <label htmlFor="scheduled-email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Gestoria
              </label>
              <Input
                id="scheduled-email"
                name="scheduledEmail"
                type="email"
                value={scheduledForm.recipientEmail}
                onChange={(e) => setScheduledForm({ ...scheduledForm, recipientEmail: e.target.value })}
                placeholder={config.COMPANY_GESTORIA_EMAIL || config.COMPANY_EMAIL || 'gestoria@...'}
              />
            </div>
          )}

          <div>
            <label htmlFor="scheduled-subject" className="block text-sm font-medium text-gray-700 mb-2">
              Asunto *
            </label>
            <Input
              id="scheduled-subject"
              name="scheduledSubject"
              value={scheduledForm.subject}
              onChange={(e) => setScheduledForm({ ...scheduledForm, subject: e.target.value.trimStart() })}
              onBlur={(e) => setScheduledForm({ ...scheduledForm, subject: e.target.value.trim() })}
              placeholder="Asunto del mensaje"
            />
          </div>

          <div>
            <label htmlFor="scheduled-message" className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje *
            </label>
            <textarea
              id="scheduled-message"
              name="scheduledMessage"
              value={scheduledForm.message}
              onChange={(e) => setScheduledForm({ ...scheduledForm, message: e.target.value })}
              rows={6}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Contenido del mensaje..."
            />
          </div>

          <div>
            <label htmlFor="scheduled-additional" className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje Adicional (opcional)
            </label>
            <textarea
              id="scheduled-additional"
              name="scheduledAdditional"
              value={scheduledForm.additionalMessage}
              onChange={(e) => setScheduledForm({ ...scheduledForm, additionalMessage: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Mensaje adicional (solo para gestoria)..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Frecuencia
            </label>
            <select
              value={scheduledForm.recurrence}
              onChange={(e) => setScheduledForm({ ...scheduledForm, recurrence: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="daily">Diario (cada día en el intervalo)</option>
              <option value="weekly">Semanal (un día a la semana)</option>
              <option value="monthly">Mensual (un día al mes)</option>
            </select>
          </div>

          {scheduledForm.recurrence === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Día de la semana
              </label>
              <select
                value={scheduledForm.recurrenceDayOfWeek}
                onChange={(e) => setScheduledForm({ ...scheduledForm, recurrenceDayOfWeek: Number(e.target.value) })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value={0}>Domingo</option>
                <option value={1}>Lunes</option>
                <option value={2}>Martes</option>
                <option value={3}>Miércoles</option>
                <option value={4}>Jueves</option>
                <option value={5}>Viernes</option>
                <option value={6}>Sábado</option>
              </select>
            </div>
          )}

          {scheduledForm.recurrence === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Día del mes (1-31)
              </label>
              <select
                value={scheduledForm.recurrenceDayOfMonth}
                onChange={(e) => setScheduledForm({ ...scheduledForm, recurrenceDayOfMonth: Number(e.target.value) })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="scheduled-start" className="block text-sm font-medium text-gray-700 mb-2">
                Data Început *
              </label>
              <Input
                id="scheduled-start"
                name="scheduledStart"
                type="date"
                value={scheduledForm.startDate}
                onChange={(e) => setScheduledForm({ ...scheduledForm, startDate: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="scheduled-end" className="block text-sm font-medium text-gray-700 mb-2">
                Data Sfârșit *
              </label>
              <Input
                id="scheduled-end"
                name="scheduledEnd"
                type="date"
                value={scheduledForm.endDate}
                onChange={(e) => setScheduledForm({ ...scheduledForm, endDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label htmlFor="scheduled-time" className="block text-sm font-medium text-gray-700 mb-2">
              Ora Trimitere *
            </label>
            <Input
              id="scheduled-time"
              name="scheduledTime"
              type="time"
              value={scheduledForm.sendTime}
              onChange={(e) => setScheduledForm({ ...scheduledForm, sendTime: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="scheduled-is-active" className="flex items-center gap-3 cursor-pointer">
              <input
                id="scheduled-is-active"
                name="scheduledIsActive"
                type="checkbox"
                checked={scheduledForm.isActive}
                onChange={(e) => setScheduledForm({ ...scheduledForm, isActive: e.target.checked })}
                className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
              />
              <span className="text-sm font-medium text-gray-700">
                Mensaje Activo
              </span>
            </label>
          </div>

          <div className="flex gap-4 justify-end pt-4 border-t">
            <button
              onClick={() => {
                setShowScheduledModal(false);
                setEditingScheduled(null);
              }}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveScheduledMessage}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-bold hover:from-purple-600 hover:to-purple-700 shadow-lg"
            >
              {editingScheduled ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal detalii email */}
      <Modal
        isOpen={showEmailModal}
        onClose={() => {
          setShowEmailModal(false);
          setSelectedEmail(null);
        }}
        title="Detalles del Mensaje"
        size="xl"
      >
        {selectedEmail && (
          <div className="space-y-4">
            <div>
              <strong>Fecha:</strong> {new Date(selectedEmail.created_at).toLocaleString('es-ES')}
            </div>
            <div>
              <strong>Destinatario:</strong> {selectedEmail.recipient_name || selectedEmail.recipient_email}
            </div>
            <div>
              <strong>Email:</strong> {selectedEmail.recipient_email}
            </div>
            <div>
              <strong>Asunto:</strong> {selectedEmail.subject}
            </div>
            <div>
              <strong>Estado:</strong> {selectedEmail.status === 'sent' ? '✅ Enviado' : '❌ Fallido'}
            </div>
            {selectedEmail.error_message && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <strong>Error:</strong> {selectedEmail.error_message}
              </div>
            )}
            {selectedEmail.additional_message && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
                <strong>Mensaje Adicional:</strong>
                <div className="mt-2 whitespace-pre-wrap">{selectedEmail.additional_message}</div>
              </div>
            )}
            <div>
              <strong>Mensaje:</strong>
              <div 
                className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200"
                dangerouslySetInnerHTML={{ __html: selectedEmail.message }}
              />
            </div>
            {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
              <div>
                <strong>Archivos Adjuntos:</strong>
                <div className="mt-2 space-y-2">
                  {selectedEmail.attachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <span>📎 {att.filename} ({(att.file_size / 1024).toFixed(2)} KB)</span>
                      <button
                        onClick={() => handleDownloadAttachment(att.id)}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Descargar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal pentru destinatarii mesajului automat */}
      <Modal
        isOpen={showRecipientsModal}
        onClose={() => {
          setShowRecipientsModal(false);
          setRecipientsData(null);
        }}
        title="Destinatarios del mensaje automático"
        size="xl"
      >
        {recipientsData && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-bold text-lg mb-2">{recipientsData.scheduledMessage?.name || 'Mensaje automático'}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Total Destinatari:</strong> {recipientsData.totalRecipients}
                </div>
                <div>
                  <strong>✅ Enviados:</strong> <span className="text-green-600">{recipientsData.sentCount}</span>
                </div>
                <div>
                  <strong>❌ Fallidos:</strong> <span className="text-red-600">{recipientsData.failedCount}</span>
                </div>
                <div>
                  <strong>⏳ No enviados:</strong> <span className="text-gray-600">{recipientsData.notSentCount}</span>
                </div>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="p-3 text-left border-b">Nume</th>
                    <th className="p-3 text-left border-b">Email</th>
                    <th className="p-3 text-left border-b">Status</th>
                    <th className="p-3 text-left border-b">Data Trimiterii</th>
                  </tr>
                </thead>
                <tbody>
                  {recipientsData.recipients && recipientsData.recipients.length > 0 ? (
                    recipientsData.recipients.map((recipient, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="p-3">{recipient.nombre || 'N/A'}</td>
                        <td className="p-3">{recipient.email}</td>
                        <td className="p-3">
                          {recipient.status === 'sent' && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">✅ Trimis</span>
                          )}
                          {recipient.status === 'failed' && (
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">❌ Fallido</span>
                          )}
                          {recipient.status === 'not_sent' && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">⏳ Ne-trimis</span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-gray-600">
                          {recipient.sentAt 
                            ? new Date(recipient.sentAt).toLocaleString('es-ES')
                            : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="p-4 text-center text-gray-500">
                        Nu există destinatari
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {recipientsData.recipients && recipientsData.recipients.some(r => r.errorMessage) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <strong className="text-red-800">Erori:</strong>
                <div className="mt-2 space-y-2">
                  {recipientsData.recipients
                    .filter(r => r.errorMessage)
                    .map((recipient, idx) => (
                      <div key={idx} className="text-sm text-red-700">
                        <strong>{recipient.nombre || recipient.email}:</strong> {recipient.errorMessage}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal de confirmación moderna */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setConfirmAction(null);
          setConfirmMessage('');
        }}
        title="Confirmar Acción"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">{confirmMessage}</p>
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => {
                setShowConfirmModal(false);
                setConfirmAction(null);
                setConfirmMessage('');
              }}
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (confirmAction) {
                  confirmAction();
                }
                setShowConfirmModal(false);
                setConfirmAction(null);
                setConfirmMessage('');
              }}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast Notification */}
      {showToast && (
        <div className={`fixed top-4 right-4 z-50 animate-slide-in-right ${
          showToast.type === 'success' 
            ? 'bg-green-500' 
            : 'bg-red-500'
        } text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-md`}>
          <span className="text-2xl">
            {showToast.type === 'success' ? '✅' : '❌'}
          </span>
          <span className="flex-1">{showToast.message}</span>
          <button
            onClick={() => setShowToast(null)}
            className="text-white hover:text-gray-200 text-xl font-bold"
          >
            ×
          </button>
        </div>
      )}

    </div>
  );
}

