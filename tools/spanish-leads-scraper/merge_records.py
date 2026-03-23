"""Fusionar listas de leads y deduplicar por dedupe_key."""
from __future__ import annotations

from typing import Any

from paginas_amarillas.scraper import compute_dedupe_key


def ensure_dedupe_key(row: dict[str, Any]) -> dict[str, Any]:
    if row.get("dedupe_key"):
        return row
    name = (row.get("company_name") or "").strip() or "unknown"
    phone = row.get("phone")
    web = row.get("website") or row.get("source_url")
    return {
        **row,
        "dedupe_key": compute_dedupe_key(name, phone, web),
    }


def merge_by_dedupe_key(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for r in records:
        row = ensure_dedupe_key(r)
        k = row["dedupe_key"]
        if k in seen:
            continue
        seen.add(k)
        out.append(row)
    return out
