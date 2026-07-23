"""Test fixture clears both caches (Issue #58)."""


def test_seed_caches():
    """First, seed both caches to simulate cross-test pollution."""
    from app.data import _PRICE_CACHE, _INFO_CACHE

    _PRICE_CACHE["seed"] = (9999999999.0, None)
    _INFO_CACHE["seed"] = (9999999999.0, {"name": "stale"})


def test_caches_cleared():
    """After autouse fixture runs, both caches should be empty."""
    from app.data import _PRICE_CACHE, _INFO_CACHE

    assert len(_PRICE_CACHE) == 0, "_PRICE_CACHE should be cleared by autouse fixture"
    assert len(_INFO_CACHE) == 0, "_INFO_CACHE should be cleared by autouse fixture"
