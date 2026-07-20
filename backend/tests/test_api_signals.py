"""Tests for /api/signals and /api/strategies endpoints."""
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


class TestPostRunSignals:
    """Tests for POST /api/signals/run persistence endpoint."""

    @patch("app.main.load_fund_price")
    def test_run_returns_completed(self, mock_load, client):
        mock_price = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=50, freq="D"),
            "netvalue": [1.0] * 25 + [1.0 + i * 0.02 for i in range(25)],
        })
        mock_load.return_value = mock_price

        resp = client.post("/api/signals/run")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"
        assert len(data["runs"]) >= 1

    @patch("app.main.load_fund_price")
    def test_run_persists_to_db(self, mock_load, client):
        mock_price = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=50, freq="D"),
            "netvalue": [1.0] * 25 + [1.0 + i * 0.02 for i in range(25)],
        })
        mock_load.return_value = mock_price

        client.post("/api/signals/run")

        from app.db import get_connection, query_signals
        conn = get_connection()
        results = query_signals(conn)
        conn.close()
        assert len(results) >= 1
        assert results[0]["fund_code"] in ("000001", "110001")

    @patch("app.main.load_fund_price")
    def test_run_records_strategy_name(self, mock_load, client):
        mock_price = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=50, freq="D"),
            "netvalue": [1.0] * 25 + [1.0 + i * 0.02 for i in range(25)],
        })
        mock_load.return_value = mock_price

        resp = client.post("/api/signals/run")
        run_strategies = {r["strategy"] for r in resp.json()["runs"]}
        assert "indicator_cross" in run_strategies

    def test_run_empty_watchlist(self, client):
        from app import watchlist as wl
        wl._WATCHLIST = {}
        wl._save()

        resp = client.post("/api/signals/run")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"
        # Strategies still produce 0-signal runs
        for r in data["runs"]:
            assert r["signals"] == 0

    @patch("app.main.load_fund_price")
    def test_momentum_persists_per_fund_signals(self, mock_load, client):
        """Momentum is multi-fund: dispatcher passes dict, each fund's rank persisted."""
        def make_df():
            return pd.DataFrame({
                "date": pd.date_range("2024-01-01", periods=30, freq="D"),
                "netvalue": [1.0 + i * 0.01 for i in range(30)],
            })

        def make_df_down():
            return pd.DataFrame({
                "date": pd.date_range("2024-01-01", periods=30, freq="D"),
                "netvalue": [1.3 - i * 0.01 for i in range(30)],
            })

        mock_load.side_effect = lambda code: make_df_down() if code == "110001" else make_df()

        resp = client.post("/api/signals/run")
        assert resp.status_code == 200
        runs = {r["strategy"]: r for r in resp.json()["runs"]}
        assert "momentum" in runs
        assert runs["momentum"]["signals"] == 2

        from app.db import get_connection, query_signals
        conn = get_connection()
        results = query_signals(conn)
        conn.close()
        momentum_items = [r for r in results if r["strategy"] == "momentum"]
        assert len(momentum_items) == 2
        funds_in_db = {r["fund_code"] for r in momentum_items}
        assert funds_in_db == {"000001", "110001"}
        details = sorted([r["detail"] for r in momentum_items])
        assert details == ["rank_1", "rank_2"]


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
    """GET /api/signals reads from SQLite (populated by POST /api/signals/run)."""

    def _populate_db(self, client):
        """Run signals once so GET has data to read."""
        with patch("app.main.load_fund_price") as mock_load:
            mock_price = pd.DataFrame({
                "date": pd.date_range("2024-01-01", periods=50, freq="D"),
                "netvalue": [1.0] * 25 + [1.0 + i * 0.02 for i in range(25)],
            })
            mock_load.return_value = mock_price
            client.post("/api/signals/run")

    def test_signals_empty_db(self, client):
        """No data in SQLite returns empty list."""
        resp = client.get("/api/signals")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_signals_returns_list(self, client):
        self._populate_db(client)
        resp = client.get("/api/signals")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_signal_has_enriched_fields(self, client):
        self._populate_db(client)
        resp = client.get("/api/signals")
        data = resp.json()
        signal = data[0]
        assert "fund_code" in signal
        assert "fund_name" in signal
        assert "strategy_name" in signal
        assert "signal_type" in signal
        assert "confidence" in signal
        assert signal["fund_name"] != ""

    def test_filter_by_fund_code(self, client):
        self._populate_db(client)
        resp = client.get("/api/signals?fund_code=000001")
        assert resp.status_code == 200
        data = resp.json()
        for s in data:
            assert s["fund_code"] == "000001"

    def test_filter_nonexistent_fund_code(self, client):
        self._populate_db(client)
        resp = client.get("/api/signals?fund_code=nonexistent")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_sorted_by_date_fund_code(self, client):
        self._populate_db(client)
        resp = client.get("/api/signals")
        data = resp.json()
        for i in range(len(data) - 1):
            curr = data[i]
            nxt = data[i + 1]
            assert (curr["date"], curr["fund_code"]) <= (nxt["date"], nxt["fund_code"])
