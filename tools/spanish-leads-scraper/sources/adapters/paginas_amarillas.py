from __future__ import annotations

import os
from typing import Any

from paginas_amarillas.scraper import ScraperBlockedError, scrape_search
from sources.criteria import SearchCriteria

_MAX_PHRASES_DEFAULT = 4


def run(
    criteria: SearchCriteria,
    *,
    max_pages: int,
    scraped_iso: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    dbg: dict[str, Any] = {"source_id": "paginas_amarillas"}
    try:
        raw = (os.environ.get("LEADS_PA_MAX_PHRASES") or "").strip()
        max_phr = int(raw) if raw.isdigit() else _MAX_PHRASES_DEFAULT
        max_phr = max(1, min(max_phr, 12))
        phrases = (criteria.expanded_query_phrases or [criteria.category])[:max_phr]
        dbg["search_term"] = f"{criteria.category!r} en {criteria.where_slug!r}"
        dbg["query_phrases_used"] = phrases
        dbg["phrase_rounds"] = []

        all_recs: list[dict[str, Any]] = []
        seen_keys: set[str] = set()

        for i, phrase in enumerate(phrases):
            sub: dict[str, Any] = {}
            try:
                chunk = scrape_search(
                    phrase,
                    criteria.where_slug,
                    max_pages=max_pages,
                    city=criteria.city,
                    debug_out=sub,
                )
            except ScraperBlockedError as e:
                sub.setdefault("phrase", phrase)
                dbg["phrase_rounds"].append(sub)
                dbg.update(
                    {
                        k: sub.get(k)
                        for k in ("blocked", "zero_reason_code", "hint", "attempts")
                        if sub.get(k) is not None
                    }
                )
                dbg["blocked"] = True
                dbg.setdefault("zero_reason_code", "blocked")
                dbg.setdefault(
                    "hint",
                    "La fuente bloqueó la solicitud automática (anti-bot).",
                )
                raise

            sub["phrase"] = phrase
            dbg["phrase_rounds"].append(sub)
            for r in chunk:
                k = r["dedupe_key"]
                if k in seen_keys:
                    continue
                seen_keys.add(k)
                all_recs.append(r)

        dbg["parsed_final"] = len(all_recs)
        if dbg.get("phrase_rounds"):
            dbg["attempts"] = dbg["phrase_rounds"][0].get("attempts", [])
        return all_recs, {"debug": dbg}
    except ScraperBlockedError as e:
        dbg.setdefault("blocked", True)
        dbg.setdefault("zero_reason_code", "blocked")
        dbg.setdefault(
            "hint",
            "La fuente bloqueó la solicitud automática (anti-bot).",
        )
        return [], {"debug": dbg, "blocked": True, "error": str(e)}
