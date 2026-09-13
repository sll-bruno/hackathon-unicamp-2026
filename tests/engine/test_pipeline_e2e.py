"""Pipeline completo nos dois casos, reexecutando respostas de LLM gravadas (sem rede)."""

from pathlib import Path

import pytest
from contracts.pipeline import PipelineOutput
from decision_engine.ingest.package import case_input_from_folder
from decision_engine.runner import run_pipeline

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / "fixtures" / "llm_cache"
CASES = [
    ("Caso_01_0801234-56-2024-8-10-0001", "DEFESA"),
    ("Caso_02_0654321-09-2024-8-04-0001", "ACORDO"),
]


@pytest.mark.parametrize(("folder", "expected_action"), CASES)
def test_full_pipeline_with_recorded_llm_responses(
    monkeypatch: pytest.MonkeyPatch, folder: str, expected_action: str
) -> None:
    monkeypatch.setenv("ENGINE_MODE", "full")
    monkeypatch.setenv("ENGINE_LLM_CACHE", "replay")
    monkeypatch.setenv("ENGINE_LLM_CACHE_DIR", str(CACHE))
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5")
    case = case_input_from_folder(ROOT / "data" / folder)
    stages = []

    output = run_pipeline(case, on_progress=lambda stage, progress: stages.append(stage))

    payload = PipelineOutput.model_validate(output.complete_payload()).complete_payload()
    recommendation = payload["recommendation"]
    assert recommendation["action"] == expected_action
    assert 0 <= recommendation["confidence_percent"] <= 100
    assert stages[-1] == "CONCLUIDO"

    band = payload["settlement_range"]
    assert 0 < band["opening"] < band["target"] < band["ceiling"]
    assert payload["justificativa"]["contexto_regional"]
    assert (payload["estrategia_acordo"] is not None) == (expected_action == "ACORDO")

    document_ids = {document.id for document in case.documents}
    assert payload["evidences"]
    for evidence in payload["evidences"]:
        assert all(source["document_id"] in document_ids for source in evidence["sources"])
