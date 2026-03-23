#!/usr/bin/env python3
"""
1. Curata duplicatele din 'leads diferite.xlsm'
2. Incarca cele ~92 lead-uri din leads_clean.csv
3. Le adauga la xlsm (fara duplicate intre cele doua surse)
4. Salveaza rezultatul in leads_final.xlsx
"""

import pandas as pd
from pathlib import Path


def normalize_key(name, address) -> tuple:
    """Cheie pentru deduplicare: nume + adresa normalizate."""
    n = ("" if pd.isna(name) else str(name)).strip().lower()
    a = ("" if pd.isna(address) else str(address)).strip().lower()
    return (n, a)


def load_xlsm(path: Path) -> pd.DataFrame:
    """Incarca primul sheet din .xlsm."""
    df = pd.read_excel(path, engine="openpyxl", sheet_name=0)
    df.columns = [str(c).strip() for c in df.columns]
    return df


def deduplicate_df(df: pd.DataFrame, name_col: str, address_col: str) -> pd.DataFrame:
    """Elimina duplicate dupa (name, address), pastreaza prima aparitie."""
    if name_col not in df.columns or address_col not in df.columns:
        return df
    seen = set()
    indices = []
    for i, row in df.iterrows():
        key = normalize_key(
            row.get(name_col, ""),
            row.get(address_col, ""),
        )
        if not key[0] and not key[1]:
            continue
        if key in seen:
            continue
        seen.add(key)
        indices.append(i)
    return df.loc[indices].reset_index(drop=True)


def main():
    base = Path(__file__).resolve().parent
    xlsm_path = base / "leads diferite.xlsm"
    csv_path = base / "leads_clean.csv"
    out_path = base / "leads_final.xlsx"

    if not xlsm_path.exists():
        print(f"Lipsa: {xlsm_path}")
        return
    if not csv_path.exists():
        print(f"Lipsa: {csv_path}. Ruleaza mai intai: python process_places_leads.py")
        return

    # Coloane in xlsm (din inspect)
    name_xlsm = "Name"
    address_xlsm = "Address"
    city_xlsm = "City"

    # 1) Incarca xlsm si curata duplicate
    df_xlsm = load_xlsm(xlsm_path)
    n_before = len(df_xlsm)
    df_xlsm = deduplicate_df(df_xlsm, name_xlsm, address_xlsm)
    n_after_xlsm = len(df_xlsm)
    print(f"leads diferite.xlsm: {n_before} randuri -> dupa deduplicare: {n_after_xlsm}")

    # 2) Incarca lead-urile din CSV (cele 92)
    df_csv = pd.read_csv(csv_path, encoding="utf-8-sig")
    # Mapeaza la schema xlsm: Name, City, Address, Rating, Reviews, etc.
    # xlsm are: #, Name, City, Phone, Website, AutoScore, WebScore, Rating, Reviews, Detected At, Address, Maps URL, Analysis
    df_new = pd.DataFrame()
    for col in df_xlsm.columns:
        df_new[col] = None

    # Mapari: CSV -> coloane xlsm
    df_new[name_xlsm] = df_csv["business_name"].values
    df_new[city_xlsm] = df_csv["city"].values
    df_new[address_xlsm] = df_csv["short_address"].values  # sau "address"
    if "Reviews" in df_new.columns:
        df_new["Reviews"] = df_csv["rating_count"].values
    if "Rating" in df_new.columns:
        df_new["Rating"] = None  # CSV nu are rating, doar count
    # Coloane extra din CSV pe care le putem pune in Analysis sau ca coloane noi
    df_new["category"] = df_csv["category"].values
    df_new["priority_score"] = df_csv["priority_score"].values
    df_new["priority_level"] = df_csv["priority_level"].values
    df_new["business_status"] = df_csv["business_status"].values

    # 3) Evita duplicate: nu adauga un rand din CSV daca (Name, Address) exista deja in xlsm
    existing_keys = {
        normalize_key(row[name_xlsm], row[address_xlsm])
        for _, row in df_xlsm.iterrows()
    }
    to_append = []
    for i, row in df_new.iterrows():
        key = normalize_key(row[name_xlsm], row[address_xlsm])
        if key in existing_keys:
            continue
        existing_keys.add(key)
        to_append.append(row)

    df_append = pd.DataFrame(to_append) if to_append else pd.DataFrame(columns=df_xlsm.columns)
    added = len(df_append)
    print(f"Din leads_clean.csv: {len(df_csv)} lead-uri; adaugate (fara duplicate): {added}")

    # 4) Concateneaza si salveaza
    df_final = pd.concat([df_xlsm, df_append], ignore_index=True)
    # Rededuplicare la final (per siguranta)
    df_final = deduplicate_df(df_final, name_xlsm, address_xlsm)
    print(f"Total final (fara duplicate): {len(df_final)} randuri -> {out_path}")

    df_final.to_excel(out_path, index=False, engine="openpyxl")
    print("Gata.")


if __name__ == "__main__":
    main()
