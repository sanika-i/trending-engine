"""
Request-timing middleware for the /performance endpoint.

Uses an in-memory dict (no DB writes) because:
  - /performance shows runtime stats, not historical
  - Writing to SQLite on every request would slow things down
    (which would bias the thing we're trying to measure)

Thread safety: FastAPI/Starlette run each request in its own task, but
asyncio is single-threaded by default, so dict mutation is safe here.
If we ever ran multiple workers we'd need a lock or an external store.
"""

import time
from collections import defaultdict
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class _Stats:
    """Running stats for a single (method, path) pair."""
    __slots__ = ("count", "total_ms", "min_ms", "max_ms")

    def __init__(self):
        self.count = 0
        self.total_ms = 0.0
        self.min_ms = float("inf")
        self.max_ms = 0.0

    def record(self, ms: float) -> None:
        self.count += 1
        self.total_ms += ms
        if ms < self.min_ms:
            self.min_ms = ms
        if ms > self.max_ms:
            self.max_ms = ms

    def snapshot(self) -> dict:
        avg = self.total_ms / self.count if self.count else 0.0
        return {
            "call_count": self.count,
            "avg_ms": avg,
            "min_ms": 0.0 if self.min_ms == float("inf") else self.min_ms,
            "max_ms": self.max_ms,
        }


_STATS: dict[tuple[str, str], _Stats] = defaultdict(_Stats)


class TimingMiddleware(BaseHTTPMiddleware):
    """
    Wraps each request in a high-resolution timer.
    Skips /performance itself so reading the stats doesn't pollute them.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if path == "/performance":
            return await call_next(request)

        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        _STATS[(request.method, path)].record(elapsed_ms)
        return response


def get_performance_snapshot() -> dict:
    """Return current timing stats, formatted for the /performance response."""
    endpoints = []
    total_calls = 0
    total_ms = 0.0

    for (method, path), stats in _STATS.items():
        snap = stats.snapshot()
        endpoints.append({
            "endpoint": path,
            "method": method,
            **snap,
        })
        total_calls += snap["call_count"]
        total_ms += snap["avg_ms"] * snap["call_count"]

    overall_avg = total_ms / total_calls if total_calls else 0.0
    # Sort slowest first — more useful for diagnosing.
    endpoints.sort(key=lambda e: e["avg_ms"], reverse=True)

    return {"endpoints": endpoints, "overall_avg_ms": overall_avg}
