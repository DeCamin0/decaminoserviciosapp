"""
Fuentes stub (sin red): habilitar vía ``extra_enabled_source_ids`` o pruebas.

Ids registrados aquí: hotfrog, qdq, axesor, einforma,
linkedin_discovery, bing_discovery. (cylex tiene adaptador propio.)

TODO por fuente: petición HTTP, parseo estable, manejo de bloqueo, tests.
Ver ``SOURCES.md`` y ``sources/registry.py`` para el roadmap.
"""
from __future__ import annotations

from typing import Any

from sources.criteria import SearchCriteria


def _stub_meta(
    source_id: str,
    *,
    display: str,
    tier: int,
    extra_note: str = "",
) -> dict[str, Any]:
    note = f"TODO: implementar {display} (tier {tier}). {extra_note}".strip()
    return {
        "debug": {
            "source_id": source_id,
            "zero_reason_code": "stub",
            "hint": note,
        }
    }


def run_hotfrog(
    criteria: SearchCriteria,
    *,
    max_pages: int,
    scraped_iso: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    # TODO: Hotfrog España
    return [], _stub_meta("hotfrog", display="Hotfrog", tier=2)


def run_qdq(
    criteria: SearchCriteria,
    *,
    max_pages: int,
    scraped_iso: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    # TODO: QDQ / directorios locales ES
    return [], _stub_meta("qdq", display="QDQ", tier=2)


def run_axesor(
    criteria: SearchCriteria,
    *,
    max_pages: int,
    scraped_iso: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    # TODO: Axesor — posible API / restricciones
    return [], _stub_meta("axesor", display="Axesor", tier=3)


def run_einforma(
    criteria: SearchCriteria,
    *,
    max_pages: int,
    scraped_iso: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    # TODO: eInforma — datos sensibles / legal
    return [], _stub_meta("einforma", display="eInforma", tier=3)


def run_linkedin_discovery(
    criteria: SearchCriteria,
    *,
    max_pages: int,
    scraped_iso: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    # TODO: búsqueda pública LinkedIn — límites estrictos, sin API de pago
    return [], _stub_meta(
        "linkedin_discovery",
        display="LinkedIn (descubrimiento)",
        tier=3,
        extra_note="Requiere estrategia distinta a HTML simple.",
    )


def run_bing_discovery(
    criteria: SearchCriteria,
    *,
    max_pages: int,
    scraped_iso: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    # TODO: Bing HTML / rate limits similares a Google
    return [], _stub_meta("bing_discovery", display="Bing (descubrimiento)", tier=3)


STUB_ADAPTER_BY_ID: dict[str, Any] = {
    "hotfrog": run_hotfrog,
    "qdq": run_qdq,
    "axesor": run_axesor,
    "einforma": run_einforma,
    "linkedin_discovery": run_linkedin_discovery,
    "bing_discovery": run_bing_discovery,
}
