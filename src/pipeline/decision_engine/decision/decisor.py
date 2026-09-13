"""LLM decisora (P7): escolhe ACORDO ou DEFESA e escreve a justificativa."""

import json
from typing import Any

from decision_engine.config_loader import load_params, load_prompt, load_weights
from decision_engine.finance.motor import FinancialAnalysis
from decision_engine.llm.client import LLMClient
from decision_engine.llm.schemas import DecisaoFinal
from decision_engine.risk.model import RiskPrediction
from decision_engine.scoring.probabilidade import ContentEstimate


def brl(value: float | None) -> str | None:
    if value is None:
        return None
    formatted = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {formatted}"


def pct(value: float | None) -> str | None:
    return None if value is None else f"{value * 100:.1f}%".replace(".", ",")


def build_analysis(
    case: dict[str, Any],
    risk: RiskPrediction,
    content: ContentEstimate | None,
    grounds: dict[str, dict[str, list]],
    finance: FinancialAnalysis,
    reason_codes: list[str],
    regional_national: float,
) -> dict[str, Any]:
    weights = load_weights()["tipos_acusacao"]
    accusations = []
    for estimate in content.acusacoes if content else []:
        categories = weights[estimate.tipo]["categorias"]
        accusations.append(
            {
                "id": estimate.id,
                "tipo": estimate.tipo,
                "descricao": estimate.descricao,
                "valor_pedido": brl(estimate.valor_pedido),
                "p_vitoria_banco": pct(estimate.p_vitoria),
                "p_vitoria_banco_se_principal_perdida": pct(estimate.p_vitoria_condicional),
                "embasamentos": [
                    {
                        "id": item["id"],
                        "categoria": category,
                        "favorece": "BANCO" if categories[category]["peso"] > 0 else "AUTOR",
                        "peso": categories[category]["peso"],
                        "titulo": item["titulo"],
                        "descricao": item["descricao"],
                        "justificativa": item["justificativa"],
                    }
                    for category, items in grounds.get(estimate.id, {}).items()
                    for item in items
                ],
            }
        )
    profile = risk.perfil_uf or {}
    return {
        "caso": case,
        "historico": {
            "probabilidades": {name: pct(value) for name, value in risk.probabilidades.items()},
            "p_derrota": pct(risk.p_derrota),
            "perda_se_condenado": brl(risk.perda_se_condenado),
            "casos_semelhantes_na_base": risk.coorte_n,
            "efeitos_em_pontos_percentuais": risk.efeitos_pp,
            "perfil_regional": {
                "taxa_derrota_uf": pct(profile.get("taxa_derrota")),
                "taxa_derrota_nacional": pct(regional_national),
                "ranking_uf_por_derrota": profile.get("ranking_derrota"),
            },
        },
        "conteudo": {
            "acusacoes": accusations,
            "p_derrota": pct(content.p_derrota) if content else None,
            "perda_se_condenado": brl(content.perda_se_condenado) if content else None,
        },
        "financeiro": {
            "alfa_historico": finance.alfa,
            "beta_conteudo": finance.beta,
            "p_derrota": pct(finance.p_derrota),
            "perda_se_condenado": brl(finance.perda_se_condenado),
            "perda_esperada": brl(finance.perda_esperada),
            "custo_defesa": brl(finance.custo_defesa),
            "custo_defesa_esperado": brl(finance.custo_defesa_esperado),
            "faixa_acordo_valor_a_pagar": {
                name: brl(value) for name, value in finance.faixa.items()
            },
            "alcada": brl(finance.alcada),
            "custo_negociacao": brl(finance.custo_negociacao),
            "custo_total_acordo_no_alvo": brl(finance.custo_acordo_alvo),
            "vantagem_economica_acordo": brl(finance.vantagem_economica_acordo),
            "simulacoes_em_que_acordo_sai_mais_barato": pct(finance.p_acordo_mais_barato),
            "p_derrota_de_equilibrio": pct(finance.p_derrota_equilibrio),
            "cenarios_custo_total": {
                option: {name: brl(value) for name, value in values.items()}
                for option, values in finance.cenarios.items()
            },
        },
        "reason_codes": reason_codes,
        "premissas": load_params()["premissas"],
    }


def decide(analysis: dict[str, Any], client: LLMClient | None = None) -> DecisaoFinal:
    client = client or LLMClient()
    prompt = load_prompt("p7_decisora")
    user = prompt.render_user(
        analise=json.dumps(analysis, ensure_ascii=False, indent=1), erros_da_tentativa_anterior=""
    )
    return client.parse(prompt, user, DecisaoFinal)
