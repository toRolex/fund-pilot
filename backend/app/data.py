"""xalpha data loading and CSV cache management."""
from pathlib import Path

import xalpha as xa

# Initialize xalpha with CSV cache backend
# ponytail: global backend, per-watchlist isolation if needed later
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
xa.set_backend(backend="csv")
