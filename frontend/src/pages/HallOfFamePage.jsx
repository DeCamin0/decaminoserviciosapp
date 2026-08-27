import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { useApi } from '../hooks/useApi';
import { Button, PageHeader, SegmentedControl, AlertBanner } from '../components/ui';
import Notification from '../components/ui/Notification.jsx';
import { routes } from '../utils/routes.js';
import { Trophy, Calendar, RefreshCw, Gift } from 'lucide-react';
import {
  formatHofScore,
  getMonthName,
  getShortMonthName,
  HofLoadingState,
  HofEmptyState,
  HallOfFamePodium,
  HallOfFameRankingList,
  HallOfFamePremioCard,
  HallOfFameHowItWorks,
  HallOfFameBreakdownModal,
  HallOfFamePremioModal,
} from '../components/hallOfFame';

const HallOfFamePage = () => {
  const { user: authUser } = useAuth();
  const { callApi } = useApi();
  const [loading, setLoading] = useState(false);

  const userGrupo = (authUser?.GRUPO || authUser?.grupo || '').trim();
  const canCalculate = userGrupo === 'Developer';

  const [ranking, setRanking] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [limit, setLimit] = useState(canCalculate ? 0 : 15);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState('ranking');
  const [premios, setPremios] = useState([]);
  const [showPremioModal, setShowPremioModal] = useState(false);
  const [selectedEmployeeForPremio, setSelectedEmployeeForPremio] = useState(null);
  const [premioFecha, setPremioFecha] = useState('');
  const [rankingTrimestral, setRankingTrimestral] = useState([]);
  const [selectedTrimestre, setSelectedTrimestre] = useState('');

  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(currentMonth);
    if (!canCalculate) setLimit(15);
  }, [canCalculate]);

  useEffect(() => {
    const initializeTrimestre = async () => {
      const now = new Date();
      const ano = now.getFullYear();
      const month = now.getMonth() + 1;
      const trimestreNum = Math.ceil(month / 3);
      const currentTrimestre = `Q${trimestreNum}-${ano}`;
      try {
        const result = await callApi(routes.getHallOfFameTrimestralLatest, { method: 'GET' });
        if (result.success && result.trimestre) {
          setSelectedTrimestre(result.trimestre);
        } else {
          setSelectedTrimestre(currentTrimestre);
        }
      } catch {
        setSelectedTrimestre(currentTrimestre);
      }
    };
    initializeTrimestre();
  }, [callApi]);

  const fetchRanking = useCallback(async () => {
    if (!selectedMonth) return;
    setLoading(true);
    try {
      const url = `${routes.getHallOfFame}?mes=${selectedMonth}&limit=${limit}`;
      const result = await callApi(url, { method: 'GET' });
      if (result.success && result.data?.ranking) {
        setRanking(result.data.ranking);
      } else if (result.success && result.ranking) {
        setRanking(result.ranking);
      }
    } catch (error) {
      console.error('Error fetching ranking:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, limit, callApi]);

  const fetchBreakdown = async (codigo) => {
    if (!codigo || !selectedMonth) return;
    if (!canCalculate) {
      setNotification({
        type: 'error',
        title: 'Acceso restringido',
        message: 'Solo los administradores pueden ver los detalles del breakdown',
        duration: 3000,
      });
      return;
    }
    setLoading(true);
    try {
      const url = `${routes.getHallOfFameEmployee(codigo)}?mes=${selectedMonth}`;
      const result = await callApi(url, { method: 'GET' });
      if (result.success && result.data?.data) {
        setBreakdown(result.data.data);
        setSelectedEmployee(codigo);
      } else if (result.success && result.data) {
        setBreakdown(result.data);
        setSelectedEmployee(codigo);
      }
    } catch (error) {
      console.error('Error fetching breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateScores = async () => {
    if (!selectedMonth) return;
    setLoading(true);
    try {
      const url = `${routes.calculateHallOfFame}?mes=${selectedMonth}`;
      const result = await callApi(url, { method: 'POST' });
      if (result.success) {
        const processed = result.data?.processed || result.processed || 0;
        setNotification({
          type: 'success',
          title: 'Cálculo completado',
          message: `Se han calculado ${processed} scores para ${selectedMonth}`,
          duration: 4000,
        });
        fetchRanking();
      } else {
        const errMsg = String(result.error || result.message || '');
        const isTimeout = /aborted|timeout|AbortError/i.test(errMsg);
        setNotification({
          type: 'error',
          title: 'Error al calcular',
          message: isTimeout
            ? 'El cálculo tarda más de lo esperado. Espera unos minutos y vuelve a intentarlo.'
            : errMsg || 'No se pudieron calcular los scores',
          duration: 8000,
        });
      }
    } catch (error) {
      const errMsg = String(error.message || error.name || '');
      const isTimeout = error.name === 'AbortError' || /aborted|timeout/i.test(errMsg);
      setNotification({
        type: 'error',
        title: 'Error al calcular',
        message: isTimeout
          ? 'El cálculo tarda más de lo esperado. Espera unos minutos y vuelve a intentarlo.'
          : errMsg || 'Ocurrió un error al calcular los scores',
        duration: 8000,
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateEmployeeScore = async (codigo, e) => {
    e.stopPropagation();
    if (!selectedMonth || !codigo) {
      setNotification({ type: 'error', title: 'Error', message: 'Por favor selecciona un mes primero', duration: 3000 });
      return;
    }
    setLoading(true);
    try {
      const url = `${routes.calculateHallOfFameEmployee(codigo)}?mes=${selectedMonth}`;
      const result = await callApi(url, { method: 'POST' });
      if (result.success) {
        setNotification({ type: 'success', title: 'Cálculo completado', message: `Score recalculado para ${codigo}`, duration: 3000 });
        fetchRanking();
      } else {
        setNotification({ type: 'error', title: 'Error al calcular', message: result.message || 'No se pudo calcular el score', duration: 5000 });
      }
    } catch (error) {
      setNotification({ type: 'error', title: 'Error al calcular', message: error.message || 'Ocurrió un error', duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const calculateTrimestralScores = async () => {
    setLoading(true);
    try {
      const url = `${routes.calculateHallOfFameTrimestral}?trimestre=${selectedTrimestre}`;
      const result = await callApi(url, { method: 'POST' });
      if (result.success) {
        setNotification({
          type: 'success',
          title: 'Éxito',
          message: `Calculados ${result.processed} scores trimestrales para ${selectedTrimestre}`,
          duration: 3000,
        });
        fetchRankingTrimestral();
      }
    } catch {
      setNotification({ type: 'error', title: 'Error', message: 'Error al calcular scores trimestrales', duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMonth) fetchRanking();
  }, [selectedMonth, fetchRanking]);

  const fetchPremios = useCallback(async () => {
    setLoading(true);
    try {
      const result = await callApi(routes.getPremios, { method: 'GET' });
      if (result.success && result.premios) {
        setPremios(result.premios);
      } else if (result.success && result.data?.premios) {
        setPremios(result.data.premios);
      }
    } catch {
      setNotification({ type: 'error', title: 'Error', message: 'No se pudieron cargar los premios', duration: 3000 });
    } finally {
      setLoading(false);
    }
  }, [callApi]);

  const fetchRankingTrimestral = useCallback(async () => {
    if (!selectedTrimestre) return;
    setLoading(true);
    try {
      const url = `${routes.getHallOfFameTrimestral}?trimestre=${selectedTrimestre}&limit=${limit}`;
      const result = await callApi(url, { method: 'GET' });
      if (result.success && result.data?.ranking) {
        setRankingTrimestral(result.data.ranking);
      } else if (result.success && result.ranking) {
        setRankingTrimestral(result.ranking);
      } else {
        setRankingTrimestral([]);
      }
    } catch {
      setRankingTrimestral([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTrimestre, limit, callApi]);

  useEffect(() => {
    if (activeTab === 'premios') fetchPremios();
    else if (activeTab === 'trimestral') fetchRankingTrimestral();
  }, [activeTab, fetchPremios, fetchRankingTrimestral]);

  const createPremio = async () => {
    if (!selectedEmployeeForPremio || !premioFecha) {
      setNotification({ type: 'error', title: 'Error', message: 'Por favor selecciona una fecha', duration: 3000 });
      return;
    }
    setLoading(true);
    try {
      const result = await callApi(routes.createPremio, {
        method: 'POST',
        body: JSON.stringify({
          codigo: selectedEmployeeForPremio.empleado_codigo || selectedEmployeeForPremio.CODIGO,
          nombre: selectedEmployeeForPremio.empleadoNombre || selectedEmployeeForPremio.NOMBRE,
          fecha: premioFecha,
          mesPremio: selectedMonth,
        }),
      });
      if (result.success) {
        setNotification({
          type: 'success',
          title: 'Premio creado',
          message: `Se ha otorgado un día libre a ${selectedEmployeeForPremio.empleadoNombre || selectedEmployeeForPremio.NOMBRE}`,
          duration: 4000,
        });
        setShowPremioModal(false);
        setSelectedEmployeeForPremio(null);
        setPremioFecha('');
        fetchPremios();
      } else {
        setNotification({ type: 'error', title: 'Error', message: result.message || 'No se pudo crear el premio', duration: 5000 });
      }
    } catch (error) {
      setNotification({ type: 'error', title: 'Error', message: error.message || 'Ocurrió un error al crear el premio', duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const openPremioModal = (entry) => {
    setSelectedEmployeeForPremio(entry);
    setShowPremioModal(true);
  };

  const closePremioModal = () => {
    setShowPremioModal(false);
    setSelectedEmployeeForPremio(null);
    setPremioFecha('');
  };

  const closeBreakdown = () => {
    setBreakdown(null);
    setSelectedEmployee(null);
  };

  const tabItems = useMemo(() => [
    { id: 'ranking', label: 'Ranking mensual', shortLabel: 'Mensual', icon: <Trophy className="w-4 h-4" aria-hidden /> },
    { id: 'premios', label: 'Premios', shortLabel: 'Premios', icon: <Gift className="w-4 h-4" aria-hidden /> },
    { id: 'trimestral', label: 'Trimestral', shortLabel: 'Trim.', icon: <Calendar className="w-4 h-4" aria-hidden /> },
  ], []);

  const trimestreOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    for (let year = currentYear; year >= currentYear - 1; year -= 1) {
      for (let q = 4; q >= 1; q -= 1) {
        options.push(`Q${q}-${year}`);
      }
    }
    return options;
  }, []);

  const previousMonths = useMemo(() => {
    if (!selectedMonth) return [];
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);
    const months = [];
    for (let i = 1; i <= 3; i += 1) {
      const d = new Date(currentYear, currentMonthNum - 1 - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  }, [selectedMonth]);

  const previousTrimestres = useMemo(() => {
    if (!selectedTrimestre) return [];
    const match = selectedTrimestre.match(/Q(\d)-(\d{4})/);
    if (!match) return [];
    let q = parseInt(match[1], 10);
    let year = parseInt(match[2], 10);
    const list = [];
    for (let i = 1; i <= 3; i += 1) {
      q -= 1;
      while (q <= 0) { q += 4; year -= 1; }
      list.push(`Q${q}-${year}`);
    }
    return list;
  }, [selectedTrimestre]);

  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const currentTrimestreKey = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}-${new Date().getFullYear()}`;

  const kpiSummary = useMemo(() => {
    const list = activeTab === 'trimestral' ? rankingTrimestral : ranking;
    if (!list.length) return null;
    return {
      total: list.length,
      leader: list[0]?.empleadoNombre || list[0]?.empleado_codigo,
      topScore: formatHofScore(list[0]?.score_final),
    };
  }, [activeTab, ranking, rankingTrimestral]);

  return (
    <div className="hall-of-fame-page app-page">
      <PageHeader
        title="Salón de la Fama"
        subtitle="Clasificación mensual y trimestral de empleados"
        backTo="/inicio"
        backTitle="Volver a Inicio"
      />

      <AlertBanner variant="info" title="Reconocimiento del equipo" compact className="hof-intro-banner">
        Este espacio refleja resultados basados en indicadores de trabajo y actitud profesional.
        Puede vincularse a reconocimientos y premios internos.
      </AlertBanner>

      <span className="hof-dev-badge">Funcionalidad en evolución</span>

      <SegmentedControl
        items={tabItems}
        value={activeTab}
        onChange={setActiveTab}
        className="hof-page__tabs"
      />

      {canCalculate && activeTab !== 'trimestral' && (
        <section className="hof-filters app-card">
          <div className="hof-filters__grid">
            <label className="hof-filter-field">
              <span className="hof-filter-field__label">Mes</span>
              <input
                id="hall-of-fame-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className="hof-input"
              />
            </label>
            <label className="hof-filter-field">
              <span className="hof-filter-field__label">Top</span>
              <select
                id="hall-of-fame-top"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                className="hof-input"
              >
                <option value={10}>Top 10</option>
                <option value={20}>Top 20</option>
                <option value={50}>Top 50</option>
                <option value={100}>Top 100</option>
                <option value={0}>Todos</option>
              </select>
            </label>
          </div>
          <Button type="button" variant="primary" size="sm" className="min-h-[44px]" onClick={calculateScores} disabled={loading}>
            <RefreshCw className={`w-4 h-4${loading ? ' animate-spin' : ''}`} aria-hidden />
            Calcular scores
          </Button>
        </section>
      )}

      {canCalculate && activeTab === 'trimestral' && (
        <section className="hof-filters app-card">
          <div className="hof-filters__grid">
            <label className="hof-filter-field">
              <span className="hof-filter-field__label">Trimestre</span>
              <select
                id="hall-of-fame-trimestre"
                value={selectedTrimestre}
                onChange={(e) => setSelectedTrimestre(e.target.value)}
                className="hof-input"
              >
                {trimestreOptions.map((t) => (
                  <option key={t} value={t}>{t.replace('-', ' ')}</option>
                ))}
              </select>
            </label>
            <label className="hof-filter-field">
              <span className="hof-filter-field__label">Top</span>
              <select
                id="hall-of-fame-top-trim"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                className="hof-input"
              >
                <option value={10}>Top 10</option>
                <option value={20}>Top 20</option>
                <option value={50}>Top 50</option>
                <option value={100}>Top 100</option>
                <option value={0}>Todos</option>
              </select>
            </label>
          </div>
          <Button type="button" variant="primary" size="sm" className="min-h-[44px]" onClick={calculateTrimestralScores} disabled={loading}>
            <RefreshCw className={`w-4 h-4${loading ? ' animate-spin' : ''}`} aria-hidden />
            Calcular trimestral
          </Button>
        </section>
      )}

      {!canCalculate && activeTab === 'ranking' && selectedMonth && (
        <section className="hof-period-nav app-card">
          <p className="hof-period-nav__label">
            Mostrando: <strong>{getMonthName(selectedMonth)}</strong>
          </p>
          <div className="hof-period-nav__chips">
            {selectedMonth === currentMonthKey ? (
              previousMonths.map((month) => (
                <Button key={month} type="button" variant="secondary" size="sm" onClick={() => setSelectedMonth(month)}>
                  {getShortMonthName(month)}
                </Button>
              ))
            ) : (
              <>
                <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedMonth(currentMonthKey)}>
                  Volver a actual
                </Button>
                {previousMonths.map((month) => (
                  <Button
                    key={month}
                    type="button"
                    variant={selectedMonth === month ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setSelectedMonth(month)}
                  >
                    {getShortMonthName(month)}
                  </Button>
                ))}
              </>
            )}
          </div>
        </section>
      )}

      {!canCalculate && activeTab === 'trimestral' && selectedTrimestre && (
        <section className="hof-period-nav app-card">
          <p className="hof-period-nav__label">
            Mostrando: <strong>{selectedTrimestre}</strong>
          </p>
          <div className="hof-period-nav__chips">
            {selectedTrimestre === currentTrimestreKey ? (
              previousTrimestres.map((t) => (
                <Button key={t} type="button" variant="secondary" size="sm" onClick={() => setSelectedTrimestre(t)}>
                  {t}
                </Button>
              ))
            ) : (
              <>
                <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedTrimestre(currentTrimestreKey)}>
                  Volver a actual
                </Button>
                {previousTrimestres.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={selectedTrimestre === t ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setSelectedTrimestre(t)}
                  >
                    {t}
                  </Button>
                ))}
              </>
            )}
          </div>
        </section>
      )}

      {kpiSummary && activeTab !== 'premios' ? (
        <section className="hof-kpi-strip">
          <div className="hof-kpi-strip__item">
            <span className="hof-kpi-strip__label">Evaluados</span>
            <strong>{kpiSummary.total}</strong>
          </div>
          <div className="hof-kpi-strip__item">
            <span className="hof-kpi-strip__label">Líder</span>
            <strong className="truncate">{kpiSummary.leader}</strong>
          </div>
          <div className="hof-kpi-strip__item">
            <span className="hof-kpi-strip__label">Mejor puntuación</span>
            <strong>{kpiSummary.topScore}</strong>
          </div>
        </section>
      ) : null}

      {activeTab === 'premios' && (
        loading ? <HofLoadingState /> : premios.length === 0 ? (
          <HofEmptyState
            icon={Gift}
            title="Aún no hay premios otorgados"
            message="Los premios otorgados a los empleados aparecerán aquí."
          />
        ) : (
          <div className="hof-premios-list">
            {premios.map((premio, index) => (
              <HallOfFamePremioCard key={premio.id || index} premio={premio} />
            ))}
          </div>
        )
      )}

      {activeTab === 'trimestral' && (
        loading ? <HofLoadingState /> : rankingTrimestral.length === 0 ? (
          <HofEmptyState
            title="Aún no hay datos para este trimestre"
            message="Cuando se calculen los resultados trimestrales, aquí aparecerán los empleados destacados."
            hint="Los scores trimestrales muestran el promedio de los últimos trimestres."
            action={canCalculate ? (
              <Button type="button" variant="primary" size="sm" onClick={calculateTrimestralScores} disabled={loading}>
                <RefreshCw className={`w-4 h-4${loading ? ' animate-spin' : ''}`} aria-hidden />
                Calcular trimestral
              </Button>
            ) : null}
          />
        ) : (
          <>
            <HallOfFamePodium
              ranking={rankingTrimestral}
              title={`Top 3 — ${selectedTrimestre}`}
              canCalculate={false}
              loading={loading}
              onSelectEmployee={() => {}}
              onRecalculate={() => {}}
              onPremio={() => {}}
              showKpi={false}
            />
            <HallOfFameRankingList
              items={rankingTrimestral}
              variant="trimestral"
              skipTopThree={rankingTrimestral.length >= 3}
              canCalculate={false}
            />
          </>
        )
      )}

      {activeTab === 'ranking' && (
        loading ? <HofLoadingState /> : ranking.length === 0 ? (
          <HofEmptyState
            title="Aún no hay datos para este mes"
            message="Cuando se calculen los resultados, aquí aparecerán los empleados destacados."
            action={canCalculate ? (
              <Button type="button" variant="primary" size="sm" onClick={calculateScores} disabled={loading}>
                <RefreshCw className={`w-4 h-4${loading ? ' animate-spin' : ''}`} aria-hidden />
                Calcular scores
              </Button>
            ) : null}
          />
        ) : (
          <>
            <HallOfFamePodium
              ranking={ranking}
              title={`Top 3 — ${getMonthName(selectedMonth)}`}
              canCalculate={canCalculate}
              loading={loading}
              onSelectEmployee={fetchBreakdown}
              onRecalculate={calculateEmployeeScore}
              onPremio={openPremioModal}
              showKpi
            />
            <HallOfFameRankingList
              items={ranking.slice(3)}
              variant="monthly"
              canCalculate={canCalculate}
              loading={loading}
              onSelectEmployee={fetchBreakdown}
              onRecalculate={calculateEmployeeScore}
              onPremio={openPremioModal}
            />
            <HallOfFameHowItWorks />
          </>
        )
      )}

      <HallOfFameBreakdownModal
        isOpen={Boolean(breakdown && selectedEmployee)}
        breakdown={breakdown}
        selectedEmployee={selectedEmployee}
        onClose={closeBreakdown}
      />

      <HallOfFamePremioModal
        isOpen={showPremioModal}
        employee={selectedEmployeeForPremio}
        premioFecha={premioFecha}
        loading={loading}
        onClose={closePremioModal}
        onChangeFecha={setPremioFecha}
        onConfirm={createPremio}
      />

      {notification ? (
        <Notification
          type={notification.type}
          title={notification.title}
          message={notification.message}
          duration={notification.duration}
          onClose={() => setNotification(null)}
        />
      ) : null}
    </div>
  );
};

export default HallOfFamePage;
