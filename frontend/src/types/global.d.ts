// Declarații globale pentru AutoFirma
declare global {
  interface Window {
    MiniApplet: {
      sign: (data: string, options?: any) => Promise<string>;
      getCertificates: () => Promise<any[]>;
      isAvailable: () => boolean;
    };
    
    // Alte funcții globale AutoFirma
    AutoFirma?: {
      sign: (data: string, options?: any) => Promise<string>;
      getCertificates: () => Promise<any[]>;
      isAvailable: () => boolean;
    };
  }
}

export {};
