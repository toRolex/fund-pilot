"""Tests for pe_percentile strategy."""
import pandas as pd
import pytest


@pytest.fixture
def pe_df_low():
    """PE series where current value is the minimum of history (percentile ≈ 0)."""
    dates = pd.date_range("2023-01-01", periods=120, freq="D")
    # Historical PE: 20..39 (20 values), then 99 stable values, then current=5 (lowest)
    pe = list(range(20, 40)) + [25] * 99 + [5]
    return pd.DataFrame({"date": dates, "pe": pe})


class TestPePercentile:
    def test_low_pe_generates_buy(self, pe_df_low):
        from app.strategies import pe_percentile

        signals = pe_percentile(pe_df_low, {"low_pct": 0.2, "high_pct": 0.8})
        assert len(signals) >= 1
        buy_signals = [s for s in signals if s.signal_type.value == "buy"]
        assert len(buy_signals) >= 1
        assert buy_signals[0].strategy_name == "pe_percentile"

    def test_high_pe_generates_sell(self):
        from app.strategies import pe_percentile

        dates = pd.date_range("2023-01-01", periods=120, freq="D")
        # Historical PE 20..39 (20 vals), then 99 stable, then current=80 (highest)
        pe = list(range(20, 40)) + [25] * 99 + [80]
        df = pd.DataFrame({"date": dates, "pe": pe})

        signals = pe_percentile(df, {"low_pct": 0.2, "high_pct": 0.8})
        sell_signals = [s for s in signals if s.signal_type.value == "sell"]
        assert len(sell_signals) >= 1
        assert sell_signals[0].strategy_name == "pe_percentile"

    def test_mid_pe_generates_hold(self):
        from app.strategies import pe_percentile

        dates = pd.date_range("2023-01-01", periods=120, freq="D")
        # 60 values < 30, 59 values > 30, current=30 → exactly at median → hold
        pe = [20] * 60 + [40] * 59 + [30]
        df = pd.DataFrame({"date": dates, "pe": pe})

        signals = pe_percentile(df, {"low_pct": 0.2, "high_pct": 0.8})
        assert len(signals) >= 1
        assert signals[0].signal_type.value == "hold"
        assert signals[0].strategy_name == "pe_percentile"

    def test_insufficient_data(self):
        from app.strategies import pe_percentile

        # Empty df
        assert pe_percentile(pd.DataFrame({"date": [], "pe": []})) == []
        # Single row — no history
        df = pd.DataFrame({"date": pd.date_range("2024-01-01", periods=1, freq="D"), "pe": [20]})
        assert pe_percentile(df) == []
        # No pe column
        df = pd.DataFrame({"date": pd.date_range("2024-01-01", periods=30, freq="D"), "netvalue": [1.0] * 30})
        assert pe_percentile(df) == []


class TestPePercentileRegistry:
    def test_metadata_and_registry(self):
        from app.strategies import get_strategy, list_strategies

        names = [s.name for s in list_strategies()]
        assert "pe_percentile" in names

        meta = [s for s in list_strategies() if s.name == "pe_percentile"][0]
        assert meta.description != ""
        assert "low_pct" in meta.params_schema
        assert meta.params_schema["low_pct"]["default"] == 0.2
        assert "high_pct" in meta.params_schema
        assert meta.params_schema["high_pct"]["default"] == 0.8

        fn = get_strategy("pe_percentile")
        assert callable(fn)
