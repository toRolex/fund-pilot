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


class TestPriceCache:
    """_PRICE_CACHE: cache hit → no xa.fundinfo call; expired → refetch."""

    def test_cache_hit_returns_cached(self):
        """Fresh cache entry → load_fund_price returns cached DataFrame without calling xa.fundinfo."""
        from app.data import _PRICE_CACHE, load_fund_price

        mock_price = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=2, freq="D"),
            "netvalue": [1.0, 1.1],
        })
        _PRICE_CACHE["000001"] = (9999999999.0, mock_price)  # far-future timestamp

        with patch("app.data.xa") as mock_xa:
            result = load_fund_price("000001")

        mock_xa.fundinfo.assert_not_called()
        pd.testing.assert_frame_equal(result, mock_price)
        _PRICE_CACHE.clear()

    def test_cache_expired_refetches(self):
        """Expired cache entry → load_fund_price calls xa.fundinfo and refreshes cache."""
        from app.data import _PRICE_CACHE, load_fund_price

        old_price = pd.DataFrame({
            "date": pd.date_range("2023-01-01", periods=2, freq="D"),
            "netvalue": [0.5, 0.6],
        })
        _PRICE_CACHE["000001"] = (0.0, old_price)  # expired timestamp

        mock_price = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=2, freq="D"),
            "netvalue": [1.0, 1.1],
        })
        mock_info = MagicMock()
        mock_info.price = mock_price

        with patch("app.data.xa") as mock_xa:
            mock_xa.fundinfo.return_value = mock_info
            result = load_fund_price("000001")

        mock_xa.fundinfo.assert_called_once_with("000001")
        pd.testing.assert_frame_equal(result, mock_price)
        _PRICE_CACHE.clear()

    def test_cache_ttl_trading_vs_nontrading(self):
        """Trading hours → 300s TTL; non-trading → 3600s TTL."""
        from app import scheduler
        from app.data import _PRICE_CACHE, _get_ttl

        with patch("app.scheduler.is_trading_time", return_value=True):
            assert _get_ttl() == 300

        with patch("app.scheduler.is_trading_time", return_value=False):
            assert _get_ttl() == 3600

        _PRICE_CACHE.clear()

    def test_cache_miss_falls_back_to_csv(self, tmp_path):
        """No cache entry + xa fails → CSV fallback still works."""
        from app.data import _PRICE_CACHE, load_fund_price

        prices_dir = tmp_path / "prices"
        prices_dir.mkdir(parents=True)
        csv_path = prices_dir / "000001.csv"
        csv_path.write_text("date,netvalue\n2024-01-01,1.0\n2024-01-02,1.1\n")

        with patch("app.data.DATA_DIR", tmp_path):
            with patch("app.data.xa") as mock_xa:
                mock_xa.fundinfo.side_effect = ValueError("network error")
                result = load_fund_price("000001")

        assert isinstance(result, pd.DataFrame)
        assert len(result) == 2
        _PRICE_CACHE.clear()


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
