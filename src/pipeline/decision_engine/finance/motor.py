"""Motor financeiro: combina os subfluxos, calcula custos, faixa de acordo, cenários e robustez.

Não decide: a decisão é da LLM decisora (P7).
"""

from dataclasses import dataclass, field
from typing import Any

import numpy as np

from decision_engine.config_loader import load_params
from decision_engine.risk.model import RiskModel, RiskPrediction
from decision_engine.scoring.probabilidade import ContentEstimate, evaluate


@dataclass(frozen=True)
class FinancialAnalysis:
    alfa: float
    beta: float
    p_derrota: float
    perda_se_condenado: float
    perda_esperada: float
    custo_defesa: float
    custo_defesa_esperado: float
    faixa: dict[str, float]
    alcada: float
    custo_negociacao: float
    custo_acordo_alvo: float
    vantagem_economica_acordo: float
    p_acordo_mais_barato: float
    aceite_minimo_para_compensar: float | None
    p_derrota_equilibrio: float
    cenarios: dict[str, dict[str, float]]
    divergencia_subfluxos: dict[str, float] | None
    faixa_custo_defesa: tuple[float, float]
    alertas: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {key: value for key, value in self.__dict__.items()}


def _interpolated_k(quantiles: dict[str, float], draws: np.ndarray) -> np.ndarray:
    levels = np.array([0.10, 0.25, 0.50, 0.75, 0.90])
    values = np.array([quantiles[key] for key in ("p10", "p25", "p50", "p75", "p90")])
    return np.interp(draws, levels, values)


def analyze(
    risk: RiskPrediction,
    content: ContentEstimate | None,
    model: RiskModel,
    valor_causa: float,
    coorte_n: int,
    taxa_reprovacao: float = 0.0,
) -> FinancialAnalysis:
    params = load_params()
    combination, costs, sim = params["combinacao"], params["custos"], params["simulacao"]
    severity, k = model.severity, model.meta["acordo_k"]
    alerts: list[str] = []

    alpha = combination["alfa"]
    if content is None:
        alpha = combination["ajustes"]["subfluxo_conteudo_indisponivel"]["alfa"]
    else:
        if taxa_reprovacao > combination["ajustes"]["validador_reprovacao_alta"]["limiar"]:
            alpha += combination["ajustes"]["validador_reprovacao_alta"]["delta_alfa"]
            alerts.append("VALIDADOR_REPROVACAO_ALTA")
        if {"COORTE_PEQUENA", "FORA_DA_DISTRIBUICAO"} & set(risk.alertas):
            alpha += combination["ajustes"]["coorte_pequena_ou_fora_distribuicao"]["delta_alfa"]
    alpha = float(np.clip(alpha, combination["alfa_min"], combination["alfa_max"]))
    beta = 1 - alpha

    p_llm = content.p_derrota if content else risk.p_derrota
    cond_llm = content.perda_se_condenado if content else risk.perda_se_condenado
    p_loss = alpha * risk.p_derrota + beta * p_llm
    loss_if_condemned = alpha * risk.perda_se_condenado + beta * cond_llm
    expected_loss = p_loss * loss_if_condemned
    defense_cost = max(
        costs["custo_defesa_percentual"] * expected_loss, costs["custo_defesa_minimo"]
    )
    expected_defense = expected_loss + defense_cost

    authority = costs["alcada_sobre_valor_causa"] * valor_causa
    negotiation = costs["custo_negociacao"]
    band = {
        "abertura": round(k["p25"] * loss_if_condemned, 2),
        "alvo": round(k["p50"] * loss_if_condemned, 2),
        "maximo": round(min(k["p90"] * loss_if_condemned, authority), 2),
    }
    if band["alvo"] > authority:
        alerts.append("FORA_DA_ALCADA")
    settlement_cost = band["alvo"] + negotiation
    advantage = expected_defense - settlement_cost
    margin_over_target = expected_defense - band["alvo"]

    divergence = None
    if content is not None:
        divergence = {
            "p_derrota": round(abs(risk.p_derrota - content.p_derrota), 4),
            "perda_se_condenado_sobre_valor_causa": round(
                abs(risk.perda_se_condenado - content.perda_se_condenado) / max(valor_causa, 1), 4
            ),
        }
        limits = combination["divergencia"]
        if (
            divergence["p_derrota"] >= limits["p_derrota"]
            or divergence["perda_se_condenado_sobre_valor_causa"]
            >= limits["perda_se_condenado_sobre_valor_causa"]
        ):
            alerts.append("DIVERGENCIA_SUBFLUXOS")

    # Simulação: incerteza de α, pesos, T, probabilidades do XGBoost e k.
    rng = np.random.default_rng(sim["seed"])
    n = sim["n"]
    alphas = rng.uniform(*sim["alfa"], n) if content is not None else np.ones(n)
    concentration = (
        min(coorte_n, sim["dirichlet_concentracao_max"]) + sim["dirichlet_concentracao_extra"]
    )
    probabilities = np.array([risk.probabilidades[name] for name in model.meta["classes"]])
    draws = rng.dirichlet(np.clip(probabilities, 1e-4, None) * concentration, n)
    p_xgb = draws[:, 2] + draws[:, 3]
    cond_xgb = (
        valor_causa
        * (draws[:, 2] * severity["parcial"] + draws[:, 3] * severity["procedencia"])
        / np.clip(p_xgb, 1e-9, None)
    )
    if content is not None:
        p_content, cond_content = evaluate(
            content.score_principal,
            content.scores_dependentes,
            content.q_dependentes,
            content.valores_ajustados,
            rng.uniform(*sim["temperatura_T"], n),
            rng.uniform(*sim["fator_pesos"], n),
        )
    else:
        p_content, cond_content = p_xgb, cond_xgb
    sim_p = alphas * p_xgb + (1 - alphas) * p_content
    sim_cond = alphas * cond_xgb + (1 - alphas) * cond_content
    sim_expected = sim_p * sim_cond
    sim_defense = sim_expected + np.maximum(
        costs["custo_defesa_percentual"] * sim_expected, costs["custo_defesa_minimo"]
    )
    sim_target = _interpolated_k(k, rng.uniform(0.10, 0.90, n)) * sim_cond
    p_cheaper = float(np.mean(sim_target + negotiation < sim_defense))

    worst_defense = max(
        severity["procedencia_p90"] * valor_causa, content.soma_pedidos if content else 0
    )
    return FinancialAnalysis(
        alfa=round(alpha, 2),
        beta=round(beta, 2),
        p_derrota=round(p_loss, 4),
        perda_se_condenado=round(loss_if_condemned, 2),
        perda_esperada=round(expected_loss, 2),
        custo_defesa=round(defense_cost, 2),
        custo_defesa_esperado=round(expected_defense, 2),
        faixa=band,
        alcada=round(authority, 2),
        custo_negociacao=negotiation,
        custo_acordo_alvo=round(settlement_cost, 2),
        vantagem_economica_acordo=round(advantage, 2),
        p_acordo_mais_barato=round(p_cheaper, 4),
        aceite_minimo_para_compensar=(
            round(negotiation / margin_over_target, 4) if margin_over_target > 0 else None
        ),
        p_derrota_equilibrio=round(
            (k["p50"] + negotiation / max(loss_if_condemned, 1))
            / (1 + costs["custo_defesa_percentual"]),
            4,
        ),
        cenarios={
            "defesa": {
                "melhor": round(defense_cost, 2),
                "medio": round(expected_defense, 2),
                "pior": round(worst_defense + defense_cost, 2),
            },
            "acordo": {
                "melhor": round(band["abertura"] + negotiation, 2),
                "medio": round(settlement_cost, 2),
                "pior": round(band["maximo"] + negotiation, 2),
            },
        },
        divergencia_subfluxos=divergence,
        faixa_custo_defesa=(
            round(float(np.quantile(sim_defense, 0.10)), 2),
            round(float(np.quantile(sim_defense, 0.90)), 2),
        ),
        alertas=alerts,
    )


def confidence_percent(action: str, analysis: FinancialAnalysis, reason_codes: list[str]) -> float:
    """Concordância da ação escolhida com a comparação econômica simulada, com tetos por alerta."""

    agreement = (
        analysis.p_acordo_mais_barato if action == "ACORDO" else 1 - analysis.p_acordo_mais_barato
    )
    value = 100 * agreement
    for code, cap in load_params()["confianca"]["tetos"].items():
        if code in reason_codes:
            value = min(value, cap)
    return round(value, 1)
