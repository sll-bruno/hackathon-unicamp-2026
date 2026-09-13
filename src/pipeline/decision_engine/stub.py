"""Resposta provisória da engine (`ENGINE_MODE=stub`).

Serve só para integrar backend e frontend enquanto a engine real é implementada.
Não calcula nada: a recomendação é marcada com `STUB` e confiança nula.
"""

from contracts.pipeline import CaseInput, PipelineOutput

from decision_engine.config_loader import load_params, load_weights

STUB_SUMMARY = (
    "Resposta provisória da engine (ENGINE_MODE=stub). Não é resultado de análise; "
    "serve apenas para testar a integração."
)


def build_stub_output(case: CaseInput) -> PipelineOutput:
    params = load_params()
    weights = load_weights()
    payload = {
        "versions": {
            "pipeline": "stub",
            "engine_params": params["version"],
            "pesos": weights["version"],
        },
        "recommendation": {
            "action": "DEFESA",
            "confidence_percent": None,
            "summary": STUB_SUMMARY,
            "reason_codes": ["STUB"],
        },
        "financial": {
            "suggested_offer": None,
            "expected_defense_cost": 0.0,
            "expected_savings": 0.0,
        },
        "evidences": [],
        "features": {
            "uf": {"valor": case.uf, "fonte": "cadastro"},
            "valor_causa": {"valor": case.valor_causa, "fonte": "cadastro"},
            "flags": {"valor": case.subsidy_flags.model_dump(), "fonte": "cadastro"},
        },
        "risk": None,
        "settlement_range": None,
        "financeiro": None,
        "acusacoes": [],
        "facts": [],
        "contradictions": [],
        "gaps": [],
        "confidence_method_version": None,
        "erros": [{"code": "STUB", "message": STUB_SUMMARY}],
    }
    return PipelineOutput.model_validate(payload)
