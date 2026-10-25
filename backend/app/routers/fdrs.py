from datetime import date
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from ..security import get_current_user, log_action

router = APIRouter(prefix="/fdrs", tags=["fdrs"])


class FDRCreate(BaseModel):
    bank_name: str = Field(min_length=2, max_length=150)
    reference_no: str = Field(min_length=2, max_length=100)
    amount: float = Field(gt=0, le=1_000_000_000_000)
    issue_date: date
    maturity_date: date

    model_config = ConfigDict(str_strip_whitespace=True)


def fdr_out(f: models.FDRRecord):
    return {
        "id": f.id,
        "fdr_uid": f.fdr_uid,
        "institution_id": f.institution_id,
        "institution": f.institution.name,
        "bank_name": f.bank_name,
        "reference_no": f.reference_no,
        "amount": f.amount,
        "issue_date": f.issue_date.isoformat(),
        "maturity_date": f.maturity_date.isoformat(),
        "status": f.status,
        "verification_remarks": f.verification_remarks,
        "is_simulated_verification": f.is_simulated_verification,
    }


@router.get("")
def list_fdrs(
    status: str = None,
    q: str = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = db.query(models.FDRRecord)

    if user.role == models.ROLE_INSTITUTION:
        query = query.filter(
            models.FDRRecord.institution_id == user.institution_id
        )

    if status:
        query = query.filter(models.FDRRecord.status == status)

    if q:
        like = f"%{q}%"
        query = query.filter(
            models.FDRRecord.reference_no.like(like)
            | models.FDRRecord.bank_name.like(like)
        )

    return [
        fdr_out(f)
        for f in query.order_by(models.FDRRecord.maturity_date).all()
    ]


@router.get("/{fdr_id}")
def get_fdr(
    fdr_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    f = db.get(models.FDRRecord, fdr_id)

    if not f:
        raise HTTPException(404, "FDR not found")

    if (
        user.role == models.ROLE_INSTITUTION
        and f.institution_id != user.institution_id
    ):
        raise HTTPException(
            403, "You cannot access another institution's record"
        )

    return fdr_out(f)


@router.post("", status_code=201)
def create_fdr(
    data: FDRCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if user.role != models.ROLE_INSTITUTION:
        raise HTTPException(
            403, "Only institution users can submit FDR records"
        )

    if not user.institution_id:
        raise HTTPException(
            400, "Your account is not linked to an institution"
        )

    if data.maturity_date <= data.issue_date:
        raise HTTPException(
            422, "Maturity date must be after the issue date"
        )

    duplicate = db.query(models.FDRRecord).filter(
        models.FDRRecord.institution_id == user.institution_id,
        models.FDRRecord.reference_no == data.reference_no,
    ).first()

    if duplicate:
        raise HTTPException(
            409, "An FDR with this reference number already exists"
        )

    record = models.FDRRecord(
        fdr_uid=f"FDR-{uuid4().hex[:12].upper()}",
        institution_id=user.institution_id,
        bank_name=data.bank_name,
        reference_no=data.reference_no,
        amount=data.amount,
        issue_date=data.issue_date,
        maturity_date=data.maturity_date,
        status=models.FDR_SUBMITTED,
        is_simulated_verification=True,
    )

    db.add(record)
    db.flush()

    db.add(
        models.AuditLog(
            user_id=user.id,
            action="FDR_SUBMITTED",
            entity="fdr_record",
            entity_id=record.id,
            details=f"FDR {record.fdr_uid} submitted",
        )
    )

    try:
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        raise HTTPException(500, "Unable to save the FDR record")

    return fdr_out(record)
