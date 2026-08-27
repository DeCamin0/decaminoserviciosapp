import { AlertTriangle, X } from 'lucide-react';

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar acción',
  message,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  type = 'danger',
  icon: CustomIcon,
  overlayZIndex = 9999,
}) => {
  if (!isOpen) return null;

  const typeStyles = {
    danger: {
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      buttonClass: 'app-modal__btn app-modal__btn--primary',
    },
    warning: {
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      buttonClass: 'app-modal__btn app-modal__btn--primary',
    },
    info: {
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      buttonClass: 'app-modal__btn app-modal__btn--primary',
    },
  };

  const styles = typeStyles[type] || typeStyles.danger;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div
      className="app-modal-overlay"
      style={{ zIndex: overlayZIndex }}
    >
      <div className="app-modal app-modal--sm" role="dialog" aria-modal="true">
        <div className="app-modal__header">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 ${styles.iconBg} rounded-[var(--app-radius-sm)] flex items-center justify-center flex-shrink-0`}>
              {CustomIcon ? (
                <CustomIcon className={`w-5 h-5 ${styles.iconColor}`} />
              ) : (
                <AlertTriangle className={`w-5 h-5 ${styles.iconColor}`} />
              )}
            </div>
            <h2 className="app-modal__title">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="app-modal__close"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="app-modal__body">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line m-0">
            {message}
          </p>
        </div>

        <div className="app-modal__footer">
          <button type="button" onClick={onClose} className="app-modal__btn">
            {cancelText}
          </button>
          <button type="button" onClick={handleConfirm} className={styles.buttonClass}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
