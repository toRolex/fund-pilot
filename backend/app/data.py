"""xalpha data loading and local CSV fallback."""
import time
from pathlib import Path
from typing import Any

import pandas as pd
import xalpha as xa

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ponytail: module-level cache, per-account segregation if multi-user needed
_PRICE_CACHE: dict[str, tuple[float, pd.DataFrame]] = {}

# ponytail: module-level info cache, per-account segregation if multi-user needed
_INFO_CACHE: dict[str, tuple[float, dict]] = {}
_INFO_TTL = 3600  # fund metadata changes infrequently


def _get_ttl() -> int:
    """Return cache TTL in seconds: 300 during trading hours, 3600 otherwise."""
    from app.scheduler import is_trading_time

    return 300 if is_trading_time() else 3600


def _get_cached_or_fetch(code: str) -> pd.DataFrame | None:
    """Return cached DataFrame if within TTL, else None."""
    now = time.time()
    cached = _PRICE_CACHE.get(code)
    if cached is not None:
        ts, df = cached
        if now - ts < _get_ttl():
            return df
    return None


def get_fund_info(code: str) -> dict:
    """Return fund metadata dict (name, type, etc.) using _INFO_CACHE (TTL 3600s)."""
    now = time.time()
    cached = _INFO_CACHE.get(code)
    if cached is not None and now - cached[0] < _INFO_TTL:
        return cached[1]

    fund = xa.fundinfo(code)
    raw = fund.info if isinstance(fund.info, dict) else {}
    raw["name"] = getattr(fund, "name", "")
    _INFO_CACHE[code] = (time.time(), raw)
    return raw


def load_fund_price(code: str) -> pd.DataFrame:
    """Load fund NAV history, return DataFrame with date and netvalue columns.

    Uses _PRICE_CACHE first; falls back to xalpha; then to local CSV.
    Cache is populated on successful xalpha fetch.
    """
    cached = _get_cached_or_fetch(code)
    if cached is not None:
        return cached

    try:
        fund = xa.fundinfo(code)
        df = fund.price
        if "date" in df.columns and "netvalue" in df.columns:
            _PRICE_CACHE[code] = (time.time(), df)
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


def load_all_prices(funds: list[Any]) -> dict[str, pd.DataFrame]:
    """Pre-load fund prices for a list of watchlist funds.

    Returns ``{fund_code: DataFrame}``, skipping any fund whose price
    data fails to load.
    """
    prices: dict[str, pd.DataFrame] = {}
    for fund in funds:
        try:
            prices[fund.code] = load_fund_price(fund.code)
        except Exception:
            continue
    return prices
