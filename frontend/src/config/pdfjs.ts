// Configurare centralizată pentru PDF.js worker (aceeași instanță ca getDocument)
import * as pdfjsLib from 'pdfjs-dist';

const isProduction = import.meta.env.PROD;

/** Asigură workerSrc pe instanța pdfjs folosită de getDocument. */
export function ensurePdfJsWorker(): void {
  if (pdfjsLib.GlobalWorkerOptions.workerSrc) return;

  if (isProduction) {
    // Fișier copiat în dist root cu extensia .js (compatibilitate server)
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  } else {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
  }
}

ensurePdfJsWorker();

export const GlobalWorkerOptions = pdfjsLib.GlobalWorkerOptions;
