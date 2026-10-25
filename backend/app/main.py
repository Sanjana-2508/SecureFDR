import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, SessionLocal, engine
from .routers import auth, admin, fdrs, documents, releases, renewals, notifications

Base.metadata.create_all(bind=engine)

logger = logging.getLogger(__name__)
MATURITY_SCAN_INTERVAL_SECONDS = 24 * 60 * 60


def _run_scheduled_maturity_scan():
    db = SessionLocal()
    try:
        result = notifications.generate_maturity_alerts_for_all(db)
        logger.info("Automatic maturity-alert scan completed: %s", result)
    except Exception:
        db.rollback()
        logger.exception("Automatic maturity-alert scan failed")
    finally:
        db.close()


async def _daily_maturity_alert_scans():
    while True:
        await asyncio.to_thread(_run_scheduled_maturity_scan)
        await asyncio.sleep(MATURITY_SCAN_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scan_task = asyncio.create_task(
        _daily_maturity_alert_scans(),
        name="daily-maturity-alert-scans",
    )
    app.state.maturity_scan_task = scan_task
    try:
        yield
    finally:
        scan_task.cancel()
        try:
            await scan_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="SecureFDR API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(fdrs.router)
app.include_router(documents.router)
app.include_router(releases.router)
app.include_router(renewals.router)
app.include_router(notifications.router)

@app.get("/")
def root():
    return {"app": "SecureFDR", "status": "running", "docs": "/docs"}