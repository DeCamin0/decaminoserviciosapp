"""Adaptador Cylex (cylex.es) — ver ``cylex/scraper.py``."""
from __future__ import annotations

from typing import Any

from cylex.scraper import scrape_cylex
from sources.criteria import SearchCriteria


def run(
    criteria: SearchCriteria,
    *,
    max_pages: int,
    scraped_iso: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    return scrape_cylex(criteria, scraped_iso=scraped_iso, max_pages=max_pages)
