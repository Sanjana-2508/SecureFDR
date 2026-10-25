from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..security import get_current_user

router = APIRouter(
    prefix="/fdrs",
    tags=["FDR Renewals"],
)


# -------------------- REQUEST SCHEMA --------------------

class FDRRenewalCreate(BaseModel):
    bank_name: str = Field(min_length=2, max_length=150)
    reference_no: str = Field(min_length=2, max_length=100)
    amount: float = Field(gt=0)
    issue_date: date
    maturity_date: date

    model_config = ConfigDict(str_strip_whitespace=True)


# -------------------- RENEW FDR --------------------

@router.post("/{fdr_id}/renew", status_code=201)
def renew_fdr(
    fdr_id: int,
    data: FDRRenewalCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # Only institutions can submit renewal records.
    if user.role != models.ROLE_INSTITUTION:
        raise HTTPException(
            status_code=403,
            detail="Only institutions can submit FDR renewals.",
        )

    # Find the original FDR.
    original = db.get(models.FDRRecord, fdr_id)

    if not original:
        raise HTTPException(
            status_code=404,
            detail="Original FDR not found.",
        )

    # Verify institution ownership.
    if original.institution_id != user.institution_id:
        raise HTTPException(
            status_code=403,
            detail="This FDR does not belong to your institution.",
        )

    # Prevent renewal of an FDR that is already renewed or released.
    if original.status not in (
        models.FDR_VERIFIED,
        models.FDR_MATURED,
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Only verified or matured FDRs can be renewed. "
                f"Current status: {original.status}."
            ),
        )

    # Validate dates.
    if data.maturity_date <= data.issue_date:
        raise HTTPException(
            status_code=400,
            detail="Maturity date must be after the issue date.",
        )

    if data.issue_date < original.issue_date:
        raise HTTPException(
            status_code=400,
            detail="The new issue date cannot precede the original issue date.",
        )

    # Prevent duplicate reference numbers.
    duplicate = (
        db.query(models.FDRRecord)
        .filter(
            models.FDRRecord.reference_no == data.reference_no
        )
        .first()
    )

    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="This FDR reference number already exists.",
        )

    # Create the replacement/renewed FDR.
    new_fdr = models.FDRRecord(
        institution_id=original.institution_id,
        bank_name=data.bank_name,
        reference_no=data.reference_no,
        amount=data.amount,
        issue_date=data.issue_date,
        maturity_date=data.maturity_date,
        status=models.FDR_SUBMITTED,
        renewed_from_id=original.id,
        is_simulated_verification=True,
    )

    db.add(new_fdr)
    db.flush()

    # Preserve the old record and link it to the new one.
    original.status = models.FDR_RENEWED

    # Audit the new FDR.
    db.add(
        models.AuditLog(
            user_id=user.id,
            action="FDR_RENEWAL_SUBMITTED",
            entity="fdr_record",
            entity_id=new_fdr.id,
            details=(
                f"New FDR {new_fdr.fdr_uid or new_fdr.id} submitted "
                f"as renewal/replacement for original FDR "
                f"{original.fdr_uid or original.id}."
            ),
        )
    )

    # Audit the original FDR's status change.
    db.add(
        models.AuditLog(
            user_id=user.id,
            action="ORIGINAL_FDR_MARKED_RENEWED",
            entity="fdr_record",
            entity_id=original.id,
            details=(
                f"Original FDR marked RENEWED. "
                f"Replacement FDR ID: {new_fdr.id}."
            ),
        )
    )

    # Notify the institution that submitted the renewal.
    db.add(
        models.Notification(
            user_id=user.id,
            fdr_id=new_fdr.id,
            title="FDR renewal submitted",
            message=(
                f"Renewal FDR {new_fdr.fdr_uid or new_fdr.id} "
                f"has been submitted for verification. "
                f"Original FDR ID: {original.id}."
            ),
            level="info",
        )
    )

    db.commit()
    db.refresh(new_fdr)

    return {
        "message": "FDR renewal submitted successfully.",
        "original_fdr": {
            "id": original.id,
            "fdr_uid": original.fdr_uid,
            "status": original.status,
        },
        "renewed_fdr": {
            "id": new_fdr.id,
            "fdr_uid": new_fdr.fdr_uid,
            "reference_no": new_fdr.reference_no,
            "bank_name": new_fdr.bank_name,
            "amount": new_fdr.amount,
            "issue_date": new_fdr.issue_date.isoformat(),
            "maturity_date": new_fdr.maturity_date.isoformat(),
            "status": new_fdr.status,
            "renewed_from_id": new_fdr.renewed_from_id,
        },
        "note": (
            "This records a renewal/replacement in SecureFDR. "
            "The new FDR must still undergo verification."
        ),
    }
