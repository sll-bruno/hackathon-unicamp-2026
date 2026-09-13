from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models import Action, CaseStatus, DivergenceReason, DocumentType, OutcomeType


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SubsidyFlagsInput(APIModel):
    contrato: bool = False
    extrato: bool = False
    comprovante_credito: bool = False
    dossie: bool = False
    demonstrativo_divida: bool = False
    laudo_referenciado: bool = False


class CaseCreate(APIModel):
    cnj: str = Field(min_length=5, max_length=40)
    uf: str = Field(min_length=2, max_length=2)
    assunto: str = Field(min_length=1, max_length=250)
    subassunto: str = Field(default="", max_length=250)
    valor_causa: float = Field(ge=0)
    plaintiff_name: str | None = Field(default=None, max_length=250)
    court: str | None = Field(default=None, max_length=250)
    contract_number: str | None = Field(default=None, max_length=100)
    subsidy_flags: SubsidyFlagsInput = Field(default_factory=SubsidyFlagsInput)

    @field_validator("cnj", "assunto", "subassunto")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("plaintiff_name", "court", "contract_number")
    @classmethod
    def strip_optional_metadata(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("uf")
    @classmethod
    def normalize_uf(cls, value: str) -> str:
        return value.strip().upper()


class CasePatch(APIModel):
    cnj: str | None = Field(default=None, min_length=5, max_length=40)
    uf: str | None = Field(default=None, min_length=2, max_length=2)
    assunto: str | None = Field(default=None, min_length=1, max_length=250)
    subassunto: str | None = Field(default=None, max_length=250)
    valor_causa: float | None = Field(default=None, ge=0)
    plaintiff_name: str | None = Field(default=None, max_length=250)
    court: str | None = Field(default=None, max_length=250)
    contract_number: str | None = Field(default=None, max_length=100)
    subsidy_flags: SubsidyFlagsInput | None = None

    @field_validator("cnj", "assunto", "subassunto")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None

    @field_validator("plaintiff_name", "court", "contract_number")
    @classmethod
    def strip_optional_metadata(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("uf")
    @classmethod
    def normalize_optional_uf(cls, value: str | None) -> str | None:
        return value.strip().upper() if value is not None else None


class DocumentPatch(APIModel):
    type: DocumentType


class IntakeConfirm(APIModel):
    """Human corrections applied on top of the extracted intake fields."""

    cnj: str | None = Field(default=None, max_length=40)
    uf: str | None = Field(default=None, max_length=2)
    assunto: str | None = Field(default=None, max_length=250)
    subassunto: str | None = Field(default=None, max_length=250)
    valor_causa: float | None = Field(default=None, ge=0)

    @field_validator("cnj", "assunto", "subassunto")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("uf")
    @classmethod
    def normalize_optional_confirm_uf(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().upper()
        return normalized or None


class DecisionCreate(APIModel):
    action: Action
    divergence_reason: DivergenceReason | None = None
    divergence_details: str | None = Field(default=None, max_length=1000)


class NegotiationCreate(APIModel):
    accepted: bool
    final_value: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def accepted_requires_value(self) -> "NegotiationCreate":
        if self.accepted and self.final_value is None:
            raise ValueError("final_value é obrigatório quando o acordo é aceito")
        return self


class ClosureCreate(APIModel):
    outcome: OutcomeType
    final_value: float | None = Field(default=None, ge=0)
    defense_cost: float | None = Field(default=None, ge=0)
    court_award: float | None = Field(default=None, ge=0)
    legal_costs: float | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=2000)


class ChatCreate(APIModel):
    message: str = Field(min_length=1, max_length=4000)

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("message não pode ser vazio")
        return value


class ChatAnswerPoint(APIModel):
    title: str = Field(max_length=80)
    text: str = Field(max_length=320)
    evidence_ids: list[str] = Field(default_factory=list, max_length=3)


class ChatAnswer(APIModel):
    summary: str = Field(max_length=280)
    points: list[ChatAnswerPoint] = Field(min_length=1, max_length=4)
    caveat: str | None = Field(default=None, max_length=280)


class HealthResponse(APIModel):
    status: str
    database: str


class Page(APIModel):
    items: list[dict[str, Any]]
    page: int
    page_size: int
    total: int


class StatusSummary(APIModel):
    total: int
    by_status: dict[CaseStatus, int]
