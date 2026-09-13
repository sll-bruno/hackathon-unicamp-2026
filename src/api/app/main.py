import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app.core.config import get_settings
from app.core.database import create_db_and_tables, get_engine
from app.core.errors import install_error_handlers
from app.routers import (
    cases_router,
    chat_router,
    dashboard_router,
    health_router,
    history_router,
    intakes_router,
    workflow_router,
)
from app.services.analysis import recover_abandoned_jobs
from app.services.autos import recover_abandoned_intakes
from app.services.seeds import seed_demo_data

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    create_db_and_tables()
    with Session(get_engine()) as session:
        recover_abandoned_jobs(session)
        recover_abandoned_intakes(session)
        seed_demo_data(session, settings)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(application)
    for router in (
        health_router,
        cases_router,
        intakes_router,
        workflow_router,
        history_router,
        dashboard_router,
        chat_router,
    ):
        application.include_router(router, prefix="/api")
    return application


app = create_app()
