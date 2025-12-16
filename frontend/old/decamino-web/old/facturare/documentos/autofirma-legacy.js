/* eslint-disable */

/**
 * Arhivă: fluxurile AutoFirma eliminate din `src/pages/DocumentosPage.jsx`.
 * Codul de mai jos NU este folosit în aplicația actuală. Este păstrat doar
 * ca referință pentru evoluția integrării AutoFirma.
 */

// --- handleViewOriginalPDF (legacy) ---
/*
const handleViewOriginalPDF = async ({
  autofirmaSessionId,
  autofirmaToken,
  setNotification,
  setAutofirmaToken,
  setAutofirmaSessionId
}) => {
  if (!autofirmaSessionId || !autofirmaToken) {
    setNotification({
      type: 'error',
      title: 'Error',
      message: 'No hay datos disponibles para visualizar el PDF original. Por favor, firma primero el documento con AutoFirma.'
    });
    return;
  }

  try {
    const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://n8n.decaminoservicios.com');
    const pdfUrl = `${baseUrl}/webhook-test/sign/autofirma/file?sid=${autofirmaSessionId}&token=${encodeURIComponent(autofirmaToken)}`;

    const response = await fetch(pdfUrl, { method: 'HEAD' });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        setAutofirmaToken(null);
        setAutofirmaSessionId(null);
        setNotification({
          type: 'error',
          title: 'Token expirado',
          message: 'El token para el PDF original ha expirado. Por favor, firma nuevamente el documento con AutoFirma.'
        });
        return;
      } else if (response.status === 404) {
        setNotification({
          type: 'error',
          title: 'PDF no encontrado',
          message: 'El PDF original no fue encontrado. Por favor, firma nuevamente el documento con AutoFirma.'
        });
        return;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    window.open(pdfUrl, '_blank');

  } catch (error) {
    console.error('❌ Error al verificar el PDF original:', error);

    if (error.message.includes('401') || error.message.includes('403')) {
      setAutofirmaToken(null);
      setAutofirmaSessionId(null);
      setNotification({
        type: 'error',
        title: 'Token expirado',
        message: 'El token para el PDF original ha expirado. Por favor, firma nuevamente el documento con AutoFirma.'
      });
    } else if (error.message.includes('404')) {
      setNotification({
        type: 'error',
        title: 'PDF no encontrado',
        message: 'El PDF original no fue encontrado. Por favor, firma nuevamente el documento con AutoFirma.'
      });
    } else {
      setNotification({
        type: 'error',
        title: 'Error de conexión',
        message: 'No se pudo acceder al PDF original. Verifica la conexión a internet e intenta de nuevo.'
      });
    }
  }
};
*/

// --- checkAutoFirmaInstallation & openAutoFirmaInIframe (legacy) ---
/*
const checkAutoFirmaInstallation = async () => {
  try {
    const testUrl = 'afirma://test';
    const testWindow = window.open(testUrl, '_blank');

    if (testWindow) {
      testWindow.close();
      return true;
    }

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = testUrl;
    document.body.appendChild(iframe);

    await new Promise(resolve => setTimeout(resolve, 100));
    const isInstalled = iframe.contentWindow !== null;
    document.body.removeChild(iframe);
    return isInstalled;
  } catch (error) {
    console.log('🔍 Error al verificar AutoFirma:', error);
    return true;
  }
};

const openAutoFirmaInIframe = ({
  pdfBase64,
  fileName,
  documentId,
  employeeId,
  setNotification
}) => {
  const existingModals = document.querySelectorAll('[data-autofirma-modal]');
  existingModals.forEach(modal => modal.remove());

  const modal = document.createElement('div');
  modal.setAttribute('data-autofirma-modal', 'true');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  const iframe = document.createElement('iframe');
  iframe.src = '/autofirma.html';
  iframe.style.cssText = `
    width: 90%;
    height: 90%;
    border: none;
    border-radius: 10px;
    background: white;
  `;

  const closeButton = document.createElement('button');
  closeButton.innerHTML = '✕';
  closeButton.style.cssText = `
    position: absolute;
    top: 20px;
    right: 20px;
    background: #ff4444;
    color: white;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    font-size: 20px;
    cursor: pointer;
    z-index: 10001;
  `;

  modal.appendChild(iframe);
  modal.appendChild(closeButton);
  document.body.appendChild(modal);

  const closeModal = () => {
    if (modal && modal.parentNode) {
      document.body.removeChild(modal);
    }
    window.removeEventListener('message', handleMessage);
  };

  closeButton.onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  iframe.onload = () => {
    iframe.contentWindow.postMessage({
      type: 'SEMNEAZA_PDF',
      base64: pdfBase64,
      fileName,
      documentId,
      employeeId
    }, '*');
  };

  const handleMessage = (event) => {
    if (event.data?.type === 'OPEN_AUTOFIRMA') {
      closeModal();
      window.location.href = event.data.url;
      return;
    }

    if (event.data?.type === 'PDF_SEMNAT') {
      const base64Semnat = event.data.base64;
      const fileNameSemnat = event.data.fileName;

      const byteCharacters = atob(base64Semnat);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileNameSemnat ? fileNameSemnat.replace('.pdf', '_SIGNED.pdf') : 'Document_Semnat.pdf';
      a.click();
      URL.revokeObjectURL(url);

      closeModal();
      window.removeEventListener('message', handleMessage);

      setNotification?.({
        type: 'success',
        title: 'Documento firmado con éxito!',
        message: 'El documento ha sido firmado y descargado con éxito.'
      });
    }
  };

  window.addEventListener('message', handleMessage);

  setNotification?.({
    type: 'info',
    title: '🚀 AutoFirma se está abriendo...',
    message: 'La aplicación AutoFirma se está lanzando para firmar el documento. Por favor, espera unos segundos.',
    duration: 5000
  });
};
*/

// --- handleOpenAutoFirmaFallback (legacy) ---
/*
const handleOpenAutoFirmaFallback = ({ autoFirmaUrl }) => {
  if (!autoFirmaUrl) {
    console.error('❌ No hay URL AutoFirma disponible');
    return;
  }

  try {
    const newWindow = window.open(autoFirmaUrl, '_blank');

    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      window.location.href = autoFirmaUrl;
    }
  } catch (error) {
    console.error('❌ Error al abrir AutoFirma:', error);

    const shouldCopy = confirm(
      'No se pudo abrir AutoFirma automáticamente.\n\n' +
      'El URL para AutoFirma es:\n' + autoFirmaUrl + '\n\n' +
      '¿Quieres copiar el URL al clipboard?'
    );

    if (shouldCopy) {
      navigator.clipboard.writeText(autoFirmaUrl).catch(() => {
        alert('No se pudo copiar el URL. Por favor, cópialo manualmente:\n' + autoFirmaUrl);
      });
    }
  }
};
*/

// --- handleSignAutoFirmaOriginal (legacy) ---
/*
const handleSignAutoFirmaOriginal = async ({ documento, authUser, routes, setNotification, handleSignAutoFirma }) => {
  try {
    if (!documento.fileName?.toLowerCase().endsWith('.pdf')) {
      setNotification({
        type: 'error',
        title: 'Error AutoFirma',
        message: 'Solo se pueden firmar documentos PDF'
      });
      return;
    }

    const downloadUrl = `${routes.downloadDocumentoOficial}?id=${documento.id}&documentId=${documento.doc_id}&email=${encodeURIComponent(authUser?.email || authUser?.['CORREO ELECTRONICO'] || '')}&fileName=${encodeURIComponent(documento.fileName || '')}`;
    const pdfResponse = await fetch(downloadUrl);

    if (!pdfResponse.ok) {
      throw new Error(`Error al descargar PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }

    const blob = await pdfResponse.blob();
    if (blob.size === 0) {
      throw new Error('El archivo PDF está vacío o no se pudo cargar');
    }

    const pdfFile = new File([blob], documento.fileName || 'documento.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', pdfFile);
    formData.append('documentId', documento.doc_id || documento.id);
    formData.append('employeeId', authUser?.CODIGO || authUser?.id);
    formData.append('reason', `Firma ${documento.tipo || 'documento oficial'}`);

    await handleSignAutoFirma(formData, documento);

  } catch (error) {
    console.error('❌ Error al firmar AutoFirma:', error);
    setNotification({
      type: 'error',
      title: 'Error de Firma',
      message: 'No se pudo abrir AutoFirma. Por favor, intenta de nuevo.'
    });
  }
};
*/

// --- handleGuardarDocumentoSemnat (legacy) ---
/*
const handleGuardarDocumentoSemnat = async ({
  previewDocument,
  email,
  authUser,
  routes,
  setNotification,
  handleClosePreview,
  fetchDocumentosOficiales
}) => {
  try {
    if (!previewDocument) {
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'No hay documento para guardar'
      });
      return;
    }

    setNotification({
      type: 'info',
      title: 'Guardando...',
      message: 'Guardando documento semnat en la base de datos...'
    });

    const formData = new FormData();
    formData.append('documento_id', previewDocument.id);
    formData.append('nombre_archivo', previewDocument.fileName);
    formData.append('tipo_documento', `${previewDocument.tipo} firmado`);
    formData.append('email_usuario', email);
    formData.append('fecha_firma', new Date().toISOString());
    formData.append('estado', 'firmado');
    formData.append('usuario_firma', authUser?.['NOMBRE / APELLIDOS'] || authUser?.name || 'Usuario');

    if (previewDocument.previewUrl) {
      const fileResponse = await fetch(previewDocument.previewUrl);
      if (fileResponse.ok) {
        const blob = await fileResponse.blob();
        const file = new File([blob], previewDocument.fileName, { type: blob.type || 'application/octet-stream' });
        formData.append('archivo', file);
      }
    }

    const response = await fetch(routes.guardarDocumentoSemnat, {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Documento semnat guardado:', result);

      setNotification({
        type: 'success',
        title: 'Documento Guardado',
        message: 'Documento semnat guardado exitosamente en la base de datos'
      });

      handleClosePreview();
      fetchDocumentosOficiales();
    }
  } catch (error) {
    console.error('❌ Error guardando documento semnat:', error);
    setNotification({
      type: 'error',
      title: 'Error al Guardar',
      message: 'No se pudo guardar el documento semnat en la base de datos'
    });
  }
};
*/
