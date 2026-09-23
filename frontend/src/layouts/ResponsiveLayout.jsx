import { useBreakpoint } from '../hooks/useBreakpoint';
import AppShell from './AppShell';
import ErrorReportNoAssistantModal from '../components/ErrorReportNoAssistantModal';
import DocumentsObligationGate from '../components/DocumentsObligationGate';

/**
 * ResponsiveLayout - un singur AppShell stabil.
 * La resize / rotație / split screen se schimbă doar chrome-ul (header/nav),
 * nu se remontează pagina — modalele și formularele rămân deschise.
 */
const ResponsiveLayout = ({ children }) => {
  const { isMobile } = useBreakpoint();

  return (
    <>
      <AppShell isMobile={isMobile}>{children}</AppShell>
      <ErrorReportNoAssistantModal />
      <DocumentsObligationGate />
    </>
  );
};

export default ResponsiveLayout;
