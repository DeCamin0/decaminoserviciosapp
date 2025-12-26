import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import '../config/pdfjs.ts'; // Importă configurația centralizată a worker-ului

const PDFViewerAndroid = ({ pdfUrl, className = '', style = {} }) => {
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  // Track current PDF.js render task to avoid concurrent renders on the same canvas
  const renderTaskRef = useRef(null);
  const renderTimeoutRef = useRef(null);

  useEffect(() => {
    if (!pdfUrl) {
      console.log('📱 PDFViewerAndroid: No PDF URL provided');
      return;
    }

    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('📱 PDFViewerAndroid: Loading PDF:', pdfUrl);
        
        // Verifică dacă URL-ul este valid
        if (!pdfUrl.startsWith('data:') && !pdfUrl.startsWith('blob:') && !pdfUrl.startsWith('http')) {
          throw new Error('Invalid PDF URL format');
        }
        
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
          verbosity: 0, // Reduce logging
        });
        
        // Adaugă event listener pentru progres
        loadingTask.onProgress = () => {
          // Progress logging removed for cleaner console
        };
        
        const pdf = await loadingTask.promise;
        
        setPdfDocument(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        
        console.log('📱 PDFViewerAndroid: PDF loaded successfully');
      } catch (err) {
        console.error('📱 PDFViewerAndroid: Error loading PDF:', err);
        console.error('📱 PDFViewerAndroid: Error details:', err.message);
        setError(`Error al cargar el PDF: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadPDF();
  }, [pdfUrl]);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current || totalPages === 0) {
      return;
    }

    // Clear any pending render timeout
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    // Debounce render calls to prevent rapid successive renders
    renderTimeoutRef.current = setTimeout(async () => {
      try {
        // Cancel any in-progress render before starting a new one
        if (renderTaskRef.current && typeof renderTaskRef.current.cancel === 'function') {
          try {
            renderTaskRef.current.cancel();
            // Wait a bit for cancellation to complete
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (_) {
            // ignore cancel errors
          }
        }

        const page = await pdfDocument.getPage(currentPage);
        const canvas = canvasRef.current;
        
        if (!canvas) {
          throw new Error('Canvas not available');
        }
        
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Canvas context not available');
        }

        const viewport = page.getViewport({ scale });
        
        // Clear canvas before setting new dimensions
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
        
        // Clear reference when done
        if (renderTaskRef.current === task) {
          renderTaskRef.current = null;
        }
      } catch (err) {
        console.error('📱 PDFViewerAndroid: Error rendering page:', err);
        console.error('📱 PDFViewerAndroid: Error details:', err.message);
        setError(`Error al renderizar la página: ${err.message}`);
      }
    }, 150); // 150ms debounce

    // Cleanup: cancel any ongoing render and timeout if dependencies change or component unmounts
    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
        renderTimeoutRef.current = null;
      }
      if (renderTaskRef.current && typeof renderTaskRef.current.cancel === 'function') {
        try {
          renderTaskRef.current.cancel();
        } catch (_) {
          // ignore
        } finally {
          renderTaskRef.current = null;
        }
      }
    };
  }, [pdfDocument, currentPage, scale, totalPages]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  // Funcții pentru navigare cu gesturi (swipe)
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentPage < totalPages) {
      // Swipe stânga = pagina următoare
      setCurrentPage(prev => prev + 1);
    }
    if (isRightSwipe && currentPage > 1) {
      // Swipe dreapta = pagina anterioară
      setCurrentPage(prev => prev - 1);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`} style={style}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Cargando PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-red-50 ${className}`} style={style}>
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
          >
            Abrir PDF en una nueva pestaña
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`} style={{ ...style, display: 'flex', flexDirection: 'column' }}>
      {/* Controles de navegación - compactos */}
      <div className="flex items-center justify-between p-2 bg-blue-50 border-b flex-shrink-0">
        {totalPages > 1 ? (
          <div className="flex items-center gap-1">
              <button
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed font-medium min-h-[32px] min-w-[32px] touch-manipulation"
              >
              ←
              </button>
            <div className="bg-white px-2 py-1 rounded border border-blue-200 text-xs">
              <span className="text-blue-700 font-bold">
                {currentPage}/{totalPages}
                </span>
              </div>
              <button
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed font-medium min-h-[32px] min-w-[32px] touch-manipulation"
              >
              →
              </button>
            </div>
        ) : (
          <div className="text-xs text-blue-600 font-medium">
            📄 1 página
          </div>
        )}
        
        {/* Controale de zoom - compactos */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="px-2 py-1 text-xs bg-gray-600 text-white rounded font-bold min-h-[32px] min-w-[32px] touch-manipulation"
          >
            -
          </button>
          <span className="text-xs text-gray-600 font-medium min-w-[40px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="px-2 py-1 text-xs bg-gray-600 text-white rounded font-bold min-h-[32px] min-w-[32px] touch-manipulation"
          >
            +
          </button>
        </div>
      </div>

      {/* Thumbnail navigation - compact */}
      {totalPages > 1 && totalPages <= 10 && (
        <div className="p-1 bg-gray-50 border-b">
          <div className="flex gap-1 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`flex-shrink-0 w-6 h-6 text-xs rounded border transition-all ${
                  currentPage === pageNum
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
              >
                {pageNum}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Canvas para renderizar PDF - más espacio */}
      <div 
        className="flex justify-center bg-gray-100 p-2 overflow-auto flex-1" 
        style={{ WebkitOverflowScrolling: 'touch' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto shadow-lg"
        />
      </div>
    </div>
  );
};

export default PDFViewerAndroid;
