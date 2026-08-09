"""Tests for single-fund strategy enable/disable persistence + on-demand run.

Covers Issue #86:
- enabled state persists to SQLite (new fund_strategy table), default disabled
- POST /funds/{code}/strategies/{name}/run enables + runs once + persists signal
- PUT /funds/{code}/strategies/{name} with {"enabled": false} persists disabled
- toggle state survives new connections (persistence, not memory)
"""
import pandas as pd
import pytest
from fastapi.testclient import TestClient
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


class TestDefaultDisabled:
    def test_strategies_default_disabled(self, client):
        resp = client.get("/api/funds/000001/strategies")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        for s in data:
            assert s["enabled"] is False

    @patch("app.main.load_fund_price")
    def test_detail_merged_strategies_default_disabled(self, mock_load, client):
        mock_load.return_value = make_price_df()
        resp = client.get("/api/funds/000001/detail")
        assert resp.status_code == 200
        for s in resp.json()["strategies"]:
            assert s["enabled"] is False


class TestRunEndpoint:
    @patch("app.main.load_fund_price")
    def test_run_enables_and_persists_signals(self, mock_load, client):
        mock_load.return_value = make_price_df()

        resp = client.post("/api/funds/000001/strategies/indicator_cross/run")
        assert resp.status_code == 200
        signals = resp.json()
        assert isinstance(signals, list)
        assert len(signals) >= 1
        assert signals[0]["fund_code"] == "000001"
        assert signals[0]["strategy_name"] == "indicator_cross"

        # Enabled persisted
        strategies = client.get("/api/funds/000001/strategies").json()
        cross = [s for s in strategies if s["name"] == "indicator_cross"][0]
        assert cross["enabled"] is True

        # signal_run + signal_item written
        from app.db import get_connection, query_signals
        conn = get_connection()
        run_count = conn.execute("SELECT COUNT(*) FROM signal_run").fetchone()[0]
        rows = query_signals(conn, fund_code="000001", strategy="indicator_cross", all_history=True)
        conn.close()
        assert run_count >= 1
        assert len(rows) >= 1
        assert rows[0]["fund_code"] == "000001"

        # GET /signals?fund_code= returns this strategy's signals
        resp = client.get("/api/signals?fund_code=000001")
        data = resp.json()
        strategies_in_signals = {s["strategy_name"] for s in data}
        assert "indicator_cross" in strategies_in_signals

    @patch("app.main.load_fund_price")
    def test_run_returns_latest_signals(self, mock_load, client):
        mock_load.return_value = make_price_df()
        resp = client.post("/api/funds/000001/strategies/indicator_cross/run")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_run_fund_not_found(self, client):
        resp = client.post("/api/funds/999999/strategies/indicator_cross/run")
        assert resp.status_code == 404

    @patch("app.main.load_fund_price")
    def test_run_strategy_not_found(self, mock_load, client):
        mock_load.return_value = make_price_df()
        resp = client.post("/api/funds/000001/strategies/nonexistent/run")
        assert resp.status_code == 404


class TestClosePersistence:
    @patch("app.main.load_fund_price")
    def test_close_persists_disabled(self, mock_load, client):
        mock_load.return_value = make_price_df()
        # Enable first via run
        client.post("/api/funds/000001/strategies/indicator_cross/run")

        # Close via PUT with body {"enabled": false}
        resp = client.put(
            "/api/funds/000001/strategies/indicator_cross",
            json={"enabled": False},
        )
        assert resp.status_code == 200
        assert resp.json()["enabled"] is False

        # Persisted as false
        strategies = client.get("/api/funds/000001/strategies").json()
        cross = [s for s in strategies if s["name"] == "indicator_cross"][0]
        assert cross["enabled"] is False

    def test_set_enabled_true_via_put(self, client):
        resp = client.put(
            "/api/funds/000001/strategies/indicator_cross",
            json={"enabled": True},
        )
        assert resp.status_code == 200
        assert resp.json()["enabled"] is True
        strategies = client.get("/api/funds/000001/strategies").json()
        cross = [s for s in strategies if s["name"] == "indicator_cross"][0]
        assert cross["enabled"] is True


class TestPersistenceAcrossConnections:
    @patch("app.main.load_fund_price")
    def test_enabled_state_survives_new_connection(self, mock_load, client):
        mock_load.return_value = make_price_df()
        client.post("/api/funds/000001/strategies/indicator_cross/run")

        # A brand-new TestClient reads the persisted state from the same DB file
        from app.main import app
        client2 = TestClient(app)
        strategies = client2.get("/api/funds/000001/strategies").json()
        cross = [s for s in strategies if s["name"] == "indicator_cross"][0]
        assert cross["enabled"] is True

    @patch("app.main.load_fund_price")
    def test_disabled_state_survives_new_connection(self, mock_load, client):
        mock_load.return_value = make_price_df()
        client.put(
            "/api/funds/000001/strategies/indicator_cross",
            json={"enabled": False},
        )

        from app.main import app
        client2 = TestClient(app)
        strategies = client2.get("/api/funds/000001/strategies").json()
        cross = [s for s in strategies if s["name"] == "indicator_cross"][0]
        assert cross["enabled"] is False


class TestGlobalBatchUnchanged:
    @patch("app.main.load_fund_price")
    def test_run_all_still_works(self, mock_load, client):
        """POST /signals/run is not migrated; regression guard."""
        mock_load.return_value = make_price_df()
        resp = client.post("/api/signals/run")
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"
