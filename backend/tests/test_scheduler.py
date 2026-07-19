"""Tests for scheduler: trading session detection, status API."""

from datetime import datetime

import pytest


@pytest.mark.parametrize("dt_str,expected", [
    # Weekday — morning session boundaries
    ("2026-07-20T09:29:59", False),   # Monday, before morning session
    ("2026-07-20T09:30:00", True),    # Monday, start of morning session
    ("2026-07-20T11:29:59", True),    # Monday, within morning session
    ("2026-07-20T11:30:00", False),   # Monday, lunch break start
    # Weekday — afternoon session boundaries
    ("2026-07-20T12:59:59", False),   # Monday, lunch break
    ("2026-07-20T13:00:00", True),    # Monday, start of afternoon session
    ("2026-07-20T14:59:59", True),    # Monday, within afternoon session
    ("2026-07-20T15:00:00", False),   # Monday, market closed
    # Weekend
    ("2026-07-18T10:00:00", False),   # Saturday
    ("2026-07-19T10:00:00", False),   # Sunday
])
def test_is_trading_time(dt_str, expected):
    from app.scheduler import is_trading_time
    dt = datetime.fromisoformat(dt_str)
    assert is_trading_time(dt) is expected


def test_scheduler_start_stop():
    """Verify scheduler starts and stops without error."""
    from app.scheduler import start, stop
    stop()  # ensure clean state
    start()
    stop()


def test_status_api_returns_fields(client):
    resp = client.get("/api/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "last_update" in data
    assert "strategies_running" in data
    assert "funds_watched" in data
    assert "connected" in data
    assert data["connected"] is True
    assert isinstance(data["strategies_running"], int)
    assert isinstance(data["funds_watched"], int)
