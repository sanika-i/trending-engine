import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).parent / "leaderboard.db"


def get_connection() -> sqlite3.Connection:
    """
    Return a new SQLite connection with row factory set to sqlite3.Row
    so results come back as dict-like objects (row["likes"] vs row[2]).
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db_cursor():
    """
    Context manager that yields a cursor and handles commit/rollback/close.
    Using this everywhere keeps connection handling consistent and leak-free.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """
    Create tables if they don't exist. Safe to call on every app startup.

    posts.created_at uses ISO-8601 text (SQLite doesn't have a real datetime
    type). Storing as text keeps things human-readable and sortable.

    history.event_type is a string, not an enum, because SQLite doesn't
    enforce CHECK constraints strictly — we'll validate in Pydantic instead.
    """
    with db_cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS posts (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                author      TEXT    NOT NULL,
                description TEXT    NOT NULL,
                likes       INTEGER NOT NULL DEFAULT 0,
                shares      INTEGER NOT NULL DEFAULT 0,
                saves       INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT    NOT NULL
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id     INTEGER NOT NULL,
                event_type  TEXT    NOT NULL,
                likes       INTEGER NOT NULL,
                shares      INTEGER NOT NULL,
                saves       INTEGER NOT NULL,
                timestamp   TEXT    NOT NULL,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
            )
        """)

        cur.execute("CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_history_post_id ON history(post_id)")
