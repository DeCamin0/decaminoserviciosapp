import React, { useState, useEffect } from 'react';
import { Button, Input } from '../../../components/ui';
import { routes } from '../../../utils/routes';
import TooltipInfo from './TooltipInfo';

const NuevaFacturaModal = ({ 
  isOpen, 
  onClose, 
  onSave 
}) => {
  const [formData, setFormData] = useState({
    numero: '',
    fecha: new Date().toISOString().split('T')[0], // Data de azi în format YYYY-MM-DD
    fechaVencimiento: '',
    tipoGasto: '600',
    proveedor: '',
    imputacion: '100',
    retencion: 'sin',
    notasPrivadas: '',
    etiquetas: '',
    marcarPagada: false,
    tipoPago: '',
    fechaPago: new Date().toISOString().split('T')[0],
    metodoPago: '',
    fechaOperacion: new Date().toISOString().split('T')[0],
    tipoOperacion: '',
    regimenCriterioCaja: false,
    imputacionIVA: '100',
    arrendamientoInmuebles: false,

    conceptos: [
      {
        concepto: '',
        baseImponible: '',
        cantidad: '1.00',
        descuento: '0',
        iva: '21',
        ivaAmount: '0.00'
      }
    ]
  });

  const [proveedores, setProveedores] = useState([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);

  const [tiposGasto, setTiposGasto] = useState([]);
  const [loadingTiposGasto, setLoadingTiposGasto] = useState(false);

  const [retenciones, setRetenciones] = useState([]);
  const [loadingRetenciones, setLoadingRetenciones] = useState(false);

  const [ivaRates] = useState([
    { codigo: '0', descripcion: '0%' },
    { codigo: '4', descripcion: '4%' },
    { codigo: '10', descripcion: '10%' },
    { codigo: '21', descripcion: '21%' }
  ]);

  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showAdvancedEditing, setShowAdvancedEditing] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showProductDetailsModal, setShowProductDetailsModal] = useState(false);
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [productos, setProductos] = useState([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
     const [showCamera, setShowCamera] = useState(false);
   const [cameraStream, setCameraStream] = useState(null);
   const [cameraError, setCameraError] = useState(null);
 
   const [showNuevoProveedorModal, setShowNuevoProveedorModal] = useState(false);
  const [ocrBackendStatus, setOcrBackendStatus] = useState('available'); // Temporar setat ca 'available' pentru a evita erorile CORS

  // State pentru modalul de proveedor nou
  const [nuevoProveedorData, setNuevoProveedorData] = useState({
    NIF: '',
    'NOMBRE O RAZÓN SOCIAL': '',
    EMAIL: '',
    TELEFONO: '',
    MOVIL: '',
    FAX: '',
    DIRECCIÓN: '',
    URL: '',
    'DESCUENTO POR DEFECTO': '',
    LATITUD: '',
    LONGITUD: '',
    'NOTAS PRIVADAS': '',
    'CUENTAS BANCARIAS': '',
    fecha_creacion: '',
    fecha_actualizacion: '',
    ESTADO: 'activo'
  });

  useEffect(() => {
    if (isOpen) {
      // Resetează formularul când se deschide modalul
      setFormData({
        numero: '',
        fecha: new Date().toISOString().split('T')[0], // Data de azi în format YYYY-MM-DD
        fechaVencimiento: '',
        tipoGasto: '600',
        proveedor: '',
        imputacion: '100',
        retencion: 'sin',
        notasPrivadas: '',
        etiquetas: '',
        marcarPagada: false,
        tipoPago: '',
        fechaPago: new Date().toISOString().split('T')[0],
        metodoPago: '',
        fechaOperacion: new Date().toISOString().split('T')[0],
        tipoOperacion: '',
        regimenCriterioCaja: false,
        imputacionIVA: '100',
        arrendamientoInmuebles: false,
        
        conceptos: [
          {
            concepto: '',
            baseImponible: '',
            cantidad: '1.00',
            descuento: '0',
            iva: '21',
            ivaAmount: '0.00'
          }
        ]
      });
      
      // Verifică statusul backend-ului OCR
      checkOcrBackendStatus();
      
      // Încarcă tipurile de gasto din backend
      loadTiposGasto();
      
      // Încarcă proveedorii din backend
      loadProveedores();
      
      // Încarcă retenciones din backend
      loadRetenciones();
      
      // Încarcă produsele din backend
      loadProductos();
    } else {
      // Închide camera când se închide modalul
      if (cameraStream) {
        stopCamera();
      }
    }
  }, [isOpen]);



  // Monitorizează schimbările în state-ul modalului de proveedor
  useEffect(() => {
    // Monitorizează schimbările în state-ul modalului
  }, [showNuevoProveedorModal]);

  // Debug pentru state-ul modalului - eliminat pentru performanță
  // useEffect(() => {
  //   // Monitorizează re-render-urile componentei
  // });

  // Funcție pentru încărcarea proveedorilor din backend
  const loadProveedores = async () => {
    try {
      setLoadingProveedores(true);
      
      const response = await fetch(routes.getProveedores);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Verifică dacă data este un array
      if (Array.isArray(data)) {
        // Mapează câmpurile corecte din backend
        const proveedoresMapeados = data.map(proveedor => ({
          id: proveedor.NIF || proveedor.nif || proveedor.CIF || proveedor.cif || 'Sin NIF',
          nombre: proveedor['NOMBRE O RAZÓN SOCIAL'] || proveedor.nombre || proveedor.Nombre || proveedor.name || 'Proveedor sin nombre',
          cif: proveedor.NIF || proveedor.nif || proveedor.CIF || proveedor.cif || 'Sin NIF',
          email: proveedor.EMAIL || proveedor.email || '',
          telefono: proveedor.TELEFONO || proveedor.telefono || '',
          direccion: proveedor.DIRECCIÓN || proveedor.direccion || '',
          poblacion: proveedor.POBLACIÓN || proveedor.poblacion || '',
          provincia: proveedor.PROVINCIA || proveedor.provincia || ''
        }));
        setProveedores(proveedoresMapeados);
      } else if (data && typeof data === 'object') {
        // Dacă este un obiect, convertește-l în array
        const proveedoresArray = Object.entries(data).map(([id, proveedor]) => ({
          id: proveedor.NIF || proveedor.nif || proveedor.CIF || proveedor.cif || id,
          nombre: proveedor['NOMBRE O RAZÓN SOCIAL'] || proveedor.nombre || proveedor.Nombre || proveedor.name || 'Proveedor sin nombre',
          cif: proveedor.NIF || proveedor.nif || proveedor.CIF || proveedor.cif || 'Sin NIF',
          email: proveedor.EMAIL || proveedor.email || '',
          telefono: proveedor.TELEFONO || proveedor.telefono || '',
          direccion: proveedor.DIRECCIÓN || proveedor.direccion || '',
          poblacion: proveedor.POBLACIÓN || proveedor.poblacion || '',
          provincia: proveedor.PROVINCIA || proveedor.provincia || ''
        }));
        setProveedores(proveedoresArray);
      } else {
        // Fallback la lista hardcodată
        setProveedores([
          { id: 1, nombre: 'Proveedor A', cif: 'A12345678' },
          { id: 2, nombre: 'Proveedor B', cif: 'B87654321' }
        ]);
      }
      
    } catch (error) {
      console.error('❌ Error cargando proveedores del backend:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack
      });
      // Fallback la lista hardcodată
      setProveedores([
        { id: 1, nombre: 'Proveedor A', cif: 'A12345678' },
        { id: 2, nombre: 'Proveedor B', cif: 'B87654321' }
      ]);
    } finally {
      setLoadingProveedores(false);
    }
  };

  // Funcție pentru salvarea unui proveedor nou
  const handleSaveNuevoProveedor = async () => {
    try {
      // Aici poți face un POST la backend-ul tău pentru a salva proveedorul
      // Pentru moment, doar îl adaug la lista locală
      const nuevoProveedor = {
        id: nuevoProveedorData.NIF,
        nombre: nuevoProveedorData['NOMBRE O RAZÓN SOCIAL'],
        cif: nuevoProveedorData.NIF,
        email: nuevoProveedorData.EMAIL,
        telefono: nuevoProveedorData.TELEFONO,
        movil: nuevoProveedorData.MOVIL,
        fax: nuevoProveedorData.FAX,
        direccion: nuevoProveedorData.DIRECCIÓN,
        url: nuevoProveedorData.URL,
        descuentoPorDefecto: nuevoProveedorData['DESCUENTO POR DEFECTO'],
        latitud: nuevoProveedorData.LATITUD,
        longitud: nuevoProveedorData.LONGITUD,
        notasPrivadas: nuevoProveedorData['NOTAS PRIVADAS'],
        cuentasBancarias: nuevoProveedorData['CUENTAS BANCARIAS'],
        fechaCreacion: nuevoProveedorData.fecha_creacion || new Date().toISOString(),
        fechaActualizacion: nuevoProveedorData.fecha_actualizacion || new Date().toISOString(),
        estado: nuevoProveedorData.ESTADO
      };
      
      // Adaugă la lista existentă
      setProveedores(prev => [...prev, nuevoProveedor]);
      
      // Selectează automat noul proveedor
      setFormData(prev => ({ ...prev, proveedor: nuevoProveedorData.NIF }));
      
      // Închide modalul
      setShowNuevoProveedorModal(false);
      
      // Resetează formularul cu toate câmpurile
      setNuevoProveedorData({
        NIF: '',
        'NOMBRE O RAZÓN SOCIAL': '',
        EMAIL: '',
        TELEFONO: '',
        MOVIL: '',
        FAX: '',
        DIRECCIÓN: '',
        URL: '',
        'DESCUENTO POR DEFECTO': '',
        LATITUD: '',
        LONGITUD: '',
        'NOTAS PRIVADAS': '',
        'CUENTAS BANCARIAS': '',
        fecha_creacion: '',
        fecha_actualizacion: '',
        ESTADO: 'activo'
      });
      
    } catch (error) {
      console.error('Error al guardar proveedor:', error);
    }
  };

  // Funcție pentru încărcarea tipurilor de gasto din backend
  const loadTiposGasto = async () => {
    try {
      setLoadingTiposGasto(true);
      
      const response = await fetch(routes.getTiposGasto);
      
      const data = await response.json();
      
      // Verifică dacă data este un array
      if (Array.isArray(data)) {
        // Grupează pe Grupos și adaugă headers
        const groupedData = [];
        let currentGrupo = null;
        
        data.forEach((item) => {
          // Dacă este un nou grup, adaugă header-ul
          if (item.Grupo && item.Grupo !== currentGrupo) {
            currentGrupo = item.Grupo;
            groupedData.push({
              codigo: item.Grupo.split('.')[0], // Ia doar numărul grupului
              descripcion: item.Grupo,
              Grupo: item.Grupo,
              isHeader: true
            });
          }
          
          // Adaugă tipul de gasto
          groupedData.push({
            ...item,
            isHeader: false
          });
        });
        
        setTiposGasto(groupedData);
        
        // Auto-selectează "600. Compras de mercaderías" ca default
        if (!formData.tipoGasto || formData.tipoGasto === '') {
          setFormData(prev => ({ ...prev, tipoGasto: '600' }));
        }
      } else if (data && typeof data === 'object') {
        // Dacă este un obiect, convertește-l în array
        const tiposArray = Object.entries(data).map(([codigo, descripcion]) => ({
          codigo,
          descripcion: typeof descripcion === 'string' ? descripcion : JSON.stringify(descripcion)
        }));
        setTiposGasto(tiposArray);
        
        // Auto-selectează "600. Compras de mercaderías" ca default
        if (!formData.tipoGasto || formData.tipoGasto === '') {
          setFormData(prev => ({ ...prev, tipoGasto: '600' }));
        }
      }
    } catch (error) {
      console.error('❌ Error cargando tipos de gasto del backend:', error);
      // Fallback la lista hardcodată organizată pe categorii
      setTiposGasto([
        // Grup 6: Compras y gastos
        { codigo: '60', descripcion: '60. Compras', Grupo: '60. Compras', isHeader: true },
        { codigo: '600', descripcion: '600. Compras de mercaderías (materiales)', Grupo: '60. Compras' },
        { codigo: '607', descripcion: '607. Trabajos realizados por otras empresas', Grupo: '60. Compras' },
        { codigo: '6099', descripcion: '6099. Otros aprovisionamientos', Grupo: '60. Compras' },
        
        // Grup 62: Servicios exteriores
        { codigo: '62', descripcion: '62. Servicios exteriores', Grupo: '62. Servicios exteriores', isHeader: true },
        { codigo: '621', descripcion: '621. Arrendamientos y cánones', Grupo: '62. Servicios exteriores' },
        { codigo: '622', descripcion: '622. Reparaciones y conservación', Grupo: '62. Servicios exteriores' },
        { codigo: '623', descripcion: '623. Servicios de profesionales independientes', Grupo: '62. Servicios exteriores' },
        { codigo: '624', descripcion: '624. Transportes', Grupo: '62. Servicios exteriores' },
        { codigo: '625', descripcion: '625. Primas de seguros', Grupo: '62. Servicios exteriores' },
        { codigo: '626', descripcion: '626. Servicios bancarios', Grupo: '62. Servicios exteriores' },
        { codigo: '627', descripcion: '627. Publicidad y relaciones públicas', Grupo: '62. Servicios exteriores' },
        { codigo: '628', descripcion: '628. Suministros (agua, luz, gas)', Grupo: '62. Servicios exteriores' },
        { codigo: '629', descripcion: '629. Otros servicios', Grupo: '62. Servicios exteriores' },
        { codigo: '6291', descripcion: '6291. Comunicaciones', Grupo: '62. Servicios exteriores' },
        { codigo: '6292', descripcion: '6292. Viajes y desplazamientos', Grupo: '62. Servicios exteriores' },
        { codigo: '6297', descripcion: '6297. Afiliaciones', Grupo: '62. Servicios exteriores' }
      ]);
    } finally {
      setLoadingTiposGasto(false);
    }
  };

  // Funcție pentru afișarea detaliilor produsului
  const handleShowProductDetails = (producto) => {
    setSelectedProductDetails(producto);
    setShowProductDetailsModal(true);
  };

  // Funcție pentru selectarea unui produs din modal
  const handleSelectProduct = (producto) => {
    console.log('🎯 Producto seleccionado:', producto);
    
    // Găsește conceptul curent (primul gol sau creează unul nou)
    let currentConceptIndex = formData.conceptos.findIndex(concepto => !concepto.concepto);
    
    if (currentConceptIndex === -1) {
      // Dacă nu există concept gol, adaugă unul nou
      currentConceptIndex = formData.conceptos.length;
      setFormData(prev => ({
        ...prev,
        conceptos: [...prev.conceptos, {
          concepto: '',
          baseImponible: '',
          cantidad: '1.00',
          descuento: '0',
          iva: '21',
          ivaAmount: '0.00'
        }]
      }));
    }
    
    // Completează conceptul cu datele produsului selectat
    const baseImponible = parseFloat(producto.baseImponible.replace(',', '.')) || 0;
    const ivaPorcentaje = parseFloat(producto.iva.replace('%', '').replace(',', '.')) || 21;
    const ivaAmount = (baseImponible * ivaPorcentaje) / 100;
    
    setFormData(prev => ({
      ...prev,
      conceptos: prev.conceptos.map((concepto, index) => 
        index === currentConceptIndex 
          ? {
              ...concepto,
              concepto: producto.nombre,
              baseImponible: baseImponible.toFixed(2),
              iva: ivaPorcentaje.toString(),
              ivaAmount: ivaAmount.toFixed(2)
            }
          : concepto
      )
    }));
    
    // Închide modalul după selecție
    setShowProductModal(false);
  };

  // Funcție pentru încărcarea produselor din backend
  const loadProductos = async () => {
    try {
      setLoadingProductos(true);
      
      const response = await fetch(routes.getCatalog);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
              // Verifică dacă data este un array
        if (Array.isArray(data)) {
          // Mapează câmpurile corecte din backend
          const productosMapeados = data.map(producto => ({
            id: producto.id,
            familia: producto['FAMILIA/SUBFAMILIA'] ? producto['FAMILIA/SUBFAMILIA'].split(' | ')[0] : 'Sin familia',
            nombre: producto.NOMBRE || 'Sin nombre',
            baseImponible: producto['PRECIO VENTA - BASE IMPONIBLE'] || '-',
            iva: producto['PRECIO VENTA - % IVA'] || '-'
          }));
          setProductos(productosMapeados);
        } else if (data && typeof data === 'object') {
          // Dacă este un obiect, convertește-l în array
          const productosArray = Object.entries(data).map(([id, producto]) => ({
            id: id,
            familia: producto['FAMILIA/SUBFAMILIA'] ? producto['FAMILIA/SUBFAMILIA'].split(' | ')[0] : 'Sin familia',
            nombre: producto.NOMBRE || 'Sin nombre',
            baseImponible: producto['PRECIO VENTA - BASE IMPONIBLE'] || '-',
            iva: producto['PRECIO VENTA - % IVA'] || '-'
          }));
          setProductos(productosArray);
        } else {
        // Fallback la lista hardcodată
        setProductos([
          { id: 1, familia: 'PRODUCTOS LIMPIEZA', nombre: 'P.B 70X90 INSA NEGRA', baseImponible: '-', iva: '-' },
          { id: 2, familia: 'PRODUCTOS LIMPIEZA', nombre: 'AMBIENTADOR MANZANA 5LT', baseImponible: '-', iva: '-' },
          { id: 3, familia: 'ANALITICAS', nombre: 'ANALITICA INICIAL VASO INFANTIL', baseImponible: '-', iva: '-' }
        ]);
      }
      
    } catch (error) {
      console.error('❌ Error cargando productos del backend:', error);
      // Fallback la lista hardcodată
      setProductos([
        { id: 1, familia: 'PRODUCTOS LIMPIEZA', nombre: 'P.B 70X90 INSA NEGRA', baseImponible: '-', iva: '-' },
        { id: 2, familia: 'PRODUCTOS LIMPIEZA', nombre: 'AMBIENTADOR MANZANA 5LT', baseImponible: '-', iva: '-' },
        { id: 3, familia: 'ANALITICAS', nombre: 'ANALITICA INICIAL VASO INFANTIL', baseImponible: '-', iva: '-' }
      ]);
    } finally {
      setLoadingProductos(false);
    }
  };

  // Funcție pentru încărcarea retenciones din backend
  const loadRetenciones = async () => {
    try {
      setLoadingRetenciones(true);
      
      
      
      // Endpoint corect pentru retenciones din routes.js
      const response = await fetch(routes.getRetenciones);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Verifică dacă data este un array
      if (Array.isArray(data)) {
        // Grupează retenciones după categorie
        const groupedRetenciones = [];
        let currentCategoria = null;
        
        data.forEach((retencion) => {
          // Dacă este o nouă categorie, adaugă header-ul
          if (retencion.categoria && retencion.categoria !== currentCategoria) {
            currentCategoria = retencion.categoria;
            groupedRetenciones.push({
              codigo: retencion.categoria,
              descripcion: retencion.categoria,
              categoria: retencion.categoria,
              isHeader: true
            });
          }
          
          // Adaugă retención cu procentaj
          const porcentaje = retencion.porcentaje || retencion.porcent || retencion.rate || '0';
          const descripcion = retencion.descripcion || retencion.description || retencion.nombre || 'Sin descripción';
          
          groupedRetenciones.push({
            codigo: retencion.codigo || retencion.code || retencion.id || porcentaje,
            descripcion: `${porcentaje}% - ${descripcion}`,
            porcentaje: porcentaje,
            categoria: retencion.categoria,
            isHeader: false
          });
        });
        
        setRetenciones(groupedRetenciones);
      } else if (data && typeof data === 'object') {
        // Dacă data este un obiect, convertește-l în array
        const retencionesArray = Object.values(data);
        const groupedRetenciones = [];
        let currentCategoria = null;
        
        retencionesArray.forEach((retencion) => {
          // Dacă este o nouă categorie, adaugă header-ul
          if (retencion.categoria && retencion.categoria !== currentCategoria) {
            currentCategoria = retencion.categoria;
            groupedRetenciones.push({
              codigo: retencion.categoria,
              descripcion: retencion.categoria,
              categoria: retencion.categoria,
              isHeader: true
            });
          }
          
          // Adaugă retención cu procentaj
          const porcentaje = retencion.porcentaje || retencion.porcent || retencion.rate || '0';
          const descripcion = retencion.descripcion || retencion.description || retencion.nombre || 'Sin descripción';
          
          groupedRetenciones.push({
            codigo: retencion.codigo || retencion.code || retencion.id || porcentaje,
            descripcion: `${porcentaje}% - ${descripcion}`,
            porcentaje: porcentaje,
            categoria: retencion.categoria,
            isHeader: false
          });
        });
        
        setRetenciones(groupedRetenciones);
      } else {
        // Fallback la lista default dacă nu există date
        setRetenciones([
          { codigo: 'sin', descripcion: '• Sin Retención.', isHeader: false },
          { codigo: 'actuales', descripcion: 'Valores actuales', isHeader: true },
          { codigo: '1', descripcion: '1% - Módulos o Actividades Ganaderas', isHeader: false },
          { codigo: '2', descripcion: '2% - Sector Agrario', isHeader: false },
          { codigo: '7', descripcion: '7% - Profesionales en los dos primeros años de actividad', isHeader: false },
          { codigo: '15', descripcion: '15% - Profesionales', isHeader: false },
          { codigo: '19', descripcion: '19% - Alquileres o Intereses (capital mobiliario)', isHeader: false }
        ]);
      }
    } catch (error) {
      console.error('Error al cargar retenciones:', error);
      // Fallback la lista default în caz de eroare
      setRetenciones([
        { codigo: 'sin', descripcion: '• Sin Retención.', isHeader: false },
        { codigo: 'actuales', descripcion: 'Valores actuales', isHeader: true },
        { codigo: '1', descripcion: '1% - Módulos o Actividades Ganaderas', isHeader: false },
        { codigo: '2', descripcion: '2% - Sector Agrario', isHeader: false },
        { codigo: '7', descripcion: '7% - Profesionales en los dos primeros años de actividad', isHeader: false },
        { codigo: '15', descripcion: '15% - Profesionales', isHeader: false },
        { codigo: '19', descripcion: '19% - Alquileres o Intereses (capital mobiliario)', isHeader: false }
      ]);
    } finally {
      setLoadingRetenciones(false);
    }
  };

  // Funcție pentru verificarea statusului backend-ului OCR
  const checkOcrBackendStatus = async () => {
    // Setează statusul ca disponibil pentru a evita erorile CORS
        setOcrBackendStatus('available');
  };

  const handleInputChange = (field, value) => {
    // Verifică dacă pentru retención nu se selectează un header
    if (field === 'retencion') {
      const retencionSeleccionada = retenciones.find(ret => ret.codigo === value);
      if (retencionSeleccionada && retencionSeleccionada.isHeader) {
        return; // Nu permite selectarea header-urilor
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleConceptChange = (index, field, value) => {
    const newConceptos = [...formData.conceptos];
    newConceptos[index] = {
      ...newConceptos[index],
      [field]: value
    };

    // Calculează IVA-ul automat
    if (field === 'baseImponible' || field === 'cantidad' || field === 'descuento' || field === 'iva') {
      const base = parseFloat(newConceptos[index].baseImponible) || 0;
      const cantidad = parseFloat(newConceptos[index].cantidad) || 1;
      const descuento = parseFloat(newConceptos[index].descuento) || 0;
      const ivaRate = parseFloat(newConceptos[index].iva) || 21;
      
      const subtotal = base * cantidad * (1 - descuento / 100);
      const ivaAmount = subtotal * (ivaRate / 100);
      
      newConceptos[index].ivaAmount = ivaAmount.toFixed(2);
    }

    setFormData(prev => ({
      ...prev,
      conceptos: newConceptos
    }));
  };

  const addConcept = () => {
    setFormData(prev => ({
      ...prev,
      conceptos: [
        ...prev.conceptos,
        {
          concepto: '',
          baseImponible: '',
          cantidad: '1.00',
          descuento: '0',
          iva: '21',
          ivaAmount: '0.00'
        }
      ]
    }));
  };

  const removeConcept = (index) => {
    if (formData.conceptos.length > 1) {
      setFormData(prev => ({
        ...prev,
        conceptos: prev.conceptos.filter((_, i) => i !== index)
      }));
    }
  };

  const setQuickDate = (days) => {
    if (days === 'sin') {
      setFormData(prev => ({ ...prev, fechaVencimiento: '' }));
    } else {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() + parseInt(days));
      setFormData(prev => ({ 
        ...prev, 
        fechaVencimiento: fecha.toLocaleDateString('es-ES') 
      }));
    }
  };

  // Funcție pentru procesarea fișierului încărcat
  const handleFileUpload = async (file) => {
    try {
    setIsProcessingOCR(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('clientFileId', `factura-${Date.now()}`);

      const response = await fetch(routes.ocrImagen, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const ocrResult = await response.json();
      
      // Procesează rezultatul OCR și completează formularul
      if (ocrResult.success && ocrResult.data) {
        const data = ocrResult.data;
        
        // Completează câmpurile cu datele din OCR
      setFormData(prev => ({
        ...prev,
          numero: data.numero || prev.numero,
          fecha: data.fecha || prev.fecha,
          proveedor: data.proveedor || prev.proveedor,
          // Adaugă și alte câmpuri după cum este necesar
        }));
        
        // Setează fișierul încărcat
        setUploadedFile(file);
      }
    } catch (error) {
      console.error('Error al procesar archivo OCR:', error);
    } finally {
      setIsProcessingOCR(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      setShowCamera(true);
      
      // Încearcă să acceseze camera
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Preferă camera din spate pe mobil
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }, 
        audio: false 
      });
      
      setCameraStream(stream);
    } catch (error) {
      console.error('Error accesando camera:', error);
      setCameraError('No se pudo acceder a la cámara: ' + error.message);
      
      // Fallback: deschide input-ul de fișiere
      document.getElementById('file-upload').click();
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
    setCameraError(null);
  };

  const capturePhoto = () => {
    if (!cameraStream) return;
    
    try {
      // Creează un canvas pentru a captura imaginea
      const canvas = document.createElement('canvas');
      const video = document.getElementById('camera-video');
      
      if (video && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        // Convertește canvas-ul în blob
        canvas.toBlob((blob) => {
          if (blob) {
            // Creează un fișier din blob
            const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
            handleFileUpload(file);
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    } catch (error) {
      console.error('Error capturando foto:', error);
      setCameraError('Error al capturar la foto: ' + error.message);
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let ivaTotal = 0;
    let retencionTotal = 0;

    formData.conceptos.forEach(concepto => {
      const base = parseFloat(concepto.baseImponible) || 0;
      const cantidad = parseFloat(concepto.cantidad) || 1;
      const descuento = parseFloat(concepto.descuento) || 0;
      const ivaRate = parseFloat(concepto.iva) || 21;
      
      const subtotalConcepto = base * cantidad * (1 - descuento / 100);
      const ivaConcepto = subtotalConcepto * (ivaRate / 100);
      
      subtotal += subtotalConcepto;
      ivaTotal += ivaConcepto;
    });

    // Calculează retenția dacă este selectată
    if (formData.retencion !== 'sin') {
      const retencionRate = parseFloat(formData.retencion);
      retencionTotal = subtotal * (retencionRate / 100);
    }

    const total = subtotal + ivaTotal - retencionTotal;

    return {
      subtotal: subtotal.toFixed(2),
      iva: ivaTotal.toFixed(2),
      retencion: retencionTotal.toFixed(2),
      total: total.toFixed(2)
    };
  };

  const handleSave = async () => {
    try {
      const totals = calculateTotals();
      
      // Convertește datele în formatul așteptat de sistemul de facturi primite
      const facturaData = {
        numero: formData.numero,
        proveedor: formData.proveedor, // NIF-ul selectat
        cif: formData.proveedor, // NIF-ul selectat
        fecha: formData.fecha,
        importe: parseFloat(totals.subtotal) || 0,
        iva: parseFloat(totals.iva) || 0,
        total: parseFloat(totals.total) || 0,
        estado: formData.marcadaPagada ? 'Pagada' : 'Pendiente',
        concepto: formData.conceptos.map(c => c.concepto).join(', '),
        notas: formData.notasPrivadas,
        archivo: uploadedFile ? uploadedFile.name : '',
        // Câmpuri suplimentare pentru compatibilitate
        tipoGasto: formData.tipoGasto,
        fechaVencimiento: formData.fechaVencimiento,
        imputacion: formData.imputacion,
        retencion: formData.retencion,

        conceptos: formData.conceptos,
        totals: totals,
        createdAt: new Date().toISOString()
      };

      if (onSave) {
        await onSave(facturaData);
      }

      onClose();
    } catch (error) {
      console.error('Error al guardar la factura:', error);
    }
  };

  const totals = calculateTotals();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-2xl font-semibold text-gray-800">
            Nueva factura recibida
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* OCR Upload Section */}
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
              isDragOver 
                ? 'border-blue-500 bg-blue-100 scale-105' 
                : 'border-blue-300 bg-blue-50 hover:bg-blue-100'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center space-y-4">
              {isProcessingOCR ? (
                <>
                  <div className="text-4xl text-blue-500 animate-pulse">⏳</div>
                  <h3 className="text-lg font-semibold text-blue-800">
                    Procesando factura con OCR...
                  </h3>
                  <div className="w-8 h-8 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                </>
              ) : uploadedFile ? (
                <>
                  <div className="text-4xl text-green-500">✅</div>
                  <h3 className="text-lg font-semibold text-green-800">
                    Archivo procesado: {uploadedFile.name}
                  </h3>
                  <p className="text-sm text-green-600">
                    Los datos han sido extraídos automáticamente
                  </p>
                  <Button 
                    onClick={() => setUploadedFile(null)}
                    variant="outline"
                    className="border-green-300 text-green-600 hover:bg-green-50"
                  >
                    🔄 Procesar otro archivo
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-4xl text-blue-500">☁️</div>
                  <h3 className="text-lg font-semibold text-blue-800">
                    ¡Ahorra tiempo! Arrastra aquí tu factura y deja que nuestro OCR la contabilice por ti.
                  </h3>
                                <p className="text-sm text-blue-600">
                Tamaño máximo: 14 MBytes
              </p>
              <p className="text-xs text-blue-500">
                Formatos soportados: PDF, JPG, JPEG, PNG, TIFF
              </p>
              
              {/* Status Backend OCR */}
              <div className="flex items-center justify-center gap-2 text-xs">
                <span>🧠 OCR Backend:</span>
                {ocrBackendStatus === 'checking' && (
                  <span className="text-yellow-600 flex items-center gap-1">
                    <div className="w-3 h-3 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                    Verificando...
                  </span>
                )}
                {ocrBackendStatus === 'available' && (
                  <span className="text-green-600 flex items-center gap-1">
                    ✅ Disponible
                  </span>
                )}
                {ocrBackendStatus === 'unavailable' && (
                  <span className="text-red-600 flex items-center gap-1">
                    ❌ No disponible
                    <button
                      onClick={() => {}} // Temporar dezactivat din cauza CORS
                      className="ml-1 text-red-500 hover:text-red-700 underline"
                      title="Reintentar conexión - temporar dezactivat"
                      disabled
                    >
                      🔄
                    </button>
                  </span>
                )}
              </div>
              
              {/* Debug info pentru dezvoltatori */}
              {ocrBackendStatus === 'unavailable' && (
                <div className="text-center text-xs text-gray-500 mt-2">
                  <p>Endpoint: {routes.ocrImagen}</p>
                  <p>Verifica consola del navegador para más detalles</p>
                </div>
              )}
                  <div className="flex gap-4 mt-4">
                    <Button 
                      onClick={() => document.getElementById('file-upload').click()}
                      disabled={ocrBackendStatus === 'unavailable'}
                      className={`px-6 py-2 ${
                        ocrBackendStatus === 'unavailable' 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                      title={ocrBackendStatus === 'unavailable' ? 'OCR backend no disponible' : ''}
                    >
                      📁 Seleccionar archivo
                    </Button>
                    <Button 
                      onClick={startCamera}
                      disabled={ocrBackendStatus === 'unavailable'}
                      variant="outline"
                      className={`border-blue-300 px-6 py-2 ${
                        ocrBackendStatus === 'unavailable' 
                          ? 'text-gray-400 border-gray-300 cursor-not-allowed' 
                          : 'text-blue-600 hover:bg-blue-50'
                      }`}
                      title={ocrBackendStatus === 'unavailable' ? 'OCR backend no disponible' : ''}
                    >
                      📷 Usar cámara
                    </Button>
                  </div>
                </>
              )}
              
              <input
                id="file-upload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.tiff"
                onChange={(e) => handleFileUpload(e.target.files[0])}
                className="hidden"
              />
            </div>
          </div>



          {/* Opțiuni Avansate */}
          <div>
            <button
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              <span>{showAdvancedOptions ? '▼' : '▶'}</span>
              <span>Opciones Avanzadas</span>
            </button>
            
            {showAdvancedOptions && (
              <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  Opțiuni avansate pentru factura (în dezvoltare...)
                </p>
              </div>
            )}
          </div>

                     {/* Información de la factura */}
           <div className="bg-blue-50 p-6 rounded-lg">
             <h3 className="text-lg font-semibold text-blue-800 mb-6">
               Información de la factura
             </h3>
             
             {/* Primera fila - Información básica */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
               {/* Número */}
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   Número
                 </label>
                 <Input
                   value={formData.numero}
                   onChange={(e) => handleInputChange('numero', e.target.value)}
                   placeholder="Número de factura"
                   className="w-full"
                 />
               </div>

               {/* Fecha */}
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   Fecha
                 </label>
                 <Input
                   type="date"
                   value={formData.fecha}
                   onChange={(e) => handleInputChange('fecha', e.target.value)}
                   className="w-full"
                 />
               </div>

               {/* Fecha de Vencimiento */}
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   Fecha de Vencimiento
                 </label>
                 <Input
                   type="date"
                   value={formData.fechaVencimiento}
                   onChange={(e) => handleInputChange('fechaVencimiento', e.target.value)}
                   className="w-full mb-2"
                 />
                 <div className="flex flex-wrap gap-1">
                   <Button
                     size="sm"
                     onClick={() => setQuickDate(30)}
                     className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white"
                   >
                     30 días
                   </Button>
                   <Button
                     size="sm"
                     onClick={() => setQuickDate(60)}
                     className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white"
                   >
                     60 días
                   </Button>
                   <Button
                     size="sm"
                     onClick={() => setQuickDate(90)}
                     className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white"
                   >
                     90 días
                   </Button>
                   <Button
                     size="sm"
                     onClick={() => setQuickDate('sin')}
                     className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white"
                   >
                     Sin fecha
                   </Button>
                 </div>
               </div>
             </div>

             {/* Segunda fila - Tipo de gasto y Proveedor */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
               {/* Columna izquierda - Tipo de gasto y Proveedor */}
               <div className="space-y-4">
                 {/* Tipo de gasto */}
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Tipo de gasto
                     {loadingTiposGasto && (
                       <span className="ml-2 text-sm text-gray-500">(cargando...)</span>
                     )}
                   </label>
                   <select
                     value={formData.tipoGasto}
                     onChange={(e) => handleInputChange('tipoGasto', e.target.value)}
                     disabled={loadingTiposGasto}
                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                   >
                     {loadingTiposGasto ? (
                       <option>Cargando tipos de gasto...</option>
                     ) : (
                       <>
                         {tiposGasto.map(tipo => (
                           <option 
                             key={tipo.codigo} 
                             value={tipo.codigo}
                             disabled={tipo.isHeader}
                             className={tipo.isHeader ? 'font-bold text-gray-700 bg-gray-100' : ''}
                           >
                             {tipo.isHeader ? `📁 ${tipo.descripcion}` : `${tipo.codigo} - ${tipo.descripcion}`}
                           </option>
                         ))}
                       </>
                     )}
                   </select>
                 </div>

                 {/* Proveedor */}
                 <div>
                   <label 
                     className="block text-sm font-medium text-gray-700 mb-2 cursor-pointer"
                     onClick={() => {
                       if (!loadingProveedores) {
                         const selectElement = document.querySelector('#proveedor-select');
                         if (selectElement) {
                           selectElement.focus();
                           selectElement.click();
                         }
                       }
                     }}
                   >
                     Proveedor
                     {loadingProveedores && (
                       <span className="ml-2 text-sm text-gray-500">(cargando...)</span>
                     )}
                     <span className="ml-2 text-sm text-gray-500">({proveedores.length} proveedores)</span>
                   </label>
                   <div 
                     className="flex gap-2"
                   >
                     <select
                       id="proveedor-select"
                       value={formData.proveedor}
                       onChange={(e) => handleInputChange('proveedor', e.target.value)}
                       disabled={loadingProveedores}
                       className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed relative z-10"
                       style={{zIndex: 10}}
                     >
                       {loadingProveedores ? (
                         <option>Cargando proveedores...</option>
                       ) : (
                         <>
                           <option value="">• Selecciona el proveedor.</option>
                           {proveedores.length === 0 ? (
                             <option disabled>No hay proveedores disponibles</option>
                           ) : (
                             proveedores.map(prov => (
                               <option key={prov.id} value={prov.id}>
                                 {prov.nombre} - {prov.cif}
                                 {prov.poblacion && ` (${prov.poblacion})`}
                                 {prov.provincia && ` - ${prov.provincia}`}
                               </option>
                             ))
                           )}
                         </>
                       )}
                     </select>
                     <button 
                       type="button"
                       data-testid="nuevo-proveedor-btn"
                       onMouseDown={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         setShowNuevoProveedorModal(true);
                       }}
                       onClick={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         setShowNuevoProveedorModal(true);
                       }}
                       className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 active:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-white rounded cursor-pointer transition-colors duration-200 select-none relative"
                       style={{zIndex: 10}}
                       tabIndex={0}
                     >
                       + Nuevo proveedor
                     </button>
                   </div>
                 </div>
               </div>

                                {/* Columna derecha - Imputación */}
                 <div className="relative">
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Imputación
                   </label>
                   <div className="flex items-center gap-2">
                     <Input
                       value={formData.imputacion}
                       onChange={(e) => handleInputChange('imputacion', e.target.value)}
                       className="w-20"
                     />
                     <span className="text-gray-600">%</span>
                     <TooltipInfo
                       texto={
                         <>
                           <strong>Porcentaje de imputación</strong><br /><br />
                           <strong>Valor entre 0 y 100.</strong><br /><br />
                           <em>Ejemplo: Si eres autónomo y desarrollas tu actividad en tu propia vivienda, al contabilizar suministros (como la factura del agua o de la luz) podrás indicar como porcentaje imputable el 30% de la proporción existente entre los metros cuadrados de la vivienda destinados a la actividad respecto a su superficie total (salvo que se pruebe un porcentaje superior o inferior), es decir, si destinas un 20% de tu vivienda a tu actividad, la imputación de la factura de la luz debería ser del 30% de ese 20%, es decir, de un 6% (0,2 x 0,3 = 0,06). Por otro lado, al contabilizar gastos derivados de la titularidad de la vivienda (como el IBI, amortizaciones, comunidad de propietarios, etc.) éstos podrán ser imputados en proporción a la parte de vivienda afectada a la actividad económica y porcentaje de titularidad. Siguiendo con el ejemplo anterior, el IBI de la vivienda se podría imputar en un 20% asumiendo que el autónomo fuese el único titular de la vivienda.</em>
                         </>
                       }
                     />
                   </div>
                 </div>
             </div>



             {/* Tercera fila - Retención y Notas */}
             <div className="space-y-6">
                                {/* Retención */}
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Retención
                     {loadingRetenciones && (
                       <span className="ml-2 text-sm text-gray-500">(cargando...)</span>
                     )}
                   </label>
                   <div className="flex items-center gap-2 relative">
                     <select
                       value={formData.retencion}
                       onChange={(e) => handleInputChange('retencion', e.target.value)}
                       disabled={loadingRetenciones}
                       className="w-96 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed relative z-10"
                       style={{zIndex: 10}}
                     >
                       {loadingRetenciones ? (
                         <option>Cargando retenciones...</option>
                       ) : (
                         <>
                           <option value="">• Selecciona la retención.</option>
                           {retenciones.length === 0 ? (
                             <option disabled>No hay retenciones disponibles</option>
                           ) : (
                             retenciones.map(ret => (
                               <option 
                                 key={ret.codigo} 
                                 value={ret.codigo}
                                 disabled={ret.isHeader}
                                 className={ret.isHeader ? 'font-bold text-gray-600 bg-gray-100' : ''}
                               >
                                 {ret.isHeader ? `📋 ${ret.descripcion}` : ret.descripcion}
                         </option>
                             ))
                           )}
                         </>
                       )}
                     </select>
                     <TooltipInfo
                       titulo="Retención"
                       texto={
                         <>
                           <strong>¿Qué es la retención?</strong><br /><br />
                           La retención es un porcentaje que se descuenta de la factura para el pago del IRPF.<br /><br />
                           <em>Ejemplo: Si eres autónomo y facturas a otro autónomo, se aplica retención del 15% (o 7% si ejerces menos de 2 años).</em>
                         </>
                       }
                     />
                   </div>
                 </div>

               {/* Notas privadas */}
               <div className="relative" style={{zIndex: 20}}>
                 <div className="flex items-center mb-2">
                   <label className="block text-sm font-medium text-gray-700">
                     Notas privadas
                   </label>
                   <TooltipInfo
                     titulo="Notas Privadas"
                     texto={
                       <>
                         Escribe las notas privadas que consideres oportunas.<br /><br />
                         Estas notas no se visualizarán en la factura.
                       </>
                     }
                   />
                 </div>
                 <Input
                   value={formData.notasPrivadas}
                   onChange={(e) => handleInputChange('notasPrivadas', e.target.value)}
                   className="w-full"
                   placeholder="Notas privadas sobre la factura..."
                 />
               </div>

               {/* Etiquetas */}
               <div className="relative" style={{zIndex: 20}}>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   Etiquetas
                 </label>
                 <div className="flex items-center gap-2">
                   <Input
                     value={formData.etiquetas}
                     onChange={(e) => handleInputChange('etiquetas', e.target.value)}
                     className="flex-1"
                     placeholder="Añadir etiquetas..."
                   />
                     <button
                       type="button"
                     className="text-gray-400 hover:text-gray-600 transition-colors"
                     title="Añadir etiqueta"
                     >
                       <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                       <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                       </svg>
                     </button>
                   </div>
                 </div>

               {/* Checkbox Marcar factura como pagada */}
               <div className="flex items-center gap-2 mb-4">
                 <input
                   type="checkbox"
                   id="marcarPagada"
                   checked={formData.marcarPagada}
                   onChange={(e) => handleInputChange('marcarPagada', e.target.checked)}
                   className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 focus:ring-2"
                 />
                 <label htmlFor="marcarPagada" className="text-sm font-medium text-gray-700">
                   Marcar factura como pagada
                 </label>
                 <TooltipInfo
                   titulo="Estado de la Factura"
                   texto={
                     <>
                       Selecciona esta opción para marcar la factura como cobrada y llevar el control de cobros y pagos al día.
                     </>
                   }
                 />
               </div>

               {/* Opțiuni de plată când e bifat checkbox-ul */}
               {formData.marcarPagada && (
                 <div className="ml-6 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                   <div className="space-y-4">
                     {/* Registrar pago */}
                     <div className="flex items-center gap-3">
                       <input
                         type="radio"
                         id="registrarPago"
                         name="tipoPago"
                         value="registrar"
                         checked={formData.tipoPago === 'registrar'}
                         onChange={(e) => handleInputChange('tipoPago', e.target.value)}
                         className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                       />
                       <label htmlFor="registrarPago" className="text-sm font-medium text-gray-700">
                         Registrar pago
                       </label>
                     </div>

                     {/* Data plății */}
                     <div className="ml-7">
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                         Fecha de pago
                 </label>
                       <div className="flex items-center gap-2">
                         <Input
                           type="date"
                           value={formData.fechaPago}
                           onChange={(e) => handleInputChange('fechaPago', e.target.value)}
                           className="w-40"
                         />
                         <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                           <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                         </svg>
                       </div>
                     </div>

                     {/* Metoda de plată */}
                     <div className="ml-7">
                       <label className="block text-sm font-medium text-gray-700 mb-2">
                         Método de pago
                       </label>
                       <div className="flex items-center gap-2">
                         <select
                           value={formData.metodoPago}
                           onChange={(e) => handleInputChange('metodoPago', e.target.value)}
                           className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                         >
                           <option value="">Selecciona método de pago</option>
                           <option value="bankinter">Bankinter Empres...</option>
                           <option value="transferencia">Transferencia bancaria</option>
                           <option value="efectivo">Efectivo</option>
                           <option value="cheque">Cheque</option>
                         </select>
                         <button
                           type="button"
                           className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                         >
                           + Nuevo método
                         </button>
                       </div>
                     </div>

                     {/* Elegir movimiento existente */}
                     <div className="flex items-center gap-3">
                       <input
                         type="radio"
                         id="movimientoExistente"
                         name="tipoPago"
                         value="existente"
                         checked={formData.tipoPago === 'existente'}
                         onChange={(e) => handleInputChange('tipoPago', e.target.value)}
                         className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                       />
                       <label htmlFor="movimientoExistente" className="text-sm font-medium text-gray-700">
                         Elegir movimiento existente
                       </label>
                     </div>
                   </div>
                 </div>
               )}

               {/* Opciones Avanzadas */}
               <div className="mb-4">
                 <button
                   type="button"
                   onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                   className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                 >
                   <svg className={`w-4 h-4 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                     <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                   </svg>
                   Opciones Avanzadas
                 </button>
                 
                 {showAdvancedOptions && (
                   <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                     <div className="space-y-4">
                       {/* Fecha de operación */}
                       <div>
                         <label className="block text-sm font-medium text-gray-700 mb-2">
                           Fecha de operación
                         </label>
                         <div className="flex items-center gap-2">
                           <Input
                             type="date"
                             value={formData.fechaOperacion}
                             onChange={(e) => handleInputChange('fechaOperacion', e.target.value)}
                             className="w-40"
                           />
                           <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                             <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                           </svg>
                         </div>
                       </div>

                       {/* Tipo de operación */}
                       <div>
                         <div className="flex items-center mb-2">
                           <label className="block text-sm font-medium text-gray-700">
                             Tipo de operación
                           </label>
                           <TooltipInfo
                             titulo="Tipo de Operación"
                             texto={
                               <>
                                 Selecciona el tipo de operación según el domicilio social del proveedor.<br /><br />
                                 <em>Nacional: Proveedor con domicilio social en España.<br />
                                 Intracomunitario: Proveedor de la UE.<br />
                                 Importación: Proveedor fuera de la UE.</em>
                               </>
                             }
                           />
                         </div>
                         <select
                           value={formData.tipoOperacion}
                           onChange={(e) => handleInputChange('tipoOperacion', e.target.value)}
                           className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                         >
                           <option value="">Selecciona tipo de operación</option>
                           <option value="nacional">Nacional (si el emisor tiene el domicilio social en España)</option>
                           <option value="intracomunitario">Intracomunitario</option>
                           <option value="importacion">Importación</option>
                         </select>
                       </div>

                       {/* Factura de un proveedor acogido al Régimen de Criterio de Caja */}
                       <div className="flex items-center gap-2">
                         <input
                           type="checkbox"
                           id="regimenCriterioCaja"
                           checked={formData.regimenCriterioCaja}
                           onChange={(e) => handleInputChange('regimenCriterioCaja', e.target.checked)}
                           className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 focus:ring-2"
                         />
                         <label htmlFor="regimenCriterioCaja" className="text-sm font-medium text-gray-700">
                           Factura de un proveedor acogido al Régimen de Criterio de Caja
                         </label>
                         <TooltipInfo
                           titulo="Régimen de Criterio de Caja"
                           texto={
                             <>
                               El Régimen de Criterio de Caja permite diferir la liquidación del IVA hasta el momento del pago.<br /><br />
                               <em>Se aplica a facturas de proveedores que utilizan este régimen especial.</em>
                             </>
                           }
                         />
                       </div>

                       {/* Imputación a IVA */}
                       <div>
                         <div className="flex items-center mb-2">
                           <label className="block text-sm font-medium text-gray-700">
                             Imputación a IVA
                           </label>
                           <TooltipInfo
                             titulo="Imputación a IVA"
                             texto={
                               <>
                                 Porcentaje de la factura que se imputa al IVA.<br /><br />
                                 <em>Normalmente 100%, pero puede variar según el tipo de operación.</em>
                               </>
                             }
                           />
                         </div>
                         <div className="flex items-center gap-2">
                           <Input
                             type="number"
                             value={formData.imputacionIVA}
                             onChange={(e) => handleInputChange('imputacionIVA', e.target.value)}
                             className="w-20"
                             placeholder="100"
                           />
                           <span className="text-gray-600">%</span>
                         </div>
                       </div>

                       {/* Operación arrendamiento de inmuebles */}
                       <div className="flex items-center gap-2">
                         <input
                           type="checkbox"
                           id="arrendamientoInmuebles"
                           checked={formData.arrendamientoInmuebles}
                           onChange={(e) => handleInputChange('arrendamientoInmuebles', e.target.checked)}
                           className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 focus:ring-2"
                         />
                         <label htmlFor="arrendamientoInmuebles" className="text-sm font-medium text-gray-700">
                           Operación arrendamiento de inmuebles
                         </label>
                         <TooltipInfo
                           titulo="Arrendamiento de Inmuebles"
                           texto={
                             <>
                               Marca esta opción si la factura corresponde a un alquiler de inmuebles.<br /><br />
                               <em>Las operaciones de arrendamiento tienen un tratamiento especial en el IVA.</em>
                             </>
                           }
                         />
                       </div>
                     </div>
                   </div>
                 )}
               </div>
             </div>
           </div>

          {/* Conceptos */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 relative" style={{zIndex: 30}}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Conceptos
              </h3>
              <button
                onClick={() => setShowAdvancedEditing(!showAdvancedEditing)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {showAdvancedEditing ? '▼' : '▲'} Mostrar edición avanzada
              </button>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 mb-3 text-sm font-medium text-gray-700 border-b border-gray-200 pb-2">
              <div className="col-span-3">Concepto</div>
              <div className="col-span-2">Base imponible</div>
              <div className="col-span-1">Cantidad</div>
              <div className="col-span-1">% Descuento</div>
              <div className="col-span-2">IVA</div>
              <div className="col-span-2">Acciones</div>
            </div>

            {/* Conceptos Rows */}
            {formData.conceptos.map((concepto, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 mb-3 items-center">
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowProductModal(true)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Buscar producto en el catálogo"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </button>
                  <Input
                    value={concepto.concepto}
                    onChange={(e) => handleConceptChange(index, 'concepto', e.target.value)}
                    placeholder="Descripción del concepto"
                      className="text-sm flex-1"
                  />
                  </div>
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={concepto.baseImponible}
                    onChange={(e) => handleConceptChange(index, 'baseImponible', e.target.value)}
                    placeholder="0.00"
                    className="text-sm"
                  />
                </div>
                <div className="col-span-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={concepto.cantidad}
                    onChange={(e) => handleConceptChange(index, 'cantidad', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="col-span-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={concepto.descuento}
                    onChange={(e) => handleConceptChange(index, 'descuento', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <div className="flex gap-1">
                    <select
                      value={concepto.iva}
                      onChange={(e) => handleConceptChange(index, 'iva', e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {ivaRates.map(rate => (
                        <option key={rate.codigo} value={rate.codigo}>
                          {rate.descripcion}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="text"
                      value={concepto.ivaAmount}
                      readOnly
                      className="w-16 text-sm text-center"
                    />
                  </div>
                </div>
                <div className="col-span-2 flex gap-1">
                  <button
                    onClick={() => removeConcept(index)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Eliminar concepto"
                  >
                    🗑️
                  </button>
                  <button className="text-gray-400 hover:text-gray-600 p-1">
                    ▼
                  </button>
                </div>
              </div>
            ))}

            {/* Add Concept Button */}
            <button
              onClick={addConcept}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              + Añadir otro concepto
            </button>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{totals.subtotal} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">IVA:</span>
                  <span className="font-medium">{totals.iva} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Retención -:</span>
                  <span className="font-medium">{totals.retencion} €</span>
                </div>
                <div className="flex justify-between border-t border-gray-300 pt-2">
                  <span className="text-lg font-bold">TOTAL:</span>
                  <span className="text-lg font-bold">{totals.total} €</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Camera Modal Overlay */}
        {showCamera && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[10000]">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  📷 Cámara para factura
                </h3>
                <button
                  onClick={stopCamera}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              {cameraError ? (
                <div className="text-center py-8">
                  <div className="text-4xl text-red-500 mb-4">❌</div>
                  <p className="text-red-600 mb-4">{cameraError}</p>
                  <Button onClick={stopCamera} className="bg-red-600 hover:bg-red-700">
                    Cerrar
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <video
                      id="camera-video"
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-64 bg-gray-900 rounded-lg"
                      ref={(video) => {
                        if (video && cameraStream) {
                          video.srcObject = cameraStream;
                        }
                      }}
                    />
                    {!cameraStream && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-white text-center">
                          <div className="text-4xl mb-2">📷</div>
                          <p>Iniciando cámara...</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-center gap-4">
                    <Button
                      onClick={capturePhoto}
                      disabled={!cameraStream}
                      className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg"
                    >
                      📸 Capturar foto
                    </Button>
                    <Button
                      onClick={stopCamera}
                      variant="outline"
                      className="px-8 py-3 text-lg"
                    >
                      ❌ Cancelar
                    </Button>
                  </div>
                  
                  <div className="text-center text-sm text-gray-600">
                    <p>📱 Apunta la la factura y captura la imagen</p>
                    <p>💡 Asegúrate de que la factura esté bien iluminada</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Nuevo Proveedor */}
        {showNuevoProveedorModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[10000]">
            <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[95vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  🏢 Nuevo Proveedor
                </h3>
                <button
                  onClick={() => setShowNuevoProveedorModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Prima coloană - Informații de bază */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* NIF */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      NIF/CIF <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={nuevoProveedorData.NIF}
                      onChange={(e) => setNuevoProveedorData(prev => ({ ...prev, NIF: e.target.value }))}
                      placeholder="NIF o CIF del proveedor"
                      className="w-full"
                    />
                  </div>

                  {/* NOMBRE O RAZÓN SOCIAL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre o Razón Social <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={nuevoProveedorData['NOMBRE O RAZÓN SOCIAL']}
                      onChange={(e) => setNuevoProveedorData(prev => ({ ...prev, 'NOMBRE O RAZÓN SOCIAL': e.target.value }))}
                      placeholder="Nombre completo o razón social"
                      className="w-full"
                    />
                  </div>

                  {/* EMAIL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={nuevoProveedorData.EMAIL}
                      onChange={(e) => setNuevoProveedorData(prev => ({ ...prev, EMAIL: e.target.value }))}
                      placeholder="email@proveedor.com"
                      className="w-full"
                    />
                  </div>

                  {/* TELEFONO */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Teléfono
                    </label>
                    <Input
                      value={nuevoProveedorData.TELEFONO}
                      onChange={(e) => setNuevoProveedorData(prev => ({ ...prev, TELEFONO: e.target.value }))}
                      placeholder="+34 600 000 000"
                      className="w-full"
                    />
                  </div>

                  {/* MÓVIL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Móvil
                    </label>
                    <Input
                      value={nuevoProveedorData.MOVIL}
                      onChange={(e) => setNuevoProveedorData(prev => ({ ...prev, MOVIL: e.target.value }))}
                      placeholder="+34 600 000 000"
                      className="w-full"
                    />
                  </div>

                  {/* FAX */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fax
                    </label>
                    <Input
                      value={nuevoProveedorData.FAX}
                      onChange={(e) => setNuevoProveedorData(prev => ({ ...prev, FAX: e.target.value }))}
                      placeholder="+34 900 000 000"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* A doua coloană - Adresa */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* DIRECCIÓN */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Dirección
                    </label>
                    <Input
                      value={nuevoProveedorData.DIRECCIÓN}
                      onChange={(e) => setNuevoProveedorData(prev => ({ ...prev, DIRECCIÓN: e.target.value }))}
                      placeholder="Calle, número, piso..."
                      className="w-full"
                    />
                  </div>

                  {/* URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      URL
                    </label>
                    <Input
                      type="url"
                      value={nuevoProveedorData.URL}
                      onChange={(e) => setNuevoProveedorData(prev => ({ ...prev, URL: e.target.value }))}
                      placeholder="https://www.proveedor.com"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* A treia coloană - Configurații și coordonate */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* DESCUENTO POR DEFECTO */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descuento por Defecto (%)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={nuevoProveedorData['DESCUENTO POR DEFECTO']}
                      onChange={(e) => setNuevoProveedorData(prev => ({ ...prev, 'DESCUENTO POR DEFECTO': e.target.value }))}
                      placeholder="0.00"
                      className="w-full"
                    />
                  </div>

                  {/* ESTADO */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estado
                    </label>
                    <select
                      value={nuevoProveedorData.ESTADO}
                      onChange={(e) => setNuevoProveedorData(prev => ({ ...prev, ESTADO: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                      <option value="suspendido">Suspendido</option>
                    </select>
                  </div>

                  {/* LATITUD */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Latitud
                    </label>
                    <Input
                      type="number"
                      step="any"
                      value={nuevoProveedorData.LATITUD}
                      onChange={(e) => setNuevoProveedorData(prev => ({ ...prev, LATITUD: e.target.value }))}
                      placeholder="40.4168"
                      className="w-full"
                    />
                  </div>

                  {/* LONGITUD */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Longitud
                    </label>
                    <Input
                      type="number"
                      step="any"
                      value={nuevoProveedorData.LONGITUD}
                      onChange={(e) => setNuevoProveedorData(prev => ({ ...prev, LONGITUD: e.target.value }))}
                      placeholder="-3.7038"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* A patra coloană - Note și conturi bancare */}
                <div className="grid grid-cols-1 gap-4">
                  {/* NOTAS PRIVADAS */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notas Privadas
                    </label>
                    <textarea
                      value={nuevoProveedorData['NOTAS PRIVADAS']}
                      onChange={(e) => setNuevoProveedorData(prev => ({ ...prev, 'NOTAS PRIVADAS': e.target.value }))}
                      placeholder="Notas privadas sobre el proveedor..."
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* CUENTAS BANCARIAS */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cuentas Bancarias
                    </label>
                    <textarea
                      value={nuevoProveedorData['CUENTAS BANCARIAS']}
                      onChange={(e) => setNuevoProveedorData(prev => ({ ...prev, 'CUENTAS BANCARIAS': e.target.value }))}
                      placeholder="IBAN: ES91 2100 0418 4502 0005 1332..."
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Butoane de acțiune */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <Button
                  onClick={() => setShowNuevoProveedorModal(false)}
                  variant="outline"
                  className="px-6 py-2"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveNuevoProveedor}
                  disabled={!nuevoProveedorData.NIF || !nuevoProveedorData['NOMBRE O RAZÓN SOCIAL']}
                  className="bg-blue-600 hover:bg-blue-700 px-6 py-2"
                >
                  💾 Guardar Proveedor
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal pentru selecția produselor */}
        {showProductModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-lg shadow-xl w-4/5 h-4/5 max-w-6xl max-h-[800px] flex flex-col">
              {/* Header modal */}
              <div className="flex justify-between items-center p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">Seleccionar producto</h3>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Filtrare produse */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Filtrar productos:</label>
                  <input
                    type="text"
                    placeholder="Buscar productos..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                    Buscar
                  </button>
                </div>
              </div>

              {/* Tabel produse */}
              <div className="flex-1 overflow-auto p-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-2 text-sm font-medium text-gray-700">Familia</th>
                      <th className="text-left p-2 text-sm font-medium text-gray-700">Nombre</th>
                      <th className="text-left p-2 text-sm font-medium text-gray-700">B.I. (€)</th>
                      <th className="text-left p-2 text-sm font-medium text-gray-700">IVA (%)</th>
                      <th className="text-left p-2 text-sm font-medium text-gray-700">Operaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingProductos ? (
                      <tr>
                        <td colSpan="5" className="p-4 text-center text-gray-500">
                          Cargando productos...
                        </td>
                      </tr>
                    ) : productos.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-4 text-center text-gray-500">
                          No hay productos disponibles
                        </td>
                      </tr>
                    ) : (
                      productos.map((producto) => (
                        <tr key={producto.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-2 text-sm text-gray-600">{producto.familia}</td>
                          <td className="p-2 text-sm text-gray-800">{producto.nombre}</td>
                          <td className="p-2 text-sm text-gray-600">{producto.baseImponible}</td>
                          <td className="p-2 text-sm text-gray-600">{producto.iva}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <button 
                                className="text-blue-600 hover:text-blue-800" 
                                title="Seleccionar"
                                onClick={() => handleSelectProduct(producto)}
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                              </button>
                              <button 
                                className="text-gray-400 hover:text-gray-600" 
                                title="Información del producto"
                                onClick={() => handleShowProductDetails(producto)}
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginare */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    Mostrando página 1 de 18 (137 elementos en total)
                  </p>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">«</button>
                    <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">‹</button>
                    <button className="px-3 py-1 bg-blue-600 text-white border border-blue-600 rounded">1</button>
                    <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">2</button>
                    <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">3</button>
                    <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">4</button>
                    <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">5</button>
                    <span className="px-2 text-gray-500">...</span>
                    <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">18</button>
                    <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">›</button>
                    <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">»</button>
                  </div>
                </div>
              </div>

              {/* Footer modal */}
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => setShowProductModal(false)}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                >
                  × Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal pentru detalii produs */}
        {showProductDetailsModal && selectedProductDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-lg shadow-xl w-2/3 max-w-4xl max-h-[80vh] flex flex-col">
              {/* Header modal */}
              <div className="flex justify-between items-center p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">
                  Detalles del producto
                </h3>
                <button
                  onClick={() => setShowProductDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Conținut modal */}
              <div className="flex-1 overflow-auto p-6">
                <div className="space-y-6">
                  {/* Información del producto */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
                      Información del producto
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600">Familia/Subfamilia:</label>
                        <p className="text-sm text-gray-800">{selectedProductDetails.familia || 'PRODUCTOS LIMPIEZA | P.B 70X90 INSA NEGRA'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600">Nombre:</label>
                        <p className="text-sm text-gray-800 font-medium">{selectedProductDetails.nombre || 'P.B 70X90 INSA NEGRA'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600">Descripción:</label>
                        <p className="text-sm text-gray-800 text-gray-400">(campo vacío)</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600">Notas privadas:</label>
                        <p className="text-sm text-gray-800 text-gray-400">(campo vacío)</p>
                      </div>
                    </div>
                  </div>

                  {/* Referencias */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
                      Referencias
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600">Código de producto:</label>
                        <p className="text-sm text-gray-800 text-gray-400">(campo vacío)</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600">Referencia proveedor:</label>
                        <p className="text-sm text-gray-800 text-gray-400">(campo vacío)</p>
                      </div>
                    </div>
                  </div>

                  {/* Precio de venta */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
                      Precio de venta
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600">Precio unitario (Base imponible):</label>
                        <p className="text-sm text-gray-800 font-semibold">{selectedProductDetails.baseImponible || '1,27'} €</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600">Porcentaje descuento:</label>
                        <p className="text-sm text-gray-800">0%</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600">Precio descontado:</label>
                        <p className="text-sm text-gray-800">{selectedProductDetails.baseImponible || '1,27'} €</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600">Porcentaje IVA:</label>
                        <p className="text-sm text-gray-800 font-semibold text-blue-600">{selectedProductDetails.iva || '21'}%</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600">Porcentaje RE:</label>
                        <p className="text-sm text-gray-800">0%</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600">IVA:</label>
                        <p className="text-sm text-gray-800">{selectedProductDetails.ivaAmount || '0,27'} €</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600">RE:</label>
                        <p className="text-sm text-gray-800">0,00 €</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600">P.V.P.:</label>
                        <p className="text-sm text-gray-800 font-bold text-red-600">
                          {(() => {
                            const base = parseFloat(selectedProductDetails.baseImponible?.replace(',', '.') || '1.27');
                            const iva = parseFloat(selectedProductDetails.iva || '21') / 100;
                            return (base * (1 + iva)).toFixed(2).replace('.', ',');
                          })()} €
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer modal cu butoane */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex gap-3">
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    Crear por copia
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                    </svg>
                    Editar
                  </button>
                  <button
                    onClick={() => setShowProductDetailsModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    × Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-center gap-4 p-6 border-t border-gray-200 flex-shrink-0">
          <Button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg"
          >
            + Crear factura
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="px-8 py-3 text-lg"
          >
            ← Volver al listado
          </Button>
        </div>




      </div>
    </div>
  );
};

export default NuevaFacturaModal;
