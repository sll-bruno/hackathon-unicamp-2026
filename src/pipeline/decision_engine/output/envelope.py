"""Monta o `PipelineOutput` consumido pelo backend, com os blocos extras da análise."""

from dataclasses import asdict
from typing import Any

from contracts.pipeline import PipelineOutput

from decision_engine.chunking.chunker import Chunk
from decision_engine.config_loader import load_params, load_weights, prompt_versions
from decision_engine.extraction.content import ContentExtraction
from decision_engine.finance.motor import FinancialAnalysis
from decision_engine.ingest.package import CasePackage
from decision_engine.llm.schemas import DecisaoFinal
from decision_engine.risk.model import RiskModel, RiskPrediction
from decision_engine.scoring.probabilidade import ContentEstimate


def _sources(references: list[dict], chunks: dict[str, Chunk]) -> list[dict]:
    return [
        {
            "document_id": chunks[reference["chunk_id"]].document_id,
            "page": chunks[reference["chunk_id"]].page,
            "excerpt": reference.get("trecho") or "",
        }
        for reference in references
        if reference.get("tipo") == "trecho" and reference.get("chunk_id") in chunks
    ]


def _workspace_blocks(
    extraction: ContentExtraction, weights_version: str
) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    weights = load_weights()
    projection = weights["projecao_workspace"]
    by_id = {accusation.id: accusation for accusation in extraction.extracao.acusacoes}
    evidences, facts, contradictions, gaps = [], [], [], []
    for accusation_id, categories in extraction.embasamentos.items():
        accusation = by_id[accusation_id]
        catalog = weights["tipos_acusacao"][accusation.tipo]["categorias"]
        for category, items in categories.items():
            weight = catalog[category]["peso"]
            for item in items:
                sources = _sources(item["referencias"], extraction.chunks)
                evidences.append(
                    {
                        "id": item["id"],
                        "text": f"{item['titulo']} — {item['descricao']}",
                        "type": category,
                        "weight": weight,
                        "sources": sources,
                    }
                )
                if category in projection["contradictions"]:
                    contradictions.append(
                        {
                            "id": item["id"],
                            "description": item["descricao"],
                            "sources": sources,
                            "note": item["justificativa"],
                        }
                    )
                elif category in projection["gaps"]:
                    gaps.append(
                        {
                            "id": item["id"],
                            "description": item["descricao"],
                            "impact": item["justificativa"],
                            "sources": sources,
                        }
                    )
                else:
                    facts.append(
                        {
                            "id": item["id"],
                            "fact_type": category,
                            "description": item["descricao"],
                            "weight": weight,
                            "weights_version": weights_version,
                            "relation": "refutes" if weight > 0 else "supports",
                            "claim": accusation.descricao,
                            "sources": sources,
                        }
                    )
    return evidences, facts, contradictions, gaps


def build_output(
    package: CasePackage,
    model: RiskModel,
    risk: RiskPrediction,
    extraction: ContentExtraction,
    content: ContentEstimate,
    finance: FinancialAnalysis,
    decision: DecisaoFinal,
    reason_codes: list[str],
    confidence: float,
    llm_model: str,
) -> PipelineOutput:
    params, weights = load_params(), load_weights()
    evidences, facts, contradictions, gaps = _workspace_blocks(extraction, weights["version"])
    is_agreement = decision.acao == "ACORDO"
    payload: dict[str, Any] = {
        "versions": {
            "pipeline": "engine-v1",
            "risk_model": model.version,
            "engine_params": params["version"],
            "pesos": weights["version"],
            "llm_model": llm_model,
            **prompt_versions(),
        },
        "recommendation": {
            "action": decision.acao,
            "confidence_percent": confidence,
            "summary": decision.resumo,
            "reason_codes": reason_codes,
        },
        "financial": {
            "suggested_offer": finance.faixa["alvo"] if is_agreement else None,
            "expected_defense_cost": finance.custo_defesa_esperado,
            "expected_savings": max(finance.vantagem_economica_acordo, 0.0)
            if is_agreement
            else 0.0,
        },
        "evidences": evidences,
        "features": {
            "uf": package.uf,
            "sub_assunto": extraction.triagem.subassunto,
            "sub_assunto_ambiguo": extraction.triagem.ambiguo,
            "valor_causa": package.valor_causa,
            "flags": package.flags,
            "demonstrativo": asdict(package.demonstrativo) if package.demonstrativo else None,
        },
        "risk": {
            "probabilities": risk.probabilidades,
            "p_derrota": risk.p_derrota,
            "perda_se_condenado": risk.perda_se_condenado,
            "cohort_size": risk.coorte_n,
            "certeza_modelo": risk.certeza_modelo,
            "efeitos_pp": risk.efeitos_pp,
        },
        "contexto_regional": {
            "uf": package.uf,
            "perfil": risk.perfil_uf,
            "taxa_derrota_nacional": model.meta["perfil_regional"]["taxa_derrota_nacional"],
            "efeito_uf_pp": risk.efeitos_pp.get("uf"),
        },
        "settlement_range": {
            "opening": finance.faixa["abertura"],
            "target": finance.faixa["alvo"],
            "ceiling": finance.faixa["maximo"],
        },
        "financeiro": finance.as_dict(),
        "defense_cost_range": list(finance.faixa_custo_defesa),
        "acusacoes": [
            {**asdict(estimate), "embasamentos": extraction.embasamentos.get(estimate.id, {})}
            for estimate in content.acusacoes
        ],
        "pedidos_processuais": [
            item.model_dump() for item in extraction.extracao.pedidos_processuais
        ],
        "cronologia": [item.model_dump() for item in extraction.extracao.cronologia],
        "validacao": {
            "taxa_reprovacao": extraction.taxa_reprovacao,
            "revisoes": extraction.revisoes,
        },
        "facts": facts,
        "contradictions": contradictions,
        "gaps": gaps,
        "justificativa": decision.justificativa.model_dump(),
        "estrategia_acordo": decision.estrategia_acordo.model_dump()
        if decision.estrategia_acordo
        else None,
        "teses_defesa": decision.teses_defesa.model_dump() if decision.teses_defesa else None,
        "decisao_contraria_a_economia": decision.decisao_contraria_a_economia,
        "what_changes": decision.condicoes_para_reavaliar,
        "pontos_de_atencao": decision.pontos_de_atencao,
        "assumptions": params["premissas"],
        "confidence_method_version": params["confianca"]["metodo"],
        "erros": [],
    }
    return PipelineOutput.model_validate(payload)
