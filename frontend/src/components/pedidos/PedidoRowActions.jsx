import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Eye, EyeOff, ChevronDown, Pencil, FileUp, Copy, Trash2, Loader2,
} from 'lucide-react';
import { Button, Modal } from '../ui';

function useIsMobile(breakpoint = 639) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);

  return isMobile;
}

function ActionMenuItems({
  isEditing,
  noEditable,
  showAlbaran,
  albaranLabel,
  showAnadirAlbaran,
  copiando,
  onEditar,
  onAlbaran,
  onAnadirAlbaran,
  onCopia,
  onBorrar,
  onClose,
}) {
  const handle = (fn) => () => {
    onClose();
    fn();
  };

  return (
    <div className="pedidos-actions-menu" role="menu">
      <button
        type="button"
        role="menuitem"
        className="pedidos-actions-menu__item"
        disabled={noEditable}
        title={noEditable ? 'No se puede editar un pedido ya enviado al proveedor' : undefined}
        onClick={handle(onEditar)}
      >
        <Pencil className="pedidos-actions-menu__icon" aria-hidden />
        <span>{isEditing ? 'Cancelar edición' : 'Editar'}</span>
      </button>

      {showAlbaran && (
        <button
          type="button"
          role="menuitem"
          className="pedidos-actions-menu__item"
          onClick={handle(onAlbaran)}
        >
          <FileUp className="pedidos-actions-menu__icon" aria-hidden />
          <span>{albaranLabel}</span>
        </button>
      )}

      {showAnadirAlbaran && (
        <button
          type="button"
          role="menuitem"
          className="pedidos-actions-menu__item"
          onClick={handle(onAnadirAlbaran)}
          title="Subir más documentos de albarán"
        >
          <FileUp className="pedidos-actions-menu__icon" aria-hidden />
          <span>Añadir albarán</span>
        </button>
      )}

      <button
        type="button"
        role="menuitem"
        className="pedidos-actions-menu__item"
        disabled={copiando}
        title="Crear un pedido nuevo con los mismos productos y comunidad"
        onClick={handle(onCopia)}
      >
        {copiando ? (
          <Loader2 className="pedidos-actions-menu__icon animate-spin" aria-hidden />
        ) : (
          <Copy className="pedidos-actions-menu__icon" aria-hidden />
        )}
        <span>{copiando ? 'Copiando…' : 'Crear por copia'}</span>
      </button>

      <div className="pedidos-actions-menu__separator" role="separator" />

      <button
        type="button"
        role="menuitem"
        className="pedidos-actions-menu__item pedidos-actions-menu__item--danger"
        title="Eliminar pedido permanentemente"
        onClick={handle(onBorrar)}
      >
        <Trash2 className="pedidos-actions-menu__icon" aria-hidden />
        <span>Borrar</span>
      </button>
    </div>
  );
}

export default function PedidoRowActions({
  detallesOpen,
  isEditing,
  noEditable,
  showAlbaran,
  albaranLabel,
  showAnadirAlbaran,
  copiando,
  onToggleDetalles,
  onEditar,
  onAlbaran,
  onAnadirAlbaran,
  onCopia,
  onBorrar,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const isMobile = useIsMobile();
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (menuOpen && !isMobile && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }
  }, [menuOpen, isMobile]);

  useEffect(() => {
    if (!menuOpen || isMobile) return undefined;

    function handleClickOutside(event) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target)
        && triggerRef.current && !triggerRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen, isMobile]);

  const DetallesIcon = detallesOpen ? EyeOff : Eye;

  return (
    <div className="pedidos-row-actions">
      <Button
        type="button"
        variant="primary"
        size="sm"
        className="pedidos-row-actions__primary"
        onClick={onToggleDetalles}
      >
        <DetallesIcon className="w-4 h-4 shrink-0" aria-hidden />
        <span>{detallesOpen ? 'Ocultar' : 'Ver detalles'}</span>
      </Button>

      <div ref={triggerRef} className="pedidos-row-actions__secondary-wrap">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="pedidos-row-actions__secondary w-full"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span>Acciones</span>
          <ChevronDown
            className={`w-4 h-4 shrink-0 pedidos-row-actions__chevron${menuOpen ? ' is-open' : ''}`}
            aria-hidden
          />
        </Button>
      </div>

      {menuOpen && typeof document !== 'undefined' && (isMobile ? createPortal(
        <Modal
          isOpen={menuOpen}
          onClose={closeMenu}
          title="Acciones"
          size="sm"
          className="app-modal--form app-modal--bottom-sheet pedidos-actions-sheet"
          showCloseButton
        >
          <ActionMenuItems
            isEditing={isEditing}
            noEditable={noEditable}
            showAlbaran={showAlbaran}
            albaranLabel={albaranLabel}
            showAnadirAlbaran={showAnadirAlbaran}
            copiando={copiando}
            onEditar={onEditar}
            onAlbaran={onAlbaran}
            onAnadirAlbaran={onAnadirAlbaran}
            onCopia={onCopia}
            onBorrar={onBorrar}
            onClose={closeMenu}
          />
        </Modal>,
        document.body,
      ) : createPortal(
        <div
          ref={dropdownRef}
          className="pedidos-actions-popover"
          style={{
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
          }}
        >
          <ActionMenuItems
            isEditing={isEditing}
            noEditable={noEditable}
            showAlbaran={showAlbaran}
            albaranLabel={albaranLabel}
            showAnadirAlbaran={showAnadirAlbaran}
            copiando={copiando}
            onEditar={onEditar}
            onAlbaran={onAlbaran}
            onAnadirAlbaran={onAnadirAlbaran}
            onCopia={onCopia}
            onBorrar={onBorrar}
            onClose={closeMenu}
          />
        </div>,
        document.body,
      ))}
    </div>
  );
}
