from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile, status
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from app.core.config import Settings, get_settings
from app.core.database import get_session
from app.core.errors import APIError
from app.models import (
    Case,
    CaseIntake,
    CaseStatus,
    CaseStatusHistory,
    Document,
    DocumentOrigin,
    DocumentType,
    IntakeStatus,
)
from app.schemas import IntakeConfirm
from app.services.autos import (
    EXTRACTION_VERSION,
    normalize_cnj,
    normalize_uf,
    run_intake_extraction,
)
from app.services.domain import commit_or_conflict, serialize_case, serialize_intake

router = APIRouter(tags=["intakes"])

PDF_CONTENT_TYPES = {
    "application/pdf",
    "application/x-pdf",
    "application/octet-stream",
}


def get_intake_or_404(session: Session, intake_id: str) -> CaseIntake:
    intake = session.get(CaseIntake, intake_id)
    if intake is None:
        raise APIError(status.HTTP_404_NOT_FOUND, "INTAKE_NOT_FOUND", "Intake não encontrado")
    return intake


@router.post("/intakes", status_code=status.HTTP_201_CREATED)
async def create_intake(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    original_name = Path(file.filename or "autos.pdf").name
    if Path(original_name).suffix.lower() != ".pdf":
        raise APIError(422, "INVALID_FILE_TYPE", "Apenas arquivos PDF são aceitos")
    if file.content_type not in PDF_CONTENT_TYPES:
        raise APIError(422, "INVALID_FILE_TYPE", "Apenas arquivos PDF são aceitos")

    target_dir = settings.storage_dir.resolve() / "intakes"
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

    intake = CaseIntake(original_name=original_name, stored_path=str(target))
    session.add(intake)
    session.commit()
    session.refresh(intake)
    background_tasks.add_task(run_intake_extraction, intake.id)
    return serialize_intake(intake, EXTRACTION_VERSION)


@router.get("/intakes")
def list_intakes(session: Session = Depends(get_session)) -> dict:
    intakes = session.exec(select(CaseIntake).order_by(CaseIntake.created_at.desc())).all()
    return {
        "items": [serialize_intake(intake, EXTRACTION_VERSION) for intake in intakes],
        "total": len(intakes),
    }


@router.get("/intakes/{intake_id}")
def get_intake(intake_id: str, session: Session = Depends(get_session)) -> dict:
    return serialize_intake(get_intake_or_404(session, intake_id), EXTRACTION_VERSION)


@router.get("/intakes/{intake_id}/file")
def download_intake(
    intake_id: str,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    intake = get_intake_or_404(session, intake_id)
    path = Path(intake.stored_path).resolve()
    allowed_root = settings.storage_dir.resolve()
    if not path.is_relative_to(allowed_root) or not path.is_file():
        raise APIError(404, "FILE_NOT_FOUND", "Arquivo do intake não encontrado")
    return FileResponse(path, media_type="application/pdf", filename=intake.original_name)


@router.post("/intakes/{intake_id}/retry", status_code=status.HTTP_202_ACCEPTED)
def retry_intake(
    intake_id: str,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
) -> dict:
    intake = get_intake_or_404(session, intake_id)
    if intake.status == IntakeStatus.CONFIRMED:
        raise APIError(
            status.HTTP_409_CONFLICT,
            "INTAKE_ALREADY_CONFIRMED",
            "O intake já gerou um caso",
            {"case_id": intake.created_case_id},
        )
    if intake.status in (IntakeStatus.UPLOADED, IntakeStatus.EXTRACTING):
        raise APIError(
            status.HTTP_409_CONFLICT,
            "INTAKE_ALREADY_RUNNING",
            "A extração deste intake já está em andamento",
        )
    intake.status = IntakeStatus.EXTRACTING
    intake.stage = "QUEUED"
    intake.progress_percent = 0
    intake.safe_error = None
    session.add(intake)
    session.commit()
    session.refresh(intake)
    background_tasks.add_task(run_intake_extraction, intake.id)
    return serialize_intake(intake, EXTRACTION_VERSION)


@router.post("/intakes/{intake_id}/confirm", status_code=status.HTTP_201_CREATED)
def confirm_intake(
    intake_id: str,
    payload: IntakeConfirm | None = None,
    session: Session = Depends(get_session),
) -> dict:
    intake = get_intake_or_404(session, intake_id)
    if intake.status == IntakeStatus.CONFIRMED:
        raise APIError(
            status.HTTP_409_CONFLICT,
            "INTAKE_ALREADY_CONFIRMED",
            "O intake já gerou um caso",
            {"case_id": intake.created_case_id},
        )
    if intake.status != IntakeStatus.NEEDS_REVIEW:
        raise APIError(
            status.HTTP_409_CONFLICT,
            "INTAKE_NOT_READY",
            "O intake ainda não está pronto para confirmação",
            {"status": intake.status.value},
        )
    corrections = payload or IntakeConfirm()

    raw_cnj = corrections.cnj or intake.cnj
    try:
        cnj = normalize_cnj(raw_cnj or "")
    except ValueError:
        raise APIError(
            422,
            "INVALID_CNJ",
            "Informe um CNJ válido no formato NNNNNNN-DD.AAAA.J.TR.OOOO",
        ) from None

    uf = normalize_uf(corrections.uf or intake.uf or "")
    if uf is None:
        raise APIError(422, "INVALID_UF", "Informe uma UF válida com 2 letras")

    assunto = (corrections.assunto or intake.assunto or "").strip()
    if not assunto or len(assunto) > 250:
        raise APIError(422, "INVALID_ASSUNTO", "Informe o assunto do processo")

    subassunto = (corrections.subassunto or intake.subassunto or "").strip()
    valor_causa = (
        corrections.valor_causa if corrections.valor_causa is not None else intake.valor_causa
    )
    if valor_causa is None or valor_causa < 0:
        raise APIError(422, "INVALID_VALOR_CAUSA", "Informe um valor da causa válido")

    existing = session.exec(select(Case).where(Case.cnj == cnj)).first()
    if existing is not None:
        raise APIError(
            status.HTTP_409_CONFLICT,
            "CNJ_ALREADY_EXISTS",
            "Já existe um caso com este CNJ",
            {"existing_case_id": existing.id},
        )

    case = Case(
        cnj=cnj,
        uf=uf,
        assunto=assunto,
        subassunto=subassunto,
        valor_causa=valor_causa,
        contrato=False,
        extrato=False,
        comprovante_credito=False,
        dossie=False,
        demonstrativo_divida=False,
        laudo_referenciado=False,
        status=CaseStatus.DOCUMENTOS_ENVIADOS,
    )
    session.add(case)
    session.flush()
    session.add(
        CaseStatusHistory(
            case_id=case.id,
            from_status=None,
            to_status=CaseStatus.DOCUMENTOS_ENVIADOS,
            actor="INTAKE",
        )
    )
    session.add(
        Document(
            case_id=case.id,
            type=DocumentType.AUTOS,
            original_name=intake.original_name,
            stored_path=intake.stored_path,
            origin=DocumentOrigin.UPLOAD,
        )
    )
    intake.status = IntakeStatus.CONFIRMED
    intake.stage = "CONFIRMED"
    intake.progress_percent = 100
    intake.created_case_id = case.id
    session.add(intake)
    commit_or_conflict(session, "CNJ_ALREADY_EXISTS", "Já existe um caso com este CNJ")
    session.refresh(intake)
    session.refresh(case)
    return {
        "intake": serialize_intake(intake, EXTRACTION_VERSION),
        "case": serialize_case(session, case),
    }
