// Configurare centralizată pentru PDF.js worker
import { GlobalWorkerOptions } from 'pdfjs-dist';

// Configurare worker pentru PDF.js
// Folosește worker-ul din node_modules pentru development
// și worker-ul din assets pentru producție
const isProduction = import.meta.env.PROD;

// Configurare worker pentru PDF.js
// În development folosim node_modules, în producție folosim fișierul copiat cu .js
if (isProduction) {
  // În producție, folosește fișierul copiat cu extensia .js pentru compatibilitate server
  GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
} else {
  // În development, folosește worker-ul din node_modules
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

export { GlobalWorkerOptions };
