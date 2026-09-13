import json
from pathlib import Path

from app.core.database import get_engine
from app.models import Case, CaseIntake, IntakeStatus
from app.services.autos import OcrUnavailableError, recover_abandoned_intakes
from fastapi.testclient import TestClient
from sqlmodel import Session, select

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
CASO_01_NAME = "01_Autos_Processo_0801234-56-2024-8-10-0001.pdf"
CASO_02_NAME = "01_Autos_Processo_0654321-09-2024-8-04-0001.pdf"
CASO_01 = DATA_DIR / "Caso_01_0801234-56-2024-8-10-0001" / CASO_01_NAME
CASO_02 = DATA_DIR / "Caso_02_0654321-09-2024-8-04-0001" / CASO_02_NAME


def _pdf_escape(text: str) -> str:
    parts: list[str] = []
    for byte in text.encode("latin-1"):
        if byte == 0x28:
            parts.append("\\(")
        elif byte == 0x29:
            parts.append("\\)")
        elif byte == 0x5C:
            parts.append("\\\\")
        elif 32 <= byte <= 126:
            parts.append(chr(byte))
        else:
            parts.append(f"\\{byte:03o}")
    return "".join(parts)


def make_pdf(pages: list[str]) -> bytes:
    """Minimal PDF with uncompressed content streams and a real page tree."""
    total_pages = len(pages)
    page_objs = [4 + index * 2 for index in range(total_pages)]
    content_objs = [5 + index * 2 for index in range(total_pages)]
    last_obj = 4 + total_pages * 2
    kids = " ".join(f"{number} 0 R" for number in page_objs)
    objects: dict[int, bytes] = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: f"<< /Type /Pages /Count {total_pages} /Kids [{kids}] >>".encode("latin-1"),
        3: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    }
    for page_obj, content_obj, text in zip(page_objs, content_objs, pages):
        objects[page_obj] = (
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {content_obj} 0 R >>"
        ).encode("latin-1")
        stream = f"BT /F1 12 Tf 72 720 Td ({_pdf_escape(text)}) Tj ET".encode("latin-1")
        objects[content_obj] = b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream"
    output = bytearray(b"%PDF-1.4\n")
    offsets: dict[int, int] = {}
    for number in sorted(objects):
        offsets[number] = len(output)
        output += f"{number} 0 obj\n".encode("latin-1") + objects[number] + b"\nendobj\n"
    xref_pos = len(output)
    output += f"xref\n0 {last_obj}\n".encode("latin-1")
    output += b"0000000000 65535 f \n"
    for number in range(1, last_obj):
        output += f"{offsets[number]:010d} 00000 n \n".encode("latin-1")
    output += (
        f"trailer\n<< /Size {last_obj} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF".encode(
            "latin-1"
        )
    )
    return bytes(output)


def upload_pdf(client: TestClient, filename: str, content: bytes) -> dict:
    response = client.post(
        "/api/intakes",
        files={"file": (filename, content, "application/pdf")},
    )
    assert response.status_code == 201
    intake_id = response.json()["id"]
    return client.get(f"/api/intakes/{intake_id}").json()


def forbid_ocr(monkeypatch) -> None:
    def _explode(_pdf_path, _page_number) -> str:
        raise AssertionError("OCR must not run on pages with native text")

    monkeypatch.setattr("app.services.autos.ocr_page_text", _explode)


def test_caso_01_extracts_expected_fields_without_ocr(client: TestClient, monkeypatch) -> None:
    forbid_ocr(monkeypatch)
    intake = upload_pdf(client, CASO_01.name, CASO_01.read_bytes())
    assert intake["status"] == "NEEDS_REVIEW"
    assert intake["page_count"] == 8
    assert intake["ocr_pages"] == []
    fields = intake["fields"]
    assert fields["cnj"]["value"] == "0801234-56.2024.8.10.0001"
    assert fields["uf"]["value"] == "MA"
    assert fields["valor_causa"]["value"] == 20000.00
    for name in ("cnj", "uf", "assunto", "subassunto", "valor_causa"):
        assert fields[name]["page"] is not None and fields[name]["page"] >= 1
        assert fields[name]["excerpt"]
    download = client.get(intake["file_url"])
    assert download.status_code == 200
    assert download.content.startswith(b"%PDF-")


def test_caso_02_extracts_expected_fields_without_ocr(client: TestClient, monkeypatch) -> None:
    forbid_ocr(monkeypatch)
    intake = upload_pdf(client, CASO_02.name, CASO_02.read_bytes())
    assert intake["status"] == "NEEDS_REVIEW"
    assert intake["page_count"] == 8
    assert intake["ocr_pages"] == []
    fields = intake["fields"]
    assert fields["cnj"]["value"] == "0654321-09.2024.8.04.0001"
    assert fields["uf"]["value"] == "AM"
    assert fields["valor_causa"]["value"] == 25000.00


def test_scanned_pdf_fails_gracefully_and_retry_preserves_pdf(
    client: TestClient, monkeypatch
) -> None:
    def _no_backend(_pdf_path, _page_number) -> str:
        raise OcrUnavailableError("OCR indisponível no ambiente")

    monkeypatch.setattr("app.services.autos.ocr_page_text", _no_backend)
    intake = upload_pdf(client, "scan.pdf", make_pdf([""]))
    assert intake["status"] == "FAILED"
    assert intake["safe_error"]
    assert client.get(intake["file_url"]).status_code == 200

    retry = client.post(f"/api/intakes/{intake['id']}/retry")
    assert retry.status_code == 202
    again = client.get(f"/api/intakes/{intake['id']}").json()
    assert again["status"] == "FAILED"
    assert client.get(again["file_url"]).status_code == 200

    refused = client.post(f"/api/intakes/{intake['id']}/confirm", json={})
    assert refused.status_code == 409
    assert refused.json()["code"] == "INTAKE_NOT_READY"


def test_selective_ocr_recovers_scanned_page(client: TestClient, monkeypatch) -> None:
    scanned_text = (
        "Processo nº 9999888-77.2026.8.26.0001 Comarca de Teste/SP "
        "EMPRÉSTIMO CONSIGNADO INEXISTÊNCIA Dá-se à causa o valor de R$ 5.000,00"
    )

    def _fake_ocr(_pdf_path, page_number) -> str:
        assert page_number == 1
        return scanned_text

    monkeypatch.setattr("app.services.autos.ocr_page_text", _fake_ocr)
    intake = upload_pdf(client, "scan.pdf", make_pdf([""]))
    assert intake["status"] == "NEEDS_REVIEW"
    assert intake["ocr_pages"] == [1]
    assert intake["fields"]["cnj"]["value"] == "9999888-77.2026.8.26.0001"
    assert intake["fields"]["valor_causa"]["value"] == 5000.00


def test_incomplete_extraction_requires_correction_at_confirm(client: TestClient) -> None:
    text = (
        "Processo nº 1234567-89.2026.8.26.0001 "
        "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod"
    )
    intake = upload_pdf(client, "partial.pdf", make_pdf([text]))
    assert intake["status"] == "NEEDS_REVIEW"
    assert intake["fields"]["cnj"]["value"] == "1234567-89.2026.8.26.0001"
    assert intake["fields"]["valor_causa"]["value"] is None

    missing = client.post(f"/api/intakes/{intake['id']}/confirm", json={})
    assert missing.status_code == 422

    confirmed = client.post(
        f"/api/intakes/{intake['id']}/confirm",
        json={"uf": "SP", "assunto": "Empréstimo consignado não reconhecido", "valor_causa": 7500},
    )
    assert confirmed.status_code == 201
    body = confirmed.json()
    assert body["intake"]["status"] == "CONFIRMED"
    case = body["case"]
    assert case["cnj"] == "1234567-89.2026.8.26.0001"
    assert case["uf"] == "SP"
    assert case["valor_causa"] == 7500.0
    assert case["status"] == "DOCUMENTOS_ENVIADOS"
    assert case["subsidy_flags"] == {
        "contrato": False,
        "extrato": False,
        "comprovante_credito": False,
        "dossie": False,
        "demonstrativo_divida": False,
        "laudo_referenciado": False,
    }
    workspace = client.get(f"/api/cases/{case['id']}/workspace").json()
    assert len(workspace["documents"]) == 1
    assert workspace["documents"][0]["type"] == "AUTOS"


def test_confirm_accepts_value_divergence(client: TestClient) -> None:
    intake = upload_pdf(client, CASO_01.name, CASO_01.read_bytes())
    assert intake["fields"]["valor_causa"]["value"] == 20000.00
    confirmed = client.post(
        f"/api/intakes/{intake['id']}/confirm",
        json={"cnj": "2222222-22.2026.8.26.0001", "valor_causa": 19500.00},
    )
    assert confirmed.status_code == 201
    assert confirmed.json()["case"]["valor_causa"] == 19500.00


def test_duplicate_cnj_does_not_overwrite_existing_case(client: TestClient) -> None:
    seed_cnj = "0801234-56.2024.8.10.0001"
    with Session(get_engine()) as session:
        existing = session.exec(select(Case).where(Case.cnj == seed_cnj)).one()
        existing_id, existing_valor, existing_status = (
            existing.id,
            existing.valor_causa,
            existing.status,
        )
    intake = upload_pdf(client, CASO_01.name, CASO_01.read_bytes())
    duplicate = client.post(f"/api/intakes/{intake['id']}/confirm", json={})
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "CNJ_ALREADY_EXISTS"
    assert duplicate.json()["details"] == {"existing_case_id": existing_id}

    with Session(get_engine()) as session:
        untouched = session.get(Case, existing_id)
        assert untouched is not None
        assert untouched.valor_causa == existing_valor
        assert untouched.status == existing_status
    assert client.get(f"/api/intakes/{intake['id']}").json()["status"] == "NEEDS_REVIEW"

    corrected = client.post(
        f"/api/intakes/{intake['id']}/confirm", json={"cnj": "3333333-33.2026.8.26.0001"}
    )
    assert corrected.status_code == 201


def test_double_confirm_does_not_duplicate_case(client: TestClient) -> None:
    text = (
        "Processo nº 4444444-44.2026.8.26.0001 Comarca de Teste/SP "
        "EMPRÉSTIMO CONSIGNADO INEXISTÊNCIA Dá-se à causa o valor de R$ 9.000,00"
    )
    intake = upload_pdf(client, "autos.pdf", make_pdf([text, text]))
    first = client.post(f"/api/intakes/{intake['id']}/confirm", json={})
    assert first.status_code == 201
    case_id = first.json()["case"]["id"]
    second = client.post(f"/api/intakes/{intake['id']}/confirm", json={})
    assert second.status_code == 409
    assert second.json()["code"] == "INTAKE_ALREADY_CONFIRMED"
    assert second.json()["details"] == {"case_id": case_id}
    with Session(get_engine()) as session:
        matches = session.exec(
            select(Case).where(Case.cnj == "4444444-44.2026.8.26.0001")
        ).all()
        assert len(matches) == 1


def test_restart_recovery_preserves_pdf_and_allows_retry(client: TestClient) -> None:
    intake = upload_pdf(client, CASO_02.name, CASO_02.read_bytes())
    assert intake["status"] == "NEEDS_REVIEW"
    with Session(get_engine()) as session:
        row = session.get(CaseIntake, intake["id"])
        assert row is not None
        row.status = IntakeStatus.EXTRACTING
        session.add(row)
        session.commit()
        recover_abandoned_intakes(session)
    recovered = client.get(f"/api/intakes/{intake['id']}").json()
    assert recovered["status"] == "FAILED"
    assert recovered["safe_error"]
    assert client.get(recovered["file_url"]).status_code == 200
    retry = client.post(f"/api/intakes/{intake['id']}/retry")
    assert retry.status_code == 202
    assert client.get(f"/api/intakes/{intake['id']}").json()["status"] == "NEEDS_REVIEW"


def test_confirmed_case_can_go_to_analysis(client: TestClient, monkeypatch) -> None:
    text = (
        "Processo nº 5555555-55.2026.8.26.0001 Comarca de Teste/SP "
        "EMPRÉSTIMO CONSIGNADO INEXISTÊNCIA Dá-se à causa o valor de R$ 7.000,00"
    )
    intake = upload_pdf(client, "autos.pdf", make_pdf([text]))
    confirmed = client.post(f"/api/intakes/{intake['id']}/confirm", json={})
    case_id = confirmed.json()["case"]["id"]

    def _fake_pipeline(case_input):
        return {
            "versions": {"pipeline": "test-v1"},
            "recommendation": {
                "action": "DEFESA",
                "confidence_percent": 70,
                "summary": "Resultado controlado do teste",
                "reason_codes": ["TEST_FIXTURE"],
            },
            "financial": {
                "suggested_offer": None,
                "expected_defense_cost": 6000,
                "expected_savings": 1000,
            },
            "evidences": [],
        }

    monkeypatch.setattr(
        "app.services.analysis.decision_engine.run_pipeline",
        _fake_pipeline,
    )
    assert client.post(f"/api/cases/{case_id}/analyze").status_code == 202
    workspace = client.get(f"/api/cases/{case_id}/workspace").json()
    assert workspace["case"]["status"] == "AGUARDANDO_DECISAO"
    assert workspace["recommendation"]["action"] == "DEFESA"


def test_intake_hides_internal_paths_and_rejects_non_pdf(client: TestClient) -> None:
    intake = upload_pdf(client, CASO_01.name, CASO_01.read_bytes())
    dumped = json.dumps(intake, default=str)
    assert "stored_path" not in dumped
    assert intake["file_url"].startswith("/api/intakes/")

    rejected = client.post(
        "/api/intakes",
        files={"file": ("not-pdf.txt", b"hello", "text/plain")},
    )
    assert rejected.status_code == 422
    assert rejected.json()["code"] == "INVALID_FILE_TYPE"

    listing = client.get("/api/intakes").json()
    assert listing["total"] >= 1
