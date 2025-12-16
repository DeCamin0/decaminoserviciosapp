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
    return { total: 0, positivos: 0, negativos: 0 };
  }

  let positivos = 0;
  let negativos = 0;

  detalles.forEach((item) => {
    const deltaValue = parseNumericValue(item?.delta);
    const excedenteValue = parseNumericValue(item?.excedente);
    const excedentePositivo = parseNumericValue(item?.excedentePositivo);
    const excedenteNegativo = parseNumericValue(item?.excedenteNegativo);

    const candidate =
      (Number.isFinite(deltaValue) ? deltaValue : undefined) ??
      (Number.isFinite(excedenteValue) ? excedenteValue : undefined) ??
      (Number.isFinite(excedentePositivo) ? excedentePositivo : undefined) ??
      (Number.isFinite(excedenteNegativo) ? excedenteNegativo : undefined);

    if (!Number.isFinite(candidate) || candidate === 0) {
      return;
    }

    if (candidate > 0) {
      positivos += 1;
    } else {
      negativos += 1;
    }
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

export const fetchMonthlyAlerts = async ({
  empleadoId,
  empleadoNombre,
  month,
  getUrl
}) => {
  if (!empleadoId || !empleadoNombre || !month || !getUrl) {
    return { data: null, summary: { total: 0, positivos: 0, negativos: 0 } };
  }

  try {
    const baseUrl = getUrl('/webhook/4d72fc30-1843-4473-9614-e06f8583f3b5');
    const url = `${baseUrl}?tipo=detallemensual&empleadoId=${encodeURIComponent(empleadoId)}&empleadoNombre=${encodeURIComponent(empleadoNombre)}&mes=${month}&lunaselectata=${month}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('⚠️ fetchMonthlyAlerts - no se pudieron obtener alertas. Status:', response.status);
      const emptySummary = { total: 0, positivos: 0, negativos: 0 };
      storeMonthlyAlerts(month, emptySummary);
      return { data: null, summary: emptySummary };
    }

    const text = await response.text();
    if (!text) {
      const emptySummary = { total: 0, positivos: 0, negativos: 0 };
      storeMonthlyAlerts(month, emptySummary);
      return { data: null, summary: emptySummary };
    }

    const data = JSON.parse(text);
    let normalized = normalizeDetalles(data);
    const hasDeltaFields = Array.isArray(normalized) && normalized.some(item => {
      const deltaValue = parseNumericValue(item?.delta);
      const excedenteValue = parseNumericValue(item?.excedente);
      return Number.isFinite(deltaValue) || Number.isFinite(excedenteValue);
    });

    let summary = computeMonthlyAlertSummary(data);

    if (!hasDeltaFields) {
      const detalle = await fetchEmployeeDetalleResumen({ empleadoId, month, getUrl });
      if (detalle) {
        normalized = detalle;
        summary = computeMonthlyAlertSummary(detalle);
      }
    }

    storeMonthlyAlerts(month, summary);

    return { data: normalized, summary };
  } catch (error) {
    console.error('❌ fetchMonthlyAlerts - error verificando alertas mensuales:', error);
    return { data: null, summary: null };
  }
};

const RESUMEN_ENDPOINT = '/webhook/b8a9d8ae-2485-4ba1-bd9b-108535b1a76b';

const fetchEmployeeDetalleResumen = async ({ empleadoId, month, getUrl }) => {
  try {
    const baseUrl = getUrl(RESUMEN_ENDPOINT);
    const url = `${baseUrl}?tipo=mensual&lunaselectata=${month}&t=${Date.now()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('⚠️ fetchEmployeeDetalleResumen - status:', response.status);
      return null;
    }

    const text = await response.text();
    if (!text) {
      return null;
    }

    const data = JSON.parse(text);
    let empleados = [];

    if (Array.isArray(data)) {
      empleados = data;
    } else if (data?.empleados && Array.isArray(data.empleados)) {
      empleados = data.empleados;
    } else if (Array.isArray(data?.[0]?.empleados)) {
      empleados = data[0].empleados;
    }

    if (!Array.isArray(empleados) || empleados.length === 0) {
      return null;
    }

    const empleado = empleados.find(emp => {
      const codigo = emp.CODIGO || emp.codigo || emp.empleadoId || emp.id;
      return `${codigo}` === `${empleadoId}`;
    });

    if (!empleado) {
      return null;
    }

    return empleado.detalii_zilnice || empleado.detaliiZilnice || [];
  } catch (error) {
    console.error('❌ fetchEmployeeDetalleResumen - error:', error);
    return null;
  }
};



