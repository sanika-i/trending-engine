"""
Pydantic models: request/response shapes for every endpoint.

Why Pydantic:
  - Automatic validation (wrong types / missing fields → 422 response, no manual checks)
  - Auto-generates the OpenAPI schema that /openapi.yaml returns
  - Makes endpoints self-documenting

Naming convention:
  - *Create  → incoming POST body
  - *Update  → incoming PATCH body (all fields optional)
  - *Response → outgoing JSON (what the client sees)
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------- #
#  Post models                                                                #
# --------------------------------------------------------------------------- #

class PostCreate(BaseModel):
    """POST /add body. Description is required; counts default to zero."""
    description: str = Field(..., min_length=1, max_length=500)
    likes: int = Field(0, ge=0)
    shares: int = Field(0, ge=0)
    saves: int = Field(0, ge=0)


class PostUpdate(BaseModel):
    """PATCH /posts/{id} body. All fields optional so clients can update any subset."""
    description: Optional[str] = Field(None, min_length=1, max_length=500)
    likes: Optional[int] = Field(None, ge=0)
    shares: Optional[int] = Field(None, ge=0)
    saves: Optional[int] = Field(None, ge=0)


class PostResponse(BaseModel):
    """
    Outgoing shape for a post. Score is computed on the fly (not stored),
    because decay means the score changes every day even without any engagement.
    """
    id: int
    description: str
    likes: int
    shares: int
    saves: int
    created_at: datetime
    score: float


# --------------------------------------------------------------------------- #
#  Stats / info                                                               #
# --------------------------------------------------------------------------- #

class ColumnStats(BaseModel):
    """Per-metric statistics. Used for each of likes, shares, saves, score."""
    mean: float
    median: float
    q1: float
    q3: float
    stddev: float
    p90: float
    p99: float
    min: float
    max: float


class Distribution(BaseModel):
    """Bucketed score distribution for the advanced /info stats."""
    bucket_edges: list[float]
    counts: list[int]


class InfoResponse(BaseModel):
    total_posts: int
    likes: ColumnStats
    shares: ColumnStats
    saves: ColumnStats
    score: ColumnStats
    score_distribution: Distribution


# --------------------------------------------------------------------------- #
#  History                                                                    #
# --------------------------------------------------------------------------- #

EventType = Literal["add", "like", "share", "save", "update", "remove"]


class HistoryEntry(BaseModel):
    id: int
    post_id: int
    event_type: EventType
    likes: int
    shares: int
    saves: int
    timestamp: datetime


# --------------------------------------------------------------------------- #
#  Performance                                                                #
# --------------------------------------------------------------------------- #

class EndpointPerformance(BaseModel):
    endpoint: str
    method: str
    call_count: int
    avg_ms: float
    min_ms: float
    max_ms: float


class PerformanceResponse(BaseModel):
    endpoints: list[EndpointPerformance]
    overall_avg_ms: float
