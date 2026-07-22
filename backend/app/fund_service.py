"""Fund data enrichment — pure helpers shared by route handlers.

Extracted from main.py to eliminate duplicated daily-change and P&L math.
All functions are side-effect free; callers own I/O and DB access.
"""
import math

import pandas as pd

from app.models import SignalResponse, SignalType


def compute_daily_change(prices: pd.DataFrame) -> float:
    """Return the percent change between the latest two NAV values.

    Returns 0.0 for empty, single-row, NaN, or zero-prev-NAV inputs.
    Output is rounded to 2 decimals to match the previous inlined math.
    """
    if prices is None or len(prices) < 2:
        return 0.0
    sorted_prices = prices.sort_values("date")
    latest = float(sorted_prices.iloc[-1]["netvalue"])
    prev = float(sorted_prices.iloc[-2]["netvalue"])
    if prev == 0 or math.isnan(latest) or math.isnan(prev):
        return 0.0
    return round((latest - prev) / prev * 100, 2)


def enrich_signal(row: dict, fund_name: str, prices: pd.DataFrame) -> SignalResponse:
    """Build a SignalResponse from a DB row, enriched with fund name + daily change."""
    return SignalResponse(
        date=row.get("date") or row.get("detail") or "",
        fund_code=row["fund_code"],
        fund_name=fund_name,
        strategy_name=row["strategy"],
        signal_type=SignalType(row["signal"]),
        confidence=row.get("value") or 0.0,
        daily_change=compute_daily_change(prices),
    )


def compute_holding_pl(holding) -> dict:
    """Return cost_basis, pl_amount, pl_percent for a holding."""
    cost_basis = holding.shares * holding.cost_price
    current_total = holding.shares * holding.current_value
    pl_amount = current_total - cost_basis
    pl_percent = (pl_amount / cost_basis * 100) if cost_basis > 0 else 0.0
    return {
        "cost_basis": round(cost_basis, 4),
        "pl_amount": round(pl_amount, 4),
        "pl_percent": round(pl_percent, 4),
    }
