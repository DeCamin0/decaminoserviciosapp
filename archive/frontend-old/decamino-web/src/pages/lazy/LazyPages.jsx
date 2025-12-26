import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLoading } from '../../components/ui/LoadingStates';

// Lazy load heavy pages - doar paginile mari
const FichajePage = lazy(() => import('../Fichaje'));
const EmpleadosPage = lazy(() => import('../EmpleadosPage'));
const SolicitudesPage = lazy(() => import('../SolicitudesPage'));
const CuadrantesPage = lazy(() => import('../CuadrantesPage'));
const CuadrantesEmpleadoPage = lazy(() => import('../CuadrantesEmpleadoPage'));
const DocumentosPage = lazy(() => import('../DocumentosPage'));
const DocumentosEmpleadosPage = lazy(() => import('../DocumentosEmpleadosPage'));
const AprobacionesPage = lazy(() => import('../AprobacionesPage'));
const EstadisticasPage = lazy(() => import('../EstadisticasPage'));
const EstadisticasCuadrantesPage = lazy(() => import('../EstadisticasCuadrantesPage'));
const EstadisticasEmpleadosPage = lazy(() => import('../EstadisticasEmpleadosPage'));
const EstadisticasFichajesPage = lazy(() => import('../EstadisticasFichajesPage'));
const ClientesPage = lazy(() => import('../ClientesPage'));
const ClienteDetallePage = lazy(() => import('../ClienteDetallePage'));
const ProveedorDetallePage = lazy(() => import('../ProveedorDetallePage'));
const AdminDashboard = lazy(() => import('../AdminDashboard'));
const InspeccionesPage = lazy(() => import('../InspeccionesPage'));
const MisInspeccionesPage = lazy(() => import('../MisInspeccionesPage'));
const TareasPage = lazy(() => import('../TareasPage'));
const ControlCorreoPage = lazy(() => import('../ControlCorreoPage'));
const IncidenciasPage = lazy(() => import('../IncidenciasPage'));
const CuadernosPage = lazy(() => import('../CuadernosPage'));
const CuadernosPorCentroPage = lazy(() => import('../CuadernosPorCentroPage'));
const TareasCentroPage = lazy(() => import('../centro/TareasCentroPage'));
const PaqueteriaCentroPage = lazy(() => import('../centro/PaqueteriaCentroPage'));
const IncidenciasCentroPage = lazy(() => import('../centro/IncidenciasCentroPage'));
const PedidosPage = lazy(() => import('../PedidosPage'));
const EmpleadoPedidosPage = lazy(() => import('../EmpleadoPedidosPage'));

// Lazy page components with loading states
export const LazyFichajePage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('fichajes.loading')} />}>
      <FichajePage {...props} />
    </Suspense>
  );
};

export const LazyEmpleadosPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('empleados.loading')} />}>
      <EmpleadosPage {...props} />
    </Suspense>
  );
};

export const LazySolicitudesPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('solicitudes.loading')} />}>
      <SolicitudesPage {...props} />
    </Suspense>
  );
};

export const LazyCuadrantesPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('cuadrantes.loading')} />}>
      <CuadrantesPage {...props} />
    </Suspense>
  );
};

export const LazyCuadrantesEmpleadoPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('cuadrantesEmpleado.loading')} />}>
      <CuadrantesEmpleadoPage {...props} />
    </Suspense>
  );
};

export const LazyDocumentosPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('documentos.loading')} />}>
      <DocumentosPage {...props} />
    </Suspense>
  );
};

export const LazyDocumentosEmpleadosPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('documentosEmpleados.loading')} />}>
      <DocumentosEmpleadosPage {...props} />
    </Suspense>
  );
};

export const LazyAprobacionesPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('aprobaciones.loading')} />}>
      <AprobacionesPage {...props} />
    </Suspense>
  );
};

export const LazyEstadisticasPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('estadisticas.loading')} />}>
      <EstadisticasPage {...props} />
    </Suspense>
  );
};

export const LazyEstadisticasCuadrantesPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('estadisticasCuadrantes.loading')} />}>
      <EstadisticasCuadrantesPage {...props} />
    </Suspense>
  );
};

export const LazyEstadisticasEmpleadosPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('estadisticasEmpleados.loading')} />}>
      <EstadisticasEmpleadosPage {...props} />
    </Suspense>
  );
};

export const LazyEstadisticasFichajesPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('estadisticasFichajes.loading')} />}>
      <EstadisticasFichajesPage {...props} />
    </Suspense>
  );
};

export const LazyClientesPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('clientes.loading')} />}>
      <ClientesPage {...props} />
    </Suspense>
  );
};

export const LazyClienteDetallePage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('clienteDetalle.loading')} />}>
      <ClienteDetallePage {...props} />
    </Suspense>
  );
};

export const LazyProveedorDetallePage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('proveedorDetalle.loading')} />}>
      <ProveedorDetallePage {...props} />
    </Suspense>
  );
};

export const LazyAdminDashboard = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('adminDashboard.loading')} />}>
      <AdminDashboard {...props} />
    </Suspense>
  );
};

export const LazyInspeccionesPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('inspecciones.loading')} />}>
      <InspeccionesPage {...props} />
    </Suspense>
  );
};

export const LazyMisInspeccionesPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('misInspecciones.loading')} />}>
      <MisInspeccionesPage {...props} />
    </Suspense>
  );
};

export const LazyTareasPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('tareas.loading')} />}>
      <TareasPage {...props} />
    </Suspense>
  );
};

export const LazyControlCorreoPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('controlCorreo.loading')} />}>
      <ControlCorreoPage {...props} />
    </Suspense>
  );
};

export const LazyIncidenciasPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('incidencias.loading')} />}>
      <IncidenciasPage {...props} />
    </Suspense>
  );
};

export const LazyCuadernosPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('cuadernos.loading')} />}>
      <CuadernosPage {...props} />
    </Suspense>
  );
};

export const LazyCuadernosPorCentroPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('cuadernosPorCentro.loading')} />}>
      <CuadernosPorCentroPage {...props} />
    </Suspense>
  );
};

export const LazyTareasCentroPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('tareasCentro.loading')} />}>
      <TareasCentroPage {...props} />
    </Suspense>
  );
};

export const LazyPaqueteriaCentroPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('paqueteriaCentro.loading')} />}>
      <PaqueteriaCentroPage {...props} />
    </Suspense>
  );
};

export const LazyIncidenciasCentroPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('incidenciasCentro.loading')} />}>
      <IncidenciasCentroPage {...props} />
    </Suspense>
  );
};

export const LazyPedidosPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('pedidos.loading')} />}>
      <PedidosPage {...props} />
    </Suspense>
  );
};

export const LazyEmpleadoPedidosPage = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PageLoading title={t('empleadoPedidos.loading')} />}>
      <EmpleadoPedidosPage {...props} />
    </Suspense>
  );
};

export default {
  LazyFichajePage,
  LazyEmpleadosPage,
  LazySolicitudesPage,
  LazyCuadrantesPage,
  LazyCuadrantesEmpleadoPage,
  LazyDocumentosPage,
  LazyDocumentosEmpleadosPage,
  LazyAprobacionesPage,
  LazyEstadisticasPage: LazyEstadisticasPage,
  LazyEstadisticasCuadrantesPage,
  LazyEstadisticasEmpleadosPage,
  LazyEstadisticasFichajesPage,
  LazyClientesPage,
  LazyClienteDetallePage,
  LazyProveedorDetallePage,
  LazyAdminDashboard,
  LazyInspeccionesPage,
  LazyMisInspeccionesPage,
  LazyTareasPage,
  LazyControlCorreoPage,
  LazyIncidenciasPage,
  LazyCuadernosPage,
  LazyCuadernosPorCentroPage,
  LazyTareasCentroPage,
  LazyPaqueteriaCentroPage,
  LazyIncidenciasCentroPage,
  LazyPedidosPage,
  LazyEmpleadoPedidosPage
};