"""Registro central de fuentes de leads (España): metadatos + prioridad + salud operativa."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Literal

SourceType = Literal["directory", "map", "search_engine", "official_site", "niche"]
FailureMode = Literal["blocked", "partial", "stable"]
SearchMode = Literal["category", "city", "province", "free_text", "code"]
HealthStatus = Literal["ok", "blocked", "broken", "experimental", "partial"]


@dataclass(frozen=True)
class SourceDefinition:
    id: str
    display_name: str
    countries: tuple[str, ...]
    source_type: SourceType
    search_modes: tuple[SearchMode, ...]
    output_fields: tuple[str, ...]
    priority: int
    default_enabled: bool
    failure_mode: FailureMode
    notes: str = ""
    # ok | blocked (frágil) | broken | experimental (stub)
    health_status: HealthStatus = "ok"
    # 1–3 stubs planificados; None = producción
    tier: int | None = None
    # False: no entra en auto salvo extra_enabled_source_ids
    include_in_auto: bool = True
    # relativo a tools/spanish-leads-scraper/
    adapter_path: str = ""

    def to_public_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["countries"] = list(self.countries)
        d["search_modes"] = list(self.search_modes)
        d["output_fields"] = list(self.output_fields)
        return d


_STUB = "sources/adapters/stub_sources.py"

REGISTRY: tuple[SourceDefinition, ...] = (
    SourceDefinition(
        id="paginas_amarillas",
        display_name="Páginas Amarillas",
        countries=("ES",),
        source_type="directory",
        search_modes=("category", "city", "province"),
        output_fields=("company_name", "phone", "website", "address"),
        priority=10,
        default_enabled=True,
        failure_mode="blocked",
        notes="Incapsula frecuente desde servidor; HTML guardado recomendado. Roadmap: mantener extracción vía HTML guardado.",
        health_status="blocked",
        include_in_auto=True,
        adapter_path="sources/adapters/paginas_amarillas.py",
    ),
    SourceDefinition(
        id="empresite",
        display_name="Empresite (El Economista)",
        countries=("ES",),
        source_type="directory",
        search_modes=("category", "city", "province", "free_text"),
        output_fields=("company_name", "phone", "website"),
        priority=20,
        default_enabled=True,
        failure_mode="partial",
        notes="Única fuente red activa (MVP). 429 posible — ver empresite/scraper.py.",
        health_status="ok",
        include_in_auto=True,
        adapter_path="sources/adapters/empresite.py",
    ),
    SourceDefinition(
        id="infobel",
        display_name="Infobel",
        countries=("ES",),
        source_type="directory",
        search_modes=("category", "city", "province", "code"),
        output_fields=("company_name", "phone", "website"),
        priority=30,
        default_enabled=False,
        failure_mode="partial",
        notes="Directorio infobel.com/es/spain; Cloudflare frecuente desde IP servidor. No auto hasta validar.",
        health_status="partial",
        tier=1,
        include_in_auto=False,
        adapter_path="sources/adapters/infobel.py",
    ),
    SourceDefinition(
        id="kompass",
        display_name="Kompass",
        countries=("ES",),
        source_type="directory",
        search_modes=("category", "city", "province", "code"),
        output_fields=("company_name", "phone", "website"),
        priority=40,
        default_enabled=False,
        failure_mode="blocked",
        notes="Listados kompass.com; Datadome/captcha frecuente desde IP servidor. Sin bypass en este adaptador.",
        health_status="blocked",
        tier=2,
        include_in_auto=False,
        adapter_path="sources/adapters/kompass.py",
    ),
    SourceDefinition(
        id="google_discovery",
        display_name="Google (descubrimiento)",
        countries=("ES",),
        source_type="search_engine",
        search_modes=("category", "city", "province", "free_text"),
        output_fields=("company_name", "email", "phone", "website"),
        priority=50,
        default_enabled=True,
        failure_mode="blocked",
        notes="429 / CAPTCHA desde IP servidor; se excluye del auto por defecto (config).",
        health_status="blocked",
        include_in_auto=True,
        adapter_path="sources/adapters/google_discovery.py",
    ),
    SourceDefinition(
        id="maps_discovery",
        display_name="Mapas / POI",
        countries=("ES",),
        source_type="map",
        search_modes=("category", "city", "province", "free_text"),
        output_fields=("company_name", "website", "phone"),
        priority=60,
        default_enabled=False,
        failure_mode="partial",
        notes="Roadmap descubrimiento — stub; futuro Nominatim/tiles según política.",
        health_status="experimental",
        tier=3,
        include_in_auto=False,
        adapter_path="sources/adapters/maps_discovery.py",
    ),
    SourceDefinition(
        id="osm_overpass",
        display_name="OpenStreetMap (Overpass)",
        countries=("ES",),
        source_type="map",
        search_modes=("category", "city", "province", "free_text"),
        output_fields=("company_name", "website"),
        priority=70,
        default_enabled=False,
        failure_mode="stable",
        notes="Opcional — stub Overpass; no confundir con maps_discovery.",
        health_status="experimental",
        tier=3,
        include_in_auto=False,
        adapter_path="sources/adapters/osm_overpass.py",
    ),
    SourceDefinition(
        id="cylex",
        display_name="Cylex",
        countries=("ES",),
        source_type="directory",
        search_modes=("category", "city", "province"),
        output_fields=("company_name", "phone", "website"),
        priority=80,
        default_enabled=False,
        failure_mode="partial",
        notes="Listados cylex.es; Cloudflare frecuente desde IP servidor. No auto hasta validar en producción.",
        health_status="partial",
        tier=1,
        include_in_auto=False,
        adapter_path="sources/adapters/cylex.py",
    ),
    SourceDefinition(
        id="yalwa",
        display_name="Yalwa",
        countries=("ES",),
        source_type="directory",
        search_modes=("category", "city", "province"),
        output_fields=("company_name", "phone", "website"),
        priority=85,
        default_enabled=False,
        failure_mode="blocked",
        notes="yalwa.es / subdominios ciudad; Cloudflare frecuente desde IP servidor. No auto hasta validar.",
        health_status="blocked",
        tier=2,
        include_in_auto=False,
        adapter_path="sources/adapters/yalwa.py",
    ),
    SourceDefinition(
        id="europages",
        display_name="Europages",
        countries=("ES",),
        source_type="directory",
        search_modes=("category", "city", "province", "free_text"),
        output_fields=("company_name", "phone", "website"),
        priority=86,
        default_enabled=False,
        failure_mode="partial",
        notes="Listados /companies/spain/{slug}.html (Visable). No auto hasta validar en producción.",
        health_status="partial",
        tier=2,
        include_in_auto=False,
        adapter_path="sources/adapters/europages.py",
    ),
    SourceDefinition(
        id="hotfrog",
        display_name="Hotfrog",
        countries=("ES",),
        source_type="directory",
        search_modes=("category", "city", "province"),
        output_fields=("company_name", "phone", "website"),
        priority=87,
        default_enabled=False,
        failure_mode="partial",
        notes="Roadmap #5 (lote) — stub.",
        health_status="experimental",
        tier=2,
        include_in_auto=False,
        adapter_path=_STUB,
    ),
    SourceDefinition(
        id="qdq",
        display_name="QDQ",
        countries=("ES",),
        source_type="niche",
        search_modes=("category", "city", "province"),
        output_fields=("company_name", "phone", "website"),
        priority=88,
        default_enabled=False,
        failure_mode="partial",
        notes="Roadmap #5 (lote) — stub directorio ES.",
        health_status="experimental",
        tier=2,
        include_in_auto=False,
        adapter_path=_STUB,
    ),
    SourceDefinition(
        id="axesor",
        display_name="Axesor",
        countries=("ES",),
        source_type="niche",
        search_modes=("category", "code"),
        output_fields=("company_name", "phone", "website"),
        priority=90,
        default_enabled=False,
        failure_mode="stable",
        notes="Roadmap datos comerciales — stub; posible API/licencia.",
        health_status="experimental",
        tier=3,
        include_in_auto=False,
        adapter_path=_STUB,
    ),
    SourceDefinition(
        id="einforma",
        display_name="eInforma",
        countries=("ES",),
        source_type="official_site",
        search_modes=("category", "code", "free_text"),
        output_fields=("company_name", "phone", "website"),
        priority=91,
        default_enabled=False,
        failure_mode="stable",
        notes="Roadmap — stub; datos sensibles / cumplimiento.",
        health_status="experimental",
        tier=3,
        include_in_auto=False,
        adapter_path=_STUB,
    ),
    SourceDefinition(
        id="linkedin_discovery",
        display_name="LinkedIn (descubrimiento)",
        countries=("ES", "EU"),
        source_type="search_engine",
        search_modes=("category", "free_text"),
        output_fields=("company_name", "website"),
        priority=92,
        default_enabled=False,
        failure_mode="blocked",
        notes="Roadmap descubrimiento — stub; límites estrictos, sin API de pago aún.",
        health_status="experimental",
        tier=3,
        include_in_auto=False,
        adapter_path=_STUB,
    ),
    SourceDefinition(
        id="bing_discovery",
        display_name="Bing (descubrimiento)",
        countries=("ES",),
        source_type="search_engine",
        search_modes=("category", "city", "province", "free_text"),
        output_fields=("company_name", "phone", "website"),
        priority=93,
        default_enabled=False,
        failure_mode="blocked",
        notes="Roadmap descubrimiento — stub; rate limits tipo Google.",
        health_status="experimental",
        tier=3,
        include_in_auto=False,
        adapter_path=_STUB,
    ),
)

_BY_ID = {s.id: s for s in REGISTRY}


def get_source_def(source_id: str) -> SourceDefinition | None:
    return _BY_ID.get(source_id)


def all_source_ids() -> list[str]:
    return [s.id for s in REGISTRY]


def _default_sources_config() -> dict[str, Any]:
    return {
        "disabled_source_ids": [],
        "extra_enabled_source_ids": [],
        "priority_overrides": {},
        "auto_skip_health_statuses": ["blocked", "broken", "experimental", "partial"],
        "auto_allow_experimental": False,
    }


def load_sources_config(scraper_root: Path | None = None) -> dict[str, Any]:
    """
    Lee ``sources/sources_config.json``.

    Campos soportados:
    - ``disabled_source_ids``: excluye de auto y de selección efectiva
    - ``extra_enabled_source_ids``: activa fuentes con default_enabled false
    - ``priority_overrides``: { "empresite": 15 } — prioridad efectiva en modo auto
    - ``auto_skip_health_statuses``: salud de registro a **no** ejecutar en auto (defecto: blocked, broken, experimental)
    - ``auto_allow_experimental``: si true, las fuentes ``experimental`` entran en auto pese a la lista (útil para pruebas)
    """
    base = Path(__file__).resolve().parent
    path = base / "sources_config.json"
    defaults = _default_sources_config()
    if not path.is_file():
        return dict(defaults)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return dict(defaults)
        disabled = data.get("disabled_source_ids") or []
        if not isinstance(disabled, list):
            disabled = []
        extra = data.get("extra_enabled_source_ids") or []
        if not isinstance(extra, list):
            extra = []
        po = data.get("priority_overrides") or {}
        priority_overrides: dict[str, int] = {}
        if isinstance(po, dict):
            for k, v in po.items():
                try:
                    priority_overrides[str(k).strip()] = int(v)
                except (TypeError, ValueError):
                    continue
        ash = data.get("auto_skip_health_statuses")
        if ash is None:
            auto_skip = list(defaults["auto_skip_health_statuses"])
        elif isinstance(ash, list):
            auto_skip = [str(x).strip() for x in ash if str(x).strip()]
        else:
            auto_skip = list(defaults["auto_skip_health_statuses"])
        allow_exp = data.get("auto_allow_experimental")
        if allow_exp is None:
            allow_exp = defaults["auto_allow_experimental"]
        else:
            allow_exp = bool(allow_exp)
        return {
            "disabled_source_ids": [str(x).strip() for x in disabled if str(x).strip()],
            "extra_enabled_source_ids": [str(x).strip() for x in extra if str(x).strip()],
            "priority_overrides": priority_overrides,
            "auto_skip_health_statuses": auto_skip,
            "auto_allow_experimental": allow_exp,
        }
    except (OSError, json.JSONDecodeError):
        return dict(defaults)


def effective_priority(source_id: str, cfg: dict[str, Any]) -> int:
    d = get_source_def(source_id)
    if not d:
        return 999
    po = cfg.get("priority_overrides") or {}
    if isinstance(po, dict) and source_id in po:
        try:
            return int(po[source_id])
        except (TypeError, ValueError):
            pass
    return d.priority


def _source_enabled_for_config(s: SourceDefinition, cfg: dict[str, Any]) -> bool:
    disabled = set(cfg.get("disabled_source_ids") or [])
    extra = set(cfg.get("extra_enabled_source_ids") or [])
    if s.id in disabled:
        return False
    if s.default_enabled:
        return True
    return s.id in extra


def _included_in_auto(s: SourceDefinition, cfg: dict[str, Any]) -> bool:
    extra = set(cfg.get("extra_enabled_source_ids") or [])
    if s.id in extra:
        return True
    return s.include_in_auto


def _health_passes_auto(s: SourceDefinition, cfg: dict[str, Any]) -> bool:
    raw = cfg.get("auto_skip_health_statuses")
    if raw is None:
        skip = {"blocked", "broken", "experimental", "partial"}
    else:
        skip = set(raw) if isinstance(raw, (list, set, tuple)) else set()
    if s.health_status == "experimental" and cfg.get("auto_allow_experimental"):
        return True
    if s.health_status in skip:
        return False
    return True


def is_source_enabled(source_id: str, config: dict[str, Any] | None = None) -> bool:
    cfg = config if config is not None else load_sources_config()
    d = get_source_def(source_id)
    if not d:
        return False
    return _source_enabled_for_config(d, cfg)


def ordered_source_ids_for_auto(config: dict[str, Any] | None = None) -> list[str]:
    cfg = config if config is not None else load_sources_config()
    items: list[tuple[int, str]] = []
    for s in REGISTRY:
        if not _source_enabled_for_config(s, cfg):
            continue
        if not _included_in_auto(s, cfg):
            continue
        if not _health_passes_auto(s, cfg):
            continue
        p = effective_priority(s.id, cfg)
        items.append((p, s.id))
    return [sid for _, sid in sorted(items)]


def registry_public_json(config: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    cfg = config if config is not None else load_sources_config()
    rows: list[dict[str, Any]] = []
    for s in REGISTRY:
        d = s.to_public_dict()
        d["enabled"] = _source_enabled_for_config(s, cfg)
        d["effective_priority"] = effective_priority(s.id, cfg)
        d["in_auto_pipeline"] = (
            _source_enabled_for_config(s, cfg)
            and _included_in_auto(s, cfg)
            and _health_passes_auto(s, cfg)
        )
        rows.append(d)
    return rows
