"""Tests for /api/holdings endpoints."""
import pytest
from unittest.mock import patch

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


class TestHoldingsPL:
    def test_zero_cost_basis(self, client):
        """Import holding with zero cost_price — handle division by zero."""
        data = [{"fund_code": "000001", "fund_name": "零成本", "shares": 100.0, "cost_price": 0.0, "current_value": 1.5}]
        client.post("/api/holdings/import", json=data)

        resp = client.get("/api/holdings")
        h = resp.json()[0]
        assert h["cost_basis"] == 0.0
        # pl_percent should be 0 when cost_basis is 0
        assert h["pl_percent"] == 0.0
        # pl_amount = shares * current_value = 150
        assert h["pl_amount"] == 150.0
