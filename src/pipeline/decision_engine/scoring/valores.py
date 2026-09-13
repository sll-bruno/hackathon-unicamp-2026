"""Valores monetários extraídos por regra dos subsídios (sem LLM)."""

import re
from dataclasses import dataclass

from decision_engine.features.tabular import parse_brl
from decision_engine.ingest.pdf_text import Page

_INSTALLMENT = re.compile(
    r"^\s*(\d+)\s+(\d{2}/\d{2}/\d{4})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})"
    r"\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+(PAGA|EM ABERTO)\s*$",
    re.MULTILINE,
)


@dataclass(frozen=True)
class DebtSchedule:
    parcelas_pagas: int
    parcelas_totais: int
    valor_parcela: float
    saldo_apos_ultima_paga: float
    total_descontado: float

    @property
    def restituicao_simples(self) -> float:
        return round(self.total_descontado, 2)

    @property
    def restituicao_dobro(self) -> float:
        return round(2 * self.total_descontado, 2)


def parse_debt_schedule(pages: list[Page]) -> DebtSchedule | None:
    """Lê a tabela do demonstrativo de evolução da dívida."""

    rows = []
    for page in pages:
        if page.document_type == "DEMONSTRATIVO_DIVIDA":
            rows.extend(_INSTALLMENT.findall(page.text))
    if not rows:
        return None
    paid = [row for row in rows if row[7] == "PAGA"]
    installment = parse_brl(rows[0][5]) or 0.0
    balance_row, balance_column = (paid[-1], 6) if paid else (rows[0], 2)
    return DebtSchedule(
        parcelas_pagas=len(paid),
        parcelas_totais=len(rows),
        valor_parcela=installment,
        saldo_apos_ultima_paga=parse_brl(balance_row[balance_column]) or 0.0,
        total_descontado=sum(parse_brl(row[5]) or 0.0 for row in paid),
    )
