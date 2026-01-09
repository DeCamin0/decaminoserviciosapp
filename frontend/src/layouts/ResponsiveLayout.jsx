import { useBreakpoint } from '../hooks/useBreakpoint';
import DesktopLayout from './DesktopLayout';
import MobileLayout from './MobileLayout';

/**
 * ResponsiveLayout - Wrapper care switch-ează între DesktopLayout și MobileLayout
 * Bazat pe breakpoint (max-width: 767px)
 */
const ResponsiveLayout = ({ children }) => {
  const { isMobile } = useBreakpoint();

  if (isMobile) {
    return <MobileLayout>{children}</MobileLayout>;
  }

  return <DesktopLayout>{children}</DesktopLayout>;
};

export default ResponsiveLayout;
