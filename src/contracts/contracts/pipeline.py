"""Contrato mínimo compartilhado entre a API e a engine de decisão.

Os blocos aceitam campos adicionais para que a engine possa evoluir sem obrigar
o backend a conhecer suas regras internas. A API persiste o payload validado por
inteiro e projeta apenas os campos definidos aqui.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="allow")


class SubsidyFlags(ContractModel):
    contrato: bool
    extrato: bool
    comprovante_credito: bool
    dossie: bool
    demonstrativo_divida: bool
    laudo_referenciado: bool


class PipelineDocument(ContractModel):
    id: str
    type: str
    path: str


class CaseInput(ContractModel):
    case_id: str
    cnj: str
    uf: str
    assunto: str
    subassunto: str
    valor_causa: float = Field(ge=0)
    subsidy_flags: SubsidyFlags
    documents: list[PipelineDocument] = Field(default_factory=list)


class EvidenceSource(ContractModel):
    document_id: str
    page: int | None = Field(default=None, ge=1)
    excerpt: str


class Evidence(ContractModel):
    id: str
    text: str
    type: str
    weight: float | None = None
    sources: list[EvidenceSource] = Field(default_factory=list)


class Recommendation(ContractModel):
    action: Literal["ACORDO", "DEFESA"]
    confidence_percent: float | None = Field(default=None, ge=0, le=100)
    summary: str
    reason_codes: list[str] = Field(default_factory=list)


class FinancialProjection(ContractModel):
    suggested_offer: float | None = Field(default=None, ge=0)
    expected_defense_cost: float = Field(ge=0)
    expected_savings: float = Field(ge=0)


class PipelineOutput(ContractModel):
    versions: dict[str, str]
    recommendation: Recommendation
    financial: FinancialProjection
    evidences: list[Evidence] = Field(default_factory=list)

    @field_validator("versions")
    @classmethod
    def versions_must_not_be_empty(cls, value: dict[str, str]) -> dict[str, str]:
        if not value or any(
            not key.strip() or not version.strip() for key, version in value.items()
        ):
            raise ValueError("versions must contain non-empty names and values")
        return value

    def complete_payload(self) -> dict[str, Any]:
        """Return the complete output, including extra fields supplied by the engine."""

        return self.model_dump(mode="json")
