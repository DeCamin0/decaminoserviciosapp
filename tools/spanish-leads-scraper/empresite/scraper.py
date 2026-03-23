"""
Empresite (eleconomista.es) — búsqueda y parseo tolerante con telemetría.
"""
from __future__ import annotations

import json
import os
import random
import re
import sys
import time
import unicodedata
from typing import Any
from urllib.parse import quote_plus, unquote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from empresite.quality import (
    apply_quality_pipeline,
    choose_better_company_name,
    clean_company_name_surface,
)
from paginas_amarillas.scraper import compute_dedupe_key

# Sin «www»: en muchos DNS «www.empresite.eleconomista.es» no resuelve (NXDOMAIN).
BASE = "https://empresite.eleconomista.es"
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
]

# Rutas .aspx antiguas devuelven 404; el sitio usa /provincia/… y /sucursales/ACTIVIDAD/PROVINCIA/.
_HTML_SKIP_SUBSTR = (
    "faq",
    "terms",
    "privacy",
    "cookies",
    "publicar",
    "informes",
    "home_usuarios",
    "ultimos_negocios",
    "top_empresas",
    "categorias_recientes",
    "empresas-provincia",
)

# Patrones en el **path** (nunca en el host): «empresite» en el dominio hacía aceptar cualquier URL absoluta.
PATH_LINK_HINTS = (
    "informacion",
    "empresa",
    "ficha",
    "actividad",
    "sociedad",
    "detalle",
    "empresas",
    "listado",
    "resultado",
)

# Hub de municipios / provincia (no son fichas de empresa)
_PROVINCIA_HUB_RE = re.compile(r"^/provincia/[a-z0-9\-]+/?$", re.I)
# Texto tipo «Alpedrete (1.146 )» = enlace a localidad, no empresa
_POPULATION_LABEL = re.compile(r"^\s*.+?\(\s*\d[\d\s.,]*\)\s*$", re.I)


def _emp_progress(event: str, **kwargs: Any) -> None:
    """Traza stderr (visible en logs Nest al hacer stream del subprocess)."""
    ts = time.strftime("%H:%M:%S")
    extra = ""
    if kwargs:
        try:
            extra = " " + json.dumps(kwargs, ensure_ascii=False)
        except Exception:
            extra = " " + str(kwargs)
    print(f"[empresite][{ts}] {event}{extra}", file=sys.stderr, flush=True)


def _delay() -> None:
    """Pausa entre GETs; configurable con LEADS_EMPRESITE_DELAY_SEC (ej. ``5-12`` o ``8``).

    Por defecto **5–10 s** (antes 2.2–4.8) para reducir 429 desde IP de servidor.
    """
    raw = (os.environ.get("LEADS_EMPRESITE_DELAY_SEC") or "").strip()
    lo, hi = 5.0, 10.0
    if raw:
        if "-" in raw:
            parts = raw.split("-", 1)
            try:
                lo = float(parts[0].strip())
                hi = float(parts[1].strip())
            except ValueError:
                pass
        else:
            try:
                v = float(raw)
                lo = hi = v
            except ValueError:
                pass
    if hi < lo:
        lo, hi = hi, lo
    time.sleep(random.uniform(lo, hi))


def _sleep_initial_before_listing() -> None:
    """Pausa antes del primer GET de listado (cookies / no «rafaga»)."""
    _emp_progress("initial_delay_start")
    raw = (os.environ.get("LEADS_EMPRESITE_INITIAL_DELAY_SEC") or "").strip()
    if not raw:
        time.sleep(random.uniform(8.0, 14.0))
        _emp_progress("initial_delay_end", seconds="8-14(default)")
        return
    if "-" in raw:
        a, b = raw.split("-", 1)
        try:
            lo, hi = float(a.strip()), float(b.strip())
        except ValueError:
            time.sleep(10.0)
            _emp_progress("initial_delay_end", seconds="10(fallback)")
            return
        if hi < lo:
            lo, hi = hi, lo
        time.sleep(random.uniform(lo, hi))
    else:
        try:
            time.sleep(float(raw))
        except ValueError:
            time.sleep(10.0)
    _emp_progress("initial_delay_end", configured=bool(raw))


def _classify_429_kind(resp: requests.Response) -> str:
    """
    Heurística para telemetría / UI:
    - ``source_rate_limited``: suele ir con ``Retry-After`` (límite temporal).
    - ``source_ip_blocked_or_throttled``: 429 sin ``Retry-After`` (WAF / IP dura).
    """
    if _parse_retry_after_seconds(resp) is not None:
        return "source_rate_limited"
    return "source_ip_blocked_or_throttled"


def _warmup_session(
    sess: requests.Session,
) -> tuple[int | None, requests.Response | None, str | None]:
    """GET a la portada para cookies. Si responde 429, devuelve ``fail_fast_kind`` (no dormir ni seguir)."""
    _emp_progress("warmup_start", url=f"{BASE}/")
    try:
        r = sess.get(f"{BASE}/", timeout=22, allow_redirects=True)
        _emp_progress("warmup_http", status=r.status_code, len=len(r.text or ""))
        if r.status_code == 429:
            kind = _classify_429_kind(r)
            _emp_progress(
                "warmup_429_fail_fast",
                zero_reason_code=kind,
                retry_after_header=_parse_retry_after_seconds(r) is not None,
            )
            return r.status_code, r, kind
        time.sleep(random.uniform(2.0, 5.5))
        _emp_progress("warmup_end")
        return r.status_code, r, None
    except Exception as ex:
        _emp_progress("warmup_error", error=str(ex)[:200])
        return None, None, None


EMPRESITE_RATE_LIMIT_HINT_EN = (
    "Empresite is rate-limiting this machine/IP. Retrying is unlikely to help right now. "
    "Try another source, another network, or browser-assisted extraction."
)


def _parse_retry_after_seconds(resp: requests.Response) -> float | None:
    ra = resp.headers.get("Retry-After")
    if not ra:
        return None
    ra = ra.strip()
    if ra.isdigit():
        return float(min(int(ra), 120))
    return None


def _empresite_fetch(
    sess: requests.Session,
    url: str,
    *,
    timeout: int = 28,
) -> tuple[requests.Response | None, dict[str, Any]]:
    """
    GET con reintentos si el servidor responde 429 (respeta ``Retry-After`` si existe).

    ``LEADS_EMPRESITE_429_RETRIES``: reintentos tras 429 (defecto **4** → hasta 5 intentos en total).
    """
    raw = (os.environ.get("LEADS_EMPRESITE_429_RETRIES") or "").strip()
    max_retries = int(raw) if raw.isdigit() else 4
    max_retries = max(0, min(max_retries, 8))
    _light = os.environ.get("LEADS_EMPRESITE_LIGHT_MODE", "").lower() in (
        "1",
        "true",
        "yes",
    )
    if _light:
        # MVP: menos vueltas de backoff ante 429 inmediato
        max_retries = min(max_retries, 1)
    meta: dict[str, Any] = {"retries_on_429": 0, "429_wait_seconds": []}
    last: requests.Response | None = None
    for attempt in range(max_retries + 1):
        try:
            _emp_progress(
                "http_attempt",
                url=url[:120],
                attempt=attempt + 1,
                max_attempts=max_retries + 1,
            )
            r = sess.get(url, timeout=timeout, allow_redirects=True)
            last = r
            _emp_progress("http_response", status=r.status_code, final_url=str(r.url)[:120])
            if r.status_code != 429:
                return r, meta
            if attempt >= max_retries:
                break
            wait = _parse_retry_after_seconds(r)
            if wait is None:
                wait = min(10.0 * (2**attempt), 75.0) + random.uniform(0.5, 3.0)
            else:
                wait = max(wait, 4.0)
            wait = min(wait, 90.0)
            meta["429_wait_seconds"].append(round(wait, 2))
            ra_hdr = _parse_retry_after_seconds(r) is not None
            _emp_progress(
                "retry_backoff_429",
                sleep_sec=round(wait, 2),
                retry_after_header=ra_hdr,
            )
            time.sleep(wait)
            meta["retries_on_429"] += 1
        except requests.RequestException as e:
            meta["request_error"] = str(e)[:240]
            return last, meta
    return last, meta


def _ascii_upper_slug(s: str) -> str:
    t = (s or "").strip()
    if not t:
        return ""
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[\s/]+", "-", t)
    t = re.sub(r"[^A-Za-z0-9\-]+", "", t)
    t = t.strip("-").upper()
    return t


def _province_segment(province: str, city: str, where_slug: str) -> str:
    for raw in (province, city, where_slug):
        seg = _ascii_upper_slug(raw)
        if seg:
            return seg
    return ""


def _activity_variants(category: str) -> list[str]:
    base = _ascii_upper_slug(category)
    if not base:
        return []
    out: list[str] = [base]
    if len(base) > 3 and base[-1] in "AEIOU":
        out.append(base + "S")
    seen: set[str] = set()
    uniq: list[str] = []
    for x in out:
        if x not in seen:
            seen.add(x)
            uniq.append(x)
    return uniq


def _empresite_search_urls(
    *,
    category: str,
    province: str,
    city: str,
    where_slug: str,
) -> list[str]:
    """URLs actuales (2025+); las .aspx quedan al final por si reaparecen."""
    prov = _province_segment(province, city, where_slug)
    acts = _activity_variants(category)
    out: list[str] = []
    # Listados por actividad antes que el hub provincial (éste enlaza a /localidad/, no a fichas).
    for act in acts:
        out.append(f"{BASE}/Actividad/{act}/")
    if prov:
        out.append(f"{BASE}/provincia/{prov}/")
    # Legacy (suelen ser 404)
    where_human = (city or province or where_slug or "").replace("-", " ").strip()
    prov_q = (province or city or where_human or "").strip() or where_slug

    term_full = quote_plus(f"{category} {where_human}".strip())
    term_w = quote_plus(category.strip())
    prov_enc = quote_plus(prov_q)
    out.extend(
        [
            f"{BASE}/Busqueda.aspx?cadena={term_full}",
            f"{BASE}/Busqueda.aspx?cadena={term_w}&provincia={prov_enc}",
            f"{BASE}/Buscar.aspx?texto={term_full}",
            f"{BASE}/Resultados.aspx?SearchText={term_full}",
            f"{BASE}/Busqueda.aspx?SearchText={term_full}",
            f"{BASE}/Busqueda.aspx?cadena={term_w}",
        ]
    )
    seen: set[str] = set()
    deduped: list[str] = []
    for u in out:
        if u not in seen:
            seen.add(u)
            deduped.append(u)
    return deduped


def _path_only_low(href: str) -> str:
    """Solo path (sin host) para no confundir el dominio «empresite» con un hint."""
    t = (href or "").strip()
    if not t:
        return ""
    if t.startswith(("http://", "https://")):
        try:
            return (urlparse(t).path or "").lower()
        except Exception:
            pass
    return t.split("?", 1)[0].lower()


def _is_excluded_nav_path(path_low: str) -> bool:
    pl = path_low.split("?", 1)[0]
    if not pl or pl == "/":
        return True
    if pl.startswith("/localidad"):
        return True
    if _PROVINCIA_HUB_RE.match(pl.rstrip("/")):
        return True
    if any(
        x in pl
        for x in (
            "/empresas-provincia",
            "/informes-empresas",
            "/informes/",
            "/home_usuarios",
            "/ultimos_negocios",
            "/categorias_recientes",
        )
    ):
        return True
    return False


def _looks_like_municipality_population_label(text: str) -> bool:
    """«Ciudad (1.234 )» en la página hub provincial = no es nombre de empresa."""
    t = (text or "").strip()
    if len(t) < 3:
        return False
    return bool(_POPULATION_LABEL.match(t))


def _link_acceptable(href: str) -> bool:
    if not href or len(href) < 4:
        return False
    low = href.lower()
    if low.startswith("javascript:") or low.startswith("#") or low.startswith("mailto:"):
        return False
    path_low = _path_only_low(href)
    if _is_excluded_nav_path(path_low):
        return False
    if low.endswith(".html"):
        if low.startswith("http") and "eleconomista.es" not in low:
            return False
        if any(sk in low for sk in _HTML_SKIP_SUBSTR):
            return False
        path = low.split("?", 1)[0].rsplit("/", 1)[-1]
        if len(path) < 5 or not path.endswith(".html"):
            return False
        slug = path[:-5]
        if len(slug) < 1 or slug.isdigit():
            return False
        return True
    if any(h in path_low for h in PATH_LINK_HINTS) or ".aspx" in path_low:
        return True
    if "/empresa" in path_low or "/emp/" in path_low:
        return True
    return False


_SOCIAL_HOSTS = (
    "facebook.com",
    "fb.com",
    "twitter.com",
    "x.com",
    "linkedin.com",
    "instagram.com",
    "youtube.com",
    "tiktok.com",
    "pinterest.com",
    "maps.google",
    "goo.gl",
    "google.es/maps",
)


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


def _normalize_phone_es(raw: str) -> str | None:
    t = re.sub(r"[^\d+]", "", (raw or "").strip())
    if not t:
        return None
    if t.startswith("34") and len(t) >= 11:
        t = "+" + t
    elif len(t) == 9 and t[0] in "6789":
        t = "+34" + t
    if len(t) < 9:
        return None
    return t[:20]


def _extract_contact_from_detail_html(html: str) -> dict[str, Any]:
    """Datos de la ficha HTML (tel/mail/JSON-LD/web) + nombre / localización si existen."""
    out: dict[str, Any] = {
        "phone": None,
        "email": None,
        "website": None,
        "detail_name": None,
        "detail_city": None,
        "detail_province": None,
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
                if isinstance(ln, str) and len(ln.strip()) >= 4:
                    out["detail_name"] = clean_company_name_surface(ln)
                elif isinstance(nm, str) and len(nm.strip()) >= 4:
                    out["detail_name"] = clean_company_name_surface(nm)
            ad = org.get("address")
            if isinstance(ad, dict):
                if str(ad.get("@type", "")).lower() in (
                    "postaladdress",
                    "http://schema.org/postaladdress",
                ) or ad.get("addressLocality") or ad.get("addressRegion"):
                    loc = ad.get("addressLocality")
                    reg = ad.get("addressRegion")
                    if isinstance(loc, str) and loc.strip():
                        out["detail_city"] = loc.strip()[:120]
                    if isinstance(reg, str) and reg.strip():
                        out["detail_province"] = reg.strip()[:120]
            cp = org.get("contactPoint")
            if isinstance(cp, list) and cp:
                cp = cp[0]
            if isinstance(cp, dict) and not out["phone"]:
                tel = cp.get("telephone")
                if isinstance(tel, str):
                    out["phone"] = _normalize_phone_es(tel) or tel.strip()[:32]
            if isinstance(cp, dict) and not out["email"]:
                em = cp.get("email")
                if isinstance(em, str) and "@" in em:
                    out["email"] = em.strip()[:255]
            if not out["phone"]:
                tel = org.get("telephone") or org.get("tel")
                if isinstance(tel, str):
                    out["phone"] = _normalize_phone_es(tel) or tel.strip()[:32]
                elif isinstance(tel, list) and tel:
                    out["phone"] = _normalize_phone_es(str(tel[0])) or str(tel[0])[:32]
            if not out["email"]:
                em = org.get("email")
                if isinstance(em, str) and "@" in em:
                    out["email"] = em.strip()[:255]
                elif isinstance(em, list) and em and isinstance(em[0], str):
                    out["email"] = em[0].strip()[:255]
            if not out["website"]:
                u = org.get("url") or org.get("sameAs")
                if isinstance(u, str) and u.startswith("http"):
                    low = u.lower()
                    if "eleconomista.es" not in low and not any(
                        s in low for s in _SOCIAL_HOSTS
                    ):
                        out["website"] = u.split("?")[0].strip()[:500]
                elif isinstance(u, list) and u:
                    for x in u:
                        if isinstance(x, str) and x.startswith("http"):
                            low = x.lower()
                            if "eleconomista.es" not in low and not any(
                                s in low for s in _SOCIAL_HOSTS
                            ):
                                out["website"] = x.split("?")[0].strip()[:500]
                                break
            if out["phone"] and out["email"] and out["website"]:
                break

    if not out["detail_name"]:
        og_title = soup.find("meta", attrs={"property": "og:title"})
        if og_title and og_title.get("content"):
            t = str(og_title["content"]).strip()
            t = re.sub(r"\s*[\|\-–]\s*.*empresite.*$", "", t, flags=re.I)
            t = re.sub(r"\s*[\|\-–]\s*.*eleconomista.*$", "", t, flags=re.I)
            t = clean_company_name_surface(t)
            if len(t) >= 4:
                out["detail_name"] = t[:500]
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
        raw = unquote(raw.split(";", 1)[0].strip())
        p = _normalize_phone_es(raw)
        if p:
            out["phone"] = p
            break

    for a in soup.select('a[href^="mailto:"]'):
        if out["email"]:
            break
        raw = (a.get("href") or "")[7:]
        raw = unquote(raw.split("?")[0].strip())
        if "@" in raw:
            out["email"] = raw[:255]
            break

    og = soup.find("meta", attrs={"property": "og:url"})
    if (
        og
        and og.get("content")
        and not out["website"]
        and isinstance(og.get("content"), str)
    ):
        cu = og["content"].strip()
        if cu.startswith("http") and "eleconomista.es" not in cu.lower():
            if not any(s in cu.lower() for s in _SOCIAL_HOSTS):
                out["website"] = cu.split("?")[0][:500]

    if not out["website"]:
        for a in soup.find_all("a", href=True):
            href = (a.get("href") or "").strip()
            if not href.startswith("http"):
                continue
            low = href.lower()
            if "eleconomista.es" in low or "empresite" in low:
                continue
            if any(s in low for s in _SOCIAL_HOSTS):
                continue
            label = (a.get_text() or "").lower()
            if any(
                k in label
                for k in (
                    "web",
                    "www",
                    "sitio",
                    "página",
                    "pagina",
                    "ir a",
                    "visitar",
                )
            ):
                out["website"] = href.split("?")[0].strip()[:500]
                break
        if not out["website"]:
            for a in soup.find_all("a", href=True):
                href = (a.get("href") or "").strip()
                if not href.startswith("http"):
                    continue
                low = href.lower()
                if "eleconomista.es" in low or "empresite" in low:
                    continue
                if any(s in low for s in _SOCIAL_HOSTS):
                    continue
                out["website"] = href.split("?")[0].strip()[:500]
                break

    if not out["phone"]:
        blob = soup.get_text(" ", strip=True)
        m = re.search(
            r"(?:\+34\s*|0034\s*)?[6789]\d(?:\s*\d{2}){3}\s*\d{2,3}",
            blob,
        )
        if m:
            out["phone"] = _normalize_phone_es(m.group(0)) or re.sub(
                r"\s+", " ", m.group(0).strip()
            )[:32]

    return out


def _enrich_records_from_detail_pages(
    sess: requests.Session,
    records: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    Segunda pasada: GET por ficha para teléfono / email / web / nombre / localidad.
    ``LEADS_EMPRESITE_ENRICH_MAX`` (default 40): cuántas fichas; ``0`` = desactivar.
    """
    dbg: dict[str, Any] = {
        "attempted": 0,
        "filled_phone": 0,
        "filled_email": 0,
        "filled_website": 0,
        "detail_names_applied": 0,
        "locations_updated": 0,
        "http_errors": 0,
        "detail_429_count": 0,
        "skipped_cap": 0,
    }
    raw = (os.environ.get("LEADS_EMPRESITE_ENRICH_MAX") or "").strip()
    max_n = int(raw) if raw.isdigit() else 40
    if max_n <= 0:
        dbg["skipped_cap"] = len(records)
        return records, dbg
    max_n = min(max_n, len(records), 80)

    _emp_progress(
        "detail_enrich_batch_start",
        total_rows=len(records),
        will_fetch=min(max_n, len(records)),
    )

    for rec in records[:max_n]:
        url = rec.get("source_url")
        if not url or not isinstance(url, str):
            continue
        if not url.startswith("http"):
            continue
        dbg["attempted"] += 1
        if dbg["attempted"] == 1 or dbg["attempted"] % 5 == 0:
            _emp_progress(
                "detail_enrich_progress",
                detail_index=dbg["attempted"],
                detail_total=min(max_n, len(records)),
            )
        _delay()
        try:
            r, fetch_meta = _empresite_fetch(sess, url, timeout=28)
            if r is None:
                dbg["http_errors"] += 1
                continue
            if r.status_code == 429:
                dbg["detail_429_count"] += 1
                dbg["http_errors"] += 1
                continue
            if r.status_code != 200:
                dbg["http_errors"] += 1
                continue
            ct = _extract_contact_from_detail_html(r.text or "")
        except Exception:
            dbg["http_errors"] += 1
            continue

        identity_changed = False
        if ct.get("phone"):
            rec["phone"] = ct["phone"]
            dbg["filled_phone"] += 1
            identity_changed = True
        if ct.get("email"):
            rec["email"] = ct["email"]
            dbg["filled_email"] += 1
            identity_changed = True
        if ct.get("website"):
            rec["website"] = ct["website"]
            dbg["filled_website"] += 1
            identity_changed = True

        dn = ct.get("detail_name")
        if dn:
            old_name = str(rec.get("company_name") or "")
            new_name = choose_better_company_name(old_name, dn)
            if new_name != old_name:
                rec["company_name"] = new_name
                dbg["detail_names_applied"] += 1
                identity_changed = True

        loc_hit = False
        if ct.get("detail_city"):
            rec["city"] = str(ct["detail_city"])[:120]
            loc_hit = True
        if ct.get("detail_province"):
            rec["province"] = str(ct["detail_province"])[:120]
            loc_hit = True
        if loc_hit:
            dbg["locations_updated"] += 1

        if identity_changed:
            prev = rec.get("notes")
            rec["notes"] = (
                f"{prev};detail_enriched" if prev else "detail_enriched"
            )
            rec["dedupe_key"] = compute_dedupe_key(
                str(rec.get("company_name") or ""),
                rec.get("phone"),
                rec.get("website") or rec.get("source_url"),
            )
    _emp_progress(
        "detail_enrich_batch_done",
        attempted=dbg["attempted"],
        filled_phone=dbg["filled_phone"],
        filled_email=dbg["filled_email"],
        filled_website=dbg["filled_website"],
        detail_429=dbg.get("detail_429_count", 0),
    )
    return records, dbg


def scrape_empresite(
    what: str,
    where: str,
    *,
    scraped_iso: str,
    category: str,
    province: str,
    city: str,
    query_phrases: list[str] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    debug: dict[str, Any] = {
        "source_id": "empresite",
        "search_term": f"{what!r} / {where!r}",
        "urls_tried": [],
        "parse_pass": None,
    }

    sess = requests.Session()
    sess.headers.update(
        {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Referer": f"{BASE}/",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        }
    )

    _light = os.environ.get("LEADS_EMPRESITE_LIGHT_MODE", "").lower() in (
        "1",
        "true",
        "yes",
    )
    _emp_progress(
        "scrape_session_ready",
        category=category,
        light_mode=_light,
        max_urls_env=os.environ.get("LEADS_EMPRESITE_MAX_URLS") or "default",
        delay_env=os.environ.get("LEADS_EMPRESITE_DELAY_SEC") or "default",
    )

    _ws, _wr, warmup_fail_kind = _warmup_session(sess)
    if warmup_fail_kind is not None:
        debug["warmup"] = {
            "http_status": 429,
            "fail_fast": True,
            "blocked_reason": warmup_fail_kind,
        }
        debug["urls_tried"] = [
            {
                "url": f"{BASE}/",
                "http_status": 429,
                "note": "warmup_429_fail_fast",
                "retry_after_header": warmup_fail_kind == "source_rate_limited",
            }
        ]
        debug["blocked"] = True
        debug["zero_reason_code"] = warmup_fail_kind
        debug["hint"] = EMPRESITE_RATE_LIMIT_HINT_EN
        _emp_progress(
            "scrape_done",
            outcome="warmup_429_blocked",
            zero_reason=warmup_fail_kind,
            fail_fast=True,
        )
        return [], {"debug": debug, "blocked": True, "error": "Empresite warmup 429"}

    _sleep_initial_before_listing()

    phrases = list(query_phrases) if query_phrases else [category]
    mpp = (os.environ.get("LEADS_EMPRESITE_MAX_PHRASES") or "").strip()
    max_ph = int(mpp) if mpp.isdigit() else 3
    max_ph = max(1, min(max_ph, 10))
    phrases = phrases[:max_ph]
    debug["query_phrases"] = phrases

    murls = (os.environ.get("LEADS_EMPRESITE_MAX_URLS") or "").strip()
    cap = int(murls) if murls.isdigit() else 6
    cap = max(3, min(cap, 48))

    candidates: list[str] = []
    seen_c: set[str] = set()
    for ph in phrases:
        for u in _empresite_search_urls(
            category=ph,
            province=province,
            city=city,
            where_slug=where,
        ):
            if u not in seen_c:
                seen_c.add(u)
                candidates.append(u)
            if len(candidates) >= cap:
                break
        if len(candidates) >= cap:
            break

    best_html = ""
    best_url = ""
    best_status = 0
    best_parse: tuple[list[dict[str, Any]], dict[str, Any]] | None = None

    abort_after_raw = (os.environ.get("LEADS_EMPRESITE_429_ABORT_AFTER") or "").strip()
    abort_after_429 = int(abort_after_raw) if abort_after_raw.isdigit() else 2
    abort_after_429 = max(1, min(abort_after_429, 20))
    consecutive_429 = 0
    _rr = (os.environ.get("LEADS_EMPRESITE_429_RETRIES") or "4").strip()
    debug["anti_429"] = {
        "retries_per_url_on_429": int(_rr) if _rr.isdigit() else 4,
        "abort_after_consecutive_429": abort_after_429,
        "delay_sec_note": "default pause between Empresite GETs is 5–10s; set LEADS_EMPRESITE_DELAY_SEC if 429 persists",
    }

    _emp_progress(
        "listing_phase_start",
        candidate_count=len(candidates),
        preview=candidates[:5],
    )

    for idx, url in enumerate(candidates, start=1):
        _emp_progress("listing_url_try", index=idx, total=len(candidates), url=url[:160])
        _delay()
        entry: dict[str, Any] = {"url": url}
        try:
            r, fetch_meta = _empresite_fetch(sess, url, timeout=28)
            entry["fetch_meta"] = fetch_meta
            if r is None:
                entry["note"] = fetch_meta.get("request_error") or "no_response"
                debug["urls_tried"].append(entry)
                continue
            entry["http_status"] = r.status_code
            entry["final_url"] = str(r.url)
            entry["html_length"] = len(r.text or "")
            if r.status_code == 429:
                entry["retry_after_header"] = _parse_retry_after_seconds(r) is not None
                entry["note"] = (
                    "rate_limited_after_retries"
                    if fetch_meta.get("retries_on_429")
                    else "rate_limited"
                )
                consecutive_429 += 1
                debug["urls_tried"].append(entry)
                if consecutive_429 >= abort_after_429:
                    entry["aborted_after_consecutive_429"] = True
                    break
                continue
            consecutive_429 = 0
            if r.status_code != 200:
                debug["urls_tried"].append(entry)
                continue
            text = r.text or ""
            if len(text) < 400:
                entry["note"] = "body_muy_corto"
                debug["urls_tried"].append(entry)
                continue
            low = text.lower()
            if "empresite" not in low and "eleconomista" not in low:
                entry["note"] = "sin_marca_empresite_en_html"
            debug["urls_tried"].append(entry)

            recs, pdbg = _parse_listing_html(
                text,
                base_url=str(r.url),
                scraped_iso=scraped_iso,
                category=category,
                province=province,
                city=city,
            )
            if recs:
                best_html = text
                best_url = str(r.url)
                best_status = r.status_code
                best_parse = (recs, pdbg)
                _emp_progress(
                    "listing_parse_ok",
                    rows=len(recs),
                    url=str(r.url)[:160],
                )
                break
            if len(text) > len(best_html):
                best_html = text
                best_url = str(r.url)
                best_status = r.status_code
                best_parse = (recs, pdbg)
        except requests.RequestException as e:
            entry["error"] = str(e)[:300]
            debug["urls_tried"].append(entry)
            continue

    if not best_html:
        saw_429 = any(x.get("http_status") == 429 for x in debug["urls_tried"])
        if saw_429:
            any_retry_after = any(
                x.get("retry_after_header")
                for x in debug["urls_tried"]
                if x.get("http_status") == 429
            )
            zrc = (
                "source_rate_limited" if any_retry_after else "source_ip_blocked_or_throttled"
            )
            _emp_progress(
                "scrape_done",
                outcome="blocked_429",
                urls_tried=len(debug["urls_tried"]),
                zero_reason=zrc,
            )
            debug["blocked"] = True
            debug["zero_reason_code"] = zrc
            debug["hint"] = EMPRESITE_RATE_LIMIT_HINT_EN
            return [], {"debug": debug, "blocked": True, "error": "Empresite 429"}
        debug["zero_reason_code"] = "http_error_or_empty"
        debug["hint"] = (
            "No se obtuvo HTML útil desde Empresite (HTTP distinto de 200, cuerpo vacío o error de red)."
        )
        _emp_progress("scrape_done", outcome="no_html", urls_tried=len(debug["urls_tried"]))
        return [], {"debug": debug}

    if best_parse and best_parse[0]:
        records, parse_dbg = best_parse
    else:
        records, parse_dbg = _parse_listing_html(
            best_html,
            base_url=best_url or BASE,
            scraped_iso=scraped_iso,
            category=category,
            province=province,
            city=city,
        )
    debug["parse_pass"] = parse_dbg
    debug["parsed_final"] = len(records)
    debug["http_status"] = best_status
    debug["effective_url"] = best_url

    if records:
        listing_rows_found = len(records)
        records, enrich_dbg = _enrich_records_from_detail_pages(sess, records)
        debug["enrich_pass"] = enrich_dbg
        records, quality_dbg = apply_quality_pipeline(records)
        debug["quality_pass"] = quality_dbg
        debug["parsed_final"] = len(records)
        debug["empresite_quality_summary"] = {
            "listing_rows_found": listing_rows_found,
            "detail_pages_visited": enrich_dbg.get("attempted", 0),
            "phones_extracted": enrich_dbg.get("filled_phone", 0),
            "websites_extracted": enrich_dbg.get("filled_website", 0),
            "emails_extracted": enrich_dbg.get("filled_email", 0),
            "detail_names_upgraded": enrich_dbg.get("detail_names_applied", 0),
            "locations_from_detail": enrich_dbg.get("locations_updated", 0),
            "rows_dropped": quality_dbg.get("rows_dropped", 0),
            "rows_flagged_low_quality": quality_dbg.get("rows_flagged_low_quality", 0),
            "drop_reasons": quality_dbg.get("drop_reasons", {}),
            "rows_kept": len(records),
        }

    if not records:
        debug["zero_reason_code"] = "parser_empty"
        debug["hint"] = (
            "Empresite respondió, pero el parser no extrajo enlaces de empresa reconocibles. "
            "Revisa parse_pass (anchors_matched, sample_hrefs)."
        )
        debug["html_preview"] = best_html[:1000].replace("\n", " ").replace("\r", " ")
    else:
        debug["zero_reason_code"] = "ok"
        debug["hint"] = "OK"

    _emp_progress(
        "scrape_done",
        outcome="ok" if records else "empty",
        rows_out=len(records),
        zero_reason=debug.get("zero_reason_code"),
    )

    return records, {"debug": debug}


def _slug_to_display_name(slug: str) -> str:
    t = re.sub(r"[-_]+", " ", slug).strip()
    return t.title() if t else slug


def _regex_empresite_html_hrefs(html: str) -> list[str]:
    """Respaldo si el HTML no sigue el patrón esperado por BeautifulSoup (mayúsculas / minúsculas)."""
    out: list[str] = []
    seen: set[str] = set()
    for m in re.finditer(r"""href\s*=\s*["']([^"']+\.html)["']""", html, re.I):
        href = (m.group(1) or "").strip()
        if not href.startswith("/"):
            continue
        if _is_excluded_nav_path(_path_only_low(href)):
            continue
        low = href.lower()
        if any(sk in low for sk in _HTML_SKIP_SUBSTR):
            continue
        path = low.split("?", 1)[0].rsplit("/", 1)[-1]
        if not path.endswith(".html"):
            continue
        slug = path[:-5]
        if len(slug) < 2 or slug.isdigit():
            continue
        if href not in seen:
            seen.add(href)
            out.append(href)
        if len(out) >= 60:
            break
    return out


def _parse_listing_html(
    html: str,
    *,
    base_url: str,
    scraped_iso: str,
    category: str,
    province: str,
    city: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    dbg: dict[str, Any] = {
        "anchors_total": 0,
        "anchors_matched": 0,
        "sample_hrefs": [],
        "discarded": [],
        "regex_fallback_hrefs": 0,
    }

    for a in soup.find_all("a", href=True):
        dbg["anchors_total"] += 1
        href = (a.get("href") or "").strip()
        if not _link_acceptable(href):
            if len(dbg["discarded"]) < 25 and href and len(href) < 200:
                dbg["discarded"].append({"href": href[:180], "reason": "link_filter"})
            continue
        dbg["anchors_matched"] += 1
        if len(dbg["sample_hrefs"]) < 25:
            dbg["sample_hrefs"].append(href[:220])

        full = urljoin(BASE + "/", href)
        name = clean_company_name_surface(a.get_text(" ", strip=True))
        if len(name) < 2 or len(name) > 400:
            dbg["discarded"].append({"href": full[:180], "reason": "bad_name_len"})
            continue
        if _looks_like_municipality_population_label(name):
            dbg["discarded"].append({"href": full[:180], "reason": "municipio_poblacion"})
            continue
        nl = name.lower()
        if any(
            nl.startswith(p)
            for p in (
                "informes de",
                "empresas en",
                "últimos negocios",
                "ultimos negocios",
            )
        ):
            dbg["discarded"].append({"href": full[:180], "reason": "nav_label"})
            continue
        if full in seen:
            continue
        seen.add(full)
        rec = {
            "company_name": name,
            "email": None,
            "phone": None,
            "website": None,
            "category": category,
            "country": "ES",
            "province": province or None,
            "city": city or None,
            "source_name": "empresite",
            "source_url": full,
            "scraped_at": scraped_iso,
            "dedupe_key": compute_dedupe_key(name, None, full),
            "status": "new",
            "notes": None,
        }
        records.append(rec)
        if len(records) >= 50:
            break

    if not records:
        for tr in soup.find_all("tr"):
            link = tr.find("a", href=True)
            if not link:
                continue
            href = (link.get("href") or "").strip()
            if not href:
                continue
            if not _link_acceptable(href):
                continue
            full = urljoin(BASE + "/", href)
            if full in seen:
                continue
            name = clean_company_name_surface(link.get_text(" ", strip=True))
            if len(name) < 3:
                continue
            if _looks_like_municipality_population_label(name):
                continue
            seen.add(full)
            row_text = tr.get_text(" ", strip=True)
            phone = None
            m = re.search(r"(?:\+34\s*)?[6789]\d{2}\s*\d{2}\s*\d{2}\s*\d{2}", row_text)
            if m:
                phone = re.sub(r"\s+", " ", m.group(0).strip())
            records.append(
                {
                    "company_name": name[:400],
                    "email": None,
                    "phone": phone,
                    "website": None,
                    "category": category,
                    "country": "ES",
                    "province": province or None,
                    "city": city or None,
                    "source_name": "empresite",
                    "source_url": full,
                    "scraped_at": scraped_iso,
                    "dedupe_key": compute_dedupe_key(name, phone, full),
                    "status": "new",
                    "notes": None,
                }
            )
            dbg["fallback_tr_rows"] = dbg.get("fallback_tr_rows", 0) + 1
            if len(records) >= 50:
                break

    if not records:
        for href in _regex_empresite_html_hrefs(html):
            full = urljoin(BASE + "/", href)
            if full in seen:
                continue
            slug = href.rstrip("/").rsplit("/", 1)[-1].replace(".html", "").replace(".HTML", "")
            name = clean_company_name_surface(_slug_to_display_name(slug))
            if len(name) < 2:
                continue
            seen.add(full)
            records.append(
                {
                    "company_name": name[:400],
                    "email": None,
                    "phone": None,
                    "website": None,
                    "category": category,
                    "country": "ES",
                    "province": province or None,
                    "city": city or None,
                    "source_name": "empresite",
                    "source_url": full,
                    "scraped_at": scraped_iso,
                    "dedupe_key": compute_dedupe_key(name, None, full),
                    "status": "new",
                    "notes": "regex_fallback",
                }
            )
            dbg["regex_fallback_hrefs"] += 1
            if len(records) >= 50:
                break

    dbg["listing_rows"] = len(records)
    return records, dbg
