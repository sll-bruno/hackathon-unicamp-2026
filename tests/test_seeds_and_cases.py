from pathlib import Path

from app.core.config import get_settings
from app.core.database import _ensure_case_metadata_columns, get_engine, reset_database_state
from app.models import AppMetadata, Case, CaseOutcome, Document, OutcomeType
from app.services.seeds import seed_demo_data
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlmodel import Session, select


def test_seed_is_idempotent_and_files_are_downloadable(client: TestClient) -> None:
    first = client.get("/api/cases")
    assert first.status_code == 200
    assert first.json()["total"] == 2
    demo = next(item for item in first.json()["items"] if item["is_demo"])
    live = next(item for item in first.json()["items"] if not item["is_demo"])
    assert demo["status"] == "AGUARDANDO_ENCERRAMENTO"
    assert demo["recommendation"]["source_kind"] == "ENGINE_PRECOMPUTED"
    assert demo["recommendation"]["action"] == "DEFESA"
    assert demo["valor_causa"] == 20_000
    assert live["status"] == "DOCUMENTOS_ENVIADOS"
    assert live["valor_causa"] == 25_000

    with Session(get_engine()) as session:
        seed_demo_data(session, get_settings())
        assert len(session.exec(select(Case)).all()) == 2
        assert len(session.exec(select(Document)).all()) == 11
        marker = session.get(AppMetadata, "demo_baseline_version")
        assert marker is not None
        assert marker.value == "real-engine-v2"

    workspace = client.get(f"/api/cases/{demo['id']}/workspace").json()
    assert len(workspace["facts"]) == 17
    assert len(workspace["contradictions"]) == 3
    assert len(workspace["gaps"]) == 7
    assert workspace["decision"]["action"] == "DEFESA"
    assert workspace["decision"]["adhered"] is True
    assert workspace["negotiation"] is None
    assert workspace["outcome"] is None
    download = client.get(workspace["documents"][0]["file_url"])
    assert download.status_code == 200
    assert download.content.startswith(b"%PDF-")
    assert download.headers["content-disposition"].startswith("inline;")


def test_seed_does_not_reset_live_demo_actions_after_baseline(client: TestClient) -> None:
    case = next(item for item in client.get("/api/cases").json()["items"] if item["is_demo"])
    closure = client.post(
        f"/api/cases/{case['id']}/closure",
        json={"outcome": "IMPROCEDENCIA", "defense_cost": 900, "legal_costs": 100},
    )
    assert closure.status_code == 201

    with Session(get_engine()) as session:
        seed_demo_data(session, get_settings())
        persisted = session.exec(
            select(CaseOutcome).where(CaseOutcome.case_id == case["id"])
        ).first()
        persisted_case = session.get(Case, case["id"])

    assert persisted is not None
    assert persisted.outcome == OutcomeType.IMPROCEDENCIA
    assert persisted_case is not None
    assert persisted_case.status == "ENCERRADO"


def test_seed_removes_exact_legacy_demo_duplicate(client: TestClient) -> None:
    duplicate = client.post(
        "/api/cases",
        json={
            "cnj": "0654321-09.2026.8.04.0002",
            "uf": "AM",
            "assunto": "Mock antigo",
            "valor_causa": 25_000,
            "plaintiff_name": "José Raimundo Oliveira Costa",
        },
    )
    assert duplicate.status_code == 201

    with Session(get_engine()) as session:
        seed_demo_data(session, get_settings())
        assert session.exec(
            select(Case).where(Case.cnj == "0654321-09.2026.8.04.0002")
        ).first() is None

    page = client.get("/api/cases").json()
    assert page["total"] == 2
    assert {item["cnj"] for item in page["items"]} == {
        "0801234-56.2024.8.10.0001",
        "0654321-09.2024.8.04.0001",
    }


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


def test_legacy_case_table_gets_metadata_columns(tmp_path: Path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE cases (id VARCHAR PRIMARY KEY)"))

    _ensure_case_metadata_columns(engine)

    columns = {column["name"] for column in inspect(engine).get_columns("cases")}
    assert {"plaintiff_name", "court", "contract_number"} <= columns


def test_case_crud_upload_security_and_invalid_state(client: TestClient) -> None:
    created = client.post(
        "/api/cases",
        json={
            "cnj": "0000001-00.2026.8.26.0001",
            "uf": "sp",
            "assunto": "Empréstimo não reconhecido",
            "subassunto": "Fraude",
            "valor_causa": 1234.5,
            "plaintiff_name": "  Ana Souza  ",
            "court": "  2ª Vara Cível  ",
            "contract_number": "  ABC-123  ",
        },
    )
    assert created.status_code == 201
    case = created.json()
    assert case["uf"] == "SP"
    assert case["status"] == "RASCUNHO"
    assert case["plaintiff_name"] == "Ana Souza"
    assert case["court"] == "2ª Vara Cível"
    assert case["contract_number"] == "ABC-123"

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
    workspace = client.get(f"/api/cases/{case['id']}/workspace").json()
    assert workspace["case"]["plaintiff"] == "Ana Souza"
    assert workspace["case"]["court"] == "2ª Vara Cível"
    assert workspace["case"]["contract_number"] == "ABC-123"

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
