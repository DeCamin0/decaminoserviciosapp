import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../../../components/ui';
import { routes } from '../../../utils/routes';

const FileAttachmentModal = ({ 
  isOpen, 
  onClose, 
  factura, 
  onSave,
  isViewMode = false
}) => {
  // console.log('🔍 FileAttachmentModal render cu props:', { isOpen, factura, isViewMode });
  const [files, setFiles] = useState([]);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Simulează spațiul pe disc (40% ocupat)
  const diskUsage = 40;
  const diskSpace = {
    used: '40 GB',
    total: '100 GB',
    percentage: diskUsage
  };

  const handleFileSelect = (event) => {
    const selectedFiles = Array.from(event.target.files);
    addFiles(selectedFiles);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    dropZoneRef.current?.classList.add('border-blue-400', 'bg-blue-50');
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    dropZoneRef.current?.classList.remove('border-blue-400', 'bg-blue-50');
  };

  const addFiles = (newFiles) => {
    const validFiles = newFiles.filter(file => {
      // Verifică dimensiunea (30MB max)
      if (file.size > 30 * 1024 * 1024) {
        alert(`Fișierul ${file.name} este prea mare. Dimensiunea maximă este 30MB.`);
        return false;
      }
      return true;
    });

    const filesWithId = validFiles.map((file, index) => ({
      id: Date.now() + index,
      file,
      name: file.name,
      size: formatFileSize(file.size),
      type: getFileType(file.name),
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));

    setFiles(prev => [...prev, ...filesWithId]);
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const removeAttachedFile = (fileId) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const typeMap = {
      'pdf': 'PDF',
      'doc': 'DOC',
      'docx': 'DOCX',
      'xls': 'XLS',
      'xlsx': 'XLSX',
      'jpg': 'JPG',
      'jpeg': 'JPEG',
      'png': 'PNG',
      'txt': 'TXT'
    };
    return typeMap[ext] || ext.toUpperCase();
  };

  const getFileExtensionFromMimeType = (mimeType) => {
    if (!mimeType || typeof mimeType !== 'string') {
      return 'txt';
    }
    
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('word')) return 'docx';
    if (mimeType.includes('excel')) return 'xlsx';
    if (mimeType.includes('image')) return 'jpg';
    return 'txt';
  };

  // Funcție pentru a obține documentele atașate existente
  const getAttachedFiles = useCallback(async () => {
    console.log('🔍 DEBUG: getAttachedFiles apelat pentru factura:', factura);
    console.log('🔍 DEBUG: factura.id:', factura?.id);
    
    if (!factura?.id) {
      console.log('❌ Nu există ID de factură pentru a obține documentele');
      return;
    }
    
    // Construiește URL-ul pentru webhook - trimite doar facturaId
    const webhookUrl = `${routes.getFacturaAttachments}?facturaId=${factura.id}`;
    console.log('🔍 DEBUG: URL webhook:', webhookUrl);
    console.log('🔍 DEBUG: Parametrii trimiși: facturaId=', factura.id);

    setLoadingFiles(true);
    try {
      const response = await fetch(webhookUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      console.log('🔍 DEBUG: Răspuns webhook status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Documente obținute cu succes:', data);
      console.log('📋 Tipul datelor:', typeof data);
      console.log('📋 Este array?', Array.isArray(data));
      console.log('📋 Lungimea:', data?.length);
      
      // Transformă obiectul în array pentru afișare
      let processedFiles = [];
      
      if (data && typeof data === 'object') {
        console.log('🔍 Procesez datele:', data);
        
        // Dacă data este array, procesează fiecare element
        if (Array.isArray(data)) {
          console.log('✅ Procesez array-ul cu', data.length, 'elemente');
          
          data.forEach((item, index) => {
            console.log(`🔍 Procesez elementul ${index}:`, item);
            
            if (item.file_bytes && item.file_bytes > 0 && item.filename) {
              console.log(`✅ Procesez fișierul ${index}:`, item.filename, 'cu', item.file_bytes, 'bytes');
              
              processedFiles.push({
                id: Date.now() + index,
                name: item.filename,
                size: formatFileSize(item.file_bytes || 0),
                type: getFileType(item.filename),
                date: item.created_at ? new Date(item.created_at).toLocaleDateString('es-ES') : 'N/A',
                mimeType: item.mimeType || 'unknown',
                descripcion: item.Descripcion || '',
                originalData: item
              });
            }
          });
        } else {
          // Procesează fișierele din obiect
          if (data.file1_bytes && data.file1_bytes > 0) {
            const fileName = data.filename1 || `Archivo_1.${getFileExtensionFromMimeType(data.mimeType)}`;
            processedFiles.push({
              id: 1,
              name: fileName,
              size: formatFileSize(data.file1_bytes || 0),
              type: getFileType(fileName),
              date: data.created_at ? new Date(data.created_at).toLocaleDateString('es-ES') : 'N/A',
              mimeType: data.mimeType || 'unknown',
              originalData: data
            });
          }
          
          if (data.file2_bytes && data.file2_bytes > 0) {
            const fileName = data.filename2 || `Archivo_2.${getFileExtensionFromMimeType(data.mimeType)}`;
            processedFiles.push({
              id: 2,
              name: fileName,
              size: formatFileSize(data.file2_bytes || 0),
              type: getFileType(fileName),
              date: data.created_at ? new Date(data.created_at).toLocaleDateString('es-ES') : 'N/A',
              mimeType: data.mimeType || 'unknown',
              originalData: data
            });
          }
          
          if (data.file3_bytes && data.file3_bytes > 0) {
            const fileName = data.filename3 || `Archivo_3.${getFileExtensionFromMimeType(data.mimeType)}`;
            processedFiles.push({
              id: 3,
              name: fileName,
              size: formatFileSize(data.file3_bytes || 0),
              type: getFileType(fileName),
              date: data.created_at ? new Date(data.created_at).toLocaleDateString('es-ES') : 'N/A',
              mimeType: data.mimeType || 'unknown',
              originalData: data
            });
          }

          // Detectează și structura cu filename și file_bytes (singular)
          if (data.file_bytes && data.file_bytes > 0 && data.filename) {
            processedFiles.push({
              id: Date.now(),
              name: data.filename,
              size: formatFileSize(data.file_bytes || 0),
              type: getFileType(data.filename),
              date: data.created_at ? new Date(data.created_at).toLocaleDateString('es-ES') : 'N/A',
              mimeType: data.mimeType || 'unknown',
              originalData: data
            });
          }
        }
        
        console.log('✅ Fișiere procesate:', processedFiles);
        console.log('✅ Numărul total de fișiere găsite:', processedFiles.length);
        setAttachedFiles(processedFiles);
      } else {
        console.log('❌ Datele nu sunt obiect, setez array gol');
        setAttachedFiles([]);
      }
    } catch (error) {
      console.error('❌ Error obținând documentele:', error);
      setAttachedFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, [factura?.id]);

  // Funcție pentru descărcarea fișierului
  const handleDownload = async (file) => {
    console.log('📥 Descărcare fișier:', file);
    
    try {
      const response = await fetch(`${routes.downloadFacturaAttachment}?facturaId=${factura.id}&filename=${encodeURIComponent(file.name)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('✅ Fișier descărcat cu succes:', file.name);
      
    } catch (error) {
      console.error('❌ Error descărcând fișierul:', error);
      alert(`Error al descargar el archivo: ${error.message}`);
    }
  };

  // Funcție pentru ștergerea fișierului
  const handleDelete = async (file) => {
    console.log('🗑️ Ștergere fișier:', file);
    
    if (!confirm(`¿Estás seguro de que quieres eliminar el archivo "${file.name}"?`)) {
      return;
    }
    
    try {
      const response = await fetch(routes.deleteFacturaAttachment, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facturaId: factura.id,
          filename: file.name,
          descripcion: file.originalData?.Descripcion || ''
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Fișier șters cu succes:', result);
      
      setAttachedFiles([]);
      await getAttachedFiles();
      
      setSuccessMessage(`✅ Archivo "${file.name}" eliminado correctamente`);
      
    } catch (error) {
      console.error('❌ Error ștergând fișierul:', error);
      alert(`Error al eliminar el archivo: ${error.message}`);
    }
  };

  const handleSave = async () => {
    if (files.length === 0 && description.trim() === '') {
      onClose();
      return;
    }

    setUploading(true);
    
    try {
      // Trimite fiecare fișier la webhook-ul n8n
      for (const fileData of files) {
        const timestamp = new Date().toISOString();
        
        const formData = new FormData();
        formData.append('file', fileData.file);
        formData.append('facturaId', factura.id || 'N/A');
        formData.append('timestamp', timestamp);
        formData.append('description', description.trim());
        formData.append('fileName', fileData.name);
        formData.append('fileSize', fileData.size);
        formData.append('fileType', fileData.type);
        
        const response = await fetch(routes.uploadFacturaAttachment, {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log(`✅ Fișier ${fileData.name} încărcat cu succes:`, result);
      }
      
      if (onSave) {
        await onSave({
          facturaId: factura.id,
          files: files.map(f => f.file),
          description: description.trim()
        });
      }
      
      setSuccessMessage(`✅ ${files.length} documento(s) cargado(s) correctamente`);
      
      setFiles([]);
      setDescription('');
      
      setAttachedFiles([]);
      await getAttachedFiles();
      
    } catch (error) {
      console.error('❌ Error uploading files to webhook:', error);
      setSuccessMessage(`❌ Error al cargar los archivos: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // useEffect simplu pentru a apela getAttachedFiles când se deschide modalul
  useEffect(() => {
    if (isOpen && factura?.id) {
      console.log('🔍 Modal deschis și factura validă, apelez getAttachedFiles()');
      getAttachedFiles();
    }
  }, [isOpen, factura?.id, getAttachedFiles]);

  if (!isOpen) return null;

  console.log('🔍 Render modal cu attachedFiles:', attachedFiles);
  console.log('🔍 attachedFiles.length:', attachedFiles.length);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">
            {isViewMode ? 'Ver Factura' : 'Gestión de documentos asociados a la factura'}
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
          {isViewMode ? (
            // Modul de vizualizare
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-800 mb-3">
                  Factura #{factura?.id || 'N/A'}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-600">ID:</span>
                    <p className="text-sm text-gray-800">{factura?.id || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Data:</span>
                    <p className="text-sm text-gray-800">{factura?.data || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Estado:</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      {factura?.Estado || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Documentos adjuntos */}
              <div className="pt-6 border-t border-gray-200">
                <h4 className="font-medium text-gray-700 mb-3">
                  Documentos adjuntos ({attachedFiles.length})
                </h4>
                {loadingFiles ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Cargando documentos...</p>
                    </div>
                ) : attachedFiles.length > 0 ? (
                  <div className="space-y-2">
                    {attachedFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                            📎
                    </div>
                          <div>
                            <div className="font-medium text-sm">{file.name}</div>
                            <div className="text-xs text-gray-500">
                              {file.size} • {file.type} • {file.date}
                    </div>
                  </div>
                </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDownload(file)}
                            className="text-blue-500 hover:text-blue-700 p-2 rounded-full hover:bg-blue-50 transition-colors"
                            title="Descargar archivo"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(file)}
                            className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors"
                            title="Eliminar archivo"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                    </div>
                  </div>
                    ))}
                </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <p>No hay documentos adjuntos</p>
                    <p className="text-sm">Debug: attachedFiles = {JSON.stringify(attachedFiles)}</p>
                    </div>
                )}
              </div>
            </div>
          ) : (
            // Modul de editare
            <>
              {/* Success Message */}
              {successMessage && (
                <div className={`p-4 rounded-lg ${
                  successMessage.startsWith('✅') 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                    {successMessage}
                </div>
              )}

              {/* File Upload Zone */}
              <div className="space-y-4">
              <div
                ref={dropZoneRef}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                  <div className="text-gray-600">
                    <div className="text-lg mb-2">📁</div>
                    <p className="text-lg font-medium">
                      Arrastra aquí los ficheros a subir o haz click para buscarlos
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                    (Tamaño máximo: 30MBytes)
                    </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
              />
              </div>

              {/* Selected Files */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">Archivos seleccionados:</h4>
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                          📄
                        </div>
                        <div>
                          <div className="font-medium text-sm">{file.name}</div>
                          <div className="text-xs text-gray-500">
                            {file.size} • {file.type}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(file.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Description Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción:
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  placeholder="Descripción opcional de los archivos..."
                />
              </div>

              {/* Attached Documents */}
              <div className="pt-6 border-t border-gray-200">
                <h4 className="font-medium text-gray-700 mb-3">
                  Documentos adjuntos ({attachedFiles.length})
                </h4>
                {loadingFiles ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Cargando documentos...</p>
                  </div>
                ) : attachedFiles.length > 0 ? (
                  <div className="space-y-2">
                    {attachedFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                            📎
                          </div>
                          <div>
                            <div className="font-medium text-sm">{file.name}</div>
                            <div className="text-xs text-gray-500">
                              {file.size} • {file.type} • {file.date}
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDownload(file)}
                            className="text-blue-500 hover:text-blue-700 p-2 rounded-full hover:bg-blue-50 transition-colors"
                            title="Descargar archivo"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(file)}
                            className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors"
                            title="Eliminar archivo"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <p>No hay documentos adjuntos</p>
                    <p className="text-sm">Debug: attachedFiles = {JSON.stringify(attachedFiles)}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 flex-shrink-0">
          {!isViewMode && (
            <Button
                onClick={handleSave}
                disabled={uploading || (files.length === 0 && description.trim() === '')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  ✓ Guardar
                </>
              )}
            </Button>
          )}
          <Button
                onClick={onClose}
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
              >
                ✕ Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FileAttachmentModal;
