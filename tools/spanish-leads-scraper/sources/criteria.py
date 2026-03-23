"""Criterios de búsqueda compartidos por los adaptadores."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class SearchCriteria:
    category: str
    where_slug: str
    province: str = ""
    city: str = ""
    country: str = "ES"
    synonyms: list[str] = field(default_factory=list)
    free_text: str = ""
    classification_codes: list[str] = field(default_factory=list)
    enrich_contact_pages: bool = False
    """Si True, los adaptadores rellenan ``debug`` detallado (también LEADS_SCRAPE_DEBUG=1)."""
    debug: bool = False
    # Rellenado por ``expand_search_criteria`` (perfil JSON + entrada usuario)
    expanded_query_phrases: list[str] = field(default_factory=list)
    cnae_codes: list[str] = field(default_factory=list)
    search_profile_id: str = ""
    preferred_source_order: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> SearchCriteria:
        return cls(
            category=str(d.get("category") or "").strip(),
            where_slug=str(d.get("where_slug") or d.get("whereSlug") or "").strip(),
            province=str(d.get("province") or "").strip(),
            city=str(d.get("city") or "").strip(),
            country=str(d.get("country") or "ES").strip().upper() or "ES",
            synonyms=_str_list(d.get("synonyms")),
            free_text=str(d.get("free_text") or d.get("freeText") or "").strip(),
            classification_codes=_str_list(
                d.get("classification_codes") or d.get("classificationCodes")
            ),
            enrich_contact_pages=bool(d.get("enrich_contact_pages") or d.get("enrichContactPages")),
            debug=bool(d.get("debug")),
            expanded_query_phrases=_str_list(
                d.get("expanded_query_phrases") or d.get("expandedQueryPhrases")
            ),
            cnae_codes=_str_list(d.get("cnae_codes") or d.get("cnaeCodes")),
            search_profile_id=str(d.get("search_profile_id") or d.get("searchProfileId") or "").strip(),
            preferred_source_order=_str_list(
                d.get("preferred_source_order") or d.get("preferredSourceOrder")
            ),
        )

    @classmethod
    def from_path(cls, path: Path) -> SearchCriteria:
        raw = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            raise ValueError("criteria JSON debe ser un objeto")
        return cls.from_dict(raw)


def _str_list(v: Any) -> list[str]:
    if v is None:
        return []
    if isinstance(v, str):
        return [s.strip() for s in v.split(",") if s.strip()]
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    return []
