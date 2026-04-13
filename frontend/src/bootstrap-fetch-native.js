/**
 * Trebuie să fie PRIMUL import din main.jsx.
 * În ESM, dependențele lui main (ex. App → … → useComunicadosApi) se încarcă înainte de
 * restul corpului modulului main; codul de la începutul main.jsx NU rulează înainte de ele.
 * Dacă nu salvăm fetch-ul nativ aici, __originalFetchForLocation poate deveni de fapt
 * primul wrapper (ex. useComunicadosApi), iar tokenRefresh / altele folosesc referința greșită.
 */
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  window.__originalFetchForLocation = window.fetch.bind(window);
}
