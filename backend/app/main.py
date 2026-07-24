from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.staticfiles import StaticFiles

import xalpha as xa

from app.data import get_fund_info, load_all_prices, load_fund_price
from app.db import get_connection as get_db_connection, init_db, query_signals
from app.fund_service import compute_daily_change, compute_holding_pl
from app.holdings import HoldingsService
from app.models import AddFundRequest, BacktestRequest, Fund, FundDetail, FundDetailResponse, Holding, HoldingResponse, NavPoint, QdiiPredictResponse, SearchResult, SignalResponse, SignalType, StrategyState, StrategyToggleRequest, SystemStatus, WatchlistFund
from app.scheduler import get_cache, start as start_scheduler, stop as stop_scheduler
from app.strategies import get_fund_enabled_strategies, get_logs, get_strategy, list_strategies, toggle_enabled, toggle_fund_strategy
from app.watchlist import WatchlistService

import app.backtest as backtest

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

    # Build enriched response with signal data
    strategies = list_strategies()
    enriched: list[WatchlistFund] = []
    for fund in funds:
        wf = WatchlistFund(code=fund.code, name=fund.name, type=fund.type)
        try:
            price_df = load_fund_price(fund.code)
        except Exception:
            enriched.append(wf)
            continue

        # Daily change from latest 2 NAV values
        wf.daily_change = compute_daily_change(price_df)

        # Run strategies to find latest signal
        for sm in strategies:
            fn = get_strategy(sm.name)
            try:
                result = fn(price_df)
            except Exception:
                continue
            if result:
                # Use the most recent signal from this strategy
                latest = max(result, key=lambda s: s.date)
                wf.signal_type = latest.signal_type
                wf.strategy_name = latest.strategy_name
                wf.confidence = latest.confidence
                if latest.signal_type != SignalType.hold:
                    break  # prefer buy/sell over hold

        enriched.append(wf)

    return sorted(enriched, key=lambda f: getattr(f, sort_by), reverse=reverse)


@api.post("/funds", status_code=201)
async def add_fund(body: AddFundRequest):
    # ponytail: get_fund_info with _INFO_CACHE, add retry/circuit-breaker if network flakiness matters
    name = ""
    try:
        info = get_fund_info(body.code)
        name = info.get("name", "")
    except Exception:
        pass

    if not name:
        raise HTTPException(status_code=422, detail=f"Invalid fund code: {body.code}")
    try:
        fund = watchlist.add(body.code, name)
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
            info = get_fund_info(code)
            name = info.get("name", "")
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


@api.get("/signals")
async def get_signals(
    fund_code: Optional[str] = Query(None),
    run_id: Optional[int] = Query(None),
    strategy: Optional[str] = Query(None),
):
    """Read signals from SQLite, enriched with fund name and daily change.

    Optional filters: ?fund_code=, ?run_id=, ?strategy=
    Default: returns only the latest run's signals.
    """
    conn = get_db_connection()
    init_db(conn)
    rows = query_signals(conn, fund_code=fund_code, run_id=run_id, strategy=strategy)
    conn.close()

    if not rows:
        return []

    funds_map = {f.code: f for f in watchlist.list_all()}
    signals: list[SignalResponse] = []

    for row in rows:
        fund = funds_map.get(row["fund_code"])
        fund_name = fund.name if fund else ""

        daily_change = 0.0
        if fund:
            try:
                price_df = load_fund_price(fund.code)
                daily_change = compute_daily_change(price_df)
            except Exception:
                pass

        signals.append(SignalResponse(
            date=row["date"] or row["detail"] or "",
            fund_code=row["fund_code"],
            fund_name=fund_name,
            strategy_name=row["strategy"],
            signal_type=SignalType(row["signal"]),
            confidence=row["value"] or 0.0,
            daily_change=daily_change,
        ))

    return signals


@api.post("/signals/run")
async def run_signals():
    """Run all strategies against watchlist funds and persist results to SQLite."""
    from app.signal_service import run_signals as execute_signals

    conn = get_db_connection()
    init_db(conn)
    funds = watchlist.list_all()
    strategies_list = list_strategies()

    # Pre-load all fund prices once for multi-fund strategies
    fund_prices = load_all_prices(funds)

    runs = execute_signals(conn, strategies_list, funds, fund_prices)
    conn.close()
    return {
        "status": "completed",
        "runs": [{"strategy": k, "signal_count": v, "status": "completed"} for k, v in runs.items()],
    }


@api.get("/funds/{code}")
async def get_fund_detail(code: str):
    """Fund detail with meta info, latest NAV, and daily change."""
    fund = watchlist.get(code)
    if not fund:
        raise HTTPException(status_code=404, detail=f"Fund {code} not found")

    # ponytail: get_fund_info with _INFO_CACHE, add retry/circuit-breaker if network flakiness matters
    try:
        info = get_fund_info(code)
    except Exception:
        info = {}

    price_df = load_fund_price(code)

    latest_nav = 0.0
    latest_nav_date = None

    if len(price_df) > 0:
        sorted_price = price_df.sort_values("date")
        latest_row = sorted_price.iloc[-1]
        latest_nav = round(float(latest_row["netvalue"]), 4)
        raw_date = latest_row["date"]
        latest_nav_date = raw_date.strftime("%Y-%m-%d") if hasattr(raw_date, "strftime") else str(raw_date)

    daily_change = compute_daily_change(price_df)

    return FundDetail(
        code=fund.code,
        name=fund.name,
        type=info.get("fund_type", fund.type or ""),
        scale=info.get("fund_scale"),
        established_date=info.get("established_date"),
        latest_nav=latest_nav,
        latest_nav_date=latest_nav_date,
        daily_change=daily_change,
    )


@api.get("/funds/{code}/detail")
async def get_fund_detail_merged(code: str):
    """Aggregated fund detail: meta, NAV, signals, strategies — one request."""
    fund = watchlist.get(code)
    if not fund:
        raise HTTPException(status_code=404, detail=f"Fund {code} not found")

    # ponytail: get_fund_info with _INFO_CACHE, add retry/circuit-breaker if network flakiness matters
    try:
        info = get_fund_info(code)
    except Exception:
        info = {}

    price_df = load_fund_price(code)

    # ── detail (FundDetail) ──
    latest_nav = 0.0
    latest_nav_date = None
    if len(price_df) > 0:
        sorted_price = price_df.sort_values("date")
        latest_row = sorted_price.iloc[-1]
        latest_nav = round(float(latest_row["netvalue"]), 4)
        raw_date = latest_row["date"]
        latest_nav_date = raw_date.strftime("%Y-%m-%d") if hasattr(raw_date, "strftime") else str(raw_date)
    daily_change = compute_daily_change(price_df)

    detail = FundDetail(
        code=fund.code,
        name=fund.name,
        type=info.get("fund_type", fund.type or ""),
        scale=info.get("fund_scale"),
        established_date=info.get("established_date"),
        latest_nav=latest_nav,
        latest_nav_date=latest_nav_date,
        daily_change=daily_change,
    )

    # ── nav (NavPoint[]) ──
    sorted_price = price_df.sort_values("date")
    nav: list[NavPoint] = []
    for _, row in sorted_price.iterrows():
        raw_date = row["date"]
        date_str = raw_date.strftime("%Y-%m-%d") if hasattr(raw_date, "strftime") else str(raw_date)
        nav.append(NavPoint(date=date_str, netvalue=round(float(row["netvalue"]), 4)))

    # ── signals (SignalResponse[]) ──
    signals: list[SignalResponse] = []
    enabled = get_fund_enabled_strategies(code)
    for sm in list_strategies():
        if not enabled.get(sm.name, True):
            continue
        fn = get_strategy(sm.name)
        # ponytail: multi-fund strategies are bulk-only; skip in per-fund endpoint
        if getattr(fn, "multi_fund", False):
            continue
        result = fn(price_df)
        for s in result:
            signals.append(SignalResponse(
                date=s.date,
                fund_code=fund.code,
                fund_name=fund.name,
                strategy_name=s.strategy_name,
                signal_type=s.signal_type,
                confidence=s.confidence,
                daily_change=daily_change,
            ))
    signals.sort(key=lambda s: s.date)

    # ── strategies (StrategyState[]) ──
    enabled_map = get_fund_enabled_strategies(code)
    strategies = [
        StrategyState(
            name=sm.name,
            description=sm.description,
            enabled=enabled_map.get(sm.name, True),
        )
        for sm in list_strategies()
    ]

    return FundDetailResponse(detail=detail, nav=nav, signals=signals, strategies=strategies)


@api.get("/funds/{code}/signals")
async def get_fund_signals(code: str):
    """Historical signals for a specific fund."""
    fund = watchlist.get(code)
    if not fund:
        raise HTTPException(status_code=404, detail=f"Fund {code} not found")

    price_df = load_fund_price(code)
    daily_change = compute_daily_change(price_df)

    signals: list[SignalResponse] = []
    enabled = get_fund_enabled_strategies(code)
    for sm in list_strategies():
        if not enabled.get(sm.name, True):
            continue
        fn = get_strategy(sm.name)
        # ponytail: multi-fund strategies are bulk-only; skip in per-fund endpoint
        if getattr(fn, "multi_fund", False):
            continue
        result = fn(price_df)
        for s in result:
            signals.append(SignalResponse(
                date=s.date,
                fund_code=fund.code,
                fund_name=fund.name,
                strategy_name=s.strategy_name,
                signal_type=s.signal_type,
                confidence=s.confidence,
                daily_change=daily_change,
            ))

    signals.sort(key=lambda s: s.date)
    return signals


@api.get("/funds/{code}/nav")
async def get_fund_nav(code: str):
    """NAV time series data for charting."""
    fund = watchlist.get(code)
    if not fund:
        raise HTTPException(status_code=404, detail=f"Fund {code} not found")

    price_df = load_fund_price(code)
    sorted_price = price_df.sort_values("date")

    points = []
    for _, row in sorted_price.iterrows():
        raw_date = row["date"]
        date_str = raw_date.strftime("%Y-%m-%d") if hasattr(raw_date, "strftime") else str(raw_date)
        points.append(NavPoint(date=date_str, netvalue=round(float(row["netvalue"]), 4)))

    return points


@api.get("/funds/{code}/strategies")
async def get_fund_strategies(code: str):
    """List all strategies with enabled/disabled state for this fund."""
    fund = watchlist.get(code)
    if not fund:
        raise HTTPException(status_code=404, detail=f"Fund {code} not found")

    enabled_map = get_fund_enabled_strategies(code)
    return [
        StrategyState(
            name=sm.name,
            description=sm.description,
            enabled=enabled_map.get(sm.name, True),
        )
        for sm in list_strategies()
    ]


@api.put("/funds/{code}/strategies/{strategy_name}")
async def fund_strategy_toggle(code: str, strategy_name: str):
    """Toggle a strategy on/off for a fund."""
    fund = watchlist.get(code)
    if not fund:
        raise HTTPException(status_code=404, detail=f"Fund {code} not found")
    try:
        enabled = toggle_fund_strategy(code, strategy_name)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Strategy '{strategy_name}' not found")
    return {"name": strategy_name, "enabled": enabled}


@api.get("/qdii/{code}")
async def get_qdii_predict(code: str):
    """QDII fund T-1/T-0 real-time NAV prediction."""
    try:
        qdii = xa.QDIIPredict(code)
        t1_value, t1_date = qdii.get_t1(return_date=True)
        t0_value, t0_date = qdii.get_t0(return_date=True)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return QdiiPredictResponse(
        code=code,
        t1_value=t1_value,
        t1_date=t1_date,
        t0_value=t0_value,
        t0_date=t0_date,
    )


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
        pl = compute_holding_pl(h)
        result.append(HoldingResponse(
            fund_code=h.fund_code,
            fund_name=h.fund_name,
            shares=h.shares,
            cost_price=h.cost_price,
            current_value=h.current_value,
            **pl,
            has_signal=h.fund_code in active_codes,
        ))

    return result


@api.post("/holdings", status_code=201)
async def create_holding(body: Holding):
    """Add a single holding."""
    try:
        return holdings_service.add(body)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@api.put("/holdings/{code}")
async def update_holding(code: str, body: dict):
    """Update a holding's fields."""
    try:
        return holdings_service.update(code, body)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@api.delete("/holdings/{code}")
async def delete_holding(code: str):
    """Delete a holding."""
    try:
        holdings_service.delete(code)
        return {"status": "deleted"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


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
    # Auto-refresh prices after import
    holdings_service.refresh_prices()
    return {"imported": len(holdings)}


@api.post("/backtest")
async def run_backtest(body: BacktestRequest):
    """Run a backtest for a fund using the given strategy."""
    fund = watchlist.get(body.fund_code)
    if not fund:
        raise HTTPException(status_code=404, detail=f"Fund {body.fund_code} not found in watchlist")

    try:
        strategy_fn = get_strategy(body.strategy)
    except KeyError:
        raise HTTPException(status_code=422, detail=f"Strategy '{body.strategy}' not found")

    if body.start_date and body.end_date and body.start_date > body.end_date:
        raise HTTPException(status_code=422, detail="start_date must be <= end_date")

    try:
        price_df = load_fund_price(body.fund_code)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return backtest.run_backtest(
        price_df=price_df,
        strategy_fn=strategy_fn,
        params=body.params,
        start_date=body.start_date,
        end_date=body.end_date,
        initial_capital=body.initial_capital,
    )


@api.post("/holdings/refresh")
async def refresh_holdings():
    """Refresh current_value for all holdings from latest NAV."""
    holdings_service.refresh_prices()
    return await list_holdings()


# Main app — mounts API and SPA
@asynccontextmanager
async def lifespan(app: FastAPI):
    conn = get_db_connection()
    init_db(conn)
    conn.close()
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(lifespan=lifespan)
app.mount("/api", api)

# SPA static files — frontend build output, fallback to index.html
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
frontend_dist.mkdir(parents=True, exist_ok=True)
app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="spa")
