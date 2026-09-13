"""Pesos × contagem de embasamentos → probabilidade de vitória por acusação e perda."""

from dataclasses import dataclass
from typing import Any

import numpy as np

from decision_engine.config_loader import load_params, load_weights
from decision_engine.features.tabular import parse_brl
from decision_engine.scoring.valores import DebtSchedule

PRINCIPAL = "inexistencia_contratacao"


@dataclass(frozen=True)
class AccusationEstimate:
    id: str
    tipo: str
    descricao: str
    contagens: dict[str, int]
    score: float
    valor_pedido: float
    valor_estimado: bool
    p_vitoria_condicional: float | None
    p_vitoria: float
    perda_se_condenado: float


@dataclass(frozen=True)
class ContentEstimate:
    acusacoes: list[AccusationEstimate]
    p_derrota: float
    perda_se_condenado: float
    soma_pedidos: float
    alertas: list[str]
    # Entradas vetorizáveis para a simulação de robustez.
    score_principal: float
    scores_dependentes: np.ndarray
    q_dependentes: np.ndarray
    valores_ajustados: np.ndarray


def _sigmoid(value):
    return 1 / (1 + np.exp(-value))


def _logit(probability: float) -> float:
    return float(np.log(probability / (1 - probability)))


def evaluate(
    score_principal, scores, q, values, temperature, weight_factor=1.0
) -> tuple[np.ndarray, np.ndarray]:
    """P(derrota) e perda se condenado do subfluxo 2; aceita arrays de simulação."""

    scoring = load_params()["scoring"]
    low, high = scoring["clip"]
    temperature = np.asarray(temperature, dtype=float)
    weight_factor = np.asarray(weight_factor, dtype=float)
    p_win_principal = np.clip(
        _sigmoid(_logit(scoring["p0_principal"]) + weight_factor * score_principal / temperature),
        low,
        high,
    )
    if len(scores) == 0:
        return 1 - p_win_principal, np.zeros_like(p_win_principal)
    logits = np.log(q / (1 - q))
    p_win_conditional = np.clip(
        _sigmoid(logits[:, None] + np.outer(scores, weight_factor) / temperature), low, high
    )
    loss_if_condemned = ((1 - p_win_conditional) * values[:, None]).sum(axis=0)
    return 1 - p_win_principal, loss_if_condemned


def estimate_content(
    accusations: list[Any],
    grounds: dict[str, dict[str, list]],
    demonstrativo: DebtSchedule | None,
    valor_causa: float,
    severity_full: float,
) -> ContentEstimate:
    params, weights = load_params()["scoring"], load_weights()["tipos_acusacao"]
    limit = params["max_itens_por_categoria"]

    counts, scores = {}, {}
    for accusation in accusations:
        categories = weights[accusation.tipo]["categorias"]
        counts[accusation.id] = {
            name: len(grounds.get(accusation.id, {}).get(name, [])) for name in categories
        }
        scores[accusation.id] = float(
            sum(
                spec["peso"] * min(counts[accusation.id][name], limit)
                for name, spec in categories.items()
            )
        )

    alerts: list[str] = []
    requested: dict[str, float] = {}
    estimated: set[str] = set()
    for accusation in accusations:
        if accusation.tipo == PRINCIPAL:
            requested[accusation.id] = 0.0
        elif accusation.tipo == "dano_material" and demonstrativo:
            factor = 2 if accusation.forma_pedido == "dobro_dos_descontos" else 1
            requested[accusation.id] = demonstrativo.total_descontado * factor
        elif accusation.valor_texto and parse_brl(accusation.valor_texto) is not None:
            requested[accusation.id] = parse_brl(accusation.valor_texto)
    for accusation in accusations:
        if accusation.id not in requested:
            requested[accusation.id] = max(valor_causa - sum(requested.values()), 0.0)
            estimated.add(accusation.id)
    if estimated:
        alerts.append("VALOR_PEDIDO_ESTIMADO")

    principal = next((item for item in accusations if item.tipo == PRINCIPAL), None)
    principal_score = scores[principal.id] if principal else 0.0
    dependents = [item for item in accusations if item.tipo != PRINCIPAL]
    q = np.array([params["q_condicional"][item.tipo] for item in dependents], dtype=float)
    dependent_scores = np.array([scores[item.id] for item in dependents], dtype=float)
    adjusted = np.array([requested[item.id] * severity_full for item in dependents], dtype=float)

    temperature = params["temperatura_T"]
    p_loss, loss = evaluate(principal_score, dependent_scores, q, adjusted, temperature)
    low, high = params["clip"]
    p_win_principal = 1 - float(np.squeeze(p_loss))

    estimates = []
    for accusation in accusations:
        if accusation.tipo == PRINCIPAL:
            conditional, p_win, contribution = None, p_win_principal, 0.0
        else:
            index = dependents.index(accusation)
            conditional = float(
                np.clip(
                    _sigmoid(_logit(q[index]) + dependent_scores[index] / temperature), low, high
                )
            )
            p_win = 1 - (1 - p_win_principal) * (1 - conditional)
            contribution = (1 - conditional) * adjusted[index]
        estimates.append(
            AccusationEstimate(
                id=accusation.id,
                tipo=accusation.tipo,
                descricao=accusation.descricao,
                contagens=counts[accusation.id],
                score=scores[accusation.id],
                valor_pedido=round(requested[accusation.id], 2),
                valor_estimado=accusation.id in estimated,
                p_vitoria_condicional=None if conditional is None else round(conditional, 4),
                p_vitoria=round(p_win, 4),
                perda_se_condenado=round(float(contribution), 2),
            )
        )

    total_requested = float(sum(requested.values()))
    if (
        valor_causa
        and abs(total_requested - valor_causa) / valor_causa
        > load_params()["alertas"]["reconciliacao_pedidos_valor_causa"]
    ):
        alerts.append("PEDIDOS_DIVERGEM_VALOR_CAUSA")

    return ContentEstimate(
        acusacoes=estimates,
        p_derrota=round(float(np.squeeze(p_loss)), 4),
        perda_se_condenado=round(float(np.squeeze(loss)), 2),
        soma_pedidos=round(total_requested, 2),
        alertas=alerts,
        score_principal=principal_score,
        scores_dependentes=dependent_scores,
        q_dependentes=q,
        valores_ajustados=adjusted,
    )
