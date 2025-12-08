import { Component } from 'react';
import { error as logError } from '../utils/logger';

/**
 * Error Boundary pentru React
 * Prinde toate erorile de componentă și le gestionează elegant
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0 
    };
  }

  static getDerivedStateFromError() {
    // Actualizează state-ul pentru a afișa UI-ul de eroare
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Filtrat: ignoră erorile specifice Google Maps din bundle-urile vendor (producție)
    const msg = (error && (error.message || error.toString())) || '';
    const stack = (errorInfo && errorInfo.componentStack) || '';
    const isGoogleMapsVendorError =
      msg.includes('google is not defined') ||
      stack.includes('google is not defined') ||
      (msg.includes('Cannot read properties of undefined') && (msg.includes("'CJ'") || msg.includes("'get'"))) ||
      (stack.includes('Cannot read properties of undefined') && (stack.includes("'CJ'") || stack.includes("'get'")));

    if (isGoogleMapsVendorError) {
      console.warn('⚠️ Ignoring Google Maps vendor error in ErrorBoundary');
      return; // nu seta starea de eroare pentru a evita ecranul de eroare
    }

    // Loghează eroarea pentru debugging
    logError('ErrorBoundary caught an error:', error);
    logError('Error info:', errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Loghează eroarea la serviciul de monitoring (dacă există)
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error, errorInfo) => {
    // Aici poți adăuga logarea la servicii externe (Sentry, LogRocket, etc.)
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Log local pentru debugging
    console.error('🚨 ErrorBoundary Error:', errorData);
  };

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // UI-ul de eroare personalizat
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">
              ¡Oops! Algo salió mal
            </h2>
            
            <p className="text-gray-600 text-center mb-6">
              La aplicación encontró un error inesperado. Disculpa las molestias.
            </p>

            {this.state.retryCount < 3 && (
              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Intentar de nuevo
                </button>
                
                <button
                  onClick={this.handleReload}
                  className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Recargar página
                </button>
              </div>
            )}

            {this.state.retryCount >= 3 && (
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  Hemos intentado reparar el problema, pero no ha funcionado.
                </p>
                <button
                  onClick={this.handleReload}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Recargar aplicación
                </button>
              </div>
            )}

            {/* Debug info pentru dezvoltare */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-4 p-3 bg-gray-100 rounded text-xs">
                <summary className="cursor-pointer font-medium">Debug Info</summary>
                <pre className="mt-2 whitespace-pre-wrap text-gray-700">
                  {this.state.error.toString()}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
