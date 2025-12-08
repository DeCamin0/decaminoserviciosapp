import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
  showDownload?: boolean;
}

export const QRCodeComponent: React.FC<QRCodeProps> = ({
  value,
  size = 128,
  className = '',
  showDownload = false,
}) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    }).catch((err) => {
      console.error('Eroare la generarea QR code:', err);
    });
  }, [value, size]);

  const downloadQR = () => {
    if (!canvasRef.current) return;

    const link = document.createElement('a');
    link.download = `qr-${value}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  if (!value) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`} style={{ width: size, height: size }}>
        <span className="text-gray-500 text-sm">{t('message.noQrData')}</span>
      </div>
    );
  }

  return (
    <div className={`qr-code-container ${className}`}>
      <canvas
        ref={canvasRef}
        className="border border-gray-200 rounded-lg"
        style={{ width: size, height: size }}
      />
      
      {showDownload && (
        <button
          type="button"
          onClick={downloadQR}
          className="mt-2 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
        >
          <Download size={14} />
          {t('button.downloadQr')}
        </button>
      )}
    </div>
  );
}; 