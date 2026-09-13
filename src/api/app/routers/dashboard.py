from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.database import get_session
from app.services.metrics import build_dashboard

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
def dashboard(session: Session = Depends(get_session)) -> dict:
    return build_dashboard(session)
