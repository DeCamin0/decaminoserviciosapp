import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';
import SignaturePadComponent from '../shared/components/SignaturePad';
import { useAuth } from '../contexts/AuthContextBase';
import { routes } from '../utils/routes';
import Modal from './ui/Modal';

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
    display: flex;
    gap: 8px;
    z-index: 1001;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
  }
  
  @media (max-width: 768px) {
    .prl-signer-dialog {
      inset: 0;
      border-radius: 0;
      max-height: 100vh;
    }

    .prl-signer-body {
      padding: 12px;
      padding-bottom: 220px; /* Space pentru footer fix */
    }

    .prl-signer-footer {
      padding: 16px 12px;
      gap: 12px;
      flex-direction: column;
    }
    
    .prl-signer-footer button {
      width: 100%;
      padding: 16px 20px !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      border-radius: 12px !important;
      min-height: 48px;
      touch-action: manipulation; /* Previne double-tap zoom */
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

export default function PRLDocumentSigner({ pdfUrl, documentoId, originalFileName, onClose, onSuccess, isDocx = false }) {
  useAuth(); // Keep for potential future use
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
  const [applyToAllPages, setApplyToAllPages] = useState(true); // Checkbox bifat by default
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
    img.onload = () => {
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
    img.src = sig.dataUrl;
  }, []);
  
  // Convertește coordonatele ecran → PDF
  const handleCanvasMouseMove = useCallback(() => {
    if (!isPlacingSignature) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Mouse position tracking removed - not used
  }, [isPlacingSignature]);

  // Încarcă DOCX-ul și convertește la HTML pentru preview
  useEffect(() => {
    if (!isDocx || !pdfUrl) return;

    const loadDocx = async () => {
      try {
        setDocxLoading(true);
        const response = await fetch(pdfUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        // Convertește DOCX la HTML folosind mammoth
        const result = await mammoth.convertToHtml({ arrayBuffer });
        let html = result.value;
        
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
      } catch (err) {
        console.error('Error loading DOCX:', err);
        setError(`Error al cargar documento DOCX: ${err.message}`);
        setDocxLoading(false);
        setLoading(false);
      }
    };

    loadDocx();
  }, [isDocx, pdfUrl]);

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
  }, [pdfDocument, currentPage, scale, signature, signaturePosition, drawSignature, isDocx]);

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
      // Poziție default: dreapta jos (în zona de numerotare a paginilor)
      const defaultX = canvas.width * 0.75; // 75% din lățime (dreapta)
      const defaultY = canvas.height * 0.92; // 92% din înălțime (foarte jos în canvas = jos în PDF)
      
      const sigWidth = 150;
      const sigHeight = 75;
      
      setSignature({
        dataUrl: signatureDataUrl
      });
      setSignaturePosition({
        x: defaultX - sigWidth / 2, // Centruază pe poziția default
        y: defaultY - sigHeight / 2,
        width: sigWidth,
        height: sigHeight
      });
      setIsPlacingSignature(true); // Activează modul de poziționare
    } else {
      setSignature({
        dataUrl: signatureDataUrl
      });
      setIsPlacingSignature(true);
    }
  }, [signatureDataUrl, isDocx, docxHtml]);

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

      const firstPage = pages[0];
      const pw = firstPage.getWidth();
      const ph = firstPage.getHeight();
      
      // Coordonatele normalizate (canvas HTML: Y=0 sus, Y=height jos)
      const xN = signaturePosition.x / canvas.width;
      const wN = signaturePosition.width / canvas.width;
      const hN = signaturePosition.height / canvas.height;
      
      // Convertește la puncte PDF (PDF: Y=0 jos, Y=height sus)
      // Canvas: Y=0 sus, Y=height jos
      // PDF: Y=0 jos, Y=height sus
      // Pentru a converti: y_pdf = (canvas.height - y_canvas - height_canvas) / canvas.height * ph
      // Simplificat: y_pdf = (1 - yN - hN) * ph (yN calculat inline pentru claritate)
      // DAR: dacă yN este mare (jos în canvas), vrem y_pdf mic (jos în PDF)
      // Corect: y_pdf = (canvas.height - signaturePosition.y - signaturePosition.height) / canvas.height * ph
      const x = xN * pw;
      const y = ((canvas.height - signaturePosition.y - signaturePosition.height) / canvas.height) * ph;
      const w = wN * pw;
      const h = hN * ph;

      // Adaugă semnătura pe paginile selectate
      if (applyToAllPages) {
        // Adaugă pe toate paginile
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          page.drawImage(image, {
            x: x,
            y: y,
            width: w,
            height: h
          });
        }
      } else {
        // Adaugă doar pe pagina curentă
        const page = pages[currentPage - 1];
        page.drawImage(image, {
          x: x,
          y: y,
          width: w,
          height: h
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

  if (loading) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Firmar Documento PRL">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando PDF...</p>
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
                <div className="mb-4 border rounded-lg overflow-auto bg-white" style={{ maxHeight: '50vh' }}>
                  <div className="p-4 bg-gray-50 border-b">
                    <p className="text-sm font-semibold text-gray-700">📄 Preview del Documento</p>
                    {signatureAddedToPreview && (
                      <p className="text-xs text-green-600 mt-1">
                        ✅ Firma añadida al preview. Se insertará en el lugar del placeholder {'{{FIRMA}}'} al guardar.
                      </p>
                    )}
                  </div>
                  <div 
                    className="p-6 docx-preview"
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
            <div className="flex gap-2 mt-2">
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

          {/* Checkbox pentru aplicare pe toate paginile */}
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
