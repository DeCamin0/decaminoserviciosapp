// Type definitions for Vite environment variables
declare global {
  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface ApiResponse<T> {
  data: T;
  status: number;
  ok: boolean;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any,
    public isCorsError?: boolean
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Adaugă token de autentificare dacă există
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${token}`,
    };
  }

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: 'Eroare de rețea' };
      }
      
      throw new ApiError(
        errorData.message || `Eroare ${response.status}`,
        response.status,
        errorData
      );
    }

    let data: T;
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else if (contentType?.includes('application/pdf')) {
      // Pentru PDF-uri, returnăm blob-ul
      const blob = await response.blob();
      data = blob as unknown as T;
    } else {
      data = await response.text() as unknown as T;
    }

    return {
      data,
      status: response.status,
      ok: response.ok,
    };
  } catch (error) {
    // Verifică dacă este o eroare CORS
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new ApiError(
        'Eroare CORS: Serverul nu permite cereri de la această origine. Verifică configurația backend-ului.',
        0,
        null,
        true
      );
    }
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      error instanceof Error ? error.message : 'Eroare de rețea',
      0
    );
  }
}

// Funcție pentru a testa conectivitatea la backend
export const testBackendConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
};

// Funcție pentru a obține URL-ul backend-ului
export const getBackendUrl = (): string => {
  return API_BASE_URL;
};

export const api = {
  get: <T>(endpoint: string) => apiRequest<T>(endpoint),
  
  post: <T>(endpoint: string, data?: any) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
    
  put: <T>(endpoint: string, data?: any) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),
    
  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, {
      method: 'DELETE',
    }),
};

export { ApiError }; 