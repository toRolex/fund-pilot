"""Tests for scheduler: trading session detection, status API, refresh_signals."""

from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest


@pytest.mark.parametrize("dt_str,expected", [
    # Weekday — morning session boundaries
    ("2026-07-20T09:29:59", False),   # Monday, before morning session
    ("2026-07-20T09:30:00", True),    # Monday, start of morning session
    ("2026-07-20T11:29:59", True),    # Monday, within morning session
    ("2026-07-20T11:30:00", False),   # Monday, lunch break start
    # Weekday — afternoon session boundaries
    ("2026-07-20T12:59:59", False),   # Monday, lunch break
    ("2026-07-20T13:00:00", True),    # Monday, start of afternoon session
    ("2026-07-20T14:59:59", True),    # Monday, within afternoon session
    ("2026-07-20T15:00:00", False),   # Monday, market closed
    # Weekend
    ("2026-07-18T10:00:00", False),   # Saturday
    ("2026-07-19T10:00:00", False),   # Sunday
])
def test_is_trading_time(dt_str, expected):
    from app.scheduler import is_trading_time
    dt = datetime.fromisoformat(dt_str)
    assert is_trading_time(dt) is expected


def test_scheduler_start_stop():
    """Verify scheduler starts and stops without error."""
    from app.scheduler import start, stop
    stop()  # ensure clean state
    start()
    stop()


def test_status_api_returns_fields(client):
    resp = client.get("/api/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "last_update" in data
    assert "strategies_running" in data
    assert "funds_watched" in data
    assert "connected" in data
    assert data["connected"] is True
    assert isinstance(data["strategies_running"], int)
    assert isinstance(data["funds_watched"], int)


class TestRefreshSignals:
    """refresh_signals() must call SQLite persistence AND refresh holdings."""

    @pytest.fixture(autouse=True)
    def _isolated_state(self, tmp_path):
        """Fresh watchlist, holdings, and DB for each test."""
        from app import watchlist as wl
        from app import holdings as hs
        from app.db import set_db_path

        wl_csv = tmp_path / "watchlist.csv"
        wl_csv.write_text("code,name,type\n000001,测试基金A,股票型\n")
        wl._WATCHLIST_PATH = wl_csv
        wl._WATCHLIST = {}
        wl._load()

        hs_csv = tmp_path / "holdings.csv"
        hs_csv.write_text(
            "fund_code,fund_name,shares,cost_price,current_value\n"
            "000001,测试基金A,1000.0,1.2500,1.0000\n"
        )
        hs._HOLDINGS_PATH = hs_csv
        hs._HOLDINGS = {}
        hs._load()

        set_db_path(str(tmp_path / "test_signals.db"))

        from app.scheduler import get_cache
        get_cache()["last_update"] = None
        yield

        wl._WATCHLIST_PATH = None
        wl._WATCHLIST = {}
        hs._HOLDINGS_PATH = None
        hs._HOLDINGS = {}

    # ponytail: from-import rebinds in app.holdings, patch both call sites
    @patch("app.holdings.load_fund_price")
    @patch("app.data.load_fund_price")
    def test_refresh_persists_signals_to_sqlite(self, mock_data_load, mock_holdings_load):
        """refresh_signals() must write signal_run + signal_item rows."""
        from app.db import get_connection, init_db, query_signals
        from app.scheduler import refresh_signals

        df = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=50, freq="D"),
            "netvalue": [1.0] * 25 + [1.0 + i * 0.02 for i in range(25)],
        })
        mock_data_load.return_value = df
        mock_holdings_load.return_value = df

        refresh_signals()

        conn = get_connection()
        init_db(conn)
        rows = query_signals(conn)
        conn.close()
        assert len(rows) >= 1
        assert rows[0]["fund_code"] == "000001"

    @patch("app.holdings.load_fund_price")
    @patch("app.data.load_fund_price")
    def test_refresh_updates_holdings_current_value(self, mock_data_load, mock_holdings_load):
        """refresh_signals() must update holdings.current_value from latest NAV."""
        from app import holdings as hs
        from app.scheduler import refresh_signals

        df = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=30, freq="D"),
            "netvalue": [1.0 + i * 0.01 for i in range(30)],
        })
        mock_data_load.return_value = df
        mock_holdings_load.return_value = df

        refresh_signals()

        h = hs._HOLDINGS["000001"]
        assert h.current_value == round(1.0 + 29 * 0.01, 4)

    @patch("app.holdings.load_fund_price")
    @patch("app.data.load_fund_price")
    def test_refresh_updates_last_update_cache(self, mock_data_load, mock_holdings_load):
        """refresh_signals() must update _cache["last_update"] timestamp."""
        from app.scheduler import get_cache, refresh_signals

        df = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=30, freq="D"),
            "netvalue": [1.0] * 30,
        })
        mock_data_load.return_value = df
        mock_holdings_load.return_value = df

        refresh_signals()

        assert get_cache()["last_update"] is not None

    @patch("app.data.xa")
    def test_refresh_warms_price_cache(self, mock_xa):
        """refresh_signals() populates _PRICE_CACHE so subsequent load_fund_price
        returns cached data without calling xa.fundinfo again."""
        from app.data import _PRICE_CACHE, load_fund_price
        from app.scheduler import refresh_signals

        df = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=50, freq="D"),
            "netvalue": [1.0] * 25 + [1.0 + i * 0.02 for i in range(25)],
        })
        mock_info = MagicMock()
        mock_info.price = df
        mock_xa.fundinfo.return_value = mock_info

        refresh_signals()

        assert "000001" in _PRICE_CACHE

        # Subsequent load_fund_price should hit cache, not call xa.fundinfo
        mock_xa.fundinfo.reset_mock()
        result = load_fund_price("000001")
        assert result is not None
        mock_xa.fundinfo.assert_not_called()
