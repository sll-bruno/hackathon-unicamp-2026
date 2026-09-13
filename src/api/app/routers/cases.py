from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from app.core.config import Settings, get_settings
from app.core.database import get_session
from app.core.errors import APIError
from app.models import (
    Action,
    Case,
    CaseStatus,
    CaseStatusHistory,
    Document,
    DocumentOrigin,
    DocumentType,
)
from app.models.domain import utc_now
from app.schemas import CaseCreate, CasePatch, DocumentPatch
from app.services.domain import (
    commit_or_conflict,
    ensure_status,
    get_case_or_404,
    get_document_or_404,
    serialize_case,
    serialize_document,
    transition_case,
)

router = APIRouter(tags=["cases"])


@router.get("/cases")
def list_cases(
    search: str | None = None,
    case_status: CaseStatus | None = Query(default=None, alias="status"),
    action: Action | None = None,
    is_demo: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
) -> dict:
    statement = select(Case).order_by(Case.created_at.desc())
    if case_status is not None:
        statement = statement.where(Case.status == case_status)
    if is_demo is not None:
        statement = statement.where(Case.is_demo == is_demo)
    cases = list(session.exec(statement).all())
    if search:
        needle = search.casefold()
        cases = [
            case
            for case in cases
            if needle in case.cnj.casefold()
            or needle in case.assunto.casefold()
            or needle in case.subassunto.casefold()
            or needle in (case.plaintiff_name or "").casefold()
        ]
    serialized = [serialize_case(session, case) for case in cases]
    if action is not None:
        serialized = [
            item
            for item in serialized
            if item["recommendation"] and item["recommendation"]["action"] == action.value
        ]
    total = len(serialized)
    start = (page - 1) * page_size
    return {
        "items": serialized[start : start + page_size],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.get("/cases/summary")
def cases_summary(session: Session = Depends(get_session)) -> dict:
    cases = session.exec(select(Case)).all()
    by_status = {case_status.value: 0 for case_status in CaseStatus}
    for case in cases:
        by_status[case.status.value] += 1
    return {"total": len(cases), "by_status": by_status}


@router.post("/cases", status_code=status.HTTP_201_CREATED)
def create_case(payload: CaseCreate, session: Session = Depends(get_session)) -> dict:
    flags = payload.subsidy_flags
    case = Case(
        cnj=payload.cnj,
        uf=payload.uf,
        assunto=payload.assunto,
        subassunto=payload.subassunto,
        valor_causa=payload.valor_causa,
        plaintiff_name=payload.plaintiff_name,
        court=payload.court,
        contract_number=payload.contract_number,
        **flags.model_dump(),
    )
    session.add(case)
    session.add(
        CaseStatusHistory(
            case_id=case.id,
            from_status=None,
            to_status=CaseStatus.RASCUNHO,
            actor="LAWYER",
        )
    )
    commit_or_conflict(session, "CNJ_ALREADY_EXISTS", "Já existe um caso com este CNJ")
    session.refresh(case)
    return serialize_case(session, case)


@router.get("/cases/{case_id}")
def get_case(case_id: str, session: Session = Depends(get_session)) -> dict:
    return serialize_case(session, get_case_or_404(session, case_id))


@router.patch("/cases/{case_id}")
def update_case(case_id: str, payload: CasePatch, session: Session = Depends(get_session)) -> dict:
    case = get_case_or_404(session, case_id)
    ensure_status(
        case,
        {CaseStatus.RASCUNHO, CaseStatus.DOCUMENTOS_ENVIADOS},
        "ser alterado",
    )
    values = payload.model_dump(exclude_unset=True)
    flags = values.pop("subsidy_flags", None)
    for field, value in values.items():
        setattr(case, field, value)
    if flags is not None:
        for field, value in flags.items():
            setattr(case, field, value)
    case.updated_at = utc_now()
    session.add(case)
    commit_or_conflict(session, "CNJ_ALREADY_EXISTS", "Já existe um caso com este CNJ")
    session.refresh(case)
    return serialize_case(session, case)


@router.post("/cases/{case_id}/documents", status_code=status.HTTP_201_CREATED)
async def upload_document(
    case_id: str,
    document_type: DocumentType = Form(alias="type"),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    case = get_case_or_404(session, case_id)
    ensure_status(
        case,
        {CaseStatus.RASCUNHO, CaseStatus.DOCUMENTOS_ENVIADOS},
        "receber documentos",
    )
    original_name = Path(file.filename or "document.pdf").name
    if Path(original_name).suffix.lower() != ".pdf":
        raise APIError(422, "INVALID_FILE_TYPE", "Apenas arquivos PDF são aceitos")
    if file.content_type not in {
        "application/pdf",
        "application/x-pdf",
        "application/octet-stream",
    }:
        raise APIError(422, "INVALID_FILE_TYPE", "Apenas arquivos PDF são aceitos")

    target_dir = settings.storage_dir.resolve() / case.id
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{uuid4()}.pdf"
    size = 0
    signature = b""
    try:
        with target.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                if not signature:
                    signature = chunk[:5]
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    raise APIError(
                        413,
                        "FILE_TOO_LARGE",
                        f"O PDF excede o limite de {settings.max_upload_bytes} bytes",
                    )
                output.write(chunk)
        if signature != b"%PDF-":
            raise APIError(422, "INVALID_PDF", "O arquivo não possui uma assinatura PDF válida")
    except Exception:
        target.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    document = Document(
        case_id=case.id,
        type=document_type,
        original_name=original_name,
        stored_path=str(target),
        origin=DocumentOrigin.UPLOAD,
    )
    session.add(document)
    transition_case(session, case, CaseStatus.DOCUMENTOS_ENVIADOS, "LAWYER")
    session.commit()
    session.refresh(document)
    return serialize_document(document)


@router.patch("/documents/{document_id}")
def update_document(
    document_id: str,
    payload: DocumentPatch,
    session: Session = Depends(get_session),
) -> dict:
    document = get_document_or_404(session, document_id)
    case = get_case_or_404(session, document.case_id)
    ensure_status(
        case,
        {CaseStatus.RASCUNHO, CaseStatus.DOCUMENTOS_ENVIADOS},
        "ter o tipo de documento alterado",
    )
    document.type = payload.type
    session.add(document)
    session.commit()
    session.refresh(document)
    return serialize_document(document)


@router.get("/documents/{document_id}/file")
def download_document(
    document_id: str,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    document = get_document_or_404(session, document_id)
    path = Path(document.stored_path).resolve()
    allowed_roots = [settings.storage_dir.resolve(), settings.data_dir.resolve()]
    if not any(path.is_relative_to(root) for root in allowed_roots) or not path.is_file():
        raise APIError(404, "FILE_NOT_FOUND", "Arquivo do documento não encontrado")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=document.original_name,
        content_disposition_type="inline",
    )
