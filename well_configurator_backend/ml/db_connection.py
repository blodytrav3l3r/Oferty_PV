"""
Wspólne połączenie SQLite dla modułów ML.
Eliminuje duplikację _get_conn() w 3 plikach.
"""
import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "well_configurator.db")


def get_ml_conn() -> sqlite3.Connection:
    """Zwraca połączenie SQLite z row_factory=sqlite3.Row."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
