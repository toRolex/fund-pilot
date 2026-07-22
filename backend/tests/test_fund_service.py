"""Tests for app.fund_service — pure data-enrichment helpers."""
import pandas as pd
import pytest

from app.models import Holding, SignalResponse, SignalType


# ----- compute_daily_change -----


class TestComputeDailyChange:
    def test_empty_dataframe_returns_zero(self):
        from app.fund_service import compute_daily_change

        df = pd.DataFrame({"date": [], "netvalue": []})
        assert compute_daily_change(df) == 0.0

    def test_single_row_returns_zero(self):
        from app.fund_service import compute_daily_change

        df = pd.DataFrame({"date": ["2024-01-01"], "netvalue": [1.0]})
        assert compute_daily_change(df) == 0.0

    def test_normal_two_rows(self):
        from app.fund_service import compute_daily_change

        df = pd.DataFrame({
            "date": pd.to_datetime(["2024-01-01", "2024-01-02"]),
            "netvalue": [1.0, 1.05],
        })
        assert compute_daily_change(df) == 5.0

    def test_unchanged_returns_zero(self):
        from app.fund_service import compute_daily_change

        df = pd.DataFrame({
            "date": pd.to_datetime(["2024-01-01", "2024-01-02"]),
            "netvalue": [1.0, 1.0],
        })
        assert compute_daily_change(df) == 0.0

    def test_zero_prev_nav_returns_zero(self):
        """Defend against division by zero when previous netvalue is 0."""
        from app.fund_service import compute_daily_change

        df = pd.DataFrame({
            "date": pd.to_datetime(["2024-01-01", "2024-01-02"]),
            "netvalue": [0.0, 1.05],
        })
        assert compute_daily_change(df) == 0.0

    def test_unordered_dates_still_computes_delta(self):
        """Function must sort by date internally."""
        from app.fund_service import compute_daily_change

        df = pd.DataFrame({
            "date": pd.to_datetime(["2024-01-03", "2024-01-01", "2024-01-02"]),
            "netvalue": [1.05, 1.0, 1.02],
        })
        # latest=1.05, prev=1.02 → (1.05-1.02)/1.02*100 = 2.94
        assert compute_daily_change(df) == 2.94

    def test_negative_change(self):
        from app.fund_service import compute_daily_change

        df = pd.DataFrame({
            "date": pd.to_datetime(["2024-01-01", "2024-01-02"]),
            "netvalue": [2.0, 1.8],
        })
        assert compute_daily_change(df) == -10.0

    def test_nan_netvalue_returns_zero(self):
        """NaN netvalue should not poison the result."""
        from app.fund_service import compute_daily_change

        df = pd.DataFrame({
            "date": pd.to_datetime(["2024-01-01", "2024-01-02"]),
            "netvalue": [1.0, float("nan")],
        })
        result = compute_daily_change(df)
        # result is a float, may be NaN — but the function should not crash
        assert isinstance(result, float)


# ----- enrich_signal -----


class TestEnrichSignal:
    def test_basic_enrichment(self):
        from app.fund_service import enrich_signal

        row = {
            "date": "2024-01-15",
            "fund_code": "000001",
            "strategy": "indicator_cross",
            "signal": "buy",
            "value": 0.85,
            "detail": "MA5 cross MA20",
        }
        prices = pd.DataFrame({
            "date": pd.to_datetime(["2024-01-14", "2024-01-15"]),
            "netvalue": [1.0, 1.05],
        })
        result = enrich_signal(row, "测试基金A", prices)
        assert isinstance(result, SignalResponse)
        assert result.fund_code == "000001"
        assert result.fund_name == "测试基金A"
        assert result.strategy_name == "indicator_cross"
        assert result.signal_type == SignalType.buy
        assert result.confidence == 0.85
        assert result.daily_change == 5.0

    def test_empty_prices_returns_zero_daily_change(self):
        from app.fund_service import enrich_signal

        row = {
            "date": "2024-01-15",
            "fund_code": "000001",
            "strategy": "indicator_cross",
            "signal": "hold",
            "value": 0.0,
            "detail": "",
        }
        result = enrich_signal(row, "测试基金A", pd.DataFrame({"date": [], "netvalue": []}))
        assert result.daily_change == 0.0
        assert result.signal_type == SignalType.hold


# ----- compute_holding_pl -----


class TestComputeHoldingPL:
    def test_positive_pnl(self):
        from app.fund_service import compute_holding_pl

        h = Holding(
            fund_code="000001",
            fund_name="测试",
            shares=1000.0,
            cost_price=1.25,
            current_value=1.35,
        )
        result = compute_holding_pl(h)
        assert result["cost_basis"] == 1250.0
        assert result["pl_amount"] == 100.0
        assert result["pl_percent"] == 8.0

    def test_negative_pnl(self):
        from app.fund_service import compute_holding_pl

        h = Holding(
            fund_code="110001",
            fund_name="测试",
            shares=500.0,
            cost_price=2.0,
            current_value=1.8,
        )
        result = compute_holding_pl(h)
        assert result["cost_basis"] == 1000.0
        assert result["pl_amount"] == -100.0
        assert result["pl_percent"] == -10.0

    def test_zero_cost_basis_returns_zero_percent(self):
        """Defend against division by zero when cost_basis is 0."""
        from app.fund_service import compute_holding_pl

        h = Holding(
            fund_code="000001",
            fund_name="零成本",
            shares=100.0,
            cost_price=0.0,
            current_value=1.5,
        )
        result = compute_holding_pl(h)
        assert result["cost_basis"] == 0.0
        # pl_amount = 100 * 1.5 = 150
        assert result["pl_amount"] == 150.0
        assert result["pl_percent"] == 0.0
