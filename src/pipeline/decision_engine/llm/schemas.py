"""Formatos de resposta das chamadas de LLM (saída estruturada estrita)."""

from functools import lru_cache
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, create_model

AccusationType = Literal[
    "inexistencia_contratacao", "dano_material", "dano_moral", "outro_pedido_monetario"
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Referencia(StrictModel):
    chunk_id: str
    trecho: str


class TriagemPeticao(StrictModel):
    no_escopo: bool
    motivo_escopo: str
    subassunto: Literal["GOLPE", "GENERICO"]
    ambiguo: bool
    referencias_subassunto: list[Referencia]


class Acusacao(StrictModel):
    id: str
    tipo: AccusationType
    descricao: str
    depende_de: str | None
    inferida: bool
    forma_pedido: Literal[
        "valor_explicito",
        "dobro_dos_descontos",
        "simples_dos_descontos",
        "a_arbitrar",
        "sem_valor_monetario",
    ]
    valor_texto: str | None
    referencias: list[Referencia]


class PedidoProcessual(StrictModel):
    tipo: Literal[
        "tutela_urgencia",
        "gratuidade",
        "inversao_onus",
        "citacao",
        "custas_honorarios",
        "producao_provas",
        "outro",
    ]
    descricao: str
    referencias: list[Referencia]


class EventoCronologia(StrictModel):
    evento: str
    data: str
    referencias: list[Referencia]


class AnexoCitado(StrictModel):
    descricao: str
    chunk_id: str
    trecho: str


class ExtracaoAcusacoes(StrictModel):
    acusacoes: list[Acusacao]
    pedidos_processuais: list[PedidoProcessual]
    cronologia: list[EventoCronologia]
    anexos_citados: list[AnexoCitado]


class ReferenciaEmbasamento(StrictModel):
    tipo: Literal["trecho", "ausencia_documental"]
    chunk_id: str | None
    trecho: str | None
    documentos_esperados: list[str]


class Embasamento(StrictModel):
    id: str
    titulo: str
    descricao: str
    justificativa: str
    referencias: list[ReferenciaEmbasamento]


@lru_cache
def embasamentos_schema(accusation_type: str, categories: tuple[str, ...]) -> type[StrictModel]:
    """Schema com uma lista obrigatória por categoria permitida para o tipo de acusação."""

    groups = create_model(  # type: ignore[call-overload]
        f"Embasamentos_{accusation_type}",
        __base__=StrictModel,
        **{category: (list[Embasamento], ...) for category in categories},
    )
    return create_model(
        f"ExtracaoEmbasamentos_{accusation_type}",
        __base__=StrictModel,
        acusacao_id=(str, ...),
        embasamentos=(groups, ...),
    )


class RevisaoItem(StrictModel):
    id: str
    status: Literal["aprovado", "reprovado", "reclassificar"]
    categoria_sugerida: str | None
    motivo: str


class ValidacaoSemantica(StrictModel):
    itens: list[RevisaoItem]


class AnalisePorAcusacao(StrictModel):
    acusacao_id: str
    analise: str
    embasamento_ids: list[str]


class Justificativa(StrictModel):
    risco_historico: str
    contexto_regional: str
    comparacao_economica: str
    qualidade_da_prova: str
    convergencia_das_analises: str
    premissas_e_limitacoes: str
    analise_por_acusacao: list[AnalisePorAcusacao]


class ConcessaoAcusacao(StrictModel):
    acusacao_id: str
    posicao: str
    embasamento_ids: list[str]


class EstrategiaAcordo(StrictModel):
    roteiro: list[str]
    concessoes_por_acusacao: list[ConcessaoAcusacao]
    argumentos_para_negociacao: list[str]
    riscos_se_recusado: list[str]


class Tese(StrictModel):
    acusacao_id: str
    tese: str
    embasamento_ids: list[str]


class RiscoDefesa(StrictModel):
    descricao: str
    embasamento_ids: list[str]


class TesesDefesa(StrictModel):
    teses: list[Tese]
    riscos_da_defesa: list[RiscoDefesa]


class DecisaoFinal(StrictModel):
    acao: Literal["ACORDO", "DEFESA"]
    resumo: str = Field(description="Até 3 frases.")
    decisao_contraria_a_economia: bool
    justificativa: Justificativa
    estrategia_acordo: EstrategiaAcordo | None
    teses_defesa: TesesDefesa | None
    condicoes_para_reavaliar: list[str]
    pontos_de_atencao: list[str]
