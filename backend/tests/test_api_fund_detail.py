"""Tests for /api/funds/{code} detail endpoints."""
import pandas as pd
import pytest
from unittest.mock import patch


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


def make_price_df(n_days=50):
    return pd.DataFrame({
        "date": pd.date_range("2024-01-01", periods=n_days, freq="D"),
        "netvalue": [1.0] * 25 + [1.0 + i * 0.02 for i in range(n_days - 25)],
    })


class TestFundDetail:
    @patch("app.main.load_fund_price")
    def test_fund_detail_ok(self, mock_load, client):
        mock_load.return_value = make_price_df()
        resp = client.get("/api/funds/000001")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == "000001"
        assert data["name"] == "测试基金A"
        assert "latest_nav" in data
        assert "daily_change" in data

    def test_fund_detail_not_found(self, client):
        resp = client.get("/api/funds/999999")
        assert resp.status_code == 404
        assert "not found" in resp.text.lower()

    @patch("app.main.get_fund_info")
    @patch("app.main.load_fund_price")
    def test_fund_detail_with_info(self, mock_load, mock_get_info, client):
        mock_load.return_value = make_price_df()
        mock_get_info.return_value = {
            "name": "测试基金A",
            "fund_type": "股票型",
            "fund_scale": 12.5,
            "established_date": "2020-01-01",
        }

        resp = client.get("/api/funds/000001")
        data = resp.json()
        assert data["type"] == "股票型"
        assert data["scale"] == 12.5
        assert data["established_date"] == "2020-01-01"

    @patch("app.main.load_fund_price")
    def test_fund_detail_extra_fields(self, mock_load, client):
        mock_load.return_value = make_price_df()
        """Verify all expected fields exist in response."""
        resp = client.get("/api/funds/000001")
        data = resp.json()
        expected = {"code", "name", "type", "scale", "established_date",
                    "latest_nav", "latest_nav_date", "daily_change"}
        assert expected.issubset(data.keys())


class TestFundNav:
    @patch("app.main.load_fund_price")
    def test_nav_returns_list(self, mock_load, client):
        mock_load.return_value = make_price_df()
        resp = client.get("/api/funds/000001/nav")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if data:
            assert "date" in data[0]
            assert "netvalue" in data[0]

    def test_nav_invalid_fund_404(self, client):
        resp = client.get("/api/funds/999999/nav")
        assert resp.status_code == 404

    @patch("app.main.load_fund_price")
    def test_nav_returns_points(self, mock_load, client):
        mock_load.return_value = make_price_df()
        resp = client.get("/api/funds/000001/nav")
        data = resp.json()
        assert len(data) == 50
        assert data[0]["date"] == "2024-01-01"
        assert data[0]["netvalue"] == 1.0


class TestFundSignals:
    @staticmethod
    def _populate_db_for_fund(code="000001"):
        """Insert a known persisted signal directly into the DB."""
        from app.db import get_connection, init_db, save_signal_item, save_signal_run

        conn = get_connection()
        init_db(conn)
        run_id = save_signal_run(conn, "indicator_cross", "2024-01-15T10:00:00")
        save_signal_item(conn, run_id, code, "buy", 0.85, "2024-01-15")
        conn.close()

    @patch("app.main.load_fund_price")
    def test_fund_signals_returns_enriched(self, mock_load, client):
        mock_load.return_value = make_price_df()
        resp = client.get("/api/funds/000001/signals")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if data:
            s = data[0]
            assert "fund_code" in s
            assert "fund_name" in s
            assert "strategy_name" in s
            assert s["fund_code"] == "000001"

    def test_fund_signals_not_found(self, client):
        resp = client.get("/api/funds/999999/signals")
        assert resp.status_code == 404

    @patch("app.main.load_fund_price")
    def test_signals_read_from_db(self, mock_load, client):
        """Single-fund signals come from persisted DB, not strategy recomputation."""
        self._populate_db_for_fund()
        mock_load.return_value = make_price_df()

        resp = client.get("/api/funds/000001/signals")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["fund_code"] == "000001"
        assert data[0]["signal_type"] == "buy"
        assert data[0]["strategy_name"] == "indicator_cross"
        assert data[0]["confidence"] == 0.85

    @patch("app.main.load_fund_price")
    def test_get_signals_does_not_create_run(self, mock_load, client):
        """GET /funds/{code}/signals must not persist a new signal run."""
        self._populate_db_for_fund()
        mock_load.return_value = make_price_df()

        from app.db import get_connection
        conn = get_connection()
        before = conn.execute("SELECT COUNT(*) FROM signal_run").fetchone()[0]
        conn.close()

        resp = client.get("/api/funds/000001/signals")
        assert resp.status_code == 200

        conn = get_connection()
        after = conn.execute("SELECT COUNT(*) FROM signal_run").fetchone()[0]
        conn.close()
        assert after == before


class TestFundStrategies:
    def test_list_strategies_for_fund(self, client):
        resp = client.get("/api/funds/000001/strategies")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        names = [s["name"] for s in data]
        assert "indicator_cross" in names
        for s in data:
            assert "enabled" in s
            assert "description" in s

    def test_strategies_fund_not_found(self, client):
        resp = client.get("/api/funds/999999/strategies")
        assert resp.status_code == 404

    def test_toggle_strategy(self, client):
        # Default is disabled; no-body PUT toggles to enabled
        resp = client.put("/api/funds/000001/strategies/indicator_cross")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "indicator_cross"
        assert data["enabled"] is True

        resp2 = client.put("/api/funds/000001/strategies/indicator_cross")
        data2 = resp2.json()
        assert data2["enabled"] is False

    def test_toggle_strategy_not_found(self, client):
        resp = client.put("/api/funds/000001/strategies/nonexistent")
        assert resp.status_code == 404

    def test_toggle_strategy_fund_not_found(self, client):
        resp = client.put("/api/funds/999999/strategies/indicator_cross")
        assert resp.status_code == 404
