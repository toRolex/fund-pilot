from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles

import xalpha as xa

from app.data import load_fund_price
from app.models import AddFundRequest, Fund, SignalResponse
from app.strategies import get_strategy, list_strategies
from app.watchlist import WatchlistService

# API sub-app
api = FastAPI(title="Fund Signal API")

watchlist = WatchlistService()


@api.get("/health")
async def health():
    return {"status": "ok"}


@api.get("/funds")
async def list_funds(
    sort_by: str = Query("code"),
    sort_dir: str = Query("asc"),
):
    if sort_by not in ("code", "name"):
        sort_by = "code"
    if sort_dir not in ("asc", "desc"):
        sort_dir = "asc"
    funds = watchlist.list_all()
    reverse = sort_dir == "desc"
    return sorted(funds, key=lambda f: getattr(f, sort_by), reverse=reverse)


@api.post("/funds", status_code=201)
async def add_fund(body: AddFundRequest):
    # ponytail: single xa.mfund call, add retry/circuit-breaker if network flakiness matters
    try:
        info = xa.mfund(body.code).info
    except Exception:
        raise HTTPException(status_code=422, detail=f"Invalid fund code: {body.code}")
    try:
        fund = watchlist.add(body.code, info.get("name", ""))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return fund


@api.delete("/funds/{code}")
async def remove_fund(code: str):
    try:
        fund = watchlist.remove(code)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return fund


@api.get("/funds/search")
async def search_funds(q: str = ""):
    return watchlist.search(q)


@api.get("/strategies")
async def get_strategies():
    """List all registered strategy plugins with metadata."""
    return list_strategies()


@api.get("/signals")
async def get_signals(code: Optional[str] = Query(None)):
    """Run all strategies against watchlist funds and return signals.

    Returns flat list[SignalResponse] sorted by (date, fund_code).
    Optional ?code= filter to target a single fund.
    """
    funds = watchlist.list_all()
    if code:
        funds = [f for f in funds if f.code == code]
        if not funds:
            return []

    signals: list[SignalResponse] = []
    strategies = list_strategies()

    for fund in funds:
        # ponytail: sequential fund processing, parallelize with asyncio if latency matters
        price_df = load_fund_price(fund.code)

        # Compute daily change from latest 2 NAV values
        daily_change = 0.0
        if len(price_df) >= 2:
            sorted_price = price_df.sort_values("date")
            daily_change = round(
                (sorted_price.iloc[-1]["netvalue"] - sorted_price.iloc[-2]["netvalue"])
                / sorted_price.iloc[-2]["netvalue"] * 100,
                2,
            )

        for sm in strategies:
            fn = get_strategy(sm.name)
            # ponytail: strategy errors propagate per AC — no try/except here
            result = fn(price_df)
            for s in result:
                s.fund_code = fund.code
                signals.append(SignalResponse(
                    date=s.date,
                    fund_code=fund.code,
                    fund_name=fund.name,
                    strategy_name=s.strategy_name,
                    signal_type=s.signal_type,
                    confidence=s.confidence,
                    daily_change=daily_change,
                ))

    signals.sort(key=lambda s: (s.date, s.fund_code))
    return signals


# Main app — mounts API and SPA
app = FastAPI()
app.mount("/api", api)

# SPA static files — frontend build output, fallback to index.html
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
frontend_dist.mkdir(parents=True, exist_ok=True)
app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="spa")
