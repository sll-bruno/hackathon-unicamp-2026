"""Monta o pacote do caso: páginas, chunks, features tabulares e valores do demonstrativo."""

import re
from dataclasses import dataclass
from pathlib import Path

from contracts.pipeline import CaseInput, PipelineDocument, SubsidyFlags

from decision_engine.chunking.chunker import Chunk, build_chunks
from decision_engine.features.tabular import claim_value, subsidy_flags, uf_from_cnj
from decision_engine.ingest.pdf_text import Page, read_document
from decision_engine.scoring.valores import DebtSchedule, parse_debt_schedule

FILE_NAME_TO_TYPE = (
    ("autos", "AUTOS"),
    ("contrato", "CONTRATO"),
    ("extrato", "EXTRATO"),
    ("comprovante", "COMPROVANTE_CREDITO"),
    ("dossie", "DOSSIE"),
    ("demonstrativo", "DEMONSTRATIVO_DIVIDA"),
    ("laudo", "LAUDO_REFERENCIADO"),
)


@dataclass(frozen=True)
class CasePackage:
    case: CaseInput
    pages: list[Page]
    chunks: list[Chunk]
    uf: str
    valor_causa: float
    flags: dict[str, bool]
    demonstrativo: DebtSchedule | None

    @property
    def document_types(self) -> list[str]:
        return sorted({document.type for document in self.case.documents})


def build_package(case: CaseInput) -> CasePackage:
    pages = [
        page
        for document in case.documents
        for page in read_document(document.id, document.type, document.path)
    ]
    return CasePackage(
        case=case,
        pages=pages,
        chunks=build_chunks(pages),
        uf=uf_from_cnj(case.cnj) or case.uf,
        valor_causa=claim_value(pages) or case.valor_causa,
        flags=subsidy_flags([document.type for document in case.documents]),
        demonstrativo=parse_debt_schedule(pages),
    )


def case_input_from_folder(folder: str | Path) -> CaseInput:
    """Monta um `CaseInput` a partir de uma pasta de PDFs como `data/Caso_02_...`."""

    folder = Path(folder)
    documents = []
    for pdf in sorted(folder.glob("*.pdf")):
        name = pdf.stem.lower()
        kind = next((kind for key, kind in FILE_NAME_TO_TYPE if key in name), None)
        if kind:
            documents.append(PipelineDocument(id=pdf.stem, type=kind, path=str(pdf.resolve())))
    digits = re.search(r"(\d{7})-(\d{2})-(\d{4})-(\d)-(\d{2})-(\d{4})", folder.name)
    cnj = (
        "{}-{}.{}.{}.{}.{}".format(*digits.groups()) if digits else folder.name
    )
    flags = subsidy_flags([document.type for document in documents])
    return CaseInput(
        case_id=folder.name,
        cnj=cnj,
        uf=uf_from_cnj(cnj) or "",
        assunto="Não reconhece operação",
        subassunto="",
        valor_causa=0,
        subsidy_flags=SubsidyFlags(**flags),
        documents=documents,
    )
