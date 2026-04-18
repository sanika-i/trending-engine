"""
FastAPI app entry point.

Wires together:
  - Database initialization on startup
  - CORS (so the frontend can call us from a different origin)
  - TimingMiddleware (for /performance)
  - All route handlers

Run with:
    uvicorn app.main:app --reload --port 8000
"""

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import yaml
import crud
from database import init_db
from models import (
    HistoryEntry,
    InfoResponse,
    PerformanceResponse,
    PostCreate,
    PostResponse,
    PostUpdate,
)
from performance import TimingMiddleware, get_performance_snapshot
from stats import column_stats, score_distribution

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create SQLite tables on startup if they don't exist."""
    init_db()
    yield


app = FastAPI(
    title="Leaderboard API",
    description="Dynamic engagement-based leaderboard with decayed scoring.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(TimingMiddleware)

@app.post("/add", response_model=PostResponse, status_code=201)
def add_entry(payload: PostCreate) -> dict:
    return crud.add_post(
        author=payload.author,
        description=payload.description,
        likes=payload.likes,
        shares=payload.shares,
        saves=payload.saves,
    )

@app.delete("/remove")
def remove_entry(
    id: Optional[int] = Query(None, description="Post id to remove"),
    all: bool = Query(False, description="If true, clear all posts"),
) -> dict:
    if all:
        count = crud.remove_all_posts()
        return {"removed": count, "cleared_all": True}

    if id is None:
        raise HTTPException(status_code=400, detail="Provide either ?id=N or ?all=true")

    ok = crud.remove_post(id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Post {id} not found")
    return {"removed": 1, "id": id}

@app.get("/leaderboard")
def leaderboard(format: str = Query("json", pattern="^(json|html)$")) -> Response:
    """
    Top 10 by score. Defaults to JSON.
    ?format=html returns a server-rendered HTML table (spec requires a
    'graphical format'; a real HTML table qualifies).
    """
    posts = crud.top_leaderboard(limit=10)

    if format == "html":
        return HTMLResponse(_render_leaderboard_html(posts))

    return Response(
        content=_json_dumps(posts),
        media_type="application/json",
    )


def _render_leaderboard_html(posts: list[dict]) -> str:
    """Minimal inline-styled HTML table for /leaderboard?format=html."""
    rows = "".join(
        f"<tr><td>{i+1}</td><td>{_escape(p['description'])}</td>"
        f"<td>{p['likes']}</td><td>{p['shares']}</td><td>{p['saves']}</td>"
        f"<td>{p['created_at']}</td><td>{p['score']:.1f}</td></tr>"
        for i, p in enumerate(posts)
    )
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Leaderboard</title>
<style>
  body{{font-family:system-ui,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem}}
  table{{width:100%;border-collapse:collapse}}
  th,td{{padding:8px 12px;border-bottom:1px solid #ddd;text-align:left}}
  th{{background:#f5f5f5}}
</style></head><body>
<h1>Top 10 Leaderboard</h1>
<table>
  <thead><tr><th>#</th><th>Description</th><th>Likes</th><th>Shares</th>
  <th>Saves</th><th>Posted</th><th>Score</th></tr></thead>
  <tbody>{rows or '<tr><td colspan=7>No posts yet</td></tr>'}</tbody>
</table></body></html>"""


def _escape(s: str) -> str:
    """Tiny HTML escape for the server-rendered table."""
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


def _json_dumps(obj) -> str:
    """JSON with ISO datetime handling (FastAPI's default does the same but we bypass it here)."""
    import json
    from datetime import datetime
    def default(o):
        if isinstance(o, datetime):
            return o.isoformat()
        raise TypeError
    return json.dumps(obj, default=default)

@app.get("/posts", response_model=list[PostResponse])
def all_posts(
    sort_by: str = Query("score"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
) -> list[dict]:
    try:
        return crud.list_posts(sort_by=sort_by, order=order)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/posts/{post_id}", response_model=PostResponse)
def get_one(post_id: int) -> dict:
    post = crud.get_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail=f"Post {post_id} not found")
    return post


@app.patch("/posts/{post_id}", response_model=PostResponse)
def update(post_id: int, payload: PostUpdate) -> dict:
    post = crud.update_post(post_id, payload.model_dump())
    if not post:
        raise HTTPException(status_code=404, detail=f"Post {post_id} not found")
    return post

@app.post("/posts/{post_id}/like", response_model=PostResponse)
def like(post_id: int) -> dict:
    post = crud.like_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail=f"Post {post_id} not found")
    return post


@app.post("/posts/{post_id}/share", response_model=PostResponse)
def share(post_id: int) -> dict:
    post = crud.share_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail=f"Post {post_id} not found")
    return post


@app.post("/posts/{post_id}/save", response_model=PostResponse)
def save(post_id: int) -> dict:
    post = crud.save_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail=f"Post {post_id} not found")
    return post

@app.get("/info", response_model=InfoResponse)
def info() -> dict:
    posts = crud.list_posts(sort_by="score", order="desc")
    likes = [p["likes"] for p in posts]
    shares = [p["shares"] for p in posts]
    saves = [p["saves"] for p in posts]
    scores = [p["score"] for p in posts]

    return {
        "total_posts": len(posts),
        "likes": column_stats(likes),
        "shares": column_stats(shares),
        "saves": column_stats(saves),
        "score": column_stats(scores),
        "score_distribution": score_distribution(scores),
    }

@app.get("/history", response_model=list[HistoryEntry])
def history(
    start_date: Optional[str] = Query(None, description="ISO-8601 datetime"),
    end_date: Optional[str] = Query(None, description="ISO-8601 datetime"),
    post_id: Optional[int] = None,
    min_score: Optional[float] = None,
    max_score: Optional[float] = None,
) -> list[dict]:
    return crud.query_history(start_date, end_date, post_id, min_score, max_score)

@app.get("/performance", response_model=PerformanceResponse)
def performance() -> dict:
    return get_performance_snapshot()

@app.get("/openapi.yaml", include_in_schema=False)
def openapi_yaml() -> Response:
    """
    Serve the OpenAPI schema as YAML (the hackathon deliverable).
    FastAPI provides .openapi() as a dict; we just dump it to YAML.
    """
    return Response(
        content=yaml.safe_dump(app.openapi(), sort_keys=False),
        media_type="application/x-yaml",
    )
