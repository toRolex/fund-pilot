"""Verify all required app modules can be imported."""

MODULES = ["app.main", "app.models", "app.data", "app.strategies", "app.scheduler"]


def test_all_modules_import():
    for mod_name in MODULES:
        __import__(mod_name)
