"""Tests for grid strategy."""
import pandas as pd
import pytest


class TestGrid:
    def test_price_crosses_up_buy(self):
        from app.strategies import grid

        # Grid lines at 1.25, 1.5, 1.75 (low=1.0, high=2.0, n=4)
        # Price jumps from 1.1 → 1.4, crossing 1.25 line upward → buy
        dates = pd.date_range("2024-01-01", periods=5, freq="D")
        nav = [1.05, 1.1, 1.15, 1.4, 1.5]
        df = pd.DataFrame({"date": dates, "netvalue": nav})

        signals = grid(df, {"low": 1.0, "high": 2.0, "n_grids": 4})
        buy_signals = [s for s in signals if s.signal_type.value == "buy"]
        assert len(buy_signals) >= 1
        assert buy_signals[0].strategy_name == "grid"

    def test_price_crosses_down_sell(self):
        from app.strategies import grid

        # Grid line at 1.25. Price drops from 1.4 → 1.1, crossing 1.25 downward → sell
        dates = pd.date_range("2024-01-01", periods=5, freq="D")
        nav = [1.5, 1.4, 1.4, 1.1, 1.05]
        df = pd.DataFrame({"date": dates, "netvalue": nav})

        signals = grid(df, {"low": 1.0, "high": 2.0, "n_grids": 4})
        sell_signals = [s for s in signals if s.signal_type.value == "sell"]
        assert len(sell_signals) >= 1
        assert sell_signals[0].strategy_name == "grid"

    def test_price_no_cross(self):
        from app.strategies import grid

        # Grid lines at 1.25, 1.5, 1.75. Price stays between 1.5 and 1.6 — no cross.
        dates = pd.date_range("2024-01-01", periods=10, freq="D")
        nav = [1.5, 1.52, 1.55, 1.58, 1.6, 1.55, 1.58, 1.6, 1.55, 1.58]
        df = pd.DataFrame({"date": dates, "netvalue": nav})

        signals = grid(df, {"low": 1.0, "high": 2.0, "n_grids": 4})
        assert signals == []

    def test_insufficient_data(self):
        from app.strategies import grid

        # Empty df
        assert grid(pd.DataFrame({"date": [], "netvalue": []}), {"low": 1.0, "high": 2.0}) == []
        # Single row
        df = pd.DataFrame({"date": pd.date_range("2024-01-01", periods=1, freq="D"), "netvalue": [1.0]})
        assert grid(df, {"low": 1.0, "high": 2.0}) == []
        # Missing netvalue
        df = pd.DataFrame({"date": pd.date_range("2024-01-01", periods=5, freq="D"), "price": [1.0] * 5})
        assert grid(df, {"low": 1.0, "high": 2.0}) == []
        # Invalid range
        df = pd.DataFrame({"date": pd.date_range("2024-01-01", periods=5, freq="D"), "netvalue": [1.0] * 5})
        assert grid(df, {"low": 2.0, "high": 1.0}) == []


class TestGridRegistry:
    def test_metadata_and_registry(self):
        from app.strategies import get_strategy, list_strategies

        names = [s.name for s in list_strategies()]
        assert "grid" in names

        meta = [s for s in list_strategies() if s.name == "grid"][0]
        assert meta.description != ""
        assert "low" in meta.params_schema
        assert "high" in meta.params_schema
        assert "n_grids" in meta.params_schema
        assert meta.params_schema["n_grids"]["default"] == 10

        fn = get_strategy("grid")
        assert callable(fn)
