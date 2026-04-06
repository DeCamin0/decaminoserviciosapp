import { useState, useEffect } from 'react';
import Modal from './ui/Modal';

/**
 * Si el usuario pulsa «Reportar error» pero no tiene el asistente del portal (perfil / config),
 * el ChatBot dispara este modal: Telegram ya se intentó enviar desde reportError.js.
 */
export default function ErrorReportNoAssistantModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setOpen(true);
    window.addEventListener('decamino-report-error-no-chat', fn);
    return () => window.removeEventListener('decamino-report-error-no-chat', fn);
  }, []);

  return (
    <Modal
      isOpen={open}
      onClose={() => setOpen(false)}
      title="Reporte enviado por Telegram"
      size="sm"
    >
      <p className="mb-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        En tu cuenta no está activo el asistente del portal (chat). Se ha intentado enviar el aviso
        al equipo por <strong>Telegram</strong> (no por WhatsApp).
      </p>
      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        Si necesitas ayuda urgente o nadie responde a tiempo, contacta con un{' '}
        <strong>supervisor</strong> o con <strong>RRHH</strong> por los canales habituales de la
        empresa.
      </p>
    </Modal>
  );
}
