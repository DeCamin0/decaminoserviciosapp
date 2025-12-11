// Dev-only fetch regulator with rate limit + queue + backoff for n8n calls
// Keeps prod untouched; hook via installRegulatedFetch() in main.

const config = {
  enabled: typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'development',
  // Higher limits in dev to keep UX snappy but still protected
  maxBurst: 20,            // allow larger short bursts
  replenishPerSecond: 12,  // faster steady refill
  maxQueue: 500,           // prevent unbounded memory
  baseDelayMs: 150,        // slightly faster initial backoff
  maxRetries: 4,
  jitterMs: 150,
  logThreshold: 30,        // log when queue grows
  logIntervalMs: 2000      // throttle queue logs
};

const originalFetch = typeof window !== 'undefined' ? window.fetch : undefined;
let tokens = config.maxBurst;
const queue = [];
const metrics =
  (typeof window !== 'undefined' &&
    (window.__regulatedFetchMetrics =
      window.__regulatedFetchMetrics || { enqueued: 0, dequeued: 0, lastLog: 0 })) ||
  { enqueued: 0, dequeued: 0, lastLog: 0 };

const refill = () => {
  tokens = Math.min(config.maxBurst, tokens + config.replenishPerSecond);
  drainQueue();
};

const drainQueue = () => {
  while (tokens > 0 && queue.length > 0) {
    const next = queue.shift();
    tokens -= 1;
    next();
    metrics.dequeued += 1;
  }
};

const shouldRegulate = (urlString) => {
  if (!urlString) return false;
  try {
    const url = new URL(urlString, window.location.origin);
    const host = url.hostname;
    const path = url.pathname || '';
    // Target n8n domains or the known webhook/proxy paths
    return host.includes('n8n.decaminoservicios.com') ||
      path.startsWith('/webhook') ||
      path.startsWith('/api/n8n');
  } catch (err) {
    return false;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withBackoff = async (fn) => {
  let attempt = 0;
  let shouldRetry = true;
  while (shouldRetry) {
    try {
      const res = await fn();
      if (![429, 500, 502, 503, 504].includes(res?.status)) {
        return res;
      }
      if (attempt >= config.maxRetries) {
        shouldRetry = false;
        return res;
      }
    } catch (err) {
      if (attempt >= config.maxRetries) {
        shouldRetry = false;
        throw err;
      }
    }
    const jitter = Math.random() * config.jitterMs;
    const delay = config.baseDelayMs * Math.pow(2, attempt) + jitter;
    await sleep(delay);
    attempt += 1;
  }
};

const schedule = (task) => {
  return new Promise((resolve, reject) => {
    const run = () => {
      withBackoff(task).then(resolve).catch(reject);
    };

    if (tokens > 0) {
      tokens -= 1;
      run();
      return;
    }

    if (queue.length >= config.maxQueue) {
      reject(new Error('Rate limit queue full'));
      return;
    }

    queue.push(run);
    metrics.enqueued += 1;
    const now = Date.now();
    if (queue.length >= config.logThreshold && now - metrics.lastLog > config.logIntervalMs) {
      metrics.lastLog = now;
      console.info(`[regulatedFetch] queue=${queue.length}, tokens=${tokens}`);
    }
  });
};

export const regulatedFetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input?.url;
  if (!config.enabled || !originalFetch || !shouldRegulate(url)) {
    return originalFetch(input, init);
  }
  // Ensure interval is running
  if (!window.__regulatedFetchInterval) {
    window.__regulatedFetchInterval = setInterval(refill, 1000);
  }
  return schedule(() => originalFetch(input, init));
};

export const installRegulatedFetch = () => {
  if (!config.enabled || !originalFetch) return;
  if (window.__regulatedFetchInstalled) return;
  window.__regulatedFetchInstalled = true;
  window.fetch = regulatedFetch;
  if (!window.__regulatedFetchInterval) {
    window.__regulatedFetchInterval = setInterval(refill, 1000);
  }
  console.info('🔒 Regulated fetch enabled for n8n endpoints (dev only)');
};
