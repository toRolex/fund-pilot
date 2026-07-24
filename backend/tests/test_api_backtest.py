"""Tests for POST /api/backtest endpoint."""
import pandas as pd
import pytest
from unittest.mock import patch

FUNDS_CSV = """code,name,type
000001,测试基金A,股票型
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


class TestBacktestAPI:
    """POST /api/backtest"""

    @patch("app.main.load_fund_price")
    def test_happy_path(self, mock_load, client):
        """Happy path: returns 200 with correct BacktestResult shape."""
        mock_load.return_value = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=50, freq="D"),
            "netvalue": [1.0] * 25 + [1.0 + i * 0.02 for i in range(25)],
        })

        resp = client.post("/api/backtest", json={
            "fund_code": "000001",
            "strategy": "indicator_cross",
            "params": {"short_window": 5, "long_window": 10},
            "start_date": "2024-01-01",
            "end_date": "2024-02-20",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "metrics" in data
        assert "trades" in data
        assert "equity_curve" in data
        assert "total_return" in data["metrics"]
        assert isinstance(data["trades"], list)
        assert isinstance(data["equity_curve"], list)

    def test_fund_not_in_watchlist_404(self, client):
        """fund_code not in watchlist returns 404."""
        resp = client.post("/api/backtest", json={
            "fund_code": "999999",
            "strategy": "indicator_cross",
        })
        assert resp.status_code == 404
        assert "not found" in resp.text.lower()

    def test_strategy_not_found_422(self, client):
        """Nonexistent strategy returns 422."""
        resp = client.post("/api/backtest", json={
            "fund_code": "000001",
            "strategy": "nonexistent_strategy",
        })
        assert resp.status_code == 422
        assert "not found" in resp.text.lower()

    @patch("app.main.load_fund_price")
    def test_start_gt_end_422(self, mock_load, client):
        """start_date > end_date returns 422."""
        mock_load.return_value = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=10, freq="D"),
            "netvalue": [1.0] * 10,
        })
        resp = client.post("/api/backtest", json={
            "fund_code": "000001",
            "strategy": "indicator_cross",
            "start_date": "2024-02-01",
            "end_date": "2024-01-01",
        })
        assert resp.status_code == 422
        assert "start_date" in resp.text.lower() or "end_date" in resp.text.lower()

    @patch("app.main.load_fund_price")
    def test_price_data_fail_502(self, mock_load, client):
        """Price data loading failure returns 502."""
        mock_load.side_effect = ValueError("Failed to load price data for 000001")

        resp = client.post("/api/backtest", json={
            "fund_code": "000001",
            "strategy": "indicator_cross",
        })
        assert resp.status_code == 502
        assert "price" in resp.text.lower() or "data" in resp.text.lower()

    @patch("app.main.load_fund_price")
    def test_correctly_calls_run_backtest(self, mock_load, client):
        """Verify run_backtest is called with deserialized request args."""
        mock_load.return_value = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=10, freq="D"),
            "netvalue": [1.0] * 10,
        })

        with patch("app.main.backtest.run_backtest") as mock_run:
            client.post("/api/backtest", json={
                "fund_code": "000001",
                "strategy": "indicator_cross",
                "params": {"short_window": 5},
                "start_date": "2024-01-01",
                "end_date": "2024-01-10",
                "initial_capital": 50000,
            })

            mock_run.assert_called_once()
            _, kwargs = mock_run.call_args
            assert "price_df" in kwargs
            assert callable(kwargs["strategy_fn"])
            assert kwargs["params"] == {"short_window": 5}
            assert kwargs["start_date"] == "2024-01-01"
            assert kwargs["end_date"] == "2024-01-10"
            assert kwargs["initial_capital"] == 50000
