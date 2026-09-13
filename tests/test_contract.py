import pytest
from contracts.pipeline import PipelineOutput
from pydantic import ValidationError


def test_pipeline_contract_preserves_extra_fields() -> None:
    output = PipelineOutput.model_validate(
        {
            "versions": {"pipeline": "test-v1"},
            "recommendation": {
                "action": "DEFESA",
                "confidence_percent": None,
                "summary": "Defender",
                "reason_codes": ["TEST"],
            },
            "financial": {
                "suggested_offer": None,
                "expected_defense_cost": 5000,
                "expected_savings": 800,
                "internal_formula": "opaque",
            },
            "evidences": [],
            "risk": {"improcedencia": 0.6},
        }
    )

    assert output.complete_payload()["risk"] == {"improcedencia": 0.6}
    assert output.complete_payload()["financial"]["internal_formula"] == "opaque"


def test_pipeline_contract_rejects_invalid_confidence_and_versions() -> None:
    with pytest.raises(ValidationError):
        PipelineOutput.model_validate(
            {
                "versions": {},
                "recommendation": {
                    "action": "ACORDO",
                    "confidence_percent": 101,
                    "summary": "Inválida",
                },
                "financial": {
                    "suggested_offer": 1,
                    "expected_defense_cost": 2,
                    "expected_savings": 1,
                },
            }
        )
