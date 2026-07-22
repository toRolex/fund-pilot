"""Signal execution service — orchestrates strategy dispatch and result persistence."""

import logging
import sqlite3
from datetime import datetime

from app.db import save_signal_item, save_signal_run
from app.strategies import get_strategy

logger = logging.getLogger(__name__)


def run_signals(
    conn: sqlite3.Connection,
    strategies: list,
    funds: list,
    fund_prices: dict,
) -> dict[str, int]:
    """Execute all strategies against fund prices and persist results to DB.

    multi_fund strategies (momentum) receive the full ``fund_prices`` dict at
    once; per-fund strategies are invoked once per fund.

    Returns ``{strategy_name: signal_count}``.
    """
    results = {}
    for sm in strategies:
        now = datetime.now().isoformat()
        run_id = save_signal_run(conn, sm.name, now)
        fn = get_strategy(sm.name)
        item_count = 0

        # Collect (signal, fund_code) pairs from the appropriate dispatch path
        pairs: list = []
        if getattr(fn, "multi_fund", False):
            if fund_prices:
                try:
                    for s in fn(fund_prices):
                        pairs.append((s, s.fund_code or ""))
                except Exception as e:
                    logger.warning("Strategy %s failed (multi-fund): %s", sm.name, e)
        else:
            for fund in funds:
                price_df = fund_prices.get(fund.code)
                if price_df is None:
                    continue
                try:
                    for s in fn(price_df):
                        pairs.append((s, fund.code))
                except Exception as e:
                    logger.warning("Strategy %s failed for fund %s: %s", sm.name, fund.code, e)

        # Unified persist loop
        for s, code in pairs:
            if not code:
                continue
            save_signal_item(
                conn, run_id, code,
                s.signal_type.value, s.confidence, s.detail, s.date,
            )
            item_count += 1

        results[sm.name] = item_count

    return results
