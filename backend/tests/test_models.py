"""Tests for Fund data model."""
import pytest
from pydantic import ValidationError


def test_fund_required_fields():
    from app.models import Fund

    fund = Fund(code="000001", name="测试基金")
    assert fund.code == "000001"
    assert fund.name == "测试基金"


def test_fund_missing_code_raises():
    from app.models import Fund

    with pytest.raises(ValidationError):
        Fund(name="测试基金")


def test_fund_optional_type_defaults_to_none():
    from app.models import Fund

    fund = Fund(code="000001", name="测试基金")
    assert fund.type is None


class TestSignal:
    def test_signal_required_fields(self):
        from app.models import Signal, SignalType

        s = Signal(date="2024-01-15", fund_code="000001",
                   strategy_name="indicator_cross", signal_type=SignalType.buy)
        assert s.date == "2024-01-15"
        assert s.fund_code == "000001"
        assert s.strategy_name == "indicator_cross"
        assert s.signal_type == SignalType.buy
        assert s.confidence == 0.0

    def test_signal_with_confidence(self):
        from app.models import Signal, SignalType

        s = Signal(date="2024-01-15", fund_code="000001",
                   strategy_name="indicator_cross", signal_type=SignalType.sell,
                   confidence=0.85)
        assert s.confidence == 0.85
        assert s.signal_type == SignalType.sell

    def test_signal_hold_type(self):
        from app.models import Signal, SignalType

        s = Signal(date="2024-01-15", fund_code="000001",
                   strategy_name="indicator_cross", signal_type=SignalType.hold)
        assert s.signal_type == SignalType.hold
        assert s.signal_type.value == "hold"


class TestSignalResponse:
    def test_response_extends_signal(self):
        from app.models import SignalResponse, SignalType

        sr = SignalResponse(date="2024-01-15", fund_code="000001",
                            strategy_name="indicator_cross", signal_type=SignalType.buy,
                            fund_name="测试基金", daily_change=0.5)
        assert sr.fund_name == "测试基金"
        assert sr.daily_change == 0.5
        assert sr.fund_code == "000001"

    def test_response_defaults(self):
        from app.models import SignalResponse, SignalType

        sr = SignalResponse(date="2024-01-15", fund_code="000001",
                            strategy_name="indicator_cross", signal_type=SignalType.buy)
        assert sr.fund_name == ""
        assert sr.daily_change == 0.0


class TestStrategyMeta:
    def test_strategy_meta_required(self):
        from app.models import StrategyMeta

        sm = StrategyMeta(name="indicator_cross", description="MA crossover",
                          params_schema={"short_window": {"type": "int", "default": 5}})
        assert sm.name == "indicator_cross"
        assert sm.params_schema["short_window"]["default"] == 5

    def test_strategy_meta_empty_params_schema(self):
        from app.models import StrategyMeta

        sm = StrategyMeta(name="buy_and_hold", description="Buy and hold",
                          params_schema={})
        assert sm.params_schema == {}
