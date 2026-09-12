"""Contrato inicial compartilhado. Alinhar mudanças entre as três frentes."""
from typing import Literal
from pydantic import BaseModel, Field


class SubsidyFlags(BaseModel):
    contrato: bool
    extrato: bool
    comprovante_credito: bool
    dossie: bool
    demonstrativo_divida: bool
    laudo_referenciado: bool


class CaseInput(BaseModel):
    case_id: str
    uf: str
    thesis: str
    claim_value: float = Field(ge=0)
    subsidy_flags: SubsidyFlags
    document_paths: list[str] = Field(default_factory=list)


class Source(BaseModel):
    document: str
    page: int = Field(ge=1)
    excerpt: str


class Fact(BaseModel):
    id: str
    fact_type: str
    description: str
    weight: float | None = None
    weights_version: str
    sources: list[Source] = Field(default_factory=list)


class PipelineOutput(BaseModel):
    action: Literal["ACORDO", "DEFESA"]
    confidence_percent: float | None = Field(ge=0, le=100)
    confidence_method_version: str | None = None
    expected_defense_cost: float = Field(ge=0)
    suggested_offer: float = Field(ge=0)
    reason: str
    facts: list[Fact] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    versions: dict[str, str] = Field(default_factory=dict)
