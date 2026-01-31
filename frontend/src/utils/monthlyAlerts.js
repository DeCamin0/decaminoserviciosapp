const STORAGE_PREFIX = 'decaminoMonthlyAlerts';
const NOTIFIED_PREFIX = 'decaminoMonthlyAlertsNotified';

const hasSessionStorage = typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

const buildStorageKey = (month) => `${STORAGE_PREFIX}:${month}`;
const buildNotifiedKey = (month) => `${NOTIFIED_PREFIX}:${month}`;

export const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const parseNumericValue = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

export const normalizeDetalles = (detalleData) => {
  if (!detalleData) {
    return [];
  }

  if (Array.isArray(detalleData)) {
    return detalleData;
  }

  const raw = detalleData.detalii_zilnice ?? detalleData.detaliiZilnice ?? detalleData.detalles;

  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('⚠️ monthlyAlerts.normalizeDetalles - invalid JSON string', err);
      return [];
    }
  }

  return [];
};

export const computeMonthlyAlertSummary = (detalleData) => {
  const detalles = normalizeDetalles(detalleData);
  if (!Array.isArray(detalles) || detalles.length === 0) {
    console.log('🔍 [AlertSummary] No detalles found');
    return { total: 0, positivos: 0, negativos: 0 };
  }

  let positivos = 0;
  let negativos = 0;
  const alertasDetalii = [];

  detalles.forEach((item, index) => {
    const fecha = item?.fecha || `dia_${index + 1}`;
    const deltaValue = parseNumericValue(item?.delta);
    const excedenteValue = parseNumericValue(item?.excedente);
    const excedentePositivo = parseNumericValue(item?.excedentePositivo);
    const excedenteNegativo = parseNumericValue(item?.excedenteNegativo);
    const plan = parseNumericValue(item?.plan);
    const fichado = parseNumericValue(item?.fichado);
    // Verifică dacă există regularizare confirmată pentru această zi
    const hasRegularizacionConfirmada = item?.has_regularizacion_confirmada === 1 || 
                                       item?.has_regularizacion_confirmada === true || 
                                       item?.has_regularizacion_confirmada === '1' ||
                                       item?.has_regularizacion_confirmada === 1.0;

    // Debug: log pentru zilele cu delta != 0
    if (deltaValue !== 0 && deltaValue !== undefined && deltaValue !== null) {
      console.log(`🔍 [AlertSummary] Ziua ${fecha}: delta=${deltaValue}, has_regularizacion_confirmada=${item?.has_regularizacion_confirmada} (type: ${typeof item?.has_regularizacion_confirmada})`);
    }

    // IMPORTANT: Excludem zilele care au regularizări confirmate
    if (hasRegularizacionConfirmada) {
      console.log(`✅ [AlertSummary] Ziua ${fecha} are regularizare confirmată (${item?.has_regularizacion_confirmada}) - excludem din alerte`);
      return;
    }

    const candidate =
      (Number.isFinite(deltaValue) ? deltaValue : undefined) ??
      (Number.isFinite(excedenteValue) ? excedenteValue : undefined) ??
      (Number.isFinite(excedentePositivo) ? excedentePositivo : undefined) ??
      (Number.isFinite(excedenteNegativo) ? excedenteNegativo : undefined);

    if (!Number.isFinite(candidate) || candidate === 0) {
      return;
    }

    // Ignorăm alertele foarte mici (sub 0.1 ore = 6 minute)
    if (Math.abs(candidate) < 0.1) {
      console.log(`⚠️ [AlertSummary] Ignorăm alerta mică pentru ${fecha}: delta=${candidate} (sub 0.1 ore = 6 minute)`);
      return;
    }

    // Excludem ziua de azi dacă nu există fichajes (tura nu a început încă)
    const today = new Date().toISOString().split('T')[0];
    if (fecha === today && (!fichado || fichado === 0)) {
      console.log(`⚠️ [AlertSummary] Excludem ziua de azi ${fecha} - tura nu a început încă (fichado=${fichado})`);
      return;
    }

    const alertaInfo = {
      fecha,
      plan: Number.isFinite(plan) ? plan : null,
      fichado: Number.isFinite(fichado) ? fichado : null,
      delta: Number.isFinite(deltaValue) ? deltaValue : null,
      excedente: Number.isFinite(excedenteValue) ? excedenteValue : null,
      candidate,
      tipo: candidate > 0 ? 'exceso' : 'deficit'
    };

    if (candidate > 0) {
      positivos += 1;
      alertasDetalii.push(alertaInfo);
    } else {
      negativos += 1;
      alertasDetalii.push(alertaInfo);
    }
  });

  console.log('📊 [AlertSummary] Calculated summary:', {
    total: positivos + negativos,
    positivos,
    negativos,
    detalles: alertasDetalii
  });
  
  // Log detaliat pentru fiecare alerta
  console.log('📋 [AlertSummary] Detalii complete pentru fiecare alerta:');
  alertasDetalii.forEach((alerta, idx) => {
    console.log(`  ${idx + 1}. ${alerta.fecha} - ${alerta.tipo}:`, {
      plan: alerta.plan,
      fichado: alerta.fichado,
      delta: alerta.delta,
      excedente: alerta.excedente,
      candidate: alerta.candidate
    });
  });

  return {
    total: positivos + negativos,
    positivos,
    negativos
  };
};

export const getStoredMonthlyAlerts = (month) => {
  if (!hasSessionStorage || !month) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(buildStorageKey(month));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (err) {
    console.warn('⚠️ monthlyAlerts.getStoredMonthlyAlerts - invalid data, resetting', err);
    window.sessionStorage.removeItem(buildStorageKey(month));
  }

  return null;
};

export const storeMonthlyAlerts = (month, summary) => {
  if (!hasSessionStorage || !month) {
    return;
  }

  if (!summary) {
    window.sessionStorage.removeItem(buildStorageKey(month));
    return;
  }

  const payload = {
    summary,
    timestamp: Date.now()
  };

  try {
    window.sessionStorage.setItem(buildStorageKey(month), JSON.stringify(payload));
  } catch (err) {
    console.warn('⚠️ monthlyAlerts.storeMonthlyAlerts - unable to persist summary', err);
  }
};

export const clearStoredMonthlyAlerts = (month) => {
  if (!hasSessionStorage || !month) {
    return;
  }
  window.sessionStorage.removeItem(buildStorageKey(month));
};

export const isMonthlyAlertsNotified = (month) => {
  if (!hasSessionStorage || !month) {
    return false;
  }
  return window.sessionStorage.getItem(buildNotifiedKey(month)) === 'true';
};

export const markMonthlyAlertsNotified = (month) => {
  if (!hasSessionStorage || !month) {
    return;
  }
  try {
    window.sessionStorage.setItem(buildNotifiedKey(month), 'true');
  } catch (err) {
    console.warn('⚠️ monthlyAlerts.markMonthlyAlertsNotified - unable to persist flag', err);
  }
};

export const resetMonthlyAlertsNotified = (month) => {
  if (!hasSessionStorage || !month) {
    return;
  }
  window.sessionStorage.removeItem(buildNotifiedKey(month));
};

export const clearAllMonthlyAlertsNotified = () => {
  if (!hasSessionStorage) {
    return;
  }
  Object.keys(window.sessionStorage).forEach((key) => {
    if (key.startsWith(NOTIFIED_PREFIX)) {
      window.sessionStorage.removeItem(key);
    }
  });
};

// Cache pentru a preveni fetch-uri duplicate simultane
const pendingFetches = new Map();

export const fetchMonthlyAlerts = async ({
  empleadoId,
  empleadoNombre,
  month
}) => {
  if (!empleadoId || !empleadoNombre || !month) {
    return { data: null, summary: { total: 0, positivos: 0, negativos: 0 } };
  }

  // Previne fetch-uri duplicate simultane pentru aceeași lună
  const cacheKey = `${empleadoId}-${month}`;
  if (pendingFetches.has(cacheKey)) {
    if (import.meta.env.DEV) {
      console.log('⏭️ [MonthlyAlerts] Fetch already in progress, reusing promise:', cacheKey);
    }
    return pendingFetches.get(cacheKey);
  }

  const fetchPromise = (async () => {
    try {
      // Folosim direct endpoint-ul resumen care returnează datele procesate cu delta calculat
      const { routes } = await import('./routes');
      const token = localStorage.getItem('auth_token');
      const url = `${routes.getMonthlyAlertsResumen}?tipo=mensual&lunaselectata=${month}&t=${Date.now()}`;
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      if (import.meta.env.DEV) {
        console.log('🔍 [MonthlyAlerts] Fetching resumen from new backend:', url);
      }
    
    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      console.warn('⚠️ [MonthlyAlerts] Request failed. Status:', response.status, response.statusText);
      const emptySummary = { total: 0, positivos: 0, negativos: 0 };
      storeMonthlyAlerts(month, emptySummary);
      return { data: null, summary: emptySummary };
    }

    const text = await response.text();
    if (!text) {
      console.warn('⚠️ [MonthlyAlerts] Empty response from backend');
      const emptySummary = { total: 0, positivos: 0, negativos: 0 };
      storeMonthlyAlerts(month, emptySummary);
      return { data: null, summary: emptySummary };
    }

    const data = JSON.parse(text);
    console.log('✅ [MonthlyAlerts] Resumen data received:', Array.isArray(data) ? `${data.length} empleados` : 'non-array response');

    // Găsim empleado-ul specificat
    let empleado = null;
    if (Array.isArray(data)) {
      empleado = data.find(emp => {
        const codigo = emp.CODIGO || emp.codigo || emp.empleadoId || emp.id;
        return `${codigo}` === `${empleadoId}`;
      });
    }

    if (!empleado) {
      console.warn(`⚠️ [MonthlyAlerts] Empleado ${empleadoId} not found in resumen response`);
      const emptySummary = { total: 0, positivos: 0, negativos: 0 };
      storeMonthlyAlerts(month, emptySummary);
      return { data: null, summary: emptySummary };
    }

    // Extragem detalii_zilnice
    let detalii = empleado.detalii_zilnice || empleado.detaliiZilnice || [];
    
    // Parse detalii_zilnice dacă este string
    if (typeof detalii === 'string') {
      try {
        detalii = JSON.parse(detalii);
      } catch (e) {
        console.warn('⚠️ [MonthlyAlerts] Error parsing detalii_zilnice:', e);
        detalii = [];
      }
    }

    if (!Array.isArray(detalii)) {
      console.warn('⚠️ [MonthlyAlerts] detalii_zilnice is not an array');
      detalii = [];
    }

    // Filtrează doar zilele până la data curentă (include ziua curentă)
    // Folosim timezone local, nu UTC
    const today = new Date();
    const year = today.getFullYear();
    const monthNum = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${monthNum}-${day}`; // Format: YYYY-MM-DD (timezone local)
    
    const detaliiPanaAstazi = detalii.filter(d => {
      if (!d?.fecha) return false;
      const fechaStr = typeof d.fecha === 'string' ? d.fecha.split('T')[0] : d.fecha;
      return fechaStr <= todayStr; // <= pentru a include ziua curentă
    });

    console.log(`✅ [MonthlyAlerts] Found ${detalii.length} zile in detalii_zilnice (${detaliiPanaAstazi.length} până astăzi ${todayStr}) for empleado ${empleadoId}`);
    
    // Log toate zilele disponibile (după filtrare) pentru debugging
    console.log('📅 [MonthlyAlerts] Toate zilele disponibile (până astăzi):', detaliiPanaAstazi.map(d => ({
      fecha: d.fecha,
      plan: d.plan,
      fichado: d.fichado,
      delta: d.delta
    })));
    
    // Folosim doar zilele până astăzi (include ziua curentă)
    detalii = detaliiPanaAstazi;
    
    // Log toate zilele cu delta != 0 pentru debugging
    const zileCuDelta = detalii.filter(d => {
      const delta = parseNumericValue(d?.delta);
      return Number.isFinite(delta) && delta !== 0;
    });
    console.log(`📊 [MonthlyAlerts] Zile cu delta != 0: ${zileCuDelta.length} din ${detalii.length}`);
    console.log('📋 [MonthlyAlerts] Toate zilele cu delta != 0:', zileCuDelta.map(d => ({
      fecha: d.fecha,
      plan: d.plan,
      fichado: d.fichado,
      delta: d.delta
    })));
    
    // Log zilele cu delta = 0 sau lipsă pentru debugging
    const zileFaraDelta = detalii.filter(d => {
      const delta = parseNumericValue(d?.delta);
      return !Number.isFinite(delta) || delta === 0;
    });
    console.log(`📊 [MonthlyAlerts] Zile fără alerta (delta = 0 sau lipsă): ${zileFaraDelta.length}`);
    if (zileFaraDelta.length > 0) {
      console.log('📋 [MonthlyAlerts] Zile fără alerta:', zileFaraDelta.slice(0, 10).map(d => ({
        fecha: d.fecha,
        plan: d.plan,
        fichado: d.fichado,
        delta: d.delta
      })));
    }
    
    // Debug: verifică dacă există zile cu regularizări în detalii
    const zileCuRegularizare = detalii.filter(d => 
      d?.has_regularizacion_confirmada === 1 || 
      d?.has_regularizacion_confirmada === true || 
      d?.has_regularizacion_confirmada === '1'
    );
    console.log(`🔍 [MonthlyAlerts] Found ${zileCuRegularizare.length} zile cu regularizări confirmate din ${detalii.length} total:`, 
      zileCuRegularizare.map(d => ({ fecha: d.fecha, has_regularizacion: d.has_regularizacion_confirmada }))
    );
    
    // Normalizează și calculează summary
    const normalized = normalizeDetalles(detalii);
    const summary = computeMonthlyAlertSummary(detalii);

      if (import.meta.env.DEV) {
        console.log('✅ [MonthlyAlerts] Calculated summary:', summary);
      }

      storeMonthlyAlerts(month, summary);

      return { data: normalized, summary };
    } catch (error) {
      console.error('❌ fetchMonthlyAlerts - error verificando alertas mensuales:', error);
      return { data: null, summary: null };
    } finally {
      // Șterge cache-ul după ce fetch-ul s-a terminat
      pendingFetches.delete(cacheKey);
    }
  })();

  pendingFetches.set(cacheKey, fetchPromise);
  return fetchPromise;
};




