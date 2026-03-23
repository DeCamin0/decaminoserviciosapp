"""
Orquestación vía registro de fuentes: modo auto o una sola fuente.
Los adaptadores devuelven ``(records, meta)`` donde ``meta`` puede incluir
``debug``, ``blocked`` y ``error``.
"""
from __future__ import annotations

import os
import random
import time
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from merge_records import merge_by_dedupe_key
from sources.adapters import ADAPTERS
from sources.criteria import SearchCriteria
from sources.registry import get_source_def, load_sources_config, ordered_source_ids_for_auto
from sources.search_profiles import apply_preferred_source_order


def _scraped_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _safe_run(
    name: str, fn: Callable[[], Any]
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    try:
        out = fn()
        if isinstance(out, tuple) and len(out) == 2:
            data, meta = out
        else:
            data, meta = out, {}
        data = list(data) if data is not None else []
        if not isinstance(meta, dict):
            meta = {}
        dbg = meta.get("debug", {}) if isinstance(meta.get("debug"), dict) else {}
        if meta.get("blocked"):
            return data, {
                "ok": False,
                "scraped": 0,
                "failed": True,
                "blocked": True,
                "error": meta.get("error", "blocked"),
                "debug": dbg,
            }
        return data, {
            "ok": True,
            "scraped": len(data),
            "failed": False,
            "debug": dbg,
        }
    except Exception as e:
        return [], {
            "ok": False,
            "scraped": 0,
            "failed": True,
            "error": str(e)[:500],
            "debug": {},
        }


def _sleep_between_auto_sources() -> None:
    """
    Evita ráfagas PA → Empresite → Google en el mismo segundo (misma IP).
    ``LEADS_INTER_SOURCE_DELAY_SEC``: vacío = 4.5–9.0 s aleatorio; ``5`` = 5 s;
    ``3-8`` = rango; ``0`` = desactivar.
    """
    raw = (os.environ.get("LEADS_INTER_SOURCE_DELAY_SEC") or "").strip()
    if raw.lower() in ("0", "false", "no", "off"):
        return
    lo, hi = 4.5, 9.0
    if raw:
        if "-" in raw:
            parts = raw.split("-", 1)
            try:
                lo = float(parts[0].strip())
                hi = float(parts[1].strip())
            except ValueError:
                pass
        else:
            try:
                v = float(raw)
                lo = hi = v
            except ValueError:
                pass
    if hi < lo:
        lo, hi = hi, lo
    time.sleep(random.uniform(lo, hi))


def normalize_source_id(source: str) -> str:
    s = (source or "auto").strip().lower()
    if s == "google":
        return "google_discovery"
    return s


def run_scrape_pipeline(
    source: str,
    criteria: SearchCriteria,
    *,
    max_pages: int,
    config: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, list[dict[str, Any]]]]:
    cfg = config if config is not None else load_sources_config()
    scraped_iso = _scraped_iso()
    norm = normalize_source_id(source)

    if norm == "auto":
        order = ordered_source_ids_for_auto(cfg)
        order = apply_preferred_source_order(
            order, criteria.preferred_source_order or None
        )
    else:
        if norm not in ADAPTERS:
            raise ValueError(f"Unknown source: {source}")
        order = [norm]

    records_by_source: dict[str, list[dict[str, Any]]] = {}
    stats_sources: dict[str, Any] = {}

    for idx, sid in enumerate(order):
        if norm == "auto" and idx > 0:
            _sleep_between_auto_sources()
        adapter = ADAPTERS.get(sid)
        if not adapter:
            records_by_source[sid] = []
            stats_sources[sid] = {
                "ok": False,
                "scraped": 0,
                "failed": True,
                "error": "sin adaptador registrado",
                "debug": {},
            }
            continue

        def runner(ad: Callable[..., Any] = adapter) -> Any:
            return ad(criteria, max_pages=max_pages, scraped_iso=scraped_iso)

        chunk, st = _safe_run(sid, runner)
        dbug = st.get("debug")
        if isinstance(dbug, dict) and dbug.get("blocked"):
            st["ok"] = False
            st["failed"] = True
            st["blocked"] = True
            chunk = []
            st["scraped"] = 0
        meta = get_source_def(sid)
        st["failure_mode"] = meta.failure_mode if meta else "partial"
        if st.get("debug"):
            d = st["debug"]
            if isinstance(d, dict):
                st["hint"] = d.get("hint")
                st["zero_reason_code"] = d.get("zero_reason_code")
                st["blocked"] = bool(d.get("blocked")) or bool(st.get("blocked"))
        records_by_source[sid] = chunk
        stats_sources[sid] = st

    flat: list[dict[str, Any]] = []
    for sid in order:
        flat.extend(records_by_source.get(sid) or [])

    merged = merge_by_dedupe_key(flat)
    stats: dict[str, Any] = {
        "sources": stats_sources,
        "import_order": order,
        "_merged_unique": len(merged),
        "_merged_raw": len(flat),
        "criteria": criteria.to_dict(),
    }
    return merged, stats, records_by_source
