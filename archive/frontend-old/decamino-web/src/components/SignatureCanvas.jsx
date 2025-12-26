import { useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';

const SignatureCanvas = forwardRef(function SignatureCanvas({ onSave, className='' }, ref){
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  
  useEffect(()=>{
    const canvas = canvasRef.current;
    if(!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    function start(e){
      isDrawingRef.current = true;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    
    function draw(e){
      if(!isDrawingRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    
    function stop(){
      isDrawingRef.current = false;
    }
    
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stop);
    canvas.addEventListener('mouseleave', stop);
    
    // Touch events
    canvas.addEventListener('touchstart', (e)=>{
      e.preventDefault();
      start(e.touches[0]);
    });
    canvas.addEventListener('touchmove', (e)=>{
      e.preventDefault();
      draw(e.touches[0]);
    });
    canvas.addEventListener('touchend', (e)=>{
      e.preventDefault();
      stop();
    });
    
    return ()=>{
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stop);
      canvas.removeEventListener('mouseleave', stop);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stop);
    };
  }, []);
  
  const clear = useCallback(()=>{
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);
  
  const save = useCallback(()=>{
    const canvas = canvasRef.current;
    if(!canvas) return;
    const dataURL = canvas.toDataURL('image/png');
    onSave?.(dataURL);
  }, [onSave]);

  const isEmpty = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return true;
    
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Verifică dacă canvas-ul este gol (toate pixelii sunt transparenți)
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i + 3] !== 0) { // Alpha channel
        return false;
      }
    }
    return true;
  }, []);

  const toDataURL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  }, []);

  // Expune metodele pentru ContractSigner
  useImperativeHandle(ref, () => ({
    clear,
    save,
    isEmpty,
    toDataURL
  }), [clear, isEmpty, save, toDataURL]);
  
  return (
    <div className={`border rounded-lg p-4 ${className}`}>
      <canvas
        ref={canvasRef}
        width={400}
        height={200}
        className="border border-gray-300 rounded cursor-crosshair w-full h-48"
        data-focusable="true"
      />
      <div className="flex gap-2 mt-2">
        <button onClick={clear} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
          Limpiar
        </button>
        <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Guardar
        </button>
      </div>
    </div>
  );
});

export default SignatureCanvas;