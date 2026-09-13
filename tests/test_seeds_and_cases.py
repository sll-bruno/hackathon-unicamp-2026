import json
from pathlib import Path

from app.core.config import get_settings
from app.core.database import get_engine, reset_database_state
from app.models import Case, Document, RecommendationRecord
from app.services.seeds import seed_demo_data
from fastapi.testclient import TestClient
from sqlmodel import Session, select


def test_seed_is_idempotent_and_files_are_downloadable(client: TestClient) -> None:
    first = client.get("/api/cases")
    assert first.status_code == 200
    assert first.json()["total"] == 2
    demo = next(item for item in first.json()["items"] if item["is_demo"])
    live = next(item for item in first.json()["items"] if not item["is_demo"])
    assert demo["status"] == "ENCERRADO"
    assert demo["recommendation"]["source_kind"] == "DEMO_FIXTURE"
    assert live["status"] == "DOCUMENTOS_ENVIADOS"

    with Session(get_engine()) as session:
        demo_case = session.exec(select(Case).where(Case.is_demo.is_(True))).one()
        recommendation = session.exec(
            select(RecommendationRecord).where(RecommendationRecord.case_id == demo_case.id)
        ).one()
        stale_payload = json.loads(recommendation.payload_json)
        stale_payload.pop("risk")
        stale_payload.pop("settlement_range")
        recommendation.payload_json = json.dumps(stale_payload)
        session.add(recommendation)
        session.commit()

        seed_demo_data(session, get_settings())
        assert len(session.exec(select(Case)).all()) == 2
        assert len(session.exec(select(Document)).all()) == 11
        session.refresh(recommendation)
        repaired_payload = json.loads(recommendation.payload_json)
        assert repaired_payload["risk"]["cohort_size"] == 196
        assert repaired_payload["settlement_range"]["target"] == 3200.0

    workspace = client.get(f"/api/cases/{demo['id']}/workspace").json()
    assert workspace["case"]["status"] == "ENCERRADO"
    assert workspace["risk"]["probabilities"]["parcial"] == 0.51
    assert workspace["recommendation"]["settlement_range"]["target"] == 3200.0
    assert workspace["decision"]["adhered"] is True
    assert workspace["negotiation"]["accepted"] is True
    assert workspace["outcome"]["outcome"] == "ACORDO"
    download = client.get(workspace["documents"][0]["file_url"])
    assert download.status_code == 200
    assert download.content.startswith(b"%PDF-")
    assert download.headers["content-disposition"].startswith("inline;")


def test_demo_seed_can_be_disabled(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'empty.db'}")
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path / "storage"))
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("DEMO_SEED", "false")
    reset_database_state()
    from app.main import create_app

    with TestClient(create_app()) as empty_client:
        assert empty_client.get("/api/cases").json()["total"] == 0
    reset_database_state()


def test_case_crud_upload_security_and_invalid_state(client: TestClient) -> None:
    created = client.post(
        "/api/cases",
        json={
            "cnj": "0000001-00.2026.8.26.0001",
            "uf": "sp",
            "assunto": "Empréstimo não reconhecido",
            "subassunto": "Fraude",
            "valor_causa": 1234.5,
        },
    )
    assert created.status_code == 201
    case = created.json()
    assert case["uf"] == "SP"
    assert case["status"] == "RASCUNHO"

    upload = client.post(
        f"/api/cases/{case['id']}/documents",
        data={"type": "AUTOS"},
        files={"file": ("../../evil.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")},
    )
    assert upload.status_code == 201
    document = upload.json()
    assert document["name"] == "evil.pdf"
    assert client.get(document["file_url"]).status_code == 200
    assert client.get(f"/api/cases/{case['id']}").json()["status"] == "DOCUMENTOS_ENVIADOS"

    invalid_extension = client.post(
        f"/api/cases/{case['id']}/documents",
        data={"type": "AUTOS"},
        files={"file": ("not-pdf.txt", b"%PDF-1.4", "application/pdf")},
    )
    assert invalid_extension.status_code == 422
    assert invalid_extension.json()["code"] == "INVALID_FILE_TYPE"

    settings = get_settings()
    settings.max_upload_bytes = 6
    too_large = client.post(
        f"/api/cases/{case['id']}/documents",
        data={"type": "AUTOS"},
        files={"file": ("large.pdf", b"%PDF-123", "application/pdf")},
    )
    assert too_large.status_code == 413

    closed_case = next(item for item in client.get("/api/cases").json()["items"] if item["is_demo"])
    invalid_patch = client.patch(f"/api/cases/{closed_case['id']}", json={"valor_causa": 10})
    assert invalid_patch.status_code == 409
    assert invalid_patch.json()["code"] == "INVALID_CASE_STATE"


def test_duplicate_cnj_uses_standard_error(client: TestClient) -> None:
    payload = {
        "cnj": "0000002-00.2026.8.26.0001",
        "uf": "SP",
        "assunto": "Teste",
        "valor_causa": 100,
    }
    assert client.post("/api/cases", json=payload).status_code == 201
    duplicate = client.post("/api/cases", json=payload)
    assert duplicate.status_code == 409
    assert duplicate.json() == {
        "code": "CNJ_ALREADY_EXISTS",
        "message": "Já existe um caso com este CNJ",
        "details": None,
    }
