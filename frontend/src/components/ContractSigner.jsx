import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import SignatureCanvas from './SignatureCanvas';
import SignaturePadComponent from '../shared/components/SignaturePad';
import { useAuth } from '../contexts/AuthContextBase';
import { routes } from '../utils/routes';
import { fetchWithAuth } from '../utils/tokenRefresh';
import {
  CONTRATO_TRABAJADOR_SIGNATURE_SLOT,
  CONTRATO_MARGEN_IZQUIERDO_SLOT,
  CONTRATO_FIRMA_DIGITAL_CAPTION,
  getContratoSignatureSlot,
  getContratoMargenIzquierdoSlot,
  buildContratoFirmaDigitalCaptionLines,
} from '../constants/contratoPdfSignatureLayout';

// Configurare worker PDF.js - folosește configurația centralizată
import '../config/pdfjs';

// CSS pentru noul layout
const dialogStyles = `
  .dlg {
    position: fixed;
    inset: 5vh 2.5vw;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,.2);
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    z-index: 1000;
  }

  .dlg__header {
    flex: 0 0 auto;
    padding: 0;
    border-bottom: none;
    background: linear-gradient(to right, #dbeafe, #bfdbfe);
    position: relative;
    z-index: 1001; /* Deasupra canvas-ului PDF */
  }

  .dlg__body {
    flex: 1 1 auto;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 12px;
    scroll-behavior: smooth;
    max-width: 100%;
    box-sizing: border-box;
  }

  .dlg__footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    border-top: 1px solid #eee;
    padding: 12px 16px;
    display: flex;
    gap: 8px;
    z-index: 1001;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
  }
  
  /* Optimizări mobile pentru footer */
  @media (max-width: 768px) {
    .dlg__footer {
      padding: 16px 12px;
      gap: 12px;
      flex-direction: column;
      /* Ascunde footer-ul pe mobil pentru a nu interfera cu preview-ul */
      display: none;
    }
    
    .dlg__footer button {
      width: 100%;
      padding: 16px 20px !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      border-radius: 12px !important;
      min-height: 48px;
    }
    
    .dlg__body {
      /* Nu mai avem nevoie de padding-bottom pentru footer pe mobil */
      padding-bottom: 16px;
      -webkit-overflow-scrolling: touch; /* Smooth scroll pe iOS */
    }
    
    /* PDF Viewer pe mobil - înălțime flexibilă */
    @media (max-width: 768px) {
      .pdf-canvas-container {
        max-height: calc(100vh - 200px) !important; /* Mai mult spațiu pentru preview pe mobil */
        overflow-x: hidden !important;
        overflow-y: auto !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
    }
    
    /* PDF Viewer pe desktop - înălțime mai mare */
    @media (min-width: 769px) {
      .pdf-canvas-container {
        max-height: 70vh !important;
        overflow-x: hidden;
        overflow-y: auto;
        max-width: 100%;
        box-sizing: border-box;
      }
    }
    
    /* Buton fixat pentru a afișa/ascunde footer-ul pe mobil */
    .mobile-footer-toggle {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1002;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(to bottom right, #3b82f6, #2563eb);
      color: white;
      border: none;
      box-shadow: 0 4px 20px rgba(59, 130, 246, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .mobile-footer-toggle:active {
      transform: scale(0.95);
    }
    
    /* Când footer-ul este vizibil, afișează-l */
    .dlg__footer.mobile-visible {
      display: flex !important;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 1003;
      background: #fff;
      border-top: 2px solid #e5e7eb;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
    }
    
    .dlg__footer.mobile-visible ~ .dlg__body {
      padding-bottom: 180px;
    }
  }
  
  /* Pentru tablete */
  @media (min-width: 769px) and (max-width: 1024px) {
    .dlg__footer {
      padding: 14px 20px;
      gap: 10px;
    }
    
    .dlg__footer button {
      padding: 14px 24px !important;
      font-size: 15px !important;
      min-height: 44px;
    }
  }

  .support-bubble { z-index: 900; }
`;

export default function ContractSigner({ 
  pdfUrl, 
  docId, 
  originalFileName, 
  onClose, 
  onSignComplete,
  // Props pentru UPDATE în loc de INSERT (pentru documente oficiale din DocumentosEmpleadosPage)
  empleadoId = null, // CODIGO al angajatului căruia îi aparține documentul
  empleadoEmail = null, // Email al angajatului
  empleadoNombre = null, // Numele angajatului
  documentoDocId = null, // doc_id al documentului existent (pentru UPDATE)
  updateExisting = false, // Flag pentru a face UPDATE în loc de INSERT
  tipoDocumento = null, // tipo_documento original (pentru a-l păstra la UPDATE)
  /** Pad-only: stamp automat pe ultima pagină (caseta trabajador/a). Fără plasare liberă. */
  autoStampMode = false,
}) {
  const { user: authUser } = useAuth();
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signatures, setSignatures] = useState({}); // { pageNum: signatureData } — free place mode
  /** dataUrl confirmat din pad (autoStampMode) */
  const [autoPadSignature, setAutoPadSignature] = useState(null);
  const [isPlacingSignature, setIsPlacingSignature] = useState(false); // Pentru poziționarea semnăturii
  const [draggedSignature, setDraggedSignature] = useState(null); // Pentru drag & drop vizual
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 }); // Poziția mouse-ului pentru preview
  const [showMobileFooter, setShowMobileFooter] = useState(false); // Pentru toggle footer pe mobil
  /** autoStampMode: casuță mică de semnare (tip Vecindario) */
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [firmaDraft, setFirmaDraft] = useState('');
  const [firmaBusy, setFirmaBusy] = useState(false);
 
  const canvasRef = useRef(null);
  const signatureRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Desenează semnătura pe canvas-ul PDF
  const drawSignature = useCallback((context, signature) => {
    if (!signature || !signature.dataUrl) return;
    
    const img = new Image();
    img.onload = () => {
      try {
        // Desenează semnătura la poziția și dimensiunea specificată
        context.drawImage(
          img,
          signature.x,
          signature.y,
          signature.width,
          signature.height
        );
      } catch (err) {
        console.error('Error drawing signature:', err);
      }
    };
    
    img.onerror = () => {
      console.error('Error loading signature image');
    };
    
    img.src = signature.dataUrl;
  }, []);
  
  // Convertește coordonatele ecran → PDF
  const handleCanvasMouseMove = useCallback((event) => {
    if (!isPlacingSignature) return;
    
    // Actualizează poziția mouse-ului pentru preview-ul semnăturii
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    setMousePosition({ x, y });
  }, [isPlacingSignature]);

  // Încarcă PDF-ul
  useEffect(() => {
    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        
        setPdfDocument(pdf);
        setTotalPages(pdf.numPages);
        // Preview normal starts on page 1; jump to last page when signing starts
        setCurrentPage(1);
        setLoading(false);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('No se pudo cargar el PDF');
        setLoading(false);
      }
    };

    if (pdfUrl) {
      loadPDF();
    }
  }, [pdfUrl, autoStampMode]);

  // Randează pagina curentă
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDocument || !canvasRef.current) return;

      try {
        // Anulează operația anterioară dacă există
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // Ignoră erorile de anulare
          }
          renderTaskRef.current = null;
        }

        const page = await pdfDocument.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        if (!context) return;
        
        // Găsește containerul PDF
        const container = canvas.closest('.pdf-canvas-container');
        
        // Calculează scale-ul corect bazat pe lățimea disponibilă
        let finalScale = scale;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          // Lățime disponibilă = lățime container - padding (p-4 = 16px pe fiecare parte = 32px total)
          const availableWidth = containerRect.width - 32;
          
          // Obține dimensiunile paginii PDF la scale 1.0
          const viewportAtScale1 = page.getViewport({ scale: 1.0 });
          const pdfWidth = viewportAtScale1.width;
          
          // Calculează scale-ul maxim pentru a se încadra în lățimea disponibilă
          const maxScaleForWidth = availableWidth / pdfWidth;
          
          // FORȚĂ scale-ul să fie maxim disponibil pentru a se încadra perfect
          finalScale = Math.min(scale, maxScaleForWidth);
        }

        // Setează viewport-ul cu scale-ul calculat
        const viewport = page.getViewport({ scale: finalScale });
        
        // Setează dimensiunile canvas-ului EXACT la dimensiunile viewport-ului
        // NU folosim scalare CSS pentru a evita blur-ul
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Curăță canvas-ul DUPĂ ce am setat dimensiunile pentru a evita conflictele
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Asigură-te că nu există o operație de render în curs înainte de a crea una nouă
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
            // Așteaptă puțin pentru ca operația să fie anulată complet
            await new Promise(resolve => setTimeout(resolve, 10));
          } catch {
            // Ignoră erorile de anulare
          }
          renderTaskRef.current = null;
        }

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        // Creează o nouă operație de render și o salvează în ref
        renderTaskRef.current = page.render(renderContext);
        
        try {
          await renderTaskRef.current.promise;
        } catch (renderErr) {
          // Ignoră erorile de anulare
          if (renderErr.name !== 'RenderingCancelled' && renderErr.name !== 'RenderingCancelledException') {
            throw renderErr;
          }
        }
        
        // Desenează semnătura dacă există pentru această pagină
        if (signatures[currentPage]) {
          drawSignature(context, signatures[currentPage]);
        }

        // Auto-stamp preview: ultima pagină = caseta trabajador; restul = margen izquierdo
        if (autoStampMode && autoPadSignature) {
          if (currentPage === pdfDocument.numPages) {
            const slot = CONTRATO_TRABAJADOR_SIGNATURE_SLOT;
            drawSignature(context, {
              dataUrl: autoPadSignature,
              x: slot.xRatio * canvas.width,
              y: (1 - slot.yBottomRatio - slot.heightRatio) * canvas.height,
              width: slot.widthRatio * canvas.width,
              height: slot.heightRatio * canvas.height,
            });
          } else {
            const slot = CONTRATO_MARGEN_IZQUIERDO_SLOT;
            // Aproximează rotația 90° pe canvas: desen vertical pe marginea stângă
            const w = slot.heightRatio * canvas.width;
            const h = slot.widthRatio * canvas.height;
            const x = Math.max(2, slot.xRatio * canvas.width - w);
            const y = (1 - slot.yBottomRatio) * canvas.height - h;
            drawSignature(context, {
              dataUrl: autoPadSignature,
              x,
              y,
              width: w,
              height: h,
            });
          }
        }
        
        // Curăță referința după ce render-ul este complet
        renderTaskRef.current = null;
      } catch (err) {
        // Ignoră erorile de anulare - sunt normale când se schimbă pagina
        if (err.name !== 'RenderingCancelled' && err.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', err);
        }
        renderTaskRef.current = null;
      }
    };

    renderPage();

    // Cleanup: anulează operația la unmount sau când se schimbă dependințele
    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignoră erorile de anulare
        }
        renderTaskRef.current = null;
      }
    };
  }, [pdfDocument, currentPage, scale, signatures, drawSignature, autoStampMode, autoPadSignature]);

  // Handlers pentru semnătură
  const handleClear = useCallback(() => {
    signatureRef.current?.clear();
    if (autoStampMode) {
      setAutoPadSignature(null);
    }
  }, [autoStampMode]);

  const handleAddSignature = useCallback(() => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      alert('Por favor, dibuja una firma primero');
      return;
    }

    const signatureData = signatureRef.current.toDataURL();

    // Auto-stamp: confirmă pad-ul — poziție fixă pe ultima pagină
    if (autoStampMode) {
      setAutoPadSignature(signatureData);
      if (totalPages > 0) {
        setCurrentPage(totalPages);
      }
      signatureRef.current.clear();
      return;
    }

    // Activează modul de poziționare cu caseta draggable
    setDraggedSignature({
      dataUrl: signatureData,
      width: 200,
      height: 100
    });
    setIsPlacingSignature(true);
    
    // Curăță signature pad după ce am luat semnătura
    signatureRef.current.clear();
  }, [autoStampMode, totalPages]);

  // Funcție pentru încărcarea unei imagini (firmă scanată/fotografiată)
  const handleLoadImageSignature = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Verifică dacă este o imagine
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecciona un archivo de imagen');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target.result;
      
      // Creează o imagine pentru a obține dimensiunile
      const img = new Image();
      img.onload = () => {
        if (autoStampMode) {
          setAutoPadSignature(imageUrl);
          if (totalPages > 0) setCurrentPage(totalPages);
          return;
        }

        // Calculează dimensiunile proporționale (max 200x100, păstrând aspect ratio)
        let width = img.width;
        let height = img.height;
        const maxWidth = 200;
        const maxHeight = 100;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        // Activează modul de poziționare cu imaginea încărcată
        setDraggedSignature({
          dataUrl: imageUrl,
          width: width,
          height: height
        });
        setIsPlacingSignature(true);
      };
      img.onerror = () => {
        alert('Error al cargar la imagen');
      };
      img.src = imageUrl;
    };
    reader.onerror = () => {
      alert('Error al leer el archivo');
    };
    reader.readAsDataURL(file);
    
    // Resetează input-ul pentru a permite încărcarea aceluiași fișier din nou
    event.target.value = '';
  }, [autoStampMode, totalPages]);

  // Poziționează semnătura pe PDF
  const handlePlaceSignature = useCallback((event) => {
    if (!isPlacingSignature || !draggedSignature) return;

    const pdfCanvas = canvasRef.current;
    if (!pdfCanvas) return;

    const rect = pdfCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convertește coordonatele la dimensiunile PDF (folosind dimensiunile REALE ale canvas-ului)
    // Canvas-ul poate fi scalat de CSS, deci trebuie să folosim dimensiunile reale
    const actualCanvasWidth = pdfCanvas.width;
    const actualCanvasHeight = pdfCanvas.height;
    const displayedWidth = rect.width;
    const displayedHeight = rect.height;
    
    const scaleX = actualCanvasWidth / displayedWidth;
    const scaleY = actualCanvasHeight / displayedHeight;

    // Calculează poziția finală (centrul semnăturii)
    const finalX = (x * scaleX) - (draggedSignature.width * scaleX / 2);
    const finalY = (y * scaleY) - (draggedSignature.height * scaleY / 2);

    const newSignature = {
      dataUrl: draggedSignature.dataUrl,
      x: finalX,
      y: finalY,
      width: draggedSignature.width * scaleX,
      height: draggedSignature.height * scaleY
    };

    setSignatures(prev => ({
      ...prev,
      [currentPage]: newSignature
    }));

    // Curăță starea de poziționare
    setDraggedSignature(null);
    setIsPlacingSignature(false);
  }, [isPlacingSignature, draggedSignature, currentPage]);

  // Activează modul de mutare pentru semnătura plasată
  const enableMoveMode = useCallback(() => {
    if (!signatures[currentPage]) return;
    
    setIsPlacingSignature(true);
    setDraggedSignature({
      dataUrl: signatures[currentPage].dataUrl,
      width: signatures[currentPage].width,
      height: signatures[currentPage].height
    });
  }, [signatures, currentPage]);


  // Cleanup pentru SignatureCanvas
  useEffect(() => {
    const signaturePad = signatureRef.current;
    return () => {
      signaturePad?.clear();
    };
  }, []);

  // Șterge semnătura de pe pagina curentă
  const clearSignature = () => {
    setSignatures(prev => {
      const newSignatures = { ...prev };
      delete newSignatures[currentPage];
      return newSignatures;
    });
  };

  // Funcție helper pentru a converti orice imagine în PNG
  const convertImageToPng = async (dataUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Creează un canvas temporar
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          // Desenează imaginea pe canvas (convertește în PNG)
          ctx.drawImage(img, 0, 0);
          
          // Convertește canvas-ul în PNG data URL
          const pngDataUrl = canvas.toDataURL('image/png');
          
          // Convertește data URL în ArrayBuffer pentru pdf-lib
          fetch(pngDataUrl)
            .then(res => res.arrayBuffer())
            .then(buffer => resolve(buffer))
            .catch(reject);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('Error loading image'));
      img.src = dataUrl;
    });
  };

  // Salvează PDF-ul cu toate semnăturile
  // signatureOverride: dataURL din modalul mic (autoStampMode)
  const saveSignedPDF = async (signatureOverride = null) => {
    try {
      const padSignature =
        signatureOverride && String(signatureOverride).startsWith('data:image/')
          ? signatureOverride
          : autoPadSignature;

      if (autoStampMode) {
        if (!padSignature) {
          alert('Por favor, dibuja tu firma primero');
          return false;
        }
      } else if (Object.keys(signatures).length === 0) {
        alert('Por favor, añade al menos una firma antes de guardar');
        return false;
      }

      // Încarcă PDF-ul original
      const response = await fetch(pdfUrl);
      const pdfBytes = await response.arrayBuffer();
      
      // Creează un nou document PDF
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();

      if (autoStampMode) {
        // Ultima pagină: caseta trabajador/a + legendă
        // Paginile 1…N-1: semnătură pe marginea stângă (clauza SEPE)
        const imageBytes = await convertImageToPng(padSignature);
        const image = await pdfDoc.embedPng(imageBytes);
        const lastIdx = pages.length - 1;

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const pw = page.getWidth();
          const ph = page.getHeight();

          if (i === lastIdx) {
            const slot = getContratoSignatureSlot(pw, ph);
            page.drawImage(image, {
              x: slot.x,
              y: slot.y,
              width: slot.width,
              height: slot.height,
            });

            const font = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
            const caption = CONTRATO_FIRMA_DIGITAL_CAPTION;
            const lines = buildContratoFirmaDigitalCaptionLines(new Date());
            const fontSize = caption.fontSize ?? 6.5;
            const lineGap = caption.lineGap ?? 1.2;
            const gap = caption.gapBelowSignature ?? 2.5;
            const colorSpec = caption.color || { r: 0.25, g: 0.25, b: 0.35 };
            const textColor = rgb(colorSpec.r, colorSpec.g, colorSpec.b);
            let textY = slot.y - gap - fontSize;
            for (const line of lines) {
              if (textY < 8) break;
              page.drawText(line, {
                x: slot.x,
                y: textY,
                size: fontSize,
                font,
                color: textColor,
                maxWidth: slot.width,
              });
              textY -= fontSize + lineGap;
            }
          } else {
            const margin = getContratoMargenIzquierdoSlot(pw, ph);
            page.drawImage(image, {
              x: margin.x,
              y: margin.y,
              width: margin.width,
              height: margin.height,
              rotate: degrees(margin.rotateDegrees ?? 90),
            });
          }
        }
      } else {
        // Adaugă semnăturile pe fiecare pagină (plasare liberă)
        for (let pageNum = 1; pageNum <= pages.length; pageNum++) {
          if (signatures[pageNum]) {
            const page = pages[pageNum - 1];
            const signature = signatures[pageNum];
            
            // Convertește semnătura la PNG (indiferent de formatul original)
            const imageBytes = await convertImageToPng(signature.dataUrl);
            const image = await pdfDoc.embedPng(imageBytes);
            
            // Calculează poziția direct folosind coordonatele canvas-ului intern
            const canvas = canvasRef.current;
            if (canvas) {
              // Folosește dimensiunile reale ale paginii PDF
              const pw = page.getWidth();
              const ph = page.getHeight();
              
              // Coordonatele din signatures sunt deja în sistemul canvas-ului intern
              // Trebuie doar să le convertim la dimensiunile PDF
              const xN = signature.x / canvas.width;
              const yN = signature.y / canvas.height;
              const wN = signature.width / canvas.width;
              const hN = signature.height / canvas.height;
              
              // Convertește la puncte PDF
              const x = xN * pw;
              const y = (1 - yN - hN) * ph; // PDF are originea jos-stânga
              const w = wN * pw;
              const h = hN * ph;
              
              console.log('🔍 Salvarea semnăturii în PDF:', {
                original: { x: signature.x, y: signature.y, width: signature.width, height: signature.height },
                canvas: { width: canvas.width, height: canvas.height },
                page: { width: pw, height: ph },
                normalized: { x: xN, y: yN, w: wN, h: hN },
                pdf: { x, y, w, h }
              });
              
              page.drawImage(image, {
                x: x,
                y: y,
                width: w,
                height: h
              });
            }
          }
        }
      }

      // Salvează PDF-ul modificat
      const modifiedPdfBytes = await pdfDoc.save();
      
      // Verifică dacă PDF-ul este valid
      if (!modifiedPdfBytes || modifiedPdfBytes.byteLength === 0) {
        throw new Error('PDF-ul generat este gol sau invalid');
      }
      
      console.log('🔍 PDF generat:', {
        size: modifiedPdfBytes.byteLength,
        sizeMB: (modifiedPdfBytes.byteLength / 1024 / 1024).toFixed(2)
      });
      
      // Convertește PDF-ul la Base64 (folosind chunking pentru fișiere mari)
      const uint8Array = new Uint8Array(modifiedPdfBytes);
      let binaryString = '';
      const chunkSize = 8192; // 8KB chunks pentru a evita "Maximum call stack size exceeded"
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64String = btoa(binaryString);
      
      // Dacă este UPDATE (pentru documente oficiale din DocumentosEmpleadosPage):
      // - Folosește datele angajatului (nu ale utilizatorului care semnează)
      // - Nu schimbă tipo_documento (rămâne la fel)
      // - Nu adaugă "_FIRMADO" la nume
      // - Folosește doc_id pentru UPDATE
      const isUpdate = !!(updateExisting && documentoDocId);
      
      console.log('🔍 [ContractSigner] Save signed PDF - Context:', {
        updateExisting,
        documentoDocId,
        isUpdate,
        empleadoId,
        empleadoEmail,
        empleadoNombre,
        originalFileName,
        docId
      });
      
      const userCodigo = isUpdate 
        ? (empleadoId || docId) // Folosește CODIGO al angajatului
        : (authUser?.CODIGO || authUser?.codigo || authUser?.userId || authUser?.id || docId);
      
      const fileName = isUpdate
        ? originalFileName // Păstrează numele original (fără "_FIRMADO")
        : (originalFileName 
          ? originalFileName.replace(/\.pdf$/i, '_FIRMADO.pdf')
          : `CONTRATO_EMPLEADO_${docId}_FIRMADO.pdf`);
      
      const nombreEmpleado = isUpdate
        ? (empleadoNombre || null) // Folosește numele angajatului
        : (authUser?.['NOMBRE / APELLIDOS'] 
          || authUser?.NOMBRE_APELLIDOS 
          || authUser?.empleadoNombre 
          || authUser?.displayName 
          || authUser?.name 
          || null);
      
      const correoElectronico = isUpdate
        ? (empleadoEmail || null) // Folosește email-ul angajatului
        : (authUser?.email || null);
      
      // Pregătește body-ul conform așteptărilor backend-ului
      const sourceDocIdNum = Number(docId);
      const requestBody = {
        signed_b64: base64String,
        id: userCodigo, // CODIGO del empleado (al angajatului, nu al utilizatorului care semnează)
        nombre_archivo: fileName,
        tipo_documento: isUpdate ? (tipoDocumento || undefined) : "CONTRATO firmado", // Păstrează tipo_documento original la UPDATE
        correo_electronico: correoElectronico,
        nombre_empleado: nombreEmpleado,
        fecha_creacion: new Date().toISOString(),
        doc_id: isUpdate ? documentoDocId : undefined, // doc_id pentru UPDATE
        update_existing: isUpdate, // Flag pentru UPDATE
        // La INSERT (_FIRMADO), backend ascunde originalul pentru angajat
        source_doc_id:
          !isUpdate && Number.isFinite(sourceDocIdNum) && sourceDocIdNum > 0
            ? sourceDocIdNum
            : undefined,
      };
      
      console.log('🔍 [ContractSigner] Request body:', {
        ...requestBody,
        signed_b64: requestBody.signed_b64.substring(0, 50) + '...' // Nu logăm tot Base64-ul
      });
      
      // Trimite la backend ca JSON folosind fetchWithAuth pentru refresh automat al token-ului
      const saveResponse = await fetchWithAuth(routes.guardarDocumentoSemnat, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (saveResponse.ok) {
        await saveResponse.json();

        // Descarcă PDF-ul semnat pe dispozitiv
        try {
          const downloadBlob = new Blob([modifiedPdfBytes], {
            type: 'application/pdf',
          });
          const downloadUrl = URL.createObjectURL(downloadBlob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(downloadUrl);
        } catch (dlErr) {
          console.warn('⚠️ No se pudo descargar el PDF firmado:', dlErr);
        }

        alert(`✅ Documento firmado guardado y descargado: ${fileName}`);
        onSignComplete?.();
        onClose?.();
        return true;
      } else {
        const errorText = await saveResponse.text();
        console.error('❌ Response failed:', {
          status: saveResponse.status,
          statusText: saveResponse.statusText,
          headers: Object.fromEntries(saveResponse.headers.entries()),
          errorText: errorText
        });
        throw new Error(`Error al guardar ${originalFileName || `CONTRATO_EMPLEADO_${docId}.pdf`}: ${saveResponse.status} - ${errorText}`);
      }
    } catch (err) {
      console.error('Error saving signed PDF:', err);
      const filename = originalFileName || `CONTRATO_EMPLEADO_${docId}.pdf`;
      alert(`❌ Error al guardar el documento firmado ${filename}: ${err.message}`);
      return false;
    }
  };

  const openFirmaModal = () => {
    setFirmaDraft('');
    setShowFirmaModal(true);
  };

  const confirmFirmaYDescargar = async () => {
    if (!firmaDraft || !String(firmaDraft).startsWith('data:image/')) {
      alert('Por favor, dibuja tu firma primero');
      return;
    }
    setFirmaBusy(true);
    try {
      const ok = await saveSignedPDF(firmaDraft);
      if (ok) {
        setShowFirmaModal(false);
        setFirmaDraft('');
      }
    } finally {
      setFirmaBusy(false);
    }
  };

  // Navigare pagini
  const goToPage = (pageNum) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  // Zoom
  const changeZoom = (newScale) => {
    setScale(Math.max(0.5, Math.min(3.0, newScale)));
  };

  const hasReadySignature = autoStampMode
    ? !!autoPadSignature
    : Object.keys(signatures).length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        <span className="ml-3 text-gray-600">Cargando PDF...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">❌</div>
        <p className="text-lg font-medium text-gray-900 mb-2">Error al cargar el PDF</p>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className="dlg">
      <style>{dialogStyles}</style>
      {/* Header modernizado */}
      <header className="dlg__header">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 ${
                autoStampMode
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                  : isPlacingSignature 
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                    : 'bg-gradient-to-br from-red-500 to-red-600'
              }`}>
                <span className="text-white text-xl">
                  {autoStampMode ? '👁️' : isPlacingSignature ? '🎯' : '✍️'}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {autoStampMode
                    ? `Vista previa: Página ${currentPage} de ${totalPages}`
                    : isPlacingSignature
                      ? `Posicionar Firma: Página ${currentPage} de ${totalPages}`
                      : `Firmar Documento: Página ${currentPage} de ${totalPages}`}
                </h3>
                <p className="text-blue-600 text-sm font-medium">Documento: {docId}</p>
                {autoStampMode ? (
                  <div className="text-blue-700 mt-1 text-sm">
                    Revisa el contrato. Al firmar: casilla trabajador (última página) + margen izquierdo en el resto.
                  </div>
                ) : isPlacingSignature ? (
                  <div className="text-blue-700 mt-1 text-sm">
                    💡 Arrastra la firma para posicionarla en el documento
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isPlacingSignature && (
                <button
                  onClick={() => {
                    setIsPlacingSignature(false);
                    setDraggedSignature(null);
                  }}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <span>❌</span>
                  <span>Cancelar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="dlg__body">
        {/* PDF Viewer */}
        <div className="bg-gray-50 p-2 sm:p-4 mb-2 sm:mb-4 rounded-lg">
          {/* Toolbar modernizado */}
          <div className="bg-white rounded-xl shadow-lg p-2 sm:p-4 mb-2 sm:mb-4 border border-gray-200">
            <div className="flex flex-col space-y-3">
              {/* Rând 1: Navigare și Zoom */}
              <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="group relative px-4 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-gray-500 to-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <div className="absolute inset-0 rounded-xl bg-gray-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"></div>
                    <div className="relative flex items-center gap-2">
                      <span>←</span>
                      <span>Anterior</span>
                    </div>
                  </button>
                  
                  <div className="bg-gradient-to-r from-blue-100 to-blue-200 px-4 py-2 rounded-xl border border-blue-300 shadow-md">
                    <span className="text-lg font-bold text-blue-900">
                      {currentPage} / {totalPages}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="group relative px-4 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-gray-500 to-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <div className="absolute inset-0 rounded-xl bg-gray-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"></div>
                    <div className="relative flex items-center gap-2">
                      <span>Siguiente</span>
                      <span>→</span>
                    </div>
                  </button>
                  
                  {/* Buton simplu X pentru închidere */}
                  <button
                    onClick={onClose}
                    className="w-10 h-10 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg group"
                    aria-label="Cerrar preview"
                  >
                    <span className="text-gray-400 group-hover:text-gray-600 text-xl">✕</span>
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => changeZoom(scale - 0.2)}
                    className="group relative px-3 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                  >
                    <div className="absolute inset-0 rounded-xl bg-blue-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"></div>
                    <div className="relative flex items-center gap-1">
                      <span>🔍</span>
                      <span>-</span>
                    </div>
                  </button>
                  
                  <div className="bg-gradient-to-r from-green-100 to-green-200 px-4 py-2 rounded-xl border border-green-300 shadow-md">
                    <span className="text-lg font-bold text-green-900 min-w-[60px] text-center">
                      {Math.round(scale * 100)}%
                    </span>
                  </div>
                  
                  <button
                    onClick={() => changeZoom(scale + 0.2)}
                    className="group relative px-3 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                  >
                    <div className="absolute inset-0 rounded-xl bg-blue-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"></div>
                    <div className="relative flex items-center gap-1">
                      <span>🔍</span>
                      <span>+</span>
                    </div>
                  </button>
                </div>
              </div>
              
              {/* Rând 2: autoStamp → Firmar y descargar (modal) | free place → Limpiar / Guardar */}
              <div className="flex items-center gap-3 w-full">
                {autoStampMode ? (
                  <button
                    type="button"
                    onClick={openFirmaModal}
                    disabled={firmaBusy}
                    className="group relative flex-1 px-4 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white disabled:opacity-60"
                  >
                    <div className="absolute inset-0 rounded-xl bg-orange-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                    <div className="relative flex items-center justify-center gap-2">
                      <span className="text-lg">✍️</span>
                      <span>Firmar y descargar</span>
                    </div>
                  </button>
                ) : (
                  <>
                <button
                  onClick={handleClear}
                  className="group relative flex-1 px-4 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-gray-500 to-gray-600 text-white"
                >
                  <div className="absolute inset-0 rounded-xl bg-gray-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"></div>
                  <div className="relative flex items-center justify-center gap-2">
                    <span>🗑️</span>
                    <span>Limpiar Firma</span>
                  </div>
                </button>
                
                <button
                  onClick={() => saveSignedPDF()}
                  disabled={!hasReadySignature}
                  className={`group relative flex-1 px-4 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg ${
                    !hasReadySignature
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed shadow-none transform-none'
                      : 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200'
                  }`}
                  style={{
                    opacity: !hasReadySignature ? 0.6 : 1,
                    pointerEvents: !hasReadySignature ? 'none' : 'auto'
                  }}
                >
                  {hasReadySignature && (
                    <div className="absolute inset-0 rounded-xl bg-green-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                  )}
                  <div className="relative flex items-center justify-center gap-2">
                    {!hasReadySignature ? (
                      <>
                        <span>❌</span>
                        <span className="text-sm">Sin firmas</span>
                      </>
                    ) : (
                      <>
                        <span className="text-lg">💾</span>
                        <span className="font-bold">Guardar PDF Firmado</span>
                      </>
                    )}
                  </div>
                </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* PDF Canvas Container */}
          <div className="pdf-canvas-container bg-white rounded-lg shadow-md p-2 sm:p-4 overflow-x-hidden overflow-y-auto max-h-[60vh] sm:max-h-[70vh] w-full flex items-center justify-center" style={{ boxSizing: 'border-box', position: 'relative', zIndex: 1 }}>
            <div className="w-full flex justify-center" style={{ minWidth: 0, maxWidth: '100%' }}>
              <canvas
                ref={canvasRef}
                className={`border border-gray-200 rounded-lg shadow-sm ${
                  !autoStampMode && isPlacingSignature ? 'cursor-crosshair' : 'cursor-default'
                }`}
                style={{ 
                  maxWidth: '100%',
                  height: 'auto',
                  display: 'block'
                }}
                onClick={autoStampMode ? undefined : handlePlaceSignature}
                onMouseMove={autoStampMode ? undefined : handleCanvasMouseMove}
              />
              
              {/* Grid overlay pentru precizie maximă */}
              {!autoStampMode && isPlacingSignature && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="w-full h-full" style={{
                    backgroundImage: `
                      linear-gradient(rgba(239, 68, 68, 0.1) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(239, 68, 68, 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px'
                  }}></div>
                </div>
              )}
              
              {/* Preview semnătură simplu */}
              {!autoStampMode && isPlacingSignature && draggedSignature && (
                <div 
                  className="absolute pointer-events-none"
                  style={{
                    left: mousePosition.x - draggedSignature.width / 2,
                    top: mousePosition.y - draggedSignature.height / 2,
                    width: draggedSignature.width,
                    height: draggedSignature.height,
                    border: '2px dashed #ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    borderRadius: '4px',
                    zIndex: 10
                  }}
                >
                  <div 
                    className="w-full h-full"
                    style={{
                      backgroundImage: `url(${draggedSignature.dataUrl})`,
                      backgroundSize: 'contain',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                      opacity: 0.6
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Signature Zone — doar plasare liberă (contracte: modal mic) */}
        {!autoStampMode && (
        <section id="signature-zone" className="bg-white rounded-lg shadow-md p-4">
          <div className="text-center mb-4">
            <h4 className="text-lg font-bold text-gray-900">
              ✍️ Firma digital
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {/* Signature Canvas */}
            <div className="md:col-span-1">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 border-2 border-dashed border-gray-300 shadow-sm">
                <SignatureCanvas
                  ref={signatureRef}
                  width={250}
                  height={150}
                  className="border border-gray-200 rounded-lg bg-white cursor-crosshair mx-auto block shadow-sm hover:shadow-md transition-shadow"
                />
                <p className="text-xs text-gray-500 text-center mt-1">
                  Dibuja tu firma aquí
                </p>
              </div>
            </div>

            {/* Signature Controls - Modernizados */}
            <div className="space-y-3">
              <button
                onClick={handleClear}
                className="group relative w-full px-4 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-gray-200"
              >
                <div className="absolute inset-0 rounded-xl bg-gray-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                <div className="relative flex items-center justify-center gap-2">
                  <span className="text-lg">🗑️</span>
                  <span>Limpiar Firma</span>
                </div>
              </button>

              {/* Buton pentru încărcarea unei imagini (firmă scanată/fotografiată) */}
              <label className="group relative w-full px-4 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200 cursor-pointer block">
                <div className="absolute inset-0 rounded-xl bg-purple-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                <div className="relative flex items-center justify-center gap-2">
                  <span className="text-lg">📷</span>
                  <span>Cargar Firma desde Imagen</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLoadImageSignature}
                  className="hidden"
                />
              </label>

              {autoStampMode ? (
                <>
                  <button
                    onClick={handleAddSignature}
                    className="group relative w-full px-4 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200"
                  >
                    <div className="absolute inset-0 rounded-xl bg-green-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                    <div className="relative flex items-center justify-center gap-2">
                      <span className="text-lg">{autoPadSignature ? '🔄' : '✅'}</span>
                      <span>
                        {autoPadSignature
                          ? 'Actualizar firma (última página)'
                          : 'Confirmar firma (última página)'}
                      </span>
                    </div>
                  </button>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
                    La firma se coloca sola en <strong>El/la trabajador/a</strong> de la última página.
                    No puedes moverla manualmente.
                  </div>
                </>
              ) : (
                <>
                  {!signatures[currentPage] ? (
                    <button
                      onClick={handleAddSignature}
                      disabled={isPlacingSignature}
                      className={`group relative w-full px-4 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                        isPlacingSignature 
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed shadow-none transform-none' 
                          : 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200'
                      }`}
                    >
                      {!isPlacingSignature && (
                        <div className="absolute inset-0 rounded-xl bg-green-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                      )}
                      <div className="relative flex items-center justify-center gap-2">
                        <span className="text-lg">{isPlacingSignature ? '🎯' : '➕'}</span>
                        <span>{isPlacingSignature ? 'Posicionando firma...' : `Añadir Firma a Página ${currentPage}`}</span>
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={enableMoveMode}
                      disabled={isPlacingSignature}
                      className={`group relative w-full px-4 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                        isPlacingSignature 
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed shadow-none transform-none' 
                          : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200'
                      }`}
                    >
                      {!isPlacingSignature && (
                        <div className="absolute inset-0 rounded-xl bg-blue-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                      )}
                      <div className="relative flex items-center justify-center gap-2">
                        <span className="text-lg">{isPlacingSignature ? '🎯' : '✏️'}</span>
                        <span>{isPlacingSignature ? 'Moviendo firma...' : 'Mover Firma'}</span>
                      </div>
                    </button>
                  )}
                  
                  <button
                    onClick={clearSignature}
                    className="group relative w-full px-4 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-200"
                  >
                    <div className="absolute inset-0 rounded-xl bg-orange-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
                    <div className="relative flex items-center justify-center gap-2">
                      <span className="text-lg">🗑️</span>
                      <span>Borrar Firma de Página {currentPage}</span>
                    </div>
                  </button>
                </>
              )}
            </div>

            {/* Signature Status */}
            <div>
              <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-sm h-full">
                <h5 className="font-bold text-gray-900 mb-3 text-center">Estado de Firmas:</h5>
                {autoStampMode ? (
                  <div className="p-3 bg-white rounded-lg border border-gray-100 text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Última página (trabajador/a):</span>
                      <span className={autoPadSignature ? 'text-green-600 font-bold' : 'text-gray-400'}>
                        {autoPadSignature ? '✅ Lista' : '❌ Pendiente'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => totalPages > 0 && setCurrentPage(totalPages)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Ir a última página →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                      <div key={pageNum} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
                        <span className="font-medium">Página {pageNum}:</span>
                        <span className={signatures[pageNum] ? 'text-green-600 font-bold' : 'text-gray-400'}>
                          {signatures[pageNum] ? '✅ Firmada' : '❌ Sin firma'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
        )}
      </main>

      {/* Buton toggle pentru footer pe mobil */}
      <button
        onClick={() => setShowMobileFooter(!showMobileFooter)}
        className="mobile-footer-toggle sm:hidden"
        aria-label="Toggle footer"
      >
        {showMobileFooter ? '▼' : '☰'}
      </button>

      {/* Footer - Sticky */}
      <footer className={`dlg__footer ${showMobileFooter ? 'mobile-visible' : ''}`}>
        {autoStampMode ? (
          <button
            type="button"
            onClick={openFirmaModal}
            disabled={firmaBusy}
            className="group relative flex-1 px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-200 disabled:opacity-60"
          >
            <div className="absolute inset-0 rounded-xl bg-orange-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
            <div className="relative flex items-center justify-center gap-2">
              <span className="text-lg">✍️</span>
              <span>Firmar y descargar</span>
            </div>
          </button>
        ) : (
          <>
        <button
          onClick={handleClear}
          className="group relative flex-1 px-4 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-gray-200"
        >
          <div className="absolute inset-0 rounded-xl bg-gray-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
          <div className="relative flex items-center justify-center gap-2">
            <span className="text-lg">🗑️</span>
            <span>Limpiar Firma</span>
          </div>
        </button>
        
        <button
          onClick={() => saveSignedPDF()}
          disabled={!hasReadySignature}
          className={`group relative flex-1 px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
            !hasReadySignature
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed shadow-none transform-none'
              : 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200'
          }`}
        >
          {hasReadySignature && (
            <div className="absolute inset-0 rounded-xl bg-red-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
          )}
          <div className="relative flex items-center justify-center gap-2">
            {!hasReadySignature ? (
              <>
                <span className="text-lg">❌</span>
                <span>Sin firmas para guardar</span>
              </>
            ) : (
              <>
                <span className="text-lg">💾</span>
                <span>Guardar PDF</span>
              </>
            )}
          </div>
        </button>
          </>
        )}
      </footer>

      {/* Casuță mică de semnare (stil Vecindario / pachete) */}
      {autoStampMode && showFirmaModal && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50"
          onClick={() => {
            if (!firmaBusy) {
              setShowFirmaModal(false);
              setFirmaDraft('');
            }
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900">Firma del trabajador</h4>
                <p className="text-xs text-slate-500">Ratón o dedo — última página + margen izquierdo</p>
              </div>
              <button
                type="button"
                disabled={firmaBusy}
                onClick={() => {
                  setShowFirmaModal(false);
                  setFirmaDraft('');
                }}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="p-4">
              <SignaturePadComponent
                value={firmaDraft}
                onChange={setFirmaDraft}
                width={320}
                height={160}
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={firmaBusy}
                  onClick={() => setFirmaDraft('')}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  Limpiar firma
                </button>
                <button
                  type="button"
                  disabled={firmaBusy || !firmaDraft}
                  onClick={confirmFirmaYDescargar}
                  className="flex-1 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-wait"
                >
                  {firmaBusy ? 'Firmando…' : 'Confirmar y descargar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
