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
        mock_xa.mfund.return_value = mock_info
        result = load_fund_price("000001")

    assert isinstance(result, pd.DataFrame)
    assert "date" in result.columns
    assert "netvalue" in result.columns
    assert len(result) == 3


def test_load_fund_price_propagates_error():
    """load_fund_price should propagate xalpha errors."""
    from app.data import load_fund_price

    with patch("app.data.xa") as mock_xa:
        mock_xa.mfund.side_effect = ValueError("network error")
        with pytest.raises(ValueError, match="network error"):
            load_fund_price("000001")
