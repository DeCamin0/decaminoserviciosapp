import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.decamino.app',
  appName: 'De Camino',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://app.decaminoservicios.com',
    cleartext: false
  }
};

export default config;
