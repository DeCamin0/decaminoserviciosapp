import { lazy, Suspense } from 'react';
import { SectionLoading } from '../ui/LoadingStates';

// Lazy load heavy Maps components
const MapView = lazy(() => import('../MapView'));
const LocationPicker = lazy(() => import('../LocationPicker'));
const RoutePlanner = lazy(() => import('../RoutePlanner'));

// Lazy Maps components with loading states
export const LazyMapView = (props) => (
  <Suspense fallback={<SectionLoading title="Se încarcă harta..." />}>
    <MapView {...props} />
  </Suspense>
);

export const LazyLocationPicker = (props) => (
  <Suspense fallback={<SectionLoading title="Se încarcă selectorul de locație..." />}>
    <LocationPicker {...props} />
  </Suspense>
);

export const LazyRoutePlanner = (props) => (
  <Suspense fallback={<SectionLoading title="Se încarcă planificatorul de rute..." />}>
    <RoutePlanner {...props} />
  </Suspense>
);

export default {
  LazyMapView,
  LazyLocationPicker,
  LazyRoutePlanner
};