# Spanish leads scraper (MVP)

Scraper **apart** del backend NestJS; la app lo invoca con `run_scrape.py`.

## Registro de fuentes (`sources/`)

- **`sources/registry.py`** — metadatos por fuente (tipo, modos, prioridad, `include_in_auto`, `adapter_path`, salud, etc.). Ver **`SOURCES.md`**.
- **`sources/sources_config.json`** — control en runtime:
  - `disabled_source_ids`: excluye fuentes (no auto ni selección efectiva).
  - `extra_enabled_source_ids`: activa fuentes con `default_enabled: false` (p. ej. stubs).
  - `priority_overrides`: `{ "empresite": 15 }` — prioridad efectiva en auto (`GET /api/leads/scrape/registry` → `effectivePriority`).
  - `auto_skip_health_statuses`: por defecto `blocked`, `broken`, `experimental` — en **auto** solo entran fuentes fuera de esta lista (p. ej. **empresite** con `ok`).
  - `auto_allow_experimental`: si `true`, las fuentes experimentales pueden entrar en auto pese a la lista.
- **`sources/criteria.py`** — `SearchCriteria` (categoría, slug, provincia, ciudad, sinónimos, texto libre, códigos, flag de enriquecimiento).
- **`sources/category_search_profiles.json`** — perfiles por categoría de negocio:
  - `query_phrases`: frases que se prueban en PA / Empresite / Google (expansión automática).
  - `cnae_codes`: códigos CNAE (se mezclan con los que envía el usuario en `classification_codes`).
  - `aliases`: para reconocer la categoría aunque el usuario escriba otro texto (p. ej. «facility services» → perfil `servicios_auxiliares`).
  - `preferred_source_order`: orden en modo **auto** (Google se fuerza al final siempre).
  - Lógica: `sources/search_profiles.py` (`expand_search_criteria`); se aplica en `run_scrape.py` antes del pipeline.
- **`sources/adapters/*.py`** — un adaptador por fuente (MVP: Infobel, Kompass, mapas y OSM son stubs sin red).

### Fuentes con red (cuando no bloquean)

- Páginas Amarillas, Empresite, Google (descubrimiento HTML).

### Empresite — enriquecido desde la ficha

Tras parsear el **listado**, el scraper hace una segunda pasada: **GET** de cada `source_url` (ficha) y rellena **teléfono**, **email**, **web**, **nombre** (mejor que el del listado si existe), **ciudad / provincia** (schema.org / JSON-LD) cuando el HTML los trae.

- **`LEADS_EMPRESITE_ENRICH_MAX`**: cuántas fichas enriquecer (por defecto `40`; `0` = desactivar y dejar solo datos del listado).
- **`LEADS_EMPRESITE_DELAY_SEC`**: pausa entre peticiones (también aplica entre fichas).
- **`LEADS_EMPRESITE_DROP_GENERIC_NO_CONTACT`**: `1` (defecto) elimina filas con nombre solo genérico (p. ej. «construcciones») y sin teléfono, email ni web; `0` conserva todas.
- **`LEADS_EMPRESITE_MIN_NAME_LEN`**: longitud mínima del nombre (defecto `3`).

En el JSON de debug: **`enrich_pass`**, **`quality_pass`**, **`empresite_quality_summary`** (filas del listado, fichas visitadas, tel/mail/web extraídos, `detail_names_upgraded`, filas descartadas o marcadas como baja calidad, etc.).

### Europages — enriquecido desde la ficha

Tras el listado, **GET** de cada `source_url` (ficha) para **nombre** (JSON-LD / título de página), **web**, **teléfono**, **ciudad** / **país** cuando el HTML lo permite.

- **`LEADS_EUROPAGES_ENRICH_MAX`**: cuántas fichas enriquecer (defecto **`40`**; **`0`** = solo datos del listado, sin segunda pasada).
- **Listados**: primero **`/es/search?countries=ES&q=…`** (misma búsqueda que la [web](https://www.europages.es/es/search?countries=ES&q=limpieza)); luego varios slugs `what_slugs` + `/companies/spain.html` + ciudad. **Página 1 recorre todos** los candidatos. Paginación: `&page=N` en búsqueda, `?page=N` en `.html`. **`max_pages`** hasta **25** (`max_pages_requested` vs `max_pages_effective` en debug).
- En `stats.sources.europages.debug`: **`listing_fetches`** (cada GET con `requested_url`, `final_url`, `rows_raw`, `listing_page_index`), **`listing_final_urls_unique`**, **`rows_raw_total_by_listing_page_index`**, **`raw_listing_rows_before_dedupe`**, **`listing_rows_after_url_dedupe`**, **`listing_bases_paginated`**, **`pages_fetched`**, **`listing_fetch_count`**, más **`listing_rows`**, **`company_rows_kept`**, calidad y **`enrich`**. `where_slug` vacío = búsqueda solo país (esperado).

### Empresite — warmup 429 (fallo rápido)

- Si el **GET** a la portada (`warmup`) devuelve **429**, no se hace la pausa inicial ni el listado: se emite `warmup_429_fail_fast` en stderr y se termina. En `debug`, `zero_reason_code` es **`source_rate_limited`** (suele ir con cabecera `Retry-After`) o **`source_ip_blocked_or_throttled`** (429 sin `Retry-After`).
- El mensaje orientativo para la UI está en inglés en `hint` (rate-limit por IP / red).
- En **modo MVP** desde Nest (`LEADS_EMPRESITE_LIGHT_MODE`), se fuerza **`LEADS_EMPRESITE_429_RETRIES=0`** y **`LEADS_EMPRESITE_429_ABORT_AFTER=1`** para no alargar el tiempo si la IP ya está limitada.

### Salida Nest (`--nest-json`)

```json
{
  "records": [...],
  "records_by_source": { "paginas_amarillas": [...], ... },
  "stats": { "sources": {...}, "import_order": [...], "_merged_unique": N, "criteria": {...} }
}
```

## Fuente implementada (PA)

- **Páginas Amarillas** (`paginas_amarillas/scraper.py`): JSON-LD (`LocalBusiness` / `ItemList`) + enlaces que contienen `ficha`.

### Incapsula / anti-bot

Las peticiones directas con `requests` suelen recibir un challenge. Si ves error *ScraperBlockedError*:

1. Abre en el navegador la misma búsqueda (ej. limpieza en Madrid).
2. Guarda la página como HTML completo.
3. Ejecuta:

```bash
python run_scrape.py --from-html resultado.html --what limpieza --where madrid -o leads.jsonl
```

## Variables de entorno (anti‑rafagas / 429)

Útiles cuando **auto** en cadena (PA → Empresite → Google) desde **la misma IP**:

| Variable | Efecto |
|----------|--------|
| `LEADS_INTER_SOURCE_DELAY_SEC` | Pausa **entre fuentes** en modo auto. Por defecto **4.5–9 s** aleatorio. `5` = 5 s fijos; `6-12` = rango; `0` = sin pausa. |
| `LEADS_EMPRESITE_DELAY_SEC` | Pausa entre GET a Empresite. Por defecto **5–10 s** en CLI; **Nest** inyecta **8–18 s** si no hay `.env`. Si 429: `15-30`. |
| `LEADS_EMPRESITE_INITIAL_DELAY_SEC` | Espera **antes del primer listado** (y tras warm-up de portada). Nest inyecta **12 s** si no hay `.env`. |
| `LEADS_EMPRESITE_429_RETRIES` | Reintentos **tras cada 429** en la misma URL (backoff amplio; defecto **4**; Nest **5** si no hay `.env`). |
| `LEADS_EMPRESITE_MAX_PHRASES` | Máx. frases del perfil en Empresite (defecto **3**). |
| `LEADS_EMPRESITE_MAX_URLS` | Tope de URLs únicas a probar (defecto **20**). |
| `LEADS_EMPRESITE_429_ABORT_AFTER` | Tras **N** respuestas **429 seguidas** (tras reintentos), deja de probar más URLs candidatas (defecto **2**). |
| `LEADS_PA_MAX_PHRASES` | Rondas en Páginas Amarillas por perfil (defecto **4**). |

## Instalación

```bash
cd tools/spanish-leads-scraper
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

## CLI

```bash
# Red — modo auto (registro + config)
python run_scrape.py --source auto --what limpieza --where madrid --max-pages 1 --nest-json

# Criterios en JSON (como envía Nest)
python run_scrape.py --source auto --criteria-file criterios.json --max-pages 1 --nest-json

# Una sola fuente
python run_scrape.py --source google_discovery --what limpieza --where madrid --nest-json

# HTML guardado desde el navegador (recomendado para PA)
python run_scrape.py --from-html resultado.html --criteria-file criterios.json --nest-json
# o sin archivo de criterios:
python run_scrape.py --from-html resultado.html --what limpieza --where madrid -o leads.json --format json
```

## Import en la app

1. En **Admin → Leads**: sube `leads.jsonl` o `leads.json` (o usa el botón de pegar JSON pequeño).
2. El backend hace `createMany` con `skipDuplicates` por `dedupe_key`.

### Extracción desde la UI

- **`POST /api/leads/scrape`** — criterios en JSON temporal (`--criteria-file`).
- **`GET /api/leads/scrape/registry`** — metadatos de fuentes + `enabled` efectivo en auto.
- **`POST /api/leads/scrape/from-html`** — multipart: `file` (HTML) + campos de criterios.

Requisitos en la máquina del **backend**:

- Python 3 en PATH (o `LEADS_PYTHON`)
- `pip install -r requirements.txt` en `tools/spanish-leads-scraper`
- Repo con `tools/spanish-leads-scraper` junto a `backend/`.

## Fixture de prueba

```bash
python run_scrape.py --from-html fixtures/sample_listing.html --what limpieza --where madrid
```

## Legal / ética

Respeta robots.txt, términos del sitio y ritmo razonable (delays aleatorios en la red).
