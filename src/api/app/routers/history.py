from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.core.database import get_session
from app.models import (
    AnalysisJob,
    CaseOutcome,
    CaseStatusHistory,
    LawyerDecision,
    NegotiationResult,
)
from app.services.domain import serialize_model

router = APIRouter(tags=["history"])


def _comparable(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(UTC).replace(tzinfo=None)
    return value


@router.get("/history")
def get_history(
    case_id: str | None = None,
    event_type: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    events: list[dict[str, Any]] = []
    tables = (
        (CaseStatusHistory, "STATUS_CHANGED"),
        (AnalysisJob, "ANALYSIS_JOB"),
        (LawyerDecision, "LAWYER_DECISION"),
        (NegotiationResult, "NEGOTIATION_RESULT"),
        (CaseOutcome, "CASE_OUTCOME"),
    )
    for model, kind in tables:
        statement = select(model)
        if case_id is not None:
            statement = statement.where(model.case_id == case_id)
        for row in session.exec(statement).all():
            payload = serialize_model(row) or {}
            created_at = row.created_at
            events.append(
                {
                    "id": row.id,
                    "case_id": row.case_id,
                    "type": kind,
                    "created_at": created_at,
                    "payload": payload,
                }
            )
    if event_type is not None:
        events = [event for event in events if event["type"] == event_type.upper()]
    if from_date is not None:
        minimum_date = _comparable(from_date)
        events = [event for event in events if _comparable(event["created_at"]) >= minimum_date]
    if to_date is not None:
        maximum_date = _comparable(to_date)
        events = [event for event in events if _comparable(event["created_at"]) <= maximum_date]
    minimum = datetime.min
    events.sort(key=lambda event: event["created_at"] or minimum, reverse=True)
    return {"items": events[:limit], "total": len(events)}
