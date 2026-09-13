from pathlib import Path

from sqlmodel import Session, select

from app.core.config import Settings
from app.models import (
    AnalysisJob,
    AppMetadata,
    Case,
    CaseIntake,
    CaseOutcome,
    CaseStatus,
    CaseStatusHistory,
    ChatMessage,
    Document,
    DocumentOrigin,
    DocumentType,
    EvidenceRecord,
    Lawyer,
    LawyerDecision,
    NegotiationResult,
    Office,
    RecommendationRecord,
)
from app.models.domain import utc_now
from app.services.analysis import persist_engine_output
from app.services.demo_outputs import load_precomputed_output

OFFICE_NAME = "Amaral Advocacia — Demo"
LAWYER_EMAIL = "advogado.demo@enter.local"
DEMO_BASELINE_KEY = "demo_baseline_version"
DEMO_BASELINE_VERSION = "real-engine-v2"
LIVE_REPLAY_CNJ = "0654321-09.2024.8.04.0001"
LEGACY_DEMO_CNJS = {"0654321-09.2026.8.04.0002"}

CASE_SPECS = (
    {
        "cnj": "0801234-56.2024.8.10.0001",
        "folder": "Caso_01_0801234-56-2024-8-10-0001",
        "uf": "MA",
        "valor_causa": 20_000.0,
        "legacy_valor_causa": 10_000.0,
        "plaintiff_name": "Maria das Graças Silva Pereira",
        "court": "3ª Vara Cível · São Luís/MA",
        "contract_number": "502348719",
        "flags": (True, True, True, True, True, True),
        "documents": (
            (DocumentType.AUTOS, "01_Autos_Processo_0801234-56-2024-8-10-0001.pdf"),
            (DocumentType.CONTRATO, "02_Contrato_502348719.pdf"),
            (DocumentType.EXTRATO, "03_Extrato_Bancario.pdf"),
            (DocumentType.COMPROVANTE_CREDITO, "04_Comprovante_de_Credito_BACEN.pdf"),
            (DocumentType.DOSSIE, "05_Dossie_Veritas.pdf"),
            (DocumentType.DEMONSTRATIVO_DIVIDA, "06_Demonstrativo_Evolucao_Divida.pdf"),
            (DocumentType.LAUDO_REFERENCIADO, "07_Laudo_Referenciado.pdf"),
        ),
        "is_demo": True,
        "initial_status": CaseStatus.AGUARDANDO_ENCERRAMENTO,
    },
    {
        "cnj": "0654321-09.2024.8.04.0001",
        "folder": "Caso_02_0654321-09-2024-8-04-0001",
        "uf": "AM",
        "valor_causa": 25_000.0,
        "legacy_valor_causa": 8_000.0,
        "plaintiff_name": "José Raimundo Oliveira Costa",
        "court": "5ª Vara Cível · Manaus/AM",
        "contract_number": "603827451",
        "flags": (False, False, True, False, True, True),
        "documents": (
            (DocumentType.AUTOS, "01_Autos_Processo_0654321-09-2024-8-04-0001.pdf"),
            (DocumentType.COMPROVANTE_CREDITO, "02_Comprovante_de_Credito_BACEN.pdf"),
            (DocumentType.DEMONSTRATIVO_DIVIDA, "03_Demonstrativo_Evolucao_Divida.pdf"),
            (DocumentType.LAUDO_REFERENCIADO, "04_Laudo_Referenciado.pdf"),
        ),
        "is_demo": False,
        "initial_status": CaseStatus.DOCUMENTOS_ENVIADOS,
    },
)


def _get_or_create_profile(session: Session) -> Lawyer:
    office = session.exec(select(Office).where(Office.name == OFFICE_NAME)).first()
    if office is None:
        office = Office(name=OFFICE_NAME)
        session.add(office)
        session.flush()
    lawyer = session.exec(select(Lawyer).where(Lawyer.email == LAWYER_EMAIL)).first()
    if lawyer is None:
        lawyer = Lawyer(
            office_id=office.id,
            name="Advogado Demonstrador",
            email=LAWYER_EMAIL,
        )
        session.add(lawyer)
        session.flush()
    return lawyer


def _create_case(session: Session, spec: dict) -> tuple[Case, bool]:
    existing = session.exec(select(Case).where(Case.cnj == spec["cnj"])).first()
    if existing is not None:
        for field in ("plaintiff_name", "court", "contract_number"):
            if getattr(existing, field) is None:
                setattr(existing, field, spec[field])
                session.add(existing)
        if existing.valor_causa == spec["legacy_valor_causa"]:
            existing.valor_causa = spec["valor_causa"]
            session.add(existing)
        return existing, False
    contrato, extrato, comprovante, dossie, demonstrativo, laudo = spec["flags"]
    case = Case(
        cnj=spec["cnj"],
        uf=spec["uf"],
        assunto="Empréstimo consignado não reconhecido",
        subassunto="Inexistência de relação jurídica",
        valor_causa=spec["valor_causa"],
        plaintiff_name=spec["plaintiff_name"],
        court=spec["court"],
        contract_number=spec["contract_number"],
        contrato=contrato,
        extrato=extrato,
        comprovante_credito=comprovante,
        dossie=dossie,
        demonstrativo_divida=demonstrativo,
        laudo_referenciado=laudo,
        status=spec["initial_status"],
        is_demo=spec["is_demo"],
    )
    session.add(case)
    session.flush()
    session.add(
        CaseStatusHistory(
            case_id=case.id,
            from_status=None,
            to_status=case.status,
            actor="DEMO_SEED",
        )
    )
    return case, True


def _seed_documents(session: Session, case: Case, spec: dict, data_dir: Path) -> list[Document]:
    existing = session.exec(select(Document).where(Document.case_id == case.id)).all()
    existing_names = {document.original_name for document in existing}
    documents = list(existing)
    for document_type, filename in spec["documents"]:
        if filename in existing_names:
            continue
        document = Document(
            case_id=case.id,
            type=document_type,
            original_name=filename,
            stored_path=str((data_dir / spec["folder"] / filename).resolve()),
            origin=DocumentOrigin.SEED,
        )
        session.add(document)
        session.flush()
        documents.append(document)
    return documents


def _clear_case_workflow(session: Session, case: Case) -> None:
    for model in (CaseOutcome, NegotiationResult, LawyerDecision, ChatMessage):
        for record in session.exec(select(model).where(model.case_id == case.id)).all():
            session.delete(record)
    recommendations = session.exec(
        select(RecommendationRecord).where(RecommendationRecord.case_id == case.id)
    ).all()
    for recommendation in recommendations:
        for evidence in session.exec(
            select(EvidenceRecord).where(
                EvidenceRecord.recommendation_id == recommendation.id
            )
        ).all():
            session.delete(evidence)
        session.delete(recommendation)
    session.flush()
    for job in session.exec(select(AnalysisJob).where(AnalysisJob.case_id == case.id)).all():
        session.delete(job)
    session.flush()


def _set_baseline_status(session: Session, case: Case, status: CaseStatus) -> None:
    previous = case.status
    case.status = status
    case.updated_at = utc_now()
    session.add(case)
    if previous != status:
        session.add(
            CaseStatusHistory(
                case_id=case.id,
                from_status=previous,
                to_status=status,
                actor="DEMO_BASELINE",
            )
        )


def _reset_demo_baseline(
    session: Session,
    seeded_cases: list[tuple[Case, list[Document], dict]],
    lawyer: Lawyer,
) -> None:
    for case, documents, spec in seeded_cases:
        _clear_case_workflow(session, case)
        _set_baseline_status(session, case, spec["initial_status"])
        if spec["is_demo"]:
            recommendation = _persist_case_one_output(session, case, documents)
            _ensure_case_one_decision(session, case, lawyer, recommendation)


def _persist_case_one_output(
    session: Session, case: Case, documents: list[Document]
) -> RecommendationRecord:
    existing = session.exec(
        select(RecommendationRecord).where(
            RecommendationRecord.case_id == case.id,
            RecommendationRecord.is_current.is_(True),
        )
    ).first()
    if existing is not None:
        return existing
    output = load_precomputed_output(case.cnj, documents)
    if output is None:
        raise ValueError(f"Missing precomputed engine output for {case.cnj}")
    return persist_engine_output(
        session,
        None,
        output,
        case_id=case.id,
        source_kind="ENGINE_PRECOMPUTED",
    )


def _ensure_case_one_decision(
    session: Session,
    case: Case,
    lawyer: Lawyer,
    recommendation: RecommendationRecord,
) -> LawyerDecision:
    existing = session.exec(
        select(LawyerDecision).where(LawyerDecision.case_id == case.id)
    ).first()
    if existing is not None:
        return existing
    decision = LawyerDecision(
        case_id=case.id,
        recommendation_id=recommendation.id,
        lawyer_id=lawyer.id,
        action=recommendation.action,
        adhered=True,
    )
    session.add(decision)
    session.flush()
    return decision


def _remove_legacy_demo_cases(session: Session) -> None:
    for cnj in LEGACY_DEMO_CNJS:
        case = session.exec(select(Case).where(Case.cnj == cnj)).first()
        if case is None:
            continue
        _clear_case_workflow(session, case)
        for intake in session.exec(
            select(CaseIntake).where(CaseIntake.created_case_id == case.id)
        ).all():
            session.delete(intake)
        for model in (Document, CaseStatusHistory):
            for record in session.exec(select(model).where(model.case_id == case.id)).all():
                session.delete(record)
        session.flush()
        session.delete(case)
        session.flush()


def reset_demo_case_two(session: Session) -> Case:
    case = session.exec(select(Case).where(Case.cnj == LIVE_REPLAY_CNJ)).first()
    if case is None:
        raise ValueError(f"Missing live replay case {LIVE_REPLAY_CNJ}")
    _clear_case_workflow(session, case)
    _set_baseline_status(session, case, CaseStatus.DOCUMENTOS_ENVIADOS)
    session.commit()
    session.refresh(case)
    return case


def _baseline_marker(session: Session) -> AppMetadata | None:
    return session.get(AppMetadata, DEMO_BASELINE_KEY)


def seed_demo_data(session: Session, settings: Settings) -> None:
    if not settings.demo_seed:
        return
    lawyer = _get_or_create_profile(session)
    _remove_legacy_demo_cases(session)
    seeded_cases: list[tuple[Case, list[Document], dict]] = []
    for spec in CASE_SPECS:
        case, _created = _create_case(session, spec)
        documents = _seed_documents(session, case, spec, settings.data_dir)
        seeded_cases.append((case, documents, spec))

    marker = _baseline_marker(session)
    if marker is None or marker.value != DEMO_BASELINE_VERSION:
        _reset_demo_baseline(session, seeded_cases, lawyer)
        if marker is None:
            marker = AppMetadata(key=DEMO_BASELINE_KEY, value=DEMO_BASELINE_VERSION)
        else:
            marker.value = DEMO_BASELINE_VERSION
            marker.updated_at = utc_now()
        session.add(marker)
    else:
        case_one, case_one_documents, _spec = seeded_cases[0]
        recommendation = _persist_case_one_output(session, case_one, case_one_documents)
        if case_one.status == CaseStatus.AGUARDANDO_ENCERRAMENTO:
            _ensure_case_one_decision(session, case_one, lawyer, recommendation)
    session.commit()
