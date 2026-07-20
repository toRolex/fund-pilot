"""APScheduler periodic refresh — signal cache and trading session detection.

Schedules a 5-minute refresh of all fund signals during A-share trading hours.
Cache is stored in a module-level dict, consumed by the /api/status endpoint.
"""

from datetime import datetime, time, timezone, timedelta
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.data import load_fund_price
from app.models import SignalResponse
from app.strategies import get_strategy, list_strategies
from app.watchlist import WatchlistService

# ponytail: module-level cache, per-instance segregation if multi-app needed
_cache: dict = {"last_update": None}
_scheduler: Optional[BackgroundScheduler] = None

# China Standard Time (UTC+8)
_CST = timezone(timedelta(hours=8))


def is_trading_time(dt: Optional[datetime] = None) -> bool:
    """Return True if *dt* falls within A-share trading hours.

    Trading sessions (CST):  9:30-11:30  and  13:00-15:00, weekdays only.
    Pass an explicit *dt* for testing; defaults to datetime.now().
    """
    if dt is None:
        dt = datetime.now()
    if dt.weekday() >= 5:  # Saturday / Sunday
        return False
    t = dt.time()
    return (time(9, 30) <= t < time(11, 30)) or (time(13, 0) <= t < time(15, 0))


def get_cache() -> dict:
    return dict(_cache)


def refresh_signals():
    """Run all strategies against every watchlisted fund, update cache + SQLite.

    Also refreshes holdings prices before computing signals.
    Persists results to SQLite so GET /api/signals stays in sync.
    """
    from datetime import datetime

    from app.holdings import HoldingsService

    from app.db import get_connection as get_db_connection, init_db, save_signal_item, save_signal_run

    HoldingsService().refresh_prices()

    watchlist = WatchlistService()
    funds = watchlist.list_all()
    strategies = list_strategies()

    signals: list[SignalResponse] = []

    conn = get_db_connection()
    init_db(conn)

    for sm in strategies:
        now = datetime.now().isoformat()
        run_id = save_signal_run(conn, sm.name, now)
        fn = get_strategy(sm.name)

        for fund in funds:
            # ponytail: sequential fund processing, parallelize with asyncio if latency matters
            try:
                price_df = load_fund_price(fund.code)
            except Exception:
                continue

            # ponytail: multi-fund strategies skip per-fund loop
            if getattr(fn, "multi_fund", False):
                continue

            daily_change = 0.0
            if len(price_df) >= 2:
                sorted_price = price_df.sort_values("date")
                daily_change = round(
                    (sorted_price.iloc[-1]["netvalue"] - sorted_price.iloc[-2]["netvalue"])
                    / sorted_price.iloc[-2]["netvalue"] * 100,
                    2,
                )

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
                save_signal_item(
                    conn, run_id, fund.code,
                    s.signal_type.value, s.confidence, s.detail, s.date,
                )

        # Multi-fund strategies (momentum) — pass all fund prices at once
        if getattr(fn, "multi_fund", False):
            fund_prices = {}
            for fund in funds:
                try:
                    fund_prices[fund.code] = load_fund_price(fund.code)
                except Exception:
                    continue
            result = fn(fund_prices)
            for s in result:
                signals.append(SignalResponse(
                    date=s.date,
                    fund_code=s.fund_code,
                    fund_name=next((f.name for f in funds if f.code == s.fund_code), ""),
                    strategy_name=s.strategy_name,
                    signal_type=s.signal_type,
                    confidence=s.confidence,
                    daily_change=0.0,
                ))
                save_signal_item(
                    conn, run_id, s.fund_code,
                    s.signal_type.value, s.confidence, s.detail, s.date,
                )

    conn.close()
    signals.sort(key=lambda s: (s.date, s.fund_code))
    _cache["last_update"] = datetime.now(tz=_CST)
    _cache["signals"] = signals


def _job():
    """Scheduler callback — skip when market is closed, else refresh."""
    if not is_trading_time():
        return
    refresh_signals()


def start():
    """Start the background scheduler (idlpotent — safe to call multiple times)."""
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler()
    trigger = CronTrigger(
        day_of_week="mon-fri",
        hour="9-14",
        minute="*/5",
        timezone="Asia/Shanghai",
    )
    _scheduler.add_job(_job, trigger=trigger, id="refresh_signals")
    _scheduler.start()


def stop():
    """Shut down the background scheduler."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
