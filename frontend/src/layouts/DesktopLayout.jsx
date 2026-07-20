import AppShell from './AppShell';

/**
 * DesktopLayout - wrapper peste AppShell (isMobile=false).
 * Preferă ResponsiveLayout pentru rute; acesta există pentru compatibilitate.
 */
const DesktopLayout = ({ children }) => {
  return <AppShell isMobile={false}>{children}</AppShell>;
};

export default DesktopLayout;
