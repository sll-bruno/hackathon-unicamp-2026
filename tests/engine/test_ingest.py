import json
import shutil
from pathlib import Path

import pypdfium2
import pytest
from decision_engine.chunking.chunker import build_chunks
from decision_engine.features.tabular import parse_brl, uf_from_cnj
from decision_engine.ingest.package import build_package, case_input_from_folder
from decision_engine.ingest.pdf_text import read_document

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).resolve().parent / "fixtures"


def gold(name: str) -> dict:
    return json.loads((FIXTURES / f"gold_{name}.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module", params=["caso01", "caso02"])
def package_and_gold(request):
    expected = gold(request.param)
    case = case_input_from_folder(ROOT / "data" / expected["pasta"])
    return build_package(case), expected


def test_case_folder_becomes_case_input(package_and_gold) -> None:
    package, expected = package_and_gold
    assert package.case.cnj == expected["cnj"]
    assert package.document_types == sorted(document["tipo"] for document in expected["documentos"])


def test_tabular_features_match_gold(package_and_gold) -> None:
    package, expected = package_and_gold
    features = expected["features_esperadas"]
    assert package.uf == features["uf"]
    assert package.valor_causa == features["valor_causa"]
    assert package.flags == features["flags"]


def test_debt_schedule_matches_gold(package_and_gold) -> None:
    package, expected = package_and_gold
    values = expected["valores_esperados"]
    schedule = package.demonstrativo
    assert schedule.parcelas_pagas == values["parcelas_pagas"]
    assert schedule.parcelas_totais == values["parcelas_totais"]
    assert schedule.valor_parcela == values["valor_parcela"]
    assert schedule.saldo_apos_ultima_paga == values["saldo_apos_ultima_paga"]
    assert schedule.restituicao_dobro == values["restituicao_dobro"]


def test_digital_pdfs_do_not_use_ocr_and_chunks_cover_pages(package_and_gold) -> None:
    package, expected = package_and_gold
    assert len(package.pages) == sum(document["paginas"] for document in expected["documentos"])
    assert not any(page.ocr for page in package.pages)
    assert len({chunk.id for chunk in package.chunks}) == len(package.chunks)
    assert {(chunk.document_id, chunk.page) for chunk in package.chunks} == {
        (page.document_id, page.number) for page in package.pages
    }


def test_helpers() -> None:
    assert uf_from_cnj("0801234-56.2024.8.10.0001") == "MA"
    assert uf_from_cnj("0654321-09.2024.8.04.0001") == "AM"
    assert parse_brl("danos morais no valor de R$ 18.000,00") == 18000.0


@pytest.mark.skipif(shutil.which("tesseract") is None, reason="Tesseract não instalado")
def test_scanned_page_is_read_with_ocr(tmp_path: Path) -> None:
    source = ROOT / "data" / "Caso_02_0654321-09-2024-8-04-0001" / "04_Laudo_Referenciado.pdf"
    pdf = pypdfium2.PdfDocument(source)
    image = pdf[1].render(scale=200 / 72).to_pil().convert("RGB")
    pdf.close()
    scanned = tmp_path / "laudo_escaneado.pdf"
    image.save(scanned, "PDF", resolution=200)

    (page,) = read_document("laudo", "LAUDO_REFERENCIADO", scanned)

    assert page.ocr and page.ocr_confidence and page.ocr_confidence > 60
    text = page.text.lower()
    assert "liveness" in text and "grafotécnica" in text
    assert build_chunks([page])[0].page == 1
