import { lazy, Suspense } from 'react';
import { SectionLoading } from '../ui/LoadingStates';

// Lazy load heavy PDF components
const PDFViewer = lazy(() => import('../PDFViewer'));
const PDFGenerator = lazy(() => import('../PDFGenerator'));

// Lazy PDF components with loading states
export const LazyPDFViewer = (props) => (
  <Suspense fallback={<SectionLoading title="Se încarcă vizualizatorul PDF..." />}>
    <PDFViewer {...props} />
  </Suspense>
);

export const LazyPDFGenerator = (props) => (
  <Suspense fallback={<SectionLoading title="Se încarcă generatorul PDF..." />}>
    <PDFGenerator {...props} />
  </Suspense>
);

export default {
  LazyPDFViewer,
  LazyPDFGenerator
};