"""Watchlist storage — in-memory dict with CSV persistence."""

import csv
from pathlib import Path
from typing import List

from app.models import Fund

# ponytail: global singleton, per-user isolation if needed later
_WATCHLIST: dict[str, Fund] = {}
_WATCHLIST_PATH: Path | None = None


def _default_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "watchlist.csv"


def _load():
    """Load watchlist from CSV into global _WATCHLIST."""
    global _WATCHLIST
    path = _WATCHLIST_PATH or _default_path()
    _WATCHLIST = {}
    if path.exists():
        with open(path, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                _WATCHLIST[row["code"]] = Fund(**row)


def _save():
    """Persist global _WATCHLIST to CSV."""
    path = _WATCHLIST_PATH or _default_path()
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["code", "name", "type"])
        writer.writeheader()
        for fund in _WATCHLIST.values():
            writer.writerow(fund.model_dump())


class WatchlistService:
    def __init__(self, csv_path: Path | None = None):
        global _WATCHLIST_PATH
        if csv_path:
            _WATCHLIST_PATH = csv_path
        _load()

    def list_all(self) -> List[Fund]:
        """Return all funds sorted by code."""
        return sorted(_WATCHLIST.values(), key=lambda f: f.code)

    def add(self, code: str, name: str) -> Fund:
        """Add a fund to the watchlist. Raises ValueError if duplicate."""
        if code in _WATCHLIST:
            raise ValueError(f"Fund {code} already in watchlist")
        fund = Fund(code=code, name=name)
        _WATCHLIST[code] = fund
        _save()
        return fund

    def remove(self, code: str) -> Fund:
        """Remove a fund from the watchlist. Raises ValueError if not found."""
        if code not in _WATCHLIST:
            raise ValueError(f"Fund {code} not found in watchlist")
        fund = _WATCHLIST.pop(code)
        _save()
        return fund

    def search(self, q: str) -> List[Fund]:
        """Search funds by code or name (case-insensitive, substring match)."""
        q_lower = q.lower()
        return [
            f
            for f in _WATCHLIST.values()
            if q_lower in f.code.lower() or q_lower in f.name.lower()
        ]

    def get(self, code: str) -> Fund | None:
        """Get a fund by code, returns None if not found."""
        return _WATCHLIST.get(code)
