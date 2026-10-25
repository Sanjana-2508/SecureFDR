from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..security import get_current_user


router = APIRouter(prefix="/fdrs", tags=["fdr-documents"])

# Files are stored outside the public frontend directory.
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def get_authorized_fdr(
    fdr_id: int,
    user: models.User,
    db: Session,
):
    """Return an FDR only if the current user may access it."""
    fdr = db.get(models.FDRRecord, fdr_id)

    if not fdr:
        raise HTTPException(status_code=404, detail="FDR not found")

    if (
        user.role == models.ROLE_INSTITUTION
        and fdr.institution_id != user.institution_id
    ):
        raise HTTPException(
            status_code=403,
            detail="You cannot access another institution's FDR",
        )

    if user.role not in (
        models.ROLE_INSTITUTION,
        models.ROLE_OFFICER,
        models.ROLE_ADMIN,
    ):
        raise HTTPException(status_code=403, detail="Access denied")

    return fdr


def document_out(document: models.FDRDocument):
    """Return safe document metadata without exposing the disk path."""
    return {
        "id": document.id,
        "fdr_id": document.fdr_id,
        "doc_type": document.doc_type,
        "filename": document.filename,
        "uploaded_by_id": document.uploaded_by_id,
        "uploaded_at": (
            document.uploaded_at.isoformat()
            if document.uploaded_at
            else None
        ),
    }


@router.post("/{fdr_id}/documents", status_code=201)
async def upload_document(
    fdr_id: int,
    file: UploadFile = File(...),
    doc_type: str = Form("FDR_COPY"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    # Only institution users may upload certificates.
    if user.role != models.ROLE_INSTITUTION:
        raise HTTPException(
            status_code=403,
            detail="Only institution users can upload FDR documents",
        )

    get_authorized_fdr(fdr_id, user, db)

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    original_name = file.filename.replace("\\", "/").split("/")[-1]

    if not original_name.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed",
        )

    if not doc_type.strip() or len(doc_type.strip()) > 50:
        raise HTTPException(
            status_code=422,
            detail="Document type must contain 1–50 characters",
        )

    # Read at most 5 MB + 1 byte so oversized uploads are rejected.
    content = await file.read(MAX_FILE_SIZE + 1)
    await file.close()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File exceeds the 5 MB limit",
        )

    # Check the PDF signature; filename and MIME type alone aren't enough.
    if not content.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid PDF",
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Never use a client-supplied filename as the disk filename.
    stored_name = f"fdr_{fdr_id}_{uuid4().hex}.pdf"
    disk_path = UPLOAD_DIR / stored_name

    try:
        disk_path.write_bytes(content)

        document = models.FDRDocument(
            fdr_id=fdr_id,
            doc_type=doc_type.strip(),
            filename=original_name[:255],
            stored_path=stored_name,
            uploaded_by_id=user.id,
        )

        db.add(document)
        db.flush()

        db.add(
            models.AuditLog(
                user_id=user.id,
                action="FDR_DOCUMENT_UPLOADED",
                entity="fdr_document",
                entity_id=document.id,
                details=f"PDF uploaded for FDR ID {fdr_id}",
            )
        )

        db.commit()
        db.refresh(document)

        return document_out(document)

    except Exception:
        db.rollback()

        # Remove the saved file if the database transaction fails.
        if disk_path.exists():
            disk_path.unlink()

        raise HTTPException(
            status_code=500,
            detail="Unable to save the document",
        )


@router.get("/{fdr_id}/documents")
def list_documents(
    fdr_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    get_authorized_fdr(fdr_id, user, db)

    documents = (
        db.query(models.FDRDocument)
        .filter(models.FDRDocument.fdr_id == fdr_id)
        .order_by(models.FDRDocument.uploaded_at.desc())
        .all()
    )

    return [document_out(document) for document in documents]


@router.get("/{fdr_id}/documents/{document_id}")
def download_document(
    fdr_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    get_authorized_fdr(fdr_id, user, db)

    document = db.get(models.FDRDocument, document_id)

    if not document or document.fdr_id != fdr_id:
        raise HTTPException(
            status_code=404,
            detail="Document not found for this FDR",
        )

    # Use only the server-generated filename, never a client-provided path.
    stored_name = Path(document.stored_path).name

    if stored_name != document.stored_path:
        raise HTTPException(status_code=404, detail="Document not found")

    disk_path = UPLOAD_DIR / stored_name

    if not disk_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Stored document is missing",
        )

    return FileResponse(
        path=str(disk_path),
        media_type="application/pdf",
        filename=document.filename,
    )