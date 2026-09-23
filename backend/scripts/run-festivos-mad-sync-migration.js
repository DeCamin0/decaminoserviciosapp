/**
 * Sync festivos Nacional + Comunidad de Madrid → fiestas.
 * Primar: calendariosnacionales
 * Verificare oficială: Open Data Comunidad de Madrid
 * Fallback: Madrid OD → Nager.Date
 *
 * Usage:
 *   node scripts/run-festivos-mad-sync-migration.js .env.decamino.local
 *   node scripts/run-festivos-mad-sync-migration.js .env.hera.local
 *   node scripts/run-festivos-mad-sync-migration.js .env.decamino.local 2026,2027
 */
const path = require('path');
const mysql = require('mysql2/promise');

const envFile = process.argv[2] || '.env.decamino.local';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

const API_BASE = 'https://calendariosnacionales.com/es/v1';
const NAGER_BASE = 'https://date.nager.at/api/v3';
const MADRID_OD_URL =
  'https://datos.comunidad.madrid/dataset/f160eb6c-6715-471e-9bc0-38497aae950f/resource/975f579d-92c2-42de-bfa9-aff5bd164586/download/festivos_regionales.json';
const MADRID_CCAA = 'ES-MD';
const SYNC_MARKERS = ['calendariosnacionales', 'madrid-od', 'nager'];

function parseYearsArg() {
  const raw = process.argv[3];
  const current = new Date().getFullYear();
  if (!raw) return [current, current + 1];
  return [
    ...new Set(
      String(raw)
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((y) => !isNaN(y) && y >= 2000 && y <= 2100),
    ),
  ];
}

function normalizeScope(raw) {
  const s = String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  if (s.includes('autonom') || s.includes('regional') || s.includes('comunidad')) {
    return 'Autonómico';
  }
  return 'Nacional';
}

function normalizeNameKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildNotes(holiday, extras = {}) {
  const marker = String(holiday.source || '').startsWith('madrid-od')
    ? 'madrid-od'
    : String(holiday.source || '').startsWith('nager')
      ? 'nager'
      : 'calendariosnacionales';
  return [
    marker,
    holiday.source || 'API',
    holiday.sourceUrl || '',
    extras.verified ? `verified:${extras.verified}` : '',
    extras.usedFallback ? 'fallback:1' : '',
    `synced:${new Date().toISOString().slice(0, 10)}`,
  ]
    .filter(Boolean)
    .join(' | ')
    .slice(0, 2000);
}

function dedupeByDate(list) {
  const byDate = new Map();
  for (const item of list) {
    if (!item?.date || !item?.name) continue;
    const date = String(item.date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const prev = byDate.get(date);
    if (!prev) {
      byDate.set(date, { ...item, date });
      continue;
    }
    if (
      normalizeScope(item.scope) === 'Autonómico' &&
      normalizeScope(prev.scope) !== 'Autonómico'
    ) {
      byDate.set(date, { ...item, date });
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function extractCnHolidays(payload) {
  const fromCalendar = payload?.holidays?.calendar;
  const list =
    Array.isArray(fromCalendar) && fromCalendar.length > 0
      ? fromCalendar
      : [
          ...(payload?.holidays?.national || []),
          ...(payload?.holidays?.regional || []),
        ];
  return dedupeByDate(list);
}

function compareDates(primary, verify, source, note) {
  const p = new Set(primary.map((h) => h.date));
  const v = new Set(verify.map((h) => h.date));
  const onlyInPrimary = [...p].filter((d) => !v.has(d)).sort();
  const onlyInVerify = [...v].filter((d) => !p.has(d)).sort();
  return {
    source,
    match: onlyInPrimary.length === 0 && onlyInVerify.length === 0,
    onlyInPrimary,
    onlyInVerify,
    note,
  };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'DeCamino-Festivos-Migration/1.1',
    },
  });
  return res;
}

async function fetchCnYear(year) {
  const url = `${API_BASE}/${year}/regiones/mad.json`;
  const res = await fetchJson(url);
  if (res.status === 404) return { status: 'not_found', holidays: [] };
  if (!res.ok) throw new Error(`CN ${year}: HTTP ${res.status}`);
  return { status: 'ok', holidays: extractCnHolidays(await res.json()) };
}

async function fetchMadridOdByYear() {
  const map = new Map();
  try {
    const res = await fetchJson(MADRID_OD_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    for (const row of rows) {
      const date = String(row.fecha_festivo || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const year = Number(row.año) || Number(date.slice(0, 4));
      const name = String(row.festividad || 'Festivo').trim();
      const isMadridOnly = /comunidad de madrid|fiesta comunidad/i.test(name);
      const list = map.get(year) || [];
      list.push({
        date,
        name,
        scope: isMadridOnly ? 'autonomico' : 'nacional',
        source: 'madrid-od',
        sourceUrl: MADRID_OD_URL,
      });
      map.set(year, list);
    }
    for (const [y, list] of map) map.set(y, dedupeByDate(list));
    console.log(`📘 Madrid OD years: ${[...map.keys()].join(',') || 'none'}`);
  } catch (e) {
    console.warn(`⚠️ Madrid OD unavailable: ${e.message}`);
  }
  return map;
}

async function fetchNagerMadridYear(year) {
  try {
    const url = `${NAGER_BASE}/PublicHolidays/${year}/ES`;
    const res = await fetchJson(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    const list = [];
    for (const row of rows || []) {
      const date = String(row.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const applies =
        row.global === true ||
        (Array.isArray(row.counties) && row.counties.includes(MADRID_CCAA));
      if (!applies) continue;
      const isMadridOnly =
        Array.isArray(row.counties) &&
        row.counties.length === 1 &&
        row.counties[0] === MADRID_CCAA;
      list.push({
        date,
        name: String(row.localName || row.name || 'Festivo').trim(),
        scope: isMadridOnly ? 'autonomico' : 'nacional',
        source: 'nager',
        sourceUrl: url,
      });
    }
    return dedupeByDate(list);
  } catch (e) {
    console.warn(`⚠️ Nager ${year}: ${e.message}`);
    return [];
  }
}

async function findExisting(connection, date, scope, name) {
  const [rows] = await connection.query(
    `SELECT id, name, scope, ccaa_code, notes FROM fiestas WHERE date = ?`,
    [date],
  );
  if (!rows.length) return null;
  const nameKey = normalizeNameKey(name);
  const byScope = rows.find((r) => {
    if (normalizeScope(r.scope) !== scope) return false;
    if (scope === 'Nacional') {
      return (
        !r.ccaa_code ||
        ['ES', 'ESP', 'NACIONAL'].includes(String(r.ccaa_code).toUpperCase())
      );
    }
    const code = String(r.ccaa_code || '').toUpperCase();
    return code === 'ES-MD' || code === 'MAD' || code === 'MD';
  });
  if (byScope) return byScope;
  const byName = rows.find((r) => normalizeNameKey(r.name) === nameKey);
  if (byName) return byName;
  return (
    rows.find((r) =>
      SYNC_MARKERS.some((m) => String(r.notes || '').includes(m)),
    ) || null
  );
}

async function upsertHoliday(connection, holiday, extras) {
  const scope = normalizeScope(holiday.scope);
  const ccaa = scope === 'Autonómico' ? MADRID_CCAA : null;
  const name = String(holiday.name).trim().slice(0, 160);
  const notes = buildNotes(holiday, extras);
  const date = holiday.date;
  const existing = await findExisting(connection, date, scope, name);

  if (!existing) {
    await connection.query(
      `INSERT INTO fiestas (date, name, scope, ccaa_code, observed_date, active, notes)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [date, name, scope, ccaa, date, notes],
    );
    return 'inserted';
  }

  await connection.query(
    `UPDATE fiestas
     SET date = ?, name = ?, scope = ?, ccaa_code = ?, observed_date = COALESCE(observed_date, ?), active = 1, notes = ?
     WHERE id = ?`,
    [date, name, scope, ccaa, date, notes, existing.id],
  );

  const alreadySynced = SYNC_MARKERS.some((m) =>
    String(existing.notes || '').includes(m),
  );
  if (
    existing.name === name &&
    normalizeScope(existing.scope) === scope &&
    alreadySynced
  ) {
    return 'unchanged';
  }
  return 'updated';
}

async function run() {
  let connection;
  const years = parseYearsArg();

  try {
    const config = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    };
    if (!config.host || !config.user || !config.database) {
      console.error('Missing DB config');
      process.exit(1);
    }

    connection = await mysql.createConnection(config);
    console.log(`Connected to ${config.database} (env=${envFile})`);
    console.log(`Years: ${years.join(', ')}`);

    const madridOd = await fetchMadridOdByYear();
    const totals = { inserted: 0, updated: 0, unchanged: 0, fetched: 0 };
    const mismatches = [];

    for (const year of years) {
      console.log(`\n📅 Year ${year}`);
      let holidays = [];
      let usedSource = 'none';
      let usedFallback = false;

      try {
        const primary = await fetchCnYear(year);
        if (primary.status === 'ok' && primary.holidays.length) {
          holidays = primary.holidays;
          usedSource = 'calendariosnacionales';
        } else {
          console.log(`  ⚠️ Primary: ${primary.status}`);
        }
      } catch (e) {
        console.warn(`  ⚠️ Primary error: ${e.message}`);
      }

      if (!holidays.length) {
        const od = madridOd.get(year) || [];
        if (od.length) {
          holidays = od;
          usedSource = 'madrid-od';
          usedFallback = true;
          console.log(`  ↩️ Fallback Madrid OD (${od.length})`);
        } else {
          const nager = await fetchNagerMadridYear(year);
          if (nager.length) {
            holidays = nager;
            usedSource = 'nager';
            usedFallback = true;
            console.log(`  ↩️ Fallback Nager (${nager.length})`);
          }
        }
      }

      if (!holidays.length) {
        console.log('  skipped — no source');
        continue;
      }

      let verification = { source: 'none', match: true };
      const od = madridOd.get(year) || [];
      if (od.length && usedSource !== 'madrid-od') {
        verification = compareDates(
          holidays,
          od,
          'madrid-od',
          'Open Data oficial Comunidad de Madrid',
        );
      } else if (usedSource !== 'nager') {
        const nager = await fetchNagerMadridYear(year);
        if (nager.length) {
          verification = compareDates(
            holidays,
            nager,
            'nager',
            'soft (traslados pueden diferir)',
          );
        }
      }

      console.log(
        `  source=${usedSource} fallback=${usedFallback} count=${holidays.length} verify=${verification.source} match=${verification.match}`,
      );
      if (!verification.match) {
        mismatches.push(year);
        console.log(
          `  ⚠️ onlyPrimary=${(verification.onlyInPrimary || []).join(',')}`,
        );
        console.log(
          `  ⚠️ onlyVerify=${(verification.onlyInVerify || []).join(',')}`,
        );
      }

      totals.fetched += holidays.length;
      for (const h of holidays) {
        const result = await upsertHoliday(connection, h, {
          verified: verification.source !== 'none' ? verification.source : undefined,
          usedFallback,
        });
        totals[result] += 1;
        console.log(
          `  ${result === 'inserted' ? '+' : result === 'updated' ? '~' : '='} ${h.date} ${h.name}`,
        );
      }
    }

    console.log('\n✅ Sync completed:');
    console.log(
      `   fetched=${totals.fetched} inserted=${totals.inserted} updated=${totals.updated} unchanged=${totals.unchanged}`,
    );
    console.log(
      `   verification mismatches: ${mismatches.length ? mismatches.join(',') : 'none'}`,
    );
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

run();
