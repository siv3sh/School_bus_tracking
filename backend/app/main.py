import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import close_db, get_db
from app.routes import admin, auth, buses, location, parent, platform, school
from app.services.location_service import mark_signal_lost_if_needed
from app.websockets import endpoints as ws_endpoints

logger = logging.getLogger(__name__)


async def _signal_lost_watcher() -> None:
    """Mark active trips signal_lost if no GPS for >30s (display state only)."""
    while True:
        try:
            buses = await get_db().buses.find({"trip_active": True}).to_list(200)
            for bus in buses:
                await mark_signal_lost_if_needed(str(bus["_id"]))
        except Exception as exc:
            logger.warning("signal_lost watcher: %s", exc)
        await asyncio.sleep(5)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(_signal_lost_watcher())
    yield
    task.cancel()
    await close_db()


app = FastAPI(title="School Bus Tracking API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(location.router)
app.include_router(buses.router)
app.include_router(admin.router)
app.include_router(parent.router)
app.include_router(platform.router)
app.include_router(school.router)
app.include_router(ws_endpoints.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def _web_dir() -> Path | None:
    backend_dir = Path(__file__).resolve().parent.parent
    for candidate in (backend_dir / "web", backend_dir.parent / "web"):
        if (candidate / "index.html").is_file():
            return candidate
    return None


_WEB_DIR = _web_dir()
if _WEB_DIR is not None:
    app.mount("/", StaticFiles(directory=_WEB_DIR, html=True), name="web")
