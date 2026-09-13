from datetime import UTC, datetime
from enum import StrEnum
from uuid import uuid4

from sqlmodel import Field, SQLModel


def new_uuid() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(UTC)


class Action(StrEnum):
    ACORDO = "ACORDO"
    DEFESA = "DEFESA"


class DocumentType(StrEnum):
    AUTOS = "AUTOS"
    CONTRATO = "CONTRATO"
    EXTRATO = "EXTRATO"
    COMPROVANTE_CREDITO = "COMPROVANTE_CREDITO"
    DOSSIE = "DOSSIE"
    DEMONSTRATIVO_DIVIDA = "DEMONSTRATIVO_DIVIDA"
    LAUDO_REFERENCIADO = "LAUDO_REFERENCIADO"


class DocumentOrigin(StrEnum):
    SEED = "SEED"
    UPLOAD = "UPLOAD"


class CaseStatus(StrEnum):
    RASCUNHO = "RASCUNHO"
    DOCUMENTOS_ENVIADOS = "DOCUMENTOS_ENVIADOS"
    EM_ANALISE = "EM_ANALISE"
    AGUARDANDO_DECISAO = "AGUARDANDO_DECISAO"
    EM_NEGOCIACAO = "EM_NEGOCIACAO"
    AGUARDANDO_ENCERRAMENTO = "AGUARDANDO_ENCERRAMENTO"
    ENCERRADO = "ENCERRADO"


class OutcomeType(StrEnum):
    ACORDO = "ACORDO"
    IMPROCEDENCIA = "IMPROCEDENCIA"
    EXTINCAO = "EXTINCAO"
    PARCIAL = "PARCIAL"
    PROCEDENCIA = "PROCEDENCIA"


class DivergenceReason(StrEnum):
    FATO_NOVO = "FATO_NOVO"
    ERRO_EXTRACAO = "ERRO_EXTRACAO"
    VALOR_IRREAL = "VALOR_IRREAL"
    REGRA_CLIENTE = "REGRA_CLIENTE"
    OUTRO = "OUTRO"


class JobStatus(StrEnum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ChatRole(StrEnum):
    USER = "USER"
    ASSISTANT = "ASSISTANT"


class ChatStatus(StrEnum):
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class IntakeStatus(StrEnum):
    UPLOADED = "UPLOADED"
    EXTRACTING = "EXTRACTING"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    FAILED = "FAILED"
    CONFIRMED = "CONFIRMED"


class Office(SQLModel, table=True):
    __tablename__ = "offices"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    name: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=utc_now)


class Lawyer(SQLModel, table=True):
    __tablename__ = "lawyers"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    office_id: str = Field(foreign_key="offices.id", index=True)
    name: str
    email: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=utc_now)


class Case(SQLModel, table=True):
    __tablename__ = "cases"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    cnj: str = Field(index=True, unique=True)
    uf: str = Field(index=True, min_length=2, max_length=2)
    assunto: str = Field(index=True)
    subassunto: str = ""
    valor_causa: float = Field(ge=0)
    contrato: bool = False
    extrato: bool = False
    comprovante_credito: bool = False
    dossie: bool = False
    demonstrativo_divida: bool = False
    laudo_referenciado: bool = False
    status: CaseStatus = Field(default=CaseStatus.RASCUNHO, index=True)
    is_demo: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=utc_now, index=True)
    updated_at: datetime = Field(default_factory=utc_now)


class Document(SQLModel, table=True):
    __tablename__ = "documents"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    case_id: str = Field(foreign_key="cases.id", index=True)
    type: DocumentType = Field(index=True)
    original_name: str
    stored_path: str
    origin: DocumentOrigin
    created_at: datetime = Field(default_factory=utc_now)


class CaseStatusHistory(SQLModel, table=True):
    __tablename__ = "case_status_history"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    case_id: str = Field(foreign_key="cases.id", index=True)
    from_status: CaseStatus | None = None
    to_status: CaseStatus = Field(index=True)
    actor: str
    created_at: datetime = Field(default_factory=utc_now, index=True)


class AnalysisJob(SQLModel, table=True):
    __tablename__ = "analysis_jobs"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    case_id: str = Field(foreign_key="cases.id", index=True)
    status: JobStatus = Field(default=JobStatus.QUEUED, index=True)
    stage: str = "QUEUED"
    progress_percent: int = Field(default=0, ge=0, le=100)
    safe_error: str | None = None
    created_at: datetime = Field(default_factory=utc_now, index=True)
    started_at: datetime | None = None
    finished_at: datetime | None = None


class RecommendationRecord(SQLModel, table=True):
    __tablename__ = "recommendations"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    case_id: str = Field(foreign_key="cases.id", index=True)
    job_id: str | None = Field(default=None, foreign_key="analysis_jobs.id", index=True)
    action: Action = Field(index=True)
    confidence_percent: float | None = Field(default=None, ge=0, le=100)
    summary: str
    reason_codes_json: str = "[]"
    suggested_offer: float | None = Field(default=None, ge=0)
    expected_defense_cost: float = Field(ge=0)
    expected_savings: float = Field(ge=0)
    versions_json: str = "{}"
    payload_json: str
    source_kind: str = Field(default="ENGINE", index=True)
    is_current: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=utc_now, index=True)


class EvidenceRecord(SQLModel, table=True):
    __tablename__ = "evidences"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    recommendation_id: str = Field(foreign_key="recommendations.id", index=True)
    external_id: str = Field(index=True)
    text: str
    type: str
    weight: float | None = None
    sources_json: str = "[]"
    created_at: datetime = Field(default_factory=utc_now)


class LawyerDecision(SQLModel, table=True):
    __tablename__ = "lawyer_decisions"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    case_id: str = Field(foreign_key="cases.id", index=True, unique=True)
    recommendation_id: str = Field(foreign_key="recommendations.id", index=True)
    lawyer_id: str = Field(foreign_key="lawyers.id", index=True)
    action: Action
    adhered: bool = Field(index=True)
    divergence_reason: DivergenceReason | None = None
    divergence_details: str | None = None
    created_at: datetime = Field(default_factory=utc_now, index=True)


class NegotiationResult(SQLModel, table=True):
    __tablename__ = "negotiation_results"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    case_id: str = Field(foreign_key="cases.id", index=True, unique=True)
    decision_id: str = Field(foreign_key="lawyer_decisions.id", index=True)
    accepted: bool = Field(index=True)
    final_value: float | None = Field(default=None, ge=0)
    created_at: datetime = Field(default_factory=utc_now, index=True)


class CaseOutcome(SQLModel, table=True):
    __tablename__ = "case_outcomes"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    case_id: str = Field(foreign_key="cases.id", index=True, unique=True)
    outcome: OutcomeType = Field(index=True)
    final_value: float | None = Field(default=None, ge=0)
    defense_cost: float | None = Field(default=None, ge=0)
    court_award: float | None = Field(default=None, ge=0)
    legal_costs: float | None = Field(default=None, ge=0)
    notes: str | None = None
    source_kind: str = Field(default="OBSERVED", index=True)
    created_at: datetime = Field(default_factory=utc_now, index=True)


class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_messages"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    case_id: str = Field(foreign_key="cases.id", index=True)
    role: ChatRole
    content: str
    sources_json: str = "[]"
    status: ChatStatus = ChatStatus.COMPLETED
    created_at: datetime = Field(default_factory=utc_now, index=True)


class CaseIntake(SQLModel, table=True):
    """Upload-first intake: the AUTOS PDF is persisted before any case exists."""

    __tablename__ = "case_intakes"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    original_name: str
    stored_path: str
    status: IntakeStatus = Field(default=IntakeStatus.UPLOADED, index=True)
    stage: str = "UPLOADED"
    progress_percent: int = Field(default=0, ge=0, le=100)
    safe_error: str | None = None
    page_count: int | None = None
    ocr_pages_json: str = "[]"
    cnj: str | None = Field(default=None, index=True)
    cnj_page: int | None = None
    cnj_excerpt: str | None = None
    uf: str | None = None
    uf_page: int | None = None
    uf_excerpt: str | None = None
    assunto: str | None = None
    assunto_page: int | None = None
    assunto_excerpt: str | None = None
    subassunto: str | None = None
    subassunto_page: int | None = None
    subassunto_excerpt: str | None = None
    valor_causa: float | None = Field(default=None, ge=0)
    valor_causa_page: int | None = None
    valor_causa_excerpt: str | None = None
    created_case_id: str | None = Field(default=None, foreign_key="cases.id", index=True)
    created_at: datetime = Field(default_factory=utc_now, index=True)
    updated_at: datetime = Field(default_factory=utc_now)
