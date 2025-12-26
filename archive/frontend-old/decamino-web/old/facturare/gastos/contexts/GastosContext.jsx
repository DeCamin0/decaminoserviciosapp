import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PeriodoContext } from '../../../contexts/PeriodoContext';
import { AuthContext } from '../../../contexts/AuthContext';
import activityLogger from '../../../utils/activityLogger';
import { routes } from '../../../utils/routes';

const GastosContext = createContext();

export const useGastos = () => {
  const context = useContext(GastosContext);
  if (!context) {
    throw new Error('useGastos must be used within a GastosProvider');
  }
  return context;
};

export const GastosProvider = ({ children }) => {
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Use useContext directly - hooks must be called at top level unconditionally
  const periodoContext = useContext(PeriodoContext);
  const authContext = useContext(AuthContext);
  const { from, to } = periodoContext || { from: null, to: null };
  const user = authContext?.user || null;

  const showToast = useCallback((message) => {
    if (!message) return;
    setToastMessage(message);
    // Ascunde automat după 3 secunde - cu cleanup
    const timeoutId = setTimeout(() => setToastMessage(''), 3000);
    return () => clearTimeout(timeoutId);
  }, []);

  // Încarcă gastos la inițializare (preferă backend; fallback localStorage)
  useEffect(() => {
    const init = async () => {
    const savedGastos = localStorage.getItem('gastos');
    if (savedGastos) {
      try {
        setGastos(JSON.parse(savedGastos));
      } catch (error) {
        console.error('Error loading gastos from localStorage:', error);
        setGastos([]);
      }
      }
      // Încearcă să încarci din backend
      try {
        await fetchGastosFromServer();
      } catch (e) {
        console.warn('Folosesc lista locală de gastos (fallback).');
      }
    };
    init();
  }, []);

  // Încarcă lista de gastos din backend
  const fetchGastosFromServer = useCallback(async () => {
    try {
      setLoading(true);
      // console.log('📥 Fetch lista gastos →', routes.getGastos);
      const response = await fetch(routes.getGastos);
      // console.log('📥 Răspuns lista gastos:', {
      //   status: response.status,
      //   ok: response.ok,
      //   contentType: response.headers.get('content-type') || ''
      // });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      // Log raw body pentru debugging - comentat pentru performanță
      const rawBody = await response.clone().text();
      // console.log('🧾 RAW body gastos (trunchiat la 2KB):', rawBody.slice(0, 2048));

      let data;
      try {
        data = JSON.parse(rawBody);
      } catch {
        console.warn('⚠️ Body nu este JSON valid, folosesc fallback []');
        data = [];
      }
      const mapped = Array.isArray(data) ? data.map((item, idx) => ({
        id: item.id || item.gastoId || `GASTO-SRV-${idx}-${Date.now()}`,
        fileName: item.fileName || item.nombre || item.archivo || 'gasto.pdf',
        originalName: item.originalName || item.fileName || item.nombre || 'gasto.pdf',
        fileSize: Number(item.fileSize || item.tamano || 0),
        uploadDate: item.uploadDate || item.fecha || new Date().toISOString(),
        status: item.status || item.estado || 'procesado',
        // Adăugăm câmpurile necesare pentru tabel
        numar_operatiune: item.numar_operatiune || item.numero || item.numero_operacion || `OP-${idx + 1}`,
        data: item.data || item.fecha || item.uploadDate || new Date().toISOString().split('T')[0],
        produse_text: item.produse_text || item.concepto || item.productos || item.descripcion || 'Sin descripción',
        total_platit: Number(item.total_platit || item.total || item.importe || 0),
        imputable: item.imputable !== undefined ? item.imputable : true, // Imputable implicit
        // Câmpurile vechi pentru compatibilitate
        magazin: item.magazin || item.tienda || item.proveedor || '',
        adresa: item.adresa || item.direccion || '',
        telefon: item.telefon || item.phone || '',
        cif: item.cif || item.nif || item.dni || '',
        tip_bon: item.tip_bon || item.tipo_bon || item.tipo_documento || '',
        ora: item.ora || item.hora || '',
        baza_impozabila: item.baza_impozabila || item.base_imponible || item.base || 0,
        tva: item.tva || item.iva || 0,
        cota_tva: item.cota_tva || item.tipo_iva || item.porcentaje_iva || 21,
        moneda: item.moneda || item.currency || 'EUR',
        metoda_plata: item.metoda_plata || item.metodo_pago || item.forma_pago || '',
        rest: item.rest || item.cambio || item.vuelto || 0,
        processedData: item.processedData || item.detalles || {
          total: Number(item.total_platit || item.total || 0),
          nif: item.nif || item.cif || '',
          fecha: item.fecha || (item.uploadDate ? new Date(item.uploadDate).toISOString().split('T')[0] : undefined),
          proveedor: item.proveedor || item.magazin || item.tienda || 'Proveedor',
          conceptos: item.conceptos || item.productos || item.produse_text || []
        },
        // semnale pentru descărcare
        hasFile: Boolean(item.hasFile || item.fileUrl || item.downloadUrl || item.base64),
        downloadUrl: item.downloadUrl || item.fileUrl || undefined
      })) : [];
      // console.log('✅ Gastos mapate:', { count: mapped.length, sample: mapped[0] });
      setGastos(mapped);
      localStorage.setItem('gastos', JSON.stringify(mapped));
      return { success: true, count: mapped.length };
    } catch (error) {
      console.error('Error fetching gastos from server:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Salvează gastos în localStorage când se modifică
  useEffect(() => {
    localStorage.setItem('gastos', JSON.stringify(gastos));
  }, [gastos]);

  // Generează ID-uri
  const generateGastoId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `GASTO-${timestamp}-${random}`;
  };

  const generateShortId = (length = 10) => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < length; i += 1) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
  };

  // Încarcă un fișier (orice tip)
  const uploadGasto = async (file, options = { autoProcess: true }) => {
    try {
      setLoading(true);
      
      // Validează fișierul
      if (!file) {
        return { success: false, error: 'No se ha seleccionado ningún archivo' };
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        return { success: false, error: 'El archivo es demasiado grande. Máximo 10MB' };
      }

      // Creează un nou gasto
      const clientFileId = generateShortId(10);
      const newGasto = {
        id: generateGastoId(),
        clientFileId,
        fileName: file.name,
        originalName: file.name,
        fileSize: file.size,
        uploadDate: new Date().toISOString(),
        status: 'cargado', // cargado, pendiente, procesado
        processedData: null, // Pentru datele extrase prin OCR/AI
        uploadedBy: user?.email || 'unknown',
        createdAt: new Date().toISOString()
      };

      // Salvează fișierul original pentru a-l trimite la backend
      newGasto.originalFile = file;
      // Salvează și ca Data URL pentru preview/descărcare
      const fileData = await readFileAsDataURL(file);
      newGasto.fileData = fileData;

      setGastos(prev => [newGasto, ...prev]);

      // Procesează automat documentul după încărcare (opțional)
      if (options?.autoProcess) {
      setTimeout(async () => {
        try {
          console.log('🔄 Procesare automată document:', newGasto.fileName);
          await processGasto(newGasto.id);
        } catch (error) {
          console.error('❌ Error procesare automată:', error);
        }
        }, 800); // mic delay pentru a permite încărcarea
      }

      // Log activitatea
      await activityLogger.logAction('gasto_uploaded', {
        gastoId: newGasto.id,
        clientFileId,
        fileName: newGasto.fileName,
        fileSize: newGasto.fileSize,
        user: user?.['NOMBRE / APELLIDOS'] || user?.nombre,
        email: user?.email
      });

      return { success: true, gasto: newGasto };
    } catch (error) {
      console.error('Error uploading gasto:', error);
      return { success: false, error: 'Error al cargar el archivo' };
    } finally {
      setLoading(false);
    }
  };

  // Creează un gasto manual (fără fișier), util pentru introducere directă
  const createManualGasto = async (fields) => {
    try {
      const manual = {
        id: generateGastoId(),
        fileName: null,
        originalName: null,
        fileSize: 0,
        uploadDate: new Date().toISOString(),
        status: 'procesado',
        // Adăugăm câmpurile necesare pentru tabel
        numar_operatiune: fields.numar_operatiune || fields.numero || `OP-${Date.now()}`,
        data: fields.data || new Date().toISOString().split('T')[0],
        produse_text: fields.produse_text || fields.concepto || 'Sin descripción',
        total_platit: Number(fields.total_platit || 0),
        imputable: fields.imputable !== undefined ? fields.imputable : true,
        processedData: {
          total: Number(fields.total_platit || 0),
          nif: fields.cif || '',
          fecha: fields.data || new Date().toISOString().split('T')[0],
          proveedor: fields.magazin || 'Proveedor',
          conceptos: fields.produse_text || ''
        },
        ...fields
      };
      setGastos(prev => [manual, ...prev]);
      return { success: true, item: manual };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  // Citește fișierul ca Data URL
  const readFileAsDataURL = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Convertește Data URL înapoi la File object
  const dataURLToFile = (dataURL, filename) => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Citește fișierul ca base64 pentru GET request
  // const readFileAsBase64 = (file) => { // Unused function
  //   return new Promise((resolve, reject) => {
  //     const reader = new FileReader();
  //     reader.onload = () => {
  //       // Extrage doar partea base64 din Data URL
  //       const base64 = reader.result.split(',')[1];
  //       resolve(base64);
  //     };
  //     reader.onerror = reject;
  //     reader.readAsDataURL(file);
  //   });
  // };

  // Procesează un gasto cu analiza reală a documentului
  const processGasto = async (id) => {
    try {
      setLoading(true);
      
      const gasto = gastos.find(g => g.id === id);
      if (!gasto) {
        return { success: false, error: 'Gasto no encontrado' };
      }

      // Trimite fișierul original la endpoint-ul de analiză
      const formData = new FormData();
      
      // Folosește fișierul original dacă există, altfel convertește din Data URL
      let fileToSend;
      if (gasto.originalFile) {
        fileToSend = gasto.originalFile;
        console.log('✅ Folosește fișierul original');
      } else if (gasto.fileData) {
        // Pentru compatibilitate cu fișierele vechi
        fileToSend = dataURLToFile(gasto.fileData, gasto.fileName);
        console.log('🔄 Convertește din Data URL');
      } else {
        throw new Error('No hay datos del archivo para procesar');
      }
      
      // Atașează fișierul DOAR sub cheia "file" + metadate utile
      formData.append('file', fileToSend, gasto.fileName);
      formData.append('fileName', gasto.fileName);
      formData.append('clientFileId', gasto.clientFileId || generateShortId(8));
      
      // Log pentru debugging
      console.log('📤 FormData conține:', {
        fileName: gasto.fileName,
        fileType: fileToSend.type,
        fileSize: fileToSend.size,
        isFile: fileToSend instanceof File
      });

      console.log('🔍 Trimite document pentru analiză:', gasto.fileName);
      console.log('📁 Tip fișier:', fileToSend.type);
      console.log('📏 Dimensiune fișier:', fileToSend.size, 'bytes');
      console.log('🌐 Endpoint OCR:', routes.ocrImagen);
      console.log('📤 Headers: multipart/form-data via browser; chei: file, fileName');

      // Folosim POST cu FormData pentru a trimite fișierul
      console.log('🔍 POST request cu fișierul către OCR endpoint');
      console.log('📤 Trimite POST la:', routes.ocrImagen);
      
      const response = await fetch(routes.ocrImagen, {
        method: 'POST',
        body: formData,
        // fetch nu suportă timeout nativ; lăsăm browserul să gestioneze
      });

      console.log('✅ Răspuns webhook status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let analisisResult;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        analisisResult = await response.json();
      } else {
        // Unele workflows n8n pot răspunde cu text; încercăm să parsăm flexibil
        const text = await response.text();
        try {
          analisisResult = JSON.parse(text);
        } catch {
          analisisResult = { raw: text };
        }
      }
      console.log('📊 Rezultat analiză document:', analisisResult);

      // Procesează rezultatul analizei
      let processedData = {
        total: 0,
        nif: '',
        fecha: new Date().toISOString().split('T')[0],
        proveedor: 'Proveedor desconocido',
        conceptos: []
      };

      // Extrage datele din răspunsul API-ului
      if (analisisResult) {
        if (analisisResult.total) {
          processedData.total = parseFloat(analisisResult.total);
        }
        if (analisisResult.nif || analisisResult.cif) {
          processedData.nif = analisisResult.nif || analisisResult.cif;
        }
        if (analisisResult.fecha) {
          processedData.fecha = analisisResult.fecha;
        }
        if (analisisResult.proveedor || analisisResult.magazin || analisisResult.tienda) {
          processedData.proveedor = analisisResult.proveedor || analisisResult.magazin || analisisResult.tienda;
        }
        if (analisisResult.conceptos && Array.isArray(analisisResult.conceptos)) {
          processedData.conceptos = analisisResult.conceptos;
        } else if (analisisResult.productos) {
          processedData.conceptos = Array.isArray(analisisResult.productos) ? analisisResult.productos : [analisisResult.productos];
        } else if (analisisResult.produse_text) {
          processedData.conceptos = [analisisResult.produse_text];
        }
        if (analisisResult.detalles) {
          processedData.detalles = analisisResult.detalles;
        }
      }

      // Actualizează gasto-ul cu datele procesate
      setGastos(prev => prev.map(g => {
        if (g.id === id) {
          return {
            ...g,
            status: 'procesado',
            processedData,
            processedAt: new Date().toISOString(),
            processedBy: user?.email || 'unknown',
            analisisResult // Salvează și rezultatul complet pentru debugging
          };
        }
        return g;
      }));

      // Log activitatea
      await activityLogger.logAction('gasto_processed', {
        gastoId: id,
        fileName: gasto.fileName,
        processedData,
        analisisResult,
        user: user?.['NOMBRE / APELLIDOS'] || user?.nombre,
        email: user?.email
      });

      // Reîmprospătează lista din server pentru a afișa în listă elementul confirmat de backend
      try {
        await fetchGastosFromServer();
        showToast('Gasto procesado y sincronizado');
      } catch (_) {
        // Ignoră erorile aici; UI rămâne pe datele locale
      }

      return { success: true, processedData, analisisResult };
    } catch (error) {
      console.error('❌ Error processing gasto (sin enviar a backend):', error);
      // Nu mai simulăm procesarea ca „procesado” — marcăm ca pendiente și afișăm eroare
      setGastos(prev => prev.map(g => {
        if (g.id === id) {
          return {
            ...g,
            status: 'pendiente',
            error: error?.message || 'Fallo al enviar al backend'
          };
        }
        return g;
      }));
      showToast('Eroare: nu s-a putut trimite documentul la backend');
      return { success: false, error: error?.message || 'Fallo al enviar al backend' };
    } finally {
      setLoading(false);
    }
  };

  // Șterge un gasto
  const deleteGasto = async (id) => {
    try {
      setLoading(true);
      
      const gastoToDelete = gastos.find(g => g.id === id);
      
      setGastos(prev => prev.filter(gasto => gasto.id !== id));

      // Log activitatea
      await activityLogger.logAction('gasto_deleted', {
        gastoId: id,
        fileName: gastoToDelete?.fileName,
        user: user?.['NOMBRE / APELLIDOS'] || user?.nombre,
        email: user?.email
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting gasto:', error);
      return { success: false, error: 'Error al eliminar el gasto' };
    } finally {
      setLoading(false);
    }
  };

  // Obține un gasto după ID
  const getGastoById = (id) => {
    return gastos.find(gasto => gasto.id === id);
  };

  // Filtrează gastos după status
  const getGastosByStatus = (status) => {
    return gastos.filter(gasto => gasto.status === status);
  };

  // Obține statistici pentru gastos
  const getGastosStats = () => {
    const inPeriod = (g) => {
      if (!from || !to) return true;
      const dStr = g?.processedData?.fecha || g?.uploadDate || g?.data || g?.fecha;
      const d = dStr ? new Date(dStr) : new Date(0);
      return d >= from && d <= to;
    };
    const scoped = gastos.filter(inPeriod);
    const total = scoped.length;
    // "Cargados" = totalul încărcărilor (indiferent dacă sunt procesate sau pendinte)
    const cargado = total;
    const pendiente = scoped.filter(g => g.status === 'pendiente').length;
    const procesado = scoped.filter(g => g.status === 'procesado').length;
    
    const totalProcessed = scoped
      .filter(g => g.status === 'procesado' && g.processedData?.total)
      .reduce((sum, g) => sum + (g.processedData.total || 0), 0);

    return {
      total,
      cargado,
      pendiente,
      procesado,
      totalProcessed: Number(totalProcessed.toFixed(2))
    };
  };

  // Descarcă fișierul original
  const downloadGasto = (gasto) => {
    try {
      if (!gasto.fileData) {
        throw new Error('No hay datos del archivo');
      }

      // Creează un link pentru descărcare
      const link = document.createElement('a');
      link.href = gasto.fileData;
      link.download = gasto.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return { success: true };
    } catch (error) {
      console.error('Error downloading gasto:', error);
      return { success: false, error: 'Error al descargar el archivo' };
    }
  };

  const value = {
    gastos,
    loading,
    toastMessage,
    showToast,
    fetchGastosFromServer,
    uploadGasto,
    createManualGasto,
    processGasto,
    deleteGasto,
    getGastoById,
    getGastosByStatus,
    getGastosStats,
    downloadGasto
  };

  return (
    <GastosContext.Provider value={value}>
      {children}
    </GastosContext.Provider>
  );
}; 