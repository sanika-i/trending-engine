"""
Scoring formula for leaderboard ranking.

Centralizing this in one module means:
  - One place to tweak weights or the decay rate
  - Easy to unit-test in isolation
  - /info and /leaderboard both call the same function, guaranteeing consistency

Formula:
    raw   = shares*3 + saves*2 + likes*1
    decay = 0.5 * floor(days_since_posted)       # whole days only
    score = max(0, raw - decay)                   # floor at zero
"""

from datetime import date, datetime

SHARE_WEIGHT = 3
SAVE_WEIGHT = 2
LIKE_WEIGHT = 1
DAILY_DECAY = 0.5


def days_since(created_at: str) -> int:
    """
    Whole days between the post's creation date and today.
    created_at is an ISO-8601 string (what SQLite stores).
    Using date (not datetime) subtraction gives us clean integer days.
    """
    created_date = datetime.fromisoformat(created_at).date()
    return (date.today() - created_date).days


def compute_score(likes: int, shares: int, saves: int, created_at: str) -> float:
    """
    Return the current decayed score for a post.
    Floored at zero so decayed old posts bottom out instead of going negative.
    """
    raw = shares * SHARE_WEIGHT + saves * SAVE_WEIGHT + likes * LIKE_WEIGHT
    decay = DAILY_DECAY * days_since(created_at)
    return max(0.0, raw - decay)
