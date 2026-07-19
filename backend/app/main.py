from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles

import xalpha as xa

from app.models import AddFundRequest, Fund
from app.watchlist import WatchlistService

# API sub-app
api = FastAPI(title="Fund Signal API")

watchlist = WatchlistService()


@api.get("/health")
async def health():
    return {"status": "ok"}


@api.get("/funds")
async def list_funds(
    sort_by: str = Query("code"),
    sort_dir: str = Query("asc"),
):
    if sort_by not in ("code", "name"):
        sort_by = "code"
    if sort_dir not in ("asc", "desc"):
        sort_dir = "asc"
    funds = watchlist.list_all()
    reverse = sort_dir == "desc"
    return sorted(funds, key=lambda f: getattr(f, sort_by), reverse=reverse)


@api.post("/funds", status_code=201)
async def add_fund(body: AddFundRequest):
    # ponytail: single xa.mfund call, add retry/circuit-breaker if network flakiness matters
    try:
        info = xa.mfund(body.code).info
    except Exception:
        raise HTTPException(status_code=422, detail=f"Invalid fund code: {body.code}")
    try:
        fund = watchlist.add(body.code, info.get("name", ""))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return fund


@api.delete("/funds/{code}")
async def remove_fund(code: str):
    try:
        fund = watchlist.remove(code)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return fund


@api.get("/funds/search")
async def search_funds(q: str = ""):
    return watchlist.search(q)


# Main app — mounts API and SPA
app = FastAPI()
app.mount("/api", api)

# SPA static files — frontend build output, fallback to index.html
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
frontend_dist.mkdir(parents=True, exist_ok=True)
app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="spa")
