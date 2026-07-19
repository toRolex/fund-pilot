"""Holdings storage — in-memory dict with CSV persistence."""

import csv
import io
from pathlib import Path
from typing import List

from app.models import Holding

# ponytail: global singleton, per-user isolation if needed later
_HOLDINGS: dict[str, Holding] = {}
_HOLDINGS_PATH: Path | None = None


def _default_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "holdings.csv"


def _load():
    global _HOLDINGS
    path = _HOLDINGS_PATH or _default_path()
    _HOLDINGS = {}
    if path.exists():
        with open(path, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                _HOLDINGS[row["fund_code"]] = Holding(
                    fund_code=row["fund_code"],
                    fund_name=row["fund_name"],
                    shares=float(row["shares"]),
                    cost_price=float(row["cost_price"]),
                    current_value=float(row["current_value"]),
                )


def _save():
    path = _HOLDINGS_PATH or _default_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["fund_code", "fund_name", "shares", "cost_price", "current_value"])
        writer.writeheader()
        for h in _HOLDINGS.values():
            writer.writerow(h.model_dump())


class HoldingsService:
    def __init__(self, csv_path: Path | None = None):
        global _HOLDINGS_PATH
        if csv_path:
            _HOLDINGS_PATH = csv_path
        _load()

    def list_all(self) -> List[Holding]:
        return sorted(_HOLDINGS.values(), key=lambda h: h.fund_code)

    def import_holdings(self, holdings: List[Holding]):
        _HOLDINGS.clear()
        for h in holdings:
            _HOLDINGS[h.fund_code] = h
        _save()

    @staticmethod
    def parse_csv(content: str) -> List[Holding]:
        reader = csv.DictReader(io.StringIO(content))
        holdings = []
        for row in reader:
            holdings.append(Holding(
                fund_code=row["fund_code"],
                fund_name=row["fund_name"],
                shares=float(row["shares"]),
                cost_price=float(row["cost_price"]),
                current_value=float(row["current_value"]),
            ))
        return holdings
