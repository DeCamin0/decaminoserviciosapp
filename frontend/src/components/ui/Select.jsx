

const Select = ({ 
  label, 
  options = [], 
  error, 
  className = '', 
  loading,
  disabled,
  id,
  name,
  ...props 
}) => {
  // Generează un ID unic dacă nu este furnizat
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
  // Generează un name din id dacă nu este furnizat
  const selectName = name || (id ? id.replace(/[^a-zA-Z0-9]/g, '-') : selectId);
  
  return (
    <div className={className}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <select
        id={selectId}
        name={selectName}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors ${
          disabled || loading ? 'bg-gray-100 cursor-not-allowed' : ''
        }`}
        disabled={disabled || loading}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default Select; 