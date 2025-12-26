// Main exports for the Impuestos (Taxes) module
export { default as ImpuestosDashboard } from './pages/ImpuestosDashboard';
export { default as ImpuestosResumen } from './pages/ImpuestosResumen';
export { default as CalendarioFiscal } from './pages/CalendarioFiscal';
export { default as IVAPage } from './pages/IVAPage';
export { default as IRPFPage } from './pages/IRPFPage';
export { default as RetencionesPage } from './pages/RetencionesPage';
export { default as RetencionesAlquileresPage } from './pages/RetencionesAlquileresPage';
export { default as OperacionesTercerasPersonasPage } from './pages/OperacionesTercerasPersonasPage';
export { default as OperacionesIntracomunitariasPage } from './pages/OperacionesIntracomunitariasPage';

// Components
export { default as ImpuestosCard } from './components/ImpuestosCard';
export { default as FiscalCalendar } from './components/FiscalCalendar';
export { default as IVAForm } from './components/IVAForm';
export { default as IRPFForm } from './components/IRPFForm';
export { default as RetencionesForm } from './components/RetencionesForm';
export { default as OperacionesForm } from './components/OperacionesForm';

// Contexts
export { ImpuestosProvider, useImpuestos } from './contexts/ImpuestosContext';
export { FiscalCalendarProvider, useFiscalCalendar } from './contexts/FiscalCalendarContext';
export { IVAProvider, useIVA } from './contexts/IVAContext';
export { IRPFProvider, useIRPF } from './contexts/IRPFContext';
export { RetencionesProvider, useRetenciones } from './contexts/RetencionesContext';
export { OperacionesProvider, useOperaciones } from './contexts/OperacionesContext';
