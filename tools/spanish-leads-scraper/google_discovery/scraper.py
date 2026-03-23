"""
Descubrimiento vía Google (HTML): varias consultas, extracción amplia de URLs y visita a sitios.

MVP: no descartar filas solo por falta de email/teléfono si hay nombre + URL útil.
"""
from __future__ import annotations

import os
import random
import re
import time
from typing import Any
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from paginas_amarillas.scraper import compute_dedupe_key
from sources.criteria import SearchCriteria

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
]

SKIP_HOST_SUBSTR = (
    "google.",
    "gstatic.com",
    "googleusercontent.",
    "youtube.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "linkedin.com",
    "wikipedia.org",
    "maps.google",
    "bing.com",
)

EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
)
PHONE_RE = re.compile(
    r"(?:\+34[\s.-]?)?(?:[6789]\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})\b",
)

# /url?q=... en HTML crudo (Google cambia el DOM con frecuencia)
_RE_URL_Q_ABS = re.compile(
    r"https?://(?:www\.)?google\.(?:com|es)/url\?q=([^&\s\"'<>]+)",
    re.I,
)
_RE_URL_Q_REL = re.compile(r"""href=["'](/url\?[^"'<>]+)["']""", re.I)


def _debug_flag(criteria: SearchCriteria) -> bool:
    return bool(criteria.debug) or os.environ.get("LEADS_SCRAPE_DEBUG", "").lower() in (
        "1",
        "true",
        "yes",
    )


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.5",
        }
    )
    return s


def _delay(a: float = 1.0, b: float = 2.5) -> None:
    time.sleep(random.uniform(a, b))


def _location_phrase(criteria: SearchCriteria) -> str:
    if criteria.city.strip():
        return criteria.city.strip()
    if criteria.province.strip():
        return criteria.province.strip()
    w = criteria.where_slug.replace("-", " ").strip()
    return w.title() if w else "España"


def _google_query_patterns(category: str, loc: str) -> list[str]:
    c = category.strip()
    L = (loc or "España").strip()
    return [
        f"{c} {L}",
        f"empresa {c} {L}",
        f"servicios de {c} {L}",
        f"{c} oficinas {L}",
        f"{c} comunidades {L}",
        f"empresa {c} contacto {L}",
        f"{c} site:.es {L}",
    ]


def build_google_discovery_queries(criteria: SearchCriteria, loc: str) -> list[str]:
    """Combina frases expandidas (perfil + usuario) y consultas CNAE."""
    phrases = criteria.expanded_query_phrases or [criteria.category.strip()]
    out: list[str] = []
    seen: set[str] = set()

    def add(q: str) -> None:
        t = (q or "").strip()
        if len(t) < 3:
            return
        k = t.lower()
        if k in seen:
            return
        seen.add(k)
        out.append(t)

    for ph in phrases[:8]:
        for x in _google_query_patterns(ph, loc):
            add(x)
    codes = list(
        dict.fromkeys(
            [
                str(c).strip()
                for c in (list(criteria.cnae_codes or []) + list(criteria.classification_codes or []))
                if str(c).strip()
            ]
        )
    )
    for code in codes[:10]:
        digits = re.sub(r"\D", "", code)
        if len(digits) < 4:
            continue
        add(f"empresas CNAE {digits} {loc}")
        add(f"CNAE {digits} empresas {loc}")
    return out[:24]


def _normalize_out_url(href: str) -> str | None:
    if not href or not isinstance(href, str):
        return None
    h = href.strip()
    if h.startswith("/url"):
        base = "https://www.google.com"
        q = parse_qs(urlparse(base + h.split("#")[0]).query).get("q", [None])[0]
        if q:
            h = unquote(q)
    if not h.startswith("http"):
        return None
    h = h.split("#")[0].strip()
    return h or None


def _consider_url(
    raw_href: str,
    source: str,
    *,
    seen: set[str],
    kept: list[str],
    discarded: list[dict[str, str]],
    max_keep: int,
) -> None:
    href = _normalize_out_url(raw_href)
    if not href:
        if raw_href and len(raw_href) > 3:
            discarded.append({"href_sample": raw_href[:180], "reason": "not_http", "via": source})
        return
    p = urlparse(href)
    host = (p.netloc or "").lower()
    if any(x in host for x in SKIP_HOST_SUBSTR):
        discarded.append({"url": href[:220], "reason": "skipped_host", "via": source})
        return
    norm = href.rstrip("/")
    if norm in seen:
        discarded.append({"url": href[:220], "reason": "duplicate_url", "via": source})
        return
    if len(kept) >= max_keep:
        return
    seen.add(norm)
    kept.append(href)


def extract_google_candidate_urls(
    html: str,
    *,
    max_urls: int,
) -> tuple[list[str], list[dict[str, str]]]:
    """Recolecta URLs externas candidatas; devuelve (mantenidas, descartadas)."""
    seen: set[str] = set()
    kept: list[str] = []
    discarded: list[dict[str, str]] = []

    for m in _RE_URL_Q_ABS.finditer(html):
        _consider_url(unquote(m.group(1)), "regex_abs", seen=seen, kept=kept, discarded=discarded, max_keep=max_urls)

    for m in _RE_URL_Q_REL.finditer(html):
        _consider_url(m.group(1), "regex_rel", seen=seen, kept=kept, discarded=discarded, max_keep=max_urls)

    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        href = a.get("href") or ""
        if "/url" in href or "url?q=" in href:
            _consider_url(href, "a_tag", seen=seen, kept=kept, discarded=discarded, max_keep=max_urls)

    return kept, discarded[:80]


def _clean_emails(text: str) -> list[str]:
    raw = EMAIL_RE.findall(text)
    out: list[str] = []
    seen: set[str] = set()
    for e in raw:
        el = e.lower()
        if el.endswith((".png", ".jpg", ".gif", ".webp")):
            continue
        if el in seen:
            continue
        seen.add(el)
        out.append(e)
    return out[:3]


def _clean_phones(text: str) -> list[str]:
    found = PHONE_RE.findall(text)
    out: list[str] = []
    seen: set[str] = set()
    for p in found:
        n = re.sub(r"\s+", " ", p.strip())
        if n in seen:
            continue
        seen.add(n)
        out.append(n)
    return out[:2]


def _fetch_limited_text(sess: requests.Session, url: str) -> tuple[str | None, int | None, str | None]:
    try:
        pr = sess.get(url, timeout=16, allow_redirects=True, stream=True)
        code = pr.status_code
        pr.raise_for_status()
        chunk = b""
        for part in pr.iter_content(8192):
            chunk += part
            if len(chunk) > 800_000:
                break
        text = chunk.decode("utf-8", errors="replace")
        return text, code, None
    except requests.RequestException as e:
        return None, None, str(e)[:200]


def _page_title(soup: BeautifulSoup) -> str:
    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        return str(og["content"]).strip()
    if soup.title and soup.title.string:
        return soup.title.string.strip()
    h1 = soup.find("h1")
    if h1:
        return h1.get_text(" ", strip=True)
    return ""


def _plausible_company_name(name: str, page_url: str) -> bool:
    n = (name or "").strip()
    if len(n) < 2:
        return False
    low = n.lower()
    if low in ("home", "inicio", "welcome", "bienvenido", "index"):
        return False
    if len(n) > 200:
        return False
    return True


def scrape_google_leads(
    criteria: SearchCriteria,
    *,
    scraped_iso: str,
    max_sites: int = 12,
    max_search_results: int = 12,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    A) discovery: varias consultas × google.com / google.es × con/sin gbv
    B) enrichment: GET de cada URL candidata; conserva fila con nombre + URL aunque falte contacto.
    """
    debug: dict[str, Any] = {
        "source_id": "google_discovery",
        "queries_tried": [],
        "discovery_steps": [],
        "candidate_urls_final": [],
        "discarded_sample": [],
        "enrichment": [],
    }
    loc = _location_phrase(criteria)
    patterns = build_google_discovery_queries(criteria, loc)
    debug["expanded_phrases_used"] = (criteria.expanded_query_phrases or [])[:12]
    _cnae_list = [
        str(x)
        for x in (criteria.cnae_codes or criteria.classification_codes or [])
        if str(x).strip()
    ][:12]
    debug["cnae_codes_used"] = list(dict.fromkeys(_cnae_list))
    sess = _session()

    all_kept_urls: list[str] = []
    seen_u: set[str] = set()
    total_discarded: list[dict[str, str]] = []

    search_hosts = ("https://www.google.es/search", "https://www.google.com/search")
    # Por página: bastan unos pocos más que max_sites; antes pedíamos 24 únicos y
    # recorríamos hasta 28 peticiones → modo "auto" parecía colgado varios minutos.
    per_page_cap = max(max_sites + 8, 16)
    max_discovery_requests = 12
    discovery_requests = 0
    done_discovery = False

    for qtext in patterns:
        if done_discovery:
            break
        for host in search_hosts:
            if done_discovery:
                break
            for use_gbv in (False, True):
                if done_discovery or discovery_requests >= max_discovery_requests:
                    done_discovery = True
                    break
                if len(all_kept_urls) >= max_sites:
                    done_discovery = True
                    break
                discovery_requests += 1
                params: dict[str, str] = {
                    "q": qtext,
                    "hl": "es",
                    "gl": "es",
                    "num": str(max_search_results),
                }
                if use_gbv:
                    params["gbv"] = "1"
                step: dict[str, Any] = {
                    "query": qtext,
                    "search_url": host,
                    "params": dict(params),
                    "use_gbv": use_gbv,
                    "discovery_index": discovery_requests,
                }
                _delay(0.45, 1.1)
                try:
                    r = sess.get(host, params=params, timeout=28, allow_redirects=True)
                    step["http_status"] = r.status_code
                    step["final_url"] = getattr(r, "url", "") or ""
                    html = r.text
                except requests.RequestException as e:
                    step["error"] = str(e)[:300]
                    debug["discovery_steps"].append(step)
                    continue

                low_url = (step.get("final_url") or "").lower()
                # 429 + redirección a /sorry/ no pasan por raise_for_status con HTML útil;
                # sin esto el modo «auto» agota las 12 peticiones y muestra «no_candidate_urls».
                if r.status_code == 429 or "/sorry/" in low_url or "google.com/sorry" in low_url:
                    debug["blocked"] = True
                    debug["zero_reason_code"] = "blocked"
                    debug["hint"] = (
                        "Google limitó las peticiones (429) o mostró la página «unusual traffic» / CAPTCHA. "
                        "Desde el servidor suele fallar: usa Páginas Amarillas (HTML guardado) o prueba más tarde."
                    )
                    step["error"] = step.get("error") or f"HTTP {r.status_code} / bloqueo (sorry)"
                    debug["discovery_steps"].append(step)
                    debug["html_preview"] = html[:1000].replace("\n", " ")
                    return [], {
                        "blocked": True,
                        "error": "Google rate limit / CAPTCHA (sorry)",
                        "debug": debug,
                    }

                if r.status_code >= 400:
                    step["error"] = f"HTTP {r.status_code}"
                    debug["discovery_steps"].append(step)
                    continue

                low = html.lower()
                if (
                    "detected unusual traffic" in low
                    or "unusual traffic" in low
                    or "captcha" in low
                    or "/sorry/" in low
                ):
                    debug["blocked"] = True
                    debug["zero_reason_code"] = "blocked"
                    debug["hint"] = "La fuente bloqueó la solicitud automática (CAPTCHA / consentimiento / tráfico)."
                    debug["discovery_steps"].append(step)
                    debug["html_preview"] = html[:1000].replace("\n", " ")
                    return [], {
                        "blocked": True,
                        "error": "Google CAPTCHA / bloqueo de tráfico",
                        "debug": debug,
                    }

                kept, disc = extract_google_candidate_urls(html, max_urls=per_page_cap)
                step["candidates_raw"] = len(kept) + len(disc)
                step["candidates_kept_this_page"] = len(kept)
                step["html_length"] = len(html)
                if not kept and len(html) > 200:
                    step["html_preview_when_no_urls"] = html[:900].replace("\n", " ")

                for u in kept:
                    nu = u.rstrip("/")
                    if nu not in seen_u:
                        seen_u.add(nu)
                        all_kept_urls.append(u)

                total_discarded.extend(disc)
                debug["discovery_steps"].append(step)
                debug["queries_tried"].append(qtext)

                if len(all_kept_urls) >= max_sites:
                    done_discovery = True
                    break

    debug["discovery_request_count"] = discovery_requests
    debug["discovery_capped"] = discovery_requests >= max_discovery_requests

    urls_visit = all_kept_urls[:max_sites]
    debug["candidate_urls_final"] = urls_visit
    debug["discarded_sample"] = total_discarded[:60]

    if not urls_visit:
        debug["zero_reason_code"] = "no_candidate_urls"
        debug["hint"] = (
            "Google respondió, pero no se encontraron URLs candidatas en el HTML "
            "(DOM cambiado o resultados vacíos para esas consultas)."
        )
        return [], {"debug": debug}

    records: list[dict[str, Any]] = []

    for u in urls_visit:
        _delay(0.45, 1.2)
        text, pg_status, err = _fetch_limited_text(sess, u)
        enr: dict[str, Any] = {"url": u, "http_status": pg_status, "fetch_error": err}
        if not text:
            enr["skipped_reason"] = err or "empty_body"
            debug["enrichment"].append(enr)
            continue

        if criteria.enrich_contact_pages:
            base = f"{urlparse(u).scheme}://{urlparse(u).netloc}"
            for path in ("/contacto", "/contact", "/contacto.html"):
                extra, _, e2 = _fetch_limited_text(sess, urljoin(base, path))
                if extra:
                    text += "\n" + extra
                    _delay(0.25, 0.6)
                elif e2:
                    enr.setdefault("contact_paths_tried", []).append({"path": path, "err": e2})

        soup = BeautifulSoup(text, "html.parser")
        title = _page_title(soup) or urlparse(u).netloc
        name = re.split(r"\s*[|\-–]\s*", title, 1)[0].strip()[:500]
        if not _plausible_company_name(name, u):
            name = urlparse(u).netloc.replace("www.", "") or u

        emails = _clean_emails(text)
        phones = _clean_phones(text)
        email = emails[0] if emails else None
        phone = phones[0] if phones else None

        enr["company_name_guess"] = name
        enr["has_email"] = bool(email)
        enr["has_phone"] = bool(phone)
        debug["enrichment"].append(enr)

        rec = {
            "company_name": name,
            "email": email,
            "phone": phone,
            "website": u,
            "category": criteria.category,
            "country": criteria.country or "ES",
            "province": criteria.province or None,
            "city": criteria.city or None,
            "source_name": "google_discovery",
            "source_url": u,
            "scraped_at": scraped_iso,
            "dedupe_key": compute_dedupe_key(name, phone, u),
            "status": "new",
            "notes": None,
        }
        records.append(rec)

    debug["raw_urls_visited"] = len(urls_visit)
    debug["parsed_final"] = len(records)
    if not records and urls_visit:
        debug["zero_reason_code"] = "enrichment_all_failed"
        debug["hint"] = "Había URLs candidatas, pero ninguna página respondió al GET o el cuerpo estaba vacío."
    elif records:
        debug["zero_reason_code"] = "ok"
        debug["hint"] = "OK"
    else:
        debug["zero_reason_code"] = "no_candidate_urls"

    debug["verbose"] = _debug_flag(criteria)

    return records, {"debug": debug}


# Compat: import legacy
__all__ = ["scrape_google_leads", "extract_google_candidate_urls"]
