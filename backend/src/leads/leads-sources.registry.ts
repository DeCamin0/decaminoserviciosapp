/**
 * Registro central de fuentes — alineado con ``tools/spanish-leads-scraper/sources/registry.py``.
 * ``auto`` no es una fuente: es el modo que recorre ``ordered_source_ids_for_auto`` en Python.
 */
export type LeadSourceType =
  | 'directory'
  | 'map'
  | 'search_engine'
  | 'official_site'
  | 'niche';

export type LeadSourceFailureMode = 'blocked' | 'partial' | 'stable';

export type LeadSourceHealthStatus =
  | 'ok'
  | 'blocked'
  | 'broken'
  | 'experimental'
  /** Implementado pero no validado para auto (p. ej. Cylex hasta QA). */
  | 'partial';

export type LeadSearchMode =
  | 'category'
  | 'city'
  | 'province'
  | 'free_text'
  | 'code';

export type LeadSourceDefinition = {
  id: string;
  displayName: string;
  countries: string[];
  sourceType: LeadSourceType;
  searchModes: LeadSearchMode[];
  outputFields: string[];
  priority: number;
  defaultEnabled: boolean;
  failureMode: LeadSourceFailureMode;
  notes?: string;
  healthStatus: LeadSourceHealthStatus;
  /** 1–3 stubs planificados; null = fuente “real” */
  tier?: number | null;
  /**
   * Si false, la fuente no entra en modo ``auto`` salvo que esté en
   * ``extra_enabled_source_ids`` (config).
   */
  includeInAuto: boolean;
  /** Ruta relativa a ``tools/spanish-leads-scraper/`` */
  adapterPath: string;
};

export const LEAD_SOURCE_REGISTRY: LeadSourceDefinition[] = [
  {
    id: 'paginas_amarillas',
    displayName: 'Páginas Amarillas',
    countries: ['ES'],
    sourceType: 'directory',
    searchModes: ['category', 'city', 'province'],
    outputFields: ['company_name', 'phone', 'website', 'address'],
    priority: 10,
    defaultEnabled: true,
    failureMode: 'blocked',
    notes:
      'Incapsula frecuente desde servidor; HTML guardado recomendado. Roadmap: mantener extracción vía HTML guardado.',
    healthStatus: 'blocked',
    tier: null,
    includeInAuto: true,
    adapterPath: 'sources/adapters/paginas_amarillas.py',
  },
  {
    id: 'empresite',
    displayName: 'Empresite (El Economista)',
    countries: ['ES'],
    sourceType: 'directory',
    searchModes: ['category', 'city', 'province', 'free_text'],
    outputFields: ['company_name', 'phone', 'website'],
    priority: 20,
    defaultEnabled: true,
    failureMode: 'partial',
    notes:
      'Única fuente red activa (MVP). 429 posible — ver empresite/scraper.py.',
    healthStatus: 'ok',
    tier: null,
    includeInAuto: true,
    adapterPath: 'sources/adapters/empresite.py',
  },
  {
    id: 'infobel',
    displayName: 'Infobel',
    countries: ['ES'],
    sourceType: 'directory',
    searchModes: ['category', 'city', 'province', 'code'],
    outputFields: ['company_name', 'phone', 'website'],
    priority: 30,
    defaultEnabled: false,
    failureMode: 'partial',
    notes:
      'Directorio infobel.com/es/spain; Cloudflare frecuente desde IP servidor. No auto hasta validar.',
    healthStatus: 'partial',
    tier: 1,
    includeInAuto: false,
    adapterPath: 'sources/adapters/infobel.py',
  },
  {
    id: 'kompass',
    displayName: 'Kompass',
    countries: ['ES'],
    sourceType: 'directory',
    searchModes: ['category', 'city', 'province', 'code'],
    outputFields: ['company_name', 'phone', 'website'],
    priority: 40,
    defaultEnabled: false,
    failureMode: 'blocked',
    notes:
      'Listados kompass.com; Datadome/captcha frecuente desde IP servidor. Sin bypass en este adaptador.',
    healthStatus: 'blocked',
    tier: 2,
    includeInAuto: false,
    adapterPath: 'sources/adapters/kompass.py',
  },
  {
    id: 'google_discovery',
    displayName: 'Google (descubrimiento)',
    countries: ['ES'],
    sourceType: 'search_engine',
    searchModes: ['category', 'city', 'province', 'free_text'],
    outputFields: ['company_name', 'email', 'phone', 'website'],
    priority: 50,
    defaultEnabled: true,
    failureMode: 'blocked',
    notes:
      '429 / CAPTCHA desde IP servidor; se excluye del auto por defecto (config).',
    healthStatus: 'blocked',
    tier: null,
    includeInAuto: true,
    adapterPath: 'sources/adapters/google_discovery.py',
  },
  {
    id: 'maps_discovery',
    displayName: 'Mapas / POI',
    countries: ['ES'],
    sourceType: 'map',
    searchModes: ['category', 'city', 'province', 'free_text'],
    outputFields: ['company_name', 'website', 'phone'],
    priority: 60,
    defaultEnabled: false,
    failureMode: 'partial',
    notes:
      'Roadmap descubrimiento — stub; futuro Nominatim/tiles según política.',
    healthStatus: 'experimental',
    tier: 3,
    includeInAuto: false,
    adapterPath: 'sources/adapters/maps_discovery.py',
  },
  {
    id: 'osm_overpass',
    displayName: 'OpenStreetMap (Overpass)',
    countries: ['ES'],
    sourceType: 'map',
    searchModes: ['category', 'city', 'province', 'free_text'],
    outputFields: ['company_name', 'website'],
    priority: 70,
    defaultEnabled: false,
    failureMode: 'stable',
    notes: 'Opcional — stub Overpass; no confundir con maps_discovery.',
    healthStatus: 'experimental',
    tier: 3,
    includeInAuto: false,
    adapterPath: 'sources/adapters/osm_overpass.py',
  },
  {
    id: 'cylex',
    displayName: 'Cylex',
    countries: ['ES'],
    sourceType: 'directory',
    searchModes: ['category', 'city', 'province'],
    outputFields: ['company_name', 'phone', 'website'],
    priority: 80,
    defaultEnabled: false,
    failureMode: 'partial',
    notes:
      'Listados cylex.es; Cloudflare frecuente desde IP servidor. No auto hasta validar en producción.',
    healthStatus: 'partial',
    tier: 1,
    includeInAuto: false,
    adapterPath: 'sources/adapters/cylex.py',
  },
  {
    id: 'yalwa',
    displayName: 'Yalwa',
    countries: ['ES'],
    sourceType: 'directory',
    searchModes: ['category', 'city', 'province'],
    outputFields: ['company_name', 'phone', 'website'],
    priority: 85,
    defaultEnabled: false,
    failureMode: 'blocked',
    notes:
      'yalwa.es / subdominios ciudad; Cloudflare frecuente desde IP servidor. No auto hasta validar.',
    healthStatus: 'blocked',
    tier: 2,
    includeInAuto: false,
    adapterPath: 'sources/adapters/yalwa.py',
  },
  {
    id: 'europages',
    displayName: 'Europages',
    countries: ['ES'],
    sourceType: 'directory',
    searchModes: ['category', 'city', 'province', 'free_text'],
    outputFields: ['company_name', 'phone', 'website'],
    priority: 86,
    defaultEnabled: false,
    failureMode: 'partial',
    notes:
      'Listados /companies/spain/{slug}.html (Visable). No auto hasta validar en producción.',
    healthStatus: 'partial',
    tier: 2,
    includeInAuto: false,
    adapterPath: 'sources/adapters/europages.py',
  },
  {
    id: 'hotfrog',
    displayName: 'Hotfrog',
    countries: ['ES'],
    sourceType: 'directory',
    searchModes: ['category', 'city', 'province'],
    outputFields: ['company_name', 'phone', 'website'],
    priority: 87,
    defaultEnabled: false,
    failureMode: 'partial',
    notes: 'Roadmap #5 (lote) — stub.',
    healthStatus: 'experimental',
    tier: 2,
    includeInAuto: false,
    adapterPath: 'sources/adapters/stub_sources.py',
  },
  {
    id: 'qdq',
    displayName: 'QDQ',
    countries: ['ES'],
    sourceType: 'niche',
    searchModes: ['category', 'city', 'province'],
    outputFields: ['company_name', 'phone', 'website'],
    priority: 88,
    defaultEnabled: false,
    failureMode: 'partial',
    notes: 'Roadmap #5 (lote) — stub directorio ES.',
    healthStatus: 'experimental',
    tier: 2,
    includeInAuto: false,
    adapterPath: 'sources/adapters/stub_sources.py',
  },
  {
    id: 'axesor',
    displayName: 'Axesor',
    countries: ['ES'],
    sourceType: 'niche',
    searchModes: ['category', 'code'],
    outputFields: ['company_name', 'phone', 'website'],
    priority: 90,
    defaultEnabled: false,
    failureMode: 'stable',
    notes: 'Roadmap datos comerciales — stub; posible API/licencia.',
    healthStatus: 'experimental',
    tier: 3,
    includeInAuto: false,
    adapterPath: 'sources/adapters/stub_sources.py',
  },
  {
    id: 'einforma',
    displayName: 'eInforma',
    countries: ['ES'],
    sourceType: 'official_site',
    searchModes: ['category', 'code', 'free_text'],
    outputFields: ['company_name', 'phone', 'website'],
    priority: 91,
    defaultEnabled: false,
    failureMode: 'stable',
    notes: 'Roadmap — stub; datos sensibles / cumplimiento.',
    healthStatus: 'experimental',
    tier: 3,
    includeInAuto: false,
    adapterPath: 'sources/adapters/stub_sources.py',
  },
  {
    id: 'linkedin_discovery',
    displayName: 'LinkedIn (descubrimiento)',
    countries: ['ES', 'EU'],
    sourceType: 'search_engine',
    searchModes: ['category', 'free_text'],
    outputFields: ['company_name', 'website'],
    priority: 92,
    defaultEnabled: false,
    failureMode: 'blocked',
    notes:
      'Roadmap descubrimiento — stub; límites estrictos, sin API de pago aún.',
    healthStatus: 'experimental',
    tier: 3,
    includeInAuto: false,
    adapterPath: 'sources/adapters/stub_sources.py',
  },
  {
    id: 'bing_discovery',
    displayName: 'Bing (descubrimiento)',
    countries: ['ES'],
    sourceType: 'search_engine',
    searchModes: ['category', 'city', 'province', 'free_text'],
    outputFields: ['company_name', 'phone', 'website'],
    priority: 93,
    defaultEnabled: false,
    failureMode: 'blocked',
    notes: 'Roadmap descubrimiento — stub; rate limits tipo Google.',
    healthStatus: 'experimental',
    tier: 3,
    includeInAuto: false,
    adapterPath: 'sources/adapters/stub_sources.py',
  },
];

export function displayNameForSourceId(id: string): string {
  return LEAD_SOURCE_REGISTRY.find((s) => s.id === id)?.displayName ?? id;
}
