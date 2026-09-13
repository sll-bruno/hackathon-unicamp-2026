"""Confere as anotações de referência contra os PDFs e a tabela de pesos."""

import json
import re
from functools import cache
from pathlib import Path

import pdfplumber
import pytest
from decision_engine.config_loader import category_weight, load_weights

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).resolve().parent / "fixtures"
GOLD_FILES = sorted(FIXTURES.glob("gold_caso*.json"))
FLAG_BY_DOCUMENT_TYPE = {
    "CONTRATO": "contrato",
    "EXTRATO": "extrato",
    "COMPROVANTE_CREDITO": "comprovante_credito",
    "DOSSIE": "dossie",
    "DEMONSTRATIVO_DIVIDA": "demonstrativo_divida",
    "LAUDO_REFERENCIADO": "laudo_referenciado",
}


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


@cache
def page_text(path: Path, page: int) -> str:
    with pdfplumber.open(path) as pdf:
        return normalize(pdf.pages[page - 1].extract_text() or "")


def load_gold(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def text_references(gold: dict) -> list[dict]:
    references = [gold["features_esperadas"]["referencia_valor_causa"]]
    references.append(gold["valores_esperados"]["referencia_resumo"])
    if "referencia_sub_assunto" in gold["features_esperadas"]:
        references.append(gold["features_esperadas"]["referencia_sub_assunto"])
    references.extend(accusation["referencia"] for accusation in gold["acusacoes_esperadas"])
    for item in gold["embasamentos_obrigatorios"]:
        references.extend(
            ref for ref in item["referencias"] if ref.get("tipo", "trecho") == "trecho"
        )
    return references


@pytest.mark.parametrize("gold_path", GOLD_FILES, ids=lambda path: path.stem)
def test_gold_quotes_exist_on_cited_pages(gold_path: Path) -> None:
    gold = load_gold(gold_path)
    folder = ROOT / "data" / gold["pasta"]
    missing = [
        (ref["arquivo"], ref["pagina"], ref["trecho"])
        for ref in text_references(gold)
        if normalize(ref["trecho"]) not in page_text(folder / ref["arquivo"], ref["pagina"])
    ]
    assert not missing


@pytest.mark.parametrize("gold_path", GOLD_FILES, ids=lambda path: path.stem)
def test_gold_categories_exist_in_weights(gold_path: Path) -> None:
    weights = load_weights()
    for item in load_gold(gold_path)["embasamentos_obrigatorios"]:
        assert any(
            category_weight(weights, accusation, category) is not None
            for accusation in item["acusacoes_aceitas"]
            for category in item["categorias_aceitas"]
        ), item["id"]


@pytest.mark.parametrize("gold_path", GOLD_FILES, ids=lambda path: path.stem)
def test_gold_flags_and_values_are_consistent(gold_path: Path) -> None:
    gold = load_gold(gold_path)
    present = {
        FLAG_BY_DOCUMENT_TYPE[document["tipo"]]
        for document in gold["documentos"]
        if document["tipo"] in FLAG_BY_DOCUMENT_TYPE
    }
    flags = gold["features_esperadas"]["flags"]
    assert {name for name, available in flags.items() if available} == present

    values = gold["valores_esperados"]
    assert values["restituicao_simples"] == values["parcelas_pagas"] * values["valor_parcela"]
    assert values["restituicao_dobro"] == 2 * values["restituicao_simples"]
    for document in gold["documentos"]:
        with pdfplumber.open(ROOT / "data" / gold["pasta"] / document["arquivo"]) as pdf:
            assert len(pdf.pages) == document["paginas"], document["arquivo"]
