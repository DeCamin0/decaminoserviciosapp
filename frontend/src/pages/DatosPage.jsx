import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContextBase';
import { routes } from '../utils/routes.js';
import { fetchAvatarOnce, getCachedAvatar, setCachedAvatar, clearAvatarCacheFor, DEFAULT_AVATAR } from '../utils/avatarCache';
import { Notification, Modal, Input, PageHeader, AlertBanner } from '../components/ui';
import { Camera, Image as ImageIcon, Trash2, Lock, Pencil } from 'lucide-react';
import { useLoadingState } from '../hooks/useLoadingState';
import { useApi } from '../hooks/useApi';
import { API_ENDPOINTS } from '../utils/constants';
import { getFormattedNombre, getEmployeeInitials } from '../utils/employeeNameHelper';
import { config } from '../config/env';
import AssistantPreferencesCard from '../components/AssistantPreferencesCard.jsx';
import { dateInputToDdMmYyyy } from '../utils/dateInputFormat';

// Función para calcular la antigüedad
const calcularAntiguedad = (fechaAntiguedad, fechaBaja) => {
  if (!fechaAntiguedad) return '';
  
  try {
    // Parsează data de start (formato dd-mm-yyyy sau dd/mm/yyyy)
    let fechaInicio;
    if (fechaAntiguedad.includes('/')) {
      const [dd, mm, yyyy] = fechaAntiguedad.split('/');
      fechaInicio = new Date(yyyy, mm - 1, dd);
    } else if (fechaAntiguedad.includes('-')) {
      const [dd, mm, yyyy] = fechaAntiguedad.split('-');
      fechaInicio = new Date(yyyy, mm - 1, dd);
    } else {
      return '';
    }
    
    // Data de final (fecha baja sau hoy)
    let fechaFinal;
    if (fechaBaja) {
      if (fechaBaja.includes('/')) {
        const [dd2, mm2, yyyy2] = fechaBaja.split('/');
        fechaFinal = new Date(yyyy2, mm2 - 1, dd2);
      } else if (fechaBaja.includes('-')) {
        const [dd2, mm2, yyyy2] = fechaBaja.split('-');
        fechaFinal = new Date(yyyy2, mm2 - 1, dd2);
      } else {
        fechaFinal = new Date();
      }
    } else {
      fechaFinal = new Date();
    }
    
    // Calculează diferența
    let years = fechaFinal.getFullYear() - fechaInicio.getFullYear();
    let months = fechaFinal.getMonth() - fechaInicio.getMonth();
    let days = fechaFinal.getDate() - fechaInicio.getDate();
    
    // Ajustează dacă e necesar
    if (days < 0) {
      months--;
      const prevMonth = new Date(fechaFinal.getFullYear(), fechaFinal.getMonth(), 0);
      days += prevMonth.getDate();
    }
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    // Format frumos
    const partsText = [];
    if (years > 0) partsText.push(`${years} año${years !== 1 ? 's' : ''}`);
    if (months > 0) partsText.push(`${months} mes${months !== 1 ? 'es' : ''}`);
    if (days > 0 && years === 0) partsText.push(`${days} día${days !== 1 ? 's' : ''}`);
    
    return partsText.length > 0 ? partsText.join(', ') : 'Menos de 1 día';
  } catch (error) {
    console.error('Error calculando antigüedad:', error);
    return '';
  }
};

// Funcție helper pentru transformare automată în majuscule
const toUpperCaseIfNeeded = (field, value) => {
  // Câmpuri care NU trebuie transformate în majuscule
  const excludeFields = [
    'DIRECCION',
    'CORREO ELECTRONICO',
    'NACIONALIDAD',
    'FECHA NACIMIENTO',
    'FECHA DE ALTA',
    'FECHA BAJA',
    'Fecha Antigüedad',
    'Antigüedad'
  ];
  
  if (excludeFields.includes(field)) {
    return value;
  }
  
  // Pentru DNI/NIE și IBAN, transformăm doar literele în majuscule
  if (field === 'D.N.I. / NIE' || field === 'Nº Cuenta') {
    return value.toUpperCase();
  }
  
  // Pentru restul câmpurilor text, transformăm totul în majuscule
  return value.toUpperCase();
};

export default function DatosPage() {
  const { user: authUser, logout } = useAuth();
  const { callApi } = useApi();
  const [user, setUser] = useState(null);
  const [uiReady, setUiReady] = useState(false); // decuplează percepția UI de fetch
  const [error, setError] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState('');
  const [motivo, setMotivo] = useState('');
  const motivoRef = useRef(null);
  const editBodyRef = useRef(null);
const [editLoading, setEditLoading] = useState(false);
  
  // Loading states centralizate
  const { 
    setOperationLoading, 
    isOperationLoading 
  } = useLoadingState();
  
  // State pentru notificări
  const [notification, setNotification] = useState(null);
  
  // State pentru încărcarea pozei de profil
  const [profileImage, setProfileImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAvatar, setDeletingAvatar] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  
  // State pentru modalul de schimbare parolă
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    oldPassword: false,
    newPassword: false,
    confirmPassword: false
  });

  const email = authUser?.email || user?.email || user?.CORREO_ELECTRONICO || authUser?.CORREO_ELECTRONICO || '';
  const resolvedCodigo = user?.CODIGO || authUser?.CODIGO || '';
  const resolvedNombre =
    user?.['NOMBRE / APELLIDOS'] ||
    user?.NOMBRE_APELLIDOS ||
    authUser?.['NOMBRE / APELLIDOS'] ||
    authUser?.NOMBRE_APELLIDOS ||
    '';

  const normalizeYesNoValue = (value) => {
    if (value === null || value === undefined) return '';
    const normalized = value.toString().trim().toLowerCase();
    if (!normalized) return '';

    const yesValues = ['si', 'sí', 'yes', 'true', '1', 's', 'y'];
    const noValues = ['no', 'false', '0', 'n'];

    if (yesValues.includes(normalized)) return 'SI';
    if (noValues.includes(normalized)) return 'NO';

    return value.toString().trim();
  };

  const renderPermissionBadge = (value, { positiveLabel = 'Sí', negativeLabel = 'No' } = {}) => {
    const interpreted = normalizeYesNoValue(value);

    if (interpreted === null || interpreted === undefined || interpreted === '' || (typeof interpreted === 'string' && interpreted.trim() === '')) {
      return <span className="datos-perm-badge datos-perm-badge--neutral">—</span>;
    }

    if (interpreted === 'SI') {
      return <span className="datos-perm-badge datos-perm-badge--ok">{positiveLabel}</span>;
    }

    if (interpreted === 'NO') {
      return <span className="datos-perm-badge datos-perm-badge--no">{negativeLabel}</span>;
    }

    return <span className="datos-perm-badge datos-perm-badge--neutral">{value}</span>;
  };

  const renderSkeleton = () => (
    <div className="datos-page datos-skeleton">
      <div className="app-card app-card--pad">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
      <div className="app-card app-card--pad">
        <div className="datos-grid">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-14 rounded bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    </div>
  );

  // Funcții pentru încărcarea pozei de profil
  const validateImage = (file) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (!allowedTypes.includes(file.type)) {
      return 'Solo se permiten archivos JPG, PNG o WebP';
    }
    
    if (file.size > maxSize) {
      return 'La imagen debe ser menor a 5MB';
    }
    
    return null;
  };

  const handleImageUpload = (event) => {
    console.log('🚀 handleImageUpload CALLED!');
    console.log('📁 event.target.files:', event.target.files);
    const file = event.target.files[0];
    if (!file) {
      console.log('❌ No file selected');
      return;
    }

    console.log('📷 Nuevo archivo seleccionado:', file.name, file.size, file.type);
    console.log('🔍 Input source:', event.target === fileInputRef.current ? 'fileInputRef' : 'cameraInputRef');
    setImageError('');
    const validationError = validateImage(file);
    if (validationError) {
      setImageError(validationError);
      return;
    }

    setProfileImage(file);
    
    // Reset preview first to force update
    setImagePreview(null);
    
    // Creează preview
    const reader = new FileReader();
    reader.onload = (e) => {
      console.log('🖼️ Preview generado para:', file.name);
      console.log('🖼️ Preview URL length:', e.target.result.length);
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
    
    // Închide modalul dacă e deschis
    setShowImageModal(false);
  };

  const handleImageRemove = () => {
    setProfileImage(null);
    setImagePreview(null);
    setImageError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const saveProfileImage = async () => {
    if (!profileImage) return;

    setImageLoading(true);
    setImageError('');

    try {
      const formData = new FormData();
      
      // Determinar el motivo según si ya tiene avatar guardado o no
      // Si ya existe AVATAR en el usuario, entonces es "Editar", sino es "Guardar"
      const hasExistingAvatar = user?.AVATAR || user?.avatar;
      const motivo = hasExistingAvatar ? 'Editar' : 'Guardar';
      
      formData.append('motivo', motivo);
      formData.append('CODIGO', user?.CODIGO || authUser?.CODIGO || '');
      formData.append('nombre', user?.['NOMBRE / APELLIDOS'] || authUser?.['NOMBRE / APELLIDOS'] || '');
      // Ensure filename is sent so n8n detects binary correctly (accepts 'file' or 'archivo')
      formData.append('file', profileImage, profileImage.name);
      formData.append('archivo', profileImage, profileImage.name);

      console.log('📤 Enviando avatar:', {
        motivo,
        CODIGO: user?.CODIGO || authUser?.CODIGO,
        nombre: user?.['NOMBRE / APELLIDOS'] || authUser?.['NOMBRE / APELLIDOS'],
        fileName: profileImage.name,
        fileSize: profileImage.size
      });

      // Folosește backend proxy (routes.getAvatar) ca înainte, pentru a evita CORS/failed to fetch
      const avatarEndpoint = routes.getAvatar;

      // Adaugă token-ul JWT dacă există
      const headers = {};
      const token = localStorage.getItem('auth_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(avatarEndpoint, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const txt = await response.text().catch(() => '');
        throw new Error(`HTTP error! status: ${response.status} ${txt}`);
      }

      const result = await response.json();
      console.log('✅ Avatar guardado:', result);
      
      // Log avatar uploaded
      const activityLogger = (await import('../utils/activityLogger')).default;
      if (authUser || user) {
        activityLogger.logAvatarUploaded(
          {
            codigo: user?.CODIGO || authUser?.CODIGO,
            fileName: profileImage.name,
            fileSize: profileImage.size,
            motivo: motivo
          },
          user || authUser
        );
      }
      
      setNotification({
        type: 'success',
        message: `Foto de perfil ${motivo === 'Guardar' ? 'guardada' : 'actualizada'} correctamente`
      });
      
      // Actualizar el user state con la nueva imagen
      if (result.avatar || result.url) {
        const newAvatarUrl = result.avatar || result.url;
        const newVersion = Date.now();
        setUser(prev => {
          // Folosește baza completă: authUser (preferat), apoi prev dacă are CODIGO/GRUPO, altfel localStorage
          const lsUser = JSON.parse(localStorage.getItem('user') || '{}');
          const hasCore = (u) => (u?.CODIGO || u?.email || u?.['CORREO ELECTRONICO']) && (u?.GRUPO || u?.role);
          const baseUser = hasCore(authUser) ? authUser : hasCore(prev) ? prev : hasCore(lsUser) ? lsUser : {};
          const newUser = {
            ...baseUser,
            AVATAR: newAvatarUrl,
            avatar: newAvatarUrl,
            avatarVersion: newVersion,
          };
          if (hasCore(newUser)) {
            localStorage.setItem('user', JSON.stringify(newUser));
          }
          return newUser;
        });
        setCachedAvatar(user?.CODIGO || authUser?.CODIGO, newAvatarUrl, newVersion);
        // Notify SW to drop old cached avatar entries
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'avatarUpdated',
            url: avatarEndpoint
          });
        }
        // Actualizar también el preview
        setImagePreview(newAvatarUrl);
      }
      
      // Reset form după salvare cu succes
      setImageError('');
      setProfileImage(null); // Resetăm profileImage pentru a închide modalul
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
      // Păstrăm imagePreview cu avatarul salvat pentru afișare
      
      // Închidem modalul de editare/încărcare după salvare cu succes
      setShowImageModal(false);
    } catch (error) {
      console.error('❌ Error al subir avatar:', error);
      setImageError('Error al subir la imagen. Inténtalo de nuevo.');
    } finally {
      setImageLoading(false);
    }
  };

  const deleteAvatar = async () => {
    setDeletingAvatar(true);
    setImageError('');
    
    try {
      const formData = new FormData();
      
      formData.append('motivo', 'Eliminar');
      formData.append('CODIGO', user?.CODIGO || authUser?.CODIGO || '');
      formData.append('nombre', user?.['NOMBRE / APELLIDOS'] || authUser?.['NOMBRE / APELLIDOS'] || '');

      console.log('🗑️ Eliminando avatar (buton mic):', {
        motivo: 'Eliminar',
        CODIGO: user?.CODIGO || authUser?.CODIGO,
        nombre: user?.['NOMBRE / APELLIDOS'] || authUser?.['NOMBRE / APELLIDOS']
      });

      // Use proxy in dev, direct n8n in production
      // Adaugă token-ul JWT dacă există
      const headers = {};
      const token = localStorage.getItem('auth_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.getAvatar, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Avatar eliminado (buton mic):', result);
      
      // Eliminar avatar del state local
      setUser(prev => {
        const lsUser = JSON.parse(localStorage.getItem('user') || '{}');
        const hasCore = (u) => (u?.CODIGO || u?.email || u?.['CORREO ELECTRONICO']) && (u?.GRUPO || u?.role);
        const baseUser = hasCore(authUser) ? authUser : hasCore(prev) ? prev : hasCore(lsUser) ? lsUser : {};
        const newUser = {
          ...baseUser,
          AVATAR: null,
          avatar: null,
          avatarVersion: null,
        };
        if (hasCore(newUser)) {
          localStorage.setItem('user', JSON.stringify(newUser));
        }
        return newUser;
      });
      setImagePreview(DEFAULT_AVATAR);
      clearAvatarCacheFor(user?.CODIGO || authUser?.CODIGO);
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'avatarDeleted',
          url: routes.getAvatar
        });
      }
      
      setNotification({
        type: 'success',
        title: 'Avatar eliminado',
        message: 'Tu foto de perfil ha sido eliminada correctamente.'
      });
      
    } catch (error) {
      console.error('❌ Error eliminando avatar (buton mic):', error);
      setImageError('No se pudo eliminar la foto de perfil. Inténtalo de nuevo.');
    } finally {
      setDeletingAvatar(false);
    }
  };

  const closeDeleteConfirm = () => {
    setShowDeleteConfirm(false);
  };

  const deleteProfileImage = async () => {
    setImageLoading(true);
    setImageError('');
    setShowDeleteConfirm(false);

    try {
      const formData = new FormData();
      
      formData.append('motivo', 'Eliminar');
      formData.append('CODIGO', user?.CODIGO || authUser?.CODIGO || '');
      formData.append('nombre', user?.['NOMBRE / APELLIDOS'] || authUser?.['NOMBRE / APELLIDOS'] || '');

      console.log('🗑️ Eliminando avatar:', {
        motivo: 'Eliminar',
        CODIGO: user?.CODIGO || authUser?.CODIGO,
        nombre: user?.['NOMBRE / APELLIDOS'] || authUser?.['NOMBRE / APELLIDOS']
      });

      // Use proxy in dev, direct n8n in production
      const response = await fetch(routes.getAvatar, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Avatar eliminado:', result);
      
      // Log avatar deleted
      const activityLogger = (await import('../utils/activityLogger')).default;
      if (authUser || user) {
        activityLogger.logAvatarDeleted(
          {
            codigo: user?.CODIGO || authUser?.CODIGO
          },
          user || authUser
        );
      }
      
      setNotification({
        type: 'success',
        message: 'Foto de perfil eliminada correctamente'
      });
      
      // Limpiar el avatar del user state
      setUser(prev => {
        const newUser = {
          ...prev,
          AVATAR: null,
          avatar: null,
          avatarVersion: null,
        };
        localStorage.setItem('user', JSON.stringify(newUser));
        return newUser;
      });
      setImagePreview(DEFAULT_AVATAR);
      clearAvatarCacheFor(user?.CODIGO || authUser?.CODIGO);
      
      // Reset form
      handleImageRemove();
    } catch (error) {
      console.error('❌ Error al eliminar avatar:', error);
      setImageError('Error al eliminar la imagen. Inténtalo de nuevo.');
    } finally {
      setImageLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    
    // Validări
    if (!passwordForm.oldPassword || !passwordForm.oldPassword.trim()) {
      setPasswordError('La contraseña actual es obligatoria');
      return;
    }
    
    if (!passwordForm.newPassword || !passwordForm.newPassword.trim()) {
      setPasswordError('La nueva contraseña es obligatoria');
      return;
    }
    
    const newPassword = passwordForm.newPassword.trim();
    
    // Longitudine minimă: 9 caractere (12 recomandat)
    if (newPassword.length < 9) {
      setPasswordError('La nueva contraseña debe tener al menos 9 caracteres (se recomienda 12)');
      return;
    }
    
    // Verifică complexitatea parolei
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword);
    
    const errors = [];
    if (!hasUpperCase) {
      errors.push('al menos 1 letra mayúscula (A-Z)');
    }
    if (!hasLowerCase) {
      errors.push('al menos 1 letra minúscula (a-z)');
    }
    if (!hasNumber) {
      errors.push('al menos 1 número (0-9)');
    }
    if (!hasSpecialChar) {
      errors.push('al menos 1 carácter especial (! @ # $ % ^ & * ( ) _ + - =)');
    }
    
    if (errors.length > 0) {
      setPasswordError(`La nueva contraseña debe contener: ${errors.join(', ')}`);
      return;
    }
    
    if (newPassword !== passwordForm.confirmPassword.trim()) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }
    
    if (newPassword === passwordForm.oldPassword.trim()) {
      setPasswordError('La nueva contraseña debe ser diferente a la contraseña actual');
      return;
    }
    
    setChangingPassword(true);
    
    try {
      const codigo = user?.CODIGO || authUser?.CODIGO || resolvedCodigo;
      if (!codigo) {
        throw new Error('No se pudo obtener el código del empleado');
      }
      
      const result = await callApi(API_ENDPOINTS.CHANGE_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          codigo,
          oldPassword: passwordForm.oldPassword.trim(),
          newPassword: passwordForm.newPassword.trim(),
        }),
      });
      
      if (result.success) {
        setNotification({
          type: 'success',
          title: 'Contraseña Cambiada',
          message: 'Tu contraseña ha sido cambiada exitosamente. Serás redirigido para iniciar sesión con tu nueva contraseña.',
        });
        setShowChangePasswordModal(false);
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordError('');
        
        // Dacă backend-ul indică că trebuie logout, facem logout automat
        if (result.requiresLogout) {
          // Așteptăm puțin pentru ca utilizatorul să vadă notificarea
          setTimeout(() => {
            logout();
          }, 2000);
        }
      } else {
        setPasswordError(result.error || 'Error al cambiar la contraseña. Inténtalo de nuevo.');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError(error.message || 'Error al cambiar la contraseña. Inténtalo de nuevo.');
    } finally {
      setChangingPassword(false);
    }
  };

  const loadExistingAvatar = useCallback(async () => {
    if (!resolvedCodigo) return;

    try {
      const cachedPayload = getCachedAvatar(resolvedCodigo);
      const cachedUrl = cachedPayload?.url || cachedPayload || null;
      const cachedVersion = cachedPayload?.version || null;
      if (cachedUrl) {
        setUser(prev => ({
          ...prev,
          AVATAR: cachedUrl,
          avatar: cachedUrl,
          avatarVersion: prev?.avatarVersion || cachedVersion || null
        }));
        setImagePreview(cachedUrl);
        return;
      }

      const avatarUrl = await fetchAvatarOnce({
        codigo: resolvedCodigo,
        nombre: resolvedNombre || '',
        endpoint: routes.getAvatar,
        version: user?.avatarVersion || authUser?.avatarVersion || null,
      });

      if (avatarUrl) {
        const newVersion = Date.now();
        setUser(prev => {
          const newUser = {
            ...prev,
            AVATAR: avatarUrl,
            avatar: avatarUrl,
            avatarVersion: newVersion,
          };
          localStorage.setItem('user', JSON.stringify(newUser));
          return newUser;
        });
        setImagePreview(avatarUrl);
        setCachedAvatar(resolvedCodigo, avatarUrl, newVersion);
      } else {
        setImagePreview(DEFAULT_AVATAR);
      }
    } catch (error) {
      console.error('❌ Error al cargar avatar:', error);
      setImagePreview((prev) => prev || DEFAULT_AVATAR);
      // No mostramos error al usuario porque no tener avatar no es un error
    }
  }, [resolvedCodigo, resolvedNombre, user?.avatarVersion, authUser?.avatarVersion]);

  // State pentru lista de clienți
  const [clientes, setClientes] = useState([]);

  // Lista de țări pentru dropdown
  const paises = [
    'España', 'Francia', 'Italia', 'Portugal', 'Alemania', 'Reino Unido', 'Irlanda', 'Países Bajos', 'Bélgica', 'Suiza', 'Austria', 'Suecia', 'Noruega', 'Dinamarca', 'Finlandia',
    'Polonia', 'República Checa', 'Eslovaquia', 'Hungría', 'Rumania', 'Bulgaria', 'Croacia', 'Eslovenia', 'Estonia', 'Letonia', 'Lituania', 'Grecia', 'Chipre', 'Malta', 'Luxemburgo',
    'Estados Unidos', 'Canadá', 'México', 'Brasil', 'Argentina', 'Chile', 'Colombia', 'Perú', 'Venezuela', 'Ecuador', 'Uruguay', 'Paraguay', 'Bolivia', 'Costa Rica', 'Panamá',
    'República Dominicana', 'Cuba', 'Puerto Rico', 'Jamaica', 'Haití', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Rusia', 'China', 'Japón', 'Corea del Sur', 'India', 'Australia'
  ];

  // Funcții de validare
  const validarSeguridadSocial = (numero) => {
    if (!numero || numero.length !== 12) return false;
    return /^\d{12}$/.test(numero);
  };

  const validarIBAN = (iban) => {
    if (!iban) return null;
    const ibanLimpio = iban.replace(/\s/g, '');
    if (ibanLimpio.length !== 24) return false;
    if (!ibanLimpio.startsWith('ES')) return false;
    return /^ES\d{22}$/.test(ibanLimpio);
  };

  const validarDNINIE = (dni) => {
    if (!dni) return null;
    const dniLimpio = dni.toUpperCase().replace(/\s/g, '');
    
    // Validar DNI
    if (/^\d{8}[A-Z]$/.test(dniLimpio)) {
      const numero = dniLimpio.substring(0, 8);
      const letra = dniLimpio.substring(8, 9);
      const letras = 'TRWAGMYFPDXBNJZSQVHLCKE';
      const letraCorrecta = letras[parseInt(numero) % 23];
      return letra === letraCorrecta;
    }
    
    // Validar NIE
    if (/^[XYZ]\d{7}[A-Z]$/.test(dniLimpio)) {
      const primerCaracter = dniLimpio.charAt(0);
      const numero = dniLimpio.substring(1, 8);
      const letra = dniLimpio.substring(8, 9);
      
      let numeroCompleto;
      switch (primerCaracter) {
        case 'X': numeroCompleto = '0' + numero; break;
        case 'Y': numeroCompleto = '1' + numero; break;
        case 'Z': numeroCompleto = '2' + numero; break;
        default: return false;
      }
      
      const letras = 'TRWAGMYFPDXBNJZSQVHLCKE';
      const letraCorrecta = letras[parseInt(numeroCompleto) % 23];
      return letra === letraCorrecta;
    }
    
    return false;
  };

  // Funcție pentru încărcarea clienților
  const fetchClientes = useCallback(async () => {
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Skipping fetchClientes in DatosPage');
      return;
    }
    
    try {
      console.log('Fetching clientes from:', routes.getClientes);
      const response = await fetch(routes.getClientes);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Clientes data received:', data);
      
      const clientesData = Array.isArray(data) ? data : [];
      // Filtrează doar clienții (nu furnizorii)
      const soloClientes = clientesData.filter(item => item.tipo !== 'proveedor');
      setClientes(soloClientes);
      
    } catch (e) {
      console.error('Error fetching clientes:', e);
    }
  }, [authUser?.isDemo]);

  // Cache pentru empleado - evită apeluri duplicate
  const empleadoCacheRef = useRef({ codigo: null, email: null, data: null, timestamp: 0 });
  const CACHE_DURATION = 60000; // 60 secunde cache
  const fetchingEmpleadoRef = useRef(false);

  const fetchUser = useCallback(async () => {
    setOperationLoading('user', true);
    setError(null);
    
    // Skip real data fetch in DEMO mode
    if (authUser?.isDemo) {
      console.log('🎭 DEMO mode: Using demo user data instead of fetching from backend');
      setUser(authUser);
      setOperationLoading('user', false);
      return;
    }
    
    // Verifică cache-ul
    const now = Date.now();
    const cache = empleadoCacheRef.current;
    if (cache.data && 
        (cache.codigo === authUser?.CODIGO || cache.email === authUser?.email) &&
        (now - cache.timestamp) < CACHE_DURATION) {
      // Folosește cache-ul
      setUser(cache.data);
      setOperationLoading('user', false);
      return;
    }
    
    // Evită apeluri duplicate simultane
    if (fetchingEmpleadoRef.current) {
      setOperationLoading('user', false);
      return;
    }
    
    try {
      fetchingEmpleadoRef.current = true;
      // Folosim backend-ul nou (getEmpleadoMe) - returnează direct angajatul curent
      const endpoint = routes.getEmpleadoMe;
      
      if (!endpoint) {
        console.error('❌ [DatosPage] routes.getEmpleadoMe nu este definit!');
        setError('No se pudo obtener el endpoint para los datos del empleado.');
        setOperationLoading('user', false);
        return;
      }
      
      console.log('✅ [DatosPage] Folosind backend-ul nou (getEmpleadoMe):', endpoint);
      
      const token = localStorage.getItem('auth_token');
      const headers = {
        'X-App-Source': (config.APP_NAME || config.COMPANY_NAME || 'Web-App').replace(/\s+/g, '-'),
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        'X-Client-Type': 'web-browser',
        'User-Agent': (config.APP_NAME || config.COMPANY_NAME || 'Web-Client') + '/1.0'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      console.log('🔍 [DatosPage] Fetching user data:', {
        endpoint,
        hasToken: !!token,
        tokenLength: token?.length || 0,
        headers: Object.keys(headers)
      });
      
      const res = await fetch(endpoint, {
        method: 'GET',
        headers,
        cache: 'no-store', // Forțează request fresh, fără cache
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('🔍 [DatosPage] Raw data from backend:', data);
      
      // Procesăm răspunsul de la backend-ul nou: { success: true, empleado: {...} }
      let found = null;
      if (data && data.success && data.empleado) {
        found = data.empleado;
      } else if (data && data.empleado) {
        found = data.empleado;
      } else if (Array.isArray(data) && data.length > 0) {
        // Fallback pentru format vechi (array) - compatibilitate
        found = data[0];
      } else if (data && !data.status) {
        // Dacă nu este status, poate fi direct obiectul empleado
        found = data;
      }
      
      // Verificăm dacă este răspuns "not-modified"
      if (data && data.status === 'not-modified') {
        console.log('ℹ️ [DatosPage] Response is status:not-modified - păstrez user-ul existent.');
        // NU suprascrii user-ul existent - păstrează datele existente
        setError(null);
        setOperationLoading('user', false);
        return;
      }
      
      if (found) {
        console.log('🔍 [DatosPage] Datele complete despre angajat din backend:', found);
        console.log('🔍 [DatosPage] Toate cheile din empleado:', Object.keys(found || {}));
        console.log('🔍 [DatosPage] DerechoPedidos din backend (raw):', found.DerechoPedidos, 'type:', typeof found.DerechoPedidos);
        console.log('🔍 [DatosPage] DerechoPedidos variants:', {
          'DerechoPedidos': found.DerechoPedidos,
          'derechoPedidos': found.derechoPedidos,
          'derecho_pedidos': found.derecho_pedidos,
        });
        
        // Mapeo robusto de campos - verificamos múltiples variaciones
        const mappedUser = {
          'CODIGO': found['CODIGO'] || found.codigo || found.CODIGO || '',
          'NOMBRE / APELLIDOS': found['NOMBRE / APELLIDOS'] || found.nombre || found.NOMBRE || '',
          // Nuevos campos separados
          'NOMBRE': found['NOMBRE'] || found.NOMBRE || '',
          'APELLIDO1': found['APELLIDO1'] || found.APELLIDO1 || '',
          'APELLIDO2': found['APELLIDO2'] || found.APELLIDO2 || '',
          'NOMBRE_SPLIT_CONFIANZA': found['NOMBRE_SPLIT_CONFIANZA'] || found.NOMBRE_SPLIT_CONFIANZA || found.nombre_split_confianza || 2,
          'NOMBRE_APELLIDOS_BACKUP': found['NOMBRE_APELLIDOS_BACKUP'] || found.NOMBRE_APELLIDOS_BACKUP || '',
          'CORREO ELECTRONICO': found['CORREO ELECTRONICO'] || found.email || found.EMAIL || found['CORREO ELECTRÓNICO'] || '',
          'NACIONALIDAD': found['NACIONALIDAD'] || found.nacionalidad || '',
          'DIRECCION': found['DIRECCION'] || found.direccion || found['DIRECCIÓN'] || '',
          'D.N.I. / NIE': found['D.N.I. / NIE'] || found.dni || found.DNI || found.nie || found.NIE || '',
          'SEG. SOCIAL': found['SEG. SOCIAL'] || found['SEGURIDAD SOCIAL'] || found.seguridad_social || found.seg_social || '',
          'Nº Cuenta': found['Nº Cuenta'] || found.cuenta || found.CUENTA || found.numero_cuenta || '',
          'TELEFONO': found['TELEFONO'] || found.telefono || found.TELEFONO || found.phone || '',
          'FECHA NACIMIENTO': found['FECHA NACIMIENTO'] || found.fecha_nacimiento || found.fechaNacimiento || found['FECHA DE NACIMIENTO'] || '',
          'FECHA DE ALTA': found['FECHA DE ALTA'] || found['FECHA_DE_ALTA'] || found.fecha_alta || found.fechaAlta || found.fecha_de_alta || '',
          'CENTRO TRABAJO': found['CENTRO TRABAJO'] || found.centro_trabajo || found.centroTrabajo || found.centro || '',
          'TIPO DE CONTRATO': found['TIPO DE CONTRATO'] || found.tipo_contrato || found.tipoContrato || found['TIPO_DE_CONTRATO'] || '',
          'SUELDO BRUTO MENSUAL': found['SUELDO BRUTO MENSUAL'] || found.sueldo || found.SUELDO || found.sueldo_bruto || '',
          'HORAS DE CONTRATO': found['HORAS DE CONTRATO'] || found.horas_contrato || found.horasContrato || found['HORAS_DE_CONTRATO'] || '',
          'EMPRESA': found['EMPRESA'] || found.empresa || found.EMPRESA || '',
          'GRUPO': found['GRUPO'] || found.grupo || found.GRUPO || '',
          'ESTADO': found['ESTADO'] || found.estado || found.ESTADO || '',
          'FECHA BAJA': found['FECHA BAJA'] || found.fecha_baja || found.fechaBaja || found['FECHA_BAJA'] || '',
          'Fecha Antigüedad': found['Fecha Antigüedad'] || found.fecha_antiguedad || found.fechaAntiguedad || '',
          'Antigüedad': found['Antigüedad'] || found.antiguedad || '',
          'DerechoPedidos': (() => {
            const rawValue = found['DerechoPedidos'] || found.derechoPedidos || found.DerechoPedidos || found.derecho_pedidos || '';
            const normalized = normalizeYesNoValue(rawValue);
            console.log('🔍 [DatosPage] DerechoPedidos mapping:', { rawValue, normalized, type: typeof rawValue });
            return normalized;
          })(),
          'TrabajaFestivos': normalizeYesNoValue(found['TrabajaFestivos'] || found.trabajaFestivos || found.TrabajaFestivos || found.trabaja_festivos || ''),
        };
        console.log('DatosPage mapped user:', mappedUser);
        console.log('FECHA DE ALTA value:', mappedUser['FECHA DE ALTA']);
        // Păstrez avatarul existent când setez user-ul nou
        const finalUser = {
          ...mappedUser,
          AVATAR: user?.AVATAR || null,
          avatar: user?.avatar || null
        };
        setUser(finalUser);
        // Actualizează cache-ul
        empleadoCacheRef.current = {
          codigo: authUser?.CODIGO,
          email: authUser?.email,
          data: finalUser,
          timestamp: Date.now(),
        };
        setError(null);
      } else {
        // Nu am găsit date despre angajat
        console.warn('⚠️ [DatosPage] Nu s-au găsit date despre angajat în răspunsul backend-ului');
        // Nu resetăm user-ul existent dacă nu există date noi - păstrăm datele existente
        if (!user && authUser) {
          // Construiește user minim din authUser ca fallback doar dacă nu avem user deloc
          const fallbackUser = {
            'CODIGO': authUser.CODIGO || authUser.codigo || '',
            'NOMBRE / APELLIDOS': authUser['NOMBRE / APELLIDOS'] || authUser.NOMBRE_APELLIDOS || authUser.empleadoNombre || authUser.name || '',
            'CORREO ELECTRONICO': authUser.email || authUser.CORREO_ELECTRONICO || authUser['CORREO ELECTRONICO'] || '',
            'GRUPO': authUser.GRUPO || authUser.grupo || '',
            'ESTADO': authUser.ESTADO || authUser.estado || '',
          };
          setUser(fallbackUser);
        }
        // Altfel, nu facem nimic - păstrăm user-ul existent
      }
    } catch {
      setError('No se pudieron cargar los datos del usuario.');
    } finally {
      setOperationLoading('user', false);
      fetchingEmpleadoRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, email, setOperationLoading]); // Removed 'user' from deps to avoid reset loops

  // Fetch clientes o singură dată la mount (nu blochează afișarea datelor utilizatorului)
  useEffect(() => {
    fetchClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Execută doar o dată la mount

  // Fetch user când se schimbă email-ul
  useEffect(() => {
    if (email) {
      fetchUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]); // Doar email, nu fetchUser (evită loop infinit)

  // Cargar avatar existente cuando el usuario está disponible
  useEffect(() => {
    loadExistingAvatar();
  }, [loadExistingAvatar]);

  // UI ready fallback după max 650ms pentru a afișa skeleton imediat
  useEffect(() => {
    const timeout = setTimeout(() => setUiReady(true), 650);
    return () => clearTimeout(timeout);
  }, []);

  // Blocăm scroll pe body când modalul de edit e deschis; body-ul modalului pornește de sus
  useEffect(() => {
    if (!showEdit) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const scrollToTop = () => {
      editBodyRef.current?.scrollTo(0, 0);
    };
    scrollToTop();
    requestAnimationFrame(scrollToTop);
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showEdit]);

  // Modal parolă: blocare scroll pagină + reset scroll body la deschidere
  useEffect(() => {
    if (!showChangePasswordModal) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const scrollToTop = () => {
      document.querySelector('.datos-password-modal .app-modal__body')?.scrollTo(0, 0);
    };
    scrollToTop();
    requestAnimationFrame(scrollToTop);
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showChangePasswordModal]);

  // Sincronizare automată: când se completează câmpurile separate, se actualizează automat "NOMBRE / APELLIDOS"
  useEffect(() => {
    if (!editForm) return;
    
    const nombre = (editForm.NOMBRE || '').trim();
    const apellido1 = (editForm.APELLIDO1 || '').trim();
    const apellido2 = (editForm.APELLIDO2 || '').trim();
    
    // Dacă există cel puțin unul din câmpurile separate completat, construim numele complet
    if (nombre || apellido1 || apellido2) {
      const parts = [nombre, apellido1, apellido2].filter(part => part && part !== '');
      const nombreCompleto = parts.length > 0 ? parts.join(' ') : '';
      
      // Actualizăm doar dacă numele complet generat este diferit de cel existent
      // sau dacă câmpul "NOMBRE / APELLIDOS" este gol
      if (nombreCompleto && (nombreCompleto !== (editForm['NOMBRE / APELLIDOS'] || '').trim())) {
        setEditForm(prev => ({
          ...prev,
          'NOMBRE / APELLIDOS': nombreCompleto
        }));
      }
    }
  }, [editForm]);

  // Dacă datele principale nu mai încarcă, marcăm UI ready imediat
  // Nu așteptăm fetchClientes - este independent și nu blochează afișarea datelor utilizatorului
  useEffect(() => {
    if (!isOperationLoading('user') && !imageLoading && user) {
      setUiReady(true);
    }
  }, [isOperationLoading, imageLoading, user]);

  // Logging + watchdog pentru a identifica blocaje de gating
  useEffect(() => {
    console.info('[Datos] gating states', {
      uiReady,
      loadingUser: isOperationLoading('user'),
      imageLoading,
      hasUser: !!user,
      authUserEmail: authUser?.email,
    });
    const watchdog = setTimeout(() => {
      if (!uiReady) {
        console.warn('[Datos] watchdog forcing uiReady=true (timeout fallback)');
        setUiReady(true);
      }
    }, 1200);
    return () => clearTimeout(watchdog);
  }, [uiReady, isOperationLoading, imageLoading, user, authUser]);

  const SHEET_FIELDS = [
    'CODIGO',
    'NOMBRE / APELLIDOS',
    'NACIONALIDAD',
    'DIRECCION',
    'D.N.I. / NIE',
    'SEG. SOCIAL',
    'Nº Cuenta',
    'TELEFONO',
    'CORREO ELECTRONICO',
    'FECHA NACIMIENTO',
    'FECHA DE ALTA',
    'CENTRO TRABAJO',
    'TIPO DE CONTRATO',
    'SUELDO BRUTO MENSUAL',
    'HORAS DE CONTRATO',
    'EMPRESA',
    'GRUPO',
    'ESTADO',
    'FECHA BAJA',
    'Fecha Antigüedad',
    'Antigüedad',
    'DerechoPedidos',
    'TrabajaFestivos',
  ];

  if (!uiReady) {
    return renderSkeleton();
  }

  // Dacă încă nu avem user dar un fetch e în curs, mai arătăm skeleton; nu afișăm eroarea până nu știm sigur că nu vine user-ul
  if (error && !user && !isOperationLoading('user')) {
    return (
      <div className="app-page datos-page">
        <PageHeader title="Datos Personales" subtitle="Información del empleado" backTo="/inicio" />
        <AlertBanner variant="danger" title="No se pudieron cargar los datos">
          {error}
        </AlertBanner>
      </div>
    );
  }

  if (!user) {
    return renderSkeleton();
  }

  return (
    <>
    <div className="app-page datos-page">
      <PageHeader
        title="Datos Personales"
        subtitle="Información del empleado"
        backTo="/inicio"
        backTitle="Regresar al Dashboard"
        actions={
          user ? (
            <div className="datos-toolbar">
              <button
                type="button"
                onClick={() => { setEditForm(user); setShowEdit(true); setMotivo(''); }}
                className="datos-btn datos-btn--primary"
              >
                <Pencil className="w-4 h-4" aria-hidden />
                <span className="hidden sm:inline">Editar datos</span>
                <span className="sm:hidden">Editar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowChangePasswordModal(true);
                  setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordError('');
                }}
                className="datos-btn"
              >
                <Lock className="w-4 h-4" aria-hidden />
                <span className="hidden sm:inline">Contraseña</span>
              </button>
            </div>
          ) : null
        }
      />

      <AssistantPreferencesCard />

      {user ? (
        <div>
          <div className="app-card app-card--pad datos-section">
            <div className="datos-profile">
              <div className="datos-profile__aside">
                <div className="datos-avatar group">
                  {(imagePreview || user?.AVATAR || user?.avatar) ? (
                    <img
                      src={imagePreview || user?.AVATAR || user?.avatar}
                      alt="Foto de perfil"
                      className="datos-avatar__img"
                    />
                  ) : user?.isDemo ? (
                    <img
                      src={`${(config.BASE_PATH || '/').replace(/\/+$/, '')}/${config.LOGO_PATH || 'logo.svg'}`.replace(/\/+/g, '/')}
                      alt="Avatar DEMO"
                      className="datos-avatar__img object-contain p-2"
                    />
                  ) : (
                    <span className="datos-avatar__initials">{getEmployeeInitials(user)}</span>
                  )}
                  <button
                    type="button"
                    className="datos-avatar__overlay"
                    onClick={() => setShowImageModal(true)}
                    aria-label="Cambiar foto de perfil"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                {(() => {
                  const hasAvatar = (imagePreview || user?.AVATAR || user?.avatar);
                  const noProfileImage = !user?.isDemo;
                  return hasAvatar && noProfileImage;
                })() && (
                  <button
                    type="button"
                    onClick={deleteAvatar}
                    disabled={deletingAvatar}
                    className="datos-btn datos-btn--danger datos-btn--block text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden />
                    {deletingAvatar ? 'Eliminando...' : 'Eliminar foto'}
                  </button>
                )}
              </div>
              <div className="datos-profile__main">
                <h2 className="datos-profile__name">{getFormattedNombre(user) || 'Sin nombre'}</h2>
                <p className="datos-profile__email">{user['CORREO ELECTRONICO'] || 'Sin email'}</p>
                <div className="datos-badge-row">
                  {user['GRUPO'] && <span className="datos-badge datos-badge--group">{user['GRUPO']}</span>}
                  {user['ESTADO'] && <span className="datos-badge datos-badge--ok">{user['ESTADO']}</span>}
                  {user['CENTRO TRABAJO'] && <span className="datos-badge datos-badge--info">{user['CENTRO TRABAJO']}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Secțiunea pentru gestionarea pozei de profil */}
          {profileImage && (
            <div className="app-card app-card--pad datos-section">
              <h3 className="datos-section__title">Foto de Perfil</h3>
              <div className="space-y-3">
                <div className="flex justify-center">
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Vista previa"
                      className="w-28 h-28 rounded-full object-cover border-2 border-gray-200"
                      key={profileImage?.name || 'default'}
                    />
                    <button
                      type="button"
                      onClick={handleImageRemove}
                      className="absolute -top-1 -right-1 w-8 h-8 datos-btn datos-btn--danger rounded-full p-0 min-h-0"
                      aria-label="Quitar vista previa"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                  {profileImage.name} · {(profileImage.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <AlertBanner variant="info" title="Recomendaciones">
                  <ul className="list-disc list-inside text-xs space-y-0.5">
                    <li>Foto profesional, mirando a la cámara</li>
                    <li>Fondo neutro y buena iluminación</li>
                    <li>Formato vertical (retrato)</li>
                  </ul>
                </AlertBanner>
                {imageError && <AlertBanner variant="danger">{imageError}</AlertBanner>}
                <div className="flex flex-col sm:flex-row gap-2 justify-end">
                  <button type="button" onClick={handleImageRemove} className="datos-btn">Cancelar</button>
                  <button type="button" onClick={saveProfileImage} disabled={imageLoading} className="datos-btn datos-btn--primary">
                    {imageLoading ? (user?.AVATAR || user?.avatar ? 'Actualizando...' : 'Guardando...') : (user?.AVATAR || user?.avatar ? 'Editar Foto' : 'Guardar Foto')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Información personal */}
            <div className="app-card app-card--pad datos-section">
            <h3 className="datos-section__title">Información Personal</h3>
            <div className="datos-grid">
              <div className="space-y-1">
                <label className="datos-field__label">Código</label>
                <p className="datos-field__value">{user.CODIGO || '-'}</p>
                  </div>
              <div className="space-y-1">
                <label className="datos-field__label">Nombre Completo</label>
                <p className="datos-field__value">{getFormattedNombre(user) || '-'}</p>
                  </div>
              {/* Campos separados si existen */}
              {(user?.NOMBRE || user?.APELLIDO1 || user?.APELLIDO2) && (
                <>
                  <div className="space-y-1">
                    <label className="datos-field__label">Nombre</label>
                    <p className="datos-field__value">{user.NOMBRE || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="datos-field__label">Primer Apellido</label>
                    <p className="datos-field__value">{user.APELLIDO1 || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="datos-field__label">Segundo Apellido</label>
                    <p className="datos-field__value">{user.APELLIDO2 || '-'}</p>
                  </div>
                  {user.NOMBRE_SPLIT_CONFIANZA !== undefined && (
                    <div className="space-y-1">
                      <label className="datos-field__label">Confianza del Split</label>
                      <p className="datos-field__value">
                        {user.NOMBRE_SPLIT_CONFIANZA === 2 ? '✅ Confiado' : user.NOMBRE_SPLIT_CONFIANZA === 1 ? '⚠️ Incierto' : '❌ Fallido'}
                      </p>
                    </div>
                  )}
                </>
              )}
              <div className="space-y-1">
                <label className="datos-field__label">Nacionalidad</label>
                <p className="datos-field__value">{user.NACIONALIDAD || '-'}</p>
                </div>
              <div className="space-y-1">
                <label className="datos-field__label">Dirección</label>
                <p className="datos-field__value">{user.DIRECCION || '-'}</p>
                </div>
              <div className="space-y-1">
                <label className="datos-field__label">DNI/NIE</label>
                <p className="datos-field__value">{user['D.N.I. / NIE'] || '-'}</p>
                </div>
              <div className="space-y-1">
                <label className="datos-field__label">Seguridad Social</label>
                <p className="datos-field__value">{user['SEG. SOCIAL'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="datos-field__label">Nº Cuenta</label>
                <p className="datos-field__value">{user['Nº Cuenta'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="datos-field__label">Teléfono</label>
                <p className="datos-field__value">{user.TELEFONO || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="datos-field__label">Email</label>
                <p className="datos-field__value">{user['CORREO ELECTRONICO'] || '-'}</p>
              </div>
              </div>
            </div>

          {/* Información laboral */}
            <div className="app-card app-card--pad datos-section">
            <h3 className="datos-section__title">Información Laboral</h3>
            <div className="datos-grid">
              <div className="space-y-1">
                <label className="datos-field__label">Fecha de Nacimiento</label>
                <p className="datos-field__value">{user['FECHA NACIMIENTO'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="datos-field__label">Fecha de Alta</label>
                <p className="datos-field__value">{user['FECHA DE ALTA'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="datos-field__label">Centro de Trabajo</label>
                <p className="datos-field__value">{user['CENTRO TRABAJO'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="datos-field__label">Tipo de Contrato</label>
                <p className="datos-field__value">{user['TIPO DE CONTRATO'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="datos-field__label">Sueldo Bruto Mensual</label>
                <p className="datos-field__value">{user['SUELDO BRUTO MENSUAL'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="datos-field__label">Horas de Contrato</label>
                <p className="datos-field__value">{user['HORAS DE CONTRATO'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="datos-field__label">Empresa</label>
                <p className="datos-field__value">{user.EMPRESA || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="datos-field__label">Grupo</label>
                <p className="datos-field__value">{user.GRUPO || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="datos-field__label">Estado</label>
                <p className="datos-field__value">{user.ESTADO || '-'}</p>
              </div>
              {user['FECHA BAJA'] && (
                <div className="space-y-1">
                  <label className="datos-field__label">Fecha Baja</label>
                  <p className="datos-field__value datos-field__value--warn">{user['FECHA BAJA']}</p>
                </div>
              )}
              <div className="space-y-1">
                <label className="datos-field__label">Fecha Antigüedad</label>
                <p className="datos-field__value">{user['Fecha Antigüedad'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="datos-field__label">Antigüedad</label>
                <p className="datos-field__value datos-field__value--ok">
                  {calcularAntiguedad(user['Fecha Antigüedad'], user['FECHA BAJA']) || '-'}
                </p>
              </div>
              <div className="space-y-1">
                <label className="datos-field__label">Derecho a Pedidos</label>
                <div className="datos-field__value">
                  {renderPermissionBadge(user.DerechoPedidos, { positiveLabel: 'Sí', negativeLabel: 'No' })}
                </div>
              </div>
              <div className="space-y-1">
                <label className="datos-field__label">Trabaja Festivos</label>
                <div className="datos-field__value">
                  {renderPermissionBadge(user.TrabajaFestivos, { positiveLabel: 'Sí', negativeLabel: 'No' })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <AlertBanner variant="danger" title="No se pudo cargar el usuario">
          Verifica tu conexión e intenta nuevamente.
        </AlertBanner>
      )}

      {/* Modal editar: fullscreen pe mobil, peste bottom-nav + FAB asistent */}
      {typeof document !== 'undefined' && showEdit && editForm && createPortal(
        <div className="datos-edit-shell">
          <div className="datos-edit-panel">
            <div className="datos-edit-panel__header">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">Editar Datos Personales</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Los cambios requieren aprobación</p>
              </div>
              <button type="button" onClick={() => setShowEdit(false)} className="app-modal__close" aria-label="Cerrar">×</button>
            </div>
            <div className="datos-edit-panel__body" ref={editBodyRef}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {SHEET_FIELDS.map(field => {
                  const fieldId = `edit-${field.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
                  return (
                  <div key={field} className="space-y-2">
                    <label htmlFor={fieldId} className="datos-field__label">{field}</label>
                    
                    {field === 'CODIGO' ? (
                      <div id={fieldId} className="datos-input datos-input--readonly" role="textbox" aria-label={field}>
                        {editForm[field] || '-'}
                      </div>
                    ) : field === 'NACIONALIDAD' ? (
                      <select
                        id={fieldId}
                        name={field}
                        className="datos-input"
                        value={editForm[field] || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                      >
                        <option value="">Selecciona nacionalidad...</option>
                        {paises.map(pais => (
                          <option key={pais} value={pais}>
                            {pais}
                          </option>
                        ))}
                      </select>
                    ) : field === 'SEG. SOCIAL' ? (
                      <div className="space-y-2">
                        <input
                          id={fieldId}
                          name={field}
                          type="text"
                          className={`datos-input ${
                            editForm[field] ? (
                              validarSeguridadSocial(editForm[field]) === true 
                                ? 'border-green-500 focus:ring-green-500 focus:border-green-500' 
                                : validarSeguridadSocial(editForm[field]) === false 
                                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                                  : 'border-gray-200 focus:ring-red-500 focus:border-red-500'
                            ) : 'border-gray-200 focus:ring-red-500 focus:border-red-500'
                          }`}
                          value={editForm[field] || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, [field]: toUpperCaseIfNeeded(field, e.target.value) }))}
                          placeholder="123456789012 (12 cifras)"
                          maxLength="12"
                        />
                        {editForm[field] && editForm[field].trim() !== '' && (
                          <div className="flex items-center gap-2 text-sm">
                            {validarSeguridadSocial(editForm[field]) === true ? (
                              <>
                                <span className="text-green-600">✅</span>
                                <span className="text-green-600 font-medium">Número de Seguridad Social válido</span>
                              </>
                            ) : validarSeguridadSocial(editForm[field]) === false ? (
                              <>
                                <span className="text-red-600">❌</span>
                                <span className="text-red-600 font-medium">Número de Seguridad Social inválido</span>
                              </>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ) : field === 'Nº Cuenta' ? (
                      <div className="space-y-2">
                        <input
                          id={fieldId}
                          name={field}
                          type="text"
                          className={`datos-input ${
                            editForm[field] ? (
                              validarIBAN(editForm[field]) === true 
                                ? 'border-green-500 focus:ring-green-500 focus:border-green-500' 
                                : validarIBAN(editForm[field]) === false 
                                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                                  : 'border-gray-200 focus:ring-red-500 focus:border-red-500'
                            ) : 'border-gray-200 focus:ring-red-500 focus:border-red-500'
                          }`}
                          value={editForm[field] || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, [field]: toUpperCaseIfNeeded(field, e.target.value) }))}
                          placeholder="ES91 2100 0418 4502 0005 1332 (IBAN español)"
                          maxLength="24"
                        />
                        {editForm[field] && editForm[field].trim() !== '' && (
                          <div className="flex items-center gap-2 text-sm">
                            {validarIBAN(editForm[field]) === true ? (
                              <>
                                <span className="text-green-600">✅</span>
                                <span className="text-green-600 font-medium">IBAN español válido</span>
                              </>
                            ) : validarIBAN(editForm[field]) === false ? (
                              <>
                                <span className="text-red-600">❌</span>
                                <span className="text-red-600 font-medium">IBAN español inválido</span>
                              </>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ) : field === 'D.N.I. / NIE' ? (
                      <div className="space-y-2">
                        <input
                          id={fieldId}
                          name={field}
                          type="text"
                          className={`datos-input ${
                            editForm[field] ? (
                              validarDNINIE(editForm[field]) === true 
                                ? 'border-green-500 focus:ring-green-500 focus:border-green-500' 
                                : validarDNINIE(editForm[field]) === false 
                                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                                  : 'border-gray-200 focus:ring-red-500 focus:border-red-500'
                            ) : 'border-gray-200 focus:ring-red-500 focus:border-red-500'
                          }`}
                          value={editForm[field] || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, [field]: toUpperCaseIfNeeded(field, e.target.value) }))}
                          placeholder="12345678A (DNI) sau X1234567A (NIE)"
                          maxLength="9"
                        />
                        {editForm[field] && editForm[field].trim() !== '' && (
                          <div className="flex items-center gap-2 text-sm">
                            {validarDNINIE(editForm[field]) === true ? (
                              <>
                                <span className="text-green-600">✅</span>
                                <span className="text-green-600 font-medium">DNI/NIE español válido</span>
                              </>
                            ) : validarDNINIE(editForm[field]) === false ? (
                              <>
                                <span className="text-red-600">❌</span>
                                <span className="text-red-600 font-medium">DNI/NIE español inválido</span>
                              </>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ) : field === 'FECHA NACIMIENTO' ? (
                      <input
                        id={fieldId}
                        name={field}
                        type="date"
                        className="datos-input"
                        value={editForm[field] ? (() => {
                          const date = editForm[field];
                          // Detectează formatul și convertește la YYYY-MM-DD pentru input type="date"
                          if (date.includes('/')) {
                            const [dd, mm, yyyy] = date.split('/');
                            return `${yyyy}-${mm}-${dd}`;
                          } else if (date.includes('-')) {
                            const [dd, mm, yyyy] = date.split('-');
                            return `${yyyy}-${mm}-${dd}`;
                          }
                          return date;
                        })() : ''}
                        onChange={(e) => {
                          setEditForm(prev => ({ ...prev, [field]: dateInputToDdMmYyyy(e.target.value) }));
                        }}
                      />
                    ) : field === 'FECHA DE ALTA' ? (
                      <input
                        id={fieldId}
                        name={field}
                        type="date"
                        className="datos-input datos-input--readonly"
                        value={editForm[field] ? (() => {
                          const date = editForm[field];
                          // Detectează formatul și convertește la YYYY-MM-DD pentru input type="date"
                          if (date.includes('/')) {
                            const [dd, mm, yyyy] = date.split('/');
                            return `${yyyy}-${mm}-${dd}`;
                          } else if (date.includes('-')) {
                            const [dd, mm, yyyy] = date.split('-');
                            return `${yyyy}-${mm}-${dd}`;
                          }
                          return date;
                        })() : ''}
                        readOnly={true}
                        placeholder="fecha de alta (solo lectura)"
                      />
                    ) : field === 'FECHA BAJA' ? (
                      <input
                        id={fieldId}
                        name={field}
                        type="date"
                        className="datos-input datos-input--readonly"
                        value={editForm[field] ? (() => {
                          const date = editForm[field];
                          // Detectează formatul și convertește la YYYY-MM-DD pentru input type="date"
                          if (date.includes('/')) {
                            const [dd, mm, yyyy] = date.split('/');
                            return `${yyyy}-${mm}-${dd}`;
                          } else if (date.includes('-')) {
                            const [dd, mm, yyyy] = date.split('-');
                            return `${yyyy}-${mm}-${dd}`;
                          }
                          return date;
                        })() : ''}
                        readOnly={true}
                        placeholder="fecha baja (solo lectura)"
                      />
                    ) : field === 'CENTRO TRABAJO' ? (
                      <select
                        id={fieldId}
                        name={field}
                        className="datos-input datos-input--readonly"
                        value={editForm[field] || ''}
                        readOnly={true}
                        disabled={true}
                      >
                        <option value="">Centro de trabajo (solo lectura)</option>
                        {clientes.map(cliente => (
                          <option key={cliente.NIF} value={cliente['NOMBRE O RAZON SOCIAL']}>
                            {cliente['NOMBRE O RAZON SOCIAL']}
                          </option>
                        ))}
                      </select>
                    ) : field === 'EMPRESA' ? (
                      <input
                        id={fieldId}
                        name={field}
                        type="text"
                        className="datos-input datos-input--readonly"
                        value={editForm[field] || (import.meta.env.VITE_COMPANY_NAME || import.meta.env.VITE_APP_NAME || '')}
                        readOnly={true}
                        placeholder={`${field.toLowerCase()} (solo lectura)`}
                      />
                    ) : field === 'ESTADO' ? (
                      <input
                        id={fieldId}
                        name={field}
                        type="text"
                        className="datos-input datos-input--readonly"
                        value={editForm[field] || ''}
                        readOnly={true}
                        placeholder="estado (solo lectura)"
                      />
                    ) : field === 'GRUPO' || field === 'Fecha Antigüedad' || field === 'Antigüedad' ? (
                      <input
                        id={fieldId}
                        name={field}
                        type="text"
                        className="datos-input datos-input--readonly"
                        value={editForm[field] || ''}
                        readOnly={true}
                        placeholder={`${field.toLowerCase()} (solo lectura)`}
                      />
                    ) : field === 'TIPO DE CONTRATO' || field === 'SUELDO BRUTO MENSUAL' || field === 'HORAS DE CONTRATO' ? (
                      <input
                        id={fieldId}
                        name={field}
                        type="text"
                        className="datos-input datos-input--readonly"
                        value={editForm[field] || ''}
                        readOnly={true}
                        placeholder={`${field.toLowerCase()} (solo lectura)`}
                      />
                    ) : field === 'DerechoPedidos' ? (
                      <select
                        id={fieldId}
                        name={field}
                        className="datos-input datos-input--readonly"
                        value={editForm[field] || ''}
                        onChange={() => {}}
                        disabled
                        readOnly
                      >
                        <option value="SI">Sí</option>
                        <option value="NO">No</option>
                      </select>
                    ) : field === 'TrabajaFestivos' ? (
                      <select
                        id={fieldId}
                        name={field}
                        className="datos-input datos-input--readonly"
                        value={editForm[field] || ''}
                        onChange={() => {}}
                        disabled
                        readOnly
                      >
                        <option value="SI">Sí</option>
                        <option value="NO">No</option>
                      </select>
                    ) : field === 'NOMBRE / APELLIDOS' ? (
                      <div className="space-y-3">
                        <input
                          id={fieldId}
                          name={field}
                          type="text"
                          className="datos-input"
                          value={editForm[field] || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, [field]: toUpperCaseIfNeeded(field, e.target.value) }))}
                          placeholder="Ingresa nombre completo..."
                        />
                        {/* Campos separados si existen */}
                        {(editForm?.NOMBRE || editForm?.APELLIDO1 || editForm?.APELLIDO2) && (
                          <div className="mt-3 p-3 border border-gray-200 rounded-lg space-y-2 bg-gray-50 dark:bg-gray-800">
                            <div>
                              <label className="datos-field__label">Nombre</label>
                              <input
                                type="text"
                                className="datos-input text-sm"
                                value={editForm.NOMBRE || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, NOMBRE: toUpperCaseIfNeeded('NOMBRE', e.target.value) }))}
                                placeholder="Nombre"
                              />
                            </div>
                            <div>
                              <label className="datos-field__label">Primer Apellido</label>
                              <input
                                type="text"
                                className="datos-input text-sm"
                                value={editForm.APELLIDO1 || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, APELLIDO1: toUpperCaseIfNeeded('APELLIDO1', e.target.value) }))}
                                placeholder="Primer Apellido"
                              />
                            </div>
                            <div>
                              <label className="datos-field__label">Segundo Apellido</label>
                              <input
                                type="text"
                                className="datos-input text-sm"
                                value={editForm.APELLIDO2 || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, APELLIDO2: toUpperCaseIfNeeded('APELLIDO2', e.target.value) }))}
                                placeholder="Segundo Apellido"
                              />
                            </div>
                            {editForm.NOMBRE_SPLIT_CONFIANZA !== undefined && (
                              <div>
                                <label className="datos-field__label">Confianza del Split</label>
                                <p className="datos-field__value text-xs">
                                  {editForm.NOMBRE_SPLIT_CONFIANZA === 2 ? 'Confiado' : editForm.NOMBRE_SPLIT_CONFIANZA === 1 ? 'Incierto' : 'Fallido'}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        id={fieldId}
                        name={field}
                        type="text"
                        className="datos-input"
                        value={editForm[field] || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, [field]: toUpperCaseIfNeeded(field, e.target.value) }))}
                        placeholder={`Ingresa ${field.toLowerCase()}...`}
                      />
                    )}
                  </div>
                  );
                })}
              </div>
              
              <div className="mt-4">
                <AlertBanner variant="warning" title="Motivo de la Modificación (Obligatorio)">
                  <textarea
                    id="edit-motivo"
                    name="motivo"
                    ref={motivoRef}
                    className="datos-input mt-2 min-h-[5.5rem] resize-none"
                    value={motivo}
                    onChange={(e) => {
                      setMotivo(e.target.value);
                      if (editError) setEditError('');
                    }}
                    placeholder="Explica el motivo de la modificación de datos..."
                    rows={3}
                    enterKeyHint="done"
                  />
                </AlertBanner>
              </div>
            </div>

            <div className="datos-edit-panel__footer">
              {editError && <AlertBanner variant="danger" className="mb-3">{editError}</AlertBanner>}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="datos-btn order-2 sm:order-1"
                >
                  Cancelar
                </button>
                <button
                type="button"
                onClick={async () => {
                  // iOS/Android: citește din DOM — ultimele taste pot să nu fie încă în state
                  const motivoValue = String(
                    motivoRef.current?.value ?? motivo ?? '',
                  ).trim();
                  if (!motivoValue) {
                    setEditError('¡El motivo de la modificación es obligatorio!');
                    motivoRef.current?.focus();
                    return;
                  }
                  setMotivo(motivoValue);
                  
                  setEditLoading(true);
                  setEditError('');
                  
                  try {
                                         // Genero ID único
                    const generateUniqueId = () => {
                      const timestamp = Date.now();
                      const random = Math.random().toString(36).substr(2, 9);
                      return `CAMBIO_${timestamp}_${random}`;
                    };
                    
                                         // Encuentro los campos modificados
                     const camposModificados = [];
                     const valoresAnteriores = {};
                     const valoresNuevos = {};
                     
                     Object.keys(editForm).forEach(key => {
                       if (editForm[key] !== user[key]) {
                         camposModificados.push(key);
                         valoresAnteriores[key] = user[key];
                         valoresNuevos[key] = editForm[key];
                       }
                     });
                     
                     // Datos para aprobación
                     const cambioData = {
                       ID: generateUniqueId(),
                       CODIGO: editForm['CODIGO'],
                       CORREO_ELECTRONICO: editForm['CORREO ELECTRONICO'],
                       NOMBRE: editForm['NOMBRE / APELLIDOS'],
                       // Campos separados si existen
                       NOMBRE_SEPARADO: editForm.NOMBRE || '',
                       APELLIDO1: editForm.APELLIDO1 || '',
                       APELLIDO2: editForm.APELLIDO2 || '',
                       NOMBRE_SPLIT_CONFIANZA: editForm.NOMBRE_SPLIT_CONFIANZA !== undefined ? editForm.NOMBRE_SPLIT_CONFIANZA : undefined,
                       CAMPO_MODIFICADO: camposModificados.join(', '),
                       VALOR_ANTERIOR: Object.values(valoresAnteriores).join(', '),
                       VALOR_NUEVO: Object.values(valoresNuevos).join(', '),
                       MOTIVO_CAMBIO: motivoValue,
                       FECHA_SOLICITUD: new Date().toISOString(),
                       FECHA_APROBACION: new Date().toISOString(),
                       ESTADO: 'pendiente'
                     };
                    
                    // Folosim backend-ul nou (fără n8n)
                    const token = localStorage.getItem('auth_token');
                    const headers = {
                      'Content-Type': 'application/json',
                      'X-App-Source': (config.APP_NAME || config.COMPANY_NAME || 'Web-App').replace(/\s+/g, '-'),
                      'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
                      'X-Client-Type': 'web-browser',
                      'User-Agent': (config.APP_NAME || config.COMPANY_NAME || 'Web-Client') + '/1.0'
                    };
                    
                    if (token) {
                      headers['Authorization'] = `Bearer ${token}`;
                    }
                    
                    const res = await fetch(routes.cambioAprobacion, {
                      method: 'POST',
                      headers: headers,
                      body: JSON.stringify(cambioData)
                    });
                    
                    if (!res.ok) {
                      const errorText = await res.text();
                      console.error('❌ Error response:', errorText);
                      throw new Error('Error al enviar para aprobación!');
                    }
                    
                    const result = await res.json();
                    if (!result.success) {
                      throw new Error('Error al enviar para aprobación!');
                    }
                    
                    setShowEdit(false);
                    setMotivo('');
                    setNotification({
                      type: 'success',
                      title: '¡Éxito!',
                      message: '¡Las modificaciones han sido enviadas para aprobación!'
                    });
                  } catch {
                    setEditError('Error al enviar para aprobación!');
                  }
                  setEditLoading(false);
                }}
                disabled={editLoading}
                  className="datos-btn datos-btn--primary order-1 sm:order-2"
              >
                  {editLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Enviando...
                    </span>
                  ) : (
                    'Enviar para Aprobación'
                  )}
              </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {typeof document !== 'undefined' && createPortal(
      <Modal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        title="Cambiar Foto de Perfil"
        showCloseButton={false}
        size="sm"
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              fileInputRef.current?.click();
              setShowImageModal(false);
            }}
            className="datos-image-option"
          >
            <ImageIcon className="w-5 h-5 text-gray-600" aria-hidden />
            <div>
              <div className="datos-image-option__title">Elegir de Galería</div>
              <div className="datos-image-option__sub">Seleccionar foto existente</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              cameraInputRef.current?.click();
              setShowImageModal(false);
            }}
            className="datos-image-option"
          >
            <Camera className="w-5 h-5 text-gray-600" aria-hidden />
            <div>
              <div className="datos-image-option__title">Hacer Foto</div>
              <div className="datos-image-option__sub">Tomar nueva foto con cámara</div>
            </div>
          </button>
        </div>
      </Modal>,
      document.body
      )}

      {/* Input-uri ascunse */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleImageUpload}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        capture="environment"
        onChange={handleImageUpload}
        className="hidden"
      />

      {typeof document !== 'undefined' && createPortal(
      <Modal
        isOpen={showDeleteConfirm}
        onClose={closeDeleteConfirm}
        title="Eliminar Foto"
        showCloseButton={false}
        size="sm"
        footer={(
          <div className="app-modal__actions">
            <button type="button" onClick={closeDeleteConfirm} className="app-modal__btn">
              Cancelar
            </button>
            <button
              type="button"
              onClick={deleteProfileImage}
              disabled={imageLoading}
              className="app-modal__btn datos-btn datos-btn--danger"
            >
              {imageLoading ? 'Eliminando...' : 'Sí, Eliminar'}
            </button>
          </div>
        )}
      >
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Vas a eliminar permanentemente tu foto de perfil. Esta acción no se puede deshacer.
        </p>
        {(user?.AVATAR || user?.avatar) && (
          <div className="flex justify-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <img
              src={user?.AVATAR || user?.avatar}
              alt="Avatar actual"
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
            />
          </div>
        )}
      </Modal>,
      document.body
      )}

      {typeof document !== 'undefined' && createPortal(
      <Modal
          isOpen={showChangePasswordModal}
          className="app-modal--form datos-password-modal"
          onClose={() => {
            setShowChangePasswordModal(false);
            setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
            setPasswordError('');
            setShowPasswords({ oldPassword: false, newPassword: false, confirmPassword: false });
          }}
          title="Cambiar Contraseña"
          showCloseButton={false}
          footer={(
            <div className="app-modal__actions">
              <button
                type="button"
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordError('');
                }}
                disabled={changingPassword}
                className="app-modal__btn"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="app-modal__btn app-modal__btn--primary"
              >
                {changingPassword ? 'Cambiando...' : 'Cambiar Contraseña'}
              </button>
            </div>
          )}
        >
          <div className="space-y-4">
            {passwordError && <AlertBanner variant="danger">{passwordError}</AlertBanner>}
            
            <div>
              <label className="datos-field__label">Contraseña Actual</label>
              <div className="relative">
                <Input
                  type={showPasswords.oldPassword ? 'text' : 'password'}
                  value={passwordForm.oldPassword}
                  onChange={(e) => {
                    setPasswordForm({ ...passwordForm, oldPassword: e.target.value });
                    setPasswordError('');
                  }}
                  placeholder="Ingresa tu contraseña actual"
                  className="datos-input w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, oldPassword: !showPasswords.oldPassword })}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  {showPasswords.oldPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            
            <div>
              <label className="datos-field__label">Nueva Contraseña</label>
              <div className="relative">
                <Input
                  type={showPasswords.newPassword ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => {
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value });
                    setPasswordError('');
                  }}
                  placeholder="Mínimo 9 caracteres (12 recomendado)"
                  className="datos-input w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, newPassword: !showPasswords.newPassword })}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  {showPasswords.newPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <AlertBanner variant="info" title="Condiciones de seguridad requeridas" compact>
                <ul className="text-xs space-y-1.5">
                  <li className="flex items-center gap-2">
                    <span className={`flex-shrink-0 ${passwordForm.newPassword.length >= 9 ? 'text-green-600' : 'text-gray-400'}`}>
                      {passwordForm.newPassword.length >= 9 ? '✅' : '○'}
                    </span>
                    <span className={passwordForm.newPassword.length >= 9 ? 'text-green-700 font-medium' : ''}>
                      Mínimo 9 caracteres {passwordForm.newPassword.length >= 12 ? '(12 recomendado ✓)' : '(12 recomendado)'}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={`flex-shrink-0 ${/[A-Z]/.test(passwordForm.newPassword) ? 'text-green-600' : 'text-gray-400'}`}>
                      {/[A-Z]/.test(passwordForm.newPassword) ? '✅' : '○'}
                    </span>
                    <span className={/[A-Z]/.test(passwordForm.newPassword) ? 'text-green-700 font-medium' : ''}>
                      Al menos 1 letra mayúscula (A-Z)
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={`flex-shrink-0 ${/[a-z]/.test(passwordForm.newPassword) ? 'text-green-600' : 'text-gray-400'}`}>
                      {/[a-z]/.test(passwordForm.newPassword) ? '✅' : '○'}
                    </span>
                    <span className={/[a-z]/.test(passwordForm.newPassword) ? 'text-green-700 font-medium' : ''}>
                      Al menos 1 letra minúscula (a-z)
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={`flex-shrink-0 ${/[0-9]/.test(passwordForm.newPassword) ? 'text-green-600' : 'text-gray-400'}`}>
                      {/[0-9]/.test(passwordForm.newPassword) ? '✅' : '○'}
                    </span>
                    <span className={/[0-9]/.test(passwordForm.newPassword) ? 'text-green-700 font-medium' : ''}>
                      Al menos 1 número (0-9)
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={`flex-shrink-0 ${/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(passwordForm.newPassword) ? 'text-green-600' : 'text-gray-400'}`}>
                      {/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(passwordForm.newPassword) ? '✅' : '○'}
                    </span>
                    <span className={/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(passwordForm.newPassword) ? 'text-green-700 font-medium' : ''}>
                      Al menos 1 carácter especial (! @ # $ % ^ & * ( ) _ + - =)
                    </span>
                  </li>
                </ul>
              </AlertBanner>
            </div>
            
            <div>
              <label className="datos-field__label">Confirmar Nueva Contraseña</label>
              <div className="relative">
                <Input
                  type={showPasswords.confirmPassword ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => {
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value });
                    setPasswordError('');
                  }}
                  placeholder="Confirma tu nueva contraseña"
                  className="datos-input w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirmPassword: !showPasswords.confirmPassword })}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  {showPasswords.confirmPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Modal>,
        document.body
      )}

      {/* Componenta de Notificări */}
      {notification && (
        <Notification
          type={notification.type}
          title={notification.title}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
    </>
  );
} 