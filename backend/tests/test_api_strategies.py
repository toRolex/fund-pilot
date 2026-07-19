"""Tests for strategy API endpoints."""
import pytest


def test_list_strategies_returns_all(client):
    resp = client.get("/api/strategies")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    names = [s["name"] for s in data]
    assert "indicator_cross" in names


def test_strategy_meta_includes_enabled_field(client):
    resp = client.get("/api/strategies")
    data = resp.json()
    cross = [s for s in data if s["name"] == "indicator_cross"][0]
    assert "enabled" in cross
    assert cross["enabled"] is True


def test_toggle_strategy_enable_disable(client):
    # Disable
    resp = client.put("/api/strategies/indicator_cross", json={"enabled": False})
    assert resp.status_code == 200
    assert resp.json()["enabled"] is False

    # Verify via GET
    resp = client.get("/api/strategies")
    cross = [s for s in resp.json() if s["name"] == "indicator_cross"][0]
    assert cross["enabled"] is False

    # Re-enable
    resp = client.put("/api/strategies/indicator_cross", json={"enabled": True})
    assert resp.status_code == 200
    assert resp.json()["enabled"] is True


def test_toggle_nonexistent_strategy_returns_404(client):
    resp = client.put("/api/strategies/nonexistent", json={"enabled": False})
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_get_strategy_logs(client):
    resp = client.get("/api/strategies/logs")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_strategy_logs_have_timestamp_and_message(client):
    resp = client.get("/api/strategies/logs")
    logs = resp.json()
    if logs:
        assert "timestamp" in logs[0]
        assert "message" in logs[0]
