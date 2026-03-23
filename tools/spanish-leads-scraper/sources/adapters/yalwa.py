"""Adaptador Yalwa (yalwa.es) — ver ``yalwa/scraper.py``."""
from __future__ import annotations

from typing import Any

from sources.criteria import SearchCriteria
from yalwa.scraper import scrape_yalwa


def run(
    criteria: SearchCriteria,
    *,
    max_pages: int,
    scraped_iso: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    return scrape_yalwa(criteria, scraped_iso=scraped_iso, max_pages=max_pages)
