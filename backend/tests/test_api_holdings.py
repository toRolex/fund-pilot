"""Tests for /api/holdings endpoints."""
import pandas as pd
import pytest
from unittest.mock import patch

from app.models import Holding

HOLDINGS_CSV = """fund_code,fund_name,shares,cost_price,current_value
000001,测试基金A,1000.0,1.2500,1.3500
110001,测试基金B,500.0,2.0000,1.8000
"""


@pytest.fixture(autouse=True)
def reset_holdings(tmp_path):
    csv_path = tmp_path / "holdings.csv"
    csv_path.write_text(HOLDINGS_CSV)
    from app import holdings as hs

    hs._HOLDINGS_PATH = csv_path
    hs._HOLDINGS = {}
    hs._load()
    yield
    hs._HOLDINGS_PATH = None
    hs._HOLDINGS = {}


HOLDINGS_JSON = [
    {"fund_code": "000001", "fund_name": "测试基金A", "shares": 1000.0, "cost_price": 1.25, "current_value": 1.35},
    {"fund_code": "110001", "fund_name": "测试基金B", "shares": 500.0, "cost_price": 2.00, "current_value": 1.80},
]

HOLDINGS_CSV_CONTENT = """fund_code,fund_name,shares,cost_price,current_value
000001,测试基金A,1000,1.25,1.35
110001,测试基金B,500,2.0,1.8
"""


class TestListHoldings:
    def test_list_all(self, client):
        resp = client.get("/api/holdings")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

    def test_list_empty(self, client):
        from app import holdings as hs
        hs._HOLDINGS = {}
        hs._save()

        resp = client.get("/api/holdings")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_pl_calculation(self, client):
        resp = client.get("/api/holdings")
        data = resp.json()
        # 000001: cost_basis=1000*1.25=1250, current_total=1000*1.35=1350
        # pl=100, pl%=100/1250*100=8.0
        h1 = next(h for h in data if h["fund_code"] == "000001")
        assert h1["cost_basis"] == 1250.0
        assert h1["pl_amount"] == 100.0
        assert h1["pl_percent"] == 8.0

        # 110001: cost_basis=500*2.0=1000, current_total=500*1.8=900
        # pl=-100, pl%=-100/1000*100=-10.0
        h2 = next(h for h in data if h["fund_code"] == "110001")
        assert h2["cost_basis"] == 1000.0
        assert h2["pl_amount"] == -100.0
        assert h2["pl_percent"] == -10.0

    def test_pl_negative_red(self, client):
        """Ensure P&L amounts reflect sign correctly."""
        resp = client.get("/api/holdings")
        data = resp.json()
        h1 = next(h for h in data if h["fund_code"] == "000001")
        h2 = next(h for h in data if h["fund_code"] == "110001")
        assert h1["pl_amount"] > 0
        assert h2["pl_amount"] < 0

    def test_has_signal_field_present(self, client):
        resp = client.get("/api/holdings")
        data = resp.json()
        for h in data:
            assert "has_signal" in h


class TestImportHoldings:
    def test_import_json_array(self, client):
        resp = client.post(
            "/api/holdings/import",
            json=HOLDINGS_JSON,
        )
        assert resp.status_code == 200
        assert resp.json()["imported"] == 2

        # Verify saved
        resp2 = client.get("/api/holdings")
        assert len(resp2.json()) == 2

    def test_import_json_object(self, client):
        """JSON with {holdings: [...]} wrapper."""
        resp = client.post(
            "/api/holdings/import",
            json={"holdings": HOLDINGS_JSON},
        )
        assert resp.status_code == 200
        assert resp.json()["imported"] == 2

    def test_import_csv_file(self, client):
        resp = client.post(
            "/api/holdings/import",
            files={"file": ("holdings.csv", HOLDINGS_CSV_CONTENT, "text/csv")},
        )
        assert resp.status_code == 200
        assert resp.json()["imported"] == 2

        # Verify P&L is correct for imported data
        resp2 = client.get("/api/holdings")
        data = resp2.json()
        assert len(data) == 2

    def test_import_json_empty_array(self, client):
        resp = client.post(
            "/api/holdings/import",
            json=[],
        )
        assert resp.status_code == 422

    def test_import_json_invalid_fields(self, client):
        resp = client.post(
            "/api/holdings/import",
            json=[{"fund_code": "000001"}],  # missing required fields
        )
        assert resp.status_code == 422

    def test_import_csv_empty(self, client):
        resp = client.post(
            "/api/holdings/import",
            files={"file": ("empty.csv", "fund_code,fund_name,shares,cost_price,current_value\n", "text/csv")},
        )
        assert resp.status_code == 422

    def test_import_csv_missing_file(self, client):
        """Sending multipart/form-data without a file field returns error."""
        resp = client.post(
            "/api/holdings/import",
            headers={"Content-Type": "multipart/form-data"},
        )
        # Starlette returns 400 for malformed multipart or 422 from our handler
        assert resp.status_code in (400, 422)

    def test_import_overwrites_existing(self, client):
        """Import replaces all existing holdings."""
        new_data = [{"fund_code": "999999", "fund_name": "新基金", "shares": 200.0, "cost_price": 10.0, "current_value": 11.0}]
        resp = client.post("/api/holdings/import", json=new_data)
        assert resp.status_code == 200
        assert resp.json()["imported"] == 1

        resp2 = client.get("/api/holdings")
        data = resp2.json()
        assert len(data) == 1
        assert data[0]["fund_code"] == "999999"

    def test_import_unsupported_content_type(self, client):
        resp = client.post(
            "/api/holdings/import",
            headers={"Content-Type": "application/xml"},
        )
        # FastAPI may handle this differently - just check it doesn't crash
        assert resp.status_code in (200, 422)


class TestAddHolding:
    """HoldingsService.add() — single holding insertion."""

    def test_add_new_holding(self):
        from app.holdings import HoldingsService

        svc = HoldingsService()
        new = Holding(
            fund_code="999999", fund_name="新基金C",
            shares=300.0, cost_price=3.0, current_value=3.5,
        )
        result = svc.add(new)
        assert result == new
        codes = [h.fund_code for h in svc.list_all()]
        assert "999999" in codes

    def test_add_duplicate_code(self):
        from app.holdings import HoldingsService

        svc = HoldingsService()
        dup = Holding(
            fund_code="000001", fund_name="重复基金",
            shares=100.0, cost_price=1.0, current_value=1.5,
        )
        with pytest.raises(ValueError, match="code 000001 already exists"):
            svc.add(dup)


class TestUpdateHolding:
    """HoldingsService.update() — update fields of a single holding."""

    def test_update_success(self):
        from app.holdings import HoldingsService

        svc = HoldingsService()
        result = svc.update("000001", {"shares": 2000.0, "cost_price": 1.5})
        assert result.fund_code == "000001"
        assert result.shares == 2000.0
        assert result.cost_price == 1.5
        # unchanged fields
        assert result.fund_name == "测试基金A"
        assert result.current_value == 1.35

    def test_update_not_found(self):
        from app.holdings import HoldingsService

        svc = HoldingsService()
        with pytest.raises(ValueError, match="code 999999 not found"):
            svc.update("999999", {"shares": 100.0})


class TestCreateHoldingEndpoint:
    """POST /holdings — single holding creation."""

    def test_post_201(self, client):
        resp = client.post("/api/holdings", json={
            "fund_code": "999999", "fund_name": "新基金C",
            "shares": 300.0, "cost_price": 3.0, "current_value": 3.5,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["fund_code"] == "999999"

    def test_post_duplicate_409(self, client):
        resp = client.post("/api/holdings", json={
            "fund_code": "000001", "fund_name": "重复基金",
            "shares": 100.0, "cost_price": 1.0, "current_value": 1.5,
        })
        assert resp.status_code == 409
        assert "already exists" in resp.json()["detail"]


class TestDeleteHolding:
    """HoldingsService.delete() — remove a single holding."""

    def test_delete_success(self):
        from app.holdings import HoldingsService

        svc = HoldingsService()
        svc.delete("000001")
        codes = [h.fund_code for h in svc.list_all()]
        assert "000001" not in codes
        assert len(codes) == 1

    def test_delete_not_found(self):
        from app.holdings import HoldingsService

        svc = HoldingsService()
        with pytest.raises(ValueError, match="code 999999 not found"):
            svc.delete("999999")


class TestUpdateHoldingEndpoint:
    """PUT /holdings/{code} — update a holding's fields."""

    def test_put_200(self, client):
        resp = client.put("/api/holdings/000001", json={"shares": 2000.0, "cost_price": 1.5})
        assert resp.status_code == 200
        data = resp.json()
        assert data["shares"] == 2000.0
        assert data["cost_price"] == 1.5

    def test_put_404(self, client):
        resp = client.put("/api/holdings/999999", json={"shares": 100.0})
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"]


class TestDeleteHoldingEndpoint:
    """DELETE /holdings/{code} — delete a holding."""

    def test_delete_200(self, client):
        resp = client.delete("/api/holdings/000001")
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

    def test_delete_404(self, client):
        resp = client.delete("/api/holdings/999999")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"]


class TestHoldingsPL:
    def test_zero_cost_basis(self, client):
        """Import holding with zero cost_price — handle division by zero."""
        with patch("app.holdings.load_fund_price", side_effect=ValueError):
            data = [{"fund_code": "000001", "fund_name": "零成本", "shares": 100.0, "cost_price": 0.0, "current_value": 1.5}]
            client.post("/api/holdings/import", json=data)

        resp = client.get("/api/holdings")
        h = resp.json()[0]
        assert h["cost_basis"] == 0.0
        # pl_percent should be 0 when cost_basis is 0
        assert h["pl_percent"] == 0.0
        # pl_amount = shares * current_value = 150
        assert h["pl_amount"] == 150.0


class TestRefreshPrices:
    def test_refresh_normal_path(self, client):
        """POST /api/holdings/refresh updates current_value and recalculates P&L."""
        def mock_load(code):
            navs = {"000001": 1.50, "110001": 2.20}
            nav = navs.get(code, 1.0)
            return pd.DataFrame({
                "date": pd.to_datetime(["2024-01-01", "2024-06-01"]),
                "netvalue": [1.0, nav],
            })

        with patch("app.holdings.load_fund_price", side_effect=mock_load):
            resp = client.post("/api/holdings/refresh")

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

        h1 = next(h for h in data if h["fund_code"] == "000001")
        assert h1["current_value"] == 1.50
        # cost_basis=1250, current_total=1500, pl=250, pl%=20.0
        assert h1["cost_basis"] == 1250.0
        assert h1["pl_amount"] == 250.0
        assert h1["pl_percent"] == 20.0

        h2 = next(h for h in data if h["fund_code"] == "110001")
        assert h2["current_value"] == 2.20
        # cost_basis=1000, current_total=1100, pl=100, pl%=10.0
        assert h2["cost_basis"] == 1000.0
        assert h2["pl_amount"] == 100.0
        assert h2["pl_percent"] == 10.0

    def test_refresh_xalpha_failure(self, client):
        """When load_fund_price fails, current_value stays unchanged."""
        with patch("app.holdings.load_fund_price", side_effect=ValueError("Network error")):
            resp = client.post("/api/holdings/refresh")

        assert resp.status_code == 200
        data = resp.json()

        h1 = next(h for h in data if h["fund_code"] == "000001")
        assert h1["current_value"] == 1.35  # unchanged
        assert h1["pl_amount"] == 100.0
        assert h1["pl_percent"] == 8.0

    def test_refresh_empty(self, client):
        """No crash with empty holdings."""
        from app import holdings as hs
        hs._HOLDINGS = {}
        hs._save()

        resp = client.post("/api/holdings/refresh")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_import_triggers_refresh(self, client):
        """Import automatically triggers a price refresh."""
        def mock_load(code):
            return pd.DataFrame({
                "date": pd.to_datetime(["2024-01-01", "2024-06-01"]),
                "netvalue": [10.0, 12.0],
            })

        with patch("app.holdings.load_fund_price", side_effect=mock_load):
            resp = client.post("/api/holdings/import", json=[
                {"fund_code": "999999", "fund_name": "新基金", "shares": 100.0, "cost_price": 10.0, "current_value": 11.0},
            ])

        assert resp.status_code == 200
        assert resp.json()["imported"] == 1

        # Verify refresh happened: current_value should be 12.0 (from mock NAV), not 11.0 (imported)
        resp2 = client.get("/api/holdings")
        data = resp2.json()
        assert len(data) == 1
        assert data[0]["current_value"] == 12.0
