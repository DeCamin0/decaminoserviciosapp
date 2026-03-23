# Lead sources — registro y roadmap

## Ubicación

| Qué | Ruta |
|-----|------|
| Registro (metadatos) | `sources/registry.py` |
| Config en runtime | `sources/sources_config.json` |
| Adaptadores reales | `sources/adapters/*.py` |
| Stubs compartidos | `sources/adapters/stub_sources.py` |
| Mapa id → función | `sources/adapters/__init__.py` (`ADAPTERS`) |
| Orden modo `auto` | `ordered_source_ids_for_auto()` en `registry.py` |
| Paridad Nest | `backend/src/leads/leads-sources.registry.ts` |

## Fuentes en pausa (anti-bot / sin ROI en este entorno)

Sin más implementación por ahora (siguen en el registro, con debug y fuera de `auto`): **paginas_amarillas**, **google_discovery**, **cylex**, **infobel**, **kompass** (Datadome/captcha), **yalwa** (Cloudflare). **Europages** tiene adaptador HTTP+parse (salud `partial`; no auto hasta validar). Siguiente en roadmap: **hotfrog**, **qdq**, …

## Modo `auto`

1. Fuentes **no** listadas en `disabled_source_ids`.
2. Fuentes con `default_enabled: true` **o** en `extra_enabled_source_ids`.
3. `include_in_auto: true` en el registro **o** id en `extra_enabled_source_ids`.
4. Salud: no estar en `auto_skip_health_statuses` (por defecto `blocked`, `broken`, `experimental`, `partial`), salvo `auto_allow_experimental: true` para experimentales.

Con la config por defecto, **solo `empresite`** (salud `ok`) entra en el pipeline automático.

## Mejorar una fuente (orden acordado)

1. **empresite** — ya activo (`empresite/scraper.py` + `adapters/empresite.py`).
2. **cylex** — adaptador real `cylex/scraper.py` + `adapters/cylex.py` (salud `partial`; no auto hasta subir a `ok`).
3. **infobel** — adaptador real `infobel/scraper.py` + `adapters/infobel.py` (salud `partial`; no auto hasta validar; Cloudflare frecuente).
4. **kompass** — adaptador real `kompass/scraper.py` + `adapters/kompass.py` (salud `blocked` desde IP típica; Datadome).
5. **yalwa** — adaptador real `yalwa/scraper.py` (salud `blocked` desde IP típica; Cloudflare).
6. **europages** — adaptador real `europages/scraper.py` (salud `partial`; listados `/companies/spain/…`).
7. **hotfrog / qdq** — stubs → adaptadores dedicados o módulo común.
8. **bing / maps / linkedin** — descubrimiento; más tarde.

Pasos típicos por fuente: implementar `run()` → probar `run_scrape.py --source <id>` → activar en config (`extra_enabled` o subir salud a `ok`) → opcionalmente `include_in_auto: true` en `registry.py`.

## `auto` no es una fuente

Es el modo que recorre las fuentes elegibles en orden de `effective_priority`.
