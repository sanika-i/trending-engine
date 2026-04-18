"""
CRUD: all database operations live here.

Design rationale:
  - Route handlers in main.py stay thin (HTTP concerns only)
  - All SQL is in one file — easy to audit for injection risks
  - Each function returns plain dicts / lists; main.py handles Pydantic conversion

Anti-injection notes:
  - All values are passed as parameterized queries (? placeholders)
  - The ONLY place we interpolate Python into SQL is for sort column names,
    and those are whitelisted against a fixed set before use.
"""

from datetime import datetime, timezone
from typing import Optional

from .database import db_cursor
from .scoring import compute_score

# Whitelist for sort_by. SQLite can't parameterize column names,
# so we enforce a fixed allowlist to prevent SQL injection.
SORTABLE_COLUMNS = {
    "score": "score",           # special-cased below (computed, not stored)
    "description": "description",
    "likes": "likes",
    "shares": "shares",
    "saves": "saves",
    "posted": "created_at",
    "created_at": "created_at",
}


def _now_iso() -> str:
    """UTC ISO-8601 timestamp. Using UTC avoids timezone math in the decay formula."""
    return datetime.now(timezone.utc).isoformat()


def _row_to_post(row) -> dict:
    """Convert a sqlite3.Row from posts table into a scored response dict."""
    return {
        "id": row["id"],
        "description": row["description"],
        "likes": row["likes"],
        "shares": row["shares"],
        "saves": row["saves"],
        "created_at": row["created_at"],
        "score": compute_score(
            row["likes"], row["shares"], row["saves"], row["created_at"]
        ),
    }


# --------------------------------------------------------------------------- #
#  Create                                                                     #
# --------------------------------------------------------------------------- #

def add_post(description: str, likes: int, shares: int, saves: int) -> dict:
    """Insert a new post and log an 'add' event in history. Returns the new post."""
    now = _now_iso()
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO posts (description, likes, shares, saves, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (description, likes, shares, saves, now),
        )
        post_id = cur.lastrowid

        cur.execute(
            "INSERT INTO history (post_id, event_type, likes, shares, saves, timestamp) "
            "VALUES (?, 'add', ?, ?, ?, ?)",
            (post_id, likes, shares, saves, now),
        )

        cur.execute("SELECT * FROM posts WHERE id = ?", (post_id,))
        return _row_to_post(cur.fetchone())


# --------------------------------------------------------------------------- #
#  Read                                                                       #
# --------------------------------------------------------------------------- #

def get_post(post_id: int) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM posts WHERE id = ?", (post_id,))
        row = cur.fetchone()
        return _row_to_post(row) if row else None


def list_posts(sort_by: str = "score", order: str = "desc") -> list[dict]:
    """
    Return all posts, sorted. Used by GET /posts (powers the List view).
    Score sorting is done in Python because score is computed, not stored.
    """
    if sort_by not in SORTABLE_COLUMNS:
        raise ValueError(f"Invalid sort_by: {sort_by}")
    if order not in ("asc", "desc"):
        raise ValueError(f"Invalid order: {order}")

    with db_cursor() as cur:
        if sort_by in ("score", "posted"):
            # Score requires in-Python sort (decay is dynamic).
            # "posted" sorts by created_at — handled in Python for consistency.
            cur.execute("SELECT * FROM posts")
            posts = [_row_to_post(r) for r in cur.fetchall()]
            key = "score" if sort_by == "score" else "created_at"
            posts.sort(key=lambda p: p[key], reverse=(order == "desc"))
            return posts

        column = SORTABLE_COLUMNS[sort_by]
        direction = "DESC" if order == "desc" else "ASC"
        # Safe: column comes from whitelist, direction from literal check above.
        cur.execute(f"SELECT * FROM posts ORDER BY {column} {direction}")
        return [_row_to_post(r) for r in cur.fetchall()]


def top_leaderboard(limit: int = 10) -> list[dict]:
    """Top-N posts by computed score, descending. Powers GET /leaderboard."""
    posts = list_posts(sort_by="score", order="desc")
    return posts[:limit]


# --------------------------------------------------------------------------- #
#  Update                                                                     #
# --------------------------------------------------------------------------- #

def _increment(post_id: int, column: str, event_type: str) -> Optional[dict]:
    """
    Shared helper for like/share/save endpoints. Increments the column by 1
    and records a history row. Returns None if the post doesn't exist.
    """
    if column not in ("likes", "shares", "saves"):
        raise ValueError(f"Invalid column: {column}")

    with db_cursor() as cur:
        cur.execute("SELECT * FROM posts WHERE id = ?", (post_id,))
        if cur.fetchone() is None:
            return None

        cur.execute(f"UPDATE posts SET {column} = {column} + 1 WHERE id = ?", (post_id,))
        cur.execute("SELECT * FROM posts WHERE id = ?", (post_id,))
        row = cur.fetchone()

        cur.execute(
            "INSERT INTO history (post_id, event_type, likes, shares, saves, timestamp) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (post_id, event_type, row["likes"], row["shares"], row["saves"], _now_iso()),
        )
        return _row_to_post(row)


def like_post(post_id: int) -> Optional[dict]:
    return _increment(post_id, "likes", "like")


def share_post(post_id: int) -> Optional[dict]:
    return _increment(post_id, "shares", "share")


def save_post(post_id: int) -> Optional[dict]:
    return _increment(post_id, "saves", "save")


def update_post(post_id: int, fields: dict) -> Optional[dict]:
    """PATCH /posts/{id}: update any subset of description/likes/shares/saves."""
    fields = {k: v for k, v in fields.items() if v is not None}
    if not fields:
        return get_post(post_id)

    allowed = {"description", "likes", "shares", "saves"}
    if not set(fields).issubset(allowed):
        raise ValueError(f"Invalid fields: {set(fields) - allowed}")

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [post_id]

    with db_cursor() as cur:
        cur.execute("SELECT * FROM posts WHERE id = ?", (post_id,))
        if cur.fetchone() is None:
            return None

        cur.execute(f"UPDATE posts SET {set_clause} WHERE id = ?", values)
        cur.execute("SELECT * FROM posts WHERE id = ?", (post_id,))
        row = cur.fetchone()

        cur.execute(
            "INSERT INTO history (post_id, event_type, likes, shares, saves, timestamp) "
            "VALUES (?, 'update', ?, ?, ?, ?)",
            (post_id, row["likes"], row["shares"], row["saves"], _now_iso()),
        )
        return _row_to_post(row)


# --------------------------------------------------------------------------- #
#  Delete                                                                     #
# --------------------------------------------------------------------------- #

def remove_post(post_id: int) -> bool:
    """Delete one post (and its history via ON DELETE CASCADE). Returns True if removed."""
    with db_cursor() as cur:
        cur.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        return cur.rowcount > 0


def remove_all_posts() -> int:
    """Clear the entire database. Returns count of posts removed."""
    with db_cursor() as cur:
        cur.execute("SELECT COUNT(*) as c FROM posts")
        count = cur.fetchone()["c"]
        cur.execute("DELETE FROM posts")
        return count


# --------------------------------------------------------------------------- #
#  History                                                                    #
# --------------------------------------------------------------------------- #

def query_history(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    post_id: Optional[int] = None,
    min_score: Optional[float] = None,
    max_score: Optional[float] = None,
) -> list[dict]:
    """
    Return history events matching the filters.
    min_score / max_score are computed per-row because score isn't stored.
    """
    conditions = []
    params: list = []

    if start_date:
        conditions.append("timestamp >= ?")
        params.append(start_date)
    if end_date:
        conditions.append("timestamp <= ?")
        params.append(end_date)
    if post_id is not None:
        conditions.append("post_id = ?")
        params.append(post_id)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with db_cursor() as cur:
        cur.execute(f"SELECT * FROM history {where} ORDER BY timestamp DESC", params)
        rows = cur.fetchall()

    results = []
    for r in rows:
        entry = {
            "id": r["id"],
            "post_id": r["post_id"],
            "event_type": r["event_type"],
            "likes": r["likes"],
            "shares": r["shares"],
            "saves": r["saves"],
            "timestamp": r["timestamp"],
        }
        if min_score is not None or max_score is not None:
            s = compute_score(r["likes"], r["shares"], r["saves"], r["timestamp"])
            if min_score is not None and s < min_score:
                continue
            if max_score is not None and s > max_score:
                continue
        results.append(entry)

    return results
