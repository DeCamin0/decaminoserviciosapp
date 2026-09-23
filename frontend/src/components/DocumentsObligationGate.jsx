import DocumentsObligationModal from './DocumentsObligationModal';
import { useDocumentsObligation } from '../hooks/useDocumentsObligation';

/**
 * Gate global: modal soft pe Inicio / hard pe tot app-ul după 3 Más tarde.
 */
export default function DocumentsObligationGate() {
  const {
    user,
    items,
    hardLocked,
    snoozeCount,
    snoozeMax,
    shouldShowModal,
    snooze,
    afterItemDone,
    logout,
  } = useDocumentsObligation();

  return (
    <>
      <DocumentsObligationModal
        open={shouldShowModal}
        items={items}
        hardLocked={hardLocked}
        snoozeCount={snoozeCount}
        snoozeMax={snoozeMax}
        user={user}
        onSnooze={snooze}
        onAfterItemDone={afterItemDone}
        onLogout={logout}
      />
      {hardLocked && items.length > 0 && (
        <div
          className="docs-obligation-hard-block"
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 11990,
            pointerEvents: 'auto',
            background: 'transparent',
          }}
        />
      )}
    </>
  );
}
