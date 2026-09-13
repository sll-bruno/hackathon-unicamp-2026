import pytest
from contracts.pipeline import CaseInput, PipelineOutput
from decision_engine import run_pipeline
from fastapi.testclient import TestClient


def case_input() -> CaseInput:
    return CaseInput.model_validate(
        {
            "case_id": "case-1",
            "cnj": "0654321-09.2024.8.04.0001",
            "uf": "AM",
            "assunto": "Não reconhece operação",
            "subassunto": "Golpe",
            "valor_causa": 25000,
            "subsidy_flags": {
                "contrato": False,
                "extrato": False,
                "comprovante_credito": True,
                "dossie": False,
                "demonstrativo_divida": True,
                "laudo_referenciado": True,
            },
            "documents": [{"id": "doc-1", "type": "AUTOS", "path": "/tmp/autos.pdf"}],
        }
    )


def test_engine_is_off_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENGINE_MODE", raising=False)
    with pytest.raises(NotImplementedError):
        run_pipeline(case_input())


def test_invalid_engine_mode_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENGINE_MODE", "heuristica")
    with pytest.raises(ValueError):
        run_pipeline(case_input())


def test_stub_returns_flagged_contract_output(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENGINE_MODE", "stub")
    output = run_pipeline(case_input())

    validated = PipelineOutput.model_validate(output.complete_payload())
    assert validated.versions["pipeline"] == "stub"
    assert validated.recommendation.reason_codes == ["STUB"]
    assert validated.recommendation.confidence_percent is None
    payload = validated.complete_payload()
    assert payload["features"]["uf"] == {"valor": "AM", "fonte": "cadastro"}
    assert payload["erros"][0]["code"] == "STUB"


def test_backend_persists_stub_recommendation(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ENGINE_MODE", "stub")
    case = next(item for item in client.get("/api/cases").json()["items"] if not item["is_demo"])

    assert client.post(f"/api/cases/{case['id']}/analyze").status_code == 202
    workspace = client.get(f"/api/cases/{case['id']}/workspace").json()

    assert workspace["analysis_job"]["status"] == "COMPLETED"
    assert workspace["case"]["status"] == "AGUARDANDO_DECISAO"
    assert workspace["recommendation"]["reason_codes"] == ["STUB"]
    assert workspace["recommendation"]["versions"]["pipeline"] == "stub"
