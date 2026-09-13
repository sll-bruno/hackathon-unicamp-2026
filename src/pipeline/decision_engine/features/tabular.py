"""Features da planilha extraídas do caso: UF, valor da causa e flags dos subsídios."""

import re

from decision_engine.ingest.pdf_text import Page
from decision_engine.risk.features import FLAG_NAMES

# Segmento TR do número CNJ para a Justiça Estadual (J = 8), em ordem alfabética dos estados.
TR_TO_UF = (
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SE",
    "SP",
    "TO",
)
DOCUMENT_TYPE_TO_FLAG = {
    "CONTRATO": "contrato",
    "EXTRATO": "extrato",
    "COMPROVANTE_CREDITO": "comprovante_credito",
    "DOSSIE": "dossie",
    "DEMONSTRATIVO_DIVIDA": "demonstrativo_divida",
    "LAUDO_REFERENCIADO": "laudo_referenciado",
}
_CNJ = re.compile(r"(\d{7})-?(\d{2})\.?(\d{4})\.?(\d)\.?(\d{2})\.?(\d{4})")
_CLAIM_VALUE = re.compile(r"Dá-se à causa o valor de R\$\s*([\d.]+,\d{2})", re.IGNORECASE)
_MONEY = re.compile(r"R\$\s*([\d.]+,\d{2})")


def parse_brl(text: str) -> float | None:
    """Converte "R$ 18.000,00" ou "18.000,00" em 18000.0."""

    match = _MONEY.search(text) or re.search(r"([\d.]+,\d{2})", text)
    return float(match.group(1).replace(".", "").replace(",", ".")) if match else None


def uf_from_cnj(cnj: str) -> str | None:
    match = _CNJ.search(cnj)
    if not match or match.group(4) != "8":
        return None
    tribunal = int(match.group(5))
    return TR_TO_UF[tribunal - 1] if 1 <= tribunal <= len(TR_TO_UF) else None


def claim_value(pages: list[Page]) -> float | None:
    for page in pages:
        if page.document_type != "AUTOS":
            continue
        match = _CLAIM_VALUE.search(re.sub(r"\s+", " ", page.text))
        if match:
            return parse_brl(match.group(1))
    return None


def subsidy_flags(document_types: list[str]) -> dict[str, bool]:
    present = {
        DOCUMENT_TYPE_TO_FLAG[kind] for kind in document_types if kind in DOCUMENT_TYPE_TO_FLAG
    }
    return {name: name in present for name in FLAG_NAMES}
