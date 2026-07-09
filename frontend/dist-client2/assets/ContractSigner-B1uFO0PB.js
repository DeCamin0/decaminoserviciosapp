import{r as s,j as e}from"./react-core-BVV8QP4a.js";import{g as De,P as _e}from"./pdf-libs-RUzN8l4o.js";import{c as Re,G as Oe,r as Fe}from"./index-B8LWpFZz.js";const Le=s.forwardRef(function({onSave:y,className:j=""},U){const S=s.useRef(null),L=s.useRef(!1);s.useEffect(()=>{const r=S.current;if(!r)return;const l=r.getContext("2d",{willReadFrequently:!0});l.strokeStyle="#000",l.lineWidth=2,l.lineCap="round";function N(g){L.current=!0;const D=r.getBoundingClientRect(),I=g.clientX-D.left,_=g.clientY-D.top;l.beginPath(),l.moveTo(I,_)}function C(g){if(!L.current)return;const D=r.getBoundingClientRect(),I=g.clientX-D.left,_=g.clientY-D.top;l.lineTo(I,_),l.stroke()}function o(){L.current=!1}r.addEventListener("mousedown",N),r.addEventListener("mousemove",C),r.addEventListener("mouseup",o),r.addEventListener("mouseleave",o);const V=g=>{g.preventDefault(),N(g.touches[0])},E=g=>{g.preventDefault(),C(g.touches[0])},J=g=>{g.preventDefault(),o()};return r.addEventListener("touchstart",V,{passive:!1}),r.addEventListener("touchmove",E,{passive:!1}),r.addEventListener("touchend",J,{passive:!1}),()=>{r.removeEventListener("mousedown",N),r.removeEventListener("mousemove",C),r.removeEventListener("mouseup",o),r.removeEventListener("mouseleave",o),r.removeEventListener("touchstart",V,{passive:!1}),r.removeEventListener("touchmove",E,{passive:!1}),r.removeEventListener("touchend",J,{passive:!1})}},[]);const A=s.useCallback(()=>{const r=S.current;if(!r)return;r.getContext("2d").clearRect(0,0,r.width,r.height)},[]),M=s.useCallback(()=>{const r=S.current;if(!r)return;const l=r.toDataURL("image/png");y?.(l)},[y]),z=s.useCallback(()=>{const r=S.current;if(!r)return!0;const N=r.getContext("2d").getImageData(0,0,r.width,r.height);for(let C=0;C<N.data.length;C+=4)if(N.data[C+3]!==0)return!1;return!0},[]),B=s.useCallback(()=>{const r=S.current;return r?r.toDataURL("image/png"):""},[]);return s.useImperativeHandle(U,()=>({clear:A,save:M,isEmpty:z,toDataURL:B}),[A,z,M,B]),e.jsxs("div",{className:`border rounded-lg p-4 ${j}`,children:[e.jsx("canvas",{ref:S,width:300,height:150,className:"border border-gray-300 rounded cursor-crosshair w-full h-36","data-focusable":"true"}),e.jsxs("div",{className:"flex gap-2 mt-2",children:[e.jsx("button",{onClick:A,className:"px-4 py-2 bg-gray-200 rounded hover:bg-gray-300",children:"Limpiar"}),e.jsx("button",{onClick:M,className:"px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700",children:"Guardar"})]})]})}),Ae=`
  .dlg {
    position: fixed;
    inset: 5vh 2.5vw;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,.2);
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    z-index: 1000;
  }

  .dlg__header {
    flex: 0 0 auto;
    padding: 0;
    border-bottom: none;
    background: linear-gradient(to right, #dbeafe, #bfdbfe);
    position: relative;
    z-index: 1001; /* Deasupra canvas-ului PDF */
  }

  .dlg__body {
    flex: 1 1 auto;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 12px;
    scroll-behavior: smooth;
    max-width: 100%;
    box-sizing: border-box;
  }

  .dlg__footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    border-top: 1px solid #eee;
    padding: 12px 16px;
    display: flex;
    gap: 8px;
    z-index: 1001;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
  }
  
  /* Optimizări mobile pentru footer */
  @media (max-width: 768px) {
    .dlg__footer {
      padding: 16px 12px;
      gap: 12px;
      flex-direction: column;
      /* Ascunde footer-ul pe mobil pentru a nu interfera cu preview-ul */
      display: none;
    }
    
    .dlg__footer button {
      width: 100%;
      padding: 16px 20px !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      border-radius: 12px !important;
      min-height: 48px;
    }
    
    .dlg__body {
      /* Nu mai avem nevoie de padding-bottom pentru footer pe mobil */
      padding-bottom: 16px;
      -webkit-overflow-scrolling: touch; /* Smooth scroll pe iOS */
    }
    
    /* PDF Viewer pe mobil - înălțime flexibilă */
    @media (max-width: 768px) {
      .pdf-canvas-container {
        max-height: calc(100vh - 200px) !important; /* Mai mult spațiu pentru preview pe mobil */
        overflow-x: hidden !important;
        overflow-y: auto !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
    }
    
    /* PDF Viewer pe desktop - înălțime mai mare */
    @media (min-width: 769px) {
      .pdf-canvas-container {
        max-height: 70vh !important;
        overflow-x: hidden;
        overflow-y: auto;
        max-width: 100%;
        box-sizing: border-box;
      }
    }
    
    /* Buton fixat pentru a afișa/ascunde footer-ul pe mobil */
    .mobile-footer-toggle {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1002;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(to bottom right, #3b82f6, #2563eb);
      color: white;
      border: none;
      box-shadow: 0 4px 20px rgba(59, 130, 246, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .mobile-footer-toggle:active {
      transform: scale(0.95);
    }
    
    /* Când footer-ul este vizibil, afișează-l */
    .dlg__footer.mobile-visible {
      display: flex !important;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 1003;
      background: #fff;
      border-top: 2px solid #e5e7eb;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
    }
    
    .dlg__footer.mobile-visible ~ .dlg__body {
      padding-bottom: 180px;
    }
  }
  
  /* Pentru tablete */
  @media (min-width: 769px) and (max-width: 1024px) {
    .dlg__footer {
      padding: 14px 20px;
      gap: 10px;
    }
    
    .dlg__footer button {
      padding: 14px 24px !important;
      font-size: 15px !important;
      min-height: 44px;
    }
  }

  .support-bubble { z-index: 900; }
`;function $e({pdfUrl:$,docId:y,originalFileName:j,onClose:U,onSignComplete:S,empleadoId:L=null,empleadoEmail:A=null,empleadoNombre:M=null,documentoDocId:z=null,updateExisting:B=!1,tipoDocumento:r=null}){const{user:l}=Re(),[N,C]=s.useState(null),[o,V]=s.useState(1),[E,J]=s.useState(0),[g,D]=s.useState(1),[I,_]=s.useState(!0),[ae,ne]=s.useState(null),[i,se]=s.useState({}),[d,W]=s.useState(!1),[f,H]=s.useState(null),[oe,be]=s.useState({x:0,y:0}),[Z,ve]=s.useState(!1),T=s.useRef(null),R=s.useRef(null),b=s.useRef(null),ie=s.useCallback((a,t)=>{if(!t||!t.dataUrl)return;const n=new Image;n.onload=()=>{try{a.drawImage(n,t.x,t.y,t.width,t.height)}catch(c){console.error("Error drawing signature:",c)}},n.onerror=()=>{console.error("Error loading signature image")},n.src=t.dataUrl},[]),we=s.useCallback(a=>{if(!d)return;const t=T.current;if(!t)return;const n=t.getBoundingClientRect(),c=a.clientX-n.left,u=a.clientY-n.top;be({x:c,y:u})},[d]);s.useEffect(()=>{$&&(async()=>{try{_(!0),ne(null);const n=await De($).promise;C(n),J(n.numPages),_(!1)}catch(t){console.error("Error loading PDF:",t),ne("No se pudo cargar el PDF"),_(!1)}})()},[$]),s.useEffect(()=>((async()=>{if(!(!N||!T.current))try{if(b.current){try{b.current.cancel()}catch{}b.current=null}const t=await N.getPage(o),n=T.current;if(!n)return;const c=n.getContext("2d");if(!c)return;const u=n.closest(".pdf-canvas-container");let p=g;if(u){const h=u.getBoundingClientRect().width-32,X=t.getViewport({scale:1}).width,Y=h/X;p=Math.min(g,Y)}const m=t.getViewport({scale:p});if(n.height=m.height,n.width=m.width,c.clearRect(0,0,n.width,n.height),b.current){try{b.current.cancel(),await new Promise(v=>setTimeout(v,10))}catch{}b.current=null}const x={canvasContext:c,viewport:m};b.current=t.render(x);try{await b.current.promise}catch(v){if(v.name!=="RenderingCancelled"&&v.name!=="RenderingCancelledException")throw v}i[o]&&ie(c,i[o]),b.current=null}catch(t){t.name!=="RenderingCancelled"&&t.name!=="RenderingCancelledException"&&console.error("Error rendering page:",t),b.current=null}})(),()=>{if(b.current){try{b.current.cancel()}catch{}b.current=null}}),[N,o,g,i,ie]);const K=s.useCallback(()=>{R.current?.clear()},[]),ye=s.useCallback(()=>{if(!R.current||R.current.isEmpty()){alert("Por favor, dibuja una firma primero");return}const a=R.current.toDataURL();H({dataUrl:a,width:200,height:100}),W(!0),R.current.clear()},[]),je=s.useCallback(a=>{const t=a.target.files?.[0];if(!t)return;if(!t.type.startsWith("image/")){alert("Por favor, selecciona un archivo de imagen");return}const n=new FileReader;n.onload=c=>{const u=c.target.result,p=new Image;p.onload=()=>{let m=p.width,x=p.height;const v=200,h=100;if(m>v||x>h){const k=Math.min(v/m,h/x);m=m*k,x=x*k}H({dataUrl:u,width:m,height:x}),W(!0)},p.onerror=()=>{alert("Error al cargar la imagen")},p.src=u},n.onerror=()=>{alert("Error al leer el archivo")},n.readAsDataURL(t),a.target.value=""},[]),Ne=s.useCallback(a=>{if(!d||!f)return;const t=T.current;if(!t)return;const n=t.getBoundingClientRect(),c=a.clientX-n.left,u=a.clientY-n.top,p=t.width,m=t.height,x=n.width,v=n.height,h=p/x,k=m/v,X=c*h-f.width*h/2,Y=u*k-f.height*k/2,Q={dataUrl:f.dataUrl,x:X,y:Y,width:f.width*h,height:f.height*k};se(G=>({...G,[o]:Q})),H(null),W(!1)},[d,f,o]),Ce=s.useCallback(()=>{i[o]&&(W(!0),H({dataUrl:i[o].dataUrl,width:i[o].width,height:i[o].height}))},[i,o]);s.useEffect(()=>{const a=R.current;return()=>{a?.clear()}},[]);const ke=()=>{se(a=>{const t={...a};return delete t[o],t})},Pe=async a=>new Promise((t,n)=>{const c=new Image;c.onload=()=>{try{const u=document.createElement("canvas");u.width=c.width,u.height=c.height,u.getContext("2d").drawImage(c,0,0);const m=u.toDataURL("image/png");fetch(m).then(x=>x.arrayBuffer()).then(x=>t(x)).catch(n)}catch(u){n(u)}},c.onerror=()=>n(new Error("Error loading image")),c.src=a}),le=async()=>{try{if(Object.keys(i).length===0){alert("Por favor, añade al menos una firma antes de guardar");return}const t=await(await fetch($)).arrayBuffer(),n=await _e.load(t),c=n.getPages();for(let w=1;w<=c.length;w++)if(i[w]){const q=c[w-1],P=i[w],Se=await Pe(P.dataUrl),Ee=await n.embedPng(Se),F=T.current;if(F){const ee=q.getWidth(),te=q.getHeight(),ue=P.x/F.width,ge=P.y/F.height,he=P.width/F.width,re=P.height/F.height,me=ue*ee,xe=(1-ge-re)*te,pe=he*ee,fe=re*te;console.log("🔍 Salvarea semnăturii în PDF:",{original:{x:P.x,y:P.y,width:P.width,height:P.height},canvas:{width:F.width,height:F.height},page:{width:ee,height:te},normalized:{x:ue,y:ge,w:he,h:re},pdf:{x:me,y:xe,w:pe,h:fe}}),q.drawImage(Ee,{x:me,y:xe,width:pe,height:fe})}}const u=await n.save();if(!u||u.byteLength===0)throw new Error("PDF-ul generat este gol sau invalid");console.log("🔍 PDF generat:",{size:u.byteLength,sizeMB:(u.byteLength/1024/1024).toFixed(2)});const p=new Uint8Array(u);let m="";const x=8192;for(let w=0;w<p.length;w+=x){const q=p.slice(w,w+x);m+=String.fromCharCode.apply(null,Array.from(q))}const v=btoa(m),h=!!(B&&z);console.log("🔍 [ContractSigner] Save signed PDF - Context:",{updateExisting:B,documentoDocId:z,isUpdate:h,empleadoId:L,empleadoEmail:A,empleadoNombre:M,originalFileName:j,docId:y});const k=h?L||y:l?.CODIGO||l?.codigo||l?.userId||l?.id||y,X=h?j:j?j.replace(/\.pdf$/i,"_FIRMADO.pdf"):`CONTRATO_EMPLEADO_${y}_FIRMADO.pdf`,Y=h?M||null:l?.["NOMBRE / APELLIDOS"]||l?.NOMBRE_APELLIDOS||l?.empleadoNombre||l?.displayName||l?.name||null,Q=h?A||null:l?.email||null,G={signed_b64:v,id:k,nombre_archivo:X,tipo_documento:h?r||void 0:"CONTRATO firmado",correo_electronico:Q,nombre_empleado:Y,fecha_creacion:new Date().toISOString(),doc_id:h?z:void 0,update_existing:h};console.log("🔍 [ContractSigner] Request body:",{...G,signed_b64:G.signed_b64.substring(0,50)+"..."});const O=await Oe(Fe.guardarDocumentoSemnat,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(G)});if(O.ok)await O.json(),alert(`✅ Documento firmado guardado exitosamente: ${j?j.replace(/\.pdf$/i,"_FIRMADO.pdf"):`CONTRATO_EMPLEADO_${y}_FIRMADO.pdf`}`),S?.(),U?.();else{const w=await O.text();throw console.error("❌ Response failed:",{status:O.status,statusText:O.statusText,headers:Object.fromEntries(O.headers.entries()),errorText:w}),new Error(`Error al guardar ${j||`CONTRATO_EMPLEADO_${y}.pdf`}: ${O.status} - ${w}`)}}catch(a){console.error("Error saving signed PDF:",a);const t=j||`CONTRATO_EMPLEADO_${y}.pdf`;alert(`❌ Error al guardar el documento firmado ${t}: ${a.message}`)}},de=a=>{a>=1&&a<=E&&V(a)},ce=a=>{D(Math.max(.5,Math.min(3,a)))};return I?e.jsxs("div",{className:"flex items-center justify-center h-96",children:[e.jsx("div",{className:"animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"}),e.jsx("span",{className:"ml-3 text-gray-600",children:"Cargando PDF..."})]}):ae?e.jsxs("div",{className:"text-center py-12",children:[e.jsx("div",{className:"text-6xl mb-4",children:"❌"}),e.jsx("p",{className:"text-lg font-medium text-gray-900 mb-2",children:"Error al cargar el PDF"}),e.jsx("p",{className:"text-gray-600 mb-4",children:ae}),e.jsx("button",{onClick:U,className:"px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors",children:"Cerrar"})]}):e.jsxs("div",{className:"dlg",children:[e.jsx("style",{children:Ae}),e.jsx("header",{className:"dlg__header",children:e.jsx("div",{className:"bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200 rounded-t-xl",children:e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx("div",{className:`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 ${d?"bg-gradient-to-br from-blue-500 to-blue-600":"bg-gradient-to-br from-red-500 to-red-600"}`,children:e.jsx("span",{className:"text-white text-xl",children:d?"🎯":"✍️"})}),e.jsxs("div",{children:[e.jsxs("h3",{className:"text-xl font-bold text-gray-900",children:[d?"Posicionar Firma":"Firmar Documento",": Página ",o," de ",E]}),e.jsxs("p",{className:"text-blue-600 text-sm font-medium",children:["Documento: ",y]}),d&&e.jsx("div",{className:"text-blue-700 mt-1 text-sm",children:"💡 Arrastra la firma para posicionarla en el documento"})]})]}),e.jsx("div",{className:"flex items-center gap-2",children:d&&e.jsxs("button",{onClick:()=>{W(!1),H(null)},className:"px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg flex items-center gap-2",children:[e.jsx("span",{children:"❌"}),e.jsx("span",{children:"Cancelar"})]})})]})})}),e.jsxs("main",{className:"dlg__body",children:[e.jsxs("div",{className:"bg-gray-50 p-2 sm:p-4 mb-2 sm:mb-4 rounded-lg",children:[e.jsx("div",{className:"bg-white rounded-xl shadow-lg p-2 sm:p-4 mb-2 sm:mb-4 border border-gray-200",children:e.jsxs("div",{className:"flex flex-col space-y-3",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsxs("button",{onClick:()=>de(o-1),disabled:o<=1,className:"group relative px-4 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-gray-500 to-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",children:[e.jsx("div",{className:"absolute inset-0 rounded-xl bg-gray-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"}),e.jsxs("div",{className:"relative flex items-center gap-2",children:[e.jsx("span",{children:"←"}),e.jsx("span",{children:"Anterior"})]})]}),e.jsx("div",{className:"bg-gradient-to-r from-blue-100 to-blue-200 px-4 py-2 rounded-xl border border-blue-300 shadow-md",children:e.jsxs("span",{className:"text-lg font-bold text-blue-900",children:[o," / ",E]})}),e.jsxs("button",{onClick:()=>de(o+1),disabled:o>=E,className:"group relative px-4 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-gray-500 to-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",children:[e.jsx("div",{className:"absolute inset-0 rounded-xl bg-gray-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"}),e.jsxs("div",{className:"relative flex items-center gap-2",children:[e.jsx("span",{children:"Siguiente"}),e.jsx("span",{children:"→"})]})]}),e.jsx("button",{onClick:U,className:"w-10 h-10 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg group","aria-label":"Cerrar preview",children:e.jsx("span",{className:"text-gray-400 group-hover:text-gray-600 text-xl",children:"✕"})})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsxs("button",{onClick:()=>ce(g-.2),className:"group relative px-3 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white",children:[e.jsx("div",{className:"absolute inset-0 rounded-xl bg-blue-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"}),e.jsxs("div",{className:"relative flex items-center gap-1",children:[e.jsx("span",{children:"🔍"}),e.jsx("span",{children:"-"})]})]}),e.jsx("div",{className:"bg-gradient-to-r from-green-100 to-green-200 px-4 py-2 rounded-xl border border-green-300 shadow-md",children:e.jsxs("span",{className:"text-lg font-bold text-green-900 min-w-[60px] text-center",children:[Math.round(g*100),"%"]})}),e.jsxs("button",{onClick:()=>ce(g+.2),className:"group relative px-3 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white",children:[e.jsx("div",{className:"absolute inset-0 rounded-xl bg-blue-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"}),e.jsxs("div",{className:"relative flex items-center gap-1",children:[e.jsx("span",{children:"🔍"}),e.jsx("span",{children:"+"})]})]})]})]}),e.jsxs("div",{className:"flex items-center gap-3 w-full",children:[e.jsxs("button",{onClick:K,className:"group relative flex-1 px-4 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg bg-gradient-to-r from-gray-500 to-gray-600 text-white",children:[e.jsx("div",{className:"absolute inset-0 rounded-xl bg-gray-400 opacity-0 group-hover:opacity-20 blur-sm transition-all duration-300"}),e.jsxs("div",{className:"relative flex items-center justify-center gap-2",children:[e.jsx("span",{children:"🗑️"}),e.jsx("span",{children:"Limpiar Firma"})]})]}),e.jsxs("button",{onClick:le,disabled:Object.keys(i).length===0,className:`group relative flex-1 px-4 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg ${Object.keys(i).length===0?"bg-gray-400 text-gray-200 cursor-not-allowed shadow-none transform-none":"bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200"}`,style:{opacity:Object.keys(i).length===0?.6:1,pointerEvents:Object.keys(i).length===0?"none":"auto"},children:[Object.keys(i).length>0&&e.jsx("div",{className:"absolute inset-0 rounded-xl bg-green-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"}),e.jsx("div",{className:"relative flex items-center justify-center gap-2",children:Object.keys(i).length===0?e.jsxs(e.Fragment,{children:[e.jsx("span",{children:"❌"}),e.jsx("span",{className:"text-sm",children:"Sin firmas"})]}):e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"text-lg",children:"💾"}),e.jsx("span",{className:"font-bold",children:"Guardar PDF Firmado"})]})})]})]})]})}),e.jsx("div",{className:"pdf-canvas-container bg-white rounded-lg shadow-md p-2 sm:p-4 overflow-x-hidden overflow-y-auto max-h-[60vh] sm:max-h-[70vh] w-full flex items-center justify-center",style:{boxSizing:"border-box",position:"relative",zIndex:1},children:e.jsxs("div",{className:"w-full flex justify-center",style:{minWidth:0,maxWidth:"100%"},children:[e.jsx("canvas",{ref:T,className:`border border-gray-200 rounded-lg shadow-sm ${d?"cursor-crosshair":"cursor-default"}`,style:{maxWidth:"100%",height:"auto",display:"block"},onClick:Ne,onMouseMove:we}),d&&e.jsx("div",{className:"absolute inset-0 pointer-events-none",children:e.jsx("div",{className:"w-full h-full",style:{backgroundImage:`
                      linear-gradient(rgba(239, 68, 68, 0.1) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(239, 68, 68, 0.1) 1px, transparent 1px)
                    `,backgroundSize:"20px 20px"}})}),d&&f&&e.jsx("div",{className:"absolute pointer-events-none",style:{left:oe.x-f.width/2,top:oe.y-f.height/2,width:f.width,height:f.height,border:"2px dashed #ef4444",backgroundColor:"rgba(239, 68, 68, 0.2)",borderRadius:"4px",zIndex:10},children:e.jsx("div",{className:"w-full h-full",style:{backgroundImage:`url(${f.dataUrl})`,backgroundSize:"contain",backgroundRepeat:"no-repeat",backgroundPosition:"center",opacity:.6}})})]})})]}),e.jsxs("section",{id:"signature-zone",className:"bg-white rounded-lg shadow-md p-4",children:[e.jsx("div",{className:"text-center mb-4",children:e.jsx("h4",{className:"text-lg font-bold text-gray-900",children:"✍️ Firma digital"})}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto",children:[e.jsx("div",{className:"md:col-span-1",children:e.jsxs("div",{className:"bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 border-2 border-dashed border-gray-300 shadow-sm",children:[e.jsx(Le,{ref:R,width:250,height:150,className:"border border-gray-200 rounded-lg bg-white cursor-crosshair mx-auto block shadow-sm hover:shadow-md transition-shadow"}),e.jsx("p",{className:"text-xs text-gray-500 text-center mt-1",children:"Dibuja tu firma aquí"})]})}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs("button",{onClick:K,className:"group relative w-full px-4 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-gray-200",children:[e.jsx("div",{className:"absolute inset-0 rounded-xl bg-gray-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"}),e.jsxs("div",{className:"relative flex items-center justify-center gap-2",children:[e.jsx("span",{className:"text-lg",children:"🗑️"}),e.jsx("span",{children:"Limpiar Firma"})]})]}),e.jsxs("label",{className:"group relative w-full px-4 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200 cursor-pointer block",children:[e.jsx("div",{className:"absolute inset-0 rounded-xl bg-purple-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"}),e.jsxs("div",{className:"relative flex items-center justify-center gap-2",children:[e.jsx("span",{className:"text-lg",children:"📷"}),e.jsx("span",{children:"Cargar Firma desde Imagen"})]}),e.jsx("input",{type:"file",accept:"image/*",onChange:je,className:"hidden"})]}),i[o]?e.jsxs("button",{onClick:Ce,disabled:d,className:`group relative w-full px-4 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${d?"bg-gray-400 text-gray-200 cursor-not-allowed shadow-none transform-none":"bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200"}`,children:[!d&&e.jsx("div",{className:"absolute inset-0 rounded-xl bg-blue-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"}),e.jsxs("div",{className:"relative flex items-center justify-center gap-2",children:[e.jsx("span",{className:"text-lg",children:d?"🎯":"✏️"}),e.jsx("span",{children:d?"Moviendo firma...":"Mover Firma"})]})]}):e.jsxs("button",{onClick:ye,disabled:d,className:`group relative w-full px-4 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${d?"bg-gray-400 text-gray-200 cursor-not-allowed shadow-none transform-none":"bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200"}`,children:[!d&&e.jsx("div",{className:"absolute inset-0 rounded-xl bg-green-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"}),e.jsxs("div",{className:"relative flex items-center justify-center gap-2",children:[e.jsx("span",{className:"text-lg",children:d?"🎯":"➕"}),e.jsx("span",{children:d?"Posicionando firma...":`Añadir Firma a Página ${o}`})]})]}),e.jsxs("button",{onClick:ke,className:"group relative w-full px-4 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-200",children:[e.jsx("div",{className:"absolute inset-0 rounded-xl bg-orange-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"}),e.jsxs("div",{className:"relative flex items-center justify-center gap-2",children:[e.jsx("span",{className:"text-lg",children:"🗑️"}),e.jsxs("span",{children:["Borrar Firma de Página ",o]})]})]})]}),e.jsx("div",{children:e.jsxs("div",{className:"p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-sm h-full",children:[e.jsx("h5",{className:"font-bold text-gray-900 mb-3 text-center",children:"Estado de Firmas:"}),e.jsx("div",{className:"space-y-2 text-sm max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent",children:Array.from({length:E},(a,t)=>t+1).map(a=>e.jsxs("div",{className:"flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200",children:[e.jsxs("span",{className:"font-medium",children:["Página ",a,":"]}),e.jsx("span",{className:i[a]?"text-green-600 font-bold":"text-gray-400",children:i[a]?"✅ Firmada":"❌ Sin firma"})]},a))})]})})]})]})]}),e.jsx("button",{onClick:()=>ve(!Z),className:"mobile-footer-toggle sm:hidden","aria-label":"Toggle footer",children:Z?"▼":"☰"}),e.jsxs("footer",{className:`dlg__footer ${Z?"mobile-visible":""}`,children:[e.jsxs("button",{onClick:K,className:"group relative flex-1 px-4 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-gray-200",children:[e.jsx("div",{className:"absolute inset-0 rounded-xl bg-gray-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"}),e.jsxs("div",{className:"relative flex items-center justify-center gap-2",children:[e.jsx("span",{className:"text-lg",children:"🗑️"}),e.jsx("span",{children:"Limpiar Firma"})]})]}),e.jsxs("button",{onClick:le,disabled:Object.keys(i).length===0,className:`group relative flex-1 px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${Object.keys(i).length===0?"bg-gray-400 text-gray-200 cursor-not-allowed shadow-none transform-none":"bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200"}`,children:[Object.keys(i).length>0&&e.jsx("div",{className:"absolute inset-0 rounded-xl bg-red-400 opacity-30 blur-md animate-pulse group-hover:opacity-40 transition-all duration-300"}),e.jsx("div",{className:"relative flex items-center justify-center gap-2",children:Object.keys(i).length===0?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"text-lg",children:"❌"}),e.jsx("span",{children:"Sin firmas para guardar"})]}):e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"text-lg",children:"💾"}),e.jsx("span",{children:"Guardar PDF"})]})})]})]})]})}export{$e as C};
//# sourceMappingURL=ContractSigner-B1uFO0PB.js.map
