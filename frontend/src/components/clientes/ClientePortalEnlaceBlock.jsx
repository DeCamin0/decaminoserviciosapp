import { useState, useEffect, useCallback } from 'react';
import { Card, Button } from '../ui';
import { routes } from '../../utils/routes';
import { buildPortalClienteUrl } from '../../config/env';
import { Link2, QrCode, RefreshCw, Copy } from 'lucide-react';

function authHeaders() {
  const token = localStorage.getItem('auth_token');
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export default function ClientePortalEnlaceBlock({ clienteId }) {
  const [portalToken, setPortalToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const portalUrl = portalToken ? buildPortalClienteUrl(portalToken) : '';

  const ensureToken = useCallback(async (rotate = false) => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(routes.clientePortalInviteToken(clienteId), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ rotate }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || `Error ${res.status}`);
      }
      const tok = json?.data?.token;
      if (!tok) throw new Error('Respuesta sin token');
      setPortalToken(tok);
    } catch (e) {
      setError(e.message || 'No se pudo generar el enlace');
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    ensureToken();
  }, [ensureToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!portalUrl) {
        setQrDataUrl('');
        return;
      }
      try {
        const QRCode = (await import('qrcode')).default;
        const dataUrl = await QRCode.toDataURL(portalUrl, {
          width: 220,
          margin: 1,
          errorCorrectionLevel: 'M',
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setQrDataUrl('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portalUrl]);

  const copy = async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
    } catch {
      window.prompt('Copia este enlace:', portalUrl);
    }
  };

  if (!clienteId) return null;

  return (
    <Card>
      <div className="p-6 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Portal clientes (enlace comunidad)
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => ensureToken(true)}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Nuevo token (invalida QR anterior)
        </Button>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-600">
          Comparte este enlace (o el código QR) con la junta: cada comunidad tiene
          su propia URL. El contacto introduce su email y recibe el código OTP.
        </p>
        {error && (
          <div className="text-sm text-red-700 bg-red-50 rounded px-3 py-2">
            {error}
          </div>
        )}
        {portalUrl && (
          <>
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="shrink-0 rounded-lg border border-gray-200 bg-white p-2">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR portal comunidad" className="w-44 h-44" />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-gray-400 text-sm">
                    <QrCode className="h-10 w-10" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <label className="text-xs font-medium text-gray-500">Enlace</label>
                <p className="text-sm break-all font-mono bg-gray-50 border rounded px-3 py-2">
                  {portalUrl}
                </p>
                <Button type="button" size="sm" variant="outline" onClick={copy}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copiar enlace
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
