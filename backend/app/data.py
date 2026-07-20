"""xalpha data loading and local CSV fallback."""
from pathlib import Path

import pandas as pd
import xalpha as xa

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_fund_price(code: str) -> pd.DataFrame:
    """Load fund NAV history, return DataFrame with date and netvalue columns.

    Tries xalpha first; falls back to local CSV in data/prices/<code>.csv
    when xalpha fails (network unavailable, CSV backend issues, etc.).
    """
    try:
        fund = xa.fundinfo(code)
        df = fund.price
        if "date" in df.columns and "netvalue" in df.columns:
            return df
    except Exception:
        pass

    # Fallback: load from local CSV
    price_path = DATA_DIR / "prices" / f"{code}.csv"
    if price_path.exists():
        df = pd.read_csv(price_path)
        df["date"] = pd.to_datetime(df["date"])
        return df

    raise ValueError(f"Failed to load price data for {code}")
