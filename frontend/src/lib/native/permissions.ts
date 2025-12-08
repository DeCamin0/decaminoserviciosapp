import { Camera, CameraPermissionType } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Toast } from '@capacitor/toast';

/**
 * Utilitare pentru cereri de permisiuni runtime native
 * Compatibil cu Capacitor pentru aplicații Android/iOS
 */

export interface PermissionResult {
  granted: boolean;
  message?: string;
}

/**
 * Verifică și solicită permisiunea pentru cameră
 */
export const requestCameraPermission = async (): Promise<PermissionResult> => {
  try {
    // Verifică permisiunea existentă
    const currentPermissions = await Camera.checkPermissions();
    
    if (currentPermissions.camera === 'granted') {
      return { granted: true };
    }

    // Solicită permisiunea dacă nu este acordată
    const result = await Camera.requestPermissions();
    
    if (result.camera === 'granted') {
      return { granted: true };
    } else {
      const message = 'Permiso de cámara denegado. Necesario para capturar fotos de facturas.';
      await Toast.show({
        text: message,
        duration: 'long'
      });
      return { granted: false, message };
    }
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    const message = 'Error al solicitar permiso de cámara';
    await Toast.show({
      text: message,
      duration: 'long'
    });
    return { granted: false, message };
  }
};

/**
 * Verifică și solicită permisiunea pentru geolocație
 */
export const requestLocationPermission = async (): Promise<PermissionResult> => {
  try {
    // Verifică permisiunea existentă
    const currentPermissions = await Geolocation.checkPermissions();
    
    if (currentPermissions.location === 'granted') {
      return { granted: true };
    }

    // Solicită permisiunea dacă nu este acordată
    const result = await Geolocation.requestPermissions();
    
    if (result.location === 'granted') {
      return { granted: true };
    } else {
      const message = 'Permiso de ubicación denegado. Necesario para fichajes con ubicación.';
      await Toast.show({
        text: message,
        duration: 'long'
      });
      return { granted: false, message };
    }
  } catch (error) {
    console.error('Error requesting location permission:', error);
    const message = 'Error al solicitar permiso de ubicación';
    await Toast.show({
      text: message,
      duration: 'long'
    });
    return { granted: false, message };
  }
};

/**
 * Verifică și solicită toate permisiunile necesare pentru aplicație
 */
export const requestAllPermissions = async (): Promise<{
  camera: PermissionResult;
  location: PermissionResult;
  allGranted: boolean;
}> => {
  const cameraResult = await requestCameraPermission();
  const locationResult = await requestLocationPermission();
  
  const allGranted = cameraResult.granted && locationResult.granted;
  
  return {
    camera: cameraResult,
    location: locationResult,
    allGranted
  };
};

/**
 * Verifică doar permisiunile (fără a le solicita)
 */
export const checkAllPermissions = async (): Promise<{
  camera: boolean;
  location: boolean;
  allGranted: boolean;
}> => {
  try {
    const cameraPermissions = await Camera.checkPermissions();
    const locationPermissions = await Geolocation.checkPermissions();
    
    const cameraGranted = cameraPermissions.camera === 'granted';
    const locationGranted = locationPermissions.location === 'granted';
    
    return {
      camera: cameraGranted,
      location: locationGranted,
      allGranted: cameraGranted && locationGranted
    };
  } catch (error) {
    console.error('Error checking permissions:', error);
    return {
      camera: false,
      location: false,
      allGranted: false
    };
  }
};

/**
 * Deschide setările aplicației pentru a permite utilizatorului să acorde permisiuni manual
 */
export const openAppSettings = async (): Promise<void> => {
  try {
    const { App } = await import('@capacitor/app');
    await App.openUrl({ url: 'app-settings:' });
  } catch (error) {
    console.error('Error opening app settings:', error);
    await Toast.show({
      text: 'No se pudo abrir la configuración de la aplicación',
      duration: 'long'
    });
  }
};
