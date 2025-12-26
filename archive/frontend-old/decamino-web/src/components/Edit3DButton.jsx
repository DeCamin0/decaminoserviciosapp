export default function Edit3DButton({ 
  onClick, 
  children = "Editar datos", 
  className = '', 
  disabled = false,
  loading = false,
  size = 'md' // sm, md, lg
}) {
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base', 
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        group relative overflow-hidden rounded-2xl font-semibold transition-all duration-300 
        transform hover:scale-105 active:scale-95 shadow-xl hover:shadow-2xl
        ${sizeClasses[size]}
        ${disabled || loading 
          ? 'opacity-50 cursor-not-allowed' 
          : 'cursor-pointer'
        }
        ${className}
      `}
    >
      {/* Base gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-600 to-indigo-600 rounded-2xl" />
      
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
      
      {/* Top glossy highlight */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute inset-x-0 -top-2 h-8 bg-white/30 blur-lg opacity-0 group-hover:opacity-70 transition-opacity duration-300" />
      </div>
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-2xl" />
      
      {/* Content */}
      <div className="relative z-10 flex items-center justify-center gap-2 text-white">
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Guardando...</span>
          </>
        ) : (
          <>
            <span className="text-lg group-hover:rotate-12 transition-transform duration-300">✏️</span>
            <span className="group-hover:translate-x-0.5 transition-transform duration-300">
              {children}
            </span>
          </>
        )}
      </div>
      
      {/* Bottom shadow for depth */}
      <div className="absolute -bottom-1 left-1 right-1 h-2 bg-gradient-to-r from-blue-600/30 via-purple-600/30 to-indigo-600/30 rounded-xl blur-sm group-hover:blur-md transition-all duration-300" />
    </button>
  );
}
