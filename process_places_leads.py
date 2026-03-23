#!/usr/bin/env python3
"""
Process Google Places export files (JSON/messy text) into a clean lead list.
Reads BOTH input files, merges all entries into ONE output (Excel or CSV).
Standalone script — does not depend on the main project.
"""

import re
import csv
import argparse
from pathlib import Path
from typing import Optional

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False



# ---------------------------------------------------------------------------
# 1. LOAD DATA — read both input files and merge into one list of raw blocks
# ---------------------------------------------------------------------------

def read_file_content(path: Path) -> str:
    """Read file with UTF-8, tolerate BOM."""
    with open(path, "r", encoding="utf-8-sig") as f:
        return f.read()


def load_and_merge_files(path1: Path, path2: Path) -> tuple[str, int, int]:
    """
    Load BOTH input files and merge into one content. Returns (merged_content, count_blocks_file1, count_blocks_file2).
    """
    parts = []
    n1, n2 = 0, 0
    if path1.exists():
        c1 = read_file_content(path1)
        parts.append(c1)
        n1 = len(extract_record_blocks(c1))
        print(f"  File 1: {path1.name} -> {n1} entries")
    else:
        print(f"  Warning: not found {path1}")
    if path2.exists():
        c2 = read_file_content(path2)
        parts.append(c2)
        n2 = len(extract_record_blocks(c2))
        print(f"  File 2: {path2.name} -> {n2} entries")
    else:
        print(f"  Warning: not found {path2}")
    return "\n\n".join(parts), n1, n2


def extract_record_blocks(content: str) -> list[str]:
    """
    Split content into blocks; each block starts with "adrFormatAddress":
    and contains one business record (until the next block or end).
    """
    # Records are separated by "adrFormatAddress": pattern (start of next record)
    blocks = re.split(r'\s*"adrFormatAddress"\s*:\s*', content, flags=re.IGNORECASE)
    # First segment may be preamble (no business); rest are records
    return [b.strip() for b in blocks[1:] if b.strip()]


# ---------------------------------------------------------------------------
# 2. EXTRACT FIELDS from each block
# ---------------------------------------------------------------------------

def strip_html(text: str) -> str:
    """Remove HTML tags and decode common entities."""
    if not text or not isinstance(text, str):
        return ""
    # Remove <...> tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Normalize whitespace and trim
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_quoted_string_after_key(block: str, key: str) -> Optional[str]:
    """Get the first quoted string value that appears after key (e.g. key = 'adrFormatAddress')."""
    # Pattern: key then optional newlines/spaces then "value"
    pattern = rf'"{key}"\s*:\s*"\s*((?:[^"\\]|\\.)*)\s*"'
    m = re.search(pattern, block, re.IGNORECASE | re.DOTALL)
    if m:
        return m.group(1).replace('\\"', '"').strip()
    return None


def extract_display_name_text(block: str) -> Optional[str]:
    """Get displayName.text from block (nested structure)."""
    # After "displayName" we have { "text": "Name" ...
    pattern = r'"displayName"\s*:\s*\{\s*"text"\s*:\s*"([^"]*(?:\\.[^"]*)*)"'
    m = re.search(pattern, block, re.IGNORECASE | re.DOTALL)
    if m:
        return m.group(1).replace('\\"', '"').strip()
    return None


def extract_user_rating_count(block: str) -> Optional[int]:
    """Get userRatingCount (integer); may be missing."""
    pattern = r'"userRatingCount"\s*:\s*(\d+)'
    m = re.search(pattern, block, re.IGNORECASE)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            return None
    return None


def extract_business_status(block: str) -> Optional[str]:
    """Get businessStatus string (e.g. OPERATIONAL)."""
    pattern = r'"businessStatus"\s*:\s*"([^"]*)"'
    m = re.search(pattern, block, re.IGNORECASE)
    return m.group(1).strip() if m else None


def extract_first_quoted_line(block: str) -> Optional[str]:
    """
    For the current block after split on adrFormatAddress, the first line that is
    a quoted string is the adrFormatAddress value (may span or be one line).
    """
    # First quoted string in this block (value of adrFormatAddress)
    m = re.match(r'\s*"((?:[^"\\]|\\.)*)"', block)
    if m:
        return m.group(1).replace('\\"', '"').strip()
    return None


def extract_short_formatted_address(block: str) -> Optional[str]:
    """Get shortFormattedAddress value."""
    return extract_quoted_string_after_key(block, "shortFormattedAddress")


def extract_city_from_address(adr: str, short_adr: str) -> str:
    """
    Extract city: Madrid or San Sebastián de los Reyes.
    Prefer locality from HTML in adr, else infer from shortFormattedAddress.
    """
    if not adr and not short_adr:
        return ""
    text = (adr or "") + " " + (short_adr or "")
    if "San Sebastián de los Reyes" in text or "San Sebastian de los Reyes" in text:
        return "San Sebastián de los Reyes"
    if "Madrid" in text:
        return "Madrid"
    # Other localities (e.g. Fuenlabrada, Rivas-Vaciamadrid) — keep as-is from short address
    if short_adr:
        # shortFormattedAddress often ends with ", Madrid" or ", San Sebastián de los Reyes" or ", Fuenlabrada"
        for city in ["San Sebastián de los Reyes", "San Sebastian de los Reyes", "Madrid", "Fuenlabrada", "Rivas-Vaciamadrid"]:
            if city in short_adr:
                return city
    return ""


def parse_one_block(block: str) -> Optional[dict]:
    """
    Parse one record block into a flat dict with keys:
    business_name, address, short_address, city, rating_count, business_status.
    """
    # Address: first quoted string in block is adrFormatAddress value
    raw_address = extract_first_quoted_line(block)
    short_address = extract_short_formatted_address(block)
    address = strip_html(raw_address) if raw_address else ""

    business_name = extract_display_name_text(block)
    if not business_name:
        return None  # skip entries without name

    rating_count = extract_user_rating_count(block)
    business_status = extract_business_status(block)
    city = extract_city_from_address(raw_address or "", short_address or "")

    return {
        "business_name": business_name,
        "address": address,
        "short_address": short_address or "",
        "city": city,
        "rating_count": rating_count if rating_count is not None else 0,
        "business_status": business_status or "",
    }


# ---------------------------------------------------------------------------
# 3. CLEAN DATA — deduplicate by (name + address)
# ---------------------------------------------------------------------------

def deduplicate(rows: list[dict]) -> list[dict]:
    """Remove duplicates based on (business_name, address)."""
    seen = set()
    out = []
    for r in rows:
        key = (r.get("business_name", "").strip().lower(), r.get("address", "").strip().lower())
        if key in seen or (not key[0] and not key[1]):
            continue
        seen.add(key)
        out.append(r)
    return out


# ---------------------------------------------------------------------------
# 4. CATEGORIZE BUSINESS by name keywords
# ---------------------------------------------------------------------------

CATEGORY_KEYWORDS = {
    "hair_barber": ["peluqueria", "peluquería", "peluquero", "barber", "barbería", "barberia", "hair", "cabello", "corte"],
    "esthetic": ["estetica", "estética", "laser", "clínica", "clinica", "beauty", "belleza", "depilacion", "depilación"],
    "nails": ["nails", "uñas", "uñas", "manicura", "pedicura"],
    "spa": ["spa"],
    "restaurant": ["restaurant", "restaurante", "taberna", "cafe", "café", "bar"],
}


def categorize_business(name: str) -> str:
    """
    Classify business based on display name (case-insensitive).
    Returns one of: hair_barber, esthetic, nails, spa, restaurant, other.
    """
    if not name:
        return "other"
    n = name.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in n for kw in keywords):
            return category
    return "other"


# ---------------------------------------------------------------------------
# 5. SCORING SYSTEM
# ---------------------------------------------------------------------------

def compute_priority_score(row: dict) -> int:
    """
    Priority score:
    - +3 if rating_count > 300
    - +2 if rating_count > 100
    - +2 if category is hair_barber, esthetic, nails, spa
    - +1 if business_status is OPERATIONAL
    """
    score = 0
    rc = row.get("rating_count") or 0
    if rc > 300:
        score += 3
    elif rc > 100:
        score += 2
    cat = row.get("category", "other")
    if cat in ("hair_barber", "esthetic", "nails", "spa"):
        score += 2
    if (row.get("business_status") or "").strip().upper() == "OPERATIONAL":
        score += 1
    return score


def priority_level(score: int) -> str:
    """HIGH >= 5, MEDIUM >= 3, else LOW."""
    if score >= 5:
        return "HIGH"
    if score >= 3:
        return "MEDIUM"
    return "LOW"


# ---------------------------------------------------------------------------
# 6. OUTPUT — CSV with required columns, sorted by priority_score DESC
# ---------------------------------------------------------------------------

OUTPUT_COLUMNS = [
    "business_name",
    "category",
    "city",
    "address",
    "short_address",
    "rating_count",
    "business_status",
    "priority_score",
    "priority_level",
]


def build_output_rows(rows: list[dict]) -> list[dict]:
    """Add category, priority_score, priority_level and ensure column order."""
    out = []
    for r in rows:
        r["category"] = categorize_business(r.get("business_name", ""))
        r["priority_score"] = compute_priority_score(r)
        r["priority_level"] = priority_level(r["priority_score"])
        out.append({k: r.get(k, "") for k in OUTPUT_COLUMNS})
    return out


def sort_by_priority(rows: list[dict]) -> list[dict]:
    """Sort by priority_score descending (best leads first)."""
    return sorted(rows, key=lambda x: (-(x.get("priority_score") or 0), x.get("business_name", "")))


def write_csv(path: Path, rows: list[dict]) -> None:
    """Write rows to CSV with UTF-8 BOM for Excel compatibility."""
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
        w.writeheader()
        w.writerows(rows)


def write_csv_with_pandas(path: Path, rows: list[dict]) -> None:
    """Write CSV with pandas (same columns, same order)."""
    df = pd.DataFrame(rows)
    df = df[OUTPUT_COLUMNS]
    df.to_csv(path, index=False, encoding="utf-8-sig")


def write_excel(path: Path, rows: list[dict]) -> None:
    """Write Excel .xlsx with pandas + openpyxl. Requires: pip install pandas openpyxl"""
    import pandas as _pd
    df = _pd.DataFrame(rows)
    df = df[OUTPUT_COLUMNS]
    df.to_excel(path, index=False, engine="openpyxl")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Process Google Places leads into clean CSV.")
    parser.add_argument(
        "file1",
        nargs="?",
        default="leads2.txt",
        help="First input file (default: leads2.txt)",
    )
    parser.add_argument(
        "file2",
        nargs="?",
        default="leads salvate 1.txt",
        help="Second input file (default: leads salvate 1.txt)",
    )
    parser.add_argument(
        "-o", "--output",
        default="leads_clean.xlsx",
        help="Output path: .xlsx (Excel) or .csv (default: leads_clean.xlsx)",
    )
    parser.add_argument(
        "--diagnose",
        action="store_true",
        help="Only count how many businesses are in each file (by 'adrFormatAddress'), then exit.",
    )
    args = parser.parse_args()

    base = Path(__file__).resolve().parent
    file1 = Path(args.file1) if Path(args.file1).is_absolute() else base / args.file1
    file2 = Path(args.file2) if Path(args.file2).is_absolute() else base / args.file2
    if not file2.exists():
        file2 = base.parent / args.file2  # e.g. "leads salvate 1.txt" in parent folder

    if args.diagnose:
        for name, p in [("File 1", file1), ("File 2", file2)]:
            if p.exists():
                c = read_file_content(p)
                n = len(extract_record_blocks(c))
                print(f"{name}: {p.name} -> {n} businesses (1 business = 1 'adrFormatAddress' block)")
            else:
                print(f"{name}: {p} -> not found")
        total = 0
        if file1.exists():
            total += len(extract_record_blocks(read_file_content(file1)))
        if file2.exists():
            total += len(extract_record_blocks(read_file_content(file2)))
        print(f"Total in both files: {total} businesses. (Many lines per file = each business has ~30-40 lines of text.)")
        return

    print("Loading BOTH files and merging into one list...")
    content, n1, n2 = load_and_merge_files(file1, file2)
    blocks = extract_record_blocks(content)
    print(f"Total in one list: {len(blocks)} businesses (all from both files).")
    print("  (Fiecare afacere = 1 bloc cu adrFormatAddress; multe linii in fisiere = fiecare afacere are ~30-40 linii.)")

    rows = []
    for block in blocks:
        row = parse_one_block(block)
        if row:
            rows.append(row)
    print(f"Parsed {len(rows)} valid entries.")

    rows = deduplicate(rows)
    print(f"After deduplication: {len(rows)} entries.")

    rows = build_output_rows(rows)
    rows = sort_by_priority(rows)

    out_path = base / args.output
    suffix = out_path.suffix.lower()
    if suffix in (".xlsx", ".xls"):
        try:
            write_excel(out_path, rows)
            print(f"Written {len(rows)} leads to Excel: {out_path}")
        except Exception as e:
            print(f"Excel write failed ({e}). Install: pip install openpyxl")
            fallback = out_path.with_suffix(".csv")
            if HAS_PANDAS:
                write_csv_with_pandas(fallback, rows)
            else:
                write_csv(fallback, rows)
            print(f"Falling back to CSV: {fallback} ({len(rows)} leads)")
    else:
        if HAS_PANDAS:
            write_csv_with_pandas(out_path, rows)
        else:
            write_csv(out_path, rows)
        print(f"Written {len(rows)} leads to CSV: {out_path}")
    print("Done.")


if __name__ == "__main__":
    main()
