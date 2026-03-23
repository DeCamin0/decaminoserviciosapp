"""
Yalwa España — listados por subdominio de ciudad (``madrid.yalwa.es``, …).

Desde muchas IPs **Cloudflare** devuelve 403 + «Just a moment…» sin JS.
En ese caso: ``blocked: true`` y telemetría; el parseo aplica si la respuesta es HTML real.
"""
from __future__ import annotations

import json
import random
import re
import time
from typing import Any
from urllib.parse import quote_plus, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from sources.criteria import SearchCriteria

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
]

_PHONE_RE = re.compile(
    r"(?:\+34|0034)?[\s\-]?(?:\d[\s\-]?){8,11}\d",
    re.MULTILINE,
)


def _city_slug(criteria: SearchCriteria) -> str:
    for raw in (criteria.where_slug, criteria.city, criteria.province):
        s = (raw or "").strip().lower()
        if not s:
            continue
        s = re.sub(r"[^a-z0-9]+", "-", s)
        s = re.sub(r"-+", "-", s).strip("-")
        if s:
            return s
    return "madrid"


def _what_query(criteria: SearchCriteria) -> str:
    parts = [criteria.category.strip()]
    if criteria.free_text:
        parts.append(criteria.free_text.strip()[:80])
    return " ".join(p for p in parts if p).strip() or "empresas"


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


def _is_cloudflare_wall(html: str) -> bool:
    low = html.lower()
    if "just a moment" in low and "<title>" in low:
        return True
    if "cf-browser-verification" in low or "challenge-platform" in low:
        return True
    if "cdn-cgi/challenge" in low:
        return True
    if "cf-wrapper" in low or "attention required" in low:
        return True
    return len(html) < 8000 and "cloudflare" in low


def _is_company_path(path: str) -> bool:
    segs = [p for p in path.split("/") if p]
    if len(segs) < 2:
        return False
    skip = {"login", "register", "search", "cookie", "privacy", "terms", "static", "assets"}
    if segs[0].lower() in skip:
        return False
    return True


def _is_company_url(full: str) -> bool:
    try:
        p = urlparse(full)
    except ValueError:
        return False
    host = (p.netloc or "").lower()
    if "yalwa" not in host:
        return False
    if not host.endswith(".es") and ".yalwa." not in host:
        return False
    return _is_company_path(p.path or "")


def parse_yalwa_listing_html(
    html: str,
    *,
    base_url: str,
    scraped_iso: str,
    category: str,
    province: str,
    city: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    dbg: dict[str, Any] = {"anchors_checked": 0, "company_links": 0, "rows_out": 0}
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    rows: list[dict[str, Any]] = []

    for a in soup.select("a[href]"):
        dbg["anchors_checked"] += 1
        href = (a.get("href") or "").strip()
        if not href or href.startswith("#"):
            continue
        full = urljoin(base_url, href)
        if not _is_company_url(full):
            continue
        low = full.split("?", 1)[0]
        if low in seen:
            continue
        seen.add(low)
        dbg["company_links"] += 1

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
                "source_name": "yalwa",
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
                if url and "yalwa" not in url.lower():
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
                        "source_name": "yalwa",
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


def scrape_yalwa(
    criteria: SearchCriteria,
    *,
    scraped_iso: str,
    max_pages: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    city = _city_slug(criteria)
    what = _what_query(criteria)
    max_pages = max(1, min(int(max_pages or 1), 10))

    debug: dict[str, Any] = {
        "source_id": "yalwa",
        "city_slug": city,
        "what": what[:200],
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

    last_err: str | None = None
    all_rows: list[dict[str, Any]] = []
    r0: requests.Response | None = None
    h0 = ""

    try:
        # Subdominio por ciudad (patrón habitual Yalwa ES)
        home_city = f"https://{city}.yalwa.es/"
        r0 = sess.get(home_city, timeout=22, allow_redirects=True)
        h0 = r0.text or ""
        debug["urls_tried"].append(
            {"url": home_city, "status": r0.status_code, "len": len(h0)}
        )
        if r0.status_code == 403 or _is_cloudflare_wall(h0):
            debug["zero_reason_code"] = "blocked"
            debug["hint"] = (
                "Yalwa devuelve Cloudflare (anti-bot) para esta IP. Prueba desde red residencial "
                "o otro método de datos."
            )
            debug["blocked"] = True
            return [], {"debug": debug, "blocked": True, "error": "Yalwa Cloudflare"}
        if r0.status_code != 200:
            last_err = f"HTTP {r0.status_code}"

        time.sleep(random.uniform(0.6, 1.4))

        q = quote_plus(what)
        for page in range(1, max_pages + 1):
            candidates = [
                f"https://{city}.yalwa.es/?q={q}&page={page}",
                f"https://{city}.yalwa.es/buscar?q={q}&page={page}" if page == 1 else None,
                f"https://www.yalwa.es/?q={q}&city={quote_plus(city)}&page={page}",
            ]
            for url in [u for u in candidates if u]:
                try:
                    r = sess.get(url, timeout=26, allow_redirects=True)
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
                    if r.status_code == 403 or _is_cloudflare_wall(html):
                        debug["zero_reason_code"] = "blocked"
                        debug["hint"] = "Yalwa / Cloudflare bloqueó el listado."
                        debug["blocked"] = True
                        return [], {"debug": debug, "blocked": True, "error": "Yalwa Cloudflare"}
                    if r.status_code != 200:
                        last_err = f"HTTP {r.status_code}"
                        continue

                    rows, pdbg = parse_yalwa_listing_html(
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
                    time.sleep(random.uniform(0.4, 1.0))
                except requests.RequestException as e:
                    last_err = str(e)[:220]
                    debug["urls_tried"].append({"url": url, "error": last_err})
                    continue
            if all_rows:
                break
            time.sleep(random.uniform(0.35, 0.9))

        # Si la portada ciudad fue 200 pero sin búsqueda extra: intentar parse de portada
        if (
            not all_rows
            and r0 is not None
            and r0.status_code == 200
            and not _is_cloudflare_wall(h0)
        ):
            rows, pdbg = parse_yalwa_listing_html(
                h0,
                base_url=str(r0.url),
                scraped_iso=scraped_iso,
                category=criteria.category,
                province=criteria.province,
                city=criteria.city,
            )
            debug["parse_pass"] = pdbg
            all_rows.extend(rows)

    except requests.RequestException as e:
        last_err = str(e)[:240]
        debug["request_error"] = last_err

    if not all_rows:
        debug["zero_reason_code"] = "parser_empty" if not last_err else "http_error_or_empty"
        debug["hint"] = last_err or "No se extrajeron empresas. Comprueba ciudad/categoría o bloqueo."
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
