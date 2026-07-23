"""Tests for the merged GET /api/funds/{code}/detail endpoint."""
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


class TestFundDetailMerged:
    ENDPOINT = "/api/funds/000001/detail"

    @patch("app.main.load_fund_price")
    def test_returns_all_sections(self, mock_load, client):
        """Response has detail, nav, signals, strategies — each with expected types."""
        mock_load.return_value = make_price_df()
        resp = client.get(self.ENDPOINT)
        assert resp.status_code == 200
        data = resp.json()

        assert "detail" in data
        assert "nav" in data
        assert "signals" in data
        assert "strategies" in data

        # detail fields
        d = data["detail"]
        assert d["code"] == "000001"
        assert d["name"] == "测试基金A"
        assert "latest_nav" in d
        assert "daily_change" in d

        # nav is a list of points
        assert isinstance(data["nav"], list)
        if data["nav"]:
            assert "date" in data["nav"][0]
            assert "netvalue" in data["nav"][0]

        # signals is a list
        assert isinstance(data["signals"], list)

        # strategies is a list with enabled/disabled
        assert isinstance(data["strategies"], list)
        for s in data["strategies"]:
            assert "name" in s
            assert "enabled" in s

    def test_not_found(self, client):
        resp = client.get("/api/funds/999999/detail")
        assert resp.status_code == 404
        assert "not found" in resp.text.lower()

    @patch("app.main.load_fund_price")
    def test_nav_length_matches(self, mock_load, client):
        """NAV array length matches the mock price data."""
        mock_load.return_value = make_price_df(n_days=30)
        resp = client.get(self.ENDPOINT)
        data = resp.json()
        assert len(data["nav"]) == 30
        assert data["nav"][0]["date"] == "2024-01-01"

    @patch("app.main.get_fund_info")
    @patch("app.main.load_fund_price")
    def test_detail_info_enrichment(self, mock_load, mock_info, client):
        """Fund detail pulls fund_type/scale/established_date from info."""
        mock_load.return_value = make_price_df()
        mock_info.return_value = {
            "name": "测试基金A",
            "fund_type": "股票型",
            "fund_scale": 12.5,
            "established_date": "2020-01-01",
        }
        resp = client.get(self.ENDPOINT)
        d = resp.json()["detail"]
        assert d["type"] == "股票型"
        assert d["scale"] == 12.5
        assert d["established_date"] == "2020-01-01"
