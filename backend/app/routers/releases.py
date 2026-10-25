from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..security import get_current_user

router = APIRouter(
    prefix="/release-requests",
    tags=["release requests"],
)


# -------------------- REQUEST SCHEMAS --------------------

class ReleaseRequestCreate(BaseModel):
    fdr_id: int
    reason: str = Field(min_length=5, max_length=1000)

    model_config = ConfigDict(str_strip_whitespace=True)


class ReleaseDecision(BaseModel):
    action: str = Field(
        description="Use REVIEW, OBSERVATION, APPROVE, or REJECT"
    )
    remarks: str = Field(min_length=3, max_length=1000)

    model_config = ConfigDict(str_strip_whitespace=True)


# -------------------- HELPERS --------------------

def release_out(request, db):
    fdr = db.get(models.FDRRecord, request.fdr_id)
    requester = db.get(models.User, request.requested_by_id)

    decider = (
        db.get(models.User, request.decided_by_id)
        if request.decided_by_id
        else None
    )

    return {
        "id": request.id,
        "fdr_id": request.fdr_id,
        "fdr_uid": fdr.fdr_uid if fdr else None,
        "bank_name": fdr.bank_name if fdr else None,
        "amount": fdr.amount if fdr else None,
        "institution_id": fdr.institution_id if fdr else None,
        "institution": (
            fdr.institution.name
            if fdr and fdr.institution
            else None
        ),
        "requested_by_id": request.requested_by_id,
        "requested_by": requester.name if requester else None,
        "reason": request.reason,
        "status": request.status,
        "officer_remarks": request.officer_remarks,
        "decided_by_id": request.decided_by_id,
        "decided_by": decider.name if decider else None,
        "created_at": (
            request.created_at.isoformat()
            if request.created_at
            else None
        ),
        "updated_at": (
            request.updated_at.isoformat()
            if request.updated_at
            else None
        ),
    }


def add_audit(db, user, action, request, details):
    db.add(
        models.AuditLog(
            user_id=user.id,
            action=action,
            entity="release_request",
            entity_id=request.id,
            details=details,
        )
    )


def notify(db, user_id, title, message, level="info", fdr_id=None):
    db.add(
        models.Notification(
            user_id=user_id,
            fdr_id=fdr_id,
            title=title,
            message=message,
            level=level,
        )
    )


def require_officer(user):
    if user.role not in (
        models.ROLE_OFFICER,
        models.ROLE_ADMIN,
    ):
        raise HTTPException(
            status_code=403,
            detail="Only officers or administrators can perform this action.",
        )


def check_request_access(request, user):
    if (
        user.role == models.ROLE_INSTITUTION
        and request.requested_by_id != user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You cannot access this release request.",
        )


# -------------------- CREATE RELEASE REQUEST --------------------

@router.post("", status_code=201)
def create_release_request(
    data: ReleaseRequestCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if user.role != models.ROLE_INSTITUTION:
        raise HTTPException(
            status_code=403,
            detail="Only institutions can request an FDR release.",
        )

    fdr = db.get(models.FDRRecord, data.fdr_id)

    if not fdr:
        raise HTTPException(status_code=404, detail="FDR not found.")

    if fdr.institution_id != user.institution_id:
        raise HTTPException(
            status_code=403,
            detail="This FDR does not belong to your institution.",
        )

    if fdr.status != models.FDR_VERIFIED:
        raise HTTPException(
            status_code=400,
            detail="Only verified FDRs can be submitted for release.",
        )

    active_statuses = [
        models.REL_SUBMITTED,
        models.REL_UNDER_REVIEW,
        models.REL_OBSERVATION,
        models.REL_RESUBMITTED,
        models.REL_APPROVED,
        models.REL_RELEASE_RECORDED,
    ]

    existing = (
        db.query(models.ReleaseRequest)
        .filter(
            models.ReleaseRequest.fdr_id == fdr.id,
            models.ReleaseRequest.status.in_(active_statuses),
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="An active or completed release request already exists for this FDR.",
        )

    request = models.ReleaseRequest(
        fdr_id=fdr.id,
        requested_by_id=user.id,
        reason=data.reason,
        status=models.REL_SUBMITTED,
    )

    db.add(request)
    db.flush()

    add_audit(
        db,
        user,
        "RELEASE_REQUEST_SUBMITTED",
        request,
        f"Release requested for FDR {fdr.fdr_uid}. Reason: {data.reason}",
    )

    db.commit()
    db.refresh(request)

    return release_out(request, db)


# -------------------- LIST RELEASE REQUESTS --------------------

@router.get("")
def list_release_requests(
    status: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    query = db.query(models.ReleaseRequest)

    if user.role == models.ROLE_INSTITUTION:
        query = query.filter(
            models.ReleaseRequest.requested_by_id == user.id
        )
    elif user.role not in (
        models.ROLE_OFFICER,
        models.ROLE_ADMIN,
    ):
        raise HTTPException(status_code=403, detail="Access denied.")

    if status:
        query = query.filter(
            models.ReleaseRequest.status == status.upper()
        )

    requests = query.order_by(
        models.ReleaseRequest.created_at.desc()
    ).all()

    return [release_out(item, db) for item in requests]


# -------------------- GET ONE RELEASE REQUEST --------------------

@router.get("/{request_id}")
def get_release_request(
    request_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    request = db.get(models.ReleaseRequest, request_id)

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Release request not found.",
        )

    if user.role not in (
        models.ROLE_INSTITUTION,
        models.ROLE_OFFICER,
        models.ROLE_ADMIN,
    ):
        raise HTTPException(status_code=403, detail="Access denied.")

    check_request_access(request, user)

    return release_out(request, db)


# -------------------- OFFICER DECISION --------------------

@router.post("/{request_id}/decision")
def decide_release_request(
    request_id: int,
    data: ReleaseDecision,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    require_officer(user)

    request = db.get(models.ReleaseRequest, request_id)

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Release request not found.",
        )

    allowed_statuses = [
        models.REL_SUBMITTED,
        models.REL_UNDER_REVIEW,
        models.REL_OBSERVATION,
        models.REL_RESUBMITTED,
    ]

    if request.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot process a request in status {request.status}.",
        )

    action = data.action.strip().upper()

    status_map = {
        "REVIEW": models.REL_UNDER_REVIEW,
        "OBSERVATION": models.REL_OBSERVATION,
        "APPROVE": models.REL_APPROVED,
        "REJECT": models.REL_REJECTED,
    }

    if action not in status_map:
        raise HTTPException(
            status_code=400,
            detail="Action must be REVIEW, OBSERVATION, APPROVE, or REJECT.",
        )

    fdr = db.get(models.FDRRecord, request.fdr_id)

    if action == "APPROVE":
        if not fdr or fdr.status != models.FDR_VERIFIED:
            raise HTTPException(
                status_code=400,
                detail="Only a verified FDR can be approved for release.",
            )

    request.status = status_map[action]
    request.officer_remarks = data.remarks
    request.decided_by_id = user.id

    add_audit(
        db,
        user,
        f"RELEASE_REQUEST_{action}",
        request,
        data.remarks,
    )

    notify(
        db,
        request.requested_by_id,
        f"Release request {action.lower()}",
        f"Your release request #{request.id} is now {request.status}. "
        f"Remarks: {data.remarks}",
        level="warning" if action in ("OBSERVATION", "REJECT") else "info",
        fdr_id=request.fdr_id,
    )

    db.commit()
    db.refresh(request)

    return release_out(request, db)


# -------------------- RESUBMIT AFTER OBSERVATION --------------------

@router.post("/{request_id}/resubmit")
def resubmit_release_request(
    request_id: int,
    data: ReleaseRequestCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if user.role != models.ROLE_INSTITUTION:
        raise HTTPException(
            status_code=403,
            detail="Only institutions can resubmit release requests.",
        )

    request = db.get(models.ReleaseRequest, request_id)

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Release request not found.",
        )

    check_request_access(request, user)

    if request.status != models.REL_OBSERVATION:
        raise HTTPException(
            status_code=400,
            detail="Only requests with an observation can be resubmitted.",
        )

    if data.fdr_id != request.fdr_id:
        raise HTTPException(
            status_code=400,
            detail="The FDR cannot be changed during resubmission.",
        )

    request.reason = data.reason
    request.status = models.REL_RESUBMITTED
    request.officer_remarks = None
    request.decided_by_id = None

    add_audit(
        db,
        user,
        "RELEASE_REQUEST_RESUBMITTED",
        request,
        data.reason,
    )

    notify(
        db,
        user.id,
        "Release request resubmitted",
        f"Release request #{request.id} has been resubmitted.",
        fdr_id=request.fdr_id,
    )

    db.commit()
    db.refresh(request)

    return release_out(request, db)


# -------------------- RECORD RELEASE --------------------

@router.post("/{request_id}/record-release")
def record_release(
    request_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    require_officer(user)

    request = db.get(models.ReleaseRequest, request_id)

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Release request not found.",
        )

    if request.status != models.REL_APPROVED:
        raise HTTPException(
            status_code=400,
            detail="Only approved release requests can be recorded as released.",
        )

    fdr = db.get(models.FDRRecord, request.fdr_id)

    if not fdr or fdr.status != models.FDR_VERIFIED:
        raise HTTPException(
            status_code=400,
            detail="The associated FDR is not in verified status.",
        )

    request.status = models.REL_RELEASE_RECORDED
    fdr.status = models.FDR_RELEASED

    add_audit(
        db,
        user,
        "FDR_RELEASE_RECORDED",
        request,
        f"Release recorded for FDR {fdr.fdr_uid}. "
        "This records the workflow; it does not transfer funds.",
    )

    notify(
        db,
        request.requested_by_id,
        "FDR release recorded",
        f"Release has been recorded for FDR {fdr.fdr_uid}.",
        fdr_id=fdr.id,
    )

    db.commit()
    db.refresh(request)

    return {
        "message": "FDR release recorded successfully.",
        "request": release_out(request, db),
        "fdr_status": fdr.status,
        "note": "This records the release in SecureFDR; it does not transfer funds.",
    }
