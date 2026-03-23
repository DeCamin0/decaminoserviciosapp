"""MVP: stub (futuro: Nominatim / tiles públicos según política de uso)."""
from __future__ import annotations

from typing import Any

from sources.criteria import SearchCriteria


def run(
    criteria: SearchCriteria,
    *,
    max_pages: int,
    scraped_iso: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    return [], {"debug": {"source_id": "maps_discovery", "hint": "Adaptador stub (sin red).", "zero_reason_code": "stub"}}
