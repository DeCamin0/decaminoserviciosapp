import { createContext, useContext, useState, useEffect } from 'react';
import { routes } from '../../../utils/routes';
import { AuthContext } from '../../../contexts/AuthContext';
import { PeriodoContext } from '../../../contexts/PeriodoContext';
import activityLogger from '../../../utils/activityLogger';

const FacturasContext = createContext();

export const useFacturas = () => {
  const context = useContext(FacturasContext);
  if (!context) {
    throw new Error('useFacturas must be used within a FacturasProvider');
  }
  return context;
};

export const FacturasProvider = ({ children }) => {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Use useContext directly - hooks must be called at top level unconditionally
  const periodoContext = useContext(PeriodoContext);
  const authContext = useContext(AuthContext);
  const { from, to } = periodoContext || { from: null, to: null };
  const user = authContext?.user || null;

  // Demo data for FacturasContext
  const setDemoFacturas = () => {
    const demoFacturas = [
      {
        id: 'DEMO_FAC_001',
        numero: 'FAC-2024-001',
        serie: 'Facturas Normales',
        cliente: 'C.P. Residencia Los Pinos',
        status: 'pagado',
        total: 2500.00,
        subtotal: 2066.12,
        totalTVA: 413.22,
        totalRetencion: 0,
        fecha: '2024-11-15T10:30:00Z',
        observaciones: 'Servicios de limpieza mensuales',
        created_at: '2024-11-15T10:30:00Z',
        updated_at: '2024-11-15T10:30:00Z'
      },
      {
        id: 'DEMO_FAC_002',
        numero: 'FAC-2024-002',
        serie: 'Facturas Normales',
        cliente: 'Hospital Universitario San Carlos',
        status: 'enviado',
        total: 15000.00,
        subtotal: 12396.69,
        totalTVA: 2479.34,
        totalRetencion: 0,
        fecha: '2024-11-20T14:15:00Z',
        observaciones: 'Limpieza quirófanos y áreas generales',
        created_at: '2024-11-20T14:15:00Z',
        updated_at: '2024-11-20T14:15:00Z'
      },
      {
        id: 'DEMO_FAC_003',
        numero: 'FAC-2024-003',
        serie: 'Facturas Rectificativas',
        cliente: 'Centro Comercial Plaza Norte',
        status: 'pendiente',
        total: 8500.00,
        subtotal: 7024.79,
        totalTVA: 1404.96,
        totalRetencion: 0,
        fecha: '2024-11-25T09:45:00Z',
        observaciones: 'Factura rectificativa por servicios adicionales',
        created_at: '2024-11-25T09:45:00Z',
        updated_at: '2024-11-25T09:45:00Z'
      },
      {
        id: 'DEMO_FAC_004',
        numero: 'FAC-2024-004',
        serie: 'Facturas Normales',
        cliente: 'Colegio Privado San Agustín',
        status: 'borrador',
        total: 3200.00,
        subtotal: 2644.63,
        totalTVA: 528.93,
        totalRetencion: 0,
        fecha: '2024-12-01T16:20:00Z',
        observaciones: 'Servicios de limpieza y conserjería',
        created_at: '2024-12-01T16:20:00Z',
        updated_at: '2024-12-01T16:20:00Z'
      },
      {
        id: 'DEMO_FAC_005',
        numero: 'FAC-2024-005',
        serie: 'Facturas Normales',
        cliente: 'Oficinas Corporativas TechCorp',
        status: 'efactura-pendiente',
        total: 5800.00,
        subtotal: 4793.39,
        totalTVA: 958.68,
        totalRetencion: 0,
        fecha: '2024-12-02T11:10:00Z',
        observaciones: 'Limpieza y recepción corporativa',
        created_at: '2024-12-02T11:10:00Z',
        updated_at: '2024-12-02T11:10:00Z'
      }
    ];
    setFacturas(demoFacturas);
    localStorage.setItem('facturas', JSON.stringify(demoFacturas));
  };

  // Carga las facturas desde localStorage al inicializar
  useEffect(() => {
    // Skip real data load in DEMO mode
    if (user?.isDemo) {
      console.log('🎭 DEMO mode: Using demo facturas data instead of loading from localStorage');
      setDemoFacturas();
      return;
    }

    const savedFacturas = localStorage.getItem('facturas');
    if (savedFacturas) {
      try {
        setFacturas(JSON.parse(savedFacturas));
      } catch (error) {
        console.error('Error loading facturas from localStorage:', error);
        setFacturas([]);
      }
    }
  }, [user?.isDemo]);

  // Guarda las facturas en localStorage cuando se modifican
  useEffect(() => {
    localStorage.setItem('facturas', JSON.stringify(facturas));
  }, [facturas]);

  // Carga desde backend (lista) al inicializar
  useEffect(() => {
    const loadFromServer = async () => {
      // Skip real data fetch in DEMO mode
      if (user?.isDemo) {
        console.log('🎭 DEMO mode: Skipping loadFromServer in FacturasContext');
        return;
      }

      try {
        const res = await fetch(routes.getFacturas);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped = data.map((it) => ({
            ...it,
            numero: it.numero || it.num_factura || it.num || '',
            serie: it.serie || it.Serie || 'normal',
            cliente: it.cliente || it.cliente_nombre || it.clienteNombre || 'Sin cliente',
            status: it.estado || it.status || 'pendiente',
            total: Number(it.total || 0),
            subtotal: Number(it.base_imponible || it.subtotal || 0),
            totalTVA: Number(it.iva || it.totalTVA || 0),
            totalRetencion: Number(it.retencion || it.totalRetencion || 0),
            fecha: it.fecha || it.created_at || new Date().toISOString(),
            observaciones: it.observaciones || ''
          }));
          setFacturas(mapped);
        }
      } catch (e) {
        // ignore
      }
    };
    loadFromServer();
  }, [user?.isDemo]);

  // Genera ID único para factura
  const generateFacturaId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `FAC-${timestamp}-${random}`;
  };

  // Genera el número automático de la factura
  const generateFacturaNumero = (serie = 'normal') => {
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Prefijo para cada serie
    const seriePrefix = {
      'Facturas Normales': 'FAC',
      'Facturas Rectificativas': 'RFAC',
      custom: 'CUSTOM'
    };
    
    const prefix = seriePrefix[serie] || serie || 'FAC';
    
    // Encuentra la última factura de esta serie, año y mes
    const pattern = new RegExp(`${prefix}-${currentYear}-${currentMonth}-(\\d+)`);
    const facturasThisMonth = facturas.filter(f => f?.numero && pattern.test(String(f.numero)));

    let nextNumber = 1;
    if (facturasThisMonth.length > 0) {
      // Extrae los números y encuentra el más grande
      const numbers = facturasThisMonth.map(f => {
        const m = String(f.numero).match(pattern);
        return m ? parseInt(m[1], 10) : 0;
      });
      nextNumber = Math.max(...numbers) + 1;
    }

    return `${prefix}-${currentYear}-${currentMonth}-${String(nextNumber).padStart(3, '0')}`;
  };

  // Calcula los totales para una factura
  const calculateTotals = (items, retencion = null, retenciones = []) => {
    console.log('🔢 calculateTotals called with:', {
      items: items,
      retencion: retencion,
      retenciones: retenciones
    });
    
    const subtotal = items.reduce((sum, item) => {
      const itemSubtotal = item.cantidad * item.precioUnitario;
      const descuento = itemSubtotal * ((item.descuento || 0) / 100);
      const itemTotal = itemSubtotal - descuento;
      console.log('📦 Item calculation:', {
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        itemSubtotal: itemSubtotal,
        descuento: descuento,
        itemTotal: itemTotal
      });
      return sum + itemTotal;
    }, 0);

    const totalTVA = items.reduce((sum, item) => {
      const itemSubtotal = item.cantidad * item.precioUnitario;
      const descuento = itemSubtotal * ((item.descuento || 0) / 100);
      const itemTotalWithDiscount = itemSubtotal - descuento;
      const tvaAmount = (itemTotalWithDiscount * item.tva) / 100;
      console.log('📊 TVA calculation:', {
        itemTotalWithDiscount: itemTotalWithDiscount,
        tva: item.tva,
        tvaAmount: tvaAmount
      });
      return sum + tvaAmount;
    }, 0);

    // Calcula retención
    let totalRetencion = 0;
    if (retencion && retenciones.length > 0) {
      // Convertim retencion la număr pentru comparație corectă
      const retencionId = parseInt(retencion);
      const retencionSeleccionada = retenciones.find(r => r.id === retencionId);
      console.log('🎯 Retención calculation:', {
        retencion: retencion,
        retencionId: retencionId,
        retencionSeleccionada: retencionSeleccionada,
        subtotal: subtotal
      });
      if (retencionSeleccionada) {
        totalRetencion = (subtotal * parseFloat(retencionSeleccionada.porcentaje)) / 100;
        console.log('💰 Retención calculated:', {
          porcentaje: retencionSeleccionada.porcentaje,
          totalRetencion: totalRetencion
        });
      }
    }

    const result = {
      subtotal: Number(subtotal.toFixed(2)),
      totalTVA: Number(totalTVA.toFixed(2)),
      totalRetencion: Number(totalRetencion.toFixed(2)),
      total: Number((subtotal + totalTVA - totalRetencion).toFixed(2))
    };
    
    console.log('✅ Final totals:', result);
    return result;
  };

  // Creează o factură nouă
  const createFactura = async (facturaData) => {
    try {
      setLoading(true);
      
      const isPaid = Boolean(facturaData.marcadaComoCobrada);
      const initialStatus = isPaid ? 'pagado' : 'pendiente';
      const newFactura = {
        id: generateFacturaId(),
        numero: facturaData.numero || generateFacturaNumero(facturaData.serie),
        serie: facturaData.serie || 'normal',
        serieCustom: facturaData.serieCustom || '',
        fecha: facturaData.fecha || new Date().toISOString(),
        fechaVencimiento: facturaData.fechaVencimiento,
        cliente: facturaData.cliente,
        items: facturaData.items || [],
        observaciones: facturaData.observaciones || '',
        retencion: facturaData.retencion || null,
        status: initialStatus, // pendiente sau pagado din start
        ...calculateTotals(facturaData.items || [], facturaData.retencion, facturaData.retenciones || []),
        createdBy: user?.email || 'unknown',
        createdAt: new Date().toISOString()
      };

      setFacturas(prev => [newFactura, ...prev]);

      // Log activitatea
      await activityLogger.logAction('factura_created', {
        facturaId: newFactura.id,
        cliente: newFactura.cliente,
        total: newFactura.total,
        user: user?.['NOMBRE / APELLIDOS'] || user?.nombre,
        email: user?.email
      });

      return { success: true, factura: newFactura };
    } catch (error) {
      console.error('Error creating factura:', error);
      return { success: false, error: 'Error al crear la factura' };
    } finally {
      setLoading(false);
    }
  };

  // Actualiza una factura existente
  const updateFactura = async (id, updates) => {
    try {
      setLoading(true);
      
      setFacturas(prev => prev.map(factura => {
        if (factura.id === id) {
          const updatedFactura = {
            ...factura,
            ...updates,
            ...calculateTotals(updates.items || factura.items, updates.retencion || factura.retencion, updates.retenciones || []),
            updatedAt: new Date().toISOString(),
            updatedBy: user?.email || 'unknown'
          };
          return updatedFactura;
        }
        return factura;
      }));

      // Log activitatea
      await activityLogger.logAction('factura_updated', {
        facturaId: id,
        updates,
        user: user?.['NOMBRE / APELLIDOS'] || user?.nombre,
        email: user?.email
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating factura:', error);
      return { success: false, error: 'Error al actualizar la factura' };
    } finally {
      setLoading(false);
    }
  };

  // Elimina una factura
  const deleteFactura = async (id) => {
    try {
      setLoading(true);
      
      const facturaToDelete = facturas.find(f => f.id === id);
      
      setFacturas(prev => prev.filter(factura => factura.id !== id));

      // Log activitatea
      await activityLogger.logAction('factura_deleted', {
        facturaId: id,
        cliente: facturaToDelete?.cliente,
        total: facturaToDelete?.total,
        user: user?.['NOMBRE / APELLIDOS'] || user?.nombre,
        email: user?.email
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting factura:', error);
      return { success: false, error: 'Error al eliminar la factura' };
    } finally {
      setLoading(false);
    }
  };

  // Schimbă statusul unei facturi
  const updateFacturaStatus = async (id, newStatus) => {
    try {
      setLoading(true);
      
      setFacturas(prev => prev.map(factura => {
        if (factura.id === id) {
          return {
            ...factura,
            status: newStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: user?.email || 'unknown'
          };
        }
        return factura;
      }));

      // Log activitatea
      await activityLogger.logAction('factura_status_changed', {
        facturaId: id,
        oldStatus: facturas.find(f => f.id === id)?.status,
        newStatus,
        user: user?.['NOMBRE / APELLIDOS'] || user?.nombre,
        email: user?.email
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating factura status:', error);
      return { success: false, error: 'Error al actualizar el estado de la factura' };
    } finally {
      setLoading(false);
    }
  };

  // Obține o factură după ID
  const getFacturaById = (id) => {
    return facturas.find(factura => factura.id === id);
  };

  // Filtrează facturile după status
  const getFacturasByStatus = (status) => {
    return facturas.filter(factura => factura.status === status);
  };

  // Obține statistici pentru facturi
  const getFacturasStats = () => {
    const inPeriod = (f) => {
      if (!from || !to) return true;
      const d = new Date(f.fecha);
      return d >= from && d <= to;
    };
    const scoped = facturas.filter(inPeriod);
    const total = scoped.length;
    const borrador = scoped.filter(f => f.status === 'borrador').length;
    const enviado = scoped.filter(f => f.status === 'enviado').length;
    const efacturaPendiente = scoped.filter(f => f.status === 'efactura-pendiente').length;
    const pagado = scoped.filter(f => f.status === 'pagado').length;
    const pendiente = scoped.filter(f => f.status === 'pendiente').length;
    
    const totalAmount = scoped.reduce((sum, f) => sum + Number(f.total || 0), 0);
    const paidAmount = scoped
      .filter(f => f.status === 'pagado')
      .reduce((sum, f) => sum + Number(f.total || 0), 0);

    return {
      total,
      borrador,
      enviado,
      efacturaPendiente,
      pagado,
      pendiente,
      totalAmount: Number(totalAmount.toFixed(2)),
      paidAmount: Number(paidAmount.toFixed(2)),
      pendingAmount: Number((totalAmount - paidAmount).toFixed(2))
    };
  };

  // Obține data ultimei facturi create (pentru validare)
  const getLastFacturaDate = () => {
    if (facturas.length === 0) return null;
    
    // Sortează facturile după dată și returnează data ultimei
    const sortedFacturas = [...facturas].sort((a, b) => {
      const dateA = new Date(a.fecha);
      const dateB = new Date(b.fecha);
      return dateB - dateA; // Descending order
    });
    
    return sortedFacturas[0].fecha;
  };

  const value = {
    facturas,
    loading,
    createFactura,
    updateFactura,
    deleteFactura,
    updateFacturaStatus,
    getFacturaById,
    getFacturasByStatus,
    getFacturasStats,
    calculateTotals,
    generateFacturaNumero,
    getLastFacturaDate
  };

  return (
    <FacturasContext.Provider value={value}>
      {children}
    </FacturasContext.Provider>
  );
}; 