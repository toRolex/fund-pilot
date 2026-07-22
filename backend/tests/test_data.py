"""Test xalpha CSV backend initialization and data loading."""
import pandas as pd
import pytest
from unittest.mock import MagicMock, patch


def test_xalpha_csv_backend_works():
    """set_backend(backend='csv') should not raise."""
    # ponytail: global backend, ok for single-user local app
    import xalpha as xa
    xa.set_backend(backend="csv")


def test_load_fund_price_returns_dataframe():
    """load_fund_price should return a DataFrame with date and netvalue columns."""
    from app.data import load_fund_price

    mock_price = pd.DataFrame({
        "date": pd.date_range("2024-01-01", periods=3, freq="D"),
        "netvalue": [1.0, 1.1, 1.2],
    })
    mock_info = MagicMock()
    mock_info.price = mock_price

    with patch("app.data.xa") as mock_xa:
        mock_xa.fundinfo.return_value = mock_info
        result = load_fund_price("000001")

    assert isinstance(result, pd.DataFrame)
    assert "date" in result.columns
    assert "netvalue" in result.columns
    assert len(result) == 3


def test_load_fund_price_fallback_to_csv(tmp_path):
    """When xalpha fails, load_fund_price should fall back to local CSV."""
    from app.data import load_fund_price

    # Create a price CSV in the data/prices directory
    prices_dir = tmp_path / "prices"
    prices_dir.mkdir(parents=True)
    csv_path = prices_dir / "000001.csv"
    csv_path.write_text("date,netvalue\n2024-01-01,1.0\n2024-01-02,1.1\n")

    # Patch DATA_DIR to point to tmp_path
    with patch("app.data.DATA_DIR", tmp_path):
        with patch("app.data.xa") as mock_xa:
            mock_xa.fundinfo.side_effect = ValueError("xalpha failed")
            result = load_fund_price("000001")

    assert isinstance(result, pd.DataFrame)
    assert "date" in result.columns
    assert "netvalue" in result.columns
    assert len(result) == 2


def test_load_fund_price_propagates_error():
    """load_fund_price should propagate error when xalpha fails and no CSV fallback."""
    from app.data import load_fund_price

    with patch("app.data.xa") as mock_xa:
        mock_xa.fundinfo.side_effect = ValueError("network error")
        with pytest.raises(ValueError, match="Failed to load price data"):
            load_fund_price("000001")


class TestLoadAllPrices:
    def test_returns_prices_for_funds(self):
        from app.data import load_all_prices

        funds = [type("Fund", (), {"code": "000001"})(), type("Fund", (), {"code": "000002"})()]
        mock_price = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=3, freq="D"),
            "netvalue": [1.0, 1.1, 1.2],
        })
        mock_info = MagicMock()
        mock_info.price = mock_price

        with patch("app.data.xa") as mock_xa:
            mock_xa.fundinfo.return_value = mock_info
            result = load_all_prices(funds)

        assert set(result.keys()) == {"000001", "000002"}
        assert all(isinstance(v, pd.DataFrame) for v in result.values())

    def test_skips_failed_funds(self):
        from app.data import load_all_prices

        funds = [type("Fund", (), {"code": "000001"})(), type("Fund", (), {"code": "000002"})()]

        def mock_fundinfo(code):
            if code == "000002":
                raise ValueError("fail")
            info = MagicMock()
            info.price = pd.DataFrame({
                "date": pd.date_range("2024-01-01", periods=2, freq="D"),
                "netvalue": [1.0, 1.1],
            })
            return info

        with patch("app.data.xa") as mock_xa:
            mock_xa.fundinfo.side_effect = mock_fundinfo
            result = load_all_prices(funds)

        assert list(result.keys()) == ["000001"]

    def test_empty_funds_returns_empty(self):
        from app.data import load_all_prices

        result = load_all_prices([])
        assert result == {}
