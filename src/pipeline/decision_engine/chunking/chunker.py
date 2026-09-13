"""Chunks por página, divididos por parágrafo quando a página é longa.

Os dois casos exemplo cabem inteiros no contexto (~15 mil tokens), então todos os
chunks são enviados juntos; o modo map-reduce fica para produção.
"""

import re
from dataclasses import dataclass

from decision_engine.config_loader import load_params
from decision_engine.ingest.pdf_text import Page

CHARS_PER_TOKEN = 4
DOCUMENT_LABELS = {
    "AUTOS": "Autos do processo",
    "CONTRATO": "Contrato",
    "EXTRATO": "Extrato bancário",
    "COMPROVANTE_CREDITO": "Comprovante de crédito (BACEN)",
    "DOSSIE": "Dossiê de verificação",
    "DEMONSTRATIVO_DIVIDA": "Demonstrativo de evolução da dívida",
    "LAUDO_REFERENCIADO": "Laudo referenciado",
}


@dataclass(frozen=True)
class Chunk:
    id: str
    document_id: str
    document_type: str
    file_name: str
    page: int
    text: str

    def render(self) -> str:
        label = DOCUMENT_LABELS.get(self.document_type, self.document_type)
        attributes = f'id="{self.id}" doc="{label}" arquivo="{self.file_name}" pagina="{self.page}"'
        return f"<chunk {attributes}>\n{self.text.strip()}\n</chunk>"


def estimate_tokens(text: str) -> int:
    return len(text) // CHARS_PER_TOKEN + 1


def build_chunks(pages: list[Page]) -> list[Chunk]:
    max_chars = load_params()["chunking"]["tokens_max"] * CHARS_PER_TOKEN
    document_codes: dict[str, str] = {}
    chunks = []
    for page in pages:
        code = document_codes.setdefault(page.document_id, f"D{len(document_codes) + 1:02d}")
        parts = [page.text]
        if len(page.text) > max_chars:
            parts, current = [], ""
            for paragraph in re.split(r"\n\s*\n|\n(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9IVX]+ ?[–.-])", page.text):
                if current and len(current) + len(paragraph) > max_chars:
                    parts.append(current)
                    current = ""
                current = f"{current}\n{paragraph}" if current else paragraph
            parts.append(current)
        for index, part in enumerate(parts, start=1):
            if part.strip():
                chunks.append(
                    Chunk(
                        id=f"{code}:p{page.number}:c{index}",
                        document_id=page.document_id,
                        document_type=page.document_type,
                        file_name=page.file_name,
                        page=page.number,
                        text=part,
                    )
                )
    return chunks


def render_chunks(chunks: list[Chunk]) -> str:
    return "\n\n".join(chunk.render() for chunk in chunks)
