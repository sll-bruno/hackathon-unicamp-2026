from fastapi import APIRouter

from app.core.database import check_database
from app.schemas.api import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    check_database()
    return HealthResponse(status="ok", database="ok")
