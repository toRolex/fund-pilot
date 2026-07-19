from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.staticfiles import StaticFiles

import xalpha as xa

from app.data import load_fund_price
from app.holdings import HoldingsService
from app.models import (
    AddFundRequest,
    Fund,
    Holding,
    HoldingResponse,
    SearchResult,
    SignalResponse,
    SignalType,
)
from app.strategies import get_strategy, list_strategies
from app.watchlist import WatchlistService

# API sub-app
api = FastAPI(title="Fund Signal API")

watchlist = WatchlistService()
holdings_service = HoldingsService()


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


@api.get("/holdings")
async def list_holdings():
    """List current holdings with calculated P&L and signal enrichment."""
    holdings = holdings_service.list_all()
    if not holdings:
        return []

    # ponytail: sequential signal computation per fund, parallelize if latency matters
    active_codes = _compute_holdings_signal_codes(holdings)

    result = []
    for h in holdings:
        cost_basis = h.shares * h.cost_price
        current_total = h.shares * h.current_value
        pl_amount = current_total - cost_basis
        pl_percent = (pl_amount / cost_basis * 100) if cost_basis > 0 else 0.0

        result.append(HoldingResponse(
            fund_code=h.fund_code,
            fund_name=h.fund_name,
            shares=h.shares,
            cost_price=h.cost_price,
            current_value=h.current_value,
            cost_basis=round(cost_basis, 4),
            pl_amount=round(pl_amount, 4),
            pl_percent=round(pl_percent, 4),
            has_signal=h.fund_code in active_codes,
        ))

    return result


def _compute_holdings_signal_codes(holdings: list[Holding]) -> set[str]:
    """Run strategies and return set of fund codes that have buy/sell signals."""
    active: set[str] = set()
    strategies = list_strategies()
    if not strategies:
        return active

    for h in holdings:
        try:
            price_df = load_fund_price(h.fund_code)
        except Exception:
            continue

        for sm in strategies:
            fn = get_strategy(sm.name)
            try:
                signals = fn(price_df)
            except Exception:
                continue
            for s in signals:
                if s.signal_type in (SignalType.buy, SignalType.sell):
                    active.add(h.fund_code)
                    break
            if h.fund_code in active:
                break

    return active


@api.post("/holdings/import")
async def import_holdings(request: Request):
    """Import holdings from CSV file upload or JSON body."""
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        body = await request.json()
        if isinstance(body, dict):
            body = body.get("holdings", body)
        if not isinstance(body, list):
            raise HTTPException(status_code=422, detail="JSON body must be an array or {holdings: [...]}")
        try:
            holdings = [Holding(**item) for item in body]
        except (ValueError, TypeError) as e:
            raise HTTPException(status_code=422, detail=f"Invalid holding data: {e}")
    elif "multipart/form-data" in content_type:
        form = await request.form()
        file = form.get("file")
        if not file:
            raise HTTPException(status_code=422, detail="CSV file required in 'file' field")
        content = await file.read()
        try:
            holdings = HoldingsService.parse_csv(content.decode("utf-8"))
        except (ValueError, KeyError) as e:
            raise HTTPException(status_code=422, detail=f"Invalid CSV: {e}")
    else:
        raise HTTPException(status_code=422, detail="Unsupported content type, use application/json or multipart/form-data")

    if not holdings:
        raise HTTPException(status_code=422, detail="No holdings data provided")

    holdings_service.import_holdings(holdings)
    return {"imported": len(holdings)}


# Main app — mounts API and SPA
app = FastAPI()
app.mount("/api", api)

# SPA static files — frontend build output, fallback to index.html
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
frontend_dist.mkdir(parents=True, exist_ok=True)
app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="spa")
