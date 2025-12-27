import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { routes } from '../utils/routes.js';
import { fetchAvatarOnce, getCachedAvatar, setCachedAvatar, clearAvatarCacheFor, DEFAULT_AVATAR } from '../utils/avatarCache';
import { Notification } from '../components/ui';
import Edit3DButton from '../components/Edit3DButton.jsx';
import Back3DButton from '../components/Back3DButton.jsx';
import { useLoadingState } from '../hooks/useLoadingState';

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

export default function DatosPage() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState(null);
  const [uiReady, setUiReady] = useState(false); // decuplează percepția UI de fetch
  const [error, setError] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState('');
  const [motivo, setMotivo] = useState('');
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

  const renderPermissionBadge = (value, { positiveLabel = 'Sí', negativeLabel = 'No', positiveIcon = '✅', negativeIcon = '🚫' } = {}) => {
    // Log pentru debugging
    console.log('🔍 [renderPermissionBadge] Input value:', value, 'type:', typeof value);
    
    const interpreted = normalizeYesNoValue(value);
    console.log('🔍 [renderPermissionBadge] After normalizeYesNoValue:', interpreted, 'type:', typeof interpreted);

    // Handle null, undefined, or empty string (including whitespace-only strings)
    if (interpreted === null || interpreted === undefined || interpreted === '' || (typeof interpreted === 'string' && interpreted.trim() === '')) {
      console.log('🔍 [renderPermissionBadge] Returning "-" for empty/null value');
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border border-gray-200 bg-gray-50 text-gray-500">
          -
        </span>
      );
    }

    if (interpreted === 'SI') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold border border-green-200 bg-green-50 text-green-700">
          <span>{positiveIcon}</span>
          {positiveLabel}
        </span>
      );
    }

    if (interpreted === 'NO') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold border border-red-200 bg-red-50 text-red-600">
          <span>{negativeIcon}</span>
          {negativeLabel}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border border-blue-200 bg-blue-50 text-blue-700">
        {value}
      </span>
    );
  };

  // Skeleton UI pentru percepție rapidă la încărcare
  const renderSkeleton = () => (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-200" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-48 bg-gray-200 rounded" />
            <div className="h-4 w-64 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-10 rounded bg-gray-100" />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-gray-100" />
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
    
    try {
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
        'X-App-Source': 'DeCamino-Web-App',
        'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
        'X-Client-Type': 'web-browser',
        'User-Agent': 'DeCamino-Web-Client/1.0'
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
        setUser(prev => ({
          ...mappedUser,
          AVATAR: prev?.AVATAR || null,
          avatar: prev?.avatar || null
        }));
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
    } catch (e) {
      setError('No se pudieron cargar los datos del usuario.');
    } finally {
      setOperationLoading('user', false);
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
      <div className="flex-1 flex justify-center items-center bg-gray-50 min-h-screen">
        <p className="text-red-600 font-bold text-xl">{error}</p>
      </div>
    );
  }

  if (!user) {
    return renderSkeleton();
  }

  return (
    <>
    <div className="space-y-6">
      {/* Header moderno */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Back3DButton to="/inicio" title="Regresar al Dashboard" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Datos Personales
            </h1>
            <p className="text-gray-600 dark:text-white text-sm sm:text-base">
              Información completa del empleado
            </p>
          </div>
        </div>
        
        {user && (
          <Edit3DButton
            onClick={() => { setEditForm(user); setShowEdit(true); setMotivo(''); }}
            size="md"
            className="hidden sm:inline-flex"
          >
            Editar datos
          </Edit3DButton>
        )}
        
        {user && (
          <Edit3DButton
            onClick={() => { setEditForm(user); setShowEdit(true); setMotivo(''); }}
            size="sm"
            className="sm:hidden"
          >
            Editar
          </Edit3DButton>
        )}
      </div>

      {user ? (
        <div>
          {/* Tarjeta de perfil principal */}
          <div className="card">
            {/* Desktop layout */}
            <div className="hidden md:flex items-start gap-6">
              <div className="flex-shrink-0">
                <div className="relative group mb-3">
                    <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg overflow-hidden">
                      {(imagePreview || user?.AVATAR || user?.avatar) ? (
                        <img 
                          src={imagePreview || user?.AVATAR || user?.avatar} 
                          alt="Foto de perfil" 
                          className="w-full h-full object-cover"
                        />
                      ) : user?.isDemo ? (
                        <img 
                          src="/DeCamino-04.svg" 
                          alt="Avatar DEMO" 
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <span className="text-white text-2xl font-bold">
                          {(user['NOMBRE / APELLIDOS'] || '').split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      )}
                  </div>
                  {/* Overlay pentru upload */}
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                       onClick={() => setShowImageModal(true)}>
                    <span className="text-white text-xs font-medium text-center px-2">
                      📷<br/>Cambiar
                    </span>
                  </div>
                </div>
                
                {/* Buton mic pentru eliminarea avatarului */}
                {(() => {
                  const hasAvatar = (imagePreview || user?.AVATAR || user?.avatar);
                  const noProfileImage = !user?.isDemo;
                  return hasAvatar && noProfileImage;
                })() && (
                  <button
                    onClick={deleteAvatar}
                    disabled={deletingAvatar}
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xs font-medium py-2 px-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {deletingAvatar ? (
                      <span className="flex items-center justify-center gap-1">
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                        Eliminando...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1">
                        🗑️
                        Eliminar Foto Perfil
                      </span>
                    )}
                  </button>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {user['NOMBRE / APELLIDOS'] || 'Sin nombre'}
                </h2>
                <p className="text-gray-600 mb-3">
                  {user['CORREO ELECTRONICO'] || 'Sin email'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {user['GRUPO'] && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-200">
                      👤 {user['GRUPO']}
                    </span>
                  )}
                  {user['ESTADO'] && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
                      ✅ {user['ESTADO']}
                    </span>
                  )}
                  {user['CENTRO TRABAJO'] && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
                      🏢 {user['CENTRO TRABAJO']}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile layout - vertical și compact */}
            <div className="md:hidden">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0">
                  <div className="relative group mb-2">
                    <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg overflow-hidden">
                      {(imagePreview || user?.AVATAR || user?.avatar) ? (
                        <img 
                          src={imagePreview || user?.AVATAR || user?.avatar} 
                          alt="Foto de perfil" 
                          className="w-full h-full object-cover"
                        />
                      ) : user?.isDemo ? (
                        <img 
                          src="/DeCamino-04.svg" 
                          alt="Avatar DEMO" 
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <span className="text-white text-lg font-bold">
                          {(user['NOMBRE / APELLIDOS'] || '').split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      )}
                    </div>
                    {/* Overlay pentru upload pe mobile - always visible */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowImageModal(true);
                      }}
                      className="absolute inset-0 bg-black bg-opacity-40 rounded-full flex items-center justify-center transition-opacity duration-200 cursor-pointer touch-manipulation"
                      type="button"
                      aria-label="Cambiar foto de perfil"
                    >
                      <span className="text-white text-xs font-medium text-center px-1">
                        📷
                      </span>
                    </button>
                  </div>
                  
                  {/* Buton mic pentru eliminarea avatarului pe mobile */}
                  {(() => {
                    const hasAvatar = (imagePreview || user?.AVATAR || user?.avatar);
                    const noProfileImage = !user?.isDemo;
                    return hasAvatar && noProfileImage;
                  })() && (
                    <button
                      onClick={deleteAvatar}
                      disabled={deletingAvatar}
                      className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xs font-medium py-1.5 px-2 rounded-md shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {deletingAvatar ? (
                        <span className="flex items-center justify-center gap-1">
                          <div className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin"></div>
                          Eliminando...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1">
                          🗑️
                          Eliminar
                        </span>
                      )}
                    </button>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 truncate">
                    {user['NOMBRE / APELLIDOS'] || 'Sin nombre'}
                  </h2>
                  <p className="text-sm text-gray-600 truncate">
                    {user['CORREO ELECTRONICO'] || 'Sin email'}
                  </p>
                </div>
              </div>
              
              {/* Badges pe rânduri separate pe mobile */}
              <div className="space-y-2">
                {user['GRUPO'] && (
                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-200 w-full justify-center">
                      👤 {user['GRUPO']}
                    </span>
                  </div>
                )}
                {user['ESTADO'] && (
                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200 w-full justify-center">
                      ✅ {user['ESTADO']}
                    </span>
                  </div>
                )}
                {user['CENTRO TRABAJO'] && (
                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200 w-full justify-center">
                      🏢 {user['CENTRO TRABAJO']}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Secțiunea pentru gestionarea pozei de profil */}
          {profileImage && (
            <div className="card">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>📷</span>
                Foto de Perfil
              </h3>
              
              <div className="space-y-4">
                {/* Preview poza */}
                <div className="flex justify-center">
                  <div className="relative">
                    <img 
                      src={imagePreview} 
                      alt="Vista previa" 
                      className="w-32 h-32 rounded-full object-cover shadow-lg border-4 border-white"
                      key={profileImage?.name || 'default'} // Force re-render when image changes
                    />
                    <button
                      onClick={handleImageRemove}
                      className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Informații despre fișier */}
                <div className="text-center text-sm text-gray-600">
                  <p><strong>Archivo:</strong> {profileImage.name}</p>
                  <p><strong>Tamaño:</strong> {(profileImage.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>

                {/* Mesaj de validare */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-yellow-600 text-lg">⚠️</span>
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium mb-1">Recomendaciones para la foto:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Usa una foto de perfil profesional</li>
                        <li>Mira directamente a la cámara</li>
                        <li>Fondo neutro o desenfocado</li>
                        <li>Buena iluminación</li>
                        <li>Formato vertical (retrato)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Erori */}
                {imageError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-800 text-sm">{imageError}</p>
                  </div>
                )}

                {/* Butoane de acțiune */}
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleImageRemove}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveProfileImage}
                    disabled={imageLoading}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
                  >
                    {imageLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {user?.AVATAR || user?.avatar ? 'Actualizando...' : 'Guardando...'}
                      </>
                    ) : (
                      <>
                        <span>{user?.AVATAR || user?.avatar ? '✏️' : '💾'}</span>
                        {user?.AVATAR || user?.avatar ? 'Editar Foto' : 'Guardar Foto'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Información personal */}
            <div className="card">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>📋</span>
              Información Personal
              </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">🆔 Código</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user.CODIGO || '-'}</p>
                  </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">👤 Nombre Completo</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user['NOMBRE / APELLIDOS'] || '-'}</p>
                  </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">🌍 Nacionalidad</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user.NACIONALIDAD || '-'}</p>
                </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">🏠 Dirección</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user.DIRECCION || '-'}</p>
                </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">📄 DNI/NIE</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user['D.N.I. / NIE'] || '-'}</p>
                </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">🏥 Seguridad Social</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user['SEG. SOCIAL'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">💳 Nº Cuenta</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user['Nº Cuenta'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">📞 Telefono</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user.TELEFONO || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">📧 Email</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user['CORREO ELECTRONICO'] || '-'}</p>
              </div>
              </div>
            </div>

          {/* Información laboral */}
            <div className="card">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>💼</span>
                Información Laboral
              </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">📅 Fecha de Nacimiento</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user['FECHA NACIMIENTO'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">📅 Fecha de Alta</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user['FECHA DE ALTA'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">🏢 Centro de Trabajo</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user['CENTRO TRABAJO'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">📋 Tipo de Contrato</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user['TIPO DE CONTRATO'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">💰 Sueldo Bruto Mensual</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user['SUELDO BRUTO MENSUAL'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">⏰ Horas de Contrato</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user['HORAS DE CONTRATO'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">🏢 Empresa</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user.EMPRESA || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">👥 Grupo</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user.GRUPO || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">📊 Estado</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user.ESTADO || '-'}</p>
              </div>
              {user['FECHA BAJA'] && (
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">🚪 Fecha Baja</label>
                  <p className="text-gray-900 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{user['FECHA BAJA']}</p>
                </div>
              )}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">📆 Fecha Antiguedad</label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user['Fecha Antigüedad'] || '-'}</p>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">🎯 Antiguedad</label>
                <p className="text-gray-900 bg-green-50 px-3 py-2 rounded-lg border border-green-200 font-semibold">
                  {calcularAntiguedad(user['Fecha Antigüedad'], user['FECHA BAJA']) || '-'}
                </p>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">🛒 Derecho a Pedidos</label>
                <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                  {renderPermissionBadge(user.DerechoPedidos, { positiveLabel: 'Sí', negativeLabel: 'No', positiveIcon: '✅', negativeIcon: '🚫' })}
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">🎉 Trabaja Festivos</label>
                <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                  {renderPermissionBadge(user.TrabajaFestivos, { positiveLabel: 'Sí', negativeLabel: 'No', positiveIcon: '🎉', negativeIcon: '🚫' })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex justify-center items-center bg-gray-50 min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-2xl">❌</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No se pudo cargar el usuario</h3>
            <p className="text-gray-600">Verifica tu conexión e intenta nuevamente</p>
          </div>
        </div>
      )}

      {/* Modal modernizado para editar */}
      {showEdit && editForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden shadow-2xl border border-gray-200 animate-in fade-in duration-300">
            {/* Header moderno */}
            <div className="bg-gradient-to-r from-red-50 to-red-100 px-6 py-4 border-b border-red-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl">✏️</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Editar Datos Personales
                    </h2>
                    <p className="text-sm text-red-600 font-medium">Actualización de información del empleado</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEdit(false)}
                  className="w-10 h-10 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-300 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg group"
                >
                  <span className="text-gray-400 group-hover:text-red-500 text-xl">✕</span>
                </button>
              </div>
            </div>
            
            {/* Content modernizado */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {SHEET_FIELDS.map(field => {
                  const fieldId = `edit-${field.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
                  return (
                  <div key={field} className="space-y-2">
                    <label htmlFor={fieldId} className="block text-sm font-bold text-gray-700 mb-2">
                      {field === 'CODIGO' && '🆔'} 
                      {field === 'NOMBRE / APELLIDOS' && '👤'} 
                      {field === 'CORREO ELECTRONICO' && '📧'} 
                      {field === 'NACIONALIDAD' && '🌍'} 
                      {field === 'DIRECCION' && '🏠'} 
                      {field === 'D.N.I. / NIE' && '📄'} 
                      {field === 'SEG. SOCIAL' && '🏥'} 
                      {field === 'Nº Cuenta' && '💳'} 
                      {field}
                    </label>
                    
                    {field === 'CODIGO' ? (
                      <div id={fieldId} className="bg-gray-100 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium" role="textbox" aria-label={field}>
                        {editForm[field] || '-'}
                      </div>
                    ) : field === 'NACIONALIDAD' ? (
                      <select
                        id={fieldId}
                        name={field}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 hover:border-gray-300"
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
                          className={`w-full px-4 py-3 border-2 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 transition-all duration-200 ${
                            editForm[field] ? (
                              validarSeguridadSocial(editForm[field]) === true 
                                ? 'border-green-500 focus:ring-green-500 focus:border-green-500' 
                                : validarSeguridadSocial(editForm[field]) === false 
                                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                                  : 'border-gray-200 focus:ring-red-500 focus:border-red-500'
                            ) : 'border-gray-200 focus:ring-red-500 focus:border-red-500'
                          }`}
                          value={editForm[field] || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
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
                          className={`w-full px-4 py-3 border-2 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 transition-all duration-200 ${
                            editForm[field] ? (
                              validarIBAN(editForm[field]) === true 
                                ? 'border-green-500 focus:ring-green-500 focus:border-green-500' 
                                : validarIBAN(editForm[field]) === false 
                                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                                  : 'border-gray-200 focus:ring-red-500 focus:border-red-500'
                            ) : 'border-gray-200 focus:ring-red-500 focus:border-red-500'
                          }`}
                          value={editForm[field] || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
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
                          className={`w-full px-4 py-3 border-2 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 transition-all duration-200 ${
                            editForm[field] ? (
                              validarDNINIE(editForm[field]) === true 
                                ? 'border-green-500 focus:ring-green-500 focus:border-green-500' 
                                : validarDNINIE(editForm[field]) === false 
                                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                                  : 'border-gray-200 focus:ring-red-500 focus:border-red-500'
                            ) : 'border-gray-200 focus:ring-red-500 focus:border-red-500'
                          }`}
                          value={editForm[field] || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
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
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 hover:border-gray-300"
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
                          const [yyyy, mm, dd] = e.target.value.split('-');
                          setEditForm(prev => ({ ...prev, [field]: `${dd}/${mm}/${yyyy}` }));
                        }}
                      />
                    ) : field === 'FECHA DE ALTA' ? (
                      <input
                        id={fieldId}
                        name={field}
                        type="date"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 cursor-not-allowed"
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
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 cursor-not-allowed"
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
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 cursor-not-allowed"
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
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 cursor-not-allowed"
                        value={editForm[field] || 'DE CAMINO SERVICIOS AUXILIARES SL'}
                        readOnly={true}
                        placeholder={`${field.toLowerCase()} (solo lectura)`}
                      />
                    ) : field === 'ESTADO' ? (
                      <input
                        id={fieldId}
                        name={field}
                        type="text"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 cursor-not-allowed"
                        value={editForm[field] || ''}
                        readOnly={true}
                        placeholder="estado (solo lectura)"
                      />
                    ) : field === 'GRUPO' || field === 'Fecha Antigüedad' || field === 'Antigüedad' ? (
                      <input
                        id={fieldId}
                        name={field}
                        type="text"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 cursor-not-allowed"
                        value={editForm[field] || ''}
                        readOnly={true}
                        placeholder={`${field.toLowerCase()} (solo lectura)`}
                      />
                    ) : field === 'TIPO DE CONTRATO' || field === 'SUELDO BRUTO MENSUAL' || field === 'HORAS DE CONTRATO' ? (
                      <input
                        id={fieldId}
                        name={field}
                        type="text"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 cursor-not-allowed"
                        value={editForm[field] || ''}
                        readOnly={true}
                        placeholder={`${field.toLowerCase()} (solo lectura)`}
                      />
                    ) : field === 'DerechoPedidos' ? (
                      <select
                        id={fieldId}
                        name={field}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 cursor-not-allowed"
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
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 cursor-not-allowed"
                        value={editForm[field] || ''}
                        onChange={() => {}}
                        disabled
                        readOnly
                      >
                        <option value="SI">Sí</option>
                        <option value="NO">No</option>
                      </select>
                    ) : (
                      <input
                        id={fieldId}
                        name={field}
                        type="text"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 hover:border-gray-300"
                        value={editForm[field] || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder={`Ingresa ${field.toLowerCase()}...`}
                      />
                    )}
                  </div>
                  );
                })}
              </div>
              
              {/* Câmp Motivo - Destacat */}
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <label htmlFor="edit-motivo" className="block text-sm font-bold text-yellow-800 mb-2">
                  ⚠️ Motivo de la Modificación (Obligatorio)
                </label>
                <textarea
                  id="edit-motivo"
                  name="motivo"
                  className="w-full px-4 py-3 border-2 border-yellow-300 rounded-xl text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all duration-200 hover:border-yellow-400 resize-none"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Explica el motivo de la modificación de datos..."
                  rows="3"
                />
              </div>
            </div>
            
            {/* Footer con botones modernos */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              {editError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-red-600 text-sm font-medium text-center">⚠️ {editError}</p>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button
                  onClick={() => setShowEdit(false)}
                  className="group relative w-full sm:w-auto px-6 py-4 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 border border-gray-300 hover:border-gray-400"
                >
                  <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                  <div className="relative flex items-center justify-center gap-3">
                    <span className="text-xl group-hover:rotate-90 transition-transform duration-300">✕</span>
                    <span className="text-sm sm:text-base">Cancelar</span>
                  </div>
                </button>
                
                <button
                onClick={async () => {
                  if (!motivo.trim()) {
                    setEditError('¡El motivo de la modificación es obligatorio!');
                    return;
                  }
                  
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
                       CAMPO_MODIFICADO: camposModificados.join(', '),
                       VALOR_ANTERIOR: Object.values(valoresAnteriores).join(', '),
                       VALOR_NUEVO: Object.values(valoresNuevos).join(', '),
                       MOTIVO_CAMBIO: motivo,
                       FECHA_SOLICITUD: new Date().toISOString(),
                       FECHA_APROBACION: new Date().toISOString(),
                       ESTADO: 'pendiente'
                     };
                    
                    // Folosim backend-ul nou (fără n8n)
                    const token = localStorage.getItem('auth_token');
                    const headers = {
                      'Content-Type': 'application/json',
                      'X-App-Source': 'DeCamino-Web-App',
                      'X-App-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
                      'X-Client-Type': 'web-browser',
                      'User-Agent': 'DeCamino-Web-Client/1.0'
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
                  } catch (e) {
                    setEditError('Error al enviar para aprobación!');
                  }
                  setEditLoading(false);
                }}
                disabled={editLoading}
                  className="group relative w-full sm:w-auto px-6 py-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-xl hover:shadow-2xl bg-gradient-to-r from-red-500 via-red-600 to-red-700 text-white border border-red-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {!editLoading && (
                    <>
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-400 to-red-500 opacity-40 blur-lg animate-pulse group-hover:opacity-60 transition-all duration-300"></div>
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                    </>
                  )}
                  <div className="relative flex items-center justify-center gap-3">
                    {editLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                        <span className="text-sm sm:text-base">Enviando...</span>
                    </>
                  ) : (
                    <>
                        <span className="text-xl group-hover:translate-x-1 transition-transform duration-300">🚀</span>
                        <span className="text-sm sm:text-base">Enviar para Aprobación</span>
                    </>
                  )}
                </div>
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal pentru alegerea sursei pozei */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-gray-200 animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-50 to-red-100 px-6 py-4 border-b border-red-200 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-lg">📷</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Cambiar Foto de Perfil</h3>
                    <p className="text-sm text-red-600 font-medium">Selecciona una opción</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowImageModal(false)}
                  className="w-8 h-8 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-300 rounded-lg flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg group"
                >
                  <span className="text-gray-400 group-hover:text-red-500 text-lg">✕</span>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                {/* Opțiunea pentru galerie */}
                <button
                  onClick={() => {
                    console.log('🖱️ Button clicked - opening file dialog');
                    console.log('🔍 fileInputRef.current:', fileInputRef.current);
                    fileInputRef.current?.click();
                    setShowImageModal(false);
                  }}
                  className="w-full group relative px-6 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200"
                >
                  <div className="absolute inset-0 rounded-xl bg-blue-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                  <div className="relative flex items-center justify-center gap-3">
                    <span className="text-2xl">📁</span>
                    <div className="text-left">
                      <div className="text-lg font-bold">Elegir de Galería</div>
                      <div className="text-sm opacity-90">Seleccionar foto existente</div>
                    </div>
                  </div>
                </button>

                {/* Opțiunea pentru cameră */}
                <button
                  onClick={() => {
                    cameraInputRef.current?.click();
                    setShowImageModal(false);
                  }}
                  className="w-full group relative px-6 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200"
                >
                  <div className="absolute inset-0 rounded-xl bg-green-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                  <div className="relative flex items-center justify-center gap-3">
                    <span className="text-2xl">📸</span>
                    <div className="text-left">
                      <div className="text-lg font-bold">Hacer Foto</div>
                      <div className="text-sm opacity-90">Tomar nueva foto con cámara</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
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

      {/* Modal modern pentru confirmarea ștergerii */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100">
            {/* Header cu gradient și iconiță */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-t-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-red-400 opacity-30 blur-md animate-pulse"></div>
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <span className="text-2xl">🗑️</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Eliminar Foto</h3>
                  <p className="text-red-100 text-sm">Esta acción no se puede deshacer</p>
                </div>
              </div>
            </div>

            {/* Conținut */}
            <div className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-3xl">⚠️</span>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">
                    ¿Estás seguro?
                  </h4>
                  <p className="text-gray-600 leading-relaxed">
                    Vas a eliminar permanentemente tu foto de perfil. Esta acción no se puede deshacer y tendrás que subir una nueva foto si deseas tener una.
                  </p>
                </div>
              </div>

              {/* Preview avatar-ului curent */}
              {(user?.AVATAR || user?.avatar) && (
                <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-3 font-medium">Foto actual:</p>
                  <div className="flex justify-center">
                    <img 
                      src={user?.AVATAR || user?.avatar} 
                      alt="Avatar actual" 
                      className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                  </div>
                </div>
              )}

              {/* Butoane */}
              <div className="flex gap-3">
                <button
                  onClick={closeDeleteConfirm}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all duration-200 transform hover:scale-105"
                >
                  Cancelar
                </button>
                <button
                  onClick={deleteProfileImage}
                  disabled={imageLoading}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-medium transition-all duration-200 transform hover:scale-105 disabled:transform-none flex items-center justify-center gap-2"
                >
                  {imageLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <span>🗑️</span>
                      Sí, Eliminar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
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