from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

# API sub-app
api = FastAPI(title="Fund Signal API")


@api.get("/health")
async def health():
    return {"status": "ok"}


# Main app — mounts API and SPA
app = FastAPI()
app.mount("/api", api)

# SPA static files — frontend build output, fallback to index.html
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
frontend_dist.mkdir(parents=True, exist_ok=True)
app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="spa")
