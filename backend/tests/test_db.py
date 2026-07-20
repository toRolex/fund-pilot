"""Tests for SQLite signal persistence module."""
import sqlite3
import tempfile
from pathlib import Path

import pytest


class TestDbInit:
    def test_init_db_creates_tables(self):
        from app.db import get_connection, init_db

        conn = get_connection()
        init_db(conn)
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        names = [r[0] for r in tables]
        assert "signal_run" in names
        assert "signal_item" in names

    def test_init_db_is_idempotent(self):
        from app.db import get_connection, init_db

        conn = get_connection()
        init_db(conn)
        init_db(conn)  # second call should not raise
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchall()
        assert len(tables) == 2

    def test_tables_have_correct_columns(self):
        from app.db import get_connection, init_db

        conn = get_connection()
        init_db(conn)
        run_cols = [r[1] for r in conn.execute("PRAGMA table_info(signal_run)").fetchall()]
        assert "id" in run_cols
        assert "strategy" in run_cols
        assert "run_at" in run_cols
        assert "status" in run_cols

        item_cols = [r[1] for r in conn.execute("PRAGMA table_info(signal_item)").fetchall()]
        assert "id" in item_cols
        assert "run_id" in item_cols
        assert "fund_code" in item_cols
        assert "signal" in item_cols
        assert "value" in item_cols
        assert "detail" in item_cols


class TestSaveSignalRun:
    def test_save_run_returns_id(self):
        from app.db import get_connection, init_db, save_signal_run

        conn = get_connection()
        init_db(conn)
        run_id = save_signal_run(conn, "test_strat", "2024-01-15T10:00:00")
        assert run_id == 1
        run_id2 = save_signal_run(conn, "test_strat2", "2024-01-15T11:00:00")
        assert run_id2 == 2

    def test_save_run_defaults_status_to_completed(self):
        from app.db import get_connection, init_db, save_signal_run

        conn = get_connection()
        init_db(conn)
        save_signal_run(conn, "test_strat", "2024-01-15T10:00:00")
        row = conn.execute("SELECT status FROM signal_run WHERE id=1").fetchone()
        assert row[0] == "completed"

    def test_save_run_with_custom_status(self):
        from app.db import get_connection, init_db, save_signal_run

        conn = get_connection()
        init_db(conn)
        save_signal_run(conn, "test_strat", "2024-01-15T10:00:00", status="running")
        row = conn.execute("SELECT status FROM signal_run WHERE id=1").fetchone()
        assert row[0] == "running"


class TestSaveSignalItem:
    def test_save_item(self):
        from app.db import get_connection, init_db, save_signal_run, save_signal_item

        conn = get_connection()
        init_db(conn)
        run_id = save_signal_run(conn, "test_strat", "2024-01-15T10:00:00")
        save_signal_item(conn, run_id, "000001", "buy", 0.85, "2024-01-15")
        rows = conn.execute("SELECT fund_code, signal, value, detail FROM signal_item").fetchall()
        assert len(rows) == 1
        assert tuple(rows[0]) == ("000001", "buy", 0.85, "2024-01-15")

    def test_save_multiple_items_same_run(self):
        from app.db import get_connection, init_db, save_signal_run, save_signal_item

        conn = get_connection()
        init_db(conn)
        run_id = save_signal_run(conn, "test_strat", "2024-01-15T10:00:00")
        save_signal_item(conn, run_id, "000001", "buy", 0.85, "2024-01-15")
        save_signal_item(conn, run_id, "000002", "sell", 0.75, "2024-01-16")
        rows = conn.execute("SELECT fund_code, signal FROM signal_item ORDER BY id").fetchall()
        assert len(rows) == 2
        assert tuple(rows[0]) == ("000001", "buy")
        assert tuple(rows[1]) == ("000002", "sell")

    def test_item_requires_valid_run_id(self):
        from app.db import get_connection, init_db, save_signal_item

        conn = get_connection()
        init_db(conn)
        with pytest.raises(sqlite3.IntegrityError):
            save_signal_item(conn, 999, "000001", "buy", 0.85, "2024-01-15")


class TestQuerySignals:
    def test_query_returns_joined_data(self):
        from app.db import get_connection, init_db, save_signal_run, save_signal_item, query_signals

        conn = get_connection()
        init_db(conn)
        run_id = save_signal_run(conn, "indicator_cross", "2024-01-15T10:00:00")
        save_signal_item(conn, run_id, "000001", "buy", 0.85, "2024-01-15")

        results = query_signals(conn)
        assert len(results) == 1
        row = results[0]
        assert row["fund_code"] == "000001"
        assert row["signal"] == "buy"
        assert row["value"] == 0.85
        assert row["detail"] == "2024-01-15"
        assert row["strategy"] == "indicator_cross"
        assert row["run_at"] == "2024-01-15T10:00:00"

    def test_query_filter_by_fund_code(self):
        from app.db import get_connection, init_db, save_signal_run, save_signal_item, query_signals

        conn = get_connection()
        init_db(conn)
        run_id = save_signal_run(conn, "indicator_cross", "2024-01-15T10:00:00")
        save_signal_item(conn, run_id, "000001", "buy", 0.85, "2024-01-15")
        save_signal_item(conn, run_id, "000002", "sell", 0.75, "2024-01-16")

        results = query_signals(conn, fund_code="000001")
        assert len(results) == 1
        assert results[0]["fund_code"] == "000001"

    def test_query_returns_empty_when_no_data(self):
        from app.db import get_connection, init_db, query_signals

        conn = get_connection()
        init_db(conn)
        assert query_signals(conn) == []

    def test_query_empty_with_filter(self):
        from app.db import get_connection, init_db, query_signals

        conn = get_connection()
        init_db(conn)
        assert query_signals(conn, fund_code="nonexistent") == []

    def test_query_orders_by_detail_fund_code(self):
        from app.db import get_connection, init_db, save_signal_run, save_signal_item, query_signals

        conn = get_connection()
        init_db(conn)
        run_id = save_signal_run(conn, "indicator_cross", "2024-01-16T10:00:00")
        save_signal_item(conn, run_id, "000002", "sell", 0.75, "2024-01-16")
        save_signal_item(conn, run_id, "000001", "buy", 0.85, "2024-01-15")

        results = query_signals(conn)
        assert len(results) == 2
        # Ordered by detail (date) then fund_code
        assert results[0]["fund_code"] == "000001"
        assert results[0]["detail"] == "2024-01-15"
        assert results[1]["fund_code"] == "000002"
        assert results[1]["detail"] == "2024-01-16"


class TestPersistenceAcrossConnections:
    def test_data_survives_reconnect(self):
        from app.db import get_connection, init_db, save_signal_run, save_signal_item, query_signals, set_db_path

        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name
        try:
            set_db_path(db_path)
            conn = get_connection()
            init_db(conn)
            run_id = save_signal_run(conn, "indicator_cross", "2024-01-15T10:00:00")
            save_signal_item(conn, run_id, "000001", "buy", 0.85, "2024-01-15")
            conn.close()

            conn2 = get_connection()
            results = query_signals(conn2)
            assert len(results) == 1
            assert results[0]["fund_code"] == "000001"
            conn2.close()
        finally:
            Path(db_path).unlink(missing_ok=True)
            set_db_path(":memory:")
