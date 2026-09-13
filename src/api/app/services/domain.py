import json
from datetime import datetime
from typing import Any

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.errors import APIError
from app.models import (
    AnalysisJob,
    Case,
    CaseIntake,
    CaseOutcome,
    CaseStatus,
    CaseStatusHistory,
    ChatMessage,
    Document,
    EvidenceRecord,
    LawyerDecision,
    NegotiationResult,
    RecommendationRecord,
)
from app.models.domain import utc_now


def json_loads(value: str, fallback: Any) -> Any:
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


def get_case_or_404(session: Session, case_id: str) -> Case:
    case = session.get(Case, case_id)
    if case is None:
        raise APIError(status.HTTP_404_NOT_FOUND, "CASE_NOT_FOUND", "Caso não encontrado")
    return case


def get_document_or_404(session: Session, document_id: str) -> Document:
    document = session.get(Document, document_id)
    if document is None:
        raise APIError(status.HTTP_404_NOT_FOUND, "DOCUMENT_NOT_FOUND", "Documento não encontrado")
    return document


def ensure_status(case: Case, allowed: set[CaseStatus], operation: str) -> None:
    if case.status not in allowed:
        raise APIError(
            status.HTTP_409_CONFLICT,
            "INVALID_CASE_STATE",
            f"O caso não pode {operation} no estado {case.status.value}",
            {
                "current_status": case.status.value,
                "allowed_statuses": sorted(s.value for s in allowed),
            },
        )


def transition_case(session: Session, case: Case, target: CaseStatus, actor: str) -> None:
    if case.status == target:
        return
    previous = case.status
    case.status = target
    case.updated_at = utc_now()
    session.add(case)
    session.add(
        CaseStatusHistory(
            case_id=case.id,
            from_status=previous,
            to_status=target,
            actor=actor,
        )
    )


def commit_or_conflict(session: Session, code: str, message: str) -> None:
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise APIError(status.HTTP_409_CONFLICT, code, message) from exc


def current_recommendation(session: Session, case_id: str) -> RecommendationRecord | None:
    return session.exec(
        select(RecommendationRecord)
        .where(RecommendationRecord.case_id == case_id, RecommendationRecord.is_current.is_(True))
        .order_by(RecommendationRecord.created_at.desc())
    ).first()


def serialize_document(document: Document) -> dict[str, Any]:
    return {
        "id": document.id,
        "case_id": document.case_id,
        "type": document.type.value,
        "name": document.original_name,
        "origin": document.origin.value,
        "created_at": document.created_at,
        "file_url": f"/api/documents/{document.id}/file",
    }


def serialize_evidence(evidence: EvidenceRecord) -> dict[str, Any]:
    return {
        "id": evidence.external_id,
        "text": evidence.text,
        "type": evidence.type,
        "weight": evidence.weight,
        "sources": json_loads(evidence.sources_json, []),
    }


def serialize_recommendation(
    session: Session, recommendation: RecommendationRecord | None
) -> dict[str, Any] | None:
    if recommendation is None:
        return None
    evidences = session.exec(
        select(EvidenceRecord)
        .where(EvidenceRecord.recommendation_id == recommendation.id)
        .order_by(EvidenceRecord.created_at)
    ).all()
    return {
        "id": recommendation.id,
        "action": recommendation.action.value,
        "confidence_percent": recommendation.confidence_percent,
        "summary": recommendation.summary,
        "reason_codes": json_loads(recommendation.reason_codes_json, []),
        "financial": {
            "suggested_offer": recommendation.suggested_offer,
            "expected_defense_cost": recommendation.expected_defense_cost,
            "expected_savings": recommendation.expected_savings,
        },
        "versions": json_loads(recommendation.versions_json, {}),
        "evidences": [serialize_evidence(evidence) for evidence in evidences],
        "source_kind": recommendation.source_kind,
        "is_current": recommendation.is_current,
        "created_at": recommendation.created_at,
    }


def serialize_case(
    session: Session, case: Case, include_recommendation: bool = True
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "id": case.id,
        "cnj": case.cnj,
        "uf": case.uf,
        "assunto": case.assunto,
        "subassunto": case.subassunto,
        "valor_causa": case.valor_causa,
        "plaintiff_name": case.plaintiff_name,
        "court": case.court,
        "contract_number": case.contract_number,
        "subsidy_flags": {
            "contrato": case.contrato,
            "extrato": case.extrato,
            "comprovante_credito": case.comprovante_credito,
            "dossie": case.dossie,
            "demonstrativo_divida": case.demonstrativo_divida,
            "laudo_referenciado": case.laudo_referenciado,
        },
        "status": case.status.value,
        "is_demo": case.is_demo,
        "created_at": case.created_at,
        "updated_at": case.updated_at,
    }
    if include_recommendation:
        result["recommendation"] = serialize_recommendation(
            session, current_recommendation(session, case.id)
        )
    return result


def serialize_model(model: Any) -> dict[str, Any] | None:
    if model is None:
        return None
    payload = model.model_dump(mode="json")
    for key, value in list(payload.items()):
        if hasattr(value, "value"):
            payload[key] = value.value
        elif isinstance(value, datetime):
            payload[key] = value.isoformat()
    return payload


def build_workspace(session: Session, case: Case) -> dict[str, Any]:
    documents = session.exec(
        select(Document).where(Document.case_id == case.id).order_by(Document.created_at)
    ).all()
    recommendation = current_recommendation(session, case.id)
    decision = session.exec(select(LawyerDecision).where(LawyerDecision.case_id == case.id)).first()
    negotiation = session.exec(
        select(NegotiationResult).where(NegotiationResult.case_id == case.id)
    ).first()
    outcome = session.exec(select(CaseOutcome).where(CaseOutcome.case_id == case.id)).first()
    job = session.exec(
        select(AnalysisJob)
        .where(AnalysisJob.case_id == case.id)
        .order_by(AnalysisJob.created_at.desc())
    ).first()
    case_payload = serialize_case(session, case, include_recommendation=False)
    engine_payload = (
        json_loads(recommendation.payload_json, {}) if recommendation is not None else {}
    )
    engine_recommendation = engine_payload.get("recommendation", {})
    engine_financial = engine_payload.get("financial", {})
    workspace_recommendation = None
    if recommendation is not None:
        workspace_recommendation = {
            "id": recommendation.id,
            "action": recommendation.action.value,
            "confidence_percent": recommendation.confidence_percent,
            "confidence_method_version": engine_payload.get("confidence_method_version"),
            "confidence_null_reason": engine_recommendation.get("confidence_null_reason"),
            "reason": recommendation.summary,
            "reason_codes": json_loads(recommendation.reason_codes_json, []),
            "expected_defense_cost": recommendation.expected_defense_cost,
            "defense_cost_range": engine_payload.get("defense_cost_range"),
            "settlement_range": engine_payload.get("settlement_range"),
            "expected_savings": recommendation.expected_savings,
            "suggested_offer": engine_financial.get(
                "suggested_offer", recommendation.suggested_offer
            ),
            "what_changes": engine_payload.get("what_changes", []),
            "assumptions": engine_payload.get("assumptions", []),
            "versions": json_loads(recommendation.versions_json, {}),
            "source_kind": recommendation.source_kind,
            "created_at": recommendation.created_at,
        }
    return {
        "case": {
            "case_id": case.id,
            "cnj": case.cnj,
            "plaintiff": case.plaintiff_name,
            "court": case.court,
            "uf": case.uf,
            "assunto": case.assunto,
            "thesis": case.subassunto,
            "claim_value": case.valor_causa,
            "contract_number": case.contract_number,
            "status": case.status.value,
        },
        "documents": [
            {
                "document_id": document.id,
                "filename": document.original_name,
                "type": document.type.value,
                "file_url": f"/api/documents/{document.id}/file",
            }
            for document in documents
        ],
        "subsidy_flags": case_payload["subsidy_flags"],
        "risk": engine_payload.get("risk"),
        "recommendation": workspace_recommendation,
        "facts": engine_payload.get("facts", []),
        "contradictions": engine_payload.get("contradictions", []),
        "gaps": engine_payload.get("gaps", []),
        "versions": json_loads(recommendation.versions_json, {})
        if recommendation is not None
        else {},
        "analyzed_at": recommendation.created_at if recommendation is not None else None,
        "decision": serialize_model(decision),
        "negotiation": serialize_model(negotiation),
        "outcome": serialize_model(outcome),
        "analysis_job": serialize_model(job),
    }


def get_chat_messages(session: Session, case_id: str, limit: int = 100) -> list[ChatMessage]:
    rows = session.exec(
        select(ChatMessage)
        .where(ChatMessage.case_id == case_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    ).all()
    return list(reversed(rows))


def _serialize_intake_field(value: Any, page: int | None, excerpt: str | None) -> dict[str, Any]:
    return {"value": value, "page": page, "excerpt": excerpt}


def serialize_intake(intake: CaseIntake, extraction_version: str = "autos-v1") -> dict[str, Any]:
    """Public intake payload: extracted fields with provenance, never internal paths."""
    return {
        "id": intake.id,
        "original_name": intake.original_name,
        "status": intake.status.value,
        "stage": intake.stage,
        "progress_percent": intake.progress_percent,
        "safe_error": intake.safe_error,
        "page_count": intake.page_count,
        "ocr_pages": json_loads(intake.ocr_pages_json, []),
        "extraction_version": extraction_version,
        "fields": {
            "cnj": _serialize_intake_field(intake.cnj, intake.cnj_page, intake.cnj_excerpt),
            "uf": _serialize_intake_field(intake.uf, intake.uf_page, intake.uf_excerpt),
            "assunto": _serialize_intake_field(
                intake.assunto, intake.assunto_page, intake.assunto_excerpt
            ),
            "subassunto": _serialize_intake_field(
                intake.subassunto, intake.subassunto_page, intake.subassunto_excerpt
            ),
            "valor_causa": _serialize_intake_field(
                intake.valor_causa, intake.valor_causa_page, intake.valor_causa_excerpt
            ),
        },
        "created_case_id": intake.created_case_id,
        "created_at": intake.created_at,
        "updated_at": intake.updated_at,
        "file_url": f"/api/intakes/{intake.id}/file",
    }
