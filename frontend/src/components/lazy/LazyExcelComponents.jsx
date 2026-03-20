import { lazy, Suspense } from 'react';
import { SectionLoading } from '../ui/LoadingStates';

// Lazy load heavy Excel components
const ExcelExporter = lazy(() => import('../ExcelExporter'));
const ExcelImporter = lazy(() => import('../ExcelImporter'));
const ExcelViewer = lazy(() => import('../ExcelViewer'));

// Lazy Excel components with loading states
export const LazyExcelExporter = (props) => (
  <Suspense fallback={<SectionLoading title="Cargando exportador Excel..." />}>
    <ExcelExporter {...props} />
  </Suspense>
);

export const LazyExcelImporter = (props) => (
  <Suspense fallback={<SectionLoading title="Cargando importador Excel..." />}>
    <ExcelImporter {...props} />
  </Suspense>
);

export const LazyExcelViewer = (props) => (
  <Suspense fallback={<SectionLoading title="Cargando visor Excel..." />}>
    <ExcelViewer {...props} />
  </Suspense>
);

export default {
  LazyExcelExporter,
  LazyExcelImporter,
  LazyExcelViewer
};