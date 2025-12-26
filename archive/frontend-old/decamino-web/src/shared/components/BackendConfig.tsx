import React, { useState, useEffect } from 'react';
import { testBackendConnection, getBackendUrl } from '../utils/api';

export const BackendConfig: React.FC = () => {
  const [backendUrl, setBackendUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setBackendUrl(getBackendUrl());
  }, []);

  const handleTestConnection = async () => {
    setIsLoading(true);
    setIsConnected(false);
    setError('');
    
    try {
      const isConnected = await testBackendConnection();
      setIsConnected(isConnected);
      if (!isConnected) {
        setError('Conexiune eșuată');
      }
    } catch (err) {
      setIsConnected(false);
      setError('Eroare la testarea conexiunii');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Configurare Backend</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            URL Backend
          </label>
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="/api"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleTestConnection}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Se testează...' : 'Testează conexiunea'}
          </button>

          {isConnected !== null && (
            <div className="flex items-center gap-2">
              {isConnected ? (
                <span className="text-green-600">✓ Conectat</span>
              ) : (
                <span className="text-red-600">✗ Nu se poate conecta</span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-red-800 mb-2">
              Probleme de conectivitate
            </h4>
            <p className="text-sm text-red-700">{error}</p>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• Verifică dacă serverul backend rulează</li>
              <li>• Verifică URL-ul backend-ului</li>
              <li>• Verifică configurația CORS</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}; 