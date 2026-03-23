from __future__ import annotations

from typing import Any

from sources.criteria import SearchCriteria


def run(
    criteria: SearchCriteria,
    *,
    max_pages: int,
    scraped_iso: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    from empresite.scraper import scrape_empresite

    what = criteria.category
    if criteria.synonyms:
        what = f"{what} {' '.join(criteria.synonyms[:3])}"
    if criteria.free_text:
        what = f"{what} {criteria.free_text[:80]}".strip()

    return scrape_empresite(
        what,
        criteria.where_slug,
        scraped_iso=scraped_iso,
        category=criteria.category,
        province=criteria.province,
        city=criteria.city,
        query_phrases=criteria.expanded_query_phrases or None,
    )
