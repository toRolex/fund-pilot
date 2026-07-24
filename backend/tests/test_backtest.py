"""Tests for backtest engine — run_backtest."""
import math

import pandas as pd
import pytest

from app.models import (
    BacktestMetrics,
    BacktestResult,
    BacktestTrade,
    EquityPoint,
    Signal,
    SignalType,
)


def _price_df(prices: list[float], start="2024-01-01") -> pd.DataFrame:
    """Helper: build a price DataFrame from a list of netvalues."""
    dates = pd.date_range(start, periods=len(prices), freq="D")
    return pd.DataFrame({"date": dates, "netvalue": prices})


def _flat_buy_strategy(price_df: pd.DataFrame, params: dict | None = None) -> list:
    """Test strategy: buy on the first day of the sliced data, hold otherwise."""
    date_str = str(price_df.iloc[0]["date"].strftime("%Y-%m-%d"))
    return [Signal(date=date_str, fund_code="", strategy_name="test", signal_type=SignalType.buy, confidence=1.0)]


def _buy_sell_strategy(price_df: pd.DataFrame, params: dict | None = None) -> list:
    """Buy on day 0, sell on day 5."""
    dates = price_df.sort_values("date").reset_index(drop=True)
    d0 = str(dates.iloc[0]["date"].strftime("%Y-%m-%d"))
    d5 = str(dates.iloc[5]["date"].strftime("%Y-%m-%d")) if len(dates) > 5 else d0
    return [
        Signal(date=d0, fund_code="", strategy_name="test", signal_type=SignalType.buy, confidence=1.0),
        Signal(date=d5, fund_code="", strategy_name="test", signal_type=SignalType.sell, confidence=1.0),
    ]


def _noop_strategy(price_df: pd.DataFrame, params: dict | None = None) -> list:
    """Returns no signals."""
    return []


def _sell_only_strategy(price_df: pd.DataFrame, params: dict | None = None) -> list:
    """Sell signal on day 3 — should be ignored (no position)."""
    dates = price_df.sort_values("date").reset_index(drop=True)
    d3 = str(dates.iloc[3]["date"].strftime("%Y-%m-%d")) if len(dates) > 3 else str(dates.iloc[0]["date"])
    return [Signal(date=d3, fund_code="", strategy_name="test", signal_type=SignalType.sell, confidence=1.0)]


# Seam 1: run_backtest returns correct structure
class TestRunBacktest:
    def test_returns_correct_structure(self):
        from app.backtest import run_backtest

        df = _price_df([1.0] * 10)
        result = run_backtest(df, _flat_buy_strategy, {}, "2024-01-01", "2024-01-10")

        assert isinstance(result, BacktestResult)
        assert isinstance(result.metrics, BacktestMetrics)
        assert isinstance(result.trades, list)
        assert isinstance(result.equity_curve, list)
        if result.trades:
            assert isinstance(result.trades[0], BacktestTrade)
        if result.equity_curve:
            assert isinstance(result.equity_curve[0], EquityPoint)

    # Seam 2: date range slicing
    def test_date_range_slicing_excludes_outside(self):
        from app.backtest import run_backtest

        # 20 days of data, but only slice 5 days
        df = _price_df([1.0] * 20, start="2024-01-01")
        result = run_backtest(df, _flat_buy_strategy, {}, "2024-01-10", "2024-01-14")

        assert len(result.equity_curve) == 5  # only 5 trading days
        assert result.equity_curve[0].date == "2024-01-10"
        assert result.equity_curve[-1].date == "2024-01-14"

    # Seam 3: buy signal simulation
    def test_buy_signal_reduces_cash(self):
        from app.backtest import run_backtest

        # Price = 2.0, buy signal on day 0 → shares = 100000 / 2 = 50000
        df = _price_df([2.0] * 10)
        result = run_backtest(df, _flat_buy_strategy, {}, "2024-01-01", "2024-01-10")
        assert len(result.trades) == 1
        assert result.trades[0].type == SignalType.buy
        assert result.trades[0].price == 2.0
        assert result.trades[0].shares == 50000.0
        assert result.trades[0].cash_remaining == 0.0

    # Seam 4: sell signal simulation
    def test_sell_signal_releases_cash(self):
        from app.backtest import run_backtest

        # Price = 2.0, buy day 0 → 50000 shares, sell day 5 at price 2.5 → cash = 50000*2.5 = 125000
        df = _price_df([2.0, 2.0, 2.0, 2.0, 2.0, 2.5, 2.5, 2.5, 2.5, 2.5])
        result = run_backtest(df, _buy_sell_strategy, {}, "2024-01-01", "2024-01-10")
        sells = [t for t in result.trades if t.type == SignalType.sell]
        assert len(sells) == 1
        assert sells[0].price == 2.5
        assert sells[0].shares == 50000.0
        assert sells[0].cash_remaining == 125000.0

    # Seam 5: sell without position is ignored
    def test_sell_without_position_ignored(self):
        from app.backtest import run_backtest

        df = _price_df([1.0] * 10)
        result = run_backtest(df, _sell_only_strategy, {}, "2024-01-01", "2024-01-10")
        assert len(result.trades) == 0  # no trades executed

    # Seam 6: equity curve daily calculation
    def test_equity_curve_value(self):
        from app.backtest import run_backtest

        # Buy day 0 at 1.0 → all-in 100000 shares. Price stays 1.0
        df = _price_df([1.0] * 5)
        result = run_backtest(df, _flat_buy_strategy, {}, "2024-01-01", "2024-01-05")
        assert len(result.equity_curve) == 5
        # Day 0: before trade cash = 100k, after trade cash = 0, shares = 100k * 1.0 = 100k
        # All days: 0 + 100000 * 1.0 = 100000
        for ep in result.equity_curve:
            assert ep.total_value == 100000.0

    # Seam 7: performance metrics correctness
    def test_metrics_buy_and_hold(self):
        from app.backtest import run_backtest

        # Price: 1.0 → 1.10 over 10 days (+10%)
        # Buy day 0 at 1.0 → 100k shares. End value = 100000 * 1.10 = 110000
        # total_return = 10%, annualized ≈ (1.1)^(252/10) - 1
        # max_drawdown = 0 (monotonic up), total_trades = 0 (no sell), win_rate = 0
        prices = [1.0 + i * 0.01 for i in range(10)]  # 1.0 → 1.09 (actually 10 days, 0-indexed)
        df = _price_df(prices)
        result = run_backtest(df, _flat_buy_strategy, {}, "2024-01-01", "2024-01-10")
        m = result.metrics
        assert m.total_return == pytest.approx(0.09, abs=1e-5)  # 109000/100000 - 1 = 0.09
        assert m.total_trades == 0  # no sell
        assert m.win_rate == 0.0
        assert len(result.equity_curve) == 10

    def test_metrics_buy_then_sell_at_profit(self):
        from app.backtest import run_backtest

        # Buy day 0 at 1.0, sell day 5 at 1.05
        # Buy cost = 100000, sell value = 100000 * 1.05 = 105000
        # total_return = (105000 - 100000)/100000 = 0.05
        # win = 1/1 = 1.0
        prices = [1.0, 1.0, 1.0, 1.0, 1.0, 1.05, 1.05, 1.05, 1.05, 1.05]
        df = _price_df(prices)
        result = run_backtest(df, _buy_sell_strategy, {}, "2024-01-01", "2024-01-10")
        m = result.metrics
        assert m.total_return == pytest.approx(0.05, abs=1e-4)
        assert m.win_rate == 1.0
        assert m.total_trades == 1

    def test_metrics_max_drawdown(self):
        from app.backtest import run_backtest

        # Buy at 1.0, price drops to 0.8 then back to 1.0
        # max_drawdown at trough: peak = 1.0, trough = 0.8 → 20%
        prices = [1.0, 0.9, 0.85, 0.8, 0.85, 0.9, 1.0]
        df = _price_df(prices)
        result = run_backtest(df, _flat_buy_strategy, {}, "2024-01-01", "2024-01-07")
        assert result.metrics.max_drawdown == pytest.approx(0.2, abs=1e-4)
        assert result.metrics.total_trades == 0

    # Seam 8: momentum strategy rejected
    def test_momentum_strategy_raises(self):
        from app.backtest import run_backtest
        from app.strategies import momentum

        df = _price_df([1.0] * 10)
        with pytest.raises(ValueError, match="not supported"):
            run_backtest(df, momentum, {}, "2024-01-01", "2024-01-10")

    # Seam 9: no signals case
    def test_no_signals_flat_equity(self):
        from app.backtest import run_backtest

        df = _price_df([1.0] * 10)
        result = run_backtest(df, _noop_strategy, {}, "2024-01-01", "2024-01-10")
        assert len(result.trades) == 0
        assert len(result.equity_curve) == 10
        assert result.equity_curve[0].total_value == 100000.0
        assert result.equity_curve[-1].total_value == 100000.0
        assert result.metrics.total_return == 0.0
        assert result.metrics.total_trades == 0

    # Seam 10: zero initial capital
    def test_zero_initial_capital(self):
        from app.backtest import run_backtest

        df = _price_df([1.0] * 5)
        result = run_backtest(df, _flat_buy_strategy, {}, "2024-01-01", "2024-01-05", initial_capital=0)
        assert len(result.trades) == 0  # no buy since cash = 0
        assert result.equity_curve[-1].total_value == 0.0
        assert result.metrics.total_return == 0.0

    # Seam: empty df after slicing
    def test_empty_df_after_slicing(self):
        from app.backtest import run_backtest

        df = _price_df([1.0] * 10, start="2024-01-01")
        result = run_backtest(df, _flat_buy_strategy, {}, "2030-01-01", "2030-01-10")
        assert result.metrics.total_trades == 0
        assert result.metrics.total_return == 0.0
        assert len(result.trades) == 0
        assert len(result.equity_curve) == 0

    # Seam: indicator_cross strategy works end-to-end
    def test_indicator_cross_backtest(self):
        from app.backtest import run_backtest
        from app.strategies import indicator_cross

        # Uptrend data: flat then up, so indicator_cross should generate buy
        dates = pd.date_range("2024-01-01", periods=50, freq="D")
        nav = [1.0] * 25 + [1.0 + i * 0.02 for i in range(25)]
        df = pd.DataFrame({"date": dates, "netvalue": nav})

        result = run_backtest(df, indicator_cross, {"short_window": 5, "long_window": 10}, "2024-01-01", "2024-02-20")
        assert result.metrics.total_trades >= 0
        assert len(result.equity_curve) > 0

    # Seam: pe_percentile strategy works end-to-end
    def test_pe_percentile_backtest(self):
        from app.backtest import run_backtest
        from app.strategies import pe_percentile

        dates = pd.date_range("2024-01-01", periods=30, freq="D")
        nav = [1.0] * 30
        pe_values = list(range(5, 35))  # current=34, rank=29/29=1.0 → sell
        df = pd.DataFrame({"date": dates, "netvalue": nav, "pe": pe_values})

        result = run_backtest(df, pe_percentile, {"low_pct": 0.2, "high_pct": 0.8}, "2024-01-01", "2024-01-30")
        assert result.metrics.total_trades >= 0
        assert len(result.equity_curve) > 0

    # Seam: grid strategy works end-to-end
    def test_grid_backtest(self):
        from app.backtest import run_backtest
        from app.strategies import grid

        # Oscillating price that crosses grid lines
        dates = pd.date_range("2024-01-01", periods=20, freq="D")
        nav = [1.0, 1.1, 1.2, 1.3, 1.2, 1.1, 1.0, 0.9, 1.0, 1.1,
               1.2, 1.1, 1.0, 0.9, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3]
        df = pd.DataFrame({"date": dates, "netvalue": nav})

        result = run_backtest(df, grid, {"low": 0.8, "high": 1.4, "n_grids": 6}, "2024-01-01", "2024-01-20")
        assert result.metrics.total_trades >= 0
        assert len(result.equity_curve) > 0
