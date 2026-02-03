import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextBase';
import { routes } from '../utils/routes';

const CertificadoHandicapDialog = () => {
  const { user } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  
  // Cache pentru empleado - evită apeluri duplicate
  const empleadoCacheRef = useRef({ codigo: null, data: null, timestamp: 0 });
  const CACHE_DURATION = 60000; // 60 secunde cache
  const fetchingEmpleadoRef = useRef(false);

  // Verifică dacă utilizatorul a confirmat deja
  useEffect(() => {
    const checkConfirmation = async () => {
      if (!user?.CODIGO) {
        setChecking(false);
        return;
      }

      // Verifică cache-ul
      const now = Date.now();
      const cache = empleadoCacheRef.current;
      if (cache.data && 
          cache.codigo === user?.CODIGO &&
          (now - cache.timestamp) < CACHE_DURATION) {
        // Folosește cache-ul
        const empleado = cache.data;
        if (empleado?.certificado_handicap_confirmado === null || empleado?.certificado_handicap_confirmado === undefined) {
          setShowDialog(true);
        }
        setChecking(false);
        return;
      }

      // Evită apeluri duplicate simultane
      if (fetchingEmpleadoRef.current) {
        setChecking(false);
        return;
      }

      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setChecking(false);
          return;
        }

        fetchingEmpleadoRef.current = true;
        // Obține datele complete ale utilizatorului
        const res = await fetch(routes.getEmpleadoMe, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (res.ok) {
          const data = await res.json();
          const empleado = data?.empleado || data?.data?.empleado;
          
          // Actualizează cache-ul
          if (empleado) {
            empleadoCacheRef.current = {
              codigo: user?.CODIGO,
              data: empleado,
              timestamp: Date.now(),
            };
          }
          
          // Dacă certificado_handicap_confirmado este null, arată dialogul
          if (empleado?.certificado_handicap_confirmado === null || empleado?.certificado_handicap_confirmado === undefined) {
            setShowDialog(true);
          }
        }
      } catch (error) {
        console.error('Error checking certificado confirmation:', error);
      } finally {
        setChecking(false);
        fetchingEmpleadoRef.current = false;
      }
    };

    if (user) {
      checkConfirmation();
    }
  }, [user]);

  const handleConfirm = async (tieneCertificado) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(routes.confirmarCertificadoHandicap, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tiene_certificado: tieneCertificado,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowDialog(false);
        
        // Reîncarcă datele utilizatorului din backend pentru a obține valoarea actualizată
        try {
          const meRes = await fetch(routes.getEmpleadoMe, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          });
          
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData?.success && meData?.user) {
              localStorage.setItem('user', JSON.stringify(meData.user));
              // Forțează re-render prin refresh (opțional, sau poți folosi un context update)
              window.location.reload();
            }
          }
        } catch (error) {
          console.error('Error refreshing user data:', error);
        }

        // Dacă s-a creat documentul, poți afișa un mesaj (opțional)
        if (data.documentoCreado) {
          // Poți adăuga o notificare aici dacă vrei
          console.log('✅ Solicitud de documento creada automáticamente');
        }
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.message || 'No se pudo confirmar'}`);
      }
    } catch (error) {
      console.error('Error confirming certificado:', error);
      alert('Error al confirmar. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (checking || !showDialog) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <button
          onClick={() => setShowDialog(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          disabled={loading}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0">
            <AlertCircle className="w-8 h-8 text-blue-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Confirmación de Certificado de Discapacidad
            </h2>
            <p className="text-gray-600 mb-4">
              Por favor, confirma si tienes un certificado de discapacidad. Esta información es necesaria para gestionar correctamente tus documentos.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleConfirm(true)}
            disabled={loading}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Confirmando...' : 'Sí, tengo certificado'}
          </button>
          <button
            onClick={() => handleConfirm(false)}
            disabled={loading}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Confirmando...' : 'No tengo certificado'}
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          Esta confirmación solo se solicita una vez. Si tienes certificado, se creará automáticamente una solicitud de documento.
        </p>
      </div>
    </div>
  );
};

export default CertificadoHandicapDialog;
