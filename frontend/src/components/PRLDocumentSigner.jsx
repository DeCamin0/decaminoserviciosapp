import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import SignaturePadComponent from '../shared/components/SignaturePad';
import { useAuth } from '../contexts/AuthContextBase';
import { routes } from '../utils/routes';
import Modal from './ui/Modal';
import {
  drawManualFooterPreviewOnCanvas,
  manualSignaturePositionFromLayout,
} from '../constants/prlManualPdfFooterFields.js';

// Configurare worker PDF.js
import '../config/pdfjs';

// CSS pentru layout
const dialogStyles = `
  .prl-signer-dialog {
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

  .prl-signer-body {
    flex: 1 1 auto;
    overflow: auto;
    padding: 16px;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch; /* Smooth scroll pe iOS */
  }

  .prl-signer-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    border-top: 1px solid #eee;
    padding: 12px 16px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
    display: flex;
    gap: 8px;
    z-index: 1001;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
  }
  
  @media (max-width: 768px) {
    /* Override pentru Modal pe mobil - asigură fullscreen */
    /* Target Modal container direct */
    [class*="fixed"][class*="inset-0"] > div[class*="bg-white"] {
      max-height: 100vh !important;
      height: 100vh !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      border-radius: 0 !important;
      max-width: 100vw !important;
      width: 100vw !important;
      margin: 0 !important;
    }
    
    /* Target Modal content wrapper - div cu overflow-y-auto */
    [class*="fixed"][class*="inset-0"] > div[class*="bg-white"] > div[class*="overflow-y-auto"] {
      flex: 1 !important;
      min-height: 0 !important;
      overflow: visible !important;
      padding: 0 !important;
      display: flex !important;
      flex-direction: column !important;
    }
    
    .prl-signer-dialog {
      position: fixed !important;
      inset: 0 !important;
      border-radius: 0 !important;
      max-height: 100vh !important;
      max-width: 100vw !important;
      width: 100vw !important;
      height: 100vh !important;
      display: flex !important;
      flex-direction: column !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    .prl-signer-body {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 12px;
      padding-bottom: 320px !important; /* Space pentru footer + butoane semnare - mărit pentru siguranță */
      -webkit-overflow-scrolling: touch;
      min-height: 0; /* Permite flex să funcționeze */
      box-sizing: border-box;
    }

    .prl-signer-footer {
      position: fixed !important;
      bottom: 64px !important; /* Peste navbar (care are h-16 = 64px) */
      left: 0 !important;
      right: 0 !important;
      padding: 16px 12px !important;
      padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important;
      gap: 12px;
      flex-direction: column;
      flex-shrink: 0;
      z-index: 10003 !important; /* Peste Modal (z-9999) și navbar (z-50) */
      box-shadow: 0 -4px 20px rgba(0,0,0,0.2) !important;
      background: #fff !important;
      border-top: 1px solid #eee !important;
      display: flex !important;
    }
    
    .prl-signer-footer button {
      width: 100% !important;
      padding: 18px 20px !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      border-radius: 12px !important;
      min-height: 52px !important;
      touch-action: manipulation; /* Previne double-tap zoom */
      -webkit-tap-highlight-color: transparent;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    /* Asigură că butonul "Guardar" este vizibil și accesibil */
    .prl-signer-footer button:last-child {
      background: #dc2626 !important; /* red-600 */
      color: white !important;
    }
    
    .prl-signer-footer button:last-child:hover {
      background: #b91c1c !important; /* red-700 */
    }
    
    .prl-signer-footer button:last-child:disabled {
      background: #fca5a5 !important; /* red-300 */
      opacity: 0.6 !important;
    }

    /* Canvas PDF - optimizat pentru mobile */
    .pdf-canvas-container {
      max-height: 40vh !important;
      touch-action: pan-x pan-y pinch-zoom; /* Permite scroll și zoom pe touch */
    }

    /* Butoane de navigare - mai mari pe mobile */
    .page-nav-buttons button {
      min-height: 44px;
      min-width: 44px;
      touch-action: manipulation;
    }

    /* Preview DOCX container - responsive pe mobil */
    .docx-preview-container {
      max-height: 35vh !important;
    }
    
    /* Preview DOCX - responsive pe mobil */
    .docx-preview {
      max-height: calc(35vh - 60px) !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      -webkit-overflow-scrolling: touch;
      word-wrap: break-word;
      overflow-wrap: break-word;
      font-size: 10pt !important;
    }
    
    .docx-preview * {
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    
    .docx-preview img {
      max-width: 100% !important;
      height: auto !important;
    }
    
    .docx-preview table {
      width: 100% !important;
      max-width: 100% !important;
      display: block !important;
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch;
    }

    /* Butoane semnare - responsive pe mobil */
    .prl-signer-body button {
      min-height: 44px !important;
      min-width: 44px !important;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      font-size: 14px !important;
      padding: 12px 16px !important;
    }
    
    /* Butoane "Añadir Firma" și "Limpiar Firma" - full width pe mobil */
    .signature-buttons-container {
      flex-direction: column !important;
      gap: 8px !important;
    }
    
    .signature-buttons-container button {
      width: 100% !important;
    }

    /* SignaturePad - mai mic pe mobile */
    .signature-pad-container {
      width: 100%;
    }

    .signature-pad-container canvas {
      width: 100% !important;
      height: auto !important;
      max-height: 200px;
    }
  }
`;

async function drawManualFooterOnPage(page, pdfDoc, footerFields, layout) {
  if (!page || !footerFields || !layout?.fields) return;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pw = page.getWidth();
  const ph = page.getHeight();
  const rows = [
    ['empresa', footerFields.empresa],
    ['fecha', footerFields.fecha],
    ['dni', footerFields.dni],
    ['nombre', footerFields.nombre],
  ];
  for (const [key, text] of rows) {
    const value = text != null ? String(text).trim() : '';
    if (!value) continue;
    const spec = layout.fields[key];
    if (!spec) continue;
    const drawOpts = {
      x: spec.xRatio * pw,
      y: spec.yBottomRatio * ph,
      size: spec.fontSize ?? 11,
      font,
      color: rgb(0.12, 0.12, 0.12),
    };
    if (spec.maxWidthRatio != null) {
      drawOpts.maxWidth = spec.maxWidthRatio * pw;
    }
    page.drawText(value, drawOpts);
  }
}

export default function PRLDocumentSigner({
  pdfUrl,
  documentoId,
  originalFileName,
  onClose,
  onSuccess,
  isDocx = false,
  footerLayout = null,
  footerFields = null,
}) {
  useAuth(); // Keep for potential future use
  const hasManualFooter = !isDocx && footerLayout && footerFields;
  
  // Log la inițializare pentru debugging
  console.log('🔍 [PRLDocumentSigner] Component initialized:', {
    isDocx,
    hasPdfUrl: !!pdfUrl,
    documentoId,
    originalFileName,
    pdfUrlType: pdfUrl ? typeof pdfUrl : 'null'
  });
  
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [signature, setSignature] = useState(null); // Semnătura desenată (pentru afișare pe PDF)
  const [signatureDataUrl, setSignatureDataUrl] = useState(null); // Semnătura din SignaturePad
  const [signaturePosition, setSignaturePosition] = useState({ x: 0, y: 0, width: 150, height: 75 });
  const [applyToAllPages, setApplyToAllPages] = useState(!footerLayout); // Manual PRL: solo última página
  const [isPlacingSignature, setIsPlacingSignature] = useState(false);
  const [docxHtml, setDocxHtml] = useState(null); // HTML convertit din DOCX pentru preview
  const [docxHtmlWithSignature, setDocxHtmlWithSignature] = useState(null); // HTML cu semnătura adăugată în preview
  const [docxLoading, setDocxLoading] = useState(false);
  const [signatureAddedToPreview, setSignatureAddedToPreview] = useState(false); // Flag pentru a ști dacă semnătura a fost adăugată în preview

  const canvasRef = useRef(null);

  // Desenează semnătura pe canvas-ul PDF
  const drawSignature = useCallback((context, sig) => {
    if (!sig || !sig.dataUrl) return;
    
    const img = new Image();
    let isLoaded = false;
    
    img.onload = () => {
      if (isLoaded) return; // Previne desenarea dublă
      isLoaded = true;
      try {
        context.drawImage(
          img,
          sig.x,
          sig.y,
          sig.width,
          sig.height
        );
      } catch (err) {
        console.error('Error drawing signature:', err);
      }
    };
    img.onerror = () => {
      console.error('Error loading signature image');
    };
    
    // Pe mobile, forțează încărcarea imediată
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      img.crossOrigin = 'anonymous';
    }
    
    // Dacă imaginea este deja în cache, onload nu se declanșează - verificăm manual
    if (img.complete && img.naturalWidth > 0) {
      img.onload();
    } else {
      img.src = sig.dataUrl;
    }
  }, []);
  
  // Convertește coordonatele ecran → PDF
  const handleCanvasMouseMove = useCallback(() => {
    if (!isPlacingSignature) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Mouse position tracking removed - not used
  }, [isPlacingSignature]);

  // Încarcă DOCX-ul și convertește la HTML pentru preview (pe backend)
  useEffect(() => {
    console.log('🔍 [PRLDocumentSigner] DOCX useEffect triggered:', { isDocx, documentoId });
    
    if (!isDocx || !documentoId) {
      console.log('🔍 [PRLDocumentSigner] Skipping DOCX load:', { isDocx, hasDocumentoId: !!documentoId });
      return;
    }

    const loadDocx = async () => {
      try {
        console.log('🔍 [PRLDocumentSigner] Starting DOCX conversion via backend for documento:', documentoId);
        setDocxLoading(true);
        setLoading(true);
        setError(null);
        
        // Apelăm backend-ul pentru conversie DOCX → HTML
        const token = localStorage.getItem('auth_token');
        const headers = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(routes.prlConvertirDocxAHtml(documentoId), {
          method: 'GET',
          headers: headers,
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Error al convertir DOCX' }));
          throw new Error(errorData.message || `HTTP error! status: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success || !data.html) {
          throw new Error('La conversión de DOCX no devolvió resultados válidos');
        }
        
        let html = data.html;
        
        console.log('🔍 [PRLDocumentSigner] DOCX converted to HTML via backend, length:', html.length);
        
        // Evidențiază placeholder-ul {{FIRMA}} pentru a-l face vizibil
        html = html.replace(
          /\{\{FIRMA\}\}/g,
          '<span style="background-color: #ffeb3b; padding: 2px 4px; border: 2px dashed #ff9800; font-weight: bold; color: #f57c00;">{{FIRMA}}</span>'
        );
        html = html.replace(
          /\{\s*{\s*FIRMA\s*}\s*\}/g,
          '<span style="background-color: #ffeb3b; padding: 2px 4px; border: 2px dashed #ff9800; font-weight: bold; color: #f57c00;">{{FIRMA}}</span>'
        );
        
        setDocxHtml(html);
        setDocxLoading(false);
        setLoading(false);
        console.log('✅ [PRLDocumentSigner] DOCX loaded successfully via backend');
      } catch (err) {
        console.error('❌ [PRLDocumentSigner] Error loading DOCX via backend:', err);
        const errorMessage = err.message || 'Error desconocido al cargar documento DOCX';
        setError(`Error al cargar documento DOCX: ${errorMessage}`);
        setDocxLoading(false);
        setLoading(false);
      }
    };

    loadDocx();
  }, [isDocx, documentoId]);

  // Încarcă PDF-ul (doar pentru PDF, nu pentru DOCX)
  useEffect(() => {
    if (isDocx) {
      // Pentru DOCX, nu încărcăm PDF (se face în useEffect-ul de mai sus)
      return;
    }

    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        
        setPdfDocument(pdf);
        setTotalPages(pdf.numPages);
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
  }, [pdfUrl, isDocx]);

  // Manual PRL: abrir directamente en la última página (datos + firma)
  useEffect(() => {
    if (!hasManualFooter || !totalPages) return;
    setCurrentPage(totalPages);
    setApplyToAllPages(false);
  }, [hasManualFooter, totalPages]);

  // Randează pagina curentă (doar pentru PDF)
  useEffect(() => {
    if (isDocx || !pdfDocument) return;
    
    let renderTask = null;
    let isCancelled = false;
    
    const renderPage = async () => {
      if (!pdfDocument || !canvasRef.current) return;

      try {
        // Anulează operația anterioară dacă există
        if (renderTask) {
          renderTask.cancel();
          renderTask = null;
        }

        // Așteaptă puțin pentru a se asigura că operația anterioară este anulată
        await new Promise(resolve => setTimeout(resolve, 50));

        if (isCancelled) return;

        const page = await pdfDocument.getPage(currentPage);
        const canvas = canvasRef.current;
        
        if (!canvas || isCancelled) return;
        
        const context = canvas.getContext('2d');

        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (isCancelled) return;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
        
        if (isCancelled) return;
        
        if (hasManualFooter && currentPage === totalPages) {
          drawManualFooterPreviewOnCanvas(context, canvas, footerFields, footerLayout);
        }

        // Desenează semnătura dacă există
        if (signature) {
          drawSignature(context, {
            ...signature,
            x: signaturePosition.x,
            y: signaturePosition.y,
            width: signaturePosition.width,
            height: signaturePosition.height
          });
        }
      } catch (err) {
        // Ignoră erorile de anulare - sunt normale când se schimbă pagina rapid
        if (err.name !== 'RenderingCancelled' && 
            err.name !== 'RenderingCancelledException' &&
            !err.message?.includes('cancelled')) {
          console.error('Error rendering page:', err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // Ignoră erorile la anulare
        }
        renderTask = null;
      }
    };
  }, [
    pdfDocument,
    currentPage,
    scale,
    signature,
    signaturePosition,
    drawSignature,
    isDocx,
    hasManualFooter,
    totalPages,
    footerFields,
    footerLayout,
  ]);

  // Handler pentru schimbarea semnăturii (din SignaturePadComponent)
  const handleSignatureChange = useCallback((dataURL) => {
    setSignatureDataUrl(dataURL);
  }, []);

  // Handler pentru adăugarea semnăturii la pagină
  const handleAddSignature = useCallback(() => {
    if (!signatureDataUrl) {
      alert('Por favor, dibuja una firma primero');
      return;
    }

    // Pentru DOCX: adaugă semnătura în preview-ul HTML
    if (isDocx && docxHtml) {
      // Înlocuiește placeholder-ul {{FIRMA}} cu o imagine preview a semnăturii
      let htmlWithSignature = docxHtml;
      
      // Creează un placeholder vizual pentru semnătură
      const signaturePreview = `<div style="display: inline-block; border: 2px solid #4CAF50; background-color: #f0f8f0; padding: 8px; margin: 4px; border-radius: 4px;">
        <img src="${signatureDataUrl}" style="max-width: 200px; max-height: 80px; display: block;" alt="Firma preview" />
        <span style="display: block; font-size: 10px; color: #4CAF50; margin-top: 4px; text-align: center;">✓ Firma se insertará aquí</span>
      </div>`;
      
      // Înlocuiește placeholder-ul evidențiat cu preview-ul semnăturii
      htmlWithSignature = htmlWithSignature.replace(
        /<span style="background-color: #ffeb3b[^"]*">\{\{FIRMA\}\}<\/span>/g,
        signaturePreview
      );
      // Dacă nu există placeholder evidențiat, înlocuiește direct textul
      htmlWithSignature = htmlWithSignature.replace(
        /\{\{FIRMA\}\}/g,
        signaturePreview
      );
      htmlWithSignature = htmlWithSignature.replace(
        /\{\s*{\s*FIRMA\s*}\s*\}/g,
        signaturePreview
      );
      
      setDocxHtmlWithSignature(htmlWithSignature);
      setSignatureAddedToPreview(true);
      setSignature({
        dataUrl: signatureDataUrl
      });
      
      return;
    }

    // Pentru PDF: logica existentă
    const canvas = canvasRef.current;
    
    if (canvas) {
      const layoutPos =
        footerLayout?.signature && manualSignaturePositionFromLayout(canvas, footerLayout.signature);
      const sigWidth = layoutPos?.width ?? 150;
      const sigHeight = layoutPos?.height ?? 75;
      const posX = layoutPos?.x ?? canvas.width * 0.75 - sigWidth / 2;
      const posY = layoutPos?.y ?? canvas.height * 0.92 - sigHeight / 2;

      setSignature({
        dataUrl: signatureDataUrl
      });
      setSignaturePosition({
        x: posX,
        y: posY,
        width: sigWidth,
        height: sigHeight
      });
      
      // Pe mobile, plasează automat semnătura la poziția default (fără să aștepte click)
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobile) {
        // Pe mobile, nu activăm modul de poziționare - semnătura apare direct la poziția default
        // useEffect-ul va re-rendera canvas-ul automat când se schimbă signature/signaturePosition
        setIsPlacingSignature(false);
      } else {
        setIsPlacingSignature(true); // Pe desktop, activează modul de poziționare
      }
    } else {
      setSignature({
        dataUrl: signatureDataUrl
      });
      setIsPlacingSignature(false);
    }
  }, [signatureDataUrl, isDocx, docxHtml, footerLayout]);

  // Handler pentru ștergerea semnăturii
  const handleClear = useCallback(() => {
    setSignatureDataUrl(null);
    setSignature(null);
    if (isDocx) {
      setDocxHtmlWithSignature(null);
      setSignatureAddedToPreview(false);
    }
  }, [isDocx]);

  // Plasează semnătura la click/touch pe canvas
  const handleCanvasClick = useCallback((event) => {
    if (!isPlacingSignature || !signature) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Obține poziția exactă a click-ului/touch-ului relativ la canvas
    const rect = canvas.getBoundingClientRect();
    
    // Suport pentru touch events
    const clientX = event.clientX || (event.touches && event.touches[0]?.clientX) || event.changedTouches?.[0]?.clientX;
    const clientY = event.clientY || (event.touches && event.touches[0]?.clientY) || event.changedTouches?.[0]?.clientY;
    
    if (!clientX || !clientY) return;
    
    // Calculează poziția relativă la canvas
    const viewportX = clientX - rect.left;
    const viewportY = clientY - rect.top;
    
    // Canvas-ul poate fi redus/mărit prin CSS, trebuie să calculăm scale-ul real
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Convertim la coordonate canvas (coordonatele interne ale canvas-ului)
    const x = viewportX * scaleX;
    const y = viewportY * scaleY;

    // Setează poziția semnăturii (centruază pe click, cu limite în canvas)
    const sigWidth = 150;
    const sigHeight = 75;
    
    setSignaturePosition({
      x: Math.max(0, Math.min(x - sigWidth / 2, canvas.width - sigWidth)), // Centruază pe click
      y: Math.max(0, Math.min(y - sigHeight / 2, canvas.height - sigHeight)),
      width: sigWidth,
      height: sigHeight
    });

    setIsPlacingSignature(false);
  }, [isPlacingSignature, signature]);

  // Salvează DOCX-ul cu semnătura (înlocuiește {{FIRMA}} cu imaginea semnăturii)
  const saveSignedDocx = async () => {
    try {
      console.log('📝 [PRLDocumentSigner] saveSignedDocx called - salvând DOCX');
      if (!signature || !signature.dataUrl) {
        alert('Por favor, dibuja una firma primero');
        return;
      }

      setSaving(true);

      // Încarcă DOCX-ul original
      const response = await fetch(pdfUrl);
      const docxBlob = await response.blob();

      // Convertește semnătura la PNG (pentru backend)
      const signatureResponse = await fetch(signature.dataUrl);
      const signatureBlob = await signatureResponse.blob();

      // Creează FormData cu DOCX și imaginea semnăturii
      const formData = new FormData();
      let fileName;
      if (originalFileName) {
        // Verifică dacă numele deja conține "_FIRMADO" pentru a evita dublarea
        if (originalFileName.toLowerCase().includes('_firmado')) {
          fileName = originalFileName; // Folosește numele așa cum este
        } else {
          fileName = originalFileName.replace(/\.docx?$/i, '_FIRMADO.docx');
        }
      } else {
        fileName = `PRL_DOCUMENTO_${documentoId}_FIRMADO.docx`;
      }
      
      formData.append('archivo', docxBlob, fileName);
      formData.append('firma', signatureBlob, 'signature.png');

      // Trimite la backend pentru a adăuga semnătura în DOCX
      const token = localStorage.getItem('auth_token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const saveResponse = await fetch(routes.prlAgregarFirmaADocx(documentoId), {
        method: 'POST',
        headers: headers,
        body: formData
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({ message: 'Error al guardar documento' }));
        throw new Error(errorData.message || 'Error al guardar documento');
      }

      const result = await saveResponse.json();
      
      // Succes!
      if (onSuccess) {
        onSuccess(result);
      }
      
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Error saving signed DOCX:', err);
      alert(`Error al guardar documento: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Salvează PDF-ul cu semnătura
  const saveSignedPDF = async () => {
    try {
      console.log('📄 [PRLDocumentSigner] saveSignedPDF called - salvând PDF');
      if (!signature || !signature.dataUrl) {
        alert('Por favor, dibuja una firma primero');
        return;
      }

      // Verifică dacă semnătura are o poziție validă (nu e la (0,0) fără click)
      // Dacă e în modul de poziționare dar are poziție default, permite salvarea
      // (poziția default este setată când se apasă "Añadir Firma")

      setSaving(true);

      // Încarcă PDF-ul original
      const response = await fetch(pdfUrl);
      const pdfBytes = await response.arrayBuffer();
      
      // Creează un nou document PDF
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();

      // Convertește semnătura la PNG
      const imageBytes = await fetch(signature.dataUrl).then(res => res.arrayBuffer());
      const image = await pdfDoc.embedPng(imageBytes);

      // Calculează poziția în puncte PDF
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error('Canvas not found');
      }

      const signPageIndex = hasManualFooter ? pages.length - 1 : currentPage - 1;
      const signPage = pages[signPageIndex];

      if (hasManualFooter) {
        await drawManualFooterOnPage(signPage, pdfDoc, footerFields, footerLayout);
      }

      const xN = signaturePosition.x / canvas.width;
      const wN = signaturePosition.width / canvas.width;
      const hN = signaturePosition.height / canvas.height;

      const pagesToSign = hasManualFooter
        ? [signPageIndex]
        : applyToAllPages
          ? pages.map((_, i) => i)
          : [currentPage - 1];

      for (const pageIdx of pagesToSign) {
        const page = pages[pageIdx];
        const pageW = page.getWidth();
        const pageH = page.getHeight();
        page.drawImage(image, {
          x: xN * pageW,
          y: ((canvas.height - signaturePosition.y - signaturePosition.height) / canvas.height) * pageH,
          width: wN * pageW,
          height: hN * pageH,
        });
      }

      // Salvează PDF-ul modificat
      const modifiedPdfBytes = await pdfDoc.save();
      
      if (!modifiedPdfBytes || modifiedPdfBytes.byteLength === 0) {
        throw new Error('PDF-ul generat este gol sau invalid');
      }

      // Creează FormData pentru trimiterea la backend
      const formData = new FormData();
      const pdfBlob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      let fileName;
      if (originalFileName) {
        // Verifică dacă numele deja conține "_FIRMADO" pentru a evita dublarea
        if (originalFileName.toLowerCase().includes('_firmado')) {
          fileName = originalFileName; // Folosește numele așa cum este
        } else {
          fileName = originalFileName.replace(/\.pdf$/i, '_FIRMADO.pdf');
        }
      } else {
        fileName = `PRL_DOCUMENTO_${documentoId}_FIRMADO.pdf`;
      }
      
      formData.append('archivo', pdfBlob, fileName);

      // Trimite la backend PRL
      const token = localStorage.getItem('auth_token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const saveResponse = await fetch(routes.prlSubirDocumentoFirmado(documentoId), {
        method: 'POST',
        headers: headers,
        body: formData
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({ message: 'Error al guardar documento' }));
        throw new Error(errorData.message || 'Error al guardar documento');
      }

      const result = await saveResponse.json();
      
      // Succes!
      if (onSuccess) {
        onSuccess(result);
      }
      
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Error saving signed PDF:', err);
      alert(`Error al guardar documento: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Funcție unificată pentru salvare (PDF sau DOCX)
  const saveSignedDocument = isDocx ? saveSignedDocx : saveSignedPDF;
  
  // Log pentru debugging
  console.log('🔍 [PRLDocumentSigner] isDocx:', isDocx, 'saveSignedDocument type:', isDocx ? 'DOCX' : 'PDF');

  if (loading || docxLoading) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Firmar Documento PRL">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isDocx ? 'Cargando documento DOCX...' : 'Cargando PDF...'}
          </p>
        </div>
      </Modal>
    );
  }

  if (error) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Error">
        <div className="text-center py-12">
          <p className="text-red-600">{error}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Cerrar
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <style>{dialogStyles}</style>
      <Modal isOpen={true} onClose={onClose} title="Firmar Documento PRL" size="xl">
        <div className="prl-signer-body">
          {/* Pentru DOCX: mesaj informativ și preview */}
          {isDocx && (
            <>
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Documento Word (DOCX)</strong>
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Dibuja tu firma abajo. La firma se insertará automáticamente en el lugar del placeholder <code className="bg-blue-100 px-1 rounded">{'{{FIRMA}}'}</code> en el documento.
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  💡 El placeholder <code className="bg-yellow-200 px-1 rounded">{'{{FIRMA}}'}</code> está resaltado en amarillo en el preview.
                </p>
              </div>
              
              {/* Preview DOCX */}
              {docxLoading && (
                <div className="mb-4 p-8 text-center bg-gray-50 rounded-lg">
                  <p className="text-gray-600">Cargando preview del documento...</p>
                </div>
              )}
              
              {docxHtml && !docxLoading && (
                <div className="mb-4 border rounded-lg overflow-hidden bg-white docx-preview-container">
                  <div className="p-3 bg-gray-50 border-b sticky top-0 z-10">
                    <p className="text-sm font-semibold text-gray-700">📄 Preview del Documento</p>
                    {signatureAddedToPreview && (
                      <p className="text-xs text-green-600 mt-1">
                        ✅ Firma añadida al preview. Se insertará en el lugar del placeholder {'{{FIRMA}}'} al guardar.
                      </p>
                    )}
                  </div>
                  <div 
                    className="p-4 docx-preview"
                    dangerouslySetInnerHTML={{ __html: docxHtmlWithSignature || docxHtml }}
                    style={{
                      fontFamily: 'Calibri, Arial, sans-serif',
                      fontSize: '11pt',
                      lineHeight: '1.5'
                    }}
                  />
                </div>
              )}
            </>
          )}

          {hasManualFooter && (
            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900">
              <p className="font-semibold">Última página — datos del trabajador</p>
              <p className="mt-1 text-emerald-800">
                Al guardar se completarán automáticamente: Empresa, Fecha, D.N.I. y Nombre. Coloca la firma en
                «Nombre y firma del trabajador». En la vista previa verás el texto en azul sobre cada línea.
              </p>
              <ul className="mt-2 text-xs text-emerald-700 space-y-0.5">
                <li><strong>Empresa:</strong> {footerFields.empresa || '—'}</li>
                <li><strong>Fecha:</strong> {footerFields.fecha || '—'}</li>
                <li><strong>D.N.I.:</strong> {footerFields.dni || '— (completa tu DNI en la ficha)'}</li>
                <li><strong>Nombre:</strong> {footerFields.nombre || '—'}</li>
              </ul>
            </div>
          )}

          {/* Controale pentru navigare pagini (doar pentru PDF) */}
          {!isDocx && (
            <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg page-nav-buttons">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  ← Anterior
                </button>
                <span className="text-sm font-medium">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  Siguiente →
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setScale(Math.max(0.5, scale - 0.25))}
                  className="px-2 py-1 bg-gray-200 rounded text-sm touch-manipulation min-h-[44px] min-w-[44px]"
                >
                  −
                </button>
                <span className="text-sm">{Math.round(scale * 100)}%</span>
                <button
                  onClick={() => setScale(Math.min(2.0, scale + 0.25))}
                  className="px-2 py-1 bg-gray-200 rounded text-sm touch-manipulation min-h-[44px] min-w-[44px]"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Canvas pentru PDF (doar pentru PDF) */}
          {!isDocx && (
            <div className="mb-4 border rounded-lg overflow-auto bg-gray-100 pdf-canvas-container" style={{ maxHeight: '60vh' }}>
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onMouseMove={handleCanvasMouseMove}
                onTouchStart={(e) => {
                  // Pe mobile, permite touch pentru poziționare
                  if (isPlacingSignature && signature) {
                    e.preventDefault();
                  }
                }}
                onTouchEnd={(e) => {
                  // Permite touch events pentru click pe canvas (doar când plasezi semnătura)
                  if (isPlacingSignature && signature) {
                    e.preventDefault();
                    handleCanvasClick(e);
                  }
                }}
                className="mx-auto block cursor-crosshair"
                style={{ touchAction: isPlacingSignature ? 'none' : 'pan-x pan-y pinch-zoom' }}
              />
            </div>
          )}

          {/* SignaturePad */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Dibuja tu firma:</h3>
            <SignaturePadComponent
              value={signatureDataUrl}
              onChange={handleSignatureChange}
              width={typeof window !== 'undefined' && window.innerWidth < 768 ? 300 : 400}
              height={typeof window !== 'undefined' && window.innerWidth < 768 ? 150 : 200}
            />
            <div className="flex gap-2 mt-2 signature-buttons-container">
              <button
                onClick={handleAddSignature}
                disabled={!signatureDataUrl}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Añadir Firma a la Página
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Limpiar Firma
              </button>
            </div>
          </div>

          {!hasManualFooter && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyToAllPages}
                  onChange={(e) => setApplyToAllPages(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-blue-900">
                  Aplicar firma a todas las páginas
                </span>
              </label>
              <p className="text-xs text-blue-700 mt-1 ml-7">
                {applyToAllPages
                  ? `La firma se aplicará en las ${totalPages} páginas del documento en la misma posición.`
                  : 'La firma se aplicará solo en la página actual.'}
              </p>
            </div>
          )}

          {/* Instrucțiuni */}
          {isPlacingSignature && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                💡 Haz clic en el PDF para colocar la firma
              </p>
            </div>
          )}
        </div>

        {/* Footer cu butoane */}
        <div className="prl-signer-footer">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={saveSignedDocument}
            disabled={!signature || saving}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex-1"
          >
            {saving ? 'Guardando...' : 'Guardar y Enviar'}
          </button>
        </div>
      </Modal>
    </>
  );
}
