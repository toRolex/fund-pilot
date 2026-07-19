"""Tests for /api/funds endpoints."""
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


class TestAddFund:
    @patch("app.main.xa")
    def test_add_fund_201(self, mock_xa, client):
        mock_fund = MagicMock()
        mock_fund.info = {"name": "新基金", "fund_type": "股票型"}
        mock_xa.mfund.return_value = mock_fund

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
        mock_xa.mfund.side_effect = ValueError("invalid fund code")

        resp = client.post("/api/funds", json={"code": "999999"})
        assert resp.status_code == 422

    @patch("app.main.xa")
    def test_add_duplicate_409(self, mock_xa, client):
        mock_fund = MagicMock()
        mock_fund.info = {"name": "重复", "fund_type": "股票型"}
        mock_xa.mfund.return_value = mock_fund

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
    def test_search_by_code(self, client):
        resp = client.get("/api/funds/search?q=000001")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["code"] == "000001"

    def test_search_by_name(self, client):
        resp = client.get("/api/funds/search?q=测试基金A")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1

    def test_search_no_results(self, client):
        resp = client.get("/api/funds/search?q=不存在")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_search_empty_query(self, client):
        resp = client.get("/api/funds/search?q=")
        assert resp.status_code == 200
        assert len(resp.json()) == 2
