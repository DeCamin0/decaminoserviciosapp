"""
Páginas Amarillas (España): descarga y parseo de listados.

La mayoría de peticiones ``requests`` reciben Incapsula (challenge JS). Por eso:
- ``fetch_search_pages`` intenta la red y lanza ``ScraperBlockedError`` si detecta bloqueo.
- ``parse_listing_html`` funciona con HTML guardado desde el navegador (``--from-html``).

Salida alineada con el import Nest/Prisma (snake_case + ``dedupe_key``).
"""
from __future__ import annotations

import hashlib
import json
import random
import re
import time
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE_ORIGIN = "https://www.paginasamarillas.es"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
]


class ScraperBlockedError(RuntimeError):
    """Anti-bot / Incapsula u otra página de challenge."""

    def __init__(
        self,
        msg: str,
        *,
        url: str | None = None,
        http_status: int | None = None,
        html_preview: str | None = None,
    ) -> None:
        super().__init__(msg)
        self.block_url = url
        self.block_http_status = http_status
        self.block_html_preview = html_preview


def _slug(text: str) -> str:
    t = text.strip().lower()
    t = re.sub(r"[\s/]+", "-", t)
    t = re.sub(r"[^a-z0-9\-áéíóúñü]+", "-", t, flags=re.IGNORECASE)
    t = re.sub(r"-+", "-", t).strip("-")
    return t or "x"


def build_search_url(what: str, where: str, page: int = 1, *, city: str = "") -> str:
    """
    URL de listado público actual (2025+): ``/a/{actividad}/{provincia}/`` o, si hay ciudad,
    ``/a/{actividad}/{provincia}/{localidad}/``. Paginación: ``?page=N`` (p. ej. ``?page=2``).
    El patrón antiguo ``/buscar/...`` devuelve 404.
    """
    w, loc = _slug(what), _slug(where)
    city_s = _slug(city) if (city or "").strip() else ""
    if city_s:
        path = f"{BASE_ORIGIN}/a/{w}/{loc}/{city_s}/"
    else:
        path = f"{BASE_ORIGIN}/a/{w}/{loc}/"
    if page <= 1:
        return path
    return f"{path}?page={page}"


def detect_bot_wall(html: str) -> bool:
    low = html.lower()
    if "incapsula" in low and "resource" in low:
        return True
    if "request unsuccessful" in low:
        return True
    if "document.forms[0].submit" in low and len(html) < 800:
        return True
    return False


def _random_delay(min_s: float, max_s: float) -> None:
    time.sleep(random.uniform(min_s, max_s))


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


def fetch_search_page(url: str, timeout: int = 28) -> tuple[str, int]:
    """GET una URL de resultados; respeta delay aleatorio. Retorna (html, status_code)."""
    _random_delay(1.2, 3.0)
    sess = _session()
    r = sess.get(url, timeout=timeout, allow_redirects=True)
    status = r.status_code
    r.raise_for_status()
    text = r.text
    if detect_bot_wall(text):
        raise ScraperBlockedError(
            "Respuesta bloqueada (Incapsula / anti-bot). "
            "Abre la misma búsqueda en el navegador, guarda la página completa como HTML "
            "y ejecuta: python run_scrape.py --from-html guardado.html ...",
            url=url,
            http_status=status,
            html_preview=text[:1000].replace("\n", " ").replace("\r", " "),
        )
    return text, status


def normalize_phone(p: str | None) -> str:
    if not p:
        return ""
    return re.sub(r"\s+", "", str(p).strip())


def normalize_website(w: str | None) -> str:
    if not w:
        return ""
    x = str(w).strip().lower()
    x = re.sub(r"^https?://", "", x)
    x = re.sub(r"^www\.", "", x)
    return x.split("/")[0].rstrip(".")


def compute_dedupe_key(company_name: str, phone: str | None, website: str | None) -> str:
    name = " ".join(company_name.strip().lower().split())
    body = f"{name}|{normalize_phone(phone)}|{normalize_website(website)}"
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _abs_url(href: str) -> str:
    if href.startswith("//"):
        return "https:" + href
    return urljoin(BASE_ORIGIN + "/", href)


def _walk_ld(obj: Any, out: list[dict[str, Any]]) -> None:
    if isinstance(obj, dict):
        types = obj.get("@type")
        if isinstance(types, str):
            types = [types]
        elif not isinstance(types, list):
            types = []

        if "ItemList" in types:
            for el in obj.get("itemListElement") or []:
                if not isinstance(el, dict):
                    continue
                item = el.get("item")
                if isinstance(item, dict):
                    _walk_ld(item, out)
                elif isinstance(item, str):
                    pass
        if any(t in ("LocalBusiness", "Organization", "Store", "ProfessionalService") for t in types):
            out.append(obj)
        if "@graph" in obj:
            for g in obj["@graph"]:
                _walk_ld(g, out)
        for v in obj.values():
            if isinstance(v, dict):
                _walk_ld(v, out)
            elif isinstance(v, list):
                for x in v:
                    if isinstance(x, dict):
                        _walk_ld(x, out)
    elif isinstance(obj, list):
        for x in obj:
            if isinstance(x, dict):
                _walk_ld(x, out)


def extract_json_ld_businesses(soup: BeautifulSoup) -> list[dict[str, Any]]:
    raw_nodes: list[dict[str, Any]] = []
    for script in soup.find_all("script", attrs={"type": re.compile(r"ld\+json", re.I)}):
        raw = (script.string or script.get_text() or "").strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(data, list):
            for chunk in data:
                if isinstance(chunk, dict):
                    _walk_ld(chunk, raw_nodes)
        elif isinstance(data, dict):
            _walk_ld(data, raw_nodes)
    return raw_nodes


def _business_to_record(
    b: dict[str, Any],
    *,
    category: str,
    province: str | None,
    city: str | None,
    listing_url: str,
    scraped_iso: str,
) -> dict[str, Any] | None:
    name = (b.get("name") or "").strip()
    if not name:
        return None
    tel = b.get("telephone") or b.get("telefono")
    if isinstance(tel, list):
        tel = tel[0] if tel else None
    phone = str(tel).strip() if tel else None
    web = b.get("url") or b.get("sameAs")
    if isinstance(web, list):
        web = next((x for x in web if isinstance(x, str) and x.startswith("http")), None)
    website = str(web).strip() if web else None
    addr = b.get("address")
    prov, cit = province, city
    if isinstance(addr, dict):
        cit = addr.get("addressLocality") or cit
        prov = addr.get("addressRegion") or prov
    dedupe = compute_dedupe_key(name, phone, website)
    return {
        "company_name": name,
        "email": None,
        "phone": phone,
        "website": website,
        "category": category or None,
        "country": "ES",
        "province": prov,
        "city": cit,
        "source_name": "paginas_amarillas",
        "source_url": listing_url,
        "scraped_at": scraped_iso,
        "dedupe_key": dedupe,
        "status": "new",
        "notes": None,
    }


def extract_ficha_links(soup: BeautifulSoup, listing_url: str) -> list[tuple[str, str]]:
    """Pares (nombre_visible, url_absoluta) desde enlaces tipo ficha."""
    pairs: list[tuple[str, str]] = []
    seen: set[str] = set()
    for a in soup.select('a[href*="ficha"]'):
        href = a.get("href")
        if not href or not isinstance(href, str):
            continue
        low = href.lower()
        if "paginasamarillas" not in low and not low.startswith("/"):
            continue
        full = _abs_url(href)
        if full in seen:
            continue
        name = a.get_text(" ", strip=True)
        if len(name) < 2:
            continue
        seen.add(full)
        pairs.append((name, full))
    return pairs


def parse_listing_html(
    html: str,
    *,
    category: str,
    province: str | None,
    city: str | None,
    listing_url: str,
    scraped_iso: str,
) -> list[dict[str, Any]]:
    """
    Extrae registros de una página de resultados (JSON-LD + enlaces ficha).
    """
    soup = BeautifulSoup(html, "html.parser")
    records: list[dict[str, Any]] = []
    keys_seen: set[str] = set()

    for b in extract_json_ld_businesses(soup):
        rec = _business_to_record(
            b,
            category=category,
            province=province,
            city=city,
            listing_url=listing_url,
            scraped_iso=scraped_iso,
        )
        if rec and rec["dedupe_key"] not in keys_seen:
            keys_seen.add(rec["dedupe_key"])
            records.append(rec)

    for name, ficha_url in extract_ficha_links(soup, listing_url):
        # No usar solo el dominio: varias fichas comparten host.
        dedupe = hashlib.sha256(
            f"pa_ficha|{name.strip().lower()}|{ficha_url}".encode("utf-8")
        ).hexdigest()
        if dedupe in keys_seen:
            continue
        keys_seen.add(dedupe)
        records.append(
            {
                "company_name": name,
                "email": None,
                "phone": None,
                "website": None,
                "category": category or None,
                "country": "ES",
                "province": province,
                "city": city,
                "source_name": "paginas_amarillas",
                "source_url": ficha_url,
                "scraped_at": scraped_iso,
                "dedupe_key": dedupe,
                "status": "new",
                "notes": None,
            }
        )

    return records


def scrape_search(
    what: str,
    where: str,
    *,
    max_pages: int = 1,
    city: str = "",
    debug_out: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """
    Intenta descargar 1..N páginas de resultados y parsearlas.
    Lanza ``ScraperBlockedError`` si Incapsula bloquea.
    Si ``debug_out`` es un dict, se rellena telemetría (urls, status, previews).
    """
    from datetime import datetime, timezone

    scraped_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    all_recs: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    if debug_out is not None:
        debug_out["source_id"] = "paginas_amarillas"
        debug_out["search_term"] = f"{what!r} en {where!r}"
        debug_out["attempts"] = []

    for page in range(1, max(1, max_pages) + 1):
        url = build_search_url(what, where, page, city=city)
        try:
            html, http_status = fetch_search_page(url)
        except ScraperBlockedError as e:
            if debug_out is not None:
                debug_out["blocked"] = True
                debug_out["zero_reason_code"] = "blocked"
                debug_out["hint"] = "La fuente bloqueó la solicitud automática (anti-bot)."
                debug_out["attempts"].append(
                    {
                        "url": getattr(e, "block_url", None) or url,
                        "http_status": getattr(e, "block_http_status", None),
                        "blocked": True,
                        "error": str(e)[:400],
                        "html_preview": getattr(e, "block_html_preview", None),
                    }
                )
            raise
        soup_probe = BeautifulSoup(html, "html.parser")
        n_ld = len(extract_json_ld_businesses(soup_probe))
        n_ficha = len(extract_ficha_links(soup_probe, url))
        chunk = parse_listing_html(
            html,
            category=what,
            province=where,
            city=(city or "").strip() or None,
            listing_url=url,
            scraped_iso=scraped_iso,
        )
        if debug_out is not None:
            entry: dict[str, Any] = {
                "url": url,
                "http_status": http_status,
                "html_length": len(html),
                "json_ld_entities": n_ld,
                "ficha_link_pairs": n_ficha,
                "parsed_records_page": len(chunk),
            }
            if not chunk and html:
                entry["html_preview"] = html[:1000].replace("\n", " ").replace("\r", " ")
            debug_out["attempts"].append(entry)
        for r in chunk:
            k = r["dedupe_key"]
            if k in seen_keys:
                continue
            seen_keys.add(k)
            all_recs.append(r)
        if not chunk:
            break

    if debug_out is not None:
        debug_out["raw_before_dedupe_pages"] = sum(
            a.get("parsed_records_page", 0) for a in debug_out.get("attempts", [])
        )
        debug_out["parsed_final"] = len(all_recs)
        if not all_recs and not debug_out.get("blocked"):
            if any((a.get("html_length") or 0) < 800 for a in debug_out.get("attempts", [])):
                debug_out["zero_reason_code"] = "short_response"
                debug_out["hint"] = "Respuesta HTTP muy corta; posible redirección o bloqueo silencioso."
            elif all((a.get("json_ld_entities", 0) == 0 and a.get("ficha_link_pairs", 0) == 0) for a in debug_out.get("attempts", [])):
                debug_out["zero_reason_code"] = "parser_empty"
                debug_out["hint"] = (
                    "El parser no extrajo resultados del HTML recibido (sin JSON-LD ni enlaces /ficha/)."
                )
            else:
                debug_out["zero_reason_code"] = "unknown"
                debug_out["hint"] = "No se obtuvieron fichas pese a señales en el HTML; revisa intentos[]."

    return all_recs


__all__ = [
    "BASE_ORIGIN",
    "ScraperBlockedError",
    "build_search_url",
    "compute_dedupe_key",
    "detect_bot_wall",
    "fetch_search_page",
    "parse_listing_html",
    "scrape_search",
]
