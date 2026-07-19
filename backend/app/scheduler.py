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
    """Run all strategies against every watchlisted fund, update *cache* in-place."""
    watchlist = WatchlistService()
    funds = watchlist.list_all()
    strategies = list_strategies()

    signals: list[SignalResponse] = []

    for fund in funds:
        # ponytail: sequential fund processing, parallelize with asyncio if latency matters
        price_df = load_fund_price(fund.code)

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
