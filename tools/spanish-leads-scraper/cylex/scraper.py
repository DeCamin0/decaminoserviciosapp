"""
Cylex España (www.cylex.es) — listados locales.

Nota: muchas IPs (datacenter / scraper) reciben **Cloudflare 403** sin JS.
En ese caso devolvemos ``blocked`` y telemetría clara; desde red residencial o
navegador el HTML de listado suele ser parseable con la lógica siguiente.
"""
from __future__ import annotations

import json
import random
import re
import time
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from sources.criteria import SearchCriteria

CYLEX_ORIGIN = "https://www.cylex.es"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
]

# Ficha de empresa: .../ciudad/slug-numeroid.html
_COMPANY_PATH_RE = re.compile(r"/[^/]+/.+-\d+\.html?$", re.I)
_PHONE_RE = re.compile(
    r"(?:\+34|0034)?[\s\-]?(?:\d[\s\-]?){8,11}\d",
    re.MULTILINE,
)


def _plus_slug(text: str) -> str:
    t = (text or "").strip().lower()
    t = re.sub(r"\s+", "+", t)
    t = re.sub(r"[^a-z0-9+áéíóúñü]+", "+", t, flags=re.I)
    t = re.sub(r"\++", "+", t).strip("+")
    return t or "servicios"


def _city_slug(criteria: SearchCriteria) -> str:
    for raw in (criteria.where_slug, criteria.city, criteria.province):
        s = (raw or "").strip().lower()
        if not s:
            continue
        s = re.sub(r"[^a-z0-9\-]+", "-", s)
        s = re.sub(r"-+", "-", s).strip("-")
        if s:
            return s
    return "madrid"


def _activity_variants(criteria: SearchCriteria) -> list[str]:
    phrases = list(criteria.expanded_query_phrases or [])
    base = _plus_slug(criteria.category)
    seen: set[str] = set()
    out: list[str] = []
    for p in phrases[:3]:
        slug = _plus_slug(p)
        if slug and slug not in seen:
            seen.add(slug)
            out.append(slug)
    for extra in (
        base,
        f"empresas+de+{base}",
        f"servicios+de+{base}",
    ):
        if extra not in seen:
            seen.add(extra)
            out.append(extra)
    return out


def _is_cloudflare_challenge(html: str) -> bool:
    low = html.lower()
    if "cf-wrapper" in low or "attention required" in low:
        return True
    if "cdn-cgi/challenge" in low or "/cdn-cgi/" in low and "cloudflare" in low:
        return True
    return len(html) < 4000 and "cloudflare" in low


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


def parse_cylex_listing_html(
    html: str,
    *,
    base_url: str,
    scraped_iso: str,
    category: str,
    province: str,
    city: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Extrae filas de un HTML de listado Cylex (sin red)."""
    dbg: dict[str, Any] = {
        "anchors_seen": 0,
        "company_links": 0,
        "rows_out": 0,
    }
    soup = BeautifulSoup(html, "html.parser")
    seen_urls: set[str] = set()
    rows: list[dict[str, Any]] = []

    for a in soup.select("a[href]"):
        dbg["anchors_seen"] += 1
        href = (a.get("href") or "").strip()
        if not href or href.startswith("#"):
            continue
        full = urljoin(base_url, href)
        if "cylex.es" not in full.lower():
            continue
        path = urlparse(full).path
        if not _COMPANY_PATH_RE.search(path):
            continue
        if "/signin" in path.lower() or "cookie" in path.lower():
            continue
        low = full.split("?", 1)[0]
        if low in seen_urls:
            continue
        seen_urls.add(low)
        dbg["company_links"] += 1

        name = a.get_text(" ", strip=True)
        name = re.sub(r"\s+", " ", name).strip()
        if len(name) < 2:
            continue

        parent_txt = ""
        p = a.parent
        for _ in range(5):
            if p is None:
                break
            parent_txt += " " + p.get_text(" ", strip=True)
            p = getattr(p, "parent", None)
        phone = _extract_phone_from_text(parent_txt)
        addr = None
        # línea típica: calle, CP ciudad
        maddr = re.search(
            r"(\d{5}\s+[A-Za-zÁÉÍÓÚÑáéíóúñ][^,\n]{3,80})",
            parent_txt,
        )
        if maddr:
            addr = maddr.group(1).strip()[:300]

        rows.append(
            {
                "company_name": name[:400],
                "phone": phone,
                "website": None,
                "email": None,
                "address": addr,
                "source_url": low,
                "source_name": "cylex",
                "country": "ES",
                "category": category,
                "province": province,
                "city": city,
                "scraped_at": scraped_iso,
            }
        )

    # JSON-LD (misma página)
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
                if not any(
                    "Business" in x or x in ("Organization", "ProfessionalService")
                    for x in types
                ):
                    continue
                name = (it.get("name") or "").strip()
                if len(name) < 2:
                    continue
                url = (it.get("url") or "") if isinstance(it.get("url"), str) else ""
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
                        "source_name": "cylex",
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


def scrape_cylex(
    criteria: SearchCriteria,
    *,
    scraped_iso: str,
    max_pages: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    city = _city_slug(criteria)
    variants = _activity_variants(criteria)
    max_pages = max(1, min(int(max_pages or 1), 10))

    debug: dict[str, Any] = {
        "source_id": "cylex",
        "city_slug": city,
        "activity_variants_tried": variants[:8],
        "urls_tried": [],
        "pages_fetched": 0,
        "parse_pass": None,
    }

    sess = requests.Session()
    sess.headers.update(
        {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Upgrade-Insecure-Requests": "1",
        }
    )

    all_rows: list[dict[str, Any]] = []
    last_err: str | None = None

    try:
        w = sess.get(CYLEX_ORIGIN + "/", timeout=22, allow_redirects=True)
        debug["urls_tried"].append(
            {"url": CYLEX_ORIGIN + "/", "status": w.status_code, "len": len(w.text or "")}
        )
        if w.status_code == 403 and _is_cloudflare_challenge(w.text or ""):
            debug["zero_reason_code"] = "blocked"
            debug["hint"] = (
                "Cylex devuelve Cloudflare (anti-bot) para esta IP. Prueba desde otra red, "
                "o guarda HTML desde el navegador y procesa fuera de este flujo cuando "
                "tengamos parser de fichero."
            )
            debug["blocked"] = True
            return [], {"debug": debug, "blocked": True, "error": "Cylex Cloudflare"}

        time.sleep(random.uniform(0.8, 1.8))

        for act in variants:
            page_rows: list[dict[str, Any]] = []
            combined_parse: dict[str, Any] | None = None
            for page in range(1, max_pages + 1):
                path = f"/{city}/{act}-{page}.html"
                url = CYLEX_ORIGIN + path
                try:
                    r = sess.get(url, timeout=26, allow_redirects=True)
                    debug["pages_fetched"] += 1
                    debug["urls_tried"].append(
                        {
                            "url": url,
                            "status": r.status_code,
                            "len": len(r.text or ""),
                            "final_url": str(r.url),
                        }
                    )
                    if r.status_code != 200:
                        last_err = f"HTTP {r.status_code}"
                        continue
                    html = r.text or ""
                    if _is_cloudflare_challenge(html):
                        debug["zero_reason_code"] = "blocked"
                        debug["hint"] = (
                            "Cylex / Cloudflare bloqueó el listado (403 o challenge). "
                            "Reintenta desde IP residencial o más tarde."
                        )
                        debug["blocked"] = True
                        return [], {"debug": debug, "blocked": True, "error": "Cylex Cloudflare"}

                    rows, pdbg = parse_cylex_listing_html(
                        html,
                        base_url=str(r.url),
                        scraped_iso=scraped_iso,
                        category=criteria.category,
                        province=criteria.province,
                        city=criteria.city,
                    )
                    combined_parse = pdbg
                    if rows:
                        page_rows.extend(rows)
                        break
                    time.sleep(random.uniform(0.6, 1.4))
                except requests.RequestException as e:
                    last_err = str(e)[:220]
                    debug["urls_tried"].append({"url": url, "error": last_err})
                    continue

            if page_rows:
                all_rows.extend(page_rows)
                debug["parse_pass"] = combined_parse
                debug["matched_activity"] = act
                break
            time.sleep(random.uniform(0.5, 1.2))

    except requests.RequestException as e:
        last_err = str(e)[:240]
        debug["request_error"] = last_err

    if not all_rows:
        debug["zero_reason_code"] = "parser_empty" if not last_err else "http_error_or_empty"
        debug["hint"] = (
            last_err
            or "No se extrajeron empresas del listado. Comprueba categoría/ciudad o bloqueo."
        )
        return [], {"debug": debug}

    # Dedupe por source_url
    seen_u: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for r in all_rows:
        u = (r.get("source_url") or "").strip()
        if u in seen_u:
            continue
        seen_u.add(u)
        deduped.append(r)

    debug["zero_reason_code"] = "ok"
    debug["hint"] = "OK"
    debug["parsed_final"] = len(deduped)
    return deduped, {"debug": debug}

