// Error handler pentru a gestiona erorile de extensii de browser și alte probleme

export const handleBrowserExtensionErrors = () => {
  // Interceptează erorile de extensii de browser
  window.addEventListener('error', (event) => {
    // Verifică dacă eroarea vine de la o extensie de browser
    if (event.error && event.error.message) {
      const errorMessage = event.error.message.toLowerCase();
      
      // Erori comune de extensii de browser
      if (errorMessage.includes('could not establish connection') ||
          errorMessage.includes('receiving end does not exist') ||
          errorMessage.includes('extension context invalidated')) {
        
        console.warn('⚠️ Eroare de extensie de browser ignorată:', event.error.message);
        event.preventDefault(); // Previne afișarea erorii în console
        return false;
      }
    }
  });

  // Interceptează promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message) {
      const errorMessage = event.reason.message.toLowerCase();
      
      // Erori comune de extensii de browser
      if (errorMessage.includes('could not establish connection') ||
          errorMessage.includes('receiving end does not exist') ||
          errorMessage.includes('extension context invalidated')) {
        
        console.warn('⚠️ Promise rejection de extensie de browser ignorată:', event.reason.message);
        event.preventDefault(); // Previne afișarea erorii în console
        return false;
      }
    }
  });
};

// Funcție pentru a verifica dacă o eroare este de la o extensie
export const isBrowserExtensionError = (error) => {
  if (!error || !error.message) return false;
  
  const errorMessage = error.message.toLowerCase();
  return errorMessage.includes('could not establish connection') ||
         errorMessage.includes('receiving end does not exist') ||
         errorMessage.includes('extension context invalidated') ||
         errorMessage.includes('chrome-extension://') ||
         errorMessage.includes('moz-extension://');
};

// Funcție pentru a loga erorile în mod controlat
export const logError = (error, context = '') => {
  if (isBrowserExtensionError(error)) {
    console.warn(`⚠️ Eroare de extensie de browser ignorată${context ? ` (${context})` : ''}:`, error.message);
    return;
  }
  
  console.error(`❌ Eroare${context ? ` (${context})` : ''}:`, error);
};
