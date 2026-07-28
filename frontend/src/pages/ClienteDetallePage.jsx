import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button, Card, Badge, Separator } from '../components/ui';
import { ArrowLeft, MapPin, Phone, Mail, Globe, CreditCard, FileText, Building, User, AlertCircle } from 'lucide-react';
import { routes } from '../utils/routes';
import GeocodingAddress from '../components/GeocodingAddress';
import ClienteContactosSection from '../components/clientes/ClienteContactosSection';
import ClientePortalEnlaceBlock from '../components/clientes/ClientePortalEnlaceBlock';

export default function ClienteDetallePage() {
  const { nif } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [portalFacturas, setPortalFacturas] = useState([]);
  const [portalFacturasLoading, setPortalFacturasLoading] = useState(false);
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
      setError(null);
      console.log('Fetching client with NIF:', nif);
      
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(routes.getClientes, {
        method: 'GET',
        headers,
      });
      
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
  useEffect(() => {
    fetchCliente();
  }, [fetchCliente]);

  const fetchPortalFacturas = useCallback(async () => {
    if (!cliente?.id) return;
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    setPortalFacturasLoading(true);
    try {
      const res = await fetch(routes.clientePortalFacturasManuales(cliente.id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPortalFacturas([]);
        return;
      }
      const list = Array.isArray(json.data) ? json.data : [];
      setPortalFacturas(list);
    } catch {
      setPortalFacturas([]);
    } finally {
      setPortalFacturasLoading(false);
    }
  }, [cliente?.id]);

  useEffect(() => {
    fetchPortalFacturas();
  }, [fetchPortalFacturas]);

  const facturasPorMes = useMemo(() => {
    const map = new Map();
    for (const f of portalFacturas) {
      const d = new Date(f.fecha_emision);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [portalFacturas]);

  const resumenTotalFacturasPortal = useMemo(() => {
    const anioActual = new Date().getFullYear();
    let sum = 0;
    let conImporte = 0;
    let facturasEnAno = 0;
    for (const f of portalFacturas) {
      const fd = new Date(f.fecha_emision);
      if (Number.isNaN(fd.getTime()) || fd.getFullYear() !== anioActual) {
        continue;
      }
      facturasEnAno += 1;
      const imp = f.importe;
      if (imp == null || imp === '') continue;
      const raw =
        typeof imp === 'object' && imp != null && 'toString' in imp
          ? String(imp.toString())
          : String(imp);
      const n = Number(raw.replace(',', '.'));
      if (!Number.isFinite(n)) continue;
      sum += n;
      conImporte += 1;
    }
    const totalFormatted =
      conImporte > 0
        ? sum.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
        : null;
    return {
      anioActual,
      sum,
      conImporte,
      facturasEnAno,
      totalFormatted,
    };
  }, [portalFacturas]);

  const etiquetaMes = (yyyyMm) => {
    const [y, m] = yyyyMm.split('-').map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString('es-ES', {
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const formatImporteEur = (imp) => {
    if (imp == null || imp === '') return null;
    const n = typeof imp === 'string' ? Number(imp.replace(',', '.')) : Number(imp);
    if (!Number.isFinite(n)) return null;
    return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  };

  const abrirFacturaPortal = async (facturaId) => {
    if (!cliente?.id) return;
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
      const res = await fetch(
        routes.clientePortalFacturaManualArchivo(cliente.id, facturaId),
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch {
      /* ignore */
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

            <ClientePortalEnlaceBlock clienteId={cliente.id} />

            <ClienteContactosSection clienteId={cliente.id} />

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

          {/* Sidebar cu acțiuni rapide */}
          <div className="space-y-6">
            
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

                <Separator className="my-2" />

                <div className="pt-1">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                    Facturas (portal)
                  </p>
                  {portalFacturasLoading ? (
                    <p className="text-xs text-gray-500">Cargando…</p>
                  ) : facturasPorMes.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      Sin facturas importadas. Las subidas desde administración (PDF lote) aparecerán aquí agrupadas por mes de emisión.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-[min(420px,50vh)] overflow-y-auto pr-1">
                      {facturasPorMes.map(([mesKey, lista]) => (
                        <div key={mesKey}>
                          <p className="text-xs font-medium text-gray-600 mb-1.5 border-b border-gray-100 pb-0.5">
                            {etiquetaMes(mesKey)}
                          </p>
                          <ul className="space-y-1">
                            {lista.map((f) => {
                              const fechaEm = f.fecha_emision
                                ? new Date(f.fecha_emision).toLocaleDateString('es-ES', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : '';
                              const fechaVto = f.fecha_vencimiento
                                ? new Date(f.fecha_vencimiento).toLocaleDateString('es-ES', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : null;
                              const importeTxt = formatImporteEur(f.importe);
                              const titulo =
                                f.numero_factura?.trim() ||
                                f.nombre_archivo?.replace(/\.pdf$/i, '') ||
                                `Factura #${f.id}`;
                              const detalles = [];
                              if (fechaEm) detalles.push(`Emisión: ${fechaEm}`);
                              if (fechaVto) detalles.push(`Venc.: ${fechaVto}`);
                              if (importeTxt) detalles.push(importeTxt);
                              return (
                                <li key={f.id}>
                                  <button
                                    type="button"
                                    className="w-full text-left text-xs text-red-700 hover:text-red-900 hover:underline flex flex-col gap-0.5 py-1"
                                    onClick={() => abrirFacturaPortal(f.id)}
                                  >
                                    <span className="font-medium break-words">{titulo}</span>
                                    {detalles.length > 0 ? (
                                      <span className="text-gray-500 font-normal">
                                        {detalles.join(' · ')}
                                      </span>
                                    ) : null}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                  {!portalFacturasLoading &&
                  facturasPorMes.length > 0 &&
                  resumenTotalFacturasPortal.totalFormatted ? (
                    <div className="mt-3 pt-2 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-800">
                        Total {resumenTotalFacturasPortal.anioActual} (solo emisión
                        en este año, con importe):{' '}
                        <span className="text-red-700 tabular-nums">
                          {resumenTotalFacturasPortal.totalFormatted}
                        </span>
                      </p>
                      {resumenTotalFacturasPortal.conImporte <
                      resumenTotalFacturasPortal.facturasEnAno ? (
                        <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                          Suma de {resumenTotalFacturasPortal.conImporte} factura(s) de{' '}
                          {resumenTotalFacturasPortal.anioActual} con importe; otras del
                          mismo año sin importe no entran.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {!portalFacturasLoading &&
                  facturasPorMes.length > 0 &&
                  !resumenTotalFacturasPortal.totalFormatted ? (
                    <p className="mt-2 text-[10px] text-gray-500 leading-snug">
                      {resumenTotalFacturasPortal.facturasEnAno === 0 ? (
                        <>
                          El total solo cuenta facturas con{' '}
                          <strong>fecha de emisión en {resumenTotalFacturasPortal.anioActual}</strong>.
                          No hay ninguna en el año en curso (las de otros años siguen listadas arriba).
                        </>
                      ) : (
                        <>
                          Hay {resumenTotalFacturasPortal.facturasEnAno} factura(s) con emisión en{' '}
                          {resumenTotalFacturasPortal.anioActual}, pero ninguna con importe
                          registrado; no se muestra total.
                        </>
                      )}
                    </p>
                  ) : null}
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