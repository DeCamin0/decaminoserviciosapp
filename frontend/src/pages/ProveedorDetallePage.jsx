import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Badge, Separator } from '../components/ui';
import { ArrowLeft, MapPin, Globe, AlertCircle } from 'lucide-react';
import { routes } from '../utils/routes';
import GeocodingAddress from '../components/GeocodingAddress';

export default function ProveedorDetallePage() {
  const { nif } = useParams();
  const navigate = useNavigate();
  const [proveedor, setProveedor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
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
      setError(null);
      console.log('Fetching proveedor with NIF:', nif);
      
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(routes.getProveedores, {
        method: 'GET',
        headers,
      });
      
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
      console.error('Error fetching proveedor:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [nif]);

  useEffect(() => {
    if (nif) {
      fetchProveedor();
    }
  }, [nif, fetchProveedor]);

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

    </>
  );
} 