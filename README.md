# Leaderboard — FastAPI + Vanilla JS

Dynamic engagement-based leaderboard with decayed scoring. Built for the Luddy Hackathon.

## Scoring formula

```
score = max(0, shares×3 + saves×2 + likes×1 − 0.5 × floor(days_since_posted))
```

Scores are computed on read, not stored — so decay applies automatically as time passes, with no background jobs.

## Project structure

```
backend/
│   ├── main.py          # FastAPI app, routes, middleware
│   ├── database.py      # SQLite connection + schema
│   ├── models.py        # Pydantic request/response models
│   ├── crud.py          # All DB operations
│   ├── stats.py         # /info calculations (stdlib only)
│   ├── scoring.py       # Decayed-score formula
│   ├── performance.py   # Request-timing middleware
│   └──requirements.txt
├── frontend/
│   ├── css
│   │   ├── style.css
│   ├── js
│   │   ├── api.js
│   │   ├── app.js
│   │   ├── modal.js
│   │   ├── render.js
│   └── index.html       # Single-file vanilla JS UI
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
```

## Running locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then open `frontend/index.html` in a browser. (Or serve it via `python -m http.server 5173 --directory frontend` and go to http://localhost:5173).

The frontend's API base URL is set at the top of `index.html` — change `const API = "http://127.0.0.1:8000"` if hosting elsewhere.

## Running in Docker

```bash
docker compose up --build
```

## Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/add` | POST | Create post |
| `/remove?id=N` or `?all=true` | DELETE | Delete one or clear all |
| `/leaderboard` | GET | Top 10 by score (add `?format=html` for HTML table) |
| `/posts?sort_by=X&order=asc` | GET | All posts, sortable |
| `/posts/{id}` | GET/PATCH | Get or update a single post |
| `/posts/{id}/like` | POST | +1 like |
| `/posts/{id}/share` | POST | +1 share |
| `/posts/{id}/save` | POST | +1 save |
| `/info` | GET | Full stats: mean, median, quartiles, stddev, percentiles, distribution |
| `/history?start_date=&end_date=&post_id=&min_score=&max_score=` | GET | Filtered audit log |
| `/performance` | GET | Avg/min/max execution time per endpoint |
| `/openapi.yaml` | GET | OpenAPI schema as YAML (hackathon deliverable) |

Interactive docs at `http://localhost:8000/docs` (Swagger UI, built into FastAPI).

## Design decisions worth defending

- **SQLite** — persistent, zero-setup, stdlib (no extra dep), plenty fast for demo scale
- **Two tables** — `posts` for current state, `history` as append-only audit log
- **Score computed on read, not stored** — decay applies every day without a cron job
- **Statistics via stdlib `statistics` module** — no numpy/pandas, smaller image, shows we did the math ourselves
- **Parameterized queries everywhere** — only column names are interpolated, and those are whitelisted
- **In-memory performance tracking** — avoids the irony of measuring "/performance" by writing to disk
