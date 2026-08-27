const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className = '',
  showCloseButton = true,
  closeOnBackdrop = true,
  footer = null,
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="app-modal-overlay"
      onClick={handleBackdropClick}
    >
      <div
        className={`app-modal app-modal--${size}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="app-modal__header">
            <h2 className="app-modal__title">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="app-modal__close"
              title="Cerrar"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        ) : null}
        <div className="app-modal__body">
          {children}
        </div>
        {footer ? (
          <div className="app-modal__footer">{footer}</div>
        ) : showCloseButton ? (
          <div className="app-modal__footer">
            <button type="button" onClick={onClose} className="app-modal__btn">
              Cerrar
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Modal;
