import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, ChevronDown, Pencil, FileUp } from 'lucide-react';
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

function MenuItems({ items, onClose }) {
  const handle = (fn) => () => {
    onClose();
    fn();
  };

  const regular = items.filter((item) => !item.danger);
  const danger = items.filter((item) => item.danger);

  return (
    <div className="pedidos-actions-menu" role="menu">
      {regular.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className="pedidos-actions-menu__item"
            disabled={item.disabled}
            title={item.title}
            onClick={handle(item.onClick)}
          >
            <Icon className="pedidos-actions-menu__icon" aria-hidden />
            <span>{item.label}</span>
          </button>
        );
      })}
      {danger.length > 0 && regular.length > 0 && (
        <div className="pedidos-actions-menu__separator" role="separator" />
      )}
      {danger.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className="pedidos-actions-menu__item pedidos-actions-menu__item--danger"
            disabled={item.disabled}
            title={item.title}
            onClick={handle(item.onClick)}
          >
            <Icon className="pedidos-actions-menu__icon" aria-hidden />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function AccionesMenu({ menuItems, menuOpen, dropdownRef, dropdownPosition, isMobile, closeMenu }) {
  if (!menuOpen || typeof document === 'undefined') return null;

  if (isMobile) {
    return createPortal(
      <Modal
        isOpen={menuOpen}
        onClose={closeMenu}
        title="Acciones"
        size="sm"
        className="app-modal--form app-modal--bottom-sheet pedidos-actions-sheet"
        showCloseButton
      >
        <MenuItems items={menuItems} onClose={closeMenu} />
      </Modal>,
      document.body,
    );
  }

  return createPortal(
    <div
      ref={dropdownRef}
      className="pedidos-actions-popover"
      style={{
        top: `${dropdownPosition.top}px`,
        right: `${dropdownPosition.right}px`,
      }}
    >
      <MenuItems items={menuItems} onClose={closeMenu} />
    </div>,
    document.body,
  );
}

export default function EmpleadoPedidoRowActions({
  estado,
  detallesOpen,
  onToggleDetalles,
  onEditar,
  onAlbaran,
  onAnadirAlbaran,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const isMobile = useIsMobile();
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const normalizedEstado = estado?.toLowerCase() ?? '';

  const { primary, menuItems } = useMemo(() => {
    const verDetallesItem = {
      id: 'detalles',
      label: detallesOpen ? 'Ocultar detalles' : 'Ver detalles',
      icon: detallesOpen ? EyeOff : Eye,
      onClick: onToggleDetalles,
    };

    if (normalizedEstado === 'pendiente') {
      return {
        primary: { label: 'Editar', icon: Pencil, onClick: onEditar },
        menuItems: [verDetallesItem],
      };
    }

    if (normalizedEstado === 'aprobado' || normalizedEstado === 'enviado') {
      return {
        primary: { label: 'Cargar albarán', icon: FileUp, onClick: onAlbaran },
        menuItems: [verDetallesItem],
      };
    }

    if (normalizedEstado === 'entregado') {
      return {
        primary: { label: 'Ver albarán', icon: FileUp, onClick: onAlbaran },
        menuItems: [
          verDetallesItem,
          {
            id: 'anadir-albaran',
            label: 'Añadir albarán',
            icon: FileUp,
            onClick: onAnadirAlbaran,
            title: 'Subir más documentos de albarán',
          },
        ],
      };
    }

    return {
      primary: {
        label: detallesOpen ? 'Ocultar detalles' : 'Ver detalles',
        icon: detallesOpen ? EyeOff : Eye,
        onClick: onToggleDetalles,
      },
      menuItems: [],
    };
  }, [
    normalizedEstado,
    detallesOpen,
    onToggleDetalles,
    onEditar,
    onAlbaran,
    onAnadirAlbaran,
  ]);

  const useAccionesMenu = menuItems.length >= 2;
  const PrimaryIcon = primary.icon;

  useEffect(() => {
    if (menuOpen && useAccionesMenu && !isMobile && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }
  }, [menuOpen, useAccionesMenu, isMobile]);

  useEffect(() => {
    if (!menuOpen || isMobile || !useAccionesMenu) return undefined;

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
  }, [menuOpen, isMobile, useAccionesMenu]);

  return (
    <div className="pedidos-row-actions">
      <Button
        type="button"
        variant="primary"
        size="sm"
        className="pedidos-row-actions__primary"
        onClick={primary.onClick}
      >
        <PrimaryIcon className="w-4 h-4 shrink-0" aria-hidden />
        <span>{primary.label}</span>
      </Button>

      {menuItems.length === 1 && (() => {
        const item = menuItems[0];
        const ItemIcon = item.icon;
        return (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="pedidos-row-actions__secondary"
            title={item.title}
            onClick={item.onClick}
          >
            <ItemIcon className="w-4 h-4 shrink-0" aria-hidden />
            <span>{item.label}</span>
          </Button>
        );
      })()}

      {useAccionesMenu && (
        <>
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
          <AccionesMenu
            menuItems={menuItems}
            menuOpen={menuOpen}
            dropdownRef={dropdownRef}
            dropdownPosition={dropdownPosition}
            isMobile={isMobile}
            closeMenu={closeMenu}
          />
        </>
      )}
    </div>
  );
}
