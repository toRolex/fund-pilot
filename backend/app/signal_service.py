"""Signal execution service — orchestrates strategy dispatch and result persistence."""

import sqlite3
from datetime import datetime

from app.db import save_signal_item, save_signal_run
from app.strategies import get_strategy


def run_signals(
    conn: sqlite3.Connection,
    strategies: list,
    funds: list,
    fund_prices: dict,
) -> dict[str, int]:
    """Execute all strategies against fund prices and persist results to DB.

    multi_fund strategies (momentum) receive all fund prices at once;
    per-fund strategies iterate each fund individually.

    Returns ``{strategy_name: signal_count}``.
    """
    results = {}
    for sm in strategies:
        now = datetime.now().isoformat()
        run_id = save_signal_run(conn, sm.name, now)
        fn = get_strategy(sm.name)
        item_count = 0

        if getattr(fn, "multi_fund", False):
            if not fund_prices:
                results[sm.name] = 0
                continue
            try:
                signals = fn(fund_prices)
            except Exception:
                results[sm.name] = 0
                continue
            for s in signals:
                code = s.fund_code or ""
                if not code:
                    continue
                save_signal_item(
                    conn, run_id, code,
                    s.signal_type.value, s.confidence, s.detail, s.date,
                )
                item_count += 1
        else:
            for fund in funds:
                price_df = fund_prices.get(fund.code)
                if price_df is None:
                    continue
                try:
                    signals = fn(price_df)
                except Exception:
                    continue
                for s in signals:
                    save_signal_item(
                        conn, run_id, fund.code,
                        s.signal_type.value, s.confidence, s.detail, s.date,
                    )
                    item_count += 1

        results[sm.name] = item_count

    return results
