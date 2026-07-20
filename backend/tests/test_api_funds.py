"""Tests for /api/funds endpoints."""
import pytest
from unittest.mock import MagicMock, patch

import pandas as pd


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


class TestListFunds:
    def test_list_all(self, client):
        resp = client.get("/api/funds")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["code"] == "000001"

    def test_list_empty(self, client):
        from app import watchlist as wl
        wl._WATCHLIST = {}
        wl._save()

        resp = client.get("/api/funds")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_sort_by_name_asc(self, client):
        resp = client.get("/api/funds?sort_by=name&sort_dir=asc")
        data = resp.json()
        assert data[0]["code"] == "000001"  # 测试基金A < 测试基金B (asc)

    def test_sort_by_name_desc(self, client):
        resp = client.get("/api/funds?sort_by=name&sort_dir=desc")
        data = resp.json()
        assert data[0]["code"] == "110001"  # 测试基金B > 测试基金A (desc)

    def test_sort_by_code_desc(self, client):
        resp = client.get("/api/funds?sort_by=code&sort_dir=desc")
        data = resp.json()
        assert data[0]["code"] == "110001"

    @patch("app.main.load_fund_price")
    def test_list_enriched_fields(self, mock_load, client):
        """GET /api/funds should return enriched fields (daily_change, signal_type, etc)."""
        mock_price = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=50, freq="D"),
            "netvalue": [1.0] * 25 + [1.0 + i * 0.02 for i in range(25)],
        })
        mock_load.return_value = mock_price

        resp = client.get("/api/funds")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        for item in data:
            assert "code" in item
            assert "name" in item
            assert "daily_change" in item
            assert "signal_type" in item
            assert "strategy_name" in item
            assert "confidence" in item
        # With uptrend price data, at least one fund should have a buy signal
        assert any(item["signal_type"] != "hold" for item in data)


class TestAddFund:
    @patch("app.main.xa")
    def test_add_fund_201(self, mock_xa, client):
        mock_fund = MagicMock()
        mock_fund.name = "新基金"
        mock_xa.fundinfo.return_value = mock_fund

        resp = client.post("/api/funds", json={"code": "000002"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["code"] == "000002"
        assert data["name"] == "新基金"

    def test_add_fund_missing_code_422(self, client):
        resp = client.post("/api/funds", json={})
        assert resp.status_code == 422

    @patch("app.main.xa")
    def test_add_invalid_code_422(self, mock_xa, client):
        mock_xa.fundinfo.side_effect = ValueError("invalid fund code")

        resp = client.post("/api/funds", json={"code": "999999"})
        assert resp.status_code == 422

    @patch("app.main.xa")
    def test_add_duplicate_409(self, mock_xa, client):
        mock_fund = MagicMock()
        mock_fund.name = "重复"
        mock_xa.fundinfo.return_value = mock_fund

        resp = client.post("/api/funds", json={"code": "000001"})
        assert resp.status_code == 409
        assert "already" in resp.text.lower()


class TestRemoveFund:
    def test_remove_existing_200(self, client):
        resp = client.delete("/api/funds/000001")
        assert resp.status_code == 200
        assert resp.json()["code"] == "000001"

    def test_remove_nonexistent_404(self, client):
        resp = client.delete("/api/funds/000999")
        assert resp.status_code == 404
        assert "not found" in resp.text.lower()


class TestSearchFunds:
    @patch("app.main.xa")
    def test_search_by_code_watched(self, mock_xa, client):
        mock_fi = MagicMock()
        mock_fi.name = "测试基金A"
        mock_xa.fundinfo.return_value = mock_fi

        resp = client.get("/api/funds/search?q=000001")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["code"] == "000001"
        assert data[0]["is_watched"] is True

    @patch("app.main.xa")
    def test_search_by_code_not_watched(self, mock_xa, client):
        mock_fi = MagicMock()
        mock_fi.name = "新发现基金"
        mock_xa.fundinfo.return_value = mock_fi

        resp = client.get("/api/funds/search?q=999999")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["code"] == "999999"
        assert data[0]["is_watched"] is False

    @patch("app.main.xa")
    def test_search_by_name(self, mock_xa, client):
        resp = client.get("/api/funds/search?q=测试基金A")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["is_watched"] is True

    @patch("app.main.xa")
    def test_search_no_results(self, mock_xa, client):
        resp = client.get("/api/funds/search?q=不存在")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("app.main.xa")
    def test_search_empty_query(self, mock_xa, client):
        resp = client.get("/api/funds/search?q=")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("app.main.xa")
    def test_search_partial_code(self, mock_xa, client):
        """Partial numeric code falls back to watchlist search when xa raises."""
        mock_xa.fundinfo.side_effect = Exception("invalid")
        resp = client.get("/api/funds/search?q=000001")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["code"] == "000001"
        assert data[0]["is_watched"] is True

    @patch("app.main.xa")
    def test_search_partial_name(self, mock_xa, client):
        """Name partial match finds from watchlist."""
        resp = client.get("/api/funds/search?q=基金A")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["code"] == "000001"
        assert data[0]["is_watched"] is True
