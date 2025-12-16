const Input = ({ 
  label,
  type = 'text', 
  placeholder = '', 
  value = '', 
  onChange, 
  className = '', 
  disabled = false,
  error,
  multiline,
  rows = 4,
  id,
  ...props 
}) => {
  // Generează un ID unic dacă nu este furnizat
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      {multiline ? (
        <textarea
          id={inputId}
          rows={rows}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors resize-vertical"
          value={value}
          onChange={onChange}
          placeholder={placeholder || undefined}
          disabled={disabled}
          {...props}
        />
      ) : (
        <input
          id={inputId}
          type={type}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
          value={value}
          onChange={onChange}
          placeholder={placeholder || undefined}
          disabled={disabled}
          {...props}
        />
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default Input; 