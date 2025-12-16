import { Link } from 'react-router-dom';

export default function Back3DButton({ to = '/inicio', title = 'Regresar al Dashboard', className = '' }) {
  return (
    <Link 
      to={to}
      className={`group relative w-12 h-12 rounded-2xl transition-transform active:translate-y-[1px] ${className}`}
      title={title}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 shadow-[0_10px_20px_rgba(239,68,68,0.35)]" />
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute inset-x-0 -top-2 h-10 bg-white/30 blur-lg opacity-0 group-hover:opacity-70 transition-opacity duration-300" />
      </div>
      <div className="relative z-10 w-full h-full rounded-2xl bg-white border border-red-200 flex items-center justify-center shadow-md transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-red-50 to-red-100 border border-red-200 shadow-inner">
          <svg className="w-5 h-5 text-red-600 group-hover:text-red-700 transition-colors duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H6" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          <span className="sr-only">Volver</span>
        </div>
      </div>
    </Link>
  );
}


