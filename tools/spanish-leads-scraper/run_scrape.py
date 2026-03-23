#!/usr/bin/env python3
"""
CLI multi-fuente con registro en ``sources/``.

Salida Nest con ``--nest-json``:
  {"records": [...], "records_by_source": {...}, "stats": {...}}
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from orchestrator import run_scrape_pipeline
from paginas_amarillas.scraper import (
    ScraperBlockedError,
    parse_listing_html,
)
from sources.criteria import SearchCriteria
from sources.registry import all_source_ids
from sources.search_profiles import expand_search_criteria

SOURCE_CHOICES = tuple(["auto", "google"] + sorted(all_source_ids()))


def _load_criteria(args: argparse.Namespace) -> SearchCriteria:
    env_dbg = os.environ.get("LEADS_SCRAPE_DEBUG", "").lower() in ("1", "true", "yes")
    cli_dbg = bool(getattr(args, "debug", False))
    if getattr(args, "criteria_file", None):
        c = SearchCriteria.from_path(Path(args.criteria_file))
        if cli_dbg or env_dbg:
            c.debug = True
        return c
    return SearchCriteria(
        category=(args.what or "").strip(),
        where_slug=(args.where or "").strip(),
        province=(args.province or "").strip(),
        city=(args.city or "").strip(),
        country="ES",
        debug=cli_dbg or env_dbg,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Leads scraper — España (registro de fuentes)")
    parser.add_argument(
        "--source",
        choices=SOURCE_CHOICES,
        default="auto",
        help="auto = fuentes habilitadas en sources/sources_config.json",
    )
    parser.add_argument("--what", help="Actividad / categoría (si no hay --criteria-file)")
    parser.add_argument("--where", help="Slug ciudad o provincia (si no hay --criteria-file)")
    parser.add_argument("--province", default="", help="Etiqueta provincia (humana)")
    parser.add_argument("--city", default="", help="Etiqueta ciudad (humana)")
    parser.add_argument(
        "--criteria-file",
        metavar="FILE",
        help="JSON SearchCriteria (category, where_slug, synonyms, …)",
    )
    parser.add_argument("--max-pages", type=int, default=1, help="Solo Páginas Amarillas (red)")
    parser.add_argument(
        "--from-html",
        metavar="FILE",
        help="Solo parseo PA desde HTML guardado",
    )
    parser.add_argument("-o", "--output")
    parser.add_argument("--format", choices=("jsonl", "json"), default="jsonl")
    parser.add_argument(
        "--nest-json",
        action="store_true",
        help="JSON con records + records_by_source + stats (Nest)",
    )
    parser.add_argument("--sample", action="store_true")
    parser.add_argument(
        "--debug",
        action="store_true",
        help="LEADS_SCRAPE_DEBUG=1 + traza stderr al final (URLs, queries, etc.)",
    )
    args = parser.parse_args()
    if args.debug:
        os.environ["LEADS_SCRAPE_DEBUG"] = "1"

    if args.sample:
        row = {
            "company_name": "Ejemplo Limpiezas S.L.",
            "email": None,
            "phone": "+34900111222",
            "website": "https://example.es",
            "category": "limpieza",
            "country": "ES",
            "province": "Madrid",
            "city": "Madrid",
            "source_name": "paginas_amarillas",
            "source_url": "https://www.paginasamarillas.es/",
            "scraped_at": "2026-03-20T12:00:00",
            "dedupe_key": "sample:paginas_amarillas:example.es:900111222",
            "status": "new",
            "notes": None,
        }
        if args.nest_json:
            json.dump(
                {
                    "records": [row],
                    "records_by_source": {"paginas_amarillas": [row]},
                    "stats": {"sample": True},
                },
                sys.stdout,
                ensure_ascii=False,
            )
        else:
            json.dump(row, sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0

    scraped_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    records_by_source: dict[str, list] = {}
    stats: dict = {}

    try:
        if args.from_html:
            if args.criteria_file:
                cmeta = _load_criteria(args)
                if not cmeta.category or not cmeta.where_slug:
                    parser.error(
                        "Con --from-html, --criteria-file debe incluir category y where_slug"
                    )
            else:
                if not args.what or not args.where:
                    parser.error(
                        "--what y --where son obligatorios con --from-html (o use --criteria-file)"
                    )
                cmeta = SearchCriteria(
                    category=args.what,
                    where_slug=args.where,
                    province=(args.province or "").strip(),
                    city=(args.city or "").strip(),
                    country="ES",
                    debug=bool(args.debug)
                    or os.environ.get("LEADS_SCRAPE_DEBUG", "").lower()
                    in ("1", "true", "yes"),
                )
            cmeta = expand_search_criteria(cmeta)
            path = Path(args.from_html)
            html = path.read_text(encoding="utf-8", errors="replace")
            listing_url = f"file://{path.resolve()}"
            records = parse_listing_html(
                html,
                category=cmeta.category,
                province=cmeta.where_slug,
                city=(cmeta.city or "").strip() or None,
                listing_url=listing_url,
                scraped_iso=scraped_iso,
            )
            records_by_source = {"paginas_amarillas": records}
            stats = {
                "sources": {
                    "paginas_amarillas": {
                        "ok": True,
                        "scraped": len(records),
                        "failed": False,
                        "failure_mode": "blocked",
                        "hint": "HTML local parseado (sin red).",
                        "zero_reason_code": "ok" if records else "parser_empty",
                        "debug": {
                            "html_length": len(html),
                            "parsed_final": len(records),
                        },
                    }
                },
                "import_order": ["paginas_amarillas"],
                "_merged_unique": len(records),
                "_merged_raw": len(records),
                "criteria": cmeta.to_dict(),
                "source_mode": "paginas_amarillas_html",
            }
        else:
            criteria = _load_criteria(args)
            if not criteria.category:
                parser.error(
                    "category es obligatorio (CLI --what o --criteria-file; where_slug opcional para búsqueda solo país)"
                )
            criteria = expand_search_criteria(criteria)
            records, stats, records_by_source = run_scrape_pipeline(
                args.source,
                criteria,
                max_pages=args.max_pages,
            )
    except ScraperBlockedError as e:
        print(str(e), file=sys.stderr)
        return 2
    except OSError as e:
        print(f"Error leyendo archivo: {e}", file=sys.stderr)
        return 1
    except ValueError as e:
        print(str(e), file=sys.stderr)
        return 1

    if not records and not args.from_html:
        print(
            "0 registros agregados. Revisa stats en stderr o salida nest-json.",
            file=sys.stderr,
        )

    out_path = args.output
    payload_records = records
    if args.nest_json:
        out_obj = {
            "records": payload_records,
            "records_by_source": records_by_source,
            "stats": stats,
        }
        text_out = json.dumps(out_obj, ensure_ascii=False)
    else:
        text_out = None

    if out_path:
        p = Path(out_path)
        if args.format == "jsonl" and not args.nest_json:
            with p.open("w", encoding="utf-8") as f:
                for r in records:
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")
        else:
            obj = out_obj if args.nest_json else records
            p.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Escrito en {p}", file=sys.stderr)
    else:
        if args.nest_json:
            print(text_out, file=sys.stdout)
        elif args.format == "jsonl":
            for r in records:
                print(json.dumps(r, ensure_ascii=False))
        else:
            print(json.dumps(records, ensure_ascii=False))

    if args.debug and stats:
        print("\n--- LEADS_SCRAPE_DEBUG (stats.sources) ---\n", file=sys.stderr)
        try:
            blob = json.dumps(stats.get("sources", stats), ensure_ascii=False, indent=2)
            print(blob[:14000], file=sys.stderr)
            if len(blob) > 14000:
                print("… [truncado]", file=sys.stderr)
        except Exception as ex:
            print(str(ex), file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
