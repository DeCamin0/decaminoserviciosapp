"""
Kompass — búsqueda de empresas (España: ``/es/es/...``).

Muchas IPs reciben **403 + Datadome** (``captcha-delivery.com``, «Please enable JS»)
sin navegador. En ese caso: ``blocked: true`` y telemetría.
El parseo aplica cuando la respuesta es HTML de listado real (200).
"""
from __future__ import annotations

import json
import random
import re
import time
from typing import Any
from urllib.parse import quote_plus, urljoin

import requests
from bs4 import BeautifulSoup

from sources.criteria import SearchCriteria

KOMPASS_ORIGIN = "https://www.kompass.com"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
]

_PHONE_RE = re.compile(
    r"(?:\+34|0034)?[\s\-]?(?:\d[\s\-]?){8,11}\d",
    re.MULTILINE,
)
# Ficha típica: .../company/slug/1234567890/ o .../w/slug/.../id
_COMPANY_PATH_RE = re.compile(
    r"/(?:company|w)/[^/]+/\d{5,}(?:/|$|\?)",
    re.I,
)


def _is_company_profile_url(full: str) -> bool:
    low = full.lower()
    if "kompass.com" not in low:
        return False
    return bool(_COMPANY_PATH_RE.search(full))


def _normalize_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if len(digits) < 9:
        return None
    if len(digits) > 9 and digits.startswith("34"):
        digits = digits[-9:]
    return digits[-9:] if len(digits) >= 9 else None


def _extract_phone_from_text(text: str) -> str | None:
    m = _PHONE_RE.search(text or "")
    if not m:
        return None
    return _normalize_phone(m.group(0))


def _location_query(criteria: SearchCriteria) -> str:
    for raw in (criteria.city, criteria.province, criteria.where_slug):
        s = (raw or "").strip()
        if s:
            return s
    return "Spain"


def _what_query(criteria: SearchCriteria) -> str:
    parts = [criteria.category.strip()]
    if criteria.free_text:
        parts.append(criteria.free_text.strip()[:80])
    return " ".join(p for p in parts if p).strip() or "services"


def _is_datadome_or_bot_wall(html: str) -> bool:
    """Respuesta mínima con captcha Datadome / anti-bot."""
    low = html.lower()
    if "captcha-delivery.com" in low or "geo.captcha-delivery" in low:
        return True
    if "ct.captcha-delivery.com" in low:
        return True
    if "please enable js" in low and "cmsg" in low:
        return True
    if len(html) < 2500 and ("var dd=" in html or "'rt':'c'" in html):
        return True
    return False


def _is_cloudflare_wall(html: str) -> bool:
    low = html.lower()
    if "just a moment" in low and "<title>" in low:
        return True
    if "cf-browser-verification" in low or "challenge-platform" in low:
        return True
    if "cdn-cgi/challenge" in low:
        return True
    return False


def _is_blocked_html(html: str, status: int) -> bool:
    # Kompass suele devolver 403 + página mínima con captcha; sin 200 no hay listado útil.
    if status == 403:
        return True
    if _is_datadome_or_bot_wall(html) or _is_cloudflare_wall(html):
        return True
    return False


def parse_kompass_search_html(
    html: str,
    *,
    base_url: str,
    scraped_iso: str,
    category: str,
    province: str,
    city: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Extrae filas de HTML de resultados Kompass (sin red)."""
    dbg: dict[str, Any] = {
        "anchors_checked": 0,
        "profile_links": 0,
        "rows_out": 0,
    }
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    rows: list[dict[str, Any]] = []

    for a in soup.select("a[href]"):
        dbg["anchors_checked"] += 1
        href = (a.get("href") or "").strip()
        if not href or href.startswith("#"):
            continue
        full = urljoin(base_url, href)
        if not _is_company_profile_url(full):
            continue
        low = full.split("?", 1)[0]
        if low in seen:
            continue
        seen.add(low)
        dbg["profile_links"] += 1

        name = a.get_text(" ", strip=True)
        name = re.sub(r"\s+", " ", name).strip()
        if len(name) < 2:
            continue

        parent_txt = ""
        p = a.parent
        for _ in range(7):
            if p is None:
                break
            parent_txt += " " + p.get_text(" ", strip=True)
            p = getattr(p, "parent", None)
        phone = _extract_phone_from_text(parent_txt)

        rows.append(
            {
                "company_name": name[:400],
                "phone": phone,
                "website": None,
                "email": None,
                "address": None,
                "source_url": low,
                "source_name": "kompass",
                "country": "ES",
                "category": category,
                "province": province,
                "city": city,
                "scraped_at": scraped_iso,
            }
        )

    if not rows:
        for script in soup.select('script[type="application/ld+json"]'):
            raw = script.string or ""
            if not raw.strip():
                continue
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            items = data if isinstance(data, list) else [data]
            for it in items:
                if not isinstance(it, dict):
                    continue
                raw_t = it.get("@type")
                types = (
                    [str(x) for x in raw_t]
                    if isinstance(raw_t, list)
                    else [str(raw_t or "")]
                )
                if not any("Business" in x or x in ("Organization", "LocalBusiness") for x in types):
                    continue
                name = (it.get("name") or "").strip()
                if len(name) < 2:
                    continue
                url = (it.get("url") or "") if isinstance(it.get("url"), str) else ""
                if url and "kompass.com" not in url.lower():
                    continue
                tel = it.get("telephone")
                phone = _normalize_phone(str(tel)) if tel else None
                rows.append(
                    {
                        "company_name": name[:400],
                        "phone": phone,
                        "website": url if url.startswith("http") else None,
                        "email": None,
                        "address": None,
                        "source_url": url or base_url,
                        "source_name": "kompass",
                        "country": "ES",
                        "category": category,
                        "province": province,
                        "city": city,
                        "scraped_at": scraped_iso,
                    }
                )
        dbg["json_ld_rows"] = len(rows)

    dbg["rows_out"] = len(rows)
    return rows, dbg


def scrape_kompass(
    criteria: SearchCriteria,
    *,
    scraped_iso: str,
    max_pages: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    what = _what_query(criteria)
    where = _location_query(criteria)
    max_pages = max(1, min(int(max_pages or 1), 10))

    debug: dict[str, Any] = {
        "source_id": "kompass",
        "what": what[:200],
        "where": where[:120],
        "urls_tried": [],
        "pages_fetched": 0,
        "parse_pass": None,
    }

    sess = requests.Session()
    sess.headers.update(
        {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.7",
            "Accept-Encoding": "gzip, deflate",
            "Upgrade-Insecure-Requests": "1",
        }
    )

    last_err: str | None = None
    all_rows: list[dict[str, Any]] = []

    try:
        home = f"{KOMPASS_ORIGIN}/es/es/"
        r0 = sess.get(home, timeout=22, allow_redirects=True)
        h0 = r0.text or ""
        debug["urls_tried"].append(
            {"url": home, "status": r0.status_code, "len": len(h0)}
        )
        if _is_blocked_html(h0, r0.status_code):
            debug["zero_reason_code"] = "blocked"
            debug["hint"] = (
                "Kompass devuelve anti-bot (Datadome / captcha) para esta IP. "
                "Prueba desde red residencial o datos exportados / API Kompass."
            )
            debug["blocked"] = True
            return [], {"debug": debug, "blocked": True, "error": "Kompass anti-bot"}
        if r0.status_code != 200:
            last_err = f"HTTP {r0.status_code}"

        time.sleep(random.uniform(0.7, 1.6))

        for page in range(1, max_pages + 1):
            q_w = quote_plus(what)
            q_loc = quote_plus(where)
            candidates = [
                f"{KOMPASS_ORIGIN}/es/es/company/search?text={q_w}&location={q_loc}&page={page}",
                f"{KOMPASS_ORIGIN}/es/es/company/search?text={q_w}&location={q_loc}"
                if page == 1
                else None,
                f"{KOMPASS_ORIGIN}/es/es/company/search?searchText={q_w}&location={q_loc}&page={page}",
            ]
            for url in [u for u in candidates if u]:
                try:
                    r = sess.get(url, timeout=28, allow_redirects=True)
                    debug["pages_fetched"] += 1
                    html = r.text or ""
                    debug["urls_tried"].append(
                        {
                            "url": url,
                            "status": r.status_code,
                            "len": len(html),
                            "final_url": str(r.url),
                        }
                    )
                    if _is_blocked_html(html, r.status_code):
                        debug["zero_reason_code"] = "blocked"
                        debug["hint"] = (
                            "Kompass bloqueó el listado (Datadome/captcha). Reintenta desde otra red."
                        )
                        debug["blocked"] = True
                        return [], {"debug": debug, "blocked": True, "error": "Kompass anti-bot"}
                    if r.status_code != 200:
                        last_err = f"HTTP {r.status_code}"
                        continue

                    rows, pdbg = parse_kompass_search_html(
                        html,
                        base_url=str(r.url),
                        scraped_iso=scraped_iso,
                        category=criteria.category,
                        province=criteria.province,
                        city=criteria.city,
                    )
                    debug["parse_pass"] = pdbg
                    if rows:
                        all_rows.extend(rows)
                        break
                    time.sleep(random.uniform(0.5, 1.2))
                except requests.RequestException as e:
                    last_err = str(e)[:220]
                    debug["urls_tried"].append({"url": url, "error": last_err})
                    continue
            if all_rows:
                break
            time.sleep(random.uniform(0.4, 1.0))

    except requests.RequestException as e:
        last_err = str(e)[:240]
        debug["request_error"] = last_err

    if not all_rows:
        debug["zero_reason_code"] = "parser_empty" if not last_err else "http_error_or_empty"
        debug["hint"] = (
            last_err
            or "No se extrajeron empresas. Comprueba categoría/ciudad o bloqueo."
        )
        return [], {"debug": debug}

    seen_u: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for row in all_rows:
        u = (row.get("source_url") or "").strip()
        if u in seen_u:
            continue
        seen_u.add(u)
        deduped.append(row)

    debug["zero_reason_code"] = "ok"
    debug["hint"] = "OK"
    debug["parsed_final"] = len(deduped)
    return deduped, {"debug": debug}
