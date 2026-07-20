"""SQLite persistence for signal runs and signal items.

Two tables: signal_run (per-strategy run record) and signal_item (individual signals).
Uses Python sqlite3, no ORM.  Functions accept an explicit connection for testability.
"""
from pathlib import Path
import sqlite3

_RUN_SQL = """\
CREATE TABLE IF NOT EXISTS signal_run (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy TEXT NOT NULL,
    run_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running'
)"""

_ITEM_SQL = """\
CREATE TABLE IF NOT EXISTS signal_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES signal_run(id),
    fund_code TEXT NOT NULL,
    signal TEXT NOT NULL,
    value REAL,
    detail TEXT
)"""

_ADD_DATE_SQL = "ALTER TABLE signal_item ADD COLUMN date TEXT"

_DB_PATH: str = str(Path(__file__).resolve().parent.parent / "data" / "signals.db")


def set_db_path(path: str) -> None:
    global _DB_PATH
    _DB_PATH = path


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.execute(_RUN_SQL)
    conn.execute(_ITEM_SQL)
    try:
        conn.execute(_ADD_DATE_SQL)
    except sqlite3.OperationalError:
        pass  # column already exists
    conn.commit()


def save_signal_run(
    conn: sqlite3.Connection,
    strategy: str,
    run_at: str,
    status: str = "completed",
) -> int:
    cursor = conn.execute(
        "INSERT INTO signal_run (strategy, run_at, status) VALUES (?, ?, ?)",
        (strategy, run_at, status),
    )
    conn.commit()
    return cursor.lastrowid


def save_signal_item(
    conn: sqlite3.Connection,
    run_id: int,
    fund_code: str,
    signal: str,
    value: float | None = None,
    detail: str | None = None,
    date: str | None = None,
) -> None:
    conn.execute(
        "INSERT INTO signal_item (run_id, fund_code, signal, value, detail, date) VALUES (?, ?, ?, ?, ?, ?)",
        (run_id, fund_code, signal, value, detail, date),
    )
    conn.commit()


def query_signals(
    conn: sqlite3.Connection,
    fund_code: str | None = None,
    run_id: int | None = None,
    strategy: str | None = None,
) -> list[dict]:
    sql = """
        SELECT si.fund_code, si.signal, si.value, si.detail, si.date,
               sr.strategy, sr.run_at
        FROM signal_item si
        JOIN signal_run sr ON si.run_id = sr.id
    """
    conditions: list[str] = []
    params: list[str | int] = []
    if fund_code:
        conditions.append("si.fund_code = ?")
        params.append(fund_code)
    if run_id is not None:
        conditions.append("si.run_id = ?")
        params.append(run_id)
    if strategy:
        conditions.append("sr.strategy = ?")
        params.append(strategy)
    if not run_id:
        # Default: latest run only
        conditions.append("si.run_id = (SELECT MAX(id) FROM signal_run)")
    if conditions:
        sql += " WHERE " + " AND ".join(conditions)
    sql += " ORDER BY si.id"
    return [dict(r) for r in conn.execute(sql, params).fetchall()]
