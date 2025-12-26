import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Badge, Separator, Modal } from '../components/ui';
import { ArrowLeft, MapPin, Globe, AlertCircle } from 'lucide-react';
import { routes } from '../utils/routes';
import GeocodingAddress from '../components/GeocodingAddress';

export default function ProveedorDetallePage() {
  const { nif } = useParams();
  const navigate = useNavigate();
  const [proveedor, setProveedor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  
  // Modale pentru contract upload
  const [showContractTypeModal, setShowContractTypeModal] = useState(false);
  const [showRenewalDateModal, setShowRenewalDateModal] = useState(false);
  const [contractTypeValue, setContractTypeValue] = useState('');
  const [renewalDateValue, setRenewalDateValue] = useState('');
  const [proveedorName, setProveedorName] = useState('');
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

  // Încarcă datele furnizorului
  const fetchProveedor = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching proveedor with NIF:', nif);
      
      const response = await fetch(routes.getProveedores);
      
      if (!response.ok) {
        throw new Error('Error al cargar los datos');
      }
      
      const data = await response.json();
      console.log('All proveedores data:', data);
      console.log('Looking for NIF:', nif);
      
      const proveedorEncontrado = data.find(p => p.NIF === nif);
      console.log('Found proveedor:', proveedorEncontrado);
      
      if (!proveedorEncontrado) {
        throw new Error('El proveedor no fue encontrado');
      }
      
      setProveedor(proveedorEncontrado);
      
      // Nu mai încărcăm adrese - folosim link-uri Google Maps
      console.log('Geocoding disabled - using Google Maps links instead');
      
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [nif]);

  useEffect(() => {
    if (nif) {
      fetchProveedor();
      fetchContracts();
    }
  }, [nif, fetchProveedor, fetchContracts]);

  // Încarcă contractele furnizorului
  const fetchContracts = useCallback(async () => {
    try {
      setLoadingContracts(true);
      console.log('Fetching contracts from production for NIF:', nif);
      
      const response = await fetch(`/contracts?nif=${nif}&tipo=proveedor`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Contracts response:', data);
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

  const handleRenovarContract = useCallback(async () => {
    try {
      const response = await fetch(routes.renovarContracto, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemId: nif }),
      });

      if (response.ok) {
        alert('Contrato renovado con éxito!');
        fetchProveedor(); // Reîncarcă datele
      } else {
        alert('Error al renovar el contrato');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al renovar el contrato');
    }
  }, [nif, fetchProveedor]);

  // Funcții pentru modale
  const askContractType = useCallback(() => {
    return new Promise((resolve) => {
      contractResolverRef.current = resolve;
      setContractTypeValue('');
      setShowContractTypeModal(true);
    });
  }, []);

  const askRenewalDate = useCallback(() => {
    return new Promise((resolve) => {
      renewalResolverRef.current = resolve;
      setRenewalDateValue('');
      setShowRenewalDateModal(true);
    });
  }, []);

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

  const handleUploadContract = useCallback(async () => {
    try {
      console.log('Încărcare contract pentru furnizor:', proveedor.NIF, proveedor);
      const proveedorName = proveedor['NOMBRE O RAZÓN SOCIAL'];
      
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
        setProveedorName(proveedorName);
        
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
        formData.append('nif', proveedor.NIF);
        formData.append('tipo', 'proveedor');
        formData.append('nombre', proveedorName);
        formData.append('contractType', contractType.trim());
        
        try {
          // Convertește fișierul în base64
          const reader = new FileReader();
          reader.onload = async () => {
            const base64Data = reader.result.split(',')[1]; // Elimină prefix-ul data:application/pdf;base64,
            
            // Pregătește datele pentru backend
            const uploadData = {
              action: 'upload',
              nif: proveedor.NIF,
              tipo: 'proveedor',
              nombre: proveedorName,
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
            
            // Trimite la endpoint-ul de producție prin proxy
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
                `📅 Fecha carga: ${new Date().toLocaleString('es-ES')}\n\n` +
                `👤 Para: ${proveedorName} (${proveedor.NIF})\n\n` +
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
  }, [proveedor, askContractType, askRenewalDate, fetchContracts]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__proveedorContractActions = {
        renovar: handleRenovarContract,
        upload: handleUploadContract,
      };
      return () => {
        delete window.__proveedorContractActions;
      };
    }
    return undefined;
  }, [handleRenovarContract, handleUploadContract]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <div className="text-red-600 font-bold text-xl">Cargando...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">❌</div>
          <div className="text-red-600 font-bold text-xl mb-2">Error</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <Button onClick={() => navigate('/clientes')} className="bg-red-600 hover:bg-red-700">
            ← Volver a la lista de proveedores
          </Button>
        </div>
      </div>
    );
  }

  if (!proveedor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">🏢</div>
          <div className="text-gray-600 font-bold text-xl mb-2">Proveedor no encontrado</div>
          <Button onClick={() => navigate('/clientes')} className="bg-red-600 hover:bg-red-700">
            ← Volver a la lista de proveedores
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => navigate('/clientes')}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </Button>
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">🏢</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                  Detalles Proveedor
                </h1>
                <p className="text-gray-500 text-sm">{proveedor['NOMBRE O RAZÓN SOCIAL']}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3"></div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coloana principală */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informații de bază */}
            {/* Contract section removed for providers */}
            {/* <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Información básica</h2>
                  <Badge variant="outline" className="bg-purple-100 text-purple-800">
                    Proveedor
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Building className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Nombre</p>
                        <p className="font-medium">{proveedor['NOMBRE O RAZÓN SOCIAL']}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <CreditCard className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">NIF/CIF</p>
                        <p className="font-medium">{proveedor.NIF}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium">{proveedor.EMAIL || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Teléfono</p>
                        <p className="font-medium">{proveedor.TELEFONO || 'N/A'}</p>
                      </div>
                    </div>
                    
                    {proveedor.MÓVIL && (
                      <div className="flex items-center space-x-3">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Móvil</p>
                          <p className="font-medium">{proveedor.MÓVIL}</p>
                        </div>
                      </div>
                    )}
                    
                    {proveedor.FAX && (
                      <div className="flex items-center space-x-3">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">FAX</p>
                          <p className="font-medium">{proveedor.FAX}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card> */}

            {/* Adresa */}
            <Card>
              <div className="p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <MapPin className="w-6 h-6 text-gray-400" />
                  <h2 className="text-2xl font-bold text-gray-800">Dirección</h2>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Dirección completa</p>
                    <p className="font-medium">{proveedor.DIRECCIÓN || 'N/A'}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Código postal</p>
                      <p className="font-medium">{proveedor.CODIGO_POSTAL || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Ciudad</p>
                      <p className="font-medium">{proveedor.POBLACIÓN || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Provincia</p>
                      <p className="font-medium">{proveedor.PROVINCIA || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">País</p>
                    <p className="font-medium">{proveedor.PAÍS || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Informații suplimentare */}
            <Card>
              <div className="p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <Globe className="w-6 h-6 text-gray-400" />
                  <h2 className="text-2xl font-bold text-gray-800">Información adicional</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Website</p>
                      <p className="font-medium">
                        {proveedor.URL ? (
                          <a href={`https://${proveedor.URL.split(';')[0]}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {proveedor.URL.split(';')[0]}
                          </a>
                        ) : 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-500">Descuento</p>
                      <p className="font-medium">{proveedor['DESCUENTO POR DEFECTO'] || '0.00'}%</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-500">Cuentas bancarias</p>
                      <p className="font-medium">{proveedor['CUENTAS BANCARIAS'] || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Fecha creación</p>
                      <p className="font-medium">{formatDate(proveedor.fecha_creacion)}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-500">Fecha actualización</p>
                      <p className="font-medium">{formatDate(proveedor.fecha_actualizacion)}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-500">Estado</p>
                      <p className="font-medium">{proveedor.ESTADO || 'Activo'}</p>
                    </div>
                  </div>
                </div>
                
                {proveedor['NOTAS PRIVADAS'] && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center space-x-3 mb-3">
                      <AlertCircle className="w-5 h-5 text-orange-400" />
                      <p className="text-sm font-medium text-gray-700">Notas privadas</p>
                    </div>
                    <p className="text-gray-600 bg-orange-50 p-3 rounded-lg">
                      {proveedor['NOTAS PRIVADAS']}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Hartă cu locația furnizorului */}
            {proveedor.LATITUD && proveedor.LONGITUD && (
              <>
                <Separator />
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">Ubicación GPS</label>
                  
                  {/* Adresa reală din coordonate */}
                  <GeocodingAddress 
                    lat={proveedor.LATITUD} 
                    lng={proveedor.LONGITUD} 
                    className="mb-4"
                  />
                  
                  <div className="mt-2 text-center">
                    <a 
                      href={getGoogleMapsLink(proveedor.LATITUD, proveedor.LONGITUD)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      📍 Abrir en Google Maps
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
                         {/* Contracte */}
             <Card>
               <div className="p-6">
                {/* <h3 className="text-lg font-semibold text-gray-800 mb-4">Contratos</h3> */}
                 
                 {/* Lista contractelor */}
                 <div className="mb-4">
                  {/* <label className="text-sm font-medium text-gray-500 mb-3 block">Contratos cargados</label> */}
                   
                   {loadingContracts ? (
                     <div className="flex items-center justify-center py-4">
                       <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                      {/* <span className="ml-2 text-sm text-gray-600">Cargando contratos de producción...</span> */}
                     </div>
                   ) : contracts.length > 0 ? (
                     <div className="space-y-3">
                       {contracts.map((contract, index) => (
                         <div key={index} className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                           <div className="space-y-3">
                             {/* Header cu numele contractului */}
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                 <span className="text-sm font-semibold text-gray-900">
                                   Contract #{index + 1}
                                 </span>
                                 <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800">
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
                             <div className="flex gap-2 pt-2 border-t border-purple-200">
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
                                         tipo: 'proveedor',
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
                    <div className="hidden"></div>
                  )}
                 </div>

                                   <Separator className="my-4" />

                  <div className="hidden"></div>
               </div>
             </Card>

            {/* Statistici */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Estadísticas</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Descuento</span>
                    <Badge className="bg-purple-100 text-purple-800">
                      {proveedor['DESCUENTO POR DEFECTO'] || '0.00'}%
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Estado</span>
                    <Badge className="bg-green-100 text-green-800">
                      {proveedor.ESTADO || 'Activo'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Fecha creación</span>
                    <span className="text-sm text-gray-500">{formatDate(proveedor.fecha_creacion)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Última actualización</span>
                    <span className="text-sm text-gray-500">{formatDate(proveedor.fecha_actualizacion)}</span>
                  </div>
                </div>
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
          Introduzca el tipo de contrato para <strong>{proveedorName}</strong>:
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