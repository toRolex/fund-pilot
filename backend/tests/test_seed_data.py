"""Tests for seed data: watchlist CSV and price files."""
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent


def test_watchlist_csv_exists():
    assert (BACKEND / "data" / "watchlist.csv").exists()


def test_watchlist_csv_has_12_funds():
    import csv
    with open(BACKEND / "data" / "watchlist.csv") as f:
        reader = csv.DictReader(f)
        funds = list(reader)
    assert len(funds) == 12
    codes = {f["code"] for f in funds}
    assert "CN-AM-001" in codes
    assert "Alpha 动量" in {f["name"] for f in funds}


def test_all_funds_have_price_csv():
    import csv
    with open(BACKEND / "data" / "watchlist.csv") as f:
        reader = csv.DictReader(f)
        funds = list(reader)
    prices_dir = BACKEND / "data" / "prices"
    for fund in funds:
        csv_path = prices_dir / f"{fund['code']}.csv"
        assert csv_path.exists(), f"Missing price CSV for {fund['code']}"


def test_price_csv_has_valid_format():
    import csv
    import pandas as pd
    prices_dir = BACKEND / "data" / "prices"
    csv_files = list(prices_dir.glob("*.csv"))
    assert len(csv_files) >= 12
    for csv_path in csv_files[:3]:  # spot-check first 3
        df = pd.read_csv(csv_path)
        assert "date" in df.columns
        assert "netvalue" in df.columns
        assert len(df) >= 30  # at least 30 trading days
