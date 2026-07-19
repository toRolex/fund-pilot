from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles

import xalpha as xa

from app.data import load_fund_price
from app.models import AddFundRequest, Fund, SearchResult, SignalResponse, StrategyToggleRequest, SystemStatus
from app.scheduler import get_cache, start as start_scheduler, stop as stop_scheduler
from app.strategies import get_logs, get_strategy, list_strategies, toggle_enabled
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
    if not q.strip():
        return []
    results: dict[str, SearchResult] = {}
    watched_codes = {f.code for f in watchlist.list_all()}

    # Try xalpha for exact code lookup
    code = q.strip()
    if code.isdigit():
        try:
            fi = xa.fundinfo(code)
            name = getattr(fi, "name", "") or ""
            results[code] = SearchResult(
                code=code, name=name, is_watched=code in watched_codes
            )
        except Exception:
            pass

    # Search watchlist for partial matches (code + name)
    for fund in watchlist.search(q):
        if fund.code in results:
            results[fund.code].is_watched = True
        else:
            results[fund.code] = SearchResult(
                code=fund.code, name=fund.name, type=fund.type, is_watched=True
            )

    # ponytail: xalpha for exact code only; name-based all-fund search needs a
    # broader source (e.g., fund list API) if watchlist-only is too narrow
    return list(results.values())[:10]


@api.get("/strategies")
async def get_strategies():
    """List all registered strategy plugins with metadata."""
    return list_strategies()


@api.put("/strategies/{name}")
async def update_strategy(name: str, body: StrategyToggleRequest):
    """Enable or disable a strategy."""
    try:
        return toggle_enabled(name, body.enabled)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@api.get("/strategies/logs")
async def get_strategy_logs(limit: int = 50):
    """Get recent strategy engine log entries."""
    return get_logs(limit=limit)


@api.get("/status")
async def get_status():
    """System status: last update, running strategies, watched funds, connection."""
    cache = get_cache()
    last_update = cache.get("last_update")
    watchlist = WatchlistService()
    return SystemStatus(
        last_update=last_update.isoformat() if last_update else None,
        strategies_running=len(list_strategies()),
        funds_watched=len(watchlist.list_all()),
        connected=True,
    )
>>>>>>> feature/14-refresh-statusbar


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
@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(lifespan=lifespan)
app.mount("/api", api)

# SPA static files — frontend build output, fallback to index.html
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
frontend_dist.mkdir(parents=True, exist_ok=True)
app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="spa")
