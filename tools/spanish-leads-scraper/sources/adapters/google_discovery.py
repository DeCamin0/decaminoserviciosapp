from __future__ import annotations

from typing import Any

from sources.criteria import SearchCriteria


def run(
    criteria: SearchCriteria,
    *,
    max_pages: int,
    scraped_iso: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    from google_discovery.scraper import scrape_google_leads

    return scrape_google_leads(
        criteria,
        scraped_iso=scraped_iso,
        max_sites=12,
        max_search_results=12,
    )
