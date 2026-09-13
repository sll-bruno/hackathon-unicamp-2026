"""Upload-first intake from AUTOS PDFs.

Native text extraction runs first for every page (stdlib only, no new
dependencies). OCR is attempted exclusively for pages without enough native
text, through optional backends that are never required. Structured fields
(CNJ, UF, assunto, subassunto, valor da causa) always carry page and excerpt
provenance so the frontend can show them for human confirmation.
"""

import base64
import binascii
import json
import logging
import re
import unicodedata
import zlib
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from sqlmodel import Session, select

from app.core.database import get_engine
from app.models import CaseIntake, IntakeStatus
from app.models.domain import utc_now

logger = logging.getLogger(__name__)

EXTRACTION_VERSION = "autos-v1"
MIN_NATIVE_CHARS = 50
EXCERPT_RADIUS = 90

VALID_UFS = frozenset(
    {
        "AC",
        "AL",
        "AM",
        "AP",
        "BA",
        "CE",
        "DF",
        "ES",
        "GO",
        "MA",
        "MG",
        "MS",
        "MT",
        "PA",
        "PB",
        "PE",
        "PI",
        "PR",
        "RJ",
        "RN",
        "RO",
        "RR",
        "RS",
        "SC",
        "SE",
        "SP",
        "TO",
    }
)

CNJ_RE = re.compile(
    r"(?<!\d)(\d{7})[-.\s]?(\d{2})[-.\s]?(\d{4})[-.\s]?(\d)[-.\s]?(\d{2})[-.\s]?(\d{4})(?!\d)"
)
COMARCA_RE = re.compile(r"COMARCA DE ([A-Z ]{2,80}?)/([A-Z]{2})\b")
GENERIC_UF_RE = re.compile(r"/([A-Z]{2})\b")
VALOR_RE = re.compile(
    r"D[ÁAÀÂÃ]-SE\s+[ÀA]\s+CAUSA\s+O\s+VALOR\s+DE\s+R\$\s*"
    r"(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2}|\d+)",
    re.IGNORECASE,
)
VALOR_FALLBACK_RE = re.compile(
    r"VALOR\s+DA\s+CAUSA[^\dR$]{0,40}R\$\s*"
    r"(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2}|\d+)",
    re.IGNORECASE,
)
ASSUNTO_RE = re.compile(r"EMPR[ÉE]STIMO\s+CONSIGNADO", re.IGNORECASE)
SUBASSUNTO_RE = re.compile(r"INEXIST[ÊE]NCIA", re.IGNORECASE)

ASSUNTO_DEFAULT = "Empréstimo consignado não reconhecido"
SUBASSUNTO_DEFAULT = "Inexistência de relação jurídica"


class AutosExtractionError(Exception):
    """Failure with a message that is safe to expose through the API."""

    def __init__(self, code: str, safe_message: str) -> None:
        super().__init__(safe_message)
        self.code = code
        self.safe_message = safe_message


class OcrUnavailableError(Exception):
    """Raised when a page needs OCR but no OCR backend is installed."""


@dataclass
class ExtractedField:
    value: str | float | None
    page: int | None = None
    excerpt: str | None = None


@dataclass
class AutosFields:
    cnj: ExtractedField
    uf: ExtractedField
    assunto: ExtractedField
    subassunto: ExtractedField
    valor_causa: ExtractedField


def normalize_cnj(raw: str) -> str:
    """Normalize free-form CNJ digits to NNNNNNN-DD.AAAA.J.TR.OOOO."""
    match = CNJ_RE.search(raw or "")
    if match is None:
        raise ValueError(f"CNJ inválido: {raw!r}")
    groups = match.groups()
    return f"{groups[0]}-{groups[1]}.{groups[2]}.{groups[3]}.{groups[4]}.{groups[5]}"


def normalize_uf(raw: str | None) -> str | None:
    if raw is None:
        return None
    candidate = raw.strip().upper()
    return candidate if candidate in VALID_UFS else None


def parse_brl_amount(raw: str) -> float:
    text = raw.strip()
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    return float(text)


def ocr_page_text(pdf_path: Path, page_number: int) -> str:
    """Run OCR on a single 1-based page; raises OcrUnavailableError without backends."""
    try:
        import pytesseract  # type: ignore[import-not-found]
        from pdf2image import convert_from_path  # type: ignore[import-not-found]
    except ImportError as exc:
        raise OcrUnavailableError("OCR indisponível no ambiente") from exc
    images = convert_from_path(
        str(pdf_path), dpi=300, first_page=page_number, last_page=page_number
    )
    if not images:
        return ""
    return str(pytesseract.image_to_string(images[0], lang="por") or "")


def _decode_stream(payload: bytes, filters: list[str]) -> bytes:
    # PDF lists stream filters in decode order: ASCII85Decode unwraps the text
    # first and FlateDecode inflates the result afterwards.
    data = payload
    for name in filters:
        if name == "FlateDecode":
            try:
                data = zlib.decompress(data)
            except zlib.error as exc:
                raise AutosExtractionError(
                    "EXTRACTION_FAILED", "Não foi possível extrair o texto do PDF"
                ) from exc
        elif name in ("ASCII85Decode", "A85"):
            text = data.strip()
            if text.endswith(b"~>"):
                text = text[:-2]
            try:
                data = base64.a85decode(text, adobe=False)
            except (ValueError, binascii.Error) as exc:
                raise AutosExtractionError(
                    "EXTRACTION_FAILED", "Não foi possível extrair o texto do PDF"
                ) from exc
        elif name == "ASCIIHexDecode":
            text = b"".join(data.split())
            if text.endswith(b">"):
                text = text[:-1]
            try:
                data = bytes.fromhex(text.decode("ascii"))
            except (ValueError, UnicodeDecodeError) as exc:
                raise AutosExtractionError(
                    "EXTRACTION_FAILED", "Não foi possível extrair o texto do PDF"
                ) from exc
        else:
            raise AutosExtractionError(
                "UNSUPPORTED_PDF_FILTER", "O PDF usa um filtro ainda não suportado"
            )
    return data


def _page_order_contents(raw: bytes) -> list[list[int]] | None:
    """Return content-stream object numbers in page order, or None when unparseable."""
    text = raw.decode("latin-1")
    kids_match = re.search(r"/Type\s*/Pages\b.*?/Kids\s*\[(.*?)\]", text, re.S)
    if kids_match is None:
        return None
    kids = [int(number) for number in re.findall(r"(\d+)\s+0\s+R", kids_match.group(1))]
    bodies: dict[int, str] = {}
    for match in re.finditer(r"(\d+)\s+0\s+obj\b(.*?)endobj", text, re.S):
        bodies[int(match.group(1))] = match.group(2)
    ordered: list[list[int]] = []
    for kid in kids:
        body = bodies.get(kid)
        if body is None or re.search(r"/Type\s*/Page(?!s)", body) is None:
            continue
        contents = re.search(r"/Contents\s*(\[(.*?)\]|(\d+)\s+0\s+R)", body, re.S)
        if contents is None:
            continue
        if contents.group(2) is not None:
            refs = [int(number) for number in re.findall(r"(\d+)\s+0\s+R", contents.group(2))]
        else:
            refs = [int(contents.group(3))]
        if refs:
            ordered.append(refs)
    return ordered or None


def _find_stream(raw: bytes, obj_num: int) -> tuple[bytes, list[str]]:
    pattern = rb"%d\s+0\s+obj\b(.*?)stream\r\n(.*?)endstream" % obj_num
    match = re.search(pattern, raw, re.S)
    if match is None:
        pattern = rb"%d\s+0\s+obj\b(.*?)stream\n(.*?)endstream" % obj_num
        match = re.search(pattern, raw, re.S)
    if match is None:
        pattern = rb"%d\s+0\s+obj\b(.*?)stream\r(.*?)endstream" % obj_num
        match = re.search(pattern, raw, re.S)
    if match is None:
        raise AutosExtractionError("EXTRACTION_FAILED", "Não foi possível extrair o texto do PDF")
    header, payload = match.group(1), match.group(2).strip()
    filter_match = re.search(rb"/Filter\s*(\[(.*?)\]|/(\w+))", header, re.S)
    filters: list[str] = []
    if filter_match is not None:
        if filter_match.group(2) is not None:
            filters = re.findall(r"/(\w+)", filter_match.group(2).decode("latin-1"))
        else:
            filters = [filter_match.group(3).decode("latin-1")]
    return payload, filters


def _decode_pdf_bytes(data: bytes) -> str:
    if data.startswith(b"\xfe\xff"):
        return data[2:].decode("utf-16-be", errors="replace")
    return data.decode("cp1252", errors="replace")


def _content_to_text(content: bytes) -> str:
    """Extract literal and hex strings from a decoded content stream, in order."""
    text = content.decode("latin-1")
    fragments: list[str] = []
    i, size = 0, len(text)
    simple_escapes = {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f"}
    while i < size:
        char = text[i]
        if char == "(":
            raw_bytes = bytearray()
            depth = 1
            i += 1
            while i < size and depth > 0:
                current = text[i]
                if current == "\\" and i + 1 < size:
                    nxt = text[i + 1]
                    if nxt in simple_escapes:
                        raw_bytes.extend(simple_escapes[nxt].encode("latin-1"))
                        i += 2
                    elif nxt in "()\\":
                        raw_bytes.append(ord(nxt))
                        i += 2
                    elif nxt.isdigit():
                        digits = nxt
                        j = i + 2
                        while j < size and len(digits) < 3 and text[j].isdigit():
                            digits += text[j]
                            j += 1
                        raw_bytes.append(int(digits, 8) % 256)
                        i = j
                    elif nxt in "\r\n":
                        i += 2
                        if nxt == "\r" and i < size and text[i] == "\n":
                            i += 1
                    else:
                        raw_bytes.append(ord(nxt) % 256)
                        i += 2
                elif current == "(":
                    depth += 1
                    raw_bytes.append(ord("("))
                    i += 1
                elif current == ")":
                    depth -= 1
                    if depth > 0:
                        raw_bytes.append(ord(")"))
                    i += 1
                else:
                    raw_bytes.append(ord(current) % 256)
                    i += 1
            fragments.append(_decode_pdf_bytes(bytes(raw_bytes)))
        elif char == "<" and i + 1 < size and text[i + 1] == "<":
            i += 2
        elif char == "<":
            end = text.find(">", i + 1)
            if end == -1:
                break
            hexpart = re.sub(r"\s", "", text[i + 1 : end])
            if hexpart and all(c in "0123456789abcdefABCDEF" for c in hexpart):
                if len(hexpart) % 2 == 1:
                    hexpart += "0"
                fragments.append(_decode_pdf_bytes(bytes.fromhex(hexpart)))
            i = end + 1
        else:
            i += 1
    return re.sub(r"\s+", " ", " ".join(fragments)).strip()


def extract_native_pages(pdf_path: Path) -> list[str]:
    """Extract native text per page, in page order, without any OCR."""
    try:
        raw = pdf_path.read_bytes()
    except OSError as exc:
        raise AutosExtractionError(
            "FILE_NOT_FOUND", "Arquivo do intake não encontrado para extração"
        ) from exc
    if not raw.startswith(b"%PDF-"):
        raise AutosExtractionError("INVALID_PDF", "O arquivo não possui uma assinatura PDF válida")
    ordered = _page_order_contents(raw)
    if ordered is None:
        return _fallback_stream_texts(raw)
    pages: list[str] = []
    for refs in ordered:
        chunks: list[str] = []
        for ref in refs:
            try:
                payload, filters = _find_stream(raw, ref)
                chunks.append(_content_to_text(_decode_stream(payload, filters)))
            except AutosExtractionError:
                continue
        pages.append(re.sub(r"\s+", " ", " ".join(chunks)).strip())
    if not pages:
        raise AutosExtractionError("EXTRACTION_FAILED", "Não foi possível extrair o texto do PDF")
    return pages


def _fallback_stream_texts(raw: bytes) -> list[str]:
    pages: list[str] = []
    for match in re.finditer(rb"stream\r\n(.*?)endstream|stream\n(.*?)endstream", raw, re.S):
        payload = next(group for group in match.groups() if group is not None).strip()
        header = raw[max(0, match.start() - 400) : match.start()].decode("latin-1")
        filter_match = re.search(r"/Filter\s*(\[(.*?)\]|/(\w+))", header, re.S)
        filters = []
        if filter_match is not None:
            if filter_match.group(2) is not None:
                filters = re.findall(r"/(\w+)", filter_match.group(2))
            else:
                filters = [filter_match.group(3)]
        try:
            pages.append(_content_to_text(_decode_stream(payload, filters)))
        except AutosExtractionError:
            continue
    if not pages:
        raise AutosExtractionError("EXTRACTION_FAILED", "Não foi possível extrair o texto do PDF")
    return pages


def _excerpt(page_text: str, start: int, end: int, limit: int = 200) -> str:
    snippet = re.sub(r"\s+", " ", page_text[max(0, start - EXCERPT_RADIUS) : end + EXCERPT_RADIUS])
    return snippet.strip()[:limit]


def _search_pages(
    pages: list[str], pattern: re.Pattern[str]
) -> tuple[int, re.Match[str], str] | None:
    for number, page_text in enumerate(pages, start=1):
        match = pattern.search(page_text)
        if match is not None:
            return number, match, page_text
    return None


def extract_cnj(pages: list[str]) -> ExtractedField:
    found = _search_pages(pages, CNJ_RE)
    if found is None:
        return ExtractedField(value=None)
    number, match, page_text = found
    return ExtractedField(
        value=normalize_cnj(match.group(0)),
        page=number,
        excerpt=_excerpt(page_text, match.start(), match.end()),
    )


def extract_uf(pages: list[str]) -> ExtractedField:
    upper_pages = [page.upper() for page in pages]
    found = _search_pages(upper_pages, COMARCA_RE)
    if found is not None:
        number, match, _ = found
        candidate = match.group(2)
        if candidate in VALID_UFS:
            original = pages[number - 1]
            position = original.upper().find(match.group(0))
            if position == -1:
                position = 0
            return ExtractedField(
                value=candidate,
                page=number,
                excerpt=_excerpt(original, position, position + len(match.group(0))),
            )
    counter: Counter[str] = Counter()
    first_seen: dict[str, tuple[int, int, int]] = {}
    for number, page_text in enumerate(upper_pages, start=1):
        for match in GENERIC_UF_RE.finditer(page_text):
            candidate = match.group(1)
            if candidate in VALID_UFS:
                counter[candidate] += 1
                first_seen.setdefault(candidate, (number, match.start(), match.end()))
    if not counter:
        return ExtractedField(value=None)
    winner = sorted(counter.items(), key=lambda item: (-item[1], first_seen[item[0]][0]))[0][0]
    number, start, end = first_seen[winner]
    return ExtractedField(
        value=winner, page=number, excerpt=_excerpt(pages[number - 1], start, end)
    )


def extract_valor_causa(pages: list[str]) -> ExtractedField:
    for pattern in (VALOR_RE, VALOR_FALLBACK_RE):
        found = _search_pages(pages, pattern)
        if found is None:
            continue
        number, match, page_text = found
        try:
            value = parse_brl_amount(match.group(1))
        except ValueError:
            continue
        return ExtractedField(
            value=round(value, 2),
            page=number,
            excerpt=_excerpt(page_text, match.start(), match.end()),
        )
    return ExtractedField(value=None)


def _extract_marker_field(
    pages: list[str], pattern: re.Pattern[str], value: str
) -> ExtractedField:
    found = _search_pages(pages, pattern)
    if found is None:
        return ExtractedField(value=None)
    number, match, page_text = found
    return ExtractedField(
        value=value, page=number, excerpt=_excerpt(page_text, match.start(), match.end())
    )


def extract_fields(pages: list[str]) -> AutosFields:
    return AutosFields(
        cnj=extract_cnj(pages),
        uf=extract_uf(pages),
        assunto=_extract_marker_field(pages, ASSUNTO_RE, ASSUNTO_DEFAULT),
        subassunto=_extract_marker_field(pages, SUBASSUNTO_RE, SUBASSUNTO_DEFAULT),
        valor_causa=extract_valor_causa(pages),
    )


def strip_accents(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")


def build_page_texts(pdf_path: Path) -> tuple[list[str], list[int]]:
    """Return final per-page texts preferring native text; OCR only fills weak pages."""
    native_pages = extract_native_pages(pdf_path)
    final_pages: list[str] = []
    ocr_pages: list[int] = []
    for number, native_text in enumerate(native_pages, start=1):
        if len(re.sub(r"\s+", "", native_text)) >= MIN_NATIVE_CHARS:
            final_pages.append(native_text)
            continue
        try:
            ocr_text = ocr_page_text(pdf_path, number)
        except OcrUnavailableError as exc:
            raise AutosExtractionError(
                "OCR_REQUIRED",
                f"A página {number} não possui texto suficiente e o OCR está indisponível; "
                "tente novamente mais tarde",
            ) from exc
        ocr_pages.append(number)
        final_pages.append(ocr_text)
    if not any(page.strip() for page in final_pages):
        raise AutosExtractionError(
            "EXTRACTION_EMPTY", "Não foi possível extrair texto do PDF; tente novamente"
        )
    return final_pages, ocr_pages


def apply_extraction(intake: CaseIntake, pages: list[str], ocr_pages: list[int]) -> None:
    fields = extract_fields(pages)
    intake.page_count = len(pages)
    intake.ocr_pages_json = json.dumps(ocr_pages)
    intake.cnj = fields.cnj.value if isinstance(fields.cnj.value, str) else None
    intake.cnj_page = fields.cnj.page
    intake.cnj_excerpt = fields.cnj.excerpt
    intake.uf = fields.uf.value if isinstance(fields.uf.value, str) else None
    intake.uf_page = fields.uf.page
    intake.uf_excerpt = fields.uf.excerpt
    intake.assunto = fields.assunto.value if isinstance(fields.assunto.value, str) else None
    intake.assunto_page = fields.assunto.page
    intake.assunto_excerpt = fields.assunto.excerpt
    intake.subassunto = (
        fields.subassunto.value if isinstance(fields.subassunto.value, str) else None
    )
    intake.subassunto_page = fields.subassunto.page
    intake.subassunto_excerpt = fields.subassunto.excerpt
    intake.valor_causa = (
        fields.valor_causa.value if isinstance(fields.valor_causa.value, (int, float)) else None
    )
    intake.valor_causa_page = fields.valor_causa.page
    intake.valor_causa_excerpt = fields.valor_causa.excerpt
    intake.status = IntakeStatus.NEEDS_REVIEW
    intake.stage = "NEEDS_REVIEW"
    intake.progress_percent = 100
    intake.safe_error = None
    intake.updated_at = utc_now()


def _fail_intake(session: Session, intake_id: str, message: str) -> None:
    intake = session.get(CaseIntake, intake_id)
    if intake is None:
        return
    intake.status = IntakeStatus.FAILED
    intake.stage = "FAILED"
    intake.progress_percent = 100
    intake.safe_error = message
    intake.updated_at = utc_now()
    session.add(intake)
    session.commit()


def run_intake_extraction(intake_id: str) -> None:
    """Background worker: native text first, selective OCR, then field structuring."""
    with Session(get_engine()) as session:
        intake = session.get(CaseIntake, intake_id)
        if intake is None or intake.status not in (
            IntakeStatus.UPLOADED,
            IntakeStatus.EXTRACTING,
        ):
            return
        intake.status = IntakeStatus.EXTRACTING
        intake.stage = "EXTRACTING_TEXT"
        intake.progress_percent = 10
        intake.updated_at = utc_now()
        session.add(intake)
        session.commit()

        try:
            pages, ocr_pages = build_page_texts(Path(intake.stored_path))
            apply_extraction(intake, pages, ocr_pages)
            session.add(intake)
            session.commit()
        except AutosExtractionError as exc:
            logger.warning("Intake %s extraction failed: %s", intake_id, exc.code)
            session.rollback()
            _fail_intake(session, intake_id, exc.safe_message)
        except Exception:
            logger.exception("Unexpected intake extraction failure for %s", intake_id)
            session.rollback()
            _fail_intake(
                session, intake_id, "Não foi possível concluir a extração; tente novamente"
            )


def recover_abandoned_intakes(session: Session) -> None:
    """Mark intakes interrupted by a restart as FAILED without deleting the PDF."""
    rows = session.exec(
        select(CaseIntake).where(
            CaseIntake.status.in_([IntakeStatus.UPLOADED, IntakeStatus.EXTRACTING])
        )
    ).all()
    now = utc_now()
    for intake in rows:
        intake.status = IntakeStatus.FAILED
        intake.stage = "FAILED_ON_RESTART"
        intake.progress_percent = 100
        intake.safe_error = "Extração interrompida pelo reinício da API; tente novamente"
        intake.updated_at = now
        session.add(intake)
    session.commit()
