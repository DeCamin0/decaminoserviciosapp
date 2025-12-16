import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Badge, Separator, Modal } from '../components/ui';
import { ArrowLeft, MapPin, Phone, Mail, Globe, Calendar, CreditCard, FileText, Building, User, AlertCircle } from 'lucide-react';
import { routes } from '../utils/routes';
import GeocodingAddress from '../components/GeocodingAddress';

export default function ClienteDetallePage() {
  const { nif } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  
  // Modale pentru contract upload
  const [showContractTypeModal, setShowContractTypeModal] = useState(false);
  const [showRenewalDateModal, setShowRenewalDateModal] = useState(false);
  const [contractTypeValue, setContractTypeValue] = useState('');
  const [renewalDateValue, setRenewalDateValue] = useState('');
  const [clienteName, setClienteName] = useState('');
  const contractResolverRef = useRef(null);
  const renewalResolverRef = useRef(null);
  // Funcție pentru a normaliza coordonatele și a crea link Google Maps
  const getGoogleMapsLink = (lat, lng) => {
    if (!lat || !lng) return null;
    
    // Normalizează coordonatele (înlocuiește virgula cu punct)
    const normalizedLat = lat.toString().replace(',', '.');
    const normalizedLng = lng.toString().replace(',', '.');
    
    return `https://www.google.com/maps?q=${normalizedLat},${normalizedLng}`;
  };

  // Funcție helper pentru a detecta comunități
  const isComunidad = (cliente) => {
    if (!cliente) return false;
    const nombre = cliente['NOMBRE O RAZON SOCIAL'] || '';
    return nombre.includes('C.P.') || 
           nombre.includes('C.P ') || 
           nombre.includes('CP ') || 
           nombre.includes('CP.') || 
           nombre.includes('COMUNIDAD DE PROPIETARIOS');
  };

  // Încarcă datele clientului
  const fetchCliente = useCallback(async () => {
    if (!nif) {
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching client with NIF:', nif);
      
      const response = await fetch(routes.getClientes);
      
      if (!response.ok) {
        throw new Error('Error al cargar los datos');
      }
      
      const data = await response.json();
      console.log('All clients data:', data);
      console.log('Looking for NIF:', nif);
      
      const clienteEncontrado = data.find(c => c.NIF === nif);
      console.log('Found client:', clienteEncontrado);
      
      if (!clienteEncontrado) {
        throw new Error('El cliente no fue encontrado');
      }
      
      setCliente(clienteEncontrado);
      
      console.log('Geocoding disabled - using Google Maps links instead');
      
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [nif]);

  // Încarcă contractele clientului
  const fetchContracts = useCallback(async () => {
    if (!nif) {
      return;
    }

    try {
      setLoadingContracts(true);
      console.log('Fetching contracts from production for NIF:', nif);
      
      const response = await fetch(`/contracts?nif=${nif}&tipo=cliente`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Contracts response:', data);
        // Trata cazurile in care backend-ul intoarce [{ success: true }] sau obiect gol
        const normalized = Array.isArray(data) 
          ? data.filter((c) => c && (c.id || c.tipo_contrato || c.archivo_base64))
          : [];
        setContracts(normalized);
      } else {
        console.log('No contracts found or error:', response.status);
        setContracts([]);
      }
    } catch (error) {
      console.error('Error fetching contracts:', error);
      setContracts([]);
    } finally {
      setLoadingContracts(false);
    }
  }, [nif]);

  useEffect(() => {
    fetchCliente();
    fetchContracts();
  }, [fetchCliente, fetchContracts]);

  // Funcții pentru modale
  const askContractType = () => {
    return new Promise((resolve) => {
      contractResolverRef.current = resolve;
      setContractTypeValue('');
      setShowContractTypeModal(true);
    });
  };

  const askRenewalDate = () => {
    return new Promise((resolve) => {
      renewalResolverRef.current = resolve;
      setRenewalDateValue('');
      setShowRenewalDateModal(true);
    });
  };

  const handleConfirmContractType = () => {
    const value = contractTypeValue.trim();
    setShowContractTypeModal(false);
    if (contractResolverRef.current) {
      contractResolverRef.current(value);
    }
  };

  const handleCancelContractType = () => {
    setShowContractTypeModal(false);
    if (contractResolverRef.current) {
      contractResolverRef.current('');
    }
  };

  const handleConfirmRenewalDate = () => {
    const value = renewalDateValue; // yyyy-mm-dd or ''
    setShowRenewalDateModal(false);
    if (renewalResolverRef.current) {
      if (!value) {
        renewalResolverRef.current('');
      } else {
        try {
          const iso = new Date(value).toISOString();
          renewalResolverRef.current(iso);
        } catch (e) {
          renewalResolverRef.current('');
        }
      }
    }
  };

  const handleCancelRenewalDate = () => {
    setShowRenewalDateModal(false);
    if (renewalResolverRef.current) renewalResolverRef.current('');
  };

  const handleUploadContract = async () => {
    try {
      console.log('Încărcare contract pentru client:', cliente.NIF, cliente);
      const clienteName = cliente['NOMBRE O RAZON SOCIAL'];
      
      // Creează un input file hidden
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png';
      fileInput.style.display = 'none';
      
      // Adaugă event listener pentru când se selectează un fișier
      fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        console.log('Fișier selectat:', file.name, file.size, file.type);
        
        // Verifică dimensiunea fișierului (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert('El archivo es demasiado grande! El tamaño máximo es 10MB.');
          return;
        }
        
        // Salvează fișierul și numele pentru modale
        setClienteName(clienteName);
        
        // Cere tipul contractului prin modal
        const contractType = await askContractType();
        
        if (!contractType || contractType.trim() === '') {
          alert('El tipo de contrato es obligatorio!');
          return;
        }
        
        // Cere data de renovare prin modal
        const fechaRenovacionISO = await askRenewalDate();
        
        // Creează FormData pentru upload
        const formData = new FormData();
        formData.append('contract', file);
        formData.append('nif', cliente.NIF);
        formData.append('tipo', 'cliente');
        formData.append('nombre', clienteName);
        formData.append('contractType', contractType.trim());
        
        try {
          // Convertește fișierul în base64
          const reader = new FileReader();
          reader.onload = async () => {
            const base64Data = reader.result.split(',')[1]; // Elimină prefix-ul data:application/pdf;base64,
            
            // Pregătește datele pentru backend
            const uploadData = {
              action: 'upload',
              nif: cliente.NIF,
              tipo: 'cliente',
              nombre: clienteName,
              contractType: contractType.trim(),
              fechaSubida: new Date().toISOString(),
              fechaRenovacion: fechaRenovacionISO || null,
              archivo: base64Data,
              nombreArchivo: file.name,
              tipoArchivo: file.type,
              tamanoArchivo: file.size
            };
            
            console.log('Uploading contract data to production:', {
              nif: uploadData.nif,
              tipo: uploadData.tipo,
              nombre: uploadData.nombre,
              contractType: uploadData.contractType,
              fechaSubida: uploadData.fechaSubida,
              nombreArchivo: uploadData.nombreArchivo,
              tipoArchivo: uploadData.tipoArchivo,
              tamanoArchivo: uploadData.tamanoArchivo,
              archivoLength: uploadData.archivo.length
            });
            
            // Trimite la endpoint-ul de test prin proxy
            const response = await fetch('/contracts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(uploadData)
            });
            
            if (response.ok) {
              const result = await response.json();
              console.log('Upload response:', result);
              
              alert(
                `✅ Contrato cargado con éxito en producción!\n\n` +
                `📄 Archivo: ${file.name}\n` +
                `📏 Tamaño: ${(file.size / 1024 / 1024).toFixed(2)}MB\n` +
                `📋 Tipo archivo: ${file.type}\n` +
                `📝 Tipo contrato: ${contractType.trim()}\n` +
                `📅 Fecha carga: ${new Date().toLocaleString('es-ES')}\n` +
                `${fechaRenovacionISO ? `🔄 Renovación: ${new Date(fechaRenovacionISO).toLocaleDateString('es-ES')}\n` : ''}\n` +
                `👤 Para: ${clienteName} (${cliente.NIF})\n\n` +
                `El contrato ha sido guardado en la base de datos de producción.`
              );
              
              // Reîncarcă lista de contracte
              fetchContracts();
            } else {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
          };
          
          reader.onerror = () => {
            throw new Error('Error al leer el archivo');
          };
          
          reader.readAsDataURL(file);
          
        } catch (error) {
          console.error('Error upload contract:', error);
          alert(`Error al cargar el contrato: ${error.message}`);
        }
      });
      
      // Adaugă input-ul la DOM și deschide file picker-ul
      document.body.appendChild(fileInput);
      fileInput.click();
      
      // Curăță input-ul după ce se închide
      fileInput.addEventListener('change', () => {
        document.body.removeChild(fileInput);
      });
      
    } catch (error) {
      console.error('Error cargando contrato:', error);
      alert('Error al cargar el contrato');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Cargando detalles del cliente...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => navigate('/clientes')}>
            ← Volver a Clientes
          </Button>
        </div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Cliente no encontrado</h2>
          <p className="text-gray-600 mb-4">El cliente con el NIF especificado no fue encontrado.</p>
          <Button onClick={() => navigate('/clientes')}>
            ← Volver a Clientes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/clientes')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Volver a Clientes
              </Button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Detalles Cliente
                </h1>
                <p className="text-sm text-gray-500">NIF: {cliente.NIF}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {isComunidad(cliente) && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                  🏘️ Comunidad
                </Badge>
              )}
              <Button
                onClick={handleUploadContract}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                📄 Cargar Contrato
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Conținut principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Informații principale */}
          <div className="lg:col-span-2 space-y-6">
            
                         {/* Card Informații de bază */}
             <Card>
               <div className="p-6 border-b border-gray-200">
                 <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                   <User className="h-5 w-5" />
                   Información básica
                 </h3>
               </div>
               <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Nombre / Denominación</label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {cliente['NOMBRE O RAZON SOCIAL']}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">NIF</label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {cliente.NIF}
                    </p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </label>
                    <p className="text-gray-900 mt-1">
                      {cliente.EMAIL || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Teléfono
                    </label>
                    <p className="text-gray-900 mt-1">
                      {cliente.TELEFONO || 'N/A'}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Móvil
                    </label>
                    <p className="text-gray-900 mt-1">
                      {cliente.MOVIL || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Website
                    </label>
                    <p className="text-gray-900 mt-1">
                      {cliente.URL ? (
                        <a 
                          href={cliente.URL} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          {cliente.URL}
                        </a>
                      ) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

                         {/* Card Adresa */}
             <Card>
               <div className="p-6 border-b border-gray-200">
                 <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                   <MapPin className="h-5 w-5" />
                   Dirección
                 </h3>
               </div>
               <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Dirección completa</label>
                    <p className="text-gray-900 mt-1">
                      {cliente.DIRECCION || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Código postal</label>
                    <p className="text-gray-900 mt-1">
                      {cliente['CODIGO POSTAL'] || 'N/A'}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Ciudad</label>
                    <p className="text-gray-900 mt-1">
                      {cliente.POBLACION || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Provincia</label>
                    <p className="text-gray-900 mt-1">
                      {cliente.PROVINCIA || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">País</label>
                    <p className="text-gray-900 mt-1">
                      {cliente.PAIS || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Hartă cu locația clientului */}
                {cliente.LATITUD && cliente.LONGITUD && (
                  <>
                    <Separator />
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-2 block">Ubicación GPS</label>
                      
                      {/* Adresa reală din coordonate */}
                      <GeocodingAddress 
                        lat={cliente.LATITUD} 
                        lng={cliente.LONGITUD} 
                        className="mb-4"
                      />
                      
                      <div className="mt-2 text-center">
                        <a 
                          href={getGoogleMapsLink(cliente.LATITUD, cliente.LONGITUD)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          📍 Ver en Google Maps
                        </a>
                      </div>
                    </div>
                  </>
                )}

                {/* Link Google Maps pentru adresa text */}
                {!cliente.LATITUD && !cliente.LONGITUD && cliente.DIRECCION && (
                  <>
                    <Separator />
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-2 block">Ubicación</label>
                      
                      <div className="mt-2 text-center">
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cliente.DIRECCION + ', ' + cliente.POBLACION + ', ' + cliente.PROVINCIA + ', ' + cliente.PAIS)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          📍 Ver en Google Maps
                        </a>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>

                         {/* Card Informații financiare */}
             <Card>
               <div className="p-6 border-b border-gray-200">
                 <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                   <CreditCard className="h-5 w-5" />
                   Información financiera
                 </h3>
               </div>
               <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Descuento por defecto</label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {cliente['DESCUENTO POR DEFECTO'] || '0.00'}%
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Límite de gasto</label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {cliente.CuantoPuedeGastar
                        ? parseFloat(cliente.CuantoPuedeGastar).toLocaleString('es-ES', {
                            style: 'currency',
                            currency: 'EUR'
                          })
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Cuenta bancaria</label>
                    <div className="mt-1">
                      {cliente['CUENTAS BANCARIAS'] ? (
                        <div className="space-y-2">
                          <Badge variant="success" className="text-xs">
                            ✅ Cuentas disponibles
                          </Badge>
                          <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border">
                            <p className="font-medium mb-1">Cuentas bancarias:</p>
                            <p className="text-gray-600 break-words">
                              {cliente['CUENTAS BANCARIAS']}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            ❌ Sin cuentas
                          </Badge>
                          <span className="text-gray-500 text-sm">No hay cuentas bancarias configuradas</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

                         {/* Card Note private */}
             {cliente['NOTAS PRIVADAS'] && (
               <Card>
                 <div className="p-6 border-b border-gray-200">
                   <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                     <FileText className="h-5 w-5" />
                     Notas privadas
                   </h3>
                 </div>
                 <div className="p-6">
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-orange-800">{cliente['NOTAS PRIVADAS']}</p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar cu informații contract */}
          <div className="space-y-6">
            
                         {/* Card Contract */}
                           <Card>
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Contratos
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                 <div>
                   <label className="text-sm font-medium text-gray-500">Última renovación</label>
                   <p className="text-gray-900 mt-1">
                     {cliente['Fecha Ultima Renovacion'] ? 
                       new Date(cliente['Fecha Ultima Renovacion']).toLocaleDateString('es-ES', {
                         year: 'numeric',
                         month: 'long',
                         day: 'numeric'
                       }) : 
                       'N/A'
                     }
                   </p>
                 </div>
                 
                 <div>
                   <label className="text-sm font-medium text-gray-500">Próxima renovación</label>
                   <p className="text-gray-900 mt-1">
                     {cliente['Fecha Proxima Renovacion'] ? 
                       new Date(cliente['Fecha Proxima Renovacion']).toLocaleDateString('es-ES', {
                         year: 'numeric',
                         month: 'long',
                         day: 'numeric'
                       }) : 
                       'N/A'
                     }
                   </p>
                 </div>

                 <Separator />

                 {/* Lista contractelor */}
                 <div>
                   <label className="text-sm font-medium text-gray-500 mb-3 block">Contratos cargados</label>
                   
                   {loadingContracts ? (
                     <div className="flex items-center justify-center py-4">
                       <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                       <span className="ml-2 text-sm text-gray-600">Cargando contratos de producción...</span>
                     </div>
                   ) : contracts.length > 0 ? (
                     <div className="space-y-3">
                       {contracts.map((contract, index) => (
                         <div key={index} className="bg-gray-50 p-4 rounded-lg border">
                           <div className="space-y-3">
                             {/* Header cu numele contractului */}
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                 <span className="text-sm font-semibold text-gray-900">
                                   Contract #{index + 1}
                                 </span>
                                 <Badge variant="outline" className="text-xs">
                                   {contract.tipo_contrato || 'N/A'}
                                 </Badge>
                               </div>
                             </div>
                             
                             {/* Detalii contract */}
                             <div className="grid grid-cols-1 gap-2 text-xs text-gray-600">
                               <div className="flex items-center gap-2">
                                 <span>📅</span>
                                 <span>{contract.fecha_subida ? new Date(contract.fecha_subida).toLocaleDateString('es-ES') : 'N/A'}</span>
                               </div>
                               <div className="flex items-center gap-2">
                                 <span>🔄</span>
                                 <span>{contract.fecha_renovacion ? new Date(contract.fecha_renovacion).toLocaleDateString('es-ES') : 'Sin renovación'}</span>
                               </div>
                               <div className="flex items-center gap-2">
                                 <span>👤</span>
                                 <span>NIF: {contract.cliente_nif || 'N/A'}</span>
                               </div>
                             </div>
                             
                             {/* Butoane acțiuni */}
                             <div className="flex gap-2 pt-2 border-t border-gray-200">
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={async () => {
                                   // Descarcă contractul prin endpoint-ul de test
                                   try {
                                     console.log('Downloading contract:', {
                                       nif: contract.cliente_nif,
                                       tipo_contrato: contract.tipo_contrato
                                     });
                                     
                                     const response = await fetch(`/download-contract?nif=${contract.cliente_nif}&tipo_contrato=${encodeURIComponent(contract.tipo_contrato)}`, {
                                       method: 'GET',
                                       // Nu seta Content-Type pentru a permite browser-ului să detecteze tipul fișierului
                                     });
                                     
                                     if (response.ok) {
                                       // Verifică dacă răspunsul este PDF
                                       const contentType = response.headers.get('content-type');
                                       console.log('Download response content-type:', contentType);
                                       
                                       if (contentType && contentType.includes('application/pdf')) {
                                         // Descarcă direct fișierul PDF binar
                                         const blob = await response.blob();
                                         const url = window.URL.createObjectURL(blob);
                                         const a = document.createElement('a');
                                         a.href = url;
                                         a.download = `contract_${contract.tipo_contrato}_${contract.cliente_nif}.pdf`;
                                         document.body.appendChild(a);
                                         a.click();
                                         window.URL.revokeObjectURL(url);
                                         document.body.removeChild(a);
                                         
                                         console.log('Contract PDF downloaded successfully');
                                       } else {
                                         // Încearcă să proceseze ca JSON (fallback pentru endpoint-uri care returnează JSON)
                                         try {
                                           const data = await response.json();
                                           console.log('Download response (JSON):', data);
                                           
                                           if (data.archivo_base64) {
                                             // Convertește base64 în blob și descarcă
                                             const byteCharacters = atob(data.archivo_base64);
                                             const byteNumbers = new Array(byteCharacters.length);
                                             for (let i = 0; i < byteCharacters.length; i++) {
                                               byteNumbers[i] = byteCharacters.charCodeAt(i);
                                             }
                                             const byteArray = new Uint8Array(byteNumbers);
                                             const blob = new Blob([byteArray], { type: 'application/pdf' });
                                             
                                             const url = window.URL.createObjectURL(blob);
                                             const a = document.createElement('a');
                                             a.href = url;
                                             a.download = `contract_${contract.tipo_contrato}_${contract.cliente_nif}.pdf`;
                                             document.body.appendChild(a);
                                             a.click();
                                             window.URL.revokeObjectURL(url);
                                             document.body.removeChild(a);
                                             
                                             console.log('Contract downloaded successfully from JSON response');
                                           } else {
                                             alert('El contrato no fue encontrado en el backend');
                                           }
                                         } catch (jsonError) {
                                           console.error('Error parsing JSON response:', jsonError);
                                           alert('Error al procesar la respuesta del servidor');
                                         }
                                       }
                                     } else {
                                       throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                                     }
                                   } catch (error) {
                                     console.error('Error downloading contract:', error);
                                     alert(`Error al descargar el contrato: ${error.message}`);
                                   }
                                 }}
                                 className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                                 title="Descargar contrato"
                               >
                                 📥 Descargar
                               </Button>
                               
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={async () => {
                                   if (!confirm(`¿Eliminar contrato "${contract.tipo_contrato}"? Esta acción no se puede deshacer.`)) {
                                     return;
                                   }
                                   try {
                                     const resp = await fetch('/contracts', {
                                       method: 'POST',
                                       headers: { 'Content-Type': 'application/json' },
                                       body: JSON.stringify({
                                        action: 'delete',
                                        id: contract.id,
                                         nif: contract.cliente_nif || nif,
                                         tipo: 'cliente',
                                         tipo_contrato: contract.tipo_contrato
                                       })
                                     });
                                     if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                                     alert('Contrato eliminado');
                                     fetchContracts();
                                   } catch (err) {
                                     console.error('Error deleting contract:', err);
                                     alert('No se pudo eliminar el contrato');
                                   }
                                 }}
                                 className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                                 title="Eliminar contrato"
                               >
                                 🗑️ Eliminar
                               </Button>
                             </div>
                           </div>
                         </div>
                       ))}
                     </div>
                   ) : (
                     <div className="text-center py-4">
                       <div className="text-gray-400 text-2xl mb-2">📄</div>
                       <p className="text-sm text-gray-500">No hay contratos cargados</p>
                     </div>
                   )}
                 </div>

                 <Separator />

                 <div className="text-center text-sm text-gray-500">
                   <p>💡 Cada contrato tiene sus propias opciones de descarga y renovación</p>
                 </div>
               </div>
             </Card>

                         {/* Card Acțiuni rapide */}
             <Card>
               <div className="p-6 border-b border-gray-200">
                 <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                   <Building className="h-5 w-5" />
                   Acciones rápidas
                 </h3>
               </div>
               <div className="p-6 space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate(`/clientes?search=${cliente.NIF}`)}
                >
                  📋 Ver en lista de clientes
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                    if (cliente.EMAIL) {
                      window.open(`mailto:${cliente.EMAIL}`, '_blank');
                    }
                  }}
                  disabled={!cliente.EMAIL}
                >
                  📧 Enviar email
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                    if (cliente.TELEFONO || cliente.MOVIL) {
                      const phone = cliente.TELEFONO || cliente.MOVIL;
                      window.open(`tel:${phone}`, '_blank');
                    }
                  }}
                  disabled={!cliente.TELEFONO && !cliente.MOVIL}
                >
                                     📞 Llamar
                 </Button>
               </div>
             </Card>
           </div>
         </div>
       </div>
     </div>

     {/* Modal pentru tipul contractului */}
     <Modal
       isOpen={showContractTypeModal}
       onClose={handleCancelContractType}
       title="Tipo de Contrato"
       size="md"
     >
       <div className="space-y-4">
         <p className="text-gray-600">
           Introduzca el tipo de contrato para <strong>{clienteName}</strong>:
         </p>
         
         <div className="space-y-2">
           <label className="block text-sm font-medium text-gray-700">Opciones:</label>
           <div className="grid grid-cols-1 gap-2">
             {[
               'Contrato de servicios',
               'Contrato de suministro', 
               'Contrato de colaboración',
               'Contrato de licencia',
               'Contrato de distribución'
             ].map((option) => (
               <button
                 key={option}
                 onClick={() => setContractTypeValue(option)}
                 className={`p-3 text-left rounded-lg border transition-colors ${contractTypeValue === option ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
               >
                 {option}
               </button>
             ))}
           </div>
         </div>
         
         <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">
             O escriba otro tipo:
           </label>
           <input
             type="text"
             value={contractTypeValue}
             onChange={(e) => setContractTypeValue(e.target.value)}
             placeholder="Especifique el tipo de contrato"
             className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
           />
         </div>
         
         <div className="flex space-x-3 pt-4">
           <Button
             onClick={handleConfirmContractType}
             disabled={!contractTypeValue.trim()}
             className="flex-1 bg-red-600 hover:bg-red-700 text-white"
           >
             Confirmar
           </Button>
           <Button
             onClick={handleCancelContractType}
             variant="outline"
             className="flex-1"
           >
             Cancelar
           </Button>
         </div>
       </div>
     </Modal>

     {/* Modal pentru data de renovare */}
     <Modal
       isOpen={showRenewalDateModal}
       onClose={handleCancelRenewalDate}
       title="Fecha de Renovación"
       size="sm"
     >
       <div className="space-y-4">
         <p className="text-gray-600">
           Introduzca la fecha de renovación (opcional):
         </p>
         
         <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">
             Fecha de renovación:
           </label>
           <input
             type="date"
             value={renewalDateValue}
             onChange={(e) => setRenewalDateValue(e.target.value)}
             className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
           />
           <p className="text-xs text-gray-500 mt-1">
             Deje vacío si no aplica
           </p>
         </div>
         
         <div className="flex space-x-3 pt-4">
           <Button
             onClick={handleConfirmRenewalDate}
             className="flex-1 bg-red-600 hover:bg-red-700 text-white"
           >
             Confirmar
           </Button>
           <Button
             onClick={handleCancelRenewalDate}
             variant="outline"
             className="flex-1"
           >
             Cancelar
           </Button>
         </div>
       </div>
     </Modal>
    </>
   );
 } 