"""
Europages (europages.es) — directorio B2B.

Listados principales en la web actual: ``/es/search?countries=ES&q=…`` (miles de
resultados por país + consulta). Compatibilidad con rutas legacy
``/companies/spain/{slug}.html`` y ``/companies/spain.html``.

Búsqueda prioritaria a **nivel país** (``countries`` + ``q``), sin forzar ciudad.

Las fichas enlazan a ``/{en|es}/company/{slug}-{id}/…``. Segunda pasada opcional:
GET de la ficha (véase ``LEADS_EUROPAGES_ENRICH_MAX``).
"""
from __future__ import annotations

import json
import os
import random
import re
import time
from typing import Any
from urllib.parse import quote_plus, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from empresite.quality import choose_better_company_name, clean_company_name_surface
from paginas_amarillas.scraper import compute_dedupe_key
from sources.criteria import SearchCriteria

EUROPAGES_ORIGIN = "https://www.europages.es"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
]

_PHONE_RE = re.compile(
    r"(?:\+34|0034)?[\s\-]?(?:\d[\s\-]?){8,11}\d",
    re.MULTILINE,
)
# Base ficha: .../en/company/foo-sl-12345 o .../es/company/...
_COMPANY_BASE_RE = re.compile(
    r"https?://[^/]+/(?:en|es)/company/[^/?#]+-\d+",
    re.I,
)


def _company_base_url(full: str) -> str | None:
    u = full.split("?", 1)[0].split("#", 1)[0]
    m = _COMPANY_BASE_RE.search(u)
    return m.group(0) if m else None


def _host_skip_external_website(url: str) -> bool:
    p = urlparse(url)
    host = (p.netloc or "").lower()
    if not host:
        return True
    skip = (
        "europages.",
        "visable.",
        "cloudfront",
        "google.",
        "facebook.",
        "linkedin.",
        "twitter.",
        "instagram.",
        "youtube.",
        "tiktok.",
        "pinterest.",
        "goo.gl",
        "schema.org",
        "wikipedia.",
    )
    return any(s in host for s in skip) or host.endswith("europages.es")


def _ld_collect_orgs(obj: Any, acc: list[dict[str, Any]]) -> None:
    if isinstance(obj, dict):
        t = obj.get("@type")
        types = [t] if isinstance(t, str) else list(t) if isinstance(t, list) else []
        if any(
            x in ("Organization", "LocalBusiness", "Corporation", "ProfessionalService")
            for x in types
        ):
            acc.append(obj)
        if "@graph" in obj:
            _ld_collect_orgs(obj["@graph"], acc)
        for v in obj.values():
            if isinstance(v, (dict, list)):
                _ld_collect_orgs(v, acc)
    elif isinstance(obj, list):
        for el in obj:
            _ld_collect_orgs(el, acc)


_INTL_LEGAL_SUFFIX_RE = re.compile(
    r"(?i)\b(s\.?l\.?u\.?|s\.?l\.?|s\.?a\.?|srl|spa|sas|s\.p\.a\.|bv|nv|gmbh|ltd\.?|limited|plc|ag|s\.a\.s\.?|s\.l\.)\b"
)
# Palabras típicas de título de producto / marketing (listados Europages)
_MARKETING_PRODUCT_RE = re.compile(
    r"(?i)\b(wholesale|distributor|suppliers?|rental|stain remover|cleaning product|"
    r"private label|customizable|deep cleaning|boot washing|care kits?|"
    r"ultrasonic cleaning|liposomal|acoustic insulation|sandwich panel)\b"
)


def _has_intl_legal_suffix(s: str) -> bool:
    return bool(_INTL_LEGAL_SUFFIX_RE.search(s or ""))


def _looks_like_product_title(name: str) -> bool:
    """Evita tratar títulos de producto / listados largos como razón social."""
    n = (name or "").strip()
    if not n:
        return True
    if _has_intl_legal_suffix(n):
        return False
    if len(n) > 80:
        return True
    if n.count(",") >= 2 and len(n) > 50:
        return True
    if len(n) > 45 and ":" in n:
        return True
    low = n.lower()
    if " - " in n and len(n) > 45:
        return True
    if n.count("-") >= 3 and len(n) > 35:
        return True
    if n.count("–") >= 2 and len(n) > 35:
        return True
    if _MARKETING_PRODUCT_RE.search(n):
        return True
    return False


def _looks_like_non_company(name: str) -> bool:
    """
    Fila que probablemente no es empresa: título largo, muchos guiones, marketing.
    Las formas legales (SL, BV, LTD…) reducen el score.
    """
    n = (name or "").strip()
    if not n:
        return True
    if _has_intl_legal_suffix(n):
        return False
    if len(n) > 88:
        return True
    if n.count("-") >= 4 and len(n) > 40:
        return True
    if _MARKETING_PRODUCT_RE.search(n) and len(n) > 32:
        return True
    if _looks_like_product_title(n):
        return True
    return False


def _looks_like_product_text(name: str) -> bool:
    """Para filtro de calidad: nombre tipo producto/marketing."""
    return _looks_like_product_title(name) or _looks_like_non_company(name)


def _listing_name_prefilter_drop(name: str) -> bool:
    """
    Antes de enriquecer: ahorrar GETs en títulos claramente no-empresa.
    """
    n = (name or "").strip()
    if not n:
        return True
    if _has_intl_legal_suffix(n):
        return False
    if len(n) > 105:
        return True
    if len(n) > 72 and n.count("-") >= 3:
        return True
    if _MARKETING_PRODUCT_RE.search(n) and len(n) > 50:
        return True
    return False


def _apply_europages_location_fallback(rec: dict[str, Any], criteria: SearchCriteria) -> None:
    """
    Europages es directorio global: la ciudad/provincia de la búsqueda NO es la de la empresa.
    Solo rellenamos país por defecto si la ficha no trajo país; nunca ciudad/provincia desde criterios.
    """
    if not (rec.get("country") or "").strip():
        c = (criteria.country or "ES").strip().upper()[:8]
        if c:
            rec["country"] = c


def _should_drop_after_quality(rec: dict[str, Any]) -> bool:
    """
    Sin teléfono ni web: descartar si el nombre parece texto de producto
    o título demasiado largo sin forma legal.
    """
    name = str(rec.get("company_name") or "").strip()
    phone = rec.get("phone")
    website = rec.get("website")
    has_phone = bool(phone and str(phone).strip())
    has_web = bool(website and str(website).strip())
    if has_phone or has_web:
        return False
    if _looks_like_product_text(name):
        return True
    if len(name) > 90 and not _has_intl_legal_suffix(name):
        return True
    return False


def _choose_europages_company_name(listing: str, detail: str | None) -> str:
    """
    Mezcla ``choose_better_company_name`` (S.L./S.A. ES) con reglas para fichas
    internacionales (p. ej. «SRL» sin puntos) y títulos de producto largos en listado.
    """
    l0 = clean_company_name_surface(listing)
    if not detail or len(detail.strip()) < 3:
        return l0
    d0 = clean_company_name_surface(detail)
    if not d0:
        return l0
    picked = choose_better_company_name(listing, detail)
    if picked != l0:
        return picked
    if _looks_like_product_title(l0) and not _looks_like_product_title(d0):
        return d0
    if len(l0) > 70 and len(d0) <= 85 and len(d0) < len(l0) - 15:
        return d0
    if (
        6 <= len(d0) <= 75
        and len(d0) < len(l0) - 15
        and _has_intl_legal_suffix(d0)
        and not _looks_like_product_title(d0)
    ):
        return d0
    return l0


def _company_name_from_page_title(title: str) -> str | None:
    """Título tipo «ACME SL in City, keywords… - on europages»."""
    t = (title or "").strip()
    if not t:
        return None
    t = re.sub(r"\s*[\|\-–]\s*.*europages.*$", "", t, flags=re.I).strip()
    t = re.sub(r"\s+on\s+europages\s*$", "", t, flags=re.I).strip()
    if " in " in t:
        head = t.split(" in ", 1)[0].strip()
        if 4 <= len(head) <= 200:
            return clean_company_name_surface(head[:500])
    cleaned = clean_company_name_surface(t)
    return cleaned[:500] if len(cleaned) >= 4 else None


def extract_europages_detail_from_html(html: str) -> dict[str, Any]:
    """Ficha empresa: JSON-LD, ``<title>``/og:, ``tel:``, enlace web externo."""
    out: dict[str, Any] = {
        "phone": None,
        "email": None,
        "website": None,
        "detail_name": None,
        "detail_city": None,
        "detail_province": None,
        "detail_country": None,
    }
    soup = BeautifulSoup(html, "html.parser")

    for script in soup.find_all("script", attrs={"type": True}):
        st = (script.get("type") or "").lower()
        if "ld+json" not in st:
            continue
        raw = script.string or script.get_text() or ""
        if not raw.strip():
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        orgs: list[dict[str, Any]] = []
        _ld_collect_orgs(data, orgs)
        for org in orgs:
            if not out["detail_name"]:
                ln = org.get("legalName")
                nm = org.get("name")
                if isinstance(ln, str) and len(ln.strip()) >= 4 and not _looks_like_product_title(ln):
                    out["detail_name"] = clean_company_name_surface(ln)
                elif isinstance(nm, str) and len(nm.strip()) >= 4 and not _looks_like_product_title(nm):
                    out["detail_name"] = clean_company_name_surface(nm)
            ad = org.get("address")
            if isinstance(ad, dict):
                loc = ad.get("addressLocality")
                reg = ad.get("addressRegion")
                ctry = ad.get("addressCountry")
                if isinstance(loc, str) and loc.strip():
                    out["detail_city"] = loc.strip()[:120]
                if isinstance(reg, str) and reg.strip():
                    out["detail_province"] = reg.strip()[:120]
                if isinstance(ctry, str) and ctry.strip():
                    out["detail_country"] = ctry.strip()[:80]
            cp = org.get("contactPoint")
            if isinstance(cp, list) and cp:
                cp = cp[0]
            if isinstance(cp, dict) and not out["phone"]:
                tel = cp.get("telephone")
                if isinstance(tel, str):
                    out["phone"] = _normalize_phone(tel) or tel.strip()[:32]
            if not out["phone"]:
                tel = org.get("telephone") or org.get("tel")
                if isinstance(tel, str):
                    out["phone"] = _normalize_phone(tel) or tel.strip()[:32]
                elif isinstance(tel, list) and tel:
                    out["phone"] = _normalize_phone(str(tel[0])) or str(tel[0]).strip()[:32]
            if not out["email"]:
                em = org.get("email")
                if isinstance(em, str) and "@" in em:
                    out["email"] = em.strip()[:255]
            if not out["website"]:
                u = org.get("url") or org.get("sameAs")
                if isinstance(u, str) and u.startswith("http") and not _host_skip_external_website(u):
                    out["website"] = u.split("?")[0].strip()[:500]
                elif isinstance(u, list):
                    for x in u:
                        if (
                            isinstance(x, str)
                            and x.startswith("http")
                            and not _host_skip_external_website(x)
                        ):
                            out["website"] = x.split("?")[0].strip()[:500]
                            break
            if out["phone"] and out["website"] and out["detail_name"]:
                break

    if out["detail_name"] and _looks_like_product_title(out["detail_name"]):
        out["detail_name"] = None

    if not out["detail_name"]:
        og = soup.find("meta", attrs={"property": "og:title"})
        if og and og.get("content"):
            dn = _company_name_from_page_title(str(og["content"]))
            if dn:
                out["detail_name"] = dn
    if not out["detail_name"]:
        ttag = soup.find("title")
        if ttag and (ttag.string or ttag.get_text()):
            dn = _company_name_from_page_title(str(ttag.string or ttag.get_text()))
            if dn:
                out["detail_name"] = dn
    if not out["detail_name"]:
        h1 = soup.find("h1")
        if h1:
            t = clean_company_name_surface(h1.get_text(" ", strip=True))
            if 4 <= len(t) <= 400:
                out["detail_name"] = t

    for a in soup.select('a[href^="tel:"]'):
        if out["phone"]:
            break
        raw = (a.get("href") or "")[4:]
        if raw:
            pn = _normalize_phone(raw)
            if pn:
                out["phone"] = pn

    if not out["website"]:
        for a in soup.select('a[href^="http"]'):
            href = (a.get("href") or "").strip()
            if not href or _host_skip_external_website(href):
                continue
            if "europages" in href.lower() and "/company/" in href.lower():
                continue
            out["website"] = href.split("?")[0].strip()[:500]
            break

    return out


def _enrich_records_from_detail_pages(
    sess: requests.Session,
    records: list[dict[str, Any]],
    criteria: SearchCriteria,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    dbg: dict[str, Any] = {
        "listing_rows_input": len(records),
        "detail_pages_visited": 0,
        "phones_extracted": 0,
        "websites_extracted": 0,
        "company_names_upgraded": 0,
        "emails_extracted": 0,
        "locations_updated": 0,
        "http_errors": 0,
        "skipped_cap": 0,
    }
    raw = (os.environ.get("LEADS_EUROPAGES_ENRICH_MAX") or "").strip()
    max_n = int(raw) if raw.isdigit() else 40
    if max_n <= 0:
        dbg["skipped_cap"] = len(records)
        for rec in records:
            _apply_europages_location_fallback(rec, criteria)
        return records, dbg
    max_n = min(max_n, len(records), 80)

    for rec in records[:max_n]:
        url = rec.get("source_url")
        if not url or not isinstance(url, str):
            continue
        if not url.startswith("http"):
            continue
        time.sleep(random.uniform(0.4, 1.0))
        try:
            r = sess.get(url, timeout=32, allow_redirects=True)
            if r.status_code != 200 or _is_cloudflare_wall(r.text or ""):
                dbg["http_errors"] += 1
                continue
            dbg["detail_pages_visited"] += 1
            ct = extract_europages_detail_from_html(r.text or "")
        except requests.RequestException:
            dbg["http_errors"] += 1
            continue
        except Exception:
            dbg["http_errors"] += 1
            continue

        old_name = str(rec.get("company_name") or "")
        if ct.get("phone"):
            rec["phone"] = ct["phone"]
            dbg["phones_extracted"] += 1
        if ct.get("email"):
            rec["email"] = ct["email"]
            dbg["emails_extracted"] += 1
        if ct.get("website"):
            rec["website"] = ct["website"]
            dbg["websites_extracted"] += 1
        dn = ct.get("detail_name")
        if dn:
            d0 = clean_company_name_surface(str(dn))
            if d0 and len(d0) >= 3:
                if _has_intl_legal_suffix(d0) or not _looks_like_non_company(d0):
                    if rec.get("company_name") != d0:
                        rec["company_name"] = d0
                        dbg["company_names_upgraded"] += 1
                else:
                    new_name = _choose_europages_company_name(old_name, d0)
                    if new_name != old_name:
                        rec["company_name"] = new_name
                        dbg["company_names_upgraded"] += 1

        loc_hit = False
        if ct.get("detail_city"):
            rec["city"] = str(ct["detail_city"])[:120]
            loc_hit = True
        if ct.get("detail_province"):
            rec["province"] = str(ct["detail_province"])[:120]
            loc_hit = True
        if ct.get("detail_country"):
            c = str(ct["detail_country"])[:80]
            rec["country"] = c.upper() if len(c) <= 3 else c
            loc_hit = True
        if loc_hit:
            dbg["locations_updated"] += 1

        rec["dedupe_key"] = compute_dedupe_key(
            str(rec.get("company_name") or ""),
            rec.get("phone"),
            rec.get("website") or rec.get("source_url"),
        )
        prev = rec.get("notes")
        rec["notes"] = f"{prev};europages_detail" if prev else "europages_detail"

    for rec in records:
        _apply_europages_location_fallback(rec, criteria)

    return records, dbg


def _slug(s: str) -> str:
    t = (s or "").strip().lower()
    t = re.sub(r"[^a-z0-9áéíóúñü]+", "-", t, flags=re.I)
    t = re.sub(r"-+", "-", t).strip("-")
    return t or "spain"


def _what_slug(criteria: SearchCriteria) -> str:
    base = (criteria.category or "").strip()
    if criteria.free_text:
        base = f"{base} {criteria.free_text}".strip()
    return _slug(base)


def _where_slug(criteria: SearchCriteria) -> str:
    for raw in (criteria.where_slug, criteria.city, criteria.province):
        s = _slug(raw or "")
        if s and s != "spain":
            return s
    return ""


def _europages_what_slugs(criteria: SearchCriteria) -> list[str]:
    """
    Varios slugs de listado /companies/spain/{slug}.html a partir de categoría
    y frases del perfil (expand_search_criteria), para no depender de un solo path.
    """
    seen: set[str] = set()
    out: list[str] = []
    primary = _what_slug(criteria)
    if primary and primary != "spain":
        out.append(primary)
        seen.add(primary)
    for ph in (criteria.expanded_query_phrases or [])[:6]:
        s = _slug(str(ph))
        if not s or s == "spain" or s in seen:
            continue
        out.append(s)
        seen.add(s)
        if len(out) >= 6:
            break
    return out


def _europages_search_text(criteria: SearchCriteria) -> str:
    """Texto para ``/es/search?countries=…&q=…`` (listado principal actual de Europages)."""
    cat = (criteria.category or "").strip()
    ft = (criteria.free_text or "").strip()
    if cat and ft:
        t = f"{cat} {ft}"
    elif cat:
        t = cat
    elif ft:
        t = ft
    else:
        return ""
    t = re.sub(r"\s+", " ", t).strip()[:200]
    return t


def _europages_search_listing_url(country_code: str, q: str, page: int) -> str:
    """Misma búsqueda que en la web: https://www.europages.es/es/search?countries=ES&q=…"""
    if not (q or "").strip():
        return ""
    cc = (country_code or "ES").strip().upper()[:8] or "ES"
    qq = quote_plus(q.strip()[:200])
    u = f"{EUROPAGES_ORIGIN}/es/search?countries={cc}&q={qq}"
    if page > 1:
        u += f"&page={page}"
    return u


def _strip_europages_page_param(url: str) -> str:
    u = (url or "").split("#")[0]
    u = re.sub(r"([&?])page=\d+", "", u)
    u = re.sub(r"\?&", "?", u)
    return u.rstrip("&?")


def _listing_pagination_base(final_url: str) -> str:
    """
    Base para seguir con ?page=N o &page=N.
    Las URLs ``/es/search?...`` deben conservar ``countries`` y ``q`` (no cortar en el primer ``?``).
    """
    u = (final_url or "").split("#")[0]
    if "/search?" in u or ("/search" in u and "?" in u):
        return _strip_europages_page_param(u)
    return u.split("?")[0]


def _europages_listing_page_url(pagination_base: str, page: int) -> str:
    if page <= 1:
        return pagination_base
    b = pagination_base
    if "/search?" in b or ("/search" in b and "?" in b):
        b = _strip_europages_page_param(b)
        return f"{b}&page={page}"
    return f"{b}?page={page}"


def _listing_urls_for_page(what_slugs: list[str], where_slug: str, page: int) -> list[str]:
    """URLs de listado para una página de resultados (sin parar en la primera con datos)."""
    q = f"?page={page}" if page > 1 else ""
    urls: list[str] = []
    seen: set[str] = set()
    ws_set = set(what_slugs or [])
    for ws in what_slugs:
        if ws and ws != "spain":
            u = f"{EUROPAGES_ORIGIN}/companies/spain/{ws}.html{q}"
            if u not in seen:
                seen.add(u)
                urls.append(u)
    u0 = f"{EUROPAGES_ORIGIN}/companies/spain.html{q}"
    if u0 not in seen:
        seen.add(u0)
        urls.append(u0)
    if where_slug and where_slug != "spain" and where_slug not in ws_set:
        u = f"{EUROPAGES_ORIGIN}/companies/spain/{where_slug}.html{q}"
        if u not in seen:
            urls.append(u)
    return urls


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
    return False


def parse_europages_listing_html(
    html: str,
    *,
    base_url: str,
    scraped_iso: str,
    category: str,
    province: str,
    city: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    # province/city no se rellenan desde la búsqueda: la ubicación real viene del detalle o del fallback.
    _ = province
    _ = city
    dbg: dict[str, Any] = {
        "anchors_checked": 0,
        "company_bases": 0,
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
        base = _company_base_url(full)
        if not base:
            continue
        if base in seen:
            continue
        seen.add(base)
        dbg["company_bases"] += 1

        name = a.get_text(" ", strip=True)
        name = re.sub(r"\s+", " ", name).strip()
        if len(name) < 2:
            continue

        parent_txt = ""
        p = a.parent
        for _ in range(8):
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
                "source_url": base,
                "source_name": "europages",
                "country": "",
                "category": category,
                "province": "",
                "city": "",
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
                if not any("Business" in x or x in ("Organization",) for x in types):
                    continue
                name = (it.get("name") or "").strip()
                if len(name) < 2:
                    continue
                url = (it.get("url") or "") if isinstance(it.get("url"), str) else ""
                if url and "europages" not in url.lower():
                    continue
                tel = it.get("telephone")
                phone = _normalize_phone(str(tel)) if tel else None
                base = _company_base_url(url) if url else None
                rows.append(
                    {
                        "company_name": name[:400],
                        "phone": phone,
                        "website": url if url.startswith("http") else None,
                        "email": None,
                        "address": None,
                        "source_url": base or url or base_url,
                        "source_name": "europages",
                        "country": "",
                        "category": category,
                        "province": "",
                        "city": "",
                        "scraped_at": scraped_iso,
                    }
                )
        dbg["json_ld_rows"] = len(rows)

    dbg["rows_out"] = len(rows)
    return rows, dbg


def scrape_europages(
    criteria: SearchCriteria,
    *,
    scraped_iso: str,
    max_pages: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    what_slugs = _europages_what_slugs(criteria)
    where_slug = _where_slug(criteria)
    max_pages_in = int(max_pages or 1)
    max_pages = max(1, min(max_pages_in, 25))

    listing_fetches: list[dict[str, Any]] = []
    debug: dict[str, Any] = {
        "source_id": "europages",
        "what_slugs": what_slugs,
        "primary_what_slug": what_slugs[0] if what_slugs else None,
        "where_slug": where_slug or None,
        "listing_url_priority": "search_es_q_then_directory_slugs",
        "max_pages_requested": max_pages_in,
        "max_pages_effective": max_pages,
        "listing_fetches": listing_fetches,
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
    bases_with_rows: set[str] = set()
    pages_fetched = 0

    def _append_fetch(
        *,
        listing_page_index: int,
        requested_url: str,
        final_url: str | None,
        http_status: int | None,
        html_len: int,
        rows_raw: int,
        pdbg: dict[str, Any] | None,
        err: str | None = None,
    ) -> None:
        fe: dict[str, Any] = {
            "listing_page_index": listing_page_index,
            "requested_url": requested_url,
            "final_url": final_url,
            "http_status": http_status,
            "html_len": html_len,
            "rows_raw": rows_raw,
        }
        if pdbg is not None:
            fe["parse_pass"] = pdbg
        if err:
            fe["error"] = err
        listing_fetches.append(fe)

    try:
        # Página 1: primero búsqueda web actual (/es/search?countries=ES&q=…) — miles de proveedores;
        # luego listados /companies/spain/… (legacy).
        search_q = _europages_search_text(criteria)
        search_url_p1 = ""
        if search_q:
            search_url_p1 = _europages_search_listing_url(
                criteria.country or "ES", search_q, 1
            )
            debug["search_query_used"] = search_q
            debug["search_listing_url_sample"] = search_url_p1 or None
        merged_p1: list[str] = []
        seen_p1: set[str] = set()
        if search_url_p1:
            merged_p1.append(search_url_p1)
            seen_p1.add(search_url_p1)
        for u in _listing_urls_for_page(what_slugs, where_slug, 1):
            if u not in seen_p1:
                seen_p1.add(u)
                merged_p1.append(u)

        # Página 1: todas las URLs candidatas; no parar en la primera.
        for url in merged_p1:
            pages_fetched += 1
            try:
                r = sess.get(url, timeout=35, allow_redirects=True)
                html = r.text or ""
                fu = str(r.url)
                hs = r.status_code
                debug["urls_tried"].append(
                    {
                        "url": url,
                        "listing_page_index": 1,
                        "status": hs,
                        "len": len(html),
                        "final_url": fu,
                    }
                )
                if hs == 403 or _is_cloudflare_wall(html):
                    debug["zero_reason_code"] = "blocked"
                    debug["hint"] = "Europages devolvió bloqueo o Cloudflare."
                    debug["blocked"] = True
                    debug["pages_fetched"] = pages_fetched
                    return [], {"debug": debug, "blocked": True, "error": "Europages blocked"}
                if hs != 200:
                    last_err = f"HTTP {hs}"
                    _append_fetch(
                        listing_page_index=1,
                        requested_url=url,
                        final_url=fu,
                        http_status=hs,
                        html_len=len(html),
                        rows_raw=0,
                        pdbg=None,
                    )
                    time.sleep(random.uniform(0.25, 0.7))
                    continue

                rows, pdbg = parse_europages_listing_html(
                    html,
                    base_url=fu,
                    scraped_iso=scraped_iso,
                    category=criteria.category,
                    province=criteria.province,
                    city=criteria.city,
                )
                debug["parse_pass"] = pdbg
                _append_fetch(
                    listing_page_index=1,
                    requested_url=url,
                    final_url=fu,
                    http_status=hs,
                    html_len=len(html),
                    rows_raw=len(rows),
                    pdbg=pdbg,
                )
                if rows:
                    all_rows.extend(rows)
                    bases_with_rows.add(_listing_pagination_base(fu))
            except requests.RequestException as e:
                last_err = str(e)[:220]
                debug["urls_tried"].append({"url": url, "listing_page_index": 1, "error": last_err})
                _append_fetch(
                    listing_page_index=1,
                    requested_url=url,
                    final_url=None,
                    http_status=None,
                    html_len=0,
                    rows_raw=0,
                    pdbg=None,
                    err=last_err,
                )
            time.sleep(random.uniform(0.35, 0.85))

        bases_sorted = sorted(bases_with_rows)
        debug["listing_bases_paginated"] = bases_sorted
        if bases_sorted:
            debug["working_base"] = bases_sorted[0]

        exhausted: set[str] = set()
        for listing_page_index in range(2, max_pages + 1):
            if not bases_sorted:
                break
            got_any = False
            for base in bases_sorted:
                if base in exhausted:
                    continue
                qurl = _europages_listing_page_url(base, listing_page_index)
                pages_fetched += 1
                try:
                    r = sess.get(qurl, timeout=35, allow_redirects=True)
                    html = r.text or ""
                    fu = str(r.url)
                    hs = r.status_code
                    debug["urls_tried"].append(
                        {
                            "url": qurl,
                            "listing_page_index": listing_page_index,
                            "status": hs,
                            "len": len(html),
                            "final_url": fu,
                        }
                    )
                    if hs == 403 or _is_cloudflare_wall(html):
                        debug["zero_reason_code"] = "blocked"
                        debug["hint"] = "Europages devolvió bloqueo o Cloudflare."
                        debug["blocked"] = True
                        debug["pages_fetched"] = pages_fetched
                        return [], {"debug": debug, "blocked": True, "error": "Europages blocked"}
                    if hs != 200:
                        last_err = f"HTTP {hs}"
                        exhausted.add(base)
                        _append_fetch(
                            listing_page_index=listing_page_index,
                            requested_url=qurl,
                            final_url=fu,
                            http_status=hs,
                            html_len=len(html),
                            rows_raw=0,
                            pdbg=None,
                        )
                        continue

                    rows, pdbg = parse_europages_listing_html(
                        html,
                        base_url=fu,
                        scraped_iso=scraped_iso,
                        category=criteria.category,
                        province=criteria.province,
                        city=criteria.city,
                    )
                    debug["parse_pass"] = pdbg
                    _append_fetch(
                        listing_page_index=listing_page_index,
                        requested_url=qurl,
                        final_url=fu,
                        http_status=hs,
                        html_len=len(html),
                        rows_raw=len(rows),
                        pdbg=pdbg,
                    )
                    if rows:
                        all_rows.extend(rows)
                        got_any = True
                    else:
                        exhausted.add(base)
                except requests.RequestException as e:
                    last_err = str(e)[:220]
                    debug["urls_tried"].append(
                        {"url": qurl, "listing_page_index": listing_page_index, "error": last_err}
                    )
                    exhausted.add(base)
                    _append_fetch(
                        listing_page_index=listing_page_index,
                        requested_url=qurl,
                        final_url=None,
                        http_status=None,
                        html_len=0,
                        rows_raw=0,
                        pdbg=None,
                        err=last_err,
                    )
                time.sleep(random.uniform(0.35, 0.85))
            if not got_any:
                break

        debug["pages_fetched"] = pages_fetched

    except requests.RequestException as e:
        last_err = str(e)[:240]
        debug["request_error"] = last_err
        debug["pages_fetched"] = pages_fetched

    if not all_rows:
        debug["zero_reason_code"] = "parser_empty" if not last_err else "http_error_or_empty"
        debug["hint"] = (
            last_err
            or "No se extrajeron empresas. Prueba otro slug de categoría o ciudad (europages.es)."
        )
        return [], {"debug": debug}

    debug["raw_listing_rows_before_dedupe"] = len(all_rows)
    _by_lp: dict[int, int] = {}
    for fe in listing_fetches:
        lip = int(fe.get("listing_page_index") or 0)
        _by_lp[lip] = _by_lp.get(lip, 0) + int(fe.get("rows_raw") or 0)
    debug["rows_raw_total_by_listing_page_index"] = dict(sorted(_by_lp.items()))
    debug["listing_fetch_count"] = len(listing_fetches)
    _fu: list[str] = []
    _seen_fu: set[str] = set()
    for fe in listing_fetches:
        fu = fe.get("final_url")
        if isinstance(fu, str) and fu.strip() and fu not in _seen_fu:
            _seen_fu.add(fu)
            _fu.append(fu.strip())
    debug["listing_final_urls_unique"] = _fu

    seen_u: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for row in all_rows:
        u = (row.get("source_url") or "").strip()
        if u in seen_u:
            continue
        seen_u.add(u)
        deduped.append(row)

    listing_rows = len(deduped)
    debug["listing_rows_after_url_dedupe"] = listing_rows
    dropped_prefilter = 0
    prefiltered: list[dict[str, Any]] = []
    for row in deduped:
        name = str(row.get("company_name") or "")
        if _listing_name_prefilter_drop(name):
            dropped_prefilter += 1
            continue
        prefiltered.append(row)
    deduped = prefiltered

    deduped, enrich_dbg = _enrich_records_from_detail_pages(sess, deduped, criteria)
    debug["enrich"] = enrich_dbg

    dropped_quality = 0
    final_rows: list[dict[str, Any]] = []
    for row in deduped:
        if _should_drop_after_quality(row):
            dropped_quality += 1
            continue
        final_rows.append(row)
    deduped = final_rows

    rows_dropped_product_like = dropped_prefilter + dropped_quality
    debug["listing_rows"] = listing_rows
    debug["company_rows_kept"] = len(deduped)
    debug["rows_dropped_product_like"] = rows_dropped_product_like
    debug["rows_with_website"] = sum(
        1 for r in deduped if (r.get("website") or "").strip()
    )
    debug["rows_with_phone"] = sum(1 for r in deduped if (r.get("phone") or "").strip())

    debug["zero_reason_code"] = "ok"
    debug["hint"] = "OK"
    debug["parsed_final"] = len(deduped)
    return deduped, {"debug": debug}
