"""End-to-end integration test for the full workflow.

Covers the chained flow: add fund → run multi-strategy signals → read signal
history from SQLite → import holdings → refresh holdings → query QDII.

All external dependencies (xalpha network, local CSV caches) are mocked.
"""
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest


# ── Shared price mock ────────────────────────────────────────────────────────
# Uptrend data (50 days) so indicator_cross produces at least one buy signal.
def _uptrend_df(n_days: int = 50) -> pd.DataFrame:
    return pd.DataFrame({
        "date": pd.date_range("2024-01-01", periods=n_days, freq="D"),
        "netvalue": [1.0] * 25 + [1.0 + i * 0.02 for i in range(n_days - 25)],
    })


def _downtrend_df(n_days: int = 50) -> pd.DataFrame:
    return pd.DataFrame({
        "date": pd.date_range("2024-01-01", periods=n_days, freq="D"),
        "netvalue": [1.5 - i * 0.01 for i in range(n_days)],
    })


# ── Shared fixtures ──────────────────────────────────────────────────────────
@pytest.fixture
def e2e_state(tmp_path):
    """Set up fresh watchlist + holdings CSVs for the E2E test."""
    watchlist_csv = tmp_path / "watchlist.csv"
    watchlist_csv.write_text("code,name,type\n")

    holdings_csv = tmp_path / "holdings.csv"
    holdings_csv.write_text("fund_code,fund_name,shares,cost_price,current_value\n")

    from app import watchlist as wl
    from app import holdings as hs

    wl._WATCHLIST_PATH = watchlist_csv
    wl._WATCHLIST = {}
    wl._load()

    hs._HOLDINGS_PATH = holdings_csv
    hs._HOLDINGS = {}
    hs._load()

    yield {
        "watchlist_path": watchlist_csv,
        "holdings_path": holdings_csv,
    }

    wl._WATCHLIST_PATH = None
    wl._WATCHLIST = {}
    hs._HOLDINGS_PATH = None
    hs._HOLDINGS = {}


# ── E2E test class ──────────────────────────────────────────────────────────
class TestEndToEndWorkflow:
    """Verify the full workflow from adding a fund to querying QDII predictions."""

    # ponytail: from-import rebinds in app.holdings / app.main, patch all three call sites
    @patch("app.main.load_fund_price")
    @patch("app.holdings.load_fund_price")
    @patch("app.data.load_fund_price")
    @patch("app.main.get_fund_info")
    @patch("app.main.xa")
    def test_full_workflow(self, mock_xa, mock_get_info, mock_data_load, mock_holdings_load, mock_main_load, client, e2e_state):
        """Run the complete user workflow and verify each step's outcome."""

        # 1. Add a real fund (mock get_fund_info so no network call).
        mock_get_info.return_value = {
            "name": "汇添富中证主要消费ETF",
            "fund_type": "股票型",
            "fund_scale": 5.0,
            "established_date": "2015-01-01",
        }

        # Mock price data for the new fund: uptrend to trigger buy signals.
        mock_data_load.return_value = _uptrend_df()
        mock_holdings_load.return_value = _uptrend_df()
        mock_main_load.return_value = _uptrend_df()

        resp = client.post("/api/funds", json={"code": "000001"})
        assert resp.status_code == 201, resp.text
        fund = resp.json()
        assert fund["code"] == "000001"
        assert fund["name"] == "汇添富中证主要消费ETF"

        # Verify it shows up in the watchlist
        resp = client.get("/api/funds")
        assert resp.status_code == 200
        funds = resp.json()
        assert len(funds) == 1
        assert funds[0]["code"] == "000001"

        # 2. Run all multi-strategy signals (trigger strategy engine).
        resp = client.post("/api/signals/run")
        assert resp.status_code == 200
        runs = resp.json()
        assert runs["status"] == "completed"
        # All four strategies should have produced a run
        run_strategies = {r["strategy"] for r in runs["runs"]}
        assert {"indicator_cross", "pe_percentile", "grid", "momentum"} <= run_strategies
        # Each run should have a status of "completed"
        for r in runs["runs"]:
            assert r["status"] == "completed"

        # 3. Query signals from SQLite — verify the persistence worked.
        resp = client.get("/api/signals")
        assert resp.status_code == 200
        signals = resp.json()
        assert isinstance(signals, list)
        assert len(signals) >= 1, "Signals should be persisted to SQLite"

        # Each signal has the enriched fields
        for s in signals:
            assert s["fund_code"] == "000001"
            assert s["fund_name"] == "汇添富中证主要消费ETF"
            assert s["strategy_name"] in {"indicator_cross", "pe_percentile", "grid", "momentum"}
            assert s["signal_type"] in {"buy", "sell", "hold"}
            assert "date" in s
            assert "confidence" in s
            assert "daily_change" in s

        # Filter by fund_code also works
        resp = client.get("/api/signals?fund_code=000001")
        assert resp.status_code == 200
        filtered = resp.json()
        assert all(s["fund_code"] == "000001" for s in filtered)
        assert len(filtered) == len(signals)

        # 4. Import holdings (mock CSV upload).
        csv_content = (
            "fund_code,fund_name,shares,cost_price,current_value\n"
            "000001,汇添富中证主要消费ETF,1000.0,1.2500,1.3500\n"
        )
        # Mock the holdings price loader so the post-import refresh works
        mock_holdings_load.return_value = _uptrend_df()

        resp = client.post(
            "/api/holdings/import",
            files={"file": ("holdings.csv", csv_content, "text/csv")},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["imported"] == 1

        # Verify holdings shows up
        resp = client.get("/api/holdings")
        assert resp.status_code == 200
        holdings = resp.json()
        assert len(holdings) == 1
        assert holdings[0]["fund_code"] == "000001"
        # P&L should be positive (current > cost)
        assert holdings[0]["pl_amount"] > 0
        assert holdings[0]["has_signal"] is True  # has_signal depends on strategies

        # 5. Refresh holdings — verify NAV is updated and P&L recalculated.
        # Make the latest NAV clearly different from cost.
        nav_df = pd.DataFrame({
            "date": pd.to_datetime(["2024-01-01", "2024-06-01"]),
            "netvalue": [1.0, 1.50],
        })
        mock_holdings_load.return_value = nav_df

        resp = client.post("/api/holdings/refresh")
        assert resp.status_code == 200
        refreshed = resp.json()
        assert len(refreshed) == 1
        h = refreshed[0]
        assert h["fund_code"] == "000001"
        # current_value was updated to 1.50 from the latest NAV
        assert h["current_value"] == 1.50
        # cost_basis = 1000 * 1.25 = 1250
        assert h["cost_basis"] == 1250.0
        # current_total = 1000 * 1.50 = 1500
        # pl_amount = 1500 - 1250 = 250
        assert h["pl_amount"] == 250.0
        # pl_percent = 250/1250*100 = 20.0
        assert h["pl_percent"] == 20.0

        # 6. Query QDII prediction (mock xalpha.QDIIPredict).
        mock_qdii_instance = MagicMock()
        mock_qdii_instance.get_t1.return_value = (1.2345, "2026-07-17")
        mock_qdii_instance.get_t0.return_value = (1.2567, "2026-07-20")
        mock_xa.QDIIPredict.return_value = mock_qdii_instance

        resp = client.get("/api/qdii/SH501018")
        assert resp.status_code == 200
        qdii = resp.json()
        assert qdii["code"] == "SH501018"
        assert qdii["t1_value"] == 1.2345
        assert qdii["t1_date"] == "2026-07-17"
        assert qdii["t0_value"] == 1.2567
        assert qdii["t0_date"] == "2026-07-20"
        # xalpha.QDIIPredict was actually invoked
        mock_xa.QDIIPredict.assert_called_with("SH501018")

    # ponytail: from-import rebinds in app.holdings / app.main, patch all three call sites
    @patch("app.main.load_fund_price")
    @patch("app.holdings.load_fund_price")
    @patch("app.data.load_fund_price")
    @patch("app.main.get_fund_info")
    def test_multi_fund_workflow(self, mock_get_info, mock_data_load, mock_holdings_load, mock_main_load, client, e2e_state):
        """E2E with multiple funds: watchlist expansion + multi-fund momentum."""
        # Mock fund info lookups
        fund_names = {
            "000001": "基金A",
            "110001": "基金B",
        }

        def fundinfo_side_effect(code):
            return {"name": fund_names.get(code, "未知基金"), "fund_type": "混合型"}

        mock_get_info.side_effect = fundinfo_side_effect

        # Two funds: one uptrend, one downtrend
        def load_side_effect(code):
            return _downtrend_df() if code == "110001" else _uptrend_df()

        mock_data_load.side_effect = load_side_effect
        mock_holdings_load.side_effect = load_side_effect
        mock_main_load.side_effect = load_side_effect

        # Add both funds
        for code in ("000001", "110001"):
            resp = client.post("/api/funds", json={"code": code})
            assert resp.status_code == 201, f"Add {code} failed: {resp.text}"

        # Verify both in watchlist
        resp = client.get("/api/funds")
        codes = {f["code"] for f in resp.json()}
        assert codes == {"000001", "110001"}

        # Run signals — momentum should rank both funds
        resp = client.post("/api/signals/run")
        assert resp.status_code == 200
        runs = resp.json()
        momentum_run = next(r for r in runs["runs"] if r["strategy"] == "momentum")
        assert momentum_run["signal_count"] == 2  # one per fund

        # SQLite should have signals for both funds
        resp = client.get("/api/signals")
        signals = resp.json()
        signal_codes = {s["fund_code"] for s in signals}
        assert "000001" in signal_codes
        assert "110001" in signal_codes

        # Import holdings for both
        holdings_payload = [
            {"fund_code": "000001", "fund_name": "基金A",
             "shares": 1000.0, "cost_price": 1.25, "current_value": 1.35},
            {"fund_code": "110001", "fund_name": "基金B",
             "shares": 500.0, "cost_price": 2.00, "current_value": 1.80},
        ]
        resp = client.post("/api/holdings/import", json=holdings_payload)
        assert resp.status_code == 200
        assert resp.json()["imported"] == 2

        # Refresh updates current_value for both
        nav_map = {"000001": 1.50, "110001": 2.20}

        def nav_side_effect(code):
            nav = nav_map.get(code, 1.0)
            return pd.DataFrame({
                "date": pd.to_datetime(["2024-01-01", "2024-06-01"]),
                "netvalue": [1.0, nav],
            })

        mock_holdings_load.side_effect = nav_side_effect
        resp = client.post("/api/holdings/refresh")
        assert resp.status_code == 200
        refreshed = {h["fund_code"]: h for h in resp.json()}
        assert refreshed["000001"]["current_value"] == 1.50
        assert refreshed["110001"]["current_value"] == 2.20

    @patch("app.main.load_fund_price")
    @patch("app.data.load_fund_price")
    @patch("app.main.get_fund_info")
    @patch("app.main.xa")
    def test_qdii_failure_does_not_break_other_flows(
        self, mock_xa, mock_get_info, mock_data_load, mock_main_load, client, e2e_state
    ):
        """A QDII failure is isolated — does not corrupt watchlist/signals/holdings."""
        # Add a fund and run signals first
        mock_get_info.return_value = {"name": "测试基金"}
        mock_data_load.return_value = _uptrend_df()
        mock_main_load.return_value = _uptrend_df()

        client.post("/api/funds", json={"code": "000001"})
        client.post("/api/signals/run")

        # Now configure QDIIPredict to fail
        mock_xa.QDIIPredict.side_effect = ValueError(
            "Please provide t1dict for prediction"
        )

        # QDII endpoint returns 422
        resp = client.get("/api/qdii/999999")
        assert resp.status_code == 422

        # Other endpoints are unaffected
        resp = client.get("/api/funds")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

        resp = client.get("/api/signals")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
