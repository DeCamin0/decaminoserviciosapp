const Separator = ({ className = '', orientation = 'horizontal', ...props }) => {
  const baseClasses = orientation === 'horizontal' 
    ? 'h-px bg-gray-200' 
    : 'w-px bg-gray-200';

  const classes = `${baseClasses} ${className}`;

  return (
    <div className={classes} {...props} />
  );
};

export default Separator; 