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
