import { useState, useEffect } from 'react';
import { useFacturas } from '../contexts/FacturasContext';
import { fetchClientes } from '../utils/pdfGenerator';
import { routes } from '../../../utils/routes';
import TooltipInfo from './TooltipInfo';
import { checkQuarterValidation, confirmOutsideQuarterOperation } from '../../../utils/quarterValidation';
import { useAuth } from '../../../contexts/AuthContext';
import { isDemoMode } from '../../../utils/demo';

const FacturaForm = ({ facturaToEdit = null, onSave, onCancel }) => {
  const { createFactura, updateFactura, calculateTotals, generateFacturaNumero, getLastFacturaDate } = useFacturas();
  const { user } = useAuth();

  // Funcții demo pentru date fictive
  const getDemoClientes = () => [
    { NIF: '12345678A', 'NOMBRE O RAZON SOCIAL': 'Empresa Demo 1', tipo: 'cliente' },
    { NIF: '87654321B', 'NOMBRE O RAZON SOCIAL': 'Empresa Demo 2', tipo: 'cliente' },
    { NIF: '11223344C', 'NOMBRE O RAZON SOCIAL': 'Cliente Demo 3', tipo: 'cliente' },
    { NIF: '44332211D', 'NOMBRE O RAZON SOCIAL': 'Empresa Ficticia 4', tipo: 'cliente' },
    { NIF: '55667788E', 'NOMBRE O RAZON SOCIAL': 'Cliente Test 5', tipo: 'cliente' }
  ];

  const getDemoFacturaSeries = () => [
    { id: 1, nombre: 'Normal', formato: 'FAC-{YYYY}-{NNNN}' },
    { id: 2, nombre: 'Rectificativa', formato: 'RFA-{YYYY}-{NNNN}' },
    { id: 3, nombre: 'Abono', formato: 'ABO-{YYYY}-{NNNN}' }
  ];

  const getDemoTiposIngreso = () => [
    { id: 1, nombre: 'Servicios profesionales', porcentaje: 21 },
    { id: 2, nombre: 'Productos', porcentaje: 21 },
    { id: 3, nombre: 'Servicios reducidos', porcentaje: 10 },
    { id: 4, nombre: 'Productos reducidos', porcentaje: 10 }
  ];

  const getDemoRetenciones = () => [
    { id: 1, nombre: 'Sin retención', porcentaje: 0 },
    { id: 2, nombre: 'Retención 15%', porcentaje: 15 },
    { id: 3, nombre: 'Retención 19%', porcentaje: 19 }
  ];

  const getDemoNotasFactura = () => [
    { id: 1, titulo: 'Nota estándar', descripcion: 'Factura emitida según normativa vigente' },
    { id: 2, titulo: 'Pago diferido', descripcion: 'Vencimiento a 30 días' },
    { id: 3, titulo: 'Descuento', descripcion: 'Descuento por pronto pago aplicado' }
  ];

  const getDemoMetodosPago = () => [
    { id: 1, tipo: 'Efectivo', nombre: 'Efectivo', numero: '', cuenta: '' },
    { id: 2, tipo: 'Transferencia', nombre: 'Transferencia bancaria', numero: 'ES12345678901234567890', cuenta: 'Banco Demo' },
    { id: 3, tipo: 'Tarjeta', nombre: 'Tarjeta de crédito', numero: '**** **** **** 1234', cuenta: 'Terminal POS' }
  ];

  // State pentru lista de clienți
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  
  // State pentru serii
  const [facturaSeries, setFacturaSeries] = useState([]);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [showSerieModal, setShowSerieModal] = useState(false);
  const [newSerieName, setNewSerieName] = useState('');
  const [newSerieFormat, setNewSerieFormat] = useState('');
  const [savingSerie, setSavingSerie] = useState(false);
  
  // State pentru tipuri de ingreso
  const [tiposIngreso, setTiposIngreso] = useState([]);
  const [loadingTiposIngreso, setLoadingTiposIngreso] = useState(true);
  
  // State pentru retenciones
  const [retenciones, setRetenciones] = useState([]);
  const [loadingRetenciones, setLoadingRetenciones] = useState(true);
  
  // State pentru note și modal
  const [notasFactura, setNotasFactura] = useState([]);
  const [loadingNotas, setLoadingNotas] = useState(true);
  const [showNotasModal, setShowNotasModal] = useState(false);
  const [newNotaTitulo, setNewNotaTitulo] = useState('');
  const [newNotaDescripcion, setNewNotaDescripcion] = useState('');
  const [savingNota, setSavingNota] = useState(false);
  
  // State pentru metodele de plată
  const [metodosPago, setMetodosPago] = useState([]);
  const [loadingMetodos, setLoadingMetodos] = useState(true);
  const [showMetodosModal, setShowMetodosModal] = useState(false);
  const [newMetodoTipo, setNewMetodoTipo] = useState('Efectivo');
  const [newMetodoNombre, setNewMetodoNombre] = useState('');
  const [newMetodoNumero, setNewMetodoNumero] = useState('');
  const [newMetodoCuenta, setNewMetodoCuenta] = useState('');
  const [savingMetodo, setSavingMetodo] = useState(false);
  
  const [formData, setFormData] = useState({
    numero: '',
    serie: 'normal', // normal, rectificativa, sau custom
    serieCustom: '', // pentru serii personalizate
    fecha: '',
    fechaVencimiento: '',
    tipoIngreso: '', // tipul de ingreso
    cliente: '',
    notasPrivadas: '', // note private pentru uz intern
    retencion: '', // retención fiscal
    notaFactura: '', // nota pentru factura
    marcadaComoCobrada: false, // factura marcată ca plătită
    fechaPago: '', // data plății
    metodoPago: '', // metoda de plată
    items: [
      {
        descripcion: '',
        cantidad: 1,
        precioUnitario: 0,
        tva: 21, // TVA standard în Spania
        descuento: 0 // Descuento în procente
      }
    ],
    observaciones: '',
    subtotal: 0,
    totalTVA: 0,
    totalRetencion: 0,
    total: 0
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Funcție pentru încărcarea seriilor de facturi
  const fetchFacturaSeries = async () => {
    try {
      console.log('Fetching factura series from:', routes.getFacturaSeries);
      const response = await fetch(routes.getFacturaSeries);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Factura series data received:', data);
      
      const seriesData = Array.isArray(data) ? data : [];
      return seriesData;
    } catch (error) {
      console.error('Error fetching factura series:', error);
      return [];
    }
  };

  // Funcție pentru încărcarea tipurilor de ingreso
  const fetchTiposIngreso = async () => {
    try {
      console.log('Fetching tipos de ingreso from:', routes.getTiposIngreso);
      const response = await fetch(routes.getTiposIngreso);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Tipos de ingreso data received:', data);
      
      const tiposData = Array.isArray(data) ? data : [];
      return tiposData;
    } catch (error) {
      console.error('Error fetching tipos de ingreso:', error);
      return [];
    }
  };

  // Funcție pentru încărcarea retenciones
  const fetchRetenciones = async () => {
    try {

      
      console.log('Fetching retenciones from:', routes.getRetenciones);
      const response = await fetch(routes.getRetenciones);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Retenciones data received:', data);
      
      const retencionesData = Array.isArray(data) ? data : [];
      return retencionesData;
    } catch (error) {
      console.error('Error fetching retenciones:', error);
      return [];
    }
  };

  // Funcție pentru încărcarea notelor din API
  const fetchNotasFactura = async () => {
    try {
      console.log('Fetching notas factura from:', routes.getNotasFactura);
      const response = await fetch(routes.getNotasFactura);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Notas factura data received:', data);
      
      // Añade IDs para cada nota si no existen
      const notasData = Array.isArray(data) ? data.map((nota, index) => ({
        ...nota,
        id: nota.id || index + 1
      })) : [];
      
      return notasData;
    } catch (error) {
      console.error('Error fetching notas factura:', error);
      return [];
    }
  };

  // Funcție pentru încărcarea metodelor de plată din API
  const fetchMetodosPago = async () => {
    try {
      console.log('Fetching metodos de pago from:', routes.getMetodosPago);
      const response = await fetch(routes.getMetodosPago);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Metodos de pago data received:', data);
      
      // Procesa los datos del API y añade iconos
      const metodosData = Array.isArray(data) ? data.map(metodo => {
        let icono = '💳'; // default icon
        
        // Asigna iconos según el tipo de método
        if (metodo.tipo_metodo === 'Transferencia') {
          icono = '🏦';
        } else if (metodo.tipo_metodo === 'Efectivo') {
          icono = '💵';
        } else if (metodo.tipo_metodo === 'Tarjeta') {
          icono = '💳';
        }
        
        return {
          ...metodo,
          icono: icono
        };
      }) : [];
      
      return metodosData;
    } catch (error) {
      console.error('Error fetching metodos de pago:', error);
      return [];
    }
  };

  // Carga la lista de clientes, series, tipos de ingreso y retenciones al montar el componente
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingClientes(true);
        setLoadingSeries(true);
        setLoadingTiposIngreso(true);
        setLoadingRetenciones(true);
        setLoadingNotas(true);
        setLoadingMetodos(true);
        
        // Verifica si está en modo demo
        if (user?.isDemo || isDemoMode()) {
          console.log('🎭 DEMO mode: Using demo data for FacturaForm');
          setClientes(getDemoClientes());
          setFacturaSeries(getDemoFacturaSeries());
          setTiposIngreso(getDemoTiposIngreso());
          setRetenciones(getDemoRetenciones());
          setNotasFactura(getDemoNotasFactura());
          setMetodosPago(getDemoMetodosPago());
        } else {
          // Carga clientes, series, tipos de ingreso, retenciones, notas y métodos de pago en paralelo
          const [clientesData, seriesData, tiposData, retencionesData, notasData, metodosData] = await Promise.all([
            fetchClientes(),
            fetchFacturaSeries(),
            fetchTiposIngreso(),
            fetchRetenciones(),
            fetchNotasFactura(),
            fetchMetodosPago()
          ]);
          
          setClientes(clientesData);
          setFacturaSeries(seriesData);
          setTiposIngreso(tiposData);
          setRetenciones(retencionesData);
          setNotasFactura(notasData);
          setMetodosPago(metodosData);
          console.log('Clientes loaded in form:', clientesData.length);
          console.log('Factura series loaded in form:', seriesData.length);
          console.log('Tipos de ingreso loaded in form:', tiposData.length);
          console.log('Retenciones loaded in form:', retencionesData.length);
          console.log('Notas factura loaded in form:', notasData.length);
          console.log('Metodos de pago loaded in form:', metodosData.length);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoadingClientes(false);
        setLoadingSeries(false);
        setLoadingTiposIngreso(false);
        setLoadingRetenciones(false);
        setLoadingNotas(false);
        setLoadingMetodos(false);
      }
    };

    loadData();
  }, [user?.isDemo]);

  // Inicializa el formulario con los datos de la factura a editar o genera el número automático
  useEffect(() => {
    if (facturaToEdit) {
      setFormData({
        numero: facturaToEdit.numero || '',
        serie: facturaToEdit.serie || 'normal',
        serieCustom: facturaToEdit.serieCustom || '',
        fecha: facturaToEdit.fecha || '',
        fechaVencimiento: facturaToEdit.fechaVencimiento || '',
        tipoIngreso: facturaToEdit.tipoIngreso || '',
        cliente: facturaToEdit.cliente || '',
        notasPrivadas: facturaToEdit.notasPrivadas || '',
        retencion: facturaToEdit.retencion || '',
        notaFactura: facturaToEdit.notaFactura || '',
        marcadaComoCobrada: facturaToEdit.marcadaComoCobrada || false,
        fechaPago: facturaToEdit.fechaPago || '',
        metodoPago: facturaToEdit.metodoPago || '',
        items: facturaToEdit.items?.length > 0 ? facturaToEdit.items : [
          {
            descripcion: '',
            cantidad: 1,
            precioUnitario: 0,
            tva: 21
          }
        ],
        observaciones: facturaToEdit.observaciones || ''
      });
    } else {
      // Genera el número automático y establece la fecha de hoy para facturas nuevas
      const defaultSerie = facturaSeries.length > 0 ? facturaSeries[0].Serie : 'normal';
      const autoNumero = generateFacturaNumero(defaultSerie);
      const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
      setFormData(prev => ({
        ...prev,
        numero: autoNumero,
        serie: defaultSerie,
        fecha: today
      }));
    }
  }, [facturaToEdit, generateFacturaNumero, facturaSeries]);

  // Calcula los totales cuando se modifican los items
  useEffect(() => {
    console.log('🔄 useEffect - recalculating totals:', {
      items: formData.items,
      retencion: formData.retencion,
      retenciones: retenciones
    });
    
    // Log detaliat pentru fiecare item
    formData.items.forEach((item, index) => {
      console.log(`📦 Item ${index}:`, {
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        tva: item.tva,
        descuento: item.descuento,
        subtotal: item.cantidad * item.precioUnitario
      });
    });
    
    const totals = calculateTotals(formData.items, formData.retencion, retenciones);
    console.log('💰 Calculated totals:', totals);
    
    setFormData(prev => ({
      ...prev,
      ...totals
    }));
  }, [formData.items, formData.retencion, retenciones, calculateTotals]);

  // Valida el formulario
  const validateForm = () => {
    const newErrors = {};

    if (!formData.cliente.trim()) {
      newErrors.cliente = 'El cliente es obligatorio';
    }

    if (!formData.numero.trim()) {
      newErrors.numero = 'El número de factura es obligatorio';
    }

    if (!formData.fecha) {
      newErrors.fecha = 'La fecha de creación es obligatoria';
    } else {
      // Verifica si la fecha no es inferior a la fecha de la última factura
      const lastFacturaDate = getLastFacturaDate();
      
      if (lastFacturaDate && !facturaToEdit) {
        const selectedDate = new Date(formData.fecha);
        const lastDate = new Date(lastFacturaDate);
        
        if (selectedDate < lastDate) {
          newErrors.fecha = `La fecha no puede ser anterior a la última factura (${lastDate.toLocaleDateString('es-ES')})`;
        }
      }
      
      // Verifica si la fecha está fuera del trimestre actual
      const quarterValidation = checkQuarterValidation(formData.fecha);
      if (quarterValidation.isOutsideQuarter) {
        // Nu punem eroare, doar afișăm un avertisment
        console.log('⚠️ Fecha fuera del trimestre actual:', quarterValidation.message);
      }
    }

    if (!formData.tipoIngreso) {
      newErrors.tipoIngreso = 'El tipo de ingreso es obligatorio';
    }

    // Valida items
    formData.items.forEach((item, index) => {
      if (!item.descripcion.trim()) {
        newErrors[`items.${index}.descripcion`] = 'La descripción es obligatoria';
      }
      if (item.cantidad <= 0) {
        newErrors[`items.${index}.cantidad`] = 'La cantidad debe ser mayor a 0';
      }
      if (item.precioUnitario < 0) {
        newErrors[`items.${index}.precioUnitario`] = 'El precio no puede ser negativo';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Gestiona las modificaciones en los campos principales
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Elimina el error para este campo
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }

    // Validare specială pentru data facturii
    if (field === 'fecha' && value && !facturaToEdit) {
      const lastFacturaDate = getLastFacturaDate();
      
      if (lastFacturaDate) {
        const selectedDate = new Date(value);
        const lastDate = new Date(lastFacturaDate);
        
        if (selectedDate < lastDate) {
          setErrors(prev => ({
            ...prev,
            fecha: `La fecha no puede ser anterior a la última factura (${lastDate.toLocaleDateString('es-ES')})`
          }));
        }
      }
      
      // Verifica si la fecha está fuera del trimestre actual
      const quarterValidation = checkQuarterValidation(value);
      if (quarterValidation.isOutsideQuarter) {
        console.log('⚠️ Fecha fuera del trimestre actual:', quarterValidation.message);
      }
    }

    // Dacă s-a schimbat clientul, aplică descuento-ul implicit
    if (field === 'cliente' && value) {
      applyClientDefaultDiscount(value);
    }

    // Si se cambió la retención, recalcula los totales
    if (field === 'retencion') {
      console.log('🔄 handleInputChange - retención changed:', value);
      console.log('📊 Available retenciones:', retenciones);
      
      // Convertim value la număr pentru comparație corectă
      const retencionId = parseInt(value);
      const retencionSeleccionada = retenciones.find(r => r.id === retencionId);
      console.log('🎯 Selected retención:', retencionSeleccionada);
      
      // Recalcula subtotal y totalTVA de los items actuales
      const currentSubtotal = formData.items.reduce((sum, item) => {
        const itemSubtotal = item.cantidad * item.precioUnitario;
        const descuento = itemSubtotal * ((item.descuento || 0) / 100);
        return sum + (itemSubtotal - descuento);
      }, 0);

      const currentTotalTVA = formData.items.reduce((sum, item) => {
        const itemSubtotal = item.cantidad * item.precioUnitario;
        const descuento = itemSubtotal * ((item.descuento || 0) / 100);
        const itemTotalWithDiscount = itemSubtotal - descuento;
        const tvaAmount = (itemTotalWithDiscount * item.tva) / 100;
        return sum + tvaAmount;
      }, 0);
      
      if (retencionSeleccionada) {
        const retentionPercentage = parseFloat(retencionSeleccionada.porcentaje);
        
        console.log('📈 Calculation values:', {
          currentSubtotal: currentSubtotal,
          currentTotalTVA: currentTotalTVA,
          retentionPercentage: retentionPercentage
        });
        
        if (!isNaN(currentSubtotal) && !isNaN(retentionPercentage)) {
          const totalRetencion = (currentSubtotal * retentionPercentage) / 100;
          const newTotal = currentSubtotal + currentTotalTVA - totalRetencion;
          
          console.log('💰 Calculated values:', {
            totalRetencion: totalRetencion,
            newTotal: newTotal
          });
          
          setFormData(prev => ({
            ...prev,
            subtotal: Number(currentSubtotal.toFixed(2)),
            totalTVA: Number(currentTotalTVA.toFixed(2)),
            totalRetencion: Number(totalRetencion.toFixed(2)),
            total: Number(newTotal.toFixed(2))
          }));
        } else {
          console.warn('❌ Invalid values for calculation');
          setFormData(prev => ({
            ...prev,
            subtotal: Number(currentSubtotal.toFixed(2)),
            totalTVA: Number(currentTotalTVA.toFixed(2)),
            totalRetencion: 0,
            total: Number((currentSubtotal + currentTotalTVA).toFixed(2))
          }));
        }
      } else {
        console.log('❌ No retención selected, resetting to 0');
        setFormData(prev => ({
          ...prev,
          subtotal: Number(currentSubtotal.toFixed(2)),
          totalTVA: Number(currentTotalTVA.toFixed(2)),
          totalRetencion: 0,
          total: Number((currentSubtotal + currentTotalTVA).toFixed(2))
        }));
      }
    }
  };

  // Funcție pentru a aplica descuento-ul implicit al clientului
  const applyClientDefaultDiscount = (clienteNombre) => {
    const clienteSeleccionado = clientes.find(c => c['NOMBRE O RAZON SOCIAL'] === clienteNombre);
    
    if (clienteSeleccionado) {
      // Caută câmpul corect pentru descuento (DESCUENTO POR DEFECTO)
      const descuentoDefault = clienteSeleccionado['DESCUENTO POR DEFECTO'] ? parseFloat(clienteSeleccionado['DESCUENTO POR DEFECTO']) : 0;
      
      console.log('Cliente seleccionado:', clienteSeleccionado);
      console.log('Descuento por defecto encontrado:', descuentoDefault);
      
      if (!isNaN(descuentoDefault) && descuentoDefault > 0) {
        console.log(`Aplicando descuento por defecto del cliente: ${descuentoDefault}%`);
        
        // Aplică descuento-ul la toate itemii existente
        setFormData(prev => ({
          ...prev,
          items: prev.items.map(item => ({
            ...item,
            descuento: descuentoDefault
          }))
        }));
        
        // Muestra un mensaje informativo
        alert(`Se ha aplicado automáticamente el descuento por defecto del cliente: ${descuentoDefault}%`);
      } else {
        // Si el cliente no tiene descuento por defecto, resetea a 0
        console.log('Cliente sin descuento por defecto, reseteando a 0%');
        
        setFormData(prev => ({
          ...prev,
          items: prev.items.map(item => ({
            ...item,
            descuento: 0
          }))
        }));
      }
    }
  };

  // Gestiona las modificaciones en items
  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const newItems = prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      );
      
      // Recalcula los totales
      const subtotal = newItems.reduce((sum, item) => {
        const itemSubtotal = item.cantidad * item.precioUnitario;
        const descuento = itemSubtotal * ((item.descuento || 0) / 100);
        return sum + (itemSubtotal - descuento);
      }, 0);

      const totalTVA = newItems.reduce((sum, item) => {
        const itemSubtotal = item.cantidad * item.precioUnitario;
        const descuento = itemSubtotal * ((item.descuento || 0) / 100);
        const itemTotalWithDiscount = itemSubtotal - descuento;
        const tvaAmount = (itemTotalWithDiscount * item.tva) / 100;
        return sum + tvaAmount;
      }, 0);

      // Calcula retención
      let totalRetencion = 0;
      if (prev.retencion && retenciones.length > 0) {
        // Convertim prev.retencion la număr pentru comparație corectă
        const retencionId = parseInt(prev.retencion);
        const retencionSeleccionada = retenciones.find(r => r.id === retencionId);
        if (retencionSeleccionada) {
          const retentionPercentage = parseFloat(retencionSeleccionada.porcentaje);
          if (!isNaN(subtotal) && !isNaN(retentionPercentage)) {
            totalRetencion = (subtotal * retentionPercentage) / 100;
            console.log('🔄 handleItemChange - recalculated retención:', {
              subtotal: subtotal,
              retentionPercentage: retentionPercentage,
              totalRetencion: totalRetencion
            });
          } else {
            console.warn('❌ Invalid values for retención calculation in handleItemChange');
          }
        }
      }

      return {
        ...prev,
        items: newItems,
        subtotal: Number(subtotal.toFixed(2)),
        totalTVA: Number(totalTVA.toFixed(2)),
        totalRetencion: Number(totalRetencion.toFixed(2)),
        total: Number((subtotal + totalTVA - totalRetencion).toFixed(2))
      };
    });

    // Elimina el error para este item
    const errorKey = `items.${index}.${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({
        ...prev,
        [errorKey]: undefined
      }));
    }
  };

  // Añade un item nuevo
  const addItem = () => {
    setFormData(prev => {
      // Determina el descuento por defecto para items nuevos
      let descuentoDefault = 0;
      if (prev.cliente) {
        const clienteSeleccionado = clientes.find(c => c['NOMBRE O RAZON SOCIAL'] === prev.cliente);
        if (clienteSeleccionado && clienteSeleccionado['DESCUENTO POR DEFECTO']) {
          const descuento = parseFloat(clienteSeleccionado['DESCUENTO POR DEFECTO']);
          if (!isNaN(descuento) && descuento > 0) {
            descuentoDefault = descuento;
          }
        }
      }

      return {
        ...prev,
        items: [
          ...prev.items,
          {
            descripcion: '',
            cantidad: 1,
            precioUnitario: 0,
            tva: 21,
            descuento: descuentoDefault
          }
        ]
      };
    });
  };

  // Elimina un item
  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  // Guarda la factura
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Verifica si la fecha está fuera del trimestre actual y pide confirmación
    const quarterValidation = checkQuarterValidation(formData.fecha);
    if (quarterValidation.isOutsideQuarter) {
      const confirmed = await confirmOutsideQuarterOperation(quarterValidation.message);
      if (!confirmed) {
        console.log('❌ Usuario canceló la operación fuera del trimestre');
        return;
      }
      console.log('✅ Usuario confirmó la operación fuera del trimestre');
    }

    setLoading(true);
    
    try {
      let result;
      
      if (facturaToEdit) {
        // Actualiza la factura existente
        result = await updateFactura(facturaToEdit.id, {
          ...formData,
          retenciones: retenciones
        });
      } else {
        // Creează factură nouă
        result = await createFactura({
          ...formData,
          retenciones: retenciones
        });
      }

      if (result.success) {
        onSave && onSave(result.factura || facturaToEdit);
      } else {
        alert(result.error || 'Error al guardar la factura');
      }
    } catch (error) {
      console.error('Error saving factura:', error);
      alert('Error al guardar la factura');
    } finally {
      setLoading(false);
    }
  };

  // Calcula el total para un item
  const calculateItemTotal = (item) => {
    const subtotal = (item.cantidad || 0) * (item.precioUnitario || 0);
    const descuento = subtotal * ((item.descuento || 0) / 100);
    const totalWithDiscount = subtotal - descuento;
    return totalWithDiscount;
  };

  // Funcție helper pentru calcularea datei de vencimiento
  const calculateVencimientoDate = (days) => {
    // Folosește data de creație dacă există, altfel data curentă
    const baseDate = formData.fecha ? new Date(formData.fecha) : new Date();
    baseDate.setDate(baseDate.getDate() + days);
    return baseDate.toISOString().split('T')[0];
  };

  // Funcții pentru gestionarea seriilor
  const getSerieInfo = (serieType) => {
    // Encuentra la serie en la lista cargada del API
    const serieFromAPI = facturaSeries.find(s => s.Serie === serieType);
    
    if (serieFromAPI) {
      return {
        name: serieFromAPI.Serie,
        format: serieFromAPI.Formato || 'FAC-AAAA-MM-###'
      };
    }
    
    // Fallback pentru serii hardcodate
    const series = {
      normal: { name: 'Facturas normales', format: 'FAC-AAAA-MM-###' },
      rectificativa: { name: 'Facturas rectificativas', format: 'RFAC-AAAA-MM-###' },
      custom: { name: formData.serieCustom, format: formData.serieCustom }
    };
    return series[serieType] || series.normal;
  };

  const handleSerieChange = (serieType) => {
    setFormData(prev => ({
      ...prev,
      serie: serieType,
      serieCustom: serieType === 'custom' ? prev.serieCustom : ''
    }));
    
    // Genera un número nuevo para la serie seleccionada
    if (!facturaToEdit && serieType) {
      const newNumero = generateFacturaNumero(serieType);
      setFormData(prev => ({
        ...prev,
        numero: newNumero
      }));
    }
  };

  const handleCreateNewSerie = async () => {
    if (newSerieName.trim() && newSerieFormat.trim()) {
      // Verifica si la serie ya existe
      const existingSerie = facturaSeries.find(s => s.Serie === newSerieName.trim());
      if (existingSerie) {
        alert('Ya existe una serie con este nombre. Por favor, elige otro nombre.');
        return;
      }

      setSavingSerie(true);
      try {
        // Guarda la serie nueva en la base de datos
        const response = await fetch(routes.saveFacturaSeries, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            Serie: newSerieName.trim(),
            Formato: newSerieFormat.trim()
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Serie saved successfully:', result);

        // Añade la serie nueva a la lista local
        const newSerie = {
          Serie: newSerieName.trim(),
          Formato: newSerieFormat.trim()
        };
        setFacturaSeries(prev => [...prev, newSerie]);

        // Setează seria nouă ca selectată
        setFormData(prev => ({
          ...prev,
          serie: newSerieName.trim(),
          serieCustom: ''
        }));
        
        // Genera un número nuevo para la serie personalizada
        if (!facturaToEdit) {
          const newNumero = generateFacturaNumero(newSerieName.trim());
          setFormData(prev => ({
            ...prev,
            numero: newNumero
          }));
        }
        
        setShowSerieModal(false);
        setNewSerieName('');
        setNewSerieFormat('');
      } catch (error) {
        console.error('Error saving new serie:', error);
        alert('Error al guardar la nueva serie. Por favor, inténtalo de nuevo.');
      } finally {
        setSavingSerie(false);
      }
    }
  };

  const handleCloseSerieModal = () => {
    setShowSerieModal(false);
    setNewSerieName('');
    setNewSerieFormat('');
    setSavingSerie(false);
    // Resetează dropdown-ul la seria anterioară sau prima serie din listă
    if (!formData.serie || formData.serie === 'crear_nueva') {
      const defaultSerie = facturaSeries.length > 0 ? facturaSeries[0].Serie : '';
      setFormData(prev => ({
        ...prev,
        serie: defaultSerie
      }));
    }
  };

  // Funcții pentru gestionarea modalului de note
  const handleCreateNewNota = async () => {
    if (newNotaTitulo.trim() && newNotaDescripcion.trim()) {
      setSavingNota(true);
      try {
        console.log('Saving new nota to:', routes.saveNotasFactura);
        console.log('Data:', { titulo: newNotaTitulo, descripcion: newNotaDescripcion });
        
        // POST request către endpoint-ul real
        const response = await fetch(routes.saveNotasFactura, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            titulo: newNotaTitulo.trim(),
            descripcion: newNotaDescripcion.trim()
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Nota saved successfully:', result);

        // Añade la nota nueva a la lista local
        const newNota = {
          id: Date.now(), // sau result.id dacă API-ul returnează ID
          titulo: newNotaTitulo.trim(),
          descripcion: newNotaDescripcion.trim()
        };
        
        setNotasFactura(prev => [...prev, newNota]);
        setShowNotasModal(false);
        setNewNotaTitulo('');
        setNewNotaDescripcion('');
      } catch (error) {
        console.error('Error saving new nota:', error);
        alert('Error al guardar la nueva nota. Por favor, inténtalo de nuevo.');
      } finally {
        setSavingNota(false);
      }
    }
  };

  const handleCloseNotasModal = () => {
    setShowNotasModal(false);
    setNewNotaTitulo('');
    setNewNotaDescripcion('');
    setSavingNota(false);
  };

  const handleDeleteNota = (notaId) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
      setNotasFactura(prev => prev.filter(nota => nota.id !== notaId));
    }
  };

  // Funcție pentru gestionarea checkbox-ului de plată
  const handleMarcadaComoCobradaChange = (checked) => {
    setFormData(prev => ({
      ...prev,
      marcadaComoCobrada: checked,
      fechaPago: checked ? new Date().toISOString().split('T')[0] : '',
      metodoPago: checked ? (metodosPago.length > 0 ? metodosPago[0].id.toString() : '') : ''
    }));
  };

  // Funcții pentru gestionarea modalului de metode de plată
  const handleCreateNewMetodo = async () => {
    if (newMetodoNombre.trim() && newMetodoNumero.trim()) {
      setSavingMetodo(true);
      try {
        console.log('Saving new metodo to:', routes.saveMetodosPago);
        console.log('Data:', { 
          tipo_metodo: newMetodoTipo, 
          nombre: newMetodoNombre, 
          numero_tarjeta_o_cuenta: newMetodoNumero,
          cuenta_vinculada: newMetodoCuenta
        });
        
        // POST request către endpoint-ul real
        const response = await fetch(routes.saveMetodosPago, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tipo_metodo: newMetodoTipo,
            nombre: newMetodoNombre.trim(),
            numero_tarjeta_o_cuenta: newMetodoNumero.trim(),
            cuenta_vinculada: newMetodoCuenta.trim()
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Metodo saved successfully:', result);

        // Añade el método nuevo a la lista local
        const newMetodo = {
          id: Date.now(), // sau result.id dacă API-ul returnează ID
          tipo_metodo: newMetodoTipo,
          nombre: newMetodoNombre.trim(),
          numero_tarjeta_o_cuenta: newMetodoNumero.trim(),
          cuenta_vinculada: newMetodoCuenta.trim()
        };
        
        setMetodosPago(prev => [...prev, newMetodo]);
        setShowMetodosModal(false);
        setNewMetodoTipo('Efectivo');
        setNewMetodoNombre('');
        setNewMetodoNumero('');
        setNewMetodoCuenta('');
      } catch (error) {
        console.error('Error saving new metodo:', error);
        alert('Error al guardar el nuevo método. Por favor, inténtalo de nuevo.');
      } finally {
        setSavingMetodo(false);
      }
    }
  };

  const handleCloseMetodosModal = () => {
    setShowMetodosModal(false);
    setNewMetodoTipo('Efectivo');
    setNewMetodoNombre('');
    setNewMetodoNumero('');
    setNewMetodoCuenta('');
    setSavingMetodo(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-6">
        <button
          onClick={onCancel}
          className="mr-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          title="Regresar"
        >
          <span className="text-gray-600 text-lg">←</span>
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          {facturaToEdit ? 'Editar Factura' : 'Nueva Factura'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informații de bază */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número de Factura *
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={formData.numero}
                onChange={(e) => handleInputChange('numero', e.target.value)}
                className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${
                  errors.numero ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="FAC-2024-001"
              />
              {!facturaToEdit && (
                <button
                  type="button"
                  onClick={() => {
                    const newNumero = generateFacturaNumero(formData.serie);
                    handleInputChange('numero', newNumero);
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                  title="Generar nuevo número"
                >
                  🔄
                </button>
              )}
            </div>
            {errors.numero && (
              <p className="text-red-500 text-sm mt-1">{errors.numero}</p>
            )}
            {!facturaToEdit && (
              <p className="text-xs text-gray-500 mt-1">
                💡 Puedes editar las últimas cifras del número automático
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Serie
            </label>
            <div className="relative">
              <select
                value={formData.serie === 'crear_nueva' ? '' : formData.serie}
                onChange={(e) => {
                  if (e.target.value === 'crear_nueva') {
                    setShowSerieModal(true);
                    // Nu schimba seria când se deschide modalul
                  } else {
                    handleSerieChange(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={loadingSeries}
              >
                <option value="">{loadingSeries ? 'Cargando series...' : 'Seleccione una serie'}</option>
                {!loadingSeries && facturaSeries.map(serie => (
                  <option key={serie.Serie} value={serie.Serie}>
                    {serie.Serie}
                  </option>
                ))}
                {formData.serieCustom && (
                  <option value="custom">{formData.serieCustom}</option>
                )}
                <option value="crear_nueva" className="text-blue-600 font-medium">
                  ➕ Crear nueva serie
                </option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Formato: {getSerieInfo(formData.serie).format}
            </p>
          </div>
        </div>

        {/* Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha de Creación *
            </label>
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => handleInputChange('fecha', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.fecha ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.fecha && (
              <p className="text-red-500 text-sm mt-1">{errors.fecha}</p>
            )}
            {!facturaToEdit && !errors.fecha && (
              <p className="text-xs text-blue-600 mt-1">
                💡 La fecha debe ser igual o posterior a la última factura creada
              </p>
            )}
            {formData.fecha && !errors.fecha && (() => {
              const quarterValidation = checkQuarterValidation(formData.fecha);
              if (quarterValidation.isOutsideQuarter) {
                return (
                  <p className="text-xs text-orange-600 mt-1">
                    ⚠️ {quarterValidation.message}
                  </p>
                );
              }
              return null;
            })()}
          </div>

                     <div>
             <label className="block text-sm font-medium text-gray-700 mb-2">
               Fecha de Vencimiento
             </label>
             <input
               type="date"
               value={formData.fechaVencimiento}
               onChange={(e) => handleInputChange('fechaVencimiento', e.target.value)}
               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
             />
             <div className="flex flex-wrap gap-2 mt-2">
               <button
                 type="button"
                 onClick={() => handleInputChange('fechaVencimiento', calculateVencimientoDate(30))}
                 className={`px-3 py-1 text-xs rounded-md transition-colors ${
                   formData.fechaVencimiento === calculateVencimientoDate(30)
                     ? 'bg-blue-500 text-white'
                     : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                 }`}
               >
                 30 días
               </button>
               <button
                 type="button"
                 onClick={() => handleInputChange('fechaVencimiento', calculateVencimientoDate(60))}
                 className={`px-3 py-1 text-xs rounded-md transition-colors ${
                   formData.fechaVencimiento === calculateVencimientoDate(60)
                     ? 'bg-green-500 text-white'
                     : 'bg-green-100 text-green-700 hover:bg-green-200'
                 }`}
               >
                 60 días
               </button>
               <button
                 type="button"
                 onClick={() => handleInputChange('fechaVencimiento', calculateVencimientoDate(90))}
                 className={`px-3 py-1 text-xs rounded-md transition-colors ${
                   formData.fechaVencimiento === calculateVencimientoDate(90)
                     ? 'bg-orange-500 text-white'
                     : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                 }`}
               >
                 90 días
               </button>
               <button
                 type="button"
                 onClick={() => handleInputChange('fechaVencimiento', '')}
                 className={`px-3 py-1 text-xs rounded-md transition-colors ${
                   !formData.fechaVencimiento
                     ? 'bg-gray-500 text-white'
                     : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                 }`}
               >
                 Sin fecha
               </button>
             </div>
           </div>
                 </div>

                   {/* Tipo de Ingreso */}
          <div>
            <div className="flex items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Tipo de Ingreso *
              </label>
              <TooltipInfo
                texto={
                  <>
                    <strong>¿Qué es el tipo de ingreso?</strong><br />
                    <br />
                    Selecciona el código contable que representa el ingreso facturado:
                    <br />
                    <br />
                    • <b>700</b>: Venta de mercaderías<br />
                    • <b>701</b>: Venta de productos terminados<br />
                    • <b>705</b>: Prestación de servicios<br />
                    • <b>752</b>: Ingresos por arrendamientos<br />
                    • <b>755</b>: Ingresos por comisiones<br />
                    • <b>759</b>: Ingresos por servicios diversos<br />
                    • <b>769</b>: Otros ingresos financieros
                    <br />
                    <br />
                    <em>Usa el código que mejor describe la operación.</em>
                  </>
                }
              />
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <select
                  value={formData.tipoIngreso}
                  onChange={(e) => handleInputChange('tipoIngreso', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${
                    errors.tipoIngreso ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={loadingTiposIngreso}
                >
                  <option value="">{loadingTiposIngreso ? 'Cargando tipos...' : 'Seleccione un tipo de ingreso'}</option>
                  {!loadingTiposIngreso && tiposIngreso.map(tipo => (
                    <option key={tipo.codigo} value={tipo.codigo}>
                      {tipo.codigo} - {tipo.descripcion}
                    </option>
                  ))}
                </select>
                {errors.tipoIngreso && (
                  <p className="text-red-500 text-sm mt-1">{errors.tipoIngreso}</p>
                )}
              </div>
            </div>
          </div>

                   {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cliente *
            </label>
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <select
                  value={formData.cliente}
                  onChange={(e) => handleInputChange('cliente', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${
                    errors.cliente ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={loadingClientes}
                >
                  <option value="">Seleccione un cliente</option>
                  {loadingClientes ? (
                    <option value="">Cargando clientes...</option>
                  ) : (
                    clientes.map(cliente => (
                      <option key={cliente.NIF} value={cliente['NOMBRE O RAZON SOCIAL']}>
                        {cliente['NOMBRE O RAZON SOCIAL']} - {cliente.NIF}
                      </option>
                    ))
                  )}
                </select>
                {errors.cliente && (
                  <p className="text-red-500 text-sm mt-1">{errors.cliente}</p>
                )}
              </div>
              
              <button
                type="button"
                onClick={() => {
                  // TODO: Implementar modal para nuevo cliente
                  alert('Funcionalidad de nuevo cliente será implementada próximamente');
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                title="Agregar nuevo cliente"
              >
                <span className="text-lg">+</span>
                <span>Nuevo Cliente</span>
              </button>
            </div>
            
            {/* Informații client selectat */}
            {formData.cliente && !loadingClientes && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Información del cliente:</h4>
                {(() => {
                  const clienteSeleccionado = clientes.find(c => c['NOMBRE O RAZON SOCIAL'] === formData.cliente);
                  if (clienteSeleccionado) {
                    return (
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><strong>NIF/CIF:</strong> {clienteSeleccionado.NIF}</p>
                        {clienteSeleccionado.DIRECCION && (
                          <p><strong>Dirección:</strong> {clienteSeleccionado.DIRECCION}</p>
                        )}
                        {clienteSeleccionado.POBLACION && (
                          <p><strong>Población:</strong> {clienteSeleccionado.POBLACION}</p>
                        )}
                        {clienteSeleccionado.EMAIL && (
                          <p><strong>Email:</strong> {clienteSeleccionado.EMAIL}</p>
                        )}
                        {clienteSeleccionado['DESCUENTO POR DEFECTO'] && parseFloat(clienteSeleccionado['DESCUENTO POR DEFECTO']) > 0 && (
                          <p className="text-green-600 font-medium">
                            <strong>Descuento por defecto:</strong> {clienteSeleccionado['DESCUENTO POR DEFECTO']}%
                          </p>
                        )}
                      </div>
                    );
                  }
                  return <p className="text-sm text-gray-500">Cliente no encontrado</p>;
                })()}
              </div>
                        )}
          </div>

          {/* Notas privadas și Retención */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Notas privadas - mai mic */}
            <div>
              <div className="flex items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Notas privadas
                </label>
                <TooltipInfo
                  texto={
                    <>
                      <strong>¿Qué son las notas privadas?</strong><br />
                      <br />
                      Las notas privadas son comentarios internos que solo verán los administradores del sistema. No aparecerán en la factura que se envía al cliente.
                      <br />
                      <br />
                      <em>Útiles para recordatorios, información confidencial o notas de seguimiento.</em>
                    </>
                  }
                />
              </div>
              
              <textarea
                value={formData.notasPrivadas || ''}
                onChange={(e) => handleInputChange('notasPrivadas', e.target.value)}
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Notas privadas para uso interno..."
              />
            </div>

            {/* Retención */}
            <div>
              <div className="flex items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Retención
                </label>
                <TooltipInfo
                  texto={
                    <>
                      Este valor representa el porcentaje retenido (IRPF) sobre la factura.<br /><br />
                      <em>Ejemplo: Existe retención si eres un autónomo y realizas una factura a otro autónomo. (15% normalmente, o 7% si hace menos de 2 años que ejerces de autónomo).</em>
                    </>
                  }
                />
              </div>
              
              <select
                value={formData.retencion}
                onChange={(e) => handleInputChange('retencion', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={loadingRetenciones}
              >
                <option value="">{loadingRetenciones ? 'Cargando retenciones...' : 'Seleccione una retención'}</option>
                {!loadingRetenciones && (
                  <>
                    {/* Categoría Actual */}
                    <optgroup label="📋 Actual">
                      {retenciones
                        .filter(r => r.categoria === 'Actual')
                        .map(retencion => (
                          <option key={retencion.id} value={retencion.id}>
                            {retencion.porcentaje}% - {retencion.nombre}
                          </option>
                        ))}
                    </optgroup>
                    
                    {/* Categoría Ceuta y Melilla */}
                    <optgroup label="🏛️ Ceuta y Melilla">
                      {retenciones
                        .filter(r => r.categoria === 'CeutaYMelilla')
                        .map(retencion => (
                          <option key={retencion.id} value={retencion.id}>
                            {retencion.porcentaje}% - {retencion.nombre}
                          </option>
                        ))}
                    </optgroup>
                    
                    {/* Categoría Antiguo */}
                    <optgroup label="📜 Antiguo">
                      {retenciones
                        .filter(r => r.categoria === 'Antiguo')
                        .map(retencion => (
                          <option key={retencion.id} value={retencion.id}>
                            {retencion.porcentaje}% - {retencion.nombre}
                          </option>
                        ))}
                    </optgroup>
                  </>
                )}
              </select>
            </div>
                     </div>

           {/* Notas en la factura */}
           <div>
             <div className="flex items-center mb-2">
               <label className="block text-sm font-medium text-gray-700">
                 Notas en la factura
               </label>
               <TooltipInfo
                 texto={
                   <>
                     <strong>¿Qué son las notas en la factura?</strong><br />
                     <br />
                     Las notas en la factura son información adicional que aparecerá en el PDF de la factura.
                     <br />
                     <br />
                     <em>Útiles para información de pago, condiciones especiales o notas importantes para el cliente.</em>
                   </>
                 }
               />
             </div>
             <div className="flex items-center space-x-3">
               <div className="flex-1">
                 <select
                   value={formData.notaFactura}
                   onChange={(e) => handleInputChange('notaFactura', e.target.value)}
                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                   disabled={loadingNotas}
                 >
                   <option value="">{loadingNotas ? 'Cargando notas...' : 'Seleccione una nota'}</option>
                   {!loadingNotas && notasFactura.map(nota => (
                     <option key={nota.id} value={nota.id}>
                       {nota.titulo}
                     </option>
                   ))}
                 </select>
               </div>
               
               <button
                 type="button"
                 onClick={() => setShowNotasModal(true)}
                 className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                 title="Gestionar información de la nota"
               >
                 <span className="text-lg">⚙️</span>
                 <span>Gestionar información de la nota</span>
               </button>
             </div>
             
             {/* Câmp pentru afișarea conținutului notei selectate */}
             {formData.notaFactura && !loadingNotas && (
               <div className="mt-3">
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   Contenido de la nota
                 </label>
                 <textarea
                   value={(() => {
                     const notaSeleccionada = notasFactura.find(nota => nota.id.toString() === formData.notaFactura.toString());
                     return notaSeleccionada ? notaSeleccionada.descripcion : '';
                   })()}
                   readOnly
                   rows="2"
                   className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                   placeholder="Seleccione una nota para ver su contenido..."
                 />
               </div>
             )}
           </div>

           {/* Marcar factura como cobrada */}
           <div>
             <div className="flex items-center mb-2">
               <label className="flex items-center text-sm font-medium text-gray-700">
                 <input
                   type="checkbox"
                   checked={formData.marcadaComoCobrada}
                   onChange={(e) => handleMarcadaComoCobradaChange(e.target.checked)}
                   className="mr-2 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                 />
                 Marcar factura como cobrada
               </label>
               <TooltipInfo
                 texto={
                   <>
                     <strong>¿Qué significa marcar como cobrada?</strong><br />
                     <br />
                     Selecciona esta opción para marcar la factura como cobrada y llevar el control de cobros y pagos al día.
                     <br />
                     <br />
                     <em>Al seleccionar la opción podrás marcar el día que se pagó la factura y el método de pago utilizado.</em>
                   </>
                 }
               />
             </div>
             
             {/* Câmpuri pentru data și metoda de plată - apar doar când e bifat */}
             {formData.marcadaComoCobrada && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Fecha de pago
                   </label>
                   <input
                     type="date"
                     value={formData.fechaPago}
                     onChange={(e) => handleInputChange('fechaPago', e.target.value)}
                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                   />
                 </div>
                 
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Método de pago
                   </label>
                   <div className="flex items-center space-x-3">
                     <div className="flex-1">
                       <select
                         value={formData.metodoPago}
                         onChange={(e) => handleInputChange('metodoPago', e.target.value)}
                         className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                         disabled={loadingMetodos}
                       >
                         <option value="">{loadingMetodos ? 'Cargando métodos...' : 'Seleccione un método'}</option>
                         {!loadingMetodos && metodosPago.map(metodo => (
                           <option key={metodo.id} value={metodo.id}>
                             {metodo.icono} {metodo.nombre}
                             {metodo.numero_tarjeta_o_cuenta && ` - ${metodo.numero_tarjeta_o_cuenta}`}
                           </option>
                         ))}
                       </select>
                     </div>
                     
                     <button
                       type="button"
                       onClick={() => setShowMetodosModal(true)}
                       className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                       title="Agregar nuevo método de pago"
                     >
                       <span className="text-lg">+</span>
                       <span>Nuevo método</span>
                     </button>
                   </div>
                 </div>
               </div>
             )}
           </div>

           {/* Items */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Productos/Servicios
            </h3>
            <button
              type="button"
              onClick={addItem}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              + Añadir Item
            </button>
          </div>

          <div className="space-y-4">
            {formData.items.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                                 <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                   <div className="md:col-span-3">
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Concepto *
                     </label>
                     <input
                       type="text"
                       value={item.descripcion}
                       onChange={(e) => handleItemChange(index, 'descripcion', e.target.value)}
                       className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${
                         errors[`items.${index}.descripcion`] ? 'border-red-500' : 'border-gray-300'
                       }`}
                       placeholder="Descripción del producto o servicio"
                     />
                     {errors[`items.${index}.descripcion`] && (
                       <p className="text-red-500 text-sm mt-1">{errors[`items.${index}.descripcion`]}</p>
                     )}
                   </div>

                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Unidades *
                     </label>
                     <input
                       type="number"
                       min="1"
                       value={item.cantidad}
                       onChange={(e) => handleItemChange(index, 'cantidad', parseFloat(e.target.value) || 0)}
                       className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${
                         errors[`items.${index}.cantidad`] ? 'border-red-500' : 'border-gray-300'
                       }`}
                     />
                     {errors[`items.${index}.cantidad`] && (
                       <p className="text-red-500 text-sm mt-1">{errors[`items.${index}.cantidad`]}</p>
                     )}
                   </div>

                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Base *
                     </label>
                     <input
                       type="number"
                       min="0"
                       step="0.01"
                       value={item.precioUnitario}
                       onChange={(e) => handleItemChange(index, 'precioUnitario', parseFloat(e.target.value) || 0)}
                       className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${
                         errors[`items.${index}.precioUnitario`] ? 'border-red-500' : 'border-gray-300'
                       }`}
                     />
                     {errors[`items.${index}.precioUnitario`] && (
                       <p className="text-red-500 text-sm mt-1">{errors[`items.${index}.precioUnitario`]}</p>
                     )}
                   </div>

                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       IVA %
                     </label>
                     <select
                       value={item.tva}
                       onChange={(e) => handleItemChange(index, 'tva', parseFloat(e.target.value))}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                     >
                       <option value={0}>0%</option>
                       <option value={4}>4%</option>
                       <option value={10}>10%</option>
                       <option value={21}>21%</option>
                     </select>
                   </div>

                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Descuento %
                     </label>
                     <input
                       type="number"
                       min="0"
                       max="100"
                       step="0.01"
                       value={item.descuento || 0}
                       onChange={(e) => handleItemChange(index, 'descuento', parseFloat(e.target.value) || 0)}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                       placeholder="0"
                     />
                   </div>
                 </div>

                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-600">
                    Total: <span className="font-semibold">
                      {new Intl.NumberFormat('es-ES', {
                        style: 'currency',
                        currency: 'EUR'
                      }).format(calculateItemTotal(item))}
                    </span>
                  </div>
                  
                  {formData.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observaciones
          </label>
          <textarea
            value={formData.observaciones}
            onChange={(e) => handleInputChange('observaciones', e.target.value)}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="Observaciones adicionales..."
          />
        </div>

        {/* Totaluri */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-center text-lg font-semibold">
            <span>Subtotal:</span>
            <span>
              {new Intl.NumberFormat('es-ES', {
                style: 'currency',
                currency: 'EUR'
              }).format(formData.subtotal || 0)}
            </span>
          </div>
          <div className="flex justify-between items-center text-lg font-semibold">
            <span>TVA:</span>
            <span>
              {new Intl.NumberFormat('es-ES', {
                style: 'currency',
                currency: 'EUR'
              }).format(formData.totalTVA || 0)}
            </span>
          </div>
          {formData.retencion && (() => {
            // Convertim formData.retencion la număr pentru comparație corectă
            const retencionId = parseInt(formData.retencion);
            const retencionSeleccionada = retenciones.find(r => r.id === retencionId);
            return (
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Retención ({retencionSeleccionada?.porcentaje}%):</span>
                <span>
                  {new Intl.NumberFormat('es-ES', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(formData.totalRetencion || 0)}
                </span>
              </div>
            );
          })()}
          <div className="flex justify-between items-center text-xl font-bold text-red-600 border-t pt-2 mt-2">
            <span>TOTAL:</span>
            <span>
              {new Intl.NumberFormat('es-ES', {
                style: 'currency',
                currency: 'EUR'
              }).format(formData.total || 0)}
            </span>
          </div>
        </div>

        {/* Butoane */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Guardando...' : (facturaToEdit ? 'Actualizar' : 'Crear')}
          </button>
        </div>
      </form>

             {/* Modal pentru crearea de serii noi */}
             {showSerieModal && (
               <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                 <div className="bg-white rounded-lg p-6 w-full max-w-md">
                   <h3 className="text-lg font-semibold text-gray-800 mb-4">
                     Crear Nueva Serie
                   </h3>
                   
                   <div className="space-y-4">
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">
                         Nombre de la Serie
                       </label>
                       <input
                         type="text"
                         value={newSerieName}
                         onChange={(e) => setNewSerieName(e.target.value)}
                         className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                         placeholder="Ej: Facturas especiales"
                       />
                     </div>
                     
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">
                         Formato del Número
                       </label>
                       <input
                         type="text"
                         value={newSerieFormat}
                         onChange={(e) => setNewSerieFormat(e.target.value)}
                         className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                         placeholder="Ej: ESP-AAAA-MM-###"
                       />
                       <p className="text-xs text-gray-500 mt-1">
                         Usa AAAA para año, MM para mes, ### para número secuencial
                       </p>
                     </div>
                   </div>
                   
                   <div className="flex justify-end space-x-3 mt-6">
                     <button
                       type="button"
                       onClick={handleCloseSerieModal}
                       className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                     >
                       Cancelar
                     </button>
                     <button
                       type="button"
                       onClick={handleCreateNewSerie}
                       disabled={!newSerieName.trim() || !newSerieFormat.trim() || savingSerie}
                       className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                     >
                       {savingSerie ? 'Guardando...' : 'Crear Serie'}
                     </button>
                   </div>
                 </div>
               </div>
             )}

              {/* Modal pentru gestionarea notelor */}
              {showNotasModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  Gestionar la información de las notas de documento
                </h3>
                <button
                  onClick={handleCloseNotasModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Secțiunea pentru adăugarea de note noi */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-4">
                    Dar de alta una nueva nota de documento
                  </h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Título
                      </label>
                      <input
                        type="text"
                        value={newNotaTitulo}
                        onChange={(e) => setNewNotaTitulo(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Ej: Cuenta BBVA"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Descripción
                      </label>
                      <textarea
                        value={newNotaDescripcion}
                        onChange={(e) => setNewNotaDescripcion(e.target.value)}
                        rows="4"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Descripción de la nota..."
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        * Los saltos de línea aparecerán también como saltos de línea en la factura o presupuesto.
                      </p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleCreateNewNota}
                      disabled={!newNotaTitulo.trim() || !newNotaDescripcion.trim() || savingNota}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span>✓</span>
                      <span>{savingNota ? 'Guardando...' : 'Insertar'}</span>
                    </button>
                  </div>
                </div>

                {/* Secțiunea pentru listarea notelor existente */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-4">
                    Listado de notas de documento disponibles
                  </h4>
                  
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="grid grid-cols-3 gap-4 text-sm font-medium text-gray-700">
                        <div>Título</div>
                        <div>Descripción</div>
                        <div>Operaciones</div>
                      </div>
                    </div>
                    
                    <div className="max-h-64 overflow-y-auto">
                      {notasFactura.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-500">
                          No hay notas disponibles
                        </div>
                      ) : (
                        notasFactura.map(nota => (
                          <div key={nota.id} className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                            <div className="grid grid-cols-3 gap-4 items-center">
                              <div className="font-medium text-gray-900">
                                {nota.titulo}
                              </div>
                              <div className="text-sm text-gray-600">
                                {nota.descripcion}
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    // TODO: Implementar funcționalitatea de editare
                                    alert('Funcionalidad de edición será implementada próximamente');
                                  }}
                                  className="p-1 text-blue-600 hover:text-blue-800"
                                  title="Editar"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNota(nota.id)}
                                  className="p-1 text-red-600 hover:text-red-800"
                                  title="Eliminar"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  type="button"
                  onClick={handleCloseNotasModal}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  × Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal pentru gestionarea metodelor de plată */}
        {showMetodosModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  Gestión de métodos de cobro
                </h3>
                <button
                  onClick={handleCloseMetodosModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Secțiunea pentru crearea de metode noi */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                    <span className="mr-2">💳</span>
                    Crear un nuevo método de cobro
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de método
                      </label>
                      <select
                        value={newMetodoTipo}
                        onChange={(e) => setNewMetodoTipo(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="Efectivo">Efectivo</option>
                        <option value="Transferencia">Transferencia</option>
                        <option value="Tarjeta">Tarjeta</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre del método
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={newMetodoNombre}
                          onChange={(e) => setNewMetodoNombre(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                          placeholder="Ej: Cuenta Empresa"
                        />
                        <TooltipInfo
                          texto={
                            <>
                              <strong>Nombre</strong><br />
                              <br />
                              Nombre con el que identificar el método de pago/cobro.
                            </>
                          }
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Número de tarjeta / Cuenta corriente
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={newMetodoNumero}
                          onChange={(e) => setNewMetodoNumero(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                          placeholder="Ej: 8090"
                        />
                        <TooltipInfo
                          texto={
                            <>
                              <strong>Número identificador</strong><br />
                              <br />
                              Número de cuenta, número de tarjeta o identificador asociada al método de pago/cobro.
                            </>
                          }
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cuenta vinculada
                      </label>
                      <select
                        value={newMetodoCuenta}
                        onChange={(e) => setNewMetodoCuenta(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="">Crear una nueva cuenta</option>
                        <option value="Cuenta Principal">Cuenta Principal</option>
                        <option value="Cuenta Secundaria">Cuenta Secundaria</option>
                        <option value="Cuenta de Ahorros">Cuenta de Ahorros</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Secțiunea de instrucțiuni */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="text-lg font-semibold text-blue-800 mb-3">
                    Instrucciones
                  </h5>
                  <ul className="text-sm text-blue-700 space-y-2">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>
                        Para poder hacer un seguimiento correcto de los pagos y cobros es necesario indicar el medio de pago y el número de cuenta o tarjeta utilizado en cada pago o cobro concreto.
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>
                        Cegid Contasimple no hace ningún uso de dicha información, que se guarda a salvo en nuestra base de datos.
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>
                        Si lo prefieres, puedes registrar el número de cuenta o tarjeta indicando únicamente los últimos cuatro dígitos.
                      </span>
                    </li>
                  </ul>
                  
                  <div className="mt-4">
                    <p className="text-sm font-medium text-blue-800 mb-2">Ejemplo:</p>
                    <div className="bg-white border border-blue-200 rounded p-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-blue-200">
                            <th className="text-left font-medium text-blue-800">Nombre</th>
                            <th className="text-left font-medium text-blue-800">Tipo Método</th>
                            <th className="text-left font-medium text-blue-800">Número de tarjeta o cuenta</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-1">Cuenta Empresa</td>
                            <td className="py-1">Transferencia</td>
                            <td className="py-1">8090</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseMetodosModal}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewMetodo}
                  disabled={!newMetodoNombre.trim() || !newMetodoNumero.trim() || savingMetodo}
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span>💾</span>
                  <span>{savingMetodo ? 'Guardando...' : 'Insertar'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

export default FacturaForm; 