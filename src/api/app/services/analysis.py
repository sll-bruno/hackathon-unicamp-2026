import json
import time
from collections.abc import Callable

import decision_engine
from contracts.pipeline import CaseInput, PipelineDocument, PipelineOutput, SubsidyFlags
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.database import get_engine
from app.models import (
    AnalysisJob,
    Case,
    CaseStatus,
    Document,
    EvidenceRecord,
    JobStatus,
    RecommendationRecord,
)
from app.models.domain import utc_now
from app.services.demo_outputs import LIVE_REPLAY_CNJ, load_precomputed_output
from app.services.domain import transition_case


def build_engine_input(session: Session, case: Case) -> CaseInput:
    documents = session.exec(select(Document).where(Document.case_id == case.id)).all()
    return CaseInput(
        case_id=case.id,
        cnj=case.cnj,
        uf=case.uf,
        assunto=case.assunto,
        subassunto=case.subassunto,
        valor_causa=case.valor_causa,
        subsidy_flags=SubsidyFlags(
            contrato=case.contrato,
            extrato=case.extrato,
            comprovante_credito=case.comprovante_credito,
            dossie=case.dossie,
            demonstrativo_divida=case.demonstrativo_divida,
            laudo_referenciado=case.laudo_referenciado,
        ),
        documents=[
            PipelineDocument(id=document.id, type=document.type.value, path=document.stored_path)
            for document in documents
        ],
    )


def invoke_pipeline(
    case_input: CaseInput,
    on_progress: Callable[[str, int], None] | None = None,
) -> PipelineOutput:
    return PipelineOutput.model_validate(
        decision_engine.run_pipeline(case_input, on_progress=on_progress)
    )


def persist_engine_output(
    session: Session,
    job: AnalysisJob | None,
    output: PipelineOutput,
    *,
    case_id: str | None = None,
    source_kind: str = "ENGINE",
) -> RecommendationRecord:
    target_case_id = job.case_id if job is not None else case_id
    if target_case_id is None:
        raise ValueError("case_id is required when persisting an output without a job")
    old_recommendations = session.exec(
        select(RecommendationRecord).where(
            RecommendationRecord.case_id == target_case_id,
            RecommendationRecord.is_current.is_(True),
        )
    ).all()
    for previous in old_recommendations:
        previous.is_current = False
        session.add(previous)
    recommendation = RecommendationRecord(
        case_id=target_case_id,
        job_id=job.id if job is not None else None,
        action=output.recommendation.action,
        confidence_percent=output.recommendation.confidence_percent,
        summary=output.recommendation.summary,
        reason_codes_json=json.dumps(output.recommendation.reason_codes, ensure_ascii=False),
        suggested_offer=output.financial.suggested_offer,
        expected_defense_cost=output.financial.expected_defense_cost,
        expected_savings=output.financial.expected_savings,
        versions_json=json.dumps(output.versions, ensure_ascii=False),
        payload_json=json.dumps(output.complete_payload(), ensure_ascii=False),
        source_kind=source_kind,
        is_current=True,
    )
    session.add(recommendation)
    session.flush()
    for evidence in output.evidences:
        session.add(
            EvidenceRecord(
                recommendation_id=recommendation.id,
                external_id=evidence.id,
                text=evidence.text,
                type=evidence.type,
                weight=evidence.weight,
                sources_json=json.dumps(
                    [source.model_dump(mode="json") for source in evidence.sources],
                    ensure_ascii=False,
                ),
            )
        )
    return recommendation


DEMO_REPLAY_STAGES = (
    ("INGESTAO", 14, 0.15),
    ("EXTRACAO", 34, 0.27),
    ("RISCO", 58, 0.20),
    ("FINANCEIRO", 74, 0.14),
    ("DECISAO", 88, 0.14),
    ("PERSISTING_RESULT", 94, 0.10),
)


def _replay_precomputed_analysis(
    session: Session,
    job: AnalysisJob,
    output: PipelineOutput,
    duration_seconds: float,
) -> PipelineOutput:
    """Replay visible pipeline milestones while preserving the real engine output."""

    for stage, progress_percent, duration_fraction in DEMO_REPLAY_STAGES:
        job.stage = stage
        job.progress_percent = progress_percent
        session.add(job)
        session.commit()
        if duration_seconds > 0:
            time.sleep(duration_seconds * duration_fraction)
    return output


def run_analysis_job(job_id: str) -> None:
    with Session(get_engine()) as session:
        job = session.get(AnalysisJob, job_id)
        if job is None or job.status != JobStatus.QUEUED:
            return
        case = session.get(Case, job.case_id)
        if case is None:
            job.status = JobStatus.FAILED
            job.stage = "FAILED"
            job.progress_percent = 100
            job.safe_error = "Caso não encontrado durante a análise"
            job.finished_at = utc_now()
            session.add(job)
            session.commit()
            return
        job.status = JobStatus.RUNNING
        job.stage = "RUNNING_ENGINE"
        job.progress_percent = 10
        job.started_at = utc_now()
        session.add(job)
        session.commit()

        try:
            case_input = build_engine_input(session, case)
            documents = list(
                session.exec(select(Document).where(Document.case_id == case.id)).all()
            )

            def persist_progress(stage: str, progress_percent: int) -> None:
                # A engine sinaliza CONCLUIDO quando terminou o cálculo, antes de a API
                # persistir e projetar o resultado no workspace. Mapeamos esse marco para
                # a última etapa visível para não mostrar 100% antes de o resultado existir.
                if stage == "CONCLUIDO":
                    stage = "PERSISTING_RESULT"
                    progress_percent = 90
                job.stage = stage
                job.progress_percent = max(
                    job.progress_percent,
                    min(progress_percent, 90),
                )
                session.add(job)
                session.commit()

            settings = get_settings()
            precomputed = (
                load_precomputed_output(case.cnj, documents)
                if settings.demo_replay_enabled and case.cnj == LIVE_REPLAY_CNJ
                else None
            )
            output = (
                _replay_precomputed_analysis(
                    session,
                    job,
                    precomputed,
                    settings.demo_replay_seconds,
                )
                if precomputed is not None
                else invoke_pipeline(case_input, on_progress=persist_progress)
            )
            job.stage = "PERSISTING_RESULT"
            job.progress_percent = max(job.progress_percent, 94 if precomputed else 90)
            session.add(job)
            persist_engine_output(
                session,
                job,
                output,
                source_kind="ENGINE_PRECOMPUTED" if precomputed else "ENGINE",
            )
            job.status = JobStatus.COMPLETED
            job.stage = "COMPLETED"
            job.progress_percent = 100
            job.finished_at = utc_now()
            job.safe_error = None
            transition_case(session, case, CaseStatus.AGUARDANDO_DECISAO, "ENGINE")
            session.add(job)
            session.commit()
        except Exception:
            session.rollback()
            job = session.get(AnalysisJob, job_id)
            case = session.get(Case, job.case_id) if job is not None else None
            if job is not None:
                job.status = JobStatus.FAILED
                job.stage = "FAILED"
                job.progress_percent = 100
                job.safe_error = "Não foi possível concluir a análise"
                job.finished_at = utc_now()
                session.add(job)
            if case is not None:
                transition_case(session, case, CaseStatus.DOCUMENTOS_ENVIADOS, "ENGINE_ERROR")
            session.commit()


def recover_abandoned_jobs(session: Session) -> None:
    jobs = session.exec(
        select(AnalysisJob).where(AnalysisJob.status.in_([JobStatus.QUEUED, JobStatus.RUNNING]))
    ).all()
    now = utc_now()
    for job in jobs:
        job.status = JobStatus.FAILED
        job.stage = "FAILED_ON_RESTART"
        job.progress_percent = 100
        job.safe_error = "Análise interrompida pelo reinício da API; tente novamente"
        job.finished_at = now
        session.add(job)
        case = session.get(Case, job.case_id)
        if case is not None and case.status == CaseStatus.EM_ANALISE:
            transition_case(session, case, CaseStatus.DOCUMENTOS_ENVIADOS, "API_RESTART")
    session.commit()
