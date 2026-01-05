// Declarații globale pentru AutoFirma
declare global {
  interface Window {
    MiniApplet: {
      sign: (data: string, options?: unknown) => Promise<string>;
      getCertificates: () => Promise<unknown[]>;
      isAvailable: () => boolean;
    };
    
    // Alte funcții globale AutoFirma
    AutoFirma?: {
      sign: (data: string, options?: unknown) => Promise<string>;
      getCertificates: () => Promise<unknown[]>;
      isAvailable: () => boolean;
    };
  }
}

export {};
