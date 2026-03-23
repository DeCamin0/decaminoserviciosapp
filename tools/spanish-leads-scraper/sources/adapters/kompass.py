"""Adaptador Kompass (kompass.com) — ver ``kompass/scraper.py``."""
from __future__ import annotations

from typing import Any

from kompass.scraper import scrape_kompass
from sources.criteria import SearchCriteria


def run(
    criteria: SearchCriteria,
    *,
    max_pages: int,
    scraped_iso: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    return scrape_kompass(criteria, scraped_iso=scraped_iso, max_pages=max_pages)
