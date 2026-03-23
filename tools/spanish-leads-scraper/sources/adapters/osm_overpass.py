"""MVP: stub (Overpass requiere endpoint y límites de uso)."""
from __future__ import annotations

from typing import Any

from sources.criteria import SearchCriteria


def run(
    criteria: SearchCriteria,
    *,
    max_pages: int,
    scraped_iso: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    return [], {"debug": {"source_id": "osm_overpass", "hint": "Adaptador stub (sin red).", "zero_reason_code": "stub"}}
