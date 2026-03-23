"""
Perfiles de búsqueda por categoría (frases, CNAE, orden de fuentes).

Config: ``sources/category_search_profiles.json`` junto a este módulo.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from sources.criteria import SearchCriteria

_PROFILES_FILE = Path(__file__).resolve().parent / "category_search_profiles.json"


def _norm_key(s: str) -> str:
    t = (s or "").strip().lower()
    t = re.sub(r"[^a-z0-9]+", "-", t)
    return re.sub(r"-+", "-", t).strip("-")


def load_category_profiles(path: Path | None = None) -> dict[str, Any]:
    p = path or _PROFILES_FILE
    if not p.is_file():
        return {"version": 1, "profiles": {}}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {"profiles": {}}
    except (OSError, json.JSONDecodeError):
        return {"version": 1, "profiles": {}}


def resolve_profile(
    category: str, data: dict[str, Any]
) -> tuple[str | None, dict[str, Any]]:
    profiles = data.get("profiles")
    if not isinstance(profiles, dict):
        return None, {}
    nk = _norm_key(category)
    if not nk:
        return None, {}
    for pid, meta in profiles.items():
        if not isinstance(meta, dict):
            continue
        if _norm_key(str(pid)) == nk:
            return str(pid), meta
        for a in meta.get("aliases", []) or []:
            if _norm_key(str(a)) == nk:
                return str(pid), meta
    defpid = data.get("default_profile_id")
    if defpid is not None and str(defpid) in profiles:
        m = profiles[str(defpid)]
        if isinstance(m, dict):
            return str(defpid), m
    return None, {}


def _dedupe_strs(items: list[str], *, max_n: int | None = None) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in items:
        t = (x or "").strip()
        if len(t) < 2:
            continue
        k = t.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(t)
        if max_n is not None and len(out) >= max_n:
            break
    return out


def _normalize_cnae(code: str) -> str:
    d = re.sub(r"\D", "", (code or "").strip())
    return d[:4] if len(d) >= 4 else (code or "").strip()


def expand_search_criteria(
    criteria: SearchCriteria,
    *,
    profiles_data: dict[str, Any] | None = None,
) -> SearchCriteria:
    """
    Rellena ``expanded_query_phrases``, ``cnae_codes``, ``preferred_source_order``,
    ``search_profile_id`` y amplía ``classification_codes`` con CNAE del perfil.
    """
    data = profiles_data if profiles_data is not None else load_category_profiles()
    pid, meta = resolve_profile(criteria.category, data)

    phrases: list[str] = []
    if meta:
        for p in meta.get("query_phrases", []) or []:
            phrases.append(str(p).strip())
    phrases.append(criteria.category.strip())
    for s in criteria.synonyms:
        phrases.append(s.strip())
    if meta:
        for p in meta.get("synonyms_extra", []) or []:
            phrases.append(str(p).strip())
    phrases = _dedupe_strs(phrases)

    profile_cnae: list[str] = []
    if meta:
        for c in meta.get("cnae_codes", []) or []:
            nc = _normalize_cnae(str(c))
            if nc:
                profile_cnae.append(nc)
    user_codes = [_normalize_cnae(str(x)) for x in criteria.classification_codes if str(x).strip()]
    user_codes = [x for x in user_codes if x]
    merged_codes = list(dict.fromkeys(profile_cnae + user_codes))

    pref: list[str] = []
    if meta:
        for x in meta.get("preferred_source_order", []) or []:
            s = str(x).strip()
            if s:
                pref.append(s)

    d = criteria.to_dict()
    d["expanded_query_phrases"] = phrases
    d["search_profile_id"] = pid or ""
    d["cnae_codes"] = merged_codes
    d["classification_codes"] = merged_codes
    d["preferred_source_order"] = pref
    return SearchCriteria.from_dict(d)


def apply_preferred_source_order(
    order: list[str], preferred: list[str] | None
) -> list[str]:
    """
    Reordena fuentes en modo auto: primero las preferidas (si están habilitadas),
    luego el resto. Google discovery queda siempre al final si está en la lista.
    """
    if not order:
        return order
    goog = "google_discovery"
    if not preferred:
        return _google_last(order)
    pref_hit = [x for x in preferred if x in order]
    rest = [x for x in order if x not in pref_hit]
    merged = pref_hit + rest
    return _google_last(merged)


def _google_last(order: list[str]) -> list[str]:
    goog = "google_discovery"
    if goog not in order:
        return order
    return [x for x in order if x != goog] + [goog]
