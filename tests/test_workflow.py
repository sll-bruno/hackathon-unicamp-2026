import json

from app.core.database import get_engine
from app.models import AnalysisJob, Case, CaseStatus, JobStatus, RecommendationRecord
from app.services.analysis import recover_abandoned_jobs
from fastapi.testclient import TestClient
from sqlmodel import Session, select


def pipeline_result(action: str = "DEFESA", document_id: str = "document") -> dict:
    return {
        "versions": {
            "pipeline": "test-v1",
            "policy": "test-policy-v1",
        },
        "recommendation": {
            "action": action,
            "confidence_percent": 78,
            "summary": "Resultado controlado do teste",
            "reason_codes": ["TEST_FIXTURE"],
        },
        "financial": {
            "suggested_offer": 2500 if action == "ACORDO" else None,
            "expected_defense_cost": 6000,
            "expected_savings": 1000,
        },
        "evidences": [
            {
                "id": "evidence-1",
                "text": "Fato rastreável",
                "type": "CREDITO",
                "weight": 0.8,
                "sources": [{"document_id": document_id, "page": 1, "excerpt": "Trecho de teste"}],
            }
        ],
        "risk": {"improcedencia": 0.7},
    }


def live_case(client: TestClient) -> dict:
    return next(item for item in client.get("/api/cases").json()["items"] if not item["is_demo"])


def test_failed_job_can_retry_and_snapshots_are_immutable(client: TestClient, monkeypatch) -> None:
    case = live_case(client)

    failed = client.post(f"/api/cases/{case['id']}/analyze")
    assert failed.status_code == 202
    failed_job = client.get(f"/api/cases/{case['id']}/analysis").json()
    assert failed_job["status"] == "FAILED"
    assert client.get(f"/api/cases/{case['id']}").json()["status"] == "DOCUMENTOS_ENVIADOS"

    monkeypatch.setattr(
        "app.services.analysis.decision_engine.run_pipeline",
        lambda case_input: pipeline_result(document_id=case_input.documents[0].id),
    )
    assert client.post(f"/api/cases/{case['id']}/analyze").status_code == 202
    first_workspace = client.get(f"/api/cases/{case['id']}/workspace").json()
    assert first_workspace["analysis_job"]["status"] == "COMPLETED"
    assert first_workspace["analysis_job"]["progress_percent"] == 100
    assert first_workspace["case"]["status"] == "AGUARDANDO_DECISAO"
    first_recommendation_id = first_workspace["recommendation"]["id"]

    assert client.post(f"/api/cases/{case['id']}/analyze").status_code == 202
    second_workspace = client.get(f"/api/cases/{case['id']}/workspace").json()
    assert second_workspace["recommendation"]["id"] != first_recommendation_id
    with Session(get_engine()) as session:
        records = session.exec(
            select(RecommendationRecord).where(RecommendationRecord.case_id == case["id"])
        ).all()
        assert len(records) == 2
        assert sum(record.is_current for record in records) == 1
        old = next(record for record in records if record.id == first_recommendation_id)
        assert json.loads(old.payload_json)["risk"] == {"improcedencia": 0.7}


def test_divergence_negotiation_and_dashboard_are_distinct_events(
    client: TestClient, monkeypatch
) -> None:
    case = live_case(client)
    monkeypatch.setattr(
        "app.services.analysis.decision_engine.run_pipeline",
        lambda case_input: pipeline_result(document_id=case_input.documents[0].id),
    )
    client.post(f"/api/cases/{case['id']}/analyze")

    missing_reason = client.post(f"/api/cases/{case['id']}/decision", json={"action": "ACORDO"})
    assert missing_reason.status_code == 422
    decision = client.post(
        f"/api/cases/{case['id']}/decision",
        json={
            "action": "ACORDO",
            "divergence_reason": "FATO_NOVO",
            "divergence_details": "Contato posterior com a cliente.",
        },
    )
    assert decision.status_code == 201
    assert decision.json()["adhered"] is False
    assert client.get(f"/api/cases/{case['id']}").json()["status"] == "EM_NEGOCIACAO"

    missing_value = client.post(
        f"/api/cases/{case['id']}/negotiation-result", json={"accepted": True}
    )
    assert missing_value.status_code == 422
    assert missing_value.json()["code"] == "VALIDATION_ERROR"

    negotiation = client.post(
        f"/api/cases/{case['id']}/negotiation-result",
        json={"accepted": True, "final_value": 2800},
    )
    assert negotiation.status_code == 201
    assert negotiation.json()["accepted"] is True
    assert client.get(f"/api/cases/{case['id']}").json()["status"] == "ENCERRADO"

    dashboard = client.get("/api/dashboard").json()
    assert dashboard["generated_from_persisted_events"] is True
    assert dashboard["adherence"]["decisions"] == 2
    assert dashboard["adherence"]["adhered"] == 1
    assert dashboard["agreements"]["negotiations"] == 2
    assert dashboard["agreements"]["accepted"] == 2
    assert dashboard["economics"]["observed_disbursement"] == 6050.0

    history = client.get("/api/history", params={"case_id": case["id"]}).json()["items"]
    event_types = {event["type"] for event in history}
    assert {"LAWYER_DECISION", "NEGOTIATION_RESULT", "CASE_OUTCOME"} <= event_types


def test_defense_closure_after_rejected_agreement(client: TestClient, monkeypatch) -> None:
    case = live_case(client)
    monkeypatch.setattr(
        "app.services.analysis.decision_engine.run_pipeline",
        lambda case_input: pipeline_result("ACORDO", case_input.documents[0].id),
    )
    client.post(f"/api/cases/{case['id']}/analyze")
    client.post(f"/api/cases/{case['id']}/decision", json={"action": "ACORDO"})
    refused = client.post(f"/api/cases/{case['id']}/negotiation-result", json={"accepted": False})
    assert refused.status_code == 201
    assert refused.json()["accepted"] is False
    closure = client.post(
        f"/api/cases/{case['id']}/closure",
        json={
            "outcome": "IMPROCEDENCIA",
            "defense_cost": 900,
            "court_award": 0,
            "legal_costs": 100,
        },
    )
    assert closure.status_code == 201
    assert closure.json()["outcome"] == "IMPROCEDENCIA"


def test_recover_abandoned_job(client: TestClient) -> None:
    case = live_case(client)
    with Session(get_engine()) as session:
        persisted = session.get(Case, case["id"])
        assert persisted is not None
        persisted.status = CaseStatus.EM_ANALISE
        job = AnalysisJob(case_id=persisted.id, status=JobStatus.RUNNING)
        session.add(persisted)
        session.add(job)
        session.commit()
        recover_abandoned_jobs(session)
        session.refresh(job)
        session.refresh(persisted)
        assert job.status == JobStatus.FAILED
        assert persisted.status == CaseStatus.DOCUMENTOS_ENVIADOS


def test_only_one_active_job_is_allowed(client: TestClient) -> None:
    case = live_case(client)
    with Session(get_engine()) as session:
        session.add(AnalysisJob(case_id=case["id"], status=JobStatus.QUEUED))
        session.commit()

    response = client.post(f"/api/cases/{case['id']}/analyze")
    assert response.status_code == 409
    assert response.json()["code"] == "ANALYSIS_ALREADY_RUNNING"
