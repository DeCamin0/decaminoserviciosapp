import { useEffect } from 'react';

const DIR = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' };

function center(el){ 
  const r = el.getBoundingClientRect(); 
  return { x: r.left + r.width/2, y: r.top + r.height/2 }; 
}

function inDir(from, to, dir){
  const dx = to.x - from.x, dy = to.y - from.y;
  if (dir==='left') return dx < 0 && Math.abs(dx) > Math.abs(dy);
  if (dir==='right') return dx > 0 && Math.abs(dx) > Math.abs(dy);
  if (dir==='up') return dy < 0 && Math.abs(dy) > Math.abs(dx);
  if (dir==='down') return dy > 0 && Math.abs(dy) > Math.abs(dx);
}

export function useSpatialNavigation(containerRef, { onBack }={}){
  useEffect(()=>{
    const el = containerRef?.current; 
    if(!el) return;
    
    function focusables(){ 
      return Array.from(el.querySelectorAll('[data-focusable="true"]:not([disabled])')); 
    }
    
    function keydown(e){
      if (e.key in DIR){
        e.preventDefault();
        const items = focusables(); 
        if(!items.length) return;
        
        const current = document.activeElement && el.contains(document.activeElement) ? document.activeElement : items[0];
        const from = center(current);
        const dir = DIR[e.key];
        
        const candidates = items.filter(x=>x!==current).map(x=>({ el:x, c:center(x) }))
          .filter(({c})=>inDir(from, c, dir))
          .sort((a,b)=>{
            const da = Math.hypot(a.c.x-from.x, a.c.y-from.y);
            const db = Math.hypot(b.c.x-from.x, b.c.y-from.y);
            return da - db;
          });
        
        (candidates[0]?.el || items[0]).focus();
      } else if (e.key === 'Enter') {
        e.preventDefault(); 
        document.activeElement?.click?.();
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        onBack?.();
      }
    }
    
    el.addEventListener('keydown', keydown);
    return ()=>el.removeEventListener('keydown', keydown);
  }, [containerRef, onBack]);
}
