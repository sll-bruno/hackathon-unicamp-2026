"""Texto por página: `pdfplumber` para PDF digital e Tesseract nas páginas sem texto."""

from dataclasses import dataclass
from pathlib import Path

import pdfplumber
import pypdfium2
import pytesseract

from decision_engine.config_loader import load_params


@dataclass(frozen=True)
class Page:
    document_id: str
    document_type: str
    file_name: str
    number: int
    text: str
    ocr: bool = False
    ocr_confidence: float | None = None


def _ocr_page(path: Path, page_index: int, language: str, dpi: int) -> tuple[str, float | None]:
    pdf = pypdfium2.PdfDocument(path)
    try:
        image = pdf[page_index].render(scale=dpi / 72).to_pil()
    finally:
        pdf.close()
    data = pytesseract.image_to_data(image, lang=language, output_type=pytesseract.Output.DICT)
    lines: dict[tuple[int, int, int], list[str]] = {}
    confidences = []
    for word, conf, block, paragraph, line in zip(
        data["text"], data["conf"], data["block_num"], data["par_num"], data["line_num"],
        strict=True,
    ):
        if word.strip():
            lines.setdefault((block, paragraph, line), []).append(word)
            if float(conf) >= 0:
                confidences.append(float(conf))
    text = "\n".join(" ".join(words) for _, words in sorted(lines.items()))
    return text, (round(sum(confidences) / len(confidences), 1) if confidences else None)


def read_document(
    document_id: str, document_type: str, path: str | Path, force_ocr: bool = False
) -> list[Page]:
    path = Path(path)
    ocr = load_params()["ocr"]
    pages = []
    with pdfplumber.open(path) as pdf:
        for index, pdf_page in enumerate(pdf.pages):
            text = pdf_page.extract_text() or ""
            needs_ocr = force_ocr or len(text.strip()) < ocr["min_caracteres_uteis"]
            confidence = None
            if needs_ocr:
                text, confidence = _ocr_page(path, index, ocr["idioma"], ocr["dpi"])
            pages.append(
                Page(
                    document_id=document_id,
                    document_type=document_type,
                    file_name=path.name,
                    number=index + 1,
                    text=text,
                    ocr=needs_ocr,
                    ocr_confidence=confidence,
                )
            )
    return pages
