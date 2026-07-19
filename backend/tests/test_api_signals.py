"""Tests for /api/signals and /api/strategies endpoints."""
import pandas as pd
import pytest
from unittest.mock import MagicMock, patch


FUNDS_CSV = """code,name,type
000001,测试基金A,股票型
110001,测试基金B,混合型
"""


@pytest.fixture(autouse=True)
def reset_watchlist(tmp_path):
    """Use a fresh CSV for each test and reset the global watchlist state."""
    csv_path = tmp_path / "watchlist.csv"
    csv_path.write_text(FUNDS_CSV)
    from app import watchlist as wl

    wl._WATCHLIST_PATH = csv_path
    wl._WATCHLIST = {}
    wl._load()
    yield
    wl._WATCHLIST_PATH = None
    wl._WATCHLIST = {}


class TestStrategiesEndpoint:
    def test_list_strategies(self, client):
        resp = client.get("/api/strategies")
        assert resp.status_code == 200
        data = resp.json()
        names = [s["name"] for s in data]
        assert "indicator_cross" in names

    def test_strategy_has_description(self, client):
        resp = client.get("/api/strategies")
        data = resp.json()
        cross = [s for s in data if s["name"] == "indicator_cross"][0]
        assert cross["description"] != ""
        assert "short_window" in cross["params_schema"]


class TestSignalsEndpoint:
    @patch("app.main.load_fund_price")
    def test_signals_empty_watchlist(self, mock_load, client):
        from app import watchlist as wl
        wl._WATCHLIST = {}
        wl._save()

        resp = client.get("/api/signals")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("app.main.load_fund_price")
    def test_signals_returns_list(self, mock_load, client):
        mock_price = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=50, freq="D"),
            "netvalue": [1.0] * 25 + [1.0 + i * 0.02 for i in range(25)],
        })
        mock_load.return_value = mock_price

        resp = client.get("/api/signals")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        # At least one signal should be generated
        assert len(data) >= 1

    @patch("app.main.load_fund_price")
    def test_signal_has_enriched_fields(self, mock_load, client):
        mock_price = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=50, freq="D"),
            "netvalue": [1.0] * 25 + [1.0 + i * 0.02 for i in range(25)],
        })
        mock_load.return_value = mock_price

        resp = client.get("/api/signals")
        data = resp.json()
        signal = data[0]
        assert "fund_code" in signal
        assert "fund_name" in signal
        assert "strategy_name" in signal
        assert "signal_type" in signal
        assert "confidence" in signal
        assert signal["fund_name"] != ""

    @patch("app.main.load_fund_price")
    def test_filter_by_code(self, mock_load, client):
        mock_price = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=50, freq="D"),
            "netvalue": [1.0] * 25 + [1.0 + i * 0.02 for i in range(25)],
        })
        mock_load.return_value = mock_price

        resp = client.get("/api/signals?code=000001")
        assert resp.status_code == 200
        data = resp.json()
        for s in data:
            assert s["fund_code"] == "000001"

    @patch("app.main.load_fund_price")
    def test_sorted_by_date_fund_code(self, mock_load, client):
        mock_price = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=50, freq="D"),
            "netvalue": [1.0] * 25 + [1.0 + i * 0.02 for i in range(25)],
        })
        mock_load.return_value = mock_price

        resp = client.get("/api/signals")
        data = resp.json()
        # Verify sorted by (date, fund_code) ascending
        for i in range(len(data) - 1):
            curr = data[i]
            nxt = data[i + 1]
            assert (curr["date"], curr["fund_code"]) <= (nxt["date"], nxt["fund_code"])

    @patch("app.main.load_fund_price")
    def test_strategy_error_propagates(self, mock_load, client):
        mock_load.side_effect = ValueError("price fetch failed")
        # FastAPI TestClient re-raises unhandled exceptions — this confirms
        # strategy/data errors are NOT silently swallowed.
        with pytest.raises(ValueError, match="price fetch failed"):
            client.get("/api/signals")
