import { useRef, useEffect, useState } from 'react';
import SignaturePad from 'signature_pad';

const SignaturePadComponent = ({
  value,
  onChange,
  width = 400,
  height = 200,
  className = '',
}) => {
  const canvasRef = useRef(null);
  const signaturePadRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;

    const signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
    });

    signaturePadRef.current = signaturePad;

    const beginHandler = () => setIsDrawing(true);
    const endHandler = () => {
      setIsDrawing(false);
      setCanUndo(signaturePad._data.length > 0);

      if (!onChangeRef.current) {
        return;
      }

      try {
        const dataURL = signaturePad.toDataURL('image/png');
        onChangeRef.current(dataURL);
      } catch (error) {
        console.error('Error generating signature:', error);
        const dataURL = signaturePad.canvas.toDataURL('image/png');
        onChangeRef.current(dataURL);
      }
    };

    signaturePad.addEventListener('beginStroke', beginHandler);
    signaturePad.addEventListener('endStroke', endHandler);

    return () => {
      signaturePad.removeEventListener('beginStroke', beginHandler);
      signaturePad.removeEventListener('endStroke', endHandler);
    };
  }, [width, height]);

  useEffect(() => {
    if (!signaturePadRef.current) return;

    if (value && value.startsWith('data:image/')) {
      try {
        signaturePadRef.current.fromDataURL(value);
      } catch (error) {
        console.error('Error loading signature value:', error);
        signaturePadRef.current.clear();
      }
    } else if (!value) {
      signaturePadRef.current.clear();
    }

    setCanUndo(signaturePadRef.current._data.length > 0);
  }, [value]);

  const clearSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      setCanUndo(false);
      onChange('');
    }
  };

  const undoSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.undo();
      setCanUndo(signaturePadRef.current._data.length > 0);

      if (!onChangeRef.current) {
        return;
      }

      try {
        const dataURL = signaturePadRef.current.toDataURL('image/png');
        onChangeRef.current(dataURL);
      } catch (error) {
        console.error('Error generating signature on undo:', error);
        const dataURL = signaturePadRef.current.canvas.toDataURL('image/png');
        onChangeRef.current(dataURL);
      }
    }
  };

  return (
    <div className={`signature-pad-container ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">
          Firma digital
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={undoSignature}
            disabled={!canUndo}
            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            title="Deshacer"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={clearSignature}
            className="p-1 text-red-500 hover:text-red-700"
            title="Limpiar firma"
          >
            ✕
          </button>
        </div>
      </div>
      
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          style={{ width, height }}
        />
      </div>
      
      {isDrawing && (
        <p className="text-xs text-gray-500 mt-1">
          Dibujando...
        </p>
      )}
    </div>
  );
};

export default SignaturePadComponent; 