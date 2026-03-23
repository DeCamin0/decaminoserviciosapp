import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

import type {
  LeadSourceDefinition,
  LeadSourceHealthStatus,
} from './leads-sources.registry';

/** Slug para URL de Páginas Amarillas (ciudad o provincia). */
export function slugifyLocation(input: string): string {
  const t = input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const s = t.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return s || 'espana';
}

export function resolveScraperDir(cwd: string = process.cwd()): string {
  return join(cwd, '..', 'tools', 'spanish-leads-scraper');
}

export function assertScraperLayout(dir: string): void {
  const script = join(dir, 'run_scrape.py');
  if (!existsSync(script)) {
    throw new Error(
      `Scraper no encontrado en ${script}. ¿cwd correcto? (esperado backend/ como cwd)`,
    );
  }
}

export function pickPythonCommand(): string {
  return (process.env.LEADS_PYTHON || 'python').trim() || 'python';
}

export type ScraperSourcesConfig = {
  disabled_source_ids: string[];
  extra_enabled_source_ids: string[];
  /** Prioridad efectiva en modo auto (sobrescribe la del registro). */
  priority_overrides: Record<string, number>;
  /**
   * Salud de registro a excluir del pipeline ``auto`` (alineado con Python).
   * Por defecto: blocked, broken, experimental → solo ``ok`` en auto (p. ej. empresite).
   */
  auto_skip_health_statuses?: string[];
  /** Si true, las fuentes experimental entran en auto pese a ``auto_skip_health_statuses``. */
  auto_allow_experimental?: boolean;
};

/** Alineado con ``sources/sources_config.json`` del scraper Python. */
export function loadScraperSourcesConfig(
  scraperDir: string,
): ScraperSourcesConfig {
  const path = join(scraperDir, 'sources', 'sources_config.json');
  try {
    const raw = readFileSync(path, 'utf8');
    const j = JSON.parse(raw) as {
      disabled_source_ids?: unknown;
      extra_enabled_source_ids?: unknown;
      priority_overrides?: unknown;
      auto_skip_health_statuses?: unknown;
      auto_allow_experimental?: unknown;
    };
    const toStrList = (v: unknown) =>
      Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
    const po: Record<string, number> = {};
    if (j?.priority_overrides && typeof j.priority_overrides === 'object') {
      for (const [k, v] of Object.entries(
        j.priority_overrides as Record<string, unknown>,
      )) {
        const id = String(k).trim();
        if (!id) continue;
        const n = Number(v);
        if (Number.isFinite(n)) po[id] = Math.floor(n);
      }
    }
    const defSkip = ['blocked', 'broken', 'experimental', 'partial'];
    let autoSkip: string[] | undefined;
    if (j?.auto_skip_health_statuses === undefined) {
      autoSkip = defSkip;
    } else if (Array.isArray(j.auto_skip_health_statuses)) {
      autoSkip = toStrList(j.auto_skip_health_statuses);
    } else {
      autoSkip = defSkip;
    }
    const allowExp =
      j?.auto_allow_experimental === undefined
        ? false
        : Boolean(j.auto_allow_experimental);

    return {
      disabled_source_ids: toStrList(j?.disabled_source_ids),
      extra_enabled_source_ids: toStrList(j?.extra_enabled_source_ids),
      priority_overrides: po,
      auto_skip_health_statuses: autoSkip,
      auto_allow_experimental: allowExp,
    };
  } catch {
    return {
      disabled_source_ids: [],
      extra_enabled_source_ids: [],
      priority_overrides: {},
      auto_skip_health_statuses: [
        'blocked',
        'broken',
        'experimental',
        'partial',
      ],
      auto_allow_experimental: false,
    };
  }
}

export function sourceRunsInAuto(
  sourceId: string,
  defaultEnabled: boolean,
  cfg: ScraperSourcesConfig,
): boolean {
  if (cfg.disabled_source_ids.includes(sourceId)) return false;
  if (defaultEnabled) return true;
  return cfg.extra_enabled_source_ids.includes(sourceId);
}

/** Misma lógica que ``ordered_source_ids_for_auto`` en Python (salud + include_in_auto). */
export function healthPassesAuto(
  health: LeadSourceHealthStatus,
  cfg: ScraperSourcesConfig,
): boolean {
  const skip = new Set(
    cfg.auto_skip_health_statuses ?? [
      'blocked',
      'broken',
      'experimental',
      'partial',
    ],
  );
  if (health === 'experimental' && cfg.auto_allow_experimental) return true;
  return !skip.has(health);
}

export function sourceInAutoPipeline(
  s: LeadSourceDefinition,
  cfg: ScraperSourcesConfig,
): boolean {
  if (!sourceRunsInAuto(s.id, s.defaultEnabled, cfg)) return false;
  if (!s.includeInAuto && !cfg.extra_enabled_source_ids.includes(s.id)) {
    return false;
  }
  return healthPassesAuto(s.healthStatus, cfg);
}

/**
 * Entorno del subprocess Python (scraper).
 * - Sin `empresiteLight`: solo rellena LEADS_* que falten (anti‑429).
 * - Con `empresiteLight=true` (MVP desde UI): fuerza menos URLs, menos reintentos, pausas cortas.
 */
export function scraperChildProcessEnv(
  empresiteLight?: boolean,
): NodeJS.ProcessEnv {
  const e: NodeJS.ProcessEnv = { ...process.env, PYTHONUTF8: '1' };
  if (empresiteLight === true) {
    e.LEADS_EMPRESITE_LIGHT_MODE = '1';
    e.LEADS_EMPRESITE_MAX_URLS = '3';
    /** Sin reintentos por URL en MVP: fallo rápido ante 429 */
    e.LEADS_EMPRESITE_429_RETRIES = '0';
    e.LEADS_EMPRESITE_DELAY_SEC = '3-7';
    e.LEADS_EMPRESITE_INITIAL_DELAY_SEC = '3';
    e.LEADS_EMPRESITE_ENRICH_MAX = '6';
    /** Tras un 429 en listado, no seguir probando más URLs */
    e.LEADS_EMPRESITE_429_ABORT_AFTER = '1';
    e.LEADS_EMPRESITE_MAX_PHRASES = '1';
    return e;
  }
  const setIfMissing = (key: string, value: string) => {
    const cur = e[key];
    if (cur === undefined || cur === '') {
      e[key] = value;
    }
  };
  setIfMissing('LEADS_EMPRESITE_DELAY_SEC', '8-18');
  setIfMissing('LEADS_EMPRESITE_429_RETRIES', '5');
  setIfMissing('LEADS_EMPRESITE_MAX_URLS', '5');
  setIfMissing('LEADS_EMPRESITE_INITIAL_DELAY_SEC', '12');
  setIfMissing('LEADS_EMPRESITE_429_ABORT_AFTER', '3');
  return e;
}
