import { useBreakpoint } from '../hooks/useBreakpoint';
import DesktopLayout from './DesktopLayout';
import MobileLayout from './MobileLayout';
import ErrorReportNoAssistantModal from '../components/ErrorReportNoAssistantModal';

/**
 * ResponsiveLayout - Wrapper care switch-ează între DesktopLayout și MobileLayout
 * Bazat pe breakpoint (max-width: 767px)
 */
const ResponsiveLayout = ({ children }) => {
  const { isMobile } = useBreakpoint();

  return (
    <>
      {isMobile ? (
        <MobileLayout>{children}</MobileLayout>
      ) : (
        <DesktopLayout>{children}</DesktopLayout>
      )}
      <ErrorReportNoAssistantModal />
    </>
  );
};

export default ResponsiveLayout;
