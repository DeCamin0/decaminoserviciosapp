import React, { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { useTranslation } from 'react-i18next';
import { RotateCcw, X } from 'lucide-react';

interface SignaturePadProps {
  onChange: (signature: string | null) => void;
  className?: string;
  width?: number;
  height?: number;
}

// Extend SignaturePad type to include missing methods
interface ExtendedSignaturePad extends SignaturePad {
  undo(): void;
  canUndo(): boolean;
}

export const SignaturePadComponent: React.FC<SignaturePadProps> = ({
  onChange,
  className = '',
  width = 400,
  height = 200,
}) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<ExtendedSignaturePad | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
    }) as ExtendedSignaturePad;

    signaturePadRef.current = signaturePad;

    // Event listeners
    signaturePad.addEventListener('beginStroke', () => setIsDrawing(true));
    signaturePad.addEventListener('endStroke', () => {
      setIsDrawing(false);
      setCanUndo(signaturePad.isEmpty() === false);
      
      // ✅ Folosește canvas.toDataURL pentru generarea semnăturii
      try {
        const dataURL = signaturePad.toDataURL('image/png');
        onChange(dataURL);
      } catch (error) {
        console.error('Error generating signature:', error);
        // Fallback la canvas direct dacă signaturePad.toDataURL eșuează
        const canvas = canvasRef.current;
        if (canvas) {
          const dataURL = canvas.toDataURL('image/png');
          onChange(dataURL);
        }
      }
    });

    return () => {
      signaturePad.off();
    };
  }, [onChange]);

  const clearSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      setCanUndo(false);
      onChange(null);
    }
  };

  const undoSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.undo();
      setCanUndo(signaturePadRef.current.isEmpty() === false);
      
      // ✅ Folosește canvas.toDataURL pentru generarea semnăturii
      try {
        const dataURL = signaturePadRef.current.toDataURL('image/png');
        onChange(dataURL);
      } catch (error) {
        console.error('Error generating signature on undo:', error);
        // Fallback la canvas direct
        const canvas = canvasRef.current;
        if (canvas) {
          const dataURL = canvas.toDataURL('image/png');
          onChange(dataURL);
        }
      }
    }
  };

  return (
    <div className={`signature-pad-container ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600">
          {isDrawing ? t('message.drawing') : t('form.signature')}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={undoSignature}
            disabled={!canUndo}
            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            title={t('button.undo')}
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            onClick={clearSignature}
            className="p-1 text-gray-500 hover:text-gray-700"
            title={t('button.clearSignature')}
          >
            <X size={16} />
          </button>
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        className="border border-gray-300 rounded-lg cursor-crosshair"
        style={{ width, height }}
      />
    </div>
  );
}; 