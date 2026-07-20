"""Verify required directories exist."""
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent


def test_data_dir_exists():
    assert (BACKEND / "data").is_dir()


def test_prices_dir_exists():
    assert (BACKEND / "data" / "prices").is_dir()


def test_strategies_dir_exists():
    assert (BACKEND / "strategies").is_dir()
