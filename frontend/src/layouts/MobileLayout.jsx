import AppShell from './AppShell';

/**
 * MobileLayout - wrapper peste AppShell (isMobile=true).
 * Preferă ResponsiveLayout pentru rute; acesta există pentru compatibilitate.
 */
const MobileLayout = ({ children }) => {
  return <AppShell isMobile>{children}</AppShell>;
};

export default MobileLayout;
