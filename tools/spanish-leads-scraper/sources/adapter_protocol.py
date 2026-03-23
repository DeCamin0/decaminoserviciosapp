"""
Contrato común para adaptadores de fuentes (leads España).

Todos los adaptadores deben exponer::

    def run(
        criteria: SearchCriteria,
        *,
        max_pages: int,
        scraped_iso: str,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]

La segunda parte del tuple es ``meta``:
- ``debug``: dict con telemetría (``source_id``, ``zero_reason_code``, ``hint``, …)
- ``blocked``: bool opcional (anti-bot / rate limit)
- ``error``: str opcional
"""
from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from sources.criteria import SearchCriteria


@runtime_checkable
class SourceAdapter(Protocol):
    def __call__(
        self,
        criteria: SearchCriteria,
        *,
        max_pages: int,
        scraped_iso: str,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]: ...
