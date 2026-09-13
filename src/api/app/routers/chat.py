import json

from fastapi import APIRouter, Depends, status
from sqlmodel import Session, select

from app.core.config import Settings, get_settings
from app.core.database import get_session
from app.core.errors import APIError
from app.models import ChatMessage, ChatRole, ChatStatus, EvidenceRecord
from app.schemas import ChatAnswer, ChatCreate
from app.services.chat import OpenAIChatGateway
from app.services.domain import (
    current_recommendation,
    get_case_or_404,
    get_chat_messages,
    serialize_evidence,
    serialize_recommendation,
)

router = APIRouter(tags=["chat"])


def _runtime(settings: Settings) -> dict:
    return {
        "provider": "OpenAI",
        "model": settings.openai_chat_model,
        "reasoning_effort": settings.openai_chat_reasoning_effort,
    }


def _compact_block(items: list[dict], limit: int) -> list[dict]:
    compact: list[dict] = []
    for item in items[:limit]:
        row = {
            key: item[key]
            for key in ("id", "description", "relation", "weight", "claim", "note", "impact")
            if item.get(key) is not None
        }
        row["sources"] = [
            {
                "document_id": source.get("document_id"),
                "page": source.get("page"),
                "excerpt": (source.get("excerpt") or "")[:280],
            }
            for source in item.get("sources", [])[:2]
        ]
        compact.append(row)
    return compact


def _serialize_message(message: ChatMessage) -> dict:
    content = message.content
    structured_answer = None
    if message.role == ChatRole.ASSISTANT and message.status == ChatStatus.COMPLETED:
        try:
            structured = ChatAnswer.model_validate_json(message.content)
            structured_answer = structured.model_dump(mode="json")
            content = structured.summary
        except ValueError:
            pass
    return {
        "id": message.id,
        "role": message.role.value,
        "content": content,
        "evidence_ids": json.loads(message.sources_json),
        "structured_answer": structured_answer,
        "status": message.status.value,
        "created_at": message.created_at,
    }


@router.get("/cases/{case_id}/chat/messages")
def list_chat_messages(
    case_id: str,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    get_case_or_404(session, case_id)
    messages = get_chat_messages(session, case_id)
    return {
        "items": [_serialize_message(message) for message in messages],
        "total": len(messages),
        "runtime": _runtime(settings),
    }


@router.post("/cases/{case_id}/chat/messages", status_code=status.HTTP_201_CREATED)
def create_chat_message(
    case_id: str,
    payload: ChatCreate,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    case = get_case_or_404(session, case_id)
    recommendation = current_recommendation(session, case.id)
    if recommendation is None:
        raise APIError(409, "RECOMMENDATION_REQUIRED", "O chat exige uma análise concluída")
    if not settings.openai_api_key:
        raise APIError(503, "OPENAI_NOT_CONFIGURED", "A chave da OpenAI não está configurada")

    evidence_rows = session.exec(
        select(EvidenceRecord).where(EvidenceRecord.recommendation_id == recommendation.id)
    ).all()
    evidences = [serialize_evidence(evidence) for evidence in evidence_rows]
    engine_snapshot = json.loads(recommendation.payload_json)
    recommendation_snapshot = serialize_recommendation(session, recommendation) or {}
    recommendation_snapshot.pop("evidences", None)
    recent_messages = get_chat_messages(session, case.id, limit=6)
    user_message = ChatMessage(case_id=case.id, role=ChatRole.USER, content=payload.message)
    session.add(user_message)
    session.commit()
    session.refresh(user_message)

    context = {
        "case": {
            "cnj": case.cnj,
            "uf": case.uf,
            "assunto": case.assunto,
            "subassunto": case.subassunto,
            "valor_causa": case.valor_causa,
        },
        "analysis_snapshot": {
            "recommendation": recommendation_snapshot,
            "risk": engine_snapshot.get("risk"),
            "facts": _compact_block(engine_snapshot.get("facts", []), 20),
            "contradictions": _compact_block(engine_snapshot.get("contradictions", []), 8),
            "gaps": _compact_block(engine_snapshot.get("gaps", []), 10),
            "what_changes": engine_snapshot.get("what_changes", []),
            "assumptions": engine_snapshot.get("assumptions", []),
        },
        "conversation": [
            {"role": message.role.value, "content": _serialize_message(message)["content"]}
            for message in recent_messages
            if message.status == ChatStatus.COMPLETED
        ],
        "question": payload.message,
    }
    try:
        result = OpenAIChatGateway(
            settings.openai_api_key,
            settings.openai_chat_model,
            settings.openai_chat_reasoning_effort,
        ).answer(context)
    except Exception as exc:
        failed = ChatMessage(
            case_id=case.id,
            role=ChatRole.ASSISTANT,
            content="Não foi possível obter a resposta do provedor.",
            status=ChatStatus.FAILED,
        )
        session.add(failed)
        session.commit()
        raise APIError(502, "OPENAI_PROVIDER_ERROR", "Falha ao consultar a OpenAI") from exc

    valid_ids = {evidence["id"] for evidence in evidences}
    result = result.model_copy(
        update={
            "points": [
                point.model_copy(
                    update={
                        "evidence_ids": list(
                            dict.fromkeys(
                                item for item in point.evidence_ids if item in valid_ids
                            )
                        )
                    }
                )
                for point in result.points
            ]
        }
    )
    evidence_ids = list(
        dict.fromkeys(item for point in result.points for item in point.evidence_ids)
    )
    assistant_message = ChatMessage(
        case_id=case.id,
        role=ChatRole.ASSISTANT,
        content=result.model_dump_json(),
        sources_json=json.dumps(evidence_ids),
    )
    session.add(assistant_message)
    session.commit()
    session.refresh(assistant_message)
    return {
        "user_message": _serialize_message(user_message),
        "assistant_message": _serialize_message(assistant_message),
        "sources": [evidence for evidence in evidences if evidence["id"] in evidence_ids],
        "runtime": _runtime(settings),
    }
