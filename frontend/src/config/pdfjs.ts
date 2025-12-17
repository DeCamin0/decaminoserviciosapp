// Configurare centralizată pentru PDF.js worker
import { GlobalWorkerOptions } from 'pdfjs-dist';

// Configurare worker pentru PDF.js
// Folosește worker-ul din node_modules pentru development
// și worker-ul din assets pentru producție
const isProduction = import.meta.env.PROD;

// Configurare worker pentru PDF.js
// În development folosim node_modules, în producție folosim fișierul copiat cu .js
// Verifică dacă worker-ul este deja configurat (pentru a evita suprascrierea)
if (!GlobalWorkerOptions.workerSrc) {
  if (isProduction) {
    // În producție, folosește fișierul copiat cu extensia .js pentru compatibilitate server
    GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
    console.log('📄 PDF.js worker configurat pentru producție:', GlobalWorkerOptions.workerSrc);
  } else {
    // În development, folosește worker-ul din node_modules
    GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    console.log('📄 PDF.js worker configurat pentru development:', GlobalWorkerOptions.workerSrc);
  }
}

export { GlobalWorkerOptions };
