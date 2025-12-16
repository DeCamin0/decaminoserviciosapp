export default function ChangeEmployee3DButton({ onClick, title = 'Cambiar Empleado', className = '' }) {
  return (
    <button 
      onClick={onClick}
      className={`group relative w-12 h-12 rounded-2xl transition-transform active:translate-y-[1px] ${className}`}
      title={title}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-[0_10px_20px_rgba(59,130,246,0.35)]" />
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute inset-x-0 -top-2 h-10 bg-white/30 blur-lg opacity-0 group-hover:opacity-70 transition-opacity duration-300" />
      </div>
      <div className="relative z-10 w-full h-full rounded-2xl bg-white border border-blue-200 flex items-center justify-center shadow-md transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 shadow-inner">
          <svg className="w-5 h-5 text-blue-600 group-hover:text-blue-700 transition-colors duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H6" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          <span className="sr-only">Cambiar Empleado</span>
        </div>
      </div>
    </button>
  );
}
