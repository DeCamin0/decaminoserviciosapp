import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button, Card, Badge, Separator, PageHeader } from '../components/ui';
import { MapPin, Phone, Mail, Globe, CreditCard, FileText, Building, User, AlertCircle, List, ExternalLink, Loader2 } from 'lucide-react';
import { ClientesStatusBadge, isComunidadCliente } from '../components/clientes';
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
  const [spTipos, setSpTipos] = useState([]);
  const [spConfig, setSpConfig] = useState({
    activo: true,
    servicios_periodicos: false,
    tipo_ids: [],
  });
  const [spSaving, setSpSaving] = useState(false);
  const [spMsg, setSpMsg] = useState('');
  // Funcție pentru a normaliza coordonatele și a crea link Google Maps
  const getGoogleMapsLink = (lat, lng) => {
    if (!lat || !lng) return null;
    
    // Normalizează coordonatele (înlocuiește virgula cu punct)
    const normalizedLat = lat.toString().replace(',', '.');
    const normalizedLng = lng.toString().replace(',', '.');
    
    return `https://www.google.com/maps?q=${normalizedLat},${normalizedLng}`;
  };

  const isComunidad = isComunidadCliente;

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

  const loadSpConfig = useCallback(async (clienteId) => {
    if (!clienteId) return;
    const token = localStorage.getItem('auth_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    try {
      const [tiposRes, cfgRes] = await Promise.all([
        fetch(`${routes.serviciosPeriodicosTipos}`, { headers }),
        fetch(routes.serviciosPeriodicosClienteConfig(clienteId), { headers }),
      ]);
      if (tiposRes.ok) {
        const tipos = await tiposRes.json();
        setSpTipos(Array.isArray(tipos) ? tipos.filter((t) => t.activo !== false) : []);
      }
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        setSpConfig({
          activo: cfg.activo !== false,
          servicios_periodicos: Boolean(cfg.servicios_periodicos),
          tipo_ids: Array.isArray(cfg.tipo_ids) ? cfg.tipo_ids.map(Number) : [],
        });
      }
    } catch (e) {
      console.error('Error loading SP config', e);
    }
  }, []);

  useEffect(() => {
    if (cliente?.id) loadSpConfig(cliente.id);
  }, [cliente?.id, loadSpConfig]);

  const saveSpConfig = async (next) => {
    if (!cliente?.id) return;
    setSpSaving(true);
    setSpMsg('');
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(routes.serviciosPeriodicosClienteConfig(cliente.id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }
      const cfg = await res.json();
      setSpConfig({
        activo: cfg.activo !== false,
        servicios_periodicos: Boolean(cfg.servicios_periodicos),
        tipo_ids: Array.isArray(cfg.tipo_ids) ? cfg.tipo_ids.map(Number) : [],
      });
      setCliente((prev) =>
        prev
          ? {
              ...prev,
              ESTADO: cfg.activo ? 'Sí' : 'No',
              servicios_periodicos: Boolean(cfg.servicios_periodicos),
            }
          : prev,
      );
      setSpMsg('Guardado');
      setTimeout(() => setSpMsg(''), 2000);
    } catch (e) {
      setSpMsg(e.message || 'Error al guardar');
    } finally {
      setSpSaving(false);
    }
  };

  const toggleSpTipo = (tipoId) => {
    const id = Number(tipoId);
    const set = new Set(spConfig.tipo_ids);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const next = {
      ...spConfig,
      tipo_ids: [...set],
    };
    setSpConfig(next);
    saveSpConfig(next);
  };

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
      <div className="clientes-detail-page app-page">
        <div className="clientes-state clientes-state--page">
          <Loader2 className="clientes-state__icon animate-spin" aria-hidden />
          <p className="clientes-state__title">Cargando detalles del cliente…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="clientes-detail-page app-page">
        <div className="clientes-state clientes-state--page">
          <AlertCircle className="clientes-state__icon text-red-500" aria-hidden />
          <p className="clientes-state__title">Error</p>
          <p className="clientes-state__text">{error}</p>
          <Button onClick={() => navigate('/clientes')}>Volver a clientes</Button>
        </div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="clientes-detail-page app-page">
        <div className="clientes-state clientes-state--page">
          <User className="clientes-state__icon" aria-hidden />
          <p className="clientes-state__title">Cliente no encontrado</p>
          <p className="clientes-state__text">El cliente con el NIF especificado no fue encontrado.</p>
          <Button onClick={() => navigate('/clientes')}>Volver a clientes</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="clientes-detail-page app-page">
      <PageHeader
        title={cliente['NOMBRE O RAZON SOCIAL']}
        subtitle={`NIF: ${cliente.NIF}`}
        backTo="/clientes"
        backTitle="Volver a clientes"
        actions={isComunidad(cliente) ? <ClientesStatusBadge row={cliente} /> : null}
      />

      <div className="clientes-detail-grid">
          {/* Informații principale */}
          <div className="clientes-detail-main">
            
             <Card className="app-card" padding="">
               <div className="clientes-detail-card__head">
                 <User className="h-5 w-5" aria-hidden />
                 <h3 className="clientes-detail-card__title">Información básica</h3>
               </div>
               <div className="clientes-detail-card__body">
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

            <Card className="app-card" padding="">
              <div className="clientes-detail-card__head">
                <Building className="h-5 w-5" aria-hidden />
                <div>
                  <h3 className="clientes-detail-card__title">Servicios periódicos</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Controla si este cliente aparece en la matriz y qué servicios se hacen.
                  </p>
                </div>
              </div>
              <div className="clientes-detail-card__body space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={spConfig.activo}
                    disabled={spSaving || !cliente?.id}
                    onChange={(e) => {
                      const next = { ...spConfig, activo: e.target.checked };
                      setSpConfig(next);
                      saveSpConfig(next);
                    }}
                  />
                  <span className="text-sm font-medium text-gray-800">Cliente activo</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={spConfig.servicios_periodicos}
                    disabled={spSaving || !cliente?.id}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      const next = {
                        ...spConfig,
                        servicios_periodicos: enabled,
                        tipo_ids:
                          enabled && spConfig.tipo_ids.length === 0
                            ? spTipos.map((t) => Number(t.id))
                            : spConfig.tipo_ids,
                      };
                      setSpConfig(next);
                      saveSpConfig(next);
                    }}
                  />
                  <span className="text-sm font-medium text-gray-800">
                    Incluir en Servicios periódicos
                  </span>
                </label>

                {spConfig.servicios_periodicos && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Servicios a realizar en esta comunidad
                    </p>
                    {spTipos.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No hay tipos definidos. Créalos en Servicios periódicos → Gestionar tipos.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {spTipos.map((t) => {
                          const checked = spConfig.tipo_ids.includes(Number(t.id));
                          return (
                            <li key={t.id}>
                              <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4"
                                  checked={checked}
                                  disabled={spSaving}
                                  onChange={() => toggleSpTipo(t.id)}
                                />
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: t.color || '#0ea5e9' }}
                                />
                                <span className="text-sm text-gray-800">{t.nombre}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {(spSaving || spMsg) && (
                  <p className={`text-xs ${spMsg && spMsg !== 'Guardado' ? 'text-red-600' : 'text-gray-500'}`}>
                    {spSaving ? 'Guardando…' : spMsg}
                  </p>
                )}
              </div>
            </Card>

             <Card className="app-card" padding="">
               <div className="clientes-detail-card__head">
                 <MapPin className="h-5 w-5" aria-hidden />
                 <h3 className="clientes-detail-card__title">Dirección</h3>
               </div>
               <div className="clientes-detail-card__body space-y-4">
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
                          <ExternalLink className="h-4 w-4 inline mr-1" aria-hidden />
                          Ver en Google Maps
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
                          <ExternalLink className="h-4 w-4 inline mr-1" aria-hidden />
                          Ver en Google Maps
                        </a>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>

             <Card className="app-card" padding="">
               <div className="clientes-detail-card__head">
                 <CreditCard className="h-5 w-5" aria-hidden />
                 <h3 className="clientes-detail-card__title">Información financiera</h3>
               </div>
               <div className="clientes-detail-card__body space-y-4">
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
                            Cuentas disponibles
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
                            Sin cuentas
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

            {cliente['NOTAS PRIVADAS'] && (
               <Card className="app-card" padding="">
                 <div className="clientes-detail-card__head">
                   <FileText className="h-5 w-5" aria-hidden />
                   <h3 className="clientes-detail-card__title">Notas privadas</h3>
                 </div>
                 <div className="clientes-detail-card__body">
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-orange-800">{cliente['NOTAS PRIVADAS']}</p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar cu acțiuni rapide */}
          <div className="clientes-detail-aside">
             <Card className="app-card" padding="">
               <div className="clientes-detail-card__head">
                 <Building className="h-5 w-5" aria-hidden />
                 <h3 className="clientes-detail-card__title">Acciones rápidas</h3>
               </div>
               <div className="clientes-detail-card__body clientes-detail-actions">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate(`/clientes?search=${cliente.NIF}`)}
                >
                  <List className="h-4 w-4 mr-2" aria-hidden />
                  Ver en lista de clientes
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
                  <Mail className="h-4 w-4 mr-2" aria-hidden />
                  Enviar email
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
                  <Phone className="h-4 w-4 mr-2" aria-hidden />
                  Llamar
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
                        <div key={mesKey} className="clientes-facturas-group">
                          <p className="clientes-facturas-group__title">
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
                                <li key={f.id} className="clientes-facturas-item">
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
   );
 }