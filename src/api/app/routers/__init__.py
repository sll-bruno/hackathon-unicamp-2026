from app.routers.cases import router as cases_router
from app.routers.chat import router as chat_router
from app.routers.dashboard import router as dashboard_router
from app.routers.health import router as health_router
from app.routers.history import router as history_router
from app.routers.workflow import router as workflow_router

__all__ = [
    "cases_router",
    "chat_router",
    "dashboard_router",
    "health_router",
    "history_router",
    "workflow_router",
]
