import json

from fastapi import APIRouter, Depends, status
from sqlmodel import Session, select

from app.core.config import Settings, get_settings
from app.core.database import get_session
from app.core.errors import APIError
from app.models import ChatMessage, ChatRole, ChatStatus, EvidenceRecord
from app.schemas import ChatCreate
from app.services.chat import OpenAIChatGateway
from app.services.domain import (
    current_recommendation,
    get_case_or_404,
    get_chat_messages,
    serialize_evidence,
    serialize_recommendation,
)

router = APIRouter(tags=["chat"])


def _serialize_message(message: ChatMessage) -> dict:
    return {
        "id": message.id,
        "role": message.role.value,
        "content": message.content,
        "evidence_ids": json.loads(message.sources_json),
        "status": message.status.value,
        "created_at": message.created_at,
    }


@router.get("/cases/{case_id}/chat/messages")
def list_chat_messages(case_id: str, session: Session = Depends(get_session)) -> dict:
    get_case_or_404(session, case_id)
    messages = get_chat_messages(session, case_id)
    return {"items": [_serialize_message(message) for message in messages], "total": len(messages)}


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
    recent_messages = get_chat_messages(session, case.id, limit=20)
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
        "recommendation_snapshot": serialize_recommendation(session, recommendation),
        "evidences": evidences,
        "conversation": [
            {"role": message.role.value, "content": message.content}
            for message in recent_messages
            if message.status == ChatStatus.COMPLETED
        ],
        "question": payload.message,
    }
    try:
        result = OpenAIChatGateway(settings.openai_api_key, settings.openai_model).answer(context)
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
    evidence_ids = list(dict.fromkeys(item for item in result.evidence_ids if item in valid_ids))
    assistant_message = ChatMessage(
        case_id=case.id,
        role=ChatRole.ASSISTANT,
        content=result.answer,
        sources_json=json.dumps(evidence_ids),
    )
    session.add(assistant_message)
    session.commit()
    session.refresh(assistant_message)
    return {
        "user_message": _serialize_message(user_message),
        "assistant_message": _serialize_message(assistant_message),
        "sources": [evidence for evidence in evidences if evidence["id"] in evidence_ids],
    }
