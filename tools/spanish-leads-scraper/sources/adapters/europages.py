"""Adaptador Europages (europages.es) — ver ``europages/scraper.py``."""
from __future__ import annotations

from typing import Any

from europages.scraper import scrape_europages
from sources.criteria import SearchCriteria


def run(
    criteria: SearchCriteria,
    *,
    max_pages: int,
    scraped_iso: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    return scrape_europages(criteria, scraped_iso=scraped_iso, max_pages=max_pages)
