"""
Calidad de nombres y filtrado ligero para leads Empresite (sin cambiar el flujo global).
"""
from __future__ import annotations

import os
import re
import unicodedata
from typing import Any

# Frases o términos demasiado genéricos como nombre de empresa (minúsculas, sin acento para comparar)
GENERIC_PHRASES: frozenset[str] = frozenset(
    {
        "servicios a empresas",
        "servicios para empresas",
        "servicios empresariales",
        "mantenimiento integral",
        "mantenimiento industrial",
        "mantenimientos",
        "logística",
        "logistica",
        "industrias",
        "construcciones",
        "mantenimiento",
        "suministros industriales",
    }
)

# Palabras que, solas o casi solas, no identifican una empresa
GENERIC_TOKENS: frozenset[str] = frozenset(
    {
        "industrias",
        "logística",
        "logistica",
        "mantenimientos",
        "mantenimiento",
        "construcciones",
        "servicios",
        "suministros",
        "transporte",
        "almacén",
        "almacen",
        "comercio",
        "comercial",
        "gestión",
        "gestion",
        "empresa",
        "empresas",
        "negocio",
        "negocios",
        "actividad",
        "actividades",
    }
)

_RE_LEGAL_HINT = re.compile(
    r"(?i)(^|\s)(s\.?\s*l\.?\s*u\.?|s\.?\s*l\.?\s*p\.?|s\.?\s*l\.?|s\.?\s*a\.?\s*|"
    r"c\.?\s*b\.?|s\.?\s*coop\.?|s\.?\s*a\.?\s*t\.?|s\.?\s*l\.?\s*u\.?|"
    r"sociedad\s+limitada|sociedad\s+anonima|sociedad\s+anónima)(\s|$|[,.])"
)


def _norm_key(s: str) -> str:
    t = unicodedata.normalize("NFD", (s or "").lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", t).strip()


def clean_company_name_surface(s: str) -> str:
    """Quita ruido superficial; preserva forma jurídica (S.L., S.A., …)."""
    t = " ".join((s or "").split())
    t = re.sub(r"\s*[\|\u2013\u2014\-]+\s*$", "", t)
    t = t.strip(" -–—|'\"•·")
    # restos tipo " - Empresite" al final
    t = re.sub(r"\s+[\|\-]\s*[^|\-]{0,40}$", "", t, flags=re.I)
    return t.strip()[:500]


def has_legal_form_hint(s: str) -> bool:
    return bool(_RE_LEGAL_HINT.search(s or ""))


def is_generic_only_name(name: str) -> bool:
    """True si el nombre no aporta identidad distintiva (solo palabras genéricas)."""
    if not name or len(name.strip()) < 2:
        return True
    nk = _norm_key(name)
    if nk in GENERIC_PHRASES:
        return True
    for phrase in GENERIC_PHRASES:
        if len(phrase) >= 6 and phrase in nk and len(nk) <= len(phrase) + 4:
            return True
    stripped = _norm_key(re.sub(r"[^\w\s]", " ", nk))
    tokens = [t for t in stripped.split() if t]
    if not tokens:
        return True
    if len(tokens) == 1:
        return tokens[0] in GENERIC_TOKENS
    if all(t in GENERIC_TOKENS for t in tokens):
        return True
    # Dos tokens genéricos muy comunes
    if len(tokens) == 2 and tokens[0] in GENERIC_TOKENS and tokens[1] in GENERIC_TOKENS:
        return True
    return False


def choose_better_company_name(listing: str, detail: str | None) -> str:
    """Prefiere el título de ficha si es más específico o jurídicamente completo."""
    l = clean_company_name_surface(listing)
    if not detail or len(detail.strip()) < 3:
        return l
    d = clean_company_name_surface(detail)
    if not d:
        return l
    if is_generic_only_name(l) and not is_generic_only_name(d):
        return d
    if has_legal_form_hint(d) and not has_legal_form_hint(l):
        return d
    if len(d) > len(l) + 4 and not is_generic_only_name(d):
        return d
    if len(d) > len(l) and not is_generic_only_name(d):
        return d
    return l


def lead_quality_score(rec: dict[str, Any]) -> tuple[int, list[str]]:
    """
    Puntuación 0–10 y flags. Se usa para filtrar o marcar, no como API pública estable.
    """
    flags: list[str] = []
    name = str(rec.get("company_name") or "").strip()
    phone = rec.get("phone")
    email = rec.get("email")
    website = rec.get("website")

    score = 0
    if phone:
        score += 3
    if email:
        score += 3
    if website:
        score += 2
    if len(name) >= 18:
        score += 1
    elif len(name) < 8:
        score -= 1
        flags.append("short_name")
    if has_legal_form_hint(name):
        score += 2
    if len(name.split()) >= 4:
        score += 1

    if is_generic_only_name(name):
        score -= 5
        flags.append("generic_name")
    if len(name) < 4:
        score -= 4
        flags.append("too_short")

    score = max(0, min(10, score))
    return score, flags


def apply_quality_pipeline(
    records: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    Elimina filas muy débiles y marca calidad en ``notes`` / ``status``.
    ``LEADS_EMPRESITE_DROP_GENERIC_NO_CONTACT``: default ``1`` — borra genérico sin tel/mail/web.
    """
    drop_generic = (os.environ.get("LEADS_EMPRESITE_DROP_GENERIC_NO_CONTACT") or "1").strip() not in (
        "0",
        "false",
        "no",
    )
    min_len = int(os.environ.get("LEADS_EMPRESITE_MIN_NAME_LEN") or "3")

    stats: dict[str, Any] = {
        "listing_rows_in": len(records),
        "rows_dropped": 0,
        "drop_reasons": {},
        "rows_flagged_low_quality": 0,
    }

    out: list[dict[str, Any]] = []

    for rec in records:
        name = clean_company_name_surface(str(rec.get("company_name") or ""))
        rec["company_name"] = name

        phone = rec.get("phone")
        email = rec.get("email")
        website = rec.get("website")
        has_contact = bool(phone or email or website)

        drop = False
        reason = None
        if len(name) < min_len:
            drop = True
            reason = "too_short"
        elif drop_generic and is_generic_only_name(name) and not has_contact:
            drop = True
            reason = "generic_no_contact"

        if drop:
            stats["rows_dropped"] += 1
            stats["drop_reasons"][reason or "unknown"] = (
                stats["drop_reasons"].get(reason or "unknown", 0) + 1
            )
            continue

        score, flags = lead_quality_score(rec)

        if score <= 3 and not has_contact:
            rec["status"] = "low_quality"
        else:
            rec["status"] = rec.get("status") or "new"

        if flags or score <= 4:
            stats["rows_flagged_low_quality"] += 1
            parts: list[str] = []
            prev = rec.get("notes")
            if prev and isinstance(prev, str):
                parts.append(prev)
            parts.append(f"empresite_q:{score}")
            if flags:
                parts.append(f"flags:{','.join(flags)}")
            rec["notes"] = "|".join(parts)

        out.append(rec)

    stats["rows_kept"] = len(out)
    return out, stats
