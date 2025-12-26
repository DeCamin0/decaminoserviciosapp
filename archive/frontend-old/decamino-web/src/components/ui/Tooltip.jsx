import { useState } from 'react';
import { useInteractionMode } from '@/hooks/useInteractionMode';

export function Tooltip({ trigger, content }){
  const mode = useInteractionMode();
  const [open,setOpen] = useState(false);
  const isHover = mode === 'desktop';
  
  return (
    <span className="relative inline-block">
      <span
        onMouseEnter={isHover ? ()=>setOpen(true) : undefined}
        onMouseLeave={isHover ? ()=>setOpen(false) : undefined}
        onClick={!isHover ? ()=>setOpen(v=>!v) : undefined}
        className={isHover ? '' : 'hit-44'}
        role="button"
        aria-haspopup="dialog"
        aria-expanded={open}
      >{trigger}</span>
      
      {open && (
        <span className="absolute z-50 mt-2 max-w-xs rounded-lg bg-slate-900 text-white p-2 text-sm shadow-lg">
          {content}
        </span>
      )}
    </span>
  );
}
