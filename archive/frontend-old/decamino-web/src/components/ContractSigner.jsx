import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import SignatureCanvas from './SignatureCanvas';
import { useAuth } from '../contexts/AuthContextBase';
import { routes } from '../utils/routes';

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
  }

  .dlg__body {
    flex: 1 1 auto;
    overflow: auto;
    padding: 16px;
    scroll-behavior: smooth;
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
      padding-bottom: 180px; /* Space pentru footer fix - mărit pentru mobil */
      -webkit-overflow-scrolling: touch; /* Smooth scroll pe iOS */
    }
    
    /* PDF Viewer pe mobil - înălțime flexibilă */
    .pdf-canvas-container {
      max-height: 60vh !important; /* Mai mare pe mobil pentru vizualizare mai bună */
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

export default function ContractSigner({ pdfUrl, docId, originalFileName, onClose }) {
  const { user: authUser } = useAuth();
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signatures, setSignatures] = useState({}); // { pageNum: signatureData }
  const [isPlacingSignature, setIsPlacingSignature] = useState(false); // Pentru poziționarea semnăturii
  const [draggedSignature, setDraggedSignature] = useState(null); // Pentru drag & drop vizual
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 }); // Poziția mouse-ului pentru preview
 
  const canvasRef = useRef(null);
  const signatureRef = useRef(null);

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
  }, [pdfUrl]);

  // Randează pagina curentă
  useEffect(() => {
    let renderTask = null;
    
    const renderPage = async () => {
      if (!pdfDocument || !canvasRef.current) return;

      try {
        // Anulează operația anterioară dacă există
        if (renderTask) {
          renderTask.cancel();
        }

        const page = await pdfDocument.getPage(currentPage);
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        // Creează o nouă operație de render
        renderTask = page.render(renderContext);
        await renderTask.promise;
        
        // Desenează semnătura dacă există pentru această pagină
        if (signatures[currentPage]) {
          drawSignature(context, signatures[currentPage]);
        }
      } catch (err) {
        // Ignoră erorile de anulare - sunt normale când se schimbă pagina
        if (err.name !== 'RenderingCancelled' && err.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', err);
        }
      }
    };

    renderPage();

    // Cleanup: anulează operația la unmount sau când se schimbă dependințele
    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDocument, currentPage, scale, signatures, drawSignature]);

  // Handlers pentru semnătură
  const handleClear = useCallback(() => {
    signatureRef.current?.clear();
  }, []);

  const handleAddSignature = useCallback(() => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      alert('Por favor, dibuja una firma primero');
      return;
    }

    // Activează modul de poziționare cu caseta draggable
    const signatureData = signatureRef.current.toDataURL();
    setDraggedSignature({
      dataUrl: signatureData,
      width: 200,
      height: 100
    });
    setIsPlacingSignature(true);
    
    // Curăță signature pad după ce am luat semnătura
    signatureRef.current.clear();
  }, []);

  // Poziționează semnătura pe PDF
  const handlePlaceSignature = useCallback((event) => {
    if (!isPlacingSignature || !draggedSignature) return;

    const pdfCanvas = canvasRef.current;
    if (!pdfCanvas) return;

    const rect = pdfCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convertește coordonatele la dimensiunile PDF
    const scaleX = pdfCanvas.width / rect.width;
    const scaleY = pdfCanvas.height / rect.height;

    // Calculează poziția finală (centrul semnăturii)
    const finalX = (x - draggedSignature.width / 2) * scaleX;
    const finalY = (y - draggedSignature.height / 2) * scaleY;

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

  // Salvează PDF-ul cu toate semnăturile
  const saveSignedPDF = async () => {
    try {
      if (Object.keys(signatures).length === 0) {
        alert('Por favor, añade al menos una firma antes de guardar');
        return;
      }

      // Încarcă PDF-ul original
      const response = await fetch(pdfUrl);
      const pdfBytes = await response.arrayBuffer();
      
      // Creează un nou document PDF
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();

      // Adaugă semnăturile pe fiecare pagină
      for (let pageNum = 1; pageNum <= pages.length; pageNum++) {
        if (signatures[pageNum]) {
          const page = pages[pageNum - 1];
          const signature = signatures[pageNum];
          
          // Convertește semnătura la PNG
          const imageBytes = await fetch(signature.dataUrl).then(res => res.arrayBuffer());
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
      
      // Creează FormData pentru fișierul binary
      const formData = new FormData();
      const pdfBlob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const fileName = originalFileName 
        ? originalFileName.replace(/\.pdf$/i, '_FIRMADO.pdf')
        : `CONTRATO_EMPLEADO_${docId}_FIRMADO.pdf`;
      
      formData.append('pdf', pdfBlob, fileName);
      
      // Adaugă metadata ca JSON string
      const metadata = {
        documento_id: docId,
        nombre_archivo: originalFileName || `CONTRATO_EMPLEADO_${docId}.pdf`,
        tipo_documento: "CONTRATO firmado",
        email_usuario: authUser?.email || "mihaipaulet1408@gmail.com",
        fecha_firma: new Date().toISOString(),
        estado: "semnat",
        usuario_firma: authUser?.displayName || authUser?.name || "Alexandru Mihai Paulet"
      };
      
      console.log('🔍 Metadata:', metadata);
      console.log('🔍 AuthUser:', authUser);
      
      formData.append('metadata', JSON.stringify(metadata));
      
      console.log('📤 Sending data to endpoint:', {
        metadata: metadata,
        pdf_size: `${(modifiedPdfBytes.byteLength / 1024 / 1024).toFixed(2)} MB`,
        endpoint: routes.guardarDocumentoSemnat
      });
      
      // Trimite la backend cu FormData (fișierul binary + metadata JSON)
      console.log('🔍 Endpoint URL:', routes.guardarDocumentoSemnat);
      console.log('🔍 FormData contents:', {
        pdf: formData.get('pdf'),
        metadata: formData.get('metadata')
      });
      
      const saveResponse = await fetch(routes.guardarDocumentoSemnat, {
        method: 'POST',
        body: formData
        // Nu setăm Content-Type pentru FormData - browser-ul îl setează automat cu boundary
      });

      if (saveResponse.ok) {
        const result = await saveResponse.json();
        console.log('✅ Response successful:', {
          status: saveResponse.status,
          statusText: saveResponse.statusText,
          headers: Object.fromEntries(saveResponse.headers.entries()),
          result: result
        });
        alert(`✅ Documento firmado guardado exitosamente: ${originalFileName 
          ? originalFileName.replace(/\.pdf$/i, '_FIRMADO.pdf')
          : `CONTRATO_EMPLEADO_${docId}_FIRMADO.pdf`
        }`);
        onClose?.();
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
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
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
                isPlacingSignature 
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                  : 'bg-gradient-to-br from-red-500 to-red-600'
              }`}>
                <span className="text-white text-xl">
                  {isPlacingSignature ? '🎯' : '✍️'}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {isPlacingSignature ? 'Posicionar Firma' : 'Firmar Documento'}: Página {currentPage} de {totalPages}
                </h3>
                <p className="text-blue-600 text-sm font-medium">Documento: {docId}</p>
                {isPlacingSignature && (
                  <div className="text-blue-700 mt-1 text-sm">
                    💡 Arrastra la firma para posicionarla en el documento
                  </div>
                )}
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
              <button
                onClick={onClose}
                className="w-10 h-10 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-300 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg group"
              >
                <span className="text-gray-400 group-hover:text-red-500 text-xl">✕</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="dlg__body">
        {/* PDF Viewer */}
        <div className="bg-gray-50 p-4 mb-4 rounded-lg">
          {/* Toolbar modernizado */}
          <div className="bg-white rounded-xl shadow-lg p-4 mb-4 border border-gray-200">
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
          </div>

          {/* PDF Canvas Container */}
          <div className="pdf-canvas-container bg-white rounded-lg shadow-md p-4 overflow-auto max-h-[40vh]">
            <div className="flex justify-center relative">
              <canvas
                ref={canvasRef}
                className={`border border-gray-200 rounded-lg shadow-sm ${
                  isPlacingSignature ? 'cursor-crosshair' : 'cursor-default'
                }`}
                style={{ maxWidth: '100%', height: 'auto' }}
                onClick={handlePlaceSignature}
                onMouseMove={handleCanvasMouseMove}
              />
              
              {/* Grid overlay pentru precizie maximă */}
              {isPlacingSignature && (
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
              {isPlacingSignature && draggedSignature && (
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

        {/* Signature Zone */}
        <section id="signature-zone" className="bg-white rounded-lg shadow-md p-4">
          <div className="text-center mb-4">
            <h4 className="text-lg font-bold text-gray-900">
              ✍️ Firma digital
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            </div>

            {/* Signature Status */}
            <div>
              <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-sm h-full">
                <h5 className="font-bold text-gray-900 mb-3 text-center">Estado de Firmas:</h5>
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
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer - Sticky con botones modernos */}
      <footer className="dlg__footer">
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
          onClick={saveSignedPDF}
          disabled={Object.keys(signatures).length === 0}
          className={`group relative flex-1 px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
            Object.keys(signatures).length === 0
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed shadow-none transform-none'
              : 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200'
          }`}
        >
          {Object.keys(signatures).length > 0 && (
            <div className="absolute inset-0 rounded-xl bg-red-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"></div>
          )}
          <div className="relative flex items-center justify-center gap-2">
            {Object.keys(signatures).length === 0 ? (
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
      </footer>
    </div>
  );
}
