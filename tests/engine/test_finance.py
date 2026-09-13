"""Pontuação e motor financeiro com as anotações de referência no lugar da LLM."""

import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from decision_engine.finance.motor import analyze, confidence_percent
from decision_engine.ingest.package import build_package, case_input_from_folder
from decision_engine.risk.features import CaseFeatures
from decision_engine.risk.model import load_risk_model
from decision_engine.scoring.probabilidade import estimate_content

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).resolve().parent / "fixtures"


def analyze_gold(name: str):
    gold = json.loads((FIXTURES / f"gold_{name}.json").read_text(encoding="utf-8"))
    package = build_package(case_input_from_folder(ROOT / "data" / gold["pasta"]))
    accusations, ids = [], {}
    for index, expected in enumerate(gold["acusacoes_esperadas"], start=1):
        value = expected["valor"]
        accusation = SimpleNamespace(
            id=f"ACU-{index:02d}",
            tipo=expected["tipo"],
            descricao=expected["tipo"],
            forma_pedido=expected["forma_pedido"],
            valor_texto=None if value is None else f"R$ {value:.2f}".replace(".", ","),
        )
        accusations.append(accusation)
        ids[expected["tipo"]] = accusation.id
    grounds = {accusation.id: {} for accusation in accusations}
    for item in gold["embasamentos_obrigatorios"]:
        accusation_id = ids[item["acusacoes_aceitas"][0]]
        grounds[accusation_id].setdefault(item["categorias_aceitas"][0], []).append(item)

    model = load_risk_model()
    features = gold["features_esperadas"]
    risk = model.predict(
        CaseFeatures.from_values(
            package.uf, features["sub_assunto"], package.flags, package.valor_causa
        )
    )
    content = estimate_content(
        accusations,
        grounds,
        package.demonstrativo,
        package.valor_causa,
        model.severity["procedencia"],
    )
    finance = analyze(risk, content, model, package.valor_causa, risk.coorte_n)
    return risk, content, finance


@pytest.fixture(scope="module")
def results():
    return {name: analyze_gold(name) for name in ("caso01", "caso02")}


def test_content_scoring_separates_the_cases(results) -> None:
    _, content_01, _ = results["caso01"]
    _, content_02, _ = results["caso02"]
    assert content_01.p_derrota < 0.1 < 0.5 < content_02.p_derrota
    requested = {estimate.tipo: estimate.valor_pedido for estimate in content_02.acusacoes}
    assert requested == {
        "inexistencia_contratacao": 0,
        "dano_material": 2880.0,
        "dano_moral": 18000.0,
    }


def test_financial_analysis_points_to_opposite_actions(results) -> None:
    _, _, finance_01 = results["caso01"]
    _, _, finance_02 = results["caso02"]
    assert finance_01.vantagem_economica_acordo < 0 and finance_01.p_acordo_mais_barato < 0.1
    assert finance_02.vantagem_economica_acordo > 0 and finance_02.p_acordo_mais_barato > 0.9
    assert confidence_percent("DEFESA", finance_01, []) > 90
    assert confidence_percent("ACORDO", finance_02, ["COORTE_PEQUENA"]) == 70


@pytest.mark.parametrize("name", ["caso01", "caso02"])
def test_band_and_scenarios_are_ordered(results, name) -> None:
    _, _, finance = results[name]
    band = finance.faixa
    assert 0 < band["abertura"] < band["alvo"] < band["maximo"] <= finance.alcada
    for option in ("defesa", "acordo"):
        scenario = finance.cenarios[option]
        assert scenario["melhor"] <= scenario["medio"] <= scenario["pior"]
    assert abs(finance.alfa + finance.beta - 1) < 1e-9
