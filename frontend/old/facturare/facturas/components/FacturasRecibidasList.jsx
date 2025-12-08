import { useState, useEffect } from 'react';
import { useFacturasRecibidas } from '../contexts/FacturasRecibidasContext';
import { Button, Input, Select, Card, Badge, Modal } from '../../../components/ui';
import NuevaFacturaModal from './NuevaFacturaModal';
import FileAttachmentModal from './FileAttachmentModal';
import PDFViewerAndroid from '../../../components/PDFViewerAndroid';
import { exportToExcelWithHeader } from '../../../utils/exportExcel.ts';
import { useNavigate } from 'react-router-dom';
import { routes } from '../../../utils/routes';
import activityLogger from '../../../utils/activityLogger';
// import { downloadFacturaPDF } from '../utils/pdfGenerator.jsx'; // Unused import
// import { downloadFacturaeXML } from '../utils/facturae.ts'; // Unused import
// import { isEInvoiceXMLEnabled } from '../../../config/env'; // Unused import

const FacturasRecibidasList = () => {
  const contextData = useFacturasRecibidas();
  const { 
    filteredFacturasRecibidas, 
    filters, 
    setFilters, 
    resetFilters,
    deleteFacturaRecibida,
    getStats,
    loading,
    refreshFromWebhook,
    sortBy,
    sortOrder,
    setSort
  } = contextData;

  // Detectare mobile pentru PDF preview
  const isBrowser = typeof window !== 'undefined';
  const ua = isBrowser ? window.navigator.userAgent : '';
  const platform = isBrowser ? window.navigator.platform : '';
  const isIOS = isBrowser && (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1));
  const isAndroid = isBrowser && /Android/i.test(ua);
  const isMobile = isIOS || isAndroid;
  






  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFactura, setEditingFactura] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showFileModal, setShowFileModal] = useState(false);
  const [selectedFacturaForFiles, setSelectedFacturaForFiles] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedFacturaForView, setSelectedFacturaForView] = useState(null);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const [processingOcr, setProcessingOcr] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedTipoGasto, setSelectedTipoGasto] = useState('600');
  const [tiposGasto, setTiposGasto] = useState([]);
  const [loadingTiposGasto, setLoadingTiposGasto] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);

  const navigate = useNavigate();





  // Încarcă lista de tipuri de gasto când se deschide modalul OCR
  useEffect(() => {
    if (showOcrModal) {
      loadTiposGasto();
    }
  }, [showOcrModal, loadTiposGasto]);

  // Închide meniul când se face click în afara lui
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMenuId && !event.target.closest('.menu-container')) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openMenuId]);



  // Funcție locală pentru afișarea toast-urilor
  const showToast = (message, type = 'info') => {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // Aici poți implementa un sistem de toast real dacă ai unul
  };

  const handleEdit = (factura) => {
    setEditingFactura(factura);
    setShowAddModal(true);
  };

  const handleDelete = (factura) => {
    setShowDeleteModal(factura);
  };

  const handleView = (factura) => {
    // Deschide modalul pentru vizualizarea facturii
    setSelectedFacturaForView(factura);
    setShowViewModal(true);
  };

  const handleAttachFiles = (factura) => {
    console.log('🔧 DEBUG: handleAttachFiles apelat pentru factura:', factura);
    console.log('🔧 DEBUG: showFileModal înainte:', showFileModal);
    console.log('🔧 DEBUG: selectedFacturaForFiles înainte:', selectedFacturaForFiles);
    
    // Deschide modalul pentru atașarea fișierelor
    setSelectedFacturaForFiles(factura);
    setShowFileModal(true);
    
    console.log('🔧 DEBUG: showFileModal după:', showFileModal);
    console.log('🔧 DEBUG: selectedFacturaForFiles după:', factura);
  };

  const handleSaveFiles = async (fileData) => {
    try {
      console.log('Salvando archivos para factura:', fileData);
      // Aici poți adăuga logica reală pentru salvarea fișierelor în backend
      // De exemplu: await uploadFiles(fileData.files, fileData.description);
      
      // NU închide modalul automat - lasă utilizatorul să-l închidă manual
      // setShowFileModal(false);
      // setSelectedFacturaForFiles(null);
      
      // Opțional: afișează un mesaj de succes în UI
      console.log('Archivos guardados correctamente');
      
    } catch (error) {
      console.error('Error saving files:', error);
      console.log('Error al guardar los archivos');
    }
  };

  const handleToggleCobro = (factura) => {
    // Funcționalitate pentru gestionarea cobrării
    console.log('Gestionar cobro para factura:', factura);
  };

  const handleDownloadPDF = async (factura) => {
    try {
      console.log('📄 Descargando PDF original de factura:', factura.id);
      
      // Face GET request la backend pentru a obține PDF-ul original
              const response = await fetch(`/api/facturas/e860f4ab-f8dd-4de4-b904-ac5ce87da07d?id=${factura.id}&action=download_pdf`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Verifică dacă răspunsul este un PDF
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/pdf')) {
        // Descarcă PDF-ul
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Factura_${factura.numero || factura.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        console.log('✅ PDF original descargado exitosamente');
      } else {
        // Dacă nu este PDF, încearcă să obțină URL-ul pentru descărcare
        const data = await response.json();
        if (data.pdf_url) {
          window.open(data.pdf_url, '_blank');
        } else {
          alert('No se encontró PDF original para esta factura');
        }
      }
    } catch (error) {
      console.error('❌ Error downloading PDF original:', error);
      alert('Error al descargar el PDF original: ' + error.message);
    }
  };

  // const handleDownloadXML = async (factura) => { // Unused function
  //   try {
  //     if (!isEInvoiceXMLEnabled()) {
  //       alert('e-Factura (XML) no está habilitada');
  //       return;
  //     }
  //     
  //     console.log('🧾 Generando XML Facturae para factura:', factura.id);
  //     
  //     // Generează XML-ul cu datele facturii folosind funcția din facturae.ts
  //     const result = await downloadFacturaeXML(factura);
  //     if (!result.success) {
  //       alert('Error al generar el XML Facturae');
  //     } else {
  //       console.log('✅ XML Facturae generado exitosamente');
  //     }
  //   } catch (error) {
  //     console.error('❌ Error generating XML Facturae:', error);
  //     alert('Error al generar el XML Facturae: ' + error.message);
  //   }
  // };

  const handleCopyInvoice = (factura) => {
    // Funcționalitate pentru copierea facturii
    console.log('📋 Crear factura por copia para factura:', factura);
  };

  const handleManageTags = (factura) => {
    // Funcționalitate pentru gestionarea etichetelor
    console.log('🏷️ Gestionar etiquetas para factura:', factura);
  };

  const handleGenerateCreditNote = (factura) => {
    // Funcționalitate pentru generarea abonului
    console.log('📝 Generar abono para factura:', factura);
  };

  // Funcție pentru sortare - IDENTICĂ cu facturile emise
  const handleSort = (field) => {
    if (sortBy === field) {
      setSort(field, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(field, 'asc');
    }
  };

  const confirmDelete = async () => {
    if (showDeleteModal) {
      try {
        await deleteFacturaRecibida(showDeleteModal.id);
        setShowDeleteModal(null);
      } catch (error) {
        console.error('Error deleting factura recibida:', error);
      }
    }
  };

  const handleSave = () => {
    setShowAddModal(false);
    setEditingFactura(null);
  };

  const handleCancel = () => {
    setShowAddModal(false);
    setEditingFactura(null);
  };

  // Funcții pentru camera
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
      const fileInput = document.getElementById('file-upload-ocr');
      if (fileInput) {
        fileInput.click();
      }
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
      const video = document.getElementById('camera-video-ocr');
      
      if (video && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        // Convertește canvas-ul în blob
        canvas.toBlob(async (blob) => {
          if (blob) {
            // Creează un fișier din blob
            const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
            
            console.log('📸 Foto capturada con camera:', file);
            console.log('📤 Enviando foto al backend de producție...');
            
            // TRIMITE DIRECT LA BACKEND-UL DE PRODUCȚIE!
            try {
              const formData = new FormData();
              formData.append('file', file);
              formData.append('fileName', file.name);
              formData.append('clientFileId', `CAMERA-${Date.now()}`);
              
              console.log('🌐 Endpoint de producție:', routes.ocrImagen);
              console.log('📤 Enviando foto reala al backend de producție...');
              console.log('📁 File details:', {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
              });
              console.log('📋 FormData contents:');
              for (let [key, value] of formData.entries()) {
                console.log(`  ${key}:`, value);
              }
              
              // TRIMITE LA ENDPOINT-UL TĂU DE TEST!
              const response = await fetch(routes.ocrImagen, {
                method: 'POST',
                body: formData
              });
              
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              
              const ocrResult = await response.json();
              console.log('📥 Respuesta OCR del backend de producție:', ocrResult);
              
              if (ocrResult.success) {
                // Afișează rezultatul OCR
                const confidence = ocrResult.confidence ? Math.round(ocrResult.confidence * 100) : 'N/A';
                alert(`¡OCR completado exitosamente!\n\n📊 Confianza: ${confidence}%\n📄 Proveedor: ${ocrResult.proveedor || ocrResult.magazin || 'N/A'}\n💰 Total: €${ocrResult.total || 'N/A'}\n\nLos datos han sido extraídos automáticamente del backend de producție.`);
                
                // Populează formularul cu datele din OCR
                setSelectedFile(file);
                const url = URL.createObjectURL(blob);
                setPreviewUrl(url);
                
              } else {
                throw new Error(ocrResult.error || 'Error en el procesamiento OCR');
              }
              
                          } catch (error) {
                console.error('❌ Error enviando foto al backend de producție:', error);
                alert('Error al enviar la foto al backend de producție: ' + error.message);
              
              // Fallback: salvează local și afișează preview
              setSelectedFile(file);
              const url = URL.createObjectURL(blob);
              setPreviewUrl(url);
            }
            
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    } catch (error) {
      console.error('Error capturando foto:', error);
      setCameraError('Error al capturar la foto: ' + error.message);
    }
  };

  // Funcție pentru încărcarea listei de tipuri de gasto
  const loadTiposGasto = async () => {
    try {
      setLoadingTiposGasto(true);
              const response = await fetch(routes.getTiposGasto);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📋 Tipos de gasto cargados:', data);
      
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
        if (!selectedTipoGasto || selectedTipoGasto === '') {
          setSelectedTipoGasto('600');
        }
      } else if (data && typeof data === 'object') {
        // Dacă este un obiect, convertește-l în array
        const tiposArray = Object.entries(data).map(([codigo, descripcion]) => ({
          codigo,
          descripcion: typeof descripcion === 'string' ? descripcion : JSON.stringify(descripcion)
        }));
        setTiposGasto(tiposArray);
        
        // Auto-selectează "600. Compras de mercaderías" ca default
        if (!selectedTipoGasto || selectedTipoGasto === '') {
          setSelectedTipoGasto('600');
        }
      }
      
    } catch (error) {
      console.error('❌ Error cargando tipos de gasto:', error);
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
        { codigo: '629', descripcion: '629. Otros servicios', Grupo: '62. Servicios exteriores', isHeader: true },
        { codigo: '6291', descripcion: '6291. Comunicaciones', Grupo: '62. Servicios exteriores' },
        { codigo: '6292', descripcion: '6292. Viajes y desplazamientos', Grupo: '62. Servicios exteriores' },
        { codigo: '6297', descripcion: '6297. Afiliaciones', Grupo: '62. Servicios exteriores' },
        
        // Grup 63: Tributos
        { codigo: '63', descripcion: '63. Tributos', Grupo: '63. Tributos', isHeader: true },
        { codigo: '631', descripcion: '631. Otros tributos (IBI, tasa de basuras)', Grupo: '63. Tributos' },
        
        // Grup 64: Gastos de personal
        { codigo: '64', descripcion: '64. Gastos de personal', Grupo: '64. Gastos de personal', isHeader: true },
        { codigo: '640', descripcion: '640. Sueldos y salarios', Grupo: '64. Gastos de personal' },
        { codigo: '641', descripcion: '641. Indemnizaciones', Grupo: '64. Gastos de personal' },
        { codigo: '642', descripcion: '642. Seguridad Social a cargo de la empresa', Grupo: '64. Gastos de personal' },
        { codigo: '649', descripcion: '649. Otros gastos sociales', Grupo: '64. Gastos de personal' },
        
        // Grup 66: Gastos financieros
        { codigo: '66', descripcion: '66. Gastos financieros', Grupo: '66. Gastos financieros', isHeader: true },
        { codigo: '660', descripcion: '660. Gastos financieros (intereses, comisiones)', Grupo: '66. Gastos financieros' },
        { codigo: '662', descripcion: '662. Intereses de deudas a largo plazo', Grupo: '66. Gastos financieros' },
        { codigo: '663', descripcion: '663. Intereses de deudas a corto plazo', Grupo: '66. Gastos financieros' },
        
        // Grup 68: Dotaciones para amortizaciones
        { codigo: '68', descripcion: '68. Dotaciones para amortizaciones', Grupo: '68. Dotaciones para amortizaciones', isHeader: true },
        { codigo: '680', descripcion: '680. Amortización del inmovilizado intangible', Grupo: '68. Dotaciones para amortizaciones' },
        { codigo: '681', descripcion: '681. Amortización del inmovilizado material', Grupo: '68. Dotaciones para amortizaciones' },
        { codigo: '682', descripcion: '682. Amortización de las inversiones inmobiliarias', Grupo: '68. Dotaciones para amortizaciones' }
      ]);
    } finally {
      setLoadingTiposGasto(false);
    }
  };

  // Funcție pentru procesarea OCR - folosește același endpoint ca la gastos
  const handleProcessOcr = async () => {
    if (!selectedFile) {
      showToast('Seleccione un archivo primero', 'error');
      return;
    }

    try {
      setProcessingOcr(true);
      console.log('🔍 Procesare OCR factura:', selectedFile.name);
      console.log('🌐 Endpoint OCR:', routes.ocrImagen);

      // Creează FormData pentru a trimite fișierul
      const formData = new FormData();
      formData.append('file', selectedFile, selectedFile.name);
              formData.append('fileName', selectedFile.name);
        formData.append('clientFileId', `FACTURA-${Date.now()}`);
        if (selectedTipoGasto) {
          // Găsește tipul de gasto selectat pentru a obține descripția completă
          const tipoSeleccionado = tiposGasto.find(tipo => tipo.codigo === selectedTipoGasto && !tipo.isHeader);
          if (tipoSeleccionado) {
            // Combină codul cu descripția într-un singur câmp
            const tipoGastoCompleto = `${tipoSeleccionado.codigo}. ${tipoSeleccionado.descripcion}`;
            formData.append('tipoGasto', tipoGastoCompleto);
          } else {
            // Fallback dacă nu se găsește
            formData.append('tipoGasto', selectedTipoGasto);
          }
        }

      // Trimite la endpoint-ul OCR de producție
      console.log('🌐 OCR URL (production):', routes.ocrImagen);
      
      const response = await fetch(routes.ocrImagen, {
        method: 'POST',
        body: formData,
        headers: {
          // Nu seta Content-Type pentru FormData, se setează automat
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP Error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      let ocrResult;
      const contentType = response.headers.get('content-type') || '';
      console.log('📡 Content-Type response:', contentType);
      
      try {
        if (contentType.includes('application/json')) {
          ocrResult = await response.json();
        } else {
          const text = await response.text();
          console.log('📄 Raw response text:', text);
          
          // Încearcă să parsezi JSON-ul
          if (text.trim()) {
            try {
              ocrResult = JSON.parse(text);
            } catch (parseError) {
              console.warn('⚠️ JSON parse failed, using raw text:', parseError);
              ocrResult = { 
                raw: text,
                success: false,
                error: 'Invalid JSON response'
              };
            }
          } else {
            ocrResult = { 
              success: false,
              error: 'Empty response from server'
            };
          }
        }
      } catch (error) {
        console.error('❌ Error reading response:', error);
        ocrResult = { 
          success: false,
          error: 'Failed to read response'
        };
      }

      console.log('📊 Rezultat OCR factura:', ocrResult);

      // Procesează rezultatul OCR pentru facturi
      const processedData = {
        total: ocrResult.total || 0,
        nif: ocrResult.nif || ocrResult.cif || '',
        fecha: ocrResult.fecha || new Date().toISOString().split('T')[0],
        proveedor: ocrResult.proveedor || ocrResult.magazin || ocrResult.tienda || 'Proveedor desconocido',
        conceptos: ocrResult.conceptos || ocrResult.productos || []
      };

      // Afișează rezultatul în UI
      showToast('Factura procesada con OCR exitosamente', 'success');
      
      // Log activitatea
      await activityLogger.logAction('factura_ocr_processed', {
        fileName: selectedFile.name,
        processedData,
        ocrResult,
        user: 'Usuario',
        email: 'email@example.com'
      });

             // Închide modalul și resetează state-ul
       setShowOcrModal(false);
                setSelectedFile(null);
         setSelectedTipoGasto('600');

         setProcessingOcr(false);
       if (previewUrl) {
         URL.revokeObjectURL(previewUrl);
         setPreviewUrl(null);
       }

      // Aici poți adăuga logica pentru a crea o nouă factură cu datele OCR
      // sau pentru a actualiza o factură existentă

    } catch (error) {
      console.error('❌ Error procesare OCR factura:', error);
      
      // Afișează mesajul de eroare specific
      let errorMessage = 'Error al procesar la factura con OCR';
      if (error.message.includes('CORS')) {
        errorMessage = 'Error CORS: Endpoint-ul nu permite accesul din browser';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Error de conexión: Nu se poate conecta la server';
      } else if (error.message.includes('JSON')) {
        errorMessage = 'Error de parsing: Răspuns invalid de la server';
      }
      
      showToast(errorMessage, 'error');
      setProcessingOcr(false);
    }
  };

  const exportToExcel = async () => {
    const columns = [
      { key: 'numero', label: 'Número', width: 15 },
      { key: 'proveedor', label: 'Proveedor', width: 25 },
      { key: 'cif', label: 'CIF', width: 15 },
      { key: 'fecha', label: 'Fecha', width: 15 },
      { key: 'concepto', label: 'Concepto', width: 40 },
      { key: 'importe', label: 'Importe', width: 15, type: 'number' },
      { key: 'iva', label: 'IVA', width: 12, type: 'number' },
      { key: 'total', label: 'Total', width: 15, type: 'number' },
      { key: 'estado', label: 'Estado', width: 12 },
      { key: 'archivo', label: 'Archivo', width: 20 }
    ];

    const data = filteredFacturasRecibidas.map(factura => ({
      ...factura,
      fecha: factura.fecha ? new Date(factura.fecha).toLocaleDateString('es-ES') : 'Sin fecha',
      importe: factura.importe ? Number(factura.importe).toFixed(2) : '0.00',
      iva: factura.iva ? Number(factura.iva).toFixed(2) : '0.00',
      total: factura.total ? Number(factura.total).toFixed(2) : '0.00'
    }));

    await exportToExcelWithHeader(
      data, 
      columns, 
      'FACTURAS RECIBIDAS', 
      'facturas_recibidas'
    );
  };

  const getEstadoColor = (estado) => {
    if (!estado) return 'bg-gray-100 text-gray-600';
    
    switch (estado) {
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'pagada':
        return 'bg-green-100 text-green-800';
      case 'vencida':
        return 'bg-red-100 text-red-800';
      case 'anulada':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEstadoText = (estado) => {
    if (!estado) return 'Sin Estado';
    
    switch (estado) {
      case 'pendiente':
        return 'Pendiente';
      case 'pagada':
        return 'Pagada';
      case 'vencida':
        return 'Vencida';
      case 'anulada':
        return 'Anulada';
      default:
        return estado;
    }
  };

  const stats = getStats();



  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Se încarcă...</div>
      </div>
    );
  }

     return (
     <div className="space-y-6 w-full max-w-none">
             {/* Header with Stats - Full Width */}
       <div className="grid grid-cols-1 md:grid-cols-6 gap-4 w-full">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Facturas</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.pendientes}</div>
          <div className="text-sm text-gray-600">Pendientes</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.pagadas}</div>
          <div className="text-sm text-gray-600">Pagadas</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-red-600">€{stats.totalImporte.toFixed(2)}</div>
          <div className="text-sm text-gray-600">Total Importe</div>
        </Card>
                 <Card className="p-4 text-center">
           <div className="text-2xl font-bold text-orange-600">€{stats.totalPendiente.toFixed(2)}</div>
           <div className="text-sm text-gray-600">Pendiente</div>
         </Card>
         <Card className="p-4 text-center">
           <div className="text-2xl font-bold text-purple-600">€{stats.totalImporte.toFixed(2)}</div>
           <div className="text-sm text-gray-600">Total Base</div>
         </Card>
      </div>

             {/* Header - Full Width */}
       <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/inicio-facturacion')}
              className="mr-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Regresar al Inicio"
            >
              <span className="text-gray-600 text-lg">←</span>
            </button>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-gray-800">Facturas Recibidas</h1>
              <p className="text-gray-600 mt-2">Gestiona las facturas de proveedores</p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
            >
              <span>📊</span>
              Export Excel
            </button>
            <button
              onClick={refreshFromWebhook}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <span>↻</span>
              {loading ? 'Actualizando...' : 'Refresh'}
            </button>
            <button
              onClick={() => setShowOcrModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
            >
              <span>🧠</span>
              Cargar vía OCR
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              + Nueva Factura
            </button>
          </div>
        </div>

             {/* Filters - Full Width */}
       <Card className="p-4 w-full">
         <div className="grid grid-cols-1 md:grid-cols-6 gap-4 w-full">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Căutare
            </label>
            <Input
              placeholder="Caută după număr, furnizor..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Proveedor
            </label>
            <Input
              placeholder="Furnizor"
              value={filters.proveedor}
              onChange={(e) => setFilters({ ...filters, proveedor: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <Select
              value={filters.estado}
              onChange={(e) => setFilters({ ...filters, estado: e.target.value })}
            >
              <option value="">Toate</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Pagada">Pagada</option>
              <option value="Incompleta">Incompleta</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Desde
            </label>
            <Input
              type="date"
              value={filters.fechaDesde}
              onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })}
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={resetFilters}
              variant="outline"
              className="w-full"
            >
              Resetează Filtrele
            </Button>
          </div>
        </div>
      </Card>

             {/* Facturas Table - Full Width */}
       <Card className="overflow-hidden w-full">
         {filteredFacturasRecibidas.length > 10 && (
           <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-blue-700 text-sm">
             📜 Tabel cu scroll - {filteredFacturasRecibidas.length} facturi (scroll pentru a vedea toate)
           </div>
         )}
         <div className="overflow-x-auto w-full max-h-[600px] overflow-y-auto custom-scrollbar" style={{
           scrollbarWidth: 'thin',
           scrollbarColor: '#d1d5db #f3f4f6'
         }}>
           <table className="w-full min-w-full">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm backdrop-blur-sm bg-gray-50/95">
              <tr>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('numar_operatiune')}
                >
                  <div className="flex items-center">
                    Número
                    {sortBy === 'numar_operatiune' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('data')}
                >
                  <div className="flex items-center">
                    Fecha
                    {sortBy === 'data' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('Estado')}
                >
                  <div className="flex items-center">
                    Estado
                    {sortBy === 'Estado' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('magazin')}
                >
                  <div className="flex items-center">
                    Proveedor
                    {sortBy === 'magazin' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('baza_impozabila')}
                >
                  <div className="flex items-center">
                    Base Imponible
                    {sortBy === 'baza_impozabila' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  IVA
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  Retención
                </th>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('total_platit')}
                >
                  <div className="flex items-center">
                    Total
                    {sortBy === 'total_platit' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  Imputable
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                  Operaciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFacturasRecibidas.map(factura => (
                                 <tr key={factura.id} className="hover:bg-gray-50">
                   <td className="px-3 py-3 whitespace-nowrap">
                     <div className="text-sm font-medium text-gray-900">
                       {factura.numar_operatiune || '-'}
                     </div>
                   </td>
                   <td className="px-3 py-3 whitespace-nowrap">
                     <div className="text-sm text-gray-900">
                       {factura.data || '-'}
                     </div>
                   </td>
                   <td className="px-3 py-3 whitespace-nowrap">
                     <Badge className={getEstadoColor(factura.Estado)}>
                       {getEstadoText(factura.Estado)}
                     </Badge>
                   </td>
                   <td className="px-3 py-3 whitespace-nowrap">
                     <div className="text-sm text-gray-900">
                       {factura.magazin || '-'}
                     </div>
                   </td>
                   <td className="px-3 py-3 whitespace-nowrap">
                     <div className="text-sm text-gray-900">
                       {factura.baza_impozabila ? `€${parseFloat(factura.baza_impozabila).toFixed(2)}` : '-'}
                     </div>
                   </td>
                   <td className="px-3 py-3 whitespace-nowrap">
                     <div className="text-sm text-gray-900">
                       {factura.tva ? `€${parseFloat(factura.tva).toFixed(2)}` : '-'}
                     </div>
                   </td>
                   <td className="px-3 py-3 whitespace-nowrap">
                     <div className="text-sm text-gray-500">
                       {factura.ValorRetencion ? `€${parseFloat(factura.ValorRetencion).toFixed(2)}` : '-'}
                     </div>
                   </td>
                   <td className="px-3 py-3 whitespace-nowrap">
                     <div className="text-lg font-semibold text-red-600">
                       {factura.total_platit ? `€${parseFloat(factura.total_platit).toFixed(2)}` : '-'}
                     </div>
                   </td>
                   <td className="px-3 py-3 whitespace-nowrap">
                     <div className="text-sm text-gray-500">
                       {factura.Imputable || '-'}
                     </div>
                   </td>
                   <td className="px-3 py-3 whitespace-nowrap text-sm font-medium">
                     <div className="flex items-center space-x-3">
                       {/* Acciones rápidas predeterminadas - IDENTICE cu facturile emise */}
                       <button
                         onClick={() => handleAttachFiles(factura)}
                         className="text-gray-600 hover:text-gray-900"
                         title="Adjuntar archivo a factura"
                       >
                         📎
                       </button>
                       <button
                         onClick={() => handleToggleCobro(factura)}
                         className="text-gray-600 hover:text-gray-900"
                         title="Gestionar cobro (marcar pagado/pendiente)"
                       >
                         💶
                       </button>
                       <button
                         onClick={() => handleDownloadPDF(factura)}
                         className="text-gray-600 hover:text-gray-900"
                         title="Exportar o imprimir en PDF"
                       >
                         🖨️
                       </button>

                                               {/* Menú de más acciones - IDENTIC cu facturile emise */}
                        <div className="relative inline-block menu-container">
                          <button
                            className="text-gray-700 hover:text-gray-900"
                            title="Acciones"
                            onClick={() => setOpenMenuId(openMenuId === factura.id ? null : factura.id)}
                          >
                            ⋮
                          </button>
                          {openMenuId === factura.id && (
                                                    <div className="absolute right-0 mt-2 min-w-[12rem] bg-white border border-gray-200 rounded-md shadow-xl z-50 flex flex-col py-1">
                            <button onClick={() => handleView(factura)} className="w-full text-left px-3 py-2 hover:bg-gray-50">→ Ver factura {factura.numar_operatiune || factura.id}</button>
                            <button onClick={() => handleEdit(factura)} className="w-full text-left px-3 py-2 hover:bg-gray-50">✏️ Editar factura</button>
                            <button onClick={() => handleCopyInvoice(factura)} className="w-full text-left px-3 py-2 hover:bg-gray-50">📋 Crear factura por copia</button>
                            <button onClick={() => handleToggleCobro(factura)} className="w-full text-left px-3 py-2 hover:bg-gray-50">💰 Gestionar los cobros de la factura</button>
                            <button onClick={() => handleAttachFiles(factura)} className="w-full text-left px-3 py-2 hover:bg-gray-50">📎 Adjuntar archivos a esta factura</button>
                            <button onClick={() => handleManageTags(factura)} className="w-full text-left px-3 py-2 hover:bg-gray-50">🏷️ Gestionar etiquetas</button>
                            <button onClick={() => handleDownloadPDF(factura)} className="w-full text-left px-3 py-2 hover:bg-gray-50">📄 Exportar o imprimir en PDF</button>
                            <button onClick={() => handleGenerateCreditNote(factura)} className="w-full text-left px-3 py-2 hover:bg-gray-50">📝 Generar un abono de la factura</button>
                            <button onClick={() => handleDelete(factura)} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600">🗑️ Eliminar factura {factura.numar_operatiune || factura.id}</button>
                          </div>
                         )}
                       </div>
                     </div>
                   </td>
                 </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan="8" className="px-4 py-3 text-sm font-medium text-gray-700">
                  Total Facturas: {filteredFacturasRecibidas.length}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-700">
                  €{filteredFacturasRecibidas.reduce((sum, f) => sum + (parseFloat(f.total_platit) || 0), 0).toFixed(2)}
                </td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {filteredFacturasRecibidas.length === 0 && (
        <Card className="p-12 text-center">
          <div className="text-gray-500">
            <p className="text-lg mb-2">Nu s-au găsit facturi</p>
            <p className="text-sm">
              Încearcă să modifici filtrele sau să adaugi o factură nouă
            </p>
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <NuevaFacturaModal
        isOpen={showAddModal}
        onClose={handleCancel}
          onSave={handleSave}
        />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteModal}
        onClose={() => setShowDeleteModal(null)}
        size="md"
      >
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Confirmă ștergerea
          </h3>
          <p className="text-gray-600 mb-6">
            Ești sigur că vrei să ștergi factura &quot;{showDeleteModal?.numero}&quot;? 
            Această acțiune nu poate fi anulată.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(null)}
            >
              Anulează
            </Button>
            <Button
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Șterge
            </Button>
                      </div>
        </div>
      </Modal>

      {/* Modal pentru atașarea fișierelor */}
        <FileAttachmentModal
          isOpen={showFileModal}
          onClose={() => {
            setShowFileModal(false);
            setSelectedFacturaForFiles(null);
          }}
          factura={selectedFacturaForFiles}
          onSave={handleSaveFiles}
          isViewMode={false}
        />

        {/* Modal pentru vizualizarea facturii */}
        <FileAttachmentModal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedFacturaForView(null);
          }}
          factura={selectedFacturaForView}
          onSave={() => {}} // Nu avem nevoie de onSave pentru vizualizare
          isViewMode={true}
        />

        {/* Modal pentru încărcarea cu OCR */}
        {showOcrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
            
            {/* Camera Modal Overlay */}
            {showCamera && (
              <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[10000]">
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
                      <button onClick={stopCamera} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-white">
                        Cerrar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative">
                        <video
                          id="camera-video-ocr"
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
                        <button
                          onClick={capturePhoto}
                          disabled={!cameraStream}
                          className="bg-red-600 hover:bg-red-700 px-8 py-3 text-lg text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          📸 Capturar foto
                        </button>
                        <button
                          onClick={stopCamera}
                          className="px-8 py-3 text-lg border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg"
                        >
                          ❌ Cancelar
                        </button>
                      </div>
                      
                      <div className="text-center text-sm text-gray-600">
                        <p>📱 Apunta a la factura y captura la imagen</p>
                        <p>💡 Asegúrate de que la factura esté bien iluminada</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Header cu branding OCR */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-red-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-red-600 text-xl">🧠</div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Cargar y previsualizar factura</h3>
                  <p className="text-xs text-gray-500">Procesado con AI OCR — extracción automática de datos</p>
                </div>
              </div>
              <button onClick={() => setShowOcrModal(false)} className="text-gray-500 hover:text-gray-800 text-xl">✕</button>
            </div>

                         <div className="p-6 space-y-4 overflow-y-auto flex-1">
               {/* Dropzone stilizat */}
               {!selectedFile ? (
                 <div className="space-y-4">
                 <label className="block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-red-300 transition-colors">
                     <input 
                       id="file-upload-ocr"
                       hidden 
                       type="file" 
                       accept="image/*,application/pdf" 
                       onChange={(e) => {
                   const file = e.target.files?.[0];
                   if (file) {
                     setSelectedFile(file);
                     // Pentru PDF pe mobile, folosim base64; pentru restul, blob URL
                     if (file.type === 'application/pdf' && isMobile) {
                       const reader = new FileReader();
                       reader.onload = () => {
                         setPreviewUrl(reader.result);
                       };
                       reader.readAsDataURL(file);
                     } else {
                       const url = URL.createObjectURL(file);
                       setPreviewUrl(url);
                     }
                     console.log('Fișier selectat pentru OCR:', file);
                   }
                       }} 
                     />
                   <div className="text-3xl mb-2">📄</div>
                   <div className="font-medium text-gray-800">Seleccione un archivo o arrástrelo aquí</div>
                   <div className="text-sm text-gray-500">Imágenes o PDF — se sube primero y luego se procesa con IA</div>
                 </label>
                   
                   {/* Butoane pentru cameră și upload */}
                   <div className="flex justify-center gap-4">
                     <button
                       onClick={() => document.getElementById('file-upload-ocr').click()}
                       className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
                     >
                       📁 Seleccionar archivo
                     </button>
                     <button
                       onClick={startCamera}
                       className="px-6 py-3 border-2 border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium flex items-center gap-2"
                     >
                       📷 Usar cámara
                     </button>
                   </div>
                 </div>
               ) : (
                 /* Preview del archivo seleccionado */
                 <div className="space-y-4">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center text-green-600 text-xl">✅</div>
                       <div>
                         <h4 className="font-medium text-gray-900">{selectedFile.name}</h4>
                         <p className="text-sm text-gray-500">
                           {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type}
                         </p>
                       </div>
                     </div>
                     <button
                       onClick={() => {
                         setSelectedFile(null);
                         if (previewUrl) {
                           URL.revokeObjectURL(previewUrl);
                           setPreviewUrl(null);
                         }
                       }}
                       className="text-gray-500 hover:text-gray-800 text-xl"
                       title="Cambiar archivo"
                     >
                       🔄
                     </button>
                   </div>
                   
                   {/* Preview visual */}
                   <div className="border rounded-lg bg-gray-50">
                     {selectedFile.type.startsWith('image/') ? (
                       <img
                         src={previewUrl}
                         alt="Preview"
                         className="max-h-[420px] object-contain mx-auto"
                       />
                     ) : selectedFile.type === 'application/pdf' ? (
                      isAndroid ? (
                        <PDFViewerAndroid 
                          pdfUrl={previewUrl}
                          className="w-full h-[420px]"
                        />
                      ) : isIOS ? (
                        <object
                          data={previewUrl}
                          type="application/pdf"
                          className="w-full h-[420px] border-0"
                        >
                          <div className="p-4 text-center text-gray-600">
                            <p className="mb-3">No se puede mostrar el PDF en este visor.</p>
                            <a
                              href={previewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
                            >
                              Abrir PDF en una nueva pestaña
                            </a>
                          </div>
                        </object>
                      ) : (
                        <iframe 
                          title="PDF Preview" 
                          src={previewUrl} 
                          className="w-full h-[420px] border-0"
                        />
                      )
                    ) : (
                       <div className="text-center py-8">
                         <div className="text-4xl mb-2">📁</div>
                         <p className="text-gray-600 font-medium">{selectedFile.name}</p>
                         <p className="text-sm text-gray-500">Archivo seleccionado</p>
                       </div>
                     )}
                   </div>
                 </div>
               )}

              {/* Hint AI */}
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span>⚙️</span>
                <span>La IA extrae: CIF/NIF, proveedor, fecha, conceptos y totales. Revisa el resultado en la lista.</span>
              </div>

              {/* Tipo de gasto */}
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-700">Tipo de gasto:</div>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  onChange={(e) => setSelectedTipoGasto(e.target.value)}
                  value={selectedTipoGasto || ''}
                  disabled={loadingTiposGasto}
                >
                  <option value="">
                    {loadingTiposGasto ? 'Cargando tipos de gasto...' : 'Selecciona el tipo de gasto'}
                  </option>
                  {tiposGasto.map((tipo) => (
                    <option 
                      key={tipo.codigo} 
                      value={tipo.codigo}
                      disabled={tipo.isHeader}
                      style={{
                        fontWeight: tipo.isHeader ? 'bold' : 'normal',
                        backgroundColor: tipo.isHeader ? '#f3f4f6' : 'transparent',
                        color: tipo.isHeader ? '#374151' : '#000',
                        paddingLeft: tipo.isHeader ? '8px' : '24px',
                        fontSize: tipo.isHeader ? '14px' : '13px'
                      }}
                    >
                      {tipo.isHeader ? `📁 ${tipo.descripcion}` : `  ${tipo.codigo}. ${tipo.descripcion}`}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
              <div className="text-xs text-gray-500">
                Procesamiento con IA OCR
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => {
                  setShowOcrModal(false);
                  setSelectedFile(null);
                  setSelectedTipoGasto('600');

                  setProcessingOcr(false);
                  if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }
                }} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                <button
                  onClick={handleProcessOcr}
                  disabled={!selectedFile || !selectedTipoGasto || processingOcr}
                  className="px-5 py-2 rounded-md text-white shadow bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {processingOcr ? 'Procesando...' : 'Procesar con OCR'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacturasRecibidasList;
