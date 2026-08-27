import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Eye, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { Button, Modal } from '../ui';
import { useIsMobile } from './clientesUi.utils';

function ActionMenuItems({ onEditar, onEliminar, onClose }) {
  const handle = (fn) => () => {
    onClose();
    fn();
  };

  return (
    <div className="clientes-actions-menu" role="menu">
      <button
        type="button"
        role="menuitem"
        className="clientes-actions-menu__item"
        onClick={handle(onEditar)}
      >
        <Pencil className="clientes-actions-menu__icon" aria-hidden />
        <span>Editar</span>
      </button>
      <div className="clientes-actions-menu__separator" role="separator" />
      <button
        type="button"
        role="menuitem"
        className="clientes-actions-menu__item clientes-actions-menu__item--danger"
        onClick={handle(onEliminar)}
      >
        <Trash2 className="clientes-actions-menu__icon" aria-hidden />
        <span>Eliminar</span>
      </button>
    </div>
  );
}

export default function ClientesRowActions({ onVerDetalle, onEditar, onEliminar }) {
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

  return (
    <div className="clientes-row-actions" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        variant="primary"
        size="sm"
        className="clientes-row-actions__primary"
        onClick={onVerDetalle}
      >
        <Eye className="w-4 h-4 shrink-0" aria-hidden />
        <span>Ver detalle</span>
      </Button>

      <div ref={triggerRef} className="clientes-row-actions__secondary-wrap">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="clientes-row-actions__secondary w-full"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span>Acciones</span>
          <ChevronDown
            className={`w-4 h-4 shrink-0 clientes-row-actions__chevron${menuOpen ? ' is-open' : ''}`}
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
          className="app-modal--form app-modal--bottom-sheet clientes-actions-sheet"
          showCloseButton
        >
          <ActionMenuItems
            onEditar={onEditar}
            onEliminar={onEliminar}
            onClose={closeMenu}
          />
        </Modal>,
        document.body,
      ) : createPortal(
        <div
          ref={dropdownRef}
          className="clientes-actions-popover"
          style={{
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
          }}
        >
          <ActionMenuItems
            onEditar={onEditar}
            onEliminar={onEliminar}
            onClose={closeMenu}
          />
        </div>,
        document.body,
      ))}
    </div>
  );
}
