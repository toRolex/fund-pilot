"""Tests for strategy registry and indicator_cross."""
import pandas as pd
import pytest


@pytest.fixture
def price_df_uptrend():
    """Price flat then up — short MA crosses above long MA (buy signal)."""
    dates = pd.date_range("2024-01-01", periods=50, freq="D")
    nav = [1.0] * 25 + [1.0 + i * 0.02 for i in range(25)]
    return pd.DataFrame({"date": dates, "netvalue": nav})


@pytest.fixture
def price_df_downtrend():
    """Price up then down — short MA crosses below long MA (sell signal)."""
    dates = pd.date_range("2024-01-01", periods=50, freq="D")
    nav = [2.0 + i * 0.02 for i in range(25)] + [2.5 - i * 0.02 for i in range(25)]
    return pd.DataFrame({"date": dates, "netvalue": nav})


@pytest.fixture
def price_df_cross_once():
    """Price flat then jumps up — single buy cross."""
    dates = pd.date_range("2024-01-01", periods=50, freq="D")
    nav = [1.0] * 20 + [1.5 + i * 0.005 for i in range(30)]
    return pd.DataFrame({"date": dates, "netvalue": nav})


class TestIndicatorCross:
    def test_uptrend_generates_buy(self, price_df_uptrend):
        from app.strategies import indicator_cross

        signals = indicator_cross(price_df_uptrend, {"short_window": 5, "long_window": 10, "totmoney": 1000})
        assert len(signals) >= 1
        buy_signals = [s for s in signals if s.signal_type.value == "buy"]
        assert len(buy_signals) >= 1

    def test_downtrend_generates_sell(self, price_df_downtrend):
        from app.strategies import indicator_cross

        signals = indicator_cross(price_df_downtrend, {"short_window": 5, "long_window": 10, "totmoney": 1000})
        sell_signals = [s for s in signals if s.signal_type.value == "sell"]
        assert len(sell_signals) >= 1

    def test_default_params(self, price_df_cross_once):
        from app.strategies import indicator_cross

        signals = indicator_cross(price_df_cross_once)
        assert len(signals) >= 1
        # With default 5/20 windows, price jump at index 20 should trigger buy
        buy_signals = [s for s in signals if s.signal_type.value == "buy"]
        assert len(buy_signals) >= 1

    def test_signal_has_date_and_strategy_name(self, price_df_cross_once):
        from app.strategies import indicator_cross

        signals = indicator_cross(price_df_cross_once)
        for s in signals:
            assert s.date != ""
            assert s.strategy_name == "indicator_cross"

    def test_missing_netvalue_raises(self):
        from app.strategies import indicator_cross

        df = pd.DataFrame({"date": ["2024-01-01"], "price": [1.0]})
        with pytest.raises(ValueError, match="netvalue"):
            indicator_cross(df)


class TestRegistry:
    def test_list_strategies_returns_indicator_cross(self):
        from app.strategies import list_strategies

        strategies = list_strategies()
        names = [s.name for s in strategies]
        assert "indicator_cross" in names

    def test_strategy_meta_has_params_schema(self):
        from app.strategies import list_strategies

        strategies = list_strategies()
        cross = [s for s in strategies if s.name == "indicator_cross"][0]
        assert cross.description != ""
        assert "short_window" in cross.params_schema
        assert cross.params_schema["short_window"]["default"] == 5
        assert cross.params_schema["long_window"]["default"] == 20

    def test_get_strategy_by_name(self):
        from app.strategies import get_strategy

        fn = get_strategy("indicator_cross")
        assert callable(fn)

    def test_get_strategy_nonexistent_raises(self):
        from app.strategies import get_strategy

        with pytest.raises(KeyError, match="nonexistent"):
            get_strategy("nonexistent")
