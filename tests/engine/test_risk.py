import pytest
from decision_engine.risk.features import FLAG_NAMES, CaseFeatures
from decision_engine.risk.model import load_risk_model

ALL_FLAGS = dict.fromkeys(FLAG_NAMES, True)
CASE_02_FLAGS = {
    "contrato": False,
    "extrato": False,
    "comprovante_credito": True,
    "dossie": False,
    "demonstrativo_divida": True,
    "laudo_referenciado": True,
}


def test_training_metrics_beat_prior_and_match_logistic_baseline() -> None:
    metrics = load_risk_model().meta["metricas_teste"]
    assert metrics["log_loss_xgb_calibrado"] < metrics["log_loss_prior"] - 0.2
    assert metrics["log_loss_xgb_calibrado"] <= metrics["log_loss_regressao_logistica"] + 0.01


def test_severity_and_settlement_k_are_ordered() -> None:
    meta = load_risk_model().meta
    severity, k = meta["severidade"], meta["acordo_k"]
    assert 0 < severity["parcial"] < severity["procedencia"] <= severity["procedencia_p90"] <= 1
    assert k["p10"] < k["p25"] < k["p50"] < k["p75"] < k["p90"] < 1
    assert k["n"] == 280


def test_sample_cases_fall_on_opposite_risk_levels() -> None:
    model = load_risk_model()
    case_01 = model.predict(CaseFeatures.from_values("MA", "GENERICO", ALL_FLAGS, 20000))
    case_02 = model.predict(CaseFeatures.from_values("AM", "GOLPE", CASE_02_FLAGS, 25000))

    assert case_01.p_derrota < 0.10
    assert case_02.p_derrota > 0.80
    assert sum(case_02.probabilidades.values()) == pytest.approx(1, abs=1e-3)
    assert 0.62 * 25000 <= case_02.perda_se_condenado <= 0.90 * 25000
    assert case_02.efeitos_pp["uf"] > 0, "AM tem taxa de derrota acima da média"
    assert case_02.efeitos_pp["contrato"] > 0, "a ausência do contrato aumenta o risco"


def test_unknown_uf_averages_over_known_ufs() -> None:
    prediction = load_risk_model().predict(
        CaseFeatures.from_values("RR", "GOLPE", CASE_02_FLAGS, 25000)
    )
    assert "FORA_DA_DISTRIBUICAO" in prediction.alertas
    assert 0 < prediction.p_derrota < 1
