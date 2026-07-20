"""Tests for momentum strategy."""
import pandas as pd
import pytest


def _df(prices):
    dates = pd.date_range("2024-01-01", periods=len(prices), freq="D")
    return pd.DataFrame({"date": dates, "netvalue": prices})


class TestMomentum:
    def test_ranking_descending(self):
        from app.strategies import momentum

        # 3 funds, 30 days, n_days=20
        # A: 1.0 → 1.20 (+20%) — top
        # B: 1.0 → 1.10 (+10%) — middle
        # C: 1.0 → 0.95 (-5%) — bottom
        funds = {
            "A": _df([1.0] * 10 + [1.0 + i * 0.01 for i in range(20)]),  # → 1.20
            "B": _df([1.0] * 10 + [1.0 + i * 0.005 for i in range(20)]),  # → 1.095
            "C": _df([1.0] * 10 + [1.0 - i * 0.0025 for i in range(20)]),  # → 0.95
        }

        signals = momentum(funds, {"n_days": 20})
        assert len(signals) == 3
        # Ordered by return descending: A, B, C
        assert signals[0].fund_code == "A"
        assert signals[1].fund_code == "B"
        assert signals[2].fund_code == "C"
        for s in signals:
            assert s.strategy_name == "momentum"

    def test_signals_have_rank_detail(self):
        from app.strategies import momentum

        funds = {
            "X": _df([1.0] * 10 + [1.0 + i * 0.01 for i in range(20)]),  # +20%
            "Y": _df([1.0] * 30),  # 0%
        }
        signals = momentum(funds, {"n_days": 20})
        assert len(signals) == 2
        ranks = [s.detail for s in signals]
        assert ranks == ["rank_1", "rank_2"]

    def test_insufficient_data_partial_skipped(self):
        from app.strategies import momentum

        # n_days=20, so need 21+ rows
        funds = {
            "OK": _df([1.0] * 30),  # enough
            "Short": _df([1.0] * 5),  # too short — skipped
            "NoData": pd.DataFrame({"date": [], "netvalue": []}),  # empty — skipped
        }
        signals = momentum(funds, {"n_days": 20})
        assert len(signals) == 1
        assert signals[0].fund_code == "OK"
        assert signals[0].detail == "rank_1"

    def test_empty_input(self):
        from app.strategies import momentum

        assert momentum({}, {"n_days": 20}) == []


class TestMomentumRegistry:
    def test_metadata_and_registry(self):
        from app.strategies import get_strategy, list_strategies, momentum

        names = [s.name for s in list_strategies()]
        assert "momentum" in names

        meta = [s for s in list_strategies() if s.name == "momentum"][0]
        assert meta.description != ""
        assert "n_days" in meta.params_schema
        assert meta.params_schema["n_days"]["default"] == 20

        fn = get_strategy("momentum")
        assert callable(fn)
        # Multi-fund strategy marker so main.py dispatches with dict input
        assert getattr(momentum, "multi_fund", False) is True
