const CACHE_KEY = 'avatar_cache_v2'; // bumped to avoid mixing old format
const AVATAR_SW_CACHE = 'avatar-cache-v1';

let memoryCache = null;
const inflight = new Map();
let loadedFromLocalStorage = false;

const buildPayload = (url, version) => ({
  url,
  version: version || null,
});

const loadCache = () => {
  if (memoryCache) return memoryCache;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      memoryCache = JSON.parse(raw);
      loadedFromLocalStorage = true;
    } else {
      memoryCache = {};
    }
  } catch {
    memoryCache = {};
  }
  return memoryCache;
};

const persist = () => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache || {}));
  } catch {
    /* ignore storage errors */
  }
};

export const clearAvatarCache = () => {
  memoryCache = {};
  inflight.clear();
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
};

export const clearAvatarCacheFor = (codigo) => {
  if (!codigo) return;
  loadCache();
  delete memoryCache[codigo];
  inflight.delete(codigo);
  persist();
};

export const getCachedAvatar = (codigo) => {
  if (!codigo) return null;
  const cache = loadCache();
  return cache?.[codigo] || null;
};

export const getAvatarVersion = (codigo) => {
  const cached = getCachedAvatar(codigo);
  return cached?.version || null;
};

export const setCachedAvatar = (codigo, url, version = null) => {
  if (!codigo || !url) return;
  // only cache valid urls (no fallback)
  const payload = buildPayload(url, version);
  loadCache();
  memoryCache[codigo] = payload;
  persist();
};

export const fetchAvatarOnce = async ({ codigo, nombre, endpoint, version }) => {
  if (!codigo || !endpoint) return null;

  // Try SW cache first (if available)
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      await navigator.serviceWorker.ready;
      const cache = await caches.open(AVATAR_SW_CACHE);
      const match = await cache.match(endpoint, { ignoreSearch: false });
      if (match) {
        console.debug('[avatarCache] Source: SW', { codigo });
        const cloned = match.clone();
        const contentType = cloned.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await cloned.json();
          let avatarData = null;
          if (Array.isArray(data) && data.length > 0) avatarData = data[0];
          else if (data && typeof data === 'object') avatarData = data;

          if (avatarData) {
            let avatarUrl = null;
            if (avatarData.AVATAR_B64) {
              const base64Clean = String(avatarData.AVATAR_B64).replace(/\n/g, '');
              avatarUrl = `data:image/jpeg;base64,${base64Clean}`;
            } else if (avatarData.avatar || avatarData.url || avatarData.imageUrl || avatarData.AVATAR) {
              avatarUrl = avatarData.avatar || avatarData.url || avatarData.imageUrl || avatarData.AVATAR;
            }
            if (avatarUrl) {
              setCachedAvatar(codigo, avatarUrl, version || getAvatarVersion(codigo) || null);
              return avatarUrl;
            }
          }
        }
      }
    }
  } catch (e) {
    // ignore SW cache read errors, continue to memory/fetch
  }

  // Return cached if version matches (or no version provided)
  const cached = getCachedAvatar(codigo);
  if (cached && (!version || cached.version === version)) {
    if (loadedFromLocalStorage) {
      console.debug('[avatarCache] Source: localStorage', { codigo });
    } else {
      console.debug('[avatarCache] Source: memory', { codigo });
    }
    return cached.url || cached;
  }

  // If version differs, clear per-user and refetch
  if (cached && version && cached.version !== version) {
    clearAvatarCacheFor(codigo);
  }

  // Return in-flight promise if exists
  if (inflight.has(codigo)) return inflight.get(codigo);

  const promise = (async () => {
    try {
      const formData = new FormData();
      formData.append('motivo', 'get');
      formData.append('CODIGO', codigo);
      formData.append('nombre', nombre || '');

      console.debug('[avatarCache] Source: fetch', { codigo, url: endpoint });
      
      // Adaugă token-ul JWT dacă există
      const headers = {};
      const token = localStorage.getItem('auth_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      let result;
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        if (!text || !text.trim()) return null;
        try {
          result = JSON.parse(text);
        } catch {
          return null;
        }
      }

      let avatarData = null;
      if (Array.isArray(result) && result.length > 0) {
        avatarData = result[0];
      } else if (result && typeof result === 'object') {
        avatarData = result;
      } else {
        return null;
      }

      let avatarUrl = null;
      if (avatarData.AVATAR_B64) {
        const base64Clean = avatarData.AVATAR_B64.replace(/\n/g, '');
        avatarUrl = `data:image/jpeg;base64,${base64Clean}`;
      } else if (avatarData.avatar || avatarData.url || avatarData.imageUrl || avatarData.AVATAR) {
        avatarUrl = avatarData.avatar || avatarData.url || avatarData.imageUrl || avatarData.AVATAR;
      }

      if (avatarUrl) {
        setCachedAvatar(codigo, avatarUrl, version || Date.now());
        return avatarUrl;
      }
      return null;
    } catch {
      return null;
    } finally {
      inflight.delete(codigo);
    }
  })();

  inflight.set(codigo, promise);
  return promise;
};

// Fallback avatar (SVG data URL) – not cached when fetch fails
export const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect fill="%23e5e7eb" width="80" height="80"/><circle cx="40" cy="30" r="18" fill="%239ca3af"/><path d="M16 72c0-14 10-24 24-24s24 10 24 24" fill="%239ca3af"/></svg>';