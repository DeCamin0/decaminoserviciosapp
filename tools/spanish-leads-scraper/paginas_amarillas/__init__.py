"""Páginas Amarillas (España) — scraper MVP."""

from .scraper import (
    ScraperBlockedError,
    build_search_url,
    compute_dedupe_key,
    parse_listing_html,
    scrape_search,
)

__all__ = [
    "ScraperBlockedError",
    "build_search_url",
    "compute_dedupe_key",
    "parse_listing_html",
    "scrape_search",
]
