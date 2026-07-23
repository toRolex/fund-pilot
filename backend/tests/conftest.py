"""Pytest configuration — shared fixtures for all tests."""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _clear_price_cache():
    """Clear module-level caches between tests to prevent cross-test pollution."""
    from app.data import _PRICE_CACHE, _INFO_CACHE

    _PRICE_CACHE.clear()
    _INFO_CACHE.clear()


@pytest.fixture(autouse=True)
def _test_db(tmp_path):
    """Use a temp file for each test so data survives across HTTP requests."""
    from app.db import set_db_path

    set_db_path(str(tmp_path / "test_signals.db"))
    yield


@pytest.fixture
def client() -> TestClient:
    from app.main import app

    return TestClient(app)
