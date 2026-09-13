from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlmodel import Session, select

from app.core.config import Settings, get_settings
from app.core.database import get_session
from app.core.errors import APIError
from app.models import (
    Action,
    AnalysisJob,
    CaseOutcome,
    CaseStatus,
    Document,
    JobStatus,
    Lawyer,
    LawyerDecision,
    NegotiationResult,
    OutcomeType,
)
from app.schemas import ClosureCreate, DecisionCreate, NegotiationCreate
from app.services.analysis import run_analysis_job
from app.services.domain import (
    build_workspace,
    current_recommendation,
    ensure_status,
    get_case_or_404,
    serialize_model,
    transition_case,
)
from app.services.seeds import reset_demo_baseline

router = APIRouter(tags=["workflow"])


@router.post("/demo/reset-case-two")
def reset_case_two_for_demo(
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    if not settings.demo_seed:
        raise APIError(404, "DEMO_RESET_NOT_AVAILABLE", "O reset da demo não está disponível")
    return build_workspace(session, reset_demo_baseline(session))


@router.post("/cases/{case_id}/analyze", status_code=status.HTTP_202_ACCEPTED)
def analyze_case(
    case_id: str,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
) -> dict:
    case = get_case_or_404(session, case_id)
    ensure_status(
        case,
        {CaseStatus.DOCUMENTOS_ENVIADOS, CaseStatus.AGUARDANDO_DECISAO},
        "ser analisado",
    )
    if not session.exec(select(Document).where(Document.case_id == case.id)).first():
        raise APIError(409, "DOCUMENTS_REQUIRED", "Adicione ao menos um documento antes da análise")
    if session.exec(select(LawyerDecision).where(LawyerDecision.case_id == case.id)).first():
        raise APIError(
            409, "DECISION_ALREADY_TAKEN", "O caso não pode ser reanalisado após a decisão"
        )
    active = session.exec(
        select(AnalysisJob).where(
            AnalysisJob.case_id == case.id,
            AnalysisJob.status.in_([JobStatus.QUEUED, JobStatus.RUNNING]),
        )
    ).first()
    if active is not None:
        raise APIError(409, "ANALYSIS_ALREADY_RUNNING", "Já existe uma análise ativa para o caso")
    job = AnalysisJob(case_id=case.id)
    session.add(job)
    transition_case(session, case, CaseStatus.EM_ANALISE, "LAWYER")
    session.commit()
    session.refresh(job)
    background_tasks.add_task(run_analysis_job, job.id)
    return serialize_model(job) or {}


@router.get("/cases/{case_id}/analysis")
def get_analysis(case_id: str, session: Session = Depends(get_session)) -> dict:
    get_case_or_404(session, case_id)
    job = session.exec(
        select(AnalysisJob)
        .where(AnalysisJob.case_id == case_id)
        .order_by(AnalysisJob.created_at.desc())
    ).first()
    if job is None:
        raise APIError(404, "ANALYSIS_NOT_FOUND", "Nenhuma análise foi iniciada para o caso")
    return serialize_model(job) or {}


@router.get("/cases/{case_id}/workspace")
def get_workspace(case_id: str, session: Session = Depends(get_session)) -> dict:
    return build_workspace(session, get_case_or_404(session, case_id))


@router.post("/cases/{case_id}/decision", status_code=status.HTTP_201_CREATED)
def create_decision(
    case_id: str, payload: DecisionCreate, session: Session = Depends(get_session)
) -> dict:
    case = get_case_or_404(session, case_id)
    ensure_status(case, {CaseStatus.AGUARDANDO_DECISAO}, "receber uma decisão")
    if session.exec(select(LawyerDecision).where(LawyerDecision.case_id == case.id)).first():
        raise APIError(409, "DECISION_ALREADY_EXISTS", "O caso já possui uma decisão")
    recommendation = current_recommendation(session, case.id)
    if recommendation is None:
        raise APIError(409, "RECOMMENDATION_REQUIRED", "A decisão exige uma recomendação concluída")
    adhered = payload.action == recommendation.action
    if not adhered and payload.divergence_reason is None:
        raise APIError(
            422,
            "DIVERGENCE_REASON_REQUIRED",
            "Informe o motivo ao divergir da recomendação",
        )
    if adhered and payload.divergence_reason is not None:
        raise APIError(
            422,
            "DIVERGENCE_REASON_NOT_ALLOWED",
            "Motivo de divergência só pode ser informado ao divergir",
        )
    lawyer = session.exec(select(Lawyer).order_by(Lawyer.created_at)).first()
    if lawyer is None:
        raise APIError(409, "LAWYER_PROFILE_REQUIRED", "O perfil do advogado não está configurado")
    decision = LawyerDecision(
        case_id=case.id,
        recommendation_id=recommendation.id,
        lawyer_id=lawyer.id,
        action=payload.action,
        adhered=adhered,
        divergence_reason=payload.divergence_reason,
        divergence_details=payload.divergence_details,
    )
    session.add(decision)
    target = (
        CaseStatus.EM_NEGOCIACAO
        if payload.action == Action.ACORDO
        else CaseStatus.AGUARDANDO_ENCERRAMENTO
    )
    transition_case(session, case, target, "LAWYER")
    session.commit()
    session.refresh(decision)
    return serialize_model(decision) or {}


@router.post("/cases/{case_id}/negotiation-result", status_code=status.HTTP_201_CREATED)
def create_negotiation_result(
    case_id: str, payload: NegotiationCreate, session: Session = Depends(get_session)
) -> dict:
    case = get_case_or_404(session, case_id)
    ensure_status(case, {CaseStatus.EM_NEGOCIACAO}, "receber o resultado da negociação")
    if session.exec(select(NegotiationResult).where(NegotiationResult.case_id == case.id)).first():
        raise APIError(409, "NEGOTIATION_ALREADY_EXISTS", "A negociação já foi registrada")
    decision = session.exec(select(LawyerDecision).where(LawyerDecision.case_id == case.id)).first()
    if decision is None or decision.action != Action.ACORDO:
        raise APIError(409, "AGREEMENT_DECISION_REQUIRED", "O caso não possui decisão de acordo")
    negotiation = NegotiationResult(
        case_id=case.id,
        decision_id=decision.id,
        accepted=payload.accepted,
        final_value=payload.final_value if payload.accepted else None,
    )
    session.add(negotiation)
    if payload.accepted:
        session.add(
            CaseOutcome(
                case_id=case.id,
                outcome=OutcomeType.ACORDO,
                final_value=payload.final_value,
            )
        )
        transition_case(session, case, CaseStatus.ENCERRADO, "LAWYER")
    else:
        transition_case(session, case, CaseStatus.AGUARDANDO_ENCERRAMENTO, "LAWYER")
    session.commit()
    session.refresh(negotiation)
    return serialize_model(negotiation) or {}


@router.post("/cases/{case_id}/closure", status_code=status.HTTP_201_CREATED)
def close_case(
    case_id: str, payload: ClosureCreate, session: Session = Depends(get_session)
) -> dict:
    case = get_case_or_404(session, case_id)
    ensure_status(case, {CaseStatus.AGUARDANDO_ENCERRAMENTO}, "ser encerrado")
    if payload.outcome == OutcomeType.ACORDO:
        raise APIError(
            422,
            "AGREEMENT_USE_NEGOTIATION",
            "Acordo aceito deve ser registrado no resultado da negociação",
        )
    if session.exec(select(CaseOutcome).where(CaseOutcome.case_id == case.id)).first():
        raise APIError(409, "OUTCOME_ALREADY_EXISTS", "O desfecho já foi registrado")
    outcome = CaseOutcome(case_id=case.id, **payload.model_dump())
    session.add(outcome)
    transition_case(session, case, CaseStatus.ENCERRADO, "LAWYER")
    session.commit()
    session.refresh(outcome)
    return serialize_model(outcome) or {}
