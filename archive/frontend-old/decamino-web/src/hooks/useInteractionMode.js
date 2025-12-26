import { useEffect, useState } from 'react';

export function useInteractionMode(){
  const [mode,setMode] = useState('desktop');
  
  useEffect(()=>{
    const d = document.documentElement;
    
    function apply(){
      const m = window.matchMedia('(hover: none) and (pointer: fine)').matches ? 'tv'
        : window.matchMedia('(hover: none) and (pointer: coarse)').matches ? 'touch'
        : 'desktop';
      setMode(m); 
      d.setAttribute('data-mode', m);
    }
    
    apply();
    
    const a = [
      window.matchMedia('(hover: none) and (pointer: fine)'),
      window.matchMedia('(hover: none) and (pointer: coarse)')
    ];
    
    a.forEach(x=>x.addEventListener('change', apply));
    return ()=>a.forEach(x=>x.removeEventListener('change', apply));
  },[]);
  
  return mode;
}
